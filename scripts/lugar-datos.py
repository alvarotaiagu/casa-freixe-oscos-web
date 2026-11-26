# «Desde la puerta» · datos del 3D de Casa Freixe (Barcia, Santa Eulalia de Oscos, Asturias).
#
# Fuentes (todas abiertas):
#   - MDT05 y MDT25 del IGN por WCS (servicios.idee.es/wcs-inspire/mdt)                  CC BY 4.0, © IGN
#   - Ortofoto PNOA por WMS (www.ign.es/wms-inspire/pnoa-ma) y WMTS (www.ign.es/wmts/pnoa-ma) CC BY 4.0, © IGN
#   - Edificios del Catastro INSPIRE (ovc.catastro.meh.es, WFS BU)                        © Dirección General del Catastro
#   - Ríos, rutas de senderismo y aldeas de OpenStreetMap (scripts/lugar-osm-api.py)        ODbL, © colaboradores de OSM
# Todo lo descargado se cachea en ref/raw/lugar-cache/ (no viaja a la web). Salida: img/lugar/ (imágenes y alturas),
# data/lugar-escena.json (la escena) y data/lugar.json (la casa y cifras para Web).
#
# Coordenadas locales en metros desde el centro de la casa (Catastro A00300600PH59D, parte 1; ver LUGAR.md):
# x al este, z al sur, y arriba (altura sobre el nivel del mar, la del MDT).
# Alturas en PNG RGB: (R*256 + G) / 10 - 100 = metros.
#
# Uso: python -I -X utf8 scripts/lugar-datos.py      (antes, una vez: scripts/lugar-osm-api.py)
import heapq, io, json, math, pathlib, re, time, urllib.request
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
import tifffile

R = pathlib.Path(__file__).resolve().parent.parent
CACHE = R / 'ref' / 'raw' / 'lugar-cache'; CACHE.mkdir(parents=True, exist_ok=True)
OUT = R / 'img' / 'lugar'; OUT.mkdir(parents=True, exist_ok=True)
DATA = R / 'data'; DATA.mkdir(exist_ok=True)
UA = {'User-Agent': 'datos-mapa-script/1.0 (uso puntual)'}       # sin datos personales

REF_CASA = 'A00300600PH59D'
CASA = (43.286736, -7.030365)                                   # centro de la parte 1 (se recalcula abajo y se comprueba)
KX = 111320 * math.cos(math.radians(CASA[0])); KZ = 111132
def loc(lat, lon): return ((np.asarray(lon) - CASA[1]) * KX, (CASA[0] - np.asarray(lat)) * KZ)
def geo(x, z): return (CASA[0] - np.asarray(z) / KZ, CASA[1] + np.asarray(x) / KX)

# caja cercana (MDT05 + PNOA): de Barcia a Santa Eulalia, la Seimeira y As Talladas
CS, CN, CO, CE = 43.228, 43.300, -7.065, -6.975
# caja lejana (MDT25): los montes de los Oscos y de A Fonsagrada alrededor; alineada con la cercana
DLON, DLAT = (CE - CO) / 36, (CN - CS) / 36
LO, LE = CO - 50 * DLON, CE + 42 * DLON
LS, LN = CS - 34 * DLAT, CN + 40 * DLAT
# el valle (ortofoto fina, WMTS z17) y la aldea (WMTS z19), en metros locales: (x0, z0, x1, z1)
VALLE = (-700.0, -500.0, 1500.0, 1700.0)
ALDEA = (-200.0, -200.0, 200.0, 200.0)


def bajar(url, destino, intentos=5):
    if destino.exists() and destino.stat().st_size > 2000:
        return destino.read_bytes()
    for k in range(intentos):
        try:
            b = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180).read()
            if len(b) < 2000 and b'<' in b[:200]:
                raise IOError(b[:120])
            destino.write_bytes(b); print('bajado', destino.name, len(b) // 1024, 'KB'); return b
        except Exception as e:
            print('falla', destino.name, str(e)[:90]); time.sleep(3 + 4 * k)
    raise SystemExit('No se pudo bajar ' + destino.name)


def wms(S, O, N, E, w, h, nombre):
    url = ('https://www.ign.es/wms-inspire/pnoa-ma?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=OI.OrthoimageCoverage'
           f'&STYLES=&CRS=EPSG:4326&BBOX={S},{O},{N},{E}&WIDTH={w}&HEIGHT={h}&FORMAT=image/jpeg')
    return Image.open(io.BytesIO(bajar(url, CACHE / nombre))).convert('RGB')


def mosaico(S, O, N, E, W, H, nx, ny, base):
    f = CACHE / (base + '.png')
    if f.exists():
        return Image.open(f).convert('RGB')
    im = Image.new('RGB', (W, H))
    for i in range(nx):
        for j in range(ny):
            o, e = O + (E - O) * i / nx, O + (E - O) * (i + 1) / nx
            n, s = N - (N - S) * j / ny, N - (N - S) * (j + 1) / ny
            im.paste(wms(s, o, n, e, W // nx, H // ny, f'{base}-{i}{j}.jpg'), (i * W // nx, j * H // ny))
    im.save(f); return im


def wmts_caja(S, O, N, E, zoom, W, H, nombre):
    """Ortofoto PNOA por teselas WMTS (GoogleMapsCompatible) llevada a la caja lat/lon (W x H; fila 0 = norte, sin espejo)."""
    f = CACHE / (nombre + '.png')
    if f.exists():
        return Image.open(f).convert('RGB')
    n = 2 ** zoom
    tx = lambda lon: (np.asarray(lon, np.float64) + 180) / 360 * n
    ty = lambda lat: (1 - np.arcsinh(np.tan(np.radians(np.asarray(lat, np.float64)))) / np.pi) / 2 * n
    x0, x1, y0, y1 = tx(O), tx(E), ty(N), ty(S)
    cols = range(int(x0), int(x1) + 1); filas = range(int(y0), int(y1) + 1)
    lienzo = Image.new('RGB', (len(cols) * 256, len(filas) * 256))
    tdir = CACHE / f'wmts{zoom}'; tdir.mkdir(exist_ok=True)
    for i, c in enumerate(cols):
        for j, r in enumerate(filas):
            url = ('https://www.ign.es/wmts/pnoa-ma?layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible'
                   f'&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={zoom}&TileCol={c}&TileRow={r}')
            lienzo.paste(Image.open(io.BytesIO(bajar(url, tdir / f'{c}-{r}.jpg'))).convert('RGB'), (i * 256, j * 256))
    a = np.asarray(lienzo, np.float32)
    lat = N - (np.arange(H) + 0.5) / H * (N - S); lon = O + (np.arange(W) + 0.5) / W * (E - O)
    py = (ty(lat) - int(y0)) * 256 - 0.5; px = (tx(lon) - int(x0)) * 256 - 0.5
    PY, PX = np.meshgrid(py, px, indexing='ij')
    out = np.stack([ndimage.map_coordinates(a[..., k], [PY, PX], order=1) for k in range(3)], -1)
    im = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)); im.save(f); return im


def wcs(cov, S, N, O, E, nombre):
    url = ('https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage'
           f'&COVERAGEID={cov}&FORMAT=image/tiff&SUBSET=Lat({S},{N})&SUBSET=Long({O},{E})')
    bajar(url, CACHE / nombre)
    return tifffile.imread(CACHE / nombre).astype(np.float32)


def caja_geo(c):
    """(x0, z0, x1, z1) locales → (S, O, N, E)."""
    x0, z0, x1, z1 = c
    n, o = geo(x0, z0); s, e = geo(x1, z1)
    return float(s), float(o), float(n), float(e)


# ------------------------------------------------------------------ Catastro: la casa (primero: fija el origen)
def poligonos(xml):
    out = []
    for f in re.findall(r'<gml:featureMember>(.*?)</gml:featureMember>', xml, re.S):
        lid = re.search(r'localId>([^<]+)', f)
        pis = re.search(r'numberOfFloorsAboveGround>(\d+)', f)
        anillos = []
        for pl in re.findall(r'<gml:posList[^>]*>([^<]+)</gml:posList>', f):
            v = list(map(float, pl.split()))
            anillos.append([(v[i], v[i + 1]) for i in range(0, len(v), 2)])     # lat lon (EPSG:4258)
        out.append({'id': lid.group(1) if lid else '?', 'pisos': int(pis.group(1)) if pis else 1, 'anillos': anillos})
    return out


bp = poligonos(bajar('https://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx?service=WFS&version=2.0.0&request=GetFeature'
                     '&typenames=BU:BuildingPart&srsname=EPSG::4258&bbox=43.2845,-7.0345,43.2890,-7.0275', CACHE / 'bp-barcia.xml').decode('latin-1'))


def centroide_ll(an):
    A = cx = cy = 0.0
    for i in range(len(an) - 1):
        (y0, x0), (y1, x1) = an[i], an[i + 1]
        c = x0 * y1 - x1 * y0; A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c
    return cy / (3 * A), cx / (3 * A)


p1 = next(b for b in bp if b['id'] == REF_CASA + '_part1')
c_lat, c_lon = centroide_ll(p1['anillos'][0])
assert abs(c_lat - CASA[0]) < 2e-6 and abs(c_lon - CASA[1]) < 2e-6, ('el centro de la casa ha cambiado', c_lat, c_lon)

# ------------------------------------------------------------------ descargas
mdt5 = wcs('Elevacion4258_5', CS, CN, CO, CE, 'mdt5-cerca.tif')
mdt25 = wcs('Elevacion4258_25', 43.16, 43.38, -7.19, -6.87, 'mdt25-lejos.tif')
CAJA25 = (43.16, 43.38, -7.19, -6.87)
orto_c = mosaico(CS, CO, CN, CE, 2400, 2632, 2, 2, 'pnoa-cerca')
orto_l = mosaico(LS, LO, LN, LE, 1600, 1600, 2, 2, 'pnoa-lejos')
S_, O_, N_, E_ = caja_geo(VALLE)
orto_v = wmts_caja(S_, O_, N_, E_, 17, 2048, int(round(2048 * (VALLE[3] - VALLE[1]) / (VALLE[2] - VALLE[0]))), 'pnoa-valle-z17')
S_, O_, N_, E_ = caja_geo(ALDEA)
orto_a = wmts_caja(S_, O_, N_, E_, 19, 1600, 1600, 'pnoa-aldea-z19')
print('MDT05', mdt5.shape, 'MDT25', mdt25.shape, 'valle', orto_v.size)

CAJA5 = (CS, CN, CO, CE)


def muestrea(a, caja, lat, lon, orden=1):
    S, N, O, E = caja
    fil = (N - np.asarray(lat)) / (N - S) * a.shape[0] - 0.5
    col = (np.asarray(lon) - O) / (E - O) * a.shape[1] - 0.5
    return ndimage.map_coordinates(a, [fil, col], order=orden, mode='nearest')


def malla_geo(caja, w, h):
    S, N, O, E = caja
    lat = N - (np.arange(h) + 0.5) / h * (N - S); lon = O + (np.arange(w) + 0.5) / w * (E - O)
    LON, LAT = np.meshgrid(lon, lat)
    return LAT, LON


paso5 = ((CE - CO) * KX / mdt5.shape[1], (CN - CS) * KZ / mdt5.shape[0])
print('paso MDT05 (m):', [round(v, 2) for v in paso5])
mdt5_s = ndimage.gaussian_filter(mdt5, 0.7)


def alt_en(lat, lon):
    lat = np.asarray(lat, np.float64); lon = np.asarray(lon, np.float64)
    a = muestrea(mdt25, CAJA25, lat, lon)
    dentro = (lat >= CS) & (lat <= CN) & (lon >= CO) & (lon <= CE)
    if dentro.any():
        a = np.array(a, np.float64); a[dentro] = muestrea(mdt5_s, CAJA5, lat[dentro], lon[dentro])
    return a


def alt_xz(x, z):
    la, lo = geo(np.atleast_1d(np.asarray(x, np.float64)), np.atleast_1d(np.asarray(z, np.float64))); return alt_en(la, lo)


COTA = float(alt_xz(0, 0)[0])
print('cota de la casa (MDT05, centro):', round(COTA, 1))


def png_alturas(h, nombre):
    v = np.clip(np.round((h + 100.0) * 10), 0, 65535).astype(np.uint16)
    rgb = np.stack([(v >> 8).astype(np.uint8), (v & 255).astype(np.uint8), np.zeros_like(v, np.uint8)], -1)
    Image.fromarray(rgb, 'RGB').save(OUT / nombre, optimize=True)


def rejilla_local(x0, z0, x1, z1, paso):
    nx = int(round((x1 - x0) / paso)) + 1; nz = int(round((z1 - z0) / paso)) + 1
    xs = np.linspace(x0, x1, nx); zs = np.linspace(z0, z1, nz)
    X, Z = np.meshgrid(xs, zs)
    lat, lon = geo(X, Z)
    return X, Z, lat, lon, nx, nz


rasters = {}
cx0, cz0 = loc(CN, CO); cx1, cz1 = loc(CS, CE)
cx0, cz0, cx1, cz1 = float(cx0), float(cz0), float(cx1), float(cz1)
for nombre, (x0, z0, x1, z1, paso) in {
    'cerca': (cx0, cz0, cx1, cz1, 15.0),
    'valle': (VALLE[0], VALLE[1], VALLE[2], VALLE[3], 5.0),
    'aldea': (ALDEA[0], ALDEA[1], ALDEA[2], ALDEA[3], 2.0),
}.items():
    X, Z, lat, lon, nx, nz = rejilla_local(x0, z0, x1, z1, paso)
    h = alt_en(lat, lon)
    png_alturas(h, f'alturas-{nombre}.png')
    rasters[nombre] = {'x0': round(x0, 2), 'z0': round(z0, 2), 'x1': round(x1, 2), 'z1': round(z1, 2), 'w': nx, 'h': nz, 'archivo': f'alturas-{nombre}.png'}
    print('alturas', nombre, nx, 'x', nz, round(float(h.min()), 1), round(float(h.max()), 1))

nlx = int(round((LE - LO) / DLON)) + 1; nlz = int(round((LN - LS) / DLAT)) + 1
lons = LO + np.arange(nlx) * DLON; lats = LN - np.arange(nlz) * DLAT
LON_, LAT_ = np.meshgrid(lons, lats)
hl = alt_en(LAT_, LON_)
png_alturas(hl, 'alturas-lejos.png')
lx0, lz0 = loc(LN, LO); lx1, lz1 = loc(LS, LE)
rasters['lejos'] = {'x0': round(float(lx0), 2), 'z0': round(float(lz0), 2), 'x1': round(float(lx1), 2), 'z1': round(float(lz1), 2), 'w': nlx, 'h': nlz,
                    'archivo': 'alturas-lejos.png',
                    'hueco': [int(round((CO - LO) / DLON)), int(round((LN - CN) / DLAT)), int(round((CE - LO) / DLON)), int(round((LN - CS) / DLAT))]}
print('lejos', nlx, 'x', nlz, 'hueco', rasters['lejos']['hueco'], 'cumbre', round(float(hl.max())))


# ------------------------------------------------------------------ ortofotos
def gradua(img, ref_img):
    a = np.asarray(img, np.float32); b = np.asarray(ref_img, np.float32)
    ma = a.reshape(-1, 3); mb = b.reshape(-1, 3)
    out = (a - ma.mean(0)) / (ma.std(0) + 1e-3) * mb.std(0) + mb.mean(0)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


orto_c.save(OUT / 'orto-cerca-2400.webp', quality=70, method=6)
orto_c.resize((1200, int(round(1200 * orto_c.height / orto_c.width))), Image.LANCZOS).save(OUT / 'orto-cerca-1200.webp', quality=74, method=6)
orto_v.save(OUT / 'orto-valle-2048.webp', quality=70, method=6)
orto_v.resize((1024, int(round(1024 * orto_v.height / orto_v.width))), Image.LANCZOS).save(OUT / 'orto-valle-1024.webp', quality=74, method=6)
orto_a.save(OUT / 'orto-aldea-1600.webp', quality=72, method=6)
orto_a.resize((800, 800), Image.LANCZOS).save(OUT / 'orto-aldea-800.webp', quality=76, method=6)
S, N, O, E = LS, LN, LO, LE
i0 = int((CO - O) / (E - O) * orto_l.width); i1 = int((CE - O) / (E - O) * orto_l.width)
j0 = int((N - CN) / (N - S) * orto_l.height); j1 = int((N - CS) / (N - S) * orto_l.height)
olg = np.asarray(gradua(orto_l, orto_c.resize((i1 - i0, j1 - j0), Image.LANCZOS)), np.float32)
gris = olg.mean(-1, keepdims=True); olg = gris + (olg - gris) * 0.8
Image.fromarray(olg.astype(np.uint8)).save(OUT / 'orto-lejos-1600.webp', quality=68, method=6)


# ------------------------------------------------------------------ el río Barcia (MDT05 + OSM)
# OSM solo tiene el tramo bajo del río Barcia (desde ~1,6 km al sureste de la aldea hasta el Agüeira). El tramo alto, el
# arroyo que baja por Barcia, se saca del MDT05: por dónde baja el agua (relleno de hoyos + D8 de máxima pendiente).
osm = json.loads((R / 'ref' / 'raw' / 'osm' / 'api-todo.json').read_text(encoding='utf-8'))['elements']
H5, W5 = mdt5.shape


def celda(x, z):
    la, lo = geo(x, z)
    return int(round((CN - la) / (CN - CS) * H5 - 0.5)), int(round((lo - CO) / (CE - CO) * W5 - 0.5))


def xz_de_celda(i, j):
    la = CN - (i + 0.5) / H5 * (CN - CS); lo = CO + (j + 0.5) / W5 * (CE - CO)
    x, z = loc(la, lo); return float(x), float(z)


f_rel = CACHE / 'mdt5-relleno-v2.npy'
if f_rel.exists():
    lleno = np.load(f_rel)
else:
    lleno = mdt5.copy(); vis = np.zeros_like(mdt5, bool); pq = []
    for i in range(H5):
        for j in (0, W5 - 1):
            heapq.heappush(pq, (float(mdt5[i, j]), i, j)); vis[i, j] = True
    for j in range(W5):
        for i in (0, H5 - 1):
            if not vis[i, j]:
                heapq.heappush(pq, (float(mdt5[i, j]), i, j)); vis[i, j] = True
    while pq:
        zz, i, j = heapq.heappop(pq)
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                a, b = i + di, j + dj
                if 0 <= a < H5 and 0 <= b < W5 and not vis[a, b]:
                    vis[a, b] = True; lleno[a, b] = max(mdt5[a, b], zz + 1e-3); heapq.heappush(pq, (float(lleno[a, b]), a, b))
    np.save(f_rel, lleno)
Pd = np.pad(lleno, 1, constant_values=1e9)
mejor = np.zeros((H5, W5), np.float32); rec_i = np.zeros((H5, W5), np.int8); rec_j = np.zeros((H5, W5), np.int8)
for di in (-1, 0, 1):
    for dj in (-1, 0, 1):
        if di == 0 and dj == 0:
            continue
        s = (lleno - Pd[1 + di:1 + di + H5, 1 + dj:1 + dj + W5]) / math.hypot(di * paso5[1], dj * paso5[0])
        m_ = s > mejor
        mejor = np.where(m_, s, mejor); rec_i = np.where(m_, di, rec_i); rec_j = np.where(m_, dj, rec_j)
acc_f = CACHE / 'mdt5-acum-v2.npy'
if acc_f.exists():
    acc = np.load(acc_f)
else:
    acc = np.ones(H5 * W5)
    orden = np.argsort(-lleno.ravel(), kind='stable')
    ri, rj = rec_i.ravel(), rec_j.ravel()
    for k in orden:
        if ri[k] == 0 and rj[k] == 0:
            continue
        i, j = divmod(int(k), W5); t = (i + ri[k]) * W5 + (j + rj[k])
        if 0 <= t < H5 * W5:
            acc[t] += acc[k]
    acc = acc.reshape(H5, W5); np.save(acc_f, acc)
area_cel = paso5[0] * paso5[1]

# el río Barcia de OSM (tramo bajo) y el Agüeira (Río Augüeira en OSM)
def cadena(vias):
    pts = []
    vias = [v[:] for v in vias]
    c = vias.pop(0)
    while vias:
        for k, v in enumerate(vias):
            if v[0] == c[-1]: c = c + v[1:]; vias.pop(k); break
            if v[-1] == c[0]: c = v + c[1:]; vias.pop(k); break
            if v[-1] == c[-1]: c = c + v[::-1][1:]; vias.pop(k); break
            if v[0] == c[0]: c = v[::-1] + c[1:]; vias.pop(k); break
        else:
            break
    return c


barcia_osm = cadena([[(p['lat'], p['lon']) for p in e['geometry']] for e in osm
                     if e['type'] == 'way' and e['tags'].get('name') == 'Río Barcia'])
agueira_osm = [[(p['lat'], p['lon']) for p in e['geometry']] for e in osm
               if e['type'] == 'way' and e['tags'].get('name') == 'Río Augüeira']
agueira_osm = cadena(agueira_osm) if agueira_osm else []
bx = [tuple(map(float, loc(la, lo))) for la, lo in barcia_osm]
if math.hypot(*bx[0]) > math.hypot(*bx[-1]):
    bx = bx[::-1]                                             # aguas abajo: de la aldea hacia el Agüeira
print('río Barcia en OSM:', len(bx), 'puntos, empieza en', [round(v) for v in bx[0]], 'acaba en', [round(v) for v in bx[-1]])

# el cauce junto a la aldea: la celda de más cuenca a menos de ~70 m al noroeste de la casa (el arroyo que entra por el
# oeste, ~4 km² de cuenca). De ahí se sube por el afluente mayor hasta ~600 m (cabecera del tramo) y se baja por D8.
i0, j0 = celda(-50.0, -180.0)
blk = acc[i0 - 14:i0 + 15, j0 - 19:j0 + 20]
bi, bj = np.unravel_index(int(np.argmax(blk)), blk.shape)
i, j = i0 - 14 + bi, j0 - 19 + bj
subido = 0.0
for _ in range(400):
    mejor_d = None
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            a, b = i + di, j + dj
            if (di or dj) and 0 <= a < H5 and 0 <= b < W5 and a + rec_i[a, b] == i and b + rec_j[a, b] == j:
                if mejor_d is None or acc[a, b] > acc[mejor_d]:
                    mejor_d = (a, b)
    if mejor_d is None or acc[mejor_d] * area_cel < 400000 or subido > 600:
        break
    subido += math.hypot((mejor_d[0] - i) * paso5[1], (mejor_d[1] - j) * paso5[0]); i, j = mejor_d
print('cabecera del tramo:', [round(v) for v in xz_de_celda(i, j)], round(float(acc[i, j]) * area_cel / 1e6, 2), 'km² de cuenca')
tramo = []
fin_osm = bx[0]
for _ in range(20000):
    x, z = xz_de_celda(i, j)
    tramo.append((x, z))
    if math.hypot(x - fin_osm[0], z - fin_osm[1]) < 25 or (rec_i[i, j] == 0 and rec_j[i, j] == 0):
        break
    i, j = i + rec_i[i, j], j + rec_j[i, j]
d_union = math.hypot(tramo[-1][0] - fin_osm[0], tramo[-1][1] - fin_osm[1])
print('tramo alto (MDT05):', len(tramo), 'celdas; llega a', round(d_union), 'm del tramo de OSM')
assert d_union < 60, 'el cauce del MDT no llega al río Barcia de OSM'


def suaviza(pts, n=3):
    P = np.array(pts, np.float64)
    for _ in range(n):
        P[1:-1] = 0.25 * P[:-2] + 0.5 * P[1:-1] + 0.25 * P[2:]
    return P


def simplifica(pts, tol):
    pts = [tuple(p) for p in pts]
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True; pila = [(0, len(pts) - 1)]
    while pila:
        a, b = pila.pop(); (ax, az), (bx_, bz) = pts[a], pts[b]; dx, dz = bx_ - ax, bz - az; L = dx * dx + dz * dz
        mx, im = -1, -1
        for q in range(a + 1, b):
            px, pz = pts[q]; t = ((px - ax) * dx + (pz - az) * dz) / L if L else 0; t = max(0, min(1, t))
            d = (ax + t * dx - px) ** 2 + (az + t * dz - pz) ** 2
            if d > mx: mx, im = d, q
        if mx > tol * tol:
            keep[im] = True; pila += [(a, im), (im, b)]
    return [p for p, k in zip(pts, keep) if k]


def remuestrea(pts, paso):
    P = np.array(pts, np.float64); d = np.r_[0, np.cumsum(np.hypot(*np.diff(P, axis=0).T))]
    s = np.arange(0, d[-1], paso)
    return np.stack([np.interp(s, d, P[:, 0]), np.interp(s, d, P[:, 1])], -1), d[-1]


rio_xz = suaviza(tramo + bx, 4)
rio_xz, largo_rio = remuestrea(rio_xz, 6.0)
# el agua va 0,3 m por encima del fondo del MDT y siempre bajando
rio_y = alt_xz(rio_xz[:, 0], rio_xz[:, 1]) + 0.3
rio_y = np.minimum.accumulate(rio_y)
# anchura: de 2,5 m arriba a 7 m al llegar al Agüeira (cuenca del MDT)
anch = []
for x, z in rio_xz:
    i, j = celda(x, z); i = min(max(i, 0), H5 - 1); j = min(max(j, 0), W5 - 1)
    a_km2 = float(acc[max(0, i - 2):i + 3, max(0, j - 2):j + 3].max()) * area_cel / 1e6
    anch.append(round(float(np.clip(2.0 + 1.6 * math.sqrt(a_km2), 2.0, 7.0)), 1))
RIO = [[round(float(x), 1), round(float(y), 2), round(float(z), 1), w] for (x, z), y, w in zip(rio_xz, rio_y, anch)]
d_rio = np.hypot(rio_xz[:, 0], rio_xz[:, 1])
k_cerca = int(np.argmin(d_rio))
print('río Barcia:', round(largo_rio), 'm modelados; pasa a', round(float(d_rio[k_cerca])), 'm de la casa, a', round(float(rio_y[k_cerca]), 1), 'm')

ag_xz = [tuple(map(float, loc(la, lo))) for la, lo in agueira_osm]
ag_xz = [p for p in ag_xz if cx0 + 50 < p[0] < cx1 - 50 and cz0 + 50 < p[1] < cz1 - 50]
ag, _ = remuestrea(suaviza(ag_xz, 2), 10.0)
ag_y = np.minimum.accumulate(alt_xz(ag[:, 0], ag[:, 1]) + 0.3) if ag[0, 0] < ag[-1, 0] else alt_xz(ag[:, 0], ag[:, 1]) + 0.3
AGUEIRA = [[round(float(x), 1), round(float(y), 2), round(float(z), 1), 8.0] for (x, z), y in zip(ag, ag_y)]


# ------------------------------------------------------------------ rutas de senderismo con trazado en OSM
def une_miembros(rel):
    trozos = [[(p['lat'], p['lon']) for p in m['geometry']] for m in rel['members'] if m.get('type') == 'way' and m.get('geometry')]
    cadenas = []
    while trozos:
        c = trozos.pop(0); crece = True
        while crece:
            crece = False
            for k, t in enumerate(trozos):
                if t[0] == c[-1]: c = c + t[1:]
                elif t[-1] == c[-1]: c = c + t[::-1][1:]
                elif t[-1] == c[0]: c = t + c[1:]
                elif t[0] == c[0]: c = t[::-1] + c[1:]
                else: continue
                trozos.pop(k); crece = True; break
        cadenas.append(c)
    return cadenas


RUTAS_OSM = {7728731: 'talladas', 6485046: 'seimeira'}
rutas = []
for e in osm:
    if e['type'] != 'relation' or e['id'] not in RUTAS_OSM:
        continue
    cs = une_miembros(e)
    trazos = []; largo = 0.0
    for c in cs:
        P = [tuple(map(float, loc(la, lo))) for la, lo in c]
        Q, L = remuestrea(P, 8.0) if len(P) > 1 else (np.array(P), 0)
        if len(Q) < 2:
            continue
        largo += L
        y = alt_xz(Q[:, 0], Q[:, 1])
        trazos.append([[round(float(x), 1), round(float(yy), 1), round(float(z), 1)] for (x, z), yy in zip(Q, y)])
    ys = [p[1] for t in trazos for p in t]
    rutas.append({'clave': RUTAS_OSM[e['id']], 'nombre': e['tags']['name'], 'ref': e['tags'].get('ref', ''), 'osm': f"relation/{e['id']}",
                  'trazos': trazos, 'largo_m': round(largo), 'cota_min': round(min(ys)), 'cota_max': round(max(ys))})
    print('ruta', e['tags']['name'], len(trazos), 'trazos,', round(largo), 'm,', round(min(ys)), '-', round(max(ys)), 'm')


# ------------------------------------------------------------------ aldeas y sitios (OSM)
def nodo(nombre=None, cond=None):
    for e in osm:
        t = e['tags']
        if (nombre and t.get('name') == nombre and (e['type'] == 'node')) or (cond and cond(e)):
            g = e.get('geometry')
            if e['type'] == 'node':
                return e['lat'], e['lon'], f"node/{e['id']}"
            if g:
                return float(np.mean([p['lat'] for p in g])), float(np.mean([p['lon'] for p in g])), f"{e['type']}/{e['id']}"
    return None


LUGARES_Q = [
    ('barcia', 'Barcia', 'tu aldea', dict(nombre='Barcia')),
    ('quinta', 'Quintá', None, dict(nombre='Quintá')),
    ('vegacarro', 'Vega del Carro', None, dict(nombre='Vega del Carro')),
    ('millarado', 'Millarado', None, dict(nombre='Millarado')),
    ('cotarelo', 'Cotarelo', None, dict(nombre='Cotarelo')),
    ('castro', 'El Castro', None, dict(nombre='El Castro')),
    ('santalla', 'Santa Eulalia de Oscos', 'Santalla', dict(nombre='Santalla')),
    ('pumares', 'Pumares', 'salida de la Seimeira', dict(nombre='Pumares')),
    ('ferreirela', 'Ferreirela de Baxo', 'Casa natal del Marqués de Sargadelos', dict(cond=lambda e: e['tags'].get('name') == 'Casa Natal del Marqués de Sargadelos')),
    ('mazonovo', 'Mazonovo', 'mazo y ferrería', dict(cond=lambda e: e['tags'].get('name') == 'Conjunto Etnográfico de Mazonovo')),
]
lugares = []
for clave, nombre, sub, q in LUGARES_Q:
    r = nodo(**q)
    if not r:
        print('SIN', nombre); continue
    la, lo, ref = r
    x, z = (float(v) for v in loc(la, lo))
    if not (cx0 < x < cx1 and cz0 < z < cz1):
        print('fuera de la caja', nombre); continue
    y = float(alt_xz(x, z)[0])
    lugares.append({'clave': clave, 'nombre': nombre, 'sub': sub, 'x': round(x, 1), 'y': round(y, 1), 'z': round(z, 1), 'osm': ref,
                    'dist_m': round(math.hypot(x, z))})
lugares.append({'clave': 'casa', 'nombre': 'Casa Freixe', 'sub': f'{round(COTA)} m', 'x': 0.0, 'y': round(COTA + 9, 1), 'z': 0.0, 'osm': None, 'dist_m': 0})
# el río y las rutas también llevan rótulo (en su sitio)
km = int(len(RIO) * 0.35)
lugares.append({'clave': 'rio', 'nombre': 'Río Barcia', 'sub': None, 'x': RIO[km][0], 'y': RIO[km][1] + 3, 'z': RIO[km][2], 'osm': 'way/1247197619', 'dist_m': None})
for r in rutas:
    t = max(r['trazos'], key=len); p = t[len(t) // 2]
    lugares.append({'clave': 'ruta-' + r['clave'], 'nombre': r['nombre'].replace('Ruta de la ', '').replace('Ruta da ', ''), 'sub': r['ref'],
                    'x': p[0], 'y': p[1] + 4, 'z': p[2], 'osm': r['osm'], 'dist_m': None})
for l in lugares:
    print('lugar', l['clave'], l['nombre'], (l['x'], l['z']), round(l['y']), 'm', l['dist_m'])
L_ = {l['clave']: l for l in lugares}


# ------------------------------------------------------------------ edificios del Catastro en la aldea
def rect_orientado(pts):
    P = np.array(pts); mejor_ = None
    for g in np.radians(np.arange(0, 90, 0.5)):
        c, s = math.cos(g), math.sin(g)
        u = P[:, 0] * c + P[:, 1] * s; v = -P[:, 0] * s + P[:, 1] * c
        a = (u.max() - u.min()) * (v.max() - v.min())
        if mejor_ is None or a < mejor_[0]:
            mejor_ = (a, g, (u.max() + u.min()) / 2, (v.max() + v.min()) / 2, u.max() - u.min(), v.max() - v.min())
    a, g, uc, vc, lu, lv = mejor_
    c, s = math.cos(g), math.sin(g)
    cx, cz = uc * c - vc * s, uc * s + vc * c
    if lv > lu:
        lu, lv, g = lv, lu, g + math.pi / 2
    return {'cx': round(cx, 2), 'cz': round(cz, 2), 'largo': round(lu, 2), 'fondo': round(lv, 2), 'ang': round(g, 4), 'area_rect': a}


def area(pts):
    return 0.5 * abs(sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts))))


edificios = []
for b in bp:
    if not b['anillos']:
        continue
    pts = [tuple(float(v) for v in loc(la, lo)) for la, lo in b['anillos'][0]]
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    if area(pts) < 6:
        continue
    rc = rect_orientado(pts)
    hs = alt_xz([p[0] for p in pts], [p[1] for p in pts])
    tipo = 'casa' if b['id'] == REF_CASA + '_part1' else ('casa-anejo' if b['id'] == REF_CASA + '_part2' else 'vecina')
    edificios.append({'id': b['id'], 'tipo': tipo, 'pisos': b['pisos'], 'anillo': [[round(x, 2), round(z, 2)] for x, z in pts],
                      'rect': {k: v for k, v in rc.items() if k != 'area_rect'}, 'rectitud': round(area(pts) / rc['area_rect'], 2),
                      'suelo': round(float(hs.min()), 2), 'suelo_max': round(float(hs.max()), 2)})
casa = next(e for e in edificios if e['tipo'] == 'casa')
# el porche va en el hastial del sureste (las fotos: la torre de la luz a la derecha, en la loma; ver LUGAR.md).
# Se elige el giro (de 180 en 180) que deja +u (el largo) hacia el sureste.
rc = casa['rect']; ang = rc['ang']
if math.cos(ang) * 0.6 + math.sin(ang) * 0.8 < 0:      # (cos, sin) = dirección +u en (x, z); sureste = (+x, +z)
    ang += math.pi
casa['rect']['ang'] = round(ang, 4)
casa['porche'] = {'lado': '+u', 'fondo': 2.4, 'alto': 2.55}
print('la casa:', casa['rect'], 'suelo', casa['suelo'], '-', casa['suelo_max'], '| rumbo del porche', round((90 + math.degrees(ang)) % 360), '°')
print('edificios del Catastro en la aldea:', len(edificios))


# ------------------------------------------------------------------ árboles (copas oscuras de la ortofoto del valle)
ov = np.asarray(orto_v, np.float32); VW, VH = orto_v.size
pv = ((VALLE[2] - VALLE[0]) / VW, (VALLE[3] - VALLE[1]) / VH)
lum = ov.mean(-1); verde = ov[..., 1] - np.maximum(ov[..., 0], ov[..., 2])
fondo_l = ndimage.uniform_filter(lum, 41)
copa = (lum < 0.80 * fondo_l) & (lum < 92) & (verde > -6)
copa = ndimage.binary_opening(copa, iterations=1)
# no en los edificios ni sobre el río
mask_ed = Image.new('L', (VW, VH), 0); dme = ImageDraw.Draw(mask_ed)
apx = lambda x, z: ((x - VALLE[0]) / pv[0], (z - VALLE[1]) / pv[1])
for e in edificios:
    dme.polygon([apx(x, z) for x, z in e['anillo']], fill=255)
mask_ed = ndimage.binary_dilation(np.asarray(mask_ed) > 0, iterations=4)
mask_rio = Image.new('L', (VW, VH), 0)
ImageDraw.Draw(mask_rio).line([apx(p[0], p[2]) for p in RIO], fill=255, width=int(6 / pv[0]))
copa &= ~mask_ed & ~(np.asarray(mask_rio) > 0)
rng = np.random.default_rng(7)
paso_c = 4.5                                                      # m entre candidatos
cand_x = np.arange(VALLE[0] + 2, VALLE[2] - 2, paso_c); cand_z = np.arange(VALLE[1] + 2, VALLE[3] - 2, paso_c)
CX, CZ = np.meshgrid(cand_x, cand_z); CX = CX + rng.uniform(-1.8, 1.8, CX.shape); CZ = CZ + rng.uniform(-1.8, 1.8, CZ.shape)
pix = np.clip((CX - VALLE[0]) / pv[0], 0, VW - 1).astype(int), np.clip((CZ - VALLE[1]) / pv[1], 0, VH - 1).astype(int)
dens = ndimage.uniform_filter(copa.astype(np.float32), 5)
ok = dens[pix[1], pix[0]] > 0.55
arboles = []
for x, z in zip(CX[ok], CZ[ok]):
    r_ = float(rng.uniform(2.6, 4.2)); h_ = float(rng.uniform(9, 16))
    arboles.append([round(float(x), 1), 0.0, round(float(z), 1), round(r_, 1), round(h_, 1)])
A = np.array(arboles)
A[:, 1] = np.round(alt_xz(A[:, 0], A[:, 2]), 1)
arboles = A.tolist()
print('árboles en el valle:', len(arboles))


def tope_arboles(x, z):
    """La altura máxima (copa) de los árboles a menos de su radio + 3 m de (x, z)."""
    if not len(A):
        return -1e9
    d = np.hypot(A[:, 0] - x, A[:, 2] - z)
    m_ = d < A[:, 3] + 3
    return float((A[m_, 1] + A[m_, 4]).max()) if m_.any() else -1e9


# ------------------------------------------------------------------ recorrido de la cámara (p de 0 a 1 con el scroll)
cr = casa['rect']; ca, sa = math.cos(cr['ang']), math.sin(cr['ang'])
def casa_pt(u, v):                                          # u hacia el porche (sureste), v a la izquierda de u
    return (cr['cx'] + u * ca - v * sa, cr['cz'] + u * sa + v * ca)
mitad = cr['largo'] / 2
puerta = casa_pt(mitad + 1.2, -0.8)                         # bajo el porche, delante de la puerta
fuera = casa_pt(mitad + 14, 0)                              # el patio, delante del porche
y_suelo_puerta = float(alt_xz(*puerta)[0]); y_patio = float(alt_xz(*fuera)[0])
k_rio = k_cerca
rio_c = RIO[k_rio]
def rio_en(frac):
    q = RIO[min(len(RIO) - 1, int(frac * (len(RIO) - 1)))]; return q
# índice del río a ~1,3 km (donde gira al este) y la vista final, sobre la loma, mirando a Santalla
k_giro = min(range(len(RIO)), key=lambda q: abs(math.hypot(RIO[q][0] - bx[0][0], RIO[q][2] - bx[0][1])))
sl = L_['santalla']
def pt_rio(k, dy, adelante=40):
    a = RIO[k]; b = RIO[min(len(RIO) - 1, k + max(1, adelante // 6))]
    return [a[0], a[1] + dy, a[2]], [b[0], b[1] + dy * 0.4, b[2]]

rec = []
def kf(p, pos, mira, nota):
    rec.append({'p': p, 'pos': [round(float(v), 1) for v in pos], 'mira': [round(float(v), 1) for v in mira], 'nota': nota})

# 1. la puerta: recién salida del porche, a 4,2 m del suelo, mirando valle abajo (azimut 348°: 0 = +z, 90 = +x).
#    A la altura de los ojos y de frente (azimut 27°) no vale: en el MDT la ladera sube justo delante del porche y
#    llenaba el cuadro. Dos fotogramas intermedios reparten el giro a la derecha (la aldea y luego la casa) para que
#    no dé un latigazo al cruzarse el punto de mira con la cámara.
def mira_az(pos, azg, pitg, d=30.0):
    a_, q_ = math.radians(azg), math.radians(pitg)
    return (pos[0] + math.sin(a_) * math.cos(q_) * d, pos[1] + math.sin(q_) * d, pos[2] + math.cos(a_) * math.cos(q_) * d)
sale = casa_pt(mitad + 4.5, -0.8)
p_sale = (sale[0], float(alt_xz(*sale)[0]) + 4.2, sale[1])
frente = casa_pt(mitad + 26, 6)
p_frente = (frente[0], y_patio + 7, frente[1])
entre = lambda t: tuple(p_sale[k] + (p_frente[k] - p_sale[k]) * t for k in range(3))
kf(0.0, p_sale, mira_az(p_sale, 348, -4), 'la puerta')
kf(0.04, entre(0.22), mira_az(entre(0.22), 305, -7), 'gira hacia la aldea')
kf(0.08, entre(0.62), mira_az(entre(0.62), 248, -10), 'gira hacia la casa')
# 2. sale al patio y se da la vuelta: la casa entera, con su porche
kf(0.12, p_frente, (cr['cx'], casa['suelo'] + 4.5, cr['cz']), 'la casa')
lado = casa_pt(mitad + 20, 30)
kf(0.2, (lado[0], float(alt_xz(*lado)[0]) + 22, lado[1]), (cr['cx'], casa['suelo'] + 3, cr['cz']), 'la casa desde arriba')
# 3 y 4. baja al río (al oeste de la aldea) y sigue el valle aguas abajo, por encima del cauce: un fotograma cada ~70 m
# de río (el cauce suavizado), a la altura que pida lo más alto (relieve o copas) en 45 m a la redonda + 10 m
k_ini = k_rio + 3
via = np.array([[RIO[q][0], RIO[q][2]] for q in range(k_ini, k_giro + 1)])
via = suaviza(via, 30)
via, L_via = remuestrea(via, 10.0)
def techo(x, z, r=45.0):
    xs_ = x + np.array([0, r, -r, 0, 0, r * .7, -r * .7, r * .7, -r * .7]); zs_ = z + np.array([0, 0, 0, r, -r, r * .7, r * .7, -r * .7, -r * .7])
    return max(float(alt_xz(xs_, zs_).max()), tope_arboles(x, z))
alt_via = np.array([techo(x, z) for x, z in via]) + 10.0
alt_via = ndimage.maximum_filter1d(alt_via, 9); alt_via = ndimage.uniform_filter1d(alt_via, 9)
P0, P1 = 0.3, 0.64
n_kf = max(4, int(L_via / 70))
for q in range(n_kf + 1):
    s = q / n_kf; k_ = int(round(s * (len(via) - 1)))
    a = via[k_]; b = via[min(len(via) - 1, k_ + 14)]
    yb = float(alt_xz(b[0], b[1])[0])
    kf(round(P0 + (P1 - P0) * s, 4), (a[0], alt_via[k_], a[1]), (b[0], max(yb, alt_via[k_] - 25), b[1]), 'el río' if q == 0 else 'valle abajo')
# el rótulo del río, donde la cámara lo tiene delante mientras baja por el cauce (de p ≈ 0,3 a 0,45)
q_r = via[int(len(via) * 0.45)]
k_r = min(range(len(RIO)), key=lambda q_: math.hypot(RIO[q_][0] - q_r[0], RIO[q_][2] - q_r[1]))
L_['rio'].update({'x': RIO[k_r][0], 'y': round(RIO[k_r][1] + 3, 1), 'z': RIO[k_r][2]})
# 5. sube y se abre: de la curva del río a lo alto, sobre Vega del Carro, mirando al sur (Santa Eulalia, las aldeas,
#    la Seimeira a la derecha y As Talladas a la izquierda)
g = via[-1]
alto1 = (g[0] - 120, float(alt_xz(g[0] - 120, g[1] - 60)[0]) + 150, g[1] - 60)
kf(0.78, alto1, (sl['x'], sl['y'], sl['z']), 'sube')
# la vista final se busca: el punto (y la altura más baja) desde el que se VEN, sin una loma por medio y dentro de un
# campo de ±30°, Santa Eulalia, Pumares, Ferreirela, Millarado y el centro de las dos rutas (Santalla está en el fondo
# del valle del Agüeira y una loma la tapa desde casi todo el norte)
def centro_ruta(clave):
    t = max(next(r for r in rutas if r['clave'] == clave)['trazos'], key=len); return t[len(t) // 2]
objetivos = [(L_[k]['x'], L_[k]['y'] + 8, L_[k]['z']) for k in ('santalla', 'pumares', 'ferreirela', 'millarado')] +             [(p_[0], p_[1] + 4, p_[2]) for p_ in (centro_ruta('seimeira'), centro_ruta('talladas'))]
cx_o = float(np.mean([o[0] for o in objetivos])); cz_o = float(np.mean([o[2] for o in objetivos])); cy_o = float(np.mean([o[1] for o in objetivos]))
def se_ve(cam, o):
    t = np.linspace(0.03, 0.97, 60); xs_ = cam[0] + (o[0] - cam[0]) * t; ys_ = cam[1] + (o[1] - cam[1]) * t; zs_ = cam[2] + (o[2] - cam[2]) * t
    return bool((alt_xz(xs_, zs_) < ys_ - 2).all())
mejor_v = None
for xc in np.arange(-1200, 3601, 400):
    for zc in np.arange(-800, 2401, 400):
        for hc in (380, 480, 600, 750):
            cam = (float(xc), float(alt_xz(xc, zc)[0]) + hc, float(zc))
            yaw = math.atan2(cx_o - cam[0], cz_o - cam[2])
            vis = 0
            for o in objetivos:
                rel = (math.atan2(o[0] - cam[0], o[2] - cam[2]) - yaw + math.pi) % (2 * math.pi) - math.pi
                if abs(rel) < math.radians(30) and se_ve(cam, o): vis += 1
            nota = vis * 10 - hc / 100 - math.hypot(xc - 300, zc - 800) / 2000
            if mejor_v is None or nota > mejor_v[0]: mejor_v = (nota, cam, vis)
print('vista final: se ven', mejor_v[2], 'de', len(objetivos), 'desde', [round(v) for v in mejor_v[1]])
fin = mejor_v[1]
mira_fin = (cx_o, cy_o - 30, cz_o)
kf(1.0, fin, mira_fin, 'Santa Eulalia y las aldeas')
rec.sort(key=lambda r: r['p'])
for r in rec:
    print('fotograma', r['p'], r['nota'], r['pos'], '→', r['mira'])


def monotona(ps, vs):
    n = len(ps); d = [(vs[i + 1] - vs[i]) / (ps[i + 1] - ps[i]) for i in range(n - 1)]; m = [0.0] * n
    for i in range(1, n - 1):
        if d[i - 1] * d[i] <= 0: m[i] = 0; continue
        h0, h1 = ps[i] - ps[i - 1], ps[i + 1] - ps[i]
        m[i] = 3 * (h0 + h1) / ((2 * h1 + h0) / d[i - 1] + (h1 + 2 * h0) / d[i])
    def f(p):
        if p <= ps[0]: return vs[0]
        if p >= ps[-1]: return vs[-1]
        k = 0
        while k < n - 2 and p > ps[k + 1]: k += 1
        h = ps[k + 1] - ps[k]; t = (p - ps[k]) / h; t2 = t * t; t3 = t2 * t
        return (2 * t3 - 3 * t2 + 1) * vs[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * vs[k + 1] + (t3 - t2) * h * m[k + 1]
    return f


ps = [r['p'] for r in rec]
fpos = [monotona(ps, [r['pos'][k] for r in rec]) for k in range(3)]
fmira = [monotona(ps, [r['mira'][k] for r in rec]) for k in range(3)]

# los árboles que tocan la trayectoria (o tapan la puerta) se quitan: la posición de cada copa es aproximada
quitar = np.zeros(len(A), bool)
holg = []
for p in np.linspace(0, 1, 1200):
    x, y, z = (f(p) for f in fpos)
    d = np.hypot(A[:, 0] - x, A[:, 2] - z)
    toca = (d < A[:, 3] + 4) & (A[:, 1] + A[:, 4] > y - 3)
    quitar |= toca
quitar |= np.hypot(A[:, 0] - fuera[0], A[:, 2] - fuera[1]) < 35
A = A[~quitar]; arboles = A.tolist()
print('árboles quitados por la trayectoria:', int(quitar.sum()), '→ quedan', len(arboles))
for p in np.linspace(0, 1, 1200):
    x, y, z = (f(p) for f in fpos)
    suelo = float(alt_xz(x, z)[0])
    holg.append((p, y - max(suelo, tope_arboles(x, z))))
# vista de comprobación (no viaja a la web): el río, el recorrido y los árboles sobre la ortofoto cercana
chk = orto_c.copy(); dch = ImageDraw.Draw(chk)
a_c = lambda x, z: ((x - cx0) / (cx1 - cx0) * chk.width, (z - cz0) / (cz1 - cz0) * chk.height)
for a in A[::3]:
    px_, pz_ = a_c(a[0], a[2]); dch.point((px_, pz_), fill=(255, 255, 0))
dch.line([a_c(p[0], p[2]) for p in RIO], fill=(0, 200, 255), width=3)
dch.line([a_c(p[0], p[2]) for p in AGUEIRA], fill=(0, 120, 255), width=3)
for r in rutas:
    for t in r['trazos']:
        dch.line([a_c(p[0], p[2]) for p in t], fill=(255, 80, 0), width=3)
dch.line([a_c(fpos[0](p), fpos[2](p)) for p in np.linspace(0, 1, 300)], fill=(255, 0, 255), width=3)
for l in lugares:
    px_, pz_ = a_c(l['x'], l['z']); dch.ellipse([px_ - 5, pz_ - 5, px_ + 5, pz_ + 5], outline=(255, 255, 255), width=2); dch.text((px_ + 7, pz_ - 6), l['nombre'], fill=(255, 255, 255))
chk.resize((1200, int(1200 * chk.height / chk.width))).save(CACHE / 'comprueba-recorrido.jpg', quality=85)
hmin = min([h for h in holg if h[0] > 0.1], key=lambda t: t[1])
hpor = min([h for h in holg if h[0] <= 0.1], key=lambda t: t[1])
print('holgura mínima sobre el suelo y los árboles:', round(hmin[1], 1), 'm en p =', round(hmin[0], 3), '(saliendo del porche:', round(hpor[1], 1), 'm)')
assert hmin[1] > 4 and hpor[1] > 1.2, 'la cámara roza el relieve'


# ------------------------------------------------------------------ plan B (1): el valle desde el aire, con el recorrido
MAPA = (-900.0, -500.0, 2700.0, 4300.0)                      # de Barcia a Santa Eulalia y As Talladas
S_, O_, N_, E_ = caja_geo(MAPA)
fil0 = (CN - N_) / (CN - CS) * orto_c.height; fil1 = (CN - S_) / (CN - CS) * orto_c.height
col0 = (O_ - CO) / (CE - CO) * orto_c.width; col1 = (E_ - CO) / (CE - CO) * orto_c.width
mapa_img = orto_c.crop((int(col0), int(fil0), int(col1), int(fil1)))
MW = 1000; MH = int(round(MW * mapa_img.height / mapa_img.width))
mapa_img.resize((MW, MH), Image.LANCZOS).save(OUT / 'plano-valle-1000.webp', quality=74, method=6)
mapa_img.resize((640, int(round(640 * MH / MW))), Image.LANCZOS).save(OUT / 'plano-valle-640.webp', quality=76, method=6)


def en_mapa(x, z):
    return [round((x - MAPA[0]) / (MAPA[2] - MAPA[0]) * 100, 2), round((z - MAPA[1]) / (MAPA[3] - MAPA[1]) * 100, 2)]


ruta_mapa = [en_mapa(fpos[0](p), fpos[2](p)) for p in np.linspace(0, 1, 140)]
rio_mapa = [en_mapa(p[0], p[2]) for p in RIO[::4]]
rutas_mapa = [{'clave': r['clave'], 'trazos': [[en_mapa(p[0], p[2]) for p in t[::3]] for t in r['trazos']]} for r in rutas]
marcas_mapa = [{'clave': l['clave'], 'pos': en_mapa(l['x'], l['z'])} for l in lugares
               if MAPA[0] < l['x'] < MAPA[2] and MAPA[1] < l['z'] < MAPA[3] and not l['clave'].startswith('ruta-')]


# ------------------------------------------------------------------ plan B (2) y póster: la vista final, dibujada
def vista(W, Hh, pos, mira, fov=44.0):
    """Render por columnas (voxel space): relieve real + ortofoto, con bruma y cielo. Sin WebGL.
    A la derecha de la imagen queda lo que está a la derecha de quien mira (sin espejo) y, mirando hacia abajo,
    el horizonte sube (se comprueba abajo con un punto conocido)."""
    px_, py_, pz_ = pos
    yaw = math.atan2(mira[0] - px_, mira[2] - pz_)
    pitch = math.atan2(mira[1] - py_, math.hypot(mira[0] - px_, mira[2] - pz_))
    f = (Hh / 2) / math.tan(math.radians(fov / 2))
    K = 2000
    d = 15.0 * (40000 / 15.0) ** (np.arange(K) / (K - 1))
    cols = np.arange(W) - W / 2 + 0.5
    ang = yaw - np.arctan(cols / f)
    cosd = np.cos(ang - yaw)
    X = px_ + np.outer(d, np.sin(ang)); Z = pz_ + np.outer(d, np.cos(ang))
    lat, lon = geo(X, Z)
    h = alt_en(lat, lon)
    prof = d[:, None] * cosd[None, :]
    y = Hh / 2 - f * (h - py_) / prof + f * math.tan(pitch)

    def col_de(img, caja):
        S, N, O, E = caja
        fy = (N - lat) / (N - S) * img.shape[0] - 0.5; fx = (lon - O) / (E - O) * img.shape[1] - 0.5
        return np.stack([ndimage.map_coordinates(img[..., c], [fy, fx], order=1, mode='nearest') for c in range(3)], -1)
    color = col_de(olg, (LS, LN, LO, LE))
    dentro_ = (lat >= CS) & (lat <= CN) & (lon >= CO) & (lon <= CE)
    cc = col_de(np.asarray(orto_c, np.float32), CAJA5); color[dentro_] = cc[dentro_]
    e = 10.0
    hx = alt_en(*geo(X + e, Z)); hz = alt_en(*geo(X, Z + e))
    nx_, nz_ = -(hx - h) / e, -(hz - h) / e
    luz = np.array([0.35, 0.6, 0.72]); luz /= np.linalg.norm(luz)
    sh = (nx_ * luz[0] + luz[1] + nz_ * luz[2]) / np.sqrt(nx_ ** 2 + nz_ ** 2 + 1)
    color *= np.clip(0.62 + 0.55 * sh, 0.4, 1.2)[..., None]
    bruma = np.array([200, 208, 214], np.float32)
    kf_ = 1 - np.exp(-(d / 22000.0) ** 2 * 1.6)
    color = color * (1 - kf_[:, None, None]) + bruma * kf_[:, None, None]
    img = np.zeros((Hh, W, 3), np.float32)
    filas = np.arange(Hh)
    yy = np.minimum.accumulate(np.minimum(y, Hh), axis=0)
    cielo_t = np.array([110, 150, 196], np.float32); cielo_h = np.array([222, 228, 232], np.float32)
    for c_ in range(W):
        idx = np.searchsorted(-yy[:, c_], -filas, side='left')
        ok_ = idx < K
        img[ok_, c_] = color[idx[ok_], c_]
        t = np.clip(filas[~ok_] / (Hh * 0.5), 0, 1)[:, None]
        img[~ok_, c_] = cielo_t * (1 - t) + cielo_h * t
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)), (f, yaw, pitch)


def proyecta(pt, pos, f, yaw, pitch, W, Hh):
    dx, dz = pt[0] - pos[0], pt[2] - pos[2]
    fr = dx * math.sin(yaw) + dz * math.cos(yaw); la = -dx * math.cos(yaw) + dz * math.sin(yaw)   # «la»: a la derecha, positivo
    if fr <= 0:
        return None
    return (W / 2 + f * la / fr, Hh / 2 - f * (pt[1] - pos[1]) / fr + f * math.tan(pitch))


# comprobación del sentido: mirando al norte, un punto al este sale a la derecha; mirando abajo, el horizonte sube
_, yaw_n, _ = (None, math.atan2(0, -1), None)
pr = proyecta((100, 0, -1000), (0, 0, 0), 500, yaw_n, 0, 1000, 600)
assert pr[0] > 500, 'vista en espejo'
assert proyecta((0, 0, -1000), (0, 0, 0), 500, yaw_n, -0.2, 1000, 600)[1] < 300, 'cabeceo al revés'

WB, HB = 1600, 1000
pf, mf = rec[-1]['pos'], rec[-1]['mira']
vista_img, (fB, yawB, pitchB) = vista(WB, HB, pf, mf, fov=50.0)
vista_img.save(OUT / 'vista-valle-1600.webp', quality=74, method=6)
vista_img.resize((960, 600), Image.LANCZOS).save(OUT / 'vista-valle-960.webp', quality=76, method=6)
marcas_vista = []
for l in lugares:
    pr = proyecta((l['x'], l['y'] + 6, l['z']), pf, fB, yawB, pitchB, WB, HB)
    if pr and 20 < pr[0] < WB - 20 and 20 < pr[1] < HB - 20:
        marcas_vista.append({'clave': l['clave'], 'x': round(pr[0] / WB * 100, 2), 'y': round(pr[1] / HB * 100, 2)})
rutas_vista = []
for r in rutas:
    tr = []
    for t in r['trazos']:
        q = [proyecta((p[0], p[1] + 2, p[2]), pf, fB, yawB, pitchB, WB, HB) for p in t[::2]]
        q = [[round(v[0] / WB * 100, 2), round(v[1] / HB * 100, 2)] for v in q if v and -50 < v[0] < WB + 50 and -50 < v[1] < HB + 50]
        if len(q) > 1:
            tr.append(q)
    rutas_vista.append({'clave': r['clave'], 'trazos': tr})
# la primera imagen del 3D (la puerta) también, como póster mientras carga
p0, m0 = rec[0]['pos'], rec[0]['mira']
print('vista final, marcas', [m['clave'] for m in marcas_vista])


# ------------------------------------------------------------------ salida
escena = {
    'version': 1,
    'origen': {'lat': CASA[0], 'lon': CASA[1], 'nota': 'centro de la casa (Catastro ' + REF_CASA + ', parte 1)'},
    'kx': round(KX, 3), 'kz': KZ, 'cota': round(COTA, 1),
    'rasters': rasters,
    'orto': {
        'cerca': {'x0': rasters['cerca']['x0'], 'z0': rasters['cerca']['z0'], 'x1': rasters['cerca']['x1'], 'z1': rasters['cerca']['z1'],
                  'archivos': {'alta': 'orto-cerca-2400.webp', 'baja': 'orto-cerca-1200.webp'}},
        'valle': {'x0': VALLE[0], 'z0': VALLE[1], 'x1': VALLE[2], 'z1': VALLE[3], 'archivos': {'alta': 'orto-valle-2048.webp', 'baja': 'orto-valle-1024.webp'}},
        'aldea': {'x0': ALDEA[0], 'z0': ALDEA[1], 'x1': ALDEA[2], 'z1': ALDEA[3], 'archivos': {'alta': 'orto-aldea-1600.webp', 'baja': 'orto-aldea-800.webp'}},
        'lejos': {'x0': rasters['lejos']['x0'], 'z0': rasters['lejos']['z0'], 'x1': rasters['lejos']['x1'], 'z1': rasters['lejos']['z1'],
                  'archivos': {'alta': 'orto-lejos-1600.webp', 'baja': 'orto-lejos-1600.webp'}},
    },
    'casa': casa, 'edificios': [e for e in edificios if e['tipo'] == 'vecina'], 'anejo': [e for e in edificios if e['tipo'] == 'casa-anejo'],
    'rio': RIO, 'agueira': AGUEIRA, 'rutas': rutas, 'arboles': [[round(v, 1) for v in a] for a in arboles],
    'lugares': lugares, 'recorrido': rec,
    'planB': {'mapa': {'archivos': ['plano-valle-640.webp', 'plano-valle-1000.webp'], 'ancho': MW, 'alto': MH, 'caja': list(MAPA),
                       'ruta': ruta_mapa, 'rio': rio_mapa, 'rutas': rutas_mapa, 'marcas': marcas_mapa},
              'vista': {'archivos': ['vista-valle-960.webp', 'vista-valle-1600.webp'], 'ancho': WB, 'alto': HB, 'marcas': marcas_vista, 'rutas': rutas_vista}},
    'fuentes': {
        'ign': 'Relieve MDT05 y MDT25 y ortofoto PNOA © Instituto Geográfico Nacional (CC BY 4.0)',
        'catastro': 'Planta de los edificios © Dirección General del Catastro',
        'osm': 'Río Barcia (tramo bajo), río Agüeira, rutas y aldeas © colaboradores de OpenStreetMap (ODbL)',
    },
    'fecha_datos': time.strftime('%Y-%m-%d'),
}
(DATA / 'lugar-escena.json').write_text(json.dumps(escena, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

lj = json.loads((DATA / 'lugar.json').read_text(encoding='utf-8'))
lj['casa'].update({'lat': CASA[0], 'lon': CASA[1], 'cota': round(COTA)})
lj['rio'] = {'nombre': 'Río Barcia', 'distancia_m': round(float(d_rio[k_cerca])), 'cota_m': round(float(rio_y[k_cerca])),
             'nota': 'distancia en línea recta del centro de la casa al cauce (tramo alto sacado del MDT05)'}
lj['santalla'] = {'recta_m': L_['santalla']['dist_m'], 'cota_m': round(L_['santalla']['y'])}
lj['rutasEnOSM'] = [{'nombre': r['nombre'], 'ref': r['ref'], 'osm': r['osm'], 'largo_km': round(r['largo_m'] / 1000, 1)} for r in rutas]
(DATA / 'lugar.json').write_text(json.dumps(lj, ensure_ascii=False, indent=1), encoding='utf-8')
print('data/lugar-escena.json', round((DATA / 'lugar-escena.json').stat().st_size / 1024), 'KB')
tot = sum(f.stat().st_size for f in OUT.iterdir())
print('img/lugar/', round(tot / 1024), 'KB')

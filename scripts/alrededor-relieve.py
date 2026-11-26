# El relieve sombreado del mapa de «Alrededor» (solo la comarca): MDT25 del IGN (CC BY 4.0), el mismo que baja
# scripts/lugar-datos.py (ref/raw/lugar-cache/mdt25-lejos.tif). Luz del noroeste, en grises cálidos y transparente en
# lo llano, para ir debajo de los ríos, las carreteras y las rutas.
#   python -I -X utf8 scripts/alrededor-relieve.py   → img/lugar/alrededor-relieve.webp y data/alrededor-relieve.json
import json, math, pathlib
import numpy as np
from PIL import Image
from scipy import ndimage
import tifffile

R = pathlib.Path(__file__).resolve().parent.parent
casa = json.loads((R / 'data' / 'lugar.json').read_text(encoding='utf-8'))['casa']
S, N, O, E = 43.16, 43.38, -7.19, -6.87
m = tifffile.imread(R / 'ref' / 'raw' / 'lugar-cache' / 'mdt25-lejos.tif').astype(np.float32)
KX = 111320 * math.cos(math.radians(casa['lat'])); KY = 111132
H, W = m.shape
dx = (E - O) * KX / W; dy = (N - S) * KY / H
m = ndimage.gaussian_filter(m, 0.8)
gy, gx = np.gradient(m, dy, dx)
# luz del noroeste (azimut 315°, 45° de altura); gy crece hacia el sur (fila 0 = norte)
az, alt = math.radians(315), math.radians(45)
lx, ly, lz = math.sin(az) * math.cos(alt), -math.cos(az) * math.cos(alt), math.sin(alt)    # x este, y sur, z arriba
nx, ny, nz = -gx, -gy, np.ones_like(m)
nl = np.sqrt(nx ** 2 + ny ** 2 + 1)
sh = (nx * lx + ny * ly + nz * lz) / nl
plano = lz
# en grises, blanco en lo llano y en las laderas al sol: va con mix-blend-mode: multiply (el blanco no tiñe)
d = sh - plano
g = 255 - np.clip(-d * 2.4, 0, 0.62) * 255
im = Image.fromarray(g.astype(np.uint8), 'L')
im = im.resize((900, int(round(900 * H / W * (dy / dx)))), Image.LANCZOS)
out = R / 'img' / 'lugar'; out.mkdir(parents=True, exist_ok=True)
im.save(out / 'alrededor-relieve.webp', quality=62, method=6)
x0 = (O - casa['lon']) * KX; x1 = (E - casa['lon']) * KX; y0 = -(N - casa['lat']) * KY; y1 = -(S - casa['lat']) * KY
(R / 'data' / 'alrededor-relieve.json').write_text(json.dumps({'archivo': 'img/lugar/alrededor-relieve.webp', 'caja': [round(x0), round(y0), round(x1), round(y1)],
                                                               'fuente': 'MDT25 © Instituto Geográfico Nacional (CC BY 4.0)'}), encoding='utf-8')
print('relieve', im.size, round((out / 'alrededor-relieve.webp').stat().st_size / 1024), 'KB, caja', [round(x0), round(y0), round(x1), round(y1)])

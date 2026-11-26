# Plan B de scripts/lugar-osm.mjs cuando Overpass no responde (502/504 en todos los espejos): la API principal de
# OpenStreetMap (api/0.6/map) por teselas de la comarca, una petición tras otra, y se juntan en un solo JSON con la
# misma forma que Overpass «out geom tags» (vías con geometry, relaciones con sus vías miembro y su geometría).
#   python -I -X utf8 scripts/lugar-osm-api.py   → ref/raw/osm/api-*.xml (caché) y ref/raw/osm/api-todo.json
# ODbL, © colaboradores de OpenStreetMap. User-Agent genérico.
import json, pathlib, time, urllib.request
import xml.etree.ElementTree as ET

R = pathlib.Path(__file__).resolve().parent.parent
D = R / 'ref' / 'raw' / 'osm'; D.mkdir(parents=True, exist_ok=True)
UA = {'User-Agent': 'datos-mapa-script/1.0 (uso puntual)'}
S, O, N, E = 43.20, -7.12, 43.34, -6.92
NY, NX = 5, 5

nodos, vias, rels = {}, {}, {}
for j in range(NY):
    for i in range(NX):
        s = S + (N - S) * j / NY; n = S + (N - S) * (j + 1) / NY
        o = O + (E - O) * i / NX; e = O + (E - O) * (i + 1) / NX
        f = D / f'api-{j}{i}.xml'
        if not f.exists() or f.stat().st_size < 500:
            url = f'https://api.openstreetmap.org/api/0.6/map?bbox={o:.5f},{s:.5f},{e:.5f},{n:.5f}'
            for k in range(4):
                try:
                    f.write_bytes(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180).read()); break
                except Exception as ex:
                    print('falla', f.name, ex); time.sleep(5 + 5 * k)
            print('bajado', f.name, f.stat().st_size // 1024, 'KB'); time.sleep(1.5)
        r = ET.parse(f).getroot()
        for x in r.findall('node'):
            t = {a.get('k'): a.get('v') for a in x.findall('tag')}
            nodos[x.get('id')] = (float(x.get('lat')), float(x.get('lon')), t)
        for w in r.findall('way'):
            vias[w.get('id')] = ([nd.get('ref') for nd in w.findall('nd')], {a.get('k'): a.get('v') for a in w.findall('tag')})
        for rl in r.findall('relation'):
            rels[rl.get('id')] = ([(m.get('type'), m.get('ref'), m.get('role')) for m in rl.findall('member')], {a.get('k'): a.get('v') for a in rl.findall('tag')})


def geom(wid):
    refs = vias[wid][0]
    return [{'lat': nodos[r][0], 'lon': nodos[r][1]} for r in refs if r in nodos]


out = []
for k, (lat, lon, t) in nodos.items():
    if t:
        out.append({'type': 'node', 'id': int(k), 'lat': lat, 'lon': lon, 'tags': t})
for k, (refs, t) in vias.items():
    if t:
        out.append({'type': 'way', 'id': int(k), 'tags': t, 'geometry': geom(k)})
for k, (ms, t) in rels.items():
    if t.get('type') in ('route', 'multipolygon') or t.get('route'):
        out.append({'type': 'relation', 'id': int(k), 'tags': t,
                    'members': [{'type': ty, 'ref': int(rf), 'role': ro, **({'geometry': geom(rf)} if ty == 'way' and rf in vias else {})} for ty, rf, ro in ms]})
(D / 'api-todo.json').write_text(json.dumps({'elements': out}), encoding='utf-8')
print('nodos', len(nodos), 'vías', len(vias), 'relaciones', len(rels), '→ api-todo.json')
for e in out:
    if e['type'] == 'relation' and e['tags'].get('route') in ('hiking', 'foot', 'walking'):
        print('ruta', e['id'], e['tags'].get('name'), e['tags'].get('ref', ''), sum(1 for m in e['members'] if m.get('geometry')), '/', len(e['members']), 'vías con geometría')

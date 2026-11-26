// Distancias de «Alrededor» con OSRM (router.project-osrm.org, perfil coche) y, a pie, con el perfil foot de
// routing.openstreetmap.de. Datos de © colaboradores de OpenStreetMap (ODbL). Receta de
// ../apartamentos-montemar-navia-web/scripts/alrededor-rutas.mjs.
// Origen: la casa de data/lugar.json (Catastro, ver LUGAR.md). Destinos: elementos de OSM con su id (comprobados a
// mano: tipo y etiquetas), sacados de ref/raw/osm/api-todo.json (la comarca) y, los lejanos, de Overpass.
//   node scripts/alrededor-rutas.mjs   → ref/raw/rutas.json   (nada se escribe a ojo)
// Si un servicio no responde, ese destino queda «por confirmar» (sin cifra).
import fs from 'node:fs';
import path from 'node:path';
import { overpass, cacheado, pedirJSON, dormir, hav, RAIZ, CASA } from './alrededor-util.mjs';

const COMARCA = JSON.parse(fs.readFileSync(path.join(RAIZ, 'ref/raw/osm/api-todo.json'), 'utf8')).elements;
const porId = new Map(COMARCA.map((e) => [e.type + '/' + e.id, e]));
const lejos = await cacheado('osm', 'lejanos.json', () => overpass(
  '[out:json][timeout:90];(node["place"~"^(town|village)$"]["name"~"^(Taramundi|A Veiga|Vegadeo|A Veiga / Vegadeo|Ribadeo|A Fonsagrada)$"](43.05,-7.35,43.60,-6.85);' +
  'node["tourism"="information"]["name"="Praia das Catedrais"](43.54,-7.18,43.57,-7.14);way["aeroway"="terminal"](43.55,-6.05,43.575,-6.01););out center tags;'));
lejos.elements.forEach((e) => porId.set(e.type + '/' + e.id, e));
const buscaLejos = (re, tipo) => lejos.elements.find((e) => re.test(e.tags.name || '') && (!tipo || e.tags.place === tipo || e.tags.aeroway === tipo || e.tags.tourism === tipo));

const pt = (e) => {
  if (e.lat != null) return { lat: e.lat, lon: e.lon };
  if (e.center) return { lat: e.center.lat, lon: e.center.lon };
  const g = e.geometry; return { lat: g.reduce((s, p) => s + p.lat, 0) / g.length, lon: g.reduce((s, p) => s + p.lon, 0) / g.length };
};

// grupo: cerca (el concejo), comarca (Oscos-Eo), costa y viaje. pie: también a pie (lo que está a menos de ~6 km).
const LUGARES = [
  { id: 'santalla', nombre: 'Santa Eulalia de Oscos', sub: 'Santalla, la capital del concejo', grupo: 'cerca', pie: true, osm: 'node/203865680' },
  { id: 'sargadelos', nombre: 'Casa natal del Marqués de Sargadelos', sub: 'museo en Ferreirela de Baxo', grupo: 'cerca', pie: true, osm: 'way/509506861' },
  { id: 'seimeira', nombre: 'Ruta de la Seimeira', sub: 'la salida, en el área recreativa de Pumares', grupo: 'cerca', pie: true, osm: 'way/992685441', ruta: 'seimeira' },
  { id: 'talladas', nombre: 'Ruta de la Mina de As Talladas', sub: 'la salida, en Santa Eulalia', grupo: 'cerca', pie: true, osm: 'node/203865680', ruta: 'talladas' },
  { id: 'mazonovo', nombre: 'Conjunto etnográfico de Mazonovo', sub: 'mazo y ferrería', grupo: 'cerca', pie: true, osm: 'node/9168136537' },
  { id: 'ferreira', nombre: 'Ferreira', sub: 'área recreativa junto al Agüeira', grupo: 'cerca', osm: 'node/4489470877' },
  { id: 'sanmartin', nombre: 'San Martín de Oscos', sub: 'Samartín', grupo: 'comarca', osm: 'node/203834023' },
  { id: 'villanueva', nombre: 'Villanueva de Oscos', sub: 'iglesia del monasterio de Santa María', grupo: 'comarca', osm: 'way/1436920559' },
  { id: 'taramundi', nombre: 'Taramundi', grupo: 'comarca', lejano: () => buscaLejos(/^Taramundi$/) },
  { id: 'fonsagrada', nombre: 'A Fonsagrada', grupo: 'comarca', lejano: () => buscaLejos(/Fonsagrada/) },
  { id: 'vegadeo', nombre: 'Vegadeo', sub: 'A Veiga', grupo: 'costa', lejano: () => buscaLejos(/Vegadeo|A Veiga/) },
  { id: 'ribadeo', nombre: 'Ribadeo', grupo: 'costa', lejano: () => buscaLejos(/^Ribadeo$/) },
  { id: 'catedrales', nombre: 'Playa de las Catedrales', sub: 'Praia das Catedrais, el acceso', grupo: 'costa', lejano: () => buscaLejos(/Catedrais/, 'information') },
  { id: 'aeropuerto', nombre: 'Aeropuerto de Asturias', sub: 'la terminal', grupo: 'viaje', lejano: () => buscaLejos(/./, 'terminal') || lejos.elements.find((e) => e.tags.aeroway === 'terminal') },
];

const resumen = (j) => {
  const r = j.routes[0], carreteras = [];
  for (const leg of r.legs) for (const s of leg.steps) {
    const ref = (s.ref || '').split(';')[0].trim();
    if (ref && s.distance > 400 && carreteras[carreteras.length - 1] !== ref && !carreteras.includes(ref)) carreteras.push(ref);
  }
  return { km: +(r.distance / 1000).toFixed(1), minutos: Math.max(1, Math.round(r.duration / 60)), carreteras, snap_destino_m: Math.round(j.waypoints[1].distance) };
};
const resumenPie = (j) => ({ km: +(j.routes[0].distance / 1000).toFixed(1), minutos: Math.max(1, Math.round(j.routes[0].duration / 60)), snap_destino_m: Math.round(j.waypoints[1].distance) });

const salida = {
  fuente: 'OSRM (router.project-osrm.org, perfil coche) y routing.openstreetmap.de/routed-foot (a pie); datos de © colaboradores de OpenStreetMap, ODbL',
  fecha: new Date().toISOString().slice(0, 10),
  nota: 'Tiempos de OSRM con velocidades teóricas, sin tráfico ni paradas: orientativos. A pie: el perfil foot (unos 5 km/h, sin contar las cuestas). snap_destino_m = distancia del punto del lugar al camino más cercano.',
  casa: { lat: CASA.lat, lon: CASA.lon, fuente: 'data/lugar.json (Catastro ' + CASA.refCatastral + ')' },
  orden: LUGARES.map((l) => l.id),
  destinos: {},
};
for (const l of LUGARES) {
  const d = { nombre: l.nombre, sub: l.sub || null, grupo: l.grupo, ruta: l.ruta || null };
  try {
    const e = l.lejano ? l.lejano() : porId.get(l.osm);
    if (!e) throw new Error('sin elemento en OSM');
    const p = pt(e);
    Object.assign(d, { osm: `${e.type}/${e.id}`, osm_nombre: e.tags && e.tags.name, lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6) });
    d.recta_km = +(hav(CASA, d) / 1000).toFixed(2);
    const url = `https://router.project-osrm.org/route/v1/driving/${CASA.lon},${CASA.lat};${d.lon},${d.lat}?overview=full&geometries=geojson&steps=true`;
    const jc = await cacheado('osrm', `coche-${l.id}.json`, () => pedirJSON(url));
    d.coche = resumen(jc);
    if (l.pie) {
      await dormir(800);
      const jp = await cacheado('osrm', `pie-${l.id}.json`, () => pedirJSON(`https://routing.openstreetmap.de/routed-foot/route/v1/driving/${CASA.lon},${CASA.lat};${d.lon},${d.lat}?overview=full&geometries=geojson`));
      d.pie = resumenPie(jp);
    }
  } catch (er) { d.error = er.message; }
  salida.destinos[l.id] = d;
  console.log(l.id.padEnd(11), d.osm || '-', (d.osm_nombre || '').padEnd(34), '| coche', d.coche ? `${d.coche.km} km ${d.coche.minutos} min ${d.coche.carreteras.join(' > ')} (snap ${d.coche.snap_destino_m} m)` : 'POR CONFIRMAR ' + (d.error || ''), d.pie ? `| a pie ${d.pie.km} km ${d.pie.minutos} min` : '', '| recta', d.recta_km);
  await dormir(900);
}
const D = salida.destinos;
salida.contraste = {
  catedrales: { su_web: 'a unos 30 minutos en coche', osrm: D.catedrales.coche ? `${D.catedrales.coche.km} km, ${D.catedrales.coche.minutos} min` : 'por confirmar' },
  santalla: { opinion_er: 'a 5 minutos (en coche)', osrm: D.santalla.coche ? `${D.santalla.coche.km} km, ${D.santalla.coche.minutos} min` : 'por confirmar' },
  mazonovo: { su_web: 'a unos 5 km de Santalla', osrm_desde_la_casa: D.mazonovo.coche ? `${D.mazonovo.coche.km} km` : 'por confirmar' },
};
fs.mkdirSync(path.join(RAIZ, 'ref/raw'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'ref/raw/rutas.json'), JSON.stringify(salida, null, 1));
console.log('contraste', JSON.stringify(salida.contraste, null, 1));

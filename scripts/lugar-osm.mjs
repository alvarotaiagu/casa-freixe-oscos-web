// Datos de OpenStreetMap (ODbL) para «Desde la puerta» y «Alrededor»: rutas de senderismo (relaciones route=hiking/foot
// con su geometría), ríos y arroyos, carreteras y caminos, aldeas y sitios de la comarca.
//   node scripts/lugar-osm.mjs   → ref/raw/osm/*.json (caché; borrar un fichero para pedirlo otra vez)
// Overpass con espejos (scripts/alrededor-util.mjs). User-Agent genérico.
import { overpass, cacheado } from './alrededor-util.mjs';

// la comarca: de Barcia a Santa Eulalia, San Martín, Villanueva y Ferreira (rutas a pie y sitios cercanos)
export const COMARCA = { s: 43.20, o: -7.12, n: 43.34, e: -6.92 };
const B = `${COMARCA.s},${COMARCA.o},${COMARCA.n},${COMARCA.e}`;

const rutas = await cacheado('osm', 'rutas.json', () => overpass(
  `[out:json][timeout:180];relation["route"~"^(hiking|foot|walking)$"](${B});out geom tags;`, { timeout: 200000 }));
console.log('rutas a pie (relaciones):', rutas.elements.length);
for (const r of rutas.elements) console.log('  ', r.id, '|', r.tags.name, '|', r.tags.ref || '', '|', r.tags.distance || '', '|', (r.members || []).filter((m) => m.type === 'way').length, 'vías');

const agua = await cacheado('osm', 'agua.json', () => overpass(
  `[out:json][timeout:180];way["waterway"~"^(river|stream)$"](${B});out geom tags;`, { timeout: 200000 }));
const nombres = {};
agua.elements.forEach((w) => { const n = w.tags.name || '(sin nombre)'; nombres[n] = (nombres[n] || 0) + 1; });
console.log('ríos y arroyos:', agua.elements.length, 'vías;', Object.entries(nombres).map(([k, v]) => k + ' ' + v).join(', '));

const vias = await cacheado('osm', 'vias.json', () => overpass(
  `[out:json][timeout:180];way["highway"~"^(primary|secondary|tertiary|unclassified|residential|track|path|footway)$"](${B});out geom tags;`, { timeout: 200000 }));
console.log('carreteras y caminos:', vias.elements.length);

const lugares = await cacheado('osm', 'lugares.json', () => overpass(
  `[out:json][timeout:120];(node["place"](${B});nwr["tourism"](${B});nwr["historic"](${B});nwr["natural"~"^(peak|waterfall)$"](${B});nwr["leisure"="picnic_table"](${B});nwr["amenity"~"^(place_of_worship|bbq|shelter)$"](${B}););out center tags;`, { timeout: 150000 }));
console.log('lugares:', lugares.elements.length);
for (const e of lugares.elements) {
  const t = e.tags || {};
  if (t.place && !/^(village|town)$/.test(t.place)) continue;
  console.log('  ', e.type + '/' + e.id, t.name || '', '|', t.place || t.tourism || t.historic || t.natural || t.amenity || t.leisure, '|', e.lat ?? e.center?.lat, e.lon ?? e.center?.lon);
}

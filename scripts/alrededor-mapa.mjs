// Datos del mapa interactivo de «Alrededor» y su HTML de respaldo:
//   - data/alrededor-mapa.json: la costa (cerrada MUY lejos, a 300 km: ver la nota de Montemar), el Eo y el Navia, los
//     ríos, carreteras y aldeas del concejo, el trazado de cada ruta (coche y a pie) y los senderos con su perfil;
//   - partes/alrededor.html: la lista con las cifras de OSRM ya escritas (respaldo sin JS) y el hueco del mapa.
//     construir.mjs (Web) la mete en lugar de @@ALREDEDOR@@.
// Lee ref/raw/rutas.json (cifras de OSRM, scripts/alrededor-rutas.mjs), data/lugar-escena.json (río Barcia y senderos
// con las alturas del MDT05, scripts/lugar-datos.py) y data/alrededor-relieve.json (scripts/alrededor-relieve.py).
// Fuentes: OpenStreetMap (ODbL); costa y ríos grandes de la caché de Montemar (misma consulta a Overpass, misma caja).
// Proyección: metros alrededor de la casa (equirrectangular con cos(lat) de la casa); x al este, y al SUR (como SVG).
//   node scripts/alrededor-mapa.mjs
import fs from 'node:fs';
import path from 'node:path';
import { cacheado, RAIZ, CASA } from './alrededor-util.mjs';

const R = JSON.parse(fs.readFileSync(path.join(RAIZ, 'ref/raw/rutas.json'), 'utf8'));
const ESC = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/lugar-escena.json'), 'utf8'));
const REL = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/alrededor-relieve.json'), 'utf8'));
const OSM = JSON.parse(fs.readFileSync(path.join(RAIZ, 'ref/raw/osm/api-todo.json'), 'utf8')).elements;
const lee = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, 'ref/raw', f), 'utf8'));

const RAD = Math.PI / 180, KX = 111320 * Math.cos(CASA.lat * RAD), KY = 111132;
const P = ([lon, lat]) => [(lon - CASA.lon) * KX, -(lat - CASA.lat) * KY];
const PG = (p) => P([p.lon, p.lat]);

// ---------- geometría ----------
function simplificar(pts, tol) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const pila = [[0, pts.length - 1]], t2 = tol * tol;
  while (pila.length) {
    const [a, b] = pila.pop(); const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    let max = -1, im = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i]; let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px, ey = ay + t * dy - py, d = ex * ex + ey * ey;
      if (d > max) { max = d; im = i; }
    }
    if (max > t2) { keep[im] = 1; pila.push([a, im], [im, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function simplificarAnillo(pts, tol) {
  if (pts.length < 5) return pts.slice();
  let im = 0, max = -1;
  pts.forEach(([x, y], i) => { const d = (x - pts[0][0]) ** 2 + (y - pts[0][1]) ** 2; if (d > max) { max = d; im = i; } });
  return simplificar(pts.slice(0, im + 1), tol).concat(simplificar(pts.slice(im), tol).slice(1));
}
function camino(pts, dec = 0, cerrar = false) {
  const f = 10 ** dec, r = (v) => Math.round(v * f) / f;
  let s = 'M' + r(pts[0][0]) + ' ' + r(pts[0][1]), px = r(pts[0][0]), py = r(pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const x = r(pts[i][0]), y = r(pts[i][1]), dx = r(x - px), dy = r(y - py);
    if (!dx && !dy) continue;
    s += 'l' + dx + (dy < 0 ? '' : ' ') + dy; px = x; py = y;
  }
  return s.replace(/ -/g, '-') + (cerrar ? 'z' : '');
}
const dentro = ([x, y], c) => x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1;
const caja = (o, s, e, n) => { const [x0, y1] = P([o, s]), [x1, y0] = P([e, n]); return { x0, x1, y0, y1 }; };
const clave = (p) => p.lon.toFixed(7) + ',' + p.lat.toFixed(7);
function unir(piezas) {
  piezas = piezas.map((p) => p.slice());
  const cadenas = [];
  while (piezas.length) {
    let c = piezas.pop(), crece = true;
    while (crece) {
      crece = false;
      for (let i = 0; i < piezas.length; i++) {
        const t = piezas[i];
        if (clave(t[0]) === clave(c[c.length - 1])) { c = c.concat(t.slice(1)); piezas.splice(i, 1); crece = true; break; }
        if (clave(t[t.length - 1]) === clave(c[c.length - 1])) { c = c.concat(t.slice(0, -1).reverse()); piezas.splice(i, 1); crece = true; break; }
        if (clave(t[t.length - 1]) === clave(c[0])) { c = t.concat(c.slice(1)); piezas.splice(i, 1); crece = true; break; }
        if (clave(t[0]) === clave(c[0])) { c = t.slice(1).reverse().concat(c); piezas.splice(i, 1); crece = true; break; }
      }
    }
    cadenas.push(c);
  }
  return cadenas;
}
const cajaDe = (pts) => [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))].map(Math.round);

// ---------- la costa (cerrada 300 km al norte: en las vistas largas, más allá de la caja, sigue habiendo mar) ----------
const BB = { s: 43.10, o: -7.45, n: 43.80, e: -5.75 };
const costaOSM = await cacheado('mapa-cache', 'costa.json', () => { throw new Error('falta ref/raw/mapa-cache/costa.json'); });
let trozos = costaOSM.elements.filter((w) => w.geometry).map((w) => w.geometry.slice());
const cadenas = [];
while (trozos.length) {                     // en OSM la costa va con la tierra a la izquierda: se une sin girar
  let c = trozos.pop(), crece = true;
  while (crece) {
    crece = false;
    for (let i = 0; i < trozos.length; i++) {
      const t = trozos[i];
      if (clave(t[0]) === clave(c[c.length - 1])) { c = c.concat(t.slice(1)); trozos.splice(i, 1); crece = true; break; }
      if (clave(t[t.length - 1]) === clave(c[0])) { c = t.concat(c.slice(1)); trozos.splice(i, 1); crece = true; break; }
    }
  }
  cadenas.push(c);
}
const abiertas = cadenas.filter((c) => clave(c[0]) !== clave(c[c.length - 1])).sort((a, b) => b.length - a.length);
const islas = cadenas.filter((c) => clave(c[0]) === clave(c[c.length - 1]) && c.length > 6);
const tierra = abiertas[0].map(PG);
function mar(c, tol) {
  const i0 = tierra.findIndex((p) => dentro(p, c)), i1 = tierra.length - 1 - [...tierra].reverse().findIndex((p) => dentro(p, c));
  const tramo = tierra.slice(Math.max(0, i0 - 1), Math.min(tierra.length, i1 + 2));
  const s = simplificar(tramo, tol);
  const ini = s[0], fin = s[s.length - 1];
  const anillo = s.concat([[fin[0], c.y0 - 300000], [ini[0], c.y0 - 300000]]);
  const isl = islas.map((c2) => c2.map(PG)).filter((r) => r.some((p) => dentro(p, c))).map((r) => simplificarAnillo(r, tol)).filter((r) => r.length > 3);
  return { caja: [c.x0, c.y0, c.x1, c.y1].map(Math.round), d: camino(anillo, 0, true), islas: isl.map((r) => camino(r, 0, true)), costa: camino(s, 0) };
}
const niveles = [
  { nombre: 'medio', ancho_max: 90000, ...mar(caja(-7.40, 43.15, -6.55, 43.65), 30) },
  { nombre: 'lejos', ancho_max: Infinity, ...mar(caja(BB.o, BB.s, BB.e, BB.n), 150) },
];
niveles.forEach((n) => console.log('mar', n.nombre, Math.round((n.d.length + n.costa.length) / 1024), 'KB'));

// ---------- ríos grandes (Eo, Navia) y los del concejo ----------
const riosOSM = await cacheado('mapa-cache', 'rios.json', () => { throw new Error('falta rios.json'); });
const porRio = {};
riosOSM.elements.filter((w) => w.geometry).forEach((w) => { const n = /Eo/.test(w.tags.name) ? 'eo' : 'navia'; (porRio[n] = porRio[n] || []).push(w.geometry); });
const riosGrandes = Object.values(porRio).map((g) => unir(g).map((c) => camino(simplificar(c.map(PG), 40), 0)).join('')).join('');
const riosCerca = [];
// el río Barcia entero (el tramo alto sale del MDT05) y el Agüeira, de la escena del 3D
riosCerca.push(camino(simplificar(ESC.rio.map((p) => [p[0], p[2]]), 6), 0));
const aguas = OSM.filter((e) => e.type === 'way' && /^(river|stream)$/.test(e.tags.waterway || '') && e.tags.name && e.tags.name !== 'Río Barcia');
const porNombre = {};
aguas.forEach((w) => (porNombre[w.tags.name] = porNombre[w.tags.name] || []).push(w.geometry));
for (const [n, gs] of Object.entries(porNombre)) unir(gs).forEach((c) => { if (c.length > 1) riosCerca.push(camino(simplificar(c.map(PG), 8), 0)); });
console.log('ríos del concejo:', Object.keys(porNombre).length + 1, 'con nombre');

// ---------- carreteras del concejo (las de coche; los caminos no, que llenan el mapa) ----------
const GORDAS = /^(primary|secondary|tertiary)$/;
const vias = OSM.filter((e) => e.type === 'way' && /^(primary|secondary|tertiary|unclassified)$/.test(e.tags.highway || '') && e.geometry && e.geometry.length > 1);
const carreteras = { a: [], b: [] };
vias.forEach((w) => carreteras[GORDAS.test(w.tags.highway) ? 'a' : 'b'].push(camino(simplificar(w.geometry.map(PG), 6), 0)));
console.log('carreteras:', carreteras.a.length, 'principales,', carreteras.b.length, 'locales');

// ---------- aldeas (rótulos de referencia, solo de cerca) ----------
const aldeas = OSM.filter((e) => e.type === 'node' && /^(village|hamlet)$/.test(e.tags.place || '') && e.tags.name).map((e) => {
  const [x, y] = PG(e); return { nombre: e.tags.name, x: Math.round(x), y: Math.round(y), v: e.tags.place === 'village' ? 1 : 0 };
}).filter((a) => Math.hypot(a.x, a.y) < 9000);
console.log('aldeas:', aldeas.length);

// ---------- los destinos: trazado de coche y a pie (de las respuestas de OSRM guardadas por alrededor-rutas.mjs) ----------
const destinos = {};
for (const id of R.orden) {
  const d = R.destinos[id];
  if (!d || !d.coche) { console.warn(id, 'sin ruta en rutas.json'); continue; }
  const jc = lee(`osrm/coche-${id}.json`);
  const pc = jc.routes[0].geometry.coordinates.map(P);
  const largo = jc.routes[0].distance, tol = Math.max(3, largo / 2500);
  const r = { x: Math.round(P([d.lon, d.lat])[0]), y: Math.round(P([d.lon, d.lat])[1]), coche: { d: camino(simplificar(pc, tol), tol < 10 ? 1 : 0), caja: cajaDe(pc.concat([[0, 0]])) } };
  // las cifras de la ficha (las mismas que el HTML de respaldo: todo sale de rutas.json)
  r.ficha = { nombre: d.nombre, sub: d.sub, lat: d.lat, lon: d.lon, recta_km: d.recta_km, osm: d.osm, coche: d.coche, pie: d.pie || null };
  if (d.pie) {
    const jp = lee(`osrm/pie-${id}.json`);
    const pp = jp.routes[0].geometry.coordinates.map(P);
    r.pie = { d: camino(simplificar(pp, 3), 1), caja: cajaDe(pp.concat([[0, 0]])) };
  }
  destinos[id] = r;
}

// ---------- los senderos con trazado en OSM: línea y perfil de desnivel (MDT05) ----------
const senderos = {};
for (const rt of ESC.rutas) {
  // los trozos en orden: el primero, el que empieza más cerca de la salida (Pumares o Santalla)
  const salida = destinos[rt.clave] ? [destinos[rt.clave].x, destinos[rt.clave].y] : [0, 0];
  let resto = rt.trazos.map((t) => t.map((p) => [p[0], p[2], p[1]]));
  const orden = []; let cab = salida;
  while (resto.length) {
    let mejor = null;
    resto.forEach((t, i) => {
      const a = Math.hypot(t[0][0] - cab[0], t[0][1] - cab[1]), b = Math.hypot(t[t.length - 1][0] - cab[0], t[t.length - 1][1] - cab[1]);
      if (!mejor || Math.min(a, b) < mejor.d) mejor = { i, d: Math.min(a, b), rev: b < a };
    });
    const t = resto.splice(mejor.i, 1)[0]; const tt = mejor.rev ? t.slice().reverse() : t;
    orden.push(tt); cab = tt[tt.length - 1];
  }
  const pts = orden.flat();
  let s = 0, sube = 0, baja = 0; const prof = [];
  const yS = pts.map((p, i) => { const a = pts[Math.max(0, i - 2)], b = pts[Math.min(pts.length - 1, i + 2)]; return (a[2] + p[2] * 2 + b[2]) / 4; });
  pts.forEach((p, i) => {
    if (i) {
      const dd = Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
      if (dd <= 40) {                               // los saltos entre trozos no cuentan
        s += dd; const dh = yS[i] - yS[i - 1]; if (dh > 0) sube += dh; else baja -= dh;
      }
    }
    prof.push([Math.round(s), Math.round(p[2] * 10) / 10, Math.round(p[0]), Math.round(p[1])]);
  });
  const paso = Math.max(1, Math.floor(prof.length / 260));
  const perfil = prof.filter((_, i) => i % paso === 0 || i === prof.length - 1);
  senderos[rt.clave] = {
    nombre: rt.nombre, ref: rt.ref, osm: rt.osm,
    trazos: orden.map((t) => camino(simplificar(t, 4), 0)), caja: cajaDe(pts),
    largo_m: Math.round(s), sube_m: Math.round(sube), baja_m: Math.round(baja), cota_min: Math.round(Math.min(...pts.map((p) => p[2]))), cota_max: Math.round(Math.max(...pts.map((p) => p[2]))),
    perfil,                                   // [metros desde la salida, cota, x, y]
  };
  console.log('sendero', rt.nombre, Math.round(s), 'm, +', Math.round(sube), '/ -', Math.round(baja), 'm,', perfil.length, 'puntos de perfil');
}

// lo que su web cuenta de cada ruta (2014): se enseña como «según su web», no como medido
const SU_WEB = {
  seimeira: 'Según su web: dificultad baja, 8 km ida y vuelta, unas 3 h; la cascada, de unos 30 m.',
  talladas: 'Según su web: dificultad media-alta, 12 km, unas 3 h 45 min.',
};

const salida = {
  fuente: 'Costa, ríos, carreteras, aldeas y senderos: © colaboradores de OpenStreetMap (ODbL). Rutas: OSRM (coche) y routing.openstreetmap.de (a pie). Relieve: MDT05 y MDT25 © IGN (CC BY 4.0).',
  fecha: R.fecha,
  casa: { lat: CASA.lat, lon: CASA.lon },
  relieve: REL,
  niveles, riosGrandes, riosCerca: riosCerca.join(''), carreteras: { a: carreteras.a.join(''), b: carreteras.b.join('') }, aldeas,
  destinos, senderos, suWeb: SU_WEB,
  rotulos: [
    { nombre: 'Mar Cantábrico', ...(([x, y]) => ({ x: Math.round(x), y: Math.round(y) }))(P([-6.75, 43.66])), min: 40000 },
    { nombre: 'Río Eo', ...(([x, y]) => ({ x: Math.round(x), y: Math.round(y) }))(P([-7.03, 43.40])), min: 25000 },
  ],
};
const txt = JSON.stringify(salida);
fs.writeFileSync(path.join(RAIZ, 'data/alrededor-mapa.json'), txt);
console.log('data/alrededor-mapa.json', Math.round(txt.length / 1024), 'KB');

// ---------- partes/alrededor.html: la lista con las cifras (respaldo sin JS) y el hueco del mapa ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const kmTxt = (v) => String(v).replace('.', ',');
const minTxt = (m) => (m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : ''));
const GRUPOS = [
  ['concejo', 'En el concejo', ['santalla', 'sargadelos', 'mazonovo', 'ferreira']],
  ['rutas', 'Rutas a pie', ['seimeira', 'talladas']],
  ['comarca', 'Los Oscos y alrededor', ['villanueva', 'sanmartin', 'taramundi', 'fonsagrada']],
  ['costa', 'La costa', ['vegadeo', 'ribadeo', 'catedrales']],
  ['viaje', 'Para llegar', ['aeropuerto']],
];
let html = '<div class="alr" data-alrededor-version="' + R.fecha + '">\n';
html += '  <div class="alr__lista">\n';
for (const [g, titulo, ids] of GRUPOS) {
  html += `    <section class="alr__grupo alr__grupo--${g}" aria-labelledby="alr-g-${g}">\n      <h3 class="alr__grupo-tit" id="alr-g-${g}">${esc(titulo)}</h3>\n      <ul class="alr__items">\n`;
  for (const id of ids) {
    const d = R.destinos[id]; if (!d) continue;
    const s = senderos[id];
    const cifra = d.coche ? `<b>${kmTxt(d.coche.km)} km</b> <span>${minTxt(d.coche.minutos)} en coche</span>` : '<b>por confirmar</b>';
    let detalle = [];
    if (s) detalle.push(`sendero de ${kmTxt((s.largo_m / 1000).toFixed(1))} km con trazado en OpenStreetMap, de ${s.cota_min} a ${s.cota_max} m`);
    if (d.sub && !s) detalle.push(esc(d.sub));
    if (d.coche && d.coche.carreteras.length) detalle.push('por ' + d.coche.carreteras.join(', '));
    if (d.pie) detalle.push(`a pie, ${kmTxt(d.pie.km)} km y ${minTxt(d.pie.minutos)}`);
    if (s && d.sub) detalle.push(esc(d.sub));
    html += `        <li class="alr__item" data-id="${id}">\n          <button type="button" class="alr__boton" data-id="${id}" aria-pressed="false" aria-controls="alr-ficha" disabled>\n` +
      `            <span class="alr__nombre">${esc(d.nombre)}</span>\n            <span class="alr__cifra">${cifra}</span>\n          </button>\n` +
      `          <p class="alr__detalle">${detalle.join(' · ')}</p>\n        </li>\n`;
  }
  html += '      </ul>\n';
  if (g === 'rutas') html += '      <p class="alr__nota">Os Cortíos (sale de la puerta), el Forcón de los Ríos, las Carballeiras y A Coba no tienen trazado en OpenStreetMap: aquí no se dibujan. En la casa saben por dónde van.</p>\n';
  html += '    </section>\n';
}
html += '  </div>\n';
html += '  <div class="alr__vista" hidden>\n    <div class="alr__mapa" id="alr-mapa" aria-hidden="true"></div>\n    <div class="alr__ficha" id="alr-ficha" aria-live="polite"></div>\n  </div>\n';
html += `  <p class="alr__fuente">Distancias y tiempos desde la puerta de Casa Freixe con OSRM (coche) y routing.openstreetmap.de (a pie), con datos de © colaboradores de OpenStreetMap (ODbL), calculados el ${R.fecha.split('-').reverse().join('/')}. Son tiempos teóricos, sin tráfico ni paradas. Relieve y desnivel: MDT05 y MDT25 © IGN (CC BY 4.0).</p>\n`;
html += '</div>\n';
fs.writeFileSync(path.join(RAIZ, 'partes/alrededor.html'), html);
console.log('partes/alrededor.html', Math.round(html.length / 1024), 'KB');

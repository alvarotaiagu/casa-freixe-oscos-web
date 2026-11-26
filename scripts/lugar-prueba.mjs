/* Comprobación del módulo «Desde la puerta» (agente Lugar). NO pinta el 3D (reglas del PC: el WebGL lo mira Álvaro).
   1. Funciones puras de js/lugar.js en Node (vm): el sol en Barcia, la luna, la frase del cielo, la estación, el recorrido.
   2. Datos: ficheros de img/lugar/ y data/, la casa (Catastro y cota), el río, las rutas de OSM, los lugares, pesos.
   3. Plan B en Chromium SIN WebGL (--disable-3d-apis; navigator.webdriver ⇒ plan B): contenedor, respaldo, imágenes,
      trazos y marcas, paradas, el cielo de ahora, sin botón 3D (no hay WebGL), que NO pide Three.js, destruir().
   4. La escena con Three.js de verdad y un WebGLRenderer FALSO que no pinta nada (no hay contexto WebGL): se monta sin
      NaN, rótulos y paradas por tramos de scroll, fuera de pantalla no pinta, «Ver en plano», destruir(); en el móvil
      (?lugar=3d) sale el plan B con el botón y Three.js no se pide hasta pulsarlo (carga diferida).
   Uso: node scripts/lugar-prueba.mjs [--sin-navegador]   (servidor propio en el 8982; un solo Chromium, escala 1)
   Antes de lanzarlo, mirar que no haya otra prueba de Playwright en marcha (CLAUDE.md de WEBS NEGOCIOS). */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = 8982;
let fallos = 0, bien = 0;
const ok = (c, txt) => { if (c) { bien++; console.log('  ok  ', txt); } else { fallos++; console.log('  MAL ', txt); } };
const lee = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, f), 'utf8'));

/* ---------- 1. funciones puras ---------- */
console.log('1. funciones puras');
const ctx = { document: { currentScript: null }, location: { href: 'http://localhost/', search: '' }, URL, URLSearchParams, Intl, Math, Date, console };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'js/lugar.js'), 'utf8'), ctx, { filename: 'lugar.js' });
const L = ctx.Freixe.lugar;
ok(typeof L.montar === 'function', 'expone Freixe.lugar.montar');
// Barcia (43,287 N, 7,030 O): mediodía solar ≈ 12:28 UTC; junio 90 − 43,29 + 23,44 ≈ 70,2°; diciembre ≈ 23,3°
const s1 = L.sol(new Date('2026-06-21T12:30:00Z')), s2 = L.sol(new Date('2026-12-21T12:29:00Z')), s3 = L.sol(new Date('2026-06-21T05:30:00Z'));
ok(s1.alt > 69.5 && s1.alt < 70.8 && s1.az > 174 && s1.az < 186, `sol 21-jun al mediodía: ${s1.alt.toFixed(1)}°, acimut ${s1.az.toFixed(0)}° (sur)`);
ok(s2.alt > 22.6 && s2.alt < 23.9 && s2.az > 174 && s2.az < 186, `sol 21-dic al mediodía: ${s2.alt.toFixed(1)}°, acimut ${s2.az.toFixed(0)}°`);
ok(s3.az > 45 && s3.az < 80, `en junio sale por el noreste (acimut ${s3.az.toFixed(0)}° a las 05:30 UTC)`);
const lu = L.luna(new Date('2026-11-26T22:00:00Z'));
ok(lu.luz >= 0 && lu.luz <= 1 && lu.fase >= 0 && lu.fase <= 1, `luna: ${(lu.luz * 100).toFixed(0)} % iluminada, fase ${lu.fase.toFixed(2)}`);
ok(/^En Barcia son las \d\d:\d\d/.test(L.fraseCielo(new Date('2026-11-26T12:00:00Z'))) && /sol está a \d+°/.test(L.fraseCielo(new Date('2026-11-26T12:00:00Z'))), 'frase del cielo: ' + L.fraseCielo(new Date('2026-11-26T12:00:00Z')));
ok(/es de noche/.test(L.fraseCielo(new Date('2026-11-26T23:00:00Z'))), 'de noche: ' + L.fraseCielo(new Date('2026-11-26T23:00:00Z')));
ok(L.estacionDe({ estacion: { nombre: 'invierno' } }) === 'invierno' && L.estacionDe({ estacion: 'otono' }) === 'otono' && L.estacionDe({ estacion: { nombre: 'brotacion' } }) === 'brotacion', 'la estación sale de opciones.estacion (la de Web)');
ok(['invierno', 'brotacion', 'verano', 'otono'].every((k) => L.ESTACIONES[k] && L.ESTACIONES[k].copas.length), 'las cuatro estaciones tienen color de copas');
const ESC = lee('data/lugar-escena.json');
const ruta = L.camino(ESC.recorrido);
let salto = 0, nan = false, prev = null;
for (let i = 0; i <= 4000; i++) {
  const c = ruta(i / 4000);
  if (![...c.pos, ...c.mira].every(Number.isFinite)) nan = true;
  if (prev) salto = Math.max(salto, Math.hypot(c.pos[0] - prev[0], c.pos[1] - prev[1], c.pos[2] - prev[2]));
  prev = c.pos;
}
ok(!nan && salto < 4, `el recorrido no tiene NaN ni saltos (máx. ${salto.toFixed(2)} m por 1/4000 de scroll)`);
const c0 = ruta(0), c1 = ruta(1);
const K = ESC.casa, ca = Math.cos(K.rect.ang), sa = Math.sin(K.rect.ang);
const uPuerta = (c0.pos[0] - K.rect.cx) * ca + (c0.pos[2] - K.rect.cz) * sa;
ok(uPuerta > K.rect.largo / 2 && uPuerta < K.rect.largo / 2 + K.porche.fondo && c0.pos[1] - K.suelo < 4.5, `empieza bajo el porche (a ${(uPuerta - K.rect.largo / 2).toFixed(1)} m del hastial, ojos a ${(c0.pos[1] - K.suelo).toFixed(1)} m)`);
const yaw1 = Math.atan2(c1.mira[0] - c1.pos[0], c1.mira[2] - c1.pos[2]) * 180 / Math.PI;
const ySl = ESC.lugares.find((l) => l.clave === 'santalla');
ok(c1.pos[1] - ESC.cota > 300 && c1.mira[2] > c1.pos[2] + 1500 && ySl.z > c1.pos[2], `acaba en lo alto (${Math.round(c1.pos[1])} m) mirando al sur, hacia Santa Eulalia (rumbo ${((180 - yaw1 + 360) % 360).toFixed(0)}°)`);
ok(L.PARADAS.length === 5 && L.PARADAS.every((p, i) => !i || p.desde > L.PARADAS[i - 1].desde), 'cinco paradas en orden');

/* ---------- 2. datos ---------- */
console.log('2. datos');
const LJ = lee('data/lugar.json');
ok(LJ.casa.refCatastral === 'A00300600PH59D' && Math.abs(LJ.casa.lat - ESC.origen.lat) < 1e-6 && Math.abs(LJ.casa.lon - ESC.origen.lon) < 1e-6, `data/lugar.json: casa ${LJ.casa.lat}, ${LJ.casa.lon}, Catastro ${LJ.casa.refCatastral}`);
ok(LJ.casa.cota === Math.round(ESC.cota) && LJ.casa.cota > 585 && LJ.casa.cota < 595, `cota de la casa ${LJ.casa.cota} m (MDT05 en el centro)`);
const enUso = new Set();
Object.values(ESC.rasters).forEach((r) => enUso.add(r.archivo));
Object.values(ESC.orto).forEach((o) => Object.values(o.archivos).forEach((a) => enUso.add(a)));
ESC.planB.mapa.archivos.concat(ESC.planB.vista.archivos).forEach((a) => enUso.add(a));
enUso.add('vista-valle-1600.webp'); enUso.add('alrededor-relieve.webp');
const hay = fs.readdirSync(path.join(RAIZ, 'img/lugar'));
ok([...enUso].every((f) => hay.includes(f)), `todos los ficheros que pide el módulo existen (${enUso.size})`);
ok(hay.every((f) => enUso.has(f)), 'en img/lugar/ no sobra ninguno' + (hay.filter((f) => !enUso.has(f)).length ? ': ' + hay.filter((f) => !enUso.has(f)).join(', ') : ''));
const peso = (fs_) => fs_.reduce((s, f) => s + fs.statSync(path.join(RAIZ, f)).size, 0);
const p3d = peso(['vendor/three-0.160.0.module.min.js', 'data/lugar-escena.json', ...Object.values(ESC.rasters).map((r) => 'img/lugar/' + r.archivo), ...Object.values(ESC.orto).map((o) => 'img/lugar/' + o.archivos.alta)]);
const p3dM = peso(['vendor/three-0.160.0.module.min.js', 'data/lugar-escena.json', ...Object.values(ESC.rasters).map((r) => 'img/lugar/' + r.archivo), ...Object.values(ESC.orto).map((o) => 'img/lugar/' + o.archivos.baja)]);
const pB = peso(['data/lugar-escena.json', 'img/lugar/' + ESC.planB.mapa.archivos[0], 'img/lugar/' + ESC.planB.vista.archivos[0]]);
ok(p3d < 4.2e6 && pB < 0.7e6, `peso: 3D ${(p3d / 1e6).toFixed(2)} MB en escritorio, ${(p3dM / 1e6).toFixed(2)} MB en móvil (con Three.js); plan B ${(pB / 1e3).toFixed(0)} KB`);
const rumboPorche = (90 + K.rect.ang * 180 / Math.PI + 360) % 360;
ok(K.rect.largo > 14 && K.rect.largo < 19 && K.rect.fondo > 5.5 && K.rect.fondo < 8.5 && rumboPorche > 120 && rumboPorche < 190, `la casa: ${K.rect.largo.toFixed(1)} × ${K.rect.fondo.toFixed(1)} m, ${K.pisos} plantas, el porche mira al ${rumboPorche.toFixed(0)}° (sureste)`);
ok(Math.hypot(K.rect.cx, K.rect.cz) < 6, 'la casa del Catastro está en el origen');
ok(ESC.edificios.length > 20, `${ESC.edificios.length} edificios vecinos del Catastro`);
const rioD = Math.min(...ESC.rio.map((p) => Math.hypot(p[0], p[2])));
ok(rioD > 50 && rioD < 140 && LJ.rio.distancia_m === Math.round(rioD), `el río Barcia pasa a ${Math.round(rioD)} m de la casa`);
ok(ESC.rio.every((p, i) => !i || p[1] <= ESC.rio[i - 1][1] + 1e-6), 'el agua del río siempre baja');
ok(ESC.rutas.length === 2 && ESC.rutas.every((r) => /^relation\/\d+$/.test(r.osm) && r.trazos.length), 'dos rutas con trazado de OSM: ' + ESC.rutas.map((r) => r.nombre + ' (' + r.ref + ')').join(', '));
const lg = Object.fromEntries(ESC.lugares.map((l) => [l.clave, l]));
ok(lg.santalla.z > 2500 && lg.pumares.x < lg.santalla.x && lg.quinta.z < 0, 'Santa Eulalia al sur, Pumares al oeste de Santalla, Quintá al norte (OSM)');
ok(ESC.arboles.length > 2000 && ESC.arboles.every((a) => a.every(Number.isFinite)), `${ESC.arboles.length} árboles detectados en la ortofoto del valle`);
ok(ESC.planB.mapa.ruta.length > 50 && ESC.planB.vista.marcas.some((m) => m.clave === 'santalla'), 'plan B: el vuelo sobre el mapa y Santa Eulalia en la vista final');

if (process.argv.includes('--sin-navegador')) { console.log(`\n${bien} bien, ${fallos} mal (sin navegador)`); process.exit(fallos ? 1 : 0); }

/* ---------- 3. plan B en el navegador, sin WebGL ---------- */
console.log('3. plan B en Chromium sin WebGL');
const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  const f = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(PUERTO, r));
const browser = await chromium.launch({ args: ['--disable-3d-apis', '--disable-gpu'] });
try {
  for (const [W, H] of [[1280, 800], [390, 844]]) {
    const c = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: 'reduce', isMobile: W < 500, hasTouch: W < 500 });
    const page = await c.newPage();
    const errores = [], pedidos = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    page.on('request', (r) => pedidos.push(r.url()));
    await page.goto(`http://localhost:${PUERTO}/ref/raw/lugar-prueba.html`);
    await page.waitForFunction(() => document.querySelector('[data-modulo="lugar"]').dataset.montado === '1' && document.querySelectorAll('.lugar__marcas li').length > 3, null, { timeout: 15000 });
    await page.locator('.lugar__vista img').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll('.lugar__planob img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
    const r = await page.evaluate(() => {
      const el = document.querySelector('[data-modulo="lugar"]'), vis = (s) => { const n = el.querySelector(s); return !!n && n.getBoundingClientRect().height > 0; };
      return { modo: el.dataset.modo, lienzo: !!el.querySelector('canvas'), pista: vis('.lugar__pista'), mapa: vis('.lugar__mapa img'), vista: vis('.lugar__vista img'),
        trazos: el.querySelectorAll('.lugar__marco--mapa polyline').length, marcas: el.querySelectorAll('.lugar__marco--mapa .lugar__marca').length,
        marcasV: el.querySelectorAll('.lugar__marcas--vista .lugar__marca').length, pasos: el.querySelectorAll('.lugar__pasos li').length,
        cielo: el.querySelector('[data-l="ahora2d"]').textContent, boton: !el.querySelector('[data-l="a3d"]').hidden, fuente: /Instituto Geográfico Nacional/.test(el.querySelector('.lugar__fuente').textContent),
        ancho: document.documentElement.scrollWidth - innerWidth, est: el.dataset.estacion };
    });
    ok(r.modo === 'plano' && !r.lienzo && !r.pista, `${W}px: plan B en el mismo hueco, sin lienzo ni pista`);
    ok(r.mapa && r.vista && r.trazos >= 4 && r.marcas >= 8 && r.marcasV >= 3, `${W}px: el valle desde el aire con ${r.trazos} trazos y ${r.marcas} marcas; la vista final con ${r.marcasV} marcas`);
    ok(r.pasos === 5 && /^En Barcia son las/.test(r.cielo) && r.fuente, `${W}px: cinco paradas, el cielo de ahora («${r.cielo.slice(0, 48)}…») y las fuentes`);
    ok(!r.boton, `${W}px: sin botón 3D (este navegador no tiene WebGL)`);
    ok(!pedidos.some((u) => /three-0\.160/.test(u)) && !pedidos.some((u) => /alturas-|orto-/.test(u)), `${W}px: no pide Three.js ni el relieve (carga diferida)`);
    ok(r.ancho <= 0, `${W}px: sin scroll horizontal (${r.ancho})`);
    ok(['invierno', 'brotacion', 'verano', 'otono'].includes(r.est), `${W}px: lee la estación de Web (${r.est})`);
    const rep = await page.evaluate(() => { window.__lugar.destruir(); const el = document.querySelector('[data-modulo="lugar"]'); return !!el.querySelector('figure.respaldo') && !el.classList.contains('lugar-mod'); });
    ok(rep, `${W}px: destruir() repone el respaldo de Web`);
    ok(errores.length === 0, `${W}px: sin errores en consola` + (errores.length ? ': ' + errores.join(' | ') : ''));
    await c.close();
  }

  /* ---------- 4. la escena con un renderizador falso (Three.js de verdad, nada se pinta) ---------- */
  console.log('4. escena 3D con renderizador falso (no pinta, sin WebGL)');
  const ENVOLTORIO = `export * from '/vendor/three-0.160.0.module.min.js?real';
export class WebGLRenderer {
  constructor(o) { this.domElement = o.canvas; this.shadowMap = { enabled: false, type: 0, autoUpdate: true, needsUpdate: false };
    this.capabilities = { getMaxAnisotropy: () => 8 }; this.info = { render: { triangles: 0, calls: 0 } }; this._pr = 1; window.__pintadas = 0; }
  setPixelRatio(v) { this._pr = v; } getPixelRatio() { return this._pr; } setSize() {} compile() {}
  render(esc, cam) {
    window.__pintadas++; let tri = 0, calls = 0;
    esc.updateMatrixWorld();
    esc.traverse((o) => { if ((o.isMesh || o.isPoints || o.isSprite) && o.visible && o.geometry) { calls++; const g = o.geometry; const n = g.index ? g.index.count : g.attributes.position.count; tri += n / 3 * (o.isInstancedMesh ? o.count : 1);
      const pa = g.attributes.position && g.attributes.position.array; if (pa && !window.__nan) { for (let i = 0; i < pa.length; i += 97) if (!Number.isFinite(pa[i])) { window.__nan = (o.name || o.type) + ' ' + i; break; } }
      if (o.isInstancedMesh && !window.__nan) { const a = o.instanceMatrix.array; for (let i = 0; i < o.count * 16; i += 13) if (!Number.isFinite(a[i])) { window.__nan = 'instancias ' + i; break; } } } });
    this.info.render.triangles = tri; this.info.render.calls = calls;
    if (![cam.position.x, cam.position.y, cam.position.z].every(Number.isFinite)) throw new Error('cámara con NaN');
    window.__cam = [cam.position.x, cam.position.y, cam.position.z, cam.near, cam.fov];
  }
  dispose() {} forceContextLoss() {}
}`;
  const fuerza = (c) => c.route((u) => u.pathname.endsWith('/vendor/three-0.160.0.module.min.js') && !u.search.includes('real'), (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: ENVOLTORIO }));
  const c3 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  await fuerza(c3);
  const page = await c3.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /Lugar/.test(m.text()))) errores.push(m.text()); });
  await page.goto(`http://localhost:${PUERTO}/ref/raw/lugar-prueba.html?lugar=3d&hora=12:00`);
  await page.locator('#lugar').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__lugar && window.__lugar.estado().t3 && window.__pintadas > 0 && window.__lugar.estado().cargado, null, { timeout: 60000 });
  const e0 = await page.evaluate(() => ({ est: window.__lugar.estado(), modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, nan: window.__nan || null,
    listo: document.querySelector('.lugar__escenario').classList.contains('lugar--listo'), hud: document.querySelector('[data-l="ahora3d"]').textContent }));
  ok(e0.modo === '3d' && e0.listo, 'modo 3D montado; se enseña cuando han llegado las texturas');
  ok(!e0.nan, 'ninguna geometría ni instancia con NaN' + (e0.nan ? ': ' + e0.nan : ''));
  console.log('       triángulos', Math.round(e0.est.t3.triangulos), '· objetos', e0.est.t3.llamadas, '· árboles', e0.est.t3.arboles, '(perennes', e0.est.t3.perennes + ') · huecos de la casa', e0.est.t3.huecos);
  ok(e0.est.t3.triangulos > 200000 && e0.est.t3.triangulos < 2000000, 'triángulos en un rango razonable');
  ok(/12:00 en Barcia · el sol de ahora/.test(e0.hud), 'rótulo de la hora (?hora=12:00) y del sol de ahora: ' + e0.hud.slice(0, 70) + '…');
  const tramos = [[0, [], 'La puerta'], [0.16, ['Casa Freixe'], 'La casa'], [0.4, ['Río Barcia'], 'El río Barcia'], [0.6, [], 'Valle abajo'], [0.999, ['Santa Eulalia de Oscos'], 'Santa Eulalia y las aldeas']];
  for (const [p, esperados, parada] of tramos) {
    await page.evaluate((p) => { const pista = document.querySelector('.lugar__pista'); const esc = document.querySelector('.lugar__escenario');
      const y0 = pista.getBoundingClientRect().top + scrollY; scrollTo(0, y0 + p * (pista.offsetHeight - esc.offsetHeight)); }, p);
    await page.waitForFunction((p) => { const t = window.__lugar.estado().t3; return t && Math.abs(t.pVis - p) < 0.004; }, p, { timeout: 20000 });
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => ({ rot: [...document.querySelectorAll('.lugar__rotulo.es-visible b')].map((b) => b.textContent), par: (document.querySelector('.lugar__paradas li.es-actual b') || {}).textContent, cam: window.__cam }));
    const faltan = esperados.filter((x) => !r.rot.includes(x));
    ok(faltan.length === 0 && r.par === parada, `p=${p}: parada «${r.par}», rótulos: ${r.rot.join(' · ') || '(ninguno)'} · cámara a ${r.cam[1].toFixed(0)} m, near ${r.cam[3].toFixed(2)}`);
  }
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  const fuera = await page.evaluate(() => { const a = window.__pintadas; return new Promise((res) => setTimeout(() => res(window.__pintadas - a), 700)); });
  ok(fuera === 0, `fuera de pantalla no pinta (${fuera} fotogramas en 0,7 s)`);
  await page.evaluate(() => document.querySelector('[data-l="aplano"]').click());
  const pl = await page.evaluate(() => ({ modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, boton: !document.querySelector('[data-l="a3d"]').hidden }));
  ok(pl.modo === 'plano' && pl.boton, '«Ver en plano» vuelve al plan B y ofrece volver al 3D');
  const rep = await page.evaluate(() => { window.__lugar.destruir(); return !!document.querySelector('[data-modulo="lugar"] figure.respaldo') && !document.querySelector('canvas'); });
  ok(rep, 'destruir() con el 3D montado repone el respaldo y quita el lienzo');
  ok(errores.length === 0, 'sin errores en consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await c3.close();

  // móvil: plan B con botón; Three.js no se pide hasta pulsarlo
  const cm = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
  await fuerza(cm);
  const pm = await cm.newPage();
  const erroresM = [], pedM = [];
  pm.on('pageerror', (e) => erroresM.push(String(e)));
  pm.on('request', (r) => pedM.push(r.url()));
  await pm.goto(`http://localhost:${PUERTO}/ref/raw/lugar-prueba.html?lugar=3d&hora=22:30`);
  await pm.waitForFunction(() => window.__lugar && document.querySelector('[data-modulo="lugar"]').dataset.montado === '1');
  await pm.waitForTimeout(400);
  const m0 = await pm.evaluate(() => ({ modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, boton: !document.querySelector('[data-l="a3d"]').hidden, t3: !!window.__lugar.estado().t3, txt: document.querySelector('[data-l="a3d"]').textContent }));
  ok(m0.modo === 'plano' && m0.boton && !m0.t3 && !pedM.some((u) => /three-0\.160/.test(u)), `móvil: plan B con el botón «${m0.txt}» y sin pedir Three.js`);
  await pm.locator('[data-l="a3d"]').scrollIntoViewIfNeeded();
  await pm.tap('[data-l="a3d"]');
  await pm.waitForFunction(() => window.__lugar.estado().t3 && window.__pintadas > 0, null, { timeout: 60000 });
  const m1 = await pm.evaluate(() => ({ modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, est: window.__lugar.estado(), hud: document.querySelector('[data-l="ahora3d"]').textContent, nan: window.__nan || null }));
  ok(m1.modo === '3d' && pedM.some((u) => /three-0\.160/.test(u)) && !m1.nan, `al pulsar pide Three.js y monta el 3D (móvil: ${Math.round(m1.est.t3.triangulos)} triángulos, ${m1.est.t3.arboles} árboles)`);
  ok(/22:30 en Barcia · el cielo de ahora/.test(m1.hud), '?hora=22:30: ' + m1.hud.slice(0, 80) + '…');
  ok(erroresM.length === 0, 'móvil: sin errores en consola' + (erroresM.length ? ': ' + erroresM.join(' | ') : ''));
  await cm.close();
} finally {
  await browser.close();
  srv.close();
}
console.log(`\n${bien} bien, ${fallos} mal`);
process.exit(fallos ? 1 : 0);

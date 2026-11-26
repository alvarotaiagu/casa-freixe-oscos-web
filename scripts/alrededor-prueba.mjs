/* Comprobación de «Alrededor» (agente Lugar). Mapa 2D (SVG), sin WebGL.
   1. Datos (Node): rutas.json, alrededor-mapa.json y partes/alrededor.html dicen lo mismo; cada cifra del HTML sale de
      OSRM; la costa se cierra lejos; los senderos tienen perfil.
   2. Navegador (un solo Chromium; 1280×800 y 390×844, escala 1; reducedMotion «reduce» salvo en una pasada):
      pulsa CADA sitio y comprueba aria-pressed, la ficha (km y minutos = rutas.json, enlace a Google Maps), que el
      camino se dibuja (d del destino, trazo terminado) y que el mapa encuadra el destino; el conmutador coche/a pie;
      el perfil de desnivel con el puntero y con el teclado (marca el punto en el mapa); con movimiento reducido salta
      sin vuelo; sin JS, la lista con las cifras; destruir() repone el respaldo; sin errores; sin scroll horizontal.
   Uso: node scripts/alrededor-prueba.mjs [--sin-navegador]   (servidor propio en el 8982)
   Antes de lanzarlo, mirar que no haya otra prueba de Playwright en marcha (CLAUDE.md de WEBS NEGOCIOS). */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = 8982;
let fallos = 0, bien = 0;
const ok = (c, txt) => { if (c) { bien++; console.log('  ok  ', txt); } else { fallos++; console.log('  MAL ', txt); } };
const lee = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, f), 'utf8'));

/* ---------- 1. datos ---------- */
console.log('1. datos');
const R = lee('ref/raw/rutas.json'), M = lee('data/alrededor-mapa.json'), L = lee('data/lugar.json');
const HTML = fs.readFileSync(path.join(RAIZ, 'partes/alrededor.html'), 'utf8');
ok(Math.abs(R.casa.lat - L.casa.lat) < 1e-6 && Math.abs(R.casa.lon - L.casa.lon) < 1e-6, 'el origen de las rutas es la casa de data/lugar.json');
const ids = R.orden;
ok(ids.length === 14 && ids.every((id) => R.destinos[id].coche && R.destinos[id].osm), `14 destinos, todos con ruta de OSRM y su elemento de OSM (${ids.length})`);
const coma = (v) => String(v).replace('.', ',');
const enHTML = ids.filter((id) => {
  const d = R.destinos[id], i0 = HTML.indexOf(`<li class="alr__item" data-id="${id}"`), li = i0 < 0 ? "" : HTML.slice(i0, HTML.indexOf("</li>", i0));
  return li.includes(coma(d.coche.km) + ' km') && (!d.pie || li.includes(coma(d.pie.km) + ' km'));
});
ok(enHTML.length === ids.length, `el HTML de respaldo trae las cifras de OSRM de cada sitio (${enHTML.length}/${ids.length})`);
ok((HTML.match(/aria-pressed="false"/g) || []).length === ids.length && (HTML.match(/<button/g) || []).length === ids.length, 'un botón con aria-pressed por sitio');
ok(ids.every((id) => M.destinos[id] && M.destinos[id].coche.d.length > 20 && M.destinos[id].ficha.coche.km === R.destinos[id].coche.km), 'cada sitio tiene su trazado y la misma cifra en el mapa');
ok(ids.filter((id) => R.destinos[id].pie).every((id) => M.destinos[id].pie && M.destinos[id].pie.d), 'los que van a pie tienen su trazado a pie');
// el camino del mar: M absoluto y l relativos; el punto más al norte tiene que quedar a ~300 km de la caja
const puntos = (d) => { const t = d.match(/[Ml]|-?\d+(\.\d+)?/g), out = []; let x = 0, y = 0, c = '';
  for (let i = 0; i < t.length; i++) { if (t[i] === 'M' || t[i] === 'l') { c = t[i]; continue; } const a = +t[i], b = +t[++i]; if (c === 'M') { x = a; y = b; } else { x += a; y += b; } out.push([x, y]); } return out; };
ok(M.niveles.every((n) => /z$/.test(n.d) && Math.min(...puntos(n.d).map((p) => p[1])) < n.caja[1] - 290000), 'el mar de cada nivel es un anillo cerrado lejos, a 300 km al norte de su caja');
const S = M.senderos;
ok(S.seimeira && S.talladas && S.seimeira.perfil.length > 50 && S.talladas.perfil.length > 50, 'los dos senderos con trazado en OSM tienen perfil (Seimeira y As Talladas)');
ok(Object.values(S).every((s) => s.perfil.every((p, i) => !i || p[0] >= s.perfil[i - 1][0]) && s.perfil[s.perfil.length - 1][0] === s.largo_m), 'los perfiles avanzan y acaban en el largo del sendero');
ok(S.seimeira.cota_min > 450 && S.seimeira.cota_max < 700 && S.talladas.cota_min > 350, `cotas razonables: Seimeira ${S.seimeira.cota_min}-${S.seimeira.cota_max} m, As Talladas ${S.talladas.cota_min}-${S.talladas.cota_max} m`);
const cat = R.destinos.catedrales.coche;
ok(cat.minutos > 30, `Catedrales: OSRM da ${cat.km} km y ${cat.minutos} min (su web dice «unos 30 minutos»: se enseña la medida)`);

if (process.argv.includes('--sin-navegador')) { console.log(`\n${bien} bien, ${fallos} mal (sin navegador)`); process.exit(fallos ? 1 : 0); }

/* ---------- 2. navegador ---------- */
console.log('2. navegador');
const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  const f = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(PUERTO, r));
const URLP = `http://localhost:${PUERTO}/ref/raw/lugar-prueba.html?sin-webgl`;
const browser = await chromium.launch();
try {
  for (const [W, H, mov] of [[1280, 800, 'reduce'], [390, 844, 'reduce'], [1280, 800, 'no-preference']]) {
    const nombre = `${W}×${H}${mov === 'reduce' ? ', movimiento reducido' : ', con movimiento'}`;
    console.log(' ' + nombre);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: mov, hasTouch: W < 500, isMobile: W < 500 });
    const page = await ctx.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    await page.goto(URLP);
    await page.waitForFunction(() => window.__alrededor && window.__alrededor.estado().listo, null, { timeout: 20000 });
    const base = await page.evaluate(() => ({ vista: !document.querySelector('.alr__vista').hidden, des: document.querySelectorAll('.alr__boton:disabled').length,
      marcas: document.querySelectorAll('.alr__marca').length, mar: (document.querySelector('.alr__mar').getAttribute('d') || '').length,
      ancho: document.documentElement.scrollWidth - innerWidth }));
    ok(base.vista && base.des === 0 && base.marcas === ids.length && base.mar > 100, `monta: mapa visible, botones activos, ${base.marcas} marcas, mar dibujado`);
    ok(base.ancho <= 0, `sin scroll horizontal (${base.ancho} px de más)`);
    const lista = mov === 'reduce' ? ids : ['santalla', 'seimeira', 'catedrales', 'aeropuerto'];
    let fichasOk = 0, trazosOk = 0, encajes = 0, pressedOk = 0;
    const malos = [];
    for (const id of lista) {
      const d = R.destinos[id];
      await page.locator(`.alr__boton[data-id="${id}"]`).scrollIntoViewIfNeeded();
      await page.click(`.alr__boton[data-id="${id}"]`);
      if (mov !== 'reduce') {
        await page.waitForFunction(() => window.__alrededor.estado().trazado, null, { timeout: 6000 });
        await page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelectorAll('.alr__ruta')[1]).strokeDashoffset) < 0.01, null, { timeout: 4000 }).catch(() => {});
      }
      const r = await page.evaluate((id) => {
        const e = window.__alrededor.estado(), f = document.querySelector('.alr__ficha');
        const mk = [...document.querySelectorAll('.alr__marca')].find((m) => m.classList.contains('es-elegida'));
        const mr = document.querySelector('.alr__mapa').getBoundingClientRect(), b = mk && mk.getBoundingClientRect();
        const ruta = document.querySelectorAll('.alr__ruta')[1];
        return { e, pres: [...document.querySelectorAll('.alr__boton')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.id),
          tit: f.querySelector('.alr__f-tit') && f.querySelector('.alr__f-tit').textContent, cif: f.querySelector('.alr__f-cifras') && f.querySelector('.alr__f-cifras').textContent,
          enlace: f.querySelector('.alr__f-enlace') && f.querySelector('.alr__f-enlace').href, dent: !!b && b.left >= mr.left - 2 && b.right <= mr.right + 60 && b.top >= mr.top - 2 && b.bottom <= mr.bottom + 2,
          off: getComputedStyle(ruta).strokeDashoffset, fichaEnItem: !!f.closest('.alr__item') };
      }, id);
      const km = coma(d.coche.km) + ' km';
      if (r.pres.length === 1 && r.pres[0] === id) pressedOk++; else malos.push(id + ' aria-pressed ' + r.pres.join(','));
      if (r.tit === d.nombre && r.cif && r.cif.includes(km) && r.cif.includes(d.coche.minutos < 60 ? d.coche.minutos + ' min' : 'h') && /google\.com\/maps\/dir\/\?api=1/.test(r.enlace) && r.enlace.includes(d.lat + ',' + d.lon)) fichasOk++;
      else malos.push(id + ' ficha «' + r.tit + '» ' + r.cif);
      if (r.e.d === (await page.evaluate((id) => window.__alrededor && document.querySelector('.alr__ruta').getAttribute('d'), id)) && r.e.d.length > 20 && r.e.sel === id && parseFloat(r.off) < 0.01) trazosOk++;
      else malos.push(id + ' trazo ' + r.off);
      if (r.dent) encajes++; else malos.push(id + ' fuera del encuadre');
      if (W < 500 && !r.fichaEnItem) malos.push(id + ' ficha no está bajo el sitio (móvil)');
    }
    ok(pressedOk === lista.length, `aria-pressed: solo el sitio pulsado (${pressedOk}/${lista.length})`);
    ok(fichasOk === lista.length, `ficha con nombre, km y minutos de OSRM y enlace a Google Maps (${fichasOk}/${lista.length})` + (malos.length ? ' · ' + malos.slice(0, 4).join(' | ') : ''));
    ok(trazosOk === lista.length, `el camino desde la casa se dibuja entero (${trazosOk}/${lista.length})`);
    ok(encajes === lista.length, `el mapa encuadra el destino (${encajes}/${lista.length})`);
    // conmutador coche / a pie (Santa Eulalia)
    await page.click('.alr__boton[data-id="santalla"]');
    const dCoche = await page.evaluate(() => window.__alrededor.estado().d);
    await page.click('.alr__modo[data-modo="pie"]');
    if (mov !== 'reduce') await page.waitForFunction(() => window.__alrededor.estado().trazado, null, { timeout: 6000 });
    const pie = await page.evaluate(() => ({ e: window.__alrededor.estado(), cif: document.querySelector('.alr__f-cifras').textContent, pr: document.querySelector('.alr__modo[data-modo="pie"]').getAttribute('aria-pressed'), foco: document.activeElement && document.activeElement.dataset.modo, enlace: document.querySelector('.alr__f-enlace').href }));
    const sp = R.destinos.santalla.pie;
    ok(pie.e.modo === 'pie' && pie.pr === 'true' && pie.e.d !== dCoche && pie.cif.includes(coma(sp.km) + ' km') && /andando/.test(pie.cif) && /travelmode=walking/.test(pie.enlace) && pie.foco === 'pie',
      `conmutador «a pie»: otro trazado, ${coma(sp.km)} km andando, enlace a pie, el foco se queda en el botón`);
    await page.click('.alr__boton[data-id="catedrales"]');
    ok(!(await page.$('.alr__modo')), 'sin conmutador donde no tiene sentido ir a pie (Catedrales)');
    // perfil de desnivel: puntero y teclado
    await page.click('.alr__boton[data-id="seimeira"]');
    if (mov !== 'reduce') await page.waitForFunction(() => window.__alrededor.estado().trazado, null, { timeout: 6000 });
    const svgP = page.locator('.alr__p-svg');
    await svgP.scrollIntoViewIfNeeded();
    const caja = await svgP.boundingBox();
    if (W < 500) await page.touchscreen.tap(caja.x + caja.width * 0.6, caja.y + caja.height / 2);
    else await page.mouse.move(caja.x + caja.width * 0.6, caja.y + caja.height / 2);
    const p1 = await page.evaluate(() => ({ e: window.__alrededor.estado(), v: +document.querySelector('.alr__p-svg').getAttribute('aria-valuenow'), t: document.querySelector('.alr__p-svg').getAttribute('aria-valuetext'),
      punto: (() => { const p = document.querySelector('.alr__punto-perfil'); return p && !p.hidden && p.getBoundingClientRect(); })(), mapa: document.querySelector('.alr__mapa').getBoundingClientRect() }));
    const Ls = S.seimeira.largo_m;
    ok(p1.e.perfil && Math.abs(p1.v - 0.6 * Ls) < Ls * 0.03 && /m de altitud/.test(p1.t), `perfil con ${W < 500 ? 'el dedo' : 'el ratón'}: ${p1.t}`);
    ok(p1.punto && p1.punto.left > p1.mapa.left && p1.punto.right < p1.mapa.right && p1.punto.top > p1.mapa.top && p1.punto.bottom < p1.mapa.bottom, 'el punto del perfil se marca dentro del mapa');
    await svgP.focus();
    await page.keyboard.press('Home'); const k0 = await page.evaluate(() => +document.querySelector('.alr__p-svg').getAttribute('aria-valuenow'));
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); const k1 = await page.evaluate(() => +document.querySelector('.alr__p-svg').getAttribute('aria-valuenow'));
    await page.keyboard.press('End'); const k2 = await page.evaluate(() => +document.querySelector('.alr__p-svg').getAttribute('aria-valuenow'));
    ok(k0 === 0 && k1 === 200 && k2 === Ls, `perfil con el teclado: Inicio ${k0} m, dos flechas ${k1} m, Fin ${k2} m`);
    const rol = await page.evaluate(() => { const s = document.querySelector('.alr__p-svg'); return s.getAttribute('role') === 'slider' && s.tabIndex === 0 && !!s.getAttribute('aria-label'); });
    ok(rol, 'el perfil es un control deslizante con nombre y en el orden del tabulador');
    // teclado en la lista: Tab llega a los botones y Enter elige
    await page.focus('.alr__boton[data-id="villanueva"]'); await page.keyboard.press('Enter');
    ok((await page.evaluate(() => window.__alrededor.estado().sel)) === 'villanueva', 'con el teclado: Enter sobre un sitio lo elige');
    // movimiento reducido: salta sin vuelo
    if (mov === 'reduce') {
      await page.click('.alr__boton[data-id="aeropuerto"]');
      const sal = await page.evaluate(() => { const e = window.__alrededor.estado(); return { volando: e.volando, w: e.vista[2], trazado: e.trazado }; });
      ok(!sal.volando && sal.w > 80000 && sal.trazado, `movimiento reducido: salta al aeropuerto sin vuelo (vista de ${Math.round(sal.w / 1000)} km) y el camino ya está entero`);
    } else {
      await page.click('.alr__boton[data-id="ribadeo"]');
      const v0 = await page.evaluate(() => window.__alrededor.estado().volando);
      ok(v0 === true, 'con movimiento: el mapa vuela hasta el sitio');
    }
    // destruir repone el respaldo
    const rep = await page.evaluate(() => { const el = document.getElementById('hueco-alrededor'); window.__alrededor.destruir(); return el.querySelectorAll('.alr__boton:disabled').length === el.querySelectorAll('.alr__boton').length && !el.querySelector('svg.alr__svg'); });
    ok(rep, 'destruir() repone el respaldo (botones sin activar y sin mapa)');
    ok(errores.length === 0, 'sin errores en consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
    await ctx.close();
  }
  // sin JS: la lista con las cifras
  const ctxS = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, javaScriptEnabled: false });
  const ps = await ctxS.newPage();
  await ps.setContent('<link rel="stylesheet" href="http://localhost:' + PUERTO + '/css/alrededor.css"><div data-modulo="alrededor">' + HTML + '</div>', { waitUntil: 'load' });
  const sj = await ps.evaluate(() => ({ items: document.querySelectorAll('.alr__item').length, vista: getComputedStyle(document.querySelector('.alr__vista')).display, cif: [...document.querySelectorAll('.alr__cifra b')].filter((b) => /km/.test(b.textContent) && b.offsetHeight > 0).length }));
  ok(sj.items === ids.length && sj.vista === 'none' && sj.cif === ids.length, `sin JS: ${sj.items} sitios con sus km a la vista y sin el hueco del mapa`);
  await ctxS.close();
} finally {
  await browser.close();
  srv.close();
}
console.log(`\n${bien} bien, ${fallos} mal`);
process.exit(fallos ? 1 : 0);

/* Verificación de la web de Casa Freixe (Playwright, UN navegador, ventanas pequeñas, escala 1).
   Uso: node verificar.mjs            (todo; servidor interno en el puerto 8991: el 8981 es el de mirar a mano)
        node verificar.mjs 3 4        (solo esos bloques, para depurar)
   Sin capturas: lo que hay que mirar a ojo va en el README. El 3D NO se pinta: el navegador arranca sin WebGL, la
   página se abre con ?sin-webgl y js/lugar.js, css/lugar.css y vendor/ se sirven VACÍOS (del 3D solo se comprueba que
   existe su contenedor y que se ve el respaldo). Alrededor (2D) se prueba con scripts/alrededor-prueba.mjs de Lugar,
   si existe, DESPUÉS de cerrar este navegador (una prueba a la vez). El fresno de la portada es canvas 2D: sí se prueba.
   Las letras y Google Maps se sirven falsos: ninguna petición de verdad a terceros. Todo con movimiento reducido salvo
   el bloque 14, una vez y al final. Mide comportamiento, no aspecto. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = 8991;
const SOLO = process.argv.slice(2).map(Number).filter(Boolean);
const toca = (n) => !SOLO.length || SOLO.includes(n);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.bin': 'application/octet-stream' };
const VACIOS = new Set(['/js/lugar.js', '/css/lugar.css']);
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (VACIOS.has(p) || p.startsWith('/vendor/')) { res.writeHead(200, { 'Content-Type': TIPOS[path.extname(p)] || 'text/plain' }); res.end(''); return; }
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
servidor.on('error', (e) => { console.error(`El puerto ${PUERTO} está ocupado (¿otra sesión?): ${e.message}`); process.exit(2); });
await new Promise((r) => servidor.listen(PUERTO, r));
const BASE = `http://localhost:${PUERTO}/`;
const PAG = BASE + 'index.html?sin-webgl';

const fallos = [];
let nOk = 0;
const comprobar = (cond, m, detalle) => { if (cond) { nOk++; console.log('  ok     ' + m); } else { fallos.push(m); console.log('  FALLO  ' + m + (detalle !== undefined ? ' → ' + JSON.stringify(detalle).slice(0, 700) : '')); } };
const nota = (m) => console.log('  ·      ' + m);
const LLAVE = 'freixe-cookies';
const sinCookies = `try { localStorage.setItem('${LLAVE}', 'si'); } catch (e) {}`;
const existe = (f) => fs.existsSync(path.join(RAIZ, f));
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const textoDe = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const D = JSON.parse(leer('data/freixe.json'));
const medidas = {};

/* ---------- contraste (WCAG 2) ---------- */
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

/* ================= 1. archivos (sin navegador) ================= */
if (toca(1)) {
  console.log('\n1. Archivos, textos, contrato y contraste');
  const htmls = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html') && !f.endsWith('.src.html'));
  comprobar(['index.html', '404.html', 'aviso-legal.html', 'privacidad.html', 'cookies.html', 'accesibilidad.html'].every((f) => htmls.includes(f)), 'están la página, el 404 y las cuatro legales');
  for (const f of htmls) {
    const s = leer(f);
    comprobar(/^<!DOCTYPE html>\s*<html lang="es">\s*<head>\s*<meta charset="utf-8">\s*<meta name="robots" content="noindex, nofollow">/.test(s), `${f}: charset lo primero, noindex, nofollow detrás y lang="es"`);
    const ids = [...s.replace(/<symbol[\s\S]*?<\/symbol>/g, '').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const rep = ids.filter((x, i) => ids.indexOf(x) !== i);
    comprobar(rep.length === 0 && !/<!--parte:/.test(s) && !/@@ALREDEDOR@@/.test(s) && !/<!--(rotulo-portada|rotulo-pie|rotulo-simbolo|unidades|vistazo|servicios|galeria|bienvenida|lugar-respaldo|opiniones|reserva|contacto|creditos|datos|jsonld)-->/.test(s), `${f}: sin ids repetidos y con todas las partes`, [...new Set(rep)]);
  }
  comprobar(['.nojekyll', 'manifest.json', 'img/og.jpg', 'marca/favicon.svg', 'marca/favicon-32.png', 'marca/apple-touch-icon.png', 'marca/icono-512.png'].every(existe), 'están .nojekyll, manifest, og (1200×630), favicons');
  const html = leer('index.html');
  const rutas = new Set();
  for (const m of html.matchAll(/(src|srcset|href)="([^"]+)"/g)) for (const parte of (/srcset/.test(m[1]) ? m[2].split(',') : [m[2]])) {
    const r = parte.trim().split(/\s+/)[0].split('?')[0];
    if (r && r !== './' && !/^(https?:|mailto:|tel:|#|data:)/.test(r)) rutas.add(r);
  }
  const DE_LUGAR = /^(css\/lugar\.css|css\/alrededor\.css|js\/lugar\.js|js\/alrededor\.js)$/;
  const faltan = [...rutas].filter((r) => !existe(r) && !DE_LUGAR.test(r));
  comprobar(faltan.length === 0, `index.html: existen los ${rutas.size} archivos que enlaza (los de Lugar pueden faltar)`, faltan);
  const deLugarFaltan = ['css/lugar.css', 'css/alrededor.css', 'js/lugar.js', 'js/alrededor.js', 'partes/alrededor.html', 'LUGAR.md'].filter((f) => !existe(f));
  if (deLugarFaltan.length) nota('aún no están (de Lugar): ' + deLugarFaltan.join(', ') + ': la página usa los respaldos');
  // fotos: nunca por encima de su tamaño; ninguna del banner con el logo impreso
  const fotos = JSON.parse(leer('img/fotos/fotos.json'));
  comprobar(fotos.every((f) => Math.max(...f.anchos) <= f.ancho && f.ancho <= 800), 'ninguna foto se sirve por encima de su tamaño original (y ninguna pasa de 800 px)', fotos.filter((f) => Math.max(...f.anchos) > f.ancho).map((f) => f.nombre));
  comprobar(fotos.every((f) => !/\.png$/.test(f.fuente)), 'ningún banner *.png con el logo impreso');
  const faltanF = []; for (const f of fotos) for (const w of f.anchos) for (const e of ['webp', 'jpg']) if (!existe(`img/fotos/${f.nombre}-${w}.${e}`)) faltanF.push(`${f.nombre}-${w}.${e}`);
  comprobar(faltanF.length === 0, 'cada foto existe en sus anchos, en WebP y JPG', faltanF.slice(0, 5));
  // textos
  const texto = textoDe(html);
  const alts = [...html.matchAll(/(?:alt|aria-label|title)="([^"]*)"/g)].map((m) => m[1]).join(' ');
  const jsTextos = ['js/reserva.js', 'js/portada.js', 'js/fresno.js', 'js/main.js'].map((f) => leer(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')).join('\n');
  comprobar(!/[—–]/.test(texto + alts) && !/[—–]/.test(jsTextos), 'ni una raya (— ni –) en el texto, los alt, las etiquetas ni los textos de los módulos');
  comprobar(!/TODO|\[PENDIENTE\]/.test(texto) && !/lorem ipsum/i.test(texto), 'sin TODO ni texto de relleno');
  comprobar(/985 621 215/.test(texto) && /669 924 374/.test(texto) && /info@casafreixe\.com/.test(texto) && /33776/.test(texto) && /Ganadería Freixe S\.C\./.test(texto) && /AR0311/.test(texto) && /Reserva de la Biosfera/.test(texto), 'contacto, titular, AR0311 y la Reserva de la Biosfera en la página');
  // reseñas: pocas → sin recuento (feedback_resenas_pocas_sin_recuento)
  comprobar(!/\b(\d+|una|siete)\s+(opiniones|reseñas|opinión|reseña)\b/i.test(texto) && !/la (primera|segunda) (reseña|opinión)|(única|sola) (reseña|opinión)/i.test(texto), 'opiniones: sin recuento ni «la única/primera»');
  comprobar(/>5<\/span><span class="opiniones__de">\/5</.test(html) && /escapadarural\.com\/casa-rural\/asturias\/casa-freixe\/opiniones/.test(html), 'opiniones: 5/5 y el enlace a EscapadaRural');
  comprobar(!/aggregateRating|"review"/.test(html), 'datos estructurados sin nota ni reseñas');
  comprobar(!/clientes satisfechos|cientos de|miles de/i.test(texto), 'sin prueba social inventada en plural');
  const citas = [...texto.matchAll(/«([^»]+)»/g)].map((m) => m[1]);
  const fuenteOp = textoDe(leer('ref/origen/paginas/er-op.html')).replace(/\s+/g, ' ');
  comprobar(citas.length >= 5 && citas.every((c) => fuenteOp.includes(c)), `las ${citas.length} citas entre « » son literales de EscapadaRural`, citas.filter((c) => !fuenteOp.includes(c)));
  comprobar(/suele haber/.test(texto) && /por confirmar/.test(texto), 'la bienvenida dice «suele haber» y lo que hay hoy, «por confirmar»');
  comprobar(/Simulación|simulación/.test(leer('js/reserva.js')) && /supuesto|por confirmar/.test(texto), 'el simulador y el precio, marcados (simulación, por confirmar)');
  comprobar(!/<iframe/.test(html), 'ningún iframe en el HTML (el mapa se crea al pedirlo)');
  // contrato con Lugar
  comprobar(/<head>[\s\S]*<script src="js\/estacion\.js[^"]*"><\/script>[\s\S]*<\/head>/.test(html) && html.indexOf('js/estacion.js') < html.indexOf('css/base.css'), 'contrato: js/estacion.js en el <head>, sin defer, antes que las hojas de estilo');
  comprobar(/<script src="js\/lugar\.js[^"]*" defer>/.test(html) && /<script src="js\/alrededor\.js[^"]*" defer>/.test(html) && /href="css\/lugar\.css/.test(html) && /href="css\/alrededor\.css/.test(html), 'contrato: lugar.js y alrededor.js con defer; lugar.css y alrededor.css en el head');
  comprobar(!/three(\.module)?(\.min)?\.js/.test(html), 'la Web no carga Three.js (lo decide Lugar)');
  comprobar(/<section class="lugar" id="lugar"[\s\S]*?<div data-modulo="lugar">/.test(html) && /<section class="alrededor" id="alrededor"[\s\S]*?<div data-modulo="alrededor">/.test(html), 'los huecos: #lugar y #alrededor con su data-modulo');
  if (existe('partes/alrededor.html')) comprobar(html.includes(leer('partes/alrededor.html').trim().slice(0, 120)), 'Alrededor: partes/alrededor.html (de Lugar) está incrustado');
  const base = leer('css/base.css');
  comprobar(['--fondo', '--superficie', '--texto', '--texto-suave', '--marca', '--acento', '--piedra', '--pizarra', '--linea', '--letra-titular', '--letra-texto', '--letra-cifras'].every((v) => base.includes(v + ':')) && /#lugar \{[^}]*--fondo:[^}]*--texto:[^}]*--texto-suave:/.test(base), 'variables comunes en base.css y redefinidas para fondo oscuro dentro de #lugar');
  if (existe('data/lugar.json')) { const L = JSON.parse(leer('data/lugar.json')); comprobar(html.includes(`${L.casa.lat},${L.casa.lon}`) && html.includes(`"latitude":${L.casa.lat}`), 'la posición de la casa de data/lugar.json (Lugar) en el mapa y en los datos estructurados'); }
  // contraste: los textos de cada estación sobre su fondo (y el de la sección oscura)
  const tok = (bloque) => Object.fromEntries([...bloque.matchAll(/(--[\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
  const raizT = tok(base.match(/:root \{[\s\S]*?\n\}/)[0]);
  const lugarT = tok(base.match(/#lugar \{[\s\S]*?\n\}/)[0]);
  const malos = [];
  const ver = (n, a, b, min) => { const c = contraste(a, b); if (c < min) malos.push(`${n}: ${c.toFixed(2)}`); return c; };
  ver('texto-suave/fondo', raizT['--texto-suave'], raizT['--fondo'], 4.5);
  ver('texto-suave/superficie', raizT['--texto-suave'], raizT['--superficie'], 4.5);
  ver('marca-texto/fondo', raizT['--marca-texto'], raizT['--fondo'], 4.5);
  ver('cookies', '#EEF0EE', raizT['--pizarra'], 4.5);
  ver('lugar texto-suave', lugarT['--texto-suave'], lugarT['--fondo'], 4.5);
  const filas = [];
  for (const e of ['invierno', 'brotacion', 'verano', 'otono']) {
    const t = tok(base.match(new RegExp(`html\\[data-estacion="${e}"\\] \\{[^}]*\\}`))[0]);
    const a = ver(`${e} acento-texto/fondo`, t['--acento-texto'], raizT['--fondo'], 4.5);
    const b = ver(`${e} acento-texto/superficie`, t['--acento-texto'], raizT['--superficie'], 4.5);
    const c = ver(`${e} sobre-acento/acento (botón)`, t['--sobre-acento'], t['--acento'], 4.5);
    const d = ver(`${e} acento-claro/lugar`, t['--acento-claro'], lugarT['--fondo'], 4.5);
    ver(`${e} índice: sobre-acento/acento`, t['--sobre-acento'], t['--acento'], 4.5);
    filas.push(`${e} ${a.toFixed(1)}/${b.toFixed(1)}/${c.toFixed(1)}/${d.toFixed(1)}`);
  }
  medidas.contraste = filas;
  comprobar(malos.length === 0, 'contraste ≥ 4,5:1 en los textos de las cuatro estaciones (acento sobre fondo y superficie, botón, sección oscura) · ' + filas.join(' · '), malos);
  // letras: ninguna de la cartera
  const otras = fs.readdirSync(path.join(RAIZ, '..')).filter((d) => d.endsWith('-web') && d !== path.basename(RAIZ));
  const usadas = otras.filter((d) => { const f = path.join(RAIZ, '..', d, 'index.html'); return fs.existsSync(f) && /Didact\+Gothic|Inclusive\+Sans/.test(fs.readFileSync(f, 'utf8')); });
  comprobar(usadas.length === 0, `Didact Gothic e Inclusive Sans: no las usa ninguna otra web de la cartera (${otras.length} miradas)`, usadas);
  // la receta de borrado del mando, sobre copias en memoria
  const quitar = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i); return i < 0 || j < 0 ? null : s.slice(0, i) + s.slice(j + b.length); };
  const cab = quitar(leer('partes/cabeza.html'), '// MANDO DE MAQUETA', "h.classList.add('densidad-sobria');\n    }");
  const pie = quitar(leer('partes/pie.html'), '<!-- MANDO DE MAQUETA', '<!-- fin del MANDO DE MAQUETA -->');
  const mj = quitar(leer('js/main.js'), '/* ============ 12. MANDO DE MAQUETA', '/* fin del MANDO DE MAQUETA */');
  const css = quitar(base, '/* ---------- MANDO DE MAQUETA', '/* fin del MANDO DE MAQUETA */');
  const restos = Object.entries({ cab, pie, mj, css }).filter(([, s]) => !s || /revision|data-densidad|\.mando\b|id="mando"/.test(s)).map(([k, s]) => k + ': ' + (s ? s.match(/.{0,50}(revision|data-densidad|\.mando\b|id="mando").{0,30}/)[0] : 'sin sus marcas'));
  comprobar(restos.length === 0, 'receta de borrado del mando (README): tras quitar los cuatro bloques no queda rastro', restos);
  let sint = true; try { new vm.Script(mj); } catch (e) { sint = false; }
  comprobar(sint, 'main.js sigue siendo JS válido sin el bloque del mando');
  for (const f of ['aviso-legal.html', 'privacidad.html']) comprobar(/Ganadería Freixe S\.C\./.test(leer(f)) && /pendiente/i.test(leer(f)) && /AR0311/.test(leer(f)), `${f}: titular, NIF pendiente y registro`);
  comprobar(/freixe-cookies/.test(leer('cookies.html')) && /Google Maps/.test(leer('cookies.html')) && /inclinación/.test(leer('cookies.html')), 'cookies.html: la clave local, Google Maps y la inclinación del móvil');
  // el rótulo: geometría
  comprobar(/<svg class="rotulo rotulo--portada" id="rotulo-portada" viewBox="[^"]+"[^>]*data-i="[\d.]+ -\d+" data-copa="[\d.]+ -\d+ \d+ \d+"/.test(html) && /<text class="r-cursiva"[^>]*>Turismo Rural<\/text>/.test(html), 'el rótulo de la portada lleva la i, la copa y «Turismo Rural»');
}

/* ================= navegador ================= */
const necesitaNav = !SOLO.length || SOLO.some((n) => n > 1);
let browser = null;
const externas = [];
const malas = [];
const faltanLugar = new Set();
async function nueva(op = {}) {
  const ctxN = await browser.newContext({ viewport: op.viewport || { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: op.movimiento ? 'no-preference' : 'reduce', hasTouch: !!op.touch, isMobile: !!op.movil, locale: 'es-ES', timezoneId: 'Europe/Madrid', javaScriptEnabled: op.js !== false });
  if (!op.cookies) await ctxN.addInitScript(sinCookies);
  await ctxN.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === 'localhost') return route.continue();
    if (u.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    if (u.hostname === 'www.google.com') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>mapa falso</title><p>mapa falso</p>' });
    externas.push(u.href);
    return route.abort();
  });
  const page = await ctxN.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  // los «Failed to load resource» se miran por la respuesta (para saber qué fichero era): los de Lugar que aún no
  // existen (contrato: la etiqueta se queda) se anotan aparte y no cuentan como fallo
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (r.status() < 400 || u.hostname !== 'localhost') return;
    if (/^\/(js\/(lugar|alrededor)\.js|css\/(lugar|alrededor)\.css)$/.test(u.pathname) && !existe(u.pathname.slice(1))) { faltanLugar.add(u.pathname); return; }
    malas.push(r.status() + ' ' + r.url()); errores.push('404 ' + u.pathname);
  });
  page.errores = errores;
  return { ctx: ctxN, page };
}
const ir = async (page, url) => { await page.goto(url, { waitUntil: 'load' }); await page.waitForFunction(() => window.Freixe && window.Freixe.web); };
const esperarPortada = (page) => page.waitForFunction(() => document.querySelector('#portada.es-viva'), null, { timeout: 8000 });

if (necesitaNav) {
  browser = await chromium.launch({ args: ['--disable-3d-apis', '--disable-webgl', '--disable-gpu'] });
  try {

/* ================= 2. portada a cinco tamaños ================= */
if (toca(2)) {
  console.log('\n2. Portada «El punto de la i» (cinco tamaños, sin solapes)');
  for (const [w, hh] of [[360, 640], [375, 667], [390, 844], [768, 1024], [1280, 800]]) {
    const { ctx: c, page } = await nueva({ viewport: { width: w, height: hh }, movil: w < 700, touch: w < 700 });
    await ir(page, PAG);
    await esperarPortada(page);
    const m = await page.evaluate(() => {
      const r = (e) => { if (typeof e === 'string') e = document.querySelector(e); if (!e) return null; const b = e.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right, h: b.height, w: b.width }; };
      const svg = document.querySelector('#rotulo-portada');
      const letras = r(svg.querySelector('.r-letras'));
      const cursiva = r(svg.querySelector('.r-cursiva'));
      const est = window.Freixe.portada.actual.estado();
      return { cab: r('#cab'), letras, cursiva, pie: r('.portada__pie'), frase: r('.portada__frase'), btn: r('.portada__acc .btn'), tel: r('.portada__tel'), guia: r('#portada-guia'), sw: document.documentElement.scrollWidth, iw: innerWidth, ih: innerHeight, copa: est.geo.copa, base: est.geo.base, crecido: est.crecido, enMarcha: est.enMarcha, hojas: est.visibles, seg: est.segmentos };
    });
    const tag = `${w}×${hh}`;
    comprobar(m.btn && m.btn.b <= m.ih + 1 && m.tel.b <= m.ih + 1, `${tag}: «Ver fechas» y el teléfono a la vista sin bajar`, { btn: m.btn, tel: m.tel, ih: m.ih });
    comprobar(m.cursiva.b <= m.pie.t + 2, `${tag}: el rótulo («Turismo Rural» incluido) no pisa la frase ni los botones`, { cursiva: m.cursiva.b, pie: m.pie.t });
    comprobar(m.letras.t >= m.cab.b - 2, `${tag}: las letras quedan bajo la cabecera`, { letras: m.letras.t, cab: m.cab.b });
    const copaArriba = m.copa.cy - m.copa.ry * 1.12, copaIzq = m.copa.cx - m.copa.rx * 1.08, copaDer = m.copa.cx + m.copa.rx * 1.08;
    comprobar(copaArriba >= m.cab.b - 2 && copaIzq >= 0 && copaDer <= m.iw, `${tag}: la copa del fresno cabe entre la cabecera y los lados (arriba ${Math.round(copaArriba)} px, ancho ${Math.round(m.copa.rx * 2)} px)`, m.copa);
    comprobar(Math.abs(m.base.y - (m.letras.b - (m.letras.b - m.letras.t) * 0.88)) < 6 || m.base.y < m.letras.b, `${tag}: el tronco nace del palo de la i`, { base: m.base, letras: m.letras });
    comprobar(m.sw <= m.iw, `${tag}: sin scroll horizontal`, [m.sw, m.iw]);
    comprobar(m.crecido === 1 && !m.enMarcha && m.hojas > 0 && m.seg > 100, `${tag}: con movimiento reducido, el árbol de hoy entero y quieto (${m.seg} ramas, ${m.hojas} hojas a la vista)`, m);
    comprobar(page.errores.length === 0, `${tag}: sin errores en la consola`, page.errores);
    medidas['portada ' + tag] = { copa: Math.round(m.copa.rx * 2) + '×' + Math.round(m.copa.ry * 2), letras: Math.round(m.letras.w) };
    await c.close();
  }
  // el lienzo pinta de verdad (2D: no es WebGL): hay píxeles en la copa
  const { ctx: c, page } = await nueva();
  await ir(page, PAG); await esperarPortada(page);
  const px = await page.evaluate(() => {
    const cv = document.querySelector('.portada__lienzo canvas'), g = window.Freixe.portada.actual.estado().geo, k = cv.width / cv.clientWidth;
    const d = cv.getContext('2d').getImageData(Math.round((g.copa.cx - g.copa.rx) * k), Math.round((g.copa.cy - g.copa.ry) * k), Math.round(g.copa.rx * 2 * k), Math.round(g.copa.ry * 2 * k)).data;
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 30) n++;
    return { n, total: d.length / 4, copaVisible: getComputedStyle(document.querySelector('#rotulo-portada .r-copa')).visibility };
  });
  comprobar(px.n / px.total > 0.04 && px.copaVisible === 'hidden', `el fresno se pinta en el lienzo (${(100 * px.n / px.total).toFixed(0)} % de la caja de la copa) y la copa de respaldo se esconde`, px);
  await c.close();
  // sin JS: el rótulo con su copa verde de logo, la frase y los botones
  const { ctx: c2, page: p2 } = await nueva({ js: false });
  await p2.goto(PAG, { waitUntil: 'load' });
  const sj = await p2.evaluate(() => ({ copa: getComputedStyle(document.querySelector('#rotulo-portada .r-copa')).visibility, fill: getComputedStyle(document.querySelector('#rotulo-portada .r-copa')).fill, frase: document.querySelector('.portada__frase').textContent, cookies: document.querySelector('#cookies').hidden, monte: getComputedStyle(document.querySelector('#rotulo-portada .r-monte')).strokeDashoffset }));
  comprobar(sj.copa === 'visible' && /67, 116, 13|rgb\(67/.test(sj.fill) && /Barcia/.test(sj.frase), 'sin JS: el rótulo con la copa verde de su logo (#43740D) y la frase', sj);
  await c2.close();
}

/* ================= 3. las estaciones ================= */
if (toca(3)) {
  console.log('\n3. Las cuatro estaciones (?estacion=) y la de hoy');
  const { ctx: c, page } = await nueva();
  const vistos = {};
  for (const e of ['invierno', 'brotacion', 'verano', 'otono']) {
    await ir(page, PAG + '&estacion=' + e);
    await esperarPortada(page);
    const m = await page.evaluate(() => ({ est: document.documentElement.dataset.estacion, btn: getComputedStyle(document.querySelector('.portada__acc .btn--acento')).backgroundColor, arbol: window.Freixe.portada.actual.estado(), txt: document.querySelector('#portada-estacion').textContent, ramita: (() => { const cv = document.querySelector('canvas[data-ramita]'); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 30) n++; return n; })() }));
    vistos[e] = m.btn;
    const okHojas = e === 'invierno' ? m.arbol.visibles === 0 : m.arbol.visibles > 0;
    comprobar(m.est === e && m.arbol.estacion === e && okHojas && /vista de prueba/.test(m.txt) && m.ramita > 50, `${e}: data-estacion, el árbol (${m.arbol.visibles} hojas a la vista), el rótulo «vista de prueba» y la ramita pintada`, { est: m.est, arbol: m.arbol.estacion, visibles: m.arbol.visibles, txt: m.txt, ramita: m.ramita });
  }
  comprobar(new Set(Object.values(vistos)).size === 4, 'el acento del botón cambia en las cuatro estaciones (color computado)', vistos);
  // hoy (fecha de prueba 2026-11-26 → otoño tardío) y una de invierno con ?fecha
  await ir(page, PAG + '&fecha=2026-11-26'); await esperarPortada(page);
  const h = await page.evaluate(() => ({ e: window.Freixe.estacion, txt: document.querySelector('#portada-estacion').textContent, casa: document.querySelector('[data-estacion-texto]').textContent }));
  comprobar(h.e.nombre === 'otono' && h.e.progreso > 0.85 && /26 de noviembre/.test(h.txt) && /amarillo pálido/.test(h.txt) && /otoño/.test(h.casa), `26 de noviembre: otoño tardío (progreso ${h.e.progreso.toFixed(2)}), con la fecha y lo que hace el árbol`, h);
  await ir(page, PAG + '&fecha=2027-01-15'); await esperarPortada(page);
  comprobar(await page.evaluate(() => window.Freixe.estacion.nombre === 'invierno' && /yemas negras/.test(document.querySelector('#portada-estacion').textContent)), '15 de enero: invierno, con las yemas negras');
  await ir(page, PAG + '&fecha=2027-04-10'); await esperarPortada(page);
  comprobar(await page.evaluate(() => window.Freixe.estacion.nombre === 'brotacion' && /florece antes de echar la hoja/.test(document.querySelector('#portada-estacion').textContent) && window.Freixe.portada.actual.estado().visibles === 0), '10 de abril: brotación, flores antes que hojas (ninguna hoja aún)');
  comprobar(page.errores.length === 0, 'sin errores en la consola', page.errores);
  await c.close();
}

/* ================= 4. menú móvil ================= */
if (toca(4)) {
  console.log('\n4. Menú móvil (con la cabecera ya fija)');
  const { ctx: c, page } = await nueva({ viewport: { width: 390, height: 844 }, movil: true, touch: true });
  await ir(page, PAG);
  await page.evaluate(() => scrollTo(0, 1600));
  await page.waitForFunction(() => document.querySelector('#cab').classList.contains('sc'));
  await page.tap('#menu-btn');
  const ab = await page.evaluate(() => ({ exp: document.querySelector('#menu-btn').getAttribute('aria-expanded'), vis: getComputedStyle(document.querySelector('#menu-movil')).visibility, h: document.querySelector('#menu-movil').getBoundingClientRect().height }));
  comprobar(ab.exp === 'true' && ab.vis === 'visible' && ab.h >= 800, 'se abre: aria-expanded="true" y ocupa la pantalla', ab);
  await page.tap('#menu-btn');
  comprobar(await page.evaluate(() => document.querySelector('#menu-btn').getAttribute('aria-expanded') === 'false'), 'se cierra con el mismo botón (no queda debajo de la cortina del menú)');
  await page.tap('#menu-btn');
  await page.tap('#menu-movil a[href="#reservar"]');
  await page.waitForTimeout(150);
  const r = await page.evaluate(() => ({ exp: document.querySelector('#menu-btn').getAttribute('aria-expanded'), top: document.querySelector('#reservar').getBoundingClientRect().top }));
  comprobar(r.exp === 'false' && Math.abs(r.top) < 120, 'un enlace del menú lo cierra y lleva a la sección', r);
  await c.close();
}

/* ================= 5. cookies ================= */
if (toca(5)) {
  console.log('\n5. Aviso de cookies (los cuatro pasos)');
  const { ctx: c, page } = await nueva({ cookies: true });
  await ir(page, PAG);
  comprobar(await page.isVisible('#cookies'), 'contexto limpio: el aviso se ve');
  await page.click('#ck-si');
  comprobar(!(await page.isVisible('#cookies')) && (await page.evaluate((k) => localStorage.getItem(k), LLAVE)) === 'si', 'Entendido: se cierra y guarda la clave');
  await ir(page, PAG);
  comprobar(!(await page.isVisible('#cookies')), 'al recargar no vuelve');
  await page.evaluate((k) => localStorage.removeItem(k), LLAVE);
  await ir(page, PAG);
  comprobar(await page.isVisible('#cookies'), 'sin la clave, vuelve a salir');
  await page.click('#ck-no');
  await page.click('#abrir-cookies');
  comprobar(await page.isVisible('#cookies'), '«Preferencias de cookies» lo vuelve a abrir');
  await c.close();
}

/* ================= 6. visor por nombre ================= */
if (toca(6)) {
  console.log('\n6. Visor: cada miniatura abre SU foto (por nombre), escritorio y móvil');
  for (const movil of [false, true]) {
    const { ctx: c, page } = await nueva(movil ? { viewport: { width: 390, height: 844 }, movil: true, touch: true } : {});
    await ir(page, PAG);
    const nombres = await page.$$eval('[data-visor]', (as) => as.map((a) => a.dataset.visor + '|' + a.dataset.grupo));
    const malos = [];
    for (let i = 0; i < nombres.length; i++) {
      const b = page.locator('[data-visor]').nth(i);
      await b.scrollIntoViewIfNeeded();
      if (movil) await b.tap(); else await b.click();
      await page.waitForFunction(() => document.querySelector('#visor').open);
      const n = await page.evaluate(() => document.querySelector('#visor-img').dataset.nombre);
      if (n !== nombres[i].split('|')[0]) malos.push(nombres[i] + ' → ' + n);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#visor').open);
    }
    comprobar(malos.length === 0, `${movil ? 'móvil' : 'escritorio'}: las ${nombres.length} miniaturas abren su foto`, malos.slice(0, 4));
    if (movil) {
      await page.locator('.estancia [data-visor]').first().tap();
      await page.waitForFunction(() => document.querySelector('#visor').open);
      const antes = await page.evaluate(() => document.querySelector('#visor-img').dataset.nombre);
      const bb = await page.locator('#visor-sig').boundingBox();
      const tapan = await page.evaluate(({ x, y, h }) => [0.25, 0.5, 0.75, 0.9].map((k) => { const e = document.elementFromPoint(x, y + h * k); return e && e.closest('#visor-sig') ? null : (e ? e.className || e.tagName : 'nada'); }).filter(Boolean), { x: bb.x + bb.width / 2, y: bb.y, h: bb.height });
      await page.tap('#visor-sig');
      const despues = await page.evaluate(() => ({ n: document.querySelector('#visor-img').dataset.nombre, w: document.querySelector('#visor-img').getBoundingClientRect().width, max: +document.querySelector('#visor-img').width }));
      comprobar(tapan.length === 0 && despues.n !== antes, 'móvil: nada tapa «siguiente» y cambia de foto', { tapan, antes, despues });
      comprobar(despues.w <= despues.max + 1, 'el visor nunca enseña la foto más grande que su tamaño real', despues);
    }
    comprobar(page.errores.length === 0, 'sin errores en la consola', page.errores);
    await c.close();
  }
}

/* ================= 7. simulador ================= */
if (toca(7)) {
  console.log('\n7. Simulador de reservas (marcado)');
  const { ctx: c, page } = await nueva();
  await ir(page, PAG + '&fecha=2026-11-26');
  await page.locator('#reservar').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.sim[data-montado]'));
  const s0 = await page.evaluate(() => ({ aviso: document.querySelector('.sim__aviso').textContent, tipos: [...document.querySelectorAll('.sim__tipo')].map((b) => b.textContent), respaldo: getComputedStyle(document.querySelector('.sim__respaldo')).display }));
  comprobar(/Simulación/.test(s0.aviso) && /no reserva ni envía nada/.test(s0.aviso) && /2014/.test(s0.aviso) && s0.respaldo === 'none', 'aviso a la vista: simulación, días de ejemplo, precio de 2014 por confirmar', s0);
  // personas: I hasta 2, II hasta 3
  await page.click('.sim__tipo[data-unidad="i"]');
  for (let k = 0; k < 4; k++) if (await page.isEnabled('[data-p="1"]')) await page.click('[data-p="1"]');
  const pI = await page.textContent('#sim-pers');
  await page.click('.sim__tipo[data-unidad="ii"]');
  for (let k = 0; k < 4; k++) if (await page.isEnabled('[data-p="1"]')) await page.click('[data-p="1"]');
  const pII = await page.textContent('#sim-pers');
  comprobar(pI === '2' && pII === '3', 'Freixe I hasta 2 personas; Freixe II hasta 3 (supletoria, supuesto marcado)', { pI, pII });
  // tres noches libres en baja (enero), total = 3 × 65 × 1,10
  const r = await page.evaluate(() => {
    const F = window.Freixe, inst = [...F.web.montados].filter(([el]) => el.closest('#reservar')).map(([, x]) => x.inst).find((i) => i && i.elegir && i.estado);
    const f = F.reserva._f; let t = f(2027, 0, 12);
    const DIA = 864e5;
    // buscar una llegada con 3 noches libres de baja
    for (let k = 0; k < 60; k++, t += DIA) { inst.limpiar(); inst.elegir(t); inst.elegir(t + 3 * DIA); const e = inst.estado(); if (e.llegada === t && e.salida === t + 3 * DIA) break; }
    return { txt: document.querySelector('.res').textContent, mail: (document.querySelector('.res a[href^="mailto:"]') || {}).href || '' };
  });
  comprobar(/214,50 €/.test(r.txt) && /IVA \(10 %\)/.test(r.txt) && /mailto:info@casafreixe\.com\?subject=/.test(r.mail), 'tres noches en baja: 3 × 65 € + 10 % de IVA = 214,50 €, y el correo preparado', r.txt.slice(0, 300));
  // calendario: Semana Santa es alta
  comprobar(await page.evaluate(() => { const F = window.Freixe.reserva; const P = F._pascua(2027); return F._alta(P - 864e5) && F._alta(F._f(2027, 6, 10)) && !F._alta(F._f(2027, 1, 10)); }), 'temporada alta: Semana Santa y julio sí; febrero no');
  // la estación de cada mes del calendario
  comprobar(await page.evaluate(() => [...document.querySelectorAll('.cal__est')].length === 2 && document.querySelectorAll('canvas.cal__ramita').length === 2), 'cada mes lleva la estación del fresno (con su ramita en la versión «Fresno»)');
  // teclado: una parada por mes y flechas
  await page.focus('.cal__dia[tabindex="0"]');
  const t0 = await page.evaluate(() => +document.activeElement.dataset.t);
  await page.keyboard.press('ArrowRight');
  const t1 = await page.evaluate(() => +document.activeElement.dataset.t);
  comprobar(t1 - t0 === 864e5, 'calendario con flechas (+1 día)');
  comprobar(page.errores.length === 0, 'sin errores en la consola', page.errores);
  await c.close();
}

/* ================= 8. movimiento reducido: contenido completo ================= */
if (toca(8)) {
  console.log('\n8. Movimiento reducido: el contenido sigue cambiando');
  const { ctx: c, page } = await nueva();
  await ir(page, PAG);
  await page.locator('#est-bano').scrollIntoViewIfNeeded();
  await page.evaluate(() => { const e = document.querySelector('#est-bano'); scrollTo(0, e.getBoundingClientRect().top + scrollY - innerHeight * 0.3); });
  await page.waitForFunction(() => document.querySelector('.estancias__indice a[data-est="bano"]').getAttribute('aria-current') === 'true', null, { timeout: 3000 }).catch(() => {});
  comprobar(await page.evaluate(() => document.querySelector('.estancias__indice a[data-est="bano"]').getAttribute('aria-current') === 'true'), 'el índice de estancias marca la que se ve');
  const m = await page.evaluate(() => {
    const ani = getComputedStyle(document.querySelector('#rotulo-portada .r-monte'));
    return { monte: ani.strokeDashoffset, animacion: ani.animationName, est: window.Freixe.portada.actual.estado() };
  });
  comprobar((m.animacion === 'none' || m.monte === '0' || m.monte === '0px') && m.est.crecido === 1 && !m.est.enMarcha && m.est.soltadas === 0, 'la línea de monte ya trazada, el árbol entero y quieto, sin hojas cayendo', m);
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await page.waitForFunction(() => document.querySelector('.pie__arbol.es-vivo'), null, { timeout: 4000 }).catch(() => {});
  comprobar(await page.evaluate(() => document.querySelector('.pie__arbol.es-vivo') && /como está hoy en Barcia/.test(document.querySelector('#pie-txt').textContent)), 'el pie: el árbol completo de hoy (estado final)');
  await c.close();
}

/* ================= 9. mando de maqueta ================= */
if (toca(9)) {
  console.log('\n9. Mando de maqueta (solo con ?revision) y las dos densidades');
  const { ctx: c, page } = await nueva({ cookies: true });
  await ir(page, PAG);
  comprobar(await page.evaluate(() => document.querySelector('#mando').hidden && getComputedStyle(document.querySelector('#mando')).display === 'none'), 'sin ?revision: el mando no existe a la vista');
  await ir(page, PAG + '&revision');
  comprobar(await page.evaluate(() => document.querySelector('#mando').hidden), 'con el aviso de cookies en pantalla, el mando se aparta');
  await page.click('#ck-si');
  comprobar(await page.isVisible('#mando'), 'al cerrar el aviso, aparece');
  const antes = await page.evaluate(() => ({ vistazo: getComputedStyle(document.querySelector('#vistazo')).display, ramita: getComputedStyle(document.querySelector('.ramita')).display }));
  await page.click('button[data-densidad="sobria"]');
  const sob = await page.evaluate(() => ({ cls: document.documentElement.classList.contains('densidad-sobria'), vistazo: getComputedStyle(document.querySelector('#vistazo')).display, ramita: getComputedStyle(document.querySelector('.ramita')).display, sw: document.documentElement.scrollWidth, iw: innerWidth, url: location.search, viva: !!document.querySelector('#portada.es-viva') }));
  comprobar(antes.vistazo === 'none' && antes.ramita !== 'none' && sob.cls && sob.vistazo !== 'none' && sob.ramita === 'none' && sob.sw <= sob.iw && /densidad=sobria/.test(sob.url) && sob.viva, 'Sobria: cambia la ramita por el dato y añade la tabla «De un vistazo»; el árbol se vuelve a montar; sin scroll horizontal', { antes, sob });
  await page.click('button[data-densidad="fresno"]');
  comprobar(await page.evaluate(() => !document.documentElement.classList.contains('densidad-sobria') && getComputedStyle(document.querySelector('#vistazo')).display === 'none'), 'se puede volver a «Fresno»');
  await page.click('button[data-estacion="invierno"]');
  await page.waitForFunction(() => window.Freixe && window.Freixe.web && document.documentElement.dataset.estacion === 'invierno');
  comprobar(/estacion=invierno/.test(page.url()), 'el mando de estación recarga con ?estacion=');
  comprobar(page.errores.length === 0, 'sin errores en la consola', page.errores);
  await c.close();
}

/* ================= 10. 3D y Alrededor (sin pintar WebGL) ================= */
if (toca(10)) {
  console.log('\n10. Desde la puerta (#lugar) y Alrededor: contenedor y respaldo');
  const { ctx: c, page } = await nueva();
  await ir(page, PAG);
  await page.locator('#lugar').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => {
    const el = document.querySelector('#lugar [data-modulo="lugar"]');
    const img = el.querySelector('img');
    let malo = null;
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.overflow !== 'visible' && s.overflow !== 'clip' || s.transform !== 'none' || s.filter !== 'none') malo = e.className || e.tagName; }
    return { existe: !!el, alto: el.getBoundingClientRect().height, img: img ? img.complete && img.naturalWidth > 0 : null, texto: el.textContent.trim().length, malo, oscuro: getComputedStyle(document.querySelector('#lugar')).backgroundColor, color: getComputedStyle(document.querySelector('#lugar .sec-tit')).color };
  });
  comprobar(m.existe && m.alto > 100 && (m.img !== false) && m.texto > 40, '#lugar: el contenedor existe y su respaldo se ve (sin pintar el 3D)', m);
  comprobar(!m.malo, 'ningún antepasado del 3D lleva overflow, transform ni filter (su sticky funciona)', m.malo);
  comprobar(/rgb\(29, 35, 38\)/.test(m.oscuro) && /rgb\(238, 240, 238\)/.test(m.color), '#lugar es la sección oscura y su título usa el texto claro', m);
  const a = await page.evaluate(() => { const el = document.querySelector('#alrededor [data-modulo="alrededor"]'); return { existe: !!el, texto: el ? el.textContent.trim().length : 0 }; });
  comprobar(a.existe && a.texto > 40, 'Alrededor: el hueco existe con su lista (la de Lugar o la provisional)', a);
  comprobar(page.errores.length === 0, 'sin errores en la consola', page.errores);
  await c.close();
}

/* ================= 11. imágenes, legales y 404 ================= */
if (toca(11)) {
  console.log('\n11. Ningún <img> roto (recorriendo la página) y las páginas legales');
  for (const [w, hh] of [[1280, 800], [390, 844]]) {
    const { ctx: c, page } = await nueva({ viewport: { width: w, height: hh }, movil: w < 700 });
    await ir(page, PAG);
    const alto = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < alto; y += hh * 0.8) { await page.evaluate((yy) => scrollTo(0, yy), y); await page.waitForTimeout(60); }
    await page.waitForLoadState('networkidle').catch(() => {});
    const rotas = await page.evaluate(() => [...document.images].filter((i) => !/^data:/.test(i.src) && !(i.complete && i.naturalWidth > 0)).map((i) => i.currentSrc || i.src));
    comprobar(rotas.length === 0, `${w}×${hh}: todas las imágenes cargan (${await page.evaluate(() => document.images.length)})`, rotas.slice(0, 5));
    comprobar(page.errores.length === 0, `${w}×${hh}: sin errores en la consola`, page.errores);
    await c.close();
  }
  const { ctx: c, page } = await nueva();
  for (const f of ['aviso-legal.html', 'privacidad.html', 'cookies.html', 'accesibilidad.html', '404.html']) {
    await page.goto(BASE + f, { waitUntil: 'load' });
    const m = await page.evaluate(() => ({ h1: document.querySelector('h1') && document.querySelector('h1').textContent, sw: document.documentElement.scrollWidth, iw: innerWidth, rot: !!document.querySelector('use[href="#rotulo"]') && !!document.querySelector('#rotulo') }));
    comprobar(m.h1 && m.sw <= m.iw && m.rot && page.errores.length === 0, `${f}: se abre con su rótulo, sin errores`, { m, e: page.errores });
  }
  await c.close();
  comprobar(malas.length === 0, 'ninguna petición propia con error (404…) en toda la verificación', malas.slice(0, 6));
}

/* ================= 12. foco ================= */
if (toca(12)) {
  console.log('\n12. Foco del teclado con la forma del motivo (folíolo) y contraste');
  const { ctx: c, page } = await nueva();
  await ir(page, PAG);
  const formas = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(30);
    formas.push(await page.evaluate(() => { const m = document.querySelector('#foco-hoja'); const el = document.activeElement; return { el: el.tagName + (el.className ? '.' + String(el.className).split(' ')[0] : ''), vis: m.classList.contains('es-visible'), hoja: (m.querySelector('.foco-hoja__hoja').getAttribute('d') || '').length > 40, color: getComputedStyle(m).color }; }));
  }
  comprobar(formas.every((f) => f.vis && f.hoja), 'cada parada lleva el contorno y su folíolo dentado', formas);
  await c.close();
}

/* ================= 13. (reservado) ================= */

/* ================= 14. CON MOVIMIENTO, una vez y al final: entrada, viento, caída, gesto táctil y rendimiento ================= */
if (toca(14)) {
  console.log('\n14. Con movimiento (una sola prueba): el árbol crece, el viento lo mueve, caen hojas, el dedo y la CPU lenta');
  const { ctx: c, page } = await nueva({ movimiento: true });
  await page.addInitScript(() => {
    window.__largas = [];
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__largas.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true }); } catch (e) { /* nada */ }
    window.__lcp = null;
    try { new PerformanceObserver((l) => { const e = l.getEntries().pop(); window.__lcp = { t: Math.round(e.startTime), el: e.element ? e.element.tagName + (typeof e.element.className === 'string' ? '.' + e.element.className : '') : '' }; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) { /* nada */ }
  });
  await ir(page, PAG + '&fecha=2026-11-26');
  await esperarPortada(page);
  const m0 = await page.evaluate(() => window.Freixe.portada.actual.estado().crecido);
  await page.waitForFunction(() => window.Freixe.portada.actual.estado().crecido >= 1, null, { timeout: 9000 });
  const lcp = await page.evaluate(() => window.__lcp);
  comprobar(m0 < 1, `el árbol crece al entrar (crecido al montar: ${m0.toFixed(2)}) y acaba entero`);
  comprobar(lcp && /portada__frase|sec-|casa__intro|H1|portada__estacion/.test(lcp.el) || (lcp && lcp.t < 2500), `LCP: ${lcp ? lcp.el + ' a ' + lcp.t + ' ms' : '?'} (texto, no depende de la animación)`, lcp);
  medidas.lcp = lcp;
  // el puntero es viento
  await page.mouse.move(300, 300);
  for (let i = 0; i < 12; i++) await page.mouse.move(300 + i * 70, 320, { steps: 2 });
  const racha = await page.evaluate(() => window.Freixe.portada.actual.estado().racha);
  comprobar(racha > 0.4, `el puntero hacia la derecha levanta viento (racha ${racha.toFixed(2)})`);
  // al bajar con la rueda caen hojas hacia «La casa»
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(60); }
  await page.waitForTimeout(500);
  const caen = await page.evaluate(() => window.Freixe.portada.actual.estado());
  comprobar(caen.soltadas >= 4 && (caen.cayendo > 0 || caen.caidas > 0), `al bajar caen hojas (${caen.soltadas} soltadas, ${caen.cayendo} en el aire)`, { soltadas: caen.soltadas, cayendo: caen.cayendo });
  const ms = caen.muestrasMs.slice(-120);
  const media = ms.reduce((a, b) => a + b, 0) / Math.max(1, ms.length);
  medidas.escritorio = { mediaMs: +media.toFixed(1), largas: await page.evaluate(() => window.__largas.slice(0, 20)) };
  nota(`escritorio 1280×800, DPR 1: ${media.toFixed(1)} ms por fotograma de media; tareas largas: ${JSON.stringify(medidas.escritorio.largas)}`);
  // el pie: lo que cayó, al pie del tronco
  await page.waitForTimeout(2500);
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await page.waitForFunction(() => document.querySelector('.pie__arbol.es-vivo'), null, { timeout: 4000 }).catch(() => {});
  const pie = await page.evaluate(() => document.querySelector('#pie-txt').textContent);
  comprobar(/cayeron mientras bajabas|cayó mientras bajabas/.test(pie), 'el pie cierra el objeto: el árbol de hoy y, al pie, las hojas que cayeron', pie);
  comprobar(await page.evaluate(() => !window.Freixe.portada.actual.estado().enMarcha), 'fuera de pantalla, el bucle de la portada se para');
  comprobar(page.errores.length === 0, 'sin errores en la consola', page.errores);
  await c.close();

  // móvil de gama media: CPU ×4, 390×844, táctil: el dedo en horizontal es viento y en vertical sigue siendo scroll
  const { ctx: c2, page: p2 } = await nueva({ movimiento: true, viewport: { width: 390, height: 844 }, movil: true, touch: true });
  const cdp = await c2.newCDPSession(p2);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await ir(p2, PAG + '&fecha=2026-11-26');
  await esperarPortada(p2);
  await p2.waitForFunction(() => window.Freixe.portada.actual.estado().crecido >= 1, null, { timeout: 15000 });
  const toque = async (x0, y0, x1, y1) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let k = 1; k <= 8; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * k / 8, y: y0 + (y1 - y0) * k / 8 }] }); await p2.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await toque(80, 300, 330, 305);
  const rm = await p2.evaluate(() => ({ racha: window.Freixe.portada.actual.estado().racha, y: scrollY }));
  comprobar(rm.racha > 0.3 && rm.y === 0, `móvil: deslizar el dedo en horizontal sobre el árbol es viento (racha ${rm.racha.toFixed(2)}) y no mueve la página`, rm);
  await toque(200, 600, 200, 250);
  await p2.waitForTimeout(400);
  const y2 = await p2.evaluate(() => scrollY);
  comprobar(y2 > 100, `móvil: en vertical, el dedo sigue bajando la página (scrollY ${Math.round(y2)})`);
  await p2.evaluate(() => scrollTo(0, 0));
  await p2.waitForTimeout(3200);
  const e2 = await p2.evaluate(() => window.Freixe.portada.actual.estado());
  const ms2 = e2.muestrasMs.slice(-150), media2 = ms2.reduce((a, b) => a + b, 0) / Math.max(1, ms2.length);
  medidas.movil = { cpu: 4, mediaMs: +media2.toFixed(1), dpr: +e2.dpr.toFixed(2), calidad: +e2.calidad.toFixed(2), bajadas: e2.bajadas };
  nota(`móvil 390×844 con CPU ×4: ${media2.toFixed(1)} ms por fotograma de media, DPR del lienzo ${e2.dpr.toFixed(2)}, bajadas de calidad: ${e2.bajadas}`);
  comprobar(media2 < 40 || e2.bajadas > 0, 'con CPU ×4 el árbol va fluido o baja la calidad solo', medidas.movil);
  comprobar(p2.errores.length === 0, 'sin errores en la consola', p2.errores);
  await c2.close();
}

  } finally {
    await browser.close();
  }
}
servidor.close();

// Alrededor (2D) de Lugar: su prueba, DESPUÉS de cerrar este navegador (una prueba de Playwright a la vez)
if (!SOLO.length || SOLO.includes(15)) {
  if (existe('scripts/alrededor-prueba.mjs')) {
    console.log('\n15. Alrededor (scripts/alrededor-prueba.mjs, de Lugar)');
    try { execFileSync(process.execPath, [path.join(RAIZ, 'scripts/alrededor-prueba.mjs')], { stdio: 'inherit', timeout: 300000 }); comprobar(true, 'la prueba de Alrededor de Lugar pasa'); }
    catch (e) { comprobar(false, 'la prueba de Alrededor de Lugar pasa', String(e.message).slice(0, 200)); }
  } else nota('aún no está scripts/alrededor-prueba.mjs (de Lugar): Alrededor solo se ha comprobado como hueco con lista');
}

if (faltanLugar.size) nota('pedidos y aún sin hacer (de Lugar): ' + [...faltanLugar].join(', '));
if (externas.length) nota('peticiones externas bloqueadas: ' + [...new Set(externas.map((u) => new URL(u).hostname))].join(', '));
console.log('\nMedidas: ' + JSON.stringify(medidas));
console.log(`\n${nOk} bien, ${fallos.length} mal`);
if (fallos.length) { console.log('Fallos:\n  - ' + fallos.join('\n  - ')); process.exitCode = 1; }

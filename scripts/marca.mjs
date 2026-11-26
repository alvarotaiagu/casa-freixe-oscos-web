/* Recursos de marca a partir del rótulo redibujado (marca/rotulo.svg y marca/favicon.svg, que escribe construir.mjs):
   img/og.jpg (1200×630), marca/favicon-32.png, marca/apple-touch-icon.png (180) y marca/icono-512.png.
   Uso: node construir.mjs && node scripts/marca.mjs
   UN navegador, escala 1, se cierra siempre. La letra cursiva (Sacramento) se pide a Google Fonts solo para «Turismo Rural». */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rotulo = fs.readFileSync(path.join(RAIZ, 'marca/rotulo.svg'), 'utf8');
const favicon = fs.readFileSync(path.join(RAIZ, 'marca/favicon.svg'), 'utf8');
fs.mkdirSync(path.join(RAIZ, 'img'), { recursive: true });

const og = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Didact+Gothic&family=Sacramento&display=block">
<style>html,body{margin:0}body{width:1200px;height:630px;background:#EDEEEB;display:grid;grid-template-rows:1fr auto;font-family:'Didact Gothic',sans-serif;color:#1A1E21}
.r{display:grid;place-items:center;padding:40px 90px 0}.r svg{width:100%;height:auto}
p{margin:0;padding:0 90px 48px;font-size:30px;display:grid;gap:4px;text-align:center}p span{color:#4A5156;font-size:23px}</style></head>
<body><div class="r">${rotulo}</div><p>Dos apartamentos rurales en Barcia, Santa Eulalia de Oscos<span>Reserva de la Biosfera de Oscos-Eo</span></p></body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(og, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(RAIZ, 'img/og.jpg'), type: 'jpeg', quality: 86 });
  for (const [n, t] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180], ['icono-512.png', 512]]) {
    await page.setViewportSize({ width: t, height: t });
    await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{width:${t}px;height:${t}px;display:block}</style>${favicon.replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" ')}`);
    await page.screenshot({ path: path.join(RAIZ, 'marca', n), omitBackground: true });
  }
  console.log('img/og.jpg y marca/favicon-32.png, apple-touch-icon.png, icono-512.png');
} finally {
  await browser.close();
}

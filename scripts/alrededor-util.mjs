// Utilidades de los scripts de Lugar y Alrededor: Overpass con espejos (y caché), OSRM y distancia en línea recta.
// Receta de ../apartamentos-montemar-navia-web/scripts/alrededor-util.mjs. User-Agent genérico, sin datos personales.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const UA = 'datos-mapa-script/1.0 (uso puntual)';
const ESPEJOS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];
export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export async function overpass(q, { rondas = 3, timeout = 90000 } = {}) {
  for (let ronda = 0; ronda < rondas; ronda++) for (const e of ESPEJOS) {
    try {
      const r = await fetch(e, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(timeout) });
      if (r.ok) { const j = await r.json(); if (j.elements) return j; } else console.error('  overpass', e, r.status);
    } catch (err) { console.error('  overpass', e, err.message); }
    await dormir(1500);
  }
  throw new Error('Overpass no responde');
}

// guarda la respuesta en ref/raw/<carpeta>/<nombre> y la reutiliza (borrar el fichero para rehacerla)
export async function cacheado(carpeta, nombre, fn) {
  const dir = path.join(RAIZ, 'ref/raw', carpeta);
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, nombre);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const j = await fn();
  fs.writeFileSync(f, JSON.stringify(j));
  return j;
}

export async function pedirJSON(url, { intentos = 5, ok = (j) => j.code === 'Ok' } = {}) {
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
      if (r.ok) { const j = await r.json(); if (ok(j)) return j; }
    } catch (e) { /* reintenta */ }
    await dormir(2500 + 1500 * i);
  }
  throw new Error('falla ' + url);
}

export const hav = (a, b) => {
  const r = Math.PI / 180, dx = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r), dy = (b.lat - a.lat) * r;
  return 6371000 * Math.hypot(dx, dy);
};

export const CASA = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/lugar.json'), 'utf8')).casa;

/* Servidor estático para mirar la web en local: node servir.mjs  →  http://localhost:8981/
   (Lugar usa el 8982; verificar.mjs, el 8991.) Sin caché, para ver cada cambio al recargar. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = +(process.argv[2] || 8981);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.bin': 'application/octet-stream', '.glb': 'model/gltf-binary' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); fs.createReadStream(path.join(RAIZ, '404.html')).pipe(res); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).on('error', (e) => { console.error(`El puerto ${PUERTO} está ocupado: ${e.message}`); process.exit(2); })
  .listen(PUERTO, () => console.log(`Casa Freixe en http://localhost:${PUERTO}/`));

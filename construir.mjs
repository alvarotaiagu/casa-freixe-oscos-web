/* Genera las páginas a partir de sus fuentes *.src.html (arquitectura de ../apartamentos-alba-somiedo-web/construir.mjs):
   1. <!--parte:partes/archivo.html--> → el contenido de ese archivo (si falta, un comentario y la web sigue).
   2. Una sola fuente de datos del negocio: data/freixe.json (de ref/DATOS-FREIXE.md) y data/fotos.json (la galería).
   3. EL RÓTULO: su logo redibujado aquí, en SVG (rotulo()): «Casa Freixe» en palo seco geométrico fino, la línea de
      monte de dos lomas de la C al árbol, el palo de la i y la copa del fresno como punto; debajo «Turismo Rural» en
      cursiva con su rúbrica. Sale en la portada (inline, con piezas animables), como <symbol id="rotulo"> para la
      cabecera, y en el pie. También como marca/rotulo.svg (para scripts/marca.mjs: og, favicon).
   4. @@ALREDEDOR@@ → partes/alrededor.html (de Lugar); sin él, una lista provisional sin cifras.
   5. data/lugar.json (de Lugar): la posición de la casa para el mapa y los datos estructurados; sin él, la de TA.
   6. <img data-foto="nombre" ...> → <picture> WebP + JPG en los anchos de img/fotos/fotos.json (nunca se amplía).
   7. Los <link>/<script> propios que no existen se quitan con un aviso, SALVO los de Lugar (css/lugar.css,
      css/alrededor.css, js/lugar.js, js/alrededor.js): se dejan, para que en cuanto existan se carguen sin reconstruir.
   8. Ejecuta versionar.mjs (?v=<huella> en CSS y JS).
   Se edita SIEMPRE el *.src.html (o la parte); el .html generado se sobrescribe. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const existe = (f) => fs.existsSync(path.join(RAIZ, f));
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const leerJson = (f) => JSON.parse(leer(f));
const leerSi = (f) => (existe(f) ? leerJson(f) : null);
const D = leerJson('data/freixe.json');
const G = leerJson('data/fotos.json');
const FOTOS = new Map(leerJson('img/fotos/fotos.json').map((f) => [f.nombre, f]));
const LUGAR = leerSi('data/lugar.json');
const CASA = LUGAR && LUGAR.casa && Number.isFinite(LUGAR.casa.lat) ? LUGAR.casa : { lat: D.lugar.lat, lon: D.lugar.lon, provisional: true };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const ico = (n, t = 24) => `<svg class="ico" width="${t}" height="${t}" aria-hidden="true"><use href="#i-${n}" width="24" height="24"/></svg>`;
const f1 = (n) => +n.toFixed(2);

/* =====================================================================================================
   EL RÓTULO. Unidades: altura de mayúscula 100, de x 70, trazo 5,5 (como el del logo: fino). Línea base en y = 0.
   ===================================================================================================== */
const SW = 5.5, h = SW / 2, X = 70;
const arco = (cx, cy, r, a) => [f1(cx + r * Math.cos((a * Math.PI) / 180)), f1(cy + r * Math.sin((a * Math.PI) / 180))];
const glifos = {
  C: (o) => { const cx = o + 50, cy = -50, r = 50 - h, [x0, y0] = arco(cx, cy, r, -40), [x1, y1] = arco(cx, cy, r, 40); return { d: [`M${x0} ${y0}A${r} ${r} 0 1 0 ${x1} ${y1}`], w: 90 }; },
  a: (o) => { const r = X / 2 - h, cx = o + X / 2, cy = -X / 2; return { d: [`M${f1(cx - r)} ${cy}A${r} ${r} 0 1 0 ${f1(cx + r)} ${cy}A${r} ${r} 0 1 0 ${f1(cx - r)} ${cy}Z`, `M${f1(cx + r)} ${-X}V0`], w: 70 }; },
  s: (o) => ({ d: [`M${o + 40.5} -58C${o + 37} -64.5 ${o + 30.5} -67.25 ${o + 22.5} -67.25C${o + 12} -67.25 ${o + 5} -61.5 ${o + 5} -53C${o + 5} -43.5 ${o + 13} -40 ${o + 22} -37.5C${o + 32} -34.8 ${o + 40.5} -31 ${o + 40.5} -19.5C${o + 40.5} -9 ${o + 32} -2.75 ${o + 21.5} -2.75C${o + 12.5} -2.75 ${o + 5.5} -7 ${o + 2.5} -14`], w: 43 }),
  F: (o) => ({ d: [`M${o + h} 0V-100`, `M${o} ${-100 + h}H${o + 52}`, `M${o + h} -52H${o + 44}`], w: 54 }),
  r: (o) => ({ d: [`M${o + h} 0V${-X}`, `M${o + h} -38C${o + h} -57 ${o + 13} ${-X + h} ${o + 31} ${-X + h}`], w: 34 }),
  e: (o) => { const r = X / 2 - h, cx = o + X / 2, cy = -X / 2, [x1, y1] = arco(cx, cy, r, 42); return { d: [`M${o + h} ${cy}H${f1(cx + r)}A${r} ${r} 0 1 0 ${x1} ${y1}`], w: 70 }; },
  x: (o) => ({ d: [`M${o} ${-X}L${o + 58} 0`, `M${o + 58} ${-X}L${o} 0`], w: 58 }),
};
// «Casa Freixe»: letra, espacio detrás
const LETRAS = [['C', 12], ['a', 13], ['s', 13], ['a', 48], ['F', 11], ['r', 9], ['e', 15], ['i', 15], ['x', 11], ['e', 0]];
let ox = 0;
const trazos = [];
let I_X = 0;
for (const [l, sep] of LETRAS) {
  if (l === 'i') { I_X = ox + h; ox += SW + sep; continue; }
  const g = glifos[l](ox);
  trazos.push(...g.d);
  ox += g.w + sep;
}
const ANCHO = ox; // 711
const I_TOP = -88;
// la copa del logo (punto de la i): centro y radios, en unidades del rótulo
const COPA = { cx: f1(I_X), cy: -120, rx: 66, ry: 60 };
// Catmull-Rom → Bézier (curva suave por puntos)
function suave(p, cerrada = false) {
  const n = p.length, P = (i) => p[cerrada ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = `M${f1(p[0][0])} ${f1(p[0][1])}`;
  for (let i = 0; i < (cerrada ? n : n - 1); i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d + (cerrada ? 'Z' : '');
}
// la línea de monte, de la C a la copa: dos lomas, la segunda más alta (como en su logo)
const MONTE = suave([[98, -101], [150, -123], [205, -140], [255, -129], [300, -112], [360, -128], [420, -148], [462, -143], [COPA.cx - COPA.rx + 3, -127]]);
// la copa de respaldo (la de su logo, una mancha verde con lóbulos): sin JS, con movimiento reducido o si falla el lienzo
const copaPts = [];
for (let k = 0; k < 44; k++) {
  const t = (k / 44) * Math.PI * 2;
  const lob = 1 + 0.06 * Math.sin(4 * t + 0.6) + 0.05 * Math.sin(7 * t + 2.1) + 0.022 * Math.sin(11 * t + 0.4);
  const ab = Math.sin(t) > 0.55 ? 0.9 : 1; // la base algo recogida, como en el logo
  copaPts.push([COPA.cx + Math.cos(t) * COPA.rx * lob, COPA.cy + Math.sin(t) * COPA.ry * lob * ab]);
}
const COPA_D = suave(copaPts, true);
const RUBRICA = 'M150 50C190 30 236 32 238 46C240 60 206 62 204 50C202 36 250 34 300 44C350 54 400 58 448 54';
const VB = `-12 -200 ${ANCHO + 25} 296`;

function rotulo({ id = '', clase = 'rotulo', piezas = false } = {}) {
  const datos = piezas ? ` data-i="${f1(I_X)} ${I_TOP}" data-copa="${COPA.cx} ${COPA.cy} ${COPA.rx} ${COPA.ry}" data-trazo="${SW}" data-ancho="${ANCHO}"` : '';
  return `<svg class="${clase}"${id ? ` id="${id}"` : ''} viewBox="${VB}" aria-hidden="true" focusable="false"${datos}>
          <path class="r-monte" pathLength="1" d="${MONTE}"/>
          <path class="r-letras" d="${trazos.join('')}"/>
          <path class="r-i"${piezas ? ' id="rotulo-i"' : ''} pathLength="1" d="M${f1(I_X)} 0V${I_TOP}"/>
          <path class="r-copa" d="${COPA_D}"/>
          <path class="r-rubrica" pathLength="1" d="${RUBRICA}"/>
          <text class="r-cursiva" x="${ANCHO - 4}" y="72" text-anchor="end">Turismo Rural</text>
        </svg>`;
}
function rotuloSimbolo() {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs><symbol id="rotulo" viewBox="${VB}">
  <path class="r-monte" d="${MONTE}"/><path class="r-letras" d="${trazos.join('')}"/><path class="r-i" d="M${f1(I_X)} 0V${I_TOP}"/><path class="r-copa" d="${COPA_D}"/>
</symbol></defs></svg>`;
}
// el rótulo suelto, para scripts/marca.mjs (og:image, favicon): colores escritos, sin CSS
function rotuloSuelto() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB}">
  <g fill="none" stroke="#1A1E21" stroke-width="${SW}"><path d="${MONTE}" stroke-width="2.4"/><path d="${trazos.join('')}"/><path d="M${f1(I_X)} 0V${I_TOP}"/><path d="${RUBRICA}" stroke-width="1.8"/></g>
  <path d="${COPA_D}" fill="#43740D"/>
  <text x="${ANCHO - 4}" y="72" text-anchor="end" font-family="Sacramento, cursive" font-size="50" fill="#1A1E21">Turismo Rural</text>
</svg>
`;
}
fs.mkdirSync(path.join(RAIZ, 'marca'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'marca/rotulo.svg'), rotuloSuelto());
fs.writeFileSync(path.join(RAIZ, 'marca/favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f1(COPA.cx - 76)} -196 152 200"><rect x="${f1(COPA.cx - 76)}" y="-196" width="152" height="200" rx="28" fill="#EDEEEB"/><path d="M${f1(I_X)} 0V-96" stroke="#1A1E21" stroke-width="11" fill="none"/><path d="${COPA_D}" fill="#43740D" transform="translate(${f1(COPA.cx)} -120) scale(1.08) translate(${f1(-COPA.cx)} 120)"/></svg>
`);

/* ---------- fotos ---------- */
function picture(atrs) {
  const nombre = /data-foto="([^"]+)"/.exec(atrs)[1];
  const f = FOTOS.get(nombre);
  if (!f) throw new Error('Foto desconocida: ' + nombre);
  const set = (ext) => f.anchos.map((w) => `img/fotos/${nombre}-${w}.${ext} ${w}w`).join(', ');
  const sizes = (/\bsizes="([^"]+)"/.exec(atrs) || [, '100vw'])[1];
  let resto = atrs.replace(/\s*data-foto="[^"]+"/, '').replace(/\s*\bsizes="[^"]+"/, '');
  if (!/\bloading=/.test(resto)) resto += ' loading="lazy"';
  if (!/\bdecoding=/.test(resto)) resto += ' decoding="async"';
  return `<picture data-foto="${nombre}"><source type="image/webp" srcset="${set('webp')}" sizes="${sizes}"><img src="img/fotos/${nombre}-${f.anchos[0]}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${f.ancho}" height="${f.alto}" style="--max:${f.ancho}px"${resto}></picture>`;
}
const altDe = (n) => { for (const e of G.estancias) for (const x of e.fotos) if (x.n === n) return x.alt; return n; };
function fotoVisor(n, grupo, sizes, alt) {
  const f = FOTOS.get(n);
  if (!f) throw new Error('Foto desconocida: ' + n);
  const a = alt || altDe(n);
  return `<a class="foto-btn" href="img/fotos/${n}-${f.ancho}.jpg" data-visor="${n}" data-grupo="${grupo}" data-anchos="${f.anchos.join(',')}" data-ancho="${f.ancho}" data-alto="${f.alto}" aria-label="Ver más grande: ${esc(a)}"><img data-foto="${n}" alt="${esc(a)}" sizes="${sizes}"></a>`;
}

/* ---------- los dos apartamentos ---------- */
const P = D.precios;
function unidades() {
  const ficha = (u) => `      <article class="apto apto--${u.id}" id="apto-${u.id}" aria-labelledby="t-apto-${u.id}">
        <p class="apto__num" aria-hidden="true">${u.romano}</p>
        <h3 class="apto__tit" id="t-apto-${u.id}">${esc(u.nombre)}</h3>
        <p class="apto__txt">${esc(u.texto)}</p>
        <dl class="apto__datos">
          <div><dt>Plazas</dt><dd><span class="cifra">${u.personas[1]}</span>${u.personas[1] > 2 ? ' <small class="es-pendiente">con supletoria, por confirmar</small>' : ''}</dd></div>
          <div><dt>Plantas</dt><dd>${u.plantasConfirmado ? esc(u.plantas) : '<span class="es-pendiente">Por confirmar</span>'}</dd></div>
          <div><dt>Chimenea de leña</dt><dd>En la cocina-salón</dd></div>
          <div><dt>La noche</dt><dd><span class="cifra">${P.baja}</span> o <span class="cifra">${P.alta}</span> € <small>+ IVA<sup>*</sup></small></dd></div>
        </dl>
        <div class="apto__fotos" role="group" aria-label="Fotos de ${esc(u.nombre)}">
${u.fotos.map((n) => `          ${fotoVisor(n, 'apto-' + u.id, '(max-width: 699px) 70vw, 22vw')}`).join('\n')}
        </div>
        <a class="btn btn--acento" href="#reservar" data-reservar="${u.id}">Ver fechas<span class="vh"> de ${esc(u.nombre)}</span></a>
      </article>`;
  return `      <div class="aptos__par">
${D.unidades.map(ficha).join('\n')}
      </div>
      <p class="aptos__nota"><sup>*</sup> Precio por apartamento y noche de su web (2014): ${P.baja} € en temporada baja y ${P.alta} € en alta, IVA (${D.iva} %) aparte. <span class="es-pendiente">Tarifa vigente por confirmar.</span> Qué fotos son de cada apartamento sale de su web: por confirmar con la casa.</p>`;
}
function vistazo() {
  const [a, b] = D.unidades;
  const filas = [
    ['Plazas', String(a.personas[1]), `${b.personas[1]} (con supletoria)`],
    ['Plantas', a.plantasConfirmado ? a.plantas : 'Por confirmar', b.plantasConfirmado ? b.plantas : 'Por confirmar'],
    ['Dormitorio', 'De matrimonio', 'De matrimonio'],
    ['Chimenea de leña', 'Sí', 'Sí'],
    ['Baño completo', 'Sí', 'Sí'],
    ['Entrada', 'Independiente', 'Independiente'],
    ['Noche en temporada baja', `${P.baja} € + IVA`, `${P.baja} € + IVA`],
    ['Noche en temporada alta', `${P.alta} € + IVA`, `${P.alta} € + IVA`],
  ];
  return `      <div class="vistazo" id="vistazo">
        <h3 class="vistazo__tit">De un vistazo</h3>
        <div class="vistazo__caja" role="group" aria-label="Tabla comparativa de los dos apartamentos">
          <table class="vistazo__tabla">
            <caption class="vh">Freixe I y Freixe II comparados</caption>
            <thead><tr><th scope="col"><span class="vh">Dato</span></th><th scope="col">Freixe I</th><th scope="col">Freixe II</th></tr></thead>
            <tbody>
${filas.map(([t, x, y]) => `              <tr><th scope="row">${t}</th><td>${x}</td><td>${y}</td></tr>`).join('\n')}
            </tbody>
          </table>
        </div>
        <p class="vistazo__nota">Supletoria en Freixe II, plantas de Freixe II y tarifa vigente: por confirmar con la casa.</p>
      </div>`;
}
function servicios() {
  return `      <div class="servicios">
        <h3 class="servicios__tit">En los dos</h3>
        <ul class="servicios__lista">
${D.servicios.map((s) => `          <li>${ico(s.icono, 30)}<b>${esc(s.nombre)}</b><span>${esc(s.detalle)}</span></li>`).join('\n')}
        </ul>
      </div>`;
}

/* ---------- por dentro, por estancias ---------- */
function galeria() {
  const E = G.estancias.filter((e) => e.fotos.length);
  const ind = E.map((e, i) => `            <li><a href="#est-${e.id}" data-est="${e.id}"${i === 0 ? ' aria-current="true"' : ''}><span class="estancias__largo">${esc(e.nombre)}</span><span class="estancias__corto" aria-hidden="true">${esc(e.corto)}</span><span class="estancias__n cifra" aria-hidden="true">${e.fotos.length}</span></a></li>`).join('\n');
  const grupos = E.map((e) => `          <section class="estancia" id="est-${e.id}" aria-labelledby="t-est-${e.id}">
            <h3 class="estancia__tit" id="t-est-${e.id}">${esc(e.nombre)}</h3>
            <p class="estancia__txt">${esc(e.texto)}</p>
            <div class="filas">
${e.fotos.map((x) => { const f = FOTOS.get(x.n); return `              <figure class="foto" style="--r:${(f.ancho / f.alto).toFixed(3)};--max:${f.ancho}px">${fotoVisor(x.n, 'galeria', '(max-width: 699px) 92vw, (max-width: 1099px) 46vw, 30vw', x.alt)}${x.ap ? `<figcaption class="foto__ap">Freixe ${x.ap}</figcaption>` : ''}</figure>`; }).join('\n')}
            </div>
          </section>`).join('\n');
  return `      <p class="galeria__aviso">${esc(G.aviso)}</p>
      <div class="estancias">
        <nav class="estancias__indice" aria-label="Estancias">
          <ol>
${ind}
          </ol>
        </nav>
        <div class="estancias__grupos">
${grupos}
        </div>
      </div>`;
}

/* ---------- la bienvenida ---------- */
function bienvenida() {
  return `      <div class="bienv__cab">
        <h2 class="sec-tit" id="t-bienvenida">La bienvenida de Rocío y Mari Carmen</h2>
        <p class="sec-intro">Lo cuentan quienes han estado: al llegar suele haber algo de la casa. Depende de la época y de lo que dé el huerto; qué hay ahora, por confirmar con ellas.</p>
      </div>
      <ul class="bienv__lista">
${D.bienvenida.map((b) => `        <li class="bienv__item">
          <span class="bienv__ico">${ico(b.icono, 44)}</span>
          <h3 class="bienv__que">${esc(b.que)}</h3>
          <blockquote class="bienv__cita"><p>«${esc(b.cita)}»</p></blockquote>
          <p class="bienv__de">${esc(b.nombre)}, en EscapadaRural, ${esc(b.fecha)}</p>
        </li>`).join('\n')}
      </ul>
      <p class="bienv__fino">Citas literales de sus opiniones en EscapadaRural, tal cual las escribieron.</p>`;
}

/* ---------- desde la puerta: el respaldo de la Web (Lugar puede sustituirlo dentro de su div) ---------- */
function lugarRespaldo() {
  return `      <div class="lugar__respaldo env">
        <figure class="lugar__foto"><img data-foto="valle-otono" alt="Ladera de robles y castaños en otoño sobre unas casas de piedra y un prado, en Los Oscos" sizes="(max-width: 699px) 92vw, 640px"><figcaption>Los Oscos en otoño. Foto de su web.</figcaption></figure>
        <div class="lugar__respaldo-txt">
          <p>Barcia está en el valle del río Barcia, en el concejo de Santa Eulalia de Oscos. Desde la puerta sale la ruta de Os Cortíos, y valle arriba quedan Santa Eulalia y las aldeas de alrededor.</p>
          <p class="lugar__fino">Aquí se carga el valle en 3D, con el relieve y la ortofoto del Instituto Geográfico Nacional. En el móvil, con un botón.</p>
        </div>
      </div>`;
}

/* ---------- alrededor (de Lugar); mientras no exista, una lista provisional SIN cifras ---------- */
function alrededor() {
  if (existe('partes/alrededor.html')) return leer('partes/alrededor.html').trim();
  console.warn('  (aún no está partes/alrededor.html, de Lugar: va la lista provisional)');
  const sitios = ['Santa Eulalia de Oscos', 'Ruta de Os Cortíos, desde la puerta', 'Museo Casa Natal del Marqués de Sargadelos, en Ferreirela de Baxo', 'Conjunto Etnográfico de Mazonovo', 'Ruta de la Seimeira, desde Pumares', 'Ruta del Forcón de los Ríos', 'Playa de las Catedrales'];
  return `<div class="alrededor__provisional"><ul>${sitios.map((s) => `<li>${esc(s)}</li>`).join('')}</ul><p class="es-pendiente">Los kilómetros y los minutos, en coche y a pie, se están calculando con OSRM sobre OpenStreetMap.</p></div>`;
}

/* ---------- opiniones: la nota y el enlace, sin recuento ---------- */
function opiniones() {
  const R = D.resenas;
  const citas = [R.citas[0], R.citas[2], R.citas[3]];
  return `    <div class="env opiniones__in">
      <p class="opiniones__nota" aria-hidden="true"><span class="cifra">${R.nota}</span><span class="opiniones__de">/${R.sobre}</span></p>
      <div class="opiniones__txt">
        <h2 class="sec-tit" id="t-opiniones">Cinco sobre cinco en EscapadaRural</h2>
        <p>Es la nota que le dan quienes han opinado en EscapadaRural.</p>
        <p><a class="btn btn--linea" href="${esc(R.enlace)}" target="_blank" rel="noopener">Leer las opiniones en EscapadaRural<span class="vh"> (se abre en otra pestaña)</span></a></p>
      </div>
      <ul class="opiniones__citas">
${citas.map((c) => `        <li><blockquote><p>«${esc(c.texto)}»</p></blockquote><p class="opiniones__quien">${esc(c.nombre)}, ${esc(c.viaje)}, ${esc(c.fecha)}</p></li>`).join('\n')}
      </ul>
    </div>`;
}

/* ---------- reservar: el respaldo sin JS (el simulador lo monta js/reserva.js) ---------- */
function reserva() {
  const C = D.contacto;
  return `      <div class="sim" data-modulo="reserva">
        <div class="sim__respaldo">
          <p>Para reservar, llama al <a class="cifra" href="tel:${C.telefonos[0].tel}">${C.telefonos[0].texto}</a> o al móvil <a class="cifra" href="tel:${C.telefonos[1].tel}">${C.telefonos[1].texto}</a>, o escribe a <a href="mailto:${C.correo}">${C.correo}</a>.</p>
          <p>Temporada alta: ${esc(D.temporadas.alta.toLowerCase())}. Baja: ${esc(D.temporadas.baja.toLowerCase())}.</p>
        </div>
      </div>`;
}
function datos() {
  const x = { nombre: D.nombre, unidades: D.unidades.map(({ id, nombre, romano, personas }) => ({ id, nombre, romano, personas })), precios: D.precios, iva: D.iva, temporadas: D.temporadas, contacto: D.contacto };
  return `<script type="application/json" id="datos-freixe">${JSON.stringify(x).replace(/</g, '\\u003c')}</script>`;
}

/* ---------- contacto ---------- */
function contacto() {
  const C = D.contacto;
  const q = `${CASA.lat},${CASA.lon}`;
  return `    <div class="env contacto__in">
      <div class="contacto__txt">
        <h2 class="sec-tit" id="t-contacto">Contacto y cómo llegar</h2>
        <p class="contacto__dir">Casa Freixe<br>Barcia, ${D.lugar.cp} Santa Eulalia de Oscos<br>Asturias</p>
        <ul class="contacto__medios">
          <li>${ico('tel', 22)}<a class="cifra" href="tel:${C.telefonos[0].tel}">${C.telefonos[0].texto}</a><small>${C.telefonos[0].tipo}</small></li>
          <li>${ico('tel', 22)}<a class="cifra" href="tel:${C.telefonos[1].tel}">${C.telefonos[1].texto}</a><small>${C.telefonos[1].tipo}</small></li>
          <li>${ico('correo', 22)}<a href="mailto:${C.correo}">${C.correo}</a></li>
        </ul>
        <p class="contacto__fino">Las distancias en coche y a pie, desde la puerta, están en <a href="#alrededor">Alrededor</a>.${CASA.provisional ? '' : ''}</p>
      </div>
      <div class="mapa" id="mapa" data-q="${esc(q)}">
        <button class="mapa__btn" type="button" id="mapa-btn">${ico('mapa', 32)}<b>Ver el mapa</b><small>Se carga Google Maps, que puede poner sus cookies.</small></button>
      </div>
    </div>`;
}

/* ---------- créditos del pie ---------- */
function creditos() {
  return `    <div class="pie__creditos">
      <p>Fotos: de su web (casafreixe.com, 2014) y de su ficha de Turismo Asturias, a su tamaño y con una corrección de color suave. El rótulo está redibujado a partir de su logo. Citas y nota: sus opiniones en <a href="${esc(D.resenas.enlace)}">EscapadaRural</a>. Fuentes del valle en 3D y de Alrededor: en sus secciones.</p>
    </div>`;
}

/* ---------- datos estructurados (sin nota ni recuento de reseñas) ---------- */
function jsonld() {
  const C = D.contacto;
  const x = {
    '@context': 'https://schema.org', '@type': 'LodgingBusiness', name: D.nombre,
    description: 'Dos apartamentos rurales de piedra y pizarra en Barcia, Santa Eulalia de Oscos (Asturias).',
    address: { '@type': 'PostalAddress', addressLocality: 'Barcia, Santa Eulalia de Oscos', postalCode: D.lugar.cp, addressRegion: 'Asturias', addressCountry: 'ES' },
    geo: { '@type': 'GeoCoordinates', latitude: CASA.lat, longitude: CASA.lon },
    telephone: C.telefonos[0].tel, email: C.correo, petsAllowed: true, numberOfRooms: 2, sameAs: [C.facebook],
  };
  return `<script type="application/ld+json">${JSON.stringify(x)}</script>`;
}

/* ---------- partes y ausentes ---------- */
const partes = (html, prof = 0) => html.replace(/<!--parte:([^\s>]+)\s*-->/g, (m, ruta) => {
  const f = path.join(RAIZ, ruta);
  if (!fs.existsSync(f)) { console.warn('  (falta ' + ruta + ')'); return `<!-- sin ${ruta} -->`; }
  if (prof > 3) throw new Error('Partes anidadas de más: ' + ruta);
  return partes(fs.readFileSync(f, 'utf8').trim(), prof + 1);
});
const DE_LUGAR = new Set(['css/lugar.css', 'css/alrededor.css', 'js/lugar.js', 'js/alrededor.js']);
const quitarAusentes = (html) => html
  .replace(/[ \t]*<link rel="stylesheet" href="(css\/[^"?]+)"[^>]*>\r?\n?/g, (m, r) => (DE_LUGAR.has(r) || existe(r) ? m : (console.warn('  (sin ' + r + ': se quita su <link>)'), '')))
  .replace(/[ \t]*<script (?:type="module" )?src="(js\/[^"?]+)"[^>]*><\/script>\r?\n?/g, (m, r) => (DE_LUGAR.has(r) || existe(r) ? m : (console.warn('  (sin ' + r + ': se quita su <script>)'), '')));
for (const r of DE_LUGAR) if (!existe(r)) console.warn(`  (aún no está ${r}, de Lugar: la etiqueta se queda y la página usa el respaldo)`);

const fuentes = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.src.html'));
for (const src of fuentes) {
  let html = quitarAusentes(partes(fs.readFileSync(path.join(RAIZ, src), 'utf8')));
  const rep = (marca, fn) => { if (html.includes(marca)) html = html.replace(marca, fn); };
  rep('<!--rotulo-portada-->', () => '        ' + rotulo({ id: 'rotulo-portada', clase: 'rotulo rotulo--portada', piezas: true }));
  rep('<!--rotulo-pie-->', () => '      ' + rotulo({ clase: 'rotulo rotulo--pie' }));
  rep('<!--rotulo-simbolo-->', rotuloSimbolo);
  rep('<!--unidades-->', unidades);
  rep('<!--vistazo-->', vistazo);
  rep('<!--servicios-->', servicios);
  rep('<!--galeria-->', galeria);
  rep('<!--bienvenida-->', bienvenida);
  rep('<!--lugar-respaldo-->', lugarRespaldo);
  rep('@@ALREDEDOR@@', alrededor);
  rep('<!--opiniones-->', opiniones);
  rep('<!--reserva-->', reserva);
  rep('<!--contacto-->', contacto);
  rep('<!--creditos-->', creditos);
  rep('<!--datos-->', datos);
  rep('<!--jsonld-->', jsonld);
  html = html.replace(/<img\b([^>]*\bdata-foto="[^"]+"[^>]*)>/g, (m, a) => picture(a.replace(/\s*\/$/, '')));
  const destino = src.replace('.src.html', '.html');
  fs.writeFileSync(path.join(RAIZ, destino), html);
  console.log(`${src} → ${destino} (${(html.length / 1024).toFixed(0)} KB)`);
}
execFileSync(process.execPath, [path.join(RAIZ, 'versionar.mjs')], { stdio: 'inherit' });

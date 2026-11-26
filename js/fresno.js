/* ------------------------------------------------------------------
   Casa Freixe · el fresno (Fraxinus excelsior) en <canvas>: Freixe.fresno
   Botánica que se respeta (ENCARGO):
   - ramificación OPUESTA (por pares; un par de cada dos sale escorzado: la disposición decusada vista de lado);
   - corteza gris ceniza: el tronco sale de la tinta del palo de la i y las ramillas aclaran hacia el gris;
   - hoja COMPUESTA IMPARIPINNADA de 9 a 13 folíolos (4 a 6 pares + el terminal), lanceolados y DENTADOS (aserrados,
     dientes hacia la punta), sentados sobre el raquis; hojas opuestas en la ramilla;
   - invierno: ramas desnudas con las YEMAS NEGRAS (la terminal mayor, las laterales por pares) y alguna sámara seca
     que aguanta en el árbol;
   - brotación: FLORES antes que las hojas (penachos pardo violáceos de estambres) y, al final, hojas tiernas;
   - verano: el verde de la copa del logo y racimos colgantes de SÁMARAS verdes;
   - otoño: amarillo pálido, la copa clarea (el fresno se desnuda pronto) y las sámaras, pardas, siguen colgando.
   Rendimiento: las hojas, racimos y flores se pintan UNA vez en sprites (a la escala del dispositivo) y cada fotograma
   solo se colocan con drawImage + setTransform; las ramas van agrupadas por grosor y color (pocas llamadas a stroke).
   Ni filtros ni sombras por fotograma. Sin bucle propio: quien lo usa (js/portada.js) llama a dibujar().
   API: Freixe.fresno.crear(canvas) → árbol { colocar(geo), estacion(nombre, progreso), dibujar(t, dt, viento),
        soltar(n), estado(), destruir() };  Freixe.fresno.ramita(canvas, nombre, progreso);  Freixe.fresno.dice(...)
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  const F = (window.Freixe = window.Freixe || {});
  const TAU = Math.PI * 2, ARRIBA = -Math.PI / 2, ABAJO = Math.PI / 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const suave = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  function azar(semilla) { let s = (semilla >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mezcla = (a, b, t) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * clamp(t, 0, 1)).toString(16).padStart(2, '0')).join(''); };

  /* ================= la estación: qué se ve en el árbol ================= */
  function estado(nombre, p) {
    p = clamp(p == null ? 0.5 : p, 0, 1);
    if (nombre === 'invierno') return {
      nombre, hojas: 0, tam: 0, yemas: 1, flores: 0, samaras: 0.16 * (1 - 0.6 * p),
      colorSamara: ['#5C4830', '#6A5536', '#4E3D29'], tonos: ['#43740D'], faltan: 0, caen: 'samara',
    };
    if (nombre === 'brotacion') {
      const flor = p < 0.35 ? suave(p / 0.12) : 1 - suave((p - 0.35) / 0.3);
      const hoja = suave((p - 0.42) / 0.58);
      return {
        nombre, hojas: hoja > 0.02 ? 1 : 0, tam: 0.3 + 0.7 * hoja, yemas: 1 - suave(p / 0.5), flores: flor, samaras: 0,
        colorSamara: ['#A7BC5C'], tonos: ['#A6CB5A', '#98C150', '#B2D467', '#8DB848'], faltan: 0, caen: hoja > 0.25 ? 'foliolo' : 'flor',
      };
    }
    if (nombre === 'verano') {
      const sec = suave((p - 0.62) / 0.38);
      return {
        nombre, hojas: 1, tam: 1, yemas: 0, flores: 0, samaras: 0.34 * suave(p / 0.25),
        colorSamara: [mezcla('#A9BE5E', '#A48F55', sec), mezcla('#9AB352', '#957F4A', sec), mezcla('#B4C66A', '#B09B5E', sec)],
        tonos: ['#43740D', '#3A6610', '#4F8418', '#36600C', '#5A8C22'], faltan: 0, caen: 'foliolo',
      };
    }
    // otoño: amarillea pronto y se desnuda; las sámaras pardas aguantan
    const amar = suave(p * 1.5);
    return {
      nombre: 'otono', hojas: 1 - 0.72 * suave(p), tam: 1, yemas: suave((p - 0.7) / 0.3) * 0.8, flores: 0, samaras: 0.36,
      colorSamara: ['#8A6B3E', '#7C5F36', '#9A7A48'],
      tonos: [mezcla('#4F7E18', '#E3D27A', amar), mezcla('#5C8A22', '#EAD985', amar), mezcla('#6A8F28', '#D8C25E', amar), mezcla('#4A7614', '#E8DC96', amar * 0.95), mezcla('#5A8420', '#C9AE52', amar)],
      faltan: 0.08 + 0.3 * suave(p), caen: 'hoja',
    };
  }
  const RAQUIS = { invierno: '#6B6A55', brotacion: '#7E9A44', verano: '#4C6A22', otono: '#9C8A4C' };

  /* ================= sprites ================= */
  function lienzo(w, h, dpr) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * dpr)); c.height = Math.max(1, Math.ceil(h * dpr));
    const x = c.getContext('2d');
    x.scale(dpr, dpr);
    return { c, x, w, h };
  }
  // un folíolo lanceolado, acuminado y aserrado, a lo largo de +x desde (0,0)
  function foliolo(x, l, color, nervio) {
    const w = l * 0.27, n = 22, dientes = 8;
    const borde = (u) => {
      const base = (w / 2) * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.82)), 0.8);
      const d = u > 0.1 && u < 0.93 ? 1 + 0.16 * ((u * dientes) % 1) : 1;
      return base * d;
    };
    x.beginPath();
    x.moveTo(0, 0);
    for (let i = 1; i <= n; i++) { const u = i / n; x.lineTo(u * l, -borde(u)); }
    for (let i = n - 1; i >= 1; i--) { const u = i / n; x.lineTo(u * l, borde(u)); }
    x.closePath();
    x.fillStyle = color;
    x.fill();
    if (l > 7) {
      x.strokeStyle = nervio; x.lineWidth = Math.max(0.35, l * 0.022);
      x.beginPath(); x.moveTo(l * 0.04, 0); x.lineTo(l * 0.88, 0); x.stroke();
    }
  }
  // la hoja compuesta: el raquis hacia arriba (−y) desde el punto de inserción (0,0)
  function hojaCompuesta(x, L, color, raquis, rnd, faltan) {
    const pares = 4 + Math.floor(rnd() * 3);                  // 4-6 pares + el terminal = 9-13 folíolos
    const curva = (rnd() - 0.5) * 0.22 * L;
    const P = (t) => [curva * t * t, -L * t];
    const pend = (t) => Math.atan2(-L, 2 * curva * t);        // dirección del raquis en t
    x.strokeStyle = raquis; x.lineCap = 'round';
    x.lineWidth = Math.max(0.6, L * 0.016);
    x.beginPath(); x.moveTo(0, 0);
    for (let i = 1; i <= 12; i++) { const [a, b] = P((i / 12) * 0.92); x.lineTo(a, b); }
    x.stroke();
    const lf = L * 0.25;
    const nervio = 'rgba(255,253,235,.28)';
    for (let k = 0; k < pares; k++) {
      const t = 0.2 + (k / pares) * 0.66;
      const [px, py] = P(t), dir = pend(t);
      const tam = lf * (0.8 + 0.28 * Math.sin((Math.PI * (k + 0.6)) / (pares + 0.4)));
      const ang = 1.0 + (rnd() - 0.5) * 0.18;
      for (const lado of [-1, 1]) {
        if (faltan && rnd() < faltan) continue;
        x.save(); x.translate(px, py); x.rotate(dir + lado * ang);
        foliolo(x, tam * (0.92 + rnd() * 0.16), varia(color, rnd), nervio);
        x.restore();
      }
    }
    if (!(faltan && rnd() < faltan * 0.6)) {
      const [tx, ty] = P(0.9);
      x.save(); x.translate(tx, ty); x.rotate(pend(0.9)); foliolo(x, lf * 1.08, varia(color, rnd), nervio); x.restore();
    }
  }
  function varia(hex, rnd) { const k = (rnd() - 0.5) * 0.14; return k > 0 ? mezcla(hex, '#FFFBE6', k) : mezcla(hex, '#1A2410', -k); }
  // racimo colgante de sámaras (hacia +y desde (0,0))
  function racimo(x, s, colores, rnd) {
    const n = 8 + Math.floor(rnd() * 8);
    x.strokeStyle = mezcla(colores[0], '#3A2E1E', 0.4); x.lineCap = 'round'; x.lineWidth = Math.max(0.5, s * 0.02);
    x.beginPath(); x.moveTo(0, 0); x.lineTo(0, s * 0.14); x.stroke();
    for (let i = 0; i < n; i++) {
      const a = ABAJO + (rnd() - 0.5) * 1.25;
      const pl = s * (0.06 + rnd() * 0.12);
      const bx = Math.cos(a) * pl, by = s * 0.14 + Math.sin(a) * pl;
      x.beginPath(); x.moveTo(0, s * 0.14); x.lineTo(bx, by); x.stroke();
      const sl = s * 0.56 * (0.82 + rnd() * 0.3), sw = sl * 0.19, ad = a + (rnd() - 0.5) * 0.35;
      x.save(); x.translate(bx, by); x.rotate(ad);
      // el ala: estrecha junto a la semilla, se ensancha y acaba redonda con una muesca
      x.beginPath();
      x.moveTo(0, 0);
      x.bezierCurveTo(sl * 0.3, -sw * 0.25, sl * 0.55, -sw * 0.55, sl * 0.9, -sw * 0.45);
      x.quadraticCurveTo(sl * 1.02, -sw * 0.2, sl * 0.97, 0);
      x.quadraticCurveTo(sl * 1.02, sw * 0.25, sl * 0.88, sw * 0.42);
      x.bezierCurveTo(sl * 0.55, sw * 0.5, sl * 0.3, sw * 0.28, 0, 0);
      x.fillStyle = colores[Math.floor(rnd() * colores.length)]; x.fill();
      // la semilla, más oscura, en la base
      x.beginPath(); x.ellipse(sl * 0.2, 0, sl * 0.17, sw * 0.2, 0, 0, TAU);
      x.fillStyle = mezcla(colores[0], '#2E2416', 0.45); x.fill();
      x.restore();
    }
  }
  // penacho de flores (estambres pardo violáceos, sin pétalos)
  function flor(x, s, rnd) {
    const n = 26 + Math.floor(rnd() * 14);
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, r = s * (0.15 + rnd() * 0.35);
      const ex = Math.cos(a) * r, ey = Math.sin(a) * r * 0.85;
      x.strokeStyle = rnd() < 0.5 ? '#5A2C4A' : '#6F3A55'; x.lineWidth = Math.max(0.4, s * 0.025);
      x.beginPath(); x.moveTo(ex * 0.25, ey * 0.25); x.lineTo(ex, ey); x.stroke();
      x.fillStyle = rnd() < 0.6 ? '#3E1C33' : '#7D4660';
      x.beginPath(); x.ellipse(ex, ey, s * 0.05, s * 0.035, a, 0, TAU); x.fill();
    }
  }
  function yema(x, px, py, ang, tam) {
    x.save(); x.translate(px, py); x.rotate(ang + Math.PI / 2);
    x.beginPath();
    x.moveTo(-tam * 0.5, 0);
    x.quadraticCurveTo(-tam * 0.55, -tam * 0.85, 0, -tam * 1.25);
    x.quadraticCurveTo(tam * 0.55, -tam * 0.85, tam * 0.5, 0);
    x.closePath(); x.fill();
    x.restore();
  }

  /* ================= el árbol ================= */
  function crear(canvas, opciones) {
    const op = Object.assign({ semilla: 20261126, tinta: '#1A1E21', ceniza: '#7F827A' }, opciones || {});
    const ctx = canvas.getContext('2d');
    let dpr = 1, W = 0, H = 0;
    let geo = null, est = estado('verano', 0.5);
    // estructura
    let S = null;                 // ramas (arrays planos)
    let hojas = [], racimos = [], flores = [], puntas = [], nudos = [];
    let maxDist = 1;
    let spr = null;               // sprites
    let crecido = 1;
    const caidas = [];            // hojas que caen
    let nCaidas = 0;
    const suelo = [];             // las que llegaron abajo (para el pie)
    const vd = [0, 0, 0, 0, 0];   // viento suavizado por orden de rama
    const KD = [0.9, 1.8, 3, 4.6, 6];
    const FLEX = [0.004, 0.011, 0.019, 0.028, 0.034];
    const colorRama = [];

    function generar() {
      const rnd = azar(op.semilla);
      const C = geo.copa, B = geo.base;
      const seg = { p: [], x0: [], y0: [], a0: [], len: [], w: [], d: [], tronco: [], fx: [], ph: [], d0: [], d1: [] };
      const dentro = (x, y) => { const dx = (x - C.cx) / C.rx, dy = (y - C.cy) / C.ry; const t = Math.atan2(dy, dx); return Math.hypot(dx, dy) / (1 + 0.07 * Math.sin(4 * t + 0.6) + 0.05 * Math.sin(7 * t + 2.1)); };
      let n = 0;
      const nuevo = (p, x0, y0, a, len, w, d, tronco) => {
        seg.p.push(p); seg.x0.push(x0); seg.y0.push(y0); seg.a0.push(a); seg.len.push(len); seg.w.push(w); seg.d.push(d); seg.tronco.push(tronco ? 1 : 0);
        seg.fx.push(0.7 + rnd() * 0.6); seg.ph.push(rnd() * TAU);
        const d0 = p >= 0 ? seg.d1[p] : 0; seg.d0.push(d0); seg.d1.push(d0 + len);
        return n++;
      };
      hojas = []; racimos = []; flores = []; puntas = []; nudos = [];
      // el tronco: sigue el palo de la i y, si la copa no está justo encima (móvil), se inclina con una curva suave
      const P = { x: C.cx + (B.x - C.cx) * 0.18, y: C.cy + C.ry * 0.42 };
      const K = { x: B.x, y: lerp(B.y, P.y, 0.6) };
      let prev = -1, px = B.x, py = B.y;
      const NT = Math.max(3, Math.round((B.y - P.y) / Math.max(10, C.ry * 0.12)));
      for (let i = 1; i <= NT; i++) {
        const t = i / NT, u = 1 - t;
        const qx = u * u * B.x + 2 * u * t * K.x + t * t * P.x, qy = u * u * B.y + 2 * u * t * K.y + t * t * P.y;
        prev = nuevo(prev, px, py, Math.atan2(qy - py, qx - px), Math.hypot(qx - px, qy - py), geo.ancho * lerp(1, 1.05, t), 0, true);
        px = qx; py = qy;
      }
      const W0 = geo.ancho * 0.92, L0 = C.ry * 0.29;
      const NODOS = [5, 3, 2, 1];
      function crecer(p, x, y, a, L, Wd, d, nodos) {
        let cur = p, cx = x, cy = y;
        for (let k = 0; k < nodos; k++) {
          const ex = cx + Math.cos(a) * L, ey = cy + Math.sin(a) * L;
          const fuera = dentro(ex, ey) > 1.02;
          cur = nuevo(cur, cx, cy, a, L, Math.max(0.55, Wd), d, false);
          cx = ex; cy = ey;
          const ultimo = fuera || k === nodos - 1;
          if (d < 3 && !ultimo) {
            const escorzo = (k + d) % 2 === 1;                  // un par de cada dos, de frente: más corto
            for (const lado of [-1, 1]) {
              let aa = a + lado * (0.6 + rnd() * 0.32);
              aa += (ARRIBA - aa) * 0.2;                         // el fresno levanta las puntas
              crecer(cur, cx, cy, aa, L * (escorzo ? 0.5 : 0.74) * (0.85 + rnd() * 0.3), Wd * 0.6, d + 1, Math.max(1, NODOS[d + 1] - (escorzo ? 1 : 0)));
            }
          }
          if (d >= 2) nudos.push({ s: cur, ultimo });
          if (ultimo) { puntas.push(cur); break; }
          a += (ARRIBA - a) * 0.13 + (rnd() - 0.5) * 0.24;
          L *= 0.86; Wd *= 0.8;
        }
      }
      // tres brazos principales desde la cruz (el central más corto), como la copa redonda del logo
      const brazos = [[-0.62, 1], [0.05, 0.82], [0.6, 1]];
      for (const [da, f] of brazos) crecer(prev, px, py, ARRIBA + da + (rnd() - 0.5) * 0.12, L0 * f, W0, 0, NODOS[0]);
      // hojas: pares opuestos en los nudos de las ramillas y un par en cada punta
      for (const nd of nudos) {
        const pares = nd.ultimo ? (rnd() < 0.55 ? 2 : 1) : (rnd() < 0.7 ? 1 : 0);
        for (let q = 0; q < pares; q++) for (const lado of [-1, 1]) {
          hojas.push({ s: nd.s, lado, rel: lado * (0.55 + rnd() * 0.5) * (q ? 0.55 : 1), at: q ? 1 : 0.75 + rnd() * 0.2, tam: 0.8 + rnd() * 0.38, v: Math.floor(rnd() * 4), c: Math.floor(rnd() * 5), r: rnd(), ph: rnd() * TAU, fr: 1.4 + rnd() * 1.6, cae: false });
        }
      }
      for (const s of puntas) {
        if (rnd() < 0.55) racimos.push({ s, v: Math.floor(rnd() * 3), r: rnd(), ph: rnd() * TAU, tam: 0.8 + rnd() * 0.4 });
        if (rnd() < 0.7) flores.push({ s, v: Math.floor(rnd() * 2), r: rnd(), tam: 0.7 + rnd() * 0.5 });
      }
      S = seg;
      maxDist = Math.max(...seg.d1);
      // color de cada rama: de la tinta (tronco, como la letra) al gris ceniza en las ramillas
      colorRama.length = 0;
      for (let d = 0; d < 4; d++) colorRama.push(mezcla(op.tinta, op.ceniza, [0, 0.35, 0.7, 0.92][d]));
      return { segmentos: n, hojas: hojas.length, puntas: puntas.length };
    }

    function hacerSprites() {
      const L = geo.copa.ry * 0.36;                          // largo de la hoja compuesta (exagerado para que se lea)
      const raq = RAQUIS[est.nombre] || '#4C6A22';
      const hojasS = [];
      for (let v = 0; v < 4; v++) {
        const fila = [];
        for (let c = 0; c < 5; c++) {
          const rnd = azar(9001 + v * 31 + c * 7);
          const s = lienzo(L * 0.82, L * 1.08, dpr);
          s.x.translate(s.w / 2, L * 1.04);
          hojaCompuesta(s.x, L, est.tonos[c % est.tonos.length], raq, rnd, est.faltan);
          s.ox = s.w / 2; s.oy = L * 1.04;
          fila.push(s);
        }
        hojasS.push(fila);
      }
      const folS = est.tonos.slice(0, 3).map((col, i) => { const l = L * 0.27, s = lienzo(l * 1.1, l * 0.4, dpr); s.x.translate(l * 0.04, l * 0.2); foliolo(s.x, l, col, 'rgba(255,253,235,.28)'); s.ox = l * 0.55; s.oy = l * 0.2; void i; return s; });
      const R = L * 0.62;
      const racS = [0, 1, 2].map((v) => { const s = lienzo(R * 1.3, R * 1.0, dpr); s.x.translate(s.w / 2, 1); racimo(s.x, R, est.colorSamara, azar(77 + v)); s.ox = s.w / 2; s.oy = 1; return s; });
      const samS = (() => { const l = R * 0.56, s = lienzo(l * 1.1, l * 0.3, dpr); s.x.translate(l * 0.05, l * 0.15); s.x.save(); racimoUna(s.x, l, est.colorSamara[0]); s.x.restore(); s.ox = l * 0.4; s.oy = l * 0.15; return s; })();
      const Fl = L * 0.34;
      const florS = [0, 1].map((v) => { const s = lienzo(Fl * 1.2, Fl * 1.1, dpr); s.x.translate(s.w / 2, s.h / 2); flor(s.x, Fl, azar(55 + v)); s.ox = s.w / 2; s.oy = s.h / 2; return s; });
      spr = { L, hojas: hojasS, foliolos: folS, racimos: racS, samara: samS, flores: florS };
    }
    function racimoUna(x, sl, col) {
      const sw = sl * 0.19;
      x.beginPath(); x.moveTo(0, 0);
      x.bezierCurveTo(sl * 0.3, -sw * 0.25, sl * 0.55, -sw * 0.55, sl * 0.9, -sw * 0.45);
      x.quadraticCurveTo(sl * 1.02, -sw * 0.2, sl * 0.97, 0);
      x.quadraticCurveTo(sl * 1.02, sw * 0.25, sl * 0.88, sw * 0.42);
      x.bezierCurveTo(sl * 0.55, sw * 0.5, sl * 0.3, sw * 0.28, 0, 0);
      x.fillStyle = col; x.fill();
      x.beginPath(); x.ellipse(sl * 0.2, 0, sl * 0.17, sw * 0.2, 0, 0, TAU); x.fillStyle = mezcla(col, '#2E2416', 0.45); x.fill();
    }

    // posición actual de cada rama (cinemática directa con el viento)
    let X0, Y0, X1, Y1, A, OFF;
    function reservar() { const n = S.p.length; X0 = new Float32Array(n); Y0 = new Float32Array(n); X1 = new Float32Array(n); Y1 = new Float32Array(n); A = new Float32Array(n); OFF = new Float32Array(n); }
    function mover(t) {
      const n = S.p.length;
      for (let i = 0; i < n; i++) {
        const p = S.p[i], d = S.d[i];
        let off = p >= 0 ? OFF[p] : 0;
        if (!S.tronco[i]) {
          const w = vd[d];
          off += w * FLEX[d] * S.fx[i] + Math.sin(t * (1.1 + S.fx[i]) + S.ph[i]) * 0.006 * (d + 1) * (0.35 + Math.abs(w));
        }
        OFF[i] = off;
        const a = S.a0[i] + off;
        // crecimiento: cada rama aparece cuando el «frente» llega a su distancia desde la base
        const g = crecido >= 1 ? 1 : clamp((crecido * maxDist * 1.08 - S.d0[i]) / S.len[i], 0, 1);
        const x0 = p >= 0 ? X1[p] : S.x0[i], y0 = p >= 0 ? Y1[p] : S.y0[i];
        X0[i] = x0; Y0[i] = y0; A[i] = a;
        X1[i] = x0 + Math.cos(a) * S.len[i] * g; Y1[i] = y0 + Math.sin(a) * S.len[i] * g;
      }
    }
    const visible = (i) => crecido >= 1 || crecido * maxDist * 1.08 > S.d1[i];
    const aparece = (i) => (crecido >= 1 ? 1 : suave((crecido * maxDist * 1.08 - S.d1[i]) / (maxDist * 0.12)));

    function pintarRamas() {
      const n = S.p.length;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // agrupadas por orden (color) y grosor redondeado a 0,5 px
      const grupos = new Map();
      for (let i = 0; i < n; i++) {
        if (X0[i] === X1[i] && Y0[i] === Y1[i]) continue;
        const k = S.d[i] * 1000 + Math.round(S.w[i] * 2);
        let g = grupos.get(k); if (!g) { g = []; grupos.set(k, g); }
        g.push(i);
      }
      for (const [k, g] of grupos) {
        const d = Math.floor(k / 1000), w = (k % 1000) / 2;
        ctx.strokeStyle = colorRama[d]; ctx.lineWidth = Math.max(0.5, w);
        ctx.beginPath();
        for (const i of g) { ctx.moveTo(X0[i], Y0[i]); ctx.lineTo(X1[i], Y1[i]); }
        ctx.stroke();
      }
    }
    function pintarYemas() {
      if (!(est.yemas > 0.02)) return;
      ctx.fillStyle = '#16130F';
      const k = est.yemas;
      for (const s of puntas) { if (!visible(s)) continue; yema(ctx, X1[s], Y1[s], A[s], Math.max(1.6, S.w[s] * 2.4) * k * aparece(s)); }
      for (const nd of nudos) {
        if (nd.ultimo || !visible(nd.s)) continue;
        const s = nd.s, t = Math.max(1.1, S.w[s] * 1.5) * k * aparece(s);
        yema(ctx, X1[s], Y1[s], A[s] - 0.9, t); yema(ctx, X1[s], Y1[s], A[s] + 0.9, t);
      }
    }
    function sello(img, x, y, ang, esc) {
      const c = Math.cos(ang) * esc * dpr, s = Math.sin(ang) * esc * dpr;
      ctx.setTransform(c, s, -s, c, x * dpr, y * dpr);
      ctx.drawImage(img.c, -img.ox, -img.oy, img.w, img.h);
    }
    let puntero = null;
    function pintarColgantes(t) {
      const wv = vd[3];
      if (est.samaras > 0) for (const r of racimos) {
        if (r.r > est.samaras * 1.4 || r.cae || !visible(r.s)) continue;
        const sw = -wv * 0.22 + Math.sin(t * 1.3 + r.ph) * (0.03 + 0.05 * Math.abs(wv));
        sello(spr.racimos[r.v], X1[r.s], Y1[r.s], sw, r.tam * aparece(r.s));
      }
      if (est.flores > 0.02) for (const f of flores) {
        if (!visible(f.s)) continue;
        sello(spr.flores[f.v], X1[f.s], Y1[f.s], 0, f.tam * est.flores * aparece(f.s));
      }
    }
    function pintarHojas(t) {
      if (!(est.hojas > 0) || !(est.tam > 0)) return;
      const umbral = 1 - est.hojas, w3 = vd[4];
      const px = puntero ? puntero.x : -1e9, py = puntero ? puntero.y : -1e9, pv = puntero ? puntero.v : 0;
      const sig2 = Math.pow(geo.copa.ry * 0.45, 2);
      for (const h of hojas) {
        if (h.r < umbral || h.cae || !visible(h.s)) continue;
        const s = h.s;
        const x = lerp(X0[s], X1[s], h.at), y = lerp(Y0[s], Y1[s], h.at);
        let a = A[s] + h.rel;
        a += (ABAJO - a) * 0.16;                               // la hoja pesa
        const dx = x - px, dy = y - py;
        const cerca = pv > 0 ? Math.exp(-(dx * dx + dy * dy) / sig2) * pv : 0;
        a += w3 * 0.1 + Math.sin(t * h.fr + h.ph) * (0.035 + 0.08 * Math.abs(w3) + 0.32 * cerca);
        sello(spr.hojas[h.v][h.c], x, y, a + Math.PI / 2, h.tam * est.tam * aparece(s));
      }
    }

    /* ---------- las que caen ---------- */
    function soltarUna() {
      let cual = null;
      const umbral = 1 - est.hojas;
      if (est.caen === 'hoja' || est.caen === 'foliolo') {
        const vivas = hojas.filter((h) => !h.cae && h.r >= umbral);
        if (vivas.length > 6) cual = vivas[Math.floor(Math.random() * vivas.length)];
      }
      if (cual) {
        cual.cae = est.caen === 'hoja';                       // en otoño cae la hoja entera; si no, un folíolo
        const s = cual.s, x = lerp(X0[s], X1[s], cual.at), y = lerp(Y0[s], Y1[s], cual.at);
        const img = est.caen === 'hoja' ? spr.hojas[cual.v][cual.c] : spr.foliolos[cual.c % spr.foliolos.length];
        caidas.push({ x, y, vx: 0, vy: 8, a: A[s] + cual.rel + Math.PI / 2, va: (Math.random() - 0.5) * 2.4, img, esc: (est.caen === 'hoja' ? cual.tam : 1) * est.tam, ph: Math.random() * TAU, fr: 1.4 + Math.random() * 1.2, gira: false });
      } else {
        // invierno (o sin hojas): una sámara seca que aguantaba en el árbol baja girando
        const vivos = racimos.filter((r) => !r.cae && r.r <= Math.max(est.samaras, 0.12) * 1.4);
        const r = vivos.length ? vivos[Math.floor(Math.random() * vivos.length)] : null;
        const x = r ? X1[r.s] : geo.copa.cx + (Math.random() - 0.5) * geo.copa.rx, y = r ? Y1[r.s] + spr.L * 0.3 : geo.copa.cy;
        caidas.push({ x, y, vx: 0, vy: 20, a: Math.random() * TAU, va: 9 + Math.random() * 5, img: est.caen === 'flor' ? spr.flores[0] : spr.samara, esc: est.caen === 'flor' ? 0.35 : 1, ph: Math.random() * TAU, fr: 2, gira: true });
      }
      nCaidas++;
      const ult = caidas[caidas.length - 1];
      suelo.push({ img: ult.img, a: ult.a, esc: ult.esc });     // para el pie: todo lo que ha caído, aunque siga en el aire
    }
    function moverCaidas(dt, t) {
      const g = geo.guia, wv = vd[2];
      for (let i = caidas.length - 1; i >= 0; i--) {
        const c = caidas[i];
        const term = c.gira ? 95 : 58;
        c.vy += (term - c.vy) * (1 - Math.exp(-dt * 1.6));
        c.vx += (wv * 55 - c.vx) * (1 - Math.exp(-dt * 1.1));
        // la guía: al bajar, las hojas van hacia el enlace a la siguiente sección
        if (g) { const k = clamp((c.y - geo.copa.cy) / Math.max(1, g.y - geo.copa.cy), 0, 1); c.vx += (g.x - c.x) * 0.9 * k * k * dt; }
        c.x += (c.vx + Math.sin(t * c.fr + c.ph) * (c.gira ? 8 : 34)) * dt;
        c.y += c.vy * dt;
        c.a += c.gira ? c.va * dt : Math.sin(t * c.fr * 1.3 + c.ph) * 1.6 * dt;
        if (c.y > H + 60 || (g && c.y > g.y + 6)) caidas.splice(i, 1);
      }
    }
    function pintarCaidas() { for (const c of caidas) sello(c.img, c.x, c.y, c.a, c.esc); }

    return {
      generar,
      colocar(g, nuevoDpr) {
        geo = g; W = g.ancho_lienzo; H = g.alto_lienzo; dpr = nuevoDpr;
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        const r = generar();
        reservar(); hacerSprites();
        return r;
      },
      estacion(nombre, p) { est = estado(nombre, p); if (geo) hacerSprites(); return est; },
      set crecido(v) { crecido = clamp(v, 0, 1); },
      get crecido() { return crecido; },
      set puntero(p) { puntero = p; },
      dibujar(t, dt, viento) {
        if (!S) return;
        for (let d = 0; d < 5; d++) vd[d] += (viento - vd[d]) * (1 - Math.exp(-(dt || 0.016) * KD[d]));
        mover(t);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        pintarRamas();
        pintarYemas();
        pintarColgantes(t);
        pintarHojas(t);
        if (caidas.length) { moverCaidas(dt || 0.016, t); pintarCaidas(); }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      },
      soltar(n) { for (let i = 0; i < n; i++) soltarUna(); },
      get cayendo() { return caidas.length; },
      get caidas() { return nCaidas; },
      get suelo() { return suelo; },
      get sprites() { return spr; },
      estado: () => ({ estacion: est.nombre, hojas: hojas.length, visibles: hojas.filter((h) => !h.cae && h.r >= 1 - est.hojas).length, segmentos: S ? S.p.length : 0, puntas: puntas.length, racimos: racimos.length, caidas: nCaidas, cayendo: caidas.length, dpr, W, H }),
      destruir() { S = null; spr = null; caidas.length = 0; },
    };
  }

  /* ================= la ramita de la estación (para «La casa» y el calendario) ================= */
  function ramita(canvas, nombre, p) {
    const e = estado(nombre, p);
    const cs = canvas.clientWidth || +canvas.getAttribute('width') || 88, dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(cs * dpr); canvas.height = Math.round(cs * dpr);
    const x = canvas.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, cs, cs);
    const rnd = azar(4242);
    const s = cs / 100;
    x.lineCap = 'round';
    // la ramilla, gris ceniza, subiendo en diagonal
    const x0 = 22 * s, y0 = 96 * s, x1 = 60 * s, y1 = 30 * s;
    x.strokeStyle = '#7F827A'; x.lineWidth = Math.max(1, 2.4 * s);
    x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo(30 * s, 58 * s, x1, y1); x.stroke();
    const a = Math.atan2(y1 - 58 * s, x1 - 30 * s);
    const nudo = [lerp(x0, x1, 0.45) + 2 * s, lerp(y0, y1, 0.45)];
    if (e.yemas > 0.05) {
      x.fillStyle = '#16130F';
      yema(x, x1, y1, a, 6 * s);
      yema(x, nudo[0], nudo[1], a - 0.9, 3.6 * s); yema(x, nudo[0], nudo[1], a + 0.9, 3.6 * s);
    }
    if (e.flores > 0.05) {
      x.save(); x.translate(x1 + 2 * s, y1 - 4 * s); flor(x, 26 * s * e.flores, rnd); x.restore();
      x.save(); x.translate(nudo[0] - 6 * s, nudo[1]); flor(x, 18 * s * e.flores, rnd); x.restore();
    }
    if (e.samaras > 0.05 && nombre !== 'brotacion') { x.save(); x.translate(nudo[0] + 3 * s, nudo[1] + 2 * s); racimo(x, 34 * s, e.colorSamara, rnd); x.restore(); }
    if (e.hojas > 0 && e.tam > 0) {
      const L = 56 * s * e.tam;
      x.save(); x.translate(x1, y1); x.rotate(a + Math.PI / 2 - 0.5); hojaCompuesta(x, L, e.tonos[0], RAQUIS[e.nombre], rnd, e.faltan * 0.6); x.restore();
      if (e.hojas > 0.45) { x.save(); x.translate(x1, y1); x.rotate(a + Math.PI / 2 + 0.75); hojaCompuesta(x, L * 0.82, e.tonos[1 % e.tonos.length], RAQUIS[e.nombre], rnd, e.faltan); x.restore(); }
    }
  }

  // lo que se ve hoy en el árbol, en una frase (portada, «La casa», el pie)
  function dice(nombre, p) {
    if (nombre === 'invierno') return 'ramas desnudas con las yemas negras, el rasgo del fresno en invierno';
    if (nombre === 'brotacion') return p < 0.45 ? 'florece antes de echar la hoja, en penachos pardo violáceos' : 'salen las primeras hojas, tiernas';
    if (nombre === 'verano') return p < 0.25 ? 'copa verde, recién hecha' : 'copa verde y racimos de sámaras colgando';
    return p < 0.45 ? 'la copa empieza a amarillear' : 'amarillo pálido; la copa se aclara y cuelgan las sámaras';
  }

  F.fresno = { crear, ramita, estado, dice };
})();

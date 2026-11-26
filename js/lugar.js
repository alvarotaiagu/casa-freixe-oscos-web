/* ------------------------------------------------------------------
   Casa Freixe · lugar.js · «Desde la puerta»
   window.Freixe.lugar.montar(el, { movimiento, densidad, webgl, estacion }) → { destruir() }

   Un vuelo en 3D que avanza con el scroll: la cámara sale por el porche
   de Casa Freixe (Barcia, 590 m), se vuelve a mirar la casa, baja al río
   Barcia, sigue el valle aguas abajo y sube hasta ver Santa Eulalia de
   Oscos y las aldeas, con las rutas de senderismo que tienen trazado en
   OpenStreetMap dibujadas sobre el relieve.
   - Relieve MDT05/MDT25 y ortofoto PNOA del IGN (CC BY 4.0), edificios
     sobre su planta del Catastro, río y rutas de OpenStreetMap; el tramo
     alto del río Barcia sale del MDT05 (scripts/lugar-datos.py).
   - El sol, la luna y la luz de este momento en Barcia (fórmulas de
     SunCalc, en el navegador; no se pide nada a nadie).
   - La copa de los árboles, con el color de la estación de hoy
     (window.Freixe.estacion o opciones.estacion).
   - Three.js 0.160.0, copia propia en vendor/, pedida con import() solo
     cuando hace falta.
   - Plan B en el mismo hueco (sin WebGL, movimiento reducido, «sobria»,
     ahorro de datos, móvil antes de pulsar el botón, navegador
     automatizado): el valle desde el aire con el recorrido, el río y las
     rutas, más la vista final dibujada con los mismos datos.
   El HTML que trae `el` es el respaldo: se guarda y se repone al destruir.
   Parámetros: ?fps (rendimiento), ?sin-webgl (plan B), ?lugar=3d (fuerza
   el 3D aunque el navegador sea automatizado), ?hora=22:30 (otra hora de
   hoy), ?estacion=invierno|brotacion|verano|otono (la lee Web).
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var FX = (window.Freixe = window.Freixe || {});
  if (FX.lugar && FX.lugar.montar) return;

  var SCRIPT = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  var RAIZ = SCRIPT ? new URL('../', SCRIPT).href : (typeof location !== 'undefined' ? new URL('./', location.href).href : './');
  var BASE = RAIZ + 'img/lugar/';
  var ESCENA = RAIZ + 'data/lugar-escena.json';
  var THREE_URL = RAIZ + 'vendor/three-0.160.0.module.min.js';
  var LAT = 43.286736, LON = -7.030365, TZ = 'Europe/Madrid', RAD = Math.PI / 180;

  /* ============ utilidades ============ */
  var lim = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var suave = function (a, b, x) { var t = lim((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var hexA = function (c) { return [1, 3, 5].map(function (i) { return parseInt(c.slice(i, i + 2), 16); }); };
  var mezcla = function (a, b, t) { var x = hexA(a), y = hexA(b); return '#' + x.map(function (v, i) { return pad(Math.round(lim(lerp(v, y[i], t), 0, 255)).toString(16)); }).join(''); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var RUMBOS = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
  var rumbo = function (az) { return RUMBOS[Math.round((((az % 360) + 360) % 360) / 45) % 8]; };
  var km = function (m) { return m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km'; };

  /* ============ la hora (con ?hora=HH:MM para ver otra hora de hoy) ============ */
  var fmtHora = null;
  function horaBarcia(f) {
    try {
      fmtHora = fmtHora || new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      return fmtHora.format(f);
    } catch (e) { return pad(f.getHours()) + ':' + pad(f.getMinutes()); }
  }
  var horaForzada = null;
  function ahora() {
    var d = new Date();
    if (horaForzada == null) return d;
    var hm = horaBarcia(d).split(':'), act = (+hm[0]) * 60 + (+hm[1]);
    return new Date(d.getTime() + (horaForzada - act) * 60000);
  }

  /* ============ el sol y la luna (fórmulas de SunCalc, V. Agafonkin) ============ */
  var J1970 = 2440588, J2000 = 2451545, OBL = RAD * 23.4397;
  var dias = function (f) { return f.valueOf() / 864e5 - 0.5 + J1970 - J2000; };
  var ascRec = function (l, b) { return Math.atan2(Math.sin(l) * Math.cos(OBL) - Math.tan(b) * Math.sin(OBL), Math.cos(l)); };
  var declin = function (l, b) { return Math.asin(Math.sin(b) * Math.cos(OBL) + Math.cos(b) * Math.sin(OBL) * Math.sin(l)); };
  var sideral = function (d) { return RAD * (280.16 + 360.9856235 * d) - RAD * -LON; };
  function altAz(H, dec) {
    var phi = RAD * LAT;
    return {
      alt: Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / RAD,
      az: (Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) / RAD + 180 + 360) % 360, // desde el norte, hacia el este
    };
  }
  function solCoords(d) {
    var M = RAD * (357.5291 + 0.98560028 * d);
    var L = M + RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + RAD * 102.9372 + Math.PI;
    return { dec: declin(L, 0), ra: ascRec(L, 0) };
  }
  function lunaCoords(d) {
    var L = RAD * (218.316 + 13.176396 * d), M = RAD * (134.963 + 13.064993 * d), F = RAD * (93.272 + 13.22935 * d);
    var l = L + RAD * 6.289 * Math.sin(M), b = RAD * 5.128 * Math.sin(F);
    return { ra: ascRec(l, b), dec: declin(l, b), dist: 385001 - 20905 * Math.cos(M) };
  }
  function sol(f) { var d = dias(f), c = solCoords(d); return altAz(sideral(d) - c.ra, c.dec); }
  function luna(f) {
    var d = dias(f), m = lunaCoords(d), s = solCoords(d), p = altAz(sideral(d) - m.ra, m.dec);
    var phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
    var inc = Math.atan2(149598000 * Math.sin(phi), m.dist - 149598000 * Math.cos(phi));
    var ang = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
    return { alt: p.alt, az: p.az, luz: (1 + Math.cos(inc)) / 2, fase: 0.5 + 0.5 * inc * (ang < 0 ? -1 : 1) / Math.PI };
  }
  function nombreFase(f) {
    if (f < 0.03 || f >= 0.97) return 'nueva';
    if (f < 0.22) return 'creciente';
    if (f < 0.28) return 'en cuarto creciente';
    if (f < 0.47) return 'gibosa creciente';
    if (f < 0.53) return 'llena';
    if (f < 0.72) return 'gibosa menguante';
    if (f < 0.78) return 'en cuarto menguante';
    return 'menguante';
  }
  // la frase del cielo de ahora (igual en el 3D y en el plano)
  function fraseCielo(f) {
    var s = sol(f), l = luna(f), h = horaBarcia(f), txt;
    if (s.alt > 0) txt = 'En Barcia son las ' + h + ' y el sol está a ' + Math.round(s.alt) + '° sobre el horizonte, al ' + rumbo(s.az) + '.';
    else if (s.alt > -6) txt = 'En Barcia son las ' + h + ': ' + (s.az < 180 ? 'está amaneciendo' : 'está anocheciendo') + '.';
    else {
      txt = 'En Barcia son las ' + h + ' y es de noche';
      if (l.alt > 0 && l.luz > 0.03) txt += '; la luna, ' + nombreFase(l.fase) + ', está a ' + Math.round(l.alt) + '° al ' + rumbo(l.az);
      txt += '.';
    }
    return txt;
  }

  /* ============ el color del cielo según la altura del sol ============ */
  var CIELO = [            // [altura del sol, cenit, horizonte]
    [-18, '#04070f', '#0b1120'],
    [-10, '#081028', '#1c2440'],
    [-4, '#1b2650', '#6e5464'],
    [0, '#33508a', '#dc8a66'],
    [6, '#5077b4', '#eec09a'],
    [18, '#6690c8', '#d8e0e6'],
    [45, '#4b80c0', '#ccd9e6'],
  ];
  function cieloPara(alt) {
    if (alt <= CIELO[0][0]) return { cz: CIELO[0][1], ch: CIELO[0][2] };
    for (var i = 1; i < CIELO.length; i++) {
      if (alt <= CIELO[i][0]) {
        var a = CIELO[i - 1], b = CIELO[i], t = (alt - a[0]) / (b[0] - a[0]);
        return { cz: mezcla(a[1], b[1], t), ch: mezcla(a[2], b[2], t) };
      }
    }
    var u = CIELO[CIELO.length - 1];
    return { cz: u[1], ch: u[2] };
  }

  /* ============ la estación: el color de las copas (el suelo es la foto de verano del PNOA) ============ */
  var ESTACIONES = {
    invierno: { copas: ['#5b4b3d', '#6a5a4a', '#4e4136'], perenne: 0.22, tinte: [0.18, '#7d7a64'], hojas: 0.55, nombre: 'invierno' },
    brotacion: { copas: ['#7f9a4c', '#93a95a', '#6d8a45'], perenne: 0.22, tinte: [0.05, '#8fa65a'], hojas: 0.8, nombre: 'brotación' },
    verano: { copas: ['#3f5a2e', '#4a6634', '#35502a'], perenne: 0.22, tinte: [0, '#000000'], hojas: 1, nombre: 'verano' },
    otono: { copas: ['#a8762e', '#8f5a26', '#b88d3c', '#7a5a2a'], perenne: 0.22, tinte: [0.14, '#8d7a3e'], hojas: 0.85, nombre: 'otoño' },
  };
  function estacionDe(op) {
    var n = (op && op.estacion && (op.estacion.nombre || op.estacion)) || (FX.estacion && FX.estacion.nombre) || null;
    n = String(n || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!ESTACIONES[n]) {                                  // sin Web: la fecha de hoy (dic-mar, abr-may, jun-sep, oct-nov)
      var m = new Date().getMonth();
      n = m === 11 || m <= 2 ? 'invierno' : m <= 4 ? 'brotacion' : m <= 8 ? 'verano' : 'otono';
    }
    return n;
  }

  /* ============ el recorrido: interpolación monótona por componente ============ */
  function monotona(ps, vs) {
    var n = ps.length, d = [], m = [], i;
    for (i = 0; i < n - 1; i++) d[i] = (vs[i + 1] - vs[i]) / (ps[i + 1] - ps[i]);
    m[0] = 0; m[n - 1] = 0;
    for (i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) { m[i] = 0; continue; }
      var h0 = ps[i] - ps[i - 1], h1 = ps[i + 1] - ps[i];
      m[i] = 3 * (h0 + h1) / ((2 * h1 + h0) / d[i - 1] + (h1 + 2 * h0) / d[i]);
    }
    return function (p) {
      if (p <= ps[0]) return vs[0];
      if (p >= ps[n - 1]) return vs[n - 1];
      var k = 0; while (k < n - 2 && p > ps[k + 1]) k++;
      var h = ps[k + 1] - ps[k], t = (p - ps[k]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * vs[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * vs[k + 1] + (t3 - t2) * h * m[k + 1];
    };
  }
  function camino(rec) {
    var ps = rec.map(function (r) { return r.p; });
    var f = [0, 1, 2].map(function (k) { return monotona(ps, rec.map(function (r) { return r.pos[k]; })); });
    var g = [0, 1, 2].map(function (k) { return monotona(ps, rec.map(function (r) { return r.mira[k]; })); });
    return function (p) { return { pos: [f[0](p), f[1](p), f[2](p)], mira: [g[0](p), g[1](p), g[2](p)] }; };
  }

  /* ============ paradas y rótulos (los mismos en el 3D y en el plano) ============ */
  var PARADAS = [
    { desde: 0, t: 'La puerta', d: 'Bajo el porche de Casa Freixe, a 590 m: el patio de piedra y la aldea de Barcia.' },
    { desde: 0.09, t: 'La casa', d: 'Piedra, pizarra y el porche de madera, levantados sobre su planta del Catastro.' },
    { desde: 0.28, t: 'El río Barcia', d: 'A unos 90 m de la puerta baja el río Barcia, entre prados y sotos.' },
    { desde: 0.46, t: 'Valle abajo', d: 'El río tuerce al este y busca el Agüeira, más abajo de Santa Eulalia.' },
    { desde: 0.7, t: 'Santa Eulalia y las aldeas', d: 'Santalla y sus aldeas desde lo alto, con las rutas de la Seimeira y de la Mina de As Talladas dibujadas por donde van.' },
  ];
  // cuándo sale cada rótulo en el 3D (tramos de p)
  var FASES = {
    casa: [0.05, 0.3], barcia: [0.1, 0.3], rio: [0.27, 0.72], vegacarro: [0.42, 1], millarado: [0.5, 1], quinta: [0.82, 1], cotarelo: [0.86, 1],
    castro: [0.8, 1], santalla: [0.72, 1], pumares: [0.76, 1], ferreirela: [0.78, 1], mazonovo: [0.82, 1], 'ruta-talladas': [0.84, 1], 'ruta-seimeira': [0.84, 1],
  };

  /* ============ alturas: PNG RGB → metros ============ */
  function cargarAlturas(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('alturas ' + r.status); return r.blob(); })
      .then(function (b) {
        var op = { colorSpaceConversion: 'none', premultiplyAlpha: 'none' };
        return (window.createImageBitmap ? createImageBitmap(b, op).catch(function () { return createImageBitmap(b); }) : Promise.reject(new Error('sin createImageBitmap')));
      })
      .then(function (bmp) {
        var c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
        var g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
        var d = g.getImageData(0, 0, c.width, c.height).data, n = c.width * c.height, out = new Float32Array(n);
        for (var i = 0; i < n; i++) out[i] = (d[i * 4] * 256 + d[i * 4 + 1]) / 10 - 100;
        if (bmp.close) bmp.close();
        return { w: c.width, h: c.height, data: out };
      });
  }
  function muestreador(r) {
    var sx = (r.w - 1) / (r.x1 - r.x0), sz = (r.h - 1) / (r.z1 - r.z0), w = r.w, h = r.h, a = r.data;
    return function (x, z) {
      var fx = lim((x - r.x0) * sx, 0, w - 1.0001), fz = lim((z - r.z0) * sz, 0, h - 1.0001);
      var i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * w + i;
      return (a[k] * (1 - u) + a[k + 1] * u) * (1 - v) + (a[k + w] * (1 - u) + a[k + w + 1] * u) * v;
    };
  }
  function pesoCaja(r, x, z, b) { var d = Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z); return lim(d / b, 0, 1); }

  /* ============ texturas dibujadas (ligeras) ============ */
  function azar(semilla) { var s = semilla >>> 0 || 1; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
  function lienzo(lado, pintar, alto) { var c = document.createElement('canvas'); c.width = lado; c.height = alto || lado; pintar(c.getContext('2d'), lado, alto || lado); return c; }
  function ruidoPlano(g, L, r, k) {
    var im = g.getImageData(0, 0, L, L), d = im.data;
    for (var i = 0; i < d.length; i += 4) { var n = (r() - 0.5) * k; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(im, 0, 0);
  }
  // mampostería de lajas de pizarra y cuarcita, como la de la casa (gris pardo con vetas ocres)
  function texPiedra(semilla) {
    return lienzo(512, function (g, L) {
      var r = azar(semilla);
      g.fillStyle = '#4d463d'; g.fillRect(0, 0, L, L);
      var y = 0;
      while (y < L) {
        var hh = 9 + r() * 16, x = -r() * 40;
        while (x < L) {
          var ww = 26 + r() * 70, b = r();
          g.fillStyle = b < 0.25 ? mezcla('#8b7a5f', '#a88a5a', r()) : b < 0.6 ? mezcla('#6f675c', '#857c6e', r()) : mezcla('#5a5550', '#77706a', r());
          g.fillRect(x + 1.2, y + 1.2, ww - 2.4, hh - 2.4);
          x += ww;
        }
        y += hh;
      }
      ruidoPlano(g, L, r, 14);
    });
  }
  function texTejado(semilla) {                     // pizarra de cubierta: hileras escalonadas de placas
    return lienzo(256, function (g, L) {
      var r = azar(semilla), filas = 14, cols = 10, fh = L / filas, cw = L / cols;
      g.fillStyle = '#1d2024'; g.fillRect(0, 0, L, L);
      for (var j = 0; j < filas; j++) {
        for (var i = -1; i < cols; i++) {
          var x = i * cw + (j % 2) * cw / 2, yy = j * fh;
          g.fillStyle = mezcla(mezcla('#3c4148', r() < 0.5 ? '#25282d' : '#5b6068', r() * 0.45), '#3a4048', r() * 0.2);
          g.fillRect(x + 1, yy + 1, cw - 2, fh - 1);
          g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + 1, yy + fh - 2, cw - 2, 2);
        }
      }
    });
  }
  function texMadera(semilla) {
    return lienzo(128, function (g, L) {
      var r = azar(semilla); g.fillStyle = '#7a4526'; g.fillRect(0, 0, L, L);
      for (var i = 0; i < 60; i++) { g.fillStyle = 'rgba(' + (r() < 0.5 ? '40,20,10' : '160,100,60') + ',' + (0.08 + r() * 0.12).toFixed(2) + ')'; g.fillRect(0, r() * L, L, 1 + r() * 2); }
    });
  }
  function texLuna(fase) {                           // el disco de la luna con su fase (lado iluminado según la fase)
    return lienzo(128, function (g, L) {
      var R = L * 0.46, c = L / 2;
      g.clearRect(0, 0, L, L);
      g.fillStyle = 'rgba(40,46,60,0.35)'; g.beginPath(); g.arc(c, c, R, 0, Math.PI * 2); g.fill();
      var k = Math.cos(fase * 2 * Math.PI), creciente = fase < 0.5;
      g.fillStyle = '#f1ecdc'; g.beginPath();
      g.arc(c, c, R, -Math.PI / 2, Math.PI / 2, !creciente);
      g.ellipse(c, c, Math.abs(k) * R, R, 0, Math.PI / 2, -Math.PI / 2, (k > 0) === creciente);
      g.fill();
    });
  }
  function texHalo() {
    return lienzo(128, function (g, L) {
      var gr = g.createRadialGradient(L / 2, L / 2, 0, L / 2, L / 2, L / 2);
      gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(0.25, 'rgba(255,190,110,.45)'); gr.addColorStop(1, 'rgba(255,170,90,0)');
      g.fillStyle = gr; g.fillRect(0, 0, L, L);
    });
  }

  /* ============ módulo ============ */
  function montar(el, opciones) {
    opciones = opciones || {};
    var q = new URLSearchParams(location.search);
    if (q.has('hora')) { var hq = String(q.get('hora')).split(':'); if (hq.length === 2 && isFinite(hq[0]) && isFinite(hq[1])) horaForzada = lim(+hq[0], 0, 23) * 60 + lim(+hq[1], 0, 59); }
    var reduce = opciones.movimiento === false || matchMedia('(prefers-reduced-motion: reduce)').matches;
    var sobria = opciones.densidad === 'sobria';
    var movil = matchMedia('(max-width: 820px)').matches || matchMedia('(pointer: coarse)').matches;
    var ahorro = !!(navigator.connection && navigator.connection.saveData);
    var forzar3d = q.get('lugar') === '3d';                                       // solo para pruebas
    var automatizado = !!navigator.webdriver && !forzar3d;                         // Playwright: nunca pinta el 3D
    var sinWebgl = opciones.webgl === false || q.has('sin-webgl') || automatizado;
    if (!sinWebgl && !sobria && !reduce && !forzar3d) {
      try { var cv0 = document.createElement('canvas'); sinWebgl = !(cv0.getContext('webgl2') || cv0.getContext('webgl')); } catch (e) { sinWebgl = true; }
    }
    var puede3d = !sinWebgl && !sobria && !reduce;
    var auto3d = puede3d && !movil && !ahorro;
    var estacion = estacionDe(opciones), EST = ESTACIONES[estacion];
    var respaldo = el.innerHTML;
    var estado = { modo: 'plano', destruido: false, error3d: null, cargado: false, p: 0, estacion: estacion, tresPedido: false };
    var escuchas = [];
    var escucha = function (o, ev, fn, op) { o.addEventListener(ev, fn, op); escuchas.push(function () { o.removeEventListener(ev, fn, op); }); };
    var t3 = null, meta = null, cargando = null, intervalo = 0;

    /* ---------- DOM ---------- */
    el.classList.add('lugar-mod');
    el.dataset.estacion = estacion;
    el.innerHTML =
      '<div class="lugar__pista">' +
        '<div class="lugar__escenario" role="img" aria-label="Vuelo en 3D desde la puerta de Casa Freixe, en Barcia: la casa, el río Barcia valle abajo y, desde lo alto, Santa Eulalia de Oscos y sus aldeas con las rutas de senderismo, con el relieve real y la luz de este momento">' +
          '<img class="lugar__poster" alt="" decoding="async" src="' + BASE + 'vista-valle-1600.webp" srcset="' + BASE + 'vista-valle-960.webp 960w, ' + BASE + 'vista-valle-1600.webp 1600w" sizes="100vw">' +
          '<div class="lugar__rotulos" aria-hidden="true"></div>' +
          '<div class="lugar__hud"><p class="lugar__ahora" data-l="ahora3d"></p></div>' +
          '<ol class="lugar__paradas"></ol>' +
          '<div class="lugar__pie3d"><p class="lugar__creditos">Relieve y foto: IGN · Edificios: Catastro · Río y rutas: OpenStreetMap</p>' +
          '<button type="button" class="lugar__btn lugar__btn--suave" data-l="aplano">Ver en plano</button></div>' +
          '<p class="lugar__aviso" data-l="aviso" role="status" hidden></p>' +
        '</div>' +
      '</div>' +
      '<div class="lugar__planob">' +
        '<figure class="lugar__mapa">' +
          '<div class="lugar__marco lugar__marco--mapa"><img alt="El valle desde el aire, de Barcia a Santa Eulalia de Oscos: el río Barcia, las aldeas y las rutas de la Seimeira y de la Mina de As Talladas" decoding="async" loading="lazy" src="' + BASE + 'plano-valle-640.webp" srcset="' + BASE + 'plano-valle-640.webp 640w, ' + BASE + 'plano-valle-1000.webp 1000w" sizes="(max-width: 820px) 100vw, 44vw">' +
          '<svg class="lugar__trazos" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>' +
          '<ul class="lugar__marcas" aria-hidden="true"></ul></div>' +
          '<figcaption>El valle sobre la ortofoto del IGN: el río Barcia <i class="lugar__ley lugar__ley--rio"></i>, el vuelo del 3D <i class="lugar__ley lugar__ley--vuelo"></i> y las rutas con trazado en OpenStreetMap <i class="lugar__ley lugar__ley--ruta"></i>.</figcaption>' +
        '</figure>' +
        '<figure class="lugar__vista">' +
          '<div class="lugar__marco lugar__marco--vista"><img alt="Santa Eulalia de Oscos y sus aldeas vistas desde lo alto del valle, al sur de Barcia" decoding="async" loading="lazy" src="' + BASE + 'vista-valle-960.webp" srcset="' + BASE + 'vista-valle-960.webp 960w, ' + BASE + 'vista-valle-1600.webp 1600w" sizes="(max-width: 820px) 100vw, 50vw">' +
          '<svg class="lugar__trazos lugar__trazos--vista" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>' +
          '<i class="lugar__noche" aria-hidden="true"></i><ul class="lugar__marcas lugar__marcas--vista" aria-hidden="true"></ul></div>' +
          '<figcaption>La última vista del vuelo, dibujada con el relieve y la ortofoto del IGN.</figcaption>' +
        '</figure>' +
        '<div class="lugar__panel"><p class="lugar__ahora" data-l="ahora2d"></p></div>' +
        '<ol class="lugar__pasos"></ol>' +
        '<p class="lugar__acciones"><button type="button" class="lugar__btn" data-l="a3d" hidden>Ver el valle en 3D</button></p>' +
      '</div>' +
      '<p class="lugar__fuente" data-l="fuente">Relieve MDT05 y MDT25 y ortofoto PNOA © Instituto Geográfico Nacional (CC BY 4.0) · Planta de los edificios © Dirección General del Catastro · Río Barcia (tramo bajo), río Agüeira, rutas y aldeas © colaboradores de OpenStreetMap (ODbL); el tramo alto del río, por donde baja el agua según el MDT05. A escala real, sin exagerar el relieve. El sol y la luna se calculan en tu navegador para Barcia; la foto aérea es de verano y las copas llevan el color de la estación.</p>';
    var $ = function (k) { return el.querySelector('[data-l="' + k + '"]'); };
    var pista = el.querySelector('.lugar__pista'), escenario = el.querySelector('.lugar__escenario');
    var capaRot = el.querySelector('.lugar__rotulos');
    var aviso = $('aviso');
    var avisar = function (t) { aviso.textContent = t || ''; aviso.hidden = !t; };

    var htmlParadas = PARADAS.map(function (p, i) { return '<li data-i="' + i + '"><b>' + esc(p.t) + '</b><span>' + esc(p.d) + '</span></li>'; }).join('');
    el.querySelector('.lugar__paradas').innerHTML = htmlParadas;
    el.querySelector('.lugar__pasos').innerHTML = htmlParadas;
    var lisParadas = el.querySelectorAll('.lugar__paradas li');
    var paradaActual = -1;
    function marcarParada(p) {
      var i = 0; for (var k = 0; k < PARADAS.length; k++) if (p >= PARADAS[k].desde - 0.001) i = k;
      if (i === paradaActual) return;
      paradaActual = i;
      lisParadas.forEach(function (li, k) { li.classList.toggle('es-actual', k === i); li.classList.toggle('es-pasada', k < i); });
    }

    /* ---------- el cielo de ahora, en texto ---------- */
    function cieloTexto() {
      var f = ahora(), txt = fraseCielo(f), s = sol(f);
      $('ahora2d').textContent = txt;
      $('ahora3d').innerHTML = '<b>' + horaBarcia(f) + ' en Barcia · ' + (s.alt > -6 ? 'el sol de ahora' : 'el cielo de ahora') + '</b><span> ' + esc(txt) + '</span>';
      el.style.setProperty('--lugar-noche', String(lim((-s.alt - 1) / 10, 0, 1).toFixed(2)));
      if (t3) t3.luces(f);
    }

    /* ---------- plan B: trazos y marcas sobre las dos imágenes ---------- */
    var linea = function (pts, cls) { return '<polyline class="' + cls + '" points="' + pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') + '"/>'; };
    function montarPlano(m) {
      var nombres = {}; m.lugares.forEach(function (l) { nombres[l.clave] = l; });
      var mp = m.planB.mapa;
      el.querySelector('.lugar__marco--mapa').style.aspectRatio = mp.ancho + ' / ' + mp.alto;
      el.querySelector('.lugar__marco--mapa .lugar__trazos').innerHTML =
        mp.rutas.map(function (r) { return r.trazos.map(function (t) { return linea(t, 'lugar__t-ruta lugar__t-ruta--' + r.clave); }).join(''); }).join('') +
        linea(mp.rio, 'lugar__t-rio') + linea(mp.ruta, 'lugar__t-vuelo');
      el.querySelector('.lugar__marco--mapa .lugar__marcas').innerHTML = mp.marcas.map(function (k) {
        var l = nombres[k.clave]; if (!l) return '';
        var der = k.pos[0] > 62, sub = l.sub && k.clave !== 'rio' ? ' <small>' + esc(l.sub) + '</small>' : '';
        return '<li class="lugar__marca' + (k.clave === 'casa' ? ' lugar__marca--casa' : '') + (der ? ' a-la-izq' : '') + '" style="left:' + k.pos[0] + '%;top:' + k.pos[1] + '%"><span>' + esc(l.nombre) + sub + '</span></li>';
      }).join('');
      var v = m.planB.vista;
      el.querySelector('.lugar__marco--vista').style.aspectRatio = v.ancho + ' / ' + v.alto;
      el.querySelector('.lugar__trazos--vista').innerHTML = v.rutas.map(function (r) { return r.trazos.map(function (t) { return linea(t, 'lugar__t-ruta lugar__t-ruta--' + r.clave); }).join(''); }).join('');
      el.querySelector('.lugar__marcas--vista').innerHTML = v.marcas.map(function (k) {
        var l = nombres[k.clave]; if (!l) return '';
        return '<li class="lugar__marca' + (k.x > 66 ? ' a-la-izq' : '') + (/^ruta-/.test(k.clave) ? ' lugar__marca--ruta' : '') + '" style="left:' + k.x + '%;top:' + k.y + '%"><span>' + esc(l.nombre) + '</span></li>';
      }).join('');
    }

    function ponModo(m) {
      estado.modo = m;
      el.dataset.modo = m;
      $('a3d').hidden = !(puede3d && m === 'plano' && !estado.error3d);
      if (t3) t3.activo(m === '3d');
    }

    /* ---------- datos ---------- */
    var pMeta = fetch(ESCENA).then(function (r) { if (!r.ok) throw new Error('lugar-escena.json ' + r.status); return r.json(); })
      .then(function (m) { meta = m; if (!estado.destruido) montarPlano(m); return m; });
    pMeta.catch(function (e) { console.warn('Lugar: sin datos', e); });

    /* ---------- el 3D ---------- */
    function cargar3d() {
      if (t3) return Promise.resolve(t3);
      if (cargando) return cargando;
      estado.tresPedido = true;
      avisar('Cargando el relieve del valle…');
      var hiDef = !movil && !ahorro;
      cargando = pMeta.then(function (m) {
        return Promise.all([
          import(THREE_URL),
          cargarAlturas(BASE + m.rasters.cerca.archivo), cargarAlturas(BASE + m.rasters.valle.archivo),
          cargarAlturas(BASE + m.rasters.aldea.archivo), cargarAlturas(BASE + m.rasters.lejos.archivo),
        ]).then(function (r) {
          if (estado.destruido) return null;
          var R = {};
          ['cerca', 'valle', 'aldea', 'lejos'].forEach(function (k, i) { var b = r[i + 1], o = m.rasters[k]; R[k] = Object.assign({}, o, { w: b.w, h: b.h, data: b.data }); });
          return crear3d(r[0], m, R, hiDef);
        });
      }).then(function (t) { avisar(''); return t; }, function (e) {
        estado.error3d = String((e && e.message) || e);
        console.warn('Lugar: el 3D no está disponible:', e);
        avisar(''); cargando = null; ponModo('plano');
        return null;
      });
      return cargando;
    }

    function crear3d(THREE, m, R, hiDef) {
      var cv = document.createElement('canvas');
      cv.className = 'lugar__lienzo'; cv.setAttribute('aria-hidden', 'true');
      escenario.insertBefore(cv, capaRot);
      var ren = new THREE.WebGLRenderer({ canvas: cv, antialias: hiDef, powerPreference: 'high-performance', alpha: false, stencil: false });
      var calidad = 0;
      var topeDPR = function () { return calidad >= 1 ? (calidad >= 2 ? 0.8 : 1) : (movil ? 1.25 : 1.5); };
      ren.setPixelRatio(Math.min(devicePixelRatio || 1, topeDPR()));
      ren.outputColorSpace = THREE.SRGBColorSpace;
      ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap; ren.shadowMap.autoUpdate = false;
      var anis = Math.min(8, ren.capabilities.getMaxAnisotropy());
      var esc3 = new THREE.Scene();
      var cam = new THREE.PerspectiveCamera(44, 1.6, 0.5, 90000);
      var disponer = [];
      var guarda = function (o) { disponer.push(o); return o; };
      var i, j;

      /* --- alturas combinadas: aldea 2 m, valle 5 m, cerca 15 m, lejos ~200 m (a escala real) --- */
      var hC = muestreador(R.cerca), hV = muestreador(R.valle), hA = muestreador(R.aldea), hL = muestreador(R.lejos);
      function altura(x, z) {
        var wc = pesoCaja(R.cerca, x, z, 1);
        if (wc <= 0) return hL(x, z);
        var h = hC(x, z);
        var wv = pesoCaja(R.valle, x, z, 80); if (wv > 0) h = lerp(h, hV(x, z), wv);
        var wa = pesoCaja(R.aldea, x, z, 30); if (wa > 0) h = lerp(h, hA(x, z), wa);
        return h;
      }

      /* --- el suelo: ortofoto cercana + la del valle + la de la aldea, fundidas en el sombreado --- */
      var ldr = new THREE.TextureLoader(), pendientes = 0, tListo = performance.now() + 7000;
      var cargaTex = function (url, alListo) {
        pendientes++;
        return ldr.load(url, function (t) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anis; t.needsUpdate = true; if (alListo) alListo(t); pendientes--; pedir(true); },
          undefined, function () { pendientes--; console.warn('Lugar: no carga', url); pedir(true); });
      };
      var O = m.orto, calidadTex = hiDef ? 'alta' : 'baja';
      var uSuelo = {
        mapValle: { value: null }, valleCaja: { value: new THREE.Vector4(O.valle.x0, O.valle.z0, O.valle.x1, O.valle.z1) }, valleListo: { value: 0 },
        mapAldea: { value: null }, aldeaCaja: { value: new THREE.Vector4(O.aldea.x0, O.aldea.z0, O.aldea.x1, O.aldea.z1) }, aldeaListo: { value: 0 },
        tinte: { value: new THREE.Color(EST.tinte[1]) }, tinteK: { value: EST.tinte[0] },
      };
      var parcheSuelo = function (sh, conCajas) {
        Object.assign(sh.uniforms, uSuelo);
        sh.vertexShader = 'varying vec2 vXZ;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vXZ = position.xz;');
        sh.fragmentShader = 'varying vec2 vXZ;\nuniform sampler2D mapValle;\nuniform vec4 valleCaja;\nuniform float valleListo;\nuniform sampler2D mapAldea;\nuniform vec4 aldeaCaja;\nuniform float aldeaListo;\nuniform vec3 tinte;\nuniform float tinteK;\n' +
          sh.fragmentShader.replace('#include <map_fragment>', [
            '#ifdef USE_MAP',
            '  vec4 texel = texture2D(map, vMapUv);',
            conCajas ? [
              '  vec2 vu = (vXZ - valleCaja.xy) / (valleCaja.zw - valleCaja.xy);',
              '  if (valleListo > 0.5 && vu.x > 0.0 && vu.x < 1.0 && vu.y > 0.0 && vu.y < 1.0) {',
              '    vec4 tv = texture2D(mapValle, vec2(vu.x, 1.0 - vu.y));',
              '    texel = mix(texel, tv, smoothstep(0.0, 0.05, min(min(vu.x, 1.0 - vu.x), min(vu.y, 1.0 - vu.y))));',
              '  }',
              '  vec2 au = (vXZ - aldeaCaja.xy) / (aldeaCaja.zw - aldeaCaja.xy);',
              '  if (aldeaListo > 0.5 && au.x > 0.0 && au.x < 1.0 && au.y > 0.0 && au.y < 1.0) {',
              '    vec4 ta = texture2D(mapAldea, vec2(au.x, 1.0 - au.y));',
              '    texel = mix(texel, ta, smoothstep(0.0, 0.12, min(min(au.x, 1.0 - au.x), min(au.y, 1.0 - au.y))));',
              '  }'].join('\n') : '',
            // el color de la estación, solo sobre lo verde de la foto (prados y bosque) y con mesura
            '  float verdor = clamp((texel.g - max(texel.r, texel.b)) * 6.0, 0.0, 1.0);',
            '  texel.rgb = mix(texel.rgb, tinte * (0.55 + 0.9 * dot(texel.rgb, vec3(0.33))), tinteK * verdor);',
            '  diffuseColor *= texel;',
            '#endif'].join('\n'));
      };
      var matCerca = guarda(new THREE.MeshLambertMaterial({ color: '#66705a' }));
      matCerca.onBeforeCompile = function (sh) { parcheSuelo(sh, true); };
      cargaTex(BASE + O.cerca.archivos[calidadTex], function (t) { matCerca.map = t; matCerca.color.set('#ffffff'); matCerca.needsUpdate = true; });
      cargaTex(BASE + O.valle.archivos[calidadTex], function (t) { uSuelo.mapValle.value = t; uSuelo.valleListo.value = 1; });
      cargaTex(BASE + O.aldea.archivos[calidadTex], function (t) { uSuelo.mapAldea.value = t; uSuelo.aldeaListo.value = 1; });
      var matLejos = guarda(new THREE.MeshLambertMaterial({ color: '#5c6658', polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 }));
      matLejos.onBeforeCompile = function (sh) { parcheSuelo(sh, false); };
      cargaTex(BASE + O.lejos.archivos.alta, function (t) { matLejos.map = t; matLejos.color.set('#ffffff'); matLejos.needsUpdate = true; });

      /* --- relieve cercano: rejilla densa en la aldea y en el valle, más abierta lejos --- */
      var F_ = hiDef ? 1 : 1.8;
      function ejes(a0, a1, zonas) {             // zonas: [desde, hasta, paso]; el paso crece un 5 % por metro fuera de cada zona
        var pasoEn = function (v) {
          var s = 70;
          zonas.forEach(function (zn) { var d = v < zn[0] ? zn[0] - v : v > zn[1] ? v - zn[1] : 0; s = Math.min(s, zn[2] * F_ + 0.05 * d); });
          return s;
        };
        var out = [a0], v = a0;
        while (v < a1 - 0.01) { v = Math.min(a1, v + pasoEn(v + pasoEn(v) / 2)); out.push(v); }
        return out;
      }
      var C = R.cerca, V = O.valle;
      var xs = ejes(C.x0, C.x1, [[-230, 230, 2.5], [V.x0, V.x1, 8]]);
      var zs = ejes(C.z0, C.z1, [[-230, 230, 2.5], [V.z0, V.z1, 8]]);
      function rejilla(xs, zs, yFn, uvCaja, hueco, faldon) {
        var nx = xs.length, nz = zs.length, n = nx * nz;
        var nF = faldon ? 2 * (nx + nz) : 0;
        var pos = new Float32Array((n + nF) * 3), uv = new Float32Array((n + nF) * 2);
        var kk = 0, ii, jj;
        for (jj = 0; jj < nz; jj++) for (ii = 0; ii < nx; ii++, kk++) {
          var x = xs[ii], z = zs[jj];
          pos[kk * 3] = x; pos[kk * 3 + 1] = yFn(x, z, ii, jj); pos[kk * 3 + 2] = z;
          uv[kk * 2] = (x - uvCaja.x0) / (uvCaja.x1 - uvCaja.x0); uv[kk * 2 + 1] = 1 - (z - uvCaja.z0) / (uvCaja.z1 - uvCaja.z0);
        }
        var idx = [];
        for (jj = 0; jj < nz - 1; jj++) for (ii = 0; ii < nx - 1; ii++) {
          if (hueco && ii >= hueco[0] && ii < hueco[2] && jj >= hueco[1] && jj < hueco[3]) continue;
          var a = jj * nx + ii, b = a + 1, c = a + nx, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
        if (faldon) {                                     // el borde baja como una pared: tapa las rendijas entre mallas
          var borde = [], f0 = n;
          for (ii = 0; ii < nx; ii++) borde.push(ii);
          for (jj = 1; jj < nz; jj++) borde.push(jj * nx + nx - 1);
          for (ii = nx - 2; ii >= 0; ii--) borde.push((nz - 1) * nx + ii);
          for (jj = nz - 2; jj > 0; jj--) borde.push(jj * nx);
          borde.forEach(function (v, qq) {
            var w = f0 + qq;
            pos[w * 3] = pos[v * 3]; pos[w * 3 + 1] = pos[v * 3 + 1] - faldon; pos[w * 3 + 2] = pos[v * 3 + 2];
            uv[w * 2] = uv[v * 2]; uv[w * 2 + 1] = uv[v * 2 + 1];
          });
          for (var q2 = 0; q2 < borde.length; q2++) {
            var v0 = borde[q2], v1 = borde[(q2 + 1) % borde.length], w0 = f0 + q2, w1 = f0 + (q2 + 1) % borde.length;
            idx.push(v0, w0, v1, v1, w0, w1, v0, v1, w0, v1, w1, w0);
          }
        }
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        g.setIndex(n + nF > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
        g.computeVertexNormals();
        return guarda(g);
      }
      var suelo = new THREE.Mesh(rejilla(xs, zs, function (x, z) { return altura(x, z); }, O.cerca, null, 150), matCerca);
      suelo.receiveShadow = true;
      esc3.add(suelo);
      var L = R.lejos, xsL = [], zsL = [];
      for (i = 0; i < L.w; i++) xsL.push(L.x0 + i * (L.x1 - L.x0) / (L.w - 1));
      for (j = 0; j < L.h; j++) zsL.push(L.z0 + j * (L.z1 - L.z0) / (L.h - 1));
      var lejos = new THREE.Mesh(rejilla(xsL, zsL, function (x, z, ii, jj) { return L.data[jj * L.w + ii]; }, O.lejos, L.hueco, 300), matLejos);
      esc3.add(lejos);

      /* --- el cielo: cúpula con su degradado, el sol y su halo; estrellas y luna de noche --- */
      var uCielo = { cZ: { value: new THREE.Color('#4b80c0') }, cH: { value: new THREE.Color('#ccd9e6') }, dirSol: { value: new THREE.Vector3(0, 1, 0) },
        colSol: { value: new THREE.Color('#fff2dc') }, halo: { value: 1 } };
      var cielo = new THREE.Mesh(guarda(new THREE.SphereGeometry(60000, 32, 16)), guarda(new THREE.ShaderMaterial({
        uniforms: uCielo, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
        vertexShader: 'varying vec3 vDir;\nvoid main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
        fragmentShader: [
          'uniform vec3 cZ; uniform vec3 cH; uniform vec3 dirSol; uniform vec3 colSol; uniform float halo; varying vec3 vDir;',
          'void main(){',
          '  vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0);',
          '  vec3 c = mix(cH, cZ, pow(h, 0.5));',
          '  float s = max(dot(d, normalize(dirSol)), 0.0);',
          '  c += colSol * (pow(s, 900.0) * 2.5 + pow(s, 12.0) * 0.22 * halo + pow(s, 3.0) * 0.06 * halo);',
          '  if (d.y < 0.0) c = mix(cH, cH * 0.82, clamp(-d.y * 6.0, 0.0, 1.0));',
          '  gl_FragColor = vec4(c, 1.0);',
          '  #include <colorspace_fragment>',
          '}'].join('\n'),
      })));
      cielo.renderOrder = -10; cielo.frustumCulled = false;
      esc3.add(cielo);
      var nEst = hiDef ? 1400 : 700, pe = new Float32Array(nEst * 3), ra = azar(11);
      for (i = 0; i < nEst; i++) {
        var th = ra() * Math.PI * 2, yy = 0.04 + ra() * 0.96, rr = Math.sqrt(1 - yy * yy);
        pe[i * 3] = Math.cos(th) * rr * 50000; pe[i * 3 + 1] = yy * 50000; pe[i * 3 + 2] = Math.sin(th) * rr * 50000;
      }
      var gEst = guarda(new THREE.BufferGeometry()); gEst.setAttribute('position', new THREE.BufferAttribute(pe, 3));
      var matEst = guarda(new THREE.PointsMaterial({ color: '#eef2ff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
      var estrellas = new THREE.Points(gEst, matEst); estrellas.frustumCulled = false; esc3.add(estrellas);
      var texL = null;
      var matLuna = guarda(new THREE.SpriteMaterial({ color: '#ffffff', transparent: true, depthWrite: false, fog: false }));
      var lunaSp = new THREE.Sprite(matLuna); lunaSp.scale.set(900, 900, 1); esc3.add(lunaSp);

      /* --- las luces: el sol (o la luna) y el cielo --- */
      var luzSol = new THREE.DirectionalLight('#fff2dc', 2.4);
      luzSol.castShadow = true;
      luzSol.shadow.mapSize.set(hiDef ? 2048 : 1024, hiDef ? 2048 : 1024);
      var sc = luzSol.shadow.camera; sc.left = -130; sc.right = 130; sc.top = 130; sc.bottom = -130; sc.near = 10; sc.far = 3000;
      luzSol.shadow.bias = -0.0006; luzSol.shadow.normalBias = 0.4;
      luzSol.target.position.set(0, m.cota, 0);
      esc3.add(luzSol); esc3.add(luzSol.target);
      var hemi = new THREE.HemisphereLight('#d9e4ee', '#5c5a48', 2.0); esc3.add(hemi);
      esc3.fog = new THREE.Fog('#ccd9e6', 3500, 42000);

      /* --- materiales de la casa y de la aldea --- */
      var tPiedra = guarda(new THREE.CanvasTexture(texPiedra(5))); tPiedra.colorSpace = THREE.SRGBColorSpace; tPiedra.wrapS = tPiedra.wrapT = THREE.RepeatWrapping; tPiedra.anisotropy = anis;
      var tTejado = guarda(new THREE.CanvasTexture(texTejado(9))); tTejado.colorSpace = THREE.SRGBColorSpace; tTejado.wrapS = tTejado.wrapT = THREE.RepeatWrapping; tTejado.anisotropy = anis;
      var tMadera = guarda(new THREE.CanvasTexture(texMadera(3))); tMadera.colorSpace = THREE.SRGBColorSpace; tMadera.wrapS = tMadera.wrapT = THREE.RepeatWrapping;
      var mPiedra = guarda(new THREE.MeshLambertMaterial({ map: tPiedra, side: THREE.DoubleSide }));
      var mPiedraV = guarda(new THREE.MeshLambertMaterial({ map: tPiedra, color: '#c9c2b6', side: THREE.DoubleSide }));
      var mTejado = guarda(new THREE.MeshLambertMaterial({ map: tTejado, side: THREE.DoubleSide }));
      var mMadera = guarda(new THREE.MeshLambertMaterial({ map: tMadera }));
      var mPuerta = guarda(new THREE.MeshLambertMaterial({ color: '#3e2417' }));
      var mVidrio = guarda(new THREE.MeshLambertMaterial({ color: '#1a1c1f', emissive: new THREE.Color('#ffb062'), emissiveIntensity: 0 }));
      var mMarco = guarda(new THREE.MeshLambertMaterial({ color: '#6a3a20' }));

      // constructor de geometría (triángulos con su normal), un lote por material
      function Lote() { this.p = []; this.n = []; this.u = []; }
      Lote.prototype.tri = function (a, b, c, ua, ub, uc) {
        var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
        this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
        for (var k = 0; k < 3; k++) this.n.push(nx / l, ny / l, nz / l);
        this.u.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
      };
      Lote.prototype.quad = function (a, b, c, d, ua, ub, uc, ud) { this.tri(a, b, c, ua, ub, uc); this.tri(a, c, d, ua, uc, ud); };
      Lote.prototype.malla = function (mat, sombra) {
        if (!this.p.length) return null;
        var g = guarda(new THREE.BufferGeometry());
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
        var me = new THREE.Mesh(g, mat); me.castShadow = !!sombra; me.receiveShadow = true; esc3.add(me); return me;
      };
      // muros de un anillo (x, z) de y0 a y1, cara hacia fuera; uv en metros / 2,5
      function muros(lote, anillo, y0, y1) {
        var cx = 0, cz = 0; anillo.forEach(function (p) { cx += p[0]; cz += p[1]; }); cx /= anillo.length; cz /= anillo.length;
        var s = 0;
        for (var k = 0; k < anillo.length; k++) {
          var a = anillo[k], b = anillo[(k + 1) % anillo.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
          var A = [a[0], y0, a[1]], B = [b[0], y0, b[1]], Cc = [b[0], y1, b[1]], D = [a[0], y1, a[1]];
          var nx = b[1] - a[1], nz = -(b[0] - a[0]), mx = (a[0] + b[0]) / 2 - cx, mz = (a[1] + b[1]) / 2 - cz;
          var u0 = s / 2.5, u1 = (s + l) / 2.5, v0 = y0 / 2.5, v1 = y1 / 2.5;
          if (nx * mx + nz * mz >= 0) lote.quad(A, B, Cc, D, [u0, v0], [u1, v0], [u1, v1], [u0, v1]);
          else lote.quad(B, A, D, Cc, [u1, v0], [u0, v0], [u0, v1], [u1, v1]);
          s += l;
        }
      }
      // del sistema de un rectángulo (u a lo largo, v a lo ancho) al mundo
      function ejesRect(rc) {
        var ca = Math.cos(rc.ang), sa = Math.sin(rc.ang);
        return function (u, v, y) { return [rc.cx + u * ca - v * sa, y, rc.cz + u * sa + v * ca]; };
      }
      // cubierta a dos aguas sobre un rectángulo, cumbrera a lo largo (u); hastiales de piedra
      function dosAguas(rc, yAlero, pend, vuelo, loteT, loteP) {
        var W = ejesRect(rc), a = rc.largo / 2, b = rc.fondo / 2, hC = b * Math.tan(pend), yC = yAlero + hC;
        var bb = b + vuelo, yb = yAlero - vuelo * Math.tan(pend), aa = a + vuelo * 0.6;
        loteT.quad(W(-aa, -bb, yb), W(aa, -bb, yb), W(aa, 0, yC), W(-aa, 0, yC), [0, 0], [aa * 2 / 2.2, 0], [aa * 2 / 2.2, bb / 1.6], [0, bb / 1.6]);
        loteT.quad(W(aa, bb, yb), W(-aa, bb, yb), W(-aa, 0, yC), W(aa, 0, yC), [0, 0], [aa * 2 / 2.2, 0], [aa * 2 / 2.2, bb / 1.6], [0, bb / 1.6]);
        [-a, a].forEach(function (u) { loteP.tri(W(u, -b, yAlero), W(u, b, yAlero), W(u, 0, yC), [0, yAlero / 2.5], [b * 2 / 2.5, yAlero / 2.5], [b / 2.5, yC / 2.5]); });
        return yC;
      }
      // cubierta de un anillo cualquiera: faldones hasta el centro (a la gallega, a cuatro aguas)
      function cuatroAguas(anillo, yAlero, alto, loteT) {
        var cx = 0, cz = 0; anillo.forEach(function (p) { cx += p[0]; cz += p[1]; }); cx /= anillo.length; cz /= anillo.length;
        var top = [cx, yAlero + alto, cz];
        for (var k = 0; k < anillo.length; k++) {
          var a = anillo[k], b = anillo[(k + 1) % anillo.length];
          var ea = [cx + (a[0] - cx) * 1.06, yAlero - 0.15, cz + (a[1] - cz) * 1.06], eb = [cx + (b[0] - cx) * 1.06, yAlero - 0.15, cz + (b[1] - cz) * 1.06];
          loteT.tri(ea, eb, top, [0, 0], [Math.hypot(b[0] - a[0], b[1] - a[1]) / 2.2, 0], [0.5, 2]);
        }
      }

      /* --- las casas vecinas (Catastro): muros de piedra y pizarra --- */
      var lPV = new Lote(), lTV = new Lote();
      (m.edificios || []).forEach(function (e) {
        var y0 = e.suelo - 1.2, yA = e.suelo_max + 0.25 + e.pisos * 2.8;
        muros(lPV, e.anillo, y0, yA);
        if (e.rectitud > 0.86 && e.rect.largo > 3) dosAguas(e.rect, yA, 0.52, 0.35, lTV, lPV);
        else cuatroAguas(e.anillo, yA, Math.min(3, Math.sqrt(Math.max(4, e.rect.largo * e.rect.fondo)) * 0.28), lTV);
      });
      lPV.malla(mPiedraV, true); lTV.malla(mTejado, true);

      /* --- la casa: dos plantas de piedra, cubierta de pizarra, porche de madera en el hastial del sureste --- */
      var K = m.casa, rc = K.rect, W = ejesRect(rc), a2 = rc.largo / 2, b2 = rc.fondo / 2;
      var yS = K.suelo, yA = K.suelo_max + 5.6, piso2 = K.suelo_max + 3.0;
      var sueloEn = function (u, v) { var w = W(u, v, 0); return altura(w[0], w[2]); };   // el terreno baja hacia el noroeste
      var yPor = sueloEn(a2 + 1.2, 0);                       // el suelo del porche
      var lP = new Lote(), lT = new Lote(), lM = new Lote();
      muros(lP, [[-a2, -b2], [a2, -b2], [a2, b2], [-a2, b2]].map(function (p) { var w = W(p[0], p[1], 0); return [w[0], w[2]]; }), yS - 1.5, yA);
      var yCum = dosAguas(rc, yA, 0.58, 0.4, lT, lP);
      (m.anejo || []).forEach(function (e) {                // la parte 2 del Catastro: una planta adosada, a un agua
        muros(lP, e.anillo, e.suelo - 1.2, e.suelo_max + 2.6);
        cuatroAguas(e.anillo, e.suelo_max + 2.6, 0.8, lT);
      });
      // el porche: dos postes, la viga y el tejadillo a un agua, apoyado en el hastial (u = +a2)
      var pf = K.porche.fondo, yP = yPor + K.porche.alto, yPm = yP + 0.55;
      var poste = function (u, v) {
        var r = 0.11, h0 = yS - 0.2, h1 = yP;
        var c4 = [[u - r, v - r], [u + r, v - r], [u + r, v + r], [u - r, v + r]].map(function (p) { var w = W(p[0], p[1], 0); return [w[0], w[2]]; });
        muros(lM, c4, h0, h1);
      };
      poste(a2 + pf - 0.15, -b2 - 0.05); poste(a2 + pf - 0.15, b2 + 0.05);
      // viga: una caja larga a lo ancho
      var viga = [[a2 + pf - 0.28, -b2 - 0.3], [a2 + pf - 0.02, -b2 - 0.3], [a2 + pf - 0.02, b2 + 0.3], [a2 + pf - 0.28, b2 + 0.3]].map(function (p) { var w = W(p[0], p[1], 0); return [w[0], w[2]]; });
      muros(lM, viga, yP, yP + 0.24);
      lT.quad(W(a2, -b2 - 0.45, yPm + 0.2), W(a2, b2 + 0.45, yPm + 0.2), W(a2 + pf + 0.35, b2 + 0.45, yP + 0.22), W(a2 + pf + 0.35, -b2 - 0.45, yP + 0.22),
        [0, 1.4], [3.4, 1.4], [3.4, 0], [0, 0]);
      // el murete del porche (a la izquierda de la puerta, mirando la casa) y el banco
      var murete = [[a2 + 0.1, b2 - 0.2], [a2 + pf - 0.4, b2 - 0.2], [a2 + pf - 0.4, b2 + 0.25], [a2 + 0.1, b2 + 0.25]].map(function (p) { var w = W(p[0], p[1], 0); return [w[0], w[2]]; });
      muros(lP, murete, yS - 0.3, yPor + 0.85);
      lP.malla(mPiedra, true); lT.malla(mTejado, true); lM.malla(mMadera, true);
      // las chimeneas: una grande de piedra en el costado noreste junto al porche y otra en el hastial del noroeste
      var lC = new Lote();
      var chimenea = function (u, v, an, alto) {
        var c4 = [[u - an, v - an], [u + an, v - an], [u + an, v + an], [u - an, v + an]].map(function (p) { var w = W(p[0], p[1], 0); return [w[0], w[2]]; });
        muros(lC, c4, yA - 1, alto);
        cuatroAguas(c4, alto + 0.05, 0.35, lT2);
      };
      var lT2 = new Lote();
      chimenea(a2 - 2.2, -b2 * 0.45, 0.45, yCum + 1.3);
      chimenea(-a2 + 0.5, 0, 0.3, yCum + 0.7);
      lC.malla(mPiedra, true); lT2.malla(mTejado, true);
      // huecos: puerta y ventana enrejada bajo el porche, ventanuco en el hastial; ventanas en los costados
      var huecos = [], lV = new Lote(), lMa = new Lote(), lPu = new Lote();
      function hueco(cara, t, dy, an, al, lote, arriba) {  // cara: '+u' | '-u' | '+v' | '-v'; t: posición a lo largo de la cara
        var s = 0.06, P, y0;                           // abajo, dy sobre el terreno de ese punto; arriba, sobre el suelo de la planta alta
        var uv = cara === '+u' ? [a2, t] : cara === '-u' ? [-a2, t] : cara === '+v' ? [t, b2] : [t, -b2];
        y0 = (arriba ? piso2 : Math.max(yS, cara === '+u' ? yPor : sueloEn(uv[0] * 1.05, uv[1] * 1.15))) + dy;
        if (cara === '+u') P = function (dt, dy) { return W(a2 + s, t + dt, y0 + dy); };
        else if (cara === '-u') P = function (dt, dy) { return W(-a2 - s, t + dt, y0 + dy); };
        else if (cara === '+v') P = function (dt, dy) { return W(t + dt, b2 + s, y0 + dy); };
        else P = function (dt, dy) { return W(t + dt, -b2 - s, y0 + dy); };
        var m2 = 0.09;
        lMa.quad(P(-an / 2 - m2, -m2), P(an / 2 + m2, -m2), P(an / 2 + m2, al + m2), P(-an / 2 - m2, al + m2), [0, 0], [1, 0], [1, 1], [0, 1]);
        var P2 = function (dt, dy) { var a = P(dt, dy), c = W(0, 0, 0); var d = Math.hypot(a[0] - c[0], a[2] - c[2]) || 1; return [a[0] + (a[0] - c[0]) / d * 0.02, a[1], a[2] + (a[2] - c[2]) / d * 0.02]; };
        lote.quad(P2(-an / 2, 0), P2(an / 2, 0), P2(an / 2, al), P2(-an / 2, al), [0, 0], [1, 0], [1, 1], [0, 1]);
        huecos.push(1);
      }
      // mirando el porche desde fuera: la puerta en el centro, la ventana enrejada a la derecha (−v), el murete a la izquierda
      hueco('+u', 0.9, 0.05, 1.0, 2.05, lPu);            // la puerta
      hueco('+u', -1.9, 0.95, 1.05, 1.15, lV);           // la ventana enrejada
      hueco('+u', 0.2, 0.9, 0.8, 1.0, lV, true);         // la ventana del hastial
      hueco('+u', 2.6, 1.1, 0.7, 0.9, lV);
      [-5.5, -2.2, 1.4, 4.8].forEach(function (t) { hueco('-v', t, 0.6, 0.85, 1.05, lV, true); });
      [-4.2, 3.2].forEach(function (t) { hueco('-v', t, 1.1, 0.8, 1.0, lV); });
      hueco('-v', -0.6, 0.05, 1.0, 2.05, lPu);
      [-4.5, 0.5, 4.5].forEach(function (t) { hueco('+v', t, 0.6, 0.8, 1.0, lV, true); });
      lMa.malla(mMarco, false); lV.malla(mVidrio, false); lPu.malla(mPuerta, false);
      // la luz del porche, de noche (halo dibujado, sin bloom)
      var tHalo = guarda(new THREE.CanvasTexture(texHalo())); tHalo.colorSpace = THREE.SRGBColorSpace;
      var matHalo = guarda(new THREE.SpriteMaterial({ map: tHalo, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, toneMapped: false }));
      var halo = new THREE.Sprite(matHalo); var ph = W(a2 + 0.25, -0.2, yP - 0.25); halo.position.set(ph[0], ph[1], ph[2]); halo.scale.set(3.2, 3.2, 1); esc3.add(halo);
      var luzPorche = new THREE.PointLight('#ffb466', 0, 22, 2); luzPorche.position.set(ph[0], ph[1] - 0.3, ph[2]); esc3.add(luzPorche);

      /* --- los árboles: copas con el color de la estación --- */
      var arb = m.arboles || [], nA = hiDef ? arb.length : Math.ceil(arb.length * 0.6);
      var gCopa = guarda(new THREE.IcosahedronGeometry(1, hiDef ? 1 : 0)), gTronco = guarda(new THREE.CylinderGeometry(0.12, 0.2, 1, 5));
      gTronco.translate(0, 0.5, 0);
      var mCopa = guarda(new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }));
      var mTronco = guarda(new THREE.MeshLambertMaterial({ color: '#4a3b2e' }));
      var copas = new THREE.InstancedMesh(gCopa, mCopa, nA), troncos = new THREE.InstancedMesh(gTronco, mTronco, nA);
      var mt = new THREE.Matrix4(), qt = new THREE.Quaternion(), vS = new THREE.Vector3(), vP = new THREE.Vector3(), colA = new THREE.Color(), rA = azar(23);
      var paso = arb.length / nA, nPer = 0;
      for (i = 0; i < nA; i++) {
        var t = arb[Math.floor(i * paso)], x = t[0], yb = altura(t[0], t[2]), z = t[2], r = t[3], h = t[4];
        var perenne = rA() < EST.perenne, hojas = perenne ? 1 : EST.hojas;
        var rc_ = r * (0.55 + 0.45 * hojas), hc = h * 0.42;
        vP.set(x, yb + h - hc * 0.9, z); vS.set(rc_, hc, rc_); qt.setFromAxisAngle(vS.clone().set(0, 1, 0), rA() * 6.28);
        mt.compose(vP, qt, vS); copas.setMatrixAt(i, mt);
        colA.set(perenne ? (rA() < 0.5 ? '#2f4527' : '#36502c') : EST.copas[Math.floor(rA() * EST.copas.length)]);
        copas.setColorAt(i, colA);
        vP.set(x, yb - 0.5, z); vS.set(1.1 + r * 0.15, h * 0.7, 1.1 + r * 0.15); mt.compose(vP, qt.identity(), vS); troncos.setMatrixAt(i, mt);
        if (perenne) nPer++;
      }
      copas.instanceMatrix.needsUpdate = true; if (copas.instanceColor) copas.instanceColor.needsUpdate = true;
      copas.castShadow = true; copas.receiveShadow = true; troncos.castShadow = false;
      esc3.add(copas); esc3.add(troncos);

      /* --- el río Barcia y el Agüeira: cintas de agua sobre el cauce --- */
      var uAgua = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        tiempo: { value: 0 }, cH: { value: new THREE.Color('#ccd9e6') }, fondo: { value: new THREE.Color('#2c3b36') }, luz: { value: 1 },
      }]);
      var matAgua = guarda(new THREE.ShaderMaterial({
        uniforms: uAgua, fog: true, transparent: true, depthWrite: false, toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
        vertexShader: ['attribute vec2 st; varying vec2 vST; varying vec3 vMundo;', '#include <fog_pars_vertex>',
          'void main(){ vST = st; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); vMundo = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * mvPosition;', '#include <fog_vertex>', '}'].join('\n'),
        fragmentShader: ['uniform float tiempo; uniform vec3 cH; uniform vec3 fondo; uniform float luz; varying vec2 vST; varying vec3 vMundo;', '#include <fog_pars_fragment>',
          'void main(){',
          '  float borde = smoothstep(0.0, 0.22, vST.y) * smoothstep(1.0, 0.78, vST.y);',
          '  vec3 vista = normalize(cameraPosition - vMundo); float fres = pow(1.0 - clamp(vista.y, 0.0, 1.0), 3.0);',
          '  float vetas = sin(vST.x * 0.9 - tiempo * 2.2 + sin(vST.y * 9.0) * 1.5) * 0.5 + 0.5;',
          '  vec3 c = mix(fondo, cH, 0.35 + 0.5 * fres) * luz;',
          '  c += vec3(0.9, 0.95, 1.0) * pow(vetas, 14.0) * 0.18 * luz;',
          '  gl_FragColor = vec4(c, 0.88 * borde);',
          '  #include <colorspace_fragment>',
          '  #include <fog_fragment>',
          '}'].join('\n'),
      }));
      function cinta(pts, ancho, alzar) {              // pts: [x, y, z, w?]
        var n = pts.length, pos = new Float32Array(n * 6), st = new Float32Array(n * 4), idx = [], s = 0;
        for (var k = 0; k < n; k++) {
          var a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)], dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1;
          var nx = -dz / l, nz = dx / l, w = (pts[k][3] || ancho) / 2, y = pts[k][1] + alzar;
          if (k) s += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][2] - pts[k - 1][2]);
          var y1 = Math.max(y, altura(pts[k][0] + nx * w, pts[k][2] + nz * w) + 0.15), y2 = Math.max(y, altura(pts[k][0] - nx * w, pts[k][2] - nz * w) + 0.15);
          pos.set([pts[k][0] + nx * w, Math.min(y1, y + 1.2), pts[k][2] + nz * w, pts[k][0] - nx * w, Math.min(y2, y + 1.2), pts[k][2] - nz * w], k * 6);
          st.set([s / 6, 0, s / 6, 1], k * 4);
          if (k) idx.push(2 * k - 2, 2 * k - 1, 2 * k, 2 * k - 1, 2 * k + 1, 2 * k);
        }
        var g = guarda(new THREE.BufferGeometry());
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('st', new THREE.BufferAttribute(st, 2)); g.setIndex(idx);
        return g;
      }
      var rio = new THREE.Mesh(cinta(m.rio, 3, 0.5), matAgua); rio.renderOrder = 2; esc3.add(rio);
      if (m.agueira && m.agueira.length > 1) { var ag = new THREE.Mesh(cinta(m.agueira, 8, 0.5), matAgua); ag.renderOrder = 2; esc3.add(ag); }

      /* --- las rutas: una cinta sobre el relieve que se dibuja al subir; halo suave debajo --- */
      var cssV = getComputedStyle(el);
      var colorVar = function (n, d) { var v = (cssV.getPropertyValue(n) || '').trim(); return /^#[0-9a-f]{6}$/i.test(v) ? v : d; };
      var COL_RUTA = { seimeira: colorVar('--acento-claro', '#e8cc6a'), talladas: '#f4efe3' };
      var uRutas = [];
      (m.rutas || []).forEach(function (rt) {
        rt.trazos.forEach(function (tz) {
          var pts = tz.map(function (p) { return [p[0], altura(p[0], p[2]), p[2]]; });
          var largo = 0; for (var k = 1; k < pts.length; k++) largo += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][2] - pts[k - 1][2]);
          [[16, 0.22], [7, 0.95]].forEach(function (cap) {
            var u = { avance: { value: 0 }, largo: { value: largo / 6 }, color: { value: new THREE.Color(COL_RUTA[rt.clave] || '#f4efe3') }, opac: { value: cap[1] } };
            uRutas.push(u);
            var mat = guarda(new THREE.ShaderMaterial({
              uniforms: u, transparent: true, depthWrite: false, toneMapped: false, blending: cap[1] < 0.5 ? THREE.AdditiveBlending : THREE.NormalBlending,
              polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6,
              vertexShader: 'attribute vec2 st; varying vec2 vST; void main(){ vST = st; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
              fragmentShader: ['uniform float avance; uniform float largo; uniform vec3 color; uniform float opac; varying vec2 vST;',
                'void main(){ float f = vST.x / largo; if (f > avance) discard;',
                '  float b = smoothstep(0.0, 0.3, vST.y) * smoothstep(1.0, 0.7, vST.y);',
                '  float punta = smoothstep(avance, avance - 0.02, f);',
                '  gl_FragColor = vec4(color, opac * b * mix(1.0, punta, 0.5));',
                '  #include <colorspace_fragment>',
                '}'].join('\n'),
            }));
            var me = new THREE.Mesh(cinta(pts, cap[0], 2.2), mat); me.renderOrder = 3; esc3.add(me);
          });
        });
      });

      /* --- rótulos (HTML encima del lienzo) --- */
      var rotulos = m.lugares.filter(function (l) { return FASES[l.clave]; }).map(function (l) {
        var d = document.createElement('div');
        d.className = 'lugar__rotulo' + (l.clave === 'casa' ? ' lugar__rotulo--casa' : '') + (/^ruta-/.test(l.clave) ? ' lugar__rotulo--ruta lugar__rotulo--' + l.clave : '');
        var dist = l.dist_m ? km(l.dist_m) + ' en línea recta' : null;
        d.innerHTML = '<b>' + esc(l.nombre) + '</b>' + (l.sub ? '<span>' + esc(l.sub) + '</span>' : dist && l.clave !== 'barcia' ? '<span>' + esc(dist) + '</span>' : '');
        capaRot.appendChild(d);
        return { l: l, el: d, v: new THREE.Vector3(l.x, l.y + (l.clave === 'casa' ? 0 : 8), l.z), f: FASES[l.clave] };
      });
      var vT = new THREE.Vector3();
      function tapado(a, b) {                          // ¿el relieve tapa el rótulo? 14 muestras por la recta
        for (var k = 1; k < 14; k++) {
          var t = k / 14, x = lerp(a.x, b.x, t), y = lerp(a.y, b.y, t), z = lerp(a.z, b.z, t);
          if (altura(x, z) > y + 4) return true;
        }
        return false;
      }
      function ponRotulos(p, W, H) {
        var ocupados = [];
        rotulos.forEach(function (r) {
          var on = p >= r.f[0] && p <= r.f[1];
          if (on) {
            vT.copy(r.v).project(cam);
            on = vT.z < 1 && Math.abs(vT.x) < 0.94 && vT.y > -0.86 && vT.y < 0.9 && !tapado(cam.position, r.v);
            if (on) {
              var x = (vT.x + 1) / 2 * W, y = (1 - vT.y) / 2 * H;
              var choca = ocupados.some(function (o) { return Math.abs(o[0] - x) < 120 && Math.abs(o[1] - y) < 30; });
              if (choca) on = false;
              else { ocupados.push([x, y]); r.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; r.el.classList.toggle('a-la-izq', x > W * 0.7); }
            }
          }
          r.el.classList.toggle('es-visible', on);
        });
      }

      /* --- la luz de ahora --- */
      var dirSol = new THREE.Vector3(), dirLuna = new THREE.Vector3(), solPrev = null, nocheF = 0;
      function dirDe(alt, az, v) {                     // acimut desde el norte hacia el este; x este, z sur
        var a = alt * RAD, z = az * RAD;
        return v.set(Math.cos(a) * Math.sin(z), Math.sin(a), -Math.cos(a) * Math.cos(z));
      }
      function luces(f) {
        var s = sol(f), l = luna(f), c = cieloPara(s.alt);
        dirDe(s.alt, s.az, dirSol); dirDe(l.alt, l.az, dirLuna);
        uCielo.cZ.value.set(c.cz); uCielo.cH.value.set(c.ch); uCielo.dirSol.value.copy(dirSol);
        var dia = suave(-6, 6, s.alt), bajo = 1 - suave(4, 30, s.alt);
        uCielo.colSol.value.set(mezcla('#fff3df', '#ff9a52', bajo)); uCielo.halo.value = dia;
        esc3.fog.color.set(c.ch);
        nocheF = 1 - suave(-10, -2, s.alt);
        matEst.opacity = nocheF * 0.9;
        var lunaArriba = l.alt > 0 && nocheF > 0.2;
        lunaSp.visible = l.alt > -2;
        if (lunaSp.visible) {
          lunaSp.position.copy(dirLuna).multiplyScalar(45000);
          if (!texL || Math.abs(texL.fase - l.fase) > 0.01) { if (texL) texL.dispose(); texL = new THREE.CanvasTexture(texLuna(l.fase)); texL.colorSpace = THREE.SRGBColorSpace; texL.fase = l.fase; matLuna.map = texL; matLuna.needsUpdate = true; }
          matLuna.opacity = 0.35 + 0.65 * nocheF;
        }
        // el sol (o la luna, de noche) da la luz directa
        if (s.alt > -2) {
          luzSol.color.set(mezcla('#fff1dc', '#ffb070', bajo)); luzSol.intensity = 2.5 * suave(-2, 8, s.alt);
          luzSol.position.copy(luzSol.target.position).addScaledVector(dirSol, 1500);
        } else {
          luzSol.color.set('#9fb4d8'); luzSol.intensity = lunaArriba ? 0.35 * l.luz : 0;
          luzSol.position.copy(luzSol.target.position).addScaledVector(dirLuna, 1500);
        }
        hemi.color.set(mezcla('#2a3550', '#d9e4ee', dia)); hemi.groundColor.set(mezcla('#151820', '#5c5a48', dia));
        hemi.intensity = lerp(0.35, 2.0, dia);
        uAgua.cH.value.set(c.ch); uAgua.luz.value = lerp(0.35, 1, dia);
        mVidrio.emissiveIntensity = nocheF * 1.3; matHalo.opacity = nocheF; luzPorche.intensity = nocheF * 14;
        var clave = Math.round(s.alt * 4) + ':' + Math.round(s.az * 2);
        if (clave !== solPrev) { solPrev = clave; ren.shadowMap.needsUpdate = true; }
        pedir(true);
      }

      /* --- el recorrido --- */
      var ruta = camino(m.recorrido);
      var pVis = estado.p, activo = false, visible = false, raf = 0, sucio = true, ult = 0, tiempos = [], fps = null, tAgua = 0;
      if (q.has('fps')) { fps = document.createElement('pre'); fps.className = 'lugar__fps'; escenario.appendChild(fps); }
      function tamano() {
        var W = escenario.clientWidth, H = escenario.clientHeight;
        if (!W || !H) return;
        ren.setPixelRatio(Math.min(devicePixelRatio || 1, topeDPR()));
        ren.setSize(W, H, false);
        cam.aspect = W / H; cam.fov = W / H < 0.9 ? 58 : 44; cam.updateProjectionMatrix();
        sucio = true;
      }
      function pedir(forzar) { if (forzar) sucio = true; if (!raf && activo && visible) raf = requestAnimationFrame(cuadro); }
      function cuadro(t) {
        raf = 0;
        if (!activo || !visible || estado.destruido) return;
        var dt = ult ? Math.min(0.1, (t - ult) / 1000) : 0.016; ult = t;
        var obj = estado.p, antes = pVis;
        pVis = Math.abs(obj - pVis) < 0.0004 ? obj : lerp(pVis, obj, 1 - Math.exp(-dt * 6));
        if (pVis !== antes) sucio = true;
        var aguaVisible = pVis < 0.8;
        if (aguaVisible && t - tAgua > 33) { tAgua = t; uAgua.tiempo.value = t / 1000; sucio = true; }     // el agua corre a ~30 fps
        if (sucio) {
          var c = ruta(pVis), W = escenario.clientWidth, H = escenario.clientHeight;
          cam.position.set(c.pos[0], c.pos[1], c.pos[2]); cam.lookAt(c.mira[0], c.mira[1], c.mira[2]);
          var hS = cam.position.y - altura(cam.position.x, cam.position.z);
          cam.near = lim(hS * 0.25, 0.3, 20); cam.far = 90000; cam.updateProjectionMatrix();
          cielo.position.copy(cam.position); estrellas.position.copy(cam.position);
          var av = suave(0.74, 0.97, pVis);
          uRutas.forEach(function (u) { u.avance.value = av; });
          marcarParada(pVis);
          var t0 = performance.now();
          ren.render(esc3, cam);
          var dtR = performance.now() - t0;
          ponRotulos(pVis, W, H);
          sucio = false;
          // calidad automática: si los fotogramas pasan de 30 ms, menos resolución; luego sin sombras
          tiempos.push(dt * 1000); if (tiempos.length > 40) tiempos.shift();
          if (tiempos.length === 40 && calidad < 2) {
            var med = tiempos.slice().sort(function (a, b) { return a - b; })[20];
            if (med > 30) { calidad++; tiempos = []; if (calidad === 2) { ren.shadowMap.enabled = false; copas.castShadow = false; } tamano(); }
          }
          if (fps) fps.textContent = Math.round(1000 / Math.max(1, tiempos.length ? tiempos.reduce(function (a, b) { return a + b; }, 0) / tiempos.length : 16)) + ' fps · calidad ' + calidad + ' · DPR ' + ren.getPixelRatio().toFixed(2) +
            '\np ' + pVis.toFixed(3) + ' · cámara ' + cam.position.y.toFixed(0) + ' m (' + hS.toFixed(0) + ' sobre el suelo)\n' + Math.round(ren.info.render.triangles / 1000) + ' k triángulos · render ' + dtR.toFixed(1) + ' ms';
          estado.t3 = { triangulos: ren.info.render.triangles, llamadas: ren.info.render.calls, pVis: pVis, arboles: nA, perennes: nPer, huecos: huecos.length, calidad: calidad, cam: [cam.position.x, cam.position.y, cam.position.z] };
        }
        if (Math.abs(estado.p - pVis) > 0.0002 || aguaVisible || pendientes > 0) pedir();
        if (!estado.cargado && (pendientes === 0 || performance.now() > tListo)) { estado.cargado = true; escenario.classList.add('lugar--listo'); }
      }
      var io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) pedir(true); }, { rootMargin: '100px' });
      io.observe(escenario);
      var ro = new ResizeObserver(function () { tamano(); pedir(true); }); ro.observe(escenario);
      cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); estado.error3d = 'contexto perdido'; ponModo('plano'); });
      tamano();
      luces(ahora());

      t3 = {
        luces: luces,
        activo: function (on) { activo = on; escenario.classList.toggle('lugar--3d', on); if (on) { tamano(); pedir(true); } else if (raf) { cancelAnimationFrame(raf); raf = 0; } },
        scroll: function () { pedir(); },
        destruir: function () {
          activo = false; if (raf) cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
          if (texL) texL.dispose();
          disponer.forEach(function (o) { try { o.dispose(); } catch (e) { /* nada */ } });
          [matCerca.map, matLejos.map, uSuelo.mapValle.value, uSuelo.mapAldea.value].forEach(function (t) { if (t) t.dispose(); });
          copas.dispose(); troncos.dispose();
          ren.dispose(); if (ren.forceContextLoss) ren.forceContextLoss();
          if (cv.parentNode) cv.parentNode.removeChild(cv); if (fps && fps.parentNode) fps.parentNode.removeChild(fps);
          capaRot.innerHTML = '';
        },
      };
      return t3;
    }

    /* ---------- scroll: p de 0 a 1 según la pista ---------- */
    function medir() {
      var r = pista.getBoundingClientRect(), H = escenario.offsetHeight || innerHeight;
      var total = Math.max(1, r.height - H);
      estado.p = lim(-r.top / total, 0, 1);
      if (estado.modo === '3d' && t3) t3.scroll();
    }
    escucha(window, 'scroll', medir, { passive: true });
    escucha(window, 'resize', medir, { passive: true });

    /* ---------- botones ---------- */
    escucha($('a3d'), 'click', function () {
      ponModo('3d');
      cargar3d().then(function (t) { if (t && !estado.destruido) { ponModo('3d'); medir(); } });
      var r = pista.getBoundingClientRect();                // lleva al principio del vuelo
      if (r.top > 40 || r.bottom < innerHeight) scrollTo({ top: scrollY + r.top, behavior: reduce ? 'auto' : 'smooth' });
    });
    escucha($('aplano'), 'click', function () {
      ponModo('plano');
      var b = $('a3d'); if (!b.hidden) b.focus({ preventScroll: true });
      el.querySelector('.lugar__planob').scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    });

    /* ---------- arranque ---------- */
    ponModo('plano');
    cieloTexto();
    intervalo = setInterval(function () { if (!estado.destruido) cieloTexto(); }, 60000);
    medir();
    if (auto3d) { ponModo('3d'); cargar3d().then(function (t) { if (t && !estado.destruido) { ponModo('3d'); medir(); } }); }
    el.dataset.montado = '1';

    var api = {
      destruir: function () {
        if (estado.destruido) return;
        estado.destruido = true;
        clearInterval(intervalo);
        escuchas.forEach(function (f) { f(); });
        if (t3) t3.destruir();
        t3 = null;
        el.classList.remove('lugar-mod'); delete el.dataset.modo; delete el.dataset.montado; delete el.dataset.estacion;
        el.style.removeProperty('--lugar-noche');
        el.innerHTML = respaldo;
      },
      estado: function () { return Object.assign({}, estado, { t3: t3 ? estado.t3 || null : null }); },
      ver3d: function () { $('a3d').click(); },
      verPlano: function () { $('aplano').click(); },
    };
    return api;
  }

  FX.lugar = {
    montar: montar,
    // para las pruebas (scripts/lugar-prueba.mjs)
    sol: sol, luna: luna, fraseCielo: fraseCielo, cieloPara: cieloPara, camino: camino, estacionDe: estacionDe, ESTACIONES: ESTACIONES, PARADAS: PARADAS, FASES: FASES,
  };
})();

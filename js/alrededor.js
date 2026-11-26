/* ------------------------------------------------------------------
   Casa Freixe · alrededor.js · «Alrededor» (módulo de Lugar)
   window.Freixe.alrededor.montar(el, { movimiento, densidad, webgl, estacion }) → { destruir() }

   La lista es el mando: al pulsar un sitio, el mapa (SVG propio con datos
   de OpenStreetMap, sin teselas de nadie) vuela hasta él y dibuja el
   camino desde la casa; la ficha da los km, los minutos, las carreteras y
   el enlace a Google Maps, con el conmutador «en coche / a pie» donde
   tiene sentido. Los senderos llevan además su perfil de desnivel (MDT05
   del IGN), que se recorre con el dedo, el ratón o las flechas y marca el
   punto en el mapa.
   - Cifras: OSRM y routing.openstreetmap.de (ref/raw/rutas.json), ya
     escritas en el HTML de respaldo (partes/alrededor.html).
   - Datos del mapa: data/alrededor-mapa.json (scripts/alrededor-mapa.mjs).
   - Movimiento reducido: sin vuelo ni trazo animado; salta y se ve entero.
   El HTML que trae `el` es el respaldo: se guarda y se repone al destruir.
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var FX = (window.Freixe = window.Freixe || {});
  if (FX.alrededor && FX.alrededor.montar) return;

  var SCRIPT = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  var RAIZ = SCRIPT ? new URL('../', SCRIPT).href : (typeof location !== 'undefined' ? new URL('./', location.href).href : './');
  var DATOS = RAIZ + 'data/alrededor-mapa.json';
  var NS = 'http://www.w3.org/2000/svg';

  var lim = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var coma = function (v, d) { return (+v).toFixed(d == null ? 1 : d).replace('.', ','); };
  var kmS = function (v) { return String(+v).replace('.', ','); };            // como en el HTML de respaldo: «27 km», «4,3 km»
  var minTxt = function (m) { return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : ''); };
  var distTxt = function (m) { return m < 1000 ? Math.round(m / 10) * 10 + ' m' : coma(m / 1000) + ' km'; };

  // vuelo suave entre dos vistas [cx, cy, ancho] (van Wijk y Nuij, «Smooth and efficient zooming and panning»)
  function interpVista(p0, p1) {
    var ux0 = p0[0], uy0 = p0[1], w0 = p0[2], ux1 = p1[0], uy1 = p1[1], w1 = p1[2];
    var dx = ux1 - ux0, dy = uy1 - uy0, d2 = dx * dx + dy * dy, rho = 1.4, rho2 = rho * rho, rho4 = rho2 * rho2, f, S;
    if (d2 < 1e-6) {
      S = Math.log(w1 / w0) / rho;
      f = function (t) { return [ux0 + t * dx, uy0 + t * dy, w0 * Math.exp(rho * t * S)]; };
    } else {
      var d1 = Math.sqrt(d2), b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1), b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1);
      var r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0), r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
      S = (r1 - r0) / rho;
      f = function (t) {
        var s = t * S, c0 = Math.cosh(r0), u = w0 / (rho2 * d1) * (c0 * Math.tanh(rho * s + r0) - Math.sinh(r0));
        return [ux0 + u * dx, uy0 + u * dy, w0 * c0 / Math.cosh(rho * s + r0)];
      };
    }
    f.duracion = lim(Math.abs(S) * 1000 * rho / Math.SQRT2 * 0.9, 650, 2100);
    return f;
  }
  var suaveIO = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  function montar(el, opciones) {
    opciones = opciones || {};
    var raiz = el.querySelector('.alr');
    if (!raiz) throw new Error('Alrededor: falta partes/alrededor.html dentro del hueco');
    var reduce = opciones.movimiento === false || matchMedia('(prefers-reduced-motion: reduce)').matches;
    var respaldo = el.innerHTML;
    var escuchas = [];
    var escucha = function (o, ev, fn, op) { o.addEventListener(ev, fn, op); escuchas.push(function () { o.removeEventListener(ev, fn, op); }); };
    var estado = { sel: null, modo: 'coche', vista: null, perfil: null, listo: false, destruido: false };
    var D = null, vuelo = 0;

    var vistaEl = raiz.querySelector('.alr__vista'), mapaEl = raiz.querySelector('.alr__mapa'), ficha = raiz.querySelector('.alr__ficha');
    var botones = [].slice.call(raiz.querySelectorAll('.alr__boton'));
    var estrecho = matchMedia('(max-width: 820px)');
    el.classList.add('alr-mod');

    /* ---------- el mapa: SVG (geometría) + capa HTML (marcas y rótulos) ---------- */
    mapaEl.innerHTML =
      '<svg class="alr__svg" preserveAspectRatio="none" focusable="false">' +
        '<rect class="alr__tierra" x="-400000" y="-400000" width="800000" height="800000"/>' +
        '<path class="alr__mar"/><g class="alr__islas"></g>' +
        '<image class="alr__relieve" preserveAspectRatio="none"/>' +
        '<path class="alr__rios-grandes"/><path class="alr__rios"/>' +
        '<path class="alr__vias alr__vias--b"/><path class="alr__vias alr__vias--a"/>' +
        '<g class="alr__senderos"></g>' +
        '<path class="alr__ruta alr__ruta--fondo"/><path class="alr__ruta" pathLength="1"/>' +
      '</svg>' +
      '<div class="alr__capa" aria-hidden="true"></div>' +
      '<div class="alr__escala" aria-hidden="true"><i></i><span></span></div>' +
      '<p class="alr__credito">© OpenStreetMap · IGN</p>';
    var svg = mapaEl.querySelector('svg'), capa = mapaEl.querySelector('.alr__capa');
    var q = function (s) { return svg.querySelector(s); };
    var rutaP = svg.querySelectorAll('.alr__ruta')[1], rutaF = q('.alr__ruta--fondo');

    function tam() { return { W: mapaEl.clientWidth || 600, H: mapaEl.clientHeight || 400 }; }
    function encaje(c, margen) {                       // vista [cx, cy, ancho] que mete la caja [x0, y0, x1, y1]
      var t = tam(), m = margen || 1.22;
      var bw = Math.max(800, c[2] - c[0]), bh = Math.max(800, c[3] - c[1]);
      var w = Math.max(bw, bh * t.W / t.H) * m;
      return [(c[0] + c[2]) / 2, (c[1] + c[3]) / 2, w];
    }
    var marcas = [], aldeas = [], puntoPerfil = null, casaM = null;
    function proyecta(x, y) {
      var t = tam(), v = estado.vista, h = v[2] * t.H / t.W;
      return [(x - (v[0] - v[2] / 2)) / v[2] * t.W, (y - (v[1] - h / 2)) / h * t.H];
    }
    function ponVista(v) {
      estado.vista = v;
      var t = tam(), h = v[2] * t.H / t.W;
      svg.setAttribute('viewBox', [v[0] - v[2] / 2, v[1] - h / 2, v[2], h].map(function (n) { return n.toFixed(1); }).join(' '));
      if (!D) return;
      // nivel de detalle: el mar de cada escala; relieve, ríos y carreteras del concejo solo de cerca (fundidos)
      var nv = D.niveles.filter(function (n) { return v[2] <= n.ancho_max; })[0] || D.niveles[D.niveles.length - 1];
      if (q('.alr__mar').dataset.nivel !== nv.nombre) {
        q('.alr__mar').setAttribute('d', nv.d); q('.alr__mar').dataset.nivel = nv.nombre;
        q('.alr__islas').innerHTML = nv.islas.map(function (d) { return '<path d="' + d + '"/>'; }).join('');
      }
      var cerca = 1 - lim((v[2] - 30000) / 30000, 0, 1);
      svg.style.setProperty('--alr-cerca', cerca.toFixed(3));
      svg.style.setProperty('--alr-muy-cerca', (1 - lim((v[2] - 9000) / 9000, 0, 1)).toFixed(3));
      // marcas
      var pxm = t.W / v[2];
      marcas.forEach(function (mk) {
        var p = proyecta(mk.x, mk.y), fuera = p[0] < -40 || p[0] > t.W + 40 || p[1] < -40 || p[1] > t.H + 40;
        mk.el.hidden = fuera;
        if (!fuera) mk.el.style.transform = 'translate(' + p[0].toFixed(1) + 'px,' + p[1].toFixed(1) + 'px)';
      });
      var cp = proyecta(0, 0); casaM.style.transform = 'translate(' + cp[0].toFixed(1) + 'px,' + cp[1].toFixed(1) + 'px)';
      // rótulos de aldeas: solo muy de cerca, sin pisarse con las marcas ni entre ellos
      var ocup = marcas.filter(function (mk) { return !mk.el.hidden; }).map(function (mk) { return proyecta(mk.x, mk.y); }).concat([cp]);
      var nAld = 0;
      aldeas.forEach(function (a) {
        var on = v[2] < 9000 && nAld < 22;
        if (on) {
          var p = proyecta(a.x, a.y);
          on = p[0] > 30 && p[0] < t.W - 30 && p[1] > 20 && p[1] < t.H - 20 && !ocup.some(function (o) { return Math.abs(o[0] - p[0]) < 70 && Math.abs(o[1] - p[1]) < 18; });
          if (on) { ocup.push(p); nAld++; a.el.style.transform = 'translate(' + p[0].toFixed(1) + 'px,' + p[1].toFixed(1) + 'px)'; }
        }
        a.el.hidden = !on;
      });
      if (puntoPerfil && estado.perfil) {
        var pp = proyecta(estado.perfil[2], estado.perfil[3]);
        puntoPerfil.style.transform = 'translate(' + pp[0].toFixed(1) + 'px,' + pp[1].toFixed(1) + 'px)';
      }
      // escala gráfica de ~110 px con un número redondo
      var metros = 110 / pxm, pot = Math.pow(10, Math.floor(Math.log10(metros))), n = [1, 2, 5, 10].map(function (k) { return k * pot; }).filter(function (k) { return k <= metros; }).pop() || pot;
      mapaEl.querySelector('.alr__escala i').style.width = (n * pxm).toFixed(0) + 'px';
      mapaEl.querySelector('.alr__escala span').textContent = distTxt(n);
    }
    function volarA(v, alAcabar) {
      cancelAnimationFrame(vuelo);
      var desde = estado.vista;
      if (reduce || !desde) { ponVista(v); if (alAcabar) alAcabar(); return; }
      var f = interpVista(desde, v), t0 = performance.now(), dur = f.duracion;
      estado.volando = true;
      var paso = function (t) {
        var k = lim((t - t0) / dur, 0, 1);
        ponVista(f(suaveIO(k)));
        if (k < 1 && !estado.destruido) vuelo = requestAnimationFrame(paso);
        else { estado.volando = false; ponVista(v); if (alAcabar) alAcabar(); }
      };
      vuelo = requestAnimationFrame(paso);
    }

    /* ---------- la ficha ---------- */
    function gmaps(d, modo) {
      return 'https://www.google.com/maps/dir/?api=1&origin=' + D.casa.lat + ',' + D.casa.lon + '&destination=' + d.lat + ',' + d.lon + '&travelmode=' + (modo === 'pie' ? 'walking' : 'driving');
    }
    function pintarFicha() {
      var id = estado.sel, r = D.rutas.destinos[id], dm = D.destinos[id], s = D.senderos[id];
      var modo = estado.modo === 'pie' && r.pie ? 'pie' : 'coche', c = r[modo];
      var html = '<h3 class="alr__f-tit">' + esc(r.nombre) + '</h3>' + (r.sub ? '<p class="alr__f-sub">' + esc(r.sub) + '</p>' : '');
      if (r.pie) {
        html += '<div class="alr__modos" role="group" aria-label="Cómo ir">' +
          '<button type="button" class="alr__modo" data-modo="coche" aria-pressed="' + (modo === 'coche') + '">En coche</button>' +
          '<button type="button" class="alr__modo" data-modo="pie" aria-pressed="' + (modo === 'pie') + '">A pie</button></div>';
      }
      html += '<p class="alr__f-cifras"><b>' + kmS(c.km) + ' km</b><span>' + minTxt(c.minutos) + (modo === 'pie' ? ' andando' : ' en coche') + '</span></p>';
      var via = [];
      if (modo === 'coche' && c.carreteras && c.carreteras.length) via.push('Por ' + c.carreteras.join(', '));
      via.push(coma(r.recta_km) + ' km en línea recta');
      html += '<p class="alr__f-via">' + esc(via.join(' · ')) + '</p>';
      if (s) {
        html += '<div class="alr__perfil">' +
          '<p class="alr__p-tit">' + esc(s.nombre) + (s.ref ? ' <small>' + esc(s.ref) + '</small>' : '') + '</p>' +
          '<p class="alr__p-datos"><span><b>' + coma(s.largo_m / 1000) + ' km</b> de sendero</span><span><b>+' + s.sube_m + ' m</b> de subida</span><span><b>−' + s.baja_m + ' m</b> de bajada</span><span>de ' + s.cota_min + ' a ' + s.cota_max + ' m</span></p>' +
          '<div class="alr__p-graf"><svg class="alr__p-svg" viewBox="0 0 600 150" preserveAspectRatio="none" role="slider" tabindex="0" aria-label="Perfil de desnivel del sendero: recórrelo con las flechas" aria-valuemin="0" aria-valuemax="' + s.largo_m + '" aria-valuenow="0" aria-valuetext=""></svg>' +
          '<p class="alr__p-lectura" aria-hidden="true"></p></div>' +
          (D.suWeb[id] ? '<p class="alr__p-web">' + esc(D.suWeb[id]) + '</p>' : '') +
          '<p class="alr__p-fuente">Trazado de OpenStreetMap (' + esc(s.osm) + '); alturas del MDT05 del IGN.</p></div>';
      }
      html += '<p class="alr__f-acciones"><a class="alr__f-enlace" href="' + esc(gmaps(r, modo)) + '" target="_blank" rel="noopener">Abrir en Google Maps<span class="alr__sr"> (se abre en otra pestaña)</span></a></p>';
      ficha.innerHTML = html;
      ficha.hidden = false;
      [].forEach.call(ficha.querySelectorAll('.alr__modo'), function (b) { b.addEventListener('click', function () { if (estado.modo !== b.dataset.modo) { estado.modo = b.dataset.modo; elegir(id, { conservarModo: true, foco: b.dataset.modo }); } }); });
      if (s) montarPerfil(s);
      return { modo: modo, dm: dm };
    }

    /* ---------- el perfil de desnivel ---------- */
    function montarPerfil(s) {
      var p = s.perfil, sv = ficha.querySelector('.alr__p-svg'), lect = ficha.querySelector('.alr__p-lectura');
      var L = s.largo_m || 1, h0 = s.cota_min - 10, h1 = s.cota_max + 10;
      var X = function (d) { return (d / L * 600).toFixed(1); }, Y = function (h) { return (142 - (h - h0) / (h1 - h0) * 122).toFixed(1); };
      var linea = p.map(function (a, i) { return (i ? 'L' : 'M') + X(a[0]) + ' ' + Y(a[1]); }).join('');
      sv.innerHTML = '<path class="alr__p-area" d="' + linea + 'L600 150L0 150Z"/><path class="alr__p-linea" d="' + linea + '"/>' +
        '<line class="alr__p-cursor" x1="0" x2="0" y1="0" y2="150"/><circle class="alr__p-punto" r="5" cx="0" cy="0"/>';
      var cur = sv.querySelector('.alr__p-cursor'), pun = sv.querySelector('.alr__p-punto');
      if (!puntoPerfil) { puntoPerfil = document.createElement('div'); puntoPerfil.className = 'alr__punto-perfil'; capa.appendChild(puntoPerfil); }
      function ir(d) {
        d = lim(d, 0, L);
        var k = 0; while (k < p.length - 1 && p[k + 1][0] < d) k++;
        var a = p[k], b = p[Math.min(p.length - 1, k + 1)], t = b[0] > a[0] ? (d - a[0]) / (b[0] - a[0]) : 0;
        var pt = [d, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
        estado.perfil = pt;
        cur.setAttribute('x1', X(d)); cur.setAttribute('x2', X(d)); pun.setAttribute('cx', X(d)); pun.setAttribute('cy', Y(pt[1]));
        var txt = distTxt(d) + ' desde la salida · ' + Math.round(pt[1]) + ' m de altitud';
        sv.setAttribute('aria-valuenow', String(Math.round(d))); sv.setAttribute('aria-valuetext', txt);
        lect.textContent = txt;
        puntoPerfil.hidden = false;
        ponVista(estado.vista);
      }
      var deX = function (e) { var r = sv.getBoundingClientRect(); return (e.clientX - r.left) / r.width * L; };
      sv.addEventListener('pointerdown', function (e) { ir(deX(e)); });
      sv.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse' || e.buttons || e.pressure > 0) ir(deX(e)); });
      sv.addEventListener('keydown', function (e) {
        var d = estado.perfil ? estado.perfil[0] : 0, paso = e.shiftKey ? 1000 : 100;
        var mapa = { ArrowRight: d + paso, ArrowUp: d + paso, ArrowLeft: d - paso, ArrowDown: d - paso, PageUp: d + 1000, PageDown: d - 1000, Home: 0, End: L };
        if (e.key in mapa) { e.preventDefault(); ir(mapa[e.key]); }
      });
      ir(0);
    }

    /* ---------- elegir un sitio ---------- */
    function elegir(id, op) {
      op = op || {};
      if (!D || !D.destinos[id]) return;
      var cambia = estado.sel !== id;
      estado.sel = id;
      if (!op.conservarModo && cambia) estado.modo = 'coche';
      botones.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.id === id)); b.closest('.alr__item').classList.toggle('es-elegido', b.dataset.id === id); });
      marcas.forEach(function (mk) { mk.el.classList.toggle('es-elegida', mk.id === id); });
      if (puntoPerfil) { puntoPerfil.hidden = true; }
      estado.perfil = null;
      // en el móvil, la ficha va debajo del sitio elegido; en grande, debajo del mapa
      var li = raiz.querySelector('.alr__item[data-id="' + id + '"]');
      if (estrecho.matches && li) li.appendChild(ficha); else if (ficha.parentNode !== vistaEl) vistaEl.appendChild(ficha);
      var fr = pintarFicha(), dm = fr.dm, modo = fr.modo, s = D.senderos[id];
      if (op.foco) { var bm = ficha.querySelector('.alr__modo[data-modo="' + op.foco + '"]'); if (bm) bm.focus(); }
      var tr = dm[modo];
      q('.alr__senderos').querySelectorAll('path').forEach(function (p) { p.classList.toggle('es-elegido', p.dataset.id === id); });
      // el camino: primero se vuela, luego se traza (con movimiento reducido, todo de golpe)
      rutaP.setAttribute('d', tr.d); rutaF.setAttribute('d', tr.d);
      rutaP.classList.toggle('alr__ruta--pie', modo === 'pie'); rutaF.classList.toggle('alr__ruta--pie', modo === 'pie');
      rutaP.classList.remove('se-traza'); rutaP.style.strokeDashoffset = reduce ? '0' : '1';
      var c = tr.caja.slice();
      if (s) { c = [Math.min(c[0], s.caja[0]), Math.min(c[1], s.caja[1]), Math.max(c[2], s.caja[2]), Math.max(c[3], s.caja[3])]; }
      estado.trazado = false;
      volarA(encaje(c), function () {
        if (estado.sel !== id) return;
        if (!reduce) { void rutaP.getBoundingClientRect(); rutaP.classList.add('se-traza'); rutaP.style.strokeDashoffset = '0'; }
        estado.trazado = true;
      });
    }

    /* ---------- datos y montaje ---------- */
    var pRutas = fetch(DATOS).then(function (r) { if (!r.ok) throw new Error('alrededor-mapa.json ' + r.status); return r.json(); });
    var listo = pRutas.then(function (m) {
      if (estado.destruido) return;
      D = m;
      // las cifras de la ficha salen del mismo HTML de respaldo (ya escritas desde rutas.json) más el JSON del mapa
      D.rutas = { destinos: {} };
      Object.keys(m.destinos).forEach(function (id) { D.rutas.destinos[id] = m.destinos[id].ficha; });
      var rel = m.relieve, img = q('.alr__relieve');
      img.setAttribute('href', RAIZ + rel.archivo);
      img.setAttribute('x', rel.caja[0]); img.setAttribute('y', rel.caja[1]); img.setAttribute('width', rel.caja[2] - rel.caja[0]); img.setAttribute('height', rel.caja[3] - rel.caja[1]);
      q('.alr__rios-grandes').setAttribute('d', m.riosGrandes); q('.alr__rios').setAttribute('d', m.riosCerca);
      q('.alr__vias--a').setAttribute('d', m.carreteras.a); q('.alr__vias--b').setAttribute('d', m.carreteras.b);
      q('.alr__senderos').innerHTML = Object.keys(m.senderos).map(function (k) { return m.senderos[k].trazos.map(function (d) { return '<path data-id="' + k + '" d="' + d + '"/>'; }).join(''); }).join('');
      // marcas: la casa y cada destino
      casaM = document.createElement('div'); casaM.className = 'alr__casa'; casaM.innerHTML = '<span>Casa Freixe</span>'; capa.appendChild(casaM);
      Object.keys(m.destinos).forEach(function (id) {
        var d = m.destinos[id], f = d.ficha, e = document.createElement('div');
        e.className = 'alr__marca' + (m.senderos[id] ? ' alr__marca--sendero' : '');
        e.innerHTML = '<span>' + esc(f.nombre) + '</span>';
        e.addEventListener('click', function () { elegir(id); });
        capa.appendChild(e);
        marcas.push({ id: id, x: d.x, y: d.y, el: e });
      });
      aldeas = m.aldeas.map(function (a) { var e = document.createElement('div'); e.className = 'alr__aldea' + (a.v ? ' alr__aldea--v' : ''); e.textContent = a.nombre; e.hidden = true; capa.appendChild(e); return { x: a.x, y: a.y, el: e }; });
      vistaEl.hidden = false;
      botones.forEach(function (b) { b.disabled = false; });
      ponVista(encaje([-1500, -1500, 4200, 6200], 1.1));
      estado.listo = true;
      el.dataset.montado = '1';
    });
    listo.catch(function (e) { console.warn('Alrededor: sin mapa', e); });

    botones.forEach(function (b) { escucha(b, 'click', function () { elegir(b.dataset.id); }); });
    var ro = new ResizeObserver(function () { if (estado.vista) ponVista(estado.vista); });
    ro.observe(mapaEl);
    escucha(estrecho, 'change', function () { if (estado.sel) elegir(estado.sel, { conservarModo: true }); });

    return {
      listo: listo,
      elegir: elegir,
      estado: function () { return { sel: estado.sel, modo: estado.modo, vista: estado.vista && estado.vista.slice(), perfil: estado.perfil && estado.perfil.slice(), listo: estado.listo, volando: !!estado.volando, trazado: !!estado.trazado, d: rutaP.getAttribute('d') || '' }; },
      destruir: function () {
        if (estado.destruido) return;
        estado.destruido = true; cancelAnimationFrame(vuelo); ro.disconnect();
        escuchas.forEach(function (f) { f(); });
        el.classList.remove('alr-mod'); delete el.dataset.montado;
        el.innerHTML = respaldo;
      },
    };
  }

  FX.alrededor = { montar: montar, interpVista: interpVista };
})();

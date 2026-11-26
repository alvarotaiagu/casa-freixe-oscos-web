/* ------------------------------------------------------------------
   Casa Freixe · «El punto de la i»: Freixe.portada y Freixe.pie (contrato: montar(el, op) → { destruir() })
   - El rótulo es SVG (construir.mjs) y se ve siempre: sin JS, con su copa verde de logo. Aquí se le pone encima un
     <canvas> con el fresno vivo (js/fresno.js) que NACE del palo de la i: el tronco sigue su trazo con su mismo grosor.
   - La copa, en escritorio, es la del logo algo mayor; en el móvil, donde el rótulo es pequeño, el árbol crece por
     encima de las letras (el tronco se alarga y, si hace falta, se inclina) para que se lea la hoja.
   - VIENTO: brisa de fondo + el puntero (la velocidad horizontal da la racha; cerca del puntero las hojas tiemblan
     más) + el dedo (deslizar en horizontal; el vertical sigue siendo scroll: touch-action: pan-y) + la inclinación del
     móvil, SOLO tras pulsar «Mover con el móvil» (en iOS pide permiso).
   - AL BAJAR caen hojas (o sámaras, en invierno) y bajan hacia el enlace «La casa». En la versión sobria no caen.
   - Movimiento reducido: el árbol de hoy, entero y quieto (es contenido, no adorno). Sin bucle.
   - Rendimiento: DPR con tope (2, y menos si el lienzo es muy grande), bucle parado fuera de pantalla o con la pestaña
     oculta, y BAJADA DE CALIDAD automática: si la media de 90 fotogramas pasa de 26 ms, baja la resolución del lienzo
     (dos veces como mucho). El LCP es la frase, que no espera a nada de esto.
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  const F = (window.Freixe = window.Freixe || {});
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const est = () => F.estacion || { nombre: 'verano', etiqueta: 'Verano', progreso: 0.5, fecha: null, fijada: false };
  const estTxt = () => { const e = est(); return e.etiqueta.toLowerCase() + (F.fresno ? ': ' + F.fresno.dice(e.nombre, e.progreso) : ''); };
  const caidasCompartidas = [];   // las hojas que cayeron en la portada, para el pie

  function textosEstacion() {
    const e = est();
    const t = document.getElementById('portada-estacion');
    if (t && F.fresno) {
      const f = e.fecha;
      const cuando = e.fijada ? `En ${e.etiqueta.toLowerCase()} (vista de prueba)` : (f ? `Hoy, ${f.dia} de ${MESES[f.mes - 1]}, en Barcia` : 'Hoy en Barcia');
      t.innerHTML = `<b>Freixe es fresno.</b> ${cuando}: ${F.fresno.dice(e.nombre, e.progreso)}.`;
    }
    document.querySelectorAll('[data-estacion-texto]').forEach((s) => { s.textContent = estTxt(); });
  }

  /* ================= la portada ================= */
  function montar(el, op) {
    if (!F.fresno) throw new Error('falta js/fresno.js');
    const seccion = el.closest('#portada');
    const svg = seccion.querySelector('#rotulo-portada');
    const guia = seccion.querySelector('#portada-guia');
    const btnInc = seccion.querySelector('#portada-inclinar');
    const movimiento = !!op.movimiento;
    const MAXC = op.densidad === 'sobria' || !movimiento ? 0 : 12;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    el.appendChild(canvas);
    const tinta = getComputedStyle(svg).color || '#1A1E21';
    const arbol = F.fresno.crear(canvas, { tinta: toHex(tinta) });
    const e = est();
    arbol.estacion(e.nombre, e.progreso);
    textosEstacion();

    let calidad = 1, geo = null, anchoVisto = 0, altoVisto = 0, dprVisto = 0, cada = 1, salto = 0;
    function colocar() {
      const r = seccion.getBoundingClientRect();
      const W = r.width, H = r.height;
      const sr = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const s = sr.width / vb.width;
      const px = (u, v) => [sr.left - r.left + (u - vb.x) * s, sr.top - r.top + (v - vb.y) * s];
      const [iu, iv] = svg.dataset.i.split(' ').map(Number);
      const [cu, cv, rxu, ryu] = svg.dataset.copa.split(' ').map(Number);
      const [bx, by] = px(iu, iv);
      const [cx0, cy0] = px(cu, cv);
      const arriba = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cabecera')) || 68) + 12;
      let rx, ry, cx, cy;
      if (W >= 760) {
        // la copa del logo algo mayor; si sobra alto (tableta en vertical), más grande, hasta 2,3 veces
        const ry0 = ryu * s, rySitio = (by - arriba - 14) / 1.81;
        ry = Math.min(Math.max(ry0 * 1.38, Math.min(rySitio * 0.8, ry0 * 2.3)), Math.max(ry0, rySitio * 1.05));
        rx = ry * (rxu / ryu);
        cy = cy0 - (ry - ry0) * 0.85;
        if (cy - ry * 1.12 < arriba) { const k = (by - arriba) / (ry * 1.12 + (by - cy)); rx *= Math.min(1, k); ry *= Math.min(1, k); cy = arriba + ry * 1.12; }
      } else {
        rx = Math.min(W * 0.41, 200); ry = rx * 0.9;
        let cyMax = by - ry * 0.55 - Math.max(14, ry * 0.14);
        const cyMin = arriba + ry * 1.12;
        if (cyMin > cyMax) { ry = Math.max(40, (by - arriba - 14) / 1.81); rx = ry / 0.9; cyMax = by - ry * 0.55 - 14; }
        cy = Math.max(arriba + ry * 1.12, cyMax);
      }
      cx = clamp(cx0, rx * 1.08 + 8, W - rx * 1.08 - 8);
      const gr = guia ? guia.getBoundingClientRect() : null;
      const visibleGuia = gr && gr.width > 0;
      let dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (W * H * dpr * dpr > 3.4e6) dpr = Math.max(1, Math.sqrt(3.4e6 / (W * H)));
      dpr = Math.max(1, dpr * calidad);                     // nunca por debajo de 1: se vería borroso
      const nuevo = { base: { x: bx, y: by }, copa: { cx, cy, rx, ry }, ancho: 5.5 * s, guia: visibleGuia ? { x: gr.left - r.left + gr.width / 2, y: gr.top - r.top + 6 } : { x: cx, y: H - 30 }, ancho_lienzo: W, alto_lienzo: H };
      // si nada ha cambiado (p. ej. al llegar las letras), no se rehace el árbol
      const igual = geo && dprVisto === dpr && Math.abs(geo.base.x - nuevo.base.x) < 0.5 && Math.abs(geo.base.y - nuevo.base.y) < 0.5 && Math.abs(geo.copa.rx - nuevo.copa.rx) < 0.5 && Math.abs(geo.ancho_lienzo - nuevo.ancho_lienzo) < 0.5 && Math.abs(geo.alto_lienzo - nuevo.alto_lienzo) < 0.5;
      anchoVisto = innerWidth; altoVisto = innerHeight;
      if (igual) return false;
      geo = nuevo; dprVisto = dpr;
      arbol.colocar(geo, dpr);
      return true;
    }

    // ---------- viento ----------
    let racha = 0, inclinacion = 0, puntero = null, ultimo = null;
    const alMover = (ev) => {
      const r = seccion.getBoundingClientRect();
      const x = ev.clientX - r.left, y = ev.clientY - r.top, t = ev.timeStamp;
      if (ultimo) {
        const dt = Math.max(8, t - ultimo.t), dx = x - ultimo.x;
        racha = clamp(racha + clamp((dx / Math.max(320, r.width)) * 7, -0.9, 0.9), -2.2, 2.2);
        const v = Math.hypot(dx, y - ultimo.y) / dt;               // px/ms
        puntero = { x, y, v: clamp(Math.max(puntero ? puntero.v : 0, v / 1.1), 0, 1) };
      }
      ultimo = { x, y, t };
    };
    const alSalir = () => { ultimo = null; };
    if (movimiento) {
      seccion.addEventListener('pointermove', alMover, { passive: true });
      seccion.addEventListener('pointerleave', alSalir);
      seccion.addEventListener('pointercancel', alSalir);
      seccion.addEventListener('pointerup', alSalir);
    }
    // la inclinación del móvil: solo si se pide (botón), y con permiso donde lo hay (iOS)
    const alInclinar = (ev) => { if (ev.gamma != null) inclinacion = clamp(ev.gamma / 28, -1.6, 1.6); };
    let inclinando = false;
    const conInclinacion = movimiento && btnInc && 'DeviceOrientationEvent' in window && matchMedia('(pointer: coarse)').matches;
    const alBoton = async () => {
      if (inclinando) { removeEventListener('deviceorientation', alInclinar); inclinando = false; inclinacion = 0; btnInc.setAttribute('aria-pressed', 'false'); return; }
      try {
        const D = window.DeviceOrientationEvent;
        if (D && typeof D.requestPermission === 'function') { const r = await D.requestPermission(); if (r !== 'granted') return; }
        addEventListener('deviceorientation', alInclinar);
        inclinando = true; btnInc.setAttribute('aria-pressed', 'true');
      } catch (er) { console.warn('Sin inclinación:', er); }
    };
    if (conInclinacion) { btnInc.hidden = false; btnInc.setAttribute('aria-pressed', 'false'); btnInc.addEventListener('click', alBoton); }

    // ---------- el bucle ----------
    let raf = 0, enVista = true, t0 = performance.now(), tPrev = 0, crecerDesde = 0;
    let soltadas = 0, porRacha = 0;
    const muestras = [], ultimasMs = []; let bajadas = 0;
    const brisa = (t) => 0.1 + 0.2 * Math.sin(t * 0.53) + 0.11 * Math.sin(t * 1.31 + 1.1) + 0.06 * Math.sin(t * 2.9 + 0.3);
    function fotograma(ahora) {
      raf = 0;
      if (cada > 1 && (salto = (salto + 1) % cada) !== 0) { if (enVista && !document.hidden) raf = requestAnimationFrame(fotograma); return; }
      const t = (ahora - t0) / 1000, dt = Math.min(0.05, tPrev ? (ahora - tPrev) / 1000 : 0.016);
      tPrev = ahora;
      racha *= Math.exp(-dt / 0.9);
      if (puntero) { puntero.v *= Math.exp(-dt / 0.35); if (puntero.v < 0.01) puntero = null; }
      arbol.puntero = puntero;
      if (arbol.crecido < 1) arbol.crecido = clamp((ahora - crecerDesde) / 2300, 0, 1);
      // al bajar: caen hojas, de una en una, según lo que se ha bajado por la portada
      if (MAXC && arbol.crecido >= 1) {
        const r = seccion.getBoundingClientRect();
        const prog = clamp(-r.top / (r.height * 0.75), 0, 1);
        const objetivo = Math.round(prog * MAXC);
        let n = 0;
        while (soltadas < objetivo && n < 2) { arbol.soltar(1); soltadas++; n++; }
        if (est().nombre === 'otono' && Math.abs(racha) > 1 && porRacha < 6 && Math.random() < dt * 1.4) { arbol.soltar(1); porRacha++; }
      }
      arbol.dibujar(t, dt, brisa(t) + racha + inclinacion);
      // calidad: media de 90 fotogramas
      muestras.push(dt * 1000); ultimasMs.push(dt * 1000); if (ultimasMs.length > 240) ultimasMs.shift();
      if (muestras.length >= 90) {
        const media = muestras.reduce((a, b) => a + b, 0) / muestras.length;
        muestras.length = 0;
        // primero menos resolución (sin bajar de DPR 1); si no basta, 30 fotogramas por segundo
        if (media > 26 * cada && bajadas < 2 && !document.hidden) {
          bajadas++;
          const antes = calidad; calidad *= 0.72;
          if (!colocar()) { calidad = antes; cada = 2; }
        }
      }
      if (enVista && !document.hidden) raf = requestAnimationFrame(fotograma);
    }
    const arrancar = () => { if (movimiento && !raf && enVista && !document.hidden) { tPrev = 0; raf = requestAnimationFrame(fotograma); } };
    const parar = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
    const quieto = () => { arbol.crecido = 1; arbol.dibujar(0, 0.016, 0); };

    colocar();
    if (movimiento) {
      arbol.crecido = 0;
      // que el árbol empiece cuando el palo de la i ya ha crecido (la entrada CSS dura ~1,9 s desde que se pinta)
      crecerDesde = Math.max(performance.now() + 150, 1700);
      arrancar();
    } else quieto();
    seccion.classList.add('es-viva');

    const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => { enVista = es[0].isIntersecting; if (enVista) arrancar(); else parar(); }) : null;
    if (io) io.observe(seccion);
    const alVisib = () => { if (document.hidden) parar(); else arrancar(); };
    document.addEventListener('visibilitychange', alVisib);
    // resize de verdad (no el de la barra del móvil): se vuelve a colocar
    let tRes = 0;
    const alResize = () => {
      if (innerWidth === anchoVisto && Math.abs(innerHeight - altoVisto) < 160) return;
      clearTimeout(tRes);
      tRes = setTimeout(() => { colocar(); if (!movimiento) quieto(); }, 180);
    };
    addEventListener('resize', alResize);
    // las letras cambian la altura del bloque de abajo, y con él dónde cae el rótulo
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!geo) return; if (colocar() && !movimiento) quieto(); });

    const inst = {
      estado: () => Object.assign(arbol.estado(), { geo, calidad, cada, bajadas, soltadas, movimiento, enMarcha: !!raf, crecido: arbol.crecido, racha, inclinacion, muestrasMs: ultimasMs.slice() }),
      arbol,
      destruir() {
        parar(); if (io) io.disconnect();
        document.removeEventListener('visibilitychange', alVisib);
        removeEventListener('resize', alResize);
        removeEventListener('deviceorientation', alInclinar);
        seccion.removeEventListener('pointermove', alMover);
        seccion.removeEventListener('pointerleave', alSalir);
        seccion.removeEventListener('pointercancel', alSalir);
        seccion.removeEventListener('pointerup', alSalir);
        if (btnInc) { btnInc.removeEventListener('click', alBoton); btnInc.hidden = true; }
        caidasCompartidas.length = 0; caidasCompartidas.push(...arbol.suelo);
        arbol.destruir(); canvas.remove(); seccion.classList.remove('es-viva');
      },
    };
    F.portada.actual = inst;
    return inst;
  }
  function toHex(c) {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
    return m ? '#' + [m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, '0')).join('') : (/^#[0-9a-f]{6}$/i.test(c) ? c : '#1A1E21');
  }

  /* ================= el pie: el mismo rótulo con el árbol entero de hoy y, al pie, lo que cayó ================= */
  function montarPie(el, op) {
    if (!F.fresno) throw new Error('falta js/fresno.js');
    const svg = el.querySelector('.rotulo--pie');
    const txt = el.querySelector('#pie-txt');
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    el.appendChild(canvas);
    const arbol = F.fresno.crear(canvas, { tinta: toHex(getComputedStyle(svg).color), semilla: 20261126 });
    const e = est();
    arbol.estacion(e.nombre, e.progreso);
    function pintar() {
      const fr = el.getBoundingClientRect(), sr = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal, s = sr.width / vb.width;
      const m = 24;
      const W = sr.width + 2 * m, H = sr.height + 2 * m;
      canvas.style.left = (sr.left - fr.left - m) + 'px'; canvas.style.top = (sr.top - fr.top - m) + 'px';
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      const px = (u, v) => [m + (u - vb.x) * s, m + (v - vb.y) * s];
      const [iu, iv] = svg.dataset.i ? svg.dataset.i.split(' ').map(Number) : [554.75, -88];
      const [cu, cv, rxu, ryu] = svg.dataset.copa ? svg.dataset.copa.split(' ').map(Number) : [554.75, -120, 66, 60];
      const [bx, by] = px(iu, iv), [cx, cy] = px(cu, cv);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      arbol.colocar({ base: { x: bx, y: by }, copa: { cx, cy: cy - ryu * s * 0.12, rx: rxu * s * 1.12, ry: ryu * s * 1.12 }, ancho: 5.5 * s, guia: null, ancho_lienzo: W, alto_lienzo: H }, dpr);
      arbol.crecido = 1;
      arbol.dibujar(0, 0.016, 0);
      // lo que cayó mientras bajabas, en el suelo (justo bajo la línea base, al pie del tronco)
      const portada = F.portada.actual;
      const suelo = portada && portada.arbol ? portada.arbol.suelo : caidasCompartidas;
      const ctx = canvas.getContext('2d');
      const [x0, y0] = px(iu, 0);
      const n = Math.min(suelo.length, 14);
      for (let i = 0; i < n; i++) {
        const c = suelo[i], k = i - (n - 1) / 2;
        const x = x0 + k * 9 * s * 1.6 + Math.sin(i * 2.3) * 4 * s, y = y0 + (12 + Math.abs(Math.sin(i * 1.7)) * 10) * s;
        const a = Math.PI / 2 + Math.sin(i * 3.1) * 0.5, esc = c.esc * 0.42 * (s / 1.2);
        const co = Math.cos(a) * esc * dpr, si = Math.sin(a) * esc * dpr;
        ctx.setTransform(co, si, -si, co, x * dpr, y * dpr);
        ctx.drawImage(c.img.c, -c.img.ox, -c.img.oy, c.img.w, c.img.h);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      el.classList.add('es-vivo');
      if (txt) txt.textContent = `Freixe es fresno. El árbol del rótulo, como está hoy en Barcia: ${estTxt()}.` + (n ? ` Al pie, ${n === 1 ? 'la hoja que cayó' : 'las hojas que cayeron'} mientras bajabas.` : '');
      return n;
    }
    let n = pintar();
    // se vuelve a pintar cada vez que el pie entra en pantalla (por si han caído más) y al cambiar el ancho
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => { if (es[0].isIntersecting) n = pintar(); }) : null;
    if (io) io.observe(el);
    let ancho = innerWidth, tRes = 0;
    const alResize = () => { if (innerWidth === ancho) return; ancho = innerWidth; clearTimeout(tRes); tRes = setTimeout(pintar, 200); };
    addEventListener('resize', alResize);
    return {
      estado: () => Object.assign(arbol.estado(), { enSuelo: n }),
      destruir() { if (io) io.disconnect(); removeEventListener('resize', alResize); arbol.destruir(); canvas.remove(); el.classList.remove('es-vivo'); },
    };
  }

  F.portada = { montar, textos: textosEstacion, actual: null };
  F.pie = { montar: montarPie };
  // las ramitas de la estación (La casa) y los textos, en cuanto se puede
  F.ramitas = function () {
    if (!F.fresno) return;
    const e = est();
    document.querySelectorAll('canvas[data-ramita="hoy"]').forEach((c) => F.fresno.ramita(c, e.nombre, e.progreso));
  };
})();

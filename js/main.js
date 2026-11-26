/* ------------------------------------------------------------------
   Casa Freixe · lo común de la página (receta de ../apartamentos-alba-somiedo-web/js/main.js)
   - Monta los módulos con su respaldo: la portada al cargar; el pie, el 3D (Freixe.lugar, de Lugar), Alrededor
     (Freixe.alrededor, de Lugar) y el simulador al acercarse (IntersectionObserver, 900 px). Contrato:
     Freixe.<mod>.montar(el, { movimiento, densidad, webgl, estacion }) → { destruir() }. Si un módulo falla (o su
     promesa «listo» se rechaza), vuelve su respaldo.
   - Cabecera (con IntersectionObserver, sin escuchar el scroll), menú móvil, contenedores que desbordan (foco solo si
     desbordan), galería por estancias, visor por NOMBRE de archivo, mapa a petición, cookies, el foco con el folíolo
     del fresno y el mando de maqueta (bloque 12; no viaja al cliente).
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const raiz = document.documentElement;
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = !quieto;
  const sobria = () => raiz.classList.contains('densidad-sobria');
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const F = (window.Freixe = window.Freixe || {});
  const anno = $('#anno');
  if (anno) anno.textContent = new Date().getFullYear();

  // el resize de la barra del móvil (mismo ancho, poca altura) no rehace NADA (checklist punto 10)
  let anchoVista = innerWidth, altoVista = innerHeight;
  const esBarra = () => innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160;

  /* ============ 1. la estación: textos y ramitas ============ */
  if (F.portada && F.portada.textos) F.portada.textos();
  if (F.ramitas) F.ramitas();

  /* ============ 2. ir a un sitio ============ */
  const cabAlto = () => parseFloat(getComputedStyle(raiz).getPropertyValue('--cabecera')) || 68;
  const irA = (sel) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) return;
    const margen = Math.max(cabAlto() + 8, parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
    const y = el.getBoundingClientRect().top + scrollY - margen;
    scrollTo({ top: Math.max(0, y), behavior: quieto ? 'auto' : 'smooth' });
  };

  /* ============ 3. cabecera: fondo al bajar, el rótulo pequeño y el enlace de la sección que se ve ============ */
  const cab = $('#cab');
  const portada = $('#portada');
  const rotuloGrande = $('#rotulo-portada');
  if ('IntersectionObserver' in window) {
    const testigo = document.createElement('div');
    testigo.setAttribute('aria-hidden', 'true');
    testigo.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:24px;pointer-events:none';
    document.body.prepend(testigo);
    new IntersectionObserver((es) => cab.classList.toggle('sc', !es[0].isIntersecting)).observe(testigo);
    if (rotuloGrande) new IntersectionObserver((es) => raiz.classList.toggle('portada-arriba', es[0].isIntersecting), { rootMargin: `-${cabAlto()}px 0px 0px 0px` }).observe(rotuloGrande);
    const enlaces = $$('.cab__nav a');
    const secs = enlaces.map((a) => $(a.getAttribute('href'))).filter(Boolean);
    const vistas = new Map();
    const ioNav = new IntersectionObserver((es) => {
      es.forEach((e) => vistas.set(e.target.id, e.isIntersecting));
      const actual = secs.find((s) => vistas.get(s.id));
      enlaces.forEach((a) => { if (actual && a.getAttribute('href') === '#' + actual.id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    }, { rootMargin: '-30% 0px -60% 0px' });
    secs.forEach((s) => ioNav.observe(s));
  }

  /* ============ 4. módulos ============ */
  const montados = new Map();
  const esperando = new Set();
  const modulo = (el) => { const m = F[el.dataset.modulo]; return m && typeof m.montar === 'function' ? m : null; };
  const opciones = () => ({ movimiento: motion, densidad: sobria() ? 'sobria' : 'fresno', webgl: !raiz.classList.contains('sin-webgl'), estacion: F.estacion || null });
  function montarModulo(el) {
    if (montados.has(el)) return;
    const mod = modulo(el);
    if (!mod) { esperando.add(el); if (document.readyState === 'complete') el.classList.add('sin-modulo'); return; }
    esperando.delete(el);
    el.classList.remove('sin-modulo');
    const respaldo = el.innerHTML;
    try {
      const inst = mod.montar(el, opciones());
      montados.set(el, { inst, respaldo });
      if (inst && inst.listo && typeof inst.listo.catch === 'function') inst.listo.catch((er) => { console.warn('Módulo ' + el.dataset.modulo + ': se queda el respaldo', er); try { inst.destruir && inst.destruir(); } catch (e) { /* nada */ } el.innerHTML = respaldo; delete el.dataset.montado; el.classList.add('sin-modulo'); });
    } catch (er) {
      console.warn('Módulo ' + el.dataset.modulo + ': se queda el respaldo', er);
      el.innerHTML = respaldo;
      el.classList.add('sin-modulo');
      montados.set(el, { inst: null, respaldo });
    }
  }
  const reintentar = () => { if (esperando.size) [...esperando].forEach(montarModulo); esperando.forEach((el) => el.classList.add('sin-modulo')); };
  addEventListener('load', reintentar);
  function remontarTodos() {
    [...montados].forEach(([el, { inst, respaldo }]) => {
      try { inst && inst.destruir && inst.destruir(); } catch (er) { console.warn(er); }
      el.innerHTML = respaldo;
      el.classList.remove('sin-modulo', 'es-montado');
      delete el.dataset.montado;
      montados.delete(el);
      montarModulo(el);
    });
  }
  const portadaMod = $('#portada [data-modulo="portada"]');
  if (portadaMod) montarModulo(portadaMod);
  const resto = $$('[data-modulo]').filter((el) => el !== portadaMod);
  if ('IntersectionObserver' in window) {
    const ioMod = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { ioMod.unobserve(e.target); montarModulo(e.target); }
    }), { rootMargin: '900px 0px' });
    resto.forEach((el) => ioMod.observe(el));
  } else resto.forEach(montarModulo);
  const deModulo = (t) => !!t.closest('[data-modulo="lugar"][data-montado], [data-modulo="alrededor"][data-montado]');

  /* ============ 5. menú ============ */
  const btnMenu = $('#menu-btn'), menu = $('#menu-movil');
  const cerrarMenu = () => {
    document.body.classList.remove('menu');
    btnMenu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
  };
  btnMenu.addEventListener('click', () => {
    const abierto = document.body.classList.toggle('menu');
    btnMenu.setAttribute('aria-expanded', String(abierto));
    menu.setAttribute('aria-hidden', String(!abierto));
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu')) { cerrarMenu(); btnMenu.focus(); } });

  /* ============ 6. enlaces internos y «Ver fechas» de cada apartamento ============ */
  F.reservar = function (unidad) {
    if (unidad && F.reserva && F.reserva.unidad) F.reserva.unidad(unidad);
    else if (unidad) F.reservaPendiente = unidad;
    cerrarMenu();
    irA('#reservar');
  };
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || deModulo(e.target)) return;
    const r = e.target.closest('[data-reservar]');
    if (r) { e.preventDefault(); F.reservar(r.getAttribute('data-reservar')); return; }
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const destino = a.getAttribute('href');
    if (destino.length < 2 || !$(destino)) return;
    e.preventDefault();
    cerrarMenu();
    irA(destino);
    setTimeout(() => {
      const t = $(destino);
      if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
    }, quieto ? 50 : 900);
  });

  /* ============ 7. contenedores que desbordan en horizontal: foco SOLO si desbordan (PLIEGO §5) ============ */
  const desbordables = $$('.apto__fotos, .vistazo__caja');
  const mirarDesborde = () => desbordables.forEach((c) => { if (c.scrollWidth > c.clientWidth + 2) c.setAttribute('tabindex', '0'); else c.removeAttribute('tabindex'); });
  mirarDesborde();
  addEventListener('load', mirarDesborde);

  /* ============ 7 bis. la galería: el índice marca la estancia que se ve (contenido: también con movimiento reducido) ============ */
  const indice = $$('.estancias__indice a');
  if (indice.length && 'IntersectionObserver' in window) {
    const marcar = (id) => indice.forEach((a) => { if (a.dataset.est === id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    const ioEst = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) marcar(e.target.id.replace('est-', '')); }), { rootMargin: '-35% 0px -60% 0px' });
    $$('.estancia').forEach((s) => ioEst.observe(s));
  }

  /* ============ 7 ter. el visor: abre por el NOMBRE del archivo (checklist 11); nunca más grande que la foto ============ */
  const visor = $('#visor');
  const vImg = $('#visor-img'), vPie = $('#visor-pie'), vN = $('#visor-n');
  let serie = [], vAct = 0, vOrigen = null;
  const infoFoto = (b) => ({ n: b.dataset.visor, alt: (b.querySelector('img') || {}).alt || '', anchos: (b.dataset.anchos || '800').split(',').map(Number), ancho: +b.dataset.ancho || 800, alto: +b.dataset.alto || 530 });
  function ponerFoto(i) {
    vAct = (i + serie.length) % serie.length;
    const f = serie[vAct];
    const peq = f.anchos[0], gran = f.anchos[f.anchos.length - 1];
    vImg.src = `img/fotos/${f.n}-${peq}.webp`;
    vImg.dataset.nombre = f.n;
    vImg.alt = f.alt;
    vImg.width = f.ancho; vImg.height = f.alto;
    vImg.style.setProperty('--max', f.ancho + 'px');
    if (gran !== peq) {
      const g = new Image();
      g.onload = () => { if (vImg.dataset.nombre === f.n) vImg.src = g.src; };
      g.src = `img/fotos/${f.n}-${gran}.webp`;
    }
    vPie.textContent = f.alt;
    vN.textContent = (vAct + 1) + ' / ' + serie.length;
  }
  function abrirVisor(b) {
    if (!visor || typeof visor.showModal !== 'function') return false;
    const g = b.dataset.grupo;
    const vistos = new Set();
    serie = (g ? $$('[data-visor][data-grupo="' + g + '"]') : [b]).map(infoFoto).filter((f) => !vistos.has(f.n) && vistos.add(f.n));
    const i = serie.findIndex((f) => f.n === b.dataset.visor);
    vOrigen = b;
    ponerFoto(i < 0 ? 0 : i);
    if (!visor.open) visor.showModal();
    return true;
  }
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;
    const b = e.target.closest('[data-visor]');
    if (!b) return;
    if (abrirVisor(b)) e.preventDefault();
  });
  if (visor) {
    $('#visor-ant').addEventListener('click', () => ponerFoto(vAct - 1));
    $('#visor-sig').addEventListener('click', () => ponerFoto(vAct + 1));
    $('#visor-cerrar').addEventListener('click', () => visor.close());
    visor.addEventListener('click', (e) => { if (e.target === visor || e.target.classList.contains('visor__fig')) visor.close(); });
    visor.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') ponerFoto(vAct - 1); else if (e.key === 'ArrowRight') ponerFoto(vAct + 1); });
    visor.addEventListener('close', () => { if (vOrigen && document.contains(vOrigen)) vOrigen.focus({ preventScroll: true }); });
    let x0 = null;
    vImg.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    vImg.addEventListener('pointerup', (e) => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 50) ponerFoto(vAct + (dx < 0 ? 1 : -1)); });
    vImg.addEventListener('pointercancel', () => { x0 = null; });
  }
  F.visor = { abrir: abrirVisor };

  /* ============ 8. cookies (y el mando se aparta mientras están) ============ */
  const ck = $('#cookies');
  const LLAVE = 'freixe-cookies';
  const leer = () => { try { return localStorage.getItem(LLAVE); } catch (e) { return null; } };
  const guardar = (v) => { try { localStorage.setItem(LLAVE, v); } catch (e) { /* sin almacenamiento */ } };
  let verMando = () => {};
  const cerrarCk = (v) => { guardar(v); ck.hidden = true; verMando(); };
  $('#ck-si').addEventListener('click', () => cerrarCk('si'));
  $('#ck-no').addEventListener('click', () => cerrarCk('no'));
  $('#abrir-cookies').addEventListener('click', () => { ck.hidden = false; verMando(); $('#ck-si').focus(); });
  if (!leer()) ck.hidden = false;

  /* ============ 9. mapa de Google solo al pedirlo (sin clave de API) ============ */
  const mapaBtn = $('#mapa-btn');
  if (mapaBtn) mapaBtn.addEventListener('click', () => {
    const marco = document.createElement('iframe');
    marco.src = 'https://www.google.com/maps?q=' + encodeURIComponent($('#mapa').dataset.q) + '&z=15&output=embed';
    marco.loading = 'lazy';
    marco.title = 'Mapa con Barcia (Santa Eulalia de Oscos) y Casa Freixe';
    marco.referrerPolicy = 'no-referrer-when-downgrade';
    $('#mapa').appendChild(marco);
    mapaBtn.remove();
  });

  /* ============ 10. el foco del teclado: contorno redondeado + un folíolo dentado del fresno en la esquina ============ */
  const marco = $('#foco-hoja');
  const marcoPath = marco && marco.querySelector('.foco-hoja__marco');
  const hojaPath = marco && marco.querySelector('.foco-hoja__hoja');
  if (marco) raiz.classList.add('foco-propio');
  let enfocado = null;
  function ponerMarco() {
    if (!marco) return;
    const el = enfocado;
    if (!el || !document.contains(el)) { marco.classList.remove('es-visible'); return; }
    const r = el.getBoundingClientRect();
    if (!r.width) { marco.classList.remove('es-visible'); return; }
    let fijo = false;
    for (let e = el; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') { fijo = true; break; }
    const m = 5, w = Math.round(r.width + 2 * m), h = Math.round(r.height + 2 * m);
    const rad = Math.min(14, h / 2);
    marco.classList.toggle('es-fijo', fijo);
    marco.style.left = (r.left - m + (fijo ? 0 : scrollX)) + 'px';
    marco.style.top = (r.top - m + (fijo ? 0 : scrollY)) + 'px';
    marco.style.width = w + 'px'; marco.style.height = h + 'px';
    marco.setAttribute('viewBox', `0 0 ${w} ${h}`);
    marcoPath.setAttribute('d', `M${rad} 1H${w - rad}A${rad - 1} ${rad - 1} 0 0 1 ${w - 1} ${rad}V${h - rad}A${rad - 1} ${rad - 1} 0 0 1 ${w - rad} ${h - 1}H${rad}A${rad - 1} ${rad - 1} 0 0 1 1 ${h - rad}V${rad}A${rad - 1} ${rad - 1} 0 0 1 ${rad} 1Z`);
    // el folíolo: lanceolado y aserrado, saliendo de la esquina de arriba a la derecha
    const x0 = w - Math.max(8, rad * 0.6), y0 = 1, L = 15, A = -0.75;
    const pts = [];
    for (let i = 0; i <= 10; i++) { const u = i / 10, half = 3.2 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 0.8) * (u > 0.15 && u < 0.9 ? 1 + 0.2 * ((u * 5) % 1) : 1); pts.push([u * L, -half]); }
    for (let i = 9; i >= 1; i--) { const u = i / 10, half = 3.2 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 0.8) * (u > 0.15 && u < 0.9 ? 1 + 0.2 * ((u * 5) % 1) : 1); pts.push([u * L, half]); }
    const c = Math.cos(A), s = Math.sin(A);
    hojaPath.setAttribute('d', 'M' + pts.map(([x, y]) => `${(x0 + x * c - y * s).toFixed(1)} ${(y0 + x * s + y * c).toFixed(1)}`).join('L') + 'Z');
    const oscuro = el.closest('#lugar, .cookies');
    marco.style.setProperty('--foco-fondo', oscuro ? '#1D2326' : 'var(--fondo)');
    marco.style.color = oscuro ? (el.closest('.cookies') ? '#F1E3A6' : 'var(--acento-claro)') : '';
    marco.classList.add('es-visible');
  }
  let tFoco = 0;
  const mirarFoco = () => {
    clearTimeout(tFoco);
    tFoco = setTimeout(() => {
      const el = document.activeElement;
      let visible = false;
      try { visible = !!el && el !== document.body && el.matches(':focus-visible') && !el.closest('dialog'); } catch (er) { /* navegador viejo */ }
      enfocado = visible ? el : null;
      ponerMarco();
    }, 0);
  };
  document.addEventListener('focusin', mirarFoco);
  document.addEventListener('focusout', mirarFoco);
  // si el elemento enfocado vive en algo fijo, el marco se recoloca al desplazarse (solo entonces)
  addEventListener('scroll', () => { if (enfocado && marco && marco.classList.contains('es-fijo')) ponerMarco(); }, { passive: true });

  /* ============ 12. MANDO DE MAQUETA (no viaja al cliente) ============ */
  const mando = $('#mando');
  if (mando && raiz.classList.contains('revision')) {
    verMando = () => { mando.hidden = !ck.hidden; };
    const botones = $$('button[data-densidad]', mando);
    const pintarMando = () => botones.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.densidad === 'sobria') === sobria())));
    botones.forEach((b) => b.addEventListener('click', () => {
      const antes = sobria();
      raiz.classList.toggle('densidad-sobria', b.dataset.densidad === 'sobria');
      const u = new URL(location.href);
      if (b.dataset.densidad === 'sobria') u.searchParams.set('densidad', 'sobria'); else u.searchParams.delete('densidad');
      history.replaceState(null, '', u);
      pintarMando();
      if (antes === sobria()) return;
      remontarTodos();
      document.dispatchEvent(new CustomEvent('freixe:densidad', { detail: sobria() ? 'sobria' : 'fresno' }));
    }));
    // la estación: recarga con ?estacion= (el acento y el árbol se deciden antes de pintar, en js/estacion.js)
    const actualEst = new URLSearchParams(location.search).get('estacion') || 'hoy';
    $$('button[data-estacion]', mando).forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.estacion === actualEst));
      b.addEventListener('click', () => {
        const u = new URL(location.href);
        if (b.dataset.estacion === 'hoy') u.searchParams.delete('estacion'); else u.searchParams.set('estacion', b.dataset.estacion);
        location.href = u.toString();
      });
    });
    pintarMando();
    verMando();
  }
  /* fin del MANDO DE MAQUETA */

  /* ============ 13. resize de verdad (no el de la barra del móvil) ============ */
  let tRes = 0;
  addEventListener('resize', () => {
    if (esBarra()) return;
    clearTimeout(tRes);
    tRes = setTimeout(() => {
      anchoVista = innerWidth; altoVista = innerHeight;
      document.dispatchEvent(new CustomEvent('freixe:resize'));
      mirarDesborde();
      ponerMarco();
      if (F.ramitas) F.ramitas();
    }, 200);
  });

  // recargar a media página: se entra arriba (checklist 12)
  addEventListener('pageshow', () => { if (!location.hash && scrollY > 0) scrollTo(0, 0); });

  F.web = { motion, quieto, sobria, irA, montados, get altoVista() { return altoVista; } };
  document.dispatchEvent(new CustomEvent('freixe:web'));
})();

/* ------------------------------------------------------------------
   Casa Freixe · simulador de reservas (Freixe.reserva.montar(el, op) → { destruir() }; Freixe.reserva.unidad(id))
   Referencia: ../casa-de-agosto-coristanco-web y ../apartamentos-alba-somiedo-web. No tienen motor de reservas: todo
   es SIMULADO y lo dice a la vista. No guarda ni envía nada: al final prepara un correo (lo envía quien reserva) o la
   llamada.
   SUPUESTOS marcados (→ PENDIENTES.md): el precio (el de su web de 2014: 65 € baja, 70 € alta, por apartamento y noche,
   + 10 % de IVA), qué noches son «puente» y Semana Santa, que la supletoria va en Freixe II, los días ocupados.
   Temporada alta (Turismo Asturias): julio, agosto, Semana Santa y puentes. El resto, baja.
   Calendario accesible: una sola parada de tabulación por mes y flechas para moverse (±1 día, ±7 días).
   Cada mes lleva la estación del fresno: en la versión «Fresno», con su ramita dibujada; en la sobria, en letra.
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  const F = (window.Freixe = window.Freixe || {});
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const SEM = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const DIA = 86400000;
  const f = (y, m, d) => Date.UTC(y, m, d, 12);
  const partes = (t) => { const x = new Date(t); return { y: x.getUTCFullYear(), m: x.getUTCMonth(), d: x.getUTCDate(), sem: x.getUTCDay() }; };
  const clave = (t) => { const p = partes(t); return `${p.y}-${String(p.m + 1).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`; };
  const largo = (t) => { const p = partes(t); return `${DIAS[p.sem]} ${p.d} de ${MESES[p.m]}`; };
  const corto = (t) => { const p = partes(t); return `${p.d} de ${MESES[p.m]}`; };

  function pascua(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, g = Math.floor((8 * b + 13) / 25);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return f(y, mes - 1, dia);
  }
  // noches de temporada alta además de julio y agosto: Semana Santa y puentes (SUPUESTO: qué cuenta como puente)
  const cache = {};
  function nochesAlta(y) {
    if (cache[y]) return cache[y];
    const s = new Set(), add = (t) => s.add(clave(t));
    const P = pascua(y);
    for (let t = P - 7 * DIA; t <= P; t += DIA) add(t);                       // de Domingo de Ramos a Domingo de Pascua
    // festivos nacionales y de Asturias (8 de septiembre): el puente son las noches del fin de semana pegado al festivo
    const fest = [f(y, 0, 1), f(y, 0, 6), f(y, 4, 1), f(y, 7, 15), f(y, 8, 8), f(y, 9, 12), f(y, 10, 1), f(y, 11, 6), f(y, 11, 8), f(y, 11, 25)];
    fest.forEach((H) => {
      const w = partes(H).sem;
      if (w === 1 || w === 2) for (let k = -3; k <= -1; k++) add(H + k * DIA);
      else if (w === 4) for (let k = -1; k <= 2; k++) add(H + k * DIA);
      else if (w === 5) for (let k = -1; k <= 1; k++) add(H + k * DIA);
    });
    return (cache[y] = s);
  }
  const esAlta = (t) => { const p = partes(t); return p.m === 6 || p.m === 7 || nochesAlta(p.y).has(clave(t)); };

  // ocupación SIMULADA: estancias inventadas de 2 a 5 noches, más probables en alta y en fin de semana; semilla fija
  function ocupacion(semilla, desde, dias) {
    let x = semilla;
    const rnd = () => { x = (x * 48271) % 2147483647; return x / 2147483647; };
    const oc = new Set();
    for (let i = 0; i < dias; i++) {
      const t = desde + i * DIA;
      if (oc.has(clave(t))) continue;
      const w = partes(t).sem;
      const p = esAlta(t) ? 0.3 : (w === 5 || w === 6) ? 0.17 : 0.05;
      if (rnd() < p) { const n = 2 + Math.floor(rnd() * 4); for (let k = 0; k < n; k++) oc.add(clave(t + k * DIA)); i += n; }
    }
    return oc;
  }
  const estacionDe = (t) => { const p = partes(t); const E = F.estacion; return E && E.de ? E.de(p.y, p.m + 1, 15) : null; };

  function montar(el, op) {
    const fuente = document.getElementById('datos-freixe');
    if (!fuente) throw new Error('sin datos de reserva');
    const D = JSON.parse(fuente.textContent);
    const E = F.estacion;
    const hoy = E && E.fecha && !(new URLSearchParams(location.search).get('fecha')) ? f(E.fecha.anio, E.fecha.mes - 1, E.fecha.dia) : (() => { const n = new Date(); return f(n.getFullYear(), n.getMonth(), n.getDate()); })();
    const ultimo = hoy + 400 * DIA;
    const OCU = {};
    D.unidades.forEach((u, i) => { OCU[u.id] = ocupacion(7654321 + i * 7919, hoy, 400); });
    const st = { unidad: F.reservaPendiente || D.unidades[0].id, personas: 2, llegada: null, salida: null, mes: f(partes(hoy).y, partes(hoy).m, 1), foco: hoy };
    delete F.reservaPendiente;
    const U = () => D.unidades.find((u) => u.id === st.unidad) || D.unidades[0];
    const C = D.contacto, P = D.precios, IVA = D.iva / 100;
    const conRamitas = op && op.densidad !== 'sobria' && F.fresno;

    el.classList.add('es-montado');
    const app = document.createElement('div');
    app.className = 'sim__app';
    app.innerHTML = `
      <p class="sim__aviso" role="note"><svg class="ico" width="22" height="22" aria-hidden="true"><use href="#i-aviso" width="24" height="24"/></svg><span><b>Simulación.</b> La casa no tiene motor de reservas: los días ocupados son de ejemplo y el precio es el de su web de 2014, por confirmar. Esto no reserva ni envía nada; al final se prepara la solicitud y ellos confirman.</span></p>
      <div class="sim__in">
        <div class="sim__izq">
          <div class="sim__elige" role="group" aria-label="Apartamento">
            ${D.unidades.map((u) => `<button type="button" class="sim__tipo" data-unidad="${u.id}" aria-pressed="false"><b>${u.nombre}</b><span>Hasta ${u.personas[1]} personas${u.personas[1] > 2 ? ' (con supletoria, por confirmar)' : ''}</span></button>`).join('')}
          </div>
          <div class="sim__personas"><span id="sim-pers-l">Personas</span>
            <span class="paso" role="group" aria-labelledby="sim-pers-l"><button type="button" data-p="-1" aria-label="Una persona menos">−</button><output class="cifra" id="sim-pers" aria-live="polite"></output><button type="button" data-p="1" aria-label="Una persona más">+</button></span>
          </div>
          <div class="cal">
            <div class="cal__cab"><button type="button" data-mes="-1" aria-label="Meses anteriores"><svg class="ico" width="20" height="20" aria-hidden="true"><use href="#i-ant" width="24" height="24"/></svg></button><span class="cal__ayuda" id="cal-ayuda">Elige el día de llegada</span><button type="button" data-mes="1" aria-label="Meses siguientes"><svg class="ico" width="20" height="20" aria-hidden="true"><use href="#i-sig" width="24" height="24"/></svg></button></div>
            <div class="cal__meses"></div>
            <ul class="cal__leyenda"><li><i class="l-libre"></i>Libre</li><li><i class="l-ocupado"></i>Ocupado (de ejemplo)</li><li><i class="l-alta"></i>Temporada alta</li></ul>
            <p class="cal__msg" aria-live="polite"></p>
          </div>
        </div>
        <aside class="res" aria-labelledby="res-t" aria-live="polite"></aside>
      </div>`;
    el.appendChild(app);
    const $ = (s) => app.querySelector(s);
    const meses = $('.cal__meses'), msg = $('.cal__msg'), res = $('.res'), ayuda = $('#cal-ayuda');
    const ocupado = (t) => OCU[st.unidad].has(clave(t));
    const libreTramo = (a, b) => { for (let t = a; t < b; t += DIA) if (ocupado(t)) return false; return true; };

    function pintarTipos() {
      app.querySelectorAll('.sim__tipo').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.unidad === st.unidad)));
      const u = U();
      st.personas = Math.min(u.personas[1], Math.max(u.personas[0], st.personas));
      $('#sim-pers').textContent = st.personas;
      app.querySelector('[data-p="-1"]').disabled = st.personas <= u.personas[0];
      app.querySelector('[data-p="1"]').disabled = st.personas >= u.personas[1];
    }
    function mesHtml(m0) {
      const p = partes(m0), dias = new Date(Date.UTC(p.y, p.m + 1, 0)).getUTCDate();
      const hueco = (p.sem + 6) % 7;
      const e = estacionDe(m0);
      let s = `<div class="cal__mes"><div class="cal__mes-cab">${conRamitas && e ? `<canvas class="cal__ramita" width="40" height="40" data-est="${e.nombre}" data-prog="${e.progreso.toFixed(2)}" aria-hidden="true"></canvas>` : ''}<h4 id="mes-${p.y}-${p.m}">${MESES[p.m]} ${p.y}</h4>${e ? `<span class="cal__est">El fresno:<br>${e.etiqueta.toLowerCase()}</span>` : ''}</div><div class="cal__rejilla" role="group" aria-labelledby="mes-${p.y}-${p.m}">`;
      s += SEM.map((x) => `<span class="cal__sem" aria-hidden="true">${x}</span>`).join('');
      for (let i = 0; i < hueco; i++) s += '<span aria-hidden="true"></span>';
      for (let d = 1; d <= dias; d++) {
        const t = f(p.y, p.m, d);
        const pasado = t < hoy || t > ultimo, oc = !pasado && ocupado(t), alta = esAlta(t);
        const enTramo = st.llegada && st.salida && t > st.llegada && t < st.salida;
        const cls = ['cal__dia', pasado ? 'es-pasado' : '', oc ? 'es-ocupado' : '', alta ? 'es-alta' : '', t === hoy ? 'es-hoy' : '', t === st.llegada ? 'es-llegada' : '', t === st.salida ? 'es-salida' : '', enTramo ? 'es-tramo' : ''].filter(Boolean).join(' ');
        const puedeSalida = st.llegada && !st.salida && t > st.llegada && libreTramo(st.llegada, t);
        const deshab = pasado || (oc && !puedeSalida);
        const estado = pasado ? 'no disponible' : oc ? (puedeSalida ? 'ocupado esa noche, se puede salir ese día' : 'ocupado (de ejemplo)') : 'libre';
        const lbl = `${largo(t)}: ${estado}${alta ? ', temporada alta' : ''}${t === st.llegada ? ', tu llegada' : ''}${t === st.salida ? ', tu salida' : ''}`;
        s += `<button type="button" class="${cls}" data-t="${t}" tabindex="${t === st.foco ? 0 : -1}" aria-label="${lbl}"${deshab ? ' aria-disabled="true"' : ''}${t === st.llegada || t === st.salida ? ' aria-pressed="true"' : ''}>${d}</button>`;
      }
      return s + '</div></div>';
    }
    function pintarCal(enfocar) {
      const p = partes(st.mes);
      const m2 = f(p.m === 11 ? p.y + 1 : p.y, (p.m + 1) % 12, 1);
      meses.innerHTML = mesHtml(st.mes) + mesHtml(m2);
      if (conRamitas) meses.querySelectorAll('canvas.cal__ramita').forEach((c) => { try { F.fresno.ramita(c, c.dataset.est, +c.dataset.prog); } catch (er) { c.remove(); } });
      app.querySelector('[data-mes="-1"]').disabled = st.mes <= f(partes(hoy).y, partes(hoy).m, 1);
      app.querySelector('[data-mes="1"]').disabled = st.mes >= f(partes(ultimo).y, partes(ultimo).m, 1);
      if (!meses.querySelector('[tabindex="0"]')) { const b = meses.querySelector('.cal__dia:not([aria-disabled])') || meses.querySelector('.cal__dia'); if (b) { b.tabIndex = 0; st.foco = +b.dataset.t; } }
      ayuda.textContent = !st.llegada ? 'Elige el día de llegada' : !st.salida ? 'Ahora, el día de salida' : 'Fechas elegidas';
      if (enfocar) { const b = meses.querySelector('[tabindex="0"]'); if (b) b.focus(); }
    }
    const euros = (n) => `${(Math.round(n * 100) / 100).toLocaleString('es-ES', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;
    function pintarResumen() {
      const u = U();
      if (!st.llegada || !st.salida) {
        res.innerHTML = `<h3 id="res-t">Tu estancia</h3><p class="res__vacio">Elige llegada y salida en el calendario: aquí salen las noches y el precio de cada una.</p>
          <p class="res__nota">Temporada alta: ${D.temporadas.alta.toLowerCase()}. El resto del año, baja.</p>`;
        return;
      }
      const noches = Math.round((st.salida - st.llegada) / DIA);
      let nAlta = 0;
      for (let t = st.llegada; t < st.salida; t += DIA) if (esAlta(t)) nAlta++;
      const nBaja = noches - nAlta, base = nAlta * P.alta + nBaja * P.baja, iva = base * IVA, total = base + iva;
      const lineas = [];
      if (nBaja) lineas.push(`<li><span><span class="cifra">${nBaja}</span> ${nBaja === 1 ? 'noche' : 'noches'} de temporada baja × <span class="cifra">${P.baja}</span> €</span><span class="cifra">${euros(nBaja * P.baja)}</span></li>`);
      if (nAlta) lineas.push(`<li><span><span class="cifra">${nAlta}</span> ${nAlta === 1 ? 'noche' : 'noches'} de temporada alta × <span class="cifra">${P.alta}</span> €</span><span class="cifra">${euros(nAlta * P.alta)}</span></li>`);
      lineas.push(`<li><span>IVA (${D.iva} %)</span><span class="cifra">${euros(iva)}</span></li>`);
      const L = st.llegada;
      const asunto = `Solicitud de reserva: ${u.nombre}, ${noches} ${noches === 1 ? 'noche' : 'noches'}, del ${corto(L)} al ${corto(st.salida)}`;
      const cuerpo = [
        'Hola:', '',
        `Querría reservar ${u.nombre}.`,
        `Llegada: ${largo(L)} de ${partes(L).y}`,
        `Salida: ${largo(st.salida)} de ${partes(st.salida).y}`,
        `Noches: ${noches}`,
        `Personas: ${st.personas}`,
        '', '¿Está libre? ¿Cuál es el precio de esas noches y cómo se paga la señal?', '',
        'Nombre:', 'Teléfono:', '',
        '(Fechas consultadas en el simulador de la web: los días ocupados y el precio que enseña son de ejemplo.)',
      ].join('\n');
      const mailto = `mailto:${C.correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
      res.innerHTML = `<h3 id="res-t">Tu estancia</h3>
        <dl class="res__fechas"><div><dt>Llegada</dt><dd>${largo(L)}</dd></div><div><dt>Salida</dt><dd>${largo(st.salida)}</dd></div></dl>
        <ul class="res__lineas">${lineas.join('')}</ul>
        <p class="res__total"><span><span class="cifra">${noches}</span> ${noches === 1 ? 'noche' : 'noches'} en ${u.nombre}</span><b>${euros(total)}</b></p>
        <p class="res__nota">Precio de ejemplo: el de su web de 2014 (${P.baja} € en baja, ${P.alta} € en alta, por apartamento y noche, IVA aparte). La tarifa de hoy, la señal y el mínimo de noches: por confirmar con la casa.</p>
        <div class="res__acc">
          <a class="btn btn--acento" href="${mailto}"><svg class="ico" width="20" height="20" aria-hidden="true"><use href="#i-correo" width="24" height="24"/></svg>Preparar la solicitud por correo</a>
          <a class="btn btn--linea" href="tel:${C.telefonos[0].tel}"><svg class="ico" width="20" height="20" aria-hidden="true"><use href="#i-tel" width="24" height="24"/></svg>Llamar al <span class="cifra">${C.telefonos[0].texto}</span></a>
          <a class="btn btn--linea" href="tel:${C.telefonos[1].tel}"><svg class="ico" width="20" height="20" aria-hidden="true"><use href="#i-tel" width="24" height="24"/></svg>Móvil: <span class="cifra">${C.telefonos[1].texto}</span></a>
        </div>
        <p class="res__wa">El correo se abre en tu programa de correo: esta web no envía ni guarda nada.</p>`;
    }
    function pintar(enfocar) { pintarTipos(); pintarCal(enfocar); pintarResumen(); }
    function elegirDia(t) {
      msg.textContent = '';
      if (t < hoy || t > ultimo) return;
      if (!st.llegada || st.salida || t <= st.llegada) {
        if (ocupado(t)) { msg.textContent = `El ${corto(t)} está ocupado (de ejemplo): elige otro día de llegada.`; return; }
        st.llegada = t; st.salida = null;
      } else {
        if (!libreTramo(st.llegada, t)) { msg.textContent = 'Hay noches ocupadas (de ejemplo) en medio: elige una salida antes o cambia la llegada.'; return; }
        st.salida = t;
      }
      st.foco = t;
      pintar(true);
    }
    const alClic = (e) => {
      const b = e.target.closest('button');
      if (!b || !app.contains(b)) return;
      if (b.dataset.unidad) { st.unidad = b.dataset.unidad; if (st.llegada && st.salida && !libreTramo(st.llegada, st.salida)) { st.salida = null; msg.textContent = 'En ese apartamento esas noches están ocupadas (de ejemplo): vuelve a elegir la salida.'; } else if (st.llegada && ocupado(st.llegada)) { st.llegada = st.salida = null; } pintar(); return; }
      if (b.dataset.p) { st.personas += +b.dataset.p; pintar(); return; }
      if (b.dataset.mes) { const p = partes(st.mes), n = p.m + (+b.dataset.mes); st.mes = f(p.y + Math.floor(n / 12), (n + 12) % 12, 1); pintarCal(); return; }
      if (b.dataset.t) { if (b.getAttribute('aria-disabled') === 'true') { msg.textContent = +b.dataset.t < hoy ? 'Ese día ya ha pasado.' : `El ${corto(+b.dataset.t)} está ocupado (de ejemplo).`; return; } elegirDia(+b.dataset.t); }
    };
    const alTecla = (e) => {
      const b = e.target.closest('.cal__dia');
      if (!b) return;
      const paso = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (!paso) return;
      e.preventDefault();
      const t = Math.min(ultimo, Math.max(hoy, +b.dataset.t + paso * DIA));
      st.foco = t;
      const p = partes(t), pm = partes(st.mes);
      const idx = (p.y - pm.y) * 12 + (p.m - pm.m);
      const dos = meses.children[1] && getComputedStyle(meses.children[1]).display !== 'none';
      if (idx < 0 || idx > (dos ? 1 : 0)) st.mes = f(p.y, p.m - (dos && idx > 1 ? 1 : 0), 1);
      pintarCal(true);
    };
    app.addEventListener('click', alClic);
    app.addEventListener('keydown', alTecla);
    pintar();
    el.setAttribute('data-montado', '');
    F.reserva.unidad = (id) => { if (D.unidades.some((u) => u.id === id)) { st.unidad = id; pintar(); } };
    return {
      estado: () => ({ ...st, ocupados: OCU[st.unidad].size }),
      elegir: elegirDia,
      limpiar() { st.llegada = st.salida = null; msg.textContent = ''; pintar(); },
      destruir() { app.removeEventListener('click', alClic); app.removeEventListener('keydown', alTecla); app.remove(); el.classList.remove('es-montado'); el.removeAttribute('data-montado'); F.reserva.unidad = (id) => { F.reservaPendiente = id; }; },
    };
  }
  F.reserva = { montar, unidad: (id) => { F.reservaPendiente = id; }, _alta: esAlta, _pascua: pascua, _f: f };
})();

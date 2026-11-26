/* ------------------------------------------------------------------
   Casa Freixe · la estación de hoy en Barcia (contrato: window.Freixe.estacion)
   Se carga EL PRIMERO, sin defer, en el <head>: pone data-estacion en <html> antes de pintar, para que el acento de
   color de la estación no salte después.
   Estaciones del fresno (ENCARGO): invierno dic-mar, brotación abr-may, verano jun-sep, otoño oct-nov.
   Fecha en Europe/Madrid. Para probar: ?estacion=invierno|brotacion|verano|otono, ?fecha=AAAA-MM-DD, ?progreso=0..1.
   Freixe.estacion = { nombre, etiqueta, color, progreso (0 al empezar la estación, 1 al acabar), fecha:{anio,mes,dia},
                       fijada, de(anio, mes, dia) }
   ------------------------------------------------------------------ */
(function (w, d) {
  'use strict';
  var F = w.Freixe = w.Freixe || {};
  var E = {
    invierno: { etiqueta: 'Invierno', color: '#3E5A73', meses: [12, 1, 2, 3] },
    brotacion: { etiqueta: 'Brotación', color: '#6E3A5E', meses: [4, 5] },
    verano: { etiqueta: 'Verano', color: '#43740D', meses: [6, 7, 8, 9] },
    otono: { etiqueta: 'Otoño', color: '#E2C35A', meses: [10, 11] }
  };
  function hoyMadrid() {
    var p = {};
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(new Date()).forEach(function (x) { p[x.type] = +x.value; });
      return { anio: p.year, mes: p.month, dia: p.day };
    } catch (e) { var n = new Date(); return { anio: n.getFullYear(), mes: n.getMonth() + 1, dia: n.getDate() }; }
  }
  var DIA = 864e5;
  function de(anio, mes, dia) {
    var nombre = 'invierno';
    for (var k in E) if (E[k].meses.indexOf(mes) >= 0) nombre = k;
    // inicio y fin de la estación que contiene la fecha (el invierno cruza el año)
    var ini, fin, t = Date.UTC(anio, mes - 1, dia);
    if (nombre === 'invierno') {
      var a0 = mes === 12 ? anio : anio - 1;
      ini = Date.UTC(a0, 11, 1); fin = Date.UTC(a0 + 1, 3, 1);
    } else {
      var m = E[nombre].meses;
      ini = Date.UTC(anio, m[0] - 1, 1); fin = Date.UTC(anio, m[m.length - 1], 1);
    }
    return { nombre: nombre, etiqueta: E[nombre].etiqueta, color: E[nombre].color, progreso: Math.min(1, Math.max(0, (t - ini + DIA / 2) / (fin - ini))) };
  }
  var q = null;
  try { q = new URLSearchParams(location.search); } catch (e) { /* navegador viejo */ }
  var f = hoyMadrid();
  var mf = q && /^(\d{4})-(\d{2})-(\d{2})$/.exec(q.get('fecha') || '');
  if (mf) f = { anio: +mf[1], mes: +mf[2], dia: +mf[3] };
  var est = de(f.anio, f.mes, f.dia);
  var fija = q && q.get('estacion');
  var fijada = false;
  if (fija && E[fija] && fija !== est.nombre) {
    // otra estación a mano: a mitad de camino, salvo ?progreso=
    est = { nombre: fija, etiqueta: E[fija].etiqueta, color: E[fija].color, progreso: 0.6 };
    fijada = true;
  } else if (fija && E[fija]) fijada = true;
  var pq = q && parseFloat(q.get('progreso'));
  if (isFinite(pq)) est.progreso = Math.min(1, Math.max(0, pq));
  F.estacion = { nombre: est.nombre, etiqueta: est.etiqueta, color: est.color, progreso: est.progreso, fecha: f, fijada: fijada, de: de, todas: E };
  d.documentElement.setAttribute('data-estacion', est.nombre);
})(window, document);

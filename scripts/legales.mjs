/* Genera los *.src.html de las páginas legales y el 404 con una plantilla común (receta de Alba y Montemar).
   Uso: node scripts/legales.mjs  (después, node construir.mjs)
   Titular: el de ref/DATOS-FREIXE.md (data/freixe.json): Ganadería Freixe S.C.; el NIF no está publicado → «pendiente».
   Solo castellano; noindex en todas. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/freixe.json'), 'utf8'));
const T = D.titular, C = D.contacto;
const TEL = `<a href="tel:${C.telefonos[0].tel}">${C.telefonos[0].texto}</a>`;
const CORREO = `<a href="mailto:${C.correo}">${C.correo}</a>`;

const TITULAR = `<dl>
  <dt>Titular</dt><dd>${T.nombre}</dd>
  <dt>NIF</dt><dd>${T.nif}</dd>
  <dt>Domicilio</dt><dd>${T.domicilio}</dd>
  <dt>Nombre comercial</dt><dd>${D.nombre}</dd>
  <dt>Teléfonos</dt><dd>${TEL} y <a href="tel:${C.telefonos[1].tel}">${C.telefonos[1].texto}</a></dd>
  <dt>Correo</dt><dd>${CORREO}</dd>
  <dt>Registro de turismo</dt><dd>${D.registro}, Registro de Empresas y Actividades Turísticas del Principado de Asturias (${D.categoria})</dd>
</dl>
<p class="aviso">Pendiente: revisar estos textos con la casa antes de publicar (NIF, domicilio exacto y representante de la sociedad). Esta web es una propuesta que nadie ha encargado todavía.</p>`;

const paginas = {
  'aviso-legal': {
    titulo: 'Aviso legal',
    cuerpo: `
<p>En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), estos son los datos del titular de esta web:</p>
${TITULAR}
<h2>Uso de la web</h2>
<p>Esta web informa sobre ${D.nombre}, dos apartamentos rurales en Barcia (Santa Eulalia de Oscos, Asturias). La disponibilidad, el precio y las condiciones de cada reserva los confirma la casa.</p>
<p>El calendario de «Elige fechas» es <b>una simulación</b>: los días ocupados son de ejemplo y el precio es el de su web de 2014, por confirmar. No reserva nada: solo prepara una solicitud que envías tú desde tu correo, o te da el teléfono. La reserva existe cuando la casa la confirma.</p>
<h2>Propiedad intelectual</h2>
<p>Los textos y el rótulo (redibujado a partir del logo de la casa) son de esta web. Las fotos son de la casa: las de su web anterior y la de su ficha de Turismo Asturias. Las citas de huéspedes son literales de sus opiniones públicas en EscapadaRural, con el nombre de pila y la fecha.</p>
<p class="aviso">Pendiente: confirmar con la casa el uso de sus fotos y pedirle las originales.</p>
<p>Las letras Didact Gothic, Inclusive Sans y Sacramento se usan con su licencia libre (SIL Open Font License).</p>
<p>La sección «Desde la puerta» y la de «Alrededor» usan datos del Instituto Geográfico Nacional (relieve y ortofoto, CC BY 4.0), de OpenStreetMap (© colaboradores de OpenStreetMap, ODbL) y rutas calculadas con OSRM. Sus créditos detallados están en esas secciones.</p>
<h2>Responsabilidad</h2>
<p>Los enlaces a otras webs (EscapadaRural, Facebook y Google Maps) llevan a servicios de terceros con sus propias condiciones.</p>
<h2>Ley aplicable</h2>
<p>Estas condiciones se rigen por la ley española.</p>`,
  },
  privacidad: {
    titulo: 'Política de privacidad',
    cuerpo: `
<h2>Responsable</h2>
${TITULAR}
<h2>Qué datos tratamos y para qué</h2>
<p>Los que nos das al escribirnos o al llamarnos para reservar: nombre, teléfono, correo, las fechas, cuántos venís y lo que quieras contarnos. Los usamos para contestarte y gestionar tu reserva.</p>
<p>Al alojarte, la ley obliga a registrar los datos de los viajeros y comunicarlos a las autoridades (Real Decreto 933/2021).</p>
<h2>El calendario de la web</h2>
<p>El simulador de fechas no guarda ni envía nada: funciona en tu navegador. El botón «Preparar la solicitud por correo» abre tu programa de correo con el mensaje escrito; lo envías tú, si quieres.</p>
<h2>Base legal y plazos</h2>
<p>La base es tu consentimiento al escribirnos, la gestión de la reserva que pides y, para el registro de viajeros, una obligación legal. Los datos se guardan mientras dura la relación y, después, el tiempo que exige la ley.</p>
<h2>Con quién se comparten</h2>
<p>Con nadie, salvo lo que obliga la ley (el registro de viajeros).</p>
<h2>Tus derechos</h2>
<p>Puedes pedir el acceso, la rectificación, la supresión, la oposición, la limitación o la portabilidad de tus datos escribiendo a ${CORREO} o llamando al ${TEL}. Si crees que no se han respetado, puedes reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es">aepd.es</a>).</p>
<h2>Lo que guarda esta web en tu navegador</h2>
<p>Una sola cosa: <code>freixe-cookies</code> en el almacenamiento local, para recordar que ya has visto el aviso de cookies. Más detalles en <a href="cookies.html">cookies</a>.</p>`,
  },
  cookies: {
    titulo: 'Política de cookies',
    cuerpo: `
<p>Esta web no usa cookies propias de análisis ni de publicidad.</p>
<h2>Lo que se guarda en tu navegador</h2>
<ul>
  <li><b>freixe-cookies</b> (almacenamiento local): recuerda que has visto el aviso, para no enseñártelo en cada visita. Es técnica y no caduca sola; puedes borrarla desde tu navegador.</li>
</ul>
<h2>Servicios de terceros</h2>
<ul>
  <li><b>Google Fonts</b>: las letras de la web (Didact Gothic, Inclusive Sans y Sacramento) se cargan desde los servidores de Google, que reciben tu dirección IP.</li>
  <li><b>Google Maps</b>: el mapa de «Contacto y cómo llegar» solo se carga si pulsas «Ver el mapa». A partir de ese momento, Google puede poner sus cookies.</li>
</ul>
<h2>El fresno, el 3D y los mapas propios</h2>
<p>El árbol de la portada se dibuja en tu navegador con archivos de esta misma web y no pone cookies. Si en el móvil pulsas «Mover con el móvil», la web lee la inclinación del teléfono mientras la tienes abierta; no la guarda ni la envía.</p>
<p>Puedes volver a ver el aviso desde «Preferencias de cookies», en el pie de la página.</p>
<p class="aviso">Pendiente: si «Desde la puerta» o «Alrededor» piden datos a otro servicio al usarlos, añadirlo aquí (ver LUGAR.md).</p>`,
  },
  accesibilidad: {
    titulo: 'Declaración de accesibilidad',
    cuerpo: `
<p>El titular se compromete a que esta web sea accesible conforme a la norma UNE-EN 301 549 (nivel AA de las WCAG 2.1).</p>
<h2>Situación de cumplimiento</h2>
<p class="aviso">Pendiente: completar tras la revisión de accesibilidad previa a la publicación.</p>
<p>La web se ha construido para poder usarse entera con el teclado y con lector de pantalla: contrastes de al menos 4,5:1 en el texto en las cuatro estaciones, foco visible, textos alternativos en las fotos, el calendario con flechas y animaciones que se quitan si tu sistema pide reducir el movimiento. El árbol de la portada y el 3D son un apoyo: la información está también en el texto.</p>
<h2>Contenido de terceros</h2>
<p>El mapa de Google no depende de esta web: su accesibilidad es la de su servicio.</p>
<h2>Contacto</h2>
<p>Si encuentras una barrera, llama al ${TEL} o escribe a ${CORREO}. Te daremos la información en un formato accesible.</p>`,
  },
};

const FUENTES = 'https://fonts.googleapis.com/css2?family=Didact+Gothic&family=Inclusive+Sans:ital,wght@0,300..700;1,300..700&display=swap';
const cabeza = (titulo) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} · Casa Freixe</title>
<script src="js/estacion.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FUENTES}">
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/legal.css">
<link rel="icon" href="marca/favicon.svg" type="image/svg+xml">
<link rel="icon" href="marca/favicon-32.png" sizes="32x32" type="image/png">
</head>`;

const MARCA = `<a class="legal-marca" href="./" aria-label="Casa Freixe, a la portada"><svg viewBox="-12 -200 736 296" aria-hidden="true" focusable="false"><use href="#rotulo"/></svg></a>`;

for (const [nombre, p] of Object.entries(paginas)) {
  const html = `${cabeza(p.titulo)}
<body>
<!--rotulo-simbolo-->
<header class="legal-cab">
  <div class="env">
    ${MARCA}
    <a class="volver" href="./">Volver a la portada</a>
  </div>
</header>
<main class="legal">
  <div class="env">
    <h1>${p.titulo}</h1>
${p.cuerpo}
  </div>
</main>
<footer class="legal-pie">
  <div class="env">
    <a href="aviso-legal.html">Aviso legal</a>
    <a href="privacidad.html">Privacidad</a>
    <a href="cookies.html">Cookies</a>
    <a href="accesibilidad.html">Accesibilidad</a>
  </div>
</footer>
</body>
</html>
`;
  fs.writeFileSync(path.join(RAIZ, `${nombre}.src.html`), html);
  console.log(`${nombre}.src.html`);
}

// el 404: el rótulo sin el punto de la i (se ha perdido), y la vuelta
fs.writeFileSync(path.join(RAIZ, '404.src.html'), `${cabeza('Página no encontrada')}
<body class="no-hay">
<!--rotulo-simbolo-->
<main class="no">
  <div class="env">
    <svg class="no__rotulo" viewBox="-12 -200 736 296" aria-hidden="true" focusable="false"><use href="#rotulo"/></svg>
    <h1>Esta página se ha caído del árbol</h1>
    <p>La dirección no existe o ha cambiado. La casa sigue en su sitio.</p>
    <p><a class="btn btn--acento" href="./">Volver a Casa Freixe</a></p>
  </div>
</main>
</body>
</html>
`);
console.log('404.src.html');

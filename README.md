# Casa Freixe · «El punto de la i»

**Propuesta de web, no encargada**, para Casa Freixe: dos apartamentos rurales en una casa de piedra y pizarra de
una familia ganadera en Barcia (Santa Eulalia de Oscos, Asturias), Reserva de la Biosfera de Oscos-Eo. Datos reales
con fuente (`ref/DATOS-FREIXE.md`); lo que falta, en [`PENDIENTES.md`](PENDIENTES.md). `noindex, nofollow` en todas
las páginas. En local: sin publicar ni subir. El 3D y Alrededor los hace el agente Lugar: ver [`LUGAR.md`](LUGAR.md).

## El concepto: «El punto de la i»

En su logo, el punto de la «i» de *Freixe* es la copa verde de un árbol, y *freixe* es **fresno**. La portada es ese
logo a tamaño grande, **redibujado en SVG** (no hay archivo suelto: se ha medido sobre `ref/logo-recorte-0.png`), y el
punto de la i se convierte en **un fresno vivo, en la estación real de hoy en Barcia**. La idea sale de su marca, no de
un catálogo: la web es la misma casa con su mismo rótulo, y lo que cambia es el árbol del rótulo, como cambia el de
verdad. Además ayuda a decidir: quien mira sabe en qué época está el valle.

Cómo está hecho:

- **El rótulo** (`construir.mjs`, función `rotulo()`): «Casa Freixe» en palo seco geométrico de trazo fino (C casi
  círculo, a de un solo ojo, F, r, e, x de dos trazos), la **línea de monte de dos lomas** que va de la C al árbol, el
  palo de la i alto (en su logo parece una «l») y debajo «Turismo Rural» en cursiva (Sacramento, cargada solo con esas
  letras) con su **rúbrica** dibujada. Sin JS o con movimiento reducido sin lienzo, el punto de la i es la mancha verde
  de su logo (`#43740D`, medido con PIL). La misma pieza sale en la cabecera (`<symbol id="rotulo">`), el pie, las
  legales, el 404 (sin el punto: «se ha caído del árbol»), el `og:image` y el favicon.
- **La entrada** (CSS puro, acaba siempre trazada): la línea de monte se traza, la rúbrica después, el palo de la i
  crece desde abajo y, encima, el fresno brota rama a rama (`js/portada.js`).
- **El fresno** (`js/fresno.js`, canvas 2D): nace del palo de la i con su mismo grosor y su misma tinta, y las ramillas
  aclaran al gris ceniza de la corteza del fresno. Botánica respetada: **ramificación opuesta** (por pares; uno de
  cada dos sale escorzado, la disposición decusada vista de lado), puntas que levantan, **hoja compuesta
  imparipinnada de 9 a 13 folíolos** (4 a 6 pares más el terminal) lanceolados y **aserrados** con los dientes hacia la
  punta, hojas opuestas en la ramilla, **sámaras en racimos colgantes** con la semilla en la base del ala.
- **Las cuatro estaciones** (`js/estacion.js`, fecha de Europe/Madrid, cargado el primero):
  - **invierno** (dic-mar): ramas desnudas con las **yemas negras** (la terminal mayor, las laterales por pares) y
    alguna sámara seca que aguanta;
  - **brotación** (abr-may): primero **flores** pardo violáceas (penachos de estambres, sin pétalos) **antes que las
    hojas**; al final, hojas tiernas que crecen;
  - **verano** (jun-sep): el verde del logo y racimos de sámaras verdes que se secan hacia septiembre;
  - **otoño** (oct-nov): amarillo pálido; la copa clarea (el fresno se desnuda pronto) y a las hojas les faltan
    folíolos; las sámaras, pardas, siguen colgando. Hoy, 26 de noviembre: otoño tardío (progreso 0,93).
  `?estacion=invierno|brotacion|verano|otono` (y `?fecha=AAAA-MM-DD`, `?progreso=0..1`) para probar.
- **El viento**: brisa de fondo + el **puntero** (su velocidad horizontal da la racha; cerca del puntero las hojas
  tiemblan más) + el **dedo** en el móvil (deslizar en horizontal sobre la portada; el vertical sigue siendo scroll,
  `touch-action: pan-y`) + la **inclinación del móvil**, solo tras pulsar «Mover con el móvil» (en iOS pide permiso).
  Las ramas gruesas responden lentas y poco; las ramillas, rápidas.
- **Al bajar caen hojas** (en invierno, sámaras que bajan girando; en brotación, folíolos o flores) y van hacia el
  enlace «La casa» de abajo: es la guía a la siguiente sección. En otoño, una racha fuerte también tira alguna.
- **El pie completa el objeto**: el mismo rótulo con el árbol entero de hoy y, al pie del tronco, las hojas que
  cayeron mientras bajabas. Con movimiento reducido, el árbol completo y quieto.
- **La web entera acompaña la estación con mesura**: una base fija de piedra y pizarra y **un solo acento** que cambia
  con la estación (botones, índice de la galería, iconos de servicios, nota de opiniones, días elegidos del
  calendario). Cada mes del calendario lleva la estación del fresno (con su ramita dibujada en la versión «Fresno»).

## Paleta y letras

Base fija: fondo `#EDEEEB` (piedra clara, neutra), superficie `#F7F7F5`, tinta de pizarra `#1A1E21`, texto suave
`#4A5156`, piedra `#8E877B`, pizarra `#22282C` (sección oscura `#1D2326`), verde de la copa del logo `#43740D`.
El acento, por estación (botón / texto sobre fondo, contraste medido por `verificar.mjs`):

| Estación | Acento | Texto del acento | Contraste texto/fondo · botón |
|---|---|---|---|
| Invierno | `#3E5A73` pizarra fría | `#3E5A73` | 6,2 · 6,8 |
| Brotación | `#6E3A5E` pardo violáceo (flor del fresno) | `#6E3A5E` | 7,4 · 8,0 |
| Verano | `#43740D` verde de la copa | `#3A650B` | 5,9 · 5,4 |
| Otoño | `#E2C35A` amarillo pálido (hoja del fresno) | `#765A00` ocre | 5,6 · 9,7 (texto oscuro) |

Distinta de Alba, Montemar y Las Riberas (verdes y azules sobre fondos verdosos): aquí gris de piedra neutro.

Letras (ninguna la usa otra web de la cartera; lo comprueba `verificar.mjs`): **Didact Gothic** para titulares y
cifras (palo seco geométrico fino, el pariente de la letra de su logo), **Inclusive Sans** para el texto (300-700, con
cursiva) y **Sacramento** solo para «Turismo Rural» (se pide a Google Fonts con `&text=` : solo esas letras).
Formas: botones y mandos en píldora; paneles a 6 px; fotos sin marco ni radio.

## Estructura

1. **Portada** «El punto de la i»: el rótulo con el fresno; la frase (Barcia, Reserva de la Biosfera), «Ver fechas» y
   el teléfono a la vista; la estación de hoy en una línea; «La casa» como guía.
2. **La casa** (`#casa`): cifras grandes (2 apartamentos, 5 plazas, 2 chimeneas, todo el año), qué es *freixe* con la
   ramita de hoy, y la fachada.
3. **Los dos apartamentos** (`#apartamentos`), uno junto al otro: plazas, plantas, chimenea, precio (marcado), su
   galería en tira y «Ver fechas» de cada uno; debajo lo que tienen los dos, con iconos dibujados.
4. **Por dentro** (`#dentro`): por estancias (cocina-salón con chimenea, dormitorio, baño, escalera, fuera), índice
   fijo que marca la que se ve, filas de la misma altura, visor que abre por nombre de archivo.
5. **La bienvenida** (`#bienvenida`): huevos, miel, rosquillas y huerto, leña; citas literales, cortas y fechadas de
   EscapadaRural; «suele haber», sin prometer.
6. **Desde la puerta** (`#lugar`, de Lugar): sección oscura. Respaldo de la Web: foto del entorno y texto.
7. **Alrededor** (`#alrededor`, de Lugar): `construir.mjs` incrusta `partes/alrededor.html`; mientras no está, una
   lista provisional sin cifras.
8. **Opiniones** (`#opiniones`): 5/5 en EscapadaRural, el enlace y tres citas. Sin recuento (regla de pocas reseñas).
9. **Reservar** (`#reservar`): simulador marcado (I hasta 2 personas, II hasta 3; precio de 2014 + IVA como ejemplo;
   días ocupados de ejemplo); prepara el correo o la llamada.
10. **Contacto** (`#contacto`): dirección, teléfonos, correo y Google Maps solo al pulsar (coordenadas de
    `data/lugar.json`, del Catastro; sin él, las de Turismo Asturias). Pie con AR0311 y la Reserva de la Biosfera.

Legales (`aviso-legal`, `privacidad`, `cookies`, `accesibilidad`) con el titular de DATOS (NIF «pendiente») y 404.

## Kit: qué se quitó y qué se añadió (PLIEGO §3 bis y §5 bis)

- **Quitado**: cortina de entrada, marquesina, letra a letra, cursor propio, pila sticky, botones magnéticos, serif
  editorial. La entrada es el propio rótulo trazándose.
- **Añadido (pieza propia)**: el rótulo que se hace fresno con la botánica y la estación reales. No podría colgar de
  otra web sin cambiarlo todo.
- **Gesto táctil**: el dedo en horizontal es viento; inclinar el móvil, tras permiso.
- **El objeto se completa en el pie**: el árbol entero y las hojas caídas al pie del tronco.
- **Foco del teclado**: contorno redondeado con un **folíolo aserrado** del fresno en la esquina (`#foco-hoja`), en el
  color del acento de texto.
- **Menú §5 bis**: «rótulo propio del hero servido como trazado SVG» y «dato real en vivo» (la estación del día).

### `repeticion.mjs` (2026-11-26)

```
node ../plantillas-negocios-web/scripts/repeticion.mjs ../casa-freixe-oscos-web
Dominan (en 5 o más de 10): ninguna
casa-freixe-oscos-web usa: ninguna del kit   (crema + acento chillón: fondo #EDEEEB, no es crema)
✓ Repite 0 de las dominantes (tope 2).
```

## Presupuesto de rendimiento

- **LCP**: la frase de la portada (texto, sin animación). El rótulo es SVG en línea y el árbol, un canvas encima que
  no bloquea nada (scripts con `defer`).
- **Lienzo**: DPR con tope 2 (y menos si el lienzo pasa de 3,4 Mpx); hojas, racimos y flores pintados una vez en
  sprites y colocados con `drawImage`; ramas agrupadas por grosor y color; ni filtros ni sombras por fotograma.
- **Bucle** solo con la portada a la vista y la pestaña visible; con movimiento reducido no hay bucle.
- **Bajada de calidad automática**: si la media de 90 fotogramas pasa de 26 ms, baja la resolución del lienzo (×0,72,
  dos veces como mucho).
  Si sigue lento con DPR 1, pasa a **30 fotogramas por segundo**. Nunca baja de DPR 1 (se vería borroso).
- **Medido** (Playwright, `verificar.mjs` bloque 14, 2026-11-26; Chrome sin GPU, así que el canvas se rasteriza en la
  CPU: es el caso malo):
  - escritorio 1280×800: **16,8 ms** por fotograma de media (60 fps), **ninguna tarea larga** tras la carga;
  - móvil 390×844 con la **CPU ×4**: 41,8 ms entre fotogramas pintados; la calidad bajó sola un escalón (a 30 fps, DPR 1);
  - **LCP 152 ms** en local (un texto del rótulo; la frase está pintada desde el principio). Sin medir en un móvil
    real ni con red lenta: pendiente.
- **INP**: sin medir (no hay interacción pesada: el viento solo suma a una variable; el visor y el calendario son DOM).

## Construir, probar y mirar

```
python -I -X utf8 scripts/fotos.py   # fotos: tamaños, WebP y la corrección de color (una vez)
node scripts/legales.mjs             # legales y 404 (*.src.html)
node construir.mjs                   # index.html y demás desde *.src.html + partes/ + data/ (y versionar.mjs)
node scripts/marca.mjs               # og:image y favicons desde el rótulo (Playwright, una vez)
node verificar.mjs                   # la comprobación final (servidor interno en el 8991)
node servir.mjs                      # para mirarla: http://localhost:8981/
```

Se edita siempre `index.src.html`, `partes/` y `data/`; `index.html` lo genera `construir.mjs`.

`verificar.mjs` no hace capturas ni pinta el 3D (WebGL apagado, `js/lugar.js` servido vacío). Comprueba: noindex y
partes en todas las páginas, enlaces y fotos (ninguna por encima de su tamaño), sin rayas, citas literales, reseñas
sin recuento, contrato con Lugar, contraste de las cuatro estaciones, letras no usadas en la cartera, receta de borrado
del mando, la portada a 360×640, 375×667, 390×844, 768×1024 y 1280×800 sin solapes, el árbol pintado, las cuatro
estaciones, menú móvil, cookies, visor por nombre (cada miniatura), simulador, movimiento reducido con contenido
completo, mando, hueco del 3D, imágenes, legales, foco y, una vez al final, con movimiento: crecimiento, viento,
caída, el dedo y la CPU ×4. Si Lugar deja `scripts/alrededor-prueba.mjs`, lo llama después de cerrar su navegador.

### Qué mirar (Álvaro, en su navegador)

El aspecto no lo ha visto nadie: los verdes de `verificar.mjs` son comportamiento, no «se ve bien».
1. La portada hoy (otoño tardío) y en las otras tres: `?estacion=invierno`, `brotacion`, `verano`. ¿Se lee la hoja
   compuesta? ¿Las yemas negras se ven en invierno? ¿Las flores de brotación se entienden como flores?
2. Que el tronco salga limpio del palo de la i (sin escalón) y que la copa no tape la línea de monte de forma rara.
3. Mover el ratón rápido de lado a lado (viento) y bajar despacio: las hojas que caen hacia «La casa».
4. En el móvil: el árbol más grande sobre las letras, el dedo en horizontal y «Mover con el móvil».
5. El pie: el árbol completo y las hojas caídas al pie del tronco.
6. Con `?revision`: el mando (Fresno / Sobria y las cuatro estaciones).

## Mando de maqueta (no viaja al cliente)

Solo aparece con `?revision`: **Fresno** (cargada) / **Sobria**, y la estación (Hoy, Invierno, Brotación, Verano,
Otoño; recarga con `?estacion=`). La sobria no quita secciones: cambia la ramita dibujada de «La casa» y las de los
meses del calendario por el dato en letra, no deja caer hojas al bajar y **añade la tabla «De un vistazo»** que
compara Freixe I y II. El árbol de la portada sigue en las dos: es el rótulo.

**Receta de borrado** (la comprueba `verificar.mjs`, bloque 1, sobre los ficheros):
1. `partes/cabeza.html`: desde `// MANDO DE MAQUETA` hasta `h.classList.add('densidad-sobria');` y su `}`.
2. `partes/pie.html`: desde `<!-- MANDO DE MAQUETA` hasta `<!-- fin del MANDO DE MAQUETA -->`.
3. `js/main.js`: desde `/* ============ 12. MANDO DE MAQUETA` hasta `/* fin del MANDO DE MAQUETA */`.
4. `css/base.css`: desde `/* ---------- MANDO DE MAQUETA` hasta `/* fin del MANDO DE MAQUETA */`.
Después, `node construir.mjs`. (La tabla «De un vistazo» se queda escondida; si se quiere a la vista, quitar en
`css/estilos.css` la regla `html:not(.densidad-sobria) .vistazo`.)

## Fotos

De su web de 2014 (`ref/origen/web/`, 800 px como mucho) y la fachada de su ficha de Turismo Asturias (708 px).
`scripts/fotos.py` las sirve a 400 px y a su tamaño real, nunca más grandes, en WebP y JPG, con **una corrección
suave e igual para todas**: menos viñeteado (como mucho +9 % en las esquinas), balance algo más frío (rojo ×0,965,
azul ×1,03) y saturación ×0,86. No se usan los banners `*.png` (llevan el logo impreso). Dos llegaron cortadas de su
servidor y se recortan por la banda gris; `entorno__222.jpg` está vacío. Pedir las originales (PENDIENTES).

## Reutilizar para otro cliente

`data/freixe.json` (negocio, apartamentos, servicios, reseñas, bienvenida) y `data/fotos.json` (galería) mandan;
`construir.mjs` lo monta todo. El rótulo se dibuja en `construir.mjs` (`glifos`, `LETRAS`, `MONTE`, `COPA`): para otra
marca, otras letras. El fresno (`js/fresno.js`) es una especie concreta: para otro árbol, cambiar la hoja
(`hojaCompuesta`), el fruto (`racimo`) y `estado()`.

# Lugar · «Desde la puerta» (3D) y «Alrededor» (mapa)

Módulos del agente Lugar (2026-11-26). Ficheros: `js/lugar.js`, `css/lugar.css`, `js/alrededor.js`, `css/alrededor.css`,
`partes/alrededor.html`, `img/lugar/`, `data/lugar.json`, `data/lugar-escena.json`, `data/alrededor-mapa.json`,
`data/alrededor-relieve.json`, `vendor/three-0.160.0.module.min.js`, `scripts/lugar-*`, `scripts/alrededor-*`, `ref/raw/`
(cachés, `rutas.json` y `lugar-prueba.html`; `ref/` no va al repo).

**El 3D no lo ha visto nadie pintado.** No se prueba con Playwright (reglas del PC): lo tiene que mirar Álvaro en su
Chrome (ver «Qué mirar»). Lo comprobado, en «Pruebas».

## La casa (dónde está de verdad)

| Dato | Valor |
|---|---|
| Referencia catastral | **A00300600PH59D** (AL BARCIA 6(A), 33776 Santa Eulalia de Oscos; parcela urbana de 833 m² construidos) |
| Edificio | la **parte 1** (2 plantas, 16,6 × 6,9 m) + la parte 2 (1 planta, adosada al suroeste) |
| Centro (ETRS89) | **43.286736, −7.030365** (centro de la parte 1) |
| Cota | **590 m** (terreno del MDT05 en el centro; 589–592 m en las esquinas, baja hacia el noroeste) |
| Río Barcia | pasa a **91 m** en línea recta, a 583 m |

Cómo se ha fijado: (1) sus UTM de la web (X 659912 Y 4794777) leídas en **ED50** y pasadas a ETRS89 (tres juegos de
parámetros) caen a menos de 15 m de esa parte; (2) las fotos `casa-rural-en-los-oscos.png` y `DSC_0390`: hastial con el
porche de madera, la loma subiendo a la derecha con una **torre de la luz** (las de OSM están al norte-noreste) y la casa
grande de piedra a cuatro aguas a la izquierda (partes 5–8 de la misma parcela); (3) `apartamentos-rural-esoscos.png`:
fachada larga de dos plantas con el porche en un extremo. Se han mirado también las fotos de fachada del Catastro (2014)
y los datos de cada parcela de Barcia (`ref/raw/lugar-cache/fachadas`, `dnprc`).
**Deducido, por confirmar con la casa**: que el porche esté en el hastial del **sureste** (rumbo 154°) y cuál de los
anejos es de los apartamentos. El Catastro registra la parcela como «vivienda + almacenes» (los apartamentos no salen).

Lo de la ficha (43.286761, −7.0313622, el nodo de la aldea en OSM) cae 80 m al oeste, en la carretera.

## «Desde la puerta» (3D, `#lugar`)

Un vuelo que avanza con el scroll (escenario `position: sticky` en una pista de 560 vh; 480 vh en móvil; sin GSAP):

| Scroll | Parada | Cámara |
|---|---|---|
| 0 – 9 % | La puerta | recién salida del porche, a 4,2 m del suelo, mirando valle abajo (azimut 348°); luego gira a la derecha por la aldea hasta dar con la casa. No sale a la altura de los ojos ni mirando de frente: en el MDT la ladera sube justo delante del porche y llenaba el cuadro (corregido el 2026-11-26) |
| 9 – 28 % | La casa | sale al patio, se vuelve y la rodea desde arriba (piedra, pizarra, porche) |
| 28 – 46 % | El río Barcia | baja al cauce al oeste de la aldea y se pone aguas abajo |
| 46 – 70 % | Valle abajo | sigue el río a ras de las copas (un fotograma cada ~70 m de río) hasta donde tuerce al este |
| 70 – 100 % | Santa Eulalia y las aldeas | sube y se abre: acaba a 1.235 m, al oeste, mirando al valle del Agüeira; las rutas se dibujan |

- **Relieve**: MDT05 del IGN en una caja de 7,3 × 8,0 km (de Barcia a Mazonovo), en rejillas de 15 m (toda la caja), 5 m
  (el valle, 2,2 km) y 2 m (la aldea, 400 m); malla de 2,5 m en la aldea y 8 m en el valle, más abierta lejos (~1 M de
  triángulos con los árboles en escritorio, ~380 k en móvil). Anillo lejano con MDT25 (26 × 24 km). **A escala real.**
- **Ortofoto PNOA**: 3,0 m/px en la caja (WMS), 1,07 m/px en el valle (WMTS z17) y 0,25 m/px en la aldea (WMTS z19).
- **La casa**, sobre su planta del Catastro: muros de mampostería (textura dibujada, lajas grises y ocres), cubierta de
  pizarra a dos aguas, **porche de madera en el hastial del sureste** (dos postes, viga, tejadillo a un agua), murete
  de piedra a la izquierda, puerta en el centro y la ventana enrejada a la derecha (como en la foto), ventanas en los
  costados, chimenea grande de piedra en el costado noreste y otra pequeña en el hastial del noroeste, el anejo de una
  planta. Alturas, huecos y chimeneas **a ojo** desde las fotos. Las 35 casas vecinas del Catastro, de piedra y pizarra
  (dos aguas si son rectangulares; a cuatro aguas si no).
- **El río Barcia**: OSM solo tiene el tramo bajo (desde 1,6 km al sureste). El tramo alto, el arroyo que baja por la
  aldea, sale del **MDT05** (relleno de hoyos + D8 de máxima pendiente; empalma con el de OSM a 23 m). 8,2 km de cinta de
  agua que siempre baja, de 2 a 7 m de ancho según la cuenca. También el **Agüeira** de OSM (allí «Río Augüeira»).
- **Rutas con trazado real en OSM**: **Ruta de la Mina de As Talladas** (PR-AS 203, relation/7728731, 12,9 km) y **Ruta
  da Seimeira** (PR-AS 116, relation/6485046, 3,3 km de ida). Cinta sobre el relieve con halo, que se dibuja entre el 74
  y el 97 % del scroll. **Os Cortíos, Forcón de los Ríos, Carballeiras y A Coba no tienen trazado en OSM**: no se dibujan
  (no hay ni relación ni caminos con ese nombre; en Ferreira solo hay carteles).
- **Árboles**: 3.613 copas sacadas de la ortofoto del valle (manchas oscuras), con el **color de la estación**
  (`window.Freixe.estacion`): otoño ocres, invierno desnudas y pardas, brotación verde claro, verano verde; un 22 %
  perennes. El suelo es la foto de verano del PNOA con un tinte suave de la estación sobre lo verde.
- **El cielo de ahora en Barcia**: sol y luna en su posición real (fórmulas de SunCalc, en el navegador; no se pide nada
  a ningún servicio), color del cielo y de la luz por la altura del sol, sombras en 260 m alrededor de la casa
  (recalculadas solo cuando el sol se mueve), estrellas, la luna con su fase; de noche, ventanas encendidas y la luz
  del porche (halo dibujado). Rótulo «15:42 en Barcia · el sol de ahora» + la frase.
- **Rótulos** (HTML): la casa, Barcia, el río, Vega del Carro, Millarado, Santa Eulalia, Pumares, Ferreirela, Mazonovo
  y las dos rutas, cada uno en su tramo; se ocultan si una loma los tapa o si se pisan.

### Cuándo sale cada cosa

| Caso | Qué se ve |
|---|---|
| Escritorio con WebGL | el 3D se pide al montar (Web monta a ~900 px); mientras, el póster en el mismo hueco |
| Móvil (≤ 820 px o puntero grueso) o ahorro de datos | plan B + botón **«Ver el valle en 3D»** (Three.js y el relieve no se piden hasta pulsar) |
| `prefers-reduced-motion`, `movimiento: false`, `densidad: 'sobria'`, sin WebGL, `?sin-webgl` | plan B, sin botón |
| Navegador automatizado (Playwright) | plan B siempre; `?lugar=3d` lo fuerza (solo para pruebas) |
| En 3D | botón «Ver en plano» abajo a la derecha |
| Si falla la carga o se pierde el contexto WebGL | vuelve solo al plan B |

**Plan B** (mismo hueco): el valle desde el aire (ortofoto) con el río, las rutas y el vuelo dibujados y las aldeas
marcadas; la vista final dibujada con los mismos datos (render por columnas en Python, sin espejo ni cabeceo al revés:
el script lo comprueba con dos `assert`, y las marcas caen donde deben: Pumares a la derecha de Santalla mirando al
sureste); el cielo de ahora y las cinco paradas.

Parámetros: `?fps` (fps, calidad, DPR, altura de la cámara, triángulos), `?hora=22:30` (otra hora de hoy),
`?estacion=invierno|brotacion|verano|otono` (la lee Web), `?sin-webgl`, `?lugar=3d`.

## «Alrededor» (`#alrededor`)

`partes/alrededor.html` (lo genera `scripts/alrededor-mapa.mjs`): la lista por grupos con las cifras de OSRM ya
escritas (respaldo sin JS; botones con `aria-pressed`, desactivados hasta que monta el JS) y el hueco del mapa.
`js/alrededor.js`: al pulsar un sitio, el mapa **vuela** (van Wijk) hasta él, **traza** el camino desde la casa y la ficha
da km, minutos, carreteras, km en línea recta y el enlace a Google Maps (`/maps/dir/?api=1`, origen la casa). Conmutador
**En coche / A pie** donde se puede ir andando (Santa Eulalia, Sargadelos, Seimeira, As Talladas, Mazonovo). Las dos
rutas llevan su **perfil de desnivel** (MDT05): con el ratón, el dedo (arrastrando en horizontal) o las flechas
(100 m; Mayús 1 km; Inicio/Fin) marca el punto en el mapa; es un `role="slider"` con `aria-valuetext`. Movimiento
reducido: salta y el camino sale entero. En el móvil el mapa queda fijo arriba (38 % de la pantalla) y la ficha se abre
debajo del sitio pulsado. Mapa propio en SVG (costa, Eo, Navia, ríos y carreteras del concejo, relieve sombreado del
MDT25 con `mix-blend-mode: multiply`, aldeas de cerca), sin teselas de nadie. El polígono del mar se cierra a **300 km**
al norte de su caja (el arreglo de Montemar).

Sitios y cifras (OSRM, 2026-11-26; tiempos teóricos, sin tráfico):

| Sitio | OSM | En coche | Carreteras | A pie | En línea recta |
|---|---|---|---|---|---|
| Santa Eulalia de Oscos | node/203865680 | 4,3 km · 5 min | AS-27 | 4,1 km · 55 min | 3,21 km |
| Casa natal del Marqués de Sargadelos | way/509506861 | 5,9 km · 7 min | AS-27 | 5,8 km · 77 min | 4,64 km |
| Ruta de la Seimeira (salida, Pumares) | way/992685441 | 4,9 km · 6 min | AS-27, SE-2 | 4,5 km · 60 min | 2,85 km |
| Ruta de la Mina de As Talladas (salida, Santalla) | node/203865680 | 4,3 km · 5 min | AS-27 | 4,1 km · 55 min | 3,21 km |
| Conjunto etnográfico de Mazonovo | node/9168136537 | 7,2 km · 8 min | AS-27 | 7,2 km · 96 min | 5,9 km |
| Ferreira (área recreativa del Agüeira) | node/4489470877 | 8,7 km · 13 min | AS-27 | — | 6,34 km |
| San Martín de Oscos | node/203834023 | 14,2 km · 20 min | AS-27, AS-33, AS-362 | — | 6,04 km |
| Villanueva de Oscos (iglesia del monasterio) | way/1436920559 | 10,6 km · 14 min | AS-27, AS-33 | — | 4,58 km |
| Taramundi | node/189180964 | 23,1 km · 24 min | AS-27, AS-11, AS-26, AS-21 | — | 10,38 km |
| A Fonsagrada | node/828410655 | 24,7 km · 30 min | AS-27, LU-703, LU-701 | — | 18,26 km |
| Vegadeo | node/59227002 | 27 km · 26 min | AS-27, AS-11 | — | 19,81 km |
| Ribadeo | node/127766530 | 37,9 km · 41 min | AS-27, AS-11, N-640, N-642, LU-140 | — | 27,76 km |
| Playa de las Catedrales (acceso) | node/702278473 | 46,7 km · 49 min | AS-27, AS-11, N-640, N-642, N-634, LU-P-0610 | — | 31,35 km |
| Aeropuerto de Asturias (terminal) | way/321569262 | 125,8 km · 96 min | AS-27, AS-11, N-640, A-8, AI-82 | — | 86,12 km |

Senderos (MDT05 sobre el trazado de OSM): **Seimeira** 3,3 km (ida), +199 / −88 m, de 493 a 609 m; **As Talladas**
12,7 km, +674 / −704 m, de 394 a 672 m. La ficha añade lo que dice su web («según su web»: Seimeira baja, 8 km ida y
vuelta, 3 h; As Talladas media-alta, 12 km, 3 h 45 min).

### Diferencias con su web y lo que no se ha puesto

- **Playa de las Catedrales: su web dice «a unos 30 minutos en coche»; OSRM da 46,7 km y 49 min.** Va la medida.
- «Santa Eulalia a 5 minutos» (opinión de EscapadaRural): cuadra (4,3 km, 5 min).
- Mazonovo «a unos 5 km de Santalla»: desde la casa son 7,2 km por carretera.
- **Telar de Irene y Navajas Luna (2014): no incluidos.** El telar sale citado en prensa (Hola, febrero de 2025, «El
  telar de Irene» en Santa Eulalia) pero sin dirección ni horario ni nodo en OSM; de Navajas Luna (Brañavella) no hay
  rastro. Si la casa confirma que siguen abiertos y dónde, se añaden.
- El monasterio de Villanueva va a la iglesia de Santa María (el nodo de OSM del monasterio no existe como tal).

## Para Web

1. **HTML**: `<div data-modulo="lugar">` con su respaldo (ya está en `index.src.html`); `construir.mjs` mete
   `partes/alrededor.html` en `@@ALREDEDOR@@` (dentro del div `data-modulo="alrededor"`).
2. **CSS y JS**: `css/lugar.css`, `css/alrededor.css`; `js/lugar.js` y `js/alrededor.js` con `defer`. **Three.js no lo
   cargas tú**: `lugar.js` lo pide con `import()` a `vendor/three-0.160.0.module.min.js` (copia propia de Three.js r160,
   MIT, la misma de Montemar) solo cuando hace falta. Sin import map, sin CDN.
3. **Montar**: `Freixe.lugar.montar(el, op)` → `{ destruir(), estado(), ver3d(), verPlano() }`;
   `Freixe.alrededor.montar(el, op)` → `{ listo (promesa), elegir(id), estado(), destruir() }` (si no encuentra
   `.alr` dentro, lanza un error y `main.js` repone el respaldo).
4. **Raíces**: `.lugar-mod` y `.alr-mod` (en el div); todo con prefijo `lugar__` y `alr__`.
5. **Sticky**: ningún antepasado de `[data-modulo="lugar"]` con `overflow` (salvo el `overflow-x: clip` de `html`) ni
   `transform`/`filter`. El escenario se fija bajo `var(--cabecera)`. La columna del mapa de Alrededor también es sticky.
6. **Variables que leen**: `--fondo`, `--superficie`, `--texto`, `--texto-suave`, `--linea`, `--acento`, `--acento-texto`,
   `--acento-suave`, `--acento-claro` (la ruta de la Seimeira, en el 3D y en el plano), `--foco`, `--gutter`, `--ancho`,
   `--cabecera`, `--letra-titular`, `--letra-texto`, `--letra-cifras`. Sobre el 3D el texto va en placas oscuras propias.
7. **`data/lugar.json`**: `casa {lat, lon, cota, refCatastral, …}`, `rio`, `santalla`, `rutasEnOSM`.
8. **Privacidad**: ningún módulo pide nada a terceros desde el navegador (sin Open-Meteo ni teselas). **Créditos**: IGN
   (CC BY 4.0), Catastro, OpenStreetMap (ODbL), OSRM — van en el pie de cada módulo; conviene repetirlos en el aviso
   legal o en los créditos.
9. **`verificar.mjs`**: puede llamar a `scripts/alrededor-prueba.mjs` y `scripts/lugar-prueba.mjs` (servidor propio en
   el 8982; ninguna pinta WebGL).
10. **Peso**: con `defer` y la carga diferida, nada entra en el LCP. El 3D baja **3,7 MB en escritorio** (Three.js
    655 KB incluido) y **2,4 MB en móvil** al pulsar el botón; el plan B, **~420 KB**. Alrededor: `alrededor-mapa.json`
    136 KB + relieve 100 KB al montar. `lugar.js` 72 KB y `alrededor.js` 21 KB, sin minificar.

## Datos (cómo se rehacen)

```
python -I -X utf8 scripts/lugar-osm-api.py     # OSM de la comarca por la API principal (Overpass daba 502) → ref/raw/osm/api-todo.json
node scripts/lugar-osm.mjs                     # lo mismo por Overpass (si responde) → ref/raw/osm/*.json
python -I -X utf8 scripts/lugar-datos.py       # IGN, Catastro, río, árboles, recorrido, plan B → img/lugar/, data/lugar*.json
node scripts/alrededor-rutas.mjs               # OSRM y routing.openstreetmap.de → ref/raw/rutas.json (+ ref/raw/osrm/)
python -I -X utf8 scripts/alrededor-relieve.py # relieve sombreado del mapa (MDT25) → img/lugar/alrededor-relieve.webp
node scripts/alrededor-mapa.mjs                # mapa y partes/alrededor.html → data/alrededor-mapa.json
node scripts/lugar-prueba.mjs                  # pruebas del 3D (sin pintar WebGL); --sin-navegador: solo Node
node scripts/alrededor-prueba.mjs              # pruebas de Alrededor; --sin-navegador: solo Node
```

Todo con User-Agent genérico (`datos-mapa-script/1.0 (uso puntual)`), sin datos personales. Costa y ríos grandes del
mapa, de la caché de Montemar (`ref/raw/mapa-cache/`, misma consulta y misma caja).

| Fuente | Servicio | Licencia | Uso |
|---|---|---|---|
| MDT05 / MDT25 IGN | WCS `servicios.idee.es/wcs-inspire/mdt` | CC BY 4.0 | relieve, cota, cauce, perfiles |
| PNOA IGN | WMS `www.ign.es/wms-inspire/pnoa-ma` y WMTS `www.ign.es/wmts/pnoa-ma` | CC BY 4.0 | suelo, árboles, plan B |
| Catastro | INSPIRE `wfsBU` (BuildingPart), `Consulta_DNPRC`, fotos de fachada | © DG del Catastro | la casa y las vecinas |
| OpenStreetMap | API 0.6 `map` por teselas y Overpass | ODbL | río, rutas, aldeas, carreteras, costa, destinos |
| OSRM / routing.openstreetmap.de | `router.project-osrm.org` (coche), `routing.openstreetmap.de/routed-foot` | datos ODbL | distancias y tiempos |
| Sol y luna | fórmulas de SunCalc (V. Agafonkin), en el navegador | — | luz, cielo, astros |

Coordenadas locales en metros desde el centro de la casa: x al este, z al sur (en el mapa, y al sur), y = cota.
Alturas en PNG RGB: `(R·256 + G) / 10 − 100` m.

## Pruebas (última pasada, 2026-11-26)

- `node scripts/lugar-prueba.mjs`: **62 bien, 0 mal**. Node: sol en Barcia (solsticios a mediodía 70,2° y 23,3° al sur;
  en junio sale por el noreste), luna, frases, estaciones, el recorrido sin NaN ni saltos (máx. 2,4 m por 1/4000), que
  empieza bajo el porche y acaba en lo alto mirando a Santa Eulalia; datos (casa, cota, ficheros, pesos, río a 91 m que
  siempre baja, dos rutas de OSM, 3.613 árboles). Navegador **sin WebGL** (`--disable-3d-apis`, 1280×800 y 390×844):
  plan B con trazos, marcas, paradas y cielo; no pide Three.js ni el relieve; sin scroll horizontal; `destruir()`.
  Escena con Three.js real y un **renderizador falso que no pinta** (no hay contexto WebGL): monta sin NaN (~1,02 M de
  triángulos en escritorio, ~383 k en móvil), rótulos y paradas por tramos (p=0,16 la casa; p=0,4 el río; p=0,999
  Millarado · Santa Eulalia · Pumares · Ferreirela · As Talladas), fuera de pantalla no pinta, «Ver en plano»,
  `destruir()`; en el móvil, plan B con botón y Three.js solo al pulsar; `?hora=22:30` de noche.
- `node scripts/alrededor-prueba.mjs`: **60 bien, 0 mal**. Datos (cifras del HTML = OSRM, mar cerrado a 300 km,
  perfiles), y en el navegador a 1280×800 y 390×844 con movimiento reducido (los 14 sitios uno a uno: `aria-pressed`,
  ficha con km y minutos de OSRM y enlace, camino trazado entero, destino dentro del encuadre) y a 1280×800 con
  movimiento (vuelo y trazo); conmutador a pie; perfil con ratón, dedo y teclado (marca el punto dentro del mapa);
  Enter en la lista; salto sin vuelo con movimiento reducido; sin JS, la lista con sus cifras; sin errores.

**No comprobado**: nada se ha pintado con WebGL (shaders sin compilar, la casa sin ver, ni el agua, ni las rutas sobre el
relieve, ni los fps). La vista final del plan B y la comprobación del recorrido sobre la ortofoto sí se han mirado;
el mapa de Alrededor no lo ha visto nadie montado (solo las pruebas), ni ninguna de las dos secciones en la página de Web.

## Rendimiento

Sin `transmission`, sin `RectAreaLight`, sin bloom (halo dibujado con sprite aditivo), colores en sRGB (`'#hex'`),
DPR ≤ 1,5 (1,25 en móvil) con bajada automática (DPR 1; luego 0,8 y sin sombras si los fotogramas pasan de 30 ms),
sombras PCF solo alrededor de la casa y recalculadas solo cuando el sol se mueve, pausa fuera de pantalla, el agua
corre a ~30 fps mientras se ve el río y, quieto, no se repinta. Lo más caro: el relieve (~600 k triángulos) y los
3.613 árboles (80 triángulos cada copa; en móvil 60 % de ellos y 20 triángulos). Si va justo, lo primero sería bajar la
malla de la aldea de 2,5 a 3 m.

## Qué mirar (Álvaro, en su Chrome)

Servidor en la carpeta de la web (`python -m http.server 8982`) y abrir `http://localhost:8982/ref/raw/lugar-prueba.html`
(los dos módulos sueltos) o la página de Web.

1. **`?fps`**: si la calidad baja sola a 1 o 2, va justo.
2. **La casa** (scroll 9–28 %): que se reconozca (piedra, pizarra, el porche de madera con su tejadillo, la puerta y la
   ventana enrejada); si el porche sale en el lado equivocado o flotando/enterrado, avisar (orientación deducida).
3. **El río**: que la cinta de agua se vea en el fondo del valle y no quede enterrada ni flotando en las curvas.
4. **El final**: Santa Eulalia en el fondo del valle, Pumares a la derecha, las rutas trazándose sobre las laderas.
5. **Los colores de la estación**: `?estacion=invierno`, `?estacion=verano`… (copas y tinte del suelo con mesura).
6. **De noche** (`?hora=22:30`): luna, estrellas, ventanas y la luz del porche.
7. **Móvil real**: el botón «Ver el valle en 3D», que el scroll no se trabe y que las paradas quepan.
8. **Alrededor**: el vuelo del mapa, el trazo, el perfil con el dedo; en el portátil, que la ficha con el perfil quepa
   debajo del mapa (si no, hace scroll dentro).

## Pendiente

- Que Álvaro vea el 3D pintado (nadie lo ha visto).
- Confirmar con la casa: el edificio (A00300600PH59D, parte 1) y que el porche dé al sureste; alturas y huecos van a ojo.
- Telar de Irene y Navajas Luna: solo si la casa confirma que siguen abiertos (y dónde).
- Catedrales: su web dice 30 min, OSRM 49 min (anotar en PENDIENTES de Web si se usa la cifra en otro sitio).
- Os Cortíos (sale de la puerta), Forcón de los Ríos, Carballeiras y A Coba: sin trazado en OSM; si la casa da un
  track (GPX), se podría dibujar indicando la fuente.
- La foto aérea es de verano: las sombras pintadas en el suelo no giran con el sol de ahora.

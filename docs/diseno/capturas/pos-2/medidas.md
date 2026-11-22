# Medidas — POS 2 (menú sin toggle y línea del carrito)

Fecha: 22-11-2026. Referencia: captura de Alegra `04-carrito-cantidad-alegra.png` (714×914, no 873 como decía el
brief) y `01-menu-toggle.png` / `02-menu-toggle-2.png` (1920×902) para el menú.

## Método

- La fila animada de Alegra no viene en el HTML guardado (`index.html` es solo el shell y las líneas se pintan en el
  cliente), así que se midió en píxeles sobre la captura 04 con un decodificador PNG (sin escalar la imagen a ojo).
- La captura 04 está ampliada ~1.25× respecto a CSS: el botón «Vender» mide 54 px en la captura y 43 px en el POS
  (54 ÷ 43 = 1.25); el select mide 48 px y nuestro `SelectTrigger` 40 px (1.2). Por eso se anotan las dos columnas:
  píxeles crudos de la captura y su equivalente CSS (÷1.25).
- La fila de Medoxigas se midió con `getBoundingClientRect`/`getComputedStyle` en Playwright (viewport 1440×900). El
  panel mide 554 px de ancho a 1440 y la fila útil 549 px; Alegra mide 686 px de panel en la captura. Las posiciones
  se comparan también en % del ancho de la fila para que la diferencia de ancho no engañe.

## Tabla

| Parte | Alegra (captura 04) | Alegra (CSS, ÷1.25) | Medoxigas antes | Medoxigas después | Diferencia |
| --- | --- | --- | --- | --- | --- |
| Ancho del riel del menú | — | 52 px (guía del menú) | 52 px | 52 px | 0 (no se tocó) |
| Ancho del menú expandido | — | 271 px | 271 px | 271 px | 0 (no se tocó) |
| Alto de ítem del menú | — | 32 px, texto 14/21 px, iconos 20 px | 32 px, 14/21 px, iconos 20 px | Igual | 0 |
| Flechitas «Ingresos» / «Turnos» | 2 chevrons (capturas 01 y 02) | 2 | 2 chevrons | 0 | −2 |
| Subitems visibles al expandir | Siempre visibles (3) | 3 | 0 (detrás del acordeón) | 3, con línea vertical | +3 |
| Subitems en el riel de 52 px | Solo icono de la sección | — | Solo icono | Solo icono (los subitems no caben) | 0 |
| Alto de la fila del carrito | 84 px | 67 px | 65 px | 76 px | +11 px vs. antes; +9 px vs. CSS Alegra (el brief pedía ~76) |
| Padding lateral de la fila | 25 px izq. / 20 px der. | 20 / 16 px | 16 / 16 px | 16 / 16 px | −4 px izq. (se conserva el padding del panel) |
| Nombre del producto | cap height 13 px → 14 px bold, #474747 | 14 px / 700 | 13 px / 600, #212529 | 14 px / 700, #212529 | +1 px y +100 de peso |
| Precio unitario | cap height 13 px, #64748b | 12–13 px / 400 | 12 px / 400, #707070 | 12 px / 400, #707070 | Sin cambio (token `--pos-texto-suave`) |
| Total de la línea | cap height 13 px → 15 px bold, #0f172a | 15 px / 700 | 14 px / 700, #212529 | 15 px / 700, #212529 | +1 px |
| Icono − / + | glifo de 18 px de ancho | 14.4 px visibles (caja ~24 px) | caja 16 px, botón 24×24 | caja 18 px (brief 16–18), botón 36×36 | Icono +2 px; botón +12 px |
| Número de cantidad | glifo 13 px de alto, caja ~40 px | 14 px / 400 | 14 px, caja 27×36 | 14 px / 500, caja 36×40 | Número legible, caja más alta |
| Ancho del stepper completo | 108 px | 86 px | ~84 px (24 + 36 + 24) | 112 px (36 + 40 + 36) | +28 px vs. antes; +26 px vs. CSS Alegra |
| Centro del stepper (% de la fila) | 430 / 686 = 58.6 % | 58.6 % | 72 % (pegado al precio) | 57 % | −15 pts: vuelve al centro como Alegra |
| Separación stepper → total | 102 px | 82 px | ~18 px | ~89 px | +71 px: el total queda solo a la derecha |
| Acciones (lápiz / papelera) | No se ven en reposo | — | 2 botones de 24 px apilados bajo el total (ocupaban 24 px de alto) | Flotan sobre el total al hover/foco; 32×32 px, sin cambiar los 76 px | Dejan de apilarse |
| Quitar en móvil/touch | No visible | — | Solo el icono de hover | Botón «Quitar línea» dentro de la edición + papelera al foco | Accesible sin hover |

## Posiciones horizontales (% del ancho de la fila)

| Punto | Alegra | Antes | Después |
| --- | --- | --- | --- |
| Inicio del nombre | 3.6 % | 2.9 % | 2.9 % |
| Fin del nombre | 44.3 % | 43.9 % (nombre corto medido) | 43.9 % |
| Centro del número de cantidad | 58.6 % | 72.0 % | 57.0 % |
| Inicio del total | 85.1 % | 83.9 % | 82.0 % |
| Fin del total | 96.9 % | 96.7 % | 96.7 % |

## Capturas

- `antes-menu-expandido.png` / `despues-menu-expandido.png`
- `despues-menu-colapsado.png` (riel 52 px, solo iconos)
- `despues-menu-movil.png` (390×844)
- `despues-menu-oscuro.png`
- `antes-linea-carrito.png` / `despues-linea-carrito.png` (recorte de la fila)
- `despues-linea-acciones.png` (hover sobre el total: lápiz y papelera en su lugar)
- `despues-linea-oscuro.png`
- `antes-panel-carrito.png` / `despues-panel-carrito.png`

## Notas de fidelidad

- La fila quedó en 76 px como pedía el brief; la de Alegra es 67 px CSS. El espacio extra se usa para que el stepper
  de 36 px y el total de 15 px respiren sin marcos, no para agregar renglones.
- El total, el nombre y los iconos usan los tokens Medoxigas (`--pos-texto` #212529, `--pos-texto-suave` #707070,
  `--pos-icono` #94a3b8), no los colores exactos de Alegra: la decisión del repo es copiar el layout, no los hex.
- Los iconos − / + quedaron en caja de 18 px (rango del brief, 16–18) dentro de botones de 36 px; el glifo visible es
  algo más chico que el de la captura de Alegra, que viene ampliada 1.25×.
- No se tocó el motor del carrito: cantidades, precios, descuentos, ITBIS y totales siguen saliendo de
  `totalesDeLinea` y de las mismas acciones (`cambiarCantidad`, `quitarLinea`).
- En la última corrida de capturas el turno estaba cerrado (lo cerró otra sesión; es estado de la base, no del
  código), por eso el botón «Vender» del panel sale deshabilitado. La fila del carrito y el menú no dependen de ese
  estado; no se abrió ni se creó ningún dato para la prueba.

# Medidas — Alegra POS → Medoxigas POS

Medido en la copia local del POS de Alegra (copia local guardada fuera del repo)
con Chromium headless (Playwright) a **1440×900** y **1024×600**, leyendo el DOM
renderizado y `styles.css`. La columna «Medoxigas» es lo que quedó implementado en
`src/app/(pos)/pos/`. Todas las cifras son píxeles CSS a zoom 100 %.

## Shell

| Medida | Alegra | Medoxigas | Nota |
| --- | --- | --- | --- |
| Riel de iconos | 52 px, blanco, borde derecho `#e2e8f0` | 52 px, blanco, borde `--pos-linea` | `menu-pos.tsx`; expande a 271 px. |
| Barra superior | 56 px (logo + barra derecha) | **No se copia** | La barra superior derecha está prohibida; el logo vive en el riel. |
| Fondo de la pantalla | `#f1f5f9` | `bg-slate-100` en claro (`--background` en oscuro) | |
| Alto del área de trabajo | 844 px a 900 de alto (56 de barra) | 856 px a 900 de alto, sin barra superior | El POS usa el alto completo para el catálogo. |
| Barra inferior | 44 px, ancho completo tras el riel | 44 px, ancho completo tras el riel | 1388 px a 1440 de ancho. |
| Borde superior de la barra | `rgba(0,0,0,.2)` | `border-black/20` | |

## Buscador y acciones del catálogo (1440×900)

| Medida | Alegra | Medoxigas | Nota |
| --- | --- | --- | --- |
| Caja del buscador | 585×40 px, radio 10, borde `#cbd5e1`, fondo blanco | 585×40 px, radio 10, borde `slate-300`, fondo blanco | Toma el espacio libre de la fila. |
| Icono lupa | 16 px, `#64748b`, a 11 px del borde | 16 px, `--pos-icono` | |
| Texto del buscador | 14 px, `#334155` | 14 px | Placeholder propio de Medoxigas. |
| Separación buscador → escáner | 6 px | 6 px (`gap-1.5`) | |
| Botón escáner | 42×40 px, radio 10, borde `rgba(148,163,184,.4)`, icono 20 | 42×40 px, radio 10, mismo borde, icono 20 | |
| Botón «Nuevo producto» | 151×40 px, radio 10, fondo `#cff2f1`, texto `#1a7e7f` 14/500 | 151×40 px, radio 10, mismo fondo/texto | En móvil queda solo el icono. |
| Margen de la fila | 24 px a los lados | 24 px en `sm+` (16 px en móvil) | |
| Fila de filtros | No existe (Alegra no tiene categorías aquí) | 32 px de alto debajo del buscador | Extra de Medoxigas: categoría, favoritos y conteo. |

## Tarjeta de producto

| Medida | Alegra | Medoxigas | Nota |
| --- | --- | --- | --- |
| Tamaño | 220×250 px (crece si el nombre ocupa 2 líneas) | 220×250 px (252 con 2 líneas) | |
| Radio / borde | 8 px / 2 px | 8 px / 2 px | Borde transparente; teal cuando está en el carrito. |
| Sombra | `1px 2px 5px rgba(0,0,0,.1)` | Igual | |
| Relleno | 10 px | 10 px (`p-2.5`) | |
| Caja del producto en la rejilla | 260×274 px (220 + 20 de margen por lado, 4 arriba, 20 abajo) | 260×274 px | `m-1 mx-5 mb-5`. |
| Zona de imagen | 196×98 px, empieza a 48 px del borde superior | 196×98 px a 48 px | |
| Icono sin foto | 64 px, `#d1d5db` | 64 px, `#d1d5db` | Icono `Tag` del repo. |
| Insignia de favorito | 28×32 px, esquina superior derecha, `#30aba9`, radios inferiores 8, estrella blanca 16 | 28×32 px, `#30aba9`, estrella 16 | Solo en favoritos; el resto lleva estrella gris discreta. |
| Chip de inventario | 16 px de alto, radio 8, fondo `#f9fafb`, `padding 0 8px`, texto 12 px `#30aba9` | Igual | «Inv. N». |
| Nombre | 14 px / 22 px, `#334155`, máximo 2 líneas con elipsis | 14 px / 22 px, en mayúsculas, 2 líneas | El mega plan pide el nombre en mayúsculas. |
| Precio | 16 px / 26 px, `#0f172a`, alineado al pie | 16 px / 26 px, `--pos-texto` | |
| «Agotado» | Chip de 16 px, fondo `#f9fafb`, texto y triángulo 12 px `#e85e42` | Igual | |
| Contador de cantidad | Círculo 22 px teal, esquina superior derecha, anillo blanco | 22 px, anillo blanco | |
| Tarjeta «Venta simple» | 220×250 px, borde `#e5e7eb`, círculo 100 px `#f1f5f9`, carrito+rayo, texto 16 px | 220×250 px, borde `#e5e7eb`, círculo 100 px, carrito+rayo del repo | |
| Rejilla | `flex-wrap`, `justify-content: space-around`; 3 columnas a 1440, 2 a 1024, 5 a 1920 | Igual | Con scroll propio en el catálogo. |

## Panel «Factura de venta»

| Medida | Alegra | Medoxigas | Nota |
| --- | --- | --- | --- |
| Ancho | 40 % del área tras el riel, máximo 550 px | `w-[40%] max-w-[550px]` | 550 px a 1440; 389 px a 1024. |
| Borde izquierdo | 1 px `#cbd5e1` | 1 px `slate-300` | |
| Encabezado | 60 px; título 18 px/700 `#334155`; 3 acciones de 40 px | Igual | Botón del rayo 28 px. |
| Etiquetas | 14 px/500 `#334155` | Igual | Lista de precio y Numeración. |
| Selects | 255×40 px, radio 10, borde `#cbd5e1` | 254×40 px, radio 10 | 254 = (550 − 32 de padding − 10 de gap) / 2. |
| Fila Cliente | 40 px de alto; botón «Nuevo» 40 px | Igual | «Nuevo» abre el diálogo real de contacto. |
| Renglón del carrito | Nombre en mayúsculas + precio unitario, stepper `− N +`, total a la derecha | Igual | |
| Pie | 119 px; «Vender» 455×43 px radio 5, 18 px, `#00b19d`; deshabilitado `#c2c9d6`; historial 44×45 radio 10 `#1e293b` | Igual | El total vive dentro de «Vender». |
| Fila «N Productos / Cancelar» | 509×43 px, radio 10, borde `#cbd5e1`, 14 px | Igual | |
| Pestañas de venta | **No** van dentro del panel: viven en la barra inferior | Fuera del panel | Punto 1 del mega plan. |

## Barra inferior

| Medida | Alegra | Medoxigas | Nota |
| --- | --- | --- | --- |
| Alto | 44 px | 44 px | |
| Pestaña activa | 160×43 px, icono 18, texto 14/500 `#474747`, acento teal | 160×43 px, icono 18, texto 14/500 | Subrayado teal abajo (como la captura 03). |
| Botón «+» | 44×40 px, borde derecho, icono 20 | 44×44 px, borde derecho, icono 20 | Abre otra venta en espera. |
| Estado del turno | No está en la barra (Alegra lo pone sobre el buscador) | A la derecha: punto + «Turno No N abierto» / «Turno cerrado» + «Cerrar/Abrir turno» | Decisión de Waldy (Punto 1). |
| Sheet móvil «Ver factura» | No aplica | `calc(100dvh - 44px)`, con el velo también 44 px arriba | Deja la barra visible al pie; el carrito termina encima. |

## Colores y tipografía

| Token / uso | Valor de Alegra | En Medoxigas |
| --- | --- | --- |
| Primario | `#00b19d` | `--pos-primario` |
| Hover del primario | `#008e79` | `--pos-primario-hover` |
| Favorito / acento de tarjeta | `#30aba9` | `bg-[#30aba9]` |
| Oscuro (botón ticket) | `#1e293b` | `--pos-oscuro` |
| Línea suave | `#e2e8f0` | `--pos-linea` |
| Borde de controles/panel | `#cbd5e1` | `border-slate-300` (claro) |
| Fondo de página | `#f1f5f9` | `bg-slate-100` (claro) |
| Fondo de panel interno | `#f8fafc` | `--pos-panel` |
| Texto principal | `#212529` / `#0f172a` | `--pos-texto` |
| Texto secundario | `#707070` / `#334155` / `#474747` | `--pos-texto-suave` / `text-[#334155]` / `text-[#474747]` |
| Iconos | `#94a3b8` / `#b3b3b3` | `--pos-icono` |
| Aviso «Agotado» | `#e85e42` | `text-[#e85e42]` |
| «Vender» deshabilitado | `#c2c9d6` | `disabled:bg-[#c2c9d6]` |
| «Nuevo producto» | `#cff2f1` / texto `#1a7e7f` | Igual en claro; `--pos-acento` en oscuro |
| Borde tarjeta «Venta simple» | `#e5e7eb` | Igual |
| Chip de inventario | `#f9fafb` | Igual |
| Placeholder de foto | `#d1d5db` | Igual |
| Tipografía | Inter (400/500/600/700) | Inter (`--font-inter`) |

## Rejilla por ancho

| Viewport | Área del catálogo | Columnas | Tarjetas visibles por fila |
| --- | --- | --- | --- |
| 1440×900 | 838 px | 3 | 220 px + 59 px de separación |
| 1024×600 | 583 px | 2 | 220 px + ~71 px de separación |
| 1920×1080 | 1318 px | 5 | 220 px + ~20 px de separación |

# Guía de diseño: vista de un documento guardado (factura, cotización, conduce), inspirada en Alegra

Para: Coder. Objetivo: que las vistas de documentos de **Medoxigas Contabilidad** (factura, cotización, conduce) se vean como las de Alegra.
Es una guía para **inspirarse**, no para copiar. No pegues `styles.css` de Alegra en el sistema.
Usa los valores de aquí con nuestras propias clases (Tailwind + shadcn).
Va junto con la guía del formulario: `../css-factura/GUIA-DISENO-FACTURA.md` (mismos colores y fuente).

## 0. De dónde salen los números

- Fuente: las 3 copias locales (`factura/`, `cotizacion/`, `conduce/`, cada una con `index.html` + `styles.css`), guardadas el 13/11/2026 de la cuenta de prueba Fiel Ferreteria. En Alegra son `/invoice/view/id/1`, `/estimate/view/id/1` y `/remission/view/id/1`.
- Medí en Chrome headless con puppeteer-core sobre el **archivo local** (`file://`). No abrí app.alegra.com para medir.
- Medí a **1280 px** de ancho. También a **1600 px** (la página se centra) y a **600 px** (móvil).
- Los valores son `getComputedStyle` y `getBoundingClientRect` (px reales), más las reglas CSS que los crean. Los colores van en hex. "/0.20" quiere decir 20 % de opacidad.
- El menú de los tres puntos no está en la copia (no tiene JS). Lo medí **píxel por píxel** en las capturas reales con Python (PIL). Comprobé la escala: el botón ⋮ mide 40 px en la captura y 40 px en el CSS, así que 1 px de captura = 1 px CSS. Esos valores pueden variar ±1 px y los marco con "≈".
- Nuestra versión (lo que hay que arreglar) la miré en las capturas de Coder (`../ref-vista/`). Ahí no hay CSS, así que esas diferencias son **a ojo**.
- Si algo no se pudo medir, lo digo con **(no medido)**.

Capturas (en `../capturas/`):

| Captura | Qué muestra |
|---|---|
| `19-vista-factura.png` | Vista de factura real de Alegra (arriba) |
| `19-vista-cotizacion.png` | Vista de cotización real |
| `19-vista-conduce.png` | Vista de conduce real |
| `19-vista-menu-tres-puntos.png` | Factura con el menú ⋮ abierto |
| `19-vista-menu-zoom.png` | Zoom 2x del menú ⋮ de la factura |
| `19-vista-menu-cotizacion-zoom.png` | Zoom 2x del menú ⋮ de la cotización (igual en el conduce) |
| `19-vista-nuestra-version-prueba.png` | El CSS y el HTML de la sección 8 abiertos en Chrome, con el azul de Medoxigas (prueba de que funcionan) |

En esta carpeta también están `vista-*-abajo.png` (parte de abajo), `vista-cotizacion-menu.png`, `vista-conduce-menu.png` y `*/copia-local.png`.

## 1. Resumen en 6 frases

1. La vista **no es una hoja de papel**. Es una columna de **tarjetas blancas** sobre fondo gris claro (`#f4f5fb`), de máximo **1040 px**, separadas **24 px**.
2. Arriba: enlace "← Volver a mis facturas", título de **20 px / 600** con una **etiqueta de estado** chica al lado, y a la derecha **botones de solo ícono de 40×40** (⋮, compartir, imprimir) más uno o dos botones con texto.
3. Las acciones raras (Anular, Clonar, Descargar PDF, notas de crédito…) van **dentro del menú ⋮**, no como botones sueltos.
4. Solo la factura tiene la tarjeta de **resumen con 4 montos** (Valor total, Valor retenido, Total cobrado, **Por cobrar en rojo**).
5. La tarjeta del documento usa **flexbox** para el encabezado (3 tercios), **CSS grid** para "Información" (3 columnas en factura, 2 en cotización/conduce, gap 32) y una **`<table>`** con borde y radio 16 para los productos.
6. Letra **Inter**, texto gris pizarra `#334155`, bordes `#e2e8f0`. El teal de Alegra (`#30aba9`) solo sale en el enlace de volver, "Ver más", la raya de la pestaña activa y el botón "Convertir". En nosotros es el azul `#1e56c7`.

## 2. Estructura y orden de los bloques

### 2.1 Marco

| Pieza | Valor medido |
|---|---|
| Fondo de la página | `#f4f5fb` |
| Área de contenido | padding **20 px** |
| Columna de la vista | **max-width 1040 px**, `margin: 0 auto`. A 1280 px mide 969 px. A 1600 px mide 1040 px y queda centrada (124.5 px a cada lado) |
| Barra lateral y barra superior | Igual que en la guía del formulario (271 px / 56 px). **No hay que copiarlas** |

### 2.2 Orden vertical (factura a 1280 px)

```
← Volver a mis facturas                                                  y=76   (12px, teal)
Factura de venta NCF B0100000001 [Por cobrar]      [⋮][⇪][⎙][+ Agregar pago]  y=100  ← flex, mb 24
┌─ RESUMEN (radio 16) ─────────────────────────────────────────────────────────┐ y=164
│ Valor total │ Valor retenido │ Total cobrado │ Por cobrar (rojo)             │ ← flex 4 × 1fr, alto 84
│                              Ver más ▾                                       │ ← 33 px
└──────────────────────────────────────────────────────────────────────────────┘ 120 px
┌─ DOCUMENTO (radio 12, padding 32) ───────────────────────────────────────────┐ y=308 (mt 24)
│ [Logo 300×117]        Fiel Ferreteria / correo          No. B0100000001      │ ← flex 3 × 1/3, mb 30
│ Información de la factura                                                    │
│ Cliente            │ RNC               │ Creación                            │ ← grid 3 col, gap 32
│ Vencimiento                                                                   │
│ Productos y servicios                                                (mt 40) │
│ ┌ tabla (borde, radio 16) ─────────────────────────────────────────────────┐ │
│ │ Producto │ Cantidad │ Precio │ Descuento │ Impuesto │ Subtotal          │ │ ← 40 px
│ │ fila 48 px …                                                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                             Subtotal ......... RD$  (mt 40) │ ← 320 px a la derecha
│                                             Total (20 px) .... RD$          │
└──────────────────────────────────────────────────────────────────────────────┘ alto 803
┌ Lista de precios / Almacén ┐ ┌ Archivos adjuntos  [Subir archivo] ┐          y=1135 (mt 24, gap 16)
┌─ Pagos asociados | Notas de crédito | Notas de débito | Contabilidad ────────┐ y=1317 (mt 24)
│ tabla de pagos + paginación "1-1 de 1"                                      │
┌─ Comentarios | Recordatorios ────────────────────────────────────────────────┐ y=1581 (mt 24, margen lateral 6)
```

Cotización y conduce: igual, pero **sin la tarjeta de resumen** (la tarjeta del documento empieza en y=164). Ver sección 6.

## 3. Bloque por bloque

### 3.1 Enlace "Volver"

- `nav` con `margin-bottom: 8px`. Dentro, flex con `gap: 4px`.
- Flecha (ícono 16×16) + texto **"Volver a mis facturas"** (o "…cotizaciones", "…conduces").
- Letra **12 px / 500 / 16 px**, color teal 700 **`#299e9c`**. Cursor de mano. Sin subrayado.

### 3.2 Título, estado y botones de arriba

- Contenedor: **flexbox** `gap: 16px; margin-bottom: 24px`. En fila desde **768 px**; debajo, en columna (los botones bajan debajo del título).
- Izquierda (`flex-grow: 1`): flex, `align-items: center; gap: 8px`:
  - `h1` **20 px / 600 / 28 px, `#0f172a`**. Texto: "Factura de venta NCF B0100000001", "Cotización 1", "Conduce 1".
  - Etiqueta de estado (ver 3.3).
- Derecha: flex, `gap: 8px`, `align-items: center`.
  - Factura: **[⋮] [compartir] [imprimir]** (40×40) + **"+ Agregar pago"** (outline, 36 px de alto, 145.5 px de ancho).
  - Cotización y conduce: **[⋮] [compartir] [imprimir]** + **"✎ Editar"** (outline, 36 px, 92.8 px) + **"Convertir ▾"** (relleno teal, 36 px, 114.3 px). Ver sección 5.
- Ojo: los botones de ícono miden **40 px** y los de texto **36 px**. Quedan centrados en vertical.

### 3.3 Etiqueta de estado

- `inline-flex`, `padding: 1px 5px`, borde 1 px, **radio 4 px**, letra **12 px / 500 / 16 px**. Alto 20 px. No es una píldora redonda.

| Estado | Fondo | Texto | Borde | De dónde |
|---|---|---|---|---|
| **Por cobrar** (factura) | `#fffbeb` | `#b45309` | `#b45309/0.15` | medido (clase `amber`) |
| **Sin facturar** (cotización y conduce) | `#fffbeb` | `#b45309` | `#b45309/0.15` | medido (misma clase `amber`) |
| **Cobrada** (factura pagada) | `#f0fdf4` | ≈ `#15803d` | verde/0.15 | ≈ medido en la captura de Coder (`ref-vista/alegra-factura-vista.png`) |
| Variante `primary` (teal) | teal 50 `#e9fafa` | teal 700 `#299e9c` | teal 700/0.15 | existe en el CSS; no vi qué estado la usa |
| Anulada, Vencida, Facturada… | — | — | — | **(no medido)** |

### 3.4 Tarjeta de resumen (solo factura)

- Caja: fondo blanco, borde 1 px **`#e2e8f0`**, **radio 16 px**, `overflow: hidden`, **sin sombra**. Alto 120 px.
- Fila: **flexbox**. Cada ítem `flex: 1 1 0`, padding **16 px**, borde derecho 1 px `#e2e8f0` (el último no). 4 ítems de 242 px a 1280 (259.8 px a 1600). Alto de fila 84 px + 1 px de línea abajo.
- Dentro de cada ítem: flex en columna, `gap: 4px`.
  - Etiqueta: **12 px / 500 / 16 px, `#64748b`**.
  - Monto: **20 px / 600 / 28 px, `#334155`**. **"Por cobrar" va en rojo `#be123c`** (rose-700).
- "Ver más ▾": barra de ancho completo, padding 8 px 16 px, borde arriba 1 px `#e2e8f0`, fondo blanco (**hover `#f8fafc`**). Texto **12 px / 500, teal `#30aba9`**, flecha 16 px a 4 px. Alto 33 px.
- Al abrir "Ver más" aparece una 2ª fila con **2 ítems**: "Notas de crédito" y "Notas de débito" (mismo estilo). Se abre con `grid-template-rows: 0fr → 1fr` en **0.3 s ease-in-out**.
- Responsive: **debajo de 768 px** cada ítem ocupa el 100 % (uno debajo de otro) y la línea pasa a ser **abajo** en vez de a la derecha.

### 3.5 Tarjeta del documento

| Propiedad | Valor |
|---|---|
| Fondo | `#ffffff` |
| Borde | 1 px `#94a3b8/0.20` |
| Radio | **12 px** |
| Sombra | **ninguna** (en el formulario sí había `shadow-sm`; aquí no) |
| Padding | **32 px** desde 768 px, 20 px desde 640 px, 12 px en móvil (clases `p-3 sm:p-5 md:p-8`) |
| Margen arriba | 24 px |
| Dentro | bloques normales (no es flex con gap). Separaciones con márgenes: 30 / 40 / 40 px (ver abajo) |

### 3.6 Encabezado: logo / empresa / número

- **Flexbox** en fila desde 768 px: `justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 30px`. Alto 117 px.
- 3 partes de **1/3** cada una (295.7 px a 1280; 319.3 px a 1600):

| Parte | Alineación | Medidas |
|---|---|---|
| Logo | izquierda | Caja `width:100%; max-width:300px; height:117px`, radio 8 px, fondo blanco, `overflow:hidden`. Imagen `object-fit: contain` |
| Empresa | centro | Nombre **16 px / 600 / 24 px `#334155`**. Debajo, **12 px / 400 / 16 px `#334155`**: el correo (y en la empresa real también "RNC: …" en otra línea, según la captura de Coder). Texto centrado |
| Número | derecha | **"No. B0100000001"** en **16 px / 600 / 24 px `#334155`**, alineado a la derecha. En cotización: "No. 1". No hay etiqueta "NCF" aparte ni tipo de comprobante aquí |

- Móvil (< 768 px): columna, `gap: 16px`, padding 12 px arriba y abajo, todo centrado.

### 3.7 "Información de la factura / de la cotización / del conduce"

- Título `h2`: **16 px / 600 / 24 px `#334155`**, `margin-bottom: 16px`.
- **CSS grid**: `grid-template-columns: repeat(3, minmax(0, 1fr))` en la factura y `repeat(2, minmax(0, 1fr))` en cotización y conduce. **`gap: 32px`** (filas y columnas).
- Columnas medidas a 1280: factura 3 × 279.7 px; cotización/conduce 2 × 435.5 px. A 1600: 3 × 303.3 px.
- Cada dato: flex en columna con **`gap: 8px`**:
  - Etiqueta (`h4`): **14 px / 500 / 20 px `#334155`**.
  - Valor: **14 px / 400 / 20 px `#334155`**.
  - **Cliente** es un enlace. En la factura: mismo 14 px, **sin subrayado** y subrayado al pasar el mouse. En cotización y conduce: **16 px / 24 px y siempre subrayado**.
- Campos por documento:
  - Factura: Cliente · RNC · Creación · Vencimiento (4 datos → 2 filas). En la factura real de Medoxigas (captura de Coder) sale "Tipo de pago" en lugar de RNC; depende de la factura.
  - Cotización: Cliente · Identificación · Fecha de creación · Fecha de vencimiento.
  - Conduce: Cliente · Fecha de creación · Fecha de vencimiento.
- Sin cajas, sin fondo gris, sin "Cliente:" en negrita en la misma línea. La etiqueta va **arriba** y el valor **abajo**.
- Responsive: **debajo de 640 px**, 1 columna.

### 3.8 "Productos y servicios" (tabla)

- Bloque con **`margin-top: 40px`**. Título `h3` **16 px / 700 (bold) / 24 px `#334155`**, **`margin-bottom: 24px`**. Ojo: aquí es **700**, no 600.
- Aquí **sí es una `<table>`** (no un grid). La envuelve una caja: fondo blanco, borde 1 px **`#e2e8f0`**, **radio 16 px**. En cotización/conduce además `overflow-x: auto`.
- **Encabezado** (`th`): alto **40 px**, padding `0 16px`, fondo **`#e2e8f0/0.20`**, letra **12 px / 500 / 16 px `#334155`**. Esquinas de arriba con radio 16 px (desde 768 px).
  - Entre columnas del encabezado hay un **separador vertical**: 1 px `#e2e8f0`, alto 60 % (≈ 24 px), a 8 px de arriba, pegado a la derecha de cada celda (menos la última).
- **Filas** (`td`): alto **48 px**, padding `0 16px`, letra **14 px / 400 / 20 px `#334155`**. Línea de 1 px `#e2e8f0` arriba de cada fila. La última fila no lleva línea abajo. Sin fondo alterno.
- **Nombre del producto**: enlace **subrayado**, 14 px, color `#334155` (no azul, no teal). Debajo puede ir la descripción en 12 px `#64748b` (vacía en la prueba).
- Columnas y anchos medidos (tabla de 901 px a 1280; 972 px a 1600):

| # | Columna | 1280 | 1600 | Alineación |
|---|---|---|---|---|
| 1 | Producto o servicios | 333.9 px | 404.9 px | izquierda (es la que crece) |
| 2 | Cantidad | 110 px | 110 px | **derecha** |
| 3 | Precio | 112 px | 112 px | **derecha** |
| 4 | Descuento | 112 px | 112 px | **derecha** |
| 5 | Impuesto | 114 px | 114 px | **derecha** |
| 6 | Subtotal | 119.1 px | 119.1 px | **derecha** |

- Formato de los números: la factura muestra `10`, `RD$650`, `0%`, `ITBIS 18%`, `RD$6,500.00`. La cotización y el conduce muestran `20.00`, `RD$380.00`, `0.00%`, `ITBIS 18.00%`. Para nosotros: usa un solo formato (recomiendo el de la factura con 2 decimales en dinero).
- No hay columna de número de línea, ni "Unidad", ni ⋮ por línea.
- A 600 px la tabla se aprieta (columnas de 84–119 px) y el encabezado sube a 48.5 px porque el texto se parte. No cambia a tarjetas.

### 3.9 Totales

- Bloque con **`margin-top: 40px`**.
  - Factura: es un grid de 2 columnas (`md:grid-cols-2`) con la izquierda vacía y los totales en la derecha (`justify-self: end`).
  - Cotización/conduce: flex en columna con `align-items: flex-end`.
  - Resultado igual: caja de **320 px** pegada a la derecha. En móvil la caja sigue de 320 px pero queda a la **izquierda**.
- Filas: `display:flex; justify-content:space-between`, alto 24 px, **sin espacio entre filas**, **16 px / 400 / 24 px `#64748b`**.
- **Total**: **20 px / 600 / 28 px `#0f172a`**, con **`margin-top: 28px`**. Sin línea, sin fondo.
- Filas de la factura: Subtotal · Descuento · **Monto gravado** · ITBIS (18%) · Total.
- Filas de cotización/conduce: Subtotal · Descuento · Subtotal (se repite) · ITBIS (18%) · Total. El "Subtotal" doble parece un detalle de Alegra; nosotros podemos poner "Monto gravado" como la factura.
- No hay "Total de líneas" ni el monto en letras.

### 3.10 Tarjetas de abajo: Lista de precios / Archivos adjuntos

- Contenedor: **flexbox**, `gap: 16px`, `margin-top: 24px`. En fila desde 768 px; en columna en móvil. Cada tarjeta `flex: 1 1 0` (476.5 px a 1280).
- Tarjeta: fondo blanco, borde 1 px **`#e2e8f0`**, **radio 8 px** (más chico que la del documento), padding **24 px 32 px**. Alto 158 px.
- **Lista de precios / Almacén**: flex en columna, `gap: 10px`. Cada fila: flex `justify-content: space-between`, `gap: 8px`, `padding-bottom: 8px`, **línea abajo 1 px `#e2e8f0`**. Etiqueta 14 px / 500, valor 14 px / 400, los dos `#334155`. En móvil el padding baja a 12 px.
- **Archivos adjuntos**: flex en columna, `gap: 16px`.
  - Título `h4` **14 px / 600 / 20 px `#334155`**.
  - Centro (flex en columna, centrado, `gap: 12px`): texto "Puedes subir archivos relacionados con esta venta" 14 px `#334155` y botón **"⤒ Subir archivo"** outline chico (**32 px** de alto, padding 5 px 16 px, radio 8 px, 142 px de ancho).
- Por documento: factura y conduce tienen las 2 tarjetas. **La cotización solo tiene "Lista de precios"** y ocupa todo el ancho.

### 3.11 Pestañas de documentos asociados

- Tarjeta: fondo blanco, borde 1 px `#94a3b8/0.20`, **radio 12 px**, padding **8 px 32 px 32 px**, `margin-top: 24px`.
- Pestañas: flex, `overflow-x: auto`. Cada pestaña: padding **8 px 24 px**, **14 px / 400 / 20 px**, sin salto de línea, línea abajo **1 px `#cbd5e1`**. Alto 37 px. La línea solo va bajo las pestañas, no a todo el ancho.
  - Inactiva: `#64748b`. Activa: `#334155`.
  - Raya de la activa: **2 px teal 500 `#30bbb7`**, ancho de la pestaña, abajo. Se mueve con `transform/width 0.11s ease-out`.
  - Hover: aparece una línea de 1 px `#94a3b8/0.40` abajo (0.11 s).
- Pestañas por documento:
  - Factura: **Pagos asociados · Notas de crédito · Notas de débito · Contabilidad**.
  - Cotización: **Facturas · Conduces**.
  - Conduce: **Facturas · Cotizaciones**.
- Contenido (`margin-top: 24px`):
  - **Tabla de pagos** (factura): misma tabla de 3.8 (borde, radio 16, encabezado 40 px, filas 48 px), columnas Fecha · Monto · Recibo de caja · Método de pago · Estado, todas a la **izquierda**. Las filas cambian a `#e2e8f0/0.45` al pasar el mouse. Abajo, **paginación**: alto 48 px, línea arriba, flex a la derecha con `gap: 16px`: "1-1 de 1" (14 px) + 2 botones ‹ › de 32×32 (deshabilitados: teal al 30 %).
  - **Vacío** (cotización/conduce): caja con borde 1 px `#e5e7eb`, radio 12 px, padding 16 px, `margin-top: 16px`, flex en columna centrado con `gap: 16px`. Ícono de 64 px `#6b7280`, texto "Aquí se mostrarán las facturas asociadas" en **24 px / 500 / 32 px `#6b7280`** y botón outline mediano **"Facturar cotización"** / **"Facturar conduce"** (36 px). Alto total 190 px.
- En móvil (< 768 px) la tabla de pagos se esconde y Alegra pone otra lista con JS. Esa lista **no está en la copia (no medido)**.

### 3.12 Comentarios / Recordatorios

- Tarjeta: borde 1 px `#94a3b8/0.40`, radio 12 px, `margin: 24px 6px` (6 px más adentro a los lados), `max-height: 80vh`, `overflow: hidden`. Alto 437 px.
- Pestañas "Comentarios" / "Recordatorios ⓘ" en **16 px / 400 / 24 px**, padding 8 px 24 px, alto 40 px. Raya teal de 2 px en la activa.
- Encabezado (padding 16 px, línea abajo): botón filtro + píldora "Recientes" (24 px de alto, radio 16 px, fondo teal 50 `#e9fafa`, borde teal/0.5, texto 13 px `#1a7e7f`).
- Vacío: padding 48 px 24 px, ícono de 64 px, "Aún no hay comentarios" 14 px `#64748b`.
- Caja para escribir: fondo `#f1f5f9`, padding 16 px 12 px; editor blanco con borde `#94a3b8/0.40`, radio 12 px; contador "0/1000" 12 px; botón enviar 32×32, radio 8 px.
- Para nosotros: **opcional**. Solo si queremos comentarios en documentos. Si no, se omite.

### 3.13 Breakpoints (@media)

Alegra usa los de Tailwind: **sm = 640 px, md = 768 px**.

| Ancho | Qué cambia |
|---|---|
| < 640 px | Información en **1 columna**. Tarjeta del documento con padding 12 px |
| ≥ 640 px | Información en 3 (factura) o 2 columnas. Padding 20 px |
| < 768 px | Título y botones en columna. Resumen: 1 ítem por fila. Encabezado del documento en columna y centrado. Totales a la izquierda. Tarjetas de abajo una debajo de otra. Tabla de pagos escondida |
| ≥ 768 px | Todo en fila. Padding del documento 32 px. Esquinas de la tabla redondeadas |
| contenido > 1040 px | La vista deja de crecer y se centra |

## 4. Tokens de diseño

### 4.1 Colores

| Uso | Hex | Tailwind |
|---|---|---|
| Fondo de la página | `#f4f5fb` | (propio) |
| Tarjetas | `#ffffff` | `white` |
| Título `h1`, Total, texto de botones outline | `#0f172a` | `slate-900` |
| Texto normal, etiquetas, valores, celdas, encabezado de tabla | `#334155` | `slate-700` |
| Etiquetas del resumen, filas de totales, pestaña inactiva | `#64748b` | `slate-500` |
| Texto del vacío | `#6b7280` | `gray-500` |
| Ítem deshabilitado del menú (Editar) | ≈ `#cbd5e1` | `slate-300` |
| Bordes de resumen, tablas, tarjetas chicas, menú | `#e2e8f0` | `slate-200` |
| Línea bajo las pestañas | `#cbd5e1` | `slate-300` |
| Borde de la tarjeta del documento y de pestañas | `#94a3b8` al 20 % | `slate-400/20` |
| Borde de botones outline y de comentarios | `#94a3b8` al 40 % | `slate-400/40` |
| Fondo del encabezado de tabla | `#e2e8f0` al 20 % | `slate-200/20` |
| Hover de filas | `#e2e8f0` al 45 % | `slate-200/45` |
| Hover de "Ver más" | `#f8fafc` | `slate-50` |
| Monto "Por cobrar" | `#be123c` | `rose-700` |
| "Anular" en el menú | ≈ `#e11d48` | `rose-600` |
| Etiqueta ámbar | fondo `#fffbeb`, texto `#b45309` | `amber-50` / `amber-700` |

Teal de Alegra: 600 `#30aba9` ("Ver más", "Convertir"), 700 `#299e9c` ("Volver a…"), 500 `#30bbb7` (raya de pestaña, anillo de foco), 50 `#e9fafa`.

### 4.2 Tipografía

Fuente **Inter**, luego Roboto, luego sans-serif (medido).

| Elemento | Tamaño | Peso | Alto de línea | Color |
|---|---|---|---|---|
| "← Volver a…" | 12 px | 500 | 16 px | teal 700 |
| Título `h1` | 20 px | 600 | 28 px | `#0f172a` |
| Etiqueta de estado | 12 px | 500 | 16 px | según estado |
| Etiqueta del resumen | 12 px | 500 | 16 px | `#64748b` |
| Monto del resumen | 20 px | 600 | 28 px | `#334155` / rojo |
| Nombre de la empresa, "No. …" | 16 px | 600 | 24 px | `#334155` |
| Correo / RNC de la empresa | 12 px | 400 | 16 px | `#334155` |
| Título "Información de…" | 16 px | 600 | 24 px | `#334155` |
| Título "Productos y servicios" | 16 px | **700** | 24 px | `#334155` |
| Etiqueta de dato | 14 px | 500 | 20 px | `#334155` |
| Valor de dato | 14 px | 400 | 20 px | `#334155` |
| Cliente (cotización/conduce) | 16 px | 400 | 24 px | `#334155`, subrayado |
| Encabezado de tabla | 12 px | 500 | 16 px | `#334155` |
| Celda de tabla | 14 px | 400 | 20 px | `#334155` |
| Filas de totales | 16 px | 400 | 24 px | `#64748b` |
| **Total** | **20 px** | **600** | 28 px | `#0f172a` |
| Tarjetas de abajo (títulos) | 14 px | 600 | 20 px | `#334155` |
| Pestañas de asociados | 14 px | 400 | 20 px | `#64748b` / `#334155` |
| Ítems del menú ⋮ | ≈ 14 px | 400 | ≈ 20 px | `#334155` |
| Botones | 14 px | 500 | 20 px | — |

### 4.3 Espacios

| Valor | Dónde |
|---|---|
| 4 px | ícono ↔ texto en botones y "Volver"; etiqueta ↔ monto en el resumen |
| 8 px | entre botones; "Volver" → título; etiqueta → valor; gap del encabezado del documento |
| 10 px | filas de "Lista de precios" |
| 16 px | padding de ítems del resumen y de celdas (lados); gap de tarjetas de abajo; título → grid de Información |
| 24 px | entre tarjetas; título de "Productos" → tabla; pestañas → contenido; padding vertical de tarjetas chicas |
| 30 px | encabezado del documento → Información |
| 32 px | padding del documento; gap del grid de Información; padding lateral de tarjetas chicas y pestañas |
| 40 px | Información → Productos; tabla → Totales |

### 4.4 Radios

| Radio | Dónde |
|---|---|
| 4 px | etiqueta de estado |
| 8 px | tarjetas chicas (Lista de precios, Archivos), caja del logo, botones chicos, menú ⋮ (≈) |
| 10 px | botones medianos (40×40 y 36 px) |
| 12 px | tarjeta del documento, pestañas de asociados, comentarios, vacío |
| 16 px | tarjeta de resumen y tablas |

### 4.5 Sombras

- Tarjetas y tablas: **sin sombra**. Solo borde.
- Menú ⋮: sombra suave que se desvanece ≈ 20 px hacia abajo y ≈ 10 px a los lados (≈ `shadow-lg`). Valor exacto **(no medido)**.
- Anillo de foco de botones: 2 px teal 500 con 1 px blanco de separación (visto en la captura con el menú abierto).

## 5. Menú de los tres puntos y botones

### 5.1 Botones de arriba

| Botón | Tipo | Tamaño | Padding | Radio | Fondo | Texto / ícono |
|---|---|---|---|---|---|---|
| ⋮ más acciones | outline, solo ícono | **40×40** | — | 10 px | blanco, borde 1 px `#94a3b8/0.40` | ícono 16 px `#0f172a` |
| Compartir (nodos) | igual | 40×40 | — | 10 px | igual | igual |
| Imprimir (impresora) | igual | 40×40 | — | 10 px | igual | igual |
| **+ Agregar pago** (factura) | outline con texto | 36 px de alto | 7 px 16 px | 10 px | igual | 14 px / 500 `#0f172a`, "+" de 16 px a 4 px |
| **✎ Editar** (cotización/conduce) | outline con texto | 36 px | 7 px 16 px | 10 px | igual | igual, lápiz 16 px |
| **Convertir ▾** (cotización/conduce) | relleno | 36 px × 114 px | 8 px 16 px | 10 px | teal `#30aba9` | blanco 14 px / 500; flecha ▾ de 16 px **después** del texto |

- Separación entre botones: **8 px**.
- ⋮ abierto: fondo ≈ `#eceff6` y anillo de foco teal de 2 px (medido en la captura).
- Hover de los outline **(no medido en esta vista)**. En el formulario era `#e2e8f0/0.45`.
- Qué hay dentro de "Convertir ▾" y de "Compartir" **(no medido)**. Compartir abre un modal (en la copia está escondido).

### 5.2 Menú ⋮ (medido en las capturas)

| Propiedad | Factura | Cotización / conduce |
|---|---|---|
| Posición | ≈ 4 px debajo del botón, alineado a su borde izquierdo | igual |
| Ancho | ≈ **210 px** | ≈ **185 px** |
| Alto | ≈ **352 px**, con **scroll** (barra visible) | ≈ **136 px**, sin scroll |
| Fondo / borde | blanco, 1 px `#e2e8f0` | igual |
| Radio | ≈ 8 px | igual |
| Padding vertical | ≈ 6 px | igual |
| Ítem | ≈ **36 px** de alto con 1 línea (56 px con 2). Padding ≈ 8 px 16 px | igual |
| Ícono | ≈ 16 px, a 16 px del borde izquierdo, color del texto | igual |
| Texto | ≈ 14 px / 20 px `#334155`, empieza a ≈ 37 px del borde. Si no cabe, **se parte en 2 líneas** ("Aplicar nota de / crédito") | igual |
| Separador | 1 px `#e2e8f0`, con ≈ 16 px de margen a cada lado y ≈ 6 px arriba y abajo | igual |
| Deshabilitado | texto e ícono ≈ `#cbd5e1` | — |
| Peligro | — | "Anular" en ≈ `#e11d48` con un ícono "—" del mismo color |
| Hover de ítem | **(no medido)** | **(no medido)** |

Opciones en orden:

- **Factura**: Editar (deshabilitado) · ─ · Descargar PDF · Imprimir copia · ─ · Aplicar nota de crédito · Aplicar nota de débito · Aplicar anticipo · Volver recurrente · ─ · Clonar · Ver versiones · Cerrar sin pagar · Editar retenciones · Anular. La captura solo deja ver hasta el 3er separador; los separadores de después de "Clonar" **no se ven (no medido)**.
- **Cotización y conduce**: Descargar PDF · Clonar · ─ · **Anular** (rojo).

Para nosotros: usa `DropdownMenu` de shadcn con `DropdownMenuSeparator` y `variant="destructive"` en Anular. Quita lo que no tengamos (anticipo, recurrente, versiones).

## 6. Diferencias entre factura, cotización y conduce

| Bloque | Factura | Cotización | Conduce |
|---|---|---|---|
| "Volver a…" | mis facturas | mis cotizaciones | mis conduces |
| Título | "Factura de venta NCF B0100000001" | "Cotización 1" | "Conduce 1" |
| Estado | "Por cobrar" (ámbar) | "Sin facturar" (ámbar) | "Sin facturar" (ámbar) |
| Botones con texto | + Agregar pago | ✎ Editar · Convertir ▾ | ✎ Editar · Convertir ▾ |
| Menú ⋮ | 12 opciones, con scroll | 3 opciones | 3 opciones |
| Tarjeta de resumen | **sí** | no | no |
| Grid de Información | **3 columnas** | **2 columnas** | **2 columnas** |
| Datos | Cliente, RNC, Creación, Vencimiento | Cliente, Identificación, Fecha de creación, Fecha de vencimiento | Cliente, Fecha de creación, Fecha de vencimiento |
| Cliente | 14 px, subrayado al pasar el mouse | 16 px, siempre subrayado | 16 px, siempre subrayado |
| Números de la tabla | `10`, `RD$650`, `0%` | `20.00`, `RD$380.00`, `0.00%` | igual que cotización |
| Totales | … Monto gravado … | … Subtotal (repetido) … | igual que cotización |
| Tarjetas de abajo | Lista de precios + Archivos adjuntos | **solo** Lista de precios (ancho completo) | Lista de precios + Archivos adjuntos |
| Pestañas | Pagos asociados · Notas de crédito · Notas de débito · Contabilidad | Facturas · Conduces | Facturas · Cotizaciones |
| Contenido de la pestaña | tabla de pagos con paginación | vacío + "Facturar cotización" | vacío + "Facturar conduce" |
| Alto total a 1280 | 1942 px | 1811 px | 1851 px |

Todo lo demás (tarjeta del documento, encabezado, tabla, totales, comentarios) es **igual** en las tres.

## 7. Diferencias con nuestra versión (de `../ref-vista/`)

Comparé `nuestra-factura.png` y `nuestro-conduce.png` con `alegra-factura-vista.png` y las copias locales. Son a ojo (no hay CSS nuestro medido). Código actual (solo lo leí, no lo toqué), en la rama `origin/prueba`:
`src/app/(main)/dashboard/facturacion/[id]/_components/vista-factura.tsx` y `factura-papel.tsx`; `src/app/(main)/dashboard/cotizaciones/_components/vista-documento.tsx` y `documento-papel.tsx` (cotización y conduce).

Lo que hay que cambiar, de lo más visible a lo menos:

1. **Hoja de papel → tarjetas.** Nuestra vista es una "hoja" blanca angosta dentro de un panel blanco, sin borde ni radio. En Alegra el fondo es gris `#f4f5fb` y el documento es una **tarjeta** de hasta 1040 px con borde `#94a3b8/0.20`, **radio 12** y padding 32. La hoja de papel debe quedar solo para imprimir/PDF.
2. **Barra de botones.** Nosotros: 5 botones con texto (Imprimir, Ver asiento, Nota de crédito, **Registrar pago** azul, **Anular** rojo). Alegra: **3 botones de ícono 40×40** (⋮, compartir, imprimir) + **un solo** botón con texto ("+ Agregar pago", outline, no relleno). Anular, Nota de crédito y "Ver asiento" van **dentro del menú ⋮** (en Alegra el asiento está en la pestaña "Contabilidad").
3. **Título.** Nosotros: "Factura #12" grande y flecha suelta a la izquierda. Alegra: enlace chico "← Volver a mis facturas" (12 px, color primario) **arriba** y título de **20 px / 600** con el **NCF** en el texto ("Factura de venta NCF B02…").
4. **Estado.** En la factura no mostramos estado. En el conduce usamos una píldora azul rellena ("Abierta"). Alegra: etiqueta **cuadrada de radio 4 px**, fondo claro, texto oscuro del mismo tono, 12 px ("Por cobrar"/"Sin facturar" en ámbar, "Cobrada" en verde).
5. **Falta la tarjeta de resumen** (Valor total, Valor retenido, Total cobrado, **Por cobrar en rojo**, "Ver más" con notas de crédito y débito). Solo en la factura.
6. **Encabezado.** Nosotros: logo + empresa + fechas a la izquierda y "Factura de Consumo / NCF / Vencimiento NCF" a la derecha. Alegra: **3 tercios**: logo (300×117) · empresa centrada (16 px / 600 + correo 12 px) · "No. B0200000005" a la derecha (16 px / 600). Las fechas **no** van en el encabezado.
7. **Datos del cliente.** Nosotros: caja gris con "Cliente:", "RNC:", "Teléfono:" en negrita en línea (y en el conduce, las fechas en la misma caja a la derecha). Alegra: título "Información de la factura" + **grid de 3 columnas** (2 en conduce/cotización), **gap 32**, etiqueta arriba (14 / 500) y valor abajo (14 / 400). Sin caja ni fondo. Las fechas van **dentro de este grid**.
8. **Tabla de productos.** Nosotros: sin borde, encabezado gris lleno, nombres de producto en **azul**, columnas Cantidad · Descripción · Unidad · Precio · Descuento · Impuesto · Valor (y el conduce con otro orden: Ítem · Precio · Cantidad…). Alegra: caja con **borde `#e2e8f0` y radio 16**, encabezado 40 px con fondo muy suave (`#e2e8f0/0.20`) y **separadores verticales**, filas de 48 px, producto **subrayado en gris pizarra**, orden **Producto · Cantidad · Precio · Descuento · Impuesto · Subtotal**, números a la derecha. Sin "Unidad". La columna se llama "Subtotal", no "Valor". Usar el mismo orden en los 3 documentos.
9. **Totales.** Nosotros: "Total de líneas: 1" y una barra gris con el monto en letras ("Setecientos sesenta y siete"); en la captura no se ve el bloque de totales arriba. Alegra: caja de **320 px a la derecha**, filas 16 px gris (Subtotal, Descuento, Monto gravado, ITBIS) y **Total 20 px / 600**, 28 px más abajo. Sin "Total de líneas" ni monto en letras (eso queda para el PDF si se quiere).
10. **Aviso azul del conduce.** Nosotros ponemos un recuadro ("Este conduce no mueve existencias…") arriba de todo. Alegra no tiene aviso. Si lo queremos, que sea texto chico gris o un tooltip, no una barra a todo el ancho.
11. **Falta todo lo de abajo**: tarjetas "Lista de precios / Almacén" y "Archivos adjuntos", pestañas "Pagos asociados / Notas de crédito / Notas de débito / Contabilidad" (factura) o "Facturas / Conduces" (cotización), y Comentarios (opcional).
12. **Botón Convertir.** Nosotros: "Convertir a factura" azul relleno solo. Alegra: **"✎ Editar"** outline + **"Convertir ▾"** relleno con flecha (menú con destinos).
13. **Tipografía.** La nuestra se ve más chica en el cuerpo del documento (a ojo ~12–13 px). En Alegra: datos y celdas a **14 px**, totales a **16 px**, Total a **20 px**.

## 8. Nuestra versión (reimplementación propia, inspirada en Alegra)

> Esto lo escribí desde cero con los valores medidos. **No es código de Alegra.** Las variables usan nuestros tokens de shadcn: el azul `--primary` (`#1e56c7`) toma el lugar del teal `#30aba9`.
> Está probado: `nuestra-version/prueba.html` (abre en Chrome) y la captura `../capturas/19-vista-nuestra-version-prueba.png`. A 969 px de ancho el grid de Información da **279.656 / 279.672 / 279.656 px**, igual que Alegra; `th` 40 px y `td` 48 px.

### 8.1 Mapa de colores Alegra → Medoxigas

| Alegra | Nuestro token |
|---|---|
| teal 600 `#30aba9` ("Ver más", "Convertir") | `var(--primary)` → `#1e56c7` |
| teal 700 `#299e9c` ("← Volver a…") | `var(--primary)` (o `--brand-dark #0a2352` si se ve muy fuerte) |
| teal 500 `#30bbb7` (raya de pestaña, foco) | `var(--primary)` / `var(--ring)` |
| teal 50 `#e9fafa` (etiqueta primary, "Recientes") | `var(--secondary)` `#eaf0fc` |
| `#334155` texto | `slate-700` (o `var(--foreground)` `#12233f`) |
| `#64748b` texto secundario | `slate-500` (o `var(--muted-foreground)` `#5b6b86`) |
| `#e2e8f0` bordes | `slate-200` (o `var(--border)` `#dbe3f2`) |
| `#f4f5fb` fondo | `bg-muted/40` o `slate-50` |
| `#be123c` Por cobrar | `rose-700` (o `var(--destructive)` `#c62f2f`) |
| `#e11d48` Anular | `var(--destructive)` |

### 8.2 CSS limpio (variables + flex/grid)

También está como archivo en `nuestra-version/vista.css`.

```css
/* vista-documento.css: reimplementación propia de Medoxigas, inspirada en Alegra.
   Valores medidos en la copia local de Alegra (13/11/2026). No es código de Alegra. */
.dv {
  --dv-primary: var(--primary, #1e56c7);       /* Alegra: teal 600 #30aba9 */
  --dv-primary-soft: var(--secondary, #eaf0fc); /* Alegra: teal 50 #e9fafa */
  --dv-ring: var(--ring, #1e56c7);              /* Alegra: teal 500 #30bbb7 */
  --dv-text: #334155;        /* slate-700 */
  --dv-strong: #0f172a;      /* slate-900 */
  --dv-muted: #64748b;       /* slate-500 */
  --dv-disabled: #cbd5e1;    /* slate-300 */
  --dv-line: #e2e8f0;        /* slate-200: bordes de tablas, tarjetas chicas, menú */
  --dv-line-strong: #cbd5e1; /* slate-300: línea bajo las pestañas */
  --dv-card-border: rgb(148 163 184 / 0.2);
  --dv-btn-border: rgb(148 163 184 / 0.4);
  --dv-head-bg: rgb(226 232 240 / 0.2);
  --dv-hover: rgb(226 232 240 / 0.45);
  --dv-danger: #be123c;      /* rose-700: monto "Por cobrar" */
  --dv-danger-menu: #e11d48; /* rose-600: "Anular" en el menú */
  --dv-r-sm: 8px; --dv-r-md: 10px; --dv-r-lg: 12px; --dv-r-xl: 16px;
  font-family: var(--font-inter, Inter), system-ui, sans-serif;
  color: var(--dv-text);
  max-width: 1040px;
  margin-inline: auto;
}
.dv *, .dv *::before, .dv *::after { box-sizing: border-box; }
.dv :where(p, h1, h2, h3, h4, dl, dd) { margin: 0; } /* :where = sin peso, no pisa .dv-title */

/* 1. Volver + título + estado + botones */
.dv-back { display: inline-flex; align-items: center; gap: 4px; margin-bottom: 8px;
  font-size: 12px; line-height: 16px; font-weight: 500; color: var(--dv-primary); text-decoration: none; }
.dv-heading { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
@media (min-width: 768px) { .dv-heading { flex-direction: row; } }
.dv-heading__title { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }
.dv-h1 { font-size: 20px; line-height: 28px; font-weight: 600; color: var(--dv-strong); }
.dv-tag { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; padding: 1px 5px;
  border: 1px solid; border-radius: 4px; font-size: 12px; line-height: 16px; font-weight: 500; white-space: nowrap; }
.dv-tag--amber { background: #fffbeb; color: #b45309; border-color: rgb(180 83 9 / 0.15); } /* Por cobrar, Sin facturar */
.dv-tag--green { background: #f0fdf4; color: #15803d; border-color: rgb(21 128 61 / 0.15); } /* Cobrada (aprox., captura de Coder) */
.dv-tag--primary { background: var(--dv-primary-soft); color: var(--dv-primary);
  border-color: color-mix(in srgb, var(--dv-primary) 15%, transparent); }
.dv-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }

/* Botones */
.dv-btn { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  height: 36px; padding: 7px 16px; border-radius: var(--dv-r-md); font-family: inherit; font-size: 14px; line-height: 20px; font-weight: 500; cursor: pointer; white-space: nowrap; }
.dv-btn:focus-visible { outline: none; box-shadow: 0 0 0 1px #fff, 0 0 0 3px var(--dv-ring); }
.dv-btn--outline { background: #fff; color: var(--dv-strong); border: 1px solid var(--dv-btn-border); }
.dv-btn--outline:hover, .dv-btn--outline[aria-expanded="true"] { background: #eceff6; } /* hover no medido; abierto ≈ #eceff6 */
.dv-btn--primary { background: var(--dv-primary); color: #fff; border: 0; padding: 8px 16px; }
.dv-btn--primary:hover { filter: brightness(0.92); }
.dv-btn--icon { width: 40px; height: 40px; padding: 0; }
.dv-btn--sm { height: 32px; padding: 5px 16px; border-radius: var(--dv-r-sm); }
.dv-btn--ghost { background: transparent; border: 0; color: var(--dv-primary); }
.dv-btn svg { width: 16px; height: 16px; flex-shrink: 0; }

/* Menú de los tres puntos */
.dv-menu-anchor { position: relative; }
.dv-menu { position: absolute; z-index: 50; top: calc(100% + 4px); left: 0; min-width: 185px; max-height: 352px;
  overflow-y: auto; padding: 6px 0; background: #fff; border: 1px solid var(--dv-line); border-radius: var(--dv-r-sm);
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1); }
.dv-menu--wide { width: 210px; }
.dv-menu__item { display: flex; align-items: flex-start; gap: 5px; width: 100%; padding: 8px 16px; border: 0;
  background: none; font-family: inherit; font-size: 14px; line-height: 20px; font-weight: 400; color: var(--dv-text); text-align: left; cursor: pointer; }
.dv-menu__item svg { width: 16px; height: 16px; margin-top: 2px; flex-shrink: 0; }
.dv-menu__item:hover { background: var(--dv-hover); } /* no medido */
.dv-menu__item[aria-disabled="true"] { color: var(--dv-disabled); cursor: not-allowed; background: none; }
.dv-menu__item--danger { color: var(--dv-danger-menu); }
.dv-menu__sep { height: 1px; margin: 6px 16px; background: var(--dv-line); }

/* 2. Tarjetas de resumen (solo factura) */
.dv-stats { background: #fff; border: 1px solid var(--dv-line); border-radius: var(--dv-r-xl); overflow: hidden; }
.dv-stats__row { display: flex; flex-wrap: wrap; }
.dv-stats__row:not(:last-child) { border-bottom: 1px solid var(--dv-line); }
.dv-stat { width: 100%; display: flex; flex-direction: column; gap: 4px; padding: 16px; border-bottom: 1px solid var(--dv-line); }
.dv-stat:last-child { border-bottom: 0; }
@media (min-width: 768px) {
  .dv-stats__row { flex-wrap: nowrap; }
  .dv-stat { flex: 1 1 0; width: auto; border-bottom: 0; border-right: 1px solid var(--dv-line); }
  .dv-stat:last-child { border-right: 0; }
}
.dv-stat__label { font-size: 12px; line-height: 16px; font-weight: 500; color: var(--dv-muted); }
.dv-stat__value { font-size: 20px; line-height: 28px; font-weight: 600; color: var(--dv-text); }
.dv-stat__value--danger { color: var(--dv-danger); }
.dv-stats__extra { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.3s ease-in-out; overflow: hidden; }
.dv-stats__extra[data-open="true"] { grid-template-rows: 1fr; }
.dv-stats__extra > div { min-height: 0; }
.dv-stats__more { display: flex; align-items: center; justify-content: center; gap: 4px; width: 100%; padding: 8px 16px;
  border: 0; border-top: 1px solid var(--dv-line); background: #fff; cursor: pointer;
  font-family: inherit; font-size: 12px; line-height: 16px; font-weight: 500; color: var(--dv-primary); }
.dv-stats__more:hover { background: #f8fafc; }

/* 3. Tarjeta del documento */
.dv-card { margin-top: 24px; padding: 12px; background: #fff; border: 1px solid var(--dv-card-border); border-radius: var(--dv-r-lg); }
@media (min-width: 640px) { .dv-card { padding: 20px; } }
@media (min-width: 768px) { .dv-card { padding: 32px; } }
.dv-head { display: flex; flex-direction: column; gap: 16px; padding-block: 12px; margin-bottom: 30px; }
.dv-head > * { width: 100%; min-width: 0; display: flex; justify-content: center; }
@media (min-width: 768px) {
  .dv-head { flex-direction: row; align-items: center; justify-content: space-between; gap: 8px; padding-block: 0; }
  .dv-head > * { width: 33.333%; }
  .dv-head__logo { justify-content: flex-start; }
  .dv-head__num { justify-content: flex-end; }
}
.dv-logo { width: 100%; max-width: 300px; height: 117px; display: flex; align-items: center; justify-content: center;
  border-radius: var(--dv-r-sm); overflow: hidden; background: #fff; }
.dv-logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
.dv-company { text-align: center; }
.dv-company__name { font-size: 16px; line-height: 24px; font-weight: 600; }
.dv-company__sub { font-size: 12px; line-height: 16px; }
.dv-number { font-size: 16px; line-height: 24px; font-weight: 600; text-align: center; }
@media (min-width: 768px) { .dv-number { text-align: right; } }

/* 4. Información (grid de etiqueta arriba y valor abajo) */
.dv-title { margin-bottom: 16px; font-size: 16px; line-height: 24px; font-weight: 600; }
.dv-info { display: grid; grid-template-columns: minmax(0, 1fr); gap: 32px; }
@media (min-width: 640px) {
  .dv-info--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); } /* factura */
  .dv-info--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); } /* cotización y conduce */
}
.dv-field { display: flex; flex-direction: column; gap: 8px; }
.dv-field__label { font-size: 14px; line-height: 20px; font-weight: 500; }
.dv-field__value { font-size: 14px; line-height: 20px; font-weight: 400; }
.dv-field__value a { color: inherit; text-decoration: none; }
.dv-field__value a:hover { text-decoration: underline; }
.dv-field__value--link a { font-size: 16px; line-height: 24px; text-decoration: underline; } /* cliente en cotización/conduce */

/* 5. Productos y servicios (tabla) */
.dv-items { margin-top: 40px; }
.dv-items__title { margin-bottom: 24px; font-size: 16px; line-height: 24px; font-weight: 700; }
.dv-table-wrap { overflow-x: auto; background: #fff; border: 1px solid var(--dv-line); border-radius: var(--dv-r-xl); }
.dv-table { width: 100%; border-collapse: collapse; }
.dv-table th { position: relative; height: 40px; padding: 0 16px; background: var(--dv-head-bg); text-align: left;
  font-size: 12px; line-height: 16px; font-weight: 500; color: var(--dv-text); white-space: nowrap; }
.dv-table th:not(:last-child)::after { content: ""; position: absolute; right: 0; top: 8px; width: 1px; height: 60%; background: var(--dv-line); }
.dv-table td { height: 48px; padding: 0 16px; border-top: 1px solid var(--dv-line); font-size: 14px; line-height: 20px; color: var(--dv-text); }
.dv-table .num { text-align: right; white-space: nowrap; }
.dv-table tbody tr.is-hover:hover { background: var(--dv-hover); }
.dv-item-link { color: var(--dv-text); text-decoration: underline; cursor: pointer; }
.dv-item-desc { font-size: 12px; line-height: 16px; color: var(--dv-muted); white-space: pre-line; }

/* 6. Totales */
.dv-totals-wrap { margin-top: 40px; display: flex; }
@media (min-width: 768px) { .dv-totals-wrap { justify-content: flex-end; } }
.dv-totals { width: 320px; max-width: 100%; font-size: 16px; line-height: 24px; color: var(--dv-muted); }
.dv-totals__row { display: flex; justify-content: space-between; gap: 16px; }
.dv-totals__total { margin-top: 28px; font-size: 20px; line-height: 28px; font-weight: 600; color: var(--dv-strong); }

/* 7. Tarjetas de abajo (Lista de precios / Archivos adjuntos) */
.dv-side { margin-top: 24px; display: flex; flex-direction: column; gap: 16px; }
@media (min-width: 768px) { .dv-side { flex-direction: row; } }
.dv-panel { flex: 1 1 0; min-width: 0; background: #fff; border: 1px solid var(--dv-line); border-radius: var(--dv-r-sm); padding: 24px 32px; }
.dv-panel--list { display: flex; flex-direction: column; gap: 10px; padding: 12px; }
@media (min-width: 768px) { .dv-panel--list { padding: 24px 32px; } }
.dv-kv { display: flex; justify-content: space-between; gap: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--dv-line); font-size: 14px; line-height: 20px; }
.dv-kv dt { font-weight: 500; }
.dv-panel--files { display: flex; flex-direction: column; gap: 16px; }
.dv-panel__title { font-size: 14px; line-height: 20px; font-weight: 600; }
.dv-files__body { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; font-size: 14px; line-height: 20px; }

/* 8. Pestañas de documentos asociados */
.dv-assoc { margin-top: 24px; padding: 8px 32px 32px; background: #fff; border: 1px solid var(--dv-card-border); border-radius: var(--dv-r-lg); }
.dv-tabs { display: flex; overflow-x: auto; }
.dv-tab { position: relative; padding: 8px 24px; border: 0; border-bottom: 1px solid var(--dv-line-strong); background: none;
  font-family: inherit; font-size: 14px; line-height: 20px; font-weight: 400; color: var(--dv-muted); white-space: nowrap; cursor: pointer; transition: color 0.11s ease-out; }
.dv-tab:hover:not([aria-selected="true"]) { box-shadow: inset 0 -1px 0 rgb(148 163 184 / 0.4); }
.dv-tab[aria-selected="true"] { color: var(--dv-text); }
.dv-tab[aria-selected="true"]::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--dv-primary); }
.dv-tabpanel { margin-top: 24px; }
.dv-pager { display: flex; justify-content: flex-end; align-items: center; gap: 16px; height: 48px; padding: 0 8px;
  border-top: 1px solid var(--dv-line); font-size: 14px; line-height: 20px; }
.dv-empty { margin-top: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;
  padding: 16px; border: 1px solid #e5e7eb; border-radius: var(--dv-r-lg); text-align: center; }
.dv-empty__text { font-size: 24px; line-height: 32px; font-weight: 500; color: #6b7280; }
```

### 8.3 Esqueleto HTML (nuestro): factura

```html
<!-- Vista de factura: reimplementación propia de Medoxigas, inspirada en Alegra. -->
<div class="dv">
  <a class="dv-back" href="/dashboard/facturacion">← Volver a mis facturas</a>
  <header class="dv-heading">
    <div class="dv-heading__title">
      <h1 class="dv-h1">Factura de venta NCF B0200000005</h1>
      <span class="dv-tag dv-tag--amber">Por cobrar</span>
    </div>
    <div class="dv-actions">
      <div class="dv-menu-anchor">
        <button class="dv-btn dv-btn--outline dv-btn--icon" aria-label="Más acciones" aria-haspopup="menu" aria-expanded="true">⋮</button>
        <div class="dv-menu dv-menu--wide" role="menu">
          <button class="dv-menu__item" role="menuitem" aria-disabled="true">✎ Editar</button>
          <div class="dv-menu__sep" role="separator"></div>
          <button class="dv-menu__item" role="menuitem">⤓ Descargar PDF</button>
          <button class="dv-menu__item" role="menuitem">⎙ Imprimir copia</button>
          <div class="dv-menu__sep" role="separator"></div>
          <button class="dv-menu__item" role="menuitem">⧉ Aplicar nota de crédito</button>
          <button class="dv-menu__item" role="menuitem">⧉ Aplicar nota de débito</button>
          <button class="dv-menu__item" role="menuitem">⧉ Aplicar anticipo</button>
          <button class="dv-menu__item" role="menuitem">⟳ Volver recurrente</button>
          <div class="dv-menu__sep" role="separator"></div>
          <button class="dv-menu__item" role="menuitem">⧉ Clonar</button>
          <button class="dv-menu__item" role="menuitem">Ver versiones</button>
          <button class="dv-menu__item" role="menuitem">Cerrar sin pagar</button>
          <button class="dv-menu__item" role="menuitem">Editar retenciones</button>
          <button class="dv-menu__item dv-menu__item--danger" role="menuitem">— Anular</button>
        </div>
      </div>
      <button class="dv-btn dv-btn--outline dv-btn--icon" aria-label="Compartir">⇪</button>
      <button class="dv-btn dv-btn--outline dv-btn--icon" aria-label="Imprimir">⎙</button>
      <button class="dv-btn dv-btn--outline">+ Agregar pago</button>
    </div>
  </header>

  <section class="dv-stats">
    <div class="dv-stats__row">
      <div class="dv-stat"><span class="dv-stat__label">Valor total</span><span class="dv-stat__value">RD$767.00</span></div>
      <div class="dv-stat"><span class="dv-stat__label">Valor retenido</span><span class="dv-stat__value">RD$0.00</span></div>
      <div class="dv-stat"><span class="dv-stat__label">Total cobrado</span><span class="dv-stat__value">RD$0.00</span></div>
      <div class="dv-stat"><span class="dv-stat__label">Por cobrar</span><span class="dv-stat__value dv-stat__value--danger">RD$767.00</span></div>
    </div>
    <div class="dv-stats__extra" data-open="false"><div><div class="dv-stats__row">
      <div class="dv-stat"><span class="dv-stat__label">Notas de crédito</span><span class="dv-stat__value">RD$0.00</span></div>
      <div class="dv-stat"><span class="dv-stat__label">Notas de débito</span><span class="dv-stat__value">RD$0.00</span></div>
    </div></div></div>
    <button class="dv-stats__more" aria-expanded="false">Ver más ▾</button>
  </section>

  <article class="dv-card">
    <header class="dv-head">
      <div class="dv-head__logo"><div class="dv-logo"><img src="logo.png" alt=""></div></div>
      <div class="dv-head__company"><div class="dv-company">
        <p class="dv-company__name">MEDOXIGAS ALC, SRL</p>
        <p class="dv-company__sub">RNC: 000000000</p><p class="dv-company__sub">correo@ejemplo.com</p>
      </div></div>
      <div class="dv-head__num"><p class="dv-number">No. B0200000005</p></div>
    </header>

    <section>
      <h2 class="dv-title">Información de la factura</h2>
      <dl class="dv-info dv-info--3">
        <div class="dv-field"><dt class="dv-field__label">Cliente</dt><dd class="dv-field__value"><a href="#">Cliente de prueba</a></dd></div>
        <div class="dv-field"><dt class="dv-field__label">RNC</dt><dd class="dv-field__value">000000000</dd></div>
        <div class="dv-field"><dt class="dv-field__label">Creación</dt><dd class="dv-field__value">13/11/2026</dd></div>
        <div class="dv-field"><dt class="dv-field__label">Vencimiento</dt><dd class="dv-field__value">13/12/2026</dd></div>
      </dl>
    </section>

    <section class="dv-items">
      <h3 class="dv-items__title">Productos y servicios</h3>
      <div class="dv-table-wrap"><table class="dv-table">
        <colgroup><col><col style="width:110px"><col style="width:112px"><col style="width:112px"><col style="width:114px"><col style="width:120px"></colgroup>
        <thead><tr><th>Producto o servicio</th><th class="num">Cantidad</th><th class="num">Precio</th><th class="num">Descuento</th><th class="num">Impuesto</th><th class="num">Subtotal</th></tr></thead>
        <tbody>
          <tr><td><a class="dv-item-link">Cemento gris</a><p class="dv-item-desc"></p></td>
            <td class="num">1</td><td class="num">RD$650.00</td><td class="num">0%</td><td class="num">ITBIS 18%</td><td class="num">RD$650.00</td></tr>
        </tbody>
      </table></div>
    </section>

    <section class="dv-totals-wrap"><div class="dv-totals">
      <div class="dv-totals__row"><span>Subtotal</span><span>RD$650.00</span></div>
      <div class="dv-totals__row"><span>Descuento</span><span>RD$0.00</span></div>
      <div class="dv-totals__row"><span>Monto gravado</span><span>RD$650.00</span></div>
      <div class="dv-totals__row"><span>ITBIS (18%)</span><span>RD$117.00</span></div>
      <div class="dv-totals__row dv-totals__total"><span>Total</span><span>RD$767.00</span></div>
    </div></section>
  </article>

  <div class="dv-side">
    <section class="dv-panel dv-panel--list"><dl style="margin:0;display:contents">
      <div class="dv-kv"><dt>Lista de precios</dt><dd>General</dd></div>
      <div class="dv-kv"><dt>Almacén</dt><dd>Principal</dd></div>
    </dl></section>
    <section class="dv-panel dv-panel--files">
      <h4 class="dv-panel__title">Archivos adjuntos</h4>
      <div class="dv-files__body"><p>Puedes subir archivos relacionados con esta venta</p>
        <button class="dv-btn dv-btn--outline dv-btn--sm">⤒ Subir archivo</button></div>
    </section>
  </div>

  <section class="dv-assoc">
    <div class="dv-tabs" role="tablist">
      <button class="dv-tab" role="tab" aria-selected="true">Pagos asociados</button>
      <button class="dv-tab" role="tab" aria-selected="false">Notas de crédito</button>
      <button class="dv-tab" role="tab" aria-selected="false">Notas de débito</button>
      <button class="dv-tab" role="tab" aria-selected="false">Contabilidad</button>
    </div>
    <div class="dv-tabpanel" role="tabpanel"><div class="dv-table-wrap">
      <table class="dv-table">
        <thead><tr><th>Fecha</th><th>Monto</th><th>Recibo de caja</th><th>Método de pago</th><th>Estado</th></tr></thead>
        <tbody><tr class="is-hover"><td>13/11/2026</td><td>RD$0.00</td><td>1</td><td>Transferencia</td><td>Abierto</td></tr></tbody>
      </table>
      <nav class="dv-pager"><span>1-1 de 1</span></nav>
    </div></div>
  </section>
</div>
```

### 8.4 Cambios para cotización y conduce

- Sin `<section class="dv-stats">`.
- Título "Cotización 1" / "Conduce 1" y etiqueta `dv-tag--amber` "Sin facturar".
- Botones: `[⋮][⇪][⎙]` + `<button class="dv-btn dv-btn--outline">✎ Editar</button>` + `<button class="dv-btn dv-btn--primary">Convertir ▾</button>`.
- Menú: Descargar PDF · Clonar · `dv-menu__sep` · `dv-menu__item--danger` Anular. Sin `dv-menu--wide`.
- Información: `dv-info dv-info--2` y cliente con `dv-field__value dv-field__value--link`.
- Cotización: en `.dv-side` solo la tarjeta `dv-panel--list`.
- Pestañas "Facturas / Conduces" (o "Facturas / Cotizaciones") con el vacío:

```html
<div class="dv-tabpanel" role="tabpanel">
  <div class="dv-empty">
    <svg width="64" height="64" aria-hidden="true"></svg>
    <p class="dv-empty__text">Aquí se mostrarán las facturas asociadas</p>
    <button class="dv-btn dv-btn--outline">Facturar cotización</button>
  </div>
</div>
```

Consejo: el texto del vacío en Alegra es de 24 px. Si se ve muy grande en nuestra app, 16 px / 500 también queda bien (eso ya es decisión nuestra, no medida).

### 8.5 Lo mismo en Tailwind v4 (para el `.tsx`)

| Pieza | Clases Tailwind |
|---|---|
| Página | `bg-slate-50` (o `bg-[#f4f5fb]`) y contenedor `mx-auto w-full max-w-[1040px]` |
| Volver | `mb-2 inline-flex items-center gap-1 text-xs font-medium text-primary` |
| Encabezado | `mb-6 flex flex-col gap-4 md:flex-row` → título `flex flex-1 items-center gap-2` → `h1 text-xl font-semibold text-slate-900` |
| Etiqueta de estado | `inline-flex items-center rounded px-[5px] py-px border text-xs font-medium` + ámbar `bg-amber-50 text-amber-700 border-amber-700/15` |
| Botón ícono | `<Button variant="outline" size="icon" className="size-10 rounded-[10px] border-slate-400/40">` |
| Botón texto | `<Button variant="outline" className="h-9 rounded-[10px] px-4 border-slate-400/40">` |
| Resumen | `overflow-hidden rounded-2xl border border-slate-200 bg-white` → fila `flex flex-wrap md:flex-nowrap` → ítem `flex w-full flex-col gap-1 border-b border-slate-200 p-4 last:border-0 md:flex-1 md:border-b-0 md:border-r` |
| Monto del resumen | `text-xl font-semibold text-slate-700` (Por cobrar `text-rose-700`) |
| Tarjeta del documento | `mt-6 rounded-xl border border-slate-400/20 bg-white p-3 sm:p-5 md:p-8` (`rounded-xl` = 14 px en nuestro tema; para 12 px usa `rounded-[12px]`) |
| Encabezado del documento | `mb-[30px] flex flex-col gap-4 py-3 md:flex-row md:items-center md:justify-between md:gap-2 md:py-0` y cada hijo `w-full min-w-0 md:w-1/3` |
| Información | `grid grid-cols-1 gap-8 sm:grid-cols-3` (o `sm:grid-cols-2`) → dato `flex flex-col gap-2` → etiqueta `text-sm font-medium text-slate-700`, valor `text-sm text-slate-700` |
| Título de productos | `mt-10 mb-6 text-base font-bold text-slate-700` |
| Tabla | `overflow-x-auto rounded-2xl border border-slate-200` → `th h-10 px-4 bg-slate-200/20 text-xs font-medium text-slate-700` → `td h-12 px-4 border-t border-slate-200 text-sm` |
| Totales | `mt-10 flex md:justify-end` → `w-80 text-base text-slate-500` → total `mt-7 text-xl font-semibold text-slate-900` |
| Tarjetas de abajo | `mt-6 flex flex-col gap-4 md:flex-row` → `flex-1 rounded-lg border border-slate-200 bg-white px-8 py-6` (`rounded-lg` = 10 px en nuestro tema; para 8 px usa `rounded-md`) |
| Pestañas | `mt-6 rounded-[12px] border border-slate-400/20 bg-white px-8 pb-8 pt-2` + `<Tabs>` con `TabsTrigger` `px-6 py-2 text-sm text-slate-500 border-b border-slate-300 data-[state=active]:text-slate-700 data-[state=active]:shadow-[inset_0_-2px_0_var(--primary)]` |
| Menú ⋮ | `<DropdownMenuContent align="start" className="min-w-[185px] max-h-[352px] rounded-md border-slate-200 py-1.5">` → ítems `px-4 py-2 text-sm text-slate-700` |

## 9. Lista para comparar (checklist de Coder)

Abre la nuestra y `../capturas/19-vista-factura.png` a 1280 px y revisa:

- [ ] Fondo gris claro y **tarjetas blancas** (no una hoja de papel). Máximo 1040 px y centrado a 1600 px.
- [ ] "← Volver a mis facturas" chico (12 px) **arriba** del título.
- [ ] Título de 20 px / 600 con el NCF y la **etiqueta de estado** cuadrada (radio 4).
- [ ] Botones: ⋮, compartir e imprimir de **40×40 solo ícono**, más **un solo** botón con texto (factura: "+ Agregar pago" outline).
- [ ] Anular, Nota de crédito, Descargar PDF, Clonar… **dentro del menú ⋮**, con separadores y Anular en rojo.
- [ ] Factura: tarjeta de **resumen** con 4 montos, "Por cobrar" en rojo y "Ver más".
- [ ] Tarjeta del documento: radio 12, borde suave, padding 32, **sin sombra**.
- [ ] Encabezado en **3 tercios**: logo · empresa centrada · "No. …" a la derecha.
- [ ] "Información de la factura" con **grid de 3 columnas** (2 en cotización/conduce), gap 32, etiqueta arriba y valor abajo. **Sin caja gris.**
- [ ] Tabla con **borde y radio 16**, encabezado 40 px con separadores, filas 48 px, producto subrayado en gris (no azul), números a la derecha.
- [ ] Columnas: Producto · Cantidad · Precio · Descuento · Impuesto · Subtotal, **igual en los 3 documentos**.
- [ ] Totales sin caja, **320 px a la derecha**, Total en 20 px / 600 con 28 px arriba. Sin "Total de líneas".
- [ ] Debajo: Lista de precios / Archivos adjuntos (2 tarjetas, gap 16) y la tarjeta de **pestañas** con su tabla o su vacío.
- [ ] Debajo de 768 px: todo en columna. Debajo de 640 px: Información en 1 columna.
- [ ] Letra Inter. Textos en gris pizarra, no negro puro.

## 10. Qué NO copiar

- **Logo y nombre de Alegra**, su teal, sus íconos y sus textos tal cual.
- Su `styles.css`, las clases `s-*`, `dui-*`, `sm-*` y los atributos `data-v-*` (son de Vue).
- El modal de "Compartir" (envía por correo/WhatsApp; nosotros no enviamos nada desde aquí sin aprobación de Waldy).
- Lo que no aplica: Almacén (inventario quedó fuera), anticipos, factura recurrente, "Ver versiones", si no los tenemos.
- El botón flotante de ayuda y "Te quedan 14 días gratis".

## 11. Lo que no se pudo medir

- **Hover** de los botones outline y de los ítems del menú ⋮ en esta vista.
- La **sombra exacta** del menú ⋮ (solo se ve que es suave, ≈ 20 px hacia abajo).
- La parte de abajo del menú de la factura (después de "Clonar"): si hay más separadores.
- Lo que hay dentro de **"Convertir ▾"** y el modal de **Compartir**.
- Los colores de otros estados: **Anulada, Vencida, Facturada, Cobrada parcial…** ("Cobrada" verde solo es aproximado, de la captura de Coder).
- La lista de pagos en **móvil** (Alegra la cambia con JS).
- Las pestañas Notas de crédito / Notas de débito / Contabilidad **abiertas** (solo se midió "Pagos asociados").
- "Ver más" **abierto** (la 2ª fila se midió en el HTML, pero no se vio abierta).
- El tamaño exacto de cada **ícono SVG** (se ven de 16 px; los de vacío, 64 px).
- Nuestra versión: sin CSS medido; las diferencias de la sección 7 son a ojo.

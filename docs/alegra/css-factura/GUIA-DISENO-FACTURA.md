# Guía de diseño: formulario "Nueva factura de venta" (inspirado en Alegra)

Para: Coder. Objetivo: que el formulario de factura de venta de **Medoxigas Contabilidad** se vea como el de Alegra.
Es una guía para **inspirarse**, no para copiar. No pegues `styles.css` de Alegra en el sistema.
Usa los valores de aquí con nuestras propias clases (Tailwind + shadcn).

## 0. De dónde salen los números

- Fuente: la copia local del formulario vacío (`index.html` + `styles.css` de esta carpeta), guardada el 13/11/2026 de la cuenta de prueba Fiel Ferreteria.
- Medí en Chrome headless con Playwright sobre el **archivo local** (`file://`). No usé app.alegra.com ni las cookies.
- Medí con ventanas de **1280 px** y **1600 px** de ancho. También probé 600 px para el móvil.
- Los valores son `getComputedStyle` (px reales) más las reglas CSS que los crean. Los colores van en hex. "/0.20" quiere decir 20 % de opacidad.
- Si algo no se pudo medir, lo digo con **(no medido)**.

Capturas nuevas (en `../capturas/`):

| Captura | Qué muestra |
|---|---|
| `18-guia-completa-1280.png` | Página entera a 1280 px |
| `18-guia-completa-1600.png` | Página entera a 1600 px (la tarjeta se centra) |
| `18-guia-movil-600.png` | A 600 px: todo pasa a 1 columna |
| `18-guia-barra-superior.png` | Pestañas "Factura convencional / rápida" y "Más ajustes" (zoom 2x) |
| `18-guia-encabezado.png` | Logo, empresa, comprobante + NCF (zoom 2x) |
| `18-guia-ajustes-info.png` | Fila Ajustes (5 columnas) e Información (3 columnas) (zoom 2x) |
| `18-guia-tabla-productos.png` | Tabla de productos (zoom 2x) |
| `18-guia-totales.png` | Bloque de totales (zoom 2x) |
| `18-guia-notas-terminos-pie.png` | Notas, Términos y Pie de factura (zoom 2x) |
| `18-guia-botones-pie.png` | Botones ⋮, Vista previa y Guardar (zoom 2x) |
| `18-guia-nuestra-version-prueba.png` | El CSS y el HTML de la sección 7 abiertos en Chrome, con el azul de Medoxigas (prueba de que funcionan) |

## 1. Resumen en 6 frases

1. Todo el formulario es **una sola tarjeta blanca**. No son varias tarjetas. Los bloques se separan con una **línea de 1 px**.
2. Las filas de campos usan **CSS grid** con columnas iguales: **5 columnas** en Ajustes y **3 columnas** en Información.
3. La tabla de productos también es **un solo CSS grid** de 8 columnas (anchos fijos + porcentajes). No usa `<table>`.
4. El encabezado, los totales y los botones usan **flexbox**.
5. La letra es **Inter**. El texto principal es gris pizarra (`#334155`). Los bordes son grises claros (`#cbd5e1`).
6. Solo hay un color de marca (teal `#30aba9`): asterisco, enlaces "+ Agregar…", botón Guardar y foco de los campos.

## 2. Estructura de la página

### 2.1 Marco de la app

| Pieza | Valor medido | Cómo está hecho |
|---|---|---|
| Fondo de la app | `#f4f5fb` | `.s-layout { background }` |
| Barra lateral | **271 px** de ancho, blanca, borde derecho 1 px `#e2e8f0` | flex en columna. Desde **1024 px** es fija a la izquierda. Debajo de 1024 px se esconde (`translate(-271px)`) |
| Ítem activo del menú | 32 px de alto, radio 6 px, fondo `#e2e8f0/0.45`, texto 14 px `#0f172a` | flex |
| Barra superior | **56 px** de alto, blanca, borde arriba y abajo 1 px `#e2e8f0`, padding `8px 16px` (24 px a los lados desde 1024 px) | flex, `space-between`, `align-items:center` |
| Área de contenido | padding **20 px** | flex en columna |
| Contenedor del formulario | **max-width 1040 px**, centrado con `margin: 0 auto` | A 1280 px mide 969 px (llena el espacio). A 1600 px mide 1040 px y queda centrado (124.5 px de margen a cada lado) |

En nuestra app la barra lateral y la barra superior ya existen (shadcn sidebar). **No hay que copiarlas.** Solo importa lo que está dentro del contenido.

### 2.2 Orden vertical

```
[Barra de arriba: pestañas Convencional/Rápida ........ botón IA  "Más ajustes"]   ← flex, margin-bottom 32px
┌─ TARJETA (una sola) ──────────────────────────────────────────────────────────┐
│ Encabezado: [Logo]        [Empresa + correo]        [Comprobante ▼ / NCF ✎]   │ ← flex 3 partes
│ Ajustes:   Moneda | Vendedor | Almacén | Centro de costo | Lista de precios   │ ← grid 5 col
│ ───────────────────────────────────────────────────────────────────────────── │ ← línea 1px
│ Información de la factura: Cliente* | Fecha de creación* | Fecha vencimiento* │ ← grid 3 col
│ ───────────────────────────────────────────────────────────────────────────── │
│ Productos y servicios   + Agregar Conduce                                      │
│ [☐][Producto][Cant][Precio][Descuento][Impuesto][Subtotal][⋮]                 │ ← grid 8 col
│ + Agregar línea                                                               │
│ Retenciones   + Agregar retención                                             │
│                                              Subtotal ........ RD$0.00        │ ← 320px a la derecha
│                                              Descuento ....... RD$0.00        │
│                                              Impuestos ....... RD$0.00        │
│                                              Total ........... RD$0.00 (grande)│
│ Notas  (texto gris "Agrega comentarios…" ✎)                                    │
│ Términos y condiciones (texto gris ✎)                                         │
│ Pie de factura (texto gris ✎)                                                 │
└───────────────────────────────────────────────────────────────────────────────┘
┌─ TARJETA 2: Pago recibido ......................................... + Agregar pago ┐
└───────────────────────────────────────────────────────────────────────────────┘
                                                   [⋮] [👁 Vista previa] [Guardar]   ← flex a la derecha
┌─ Comentarios / Recordatorios (no hace falta copiar) ──────────────────────────┐
```

## 3. La tarjeta principal

| Propiedad | Valor |
|---|---|
| Fondo | `#ffffff` |
| Borde | 1 px `#94a3b8/0.20` (gris muy suave) |
| Radio | **12 px** |
| Sombra | `0 1px 2px 0 rgba(0,0,0,0.05)` (es `shadow-sm` de Tailwind) |
| Padding | **32 px** desde 768 px. 20 px desde 640 px. 12 px en móvil |
| Dentro | `display:flex; flex-direction:column; gap:32px` (24 px desde 640, 16 px en móvil) |
| Centrada | Sí, por el contenedor de 1040 px |

Clases de Alegra (Tailwind): `p-3 sm:p-5 md:p-8 border border-slate-400/20 bg-white rounded-xl shadow-sm flex flex-col gap-4 sm:gap-6 md:gap-8`.

La 2ª tarjeta (Pago recibido) es parecida: padding 32 px, radio 12 px, borde 1 px `#ebecf1`, sin sombra. Está **fuera** de la tarjeta principal, 24 px más abajo.

## 4. Bloque por bloque (técnica y columnas)

### 4.1 Barra de arriba (fuera de la tarjeta)

- **Flexbox**: `flex justify-between items-center gap-16px`, `margin-bottom: 32px`. En móvil va en columna.
- Izquierda: el interruptor "Factura convencional / Factura rápida" (ver 6.4).
- Derecha: botón cuadrado de 40×40 (IA: leer factura desde un archivo) y botón **"Más ajustes"** (ver 6.5). Separación 8 px.

### 4.2 Encabezado (logo / empresa / comprobante + NCF)

- **Flexbox** en fila desde 768 px. En móvil va en columna.
- `justify-content: space-between; align-items: center; gap: 24px`.
- Padding vertical: **32 px** desde 1024 px, 24 px desde 768 px, 12 px en móvil. Alto total medido: 181 px.
- **3 partes iguales, cada una `w-1/3`** (285 px a 1280; 309 px a 1600):

| Parte | Alineación | Contenido y medidas |
|---|---|---|
| Logo | izquierda (centrado en móvil) | Caja **300×117 px**, radio 8 px, fondo blanco. Imagen con `object-fit: contain`. En móvil: `width:100%; max-width:300px` |
| Empresa | centro | Nombre **16 px / 600 / `#334155`**. Debajo el correo: **12 px / 400 / 16 px de alto de línea / `#334155`**. Texto centrado. Al pasar el mouse: fondo `#e2e8f0/0.8`, el texto baja a 35 % de opacidad y aparece un botón lápiz en el centro (transición 0.2 s) |
| Comprobante | derecha | Select "Crédito fiscal (01)" de **40 px** de alto y 285 px de ancho. Debajo, a 14 px (`mt-3.5`) y con 10 px de sangría: "NCF" en 16 px `#64748b` + el número `B0100000002` en 16 px `#334155` + botón engranaje de 40×40 ("Configurar numeración"). Separación 10 px (`gap-2.5`) |

### 4.3 Sección "Ajustes" (5 columnas)

- Título "Ajustes": **16 px / 600 / 24 px alto de línea / `#334155`**. Debajo del título: `margin-bottom: 16px`.
- **CSS grid**: `grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 16px` (1rem).
- Columnas medidas: 5 × 167.8 px a 1280. 5 × 182 px a 1600.
- Campos (de izquierda a derecha): **Moneda** ("DOP - Dominican Republic Peso"), **Vendedor** (vacío), **Almacén** ("Principal"), **Centro de costo** (vacío), **Lista de precios** ("General").
- Los 5 campos son selects **chicos (32 px)**. Ver 6.1.
- **Responsive:** debajo de **640 px** pasa a **1 columna** (`repeat(1, minmax(0,1fr))`).
- No lleva línea arriba. La línea gris va **antes** de la siguiente sección.

### 4.4 Sección "Información de la factura" (3 columnas)

- Empieza con la línea divisoria: alto **1 px**, color `#94a3b8/0.20`, ancho completo, `margin-bottom: 16px`.
- Título igual que "Ajustes" (16 px / 600) con 16 px abajo.
- **CSS grid**: `grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px` (2rem). Ojo: aquí el gap es **32 px**, no 16.
- Columnas medidas: 3 × 279.7 px a 1280. 3 × 303.3 px a 1600.
- Campos: **Cliente \*** (select, placeholder "Seleccionar"), **Fecha de creación \*** (fecha, hoy), **Fecha de vencimiento \*** (fecha, hoy).
- Estos 3 son campos **medianos (40 px)**.
- **Responsive:** debajo de 640 px, 1 columna.

### 4.5 "Productos y servicios" (tabla en grid)

- Empieza con la línea divisoria de 1 px + 16 px.
- La sección es flex en columna con `gap: 16px`.
- Fila de título: flex, `gap: 8px`. Título **16 px / 600 `#334155`**. Al lado, el botón texto "+ Agregar Conduce" (224 px de ancho, deshabilitado: teal al 30 %).
- **La tabla es UN solo `display: grid`** con todas las celdas como hijos directos (encabezado + filas + "Agregar línea"). No hay `<table>` ni `<tr>`.
- `grid-template-columns` (lo pone el JS de Alegra en línea):

```
44px  29%  7.39%  12.6%  148px  13.6%  13.48%  32px
```

- Sin `gap` entre columnas. La separación viene del padding de cada celda (`padding: 8px 4px 8px 0`).
- Ojo: 224 px fijos + 76.07 % suman **más del 100 %** cuando la tabla mide menos de unos 937 px. A 1280 px la tabla mide 903 px y las columnas suman 912 px: se pasa 9 px. En nuestra versión usa `fr` (sección 7.3) para que no se desborde.
- `min-width: 820px`. Si la pantalla es más chica, hay scroll horizontal.

Anchos medidos de cada columna:

| # | Columna | Ancho a 1280 | Ancho a 1600 | Alineación |
|---|---|---|---|---|
| 1 | Casilla / número de línea | 44 px | 44 px | centro |
| 2 | Producto o servicios | 262 px | 282 px | izquierda |
| 3 | Cantidad | 67 px | 72 px | izquierda |
| 4 | Precio | 114 px | 123 px | izquierda |
| 5 | Descuento | 148 px (fijo) | 148 px | izquierda |
| 6 | Impuesto | 123 px | 132 px | izquierda |
| 7 | Subtotal | 122 px | 131 px | **derecha** |
| 8 | Menú ⋮ | 32 px | 32 px | centro |

**Celda de encabezado:** alto **40 px**, fondo **`#f8fafc`**, borde abajo 1 px `#94a3b8/0.20`, letra **12 px / 500 / 16 px**, color `#6b7280`. Flex con `align-items:center`. La 1ª tiene una casilla (seleccionar todo).

**Fila de producto** (68 px de alto con la descripción):
- Col 1: número "1" en 12 px `#64748b`, alto de línea 40 px, centrado.
- Col 2: select chico (32 px) "Seleccionar". Debajo, el enlace "Agregar referencia y/o descripción ✎" en **12 px `#64748b`** (gap 4 px con el ícono).
- Col 3: Cantidad, campo chico, placeholder "0".
- Col 4: Precio, campo chico con prefijo "RD$" a la izquierda (caja de 36 px dentro del campo).
- Col 5: Descuento, campo chico con un selector "% ▾" a la izquierda + el número.
- Col 6: Impuesto, select chico ("Ninguno").
- Col 7: Subtotal "RD$0.00" en **14 px `#334155`**, alto de línea 32 px, a la derecha, `margin-top: 4px`.
- Col 8: botón ⋮ de 32×32, radio 8 px, color `#0f172a`.
- Mientras no hay producto, Cantidad/Precio/Descuento/Impuesto están **deshabilitados** (fondo `#f8fafc`, borde `#e2e8f0`, texto `#cbd5e1`).

**"+ Agregar línea":** ocupa toda la fila (`grid-column: 1 / -1`). Es un botón texto teal (ver 6.5).

**Barra de acciones masivas:** cuando marcas casillas aparece abajo una barra fija **oscura** (`#0f172a`, texto `#e2e8f0`) con "N seleccionados", "Aplicar descuento" y "Eliminar". En la copia está escondida. Es opcional.

**Responsive:** Alegra cambia a otra tabla para móvil con JavaScript (`items-table-mobile`). Esa versión **no está en la copia (no medido)**. En la copia a 600 px la tabla solo se aprieta.

### 4.6 Retenciones

- Bloque con `margin-top: 32px`.
- Título "Retenciones" 16 px / 600 `#334155`, `margin-bottom: 16px`.
- Botón texto chico "+ Agregar retención" (32 px de alto, teal). En móvil ocupa todo el ancho.

### 4.7 Totales

- **Flexbox**: la sección es `display:flex; justify-content:flex-end` desde 768 px (centrada en móvil). `margin-top: 32px` (24 px en sm, 16 px en móvil).
- Caja de totales: **320 px de ancho** (`w-80`). En móvil 100 %.
- Cada fila: `display:flex; justify-content:space-between`, alto 24 px, **sin separación** entre filas.
- Subtotal, Descuento, Impuestos: **16 px / 400 / `#64748b`**.
- **Total:** **20 px / 600 / 28 px alto de línea / `#0f172a`**, con **`margin-top: 28px`**. Sin línea encima. Sin fondo.
- Los montos van a la derecha con formato `RD$0.00`.

### 4.8 Notas, Términos y condiciones, Pie de factura

- Son 3 bloques iguales, uno debajo del otro (32 px entre ellos por el gap de la tarjeta).
- Cada bloque: `padding: 8px 0`, `cursor: pointer`, ancho completo.
- Título: **16 px / 600 / `#334155`**, `margin-bottom: 4px`.
- Debajo, un texto guía en **16 px `#94a3b8`** con un lápiz al final:
  - Notas: "Agrega comentarios para aclarar datos de la factura, serán visibles PDF"
  - Términos: "Agregue condiciones o cláusulas relacionadas con esta factura que serán visibles en el PDF"
  - Pie: "Agregue información, será visible en el PDF"
- Al hacer clic se abre un editor. En la copia no se abre, así que **el editor abierto no está medido**.
- No hay caja ni borde alrededor. Es solo texto.

### 4.9 Pago recibido (2ª tarjeta)

- Título "Pago recibido" 16 px / 600 `#334155`. Descripción "Puede agregar un pago ya recibido por esta venta." en 14 px `#64748b`.
- Botón texto "+ Agregar pago" a la derecha.
- Al abrirlo hay un grid de **5 columnas iguales con gap 16 px**: Numeración, Fecha, Cuenta bancaria, Método de pago, Valor. Los títulos van en una franja de fondo `#e2e8f0/0.40` con radio 8 px y padding 0 16 px. En la copia está cerrado, así que **el alto abierto no está medido**.
- Mensaje de ayuda: "Al guardar la factura, se creará un recibo de caja por un valor de RD$ 0.00", en 14 px `#64748b`.

### 4.10 Botones finales

- Van **fuera** de las tarjetas, `margin-top: 32px`.
- **Flexbox**: `flex-wrap: wrap; justify-content: flex-end; gap: 8px`.
- Orden: [⋮ más acciones 50×48] [👁 Vista previa] [**Guardar**]. Todos tamaño grande (48 px). Ver 6.5.
- No hay botón "Cancelar" visible. Se cancela con el menú lateral o con ⋮.

### 4.11 Breakpoints (@media) que cambian el formulario

Alegra usa los breakpoints de Tailwind: **sm = 640 px, md = 768 px, lg = 1024 px**.

| Ancho | Qué cambia |
|---|---|
| < 640 px | Ajustes e Información pasan a 1 columna. Tarjeta con padding 12 px y gap 16 px. Pestañas de 44 px de alto y ancho completo |
| ≥ 640 px | Ajustes 5 columnas, Información 3 columnas. Padding 20 px, gap 24 px. Pestañas de 48 px y mínimo 400 px |
| < 768 px | Encabezado en columna y centrado. Logo al 100 % (máx. 300 px). Totales al 100 % y centrados |
| ≥ 768 px | Encabezado en fila (3 × 1/3). Totales a la derecha (320 px). Padding de la tarjeta 32 px, gap 32 px |
| ≥ 1024 px | Barra lateral visible (271 px). Encabezado con 32 px arriba y abajo |
| contenido > 1040 px | El formulario deja de crecer y se centra |

## 5. Tokens de diseño

### 5.1 Colores

Alegra usa la paleta **slate** de Tailwind más su teal.

| Uso | Hex | Tailwind |
|---|---|---|
| Fondo de la app | `#f4f5fb` | (propio) |
| Tarjeta, campos | `#ffffff` | `white` |
| Títulos, etiquetas, texto de campos, montos de línea | `#334155` | `slate-700` |
| Texto "Total", ⋮, botones outline | `#0f172a` | `slate-900` |
| Pestaña activa | `#1e293b` | `slate-800` |
| Texto secundario (totales, NCF, descripción) | `#64748b` | `slate-500` |
| Texto base heredado, encabezado de tabla | `#6b7280` | `gray-500` |
| Placeholder, texto guía de Notas, pestaña inactiva | `#94a3b8` | `slate-400` |
| Texto deshabilitado | `#cbd5e1` | `slate-300` |
| Borde de campos | `#cbd5e1` | `slate-300` |
| Borde de campos al pasar el mouse | `#94a3b8` | `slate-400` |
| Borde deshabilitado/solo lectura, bordes de la barra | `#e2e8f0` | `slate-200` |
| Fondo deshabilitado y encabezado de tabla | `#f8fafc` | `slate-50` |
| Líneas divisorias, borde de la tarjeta | `#94a3b8` al 20 % | `slate-400/20` |
| Hover de botones texto/outline | `#e2e8f0` al 45 % | `slate-200/45` |
| Borde de botón outline | `#94a3b8` al 40 % | `slate-400/40` |

Teal de Alegra (variable `--sm-color-primary-*`):

| Tono | Hex | Para qué |
|---|---|---|
| 50 | `#e9fafa` | — |
| 100 | `#cff2f1` | Fondo de "Más ajustes" |
| 200 | `#b6ecea` | Hover de "Más ajustes" |
| 300 | `#9be4e0` | Clic de "Más ajustes" |
| 500 | `#30bbb7` | Borde de foco de los campos, anillo de foco, ícono IA |
| **600** | **`#30aba9`** | **Principal**: Guardar, enlaces "+ Agregar…", asterisco |
| 700 | `#299e9c` | Hover de Guardar |
| 800 | `#208d8d` | Clic de Guardar |
| 900 | `#1a7e7f` | Texto de "Más ajustes" |

Otro: la etiqueta "Beta" usa índigo (fondo `#eef2ff`, texto `#4338ca`, borde `#4338ca/0.15`).

### 5.2 Tipografía

- Fuente: **Inter** (fuente variable, pesos 100–900), luego Roboto, luego sans-serif.
- Base del cuerpo: 16 px / 24 px, peso 400.

| Elemento | Tamaño | Peso | Alto de línea | Color |
|---|---|---|---|---|
| Títulos de sección ("Ajustes", "Productos y servicios", "Notas"…) | 16 px | 600 | 24 px | `#334155` |
| Nombre de la empresa | 16 px | 600 | 24 px | `#334155` |
| Correo de la empresa | 12 px | 400 | 16 px | `#334155` |
| Etiqueta de campo | 14 px | 500 | 20 px | `#334155` |
| Asterisco obligatorio | 12 px | 400 | 16 px | `#30aba9` |
| Texto dentro de campo mediano (40 px) | 16 px | 400 | 24 px | `#334155` |
| Texto dentro de campo chico (32 px) | 14 px | 400 | 20 px | `#334155` |
| Encabezado de tabla | 12 px | 500 | 16 px | `#6b7280` |
| Descripción bajo el producto | 12 px | 400 | 16 px | `#64748b` |
| Subtotal de línea | 14 px | 400 | 32 px | `#334155` |
| Filas de totales | 16 px | 400 | 24 px | `#64748b` |
| **Total** | **20 px** | **600** | 28 px | `#0f172a` |
| Pestañas | 14 px (13 px en móvil) | 500 | 20 px | activo `#1e293b`, inactivo `#94a3b8`; letter-spacing −0.35 px |
| Botones medianos/chicos | 14 px | 500 | 20 px | — |
| Botones grandes (Guardar) | 16 px | 500 | 24 px | — |

No hay un título grande tipo "Nueva factura" dentro del formulario. El "título" es el interruptor de pestañas.

### 5.3 Espacios

Alegra usa la escala de Tailwind (múltiplos de 4 px):

| Valor | Dónde |
|---|---|
| 4 px | etiqueta → campo; título de Notas → texto; asterisco ↔ etiqueta |
| 8 px | entre botones; padding vertical de celdas y de Notas |
| 10 px | NCF: gap y sangría |
| 16 px | gap de Ajustes (5 col); título → campos; línea → título |
| 24 px | gap del encabezado |
| 32 px | gap de Información (3 col); padding de la tarjeta; espacio entre bloques; margen bajo la barra de pestañas |

### 5.4 Radios

| Radio | Dónde |
|---|---|
| 4 px | etiqueta Beta |
| 6 px | ítem del menú lateral |
| 8 px | campos chicos (32 px), botones chicos, caja del logo, pestaña activa, botón ⋮ |
| 10 px | campos medianos (40 px), fechas, botones medianos, contenedor de pestañas |
| 12 px | tarjetas, botones grandes (Guardar, Vista previa) |

Coincidencia útil: nuestro `--radius` ya es **0.625rem = 10 px**. Así `rounded-lg` = 10 px, `rounded-md` = 8 px y `rounded-xl` = 14 px. Para 12 px usa `rounded-[12px]`.

### 5.5 Sombras

- Tarjeta: `0 1px 2px 0 rgb(0 0 0 / 0.05)` (`shadow-sm`).
- Pestaña activa: `0 1px 2px rgba(15,23,42,.06), 0 1px 3px rgba(15,23,42,.04)`.
- Campos y botones: **sin sombra**.
- Anillo de foco de botones: 3 px en total (2 px de anillo + 1 px de separación) en teal 500 (`#30bbb7`).

### 5.6 Transiciones

- Pestañas: color, fondo y borde en **200 ms** `cubic-bezier(0.4, 0, 0.2, 1)`.
- Caja del logo: color/fondo/borde en 150 ms, misma curva.
- Botón lápiz de la empresa: opacidad en 200 ms.
- Flecha ▾ de los selects: `transform 0.14s ease-in` (gira al abrir).
- Barra lateral: 300 ms.
- Campos: **sin transición** en el borde (cambia de golpe).

## 6. Componentes

### 6.1 Campo de texto / select

Estructura: `[etiqueta]` arriba, a 4 px de la caja, y la caja con `[input][ícono ▾]` en flex.

| | Mediano (Cliente, Comprobante) | Chico (Ajustes, tabla) |
|---|---|---|
| Alto | **40 px** | **32 px** |
| Radio | 10 px | 8 px |
| Borde | 1 px `#cbd5e1` | igual |
| Fondo | `#ffffff` | igual |
| Padding del texto | 6 px 8 px | 6 px 8 px |
| Letra | 16 px / 24 px | 14 px / 20 px |
| Ícono ▾ | caja 40×40, padding 10 px, a la **derecha**, color `#64748b` | padding 8 px |

Estados:
- **Hover:** borde `#94a3b8`.
- **Foco** (`:focus-within` en la caja): borde de **2 px** en teal `#30bbb7`. Sin anillo ni sombra. El input no tiene outline.
- **Placeholder:** `#94a3b8`.
- **Deshabilitado:** fondo `#f8fafc`, borde `#e2e8f0`, texto y placeholder `#cbd5e1`, cursor normal.
- **Solo lectura:** fondo `#f8fafc`, borde `#e2e8f0`. Hover y foco no cambian el borde. Nota: el select de Comprobante es de solo lectura pero se midió con fondo blanco y borde `#cbd5e1`, así que algo lo sobreescribe.
- **Prefijo** (RD$, %): va dentro de la caja, a la izquierda, antes del input (caja de unos 36 px).
- **Error:** no hubo error en el formulario vacío **(no medido)**.

Consejo: con borde de 2 px en foco, el texto se mueve 1 px. Si no lo quieres, usa `box-shadow: inset 0 0 0 1px` encima del borde de 1 px, o `ring-1 ring-inset`.

### 6.2 Campo de fecha

- Alto **40 px**, radio 10 px, borde 1 px `#cbd5e1`, texto 16 px `#334155`.
- **Ícono de calendario a la izquierda.** Padding `7px 12px 7px 35px`. Color del ícono `#64748b`.
- Hover: borde `#94a3b8`. Placeholder `#94a3b8`.
- Formato del valor: `13/11/2026` (dd/mm/aaaa).
- Foco: no hay regla de foco propia en el CSS copiado **(no medido)**. Usa el mismo foco teal de 6.1.
- La etiqueta de la fecha es igual a la de 6.1 (14 px / 500), con 4 px abajo.

### 6.3 Etiqueta y asterisco

- Etiqueta: flex, `gap: 4px`, 14 px / 500 / 20 px, `#334155`.
- Asterisco: otro `<span>` **después** del texto, 12 px, color teal 600 `#30aba9` (no rojo).
- Obligatorios en el formulario: Cliente, Fecha de creación, Fecha de vencimiento.

### 6.4 Interruptor "Factura convencional / Factura rápida"

- Contenedor: flex, alto **48 px** (44 px en móvil), mínimo **400 px** de ancho (100 % en móvil), padding 4 px, borde 1 px `#e2e8f0`, fondo `#e2e8f0` al 45 %, radio **10 px**.
- Cada opción: `flex: 1`, centrada, padding 0 20 px, radio 8 px, 14 px / 500, letter-spacing −0.35 px. Medida: 195 × 38 px.
- **Activa:** fondo blanco, borde 1 px `#e2e8f0`, texto `#1e293b`, la sombra de 5.5.
- **Inactiva:** fondo y borde transparentes, texto `#94a3b8`. Hover: `#64748b`.
- Etiqueta "Beta" en la inactiva: 12 px / 500, padding 1 px 5 px, radio 4 px, índigo, `scale(0.85)`.
- Es un `role="tablist"` con botones `role="tab"`. Equivale a `Tabs` o `ToggleGroup` de shadcn.

### 6.5 Botones

Base de todos: `display:flex`, centrados, `gap: 4px`, peso 500, outline transparente, anillo de foco teal (5.5).

| Botón | Tipo | Alto | Padding | Radio | Fondo | Texto | Hover |
|---|---|---|---|---|---|---|---|
| **Guardar** | relleno grande | 48 px | 10 px 24 px | 12 px | `#30aba9` | blanco 16 px | `#299e9c` (clic `#208d8d`) |
| **Vista previa** | outline grande (con ícono ojo) | 48 px | 9 px 24 px | 12 px | blanco | `#0f172a` 16 px; borde 1 px `#94a3b8/0.40` | fondo `#e2e8f0/0.45` |
| ⋮ más acciones | outline grande, solo ícono | 48 × 50 px | 9 px 24 px | 12 px | blanco | `#0f172a` | igual |
| **Más ajustes** | "subtle" mediano | 36 px | 8 px 16 px | 10 px | `#cff2f1` | `#1a7e7f` 14 px | `#b6ecea` (clic `#9be4e0`) |
| Botón IA (archivo) | outline mediano, solo ícono | 40 × 40 px | — | 10 px | blanco, borde 1 px `#e2e8f0` | ícono `#30bbb7` | — |
| **+ Agregar línea**, + Agregar Conduce, + Agregar pago | texto mediano | 36 px | 8 px 16 px | 10 px | transparente | `#30aba9` 14 px | fondo `#e2e8f0/0.45` (clic 0.70) |
| + Agregar retención | texto chico | 32 px | 6 px 16 px | 8 px | transparente | `#30aba9` 14 px | igual |
| ⋮ de la línea | texto chico, solo ícono | 32 × 32 px | — | 8 px | transparente | `#0f172a` | igual |

Deshabilitado: relleno → fondo teal al 30 % y texto blanco al 90 %. Texto → teal al 30 %. Outline → texto `#0f172a` al 30 % y borde `#94a3b8/0.20`. Cursor `not-allowed`.

El "+" de los enlaces es un ícono SVG de unos 16 px, a 4 px del texto. No es un carácter.

### 6.6 Títulos de sección y divisores

- Título: `<h2>`/`<h3>`, 16 px / 600 / 24 px, `#334155`, sin línea debajo.
- Divisor: `<div>` de 1 px, `#94a3b8/0.20`, ancho completo, `margin-bottom: 16px`. Va **arriba** de Información y de Productos. No se usa `<hr>`.

### 6.7 Fila de productos

Ver 4.5. Las líneas no tienen borde ni fondo alterno. Solo el encabezado lleva fondo `#f8fafc` y línea inferior.

### 6.8 Totales

Ver 4.7. Es texto plano, sin caja ni fondo.

### 6.9 Qué hay detrás de "Más ajustes"

- Abre un panel lateral ("slideover"). En la copia el panel está **vacío** (`display:none`), así que su diseño **no está medido**.
- Por lo anotado en ALEGRA.md (secciones 2, 5.1 y 13.2), ahí van Moneda, Vendedor, Almacén, Centro de costo, Lista de precios y la plantilla de impresión. En la factura nueva esos campos **ya se ven** en la fila "Ajustes". El panel sirve para elegir cuáles mostrar.
- Para nosotros: basta con un `Sheet` de shadcn a la derecha con interruptores para mostrar u ocultar campos de "Ajustes".

### 6.10 Ignorar

- Botón flotante de ayuda (círculo teal abajo a la derecha).
- Bloque "Comentarios / Recordatorios".
- Barra "Te quedan 14 días gratis / Elegir plan".
- Botón de IA (leer factura de un archivo), salvo que se quiera más adelante.

## 7. Nuestra versión (reimplementación propia, inspirada en Alegra)

> Esto lo escribí desde cero con los valores medidos. **No es código de Alegra.** Usa nuestros tokens de shadcn. Si el preset es `medoxigas`, el azul `--primary` (`#1e56c7`) toma el lugar del teal.

### 7.1 Lo que ya tiene el repo (solo lectura, no toqué nada)

- Next.js 16, **Tailwind v4** (`@import "tailwindcss"` en `src/app/globals.css`), **shadcn** estilo `base-nova`, íconos **lucide**.
- Tema `src/styles/presets/medoxigas.css` (modo claro):
  - `--primary #1e56c7`, `--primary-foreground #ffffff`
  - `--foreground #12233f`, `--muted-foreground #5b6b86`
  - `--border` / `--input #dbe3f2`, `--ring #1e56c7`
  - `--secondary` / `--accent #eaf0fc` (texto `#0a2352`), `--muted #eef2f9`
  - `--destructive #c62f2f`, `--brand-dark #0a2352`, `--radius 0.625rem`
- Fuentes: `src/lib/fonts/registry.ts` ya trae **Inter** (`--font-inter`). Se activa con `data-font="inter"` en `<html>`.
- El formulario actual está en `src/app/(main)/dashboard/facturacion/nueva/_components/factura-form.tsx` (rama `origin/prueba`; en `main` no existe todavía). Diferencias con Alegra:
  - Usa **varias `Card`**. Alegra usa **una sola** tarjeta con divisores de 1 px.
  - Las líneas son un `grid-cols-12` con **etiqueta en cada línea**. Alegra tiene **una fila de encabezado** (40 px, fondo gris) y un solo grid de 8 columnas.
  - Cliente/fechas van en `md:grid-cols-3` con gap 16. Alegra usa **gap 32**. Además falta la fila "Ajustes" de 5 columnas.
  - Los totales van en una caja `bg-muted/50`. En Alegra son **texto plano** de 320 px a la derecha, con el Total en 20 px / 600 y 28 px de margen arriba.
  - Notas/Términos son `Collapsible` dentro de una `Card`. En Alegra son título + texto gris con lápiz.

### 7.2 Mapa de colores Alegra → Medoxigas

| Alegra | Nuestro token |
|---|---|
| teal 600 `#30aba9` (Guardar, enlaces, asterisco) | `var(--primary)` → `#1e56c7` |
| teal 500 `#30bbb7` (foco) | `var(--ring)` → `#1e56c7` |
| teal 100 / 900 ("Más ajustes") | `var(--secondary)` `#eaf0fc` / `var(--secondary-foreground)` `#0a2352` |
| `#334155` texto | `var(--foreground)` `#12233f` (o `slate-700` si quieren el gris de Alegra) |
| `#64748b` / `#94a3b8` | `var(--muted-foreground)` `#5b6b86` / `slate-400` |
| `#cbd5e1` borde de campos | `var(--input)` `#dbe3f2` (más claro; para el mismo contraste usa `slate-300`) |
| `#f8fafc` encabezado de tabla / deshabilitado | `var(--muted)` `#eef2f9` o `slate-50` |
| `#f4f5fb` fondo de la app | `bg-muted/40` o `slate-50` |
| hover de botones texto/outline `#e2e8f0/0.45` | `bg-accent` |

### 7.3 CSS limpio (variables + grid)

```css
/* factura-form.css — reimplementación propia de Medoxigas, inspirada en Alegra.
   Valores medidos en la copia local de Alegra (13/11/2026). */
.fx {
  --fx-primary: var(--primary, #1e56c7);
  --fx-primary-soft: var(--secondary, #eaf0fc);
  --fx-primary-soft-fg: var(--secondary-foreground, #0a2352);
  --fx-ring: var(--ring, #1e56c7);
  --fx-text: #334155;          /* slate-700 */
  --fx-text-strong: #0f172a;   /* slate-900 */
  --fx-text-muted: #64748b;    /* slate-500 */
  --fx-placeholder: #94a3b8;   /* slate-400 */
  --fx-disabled-text: #cbd5e1; /* slate-300 */
  --fx-border: #cbd5e1;        /* slate-300 */
  --fx-border-hover: #94a3b8;  /* slate-400 */
  --fx-border-soft: #e2e8f0;   /* slate-200 */
  --fx-divider: rgb(148 163 184 / 0.2);
  --fx-surface-2: #f8fafc;     /* slate-50 */
  --fx-hover: rgb(226 232 240 / 0.45);
  --fx-r-sm: 8px; --fx-r-md: 10px; --fx-r-lg: 12px;
  font-family: var(--font-inter, Inter), system-ui, sans-serif;
  color: var(--fx-text);
  max-width: 1040px; margin-inline: auto;
}

/* Barra de arriba */
.fx-toolbar { display: flex; flex-direction: column; gap: 16px; margin-bottom: 32px; }
@media (min-width: 640px) { .fx-toolbar { flex-direction: row; align-items: center; justify-content: space-between; } }
.fx-tabs { display: flex; height: 44px; width: 100%; padding: 4px; border: 1px solid var(--fx-border-soft);
  background: rgb(226 232 240 / 0.45); border-radius: var(--fx-r-md); }
@media (min-width: 640px) { .fx-tabs { height: 48px; width: auto; min-width: 400px; } }
.fx-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 20px;
  border: 1px solid transparent; border-radius: var(--fx-r-sm); font-size: 14px; font-weight: 500;
  letter-spacing: -0.35px; color: var(--fx-placeholder); transition: color .2s, background-color .2s, border-color .2s; }
.fx-tab[aria-selected="true"] { background: #fff; border-color: var(--fx-border-soft); color: #1e293b;
  box-shadow: 0 1px 2px rgb(15 23 42 / .06), 0 1px 3px rgb(15 23 42 / .04); }

/* Tarjeta única */
.fx-card { display: flex; flex-direction: column; gap: 16px; padding: 12px; background: #fff;
  border: 1px solid var(--fx-divider); border-radius: var(--fx-r-lg); box-shadow: 0 1px 2px rgb(0 0 0 / .05); }
@media (min-width: 640px) { .fx-card { gap: 24px; padding: 20px; } }
@media (min-width: 768px) { .fx-card { gap: 32px; padding: 32px; } }

/* Encabezado: 3 tercios */
.fx-head { display: flex; flex-direction: column; gap: 16px; padding-block: 12px; }
.fx-head > * { min-width: 0; display: flex; justify-content: center; }
@media (min-width: 768px) {
  .fx-head { flex-direction: row; align-items: center; justify-content: space-between; gap: 24px; padding-block: 24px; }
  .fx-head > * { width: 33.333%; }
  .fx-head__logo { justify-content: flex-start; }
  .fx-head__num { justify-content: flex-end; }
}
@media (min-width: 1024px) { .fx-head { padding-block: 32px; } }
.fx-logo { width: 100%; max-width: 300px; height: 117px; border-radius: var(--fx-r-sm); display: flex; align-items: center; justify-content: center; overflow: hidden; }
.fx-logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
.fx-company { text-align: center; }
.fx-company__name { font-size: 16px; font-weight: 600; line-height: 24px; }
.fx-company__sub { font-size: 12px; line-height: 16px; }
.fx-ncf { display: flex; align-items: center; gap: 10px; padding-left: 10px; margin-top: 14px; }
.fx-ncf__label { color: var(--fx-text-muted); }

/* Secciones y divisores */
.fx-divider { height: 1px; background: var(--fx-divider); margin-bottom: 16px; }
.fx-title { font-size: 16px; font-weight: 600; line-height: 24px; color: var(--fx-text); margin: 0 0 16px; }
.fx-grid-5, .fx-grid-3 { display: grid; grid-template-columns: minmax(0, 1fr); }
.fx-grid-5 { gap: 16px; }
.fx-grid-3 { gap: 32px; }
@media (min-width: 640px) {
  .fx-grid-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .fx-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

/* Campo */
.fx-field { display: flex; flex-direction: column; gap: 4px; }
.fx-label { display: flex; align-items: center; gap: 4px; font-size: 14px; font-weight: 500; line-height: 20px; color: var(--fx-text); }
.fx-req { font-size: 12px; line-height: 16px; color: var(--fx-primary); }
.fx-input { display: flex; align-items: center; height: 40px; background: #fff; border: 1px solid var(--fx-border);
  border-radius: var(--fx-r-md); overflow: hidden; }
.fx-input:hover { border-color: var(--fx-border-hover); }
.fx-input:focus-within { border-color: var(--fx-ring); box-shadow: inset 0 0 0 1px var(--fx-ring); } /* = borde de 2px sin mover el texto */
.fx-input > input, .fx-input > select { flex: 1; min-width: 0; height: 100%; padding: 6px 8px; border: 0; outline: 0;
  background: transparent; font-size: 16px; line-height: 24px; color: var(--fx-text); }
.fx-input > input::placeholder { color: var(--fx-placeholder); }
.fx-input__icon { display: flex; padding: 10px; color: var(--fx-text-muted); }
.fx-input__prefix { padding-left: 8px; font-size: 14px; color: var(--fx-text-muted); }
.fx-input--sm { height: 32px; border-radius: var(--fx-r-sm); }
.fx-input--sm > input, .fx-input--sm > select { font-size: 14px; line-height: 20px; }
.fx-input--sm .fx-input__icon { padding: 8px; }
.fx-input[data-disabled] { background: var(--fx-surface-2); border-color: var(--fx-border-soft); }
.fx-input[data-disabled] > * { color: var(--fx-disabled-text); }
.fx-input--date > input { padding: 7px 12px 7px 4px; }  /* el ícono va primero, a la izquierda */

/* Tabla de productos: un solo grid */
.fx-items-scroll { overflow-x: auto; }
/* Mismas proporciones que Alegra, pero con fr para que nunca se pase del 100 % (ver nota en 4.5). */
.fx-items { display: grid; min-width: 820px;
  grid-template-columns: 44px minmax(0, 29fr) minmax(0, 7.4fr) minmax(0, 12.6fr) 148px minmax(0, 13.6fr) minmax(0, 13.5fr) 32px; }
.fx-th { display: flex; align-items: center; height: 40px; background: var(--fx-surface-2);
  border-bottom: 1px solid var(--fx-divider); font-size: 12px; font-weight: 500; line-height: 16px; color: #6b7280; }
.fx-td { padding: 8px 4px 8px 0; }
.fx-center { justify-content: center; text-align: center; }
.fx-right { justify-content: flex-end; text-align: right; }
.fx-rownum { font-size: 12px; line-height: 40px; color: var(--fx-text-muted); text-align: center; }
.fx-desc-link { display: flex; align-items: center; gap: 4px; margin-top: 4px; font-size: 12px; line-height: 16px; color: var(--fx-text-muted); }
.fx-line-total { margin-top: 4px; font-size: 14px; line-height: 32px; text-align: right; }
.fx-items__add { grid-column: 1 / -1; }

/* Botones */
.fx-btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; font-weight: 500;
  border: 0; cursor: pointer; outline: 2px solid transparent; }
.fx-btn:focus-visible { box-shadow: 0 0 0 1px #fff, 0 0 0 3px var(--fx-ring); }
.fx-btn--md { height: 36px; padding: 8px 16px; border-radius: var(--fx-r-md); font-size: 14px; line-height: 20px; }
.fx-btn--sm { height: 32px; padding: 6px 16px; border-radius: var(--fx-r-sm); font-size: 14px; line-height: 20px; }
.fx-btn--lg { height: 48px; padding: 10px 24px; border-radius: var(--fx-r-lg); font-size: 16px; line-height: 24px; }
.fx-btn--primary { background: var(--fx-primary); color: #fff; }
.fx-btn--primary:hover { filter: brightness(.92); }
.fx-btn--soft { background: var(--fx-primary-soft); color: var(--fx-primary-soft-fg); }
.fx-btn--outline { background: #fff; color: var(--fx-text-strong); border: 1px solid rgb(148 163 184 / .4); padding-block: 9px; }
.fx-btn--link { background: transparent; color: var(--fx-primary); }
.fx-btn--outline:hover, .fx-btn--link:hover { background: var(--fx-hover); }
.fx-btn:disabled { opacity: .3; cursor: not-allowed; }
.fx-btn--icon { width: 32px; padding: 0; }  /* ⋮ de la línea: 32×32 */

/* Totales */
.fx-totals-wrap { display: flex; justify-content: center; margin-top: 16px; }
@media (min-width: 768px) { .fx-totals-wrap { justify-content: flex-end; margin-top: 32px; } }
.fx-totals { width: 100%; color: var(--fx-text-muted); font-size: 16px; line-height: 24px; }
@media (min-width: 768px) { .fx-totals { width: 320px; } }
.fx-totals__row { display: flex; justify-content: space-between; }
.fx-totals__total { margin-top: 28px; font-size: 20px; line-height: 28px; font-weight: 600; color: var(--fx-text-strong); }

/* Notas / Términos / Pie */
.fx-foot { padding: 8px 0; cursor: pointer; }
.fx-foot__title { margin-bottom: 4px; font-size: 16px; font-weight: 600; line-height: 24px; }
.fx-foot__hint { display: flex; align-items: center; gap: 4px; color: var(--fx-placeholder); }

/* Botones finales */
.fx-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: 32px; }
```

### 7.4 Esqueleto HTML (nuestro)

```html
<!-- Reimplementación propia de Medoxigas, inspirada en Alegra. -->
<div class="fx">
  <div class="fx-toolbar">
    <div class="fx-tabs" role="tablist">
      <button class="fx-tab" role="tab" aria-selected="true">Factura convencional</button>
      <button class="fx-tab" role="tab" aria-selected="false">Factura rápida</button>
    </div>
    <button class="fx-btn fx-btn--md fx-btn--soft">Más ajustes</button>
  </div>

  <form class="fx-card">
    <header class="fx-head">
      <div class="fx-head__logo"><div class="fx-logo"><img src="/logo.png" alt=""></div></div>
      <div class="fx-head__company"><div class="fx-company">
        <p class="fx-company__name">MEDOXIGAS ALC, SRL</p><p class="fx-company__sub">RNC · correo</p></div></div>
      <div class="fx-head__num"><div style="width:100%">
        <div class="fx-input"><select><option>Crédito fiscal (01)</option></select></div>
        <div class="fx-ncf"><span class="fx-ncf__label">NCF</span><span>Se asigna al guardar</span></div>
      </div></div>
    </header>

    <section>
      <h2 class="fx-title">Ajustes</h2>
      <div class="fx-grid-5">
        <label class="fx-field"><span class="fx-label">Moneda</span>
          <span class="fx-input fx-input--sm"><select><option>DOP</option></select></span></label>
        <!-- Vendedor · Almacén · Centro de costo · Lista de precios -->
      </div>
    </section>

    <section>
      <div class="fx-divider"></div>
      <h2 class="fx-title">Información de la factura</h2>
      <div class="fx-grid-3">
        <label class="fx-field"><span class="fx-label">Cliente <span class="fx-req">*</span></span>
          <span class="fx-input"><input placeholder="Seleccionar"><span class="fx-input__icon">▾</span></span></label>
        <label class="fx-field"><span class="fx-label">Fecha de creación <span class="fx-req">*</span></span>
          <span class="fx-input fx-input--date"><span class="fx-input__icon">📅</span><input value="13/11/2026"></span></label>
        <label class="fx-field"><span class="fx-label">Fecha de vencimiento <span class="fx-req">*</span></span>
          <span class="fx-input fx-input--date"><span class="fx-input__icon">📅</span><input value="13/11/2026"></span></label>
      </div>
    </section>

    <section>
      <div class="fx-divider"></div>
      <h3 class="fx-title">Productos y servicios</h3>
      <div class="fx-items-scroll"><div class="fx-items">
        <div class="fx-th fx-center"><input type="checkbox"></div>
        <div class="fx-th">Producto o servicio</div><div class="fx-th">Cantidad</div><div class="fx-th">Precio</div>
        <div class="fx-th">Descuento</div><div class="fx-th">Impuesto</div><div class="fx-th fx-right">Subtotal</div><div class="fx-th"></div>
        <!-- una línea = 8 celdas .fx-td -->
        <div class="fx-td"><p class="fx-rownum">1</p></div>
        <div class="fx-td"><span class="fx-input fx-input--sm"><input placeholder="Seleccionar"></span>
          <a class="fx-desc-link">Agregar referencia y/o descripción ✎</a></div>
        <div class="fx-td"><span class="fx-input fx-input--sm"><input placeholder="0"></span></div>
        <div class="fx-td"><span class="fx-input fx-input--sm"><span class="fx-input__prefix">RD$</span><input placeholder="0"></span></div>
        <div class="fx-td"><span class="fx-input fx-input--sm"><span class="fx-input__prefix">% ▾</span><input placeholder="0"></span></div>
        <div class="fx-td"><span class="fx-input fx-input--sm"><select><option>ITBIS 18%</option></select></span></div>
        <div class="fx-td"><p class="fx-line-total">RD$0.00</p></div>
        <div class="fx-td fx-center"><button type="button" class="fx-btn fx-btn--sm fx-btn--link fx-btn--icon" aria-label="Opciones">⋮</button></div>
        <div class="fx-items__add"><button type="button" class="fx-btn fx-btn--md fx-btn--link">+ Agregar línea</button></div>
      </div></div>
    </section>

    <section class="fx-totals-wrap"><div class="fx-totals">
      <div class="fx-totals__row"><span>Subtotal</span><span>RD$0.00</span></div>
      <div class="fx-totals__row"><span>Descuento</span><span>RD$0.00</span></div>
      <div class="fx-totals__row"><span>ITBIS</span><span>RD$0.00</span></div>
      <div class="fx-totals__row fx-totals__total"><span>Total</span><span>RD$0.00</span></div>
    </div></section>

    <section class="fx-foot"><h3 class="fx-foot__title">Notas</h3>
      <p class="fx-foot__hint">Agrega comentarios para aclarar datos de la factura ✎</p></section>
    <!-- Términos y condiciones · Pie de factura: igual -->
  </form>

  <div class="fx-actions">
    <button class="fx-btn fx-btn--lg fx-btn--outline">Vista previa</button>
    <button class="fx-btn fx-btn--lg fx-btn--primary">Guardar</button>
  </div>
</div>
```

### 7.5 Lo mismo en Tailwind v4 (para el `.tsx`)

Usa nuestros componentes (`Input`, `Combobox`, `NativeSelect`, `Button`, `Tabs`/`ToggleGroup`, `Sheet`) y cambia solo las clases:

| Pieza | Clases Tailwind |
|---|---|
| Contenedor | `mx-auto w-full max-w-[1040px]` |
| Barra de arriba | `mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between` |
| Pestañas (contenedor) | `flex h-11 w-full rounded-[10px] border border-slate-200 bg-slate-200/45 p-1 sm:h-12 sm:w-auto sm:min-w-[25rem]` |
| Pestaña activa / inactiva | `flex-1 rounded-lg border px-5 text-sm font-medium tracking-tight` + `border-slate-200 bg-white text-slate-800 shadow-sm` / `border-transparent text-slate-400 hover:text-slate-500` |
| Tarjeta única | `flex flex-col gap-4 rounded-[12px] border border-slate-400/20 bg-white p-3 shadow-sm sm:gap-6 sm:p-5 md:gap-8 md:p-8` |
| Encabezado | `flex flex-col gap-4 py-3 md:flex-row md:items-center md:justify-between md:gap-6 md:py-6 lg:py-8` y cada hijo `w-full min-w-0 md:w-1/3` |
| Título de sección | `mb-4 text-base font-semibold text-slate-700` |
| Divisor | `mb-4 h-px w-full bg-slate-400/20` (o `<Separator className="mb-4 bg-slate-400/20" />`) |
| Fila Ajustes | `grid grid-cols-1 gap-4 sm:grid-cols-5` |
| Fila Información | `grid grid-cols-1 gap-8 sm:grid-cols-3` |
| Campo (contenedor) | `flex flex-col gap-1` |
| Etiqueta | `flex items-center gap-1 text-sm font-medium text-slate-700` + asterisco `text-xs text-primary` |
| Input mediano | `h-10 rounded-[10px] border-slate-300 bg-white px-2 text-base text-slate-700 placeholder:text-slate-400 hover:border-slate-400 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary` |
| Input chico | `h-8 rounded-lg px-2 text-sm` + lo mismo |
| Deshabilitado | `disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300` |
| Tabla (grid) | `grid min-w-[820px] grid-cols-[44px_minmax(0,29fr)_minmax(0,7.4fr)_minmax(0,12.6fr)_148px_minmax(0,13.6fr)_minmax(0,13.5fr)_32px]` dentro de `overflow-x-auto` |
| Celda encabezado | `flex h-10 items-center border-b border-slate-400/20 bg-slate-50 text-xs font-medium text-gray-500` |
| Celda | `py-2 pr-1` |
| Agregar línea | `col-span-full` + `<Button variant="ghost" className="h-9 text-primary hover:bg-slate-200/45">` |
| Totales | `mt-4 flex justify-center sm:mt-6 md:mt-8 md:justify-end` → `w-full text-base text-slate-500 md:w-80` → filas `flex justify-between` → total `mt-7 text-xl font-semibold text-slate-900` |
| Notas/Términos/Pie | `w-full cursor-pointer py-2` → `mb-1 text-base font-semibold text-slate-700` → `flex items-center gap-1 text-slate-400` |
| Botones finales | `mt-8 flex flex-wrap justify-end gap-2` → `h-12 rounded-[12px] px-6 text-base` |
| Más ajustes | `<Button variant="secondary" className="h-9 rounded-[10px] px-4 text-sm">` |

Fuente: para que se parezca, pon `data-font="inter"` en `<html>` (ya existe en `layout.tsx`) o `font-[var(--font-inter)]` solo en el formulario.

## 8. Lista para comparar (checklist de Coder)

Abre el nuestro y `capturas/18-guia-completa-1280.png` a 1280 px y revisa:

- [ ] Hay **una sola tarjeta** blanca (radio 12, borde gris suave, `shadow-sm`, padding 32) y no varias `Card`.
- [ ] Ancho máximo **1040 px** y centrado en pantallas grandes (probar a 1600 px).
- [ ] Encabezado en **3 tercios**: logo a la izquierda (300×117), empresa al centro, comprobante + NCF a la derecha.
- [ ] Fila **Ajustes** con **5 columnas iguales** y gap 16, con campos de 32 px.
- [ ] **Línea de 1 px** antes de Información y antes de Productos.
- [ ] Información con **3 columnas** y gap **32** (no 16), con campos de 40 px.
- [ ] Etiqueta arriba (14 px / 500), a 4 px del campo. Asterisco en el color primario, **no rojo**.
- [ ] Fechas con el **ícono a la izquierda**. Selects con **▾ a la derecha**.
- [ ] Foco: borde de 2 px en el color primario. Hover: borde un tono más oscuro.
- [ ] Tabla con **fila de encabezado** de 40 px, fondo gris claro y letra de 12 px. **Sin etiquetas repetidas** en cada línea.
- [ ] Columnas en el orden: casilla/n.º · Producto · Cantidad · Precio · Descuento · Impuesto · Subtotal (a la derecha) · ⋮.
- [ ] "Agregar referencia y/o descripción" debajo del producto, en 12 px gris.
- [ ] "+ Agregar línea" como **enlace de color** (botón texto), no como botón con borde.
- [ ] Totales **sin caja**, 320 px, pegados a la derecha. Total en **20 px semibold**, 28 px más abajo.
- [ ] Notas / Términos / Pie como **título + texto gris con lápiz**.
- [ ] Botones finales fuera de la tarjeta, a la derecha: Vista previa (outline) y **Guardar** (relleno), de 48 px.
- [ ] Por debajo de 640 px todo queda en 1 columna. La tabla hace scroll horizontal.
- [ ] Letra Inter. Textos en gris pizarra, no negro puro.

## 9. Qué NO copiar

- **Logo y nombre de Alegra**, la etiqueta "Beta" y el botón de IA.
- **El teal de Alegra.** Usa el azul de Medoxigas (`--primary #1e56c7`) y sus tokens (sección 7.2).
- Su `styles.css`, las clases `s-*`, `dui-*`, `sm-*` y los atributos `data-v-*`. Son de Vue y no sirven en React.
- Las fuentes en base64 del CSS. Ya tenemos Inter con `next/font`.
- La barra lateral, la barra superior, el botón flotante de ayuda, "Comentarios/Recordatorios" y "Te quedan 14 días gratis".
- Los textos de Alegra tal cual. Escribe los nuestros ("ITBIS" en vez de "Impuestos", por ejemplo).
- Lo que no aplica a nosotros: "+ Agregar Conduce" (solo si tenemos conduces) y Almacén (Waldy dejó inventario fuera).

## 10. Lo que no se pudo medir

- El panel de **"Más ajustes"** abierto: está vacío en la copia.
- La **tabla de productos en móvil** de Alegra: la cambia el JavaScript, y la copia no tiene JS.
- El **foco** del campo de fecha: no hay regla propia en el CSS. Se supone igual al de los demás campos.
- El **estado de error** de un campo: el formulario estaba vacío y sin errores.
- Los **menús abiertos**: lista del select, calendario, menú ⋮.
- El editor de **Notas/Términos/Pie** abierto y la tabla de **Pago recibido** abierta.
- El tamaño exacto de los **íconos SVG**. Se ven de unos 16–20 px, pero no los medí uno por uno.

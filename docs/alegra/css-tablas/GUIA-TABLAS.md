# Guía de diseño: tabla de listas (facturas de venta), inspirada en Alegra

Para: Coder. Objetivo: que las listas de **Medoxigas Contabilidad** (facturas, contactos, productos, pagos…) se vean como las de Alegra.
Es una guía para **inspirarse**, no para copiar. No pegues CSS ni HTML de Alegra en el sistema.
Va junto con las otras guías: `../css-vista/GUIA-VISTA.md`, `../css-factura/GUIA-DISENO-FACTURA.md`, `../css-pagos/GUIA-FORMULARIOS.md`, `../css-inicio/GUIA-INICIO.md` (mismos colores y fuente).

## 0. De dónde salen los números

- Fuente: la lista **Facturas de venta** de Alegra (`/invoice`, menú Ingresos → Facturas de venta), medida **en vivo** en app.alegra.com con la cuenta de prueba Fiel Ferreteria, con puppeteer sobre el Chrome de la caja. Ventana de **1600 × 950**.
- Los valores son `getComputedStyle` y `getBoundingClientRect` (px reales). Los colores van en hex.
- La copia local `facturas/` (index.html + styles.css) sirve para verla sin internet; la clase base es `s-table`.
- De las variantes (contactos, productos, estado vacío inicial) se usaron las capturas del repo `../capturas/`; lo sacado de ahí es **píxel a píxel** y va marcado con **≈**.
- Ojo con el zoom: una captura anterior de Waldy (a 1920 px) salió con zoom ~125 %: allí las filas miden 60 px y la cabecera 50 px. **Los valores reales (100 %) son 48 y 40 px.** Donde algo solo se midió en esa captura va marcado **≈**.
- Si algo no se pudo medir, lo digo con **(no medido)**.

Capturas (en `../capturas/`):

| Captura | Qué muestra |
|---|---|
| `21-tabla-facturas.png` | Lista de facturas medida en vivo (1600×950, cuenta Fiel Ferreteria) |
| `21-tabla-vacia.png` | Búsqueda sin resultados ("Sin resultados / La búsqueda no arrojó facturas") |
| `21-tabla-hover.png` | Fila con el mouse encima (fondo `rgba(226,232,240,0.45)`) |
| `01-contactos-lista.png` | Variante con pestañas y avatar (ya estaba) |
| `01-productos-lista.png` | Variante con filtros activos y columna de acciones con varios iconos (ya estaba) |
| `01-facturas-venta-lista.png` | Estado vacío inicial "¡Aún no tienes facturas!" (ya estaba) |

## 1. Resumen en 6 frases

1. La lista entera vive en **una sola tarjeta blanca** (borde 1 px `#e2e8f0`, radio **16 px**, sin sombra): arriba una barra de 49 px con búsqueda y "Filtrar", en medio la tabla, abajo la paginación. Todo separado por líneas `#e2e8f0` que llegan a los bordes.
2. La búsqueda es una caja de **~267 × 32 px** (borde `#cbd5e1`, radio ~8) con la **lupa dentro a la izquierda** (16 px, `#64748b`); a su lado un **?** teal y el botón **"Filtrar"** (embudo + texto 14/500, sin borde).
3. La cabecera de la tabla tiene fondo `rgba(226,232,240,0.2)` (≈ `#f7f8fa`) y **40 px** de alto; los datos van en filas de **48 px** separadas por `#e2e8f0`; el **hover pinta la fila de gris suave** (`rgba(226,232,240,0.45)`).
4. Cabecera en **12 px / 500**, celdas en **14 px / 400**, todo `#334155`; las columnas de montos van **alineadas a la derecha** y la fecha de vencimiento vencida sale **en rojo** (`rgb(220,20,60)` ≈).
5. "Estado" es una **etiqueta pill chiquita** (11 px, 24 px de alto, radio 6): Por cobrar `#fef3c7`/`#b45309`, Cobrada `#dcfce7`/`#15803d`. La columna "Estado de emisión" (círculo verde con check = Emitida, círculo hueco = No electrónica) **solo aparece con la facturación electrónica activada**.
6. La **paginación va dentro de la misma tarjeta** en una fila de 48 px: a la izquierda "Ítems por página: [10 ▾] 1-2 de 2", a la derecha "Página [ 1 ] N ‹ ›".

## 2. Estructura y orden de los bloques

### 2.1 Marco

| Pieza | Valor |
|---|---|
| Fondo de la página | `#f4f5fb` ≈ |
| Área de contenido | padding lateral ~24–28 px; la tarjeta arranca en x≈291 y ocupa hasta el borde derecho |
| Tarjeta de la tabla `.s-table` | fondo `#ffffff`, borde 1 px `#e2e8f0`, radio **16 px**, `overflow: hidden`. Medida: x 291, y 180, **1289 × 619 px** a 1600 de ancho |

### 2.2 Orden vertical (medido a 1600×950)

```
Facturas                                      [Más acciones ▾] [+ Nueva factura de venta ▾]   y 76–118
Si necesitas ayuda para crear una factura, haz clic aquí.                                     y ~104–128
┌─ TARJETA (radio 16, borde #e2e8f0) ─────────────────────────────────────────────────────────┐ y 180–799
│ 🔍 Buscar cliente          (?)   ▽ Filtrar                                                  │ toolbar 181–230 (49)
│────────────────────────────────────────────────────────────────────────────────────────────│ y 230
│ ☐  # Interno   NCF/Número   Cliente   Creación   Vencimiento   Total   Por cobrar  Estado ⋮ │ cabecera 230–270 (40)
│────────────────────────────────────────────────────────────────────────────────────────────│ y 270
│ ☐  ---    B0200000001  Juan Pérez     13/11/2026 13/11/2026 RD$ 5,192.00 RD$ 0.00 Cobrada ⋮│ fila 270–318 (48)
│────────────────────────────────────────────────────────────────────────────────────────────│ y 318
│ ☐  ---    B0100000001  Constructora…  13/11/2026 13/12/2026 RD$16,638.00 RD$8,461.00 Por…  │ fila 318–366 (48)
│────────────────────────────────────────────────────────────────────────────────────────────│
│ Ítems por página: [10 ▾]  1-2 de 2                      Página [ 1 ] 1   ‹  ›               │ pie 750–798 (48)
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    [ (?) FAB teal 60×60, esquina inf. der. ]
```

## 3. Bloque por bloque

### 3.1 Cabecera de página

- Título **"Facturas"** (`h1`): **20 px / 600 / `#0f172a`**, línea 28 px; bloque 830 × 52 px.
- Subtítulo "Si necesitas ayuda para crear una factura, haz **clic aquí**.": **16 px / 400 / `#6b7280`**, el enlace en teal `#30aba9` (sin subrayado).
- A la derecha (flex, gap 4–8):
  - **"Más acciones ▾"**: outline, **171 × 42 px**, padding 8 × 20, borde 1 px `#cbd5e1`, radio **10 px**, texto **16 px / 500 / `#0f172a`**, chevron.
  - **"+ Nueva factura de venta ▾"**: relleno teal **`#30aba9`**, **264 × 40 px**, padding 8 × 20, radio **10 px**, texto blanco **16 px / 500**; es **split button** (el ▾ abre "Nueva factura recurrente").
- Otras listas cambian el botón: "+ Nuevo contacto", "+ Nuevo producto/servicio". Contactos además muestra "Ayuda" y "Papelera" antes de "Más acciones" ≈.

### 3.2 Tarjetas-resumen "Sin emisión / En proceso" (variante)

- Solo aparecen en cuentas con **facturación electrónica activada** (en la captura de Waldy con su cuenta real: dos tarjetas blancas lado a lado encima de la tabla, con contador e ícono). En la cuenta de prueba no salen. **≈ (medido por captura, no en vivo)**

### 3.3 Barra de búsqueda y filtros (`.s-toolbar`)

- Fila de **49 px** dentro de la tarjeta, separada de la cabecera de la tabla por una línea `#e2e8f0` a todo lo ancho. Contenedor flex con gap 8.
- **Input "Buscar cliente"**:
  - Caja visible ≈ **267 × 32 px**: borde 1 px `#cbd5e1`, radio ~8 px, fondo blanco.
  - Dentro: lupa svg **16 × 16** `#64748b` a la izquierda, luego el input propiamente (230 × 30, **sin borde propio**, padding 6 × 8, **14 px / 400 / `#334155`**).
  - Placeholder "Buscar cliente" en gris (`#94a3b8` ≈).
- **"?"**: círculo con signo de interrogación en teal `#30aba9` ≈, ~18 px, tooltip de ayuda.
- **"Filtrar"**: botón sin borde ni fondo: ícono de embudo (~16 px) + texto **"Filtrar" 14 px / 500 / `#334155`** (39 × 20 px el texto).
- En productos hay además una **segunda fila de filtros activos** (chip "Estado ▾" con borde dashed + "Remover filtros") ≈ — ver sección 5.

### 3.4 Cabecera de la tabla (`thead`)

- Fila de **40 px** de alto, fondo **`rgba(226,232,240,0.2)`** (≈ `#f7f8fa` sobre blanco), líneas `#e2e8f0` arriba y abajo.
- Celda de cabecera `th`: **12 px / 500 / `#334155`**, padding 0 × 16, texto a la izquierda; **"Total" y "Por cobrar" a la derecha**.
- Las columnas ordenables (NCF/Número, Creación) llevan un ícono de orden **16 px** a la derecha del texto.
- Checkbox de cabecera ~15 px, borde gris.
- Columnas de la lista de facturas y ancho medido (a 1600 px, tarjeta de 1289):

| # | Columna | Ancho | Alineación | Notas |
|---|---|---|---|---|
| 0 | ☐ checkbox | 64 px | centro | |
| 1 | # Interno | 124 px | izquierda | "---" cuando no hay interno |
| 2 | NCF/Número | 152 px | izquierda | ordenable |
| 3 | Cliente | 190 px | izquierda | recorta con "…" |
| 4 | Creación | 124 px | izquierda | ordenable, dd/mm/aaaa |
| 5 | Vencimiento | 148 px | izquierda | en **rojo** si venció |
| 6 | Total | 139 px | **derecha** | "RD$ 5,192.00" |
| 7 | Por cobrar | 131 px | **derecha** | "RD$ 0.00" si cobrada |
| 8 | Estado | 127 px | izquierda | pill |
| 9 | (acciones) | 88 px | centro | 1–2 botones-ícono 32×32 |

- Con la facturación electrónica activada aparece además la columna **"Estado de emisión"** entre Vencimiento y Total (≈, de la captura de Waldy) — ver 3.6.

### 3.5 Filas (`tbody tr`)

- Alto **48 px**, separador 1 px `#e2e8f0` abajo de cada fila (la última también lleva línea antes del pie).
- Celda `td`: **14 px / 400 / línea 20 px / `#334155`**, padding 0 × 16.
- "# Interno" vacío se muestra como "**---**".
- El nombre del cliente se recorta con "…" si no cabe ("Constructora Prueb…").
- **Vencimiento vencido**: la fecha sale en **rojo `rgb(220,20,60)`** ≈ (medido por píxel en la captura de Waldy; en la cuenta de prueba no había facturas vencidas).
- **Hover de fila**: fondo **`rgba(226,232,240,0.45)`** (medido en vivo; ver `21-tabla-hover.png`).
- Checkbox de fila ~15 px, borde gris.

### 3.6 Columna "Estado de emisión" (variante e-CF)

- Ícono de **círculo ~16 px** + texto 14 px `#334155`, flex con gap ~6–8 px. **≈**
- **Emitida**: círculo verde **de contorno** (~1.5–2 px de trazo) con check dentro (pixel ≈ `#1aa44d`).
- **No electrónica**: círculo hueco con borde gris (`#94a3b8` ≈), sin check.
- Solo existe cuando la cuenta tiene facturación electrónica activada; en la cuenta de prueba no sale.

### 3.7 Columna "Estado" (etiqueta pill)

Medido en vivo:

| Estado | Clase | Fondo | Texto | Tamaño medido |
|---|---|---|---|---|
| Cobrada | `status closed` | `#dcfce7` | `#15803d` | 63 × 24 |
| Por cobrar | `status open` | `#fef3c7` | `#b45309` | 73 × 24 |
| Anulada / Vencida / Parcial | — | — | — | **(no medido)** |

- Pill: **11 px / 400**, línea 14.3, padding **6 × 9 × 4**, radio **6 px**, **sin borde**. Es más chica de lo que parece a zoom >100 %.

### 3.8 Columna de acciones

- Celda de 88 px al final de la fila; botones-ícono de **32 × 32 px**, radio 10, color `#0f172a`, fondo transparente.
- En facturas: ícono de **monedas** (= registrar pago, solo cuando hay saldo por cobrar) + **⋮** ("Más acciones" de la fila). Una fila cobrada solo muestra ⋮.
- En productos son 4 íconos sueltos (ver, editar, duplicar, papelera) ≈; en contactos lápiz + ⋮ ≈.

### 3.9 Pie de paginación (`.s-pagination`)

- Fila de **48 px** dentro de la tarjeta, separada de la última fila por `#e2e8f0`, padding 0 × 8, flex con gap 16.
- **Izquierda**: "Ítems por página:" (14 px / 400 / `#334155`) + select **56 × 32** (borde `#cbd5e1`, radio 8, opciones **10/20/30**) + contador "**1-2 de 2**" (el "de" va en su propio elemento).
- **Derecha**: "Página" + **input de número** ~32 px + número total + flechas **‹ ›**.
- Variantes de texto por lista ≈: facturas "Ítems por página", productos "Resultados por página", contactos "Contactos por página" (este último invierte el orden: "Página … De N" a la izquierda).

### 3.10 Estados vacíos

- **Búsqueda sin resultados** (medido en vivo, `21-tabla-vacia.png`): dentro de la tarjeta, ícono de documento ~40 px gris, título **"Sin resultados"** (~20 px / 600 `#111827` ≈), texto "**La búsqueda no arrojó facturas**" (14 px `#6b7280` ≈). El pie de paginación sigue visible.
- **Lista sin datos** (de `01-facturas-venta-lista.png` ≈): ícono + "**¡Aún no tienes facturas!**" + texto de ayuda + botón teal "Crear una factura de venta".

### 3.11 Botón flotante (FAB)

- Círculo teal `#30aba9` de **60 × 60 px**, fijo en la esquina inferior derecha (margen ~16 px), con ícono "?": es el botón de ayuda/chat de Alegra. **No lo necesitamos.**

## 4. Tokens de diseño

### 4.1 Colores

| Token | Valor | Uso |
|---|---|---|
| Fondo página | `#f4f5fb` ≈ | detrás de la tarjeta |
| Fondo tarjeta | `#ffffff` | |
| Borde / separadores | `#e2e8f0` | bordes de tarjeta, líneas de fila y secciones |
| Fondo cabecera tabla | `rgba(226,232,240,0.2)` ≈ `#f7f8fa` | |
| Hover de fila | `rgba(226,232,240,0.45)` | |
| Texto tabla | `#334155` | cabeceras (12/500) y celdas (14/400) |
| Texto apagado | `#6b7280` | subtítulo, estado vacío |
| Título página | `#0f172a` | h1, texto de botón outline, íconos de acción |
| Lupa / íconos grises | `#64748b` | |
| Borde de input / select | `#cbd5e1` | buscador, select de página |
| Teal primario | `#30aba9` | "?", enlace "clic aquí", botón principal, FAB |
| Por cobrar | `#fef3c7` / `#b45309` | pill |
| Cobrada | `#dcfce7` / `#15803d` | pill |
| Vencido | `rgb(220,20,60)` ≈ | fecha de vencimiento |
| Emitida (ícono) | ≈ `#1aa44d` | círculo check |

### 4.2 Tipografía

- Fuente **Inter** (fallback sans), igual que en toda la app.
- h1 página: 20 / 600. Subtítulo: 16 / 400 `#6b7280`.
- Botones de cabecera: 16 / 500.
- Cabecera de tabla: **12 / 500** `#334155`.
- Celdas: **14 / 400** `#334155`, línea 20.
- Pill: **11 / 400**.
- Pie y búsqueda: 14 / 400 `#334155`.

### 4.3 Espacios

| Pieza | Valor |
|---|---|
| Barra búsqueda | 49 px de alto |
| Cabecera tabla | 40 px |
| Fila | 48 px |
| Pie paginación | 48 px, padding 0 × 8 |
| Padding horizontal de celda | 16 px |
| Input búsqueda | caja ≈267 × 32; input interno 230 × 30 |
| Botón-ícono fila | 32 × 32 |
| Select pie | 56 × 32 |
| Gap entre piezas | 8–16 px |

### 4.4 Radios y sombras

- Tarjeta: radio **16 px**, sin sombra.
- Botones e input: radio **10 / ~8 px**. Pill: **6 px**. Select: **8 px**. Botón-ícono: **10 px**.

## 5. Variantes en otras listas (de las capturas del repo, ≈)

- **Contactos**: pestañas "Todos | Clientes | Proveedores" **fuera** de la tarjeta, raya teal en la activa; dentro, checkbox + **avatar circular con inicial** (~24 px, color por letra) + nombre; acciones lápiz + ⋮; el pie pone "Página [ 1 ] De 1" a la **izquierda** y "Contactos por página [10▾]" a la **derecha** (orden invertido).
- **Productos y servicios**: encima "Lista de precios" con su select; barra con "Buscar por nombre o referencia" + "Filtrar"; **fila de filtros aplicados** (chip "Estado ▾" con borde punteado + "+" y "Remover filtros"); acciones con 4 íconos.
- **Facturas proveedor / otras**: mismo patrón (buscador + tabla + paginación en una tarjeta). Las columnas cambian, el patrón no.

## 6. Diferencias con nuestra versión

Nuestra tabla hoy (`src/app/(main)/dashboard/facturacion/_components/facturas-tabla.tsx` + `src/components/listas/`):

| Pieza | Alegra | Medoxigas hoy | Qué hacer |
|---|---|---|---|
| Contenedor | Una tarjeta con todo dentro | Tabla en `rounded-xl ring-1`; buscador y paginador **sueltos** arriba/abajo | Meter búsqueda + filtro dentro de la tarjeta (primera fila ~48 px) y la paginación como última fila |
| Cabecera tabla | `rgba(226,232,240,.2)`, 40 px, 12 px/500 `#334155` | `border-b`, alto 40 px (`h-10`), `font-medium` | Fondo `bg-slate-200/20` (`bg-slate-50` sirve) |
| Filas | 48 px, separador `#e2e8f0`, hover `rgba(226,232,240,.45)` | ~40–48 px (padding `p-2`), hover `hover:bg-muted/50` parecido | `h-12` en filas; hover ya es similar |
| Búsqueda | caja 267×32 con lupa dentro, "?" y "Filtrar" al lado | `BuscadorLista` igual en espíritu, pero **fuera** de la tarjeta | Mover dentro; añadir botón "Filtrar" |
| Checkbox | Primera columna ☐ | No existe | Añadir si se quieren acciones por lote |
| Estado | pill 11 px amber/green sin borde | `Badge` outline emerald | Variantes amber/green sin borde, `text-[11px]` |
| Estado de emisión | círculo + texto (solo con e-CF) | No existe | Añadir cuando haya e-CF |
| Vencimiento vencido | rojo `rgb(220,20,60)` | `formatoDia` normal | `text-red-600` cuando `vencimiento < hoy` y estado ≠ cobrada |
| Acción por fila | ícono monedas + ⋮ | No existe | Botón-ícono "registrar pago" + menú ⋮ |
| Paginación | dentro de la tarjeta, select 10/20/30 + "Página [n] N ‹ ›" | `PaginadorLista` fuera, "Mostrando X–Y de N" + 4 botones | Mover dentro de la tarjeta |
| Moneda | "RD$ 5,192.00" | `formatoMoneda` | Mantener "RD$" visible |

## 7. Lo mismo en Tailwind v4 (esqueleto)

```tsx
<div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white">
  {/* barra de búsqueda — 49 px */}
  <div className="flex h-[49px] items-center gap-2 border-b border-[#e2e8f0] px-3">
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#64748b]" />
      <input placeholder="Buscar cliente"
        className="h-8 w-[267px] rounded-lg border border-[#cbd5e1] pl-8 pr-2 text-sm text-[#334155]" />
    </div>
    <button className="text-[#30aba9]"><CircleHelp className="size-[18px]" /></button>
    <button className="flex items-center gap-1.5 text-sm font-medium text-[#334155]">
      <ListFilter className="size-4" /> Filtrar
    </button>
  </div>
  {/* tabla */}
  <table className="w-full text-sm text-[#334155]">
    <thead>
      <tr className="h-10 border-b border-[#e2e8f0] bg-[#e2e8f0]/20 text-left text-xs font-medium">
        <th className="w-16 px-4"><input type="checkbox" /></th>
        <th className="px-4"># Interno</th><th className="px-4">NCF/Número</th>
        <th className="px-4">Cliente</th><th className="px-4">Creación</th>
        <th className="px-4">Vencimiento</th><th className="px-4 text-right">Total</th>
        <th className="px-4 text-right">Por cobrar</th><th className="px-4">Estado</th>
        <th className="w-[88px]" />
      </tr>
    </thead>
    <tbody>
      <tr className="h-12 border-b border-[#e2e8f0] hover:bg-[#e2e8f0]/45">
        <td className="px-4"><input type="checkbox" /></td>
        <td className="px-4">---</td>
        <td className="px-4">B0200000001</td><td className="px-4">Juan Pérez</td>
        <td className="px-4">13/11/2026</td><td className="px-4 text-[#dc143c]">13/11/2026</td>
        <td className="px-4 text-right">RD$ 5,192.00</td>
        <td className="px-4 text-right">RD$ 0.00</td>
        <td className="px-4"><span className="rounded-md bg-[#dcfce7] px-[9px] pb-1 pt-1.5 text-[11px] text-[#15803d]">Cobrada</span></td>
        <td className="px-4"><Coins className="size-4 text-[#0f172a]" /></td>
      </tr>
    </tbody>
  </table>
  {/* pie de paginación — 48 px */}
  <div className="flex h-12 items-center justify-between border-t border-[#e2e8f0] px-2 text-sm text-[#334155]">
    <div className="flex items-center gap-2">
      Ítems por página:
      <select className="h-8 w-14 rounded-lg border border-[#cbd5e1]"><option>10</option></select>
      1-2 de 2
    </div>
    <div className="flex items-center gap-2">
      Página <input className="h-8 w-8 rounded-lg border border-[#cbd5e1] text-center" defaultValue={1} /> 1
      <button>‹</button><button>›</button>
    </div>
  </div>
</div>
```

Con tokens de la app: `#e2e8f0` → `border-border`/`border-slate-200`, cabecera → `bg-slate-200/20`, `#334155` → `text-slate-700`, `#64748b` → `text-slate-500`, teal → `text-primary`/botón `default`, rojo vencido → `text-destructive`.

## 8. Lista para comparar (checklist de Coder)

- [ ] Buscador, tabla y paginación dentro de **una sola tarjeta** (radio 16) con líneas `#e2e8f0` entre secciones.
- [ ] Caja de búsqueda ~267×32 con lupa dentro; "Filtrar" con embudo a su lado.
- [ ] Cabecera `#e2e8f0/20`, 40 px, 12 px / 500 `#334155`; montos a la derecha.
- [ ] Filas de 48 px; texto 14 px `#334155`; hover `bg-[#e2e8f0]/45`; vencido en rojo.
- [ ] Pill de estado 11 px, 24 de alto, sin borde (`#fef3c7`/`#b45309`, `#dcfce7`/`#15803d`).
- [ ] Estado de emisión = círculo (verde check / hueco) + texto (solo con e-CF).
- [ ] Botones-ícono 32×32 al final de la fila.
- [ ] Pie con "Ítems por página [10▾] 1-N de N" a la izquierda y "Página [ n ] N ‹ ›" a la derecha.
- [ ] Estado vacío: ícono + título + texto de ayuda (+ botón si no hay datos).

## 9. Qué NO copiar

- Ni el HTML ni el CSS de Alegra (la copia local es solo para medir).
- Ni los nombres de las columnas que no aplican ("Estado de emisión" solo existe donde hay e-CF).
- Ni el teal: en Medoxigas es el azul primario `#1e56c7`.
- Ni los íconos concretos de Alegra: usar lucide (`Search`, `ListFilter`, `CircleHelp`, `CircleCheck`, `Circle`, `Coins`, `EllipsisVertical`…).
- Ni el FAB de ayuda.

## 10. Lo que no se pudo medir

- El menú que abre "Filtrar", el split ▾ de "Nueva factura de venta" y el menú ⋮ de la fila **(no medido)**.
- Pills de Anulada/Vencida/Parcial y paginación con varias páginas **(no medido)**.
- Las tarjetas-resumen y la columna "Estado de emisión" solo se midieron por captura **≈** (en la cuenta de prueba no salen).
- El rojo de vencido salió de la captura de Waldy (`rgb(220,20,60)` ≈), no en vivo.

# Guía de diseño: tabla de listas (facturas de venta), inspirada en Alegra

Para: Coder. Objetivo: que las listas de **Medoxigas Contabilidad** (facturas, contactos, productos, pagos…) se vean como las de Alegra.
Es una guía para **inspirarse**, no para copiar. No pegues CSS ni HTML de Alegra en el sistema.
Va junto con las otras guías: `../css-vista/GUIA-VISTA.md`, `../css-factura/GUIA-DISENO-FACTURA.md`, `../css-pagos/GUIA-FORMULARIOS.md`, `../css-inicio/GUIA-INICIO.md` (mismos colores y fuente).

## 0. De dónde salen los números

- Fuente: la lista **Facturas de venta** de Alegra (`/invoice`, menú Ingresos), medida **en vivo** en app.alegra.com con la cuenta de prueba Fiel Ferreteria, con puppeteer-core sobre el Chrome de la caja. Ventana de **1600 × 950** (y comprobado a 1280 px).
- Los valores son `getComputedStyle` y `getBoundingClientRect` (px reales) más las reglas CSS que los crean. Los colores van en hex.
- La copia local `facturas/` (index.html + styles.css) sirve para verla sin internet; los estados interactivos (hover, menús) se midieron en vivo o en las capturas.
- De las variantes (contactos, productos) se usaron las capturas del repo `../capturas/`; lo sacado de ahí es **píxel a píxel** y va marcado con **≈**.
- Si algo no se pudo medir, lo digo con **(no medido)**.

Capturas (en `../capturas/`):

| Captura | Qué muestra |
|---|---|
| `21-tabla-facturas.png` | Lista de facturas real de Alegra (arriba) |
| `21-tabla-facturas-abajo.png` | La misma lista, parte de abajo con la paginación |
| `21-tabla-vacia.png` | Estado vacío ("¡Aún no tienes facturas!") + pie de página |
| `21-tabla-filtros.png` | Buscador + "Filtrar" abierto **(no medido si no se abrió)** |
| `01-contactos-lista.png` | Variante con pestañas y avatar (ya estaba) |
| `01-productos-lista.png` | Variante con filtros activos y columna de acciones con iconos (ya estaba) |

## 1. Resumen en 6 frases

1. La lista entera vive en **una sola tarjeta blanca** (borde `#e2e8f0`, radio ~12–16 px): arriba la barra de búsqueda y "Filtrar", en medio la tabla, abajo la paginación. Todo separado por líneas `#e2e8f0`.
2. La búsqueda es un input de **~320 × 40 px** con la lupa dentro a la izquierda; a su lado un **?** teal y el botón **"Filtrar"** (embudo + texto, sin borde).
3. La cabecera de la tabla tiene fondo **`#f9fafc`** y ~**50 px** de alto; los datos van en filas de **~60 px** separadas por `#e2e8f0`, sin hover marcado.
4. Todo el texto de la tabla es **14 px en `#334155`** (la cabecera en 500–600, las celdas en 400–500); las columnas de montos van **alineadas a la derecha** y la fecha de vencimiento vencida sale **en rojo**.
5. "Estado" es una **etiqueta pill** (Por cobrar: fondo `#fef3c7`, texto `#b45309`; Cobrada: fondo `#dcfce7` ≈, texto `#15803d`); "Estado de emisión" es **ícono de círculo + texto** (verde relleno con check = Emitida, círculo hueco = No electrónica).
6. La **paginación va dentro de la misma tarjeta**, en una fila de pie: a la izquierda "Ítems por página: [10 ▾]  1–11", a la derecha "Página [ 1 ] De N ‹ ›".

## 2. Estructura y orden de los bloques

### 2.1 Marco

| Pieza | Valor |
|---|---|
| Fondo de la página | `#f4f5fb` |
| Área de contenido | padding **20 px** (≈ a 1600; a 1280 igual) |
| Tarjeta de la tabla | fondo `#ffffff`, borde 1 px `#e2e8f0`, radio ~**12–16 px**, `overflow: hidden` |

### 2.2 Orden vertical (a 1920 px en la captura real)

```
Facturas                                      [Más acciones ▾] [+ Nueva factura de venta ▾]   y≈80
Si necesitas ayuda para crear una factura, haz clic aquí.                                       y≈105
┌ Sin emisión 0 ┐  ┌ En proceso 0 ┐              ← tarjetas-resumen (solo algunas listas)      y≈180
┌─ TARJETA DE LA TABLA ─────────────────────────────────────────────────────────────────────┐ y≈352
│ [🔍 Buscar cliente           ]  (?)   ▽ Filtrar                                             │ barra 353–412 (~60)
│────────────────────────────────────────────────────────────────────────────────────────────│ y=413
│ ☐  # Interno   NCF/Número   Cliente   Creación   Vencimiento   Total   Estado de emisión …  │ cabecera 413–463 (50)
│────────────────────────────────────────────────────────────────────────────────────────────│ y=463
│ ☐  ---    B1500004529  HOSPITAL DR JAIM…  15/11/2026  15/12/2026  RD$ 153,400.00  …        │ fila 60
│────────────────────────────────────────────────────────────────────────────────────────────│ y=523
│ ☐  ---    E310000000111  CENTRO MEDICO R…  14/11/2026  29/11/2026   RD$ 7,000.00  …        │ fila 60
│ … (una línea #e2e8f0 cada 60 px)                                                           │
│────────────────────────────────────────────────────────────────────────────────────────────│
│ Ítems por página: [10 ▾]  1–11                        Página [ 1 ] De 1   ‹  ›               │ pie ~44–48
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 3. Bloque por bloque

### 3.1 Cabecera de página

- Título **"Facturas"**: 20 px / 600 / `#0f172a` (mismo patrón que la vista de documento).
- Subtítulo "Si necesitas ayuda para crear una factura, haz **clic aquí**.": 14 px `#64748b`, el enlace en teal `#30aba9` (sin subrayado).
- A la derecha (flex, gap 8):
  - **"Más acciones ▾"**: botón outline, ~36–40 px de alto, borde `rgba(148,163,184,0.4)` ≈, texto 14 px / 500 `#334155`, chevron 16 px.
  - **"+ Nueva factura de venta ▾"**: botón relleno teal `#30aba9`, texto blanco 14 px / 500–600, radio ~8–10, ~36–40 px de alto; tiene **split button** (el ▾ a la derecha abre opciones como "Nueva factura recurrente").
- Otras listas cambian el botón: "+ Nuevo contacto", "+ Nuevo producto/servicio". Contactos además muestra "Ayuda" y "Papelera" antes de "Más acciones".

### 3.2 Tarjetas-resumen (solo en la lista de facturas)

- Dos tarjetas blancas lado a lado (flex, gap ~16): **"Sin emisión"** con ícono ✗ en círculo, **"En proceso"** con ícono de reloj en círculo.
- Cada una: padding ~16, etiqueta 12–14 px `#64748b` arriba y número grande ~20–24 px / 600 `#0f172a` debajo (o a la derecha del ícono).
- Ocupan ~la mitad del ancho cada una ≈. **(detalle de medidas: no medido en vivo todavía)**

### 3.3 Barra de búsqueda y filtros

- Fila de **~60 px** de alto dentro de la tarjeta (y=353–412 en la captura), padding lateral ~16–20 px, `align-items: center`, separada de la cabecera de la tabla por una línea `#e2e8f0` a todo lo ancho.
- **Input "Buscar cliente"** (o "Buscar por nombre o referencia", "Buscar"…):
  - Ancho **≈320 px**, alto **≈40 px** (borde top y=363, bottom y=402 en la captura).
  - Borde 1 px `#cbd5e1`, radio ≈8 px, fondo blanco.
  - Lupa **dentro**, a la izquierda (ícono ~16 px, gris); placeholder `#94a3b8` 14 px.
- **"?"**: ícono de círculo con signo de interrogación, teal `#30aba9` ≈, ~18 px, a ~8–12 px del input. Tooltip de ayuda.
- **"Filtrar"**: botón sin borde ni fondo: ícono de embudo ~14–16 px + texto "Filtrar" 14 px / 500–600 `#334155` (≈; en la captura se ve bold ~600).
- En productos hay además una **segunda fila de filtros activos** (chip "Estado ▾" con borde dashed + botón "+" y "Remover filtros" a la derecha) ≈ — ver sección 5.

### 3.4 Cabecera de la tabla

- Fila de **50 px** de alto (y=413–463 en la captura), fondo **`#f9fafc`** (apenas gris), separador `#e2e8f0` arriba y abajo.
- Texto de cabecera: **14 px / 500–600 / `#334155`** (≈; altura de banda de texto ~12 px).
- Alineación: textos a la izquierda; **"Total" y "Por cobrar" a la derecha** (en la captura el texto "Total" termina en x≈1317 y los montos terminan alineados con él).
- Columnas de la lista de facturas, de izquierda a derecha:

| # | Columna | Ancho ≈ (a 1920) | Alineación | Notas |
|---|---|---|---|---|
| 0 | ☐ checkbox | ~40 px | centro | checkbox ~15–16 px, borde gris `#767676`/`#dddddd` |
| 1 | # Interno | ~110 px | izquierda, con sangría (~24 px tras el checkbox) | "---" cuando no hay interno |
| 2 | NCF/Número | ~120 px | izquierda | |
| 3 | Cliente | ~200+ px (crece) | izquierda | texto recortado con "…" |
| 4 | Creación | ~110 px | izquierda | dd/mm/aaaa |
| 5 | Vencimiento | ~110 px | izquierda | en **rojo** si venció |
| 6 | Total | ~120 px | **derecha** | "RD$ 153,400.00" |
| 7 | Estado de emisión | ~170 px | izquierda | ícono círculo + texto |
| 8 | Por cobrar | ~140 px | **derecha** | "RD$ 0.00" cuando está cobrada |
| 9 | Estado | ~110 px | izquierda | pill |
| 10 | (acción) | ~50 px | centro | ícono ~18 px |

### 3.5 Filas

- Alto **60 px** exacto (separadores cada 60 px: 463, 523, 583…), separador 1 px `#e2e8f0` entre filas; **la última fila también lleva línea** antes del pie de paginación.
- Texto: **14 px / 400–500 / `#334155`** para todo (número, NCF, cliente, fechas, montos, estado de emisión). El nombre del cliente va en mayúsculas porque el dato viene así, no por CSS ≈.
- "# Interno" vacío: se muestra "---" centrado ≈.
- **Vencimiento vencido**: en la fila de GRUPO MAXPROJE… el "14/11/2026" sale en **rojo** (`#dc2626`/`#be123c` ≈ — mientras el resto de la fila sigue `#334155`).
- Checkbox de fila: ~15–16 px, borde `#767676`/`#dddddd`, sin relleno.
- Hover de fila: **(no medido)** — en la captura no hay hover; otras vistas de Alegra usan `#f8fafc`.

### 3.6 Columna "Estado de emisión"

- Ícono de **círculo ~16 px** + texto 14 px `#334155`, flex con gap ~6–8 px.
- **Emitida**: círculo verde **de contorno** (~1.5–2 px de trazo) con un check dentro (`#16a34a`/`#22c55e`-ish, pixel medido ≈ `#1aa44d`).
- **No electrónica**: círculo hueco con borde gris (`#94a3b8`/`#64748b` ≈), sin check.

### 3.7 Columna "Estado" (etiqueta pill)

| Estado | Fondo | Texto | Notas |
|---|---|---|---|
| Por cobrar | `#fef3c7` (amber-100) | `#b45309` (amber-700) | medido en captura |
| Cobrada | `#dcfce7` ≈ (green-100; pixel ≈ `#dcf6dc`) | `#15803d` (green-700) | medido en captura |
| Anulada / Vencida / Parcial | — | — | **(no medido)** |

- Pill: **≈90 × 26–30 px** para "Por cobrar" (padding-x ~12 px ≈), radio ~**8–10 px** (esquinas bien redondeadas, casi píldora ≈), texto ~13–14 px / 500 ≈. La de la vista usa radio 4 px y borde 15 % — la de la lista se ve **sin borde** ≈.

### 3.8 Columna de acción

- Un solo ícono a la derecha de la fila, ~18 px, color `#0f172a` ≈: en facturas es el ícono de **monedas apiladas** (= registrar pago / cobrar).
- En productos son varios íconos (ojo, lápiz, duplicar, papelera) en gris `#64748b` ≈; en contactos lápiz + ⋮ ≈.

### 3.9 Pie de paginación

- Fila de **~44–48 px** dentro de la misma tarjeta, separada de la última fila por `#e2e8f0`; padding lateral igual que la barra de búsqueda.
- **Izquierda**: "Ítems por página:" + select **[10 ▾]** (input chico ~44–56 px, borde `#cbd5e1`, radio ~6) + "1–11" (rango mostrado). Texto ~13–14 px `#334155`.
- **Derecha**: "Página" + **input de número [ 1 ]** (~36 px, borde, centrado) + "De 1" + flechas **‹ ›** (habilitadas/deshabilitadas en gris).
- Variantes de texto por lista ≈: facturas "Ítems por página", productos "Resultados por página", contactos "Contactos por página" (este último pone el select a la derecha y "Página … De N" a la izquierda).

### 3.10 Estado vacío

- Misma tarjeta; donde irían las filas: ícono de documento grande (~48 px, gris `#cbd5e1`/`#94a3b8`), título **"¡Aún no tienes facturas!"** ~16 px / 600 `#0f172a`, texto secundario 14 px `#64748b` y botón **"Crear una factura de venta"** relleno teal ≈ (de la captura `01-facturas-venta-lista.png`).

## 4. Tokens de diseño

### 4.1 Colores (los de esta tabla)

| Token | Valor | Uso |
|---|---|---|
| Fondo página | `#f4f5fb` | detrás de la tarjeta |
| Fondo tarjeta | `#ffffff` | |
| Borde / separadores | `#e2e8f0` | bordes de tarjeta, líneas de fila, cabecera |
| Fondo cabecera tabla | `#f9fafc` | |
| Texto principal | `#334155` | cabeceras y celdas |
| Texto apagado | `#64748b` | subtítulos, pie |
| Placeholder | `#94a3b8` | input de búsqueda |
| Borde de input | `#cbd5e1` | buscador, selects del pie |
| Teal primario | `#30aba9` | "?", "Filtrar" activo, "clic aquí", botón principal |
| Por cobrar | `#fef3c7` / `#b45309` | pill |
| Cobrada | `#dcfce7` ≈ / `#15803d` | pill |
| Vencido | `#dc2626` ≈ | fecha de vencimiento |
| Emitida (ícono) | `#16a34a` ≈ (pixel ≈ `#1aa44d`) | círculo check |
| Acción (ícono) | `#0f172a` ≈ | monedas |

### 4.2 Tipografía

- Fuente **Inter** (fallback Roboto/sans), igual que en toda la app.
- Cabecera de tabla: 14 px / 500–600, `#334155`.
- Celdas: 14 px / 400–500, `#334155`.
- Pie y textos secundarios: 13–14 px, `#64748b` ≈.
- Números con tabulación: montos en "RD$ 153,400.00" — mismos dígitos tabulares que el resto de la app ≈.

### 4.3 Espacios

| Pieza | Valor |
|---|---|
| Padding lateral de la tarjeta | ~16–20 px ≈ (la línea separadora sí llega a los bordes) |
| Barra búsqueda | alto ~60 px, input 40 px centrado |
| Cabecera tabla | 50 px |
| Fila | 60 px |
| Pie paginación | ~44–48 px |
| Gap ícono–texto | 6–8 px |

### 4.4 Radios y sombras

- Tarjeta: radio ~12–16 px ≈ (la sombra es nula o casi nula — igual que la vista: borde sin sombra).
- Input: ~8 px. Pill de estado: ~6–10 px ≈. Select del pie: ~6 px ≈.

## 5. Variantes en otras listas (de las capturas del repo, ≈)

- **Contactos**: pestañas "Todos | Clientes | Proveedores" **fuera** de la tarjeta, con raya teal en la activa; dentro, checkbox + **avatar circular con inicial** (círculo ~24 px, color por letra: violeta/azul) + nombre; columna "Identificación", "Teléfono", "Tipo"; acciones: lápiz + ⋮; el pie pone "Página [ 1 ] De 1" a la **izquierda** y "Contactos por página [10▾] 1–4 De 4" a la **derecha** (orden invertido respecto a facturas).
- **Productos y servicios**: encima de la tabla hay "Lista de precios" con su propio select ("General"); la barra lleva "Buscar por nombre o referencia" + "Filtrar"; y una **fila de filtros aplicados**: chip "**Estado ▾**" (borde punteado) + botón "+" y "**Remover filtros**" a la derecha; columna Acciones con 4 íconos sueltos (ojo, lápiz, dos-rectángulos, papelera).
- **Facturas proveedor / otras**: mismo patrón (buscador + tabla + paginación en una tarjeta). Las columnas cambian, el patrón no.

## 6. Diferencias con nuestra versión

Nuestra tabla hoy (`src/app/(main)/dashboard/facturacion/_components/facturas-tabla.tsx` + `src/components/listas/`):

| Pieza | Alegra | Medoxigas hoy | Qué hacer |
|---|---|---|---|
| Contenedor | Una tarjeta con todo dentro | Tabla en `rounded-xl ring-1`; buscador y paginador **sueltos** arriba/abajo | Meter búsqueda + filtro dentro de la tarjeta (primera fila ~60 px) y la paginación como última fila de la tarjeta |
| Cabecera tabla | `#f9fafc`, 50 px, 14 px/500–600 `#334155` | `border-b`, alto 40 px (`h-10`), `font-medium` | Subir a ~50 px y fondo `bg-[#f9fafc]` (`bg-slate-50`) |
| Filas | 60 px, separador `#e2e8f0` | ~40–48 px (padding `p-2`) | Fila de ~60 px (`h-[60px]` o `py-4`) |
| Búsqueda | input 320×40, lupa dentro, al lado "?" y "Filtrar" | `BuscadorLista` igual en espíritu, pero **fuera** de la tarjeta y max-w-sm | Mover dentro; añadir botón "Filtrar" |
| Checkbox | Primera columna ☐ | No existe | Añadir si se quieren acciones por lote (Más acciones las usa) |
| Estado | pill amber/green sin borde | `Badge` outline emerald | Variantes amber/green sin borde, ~12–13 px |
| Estado de emisión | círculo + texto | No existe | Añadir cuando haya e-CF |
| Vencimiento vencido | rojo | `formatoDia` normal | `text-red-600` cuando `vencimiento < hoy` y estado ≠ cobrada |
| Acción por fila | ícono monedas | No existe | Botón-ícono "registrar pago" |
| Paginación | dentro de la tarjeta, select de tamaño + "Página [n] De N" | `PaginadorLista` fuera, "Mostrando X–Y de N" + 4 botones | Mover dentro; mismo texto o el nuestro, pero dentro de la tarjeta |
| Moneda | "RD$ 153,400.00" | `formatoMoneda` (revisar prefijo) | Mantener "RD$" visible |

## 7. Lo mismo en Tailwind v4 (esqueleto)

```tsx
<div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
  {/* barra de búsqueda */}
  <div className="flex h-[60px] items-center gap-3 border-b border-[#e2e8f0] px-5">
    <div className="relative w-80">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
      <input placeholder="Buscar cliente" className="h-10 w-full rounded-lg border border-[#cbd5e1] pl-9 text-sm" />
    </div>
    <button className="text-[#30aba9]"><CircleHelp className="size-[18px]" /></button>
    <button className="flex items-center gap-1.5 text-sm font-medium text-[#334155]">
      <ListFilter className="size-4" /> Filtrar
    </button>
  </div>
  {/* tabla */}
  <table className="w-full text-sm text-[#334155]">
    <thead>
      <tr className="h-[50px] border-b border-[#e2e8f0] bg-[#f9fafc] text-left font-medium">
        <th className="w-10 px-4"><input type="checkbox" /></th>
        <th className="pl-6"># Interno</th>
        <th>NCF/Número</th><th>Cliente</th><th>Creación</th><th>Vencimiento</th>
        <th className="text-right">Total</th><th>Estado de emisión</th>
        <th className="text-right">Por cobrar</th><th>Estado</th><th className="w-12" />
      </tr>
    </thead>
    <tbody>
      <tr className="h-[60px] border-b border-[#e2e8f0] last:border-b">
        <td className="px-4"><input type="checkbox" /></td>
        <td className="pl-6 text-center">---</td>
        <td>B1500004529</td><td>HOSPITAL DR JAIM…</td>
        <td>15/11/2026</td><td className="text-[#dc2626]">14/11/2026</td>
        <td className="text-right">RD$ 153,400.00</td>
        <td><span className="flex items-center gap-1.5"><CheckCircle2 className="size-4 text-[#16a34a]" />Emitida</span></td>
        <td className="text-right">RD$ 153,400.00</td>
        <td><span className="rounded-md bg-[#fef3c7] px-2 py-0.5 text-xs font-medium text-[#b45309]">Por cobrar</span></td>
        <td><Coins className="size-[18px] text-[#0f172a]" /></td>
      </tr>
    </tbody>
  </table>
  {/* pie de paginación */}
  <div className="flex h-12 items-center justify-between px-5 text-sm text-[#334155]">
    <div className="flex items-center gap-2">
      Ítems por página: <select className="h-8 rounded-md border border-[#cbd5e1]">10</select> 1–11
    </div>
    <div className="flex items-center gap-2">
      Página <input className="h-8 w-9 rounded-md border border-[#cbd5e1] text-center" defaultValue={1} /> De 1
      <button>‹</button><button>›</button>
    </div>
  </div>
</div>
```

Con tokens de la app: `#e2e8f0` → `border-border`/`border-slate-200`, `#f9fafc` → `bg-slate-50`, `#334155` → `text-slate-700`, `#94a3b8` → `text-slate-400`, teal → `text-primary`/botón `default`, rojo vencido → `text-destructive` o `text-red-600`.

## 8. Lista para comparar (checklist de Coder)

- [ ] Buscador, tabla y paginación dentro de **una sola tarjeta** con líneas `#e2e8f0` entre secciones.
- [ ] Input ~320×40 con lupa dentro; "Filtrar" con embudo a su lado.
- [ ] Cabecera `#f9fafc`, 50 px, 14 px medio `#334155`; montos a la derecha.
- [ ] Filas de 60 px; texto 14 px `#334155`; vencido en rojo.
- [ ] Pill de estado amber (`#fef3c7`/`#b45309`) y verde (`#dcfce7`/`#15803d`) sin borde.
- [ ] Estado de emisión = círculo (verde check / hueco) + texto.
- [ ] Ícono de acción al final de la fila.
- [ ] Pie con "Ítems por página [10▾] 1–N" a la izquierda y "Página [ n ] De N ‹ ›" a la derecha.
- [ ] Estado vacío: ícono + "¡Aún no tienes …!" + botón teal.

## 9. Qué NO copiar

- Ni el HTML ni el CSS de Alegra (la copia local es solo para medir).
- Ni los nombres de las columnas que no aplican ("Estado de emisión" solo existe donde hay e-CF).
- Ni el teal: en Medoxigas es el azul primario `#1e56c7`.
- Ni los íconos concretos de Alegra: usar lucide (`Search`, `ListFilter`, `CircleHelp`, `CircleCheck`, `Circle`, `Coins`…).

## 10. Lo que no se pudo medir

- Hover de fila y de "Filtrar" **(no medido: la captura no lo muestra)**.
- El menú que abre "Filtrar" y el split ▾ de "Nueva factura de venta" **(no medido)**.
- Radios exactos de la tarjeta, del input y de la pill **(≈ de captura; falta medida en vivo)**.
- Estados Anulada / Vencida / Parcial / Sin emisión de la pill **(no medido: no hay filas con esos estados en la cuenta de prueba)**.
- Checkbox marcado / indeterminado y el bulk-bar que aparece al seleccionar filas **(no medido)**.
- Comportamiento responsive (<1280 px): la tabla hace scroll horizontal **(no medido)**.

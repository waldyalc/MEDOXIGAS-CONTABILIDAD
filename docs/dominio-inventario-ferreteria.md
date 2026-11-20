# Dominio: inventario de ferretería (fase 1A, backend)

Contrato de datos y RPC del inventario de alto volumen: catálogo con códigos de
barra, unidades con conversión, combos reales, conteo físico y tres lecturas
rápidas para el futuro POS.

Migraciones:

- `supabase/migrations/20261125100000_inventario_ferreteria_catalogo.sql`
  (columnas, tablas, índices, RLS, conteo y lecturas).
- `supabase/migrations/20261125101000_inventario_ferreteria_motor.sql`
  (conversión de unidades y combos dentro del motor contable).

Reglas generales que no cambian: dinero `numeric(14,2)`, cantidades
`numeric(14,2)`, factores `numeric(14,4)`, toda escritura por RPC
`security definer` con rol `admin` o `contador`, RLS activo (anon nada,
authenticated solo lectura), sin DELETE de documentos contables.

## 1. Identificación y ubicación

`productos` gana tres columnas aditivas:

| columna | tipo | uso |
| --- | --- | --- |
| `marca` | `text` | búsqueda por trigrama y filtro del POS |
| `favorito_pos` | `boolean not null default false` | ordena el catálogo del POS |
| `ubicacion` | `text` | pasillo/estante por defecto del producto |

`existencias` gana `ubicacion text`: la ubicación real por almacén. Si la fila
del almacén no tiene ubicación, el POS/reporte usa la del producto.

Búsqueda ultrarrápida:

- `pg_trgm` + índices GIN de trigrama en `productos.nombre`,
  `productos.referencia` y `productos.marca`.
- Índice compuesto `productos (activo, favorito_pos, categoria_id)`.
- Índices de apoyo para Kardex en `factura_lineas(producto_id)`,
  `facturas_proveedor_lineas(producto_id)` y
  `ajuste_inventario_lineas(producto_id)` (creados con `if not exists`; el de
  ajustes ya existía y se conserva).

### Códigos de barra (`producto_codigos_barra`)

`id`, `producto_id`, `unidad_id` (nullable), `codigo`, `principal`,
`creado_en`.

- Un mismo `codigo` no se repite en toda la empresa: índice único sobre
  `lower(trim(codigo))`. Sirve para EAN/UPC de fabricante, SKU interno y
  códigos por empaque.
- `unidad_id` permite que un código venda, por ejemplo, una caja y no una
  unidad base. Debe pertenecer al mismo producto.
- Como máximo un código principal por producto (índice parcial).

## 2. Unidades de medida (`producto_unidades`)

`id`, `producto_id`, `nombre`, `factor_base numeric(14,4) > 0`, `precio`
(nullable), `es_compra`, `es_venta`, `activa`, `creado_en`.

- `nombre` es la presentación: "Caja 50 lb", "Rollo 100 m", "Metro", "Libra".
- `factor_base` es cuántas unidades base contiene una presentación. Ejemplos:
  caja de 50 lb → 50; rollo de 100 m → 100; metro → 1; libra → 1.
- `precio` es el precio de venta de esa presentación. Si es `null`, el POS
  resuelve el precio de la lista/base y lo multiplica por `factor_base`.
- Único por `(producto_id, lower(nombre))`.

### Invariante central

`existencias.cantidad`, `productos.cantidad` y `productos.costo` (promedio
ponderado) **siempre están en la unidad base del producto**. Nunca se guarda
stock en cajas, rollos ni libras no-base.

Al vender o comprar una línea con `unidad_id`:

```
cantidad_base = round(cantidad * factor_base, 2)
```

- `cantidad` es la cantidad de la presentación que ve el usuario (2 cajas).
- `cantidad_base` es la que mueve existencias y costos (100 lb si la caja es
  de 50).
- El stock se valida contra `cantidad_base`.
- El costo de venta es `cantidad_base × productos.costo`.
- En la compra, el costo de la presentación se convierte a costo base:
  `costo_base = round(costo_presentación / factor_base, 2)`, y el promedio
  ponderado se calcula con cantidades base.
- La línea guarda `unidad_id`, `unidad_nombre` y `factor_base` para imprimir
  exacto y para que una devolución multiplique por el mismo factor. El
  `costo_unitario` de la línea es el de la presentación (costo base × factor)
  y el asiento usa el total en unidad base.

Columnas nuevas en `factura_lineas`, `cotizacion_lineas`,
`nota_credito_venta_lineas` y `facturas_proveedor_lineas`:

| columna | tipo |
| --- | --- |
| `unidad_id` | `uuid null → producto_unidades` |
| `unidad_nombre` | `text` (la presentación impresa) |
| `factor_base` | `numeric(14,4) not null default 1`, `> 0` |

Un trigger `_linea_completar_unidad` completa `unidad_nombre` y `factor_base`
desde `unidad_id` en cualquier inserción/edición de esas cuatro tablas, y
rechaza una unidad que no pertenezca al producto. Los motores de factura,
compra y nota de crédito ya envían los tres campos explícitos.

**Decisión y pendiente:** el RPC de cotizaciones todavía no propaga
`unidad_id` desde su JSON (su motor es compartido con remisiones y quedó fuera
de esta fase). Las columnas y el trigger están listos; cuando la pantalla de
cotizaciones envíe `unidad_id`, la impresión y la conversión a factura ya
tendrán el dato coherente.

## 3. Combos (`combo_componentes`)

`id`, `combo_id`, `componente_id`, `cantidad numeric(14,2) > 0`.

- `unique (combo_id, componente_id)` y `check (combo_id <> componente_id)`.
- Un componente debe ser un producto con `tipo = 'producto'` (inventariable o
  no, pero producto). **No se permiten combos anidados**: un componente no
  puede ser otro combo.
- Un producto que ya es componente de un combo no puede convertirse en combo.
- Un combo con componentes no puede cambiar a `producto`/`servicio` sin
  vaciar antes sus componentes.

### Alta y edición

No hay RPC nueva de combos: se usa `crear_producto` / `actualizar_producto`
con `tipo = 'combo'` y un arreglo `componentes`:

```json
{
  "tipo": "combo",
  "nombre": "Kit instalación tanque",
  "precio": 2500,
  "itbis_tasa": 18,
  "componentes": [
    { "componente_id": "…", "cantidad": 2 },
    { "componente_id": "…", "cantidad": 1 }
  ]
}
```

`crear_producto` y `actualizar_producto` también aceptan `unidades`,
`codigos_barra`, `marca`, `favorito_pos` y `ubicacion` en el mismo JSON. En
edición, enviar `componentes`/`unidades`/`codigos_barra` reemplaza el conjunto:
las unidades que sobran se desactivan (no se borran) y los códigos que sobran
se eliminan. Un combo sin componentes se puede guardar, pero no vender.

Comprar un combo no está permitido: `crear_factura_proveedor` lo rechaza con
un error claro porque el stock entra por los componentes, no por el combo.

### Venta y devolución

En `crear_factura`:

1. La cantidad de la línea se convierte a base con el factor del combo.
2. Por cada unidad base vendida se consume `componente.cantidad` de cada
   componente, en el almacén del documento.
3. Antes de escribir nada se valida `vende_negativo` de cada componente
   inventariable, con las filas de `existencias` bloqueadas `FOR UPDATE` en
   orden fijo por `producto_id` (evita deadlocks).
4. El costo de venta es la suma real de los costos promedio vigentes:
   `Σ(componente.costo × componente.cantidad × cantidad_base)`.
5. El asiento usa las cuentas de costo/inventario del combo (o las de
   `config_contable`). El detalle por componente no se contabiliza aparte.

En `crear_nota_credito_venta` se devuelve la misma cantidad base al almacén y
se reingresa al costo promedio vigente de cada componente (no al costo
histórico de la venta), igual que un producto simple. La nota de crédito no
valida `vende_negativo`: es un reingreso, no una salida de stock.

La anulación de una factura de venta devuelve la cantidad base de cada línea y
los componentes de cada combo. La anulación de una compra resta la cantidad
base y revierte el promedio con el costo base de la línea.

**Límite conocido:** el reingreso por anulación o devolución usa la definición
vigente del combo. Si el combo cambió entre la venta y la devolución, se
devuelven los componentes actuales. Para ferretería es aceptable; si se vuelve
crítico, se agregará una foto de componentes en la línea del documento.

## 4. Conteo físico

### Tablas

`conteos_inventario`: `id`, `numero int unique` (secuencia), `almacen_id`,
`fecha`, `estado ('borrador','aplicado','anulado' default 'borrador')`,
`ajuste_id` (nullable), `notas`, `creado_por`, `creado_en`.

`conteo_inventario_lineas`: `id`, `conteo_id`, `producto_id`,
`cantidad_sistema`, `cantidad_contada`, `diferencia`, `notas`.
`unique (conteo_id, producto_id)`, `cantidad_contada >= 0`.

### RPC

- `crear_conteo_inventario(p jsonb)` → id. Exige `almacen_id` activo; fecha
  opcional (hoy); estado `borrador`; si trae `lineas`, las delega a
  `guardar_lineas_conteo`.
- `guardar_lineas_conteo(p_id uuid, p jsonb)` → id. Solo en `borrador`.
  Reemplaza las líneas. La `cantidad_sistema` **no la manda el cliente**: se
  lee de `existencias` en ese momento y `diferencia = cantidad_contada −
  cantidad_sistema`. Solo acepta productos activos inventariables.
- `aplicar_conteo_inventario(p_id uuid)` → id del ajuste (o null si no hay
  diferencias). Solo en `borrador`. Recalcula y congela sistema/diferencia,
  y llama internamente a `crear_ajuste_inventario` en la misma transacción:
  diferencia positiva → línea de entrada; negativa → salida. El ajuste mueve
  stock y genera su asiento contable. Guarda `ajuste_id` y deja el conteo en
  `aplicado`. Si todas las diferencias son cero, no crea ajuste.
- `anular_conteo_inventario(p_id uuid)` → id. Solo `borrador`; un conteo
  aplicado se revierte anulando su ajuste de inventario (`anular_documento`),
  no el conteo.

## 5. Lecturas rápidas (POS)

Las tres son `stable`, `security invoker` y respetan RLS. No usan
`_almacen_principal()` (esa función interna está revocada para
`authenticated`): resuelven el almacén principal con una subconsulta sobre
`almacenes`. Si `p_almacen_id` viene null usan el principal activo.

Precio efectivo (`_precio_lista`): si hay fila en `producto_precios` para la
lista activa, `fijo` usa ese precio y `porcentaje` aplica el porcentaje sobre
`productos.precio`; si no hay lista o fila, usa `productos.precio`. Siempre
redondea a 2 y nunca devuelve negativo.

### `pos_buscar_por_codigo_barra(p_codigo, p_almacen_id, p_lista_precio_id)`

Coincidencia exacta `lower(trim(codigo))`, una fila. Devuelve producto,
`unidad_id`, `unidad_nombre`, `factor_base`, precio de la unidad (su `precio`
o el de la lista × factor), ITBIS, stock del almacén, disponibilidad y
`imagen_path`. Es el camino de la pistola del POS.

### `pos_catalogo_productos(p_almacen_id, p_lista_precio_id, p_busqueda, p_categoria_id, p_solo_favoritos, p_limit, p_offset)`

Una sola ida a la base, sin N+1. Devuelve stock del almacén, precio efectivo,
imagen y `unidades` activas como JSON. `p_busqueda` usa los índices de
trigrama sobre nombre/referencia/marca y también busca en códigos de barra.
`p_limit` se acota a 1–200 (50 por defecto) y `p_offset` nunca es negativo.
Ordena favoritos primero y luego por nombre.

`disponible`: para un producto simple es el stock del almacén; para un combo
es `min(floor(stock_componente / componente.cantidad))` considerando solo
componentes inventariables que no permiten vender en negativo. `null`
significa que ningún componente limita la venta.

### `reporte_stock_bajo(p_almacen_id)`

Productos inventariables activos con `cantidad <= minimo` (o con cantidad
negativa), ordenados por criticidad: primero los que están más por debajo del
mínimo. Devuelve `faltante = max(minimo − cantidad, 0)` y
`sugerido = max(maximo − cantidad, 0)`; si no hay máximo, sugiere hasta el
mínimo. Un producto con `minimo = 0` y cantidad 0 no entra (no está bajo
mínimo); sí entra si la cantidad es negativa.

## 6. Permisos

Tablas nuevas (`producto_codigos_barra`, `producto_unidades`,
`combo_componentes`, `conteos_inventario`, `conteo_inventario_lineas`): RLS
activo, `anon` sin acceso, `authenticated` solo `SELECT` con perfil; escritura
solo por RPC. Las RPC de conteo exigen `admin`/`contador`. Las lecturas del POS
son `security invoker`: un `lector` puede consultarlas y ve exactamente lo que
RLS le permite.

## 7. Verificación

- `supabase/tests/inventario_ferreteria_test.sql` (pgTAP): RLS, conversión de
  unidades, combos (sin anidar, descuento y costo), conteo (ajuste y asiento,
  anulación solo en borrador) y las tres lecturas.
- Candados de repo: `src/lib/supabase/migraciones.test.ts` y
  `src/lib/supabase/reset-virgen.test.ts`. Las cinco tablas nuevas están
  clasificadas en `docs/pruebas/reset-base-virgen.sql` como transaccionales.

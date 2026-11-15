# Consultas sin paginar — lecturas que se cortan en ~1,000 filas

**Fecha:** 2026-11-15 · **Rama:** `test/pruebas-carga` · **Alcance:** solo lectura de código (`src/lib/**` y `src/app/**`); no se tocó nada de la app.

## De qué va esto

La API de Supabase (PostgREST) devuelve **máximo ~1,000 filas por consulta**, también cuando la llamada es una RPC (`.rpc()`). Si el código no pagina, los datos se cortan **en silencio**: no hay error, simplemente faltan filas y los totales salen más bajos de lo real.

**Caso ya confirmado:** `obtenerVentas` del reporte 607 (`src/lib/reportes/fiscales/consultas.ts:229`) lee `facturas` sin paginar. En marzo 2023 hay ~1,700 facturas y la lectura trajo solo 1,000 (RD$30.8M de RD$52.6M → se pierde ~41 %). Ver `carga.json → cuadreMarzo2023`.

**Patrón correcto de referencia (ya existe en el repo):**

- `src/lib/reportes/ventas/v1/consultas.ts:34-52` — `consultarFacturas`: bucle `for(;;)` con `.range(inicio, inicio + 999)`, `TAMANO_LOTE = 1000`, orden estable (`fecha`, `numero`). Lo usan Ventas generales y Ventas por almacén.
- `src/lib/reportes/ventas/v2/consultas.ts:46-65` — `obtenerLineasVenta`: mismo patrón sobre `factura_lineas`. Lo usan Ventas por producto y Rentabilidad por producto.

**Datos de referencia ZZTEST cargados** (`docs/pruebas/resultados/carga.json`): ~15,000 facturas de venta, ~5,000 facturas de proveedor, ~7,000 pagos recibidos, ~3,000 pagos a proveedor, 500 notas de crédito, 300 anulaciones, 1,000 contactos (800 clientes + 200 proveedores), 300 productos, repartidos en 2021-2023. Cada documento genera ~2-4 líneas en `asiento_lineas` → la tabla `asiento_lineas` tiene del orden de **60,000-100,000 filas**.

**Arreglo típico:** copiar el bucle `.range()` de ventas/v1 (funciona igual sobre `.rpc()` porque PostgREST aplica el tope también a funciones), o mejor aún, **mover el filtro/agregado a SQL** cuando lo que se necesita es una suma o un grupo (ver detalle por hallazgo).

---

## Tabla resumen (ordenada por gravedad)

| # | Archivo:línea | Qué lee | Pantalla / reporte afectado | ¿Corta hoy con ZZTEST? | Arreglo propuesto |
|---|---------------|---------|------------------------------|------------------------|-------------------|
| 1 | `src/lib/reportes/fiscales/consultas.ts:229` | `facturas` + `factura_lineas` + `contactos` + pagos del período | **607**, impuestos-retenciones, impuestos-detallados, IT-1, exportar-contador | **SÍ — confirmado** (marzo 2023: 1,000 de ~1,700) | Paginar como ventas/v1 + paginar las 2 consultas `.in("factura_id")` de abajo |
| 2 | `src/lib/reportes/libros/consultas.ts:34` | RPC `reporte_movimientos` (1 fila por línea de asiento del período) | Libro diario, movimientos por cuenta, movimientos agrupado | **SÍ** — un mes tiene ~1,500-3,000 líneas de asiento | Paginar la RPC con `.range()` en bucle, o filtrar por página en SQL |
| 3 | `src/lib/reportes/consultas.ts:21` | RPC `reporte_libro_diario` (1 fila por línea de asiento) | Exportar para el contador | **SÍ** — mismo motivo que #2 | Igual: paginar la RPC |
| 4 | `src/lib/reportes/administrativos/d/consultas.ts:94` | `facturas` no anuladas `<= hasta` (**sin fecha inicial**) | Reporte CxC (antigüedad) | **SÍ** — 15,000+ facturas; solo trae las 1,000 más recientes | Mover a RPC tipo `reporte_cxc` (ya existe) paginada, o paginar + filtro `saldo>0` en SQL |
| 5 | `src/lib/reportes/administrativos/d/consultas.ts:116` | `facturas_proveedor` en rango | Reporte CxP (antigüedad) | **SÍ** en rangos anuales (5,000 compras) | Paginar o RPC agregada por proveedor |
| 6 | `src/lib/reportes/administrativos/d/consultas.ts:139` | `facturas_proveedor` en rango | Reporte de compras | **SÍ** en rangos anuales | Paginar como ventas/v1 |
| 7 | `src/lib/reportes/administrativos/e/consultas.ts:259 y :265` | `facturas` (fecha, subtotal) año actual y anterior | Reporte anual (gráfica ventas) | **SÍ** — ~5,000 facturas/año | Paginar o RPC que agregue por mes (`date_trunc`) |
| 8 | `src/lib/reportes/administrativos/e/consultas.ts:271` | `factura_lineas` + join `facturas` del año | Reporte anual (ranking productos) | **SÍ** — ~30,000+ líneas/año | RPC que agrupe por producto en SQL |
| 9 | `src/lib/reportes/administrativos/e/consultas.ts:277` | `facturas` (contacto, subtotal) del año | Reporte anual (ranking clientes) | **SÍ** — ~5,000/año | RPC que agrupe por contacto, o paginar |
| 10 | `src/lib/reportes/administrativos/e/consultas.ts:178, :186, :194` | `pagos_recibidos` + `pagos_proveedor` + `gastos_menores` en rango | Reporte de transacciones | **SÍ** en rangos anchos (~10,000 movimientos/año) | Paginar cada consulta o unificar en RPC |
| 11 | `src/lib/compras/consultas.ts:31` | `facturas_proveedor` **todas** (sin límite) | Lista principal de Compras (`/dashboard/compras`) | **SÍ** — 5,000 filas; solo se ven las 1,000 más nuevas | Paginar, o mejor: `.limit()` + filtros como hace facturación (decidir UX) |
| 12 | `src/lib/compras/consultas.ts:153` | `pagos_proveedor` **todas** | Lista de pagos a proveedores (`/dashboard/compras/pagos`) | **SÍ** — 3,000 filas | Igual que #11 |
| 13 | `src/lib/bancos/consultas.ts:281` | `asiento_lineas` de una cuenta banco (**toda la historia**) | Detalle de cuenta bancaria + conciliaciones | **SÍ** — miles de líneas en la cuenta de caja/banco | Paginar, o filtrar por fecha en SQL (el filtro hoy es en JS) |
| 14 | `src/app/(main)/dashboard/contabilidad/cuentas/[id]/_consultas.ts:97` | `asiento_lineas` de una cuenta (**toda la historia**) | Auxiliar de cuenta (`/dashboard/contabilidad/cuentas/[id]`) | **SÍ** — CxC/CxP/ingresos acumulan miles de líneas | Igual que #13 |
| 15 | `src/lib/reportes/fiscales/retenciones-consultas.ts:113` | `pagos_proveedor` + retenciones en rango | IR-17 y cartas de retención | **SÍ** en rango anual (3,000 pagos) | Paginar como ventas/v1 |
| 16 | `src/lib/contactos/consultas.ts:10` | `contactos` **todos** (sin límite) | Lista de Contactos | **SÍ** — 1,000 ZZTEST + clientes reales >1,000 | Paginar o `.limit()` + búsqueda server-side |
| 17 | `src/lib/asientos/consultas.ts:39` | `contactos` activos **todos** | Formulario de asiento manual | **SÍ** — mismo padrón >1,000 | Paginar o buscador server-side |
| 18 | `src/lib/reportes/libros/consultas.ts:53` | RPC `reporte_saldos_tercero` (1 fila por cuenta × contacto) | Balanza por tercero, auxiliar por tercero, movimientos agrupado | **PROBABLE** — ~800 clientes × varias cuentas CxC/CxP puede pasar de 1,000 | Paginar la RPC o filtrarla por cuenta/tercero antes |
| 19 | `src/lib/reportes/ventas/v3/consultas.ts:66` | `facturas` en rango | Reporte ventas por vendedor | **SÍ** en rangos anuales | Paginar como ventas/v1 |
| 20 | `src/lib/reportes/ventas/v3/consultas.ts:101` | `facturas` en rango | Reporte ventas por cliente | **SÍ** en rangos anuales | Paginar como ventas/v1 |
| 21 | `src/lib/reportes/fiscales/consultas.ts:251` | `pagos_recibidos` `.in("factura_id", ids)` | 607 (formas de pago) | **Posible** — hasta ~1,000 facturas × pagos | Paginar o traer por rango de fecha |
| 22 | `src/lib/reportes/fiscales/consultas.ts:257` | `pago_recibido_aplicaciones` `.in("factura_id", ids)` | 607 | **Posible** — pagos multi-factura inflan el conteo | Igual que #21 |
| 23 | `src/lib/reportes/administrativos/d/consultas.ts:178 y :187` | `facturas` (ids) + `factura_lineas` `.in("factura_id")` | Valor del inventario a fecha pasada | **SÍ** — miles de ids y líneas | Rehacer en SQL (ver detalle) |
| 24 | `src/lib/reportes/administrativos/d/consultas.ts:200 y :209` | `facturas_proveedor` (ids) + `facturas_proveedor_lineas` `.in(...)` | Valor del inventario (compras) | **SÍ** — igual | Igual que #23 |
| 25 | `src/lib/facturacion/consultas.ts:50` | `contactos` clientes/ambos activos | Selects de formularios (factura, pago, cotización, conduce, nota de débito, recurrentes) | **Borde** — ~800 ZZTEST + reales, puede pasar de 1,000 | Buscador server-side o paginar |
| 26 | `src/lib/reportes/ventas/v3/consultas.ts:138` | `contactos` clientes/ambos activos | Selector del reporte estado de cuenta cliente | **Borde** — igual que #25 | Igual |
| 27 | `src/lib/contactos/ficha-consultas.ts:178-251` | 9 consultas por contacto (`facturas`, `facturas_proveedor`, `cotizaciones`, `remisiones`, 3 tipos de notas, `pagos_recibidos`, `pagos_proveedor`, **`asiento_lineas`**) | Ficha del contacto | **Borde** — ~19 docs/contacto en ZZTEST, pero un cliente grande real con >1,000 docs corta (sobre todo `asiento_lineas`) | Paginar cada una o límite por pestaña |
| 28 | `src/lib/contactos/estado-cuenta-consultas.ts:26,33,48` | `facturas` + `pagos_recibidos` + aplicaciones por contacto | Estado de cuenta del contacto | **Borde** — igual que #27 | Paginar |
| 29 | `src/lib/productos/ficha-consultas.ts:271,276,280,281` | `factura_lineas`, `facturas_proveedor_lineas`, `cotizacion_lineas`, `remision_lineas` por producto + `facturas`/`facturas_proveedor` `.in("id")` | Ficha del producto y kardex | **Borde hoy** (~100-200 líneas/producto en ZZTEST); un producto estrella real corta | Paginar o kardex por RPC/rango de fechas |
| 30 | `src/lib/compras/consultas.ts:170` | `pago_proveedor_aplicaciones` `.in("pago_id")` | Lista de pagos a proveedores (conteo de aplicaciones) | **Posible** — hereda el corte de #12 | Paginar |
| 31 | `src/lib/compras/consultas.ts:278` | `facturas_proveedor` `estado=abierta` | Formulario de pago a proveedor | **Bajo-medio** — depende de cuántas compras queden abiertas | Filtro en SQL o límite mayor con paginación |
| 32 | `src/lib/facturacion/consultas.ts:64 y :74` | `productos` activos + `producto_precios` `.in("producto_id")` | Selects de formularios | **Bajo** — 300 productos; `producto_precios` crece con listas de precios | Vigilar; paginar si crece |
| 33 | `src/lib/monedas/consultas.ts:21` | `tasas_cambio` todas | Configuración de monedas | **Bajo hoy** — crece a diario | Paginar o limitar a rango reciente |
| 34 | `src/lib/activos-fijos/consultas.ts:49` | `activo_depreciaciones` todas | Lista de activos fijos | **Bajo** — decenas de filas | Paginar si crece |
| 35 | `src/lib/inventario/consultas.ts:126 y :245` | `ajustes_inventario` y `transferencias_inventario` todas | Listas de inventario | **Bajo** | Paginar si crecen |
| 36 | `src/lib/pagos-recurrentes/consultas.ts:22` | `pagos_recurrentes` todas | Lista de pagos recurrentes | **Bajo** | Paginar si crecen |
| 37 | `src/lib/reportes/ventas/v3/consultas.ts:155,179,186` | `facturas` + `pagos_recibidos` + aplicaciones por cliente | Estado de cuenta cliente (reporte) | **Bajo hoy** — mismo caso que #28 | Paginar |
| 38 | `src/lib/compras/consultas.ts:188,261`, `src/lib/gastos/consultas.ts:26`, `src/lib/ordenes-compra/consultas.ts:102`, `src/lib/pagos-recurrentes/consultas.ts:130`, `src/lib/activos-fijos/consultas.ts:170`, `src/lib/compras/consultas.ts:196` | `contactos`/`productos` filtrados por tipo | Selects de formularios de compras/gastos/órdenes/activos | **Bajo** — ~200 proveedores y ~300 productos ZZTEST | Vigilar |
| 39 | `src/lib/reportes/consultas.ts:56` | RPC `reporte_cxc` (1 fila por factura con saldo) | **Sin uso actual** (código muerto) | Latente — si se usa con >1,000 facturas pendientes, corta | Borrar o paginar antes de usar |
| 40 | `src/lib/reportes/ventas/v2/consultas.ts:6` | tope `MAXIMO_LINEAS = 20000` | Ventas por producto, rentabilidad | **Borde** — rangos muy anchos (>20,000 líneas) se detienen en silencio | Subir el tope o avisar cuando se alcanza |

---

## Detalle por hallazgo

### 1. Reportes fiscales (606, 607, 608, IT-1, IR-17, exportar contador)

**`src/lib/reportes/fiscales/consultas.ts`** — todas las funciones leen sin paginar:

- **`:229` `obtenerVentas`** → `facturas` con embed de `factura_lineas` y `contactos`, filtrada por fecha. **Confirmado**: el `cuadreMarzo2023` de `carga.json` muestra que la lectura simple trajo 1,000 filas (todas ZZTEST) de ~1,700 reales del mes. La pérdida es del 41 % del monto. Además, en el mismo archivo:
  - **`:251`** `pagos_recibidos` `.in("factura_id", ids)` — hasta 1,000 facturas; si hay varios pagos por factura, supera 1,000.
  - **`:257`** `pago_recibido_aplicaciones` `.in("factura_id", ids)` — pagos multi-factura generan varias filas por factura.
  - Alimenta: `/reportes/607`, `/reportes/impuestos-retenciones`, `/reportes/impuestos-detallados`, `/reportes/it1`, `/reportes/exportar-contador`.
- **`:453` `obtenerCompras`** → `facturas_proveedor` con embed de líneas + `gastos_menores` (`:464`), mismo patrón. 606 y los mismos reportes de impuestos. 5,000 compras ZZTEST → cualquier rango anual corta.
- **`:502` `obtenerDevolucionesVentas`** → `notas_credito_venta`. Hoy ~500 notas → mensual/ anual probablemente bajo 1,000, pero sin paginar es una bomba de tiempo.
- **`:563`, `:570`, `:577` `obtenerAnulados`** → `facturas`, `gastos_menores`, `notas_credito_venta` con `estado=anulada`. 300 anulaciones ZZTEST → bajo hoy.
- **`:632` `obtenerEmpresa`** → `.maybeSingle()` — correcto.

**`src/lib/reportes/fiscales/retenciones-consultas.ts:113`** → `pagos_proveedor` con embeds de retenciones, por rango de fechas. Es la fuente del **IR-17** y de las **cartas de retención** — reportes que se entregan a la DGII por año. Con 3,000 pagos ZZTEST, un año completo devuelve solo 1,000 → retenciones faltantes en el archivo. **Prioridad alta.**

**Arreglo sugerido:** extraer el bucle `.range()` de `ventas/v1/consultas.ts` a un helper compartido (ej. `src/lib/reportes/paginar.ts`) y aplicarlo a cada consulta; las `.in()` se pueden paginar por fecha o por lotes de ids.

### 2. Libros contables y reportes administrativos

**`src/lib/reportes/libros/consultas.ts`**

- **`:34` `obtenerMovimientos`** → RPC `reporte_movimientos`. La función devuelve **una fila por línea de asiento** del período (`asiento_lineas` unida a `asientos`). Con ~750 documentos/mes en ZZTEST y 2-4 líneas por asiento, **un solo mes ya supera 1,000 filas**. PostgREST corta la RPC igual que una tabla → el libro diario muestra totales y filas incompletos. La página (`reportes/libro-diario/page.tsx`) pagina en JS sobre esas filas, así que "funciona" pero con datos incompletos. Lo mismo `movimientos-cuenta` y `movimientos-cuenta-agrupado`.
- **`:53` `obtenerSaldosTercero`** → RPC `reporte_saldos_tercero`: una fila por (cuenta × contacto) con movimientos. Solo la cuenta CxC con ~800 clientes ya son ~800 filas; sumando CxP y otras cuentas con tercero, probablemente supera 1,000 hoy. Páginas: balanza-tercero, auxiliar-tercero, movimientos-cuenta-agrupado.
- **`:73` `obtenerSaldosCuentas`** → RPC `reporte_saldos_cuentas`: una fila por cuenta — <1,000. **OK.**
- **`:86` `obtenerContactos`**, **`:95` `obtenerCuentas`** → catálogos (ver #16 y #17 para contactos).

**`src/lib/reportes/consultas.ts`**

- **`:21` `obtenerLibroDiario`** → RPC `reporte_libro_diario`, una fila por línea de asiento. Solo la usa `exportar-contador`, pero con el mismo corte que #2.
- **`:32`, `:46`, `:72`, `:77`** → RPCs `reporte_balance_comprobacion`, `reporte_estado_resultados`, `reporte_estado_resultados_centro`: devuelven una fila por cuenta — **OK**.
- **`:56` `obtenerCxc`** → RPC `reporte_cxc` (una fila por factura con saldo). **No tiene llamadores** (código muerto), pero si se usa cortaría: hay miles de facturas con saldo potencial.

**`src/lib/reportes/administrativos/d/consultas.ts`** (antigüedad CxC/CxP, compras, inventario)

- **`:94` `obtenerCarteraCxc`** → `facturas` no anuladas con `fecha <= hasta` **sin fecha mínima**: trae TODA la historia y filtra saldo en JS. 15,000+ facturas → devuelve solo las 1,000 más recientes (orden `fecha desc`), así que las deudas viejas desaparecen del reporte. Además `convertirCartera` descarta saldo ≤ 0 en JS — el filtro debería estar en SQL.
- **`:116` `obtenerCarteraCxp`** → `facturas_proveedor` en rango. 5,000 compras → corta en rangos anuales.
- **`:139` `obtenerCompras`** → `facturas_proveedor` en rango para el reporte de compras. Igual.
- **`:178` + `:187` `movimientosVenta`** → primero `facturas` (solo ids, `.gt("fecha")`) y luego `factura_lineas` `.in("factura_id", ids)`. Con "hasta" en el pasado, ids puede ser ~15,000 y líneas ~30,000 → ambas consultas cortan en 1,000 y el costo unitario queda mal sumado.
- **`:200` + `:209` `movimientosCompra`** → mismo patrón con compras. Usado por `valor-inventario` cuando la fecha es histórica.
- **`:223` `obtenerInventario`** → `productos` inventariables (~300) — **OK hoy**.

**`src/lib/reportes/administrativos/e/consultas.ts`** (ingresos/compras, transacciones, reporte anual)

- **`:178`, `:186`, `:194` `obtenerTransacciones`** → `pagos_recibidos` + `pagos_proveedor` + `gastos_menores` en rango, luego ordena/filtra/pagina **todo en JS**. Un año ZZTEST son ~10,000 movimientos → corta. El reporte `transacciones` es de los más usados.
- **`:259`, `:265`, `:271`, `:277` `obtenerDatosReporteAnual`** → siempre un año completo: `facturas` ×2 (año y año anterior), `factura_lineas` con join, `facturas` para clientes. Todas cortan en 1,000 → la gráfica de ventas y los rankings de productos/clientes del reporte anual salen incompletos. **Prioridad alta.**
- **`:31` `obtenerDatosIngresosCompras`** → `cuentas` filtradas + RPC `reporte_estado_resultados` — catálogos y agregado por cuenta, **OK**.

**`src/lib/reportes/estados/consultas.ts`** → solo RPCs que devuelven una fila por cuenta (`reporte_estado_resultados_centro`, `reporte_balance_comprobacion`) — **OK**.

### 3. Listas principales de documentos (los módulos)

- **`src/lib/compras/consultas.ts:31` `listarFacturasProveedor`** → `facturas_proveedor` **todas** sin límite. Es la lista principal de Compras: con 5,000 ZZTEST solo se ven las 1,000 más recientes y las demás "desaparecen". Comparar con `getFacturasLista` de facturación que sí usa `.limit(300)` a propósito.
- **`src/lib/compras/consultas.ts:153` `listarPagosProveedor`** → `pagos_proveedor` todas (3,000). Ídem en `/compras/pagos`. Además **`:170`** baja `pago_proveedor_aplicaciones` `.in("pago_id", ids)` sin paginar.
- **`:278` `cargarOpcionesPago`** → `facturas_proveedor` `estado=abierta` sin límite: depende de cuántas compras abiertas haya.
- **`src/lib/contactos/consultas.ts:10` `listarContactos`** → `contactos` todos. Con 1,000 contactos ZZTEST + los reales ya hay >1,000 → la lista de Contactos pierde filas. **Corta hoy.**
- Listas con `.limit(300)` o `.limit(500)` **correctas**: facturas (`facturacion/consultas.ts:132`), pagos recibidos (`pagos/consultas.ts:74`), gastos (`gastos/consultas.ts:60`), notas de crédito/débito venta y compra, cotizaciones/remisiones, órdenes de compra, facturas recurrentes, asientos (`asientos/consultas.ts:18`), activos fijos (`activos-fijos/consultas.ts:47`), facturas abiertas para pago (`pagos/consultas.ts:17`, tope 300), selector de nota de débito (`notas-debito/consultas.ts:131`, tope 500).

### 4. Movimientos de banco y auxiliar de cuenta

- **`src/lib/bancos/consultas.ts:281` `cargarLineasCuenta`** → `asiento_lineas` `.eq("cuenta_id")` **de toda la historia**, sin filtro de fecha en SQL (el rango se aplica en JS con `calcularMovimientosBanco`). La cuenta de caja/banco acumula una línea por cada factura contado, pago y gasto → miles de filas → **corta hoy**. Alimenta el detalle de cuenta en `/dashboard/bancos/[id]` y las conciliaciones (`getDetalleConciliacion`, `getInicioConciliacion` en `bancos/conciliaciones.ts`).
- **`src/app/(main)/dashboard/contabilidad/cuentas/[id]/_consultas.ts:97` `obtenerCuentaDetalle`** → idéntico patrón: `asiento_lineas` por cuenta, toda la historia, filtro de fechas en JS. Es el **auxiliar de cuenta**. La cuenta CxC sola tiene ~10,000 líneas. **Corta hoy.** Después `cargarAsientos` (`:62`) baja `asientos.in("id", ids)` — si `ids` supera 1,000 también corta.
- **`src/lib/contactos/ficha-consultas.ts:242`** → `asiento_lineas` `.eq("contacto_id")` sin límite dentro de la ficha del contacto (ver #27).

### 5. Fichas por contacto y por producto

- **`src/lib/contactos/ficha-consultas.ts:160-252` `obtenerFichaContacto`** → 9 consultas por `contacto_id` sin límite: facturas, compras, cotizaciones, remisiones, 3 tipos de notas, pagos recibidos, pagos a proveedor y `asiento_lineas`. En ZZTEST hay ~19 documentos por cliente en promedio, así que hoy no corta; pero un cliente real grande (>1,000 documentos o >1,000 líneas de asiento) sí. La ficha muestra listas "recientes primero", así que el corte quita lo más viejo en silencio.
- **`src/lib/contactos/estado-cuenta-consultas.ts:26,33,48`** → `facturas`, `pagos_recibidos` y `pago_recibido_aplicaciones` por contacto. Mismo riesgo por cliente grande.
- **`src/lib/productos/ficha-consultas.ts:271,276,280,281`** → todas las líneas de venta/compra/cotización/remisión del producto (`.eq("producto_id")`) y luego `facturas`/`facturas_proveedor` `.in("id", ids)` (`:100`, `:120`). Con ~100-200 líneas por producto en ZZTEST hoy está bajo 1,000, pero un producto de alta rotación lo supera y el kardex sale incompleto.

### 6. Selects de formularios (contactos y productos)

Estos no son reportes pero alimentan combos que deben mostrar **todos** los registros:

- **`src/lib/facturacion/consultas.ts:50` `getContactosClientes`** → clientes/ambos activos. ~800 ZZTEST + reales → al borde de 1,000. Lo usan: factura nueva, pago recibido, cotización, conduce, nota de débito, facturas recurrentes.
- **`src/lib/asientos/consultas.ts:39` `getDatosFormularioAsiento`** → **todos** los contactos activos (cliente+proveedor+ambos) → >1,000 seguro. Asiento manual.
- **`src/lib/reportes/ventas/v3/consultas.ts:138` `listarClientes`** → mismo padrón de clientes para el selector de estado de cuenta.
- **`src/lib/facturacion/consultas.ts:64` `getProductosActivos`** y **`:74` `producto_precios.in()`** → ~300 productos hoy; `producto_precios` crece con cada lista de precios (productos × listas).
- Consultas de proveedores (`contactos` tipo proveedor/ambos): `compras/consultas.ts:188,261`, `gastos/consultas.ts:26`, `ordenes-compra/consultas.ts:102`, `pagos-recurrentes/consultas.ts:130`, `activos-fijos/consultas.ts:170` → ~200 ZZTEST, bajo pero sin límite.
- Catálogos que sí están bien por tamaño: `cuentas`, `impuestos`, `numeraciones`, `config_contable`, `centros_costo`, `vendedores`, `monedas`, `almacenes`, `categorias_productos`, `listas_precios`, `plantillas_impresion`, `periodos_contables`, `empresa`, `perfiles`.

### 7. Tablas chicas que crecen lento (anotar, no urgente)

- `monedas/consultas.ts:21` `tasas_cambio` — una fila por moneda por día; en años llegará a 1,000.
- `activos-fijos/consultas.ts:49` `activo_depreciaciones` — una por activo por mes.
- `inventario/consultas.ts:126,245` ajustes y transferencias — todas, sin límite.
- `pagos-recurrentes/consultas.ts:22` planes recurrentes — todas.
- `compras/consultas.ts:170` aplicaciones de pagos a proveedor `.in()` — depende de #12.

### 8. Observaciones

- **`src/lib/reportes/ventas/v2/consultas.ts:6`**: `MAXIMO_LINEAS = 20000` — el bucle para en 20,000 líneas aunque haya más. Con el volumen ZZTEST, un rango de varios años lo alcanza; conviene avisar o subir el tope.
- **`obtenerCxc` (`reportes/consultas.ts:54`)**: RPC `reporte_cxc` sin llamadores en `src/app` — código muerto que, de usarse, cortaría igual que las demás.
- Las **RPC de reportes que devuelven una fila por cuenta** (`reporte_balance_comprobacion`, `reporte_estado_resultados`, `reporte_estado_resultados_centro`, `reporte_saldos_cuentas`, `saldos_caja_banco`, `dashboard_resumen`) están bien: el plan de cuentas es <1,000.
- Las **RPC de escritura** (`crear_factura`, `registrar_pago_*`, etc.) devuelven un id — no aplica.
- La paginación en JS que existe (`libro-diario.ts`, `transacciones.ts`, `parametros.ts`, `ventas-cliente.ts`, `paginador.tsx`) **no arregla** el problema: solo reparte en páginas las filas que ya llegaron cortadas.

---

## Resumen ejecutivo para decidir orden de arreglo

1. **Primero lo fiscal y lo contable que ya corta:** 607/606/IT-1/IR-17 (`fiscales/consultas.ts`, `retenciones-consultas.ts`), libro diario y movimientos (`reportes_movimientos`, `reporte_libro_diario` RPC), CxC/CxP (`administrativos/d`), reporte anual y transacciones (`administrativos/e`).
2. **Segundo las listas que ya pierden documentos:** compras (`listarFacturasProveedor`, `listarPagosProveedor`), contactos (`listarContactos`, selects de formularios), auxiliar de cuenta y detalle de banco (`asiento_lineas` por cuenta).
3. **Después los bordes:** fichas de contacto/producto, selects de clientes, y las tablas chicas que crecen.
4. **Arreglo base sugerido:** un helper `paginarConsulta(fn)` que replique el bucle `.range()` de `ventas/v1` (sirve para `.from()` y `.rpc()`), más mover a SQL los agregados que hoy se hacen en JS (cartera, inventario histórico, anuales).

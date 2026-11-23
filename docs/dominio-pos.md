# Punto de venta (POS) — contrato de datos y RPCs

**Estado:** propuesta de diseño. No implementa código, no crea la migración y no aplica nada en Supabase.
**Rama:** `feat/docs-dominio-pos`, desde `origin/main` `e15e557`.
**Alcance:** contrato completo de tablas, columnas, RPCs, RLS, impresión e invariantes del módulo POS. Es la fuente de verdad para 2A (migración + pgTAP + `types.ts`), 2B (capa TS), 2C (configuración + sidebar) y 2D (UI `/pos`).

> **Reglas anti-confusión (obligatorias).**
> 1. El POS es **la misma contabilidad**, no un sistema paralelo: cada venta crea una fila real en `facturas`, descarga inventario y genera asiento en la misma transacción.
> 2. Colores: **solo** los tokens de `docs/plantilla-diseno.md` (shadcn/Base UI, `--primary` azul). **Nunca** el teal `#00b19d` de Alegra ni hex sueltos.
> 3. Sin multi-empresa: se usa la fila única de `empresa` (`empresa.nombre`, `empresa.rnc`, etc.). No se agrega `empresa_id`.
> 4. Nada de textos de marca hardcodeados en tablas, RPCs ni tickets. El ticket usa `empresa.*`; si un dato falta, se omite la línea.
> 5. El POS solo tiene **Vender**, **Ventas**, **Pagos**, **Turnos** y **Devoluciones**. Inventario y Configuración viven en Contabilidad.
> 6. No se copia código, HTML, CSS, textos ni diseño exacto de Alegra. El estudio de `docs/alegra/pos/` es inspiración funcional.

---

## 0. Lo que existe hoy (verificado en el repo)

| Pieza | Archivo / referencia | Comportamiento actual |
| --- | --- | --- |
| `facturas` | `20261113140000_motor_contable.sql:206-226` + migraciones posteriores | `id`, `numero`, `tipo_comprobante`, `ncf`, `contacto_id`, `fecha`, `vencimiento`, `subtotal`, `descuento`, `itbis`, `total`, `pagado`, `estado` (`abierta`/`pagada`/`anulada`), `notas`, `terminos`, `pie`, `asiento_id`, `creado_por`, `creado_en`. Después suma `credito`, `retenido`, `otros_impuestos`, `propina`, `almacen_id`, `vendedor_id`, `centro_costo_id`, `fecha_anulacion`, `motivo_anulacion_id`. **No** tiene `origen`, `turno_id`, `monto_recibido` ni `cambio`. |
| `pagos_recibidos` | `20261113140000_motor_contable.sql:247-261` | `numero`, `contacto_id`, `factura_id`, `fecha`, `cuenta_id` (caja/banco), `metodo` (`efectivo`/`transferencia`/`tarjeta`/`cheque`), `monto > 0`, `estado`, `notas`, `asiento_id`, `retenido`. **No** tiene `turno_id`. |
| `notas_credito_venta` | `20261113220000_notas_credito_venta.sql:30-46` + posteriores | `ncf` B04, `factura_id not null`, `contacto_id`, `fecha`, `subtotal`, `itbis`, `total`, `devuelve_inventario`, `estado` (`activa`/`anulada`), `notas`, `asiento_id`, `almacen_id`, `otros_impuestos`, `propina`. **No** tiene `turno_id`, `tipo_reembolso`, `monto_reembolso_efectivo` ni `cuenta_reembolso_id`. |
| `cotizaciones` | `20261113230000_cotizaciones_remisiones.sql:15-30` + posteriores | `numero`, `contacto_id`, `fecha`, `vencimiento`, `subtotal`, `descuento`, `itbis`, `total`, `estado` (`abierta`/`convertida`/`anulada`), `factura_id`, `notas`, `terminos`, `vendedor_id`, `centro_costo_id`, `otros_impuestos`, `propina`. **No** tiene `origen` ni `turno_id`. |
| `crear_factura(p jsonb)` | Wrapper vigente en `20261115701000_motor_impuestos.sql:325-374`; el stock en `20261118190224_vende_negativo_motor.sql` | Crea factura real con NCF de `numeraciones` (activa del tipo, `id` más bajo, `for update`), ITBIS/impuestos, descarga inventario y asiento. Acepta `tipo_comprobante`, `contacto_id`, `fecha`, `vencimiento`, `notas`, `terminos`, `pie`, `vendedor_id`, `centro_costo_id`, `almacen_id`, `lineas` y `pago` (un solo pago). |
| `registrar_pago_recibido(p jsonb)` | `20261113220000_notas_credito_venta.sql:359-504` (con retenciones en `20261115100100`) | `{factura_id?, contacto_id?, fecha, cuenta_id, metodo, monto, notas?}`. Valida cuenta `es_caja_banco`, saldo, crea pago y asiento `Dr caja/banco / Cr CxC`, actualiza `pagado` y estado. Devuelve el `id` del pago. |
| `crear_cotizacion(p jsonb)` | `20261115400000_documentos_venta_editar_clonar.sql:28-45` | Llama `_crear_documento_no_contable('cotizacion', p)`. No emite NCF, no mueve inventario, no genera asiento. Líneas con `producto_id`, `descripcion`, `cantidad`, `precio`, `descuento_pct`, `itbis_tasa`, `impuesto_id`. |
| `crear_nota_credito_venta(p jsonb)` | `20261124100100_costeo_salida_nc.sql:140-420` | `{factura_id, fecha?, notas?, devuelve_inventario?, almacen_id?, lineas:[{factura_linea_id, cantidad}]}`. Asigna B04, crea asiento `Dr Devoluciones en ventas + Dr ITBIS / Cr CxC`, devuelve inventario al **costo promedio vigente**, actualiza `facturas.credito` y estado. |
| `crear_gasto_menor(p jsonb)` | `20261113140000_motor_contable.sql:1612-1737` | `{fecha, descripcion, subtotal, itbis_tasa?, cuenta_gasto_id?, cuenta_pago_id?, contacto_id?}`. Asigna B13, crea gasto y asiento `Dr gasto + Dr ITBIS adelantado / Cr caja`. |
| `_crear_asiento(...)` | `20261113140000_motor_contable.sql:510-593` + centros de costo | `(p_fecha date, p_descripcion text, p_origen_tipo text, p_origen_id uuid, p_lineas jsonb)`. Valida 2+ líneas, un solo lado por línea, cuentas de detalle y débitos = créditos. |
| Checklist de asientos | `20261124100000_inventario_inicial_asiento.sql:74-92` | `asientos_origen_tipo_check` admite hoy: `factura`, `pago_recibido`, `factura_proveedor`, `pago_proveedor`, `gasto_menor`, `manual`, `anulacion`, `nota_credito_venta`, `nota_credito_compra`, `nota_debito`, `transferencia`, `deposito`, `conciliacion`, `ajuste_inventario`, `saldo_inicial`, `inventario_inicial`. |
| `anular_documento` | `20261124110000_anulacion_fecha_motivo.sql:87+` | Solo `factura` y `gasto_menor` aceptan fecha/motivo; la anulación de nota de crédito no está implementada en la app. No se usa en el POS. |
| Configuración contable | `config_contable` + `docs/motor-contable.md` | 20 claves (`caja`, `banco`, `caja_chica`, `cxc`, `inventario`, `itbis_adelantado`, `cxp`, `itbis_por_pagar`, `ventas`, `ventas_servicios`, `costo_ventas`, `gastos_generales`, `ajuste_inventario`, retenciones, `ajustes_iniciales`, `ajustes_iniciales_inventario`, `devoluciones_ventas`). |
| Inventario y precios | `20261114500000_inventario.sql`, `20261114900000`, `20261117210938`, `20261118190224` | `almacenes`, `existencias(producto_id, almacen_id, cantidad)`, `listas_precios`, `producto_precios`, `productos.tipo` (`producto`/`servicio`/`combo`), `vende_negativo`. |
| Crédito | `20261120120000_limite_credito.sql` | `contactos.limite_credito numeric(14,2)` existe y se persiste, pero **nadie lo hace cumplir** todavía. |
| Impresión Carta | `src/components/documento-venta/documento-papel.tsx`, `plantillas_impresion` | Documento formal para factura, cotización y conduce; usa `empresa`, `contacto`, líneas, impuestos y `mostrar_logo` de `plantillas_impresion`. |
| Fase 1 de inventario (en curso) | `20261125100000_inventario_ferreteria_catalogo.sql`, `20261125101000_inventario_ferreteria_motor.sql` (worktree aparte, aún no en `main`) | Agrega `producto_unidades`, `producto_codigos_barra`, `combo_componentes`; columnas `unidad_id`/`unidad_nombre`/`factor_base` en líneas; `crear_factura` acepta `unidad_id` y expande combos; crea las RPC de lectura `pos_catalogo_productos` y `pos_buscar_por_codigo_barra`. **El POS no las redefine.** |

**Lo que no existe hoy:** tablas `pos_*`, columnas de turno en facturas/cotizaciones/pagos/notas, `monto_recibido`/`cambio`, columnas de reembolso en notas, cuentas semilla de sobrante/faltante, enforcement del límite de crédito, RPCs del POS, componente de ticket térmico, rutas `/pos` y pantalla de configuración de terminales.

**Consecuencia de diseño:** el POS no puede ser solo pantalla. Necesita tablas transaccionales propias (terminales, turnos, movimientos), extensiones aditivas a los documentos existentes para trazabilidad, RPCs transaccionales que reutilicen el motor y un contrato de impresión separado del PDF Carta. La contabilidad existente no cambia de comportamiento: todo lo nuevo entra con defaults que dejan los documentos actuales como `origen = 'contabilidad'` y sin turno.

---

## 1. Decisión de producto

### 1.1 Qué es y qué no es el POS

**Es** una caja rápida para mostrador: buscar producto o escanear código, armar un carrito, cobrar en efectivo/tarjeta/transferencia o a crédito, guardar una cotización rápida, abrir/cerrar turno con arqueo y hacer devoluciones con nota de crédito B04. Todo comparte el mismo Postgres, el mismo catálogo, el mismo inventario y el mismo motor de asientos.

**No es** un sistema aparte, no tiene base propia, no sincroniza, no duplica inventario, no crea "facturas POS" en otra tabla y no tiene multi-empresa ni multi-sucursal.

### 1.2 Pantallas y rutas

| Pantalla | Ruta | Qué hace |
| --- | --- | --- |
| Vender | `/pos` | Catálogo en tarjetas + carrito «Factura de venta» (panel fijo de 400 px) + checkout en dos pasos + venta simple + cotización rápida + cargar cotización. Es la pantalla principal. |
| Pagos | `/pos/pagos` | Ingresos y retiros de efectivo de los turnos (`pos_turno_movimientos`), con «Nuevo pago» que exige turno abierto y calcula el efectivo esperado. |
| Turnos | `/pos/turnos` | Turno en curso, resumen, movimientos de caja, cierre con conteo real, historial de cierres e impresión del cierre. |
| Ventas | `/pos/historial` | Facturas del POS (`origen = 'pos'`), maestro-detalle, pagos, notas de crédito, ticket y PDF Carta. |
| Devoluciones | `/pos/devoluciones` | Lista de devoluciones del POS y wizard de 3 pasos para crear una B04 (efectivo, crédito o combinado). |
| Configuración → POS | `/dashboard/configuracion/pos` | Terminales: almacén, cuentas por método, numeración, lista de precios, contacto por defecto, centro de costo y plantilla del ticket. |

- El POS vive en un **layout propio** `src/app/(pos)/pos/` sin el sidebar de Contabilidad. La navegación es un **riel lateral** (`menu-pos.tsx`): riel de 56 px que expande un panel de 271 px al hover/foco (con pin fijable) y cajón móvil de 271 px bajo 1024 px. Menú plano: Facturar → `/pos`; Ventas → `/pos/historial`; Pagos → `/pos/pagos`; Turnos → `/pos/turnos`; Devoluciones → `/pos/devoluciones`; separador; Contactos/Inventario/Configuraciones → `/dashboard/...` en pestaña nueva. El pie lleva el selector de terminal, la insignia de turno (ABIERTO/CERRADO), el usuario, «Volver a Contabilidad» y «Salir».
- El menú principal agrega **Punto de venta** con `newTab: true` hacia `/pos` (`src/navigation/sidebar/sidebar-items.ts`). No duplica las pantallas de Inventario ni Configuración.
- La configuración de terminales sí vive en el dashboard (`/dashboard/configuracion/pos`) y se enlaza desde la tarjeta «Punto de venta» del hub de Configuración.

### 1.3 Roles

| Acción | `admin` | `contador` | `lector` |
| --- | --- | --- | --- |
| Ver terminales, turnos, historial y devoluciones | Sí | Sí | Sí (solo lectura) |
| Crear/editar terminales | Sí | Sí | No |
| Abrir/cerrar turno | Sí | Sí | No |
| Vender, cotizar, devolver | Sí | Sí | No |
| Ver el ticket/PDF | Sí | Sí | Sí |

- Las RPC de escritura exigen `rol_actual() in ('admin','contador')`; si no, `raise exception 'sin permiso' using errcode = '42501'`.
- **No se agrega el rol `cajero` en esta fase.** El POS opera con `admin`/`contador`. Un rol de cajero con permisos limitados (solo vender, no ver contabilidad) es una fase posterior: requiere nuevo rol, RLS, menú y pruebas.
- La UI no es la frontera de seguridad: aunque un `lector` abra `/pos`, las RPC de escritura lo rechazan.

### 1.4 Flujo de una venta

1. La cajera elige la terminal (si hay una sola, se autoselecciona) y ve el estado del turno.
2. Si no hay turno abierto, lo abre con una **base inicial** (conteo físico). Sin turno abierto no se vende ni se devuelve.
3. Busca productos por nombre/referencia/marca o escanea un código de barra. El catálogo devuelve precio de la lista del terminal, ITBIS y existencia del almacén del terminal.
4. Agrega líneas al carrito (cliente, cantidad, unidad, precio editable, descuento). Puede usar **venta simple** (monto libre sin producto) o **cargar una cotización abierta**.
5. Elige cliente (por defecto el contacto de la terminal, normalmente Consumidor Final), tipo de comprobante y lista de precios.
6. Cobra:
   - **Pago simple:** efectivo, tarjeta débito, tarjeta crédito o transferencia.
   - **Combinado:** varias filas, cada una con su método, cuenta y monto.
   - **Crédito o pago parcial:** si la suma de pagos es menor al total, el saldo queda en CxC y la factura nace `abierta`.
   - El **cambio** se calcula solo sobre el efectivo recibido; el servidor lo calcula y lo guarda.
7. `pos_completar_venta` hace todo en **un solo round-trip**: factura real, NCF, ITBIS, inventario, asiento, pagos, turno y payload de impresión.
8. La confirmación ofrece **Imprimir ticket** y **Imprimir PDF (Carta)**, y «Nueva venta».
9. La factura aparece en **Ingresos → Facturas de venta** como cualquier otra, con su NCF y su asiento.

### 1.5 Flujo de turno

1. **Abrir:** terminal activa, sin otro turno abierto, `base_inicial >= 0`. La base es un conteo físico de arranque; no genera asiento.
2. **Operar:** ventas, cobros de facturas, gastos menores, ingresos/retiros de efectivo. Todo lo que entra o sale de la caja queda en `pos_turno_movimientos` y en el asiento correspondiente.
3. **Cerrar:** se muestra el resumen con `efectivo_esperado`, se escribe el `efectivo_real` contado y una observación. El servidor congela el esperado, calcula la diferencia y, si se pide, genera el asiento de sobrante/faltante.
4. **Historial:** los cierres quedan con su número, terminal, fechas, base, esperado, real y diferencia. No se reabren; un error se corrige con un movimiento nuevo en un turno nuevo o desde Contabilidad.
5. **Un solo turno abierto por terminal** es un candado de base de datos (índice único parcial), no solo una validación de pantalla.

### 1.6 Flujo de devolución

1. Se elige una factura no anulada y las líneas/cantidades a devolver.
2. Se elige el tipo de reembolso: **crédito a factura** (no sale dinero), **efectivo** (sale del cajón de la terminal) o **combinado** (una parte efectivo y otra crédito; ambas mayores a cero y suman el total de la devolución).
3. Se crea una **nota de crédito B04 real** con `crear_nota_credito_venta`: revierte ingreso/ITBIS, devuelve inventario al costo promedio vigente y acredita la CxC.
4. Por la parte en efectivo se crea, en la misma transacción, el asiento `Dr CxC / Cr caja de la terminal`; eso neutraliza el crédito de la CxC por esa parte y baja el efectivo esperado del turno.
5. La devolución queda ligada al turno y se puede imprimir como ticket. La factura original muestra el crédito aplicado.

### 1.7 Qué se reutiliza y qué se agrega

| Se reutiliza tal cual | Se agrega |
| --- | --- |
| `facturas`, `factura_lineas`, `pagos_recibidos`, `notas_credito_venta`, `cotizaciones`, `asientos`, `asiento_lineas` | `pos_terminales`, `pos_turnos`, `pos_turno_movimientos` |
| `crear_factura`, `registrar_pago_recibido`, `crear_cotizacion`, `crear_nota_credito_venta`, `crear_gasto_menor`, `_crear_asiento` | RPC `pos_*` que orquestan el motor y ligan turno/origen |
| `productos`, `existencias`, `almacenes`, `listas_precios`, `producto_precios`, `impuestos` | Columnas de unidad/combos de la fase 1 de inventario (dependencia, no se redefinen) |
| `numeraciones`, `contactos`, `cuentas`, `config_contable`, `centros_costo`, `vendedores` | Semilla de cuentas de sobrante/faltante y contacto Consumidor Final |
| `plantillas_impresion`, `DocumentoPapel` | Componente de ticket térmico 80/57 mm y su plantilla JSON |
| RLS de lectura y RPC `security definer` | RLS de las tablas nuevas y auditoría de turnos/terminales/movimientos |

### 1.8 Fuera de alcance de esta fase

- Facturación electrónica e-CF, XML, firma y envío a DGII.
- NCF manual por factura (vive en el plan de `docs/dominio-ncf-manual.md`; el POS no envía `ncf_manual`).
- Modo offline, cola de sincronización o POS en otro dispositivo sin conexión.
- Multi-empresa, multi-sucursal, monedas distintas a la base.
- Rol `cajero`, propinas/restaurante, báscula, promociones, programas de puntos.
- Devolución a tarjeta/banco desde el POS (solo efectivo o crédito a factura; un reembolso bancario se hace desde Contabilidad → Notas de crédito).
- Impresión directa ESC/POS a la impresora (se usa el diálogo del navegador con `@media print`).
- Edición o anulación de una venta POS: se anula desde Ingresos → Facturas con el flujo existente (primero sus pagos). El POS no duplica esa acción.
- Borrado físico de turnos, movimientos o terminales. No existe.

---

## 2. Modelo de datos

### 2.1 Principios

- Todo es **aditivo y reintentable**: `add column if not exists`, `create table if not exists`, `create index if not exists`, semillas con `on conflict do nothing`. No se edita ninguna migración aplicada.
- Dinero: `numeric(14,2)`, redondeo a 2 decimales en el servidor. Nunca `float`/`double`.
- Ids: `uuid default gen_random_uuid()`. Fechas de documento: `date`. Marcas de tiempo: `timestamptz` (`now()`); la UI las muestra en `America/Santo_Domingo`.
- `numeraciones` de documentos: secuencias `int` con `nextval` (como las existentes). Los números son globales y únicos, no por terminal.
- Ningún documento se borra: se anula o se corrige con un movimiento inverso. Las tablas nuevas no tienen política de `DELETE`.
- Los defaults dejan todo lo existente como está: facturas y cotizaciones actuales quedan `origen = 'contabilidad'` y `turno_id = null`; notas actuales quedan `tipo_reembolso = 'credito_factura'`, reembolso 0 y cuenta null.

### 2.2 `pos_terminales` (catálogo/configuración)

Se administra en `/dashboard/configuracion/pos`. Una fila = una caja/terminal física o lógica. **No** se siembra una terminal por defecto: la configura Waldy con sus cuentas.

| Columna | Tipo | Nulo | Default | Regla |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | No | `gen_random_uuid()` | PK. |
| `nombre` | `text` | No | — | Obligatorio, `trim`, 1–80 caracteres. Único por `lower(btrim(nombre))`. |
| `almacen_id` | `uuid` | No | — | FK `almacenes(id)`. Debe estar activo. Es el almacén del que descarga el POS. |
| `cuenta_efectivo_id` | `uuid` | No | — | FK `cuentas(id)`. `es_caja_banco = true` y `activa = true`. Es el cajón físico de la terminal. |
| `cuenta_tarjeta_debito_id` | `uuid` | Sí | `null` | FK `cuentas(id)`. Si existe: `es_caja_banco = true`, activa, **distinta** de `cuenta_efectivo_id` y de la cuenta de efectivo de cualquier terminal activa. Si es null, el método «tarjeta débito» no está disponible. |
| `cuenta_tarjeta_credito_id` | `uuid` | Sí | `null` | Igual que débito. |
| `cuenta_transferencia_id` | `uuid` | Sí | `null` | Igual que débito. |
| `numeracion_defecto_id` | `uuid` | No | — | FK `numeraciones(id)`. Activa y de tipo `01`, `02`, `14`, `15` o `16`. Define el **tipo** de comprobante por defecto; la serie concreta la resuelve `crear_factura` (activa del tipo, `id` más bajo). |
| `lista_precio_defecto_id` | `uuid` | Sí | `null` | FK `listas_precios(id)`. Si existe, activa. Si es null, se usa el precio base del producto. |
| `contacto_defecto_id` | `uuid` | No | — | FK `contactos(id)`. Activo y `tipo in ('cliente','ambos')`. Es el **Consumidor Final** de esa terminal: el crédito se bloquea cuando la venta usa este contacto. |
| `centro_costo_id` | `uuid` | Sí | `null` | FK `centros_costo(id)`. Si existe, activo. Se copia a la factura y a las líneas de asiento del POS. |
| `plantilla_ticket` | `jsonb` | No | Ver §2.2.1 | Objeto JSON validado por las RPC. `jsonb_typeof = 'object'`. |
| `activa` | `boolean` | No | `true` | Si es false no se puede abrir turno, vender, cotizar ni devolver. No se borra. |
| `creado_en` | `timestamptz` | No | `now()` | Metadato. |
| `actualizado_en` | `timestamptz` | No | `now()` | Lo actualiza `pos_actualizar_terminal`. |

**Índices y candados**

- `pos_terminales_nombre_unico`: único sobre `lower(btrim(nombre))`.
- `pos_terminales_cuenta_efectivo_unica`: único sobre `cuenta_efectivo_id` **where `activa`**. Dos terminales activas no pueden compartir cajón: el arqueo de una contaminaría el de la otra. Para dos cajas físicas se usan dos cuentas de efectivo (por ejemplo, 1101 Caja general y 1107 Caja POS 2).
- `pos_terminales_almacen_id_idx` sobre `almacen_id`.
- Las cuentas de tarjeta/transferencia **sí** pueden compartirse entre terminales (son cuentas de banco, no cajones). No pueden ser la misma cuenta de efectivo de la terminal: una venta con tarjeta no debe inflar el cajón físico. Ninguna cuenta de tarjeta/transferencia puede ser la cuenta de efectivo de **otra** terminal activa; el RPC lo valida.
- La tabla no puede validar por sí sola `es_caja_banco`, `activa`, tipo de numeración, etc. (son referencias cruzadas). La frontera es `pos_crear_terminal` / `pos_actualizar_terminal`; los índices son la última defensa para nombre y cajón único.

#### 2.2.1 `plantilla_ticket` (contrato exacto)

| Clave | Tipo | Valores / default | Uso |
| --- | --- | --- | --- |
| `estilo` | `text` | `clasico` (default), `minimalista`, `detallado` | Distribución del ticket. |
| `ancho_mm` | `int` | `80` (default), `57` | Ancho del papel térmico. |
| `fuente` | `text` | `clasica` (default), `moderna`, `compacta` | Familia tipográfica del ticket. |
| `tamano_letra` | `text` | `pequena`, `mediana` (default), `grande` | Tamaño base. |
| `interlineado` | `text` | `compacto`, `normal` (default), `amplio` | Altura de línea. |
| `mostrar_logo` | `boolean` | `true` | Logo de `empresa.logo_url`. |
| `mostrar_vendedor` | `boolean` | `true` | Vendedor de la factura/cotización (no el cajero). |
| `mostrar_descripcion` | `boolean` | `true` | Descripción de la línea; si false, solo el nombre del producto o la descripción libre. |
| `mostrar_referencia` | `boolean` | `false` | Referencia del producto. |
| `mostrar_precio_unitario` | `boolean` | `true` | Columna de precio unitario; si false, solo el total de la línea. |
| `mostrar_unidad` | `boolean` | `true` | Unidad de medida junto a la cantidad. |
| `precios_con_impuestos` | `boolean` | `true` | Presentación: true muestra el precio unitario con ITBIS; false lo muestra sin ITBIS. No cambia el cálculo guardado. |
| `pie_ticket` | `text` | `null` | Pie del ticket. Máximo 500 caracteres; vacío se guarda como null. Si es null, el ticket no imprime pie (no se inventa texto). |

Default exacto:

```json
{
  "estilo": "clasico",
  "ancho_mm": 80,
  "fuente": "clasica",
  "tamano_letra": "mediana",
  "interlineado": "normal",
  "mostrar_logo": true,
  "mostrar_vendedor": true,
  "mostrar_descripcion": true,
  "mostrar_referencia": false,
  "mostrar_precio_unitario": true,
  "mostrar_unidad": true,
  "precios_con_impuestos": true,
  "pie_ticket": null
}
```

Reglas de validación en `pos_crear_terminal` / `pos_actualizar_terminal`:

- Debe ser un objeto JSON. Si no viene, se usa el default.
- Solo se aceptan las claves de la tabla. Una clave desconocida se rechaza: «la plantilla del ticket tiene un campo desconocido: X».
- Cada enum debe estar en su lista; cada toggle debe ser booleano; `ancho_mm` debe ser 80 o 57; `pie_ticket` texto de hasta 500.
- En create, el objeto enviado se mezcla sobre el default. En update, se mezcla sobre el valor actual (para no borrar toggles que la pantalla no envía). `pie_ticket: null` limpia el pie.
- La UI del editor muestra una vista previa en vivo con la misma plantilla y permite «Imprimir prueba».

### 2.3 `pos_turnos` (transaccional)

Un turno = una sesión de caja de una terminal, desde que se abre hasta que se cierra.

| Columna | Tipo | Nulo | Default | Regla |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | No | `gen_random_uuid()` | PK. |
| `numero` | `int` | No | `nextval('public.pos_turnos_numero_seq')` | Único. Es el «Cierre No N» del ticket. |
| `terminal_id` | `uuid` | No | — | FK `pos_terminales(id)`. |
| `abierto_por` | `uuid` | No | `auth.uid()` | Usuario que abrió. Sin FK a `perfiles` (mismo patrón que `creado_por`). |
| `cerrado_por` | `uuid` | Sí | `null` | Usuario que cerró. |
| `abierto_en` | `timestamptz` | No | `now()` | Inicio. |
| `cerrado_en` | `timestamptz` | Sí | `null` | Fin; se llena al cerrar. |
| `estado` | `text` | No | `'abierto'` | `check (estado in ('abierto','cerrado'))`. |
| `base_inicial` | `numeric(14,2)` | No | `0` | `check (base_inicial >= 0)`. Conteo físico de arranque; no genera asiento. |
| `efectivo_esperado` | `numeric(14,2)` | Sí | `null` | Se congela al cerrar. `check (efectivo_esperado is null or efectivo_esperado >= 0)`. Mientras está abierto se calcula en vivo y no se guarda. |
| `efectivo_real` | `numeric(14,2)` | Sí | `null` | Conteo físico al cerrar. `check (efectivo_real is null or efectivo_real >= 0)`. |
| `diferencia` | `numeric(14,2)` | Sí | `null` | `efectivo_real - efectivo_esperado`, redondeado a 2. Positivo = sobrante; negativo = faltante. |
| `asiento_diferencia_id` | `uuid` | Sí | `null` | FK `asientos(id)`. Se llena solo si se registró el asiento de diferencia. |
| `observaciones` | `text` | Sí | `null` | Máximo 500 caracteres; `trim`. |

**Check de coherencia del cierre** (una sola restricción, además de los checks de columna):

- Si `estado = 'abierto'`: `cerrado_en`, `cerrado_por`, `efectivo_esperado`, `efectivo_real`, `diferencia` y `asiento_diferencia_id` deben ser null.
- Si `estado = 'cerrado'`: `cerrado_en`, `cerrado_por`, `efectivo_esperado`, `efectivo_real` y `diferencia` no son null; `diferencia = round(efectivo_real - efectivo_esperado, 2)`. `asiento_diferencia_id` puede ser null si no se registró el asiento.

**Candado de concurrencia (obligatorio):**

- Índice único parcial `pos_turnos_terminal_abierto_uniq` sobre `(terminal_id)` **where `estado = 'abierto'`**. Una terminal no puede tener dos turnos abiertos ni por carrera. Es la última defensa; `pos_abrir_turno` además bloquea la fila de la terminal y da el mensaje en español.

**Índices:** `pos_turnos_terminal_id_idx`, `pos_turnos_abierto_en_idx`, `pos_turnos_estado_idx`.

**Estados:** `abierto → cerrado`. No hay reapertura ni anulación de turno. Un cierre es una foto: anulaciones posteriores de pagos/notas desde Contabilidad no reescriben el esperado congelado.

### 2.4 `pos_turno_movimientos` (transaccional)

Cada entrada o salida de efectivo del turno que **no** es una venta POS (las ventas viven en `facturas`/`pagos_recibidos`). Es un recibo correlativo con su asiento.

| Columna | Tipo | Nulo | Default | Regla |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | No | `gen_random_uuid()` | PK. |
| `numero` | `int` | No | `nextval('public.pos_turno_movimientos_numero_seq')` | Único. Es el «Recibo No N» del ticket. |
| `turno_id` | `uuid` | No | — | FK `pos_turnos(id)`. |
| `tipo` | `text` | No | — | `check (tipo in ('ingreso','retiro'))`. |
| `motivo` | `text` | No | — | `check (motivo in ('fondo_caja','cobro_factura','retiro_caja','gasto_menor','deposito_banco','otro'))`. |
| `monto` | `numeric(14,2)` | No | — | `check (monto > 0)`. Es el efectivo que entra o sale. |
| `cuenta_contrapartida_id` | `uuid` | No | — | FK `cuentas(id)`. Cuenta de detalle activa. Para `cobro_factura` es la CxC; para `gasto_menor`, la cuenta de gasto; para los demás, la cuenta elegida. |
| `contacto_id` | `uuid` | Sí | `null` | FK `contactos(id)`. En `cobro_factura`, el contacto de la factura. En `gasto_menor`, el contacto opcional. |
| `factura_id` | `uuid` | Sí | `null` | FK `facturas(id)`. Obligatorio en `cobro_factura`; null en los demás. |
| `asiento_id` | `uuid` | No | — | FK `asientos(id)`. Todo movimiento tiene asiento real (el del pago, el del gasto o el creado por el POS). |
| `pago_recibido_id` | `uuid` | Sí | `null` | FK `pagos_recibidos(id)`. Solo en `cobro_factura`. |
| `gasto_menor_id` | `uuid` | Sí | `null` | FK `gastos_menores(id)`. Solo en `gasto_menor`. |
| `notas` | `text` | Sí | `null` | Máximo 500 caracteres; `trim`. |
| `creado_por` | `uuid` | No | `auth.uid()` | Usuario que registró el movimiento. |
| `creado_en` | `timestamptz` | No | `now()` | Fecha/hora del recibo. |

**Check de motivo/tipo y vínculos** (una sola restricción):

- `fondo_caja` y `cobro_factura` son `ingreso`.
- `retiro_caja`, `gasto_menor` y `deposito_banco` son `retiro`.
- `otro` puede ser `ingreso` o `retiro`.
- `cobro_factura`: `factura_id` y `pago_recibido_id` no null; `gasto_menor_id` null.
- `gasto_menor`: `gasto_menor_id` no null; `factura_id` y `pago_recibido_id` null.
- Los demás motivos: `factura_id`, `pago_recibido_id` y `gasto_menor_id` null.

**Índices y candados:**

- `pos_turno_movimientos_turno_id_idx` sobre `turno_id`.
- `pos_turno_movimientos_creado_en_idx` sobre `creado_en`.
- Único parcial sobre `pago_recibido_id` where not null: un pago no puede estar en dos movimientos.
- Único parcial sobre `gasto_menor_id` where not null: un gasto no puede estar en dos movimientos.

**Inmutabilidad:** no hay update ni delete. Un monto equivocado se corrige con un movimiento inverso (`otro`, tipo contrario) y una nota; el original queda para auditoría.

**Numeración explícita:** la RPC toma `nextval('public.pos_turno_movimientos_numero_seq')` y `gen_random_uuid()` **antes** de crear el asiento, para poder usar el número del recibo en la descripción y para insertar el movimiento con `asiento_id` no nulo en una sola pasada.

### 2.5 Extensiones aditivas a tablas existentes

#### 2.5.1 `facturas`

| Columna | Tipo | Nulo | Default | Regla |
| --- | --- | --- | --- | --- |
| `turno_id` | `uuid` | Sí | `null` | FK `pos_turnos(id)`. Solo ventas POS. |
| `origen` | `text` | No | `'contabilidad'` | `check (origen in ('contabilidad','pos'))`. Las facturas existentes quedan `contabilidad`. |
| `monto_recibido` | `numeric(14,2)` | Sí | `null` | Efectivo bruto que entregó el cliente en la venta POS (suma de `monto_recibido` de los pagos en efectivo). 0 si no hubo efectivo. Null en facturas no POS. `check (monto_recibido is null or monto_recibido >= 0)`. |
| `cambio` | `numeric(14,2)` | Sí | `null` | Cambio devuelto, solo sobre efectivo. 0 si no hubo cambio. Null en facturas no POS. `check (cambio is null or (monto_recibido is not null and cambio >= 0 and cambio <= monto_recibido))`. |

- Índices: `facturas_turno_id_idx`, `facturas_origen_idx` y, recomendado, un índice parcial `(turno_id, fecha desc) where origen = 'pos'` para el historial.
- `monto_recibido` **no** es el total pagado (incluye tarjetas); es solo el efectivo entregado. `pagado` sigue siendo la suma de montos aplicados de todos los métodos. `saldo = round(total - pagado - retenido - credito, 2)`.
- Una venta POS sin efectivo guarda `monto_recibido = 0` y `cambio = 0` (no null), para distinguirla de una factura de Contabilidad.

#### 2.5.2 `cotizaciones`

| Columna | Tipo | Nulo | Default | Regla |
| --- | --- | --- | --- | --- |
| `origen` | `text` | No | `'contabilidad'` | `check (origen in ('contabilidad','pos'))`. |
| `turno_id` | `uuid` | Sí | `null` | FK `pos_turnos(id)`. Turno donde se creó la cotización (informativo; no afecta caja). |

- Índice `cotizaciones_turno_id_idx`.
- Las cotizaciones existentes quedan `contabilidad` y sin turno.

#### 2.5.3 `pagos_recibidos`

| Columna | Tipo | Nulo | Default | Regla |
| --- | --- | --- | --- | --- |
| `turno_id` | `uuid` | Sí | `null` | FK `pos_turnos(id)`. Se llena en los pagos de venta POS y en los cobros de factura hechos desde el POS. |

- Índice `pagos_recibidos_turno_id_idx`.
- **No se agrega `origen` a `pagos_recibidos`:** el pago POS se identifica por `turno_id` (y por la factura `origen='pos'`). El brief dice «origen='pos' en factura y pagos»; en pagos se cumple con `turno_id`, sin inventar una columna nueva.
- No se agrega columna de método POS: el detalle débito/crédito se recupera por `cuenta_id` (las cuentas del terminal) y, en la respuesta inmediata de la venta, por `metodo_pos`. En el historial se muestra «Tarjeta» si la cuenta es compartida.

#### 2.5.4 `notas_credito_venta`

| Columna | Tipo | Nulo | Default | Regla |
| --- | --- | --- | --- | --- |
| `turno_id` | `uuid` | Sí | `null` | FK `pos_turnos(id)`. Devolución hecha desde el POS. |
| `tipo_reembolso` | `text` | No | `'credito_factura'` | `check (tipo_reembolso in ('credito_factura','efectivo','combinado'))`. |
| `monto_reembolso_efectivo` | `numeric(14,2)` | No | `0` | `check (monto_reembolso_efectivo >= 0)`. Parte del total devuelta en efectivo. |
| `cuenta_reembolso_id` | `uuid` | Sí | `null` | FK `cuentas(id)`. Cuenta de la que sale el efectivo. En esta fase, el POS exige que sea la cuenta de efectivo de la terminal. |

- Check de coherencia (no referencia `total`, porque el total se calcula después de insertar la cabecera):
  - `credito_factura`: `monto_reembolso_efectivo = 0` y `cuenta_reembolso_id is null`.
  - `efectivo` o `combinado`: `monto_reembolso_efectivo > 0` y `cuenta_reembolso_id is not null`.
- Las notas existentes y las de Contabilidad cumplen el default (`credito_factura`, 0, null).
- Índice `notas_credito_venta_turno_id_idx`.
- La igualdad `monto_reembolso_efectivo = total` (efectivo) o `0 < monto < total` (combinado) se valida en `pos_crear_devolucion`, cuando el total ya existe. No se puede poner como check de tabla sin diferirlo.
- **Anulación futura:** el asiento de la NC y el asiento del reembolso en efectivo comparten `origen_tipo = 'nota_credito_venta'` y `origen_id = nota.id`. Cuando se implemente la anulación de notas, debe revertir **ambos** asientos (hoy la app no anula notas de crédito de venta).

#### 2.5.5 `asientos_origen_tipo_check`

Se reemplaza la restricción por la lista actual más dos valores:

`factura`, `pago_recibido`, `factura_proveedor`, `pago_proveedor`, `gasto_menor`, `manual`, `anulacion`, `nota_credito_venta`, `nota_credito_compra`, `nota_debito`, `transferencia`, `deposito`, `conciliacion`, `ajuste_inventario`, `saldo_inicial`, `inventario_inicial`, **`pos_movimiento`**, **`pos_diferencia`**.

- `pos_movimiento`: asiento de un ingreso/retiro directo de caja; `origen_id = pos_turno_movimientos.id`.
- `pos_diferencia`: asiento de sobrante/faltante al cerrar; `origen_id = pos_turnos.id`.

### 2.6 Semillas idempotentes

#### 2.6.1 Cuentas de sobrante y faltante de caja

La migración debe dejar dos cuentas de detalle y sus claves de configuración, sin duplicar si ya existen:

| Cuenta | Tipo / naturaleza | Código sugerido | Clave en `config_contable` |
| --- | --- | --- | --- |
| `Sobrantes de caja` | `ingreso` / `credito` | 4104 (o el primer libre ≥ 4104) | `sobrante_caja` |
| `Faltantes de caja` | `gasto` / `debito` | 6108 (o el primer libre ≥ 6108) | `faltante_caja` |

Reglas:

- Se buscan por nombre exacto (`lower(btrim(nombre))`) y por padre (grupo 4 Ingresos / 6 Gastos). Si existen, se reutilizan; si no, se crean como hijas del grupo raíz 4/6 (la app las muestra bajo «Otros ingresos»/«Otros gastos» por su tipo; no se crean grupos nuevos para no alterar el catálogo).
- `acepta_movimientos = true`, `activa = true`. Sin clasificación DGII por defecto: son cuentas de arqueo, no compras/ventas; Contable las clasifica si hace falta.
- `config_contable`: `insert ... on conflict (clave) do nothing`. Nunca se pisa una clave ya configurada.
- Si la clave existe pero apunta a una cuenta inactiva o inexistente, `pos_cerrar_turno` falla con mensaje claro; no se corrige sola.

#### 2.6.2 Contacto Consumidor Final

- Si no existe un contacto activo con `lower(btrim(nombre)) = 'consumidor final'`, se crea una vez: `tipo = 'cliente'`, `nombre = 'Consumidor Final'`, `rnc_cedula = '22222222222'`, `tipo_identificacion = 'rnc'`, `activo = true`.
- Es el valor sugerido para `pos_terminales.contacto_defecto_id`. Cada terminal puede elegir otro contacto por defecto; el bloqueo de crédito se basa en la **identidad** del contacto configurado, no en el nombre.
- No se duplica si ya hay uno; si Waldy ya tiene su «Consumidor Final», se reutiliza.

### 2.7 Secuencias

- `pos_turnos_numero_seq`
- `pos_turno_movimientos_numero_seq`

Ambas se revocan de `anon` y `authenticated` (solo las usan las RPC definer). El reset a base virgen las reinicia con el bloque genérico de `pg_sequences` que ya existe.

### 2.8 Estados y transiciones

| Entidad | Estados | Transición permitida |
| --- | --- | --- |
| `pos_terminales` | `activa`, `inactiva` | Activar/desactivar por RPC. No se borra. No se desactiva con turno abierto. |
| `pos_turnos` | `abierto`, `cerrado` | Abrir → cerrar. No se reabre. |
| `pos_turno_movimientos` | Sin estado | Inmutable; se corrige con un movimiento inverso. |
| `facturas` POS | `abierta`, `pagada`, `anulada` | Las reglas existentes del motor. Una venta POS a crédito nace `abierta`; con pago completo, `pagada`. |
| `cotizaciones` POS | `abierta`, `convertida`, `anulada` | Convertir desde el POS la deja `convertida` con `factura_id`. |
| `notas_credito_venta` POS | `activa`, `anulada` | La app actual no anula NC; queda como deuda documentada. |

### 2.9 Reset a base virgen (`docs/pruebas/reset-base-virgen.sql`)

Clasificación obligatoria para el candado `src/lib/supabase/reset-virgen.test.ts`:

- `-- @conservar public.pos_terminales` (es configuración, no documento).
- `pos_turnos` y `pos_turno_movimientos` van en el `TRUNCATE ... RESTART IDENTITY CASCADE` y en el array de verificación del bloque `DO`.
- Las secuencias `pos_turnos_numero_seq` y `pos_turno_movimientos_numero_seq` se reinician con el bloque genérico de secuencias.
- El `DELETE` de cuentas de prueba debe agregar un `NOT EXISTS` sobre `pos_terminales` (cuenta de efectivo o cualquiera de las cuentas de cobro): si una cuenta ZZTEST/E2E está referenciada por una terminal, no se borra.

**Ojo con el CASCADE (importante para 2A):** `pos_terminales.contacto_defecto_id` referencia `contactos`, y el reset vacía `contactos` con `TRUNCATE ... CASCADE`. Marcar `pos_terminales` como `@conservar` **no basta**: el CASCADE la vaciaría en silencio. 2A debe hacer una de estas dos cosas, y dejarlo escrito en el script:

1. **Conservar de verdad (recomendado, coincide con el plan):** antes del `TRUNCATE`, respaldar las terminales en una tabla temporal `on commit drop`; después del `TRUNCATE`, re-sembrar el contacto «Consumidor Final» y reinsertar las terminales apuntando `contacto_defecto_id` a ese contacto. Las demás FKs (cuentas, almacén, numeración, lista, centro de costo) sobreviven porque son catálogos conservados. Si una terminal referencia una cuenta/almacén que ya no existe, se omite y se avisa.
2. **Clasificarla como transaccional:** sacarla de `@conservar` y ponerla en el `TRUNCATE`, documentando que después de un reset hay que reconfigurar las terminales. Es más simple, pero contradice el plan; si se elige, debe aprobarlo el Orquestador.

No se puede dejar `@conservar` sin el respaldo: el script parecería correcto y perdería la configuración al ejecutarse.

---

## 3. RPCs

### 3.1 Reglas comunes

- Todas las RPC de escritura son `language plpgsql`, `security definer`, `set search_path = ''`, `volatile`, y exigen `public.rol_actual() in ('admin','contador')`. Si no: `raise exception 'sin permiso' using errcode = '42501'`.
- `pos_resumen_turno` es la excepción de lectura: `stable`, `security invoker`, disponible para cualquier `authenticated` con perfil (incluido `lector`).
- Todas las referencias a tablas/funciones van calificadas con `public.` (por `search_path = ''`).
- `p` null o sin las claves obligatorias: error `22023` con mensaje en español, en minúscula; la UI capitaliza la primera letra.
- Dinero: `round(x::numeric, 2)`. Fechas: `(p->>'fecha')::date` o `current_date`. Ids: `nullif(p->>'x','')::uuid`.
- Los textos se `trim`; los vacíos se guardan como `null` cuando la columna lo permite.
- **Orden de bloqueo para evitar deadlocks:**
  1. `pos_terminales` (share en ventas/movimientos; update en apertura/edición).
  2. `pos_turnos` (update).
  3. Motor: `numeraciones`, `existencias`, `facturas` (lo que bloquee `crear_factura`/`crear_nota_credito_venta`).
  4. `contactos` (update, solo si la venta queda con saldo y hay que validar el límite).
  Todas las RPC del POS siguen este orden. El bloqueo del contacto se toma antes de calcular el límite, no antes de crear la factura; así no se serializan las ventas de contado al mismo Consumidor Final.
- **Una sola transacción:** si cualquier paso falla, no queda factura, pago, movimiento, asiento ni turno a medias.
- Las RPC atrapan `unique_violation` en los candados propios (turno abierto, nombre de terminal, cajón único) y lo convierten en `22023` con mensaje claro. Los demás errores del motor se propagan tal cual (ya están en español).
- No se usa `service_role` ni se desactiva RLS en ningún punto.
- Claves desconocidas del payload: se ignoran (compatibilidad hacia adelante), salvo dentro de `plantilla_ticket`, donde se rechazan para detectar errores de tipeo.

### 3.2 `pos_crear_terminal(p jsonb) returns uuid`

Crea una terminal activa o inactiva. Devuelve el `id`.

| Clave | Tipo | Obligatoria | Regla |
| --- | --- | --- | --- |
| `nombre` | text | Sí | 1–80, único case-insensitive. |
| `almacen_id` | uuid | Sí | Almacén activo. |
| `cuenta_efectivo_id` | uuid | Sí | `es_caja_banco`, activa, no usada por otra terminal activa. |
| `cuenta_tarjeta_debito_id` | uuid/null | No | Si viene: `es_caja_banco`, activa, distinta de efectivo y de la cuenta de efectivo de cualquier terminal activa. |
| `cuenta_tarjeta_credito_id` | uuid/null | No | Igual. |
| `cuenta_transferencia_id` | uuid/null | No | Igual. |
| `numeracion_defecto_id` | uuid | Sí | Activa, tipo `01`/`02`/`14`/`15`/`16`. |
| `lista_precio_defecto_id` | uuid/null | No | Si viene: activa. |
| `contacto_defecto_id` | uuid | Sí | Activo, `tipo in ('cliente','ambos')`. |
| `centro_costo_id` | uuid/null | No | Si viene: activo. |
| `plantilla_ticket` | object/null | No | Se mezcla sobre el default (§2.2.1). |
| `activa` | boolean | No | Default `true`. |

Pasos: validar rol → validar payload → validar cada referencia → insertar → devolver `id`. Si el nombre o el cajón chocan con otra terminal, mensaje en español. No crea turno.

### 3.3 `pos_actualizar_terminal(p_id uuid, p jsonb) returns uuid`

Actualiza solo las claves presentes. `plantilla_ticket` se mezcla sobre el valor actual; `pie_ticket: null` lo limpia. `actualizado_en = now()`.

Reglas adicionales:

- Si `p_id` no existe: «la terminal no existe».
- Si se intenta desactivar (`activa = false`) y la terminal tiene un turno abierto: «no se puede desactivar una terminal con un turno abierto».
- Si hay turno abierto, no se puede cambiar `cuenta_efectivo_id`, `almacen_id` ni `numeracion_defecto_id`: «cierra el turno antes de cambiar la cuenta de efectivo, el almacén o la numeración». El resto de la configuración (nombre, cuentas de tarjeta/transferencia, lista, contacto, centro de costo, plantilla) sí se puede editar.
- Si se cambia el cajón a una cuenta usada por otra terminal activa: «ya existe una terminal activa con esa cuenta de efectivo».
- No se puede poner una cuenta de tarjeta/transferencia igual al cajón de la terminal (ni al de otra terminal activa): «la cuenta de tarjeta/transferencia no puede ser un cajón de efectivo».

### 3.4 `pos_abrir_turno(p jsonb) returns jsonb`

| Clave | Tipo | Obligatoria | Regla |
| --- | --- | --- | --- |
| `terminal_id` | uuid | Sí | Terminal existente y activa. |
| `base_inicial` | numeric | No | Default 0; `>= 0`; se redondea a 2. |
| `observaciones` | text/null | No | Máximo 500. |

Pasos:

1. Validar rol.
2. Bloquear la terminal `for update` (serializa aperturas).
3. Si la terminal no está activa: «la terminal no existe o está inactiva».
4. Si ya hay un turno abierto: «la terminal ya tiene un turno abierto (turno No N)».
5. Insertar el turno con `numero` de la secuencia, `abierto_por = auth.uid()`, `estado = 'abierto'`.
6. Devolver el payload.

**Retorno:**

```json
{
  "turno": {
    "id": "uuid",
    "numero": 1,
    "terminal_id": "uuid",
    "abierto_por": "uuid",
    "abierto_en": "2026-11-20T14:05:00-04:00",
    "base_inicial": 0.00,
    "estado": "abierto"
  },
  "terminal": { "id": "uuid", "nombre": "Caja 1", "almacen_id": "uuid", "cuenta_efectivo_id": "uuid" },
  "empresa": { "id": 1, "nombre": "…", "rnc": "…", "direccion": "…", "telefono": "…", "correo": "…", "logo_url": "…" },
  "resumen": { "…": "bloque resumen de §3.9, con ventas/ingresos/retiros/devoluciones en cero y efectivo_esperado = base_inicial" }
}
```

La base inicial **no** genera asiento: es un conteo físico de arranque. El efectivo del negocio ya está en la cuenta de caja.

### 3.5 `pos_registrar_movimiento_turno(p jsonb) returns jsonb`

Registra una entrada o salida de efectivo del turno. Exige turno abierto. Devuelve el recibo listo para imprimir.

| Clave | Tipo | Obligatoria | Regla |
| --- | --- | --- | --- |
| `turno_id` | uuid | Sí | Turno abierto. |
| `tipo` | text | Sí | `ingreso` o `retiro`; debe corresponder al motivo. |
| `motivo` | text | Sí | Uno de los seis motivos. |
| `monto` | numeric | Sí | `> 0`; 2 decimales. |
| `cuenta_contrapartida_id` | uuid/null | Según motivo | Obligatoria en `fondo_caja`, `retiro_caja`, `deposito_banco` y `otro`. No se usa en `cobro_factura` (se deriva la CxC) ni en `gasto_menor` (se deriva del gasto). |
| `contacto_id` | uuid/null | No | Si viene, activo. En `cobro_factura` se ignora: manda el contacto de la factura. |
| `factura_id` | uuid/null | Solo `cobro_factura` | Factura no anulada con saldo `> 0`. |
| `cuenta_gasto_id` | uuid/null | Solo `gasto_menor` | Cuenta de detalle `tipo in ('gasto','costo')`, activa. |
| `subtotal` | numeric/null | No | Solo `gasto_menor`. Default `monto`. |
| `itbis_tasa` | numeric/null | No | Solo `gasto_menor`. Default 0; 0–100. |
| `descripcion` | text/null | Solo `gasto_menor` | Descripción del gasto (1–200). En otros motivos se usa como nota si no viene `notas`. |
| `notas` | text/null | No | Máximo 500. |

**Ramas:**

1. **`cobro_factura` (ingreso):**
   - Bloquear el turno; validar que esté abierto.
   - Leer la factura `for update`; debe existir, no estar anulada y tener `saldo = round(total - pagado - retenido - credito, 2) > 0`.
   - `monto <= saldo`; si no: «el monto del cobro excede el saldo de la factura».
   - Llamar `registrar_pago_recibido` con `factura_id`, `contacto_id` de la factura, `fecha = current_date`, `cuenta_id = terminal.cuenta_efectivo_id`, `metodo = 'efectivo'`, `monto`, `notas`.
   - Actualizar `pagos_recibidos.turno_id` con el pago devuelto.
   - Insertar el movimiento: `tipo='ingreso'`, `motivo='cobro_factura'`, `factura_id`, `pago_recibido_id`, `contacto_id`, `cuenta_contrapartida_id = coalesce(contacto.cuenta_cxc_id, config cxc)`, `asiento_id = pago.asiento_id`.
   - El efectivo esperado sube por `monto`.

2. **`gasto_menor` (retiro):**
   - Validar `cuenta_gasto_id`, `descripcion`, `monto > 0`.
   - `subtotal` default `monto`; `itbis_tasa` default 0. Si se envían ambos, verificar `subtotal + round(subtotal * itbis_tasa/100, 2) = monto`; si no: «el ITBIS del gasto no cuadra con el monto».
   - Verificar que el efectivo esperado actual alcance para el retiro (`monto <= esperado`); si no: «el retiro deja la caja en negativo».
   - Llamar `crear_gasto_menor` con `fecha`, `descripcion`, `subtotal`, `itbis_tasa`, `cuenta_gasto_id`, `cuenta_pago_id = terminal.cuenta_efectivo_id`, `contacto_id`.
   - Insertar el movimiento: `tipo='retiro'`, `motivo='gasto_menor'`, `gasto_menor_id`, `cuenta_contrapartida_id = cuenta_gasto_id`, `contacto_id`, `asiento_id = gasto.asiento_id`.
   - El esperado baja por `monto` (el total del gasto).

3. **`fondo_caja` (ingreso), `retiro_caja` (retiro), `deposito_banco` (retiro), `otro` (ingreso o retiro):**
   - `cuenta_contrapartida_id` obligatoria; debe existir, estar activa, `acepta_movimientos = true` y ser distinta de la cuenta de efectivo de la terminal.
   - `deposito_banco`: además, `es_caja_banco = true` (cuenta destino de banco). Si no: «para depositar al banco, la cuenta de destino debe ser de caja o banco».
   - En retiros, verificar `monto <= efectivo esperado actual`; si no: «el retiro deja la caja en negativo».
   - Generar `id` y `numero` del movimiento.
   - Crear el asiento real con `_crear_asiento`:
     - `ingreso`: `Dr terminal.cuenta_efectivo_id / Cr cuenta_contrapartida_id`.
     - `retiro`: `Dr cuenta_contrapartida_id / Cr terminal.cuenta_efectivo_id`.
     - `origen_tipo = 'pos_movimiento'`, `origen_id = movimiento.id`, `descripcion = 'Movimiento de caja ' || numero || ' · ' || motivo`, `fecha = current_date`.
     - Si la terminal tiene `centro_costo_id`, se aplica a las líneas.
     - Si hay `contacto_id`, va en la línea de contrapartida.
   - Insertar el movimiento con `asiento_id`.
   - El esperado sube (ingreso) o baja (retiro) por `monto`.

**Retorno:**

```json
{
  "movimiento": {
    "id": "uuid",
    "numero": 10,
    "turno_id": "uuid",
    "tipo": "ingreso",
    "motivo": "cobro_factura",
    "monto": 100.00,
    "cuenta_contrapartida_id": "uuid",
    "cuenta_nombre": "Cuentas por cobrar clientes",
    "contacto_id": "uuid",
    "factura_id": "uuid",
    "factura_numero": 12,
    "factura_ncf": "B0200000012",
    "pago_recibido_id": "uuid",
    "gasto_menor_id": null,
    "asiento_id": "uuid",
    "notas": "…",
    "creado_en": "2026-11-20T15:10:00-04:00",
    "creado_por": "uuid",
    "cajero": "Waldy Alcántara"
  },
  "turno": { "id": "uuid", "numero": 1, "estado": "abierto", "base_inicial": 0.00 },
  "terminal": { "id": "uuid", "nombre": "Caja 1" },
  "empresa": { "…": "…" },
  "asiento": { "id": "uuid", "numero": 34, "fecha": "2026-11-20", "descripcion": "…", "total": 100.00 },
  "plantilla_ticket": { "…": "…" },
  "resumen": { "…": "bloque resumen de §3.9 después del movimiento" }
}
```

### 3.6 `pos_completar_venta(p jsonb) returns jsonb`

La RPC central del POS. **Un solo round-trip:** factura real, NCF, ITBIS, inventario, asiento, pagos, turno y payload de impresión. Exige turno abierto.

#### 3.6.1 Payload

| Clave | Tipo | Obligatoria | Regla |
| --- | --- | --- | --- |
| `terminal_id` | uuid | Sí | Terminal activa. |
| `turno_id` | uuid/null | No | Default: el turno abierto de la terminal. Si viene, debe ser de esa terminal y estar abierto. |
| `contacto_id` | uuid/null | No | Default: `terminal.contacto_defecto_id`. Si viene, activo. No puede ser el contacto por defecto si la venta queda a crédito. |
| `lista_precio_id` | uuid/null | No | Default: `terminal.lista_precio_defecto_id`. Si viene, activa. |
| `numeracion_id` | uuid/null | No | Default: `terminal.numeracion_defecto_id`. Debe estar activa y ser de tipo `01`/`02`/`14`/`15`/`16`. |
| `tipo_comprobante` | text/null | No | Alternativa a `numeracion_id`; solo si no se envía numeración. Uno de `01`/`02`/`14`/`15`/`16`. |
| `fecha` | date/null | No | Default `current_date`. Se envía desde la UI como fecha de negocio. |
| `vencimiento` | date/null | No | Default `fecha`. No puede ser anterior a `fecha`. |
| `vendedor_id` | uuid/null | No | Si viene, activo. |
| `notas` | text/null | No | Máximo 500. |
| `terminos` | text/null | No | Máximo 1,000. |
| `pie` | text/null | No | Máximo 500. |
| `lineas` | array/null | Una fuente | Líneas de producto o libres (ver §3.6.2). |
| `venta_simple` | object/null | Una fuente | `{descripcion, monto, itbis_tasa?}`. |
| `cotizacion_id` | uuid/null | Una fuente | Cotización `abierta` a convertir. |
| `pagos` | array | No | Filas de pago (ver §3.6.3). Vacío/ausente = venta a crédito total. |

**Fuente exclusiva:** exactamente una de `lineas` (array no vacío), `venta_simple` (objeto) o `cotizacion_id`. Si hay dos o ninguna: «indica líneas, venta simple o una cotización, no varias a la vez».

**Datos que siempre salen de la terminal (el payload no los puede cambiar):**

- `almacen_id = terminal.almacen_id` (descarga de inventario).
- `centro_costo_id = terminal.centro_costo_id` en ventas normales; en conversión de cotización, el de la cotización (la factura y los asientos lo copian).
- Cuentas de cobro de los pagos (salvo `cuenta_id` explícito permitido en §3.6.3).
- La cuenta de efectivo para el cambio.
- El `origen = 'pos'` y el `turno_id` de la factura.
- La lista de precios por defecto si no se envía otra.

#### 3.6.2 Resolución de líneas

Cada línea de `lineas`:

| Clave | Tipo | Obligatoria | Regla |
| --- | --- | --- | --- |
| `producto_id` | uuid/null | No | Si viene, producto activo. Null = línea libre. |
| `descripcion` | text/null | No | Si no viene, nombre del producto. En línea libre es obligatoria. |
| `cantidad` | numeric | Sí | `> 0`; 2 decimales. En la unidad indicada. |
| `unidad_id` | uuid/null | No | Solo con producto. Debe pertenecer al producto y estar activa. Si se omite, unidad base (`factor_base = 1`). |
| `precio` | numeric/null | No | Si no viene, el POS lo resuelve con la lista y la unidad. Si viene, es override del cajero; `>= 0`. |
| `descuento_pct` | numeric/null | No | 0–100; default 0. |
| `itbis_tasa` | numeric/null | No | 0–100; si no viene, la del producto. En línea libre y venta simple, default 0. |
| `impuesto_id` | uuid/null | No | Si viene, del catálogo `impuestos`. |

**Resolución de precio (servidor, no el cliente):**

1. Si `precio` viene, se usa tal cual (redondeado a 2). Es un override consciente del cajero.
2. Si no viene y hay `producto_id`:
   - Sin unidad o unidad base: `_precio_lista(producto.precio, lista_id)`.
   - Con unidad: `producto_unidades.precio` si no es null; si es null, `_precio_lista(producto.precio, lista_id) * factor_base`, redondeado a 2.
3. Si no viene y no hay producto: error «la línea libre requiere un precio».

**Combos:** un `producto_id` con `tipo = 'combo'` se acepta; el motor de la fase 1 expande componentes, descuenta existencias y costea. No se permite `unidad_id` en un combo. La existencia/disponibilidad la valida el motor; el POS no la reimplementa.

**Venta simple:** se convierte en una línea `producto_id = null`, `descripcion`, `cantidad = 1`, `precio = monto`, `descuento_pct = 0`, `itbis_tasa` (default 0). El motor calcula `itbis = round(monto * tasa/100, 2)` y `total = monto + itbis`; la UI muestra el total antes de confirmar.

**Cotización:** si viene `cotizacion_id`:

- La cotización debe existir y estar `abierta`; no tiene terminal, así que se acepta cualquiera abierta (el operador la carga en el POS).
- Se bloquea `for update` para que no se convierta dos veces.
- Las líneas se copian de `cotizacion_lineas` (producto, descripción, cantidad, precio, descuento, ITBIS, impuesto, unidad si existe).
- Contacto, vendedor y centro de costo salen de la cotización; si el payload trae `contacto_id` y no coincide: «la cotización pertenece a otro contacto». La UI debe omitir `contacto_id` al convertir.
- `fecha`/`vencimiento` se toman del payload o de hoy (no de la cotización, que puede estar vencida).
- `notas`/`terminos` del payload si vienen; si no, los de la cotización.
- Al final, en la misma transacción: `cotizaciones.estado = 'convertida'`, `factura_id = nueva factura`. Si algo falla, la cotización queda abierta.
- El `turno_id` de la cotización no se reescribe: es el turno donde se creó; la factura lleva el turno donde se cobró.

#### 3.6.3 Pagos

Cada fila de `pagos`:

| Clave | Tipo | Obligatoria | Regla |
| --- | --- | --- | --- |
| `metodo` | text | Sí | `efectivo`, `tarjeta_debito`, `tarjeta_credito` o `transferencia`. |
| `monto` | numeric | Sí | `> 0`; es el importe **aplicado** a la venta, no el efectivo entregado. |
| `cuenta_id` | uuid/null | No | Override de la cuenta del método. Debe ser `es_caja_banco`, activa y distinta del cajón (excepto efectivo). |
| `monto_recibido` | numeric/null | No | Solo efectivo. Efectivo bruto entregado; `>= monto`. En métodos no efectivo debe ser null o igual a `monto`. |
| `notas` | text/null | No | Máximo 500. |

**Mapeo a `pagos_recibidos`:**

| `metodo` POS | `pagos_recibidos.metodo` | Cuenta por defecto |
| --- | --- | --- |
| `efectivo` | `efectivo` | `terminal.cuenta_efectivo_id` (no se puede cambiar). |
| `tarjeta_debito` | `tarjeta` | `terminal.cuenta_tarjeta_debito_id`; si es null y no hay override, error. |
| `tarjeta_credito` | `tarjeta` | `terminal.cuenta_tarjeta_credito_id`; si es null y no hay override, error. |
| `transferencia` | `transferencia` | `terminal.cuenta_transferencia_id`; si es null y no hay override, error. |

**Validaciones:**

- Cada `monto > 0`, redondeado a 2.
- **Efectivo:** `monto_recibido` default `monto`; no puede ser menor que `monto`.
- **No efectivo:** `monto_recibido` debe ser null o igual a `monto`; cualquier otro valor se rechaza: «solo el efectivo admite cambio».
- **Cuenta:** la resuelta debe existir, estar activa y ser `es_caja_banco`. Para métodos no efectivo no puede ser la cuenta de efectivo de ninguna terminal activa: «una tarjeta o transferencia no puede acreditarse a un cajón de efectivo».
- **Suma:** `sum(pagos.monto) <= factura.total`; si excede: «la suma de los pagos no puede exceder el total de la venta».
- **Cambio:** `cambio = sum(efectivo.monto_recibido) - sum(efectivo.monto)`, redondeado a 2; no puede ser negativo. Si la venta queda a crédito (`sum(monto) < total`), ningún pago en efectivo puede tener `monto_recibido > monto` (no se da cambio y se fía a la vez). El cambio **solo** se calcula sobre efectivo; las tarjetas/transferencias no generan cambio.
- **Pago parcial/crédito:** si `sum(monto) < total`, el saldo queda en CxC y la factura queda `abierta`. Si `sum(monto) = total`, la factura queda `pagada`. Si no hay pagos, es venta a crédito total.

#### 3.6.4 Crédito y límite

Sea `nuevo_saldo = round(factura.total - sum(pagos.monto), 2)`.

Si `nuevo_saldo > 0`:

1. **Consumidor Final bloqueado:** si `contacto.id = terminal.contacto_defecto_id`: «no se puede vender a crédito al Consumidor Final; selecciona un cliente o cobra el total».
2. **Límite de crédito:** si `contacto.limite_credito` no es null, calcular:
   - `saldo_actual` = suma de `round(total - pagado - retenido - credito, 2)` de las facturas del contacto con `estado <> 'anulada'` y saldo `> 0`.
   - Si `round(saldo_actual + nuevo_saldo, 2) > limite_credito`: «la venta a crédito excede el límite del contacto (límite X, saldo actual Y, saldo nuevo Z)».
   - La fila del contacto se bloquea `for update` antes de calcular, para que dos ventas concurrentes no pasen ambas.
3. `limite_credito` null = sin límite (solo aplica el bloqueo de Consumidor Final).
4. El límite se evalúa **solo en el POS** en esta fase; no cambia el comportamiento de `crear_factura` en Contabilidad.

#### 3.6.5 Pasos de la RPC

1. Validar rol y payload; resolver la fuente (líneas/venta simple/cotización).
2. Bloquear terminal (`for share`) y turno (`for update`); validar que el turno esté abierto y sea de la terminal.
3. Resolver contacto, lista, numeración/tipo, vendedor y fechas.
4. Resolver las líneas (productos, unidades, precios, impuestos). Para cotización, leer sus líneas.
5. Llamar `crear_factura` **sin `pago`** con `tipo_comprobante`, `contacto_id`, `fecha`, `vencimiento`, `notas`, `terminos`, `pie`, `vendedor_id`, `centro_costo_id` de la terminal, `almacen_id` de la terminal y `lineas` resueltas. Esto crea factura, NCF, ITBIS, inventario y asiento.
6. Leer la factura creada (totales, `numero`, `ncf`, `estado`).
7. Validar pagos contra el total; calcular cambio. Si `nuevo_saldo > 0`, bloquear el contacto `for update`, recalcular `saldo_actual` y validar el límite/Consumidor Final.
8. Por cada pago, en orden: llamar `registrar_pago_recibido` con `factura_id`, `contacto_id`, `fecha`, `cuenta_id`, `metodo` mapeado, `monto`, `notas`; luego `update pagos_recibidos set turno_id = ... where id = pago_id`.
9. Actualizar la factura: `origen = 'pos'`, `turno_id`, `monto_recibido` (suma de efectivo bruto), `cambio`.
10. Si es cotización: `estado = 'convertida'`, `factura_id`.
11. Recalcular el estado de la factura (el motor ya lo hizo con cada pago; verificar `pagado + retenido + credito >= total` → `pagada`, si no `abierta`).
12. Armar y devolver el payload completo.

**Notas importantes:**

- **No se pasa `pago` a `crear_factura`**: todos los pagos se registran con `registrar_pago_recibido` para poder ligar `turno_id` y tener un recibo por método.
- La factura se actualiza después de crearla; no se modifica `crear_factura` para `origen`/`turno_id` (se evita tocar el motor).
- El `cambio` no genera asiento: el pago se asienta por el `monto` aplicado; el efectivo que se devuelve nunca fue ingreso.
- `monto_recibido`/`cambio` se guardan en la factura (nivel venta). `pagos_recibidos` no tiene esas columnas; el recibo de Contabilidad muestra el monto aplicado.

#### 3.6.6 Retorno

```json
{
  "factura": {
    "id": "uuid", "numero": 15, "ncf": "B0200000015", "tipo_comprobante": "02",
    "fecha": "2026-11-20", "vencimiento": "2026-11-20", "estado": "pagada",
    "subtotal": 200.00, "descuento": 0.00, "itbis": 36.00, "otros_impuestos": 0.00, "propina": 0.00,
    "total": 236.00, "pagado": 236.00, "retenido": 0.00, "credito": 0.00, "saldo": 0.00,
    "monto_recibido": 250.00, "cambio": 14.00,
    "notas": null, "terminos": null, "pie": null,
    "origen": "pos", "turno_id": "uuid", "almacen_id": "uuid",
    "vendedor_id": null, "centro_costo_id": null, "asiento_id": "uuid"
  },
  "contacto": { "id": "uuid", "nombre": "Consumidor Final", "rnc_cedula": "22222222222", "direccion": null, "telefono": null, "correo": null, "tipo_identificacion": "rnc", "municipio_provincia": null, "lista_precio_id": null },
  "empresa": { "id": 1, "nombre": "…", "rnc": "…", "direccion": "…", "telefono": "…", "correo": "…", "logo_url": "…" },
  "terminal": { "id": "uuid", "nombre": "Caja 1", "plantilla_ticket": { "…": "…" } },
  "turno": { "id": "uuid", "numero": 1, "abierto_en": "2026-11-20T14:05:00-04:00", "base_inicial": 0.00, "efectivo_esperado_actual": 236.00 },
  "cajero": "Waldy Alcántara",
  "vendedor": null,
  "almacen": { "id": "uuid", "nombre": "Principal" },
  "lista_precio": { "id": "uuid", "nombre": "General" },
  "lineas": [
    {
      "id": "uuid", "producto_id": "uuid", "producto_nombre": "Destornillador", "referencia": "DEST-01",
      "descripcion": "Destornillador Phillips", "cantidad": 2.00, "unidad_id": null, "unidad_nombre": "Unidad", "factor_base": 1,
      "precio": 100.00, "descuento_pct": 0.00, "itbis_tasa": 18.00, "impuesto_id": null,
      "subtotal": 200.00, "itbis": 36.00, "total": 236.00, "costo_unitario": 40.00
    }
  ],
  "pagos": [
    { "id": "uuid", "numero": 8, "fecha": "2026-11-20", "metodo": "efectivo", "metodo_pos": "efectivo", "cuenta_id": "uuid", "cuenta_nombre": "Caja general", "monto": 236.00, "monto_recibido": 250.00, "cambio": 14.00, "estado": "activo" }
  ],
  "impuestos": [ { "id": "uuid", "codigo": "itbis-18", "nombre": "ITBIS", "tipo": "itbis", "tarifa": 18.00, "cuenta_id": "uuid", "activo": true, "orden": 10 } ],
  "totales": { "subtotal": 200.00, "descuento": 0.00, "itbis": 36.00, "otros_impuestos": 0.00, "propina": 0.00, "total": 236.00, "pagado": 236.00, "retenido": 0.00, "credito": 0.00, "saldo": 0.00, "monto_recibido": 250.00, "cambio": 14.00 },
  "ncf_vence": null
}
```

`lineas` es un superconjunto de `FacturaLinea` (2B puede definir `LineaPos`); `factura` es un superconjunto de `FacturaDetalle` (`FacturaPos`). `DocumentoPapel` ignora las claves extra. `plantilla_ticket` va en `terminal` para que la UI imprima sin otra consulta.

### 3.7 `pos_crear_cotizacion(p jsonb) returns jsonb`

Atajo del carrito para guardar una cotización rápida. **No requiere turno abierto** (no mueve caja ni inventario); si hay uno abierto, lo liga. La cotización es real y aparece en **Ingresos → Cotizaciones**.

Payload: igual que §3.6.1 pero sin `pagos` ni `numeracion_id`/`tipo_comprobante`, y con `lineas` o `venta_simple` (no `cotizacion_id`; no se convierte una cotización en otra).

Pasos:

1. Validar rol, terminal activa.
2. Resolver contacto (default terminal), lista, vendedor, fechas.
3. Resolver líneas con el mismo criterio de precio/unidad que la venta; **siempre enviar `precio` resuelto** a `crear_cotizacion` para que la lista del terminal se respete.
4. Llamar `crear_cotizacion` con `contacto_id`, `fecha`, `vencimiento`, `notas`, `terminos`, `vendedor_id`, `centro_costo_id`, `lineas`.
5. Actualizar `cotizaciones.origen = 'pos'`, `turno_id = turno abierto de la terminal o null`.
6. Devolver el payload para ticket/PDF: `cotizacion`, `contacto`, `empresa`, `terminal`, `turno`, `vendedor`, `lineas`, `impuestos`, `totales`, `plantilla_ticket`, `lista_precio`.

No consume NCF, no descuenta inventario, no genera asiento y no valida límite de crédito. La cotización no es una venta.

**Dependencia de unidad:** la fase 1 agrega `unidad_id`/`unidad_nombre`/`factor_base` a `cotizacion_lineas`. Si el cuerpo vigente de `_crear_documento_no_contable` aún no inserta `unidad_id`, 2A lo extiende para incluirlo (la columna y el trigger ya existen); el POS no duplica la conversión ni la lógica de unidades.

### 3.8 `pos_crear_devolucion(p jsonb) returns jsonb`

Crea una nota de crédito B04 real y, si hay parte en efectivo, su asiento de reembolso. Exige turno abierto.

#### 3.8.1 Payload

| Clave | Tipo | Obligatoria | Regla |
| --- | --- | --- | --- |
| `terminal_id` | uuid | Sí | Terminal activa. |
| `turno_id` | uuid/null | No | Default: turno abierto de la terminal. Debe estar abierto. |
| `factura_id` | uuid | Sí | Factura existente, no anulada. Puede ser POS o de Contabilidad. |
| `fecha` | date/null | No | Default `current_date`. |
| `lineas` | array | Sí | `[{factura_linea_id, cantidad}]`; no vacío. |
| `tipo_reembolso` | text | Sí | `credito_factura`, `efectivo` o `combinado`. |
| `monto_reembolso_efectivo` | numeric/null | Según tipo | Ver reglas. |
| `cuenta_reembolso_id` | uuid/null | No | Default `terminal.cuenta_efectivo_id`. En esta fase el POS siempre usa la cuenta de efectivo de la terminal; el campo queda para auditoría y para una fase posterior. |
| `notas` | text/null | No | Máximo 500. |

#### 3.8.2 Pasos

1. Validar rol; bloquear terminal (`for share`) y turno (`for update`); validar turno abierto.
2. Validar la factura: existe, no anulada. Bloquearla (la NC lo vuelve a hacer).
3. Validar `tipo_reembolso`; si es `credito_factura`, `monto_reembolso_efectivo` debe ser 0/omitido y `cuenta_reembolso_id` null/omitido. Si es `efectivo` o `combinado`, la cuenta debe ser la de efectivo de la terminal y estar activa.
4. Llamar `crear_nota_credito_venta` con `factura_id`, `fecha`, `notas`, `devuelve_inventario = true`, `almacen_id = terminal.almacen_id`, `lineas`. Esto crea la B04, el asiento de reversión y devuelve el inventario al costo promedio vigente; actualiza `facturas.credito`.
5. Leer el `total` de la NC.
6. Validar el split:
   - `credito_factura`: `monto_efectivo = 0`.
   - `efectivo`: `monto_efectivo = total`.
   - `combinado`: `0 < monto_efectivo < total`; si no: «el reembolso combinado requiere efectivo y crédito mayores a cero».
   - `monto_efectivo <= total`; si no: «el reembolso en efectivo no puede exceder el total de la devolución».
7. **Caps del efectivo:**
   - `monto_efectivo <= round(factura.pagado - devuelto_efectivo_previo, 2)`, donde `devuelto_efectivo_previo` es la suma de `monto_reembolso_efectivo` de las NC activas de esa factura. Si no: «el efectivo devuelto no puede exceder lo pagado en la factura».
   - `monto_efectivo <= efectivo_esperado_actual` del turno. Si no: «el efectivo devuelto no puede exceder el efectivo disponible en la caja».
8. Actualizar la NC con `turno_id`, `tipo_reembolso`, `monto_reembolso_efectivo`, `cuenta_reembolso_id`.
9. Si `monto_efectivo > 0`: crear el asiento `Dr CxC / Cr cuenta_reembolso_id` por `monto_efectivo`, `origen_tipo = 'nota_credito_venta'`, `origen_id = nota.id`, `fecha = current_date`, `descripcion = 'Reembolso en efectivo NC ' || ncf`, usando la CxC del contacto/config y el centro de costo de la terminal. Este asiento neutraliza la parte de CxC que la NC acreditó y saca el efectivo del cajón.
10. Devolver el payload.

**Reglas contables resultantes** (ver §3.11): la NC revierte ingreso/ITBIS y acredita CxC por el total; el asiento de efectivo debita CxC y acredita caja por la parte en efectivo; el crédito restante queda como saldo a favor del cliente en la CxC. El inventario vuelve al costo promedio vigente y no mueve el promedio. La factura original aumenta su `credito` por el total de la NC.

**Retorno:**

```json
{
  "nota": {
    "id": "uuid", "numero": 4, "ncf": "B0400000004", "factura_id": "uuid", "contacto_id": "uuid",
    "fecha": "2026-11-20", "subtotal": 50.00, "itbis": 9.00, "total": 59.00,
    "estado": "activa", "devuelve_inventario": true,
    "tipo_reembolso": "efectivo", "monto_reembolso_efectivo": 59.00,
    "cuenta_reembolso_id": "uuid", "turno_id": "uuid", "notas": null
  },
  "factura": { "id": "uuid", "numero": 12, "ncf": "B0200000012", "total": 100.00, "pagado": 100.00, "credito": 59.00, "estado": "pagada", "saldo": -59.00 },
  "contacto": { "…": "…" },
  "empresa": { "…": "…" },
  "terminal": { "id": "uuid", "nombre": "Caja 1", "plantilla_ticket": { "…": "…" } },
  "turno": { "id": "uuid", "numero": 1 },
  "lineas": [ { "factura_linea_id": "uuid", "producto_id": "uuid", "descripcion": "…", "cantidad": 0.50, "precio": 100.00, "descuento_pct": 0.00, "itbis_tasa": 18.00, "subtotal": 50.00, "itbis": 9.00, "total": 59.00, "costo_unitario": 40.00 } ],
  "reembolso": { "tipo": "efectivo", "efectivo": 59.00, "credito": 0.00, "cuenta_id": "uuid", "cuenta_nombre": "Caja general" },
  "totales": { "subtotal": 50.00, "itbis": 9.00, "total": 59.00, "efectivo": 59.00, "credito": 0.00 },
  "resumen": { "…": "bloque resumen de §3.9 después de la devolución" }
}
```

**Anulación:** la app no anula NC de venta hoy. Si se implementa, debe revertir el asiento de la NC **y** el del reembolso en efectivo (ambos con `origen_tipo='nota_credito_venta'` y `origen_id=nota.id`).

### 3.9 `pos_resumen_turno(p_turno_id uuid) returns jsonb`

`stable`, `security invoker`, `set search_path = ''`. Disponible para `authenticated` con perfil (incluido `lector`). No escribe.

**Definiciones exactas** (todas dentro del bloque `resumen`):

- `ventas.total` y `ventas.cantidad`: facturas con `origen = 'pos'`, `turno_id = p_turno_id` y `estado <> 'anulada'`. Suma de `total` y conteo.
- `ventas.cobrado`: pagos activos de esas facturas **que no tienen un movimiento de turno** (`not exists pos_turno_movimientos m where m.pago_recibido_id = p.id`). Son los pagos iniciales de la venta.
- `ventas.por_metodo` (solo pagos iniciales, es decir, sin movimiento de turno, igual que `ventas.cobrado`):
  - `efectivo`: suma de `pagos.monto` con `metodo = 'efectivo'` y `cuenta_id = terminal.cuenta_efectivo_id`.
  - `tarjeta`: suma de los pagos con `metodo = 'tarjeta'`.
  - `transferencia`: suma de los pagos con `metodo = 'transferencia'`.
  - `credito`: `ventas.total - ventas.cobrado` (saldo que quedó a crédito en las ventas del turno).
  - La suma de las cuatro = `ventas.total`.
- `ventas.por_cuenta`: array `[{cuenta_id, cuenta_nombre, metodo, monto}]` agrupado por cuenta, solo con los pagos iniciales, para el detalle del ticket. Si débito y crédito comparten cuenta, aparecen juntos como `tarjeta`.
- `ingresos`: movimientos `tipo = 'ingreso'` del turno. `total` y `por_motivo` (`fondo_caja`, `cobro_factura`, `otro`). `cantidad`.
- `retiros`: movimientos `tipo = 'retiro'`. `total` y `por_motivo` (`retiro_caja`, `gasto_menor`, `deposito_banco`, `otro`). `cantidad`.
- `vigencia de movimientos`: un `cobro_factura` cuenta solo si su `pago_recibido_id` está `estado = 'activo'`; un `gasto_menor` cuenta solo si su `gasto_menor_id` está `estado = 'activo'`. Los movimientos directos (`fondo_caja`, `retiro_caja`, `deposito_banco`, `otro`) siempre cuentan: no tienen estado y se corrigen con el inverso. Los movimientos con documento anulado se excluyen de `ingresos`/`retiros` y se marcan `vigente = false` en el array.
- `devoluciones`: NC activas con `turno_id = p_turno_id`. `cantidad`, `total`, `efectivo` (suma de `monto_reembolso_efectivo`), `credito` (`total - efectivo`).
- `movimientos`: array de todos los movimientos del turno con `numero`, `tipo`, `motivo`, `monto`, `cuenta_contrapartida_id`, `cuenta_nombre`, `contacto_id`, `factura_id`, `factura_numero`, `pago_recibido_id`, `gasto_menor_id`, `asiento_id`, `notas`, `creado_en`, `creado_por`, `vigente`.
- `efectivo`:
  - `base_inicial`: la del turno.
  - `ventas_efectivo`: `ventas.por_metodo.efectivo`.
  - `ingresos_efectivo`: `ingresos.total` (todos los ingresos son efectivo: `cobro_factura` va al cajón, `fondo_caja` y `otro` también).
  - `retiros_efectivo`: `retiros.total`.
  - `devoluciones_efectivo`: `devoluciones.efectivo`.
  - `efectivo_esperado = round(base_inicial + ventas_efectivo + ingresos_efectivo - retiros_efectivo - devoluciones_efectivo, 2)`.
  - `efectivo_real` y `diferencia`: del turno; null si está abierto.
  - `congelado`: `true` si el turno está cerrado (se devuelve el `efectivo_esperado` guardado, no se recalcula); `false` si está abierto.

**Reglas:**

- Si el turno no existe: «el turno no existe».
- Si está cerrado, `efectivo_esperado` es el valor congelado; los demás agregados se calculan de las filas (pueden cambiar si Contabilidad anula un pago/nota después; el cierre es una foto y no se reescribe).
- El `efectivo_esperado` no debe ser negativo: los retiros y las devoluciones en efectivo se validan contra el esperado actual. Si una anulación externa de un pago o una nota dejara el esperado negativo, el cierre **se bloquea** con un mensaje que pide revisar los pagos/devoluciones del turno antes de cerrar; no se cierra con un esperado negativo ni se fuerza un asiento de sobrante.
- No hace N+1: se resuelve con agregados y `jsonb_agg` en una o pocas consultas.

**Retorno:** `{turno, terminal, empresa, resumen}`, donde `resumen` es el **bloque resumen** `{ventas, ingresos, retiros, devoluciones, efectivo, movimientos}`. Ese bloque es el que reutilizan las demás RPC (`pos_abrir_turno`, `pos_registrar_movimiento_turno`, `pos_crear_devolucion`, `pos_cerrar_turno`). `turno` incluye `id`, `numero`, `terminal_id`, `abierto_por`, `cerrado_por`, `abierto_en`, `cerrado_en`, `estado`, `base_inicial`, `efectivo_esperado`, `efectivo_real`, `diferencia`, `asiento_diferencia_id`, `observaciones`. `terminal` incluye `id`, `nombre`, `almacen_id`, `cuenta_efectivo_id`, `plantilla_ticket`. `empresa` es la fila única.

### 3.10 `pos_cerrar_turno(p jsonb) returns jsonb`

| Clave | Tipo | Obligatoria | Regla |
| --- | --- | --- | --- |
| `turno_id` | uuid | Sí | Turno abierto. |
| `efectivo_real` | numeric | Sí | Conteo físico; `>= 0`; 2 decimales. |
| `observaciones` | text/null | No | Máximo 500. |
| `registrar_diferencia` | boolean | No | Default `true`. |

Pasos:

1. Validar rol; bloquear terminal (`for share`) y turno (`for update`).
2. Si el turno no existe o no está abierto: «el turno ya está cerrado» / «el turno no existe».
3. Calcular el resumen con la misma fórmula de §3.9 (mientras el turno está bloqueado, no entra ningún movimiento nuevo). Si `efectivo_esperado < 0`: «el efectivo esperado es negativo; revisa los pagos y devoluciones del turno antes de cerrar».
4. `diferencia = round(efectivo_real - efectivo_esperado, 2)`.
5. Si `registrar_diferencia` y `diferencia <> 0`:
   - Crear asiento `origen_tipo = 'pos_diferencia'`, `origen_id = turno.id`, `fecha = current_date`, `descripcion = 'Diferencia de cierre del turno ' || numero`:
     - Sobrante (`diferencia > 0`): `Dr terminal.cuenta_efectivo_id / Cr cuenta config sobrante_caja` por `diferencia`.
     - Faltante (`diferencia < 0`): `Dr cuenta config faltante_caja / Cr terminal.cuenta_efectivo_id` por `abs(diferencia)`.
   - Si falta la clave/cuenta: «no hay una cuenta configurada para sobrante/faltante de caja».
6. Actualizar el turno en una sola sentencia: `estado='cerrado'`, `cerrado_por=auth.uid()`, `cerrado_en=now()`, `efectivo_esperado`, `efectivo_real`, `diferencia`, `asiento_diferencia_id`, `observaciones`. El check de coherencia debe pasar.
7. Devolver el payload del cierre: `turno`, `terminal` (con `plantilla_ticket`), `empresa`, `resumen` (con `congelado=true` y su array `movimientos`), `asiento_diferencia` (o null).

**Reglas:**

- No se puede cerrar un turno ya cerrado; no se reabre.
- Si `registrar_diferencia = false`, la diferencia se guarda igual y `asiento_diferencia_id` queda null; el arqueo queda documentado sin ajuste contable.
- El cierre congela el esperado: anulaciones posteriores no lo reescriben.
- **Limitación de concurrencia con Contabilidad:** el cierre bloquea el turno, pero no las anulaciones de pagos/gastos que se hacen desde Contabilidad (esas bloquean el pago/gasto, no el turno). Si se anula un pago del turno mientras se cierra, gana el orden de commit; se recomienda no anular pagos/gastos del turno durante el cierre. El esperado congelado es la foto del momento.
- El índice único parcial libera la terminal al cambiar a `cerrado`, dentro de la misma transacción, para que se pueda abrir un turno nuevo.

### 3.11 Matriz de asientos por operación

| Operación | Débito | Crédito | `origen_tipo` | `origen_id` |
| --- | --- | --- | --- | --- |
| Venta POS (`crear_factura`) | CxC (contacto o `cxc`) por el total | Ventas por línea (neto) + ITBIS por pagar + otros impuestos/propina | `factura` | factura |
| Costo de la venta (si inventariable/combo) | Costo de ventas | Inventario | `factura` | factura |
| Pago de la venta (`registrar_pago_recibido`) | Cuenta del método (cajón/banco) por `monto` | CxC por `monto` | `pago_recibido` | pago |
| Cobro de factura en turno | Caja de la terminal | CxC | `pago_recibido` | pago |
| Gasto menor | Cuenta de gasto + ITBIS adelantado | Caja de la terminal | `gasto_menor` | gasto |
| Ingreso directo (`fondo_caja`/`otro` ingreso) | Caja de la terminal | Cuenta de contrapartida | `pos_movimiento` | movimiento |
| Retiro directo (`retiro_caja`/`otro` retiro) | Cuenta de contrapartida | Caja de la terminal | `pos_movimiento` | movimiento |
| Depósito al banco | Cuenta de banco destino | Caja de la terminal | `pos_movimiento` | movimiento |
| Nota de crédito B04 | Devoluciones en ventas + ITBIS por pagar | CxC por el total | `nota_credito_venta` | nota |
| Reembolso en efectivo de la NC | CxC por la parte en efectivo | Caja de la terminal por la parte en efectivo | `nota_credito_venta` | nota |
| Diferencia sobrante | Caja de la terminal | Sobrantes de caja | `pos_diferencia` | turno |
| Diferencia faltante | Faltantes de caja | Caja de la terminal | `pos_diferencia` | turno |
| Anulación (existente) | Créditos originales | Débitos originales | `anulacion` | asiento original |

- Todos los asientos los crea `_crear_asiento`, que valida cuentas de detalle y cuadre. La RPC no inserta en `asientos` directamente.
- El centro de costo de la terminal se aplica a las líneas de los asientos de venta, movimiento, reembolso y diferencia cuando exista.
- El asiento de la venta y los de los pagos son distintos: la factura nace con su asiento; cada pago crea el suyo. Es el patrón actual de Contabilidad.

### 3.12 RPC de lectura de la fase 1 (dependencia, no se redefinen)

El POS consume estas dos RPC creadas por la migración de inventario ferretería. **No se crean ni se reemplazan en la migración del POS.** Si la fase 1 cambia su firma, manda esa migración.

- `pos_buscar_por_codigo_barra(p_codigo text, p_almacen_id uuid default null, p_lista_precio_id uuid default null)` → `table (producto_id uuid, nombre text, referencia text, marca text, tipo text, unidad_id uuid, unidad_nombre text, factor_base numeric, precio numeric, itbis_tasa numeric, stock numeric, disponible numeric, imagen_path text, favorito_pos boolean, codigo text)`. `security invoker`, `stable`. Match exacto por código (case-insensitive, trim).
- `pos_catalogo_productos(p_almacen_id uuid default null, p_lista_precio_id uuid default null, p_busqueda text default null, p_categoria_id uuid default null, p_solo_favoritos boolean default false, p_limit int default 50, p_offset int default 0)` → `table (producto_id uuid, nombre text, referencia text, marca text, tipo text, categoria_id uuid, favorito_pos boolean, imagen_path text, unidad_medida text, precio numeric, itbis_tasa numeric, stock numeric, disponible numeric, unidades jsonb)`. `security invoker`, `stable`. Una sola consulta, sin N+1.

Ambas respetan RLS y resuelven el almacén/lista por defecto si el parámetro es null. El POS usa `p_limit` de 50–100 y `p_offset`; no hay tope de 1,000.

---

## 4. Impresión dual

### 4.1 Ticket térmico (80 mm / 57 mm)

Un solo componente `TicketPos` (2D) que se renderiza en un contenedor de impresión y usa `window.print()`. **No** se abre una ventana nueva con HTML concatenado ni se usa un iframe: evita XSS, estilos inconsistentes y bloqueos de popup.

**Reglas de impresión:**

- `@media print` oculta el resto de la app y deja visible solo el ticket. `@page { size: <ancho_mm>mm auto; margin: 0 }`; el contenedor mide exactamente el ancho del papel y usa 3 mm de margen interno.
- 80 mm: ancho útil ~72 mm; fuente base 9–10 pt.
- 57 mm: ancho útil ~48 mm; fuente base 7–8 pt; las columnas se apilan (descripción en una línea, cantidad/precio/total en otra).
- `break-inside: avoid` en cada línea y en los bloques de totales; `page-break-inside: avoid` como respaldo.
- El ticket impreso es **siempre blanco y negro** (`background: white`, `color: black`), sin tokens de tema. La vista previa en pantalla sí puede usar el tema, pero el print fuerza blanco/negro. Son los únicos colores literales permitidos, y solo en el CSS de impresión del ticket (no en la UI).
- `-webkit-print-color-adjust: exact` para que las líneas/negritas salgan.
- El logo se limita a ~18 mm de alto y se oculta si falla la carga.
- No se imprimen URLs, botones ni el sidebar.

**Estilos:**

| Estilo | Reglas visuales |
| --- | --- |
| `clasico` | Cabecera centrada, separadores punteados entre bloques, tabla con columnas, total en caja, pie centrado. Es el default. |
| `minimalista` | Todo alineado a la izquierda, sin separadores salvo uno antes de totales, etiquetas en mayúscula pequeña, sin caja de total. |
| `detallado` | Incluye referencia, unidad, precio unitario, descuento por línea, desglose de impuestos por tasa, vendedor y detalle de pagos. |

**Tipografía (sin dependencias nuevas):**

- `clasica`: `ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif`.
- `moderna`: `"Geist", "Inter", ui-sans-serif, system-ui, sans-serif` (las fuentes ya cargadas por la app).
- `compacta`: `ui-sans-serif, system-ui, "Arial Narrow", sans-serif` con `letter-spacing: -0.01em`.

**Toggles:**

- `mostrar_logo`: `empresa.logo_url`.
- `mostrar_vendedor`: vendedor de la factura/cotización (`vendedores.nombre`).
- `mostrar_descripcion`: descripción de la línea; si false, solo el nombre del producto o la descripción libre.
- `mostrar_referencia`: `productos.referencia`.
- `mostrar_precio_unitario`: columna de precio unitario; si false, solo total de línea.
- `mostrar_unidad`: `unidad_nombre` o `productos.unidad_medida`.
- `precios_con_impuestos`: true muestra el precio unitario con ITBIS (`round(precio * (1 + tasa/100), 2)`) y una nota «ITBIS incluido»; false muestra el precio sin ITBIS y el ITBIS en el bloque de totales. **No cambia los montos guardados.**

**Contenido por documento:**

| Documento | Cabecera / datos | Cuerpo | Totales / pie |
| --- | --- | --- | --- |
| Factura POS | Empresa (nombre, RNC, dirección, teléfono, correo, logo), título según tipo (`Factura de Crédito Fiscal` 01, `Factura de Consumo` 02, etc.), NCF, fecha/hora, caja/terminal, turno, cliente, vendedor (toggle) | Líneas con cantidad, unidad, descripción, referencia, precio unitario, descuento, ITBIS y total; métodos de pago y recibido/cambio | Subtotal, descuento, gravado, exento, ITBIS, otros impuestos, propina, total; pagado, saldo si es crédito; recibido y cambio si hubo efectivo; `pie_ticket` |
| Cotización POS | Empresa, «Cotización No N», fecha, vence, cliente, vendedor | Líneas; sin NCF, sin pagos | Subtotal, descuento, ITBIS, otros, propina, total; nota «No es una factura»; `pie_ticket` |
| Cierre de turno | Empresa, «Cierre No N», terminal, abierto/cerrado, cajero | Base, ventas por método, ingresos por motivo, retiros por motivo, devoluciones (efectivo/crédito), lista de movimientos, total de movimientos | Efectivo esperado, efectivo real, diferencia (sobrante/faltante), observaciones; `pie_ticket` |
| Devolución B04 | Empresa, «Nota de Crédito» + NCF B04, fecha, factura origen, cliente, turno | Líneas devueltas con cantidad/precio/ITBIS/total; reembolso efectivo/crédito y cuenta | Subtotal, ITBIS, total; efectivo, crédito; `pie_ticket` |
| Recibo de movimiento | Empresa, «Recibo de ingreso/retiro No N», fecha/hora, turno, cajero | Motivo, monto, cuenta, contacto/factura, notas | Total del recibo y, si aplica, efectivo esperado después del movimiento; `pie_ticket` |

**Reglas de contenido:**

- El NCF y el título salen del tipo de comprobante; no se inventan series.
- El cliente es el de la factura/cotización; en Consumidor Final se muestra el nombre configurado (no un texto hardcodeado).
- Los montos van alineados a la derecha, en `tabular-nums`, con 2 decimales.
- Las devoluciones y retiros se muestran en negativo/rojo suave en la pantalla; en el ticket impreso, con signo `-` y etiqueta «Devolución»/«Retiro».
- Si `pie_ticket` es null, no se imprime pie. No se usa el pie de `plantillas_impresion` en el ticket (ese es del PDF Carta).
- No se imprime «Generado por Alegra» ni ninguna marca de terceros.

### 4.2 PDF Carta

- Se reutiliza **`DocumentoPapel`** y **`plantillas_impresion`** existentes. No se crea un segundo documento formal ni se duplica el HTML.
- Botón «Imprimir PDF (Carta)» en:
  - Confirmación de venta POS.
  - Detalle del historial POS.
  - Confirmación de cotización rápida.
- Para factura: `DocumentoPapel tipo="factura"` con `empresa`, `factura`, `lineas`, `contacto`, `ncfVence`, `impuestos`, `mostrarLogo` de `plantillas_impresion('factura')`.
- Para cotización: `DocumentoPapel tipo="cotizacion"` con la `vista` que arma 2B desde el payload.
- El PDF Carta usa la plantilla de Contabilidad (notas al pie, términos, logo). El ticket usa `pos_terminales.plantilla_ticket`. Son dos formatos distintos y pueden verse distintos.
- El botón del POS no debe obligar a salir del POS: puede abrir el documento en una pestaña nueva o renderizarlo en un diálogo de impresión; lo que no puede es pedir otra consulta para armarlo (el payload ya trae todo).
- No se agrega una librería de PDF nueva. Se usa el flujo de impresión/`DocumentoPapel` que ya existe.

### 4.3 Reglas de marca y tokens

- **Nunca** el teal `#00b19d` de Alegra. El primario es `--primary` (azul) de `docs/plantilla-diseno.md`.
- Nada de hex/rgb/oklch sueltos en componentes; solo tokens (`bg-background`, `text-foreground`, `border-border`, `text-muted-foreground`, `bg-primary`, etc.).
- El ticket impreso es la excepción de color: blanco/negro por legibilidad térmica.
- El POS no hardcodea «Medoxigas»: usa `empresa.nombre` y `empresa.rnc`. Si `empresa.nombre` es null, omite la línea; no cae al texto de relleno de `DocumentoPapel`.
- Fechas y horas en `America/Santo_Domingo`; montos `es-DO` con `RD$` y coma de miles. El ticket puede usar `RD$` o el símbolo de la moneda base; no se inventa moneda.

---

## 5. RLS, permisos y auditoría

### 5.1 RLS por tabla

| Tabla | RLS | `anon` | `authenticated` | Escrituras |
| --- | --- | --- | --- | --- |
| `pos_terminales` | Activo | Nada | `select` si `rol_actual() is not null` | Solo RPC definer (`pos_crear_terminal`, `pos_actualizar_terminal`) |
| `pos_turnos` | Activo | Nada | `select` si `rol_actual() is not null` | Solo RPC definer |
| `pos_turno_movimientos` | Activo | Nada | `select` si `rol_actual() is not null` | Solo RPC definer |

Patrón exacto (el mismo de `almacenes`):

- `alter table ... enable row level security`.
- `revoke all on public.<tabla> from anon`.
- `revoke all on public.<tabla> from authenticated`.
- `grant select on public.<tabla> to authenticated`.
- `create policy <tabla>_leer on public.<tabla> for select to authenticated using ((select public.rol_actual()) is not null)`.
- Sin políticas de `insert`, `update` ni `delete`.
- Las secuencias `pos_turnos_numero_seq` y `pos_turno_movimientos_numero_seq`: `revoke all from anon, authenticated`.

Las columnas nuevas de `facturas`, `cotizaciones`, `pagos_recibidos` y `notas_credito_venta` heredan las políticas existentes; no se agregan políticas nuevas. `authenticated` sigue leyendo con perfil y no escribe directo.

### 5.2 Permisos de funciones

- `pos_crear_terminal(jsonb)`, `pos_actualizar_terminal(uuid, jsonb)`, `pos_abrir_turno(jsonb)`, `pos_registrar_movimiento_turno(jsonb)`, `pos_completar_venta(jsonb)`, `pos_crear_cotizacion(jsonb)`, `pos_crear_devolucion(jsonb)`, `pos_cerrar_turno(jsonb)`:
  - `revoke all on function ... from public, anon, authenticated;`
  - `grant execute on function ... to authenticated;`
  - El rol se valida dentro (admin/contador).
- `pos_resumen_turno(uuid)`: `revoke all from public, anon, authenticated`; `grant execute to authenticated`; es `security invoker`, así que RLS aplica. `lector` puede leer.
- Cualquier helper interno nuevo (`_pos_*`) va `revoke all from public, anon, authenticated` y **no** se concede.
- No se usa `service_role` en la app, en las RPC ni en los scripts.

### 5.3 No DELETE

- No hay `delete` en RPC, ni políticas, ni grants.
- Una terminal se desactiva (`activa = false`), no se borra.
- Un turno se cierra, no se borra.
- Un movimiento equivocado se corrige con un movimiento inverso (`otro`, tipo contrario) y una nota; el original queda.
- Una venta se anula desde Ingresos → Facturas con el flujo existente (primero sus pagos). Una devolución no se borra: su reversión requiere la anulación de la nota de crédito (hoy no implementada en la app) o un ajuste contable manual con OK de Contable; el POS no borra notas.

### 5.4 Auditoría

Se reutiliza `_auditar()` de `20261118190225_auditoria.sql`:

| Tabla | Trigger | Campos vigilados | Etiqueta | Entidad |
| --- | --- | --- | --- | --- |
| `pos_terminales` | insert/update | `nombre,almacen_id,cuenta_efectivo_id,cuenta_tarjeta_debito_id,cuenta_tarjeta_credito_id,cuenta_transferencia_id,numeracion_defecto_id,contacto_defecto_id,activa` | `nombre` | `terminal_pos` |
| `pos_turnos` | insert/update | `estado,base_inicial,efectivo_esperado,efectivo_real,diferencia,observaciones` | `numero` | `turno_pos` |
| `pos_turno_movimientos` | insert | `monto,tipo,motivo` | `numero` | `movimiento_pos` |

- La auditoría de facturas, pagos y notas ya existe y cubre los documentos POS.
- La pantalla de Auditoría (2C) agrega las etiquetas «Terminal POS», «Turno POS» y «Movimiento POS».
- El reset a base virgen vacía `auditoria` (es transaccional), sin tocar los triggers.

### 5.5 Menú y roles

- `src/navigation/sidebar/sidebar-items.ts`: ítem «Punto de venta» con `newTab: true`, URL `/pos`, icono de tienda/carrito, roles `admin` y `contador`. `lector` no lo ve en el menú, pero puede consultar las facturas POS en Ingresos → Facturas y, si entra directo a `/pos/historial`, la pantalla es de solo lectura.
- La configuración `/dashboard/configuracion/pos` se muestra a `admin`/`contador`; `lector` la ve en modo lectura (o no la ve, según el patrón de las demás pantallas de configuración).
- El POS no muestra el sidebar de Contabilidad; su layout tiene navegación propia (Vender, Turnos, Historial, Devoluciones) y «Volver a Contabilidad».

---

## 6. Invariantes y errores

### 6.1 Invariantes (pgTAP)

1. **Un turno abierto por terminal:** el índice único parcial lo garantiza; dos aperturas concurrentes no pueden pasar.
2. **Coherencia del turno:** abierto = sin cierre ni conteos; cerrado = con `cerrado_por`, `cerrado_en`, esperado, real y `diferencia = round(real - esperado, 2)`.
3. **Fórmula del efectivo esperado:** `base_inicial + ventas_efectivo + ingresos_efectivo - retiros_efectivo - devoluciones_efectivo`, con las definiciones de §3.9.
4. **Caja no negativa:** un retiro, gasto o devolución en efectivo no puede dejar el esperado en negativo; el esperado congelado es `>= 0`. Si una anulación externa lo dejara negativo, el cierre se bloquea para revisión.
5. **Cambio solo sobre efectivo:** `monto_recibido` solo en efectivo; `cambio = sum(recibido) - sum(aplicado)` de los pagos en efectivo; `0 <= cambio <= monto_recibido`; no hay cambio si la venta queda a crédito.
6. **Pagos:** cada `monto > 0`; `sum(pagos.monto) <= factura.total`; `pagado` = suma de montos aplicados; `saldo = total - pagado - retenido - credito`.
7. **Consumidor Final sin crédito:** si el contacto es el `contacto_defecto_id` de la terminal y `nuevo_saldo > 0`, se rechaza.
8. **Límite de crédito:** si `limite_credito` no es null, `saldo_actual + nuevo_saldo <= limite`; la fila del contacto se bloquea antes de calcular.
9. **Fuente única de la venta:** líneas, venta simple o cotización; exactamente una.
10. **Cotización convertida una vez:** solo `abierta`; se bloquea; queda `convertida` con `factura_id`; no se descuenta dos veces.
11. **Devolución:** `credito_factura` = 0 efectivo; `efectivo` = total; `combinado` = ambos > 0 y suma total; `efectivo <= pagado - devuelto_previo` y `<= efectivo esperado`.
12. **Inventario de la devolución:** vuelve al costo promedio vigente; no mueve el promedio; la NC es B04 real.
13. **Asientos cuadrados:** todo asiento nuevo pasa por `_crear_asiento`; débitos = créditos; 2+ líneas; cuentas de detalle; origen permitido.
14. **Diferencia de cierre:** sobrante `Dr Caja / Cr Sobrantes`; faltante `Dr Faltantes / Cr Caja`; monto `abs(diferencia)`; solo si `registrar_diferencia` y `diferencia <> 0`.
15. **Terminal:** todas las cuentas de cobro son `es_caja_banco` activas; tarjeta/transferencia distintas de cualquier cajón activo; numeración de venta activa; contacto cliente activo; almacén/lista/centro activos si existen.
16. **Cajón único:** dos terminales activas no comparten `cuenta_efectivo_id`.
17. **Una sola terminal por turno:** `pos_turnos.terminal_id` es de una terminal; no se mueve un turno de terminal.
18. **Inmutabilidad:** no se actualiza ni borra un movimiento; no se reabre un turno; no se edita una factura POS fuera del flujo del motor.
19. **Roles:** `lector` no escribe; `anon` no ve nada; las escrituras son solo por RPC definer.
20. **Sin DELETE:** no hay grants ni políticas de delete en las tablas nuevas.
21. **Redondeo:** todo monto guardado es `numeric(14,2)`; los totales se comparan con `round(...,2)`.
22. **Impuestos e inventario:** los calcula el motor (`crear_factura`, `crear_nota_credito_venta`), no el POS; el POS solo resuelve precio de lista/unidad y arma el payload.
23. **Semillas idempotentes:** sobrante/faltante y Consumidor Final existen una sola vez; `config_contable` no se pisa.
24. **Reset:** `pos_terminales` conservada de verdad (con respaldo) o clasificada como transaccional; `pos_turnos`/movimientos truncados; secuencias reiniciadas.
25. **Payload completo:** la venta, cotización, devolución, cierre y recibo devuelven todo lo necesario para imprimir sin otra consulta.
26. **Trazabilidad:** factura POS con `origen='pos'` y `turno_id`; cotización POS con `origen='pos'` y `turno_id`; pagos POS con `turno_id`; NC POS con `turno_id` y split de reembolso.
27. **Cierre congelado:** el `efectivo_esperado` de un turno cerrado no se recalcula; el resumen devuelve el valor guardado.
28. **Sin multi-empresa:** no hay `empresa_id`; se usa la fila única.
29. **Marca:** no hay textos de Medoxigas hardcodeados en tablas/RPCs/tickets; se usa `empresa.*`.
30. **Fechas:** `vencimiento >= fecha`; no se aceptan fechas futuras de cierre/anulación fuera de las reglas existentes.

### 6.2 Errores en español

La RPC devuelve los mensajes en minúscula; la UI capitaliza la primera letra. SQLSTATE `22023` para validación, `42501` para permiso; `23514`/`23505` solo como defensa final.

| Situación | Mensaje |
| --- | --- |
| Sin rol admin/contador | `sin permiso` (42501) |
| Terminal inexistente/inactiva | `la terminal no existe o está inactiva` |
| Nombre de terminal vacío | `el nombre de la terminal es obligatorio` |
| Nombre duplicado | `ya existe una terminal con ese nombre` |
| Almacén inválido | `el almacén de la terminal no existe o está inactivo` |
| Cuenta de efectivo inválida | `la cuenta de efectivo debe ser una cuenta de caja o banco activa` |
| Cuenta de tarjeta/transferencia inválida | `la cuenta de % debe ser una cuenta de caja o banco activa distinta a la de efectivo` |
| Cuenta de tarjeta/transferencia sobre un cajón | `la cuenta de % no puede ser un cajón de efectivo` |
| Cajón duplicado | `ya existe una terminal activa con esa cuenta de efectivo` |
| Numeración inválida | `la numeración de la terminal no existe, está inactiva o no es de factura de venta` |
| Contacto inválido | `el contacto por defecto debe ser un cliente activo` |
| Lista/centro inválidos | `la lista de precios o el centro de costo no existe o está inactivo` |
| Plantilla con enum inválido | `la plantilla del ticket tiene un valor inválido para %` |
| Plantilla que no es objeto | `la plantilla del ticket debe ser un objeto` |
| Plantilla con campo desconocido | `la plantilla del ticket tiene un campo desconocido: %` |
| Desactivar con turno abierto | `no se puede desactivar una terminal con un turno abierto` |
| Cambiar cajón/almacén/numeración con turno abierto | `cierra el turno antes de cambiar la cuenta de efectivo, el almacén o la numeración` |
| Turno ya abierto | `la terminal ya tiene un turno abierto (turno No %)` |
| Sin turno abierto | `no hay un turno abierto en la terminal %` |
| Turno de otra terminal | `el turno no pertenece a la terminal` |
| Turno cerrado | `el turno ya está cerrado` |
| Turno inexistente | `el turno no existe` |
| Esperado negativo al cerrar | `el efectivo esperado es negativo; revisa los pagos y devoluciones del turno antes de cerrar` |
| Base negativa | `la base inicial no puede ser negativa` |
| Monto no positivo | `el monto del movimiento debe ser mayor a cero` |
| Motivo/tipo incoherente | `el motivo del movimiento no corresponde al tipo` |
| Contrapartida inválida | `la cuenta de contrapartida no existe, está inactiva o no acepta movimientos` |
| Contrapartida igual al cajón | `la cuenta de contrapartida debe ser distinta de la cuenta de efectivo` |
| Depósito sin banco | `para depositar al banco, la cuenta de destino debe ser de caja o banco` |
| Retiro deja caja negativa | `el retiro deja la caja en negativo` |
| Factura inexistente/anulada | `la factura no existe o está anulada` |
| Factura sin saldo | `la factura no tiene saldo pendiente` |
| Cobro mayor al saldo | `el monto del cobro excede el saldo de la factura` |
| Cuenta de gasto inválida | `la cuenta de gasto no existe, está inactiva o no es de gasto` |
| Gasto sin descripción | `la descripción del gasto es obligatoria` |
| ITBIS del gasto no cuadra | `el ITBIS del gasto no cuadra con el monto` |
| Venta sin fuente | `indica líneas, venta simple o una cotización, no varias a la vez` |
| Venta simple inválida | `la venta simple requiere una descripción y un monto mayor a cero` |
| Línea libre sin precio | `la línea libre requiere un precio` |
| Producto/unidad inválidos | `el producto o la unidad de medida no existe o está inactivo` |
| Cotización no abierta | `la cotización no existe o no está abierta` |
| Cotización de otro contacto | `la cotización pertenece a otro contacto` |
| Método inválido | `el método de pago no es válido` |
| Método sin cuenta | `la terminal no tiene una cuenta configurada para %` |
| Cambio en no efectivo | `solo el efectivo admite monto recibido y cambio` |
| Recibido menor al monto | `el monto recibido en efectivo no puede ser menor al monto del pago` |
| Suma de pagos excedida | `la suma de los pagos no puede exceder el total de la venta` |
| Crédito a Consumidor Final | `no se puede vender a crédito al Consumidor Final; selecciona un cliente o cobra el total` |
| Límite excedido | `la venta a crédito excede el límite del contacto (límite %, saldo actual %, saldo nuevo %)` |
| Devolución sin líneas | `la devolución requiere al menos una línea` |
| Split combinado inválido | `el reembolso combinado requiere efectivo y crédito mayores a cero` |
| Efectivo distinto del total | `el reembolso en efectivo debe ser igual al total de la devolución` |
| Crédito con efectivo | `el reembolso con crédito a factura no puede incluir efectivo` |
| Efectivo mayor al total | `el reembolso en efectivo no puede exceder el total de la devolución` |
| Efectivo mayor a lo pagado | `el efectivo devuelto no puede exceder lo pagado en la factura` |
| Efectivo mayor a la caja | `el efectivo devuelto no puede exceder el efectivo disponible en la caja` |
| Cuenta de reembolso inválida | `la cuenta de reembolso debe ser la cuenta de efectivo de la terminal` |
| Efectivo real faltante | `el efectivo real es obligatorio` |
| Efectivo real negativo | `el efectivo real no puede ser negativo` |
| Cuenta de sobrante/faltante | `no hay una cuenta configurada para sobrante o faltante de caja` |

---

## 7. Pruebas

### 7.1 pgTAP (`supabase/tests/pos_test.sql`)

Cada archivo con `begin; select plan(N); ... rollback;` y usuarios propios, como los tests actuales. Los casos de unidad/combos se activan cuando la fase 1 de inventario esté en `main`; hasta entonces se prueban con productos simples y se deja el caso marcado como dependencia.

| # | Caso | Resultado esperado |
| --- | --- | --- |
| 1 | Crear terminal válida | Devuelve id; se lee en `pos_terminales`. |
| 2 | Terminal con cuenta que no es caja/banco | 22023; no inserta. |
| 3 | Terminal con numeración 03/04/13 | 22023; no inserta. |
| 4 | Dos terminales activas con el mismo cajón | 22023/23505; solo una. |
| 5 | Nombre duplicado | 22023; no inserta. |
| 6 | `lector` crea terminal | 42501. |
| 7 | Abrir turno con base 0 | Crea turno `abierto`; `numero` 1; sin asiento. |
| 8 | Abrir segundo turno en la misma terminal | 22023; el índice único lo impide. |
| 9 | Abrir turno en otra terminal | Permitido. |
| 10 | Base negativa | 22023. |
| 11 | Venta en efectivo con cambio | Factura real, NCF, asiento, pago, `origen='pos'`, `turno_id`, `monto_recibido=250`, `cambio=14`, `pagado=236`; el esperado sube 236 (no 250). |
| 12 | Venta con tarjeta débito | Pago con `metodo='tarjeta'` y cuenta de débito; no cambia el efectivo esperado. |
| 13 | Venta combinada efectivo + tarjeta | Dos pagos, dos asientos; cambio solo sobre efectivo; suma aplicada = total. |
| 14 | Venta a crédito total a un cliente con límite | Factura `abierta`, saldo = total, CxC; sin pago; esperado no cambia. |
| 15 | Venta a crédito a Consumidor Final | 22023; no crea factura. |
| 16 | Venta que excede el límite | 22023; no crea factura. |
| 17 | Venta que queda justo en el límite | Permitida. |
| 18 | Venta simple con ITBIS 0 | Una línea libre; total exacto; sin inventario. |
| 19 | Venta con producto sin stock y `vende_negativo=false` | Error del motor; no crea factura. |
| 20 | Venta con producto `vende_negativo=true` | Permitida; stock negativo. |
| 21 | Venta desde cotización abierta | Factura creada; cotización `convertida` con `factura_id`; no se descuenta dos veces. |
| 22 | Convertir la misma cotización dos veces | 22023; la segunda no crea factura. |
| 23 | Cotización rápida desde el POS | Fila en `cotizaciones`, `origen='pos'`, `turno_id`; no consume NCF, no mueve inventario, no asiento. |
| 24 | Ingreso directo `fondo_caja` | Asiento `Dr Caja / Cr contrapartida`, origen `pos_movimiento`; esperado sube. |
| 25 | Retiro directo `retiro_caja` | Asiento inverso; esperado baja; no deja caja negativa. |
| 26 | Depósito al banco | `Dr banco / Cr caja`; esperado baja. |
| 27 | Gasto menor desde caja | B13, asiento, movimiento ligado; esperado baja por el total. |
| 28 | Cobro de factura en turno | Pago creado y ligado al movimiento; esperado sube; factura baja su saldo; no se cuenta dos veces como venta. |
| 29 | Devolución solo crédito | B04, inventario al promedio, `facturas.credito` sube, sin asiento de efectivo; esperado no cambia. |
| 30 | Devolución solo efectivo | B04 + asiento `Dr CxC / Cr Caja`; esperado baja; `monto_reembolso_efectivo=total`. |
| 31 | Devolución combinada | Ambos > 0 y suma total; asiento de efectivo por la parte cash; crédito restante en CxC. |
| 32 | Devolución con efectivo > pagado o > caja | 22023; no crea NC. |
| 33 | Devolución con split inválido | 22023; no crea NC. |
| 34 | Devolución sin turno abierto | 22023. |
| 35 | Resumen de turno | Fórmula exacta; ventas por método; ingresos/retiros/devoluciones; `lector` puede leer. |
| 36 | Cerrar turno sin diferencia | Congela esperado/real; `diferencia=0`; no asiento; libera la terminal. |
| 37 | Cerrar con sobrante | `Dr Caja / Cr Sobrantes`; `asiento_diferencia_id`; check de cierre. |
| 38 | Cerrar con faltante | `Dr Faltantes / Cr Caja`; `asiento_diferencia_id`; check de cierre. |
| 39 | Cerrar con `registrar_diferencia=false` | Guarda diferencia, sin asiento. |
| 40 | Cerrar dos veces / vender después de cerrar | 22023; no escribe. |
| 41 | Movimiento después de cerrar | 22023. |
| 42 | RLS: `anon` no ve `pos_*` | 0 filas / permiso denegado. |
| 43 | RLS: `lector` lee, no escribe | `select` ok; RPC de escritura 42501. |
| 44 | Sin DELETE directo | `authenticated` no tiene grant de delete; no hay política. |
| 45 | Auditoría de cierre | Fila en `auditoria` con entidad `turno_pos`. |
| 46 | Semillas idempotentes | Sobrante/faltante y Consumidor Final una sola vez; `config_contable` no se pisa. |
| 47 | Reset | `pos_terminales` conservada de verdad o clasificada; turnos/movimientos truncados; secuencias en 1. |
| 48 | Payload de venta | Incluye `factura`, `contacto`, `empresa`, `terminal`, `turno`, `lineas`, `pagos`, `impuestos`, `totales`, `plantilla_ticket`. |
| 49 | Venta con unidad (fase 1) | 1 caja descuenta `factor_base` unidades; línea guarda unidad/factor. |
| 50 | Venta de combo (fase 1) | Descuenta componentes y costea; no vende el combo como producto simple. |

### 7.2 Vitest (2B)

- Esquemas Zod de los payloads (venta, pago, cotización, devolución, movimiento, cierre, terminal, plantilla).
- Mapeo método POS → `pagos_recibidos.metodo` y cuenta.
- Cálculo de cambio en el cliente (solo previsualización; el servidor manda).
- Formateo del ticket (anchos, toggles, estilos) y del payload de impresión.
- Consultas paginadas (`paginarConsulta`/`consultarEnLotes`), sin topes fijos.
- Server actions usan `supabase.rpc("pos_...", { p })` directo (candado `rpc-sin-extraer`).
- Errores en español y capitalización.

### 7.3 Playwright y evidencia visual (2C/2D)

- Abrir turno, vender efectivo con cambio, vender combinado, venta a crédito, bloquear Consumidor Final, convertir cotización, devolución combinada, cerrar con sobrante/faltante.
- Imprimir ticket (al menos abrir el diálogo/print preview) y PDF Carta.
- Capturas claro/oscuro y móvil de Vender, checkout, Turnos, Historial, Devoluciones y Configuración → POS. Las revisa Waldy; sin captura, no está terminado.
- `pnpm test:e2e` se salta sin `E2E_EMAIL`/`E2E_PASSWORD`; las capturas del dev server del worktree son la evidencia principal.

---

## 8. Rollout, compatibilidad y rollback

### 8.1 Orden de migraciones y dependencias

1. **Fase 1 de inventario ferretería** (`20261125100000_inventario_ferreteria_catalogo.sql`, `20261125101000_inventario_ferreteria_motor.sql` o los nombres/timestamps que queden en `main`). Aporta `producto_unidades`, `producto_codigos_barra`, `combo_componentes`, columnas de unidad en líneas, `crear_factura` con `unidad_id`/combos y las RPC `pos_catalogo_productos`/`pos_buscar_por_codigo_barra`. **El POS no las redefine.**
2. **Migración del POS** (`<timestamp>_pos_motor.sql`, posterior a la fase 1 y a `20261124120000_config_dgii_rnc.sql`): tablas `pos_*`, extensiones, semillas, RPC, RLS, triggers, auditoría.
3. **`pnpm db:types`** después de aplicar en local/CI; commit de `src/lib/supabase/types.ts`.
4. **`docs/pruebas/reset-base-virgen.sql`** actualizado con las tres tablas, el `NOT EXISTS` de cuentas y la decisión de conservación de terminales.
5. **`supabase/tests/pos_test.sql`** y CI en verde.

Si la fase 1 no está en `main` cuando 2A empiece, la migración del POS debe esperar o incluir guards; no se debe duplicar `pos_catalogo_productos` ni la lógica de unidades/combos.

La NCF manual (`docs/dominio-ncf-manual.md`) es independiente: el POS no envía `ncf_manual` y sigue usando la numeración automática. Si esa fase se aplica antes, no cambia el contrato del POS.

### 8.2 Preflight (solo lectura, antes de aplicar)

En `prueba`, nunca contra producción desde el agente:

- Contar terminales activas por `cuenta_efectivo_id`; si hay duplicados, resolver antes del índice único.
- Verificar que las cuentas candidatas existan, estén activas y sean `es_caja_banco`.
- Verificar que las numeraciones de venta (01/02/14/15/16) estén activas y sin series duplicadas por tipo (la recomendación es una sola activa por tipo).
- Verificar que el contacto «Consumidor Final» exista o dejar que la semilla lo cree.
- Verificar que `config_contable` no tenga ya `sobrante_caja`/`faltante_caja` apuntando a cuentas raras.
- Verificar que exista al menos un almacén activo, una lista de precios activa y un centro de costo si se va a configurar.
- Revisar que no haya un turno abierto en la base antes de una migración (no aplica: las tablas son nuevas; pero sí antes de probar).
- Confirmar que la fase 1 de inventario está aplicada y que `crear_factura` acepta `unidad_id`.

### 8.3 Compatibilidad app/base

| App | Base | Resultado |
| --- | --- | --- |
| Vieja | Vieja | Comportamiento actual; el POS no existe. |
| Nueva | Vieja | El dashboard sigue igual; las pantallas POS detectan que faltan las tablas/RPC y muestran «POS no instalado»; no rompen Contabilidad. |
| Vieja | Nueva | La app vieja ignora las tablas/columnas; las facturas/cotizaciones/notas existentes quedan con los defaults (`contabilidad`, `credito_factura`); Contabilidad funciona igual. |
| Nueva | Nueva | POS completo. |

- La detección de capacidad es por la presencia de `pos_terminales`/RPC, no por una variable de entorno. No se agrega un feature flag de entorno.
- El ítem del menú POS solo se muestra si la migración está aplicada; si no, se oculta o la pantalla muestra el estado de instalación.
- Los reportes existentes no cambian: las facturas POS son facturas reales y aparecen en 607, CxC y libros. Si un reporte quiere separar POS/Contabilidad, filtra por `origen`.

### 8.4 Rollback

- **Código:** volver al deploy anterior. Las rutas `/pos` desaparecen; las facturas POS siguen siendo facturas válidas y se ven en Ingresos → Facturas. No se borra nada.
- **Migración:** no se borran columnas ni tablas. Son aditivas. Si hay que revertir una función, se hace con una migración nueva que restaure la definición anterior; nunca editando una migración aplicada.
- **Datos:** un turno mal cerrado no se reabre; se corrige con un movimiento nuevo o desde Contabilidad. Una venta se anula con el flujo existente. Una NC se revierte cuando exista la anulación de notas; hoy no se borra.
- **Terminales:** se desactivan, no se borran. Si se desactivó por error, se reactiva si no hay otra con el mismo cajón.
- **Semillas:** las cuentas de sobrante/faltante y el Consumidor Final quedan; son inofensivas. No se eliminan en un rollback.

### 8.5 Qué debe aprobar Waldy / Contable antes de aplicar

- [ ] **Waldy:** el alcance (solo Vender/Turnos/Historial/Devoluciones; Inventario y Configuración en Contabilidad).
- [ ] **Waldy:** cajón único por terminal activa y cuentas de tarjeta/transferencia distintas del cajón.
- [ ] **Waldy:** no permitir retiros/devoluciones que dejen la caja en negativo.
- [ ] **Waldy:** bloqueo de crédito a Consumidor Final y enforcement del límite de crédito solo en el POS.
- [ ] **Waldy:** reembolso en efectivo del POS solo desde la cuenta de efectivo de la terminal (reembolsos bancarios desde Contabilidad).
- [ ] **Waldy:** permitir devolver desde el POS una factura de Contabilidad (no solo ventas POS) o restringirlo a las ventas del POS.
- [ ] **Waldy:** permitir cotizar sin turno abierto (la venta y la devolución sí lo exigen).
- [ ] **Waldy:** la semilla de Consumidor Final (`22222222222`) y el nombre/código de las cuentas de sobrante/faltante.
- [ ] **Waldy:** la decisión de conservar `pos_terminales` en el reset (respaldo/restauración) vs. clasificarla como transaccional.
- [ ] **Contable:** asientos de venta, pago, gasto menor, ingreso/retiro, depósito, devolución, reembolso y diferencia.
- [ ] **Contable:** tratamiento del crédito a factura vs. efectivo en la devolución combinada y el saldo a favor del cliente.
- [ ] **Contable:** cuentas de sobrante/faltante y su clasificación DGII (o dejarlas sin clasificar).
- [ ] **Coder:** orden de migraciones (fase 1 primero), pgTAP, `types.ts`, reset y CI.
- [ ] **Waldy:** aplicar en `prueba` y, después de la prueba, en producción.

---

## 9. Consumo desde la app (2B / 2C / 2D)

### 9.1 Capa TS (2B)

- `src/lib/pos/tipos.ts`: `TerminalPos`, `TurnoPos`, `MovimientoTurnoPos`, `VentaPos`, `LineaPos`, `PagoPos`, `CotizacionPos`, `DevolucionPos`, `ResumenTurnoPos`, `PlantillaTicket`, `MetodoPagoPos`.
- `src/lib/pos/validacion.ts`: esquemas Zod de todos los payloads; `p` se valida antes de la RPC.
- `src/lib/pos/consultas.ts`: terminales, turno actual, resumen, historial POS paginado, detalle de venta, cotizaciones abiertas, notas POS. Usar `paginarConsulta`/`consultarEnLotes`; nada de topes de 300/500/1,000.
- `src/lib/pos/acciones.ts`: server actions que llaman `supabase.rpc("pos_...", { p })` **directo** (nunca guardar la RPC en una variable ni convertirla con `as`), revalidan las rutas y devuelven los errores en español.
- `src/lib/pos/ticket.ts`: helpers de presentación (ancho, estilos, toggles, formateo de montos/fechas), sin lógica contable.
- Tests Vitest por módulo, incluidos los candados de RPC directa y paginación.

### 9.2 Rutas y UI

- `src/app/(pos)/pos/layout.tsx`: layout propio sin sidebar de Contabilidad; header con marca, selector de terminal (`Select`/`Combobox`), estado del turno, usuario y «Volver a Contabilidad». Tema claro/oscuro.
- `src/app/(pos)/pos/page.tsx`: Vender. Dos columnas: catálogo (buscador + escáner + filtros + favoritos + grid de tarjetas) y panel de factura fijo (lista de precio, numeración, cliente, líneas, totales, botón Vender). Pestañas de ventas paralelas en el cliente; no hay borradores en la BD. Venta simple (F4) y «Guardar cotización»/«Cargar cotización».
- `src/app/(pos)/pos/turnos/page.tsx`: turno en curso (resumen, ingresos/retiros, cerrar) e historial de cierres con ticket.
- `src/app/(pos)/pos/historial/page.tsx`: facturas `origen='pos'`, filtros, detalle, pagos, NC, ticket y PDF Carta. Si es una tabla, usa `TablaLista`; si es una lista de tarjetas, usa `EsqueletoTabla` para la carga. En ambos casos, paginación por lotes.
- `src/app/(pos)/pos/devoluciones/page.tsx`: lista de NC POS + wizard de 3 pasos (tipo, productos/cliente, detalle) con las dos columnas de efectivo/crédito en combinado.
- `src/app/(main)/dashboard/configuracion/pos/page.tsx`: lista de terminales y formulario; `EncabezadoPagina` + migas + `TablaLista`; editor de plantilla con vista previa en vivo y «Imprimir prueba».
- `src/app/(main)/dashboard/configuracion/page.tsx`: tarjeta «Punto de venta».
- `src/navigation/sidebar/sidebar-items.ts`: ítem «Punto de venta» (`newTab: true`, `/pos`, roles admin/contador).
- `src/lib/diseno-paginas.test.ts`: agregar `configuracion/pos/page.tsx` a `PAGINAS_MIGRADAS` si aplica.
- `src/lib/tablas-listas.test.ts`: agregar la lista de terminales si usa `TablaLista`.

**Reglas de UI obligatorias:**

- `Select`/`SelectCampo`/`Combobox` de `components/ui`; nunca `<select>` ni `NativeSelect` fuera de `components/ui`.
- `DatePicker`/`DatePickerCampo`; nunca `<input type="date">`.
- `InputGroup` para montos/campos compuestos; `Switch` para toggles; `Button`, `Card`, `Badge`, `Tabs`, `Dialog`, `Sheet` de shadcn/Base UI.
- Colores solo tokens; nada de teal ni hex.
- Montos a la derecha, `tabular-nums`, `es-DO`; fechas/horas en `America/Santo_Domingo`.
- El POS es denso y rápido: el checkout no abandona la pantalla; el panel de factura no hace scroll con el catálogo; el escáner mantiene el foco.
- Responsive: 2 columnas ≥ 1024 px; en tablet/móvil se apila y el panel de factura se abre como sheet. Capturas claro/oscuro y móvil.
- El estado del carrito y las pestañas paralelas son del cliente; al confirmar, el servidor manda. No hay carrito persistido ni offline.

### 9.3 Archivos que se tocarían

**2A (BD):**

- `supabase/migrations/<timestamp>_pos_motor.sql` (nuevo).
- `docs/pruebas/reset-base-virgen.sql` (clasificación + guardas).
- `supabase/tests/pos_test.sql` (nuevo).
- `src/lib/supabase/types.ts` (regenerado).
- `docs/dominio-pos.md` (este archivo).

**2B (TS):**

- `src/lib/pos/tipos.ts`, `validacion.ts`, `consultas.ts`, `acciones.ts`, `ticket.ts`, tests.

**2C (configuración + sidebar):**

- `src/app/(main)/dashboard/configuracion/pos/page.tsx` y `_components/`.
- `src/app/(main)/dashboard/configuracion/page.tsx` (tarjeta).
- `src/navigation/sidebar/sidebar-items.ts`.
- `src/lib/diseno-paginas.test.ts`, `src/lib/tablas-listas.test.ts` (si aplica).

**2D (UI POS):**

- `src/app/(pos)/pos/layout.tsx`, `page.tsx`, `turnos/page.tsx`, `historial/page.tsx`, `devoluciones/page.tsx`, `_components/`.
- `src/components/pos/ticket-pos.tsx` y componentes de ticket/cierre/recibo.
- Reutiliza `DocumentoPapel` y `plantillas_impresion` para el PDF Carta.

No se toca `src/components/ui`, `package.json` (sin dependencias nuevas), ni migraciones aplicadas.

---

## 10. Lo que no hace esta fase y pendientes

- **No** implementa e-CF/DGII, NCF manual, offline, multi-empresa, multi-sucursal, rol cajero, propinas/restaurante, báscula, promociones, puntos, ni impresión ESC/POS directa.
- **No** anula notas de crédito de venta; cuando se implemente, debe revertir el asiento de la NC y el del reembolso en efectivo.
- **No** permite editar una venta POS: se anula desde Contabilidad con el flujo existente.
- **No** crea una terminal por defecto: la configura Waldy.
- **No** agrega `metodo_pos` a `pagos_recibidos`: el historial muestra el método por la cuenta; la respuesta inmediata de la venta sí devuelve `metodo_pos`.
- **No** permite reembolsos bancarios desde el POS: solo efectivo (cajón de la terminal) o crédito a factura.
- **No** duplica inventario ni configuración dentro del POS.
- Pendientes de decisión: conservación de terminales en el reset, cajón único, cuentas de tarjeta/transferencia distintas del cajón, tope de retiros/devoluciones por efectivo disponible, semilla de Consumidor Final, devolución de facturas de Contabilidad desde el POS, cotización sin turno y clasificación DGII de sobrante/faltante (ver §8.5).

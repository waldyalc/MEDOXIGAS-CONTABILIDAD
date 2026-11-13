# Contrato de base de datos — Beta 1 (motor contable)

Fuente de verdad para TODAS las tareas de la beta. La tarea A lo implementa en
`supabase/migrations/20261113140000_motor_contable.sql`; las pantallas (B, C, D) lo usan tal cual.
Todo en `public`, ids `uuid default gen_random_uuid()`, dinero `numeric(14,2)`, fechas `date`,
`creado_en timestamptz default now()`, `creado_por uuid default auth.uid()`.

## Roles
- `public.rol_actual() returns text` (security definer, stable, `search_path=''`): rol del usuario en `perfiles` o null.
- Lectura: toda tabla tiene RLS; `select` para `authenticated` si `rol_actual() is not null`. `anon` nada.
- Escritura: NADIE escribe directo en tablas (revoke insert/update/delete). Solo por RPC security definer
  que exigen `rol_actual() in ('admin','contador')` (si no: `raise exception 'sin permiso' using errcode='42501'`).
- No hay DELETE de documentos: se anulan (`anular_documento`).

## Tablas
- `empresa` (fila única `id int primary key default 1 check (id=1)`): nombre, rnc, direccion, telefono, correo, logo_url. Seed: `MEDOXIGAS ALC, SRL`.
- `cuentas`: id, codigo text unique, nombre, tipo text check in ('activo','pasivo','capital','ingreso','costo','gasto'),
  naturaleza text check in ('debito','credito'), padre_id uuid null → cuentas, acepta_movimientos bool default true,
  es_caja_banco bool default false, activa bool default true.
- `config_contable`: clave text primary key, cuenta_id uuid not null → cuentas. Claves:
  `caja, banco, caja_chica, cxc, inventario, itbis_adelantado, cxp, itbis_por_pagar, ventas, ventas_servicios, costo_ventas, gastos_generales`.
- `contactos`: id, tipo text check in ('cliente','proveedor','ambos') default 'cliente', nombre not null, rnc_cedula, telefono,
  correo, direccion, cuenta_cxc_id null, cuenta_cxp_id null, activo bool default true, creado_en.
- `productos`: id, tipo text check in ('producto','servicio') default 'producto', nombre not null, referencia, descripcion,
  precio numeric(14,2) default 0, itbis_tasa numeric(5,2) default 18 (valores 0, 16 o 18), inventariable bool default false,
  cantidad numeric(14,2) default 0, costo numeric(14,2) default 0 (costo promedio),
  cuenta_ingreso_id null, cuenta_costo_id null, cuenta_inventario_id null (null = usa config_contable), activo bool default true, creado_en.
- `numeraciones`: id, tipo_comprobante text ('01' crédito fiscal, '02' consumo, '13' gastos menores), nombre,
  prefijo text ('B01','B02','B13'), siguiente int default 1, hasta int, vence date null, activa bool.
  Seed: 01→B01, 02→B02 y 13→B13, hasta 100000. NCF = prefijo || lpad(siguiente,8,'0').
- `facturas`: id, numero int unique (secuencia interna), tipo_comprobante text, ncf text unique, contacto_id not null, fecha, vencimiento,
  subtotal, descuento, itbis, total, pagado numeric(14,2) default 0, estado text check in ('abierta','pagada','anulada'),
  notas, terminos, pie, asiento_id null, creado_por, creado_en.
- `factura_lineas`: id, factura_id, producto_id null, descripcion, cantidad numeric(14,2), precio, descuento_pct numeric(5,2) default 0,
  itbis_tasa numeric(5,2), subtotal (cantidad*precio - descuento), itbis, total, costo_unitario numeric(14,2) default 0.
- `pagos_recibidos`: id, numero int unique, contacto_id, factura_id null, fecha, cuenta_id (caja o banco), metodo text
  ('efectivo','transferencia','tarjeta','cheque'), monto, estado ('activo','anulado'), notas, asiento_id, creado_por, creado_en.
- `facturas_proveedor`: id, numero int unique, ncf text null, contacto_id, fecha, vencimiento, subtotal, itbis, total,
  pagado default 0, estado ('abierta','pagada','anulada'), notas, asiento_id, creado_por, creado_en.
- `facturas_proveedor_lineas`: id, factura_proveedor_id, producto_id null, cuenta_id null (cuenta de gasto si no hay producto),
  descripcion, cantidad, costo, itbis_tasa, subtotal, itbis, total.
- `pagos_proveedor`: igual que pagos_recibidos pero con factura_proveedor_id.
- `gastos_menores`: id, numero int unique, ncf text unique null, fecha, contacto_id null, cuenta_gasto_id (default gastos_generales),
  cuenta_pago_id (default caja_chica), descripcion not null, subtotal, itbis_tasa default 0, itbis, total, estado ('activo','anulado'), asiento_id, creado_por, creado_en.
- `asientos`: id, numero int unique, fecha, descripcion, origen_tipo text check in
  ('factura','pago_recibido','factura_proveedor','pago_proveedor','gasto_menor','manual','anulacion'),
  origen_id uuid null, anula_asiento_id uuid null, total numeric(14,2), creado_por, creado_en.
- `asiento_lineas`: id, asiento_id on delete cascade, cuenta_id (debe aceptar movimientos), contacto_id null, descripcion,
  debito numeric(14,2) default 0 check >=0, credito numeric(14,2) default 0 check >=0, check (debito=0) <> (credito=0)... (exactamente uno > 0).
  Trigger de restricción DIFERIDO (`deferrable initially deferred`) por asiento: suma(debito)=suma(credito) y al menos 2 líneas; si no, error.
  Índices: (asiento_id), (cuenta_id), asientos(fecha).

## Catálogo semilla (codigo — nombre — tipo/naturaleza)
1 Activos · 11 Activos corrientes · 1101 Caja general (caja) · 1102 Banco principal (banco) · 1103 Cuentas por cobrar clientes (cxc) ·
1104 Inventario de mercancía (inventario) · 1105 ITBIS adelantado en compras (itbis_adelantado) · 1106 Caja chica (caja) ·
2 Pasivos · 21 Pasivos corrientes · 2101 Cuentas por pagar proveedores (cxp) · 2102 ITBIS por pagar (itbis_por_pagar) ·
3 Capital · 3101 Capital social · 3201 Resultados acumulados ·
4 Ingresos · 4101 Ventas de productos (ventas) · 4102 Ventas de servicios (ventas_servicios) ·
5 Costos · 5101 Costo de ventas (costo_ventas) ·
6 Gastos · 6101 Gastos generales (gastos_generales) · 6102 Gastos de caja menor · 6103 Combustible y transporte · 6104 Servicios (luz, agua, teléfono) ·
6105 Combustibles y lubricantes · 6106 Agua · 6107 Papelería y útiles de oficina.
Cuentas de 1 o 2 dígitos: `acepta_movimientos=false`. 1101, 1102 y 1106: `es_caja_banco=true`.

## RPC (todas security definer, `set search_path=''`, transaccionales, devuelven uuid del documento)
- `crear_contacto(p jsonb)`, `actualizar_contacto(p_id uuid, p jsonb)` — campos de `contactos`.
- `crear_producto(p jsonb)`, `actualizar_producto(p_id uuid, p jsonb)` — campos de `productos`.
- `crear_factura(p jsonb)`: `{tipo_comprobante, contacto_id, fecha, vencimiento, notas?, terminos?, pie?,
  lineas:[{producto_id?, descripcion?, cantidad, precio, descuento_pct?, itbis_tasa?}], pago?:{cuenta_id, metodo, monto, fecha?}}`.
  Calcula todo en el servidor (redondeo 2 decimales por línea), toma NCF de `numeraciones` con `for update`, guarda costo_unitario.
  Asiento: Dr CxC (total) / Cr Ventas por cuenta de ingreso del producto (subtotal neto) / Cr ITBIS por pagar (itbis);
  por cada línea inventariable: Dr Costo de ventas / Cr Inventario (cantidad*costo) y baja `productos.cantidad`.
  Si trae `pago`, llama a `registrar_pago_recibido` con esa factura.
- `registrar_pago_recibido(p jsonb)`: `{factura_id?, contacto_id?, fecha, cuenta_id, metodo, monto, notas?}`. Monto no puede pasar del saldo.
  Asiento: Dr caja/banco / Cr CxC. Actualiza `facturas.pagado` y estado ('pagada' si pagado=total).
- `crear_factura_proveedor(p jsonb)`: `{ncf?, contacto_id, fecha, vencimiento, notas?, lineas:[{producto_id? | cuenta_id?, descripcion?, cantidad, costo, itbis_tasa?}]}`.
  Asiento: Dr Inventario (producto inventariable: sube cantidad y recalcula costo promedio) o Dr cuenta de gasto / Dr ITBIS adelantado / Cr CxP.
- `registrar_pago_proveedor(p jsonb)`: `{factura_proveedor_id, fecha, cuenta_id, metodo, monto}`. Asiento: Dr CxP / Cr caja/banco.
- `crear_gasto_menor(p jsonb)`: `{fecha, descripcion, subtotal, itbis_tasa?, cuenta_gasto_id?, cuenta_pago_id?, contacto_id?}`.
  Asigna NCF B13 de `numeraciones` '13' con `for update`. Defaults: cuenta de gasto 6101 (`gastos_generales`) y cuenta de pago
  1106 (`caja_chica`). Valida que la cuenta de gasto sea de detalle (tipo gasto/costo, `acepta_movimientos`) y que la de pago sea
  `es_caja_banco`. Asiento: Dr gasto (subtotal) / Dr ITBIS adelantado (itbis) / Cr caja chica (total).
- `anular_documento(p_tipo text, p_id uuid)`: p_tipo ∈ origen_tipo de documentos. Crea asiento 'anulacion' con débitos y créditos
  invertidos (`anula_asiento_id`), marca el documento anulado, revierte inventario y saldos (`pagado`). Una factura con pagos activos no se anula (error claro).

## Reportes (funciones `stable`, security invoker, respetan RLS)
- `reporte_libro_diario(p_desde date, p_hasta date)` → asiento_numero, fecha, asiento_descripcion, origen_tipo, cuenta_codigo, cuenta_nombre, debito, credito.
- `reporte_balance_comprobacion(p_desde date, p_hasta date)` → cuenta_codigo, cuenta_nombre, tipo, debitos, creditos, saldo (según naturaleza).
- `reporte_estado_resultados(p_desde date, p_hasta date)` → tipo ('ingreso','costo','gasto'), cuenta_codigo, cuenta_nombre, monto.
- `reporte_cxc(p_fecha date)` → contacto_id, contacto_nombre, factura_id, numero, ncf, fecha, vencimiento, total, pagado, saldo, dias_vencida.

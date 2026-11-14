-- ---------------------------------------------------------------------------
-- S22 · Índices de lectura para navegación rápida
--
-- Solo agrega índices (CREATE INDEX IF NOT EXISTS); no toca datos ni políticas.
-- Cubren los listados y fichas que ordenan/filtran por estas columnas:
--   · listas: facturas por fecha/número, compras y pagos por fecha
--   · fichas de contacto: documentos y pagos por contacto + fecha
--   · listas de contactos/productos por nombre y activo
--   · tablas del documento: notas por factura + fecha
-- No se borran los índices de una sola columna que ya existían.
-- ---------------------------------------------------------------------------

-- Fichas de contacto: documento más reciente primero.
create index if not exists facturas_contacto_fecha_idx
  on public.facturas (contacto_id, fecha desc, numero desc);
create index if not exists facturas_proveedor_contacto_fecha_idx
  on public.facturas_proveedor (contacto_id, fecha desc, numero desc);
create index if not exists cotizaciones_contacto_fecha_idx
  on public.cotizaciones (contacto_id, fecha desc, numero desc);
create index if not exists remisiones_contacto_fecha_idx
  on public.remisiones (contacto_id, fecha desc, numero desc);
create index if not exists pagos_recibidos_contacto_fecha_idx
  on public.pagos_recibidos (contacto_id, fecha desc, numero desc);
create index if not exists pagos_proveedor_contacto_fecha_idx
  on public.pagos_proveedor (contacto_id, fecha desc, numero desc);

-- Listados generales ordenados por fecha y número.
create index if not exists facturas_proveedor_fecha_numero_idx
  on public.facturas_proveedor (fecha desc, numero desc);
create index if not exists pagos_recibidos_fecha_numero_idx
  on public.pagos_recibidos (fecha desc, numero desc);
create index if not exists pagos_proveedor_fecha_numero_idx
  on public.pagos_proveedor (fecha desc, numero desc);

-- Reportes de ventas por rango de fechas, ordenados por fecha y número.
create index if not exists facturas_fecha_numero_idx
  on public.facturas (fecha, numero);

-- Facturas abiertas de proveedor para el formulario de pagos.
create index if not exists facturas_proveedor_estado_vencimiento_idx
  on public.facturas_proveedor (estado, vencimiento);

-- Pestañas de la ficha de factura: notas por factura y fecha.
create index if not exists notas_credito_venta_factura_fecha_idx
  on public.notas_credito_venta (factura_id, fecha);
create index if not exists notas_debito_venta_factura_fecha_idx
  on public.notas_debito_venta (factura_id, fecha);
create index if not exists notas_credito_compra_factura_fecha_idx
  on public.notas_credito_compra (factura_proveedor_id, fecha);

-- Listados de contactos y productos (orden por nombre, filtros por activo).
create index if not exists contactos_nombre_idx on public.contactos (nombre);
create index if not exists contactos_tipo_activo_nombre_idx on public.contactos (tipo, activo, nombre);
create index if not exists productos_nombre_idx on public.productos (nombre);
create index if not exists productos_activo_nombre_idx on public.productos (activo, nombre);

-- Libro diario y movimientos por cuenta.
create index if not exists asientos_fecha_numero_idx on public.asientos (fecha, numero);
create index if not exists asiento_lineas_asiento_cuenta_idx on public.asiento_lineas (asiento_id, cuenta_id);

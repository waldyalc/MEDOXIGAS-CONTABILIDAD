begin;
select plan(27);

create temp table _dashboard_ids (clave text primary key, id uuid) on commit drop;
create temp table _dashboard_resumen (diario jsonb, mensual jsonb) on commit drop;
grant select, insert, update, delete on _dashboard_ids to authenticated;
grant select, insert, update, delete on _dashboard_resumen to authenticated;

insert into auth.users (id, email) values
  ('dddddddd-3333-3333-3333-333333333333', 'admin.dashboard@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('dddddddd-3333-3333-3333-333333333333', 'Admin Dashboard', 'admin');

set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-3333-3333-3333-333333333333","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Datos propios del test (fechas 2099 para no depender de otros documentos)
-- ---------------------------------------------------------------------------

insert into _dashboard_ids (clave, id)
select 'cliente_a', public.crear_contacto('{"tipo":"cliente","nombre":"Dashboard Cliente A"}'::jsonb);

insert into _dashboard_ids (clave, id)
select 'cliente_b', public.crear_contacto('{"tipo":"cliente","nombre":"Dashboard Cliente B"}'::jsonb);

insert into _dashboard_ids (clave, id)
select 'proveedor', public.crear_contacto('{"tipo":"proveedor","nombre":"Dashboard Proveedor"}'::jsonb);

insert into _dashboard_ids (clave, id)
select 'servicio', public.crear_producto(
  '{"tipo":"servicio","nombre":"Dashboard Servicio","precio":1000,"itbis_tasa":18}'::jsonb
);

insert into _dashboard_ids (clave, id)
select 'factura_vencida', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _dashboard_ids where clave = 'cliente_a'),
  'fecha', '2099-01-10',
  'vencimiento', '2099-01-20',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _dashboard_ids where clave = 'servicio'),
    'cantidad', 2,
    'precio', 1000
  ))
));

insert into _dashboard_ids (clave, id)
select 'factura_vigente', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _dashboard_ids where clave = 'cliente_a'),
  'fecha', '2099-01-15',
  'vencimiento', '2099-02-15',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _dashboard_ids where clave = 'servicio'),
    'cantidad', 1,
    'precio', 1000
  ))
));

insert into _dashboard_ids (clave, id)
select 'factura_pagada', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _dashboard_ids where clave = 'cliente_b'),
  'fecha', '2099-01-20',
  'vencimiento', '2099-01-25',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _dashboard_ids where clave = 'servicio'),
    'cantidad', 1,
    'precio', 1000
  ))
));

select public.registrar_pago_recibido(jsonb_build_object(
  'factura_id', (select id from _dashboard_ids where clave = 'factura_pagada'),
  'fecha', '2099-01-25',
  'cuenta_id', (select id from public.cuentas where codigo = '1101'),
  'metodo', 'efectivo',
  'monto', 1180
));

insert into _dashboard_ids (clave, id)
select 'factura_anulada', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _dashboard_ids where clave = 'cliente_b'),
  'fecha', '2099-01-22',
  'vencimiento', '2099-01-28',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _dashboard_ids where clave = 'servicio'),
    'cantidad', 3,
    'precio', 1000
  ))
));

select public.anular_documento('factura', (select id from _dashboard_ids where clave = 'factura_anulada'));

insert into _dashboard_ids (clave, id)
select 'factura_anio_anterior', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _dashboard_ids where clave = 'cliente_a'),
  'fecha', '2098-01-12',
  'vencimiento', '2098-02-12',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _dashboard_ids where clave = 'servicio'),
    'cantidad', 1,
    'precio', 1000
  ))
));

insert into _dashboard_ids (clave, id)
select 'factura_fuera', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _dashboard_ids where clave = 'cliente_a'),
  'fecha', '2099-02-05',
  'vencimiento', '2099-03-05',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _dashboard_ids where clave = 'servicio'),
    'cantidad', 1,
    'precio', 1000
  ))
));

select public.crear_nota_credito_venta(jsonb_build_object(
  'factura_id', (select id from _dashboard_ids where clave = 'factura_vencida'),
  'fecha', '2099-01-25',
  'lineas', jsonb_build_array(jsonb_build_object(
    'factura_linea_id', (
      select fl.id from public.factura_lineas fl
      where fl.factura_id = (select id from _dashboard_ids where clave = 'factura_vencida')
      limit 1
    ),
    'cantidad', 1
  ))
));

-- Cuentas por pagar: una vencida, una vigente, una pagada y una fuera del periodo.
insert into _dashboard_ids (clave, id)
select 'compra_vencida', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _dashboard_ids where clave = 'proveedor'),
  'fecha', '2099-01-08',
  'vencimiento', '2099-01-18',
  'lineas', jsonb_build_array(jsonb_build_object(
    'cuenta_id', (select id from public.cuentas where codigo = '6101'),
    'descripcion', 'Servicios vencidos',
    'cantidad', 1,
    'costo', 2000,
    'itbis_tasa', 18
  ))
));

insert into _dashboard_ids (clave, id)
select 'compra_vigente', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _dashboard_ids where clave = 'proveedor'),
  'fecha', '2099-01-12',
  'vencimiento', '2099-02-12',
  'lineas', jsonb_build_array(jsonb_build_object(
    'cuenta_id', (select id from public.cuentas where codigo = '6101'),
    'descripcion', 'Servicios vigentes',
    'cantidad', 1,
    'costo', 1000,
    'itbis_tasa', 18
  ))
));

insert into _dashboard_ids (clave, id)
select 'compra_pagada', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _dashboard_ids where clave = 'proveedor'),
  'fecha', '2099-01-14',
  'vencimiento', '2099-01-24',
  'lineas', jsonb_build_array(jsonb_build_object(
    'cuenta_id', (select id from public.cuentas where codigo = '6101'),
    'descripcion', 'Servicios pagados',
    'cantidad', 1,
    'costo', 500,
    'itbis_tasa', 18
  ))
));

select public.registrar_pago_proveedor(jsonb_build_object(
  'factura_proveedor_id', (select id from _dashboard_ids where clave = 'compra_pagada'),
  'fecha', '2099-01-24',
  'cuenta_id', (select id from public.cuentas where codigo = '1102'),
  'metodo', 'transferencia',
  'monto', 590
));

insert into _dashboard_ids (clave, id)
select 'compra_fuera', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _dashboard_ids where clave = 'proveedor'),
  'fecha', '2099-02-01',
  'vencimiento', '2099-03-01',
  'lineas', jsonb_build_array(jsonb_build_object(
    'cuenta_id', (select id from public.cuentas where codigo = '6101'),
    'descripcion', 'Servicios fuera del periodo',
    'cantidad', 1,
    'costo', 700,
    'itbis_tasa', 18
  ))
));

insert into _dashboard_resumen (diario, mensual)
values (
  public.dashboard_resumen('2099-01-01', '2099-01-31'),
  public.dashboard_resumen('2098-11-01', '2099-01-31')
);

-- ---------------------------------------------------------------------------
-- Forma y periodo
-- ---------------------------------------------------------------------------

select is(
  jsonb_typeof((select diario from _dashboard_resumen)),
  'object',
  'dashboard_resumen devuelve un objeto JSON'
);

select is(
  (select (diario->>'es_diario')::boolean from _dashboard_resumen),
  true,
  'un periodo de un solo mes usa serie diaria'
);

select is(
  (select jsonb_array_length(diario->'ventas'->'serie') from _dashboard_resumen),
  31,
  'la serie diaria cubre del día 1 al último día del periodo'
);

select is(
  (
    select sum((punto->>'actual')::numeric)
    from _dashboard_resumen r
    cross join jsonb_array_elements(r.diario->'ventas'->'serie') punto
  ),
  4720.00::numeric,
  'la serie diaria suma las ventas del periodo'
);

select is(
  (
    select (punto->>'actual')::numeric
    from _dashboard_resumen r
    cross join jsonb_array_elements(r.diario->'ventas'->'serie') punto
    where punto->>'etiqueta' = '2099-01-10'
  ),
  2360.00::numeric,
  'la serie diaria pone la venta en su día'
);

select is(
  (
    select (punto->>'anterior')::numeric
    from _dashboard_resumen r
    cross join jsonb_array_elements(r.diario->'ventas'->'serie') punto
    where punto->>'etiqueta' = '2099-01-12'
  ),
  1180.00::numeric,
  'la serie diaria trae el mismo día del año anterior'
);

-- ---------------------------------------------------------------------------
-- Cuentas por cobrar
-- ---------------------------------------------------------------------------

select is(
  (select (diario->'cxc'->>'total')::numeric from _dashboard_resumen),
  2360.00::numeric,
  'CxC suma el saldo pendiente del periodo'
);

select is(
  (select (diario->'cxc'->'vencidas'->>'monto')::numeric from _dashboard_resumen),
  1180.00::numeric,
  'CxC vencidas usa el saldo después de la nota de crédito'
);

select is(
  (select (diario->'cxc'->'vencidas'->>'documentos')::int from _dashboard_resumen),
  1,
  'CxC cuenta una factura vencida'
);

select is(
  (select (diario->'cxc'->'vigentes'->>'monto')::numeric from _dashboard_resumen),
  1180.00::numeric,
  'CxC vigentes suma la factura no vencida'
);

select is(
  (select (diario->'cxc'->'vigentes'->>'documentos')::int from _dashboard_resumen),
  1,
  'CxC cuenta una factura vigente'
);

-- ---------------------------------------------------------------------------
-- Cuentas por pagar
-- ---------------------------------------------------------------------------

select is(
  (select (diario->'cxp'->>'total')::numeric from _dashboard_resumen),
  3540.00::numeric,
  'CxP suma el saldo pendiente del periodo'
);

select is(
  (select (diario->'cxp'->'vencidas'->>'monto')::numeric from _dashboard_resumen),
  2360.00::numeric,
  'CxP vencidas suma la compra vencida'
);

select is(
  (select (diario->'cxp'->'vencidas'->>'documentos')::int from _dashboard_resumen),
  1,
  'CxP cuenta una compra vencida'
);

select is(
  (select (diario->'cxp'->'vigentes'->>'monto')::numeric from _dashboard_resumen),
  1180.00::numeric,
  'CxP vigentes suma la compra no vencida'
);

select is(
  (select (diario->'cxp'->'vigentes'->>'documentos')::int from _dashboard_resumen),
  1,
  'CxP cuenta una compra vigente'
);

-- ---------------------------------------------------------------------------
-- Tarjetas chicas y ventas
-- ---------------------------------------------------------------------------

select is(
  (select (diario->>'impuestos_venta')::numeric from _dashboard_resumen),
  720.00::numeric,
  'impuestos en venta suma el ITBIS de las facturas del periodo'
);

select is(
  (select (diario->>'productos_vendidos')::numeric from _dashboard_resumen),
  4.00::numeric,
  'productos vendidos suma unidades de las facturas no anuladas'
);

select is(
  (select (diario->>'devoluciones_clientes')::numeric from _dashboard_resumen),
  1180.00::numeric,
  'devoluciones de clientes suma las notas de crédito activas del periodo'
);

select is(
  (select (diario->>'clientes_con_ventas')::int from _dashboard_resumen),
  2,
  'clientes con ventas cuenta clientes distintos'
);

select is(
  (select (diario->'ventas'->>'total')::numeric from _dashboard_resumen),
  4720.00::numeric,
  'ventas del periodo suma facturas no anuladas con impuestos'
);

select is(
  (select (diario->'ventas'->>'anterior')::numeric from _dashboard_resumen),
  1180.00::numeric,
  'ventas del año anterior usa el mismo rango'
);

select is(
  (select (diario->'ventas'->>'variacion')::numeric from _dashboard_resumen),
  300.00::numeric,
  'la variación compara contra el mismo rango del año anterior'
);

-- ---------------------------------------------------------------------------
-- Serie mensual
-- ---------------------------------------------------------------------------

select is(
  (select (mensual->>'es_diario')::boolean from _dashboard_resumen),
  false,
  'un periodo de varios meses usa serie mensual'
);

select is(
  (select jsonb_array_length(mensual->'ventas'->'serie') from _dashboard_resumen),
  3,
  'la serie mensual tiene un punto por mes del periodo'
);

select is(
  (
    select (punto->>'actual')::numeric
    from _dashboard_resumen r
    cross join jsonb_array_elements(r.mensual->'ventas'->'serie') punto
    where punto->>'etiqueta' = '2099-01-01'
  ),
  4720.00::numeric,
  'la serie mensual agrupa las ventas por mes'
);

select is(
  (
    select (punto->>'anterior')::numeric
    from _dashboard_resumen r
    cross join jsonb_array_elements(r.mensual->'ventas'->'serie') punto
    where punto->>'etiqueta' = '2099-01-01'
  ),
  1180.00::numeric,
  'la serie mensual trae el mismo mes del año anterior'
);

select * from finish();
rollback;

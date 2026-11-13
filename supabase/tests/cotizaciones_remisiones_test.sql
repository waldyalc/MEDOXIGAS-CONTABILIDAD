begin;
select plan(40);

create temp table _ids (clave text primary key, id uuid) on commit drop;
create temp table _valores (clave text primary key, valor text) on commit drop;
grant select, insert, update, delete on _ids to authenticated;
grant select, insert, update, delete on _valores to authenticated;

alter sequence public.cotizaciones_numero_seq restart with 1;
alter sequence public.remisiones_numero_seq restart with 1;

select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.cotizaciones')), false), 'RLS activo en cotizaciones');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.cotizacion_lineas')), false), 'RLS activo en cotizacion_lineas');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.remisiones')), false), 'RLS activo en remisiones');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.remision_lineas')), false), 'RLS activo en remision_lineas');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local'),
  ('22222222-2222-2222-2222-222222222222', 'contador@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector@prueba.local');
insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Contador', 'contador'),
  ('33333333-3333-3333-3333-333333333333', 'Lector', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id)
select 'contacto', public.crear_contacto(jsonb_build_object(
  'tipo', 'cliente',
  'nombre', 'Cotiza Cliente'
));

insert into _ids (clave, id)
select 'producto', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Cotiza Producto',
  'precio', 650.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'inventariable', true,
  'cantidad', 10.00::numeric,
  'costo', 390.00::numeric
));

insert into _valores (clave, valor)
select 'asientos_antes', count(*)::text from public.asientos;

insert into _ids (clave, id)
select 'cotizacion', public.crear_cotizacion(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-11-20',
  'notas', 'Cotización de prueba',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'producto'),
      'cantidad', 2.00::numeric
    )
  )
));

select is(
  (select numero from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  1,
  'número de la primera cotización es 1'
);

select is(
  (select estado from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  'abierta',
  'cotización nace abierta'
);

select is(
  (select subtotal::numeric(14,2) from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  1300.00::numeric(14,2),
  'subtotal de la cotización'
);

select is(
  (select descuento::numeric(14,2) from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  0.00::numeric(14,2),
  'descuento de la cotización'
);

select is(
  (select itbis::numeric(14,2) from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  234.00::numeric(14,2),
  'itbis de la cotización'
);

select is(
  (select total::numeric(14,2) from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  1534.00::numeric(14,2),
  'total de la cotización'
);

select is(
  (select precio::numeric(14,2)
   from public.cotizacion_lineas
   where cotizacion_id = (select id from _ids where clave = 'cotizacion')),
  650.00::numeric(14,2),
  'precio de la línea tomado del producto'
);

select is(
  (select itbis_tasa::numeric(5,2)
   from public.cotizacion_lineas
   where cotizacion_id = (select id from _ids where clave = 'cotizacion')),
  18.00::numeric(5,2),
  'ITBIS de la línea tomado del producto'
);

select is(
  (select total::numeric(14,2)
   from public.cotizacion_lineas
   where cotizacion_id = (select id from _ids where clave = 'cotizacion')),
  1534.00::numeric(14,2),
  'total de la línea de la cotización'
);

select is(
  (select count(*)::int from public.asientos),
  (select valor::int from _valores where clave = 'asientos_antes'),
  'la cotización no genera asiento'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where id = (select id from _ids where clave = 'producto')),
  10.00::numeric(14,2),
  'la cotización no mueve inventario'
);

insert into _ids (clave, id)
select 'factura_cotizacion', public.convertir_a_factura(jsonb_build_object(
  'tipo', 'cotizacion',
  'id', (select id from _ids where clave = 'cotizacion'),
  'tipo_comprobante', '02'
));

select is(
  (select tipo_comprobante from public.facturas where id = (select id from _ids where clave = 'factura_cotizacion')),
  '02',
  'la factura convertida usa el comprobante indicado'
);

select is(
  (select total::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura_cotizacion')),
  1534.00::numeric(14,2),
  'la factura convertida conserva el total'
);

select is(
  (select fl.producto_id
   from public.factura_lineas fl
   where fl.factura_id = (select id from _ids where clave = 'factura_cotizacion')),
  (select id from _ids where clave = 'producto'),
  'la factura convertida conserva el producto de la línea'
);

select is(
  (select cantidad::numeric(14,2)
   from public.factura_lineas
   where factura_id = (select id from _ids where clave = 'factura_cotizacion')),
  2.00::numeric(14,2),
  'la factura convertida conserva la cantidad de la línea'
);

select is(
  (select estado from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  'convertida',
  'la cotización queda convertida'
);

select is(
  (select factura_id from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  (select id from _ids where clave = 'factura_cotizacion'),
  'la cotización apunta a la factura creada'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where id = (select id from _ids where clave = 'producto')),
  8.00::numeric(14,2),
  'convertir a factura descuenta el inventario como crear_factura'
);

select is(
  (select count(*)::int from public.asientos),
  (select valor::int from _valores where clave = 'asientos_antes') + 1,
  'la factura convertida genera su asiento'
);

select throws_ok(
  format(
    'select public.convertir_a_factura(%L::jsonb)',
    jsonb_build_object(
      'tipo', 'cotizacion',
      'id', (select id from _ids where clave = 'cotizacion'),
      'tipo_comprobante', '02'
    )::text
  ),
  '22023',
  null,
  'una cotización convertida no se vuelve a convertir'
);

insert into _ids (clave, id)
select 'remision', public.crear_remision(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-13',
  'notas', 'Conduce de prueba',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'producto'),
      'cantidad', 5.00::numeric
    )
  )
));

select is(
  (select numero from public.remisiones where id = (select id from _ids where clave = 'remision')),
  1,
  'número de la primera remisión es 1'
);

select is(
  (select subtotal::numeric(14,2) from public.remisiones where id = (select id from _ids where clave = 'remision')),
  3250.00::numeric(14,2),
  'subtotal de la remisión'
);

select is(
  (select itbis::numeric(14,2) from public.remisiones where id = (select id from _ids where clave = 'remision')),
  585.00::numeric(14,2),
  'itbis de la remisión'
);

select is(
  (select total::numeric(14,2) from public.remisiones where id = (select id from _ids where clave = 'remision')),
  3835.00::numeric(14,2),
  'total de la remisión'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where id = (select id from _ids where clave = 'producto')),
  8.00::numeric(14,2),
  'la remisión no baja el inventario'
);

select is(
  (select count(*)::int from public.asientos),
  (select valor::int from _valores where clave = 'asientos_antes') + 1,
  'la remisión no genera asiento'
);

insert into _ids (clave, id)
select 'factura_remision', public.convertir_a_factura(jsonb_build_object(
  'tipo', 'remision',
  'id', (select id from _ids where clave = 'remision'),
  'tipo_comprobante', '01'
));

select is(
  (select tipo_comprobante from public.facturas where id = (select id from _ids where clave = 'factura_remision')),
  '01',
  'la remisión se convierte con comprobante 01'
);

select is(
  (select total::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura_remision')),
  3835.00::numeric(14,2),
  'la factura de la remisión conserva el total'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where id = (select id from _ids where clave = 'producto')),
  3.00::numeric(14,2),
  'convertir la remisión a factura descuenta el inventario'
);

select ok(
  exists(
    select 1
    from public.asientos a
    where a.id = (select asiento_id from public.facturas where id = (select id from _ids where clave = 'factura_remision'))
      and a.origen_tipo = 'factura'
  ),
  'la factura de la remisión genera asiento de factura'
);

select is(
  (select estado from public.remisiones where id = (select id from _ids where clave = 'remision')),
  'convertida',
  'la remisión queda convertida'
);

select is(
  (select factura_id from public.remisiones where id = (select id from _ids where clave = 'remision')),
  (select id from _ids where clave = 'factura_remision'),
  'la remisión apunta a la factura creada'
);

select throws_ok(
  $q$insert into public.cotizaciones (contacto_id, vencimiento) values ((select id from _ids where clave = 'contacto'), '2026-11-13')$q$,
  '42501',
  null,
  'authenticated no escribe cotizaciones directo'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  $q$select public.crear_cotizacion('{"contacto_id":"00000000-0000-0000-0000-000000000000","lineas":[]}'::jsonb)$q$,
  '42501',
  null,
  'lector no puede crear cotizaciones'
);

select throws_ok(
  $q$select public.crear_remision('{"contacto_id":"00000000-0000-0000-0000-000000000000","lineas":[]}'::jsonb)$q$,
  '42501',
  null,
  'lector no puede crear remisiones'
);

select throws_ok(
  $q$select public.convertir_a_factura('{"tipo":"cotizacion","id":"00000000-0000-0000-0000-000000000000"}'::jsonb)$q$,
  '42501',
  null,
  'lector no puede convertir documentos'
);

select * from finish();
rollback;

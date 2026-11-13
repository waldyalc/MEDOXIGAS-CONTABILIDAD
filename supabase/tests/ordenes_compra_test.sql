begin;
select plan(11);

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector@prueba.local');
insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin'),
  ('33333333-3333-3333-3333-333333333333', 'Lector', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id)
select 'contacto', public.crear_contacto(jsonb_build_object(
  'tipo', 'proveedor',
  'nombre', 'Proveedor Orden'
));

insert into _ids (clave, id)
select 'producto', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Producto Orden',
  'precio', 650.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'inventariable', true,
  'cantidad', 10.00::numeric,
  'costo', 300.00::numeric
));

insert into _ids (clave, id)
select 'orden', public.crear_orden_compra(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-14',
  'fecha_entrega', '2026-11-20',
  'notas', 'Orden de prueba',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 5.00::numeric,
    'costo', 400.00::numeric,
    'itbis_tasa', 18.00::numeric
  ))
));

select is(
  (select subtotal::numeric(14,2) from public.ordenes_compra where id = (select id from _ids where clave = 'orden')),
  2000.00::numeric(14,2),
  'orden de compra: subtotal 2000.00'
);

select is(
  (select itbis::numeric(14,2) from public.ordenes_compra where id = (select id from _ids where clave = 'orden')),
  360.00::numeric(14,2),
  'orden de compra: ITBIS 360.00'
);

select is(
  (select total::numeric(14,2) from public.ordenes_compra where id = (select id from _ids where clave = 'orden')),
  2360.00::numeric(14,2),
  'orden de compra: total 2360.00'
);

select is(
  (select count(*)::int from public.orden_compra_lineas where orden_id = (select id from _ids where clave = 'orden')),
  1,
  'orden de compra: una línea'
);

select is(
  (select count(*)::int from public.asientos),
  0,
  'la orden de compra no genera asiento'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where id = (select id from _ids where clave = 'producto')),
  10.00::numeric(14,2),
  'la orden de compra no mueve inventario'
);

insert into _ids (clave, id)
select 'factura', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-14',
  'vencimiento', '2026-12-14',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 5.00::numeric,
    'costo', 400.00::numeric,
    'itbis_tasa', 18.00::numeric
  ))
));

select is(
  public.vincular_orden_compra(
    (select id from _ids where clave = 'orden'),
    (select id from _ids where clave = 'factura')
  ),
  (select id from _ids where clave = 'orden'),
  'vincular_orden_compra devuelve la orden'
);

select is(
  (select estado from public.ordenes_compra where id = (select id from _ids where clave = 'orden')),
  'convertida',
  'la orden queda convertida'
);

select is(
  (select factura_proveedor_id from public.ordenes_compra where id = (select id from _ids where clave = 'orden')),
  (select id from _ids where clave = 'factura'),
  'la orden guarda la factura de proveedor'
);

insert into _ids (clave, id)
select 'factura2', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-14',
  'vencimiento', '2026-12-14',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 1.00::numeric,
    'costo', 400.00::numeric,
    'itbis_tasa', 18.00::numeric
  ))
));

select throws_ok(
  $q$select public.vincular_orden_compra(
    (select id from _ids where clave = 'orden'),
    (select id from _ids where clave = 'factura2')
  )$q$,
  null,
  null,
  'no se puede convertir la orden en una segunda factura'
);

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  $q$select public.crear_orden_compra('{}'::jsonb)$q$,
  '42501',
  null,
  'lector no puede crear órdenes de compra'
);

select * from finish();
rollback;

begin;
select plan(18);

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

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
select 'proveedor', public.crear_contacto(
  '{"tipo":"proveedor","nombre":"Proveedor Anula Costo"}'::jsonb
);

insert into _ids (clave, id)
select 'cliente', public.crear_contacto(
  '{"tipo":"cliente","nombre":"Cliente Anula Costo"}'::jsonb
);

insert into _ids (clave, id)
select 'producto1', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Costo Promedio 1',
  'precio', 650.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'inventariable', true,
  'cantidad', 50.00::numeric,
  'costo', 300.00::numeric
));

insert into _ids (clave, id)
select 'compra1', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'proveedor'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'producto1'),
      'cantidad', 100.00::numeric,
      'costo', 390.00::numeric
    )
  )
));

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'producto1')),
  150.00::numeric(14,2),
  'compra: cantidad sube a 150'
);

select is(
  (select costo from public.productos where id = (select id from _ids where clave = 'producto1')),
  360.00::numeric(14,2),
  'compra: costo promedio ponderado = 360.00'
);

select public.anular_documento('factura_proveedor', (select id from _ids where clave = 'compra1'));

select ok(
  exists(
    select 1
    from public.asientos a
    where a.origen_tipo = 'anulacion'
      and a.anula_asiento_id = (
        select asiento_id from public.facturas_proveedor
        where id = (select id from _ids where clave = 'compra1')
      )
  ),
  'anulación de compra: asiento de reversión intacto'
);

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'producto1')),
  50.00::numeric(14,2),
  'anulación: cantidad vuelve a 50'
);

select is(
  (select costo from public.productos where id = (select id from _ids where clave = 'producto1')),
  300.00::numeric(14,2),
  'anulación: costo vuelve a 300.00'
);

insert into _ids (clave, id)
select 'producto2', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Costo Promedio 2',
  'precio', 650.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'inventariable', true,
  'cantidad', 0.00::numeric,
  'costo', 0.00::numeric
));

insert into _ids (clave, id)
select 'compra2', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'proveedor'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'producto2'),
      'cantidad', 10.00::numeric,
      'costo', 200.00::numeric
    )
  )
));

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'producto2')),
  10.00::numeric(14,2),
  'compra desde cero: cantidad 10'
);

select is(
  (select costo from public.productos where id = (select id from _ids where clave = 'producto2')),
  200.00::numeric(14,2),
  'compra desde cero: costo 200.00'
);

select public.anular_documento('factura_proveedor', (select id from _ids where clave = 'compra2'));

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'producto2')),
  0.00::numeric(14,2),
  'anulación desde cero: cantidad 0'
);

select is(
  (select costo from public.productos where id = (select id from _ids where clave = 'producto2')),
  0.00::numeric(14,2),
  'anulación desde cero: costo 0'
);

insert into _ids (clave, id)
select 'producto3', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Costo Venta',
  'precio', 650.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'inventariable', true,
  'cantidad', 50.00::numeric,
  'costo', 300.00::numeric
));

insert into _ids (clave, id)
select 'venta1', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'cliente'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'producto3'),
      'cantidad', 5.00::numeric,
      'precio', 650.00::numeric
    )
  )
));

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'producto3')),
  45.00::numeric(14,2),
  'venta: cantidad baja a 45'
);

select is(
  (select costo from public.productos where id = (select id from _ids where clave = 'producto3')),
  300.00::numeric(14,2),
  'venta: el costo no cambia'
);

select public.anular_documento('factura', (select id from _ids where clave = 'venta1'));

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'producto3')),
  50.00::numeric(14,2),
  'anulación de venta: solo devuelve la cantidad'
);

select is(
  (select costo from public.productos where id = (select id from _ids where clave = 'producto3')),
  300.00::numeric(14,2),
  'anulación de venta: el costo sigue igual'
);

insert into _ids (clave, id)
select 'producto4', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Costo Compra Pagada',
  'precio', 650.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'inventariable', true,
  'cantidad', 0.00::numeric,
  'costo', 0.00::numeric
));

insert into _ids (clave, id)
select 'compra_pagada', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'proveedor'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'producto4'),
      'cantidad', 4.00::numeric,
      'costo', 100.00::numeric
    )
  )
));

select public.registrar_pago_proveedor(jsonb_build_object(
  'factura_proveedor_id', (select id from _ids where clave = 'compra_pagada'),
  'fecha', '2026-11-13',
  'cuenta_id', (select id from public.cuentas where codigo = '1102'),
  'metodo', 'transferencia',
  'monto', 400.00::numeric
));

select throws_ok(
  $q$select public.anular_documento('factura_proveedor', (select id from _ids where clave = 'compra_pagada'))$q$,
  null,
  null,
  'compra con pago activo no se anula'
);

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'producto4')),
  4.00::numeric(14,2),
  'compra con pago activo: la cantidad no cambia'
);

select is(
  (select estado from public.facturas_proveedor where id = (select id from _ids where clave = 'compra_pagada')),
  'pagada',
  'compra con pago activo: sigue pagada'
);

insert into _ids (clave, id)
select 'producto5', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Costo Existencia Negativa',
  'precio', 650.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'inventariable', true,
  'cantidad', 5.00::numeric,
  'costo', 100.00::numeric
));

insert into _ids (clave, id)
select 'compra_negativa', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'proveedor'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'producto5'),
      'cantidad', 10.00::numeric,
      'costo', 200.00::numeric
    )
  )
));

select public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'cliente'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'producto5'),
      'cantidad', 7.00::numeric,
      'precio', 650.00::numeric
    )
  )
));

select public.anular_documento('factura_proveedor', (select id from _ids where clave = 'compra_negativa'));

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'producto5')),
  (-2.00)::numeric(14,2),
  'anulación con existencia insuficiente: resta la cantidad'
);

select is(
  (select costo from public.productos where id = (select id from _ids where clave = 'producto5')),
  166.67::numeric(14,2),
  'anulación con existencia insuficiente: conserva el costo vigente (promedio 166.67), no el original'
);

select * from finish();
rollback;

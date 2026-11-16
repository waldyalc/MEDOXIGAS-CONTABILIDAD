begin;
select plan(16);

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
select 'producto', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Costo ajuste anulación pgTAP',
  'precio', 650.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'inventariable', true,
  'cantidad', 10.00::numeric,
  'costo', 100.00::numeric
));

-- Entrada 1: 10 unidades a 200.00 -> promedio (10*100 + 10*200) / 20 = 150.00
insert into _ids (clave, id)
select 'entrada1', public.crear_ajuste_inventario(jsonb_build_object(
  'fecha', '2026-11-17',
  'almacen_id', (select id from public.almacenes where es_principal),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'tipo', 'entrada',
    'cantidad', 10.00::numeric,
    'costo_unitario', 200.00::numeric
  ))
));

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'producto')),
  20.00::numeric(14,2),
  'entrada: la cantidad sube de 10 a 20'
);

select is(
  (select costo from public.productos where id = (select id from _ids where clave = 'producto')),
  150.00::numeric(14,2),
  'entrada: el costo promedio ponderado pasa a 150.00'
);

-- Entrada 2: 10 unidades a 60.00 -> promedio (20*150 + 10*60) / 30 = 120.00
insert into _ids (clave, id)
select 'entrada2', public.crear_ajuste_inventario(jsonb_build_object(
  'fecha', '2026-11-17',
  'almacen_id', (select id from public.almacenes where es_principal),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'tipo', 'entrada',
    'cantidad', 10.00::numeric,
    'costo_unitario', 60.00::numeric
  ))
));

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'producto')),
  30.00::numeric(14,2),
  'segunda entrada: la cantidad sube a 30'
);

select is(
  (select costo from public.productos where id = (select id from _ids where clave = 'producto')),
  120.00::numeric(14,2),
  'segunda entrada: el costo promedio pasa a 120.00'
);

select public.anular_documento(
  'ajuste_inventario',
  (select id from _ids where clave = 'entrada2')
);

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'producto')),
  20.00::numeric(14,2),
  'anular la segunda entrada devuelve la cantidad a 20'
);

select is(
  (select costo from public.productos where id = (select id from _ids where clave = 'producto')),
  150.00::numeric(14,2),
  'anular la segunda entrada restaura el costo promedio a 150.00'
);

select is(
  (select estado from public.ajustes_inventario where id = (select id from _ids where clave = 'entrada2')),
  'anulada',
  'la segunda entrada queda anulada'
);

select ok(
  exists (
    select 1
    from public.asientos r
    join public.ajustes_inventario ai on ai.asiento_id = r.anula_asiento_id
    where ai.id = (select id from _ids where clave = 'entrada2')
  ),
  'la segunda entrada tiene su asiento de reversión'
);

select public.anular_documento(
  'ajuste_inventario',
  (select id from _ids where clave = 'entrada1')
);

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'producto')),
  10.00::numeric(14,2),
  'anular la primera entrada devuelve la cantidad a 10'
);

select is(
  (select costo from public.productos where id = (select id from _ids where clave = 'producto')),
  100.00::numeric(14,2),
  'anular la primera entrada restaura el costo original de 100.00'
);

select is(
  (select estado from public.ajustes_inventario where id = (select id from _ids where clave = 'entrada1')),
  'anulada',
  'la primera entrada queda anulada'
);

-- Salida: no cambia el costo promedio al crearse ni al anularse.
insert into _ids (clave, id)
select 'salida', public.crear_ajuste_inventario(jsonb_build_object(
  'fecha', '2026-11-17',
  'almacen_id', (select id from public.almacenes where es_principal),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'tipo', 'salida',
    'cantidad', 4.00::numeric
  ))
));

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'producto')),
  6.00::numeric(14,2),
  'la salida baja la cantidad a 6'
);

select is(
  (select costo from public.productos where id = (select id from _ids where clave = 'producto')),
  100.00::numeric(14,2),
  'la salida no cambia el costo promedio'
);

select public.anular_documento(
  'ajuste_inventario',
  (select id from _ids where clave = 'salida')
);

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'producto')),
  10.00::numeric(14,2),
  'anular la salida devuelve la cantidad a 10'
);

select is(
  (select costo from public.productos where id = (select id from _ids where clave = 'producto')),
  100.00::numeric(14,2),
  'anular la salida no toca el costo promedio'
);

select throws_ok(
  $q$select public.anular_documento(
    'ajuste_inventario',
    (select id from _ids where clave = 'entrada1')
  )$q$,
  '22023',
  null,
  'no permite anular dos veces el mismo ajuste'
);

select * from finish();
rollback;

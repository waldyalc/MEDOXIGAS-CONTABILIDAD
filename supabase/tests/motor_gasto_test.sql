begin;
select plan(9);

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

select public.crear_gasto_menor(
  '{"fecha":"2026-11-13","descripcion":"Gasto Prueba","subtotal":1000,"itbis_tasa":18}'::jsonb
);

select is(
  (select g.itbis from public.gastos_menores g where g.descripcion = 'Gasto Prueba'),
  180.00::numeric,
  'el ITBIS del gasto es 180.00'
);

select is(
  (select g.total from public.gastos_menores g where g.descripcion = 'Gasto Prueba'),
  1180.00::numeric,
  'el total del gasto es 1180.00'
);

select is(
  (select g.estado from public.gastos_menores g where g.descripcion = 'Gasto Prueba'),
  'activo',
  'el gasto queda activo'
);

select is(
  (select sum(al.debito)
   from public.gastos_menores g
   join public.asiento_lineas al on al.asiento_id = g.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where g.descripcion = 'Gasto Prueba' and c.codigo = '6101'),
  1000.00::numeric,
  'el asiento debita 1000.00 en la cuenta 6101'
);

select is(
  (select sum(al.debito)
   from public.gastos_menores g
   join public.asiento_lineas al on al.asiento_id = g.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where g.descripcion = 'Gasto Prueba' and c.codigo = '1105'),
  180.00::numeric,
  'el asiento debita 180.00 en la cuenta 1105'
);

select is(
  (select sum(al.credito)
   from public.gastos_menores g
   join public.asiento_lineas al on al.asiento_id = g.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where g.descripcion = 'Gasto Prueba' and c.codigo = '1106'),
  1180.00::numeric,
  'el asiento acredita 1180.00 en la cuenta 1106'
);

select is(
  (select c.codigo
   from public.gastos_menores g
   join public.cuentas c on c.id = g.cuenta_gasto_id
   where g.descripcion = 'Gasto Prueba'),
  '6101',
  'el gasto usa la cuenta de gasto 6101'
);

select is(
  (select c.codigo
   from public.gastos_menores g
   join public.cuentas c on c.id = g.cuenta_pago_id
   where g.descripcion = 'Gasto Prueba'),
  '1106',
  'el gasto usa la cuenta de pago 1106'
);

select is(
  (select sum(al.debito) - sum(al.credito)
   from public.gastos_menores g
   join public.asiento_lineas al on al.asiento_id = g.asiento_id
   where g.descripcion = 'Gasto Prueba'),
  0.00::numeric,
  'el asiento del gasto está cuadrado'
);

select * from finish();
rollback;

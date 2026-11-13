begin;
select plan(11);

create temp table _ids (clave text primary key, id uuid) on commit drop;
create temp table _valores (clave text primary key, valor text) on commit drop;
grant select, insert, update, delete on _ids to authenticated;
grant select, insert, update, delete on _valores to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local'),
  ('22222222-2222-2222-2222-222222222222', 'contador@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Contador', 'contador'),
  ('33333333-3333-3333-3333-333333333333', 'Lector', 'lector');

insert into _valores (clave, valor)
select 'ncf1', n.prefijo || lpad(n.siguiente::text, 8, '0')
from public.numeraciones n
where n.tipo_comprobante = '13' and n.activa
order by n.id
limit 1;

insert into _valores (clave, valor)
select 'ncf2', n.prefijo || lpad((n.siguiente + 1)::text, 8, '0')
from public.numeraciones n
where n.tipo_comprobante = '13' and n.activa
order by n.id
limit 1;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id)
select 'gasto1', public.crear_gasto_menor(jsonb_build_object(
  'fecha', '2026-11-13',
  'descripcion', 'Combustible caja chica',
  'subtotal', 500,
  'cuenta_gasto_id', (select id from public.cuentas where codigo = '6105')
));

select is(
  (select g.ncf from public.gastos_menores g where g.id = (select id from _ids where clave = 'gasto1')),
  (select valor from _valores where clave = 'ncf1'),
  'el primer gasto menor recibe el siguiente NCF B13'
);

select is(
  (select coalesce(sum(al.debito), 0)
   from public.gastos_menores g
   join public.asiento_lineas al on al.asiento_id = g.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where g.id = (select id from _ids where clave = 'gasto1') and c.codigo = '6105'),
  500.00::numeric,
  'el asiento debita 500.00 en 6105 Combustibles y lubricantes'
);

select is(
  (select coalesce(sum(al.credito), 0)
   from public.gastos_menores g
   join public.asiento_lineas al on al.asiento_id = g.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where g.id = (select id from _ids where clave = 'gasto1') and c.codigo = '1106'),
  500.00::numeric,
  'el asiento acredita 500.00 en 1106 Caja chica'
);

select is(
  (select c.codigo
   from public.gastos_menores g
   join public.cuentas c on c.id = g.cuenta_pago_id
   where g.id = (select id from _ids where clave = 'gasto1')),
  '1106',
  'el pago por defecto usa la cuenta 1106 Caja chica'
);

select is(
  (select count(*)::int
   from public.numeraciones n
   where n.tipo_comprobante = '13' and n.prefijo = 'B13'
     and n.hasta = 100000 and n.activa),
  1,
  'la numeración 13/B13 Gastos menores está activa'
);

insert into _ids (clave, id)
select 'gasto2', public.crear_gasto_menor(jsonb_build_object(
  'fecha', '2026-11-13',
  'descripcion', 'Agua caja chica',
  'subtotal', 250,
  'cuenta_gasto_id', (select id from public.cuentas where codigo = '6106')
));

select is(
  (select g.ncf from public.gastos_menores g where g.id = (select id from _ids where clave = 'gasto2')),
  (select valor from _valores where clave = 'ncf2'),
  'el segundo gasto menor recibe el NCF siguiente'
);

select is(
  (select coalesce(sum(al.debito), 0)
   from public.gastos_menores g
   join public.asiento_lineas al on al.asiento_id = g.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where g.id = (select id from _ids where clave = 'gasto2') and c.codigo = '6106'),
  250.00::numeric,
  'el asiento debita 250.00 en 6106 Agua'
);

select is(
  (select coalesce(sum(al.credito), 0)
   from public.gastos_menores g
   join public.asiento_lineas al on al.asiento_id = g.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where g.id = (select id from _ids where clave = 'gasto2') and c.codigo = '1106'),
  250.00::numeric,
  'el asiento acredita 250.00 en 1106 Caja chica'
);

select throws_ok(
  format(
    'select public.crear_gasto_menor(%L::jsonb)',
    jsonb_build_object(
      'descripcion', 'Cuenta padre',
      'subtotal', 100,
      'cuenta_gasto_id', (select id from public.cuentas where codigo = '6')
    )::text
  ),
  '22023',
  'Elige una cuenta de detalle, no una cuenta padre',
  'una cuenta padre como gasto lanza error claro'
);

insert into _ids (clave, id)
select 'gasto3', public.crear_gasto_menor(jsonb_build_object(
  'fecha', '2026-11-13',
  'descripcion', 'Papelería desde caja general',
  'subtotal', 500,
  'cuenta_gasto_id', (select id from public.cuentas where codigo = '6107'),
  'cuenta_pago_id', (select id from public.cuentas where codigo = '1101')
));

select is(
  (select coalesce(sum(al.credito), 0)
   from public.gastos_menores g
   join public.asiento_lineas al on al.asiento_id = g.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where g.id = (select id from _ids where clave = 'gasto3') and c.codigo = '1101'),
  500.00::numeric,
  'un pago explícito desde 1101 Caja general sigue funcionando'
);

select is(
  (select sum(al.debito) - sum(al.credito)
   from public.asiento_lineas al
   where al.asiento_id in (
     select g.asiento_id
     from public.gastos_menores g
     where g.id in (select id from _ids where clave in ('gasto1', 'gasto2', 'gasto3'))
   )),
  0::numeric,
  'los asientos de gastos menores quedan cuadrados'
);

select * from finish();
rollback;

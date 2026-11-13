begin;
select plan(5);

create temp table _saldos_ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _saldos_ids to authenticated;

create temp table _saldos_antes (
  codigo text not null,
  fecha date not null,
  saldo numeric(14,2) not null,
  primary key (codigo, fecha)
) on commit drop;
grant select, insert on _saldos_antes to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local');
insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _saldos_antes (codigo, fecha, saldo)
select codigo, '2099-01-31'::date, saldo::numeric(14,2)
from public.saldos_caja_banco('2099-01-31')
where codigo in ('1101', '1102')
union all
select codigo, '2099-01-01'::date, saldo::numeric(14,2)
from public.saldos_caja_banco('2099-01-01')
where codigo in ('1101', '1102');

insert into _saldos_ids (clave, id)
select 'gasto', public.crear_gasto_menor(jsonb_build_object(
  'fecha', '2099-01-15',
  'descripcion', 'Gasto de prueba saldos caja banco',
  'subtotal', 100.00::numeric,
  'itbis_tasa', 0.00::numeric,
  'cuenta_pago_id', (select id from public.cuentas where codigo = '1102')
));

select is(
  (select count(*)::int from public.saldos_caja_banco('2099-01-31')),
  (select count(*)::int from public.cuentas where es_caja_banco),
  'devuelve todas las cuentas de caja y banco'
);

select is(
  (select codigo from public.saldos_caja_banco('2099-01-31') limit 1),
  '1101',
  'ordena las cuentas por código'
);

select is(
  (select saldo::numeric(14,2) from public.saldos_caja_banco('2099-01-31') where codigo = '1102'),
  (select saldo - 100.00 from _saldos_antes where codigo = '1102' and fecha = '2099-01-31'),
  'el banco baja 100.00 tras el gasto'
);

select is(
  (select saldo::numeric(14,2) from public.saldos_caja_banco('2099-01-01') where codigo = '1102'),
  (select saldo from _saldos_antes where codigo = '1102' and fecha = '2099-01-01'),
  'con fecha anterior al gasto el saldo del banco no cambia'
);

select ok(
  (select saldo::numeric(14,2) from public.saldos_caja_banco('2099-01-31') where codigo = '1101')
    = (select saldo from _saldos_antes where codigo = '1101' and fecha = '2099-01-31')
  and
  (select saldo::numeric(14,2) from public.saldos_caja_banco('2099-01-01') where codigo = '1101')
    = (select saldo from _saldos_antes where codigo = '1101' and fecha = '2099-01-01'),
  'la caja general no cambia con el gasto'
);

select * from finish();
rollback;

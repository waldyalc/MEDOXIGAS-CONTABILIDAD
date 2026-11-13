begin;
select plan(11);

create temp table _bancos_ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _bancos_ids to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin'),
  ('33333333-3333-3333-3333-333333333333', 'Lector', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _bancos_ids (clave, id)
select 'transferencia', public.transferir_entre_cuentas(jsonb_build_object(
  'cuenta_origen_id', (select id from public.cuentas where codigo = '1101'),
  'cuenta_destino_id', (select id from public.cuentas where codigo = '1102'),
  'monto', 100,
  'fecha', '2099-02-01',
  'descripcion', 'Transferencia de prueba'
));

select is(
  (select a.origen_tipo from public.asientos a where a.id = (select id from _bancos_ids where clave = 'transferencia')),
  'transferencia',
  'la transferencia genera un asiento con origen_tipo transferencia'
);

select is(
  (select sum(al.debito)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select id from _bancos_ids where clave = 'transferencia')
     and c.codigo = '1102'),
  100.00::numeric,
  'la transferencia debita 100.00 en la cuenta destino 1102'
);

select is(
  (select sum(al.credito)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select id from _bancos_ids where clave = 'transferencia')
     and c.codigo = '1101'),
  100.00::numeric,
  'la transferencia acredita 100.00 en la cuenta origen 1101'
);

select is(
  (select coalesce(sum(al.debito), 0) - coalesce(sum(al.credito), 0)
   from public.asiento_lineas al
   where al.asiento_id = (select id from _bancos_ids where clave = 'transferencia')),
  0.00::numeric,
  'el asiento de la transferencia está cuadrado'
);

insert into _bancos_ids (clave, id)
select 'deposito', public.registrar_deposito(jsonb_build_object(
  'cuenta_destino_id', (select id from public.cuentas where codigo = '1102'),
  'cuenta_contrapartida_id', (select id from public.cuentas where codigo = '3101'),
  'monto', 500,
  'fecha', '2099-02-02',
  'descripcion', 'Aporte de capital'
));

select is(
  (select a.origen_tipo from public.asientos a where a.id = (select id from _bancos_ids where clave = 'deposito')),
  'deposito',
  'el depósito genera un asiento con origen_tipo deposito'
);

select is(
  (select sum(al.debito)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select id from _bancos_ids where clave = 'deposito')
     and c.codigo = '1102'),
  500.00::numeric,
  'el depósito debita 500.00 en la cuenta destino 1102'
);

select is(
  (select sum(al.credito)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select id from _bancos_ids where clave = 'deposito')
     and c.codigo = '3101'),
  500.00::numeric,
  'el depósito acredita 500.00 en la contrapartida 3101'
);

select is(
  (select coalesce(sum(al.debito), 0) - coalesce(sum(al.credito), 0)
   from public.asiento_lineas al
   where al.asiento_id = (select id from _bancos_ids where clave = 'deposito')),
  0.00::numeric,
  'el asiento del depósito está cuadrado'
);

select throws_ok(
  format(
    'select public.transferir_entre_cuentas(%L::jsonb)',
    jsonb_build_object(
      'cuenta_origen_id', (select id from public.cuentas where codigo = '1101'),
      'cuenta_destino_id', (select id from public.cuentas where codigo = '1101'),
      'monto', 50,
      'fecha', '2099-02-03'
    )::text
  ),
  '22023',
  'la cuenta de origen y destino deben ser distintas',
  'transferir a la misma cuenta falla'
);

select throws_ok(
  format(
    'select public.transferir_entre_cuentas(%L::jsonb)',
    jsonb_build_object(
      'cuenta_origen_id', (select id from public.cuentas where codigo = '1101'),
      'cuenta_destino_id', (select id from public.cuentas where codigo = '1102'),
      'monto', 0,
      'fecha', '2099-02-03'
    )::text
  ),
  '22023',
  'el monto de la transferencia debe ser mayor a cero',
  'transferir con monto cero falla'
);

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  format(
    'select public.transferir_entre_cuentas(%L::jsonb)',
    jsonb_build_object(
      'cuenta_origen_id', (select id from public.cuentas where codigo = '1101'),
      'cuenta_destino_id', (select id from public.cuentas where codigo = '1102'),
      'monto', 50,
      'fecha', '2099-02-03'
    )::text
  ),
  '42501',
  'sin permiso',
  'lector no puede transferir'
);

select * from finish();
rollback;

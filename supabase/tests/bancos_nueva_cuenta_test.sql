begin;
select plan(23);

create temp table _cuenta_ids (clave text primary key, id uuid) on commit drop;
create temp table _valores (clave text primary key, valor numeric) on commit drop;
grant select, insert, update, delete on _cuenta_ids to authenticated;
grant select, insert, update, delete on _valores to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin'),
  ('33333333-3333-3333-3333-333333333333', 'Lector', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _cuenta_ids (clave, id)
select 'banco', public.crear_cuenta_banco(jsonb_build_object(
  'nombre', 'Banco Popular Prueba',
  'tipo_banco', 'banco',
  'numero_cuenta', '123456789',
  'saldo_inicial', 50000,
  'fecha_saldo_inicial', '2026-11-13',
  'descripcion', 'Cuenta de prueba'
));

select is(
  (select c.nombre from public.cuentas c where c.id = (select id from _cuenta_ids where clave = 'banco')),
  'Banco Popular Prueba',
  'crear_cuenta_banco crea la cuenta con el mismo nombre'
);

select is(
  (select c.tipo from public.cuentas c where c.id = (select id from _cuenta_ids where clave = 'banco')),
  'activo',
  'la cuenta contable nueva es de tipo activo'
);

select is(
  (select c.naturaleza from public.cuentas c where c.id = (select id from _cuenta_ids where clave = 'banco')),
  'debito',
  'la cuenta contable nueva es de naturaleza débito'
);

select ok(
  (select c.es_caja_banco and c.acepta_movimientos and c.activa
   from public.cuentas c where c.id = (select id from _cuenta_ids where clave = 'banco')),
  'la cuenta nueva es de caja/banco, acepta movimientos y está activa'
);

select is(
  (select c.tipo_banco from public.cuentas c where c.id = (select id from _cuenta_ids where clave = 'banco')),
  'banco',
  'la cuenta guarda el tipo banco'
);

select is(
  (select c.numero_cuenta from public.cuentas c where c.id = (select id from _cuenta_ids where clave = 'banco')),
  '123456789',
  'la cuenta guarda el número de cuenta'
);

select is(
  (select c.padre_id from public.cuentas c where c.id = (select id from _cuenta_ids where clave = 'banco')),
  (select c.padre_id from public.cuentas c where c.codigo = '1102'),
  'la cuenta nueva cuelga del padre de la cuenta de banco principal'
);

insert into _cuenta_ids (clave, id)
select 'asiento_banco', a.id
from public.asientos a
join public.asiento_lineas l on l.asiento_id = a.id
where l.cuenta_id = (select id from _cuenta_ids where clave = 'banco')
  and a.origen_tipo = 'deposito'
limit 1;

select is(
  (select a.origen_tipo from public.asientos a where a.id = (select id from _cuenta_ids where clave = 'asiento_banco')),
  'deposito',
  'el saldo inicial genera un asiento de depósito'
);

select is(
  (select sum(l.debito)
   from public.asiento_lineas l
   where l.asiento_id = (select id from _cuenta_ids where clave = 'asiento_banco')
     and l.cuenta_id = (select id from _cuenta_ids where clave = 'banco')),
  50000.00::numeric,
  'el asiento debita 50,000 en la cuenta nueva'
);

insert into _cuenta_ids (clave, id)
select 'ajustes', l.cuenta_id
from public.asiento_lineas l
where l.asiento_id = (select id from _cuenta_ids where clave = 'asiento_banco')
  and l.cuenta_id <> (select id from _cuenta_ids where clave = 'banco')
limit 1;

select is(
  (select c.nombre from public.cuentas c where c.id = (select id from _cuenta_ids where clave = 'ajustes')),
  'Ajustes iniciales en bancos',
  'la contrapartida es Ajustes iniciales en bancos'
);

select is(
  (select sum(l.credito)
   from public.asiento_lineas l
   where l.asiento_id = (select id from _cuenta_ids where clave = 'asiento_banco')
     and l.cuenta_id = (select id from _cuenta_ids where clave = 'ajustes')),
  50000.00::numeric,
  'el asiento acredita 50,000 en Ajustes iniciales en bancos'
);

select is(
  (select c.tipo from public.cuentas c where c.id = (select id from _cuenta_ids where clave = 'ajustes')),
  'capital',
  'Ajustes iniciales en bancos se crea bajo capital'
);

select is(
  (select c.naturaleza from public.cuentas c where c.id = (select id from _cuenta_ids where clave = 'ajustes')),
  'credito',
  'Ajustes iniciales en bancos es de naturaleza crédito'
);

select ok(
  (select c.acepta_movimientos and c.activa
   from public.cuentas c where c.id = (select id from _cuenta_ids where clave = 'ajustes')),
  'Ajustes iniciales en bancos acepta movimientos y está activa'
);

select is(
  (select s.saldo from public.saldos_caja_banco('2026-11-13') s
   where s.cuenta_id = (select id from _cuenta_ids where clave = 'banco')),
  50000.00::numeric,
  'el saldo de la cuenta nueva es 50,000'
);

insert into _valores (clave, valor)
select 'asientos_banco', count(*) from public.asientos;

insert into _cuenta_ids (clave, id)
select 'cero', public.crear_cuenta_banco(jsonb_build_object(
  'nombre', 'Cuenta Cero Prueba',
  'tipo_banco', 'efectivo',
  'saldo_inicial', 0,
  'fecha_saldo_inicial', '2026-11-13'
));

select is(
  (select count(*)::numeric from public.asientos),
  (select valor from _valores where clave = 'asientos_banco'),
  'crear una cuenta con saldo inicial 0 no genera asiento'
);

select is(
  (select c.tipo_banco from public.cuentas c where c.id = (select id from _cuenta_ids where clave = 'cero')),
  'efectivo',
  'la cuenta con saldo 0 también guarda su tipo'
);

insert into _cuenta_ids (clave, id)
select 'transferencia', public.transferir_entre_cuentas(jsonb_build_object(
  'cuenta_origen_id', (select id from public.cuentas where codigo = '1101'),
  'cuenta_destino_id', (select id from _cuenta_ids where clave = 'banco'),
  'monto', 5000,
  'fecha', '2026-11-13',
  'descripcion', 'Depósito de caja al banco',
  'numeracion_ingreso', 'REC-001',
  'numeracion_egreso', 'EGR-001'
));

select is(
  (select count(*) from public.asiento_lineas l
   where l.asiento_id = (select id from _cuenta_ids where clave = 'transferencia')),
  2::bigint,
  'la transferencia sigue teniendo solo dos líneas, sin cuenta puente'
);

select is(
  (select sum(l.debito)
   from public.asiento_lineas l
   where l.asiento_id = (select id from _cuenta_ids where clave = 'transferencia')
     and l.cuenta_id = (select id from _cuenta_ids where clave = 'banco')),
  5000.00::numeric,
  'la transferencia debita 5,000 en la cuenta destino'
);

select is(
  (select sum(l.credito)
   from public.asiento_lineas l
   where l.asiento_id = (select id from _cuenta_ids where clave = 'transferencia')
     and l.cuenta_id = (select id from public.cuentas where codigo = '1101')),
  5000.00::numeric,
  'la transferencia acredita 5,000 en la cuenta origen'
);

select is(
  (select a.numeracion_ingreso from public.asientos a
   where a.id = (select id from _cuenta_ids where clave = 'transferencia')),
  'REC-001',
  'la transferencia guarda la numeración de ingreso'
);

select is(
  (select a.numeracion_egreso from public.asientos a
   where a.id = (select id from _cuenta_ids where clave = 'transferencia')),
  'EGR-001',
  'la transferencia guarda la numeración de egreso'
);

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  format(
    'select public.crear_cuenta_banco(%L::jsonb)',
    jsonb_build_object(
      'nombre', 'Cuenta sin permiso',
      'tipo_banco', 'banco',
      'saldo_inicial', 0,
      'fecha_saldo_inicial', '2026-11-13'
    )::text
  ),
  '42501',
  'sin permiso',
  'lector no puede crear cuentas de banco'
);

select * from finish();
rollback;

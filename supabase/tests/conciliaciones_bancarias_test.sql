begin;
select plan(28);

create temp table _conc_ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _conc_ids to authenticated;

insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'admin-conc@prueba.local'),
  ('55555555-5555-5555-5555-555555555555', 'lector-conc@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('44444444-4444-4444-4444-444444444444', 'Admin conciliación', 'admin'),
  ('55555555-5555-5555-5555-555555555555', 'Lector conciliación', 'lector');

insert into public.cuentas (codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos, es_caja_banco)
select '1199', 'Banco conciliación prueba', 'activo', 'debito', p.id, true, true
from public.cuentas p
where p.codigo = '11';

select is(
  (select count(*)::int
   from public.cuentas
   where (nombre = 'Gastos financieros' and tipo = 'gasto' and naturaleza = 'debito' and acepta_movimientos)
      or (nombre = 'Ingresos por intereses' and tipo = 'ingreso' and naturaleza = 'credito' and acepta_movimientos)),
  2,
  'las cuentas por defecto de gastos e intereses existen'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

insert into _conc_ids (clave, id)
select 'deposito1', public.registrar_deposito(jsonb_build_object(
  'cuenta_destino_id', (select id from public.cuentas where codigo = '1199'),
  'cuenta_contrapartida_id', (select id from public.cuentas where codigo = '3101'),
  'monto', 1000,
  'fecha', '2099-05-02',
  'descripcion', 'Depósito conciliación 1'
));

insert into _conc_ids (clave, id)
select 'linea1', l.id
from public.asiento_lineas l
where l.asiento_id = (select id from _conc_ids where clave = 'deposito1')
  and l.cuenta_id = (select id from public.cuentas where codigo = '1199');

insert into _conc_ids (clave, id)
select 'borrador1', public.guardar_borrador_conciliacion(jsonb_build_object(
  'cuenta_id', (select id from public.cuentas where codigo = '1199'),
  'fecha_desde', '2099-05-01',
  'fecha_hasta', '2099-05-31',
  'saldo_bancario', 1000,
  'lineas', jsonb_build_array((select id from _conc_ids where clave = 'linea1'))
));

select is(
  (select estado from public.conciliaciones where id = (select id from _conc_ids where clave = 'borrador1')),
  'borrador',
  'guardar_borrador_conciliacion deja la conciliación en borrador'
);

select ok(
  (select asiento_id is null from public.conciliaciones where id = (select id from _conc_ids where clave = 'borrador1')),
  'el borrador no genera asiento'
);

select is(
  (select count(*)::int from public.conciliacion_movimientos
   where conciliacion_id = (select id from _conc_ids where clave = 'borrador1')),
  1,
  'el borrador marca el movimiento seleccionado'
);

select is(
  public.guardar_borrador_conciliacion(jsonb_build_object(
    'conciliacion_id', (select id from _conc_ids where clave = 'borrador1'),
    'cuenta_id', (select id from public.cuentas where codigo = '1199'),
    'fecha_desde', '2099-05-01',
    'fecha_hasta', '2099-05-31',
    'saldo_bancario', 1200,
    'lineas', jsonb_build_array((select id from _conc_ids where clave = 'linea1'))
  )),
  (select id from _conc_ids where clave = 'borrador1'),
  'guardar_borrador_conciliacion actualiza el mismo borrador'
);

select is(
  (select saldo_bancario from public.conciliaciones where id = (select id from _conc_ids where clave = 'borrador1')),
  1200.00::numeric,
  'el borrador actualizado conserva el saldo nuevo'
);

insert into _conc_ids (clave, id)
select 'conciliacion1', public.conciliar_cuenta(jsonb_build_object(
  'cuenta_id', (select id from public.cuentas where codigo = '1199'),
  'fecha_desde', '2099-05-01',
  'fecha_hasta', '2099-05-31',
  'saldo_bancario', 1000,
  'lineas', jsonb_build_array((select id from _conc_ids where clave = 'linea1'))
));

select is(
  (select id from _conc_ids where clave = 'conciliacion1'),
  (select id from _conc_ids where clave = 'borrador1'),
  'conciliar_cuenta reutiliza el borrador de la cuenta'
);

select is(
  (select estado from public.conciliaciones where id = (select id from _conc_ids where clave = 'conciliacion1')),
  'conciliada',
  'conciliar_cuenta deja la conciliación conciliada'
);

select ok(
  (select asiento_id is null from public.conciliaciones where id = (select id from _conc_ids where clave = 'conciliacion1')),
  'sin gastos, impuestos ni entradas la conciliación no asienta'
);

select ok(
  (select conciliado_en is not null from public.conciliaciones where id = (select id from _conc_ids where clave = 'conciliacion1')),
  'conciliar_cuenta registra la fecha de conciliación'
);

select is(
  (select count(*)::int from public.conciliacion_movimientos
   where conciliacion_id = (select id from _conc_ids where clave = 'conciliacion1')),
  1,
  'la conciliación deja marcado el movimiento'
);

insert into _conc_ids (clave, id)
select 'deposito2', public.registrar_deposito(jsonb_build_object(
  'cuenta_destino_id', (select id from public.cuentas where codigo = '1199'),
  'cuenta_contrapartida_id', (select id from public.cuentas where codigo = '3101'),
  'monto', 500,
  'fecha', '2099-06-10',
  'descripcion', 'Depósito conciliación 2'
));

insert into _conc_ids (clave, id)
select 'linea2', l.id
from public.asiento_lineas l
where l.asiento_id = (select id from _conc_ids where clave = 'deposito2')
  and l.cuenta_id = (select id from public.cuentas where codigo = '1199');

insert into _conc_ids (clave, id)
select 'conciliacion2', public.conciliar_cuenta(jsonb_build_object(
  'cuenta_id', (select id from public.cuentas where codigo = '1199'),
  'fecha_desde', '2099-06-01',
  'fecha_hasta', '2099-06-30',
  'saldo_bancario', 470,
  'gastos_bancarios', 30,
  'lineas', jsonb_build_array((select id from _conc_ids where clave = 'linea2'))
));

select is(
  (select estado from public.conciliaciones where id = (select id from _conc_ids where clave = 'conciliacion2')),
  'conciliada',
  'conciliar con gastos bancarios queda conciliada'
);

select ok(
  (select asiento_id is not null from public.conciliaciones where id = (select id from _conc_ids where clave = 'conciliacion2')),
  'conciliar con gastos bancarios genera asiento'
);

select is(
  (select a.origen_tipo
   from public.asientos a
   where a.id = (select asiento_id from public.conciliaciones where id = (select id from _conc_ids where clave = 'conciliacion2'))),
  'conciliacion',
  'el asiento de la conciliación usa origen_tipo conciliacion'
);

select is(
  (select coalesce(sum(al.debito), 0)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.conciliaciones where id = (select id from _conc_ids where clave = 'conciliacion2'))
     and c.nombre = 'Gastos financieros'),
  30.00::numeric,
  'el asiento debita 30.00 en Gastos financieros'
);

select is(
  (select coalesce(sum(al.credito), 0)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.conciliaciones where id = (select id from _conc_ids where clave = 'conciliacion2'))
     and c.codigo = '1199'),
  30.00::numeric,
  'el asiento acredita 30.00 en la cuenta de banco'
);

select is(
  (select coalesce(sum(al.debito), 0) - coalesce(sum(al.credito), 0)
   from public.asiento_lineas al
   where al.asiento_id = (select asiento_id from public.conciliaciones where id = (select id from _conc_ids where clave = 'conciliacion2'))),
  0.00::numeric,
  'el asiento de la conciliación está cuadrado'
);

select is(
  (select count(*)::int from public.conciliacion_movimientos
   where conciliacion_id = (select id from _conc_ids where clave = 'conciliacion2')),
  1,
  'la segunda conciliación marca su movimiento'
);

select throws_ok(
  format(
    'select public.conciliar_cuenta(%L::jsonb)',
    jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '1199'),
      'fecha_desde', '2099-06-01',
      'fecha_hasta', '2099-06-30',
      'saldo_bancario', 470,
      'lineas', jsonb_build_array((select id from _conc_ids where clave = 'linea2'))
    )::text
  ),
  '23505',
  'el movimiento ya está en otra conciliación',
  'un movimiento conciliado no se puede volver a usar'
);

select throws_ok(
  format(
    'select public.conciliar_cuenta(%L::jsonb)',
    jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '1199'),
      'fecha_desde', '2099-07-01',
      'fecha_hasta', '2099-07-31',
      'lineas', jsonb_build_array((select id from _conc_ids where clave = 'linea1'))
    )::text
  ),
  '22023',
  'el saldo bancario es obligatorio',
  'conciliar_cuenta exige saldo bancario'
);

select throws_ok(
  format(
    'select public.conciliar_cuenta(%L::jsonb)',
    jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '1199'),
      'fecha_desde', '2099-07-01',
      'fecha_hasta', '2099-07-31',
      'saldo_bancario', 0
    )::text
  ),
  '22023',
  'selecciona al menos un movimiento',
  'conciliar_cuenta exige al menos un movimiento'
);

select throws_ok(
  format(
    'select public.conciliar_cuenta(%L::jsonb)',
    jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '1199'),
      'fecha_desde', '2099-07-01',
      'fecha_hasta', '2099-07-31',
      'saldo_bancario', 0,
      'lineas', jsonb_build_array((select id from _conc_ids where clave = 'linea1'))
    )::text
  ),
  '22023',
  'el movimiento no pertenece a la cuenta o está fuera del rango',
  'un movimiento fuera del rango no se puede conciliar'
);

select throws_ok(
  format(
    'select public.guardar_borrador_conciliacion(%L::jsonb)',
    jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '6108'),
      'fecha_desde', '2099-07-01',
      'fecha_hasta', '2099-07-31'
    )::text
  ),
  '22023',
  'la cuenta debe ser de caja o banco',
  'la conciliación exige una cuenta de caja o banco'
);

select ok(
  has_table_privilege('authenticated', 'public.conciliaciones', 'SELECT')
  and has_table_privilege('authenticated', 'public.conciliacion_movimientos', 'SELECT'),
  'authenticated puede leer conciliaciones y sus movimientos'
);

select ok(
  not has_table_privilege('authenticated', 'public.conciliaciones', 'INSERT')
  and not has_table_privilege('authenticated', 'public.conciliaciones', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.conciliaciones', 'DELETE'),
  'authenticated no escribe directo en conciliaciones'
);

select ok(
  not has_table_privilege('authenticated', 'public.conciliacion_movimientos', 'INSERT')
  and not has_table_privilege('authenticated', 'public.conciliacion_movimientos', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.conciliacion_movimientos', 'DELETE'),
  'authenticated no escribe directo en conciliacion_movimientos'
);

set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

select throws_ok(
  format(
    'select public.guardar_borrador_conciliacion(%L::jsonb)',
    jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '1199'),
      'fecha_desde', '2099-08-01',
      'fecha_hasta', '2099-08-31'
    )::text
  ),
  '42501',
  'sin permiso',
  'lector no puede guardar borradores de conciliación'
);

select throws_ok(
  format(
    'select public.conciliar_cuenta(%L::jsonb)',
    jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '1199'),
      'fecha_desde', '2099-08-01',
      'fecha_hasta', '2099-08-31',
      'saldo_bancario', 0,
      'lineas', jsonb_build_array((select id from _conc_ids where clave = 'linea1'))
    )::text
  ),
  '42501',
  'sin permiso',
  'lector no puede conciliar'
);

select * from finish();
rollback;

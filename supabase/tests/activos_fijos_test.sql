begin;
select plan(27);

create temp table _activos (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _activos to authenticated;

insert into auth.users (id, email) values
  ('71111111-1111-1111-1111-111111111111', 'admin.activos@prueba.local'),
  ('72222222-2222-2222-2222-222222222222', 'lector.activos@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('71111111-1111-1111-1111-111111111111', 'Admin activos', 'admin'),
  ('72222222-2222-2222-2222-222222222222', 'Lector activos', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"71111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _activos (clave, id)
select 'camioneta', public.crear_activo_fijo(jsonb_build_object(
  'nombre', 'Camioneta pgTAP',
  'referencia', 'ACT-001',
  'tipo_activo', 'equipos_transporte',
  'fecha_adquisicion', '2026-01-15',
  'costo_unitario', 120000,
  'cantidad', 1,
  'monto_total', 120000,
  'valor_residual', 0,
  'fecha_inicio_depreciacion', '2026-01-15',
  'vida_util_meses', 12,
  'contabilizar_creacion', true
));

select ok(
  (select id from _activos where clave = 'camioneta') is not null,
  'crear_activo_fijo devuelve el id del activo'
);

select is(
  (select a.monto_total from public.activos_fijos a where a.id = (select id from _activos where clave = 'camioneta')),
  120000.00::numeric,
  'el monto total del activo es 120000.00'
);

select is(
  (select a.vida_util_meses from public.activos_fijos a where a.id = (select id from _activos where clave = 'camioneta')),
  12,
  'la vida útil queda en 12 meses'
);

select is(
  (select c.codigo from public.activos_fijos a join public.cuentas c on c.id = a.cuenta_activo_id
   where a.id = (select id from _activos where clave = 'camioneta')),
  '1210',
  'la cuenta del activo por defecto es 1210'
);

select is(
  (select c.codigo from public.activos_fijos a join public.cuentas c on c.id = a.cuenta_depreciacion_id
   where a.id = (select id from _activos where clave = 'camioneta')),
  '1211',
  'la cuenta de depreciación acumulada por defecto es 1211'
);

select is(
  (select c.codigo from public.activos_fijos a join public.cuentas c on c.id = a.cuenta_gasto_id
   where a.id = (select id from _activos where clave = 'camioneta')),
  '6109',
  'la cuenta de gasto por defecto es 6109'
);

select ok(
  (select a.asiento_id from public.activos_fijos a where a.id = (select id from _activos where clave = 'camioneta')) is not null,
  'el activo queda enlazado a su asiento de compra'
);

select is(
  (select sum(l.debito) from public.asientos a
   join public.asiento_lineas l on l.asiento_id = a.id
   join public.cuentas c on c.id = l.cuenta_id
   where a.id = (select asiento_id from public.activos_fijos where id = (select id from _activos where clave = 'camioneta'))
     and c.codigo = '1210'),
  120000.00::numeric,
  'el asiento de compra debita 120000.00 en 1210'
);

select is(
  (select sum(l.credito) from public.asientos a
   join public.asiento_lineas l on l.asiento_id = a.id
   join public.cuentas c on c.id = l.cuenta_id
   where a.id = (select asiento_id from public.activos_fijos where id = (select id from _activos where clave = 'camioneta'))
     and c.codigo = '2101'),
  120000.00::numeric,
  'el asiento de compra acredita 120000.00 en 2101'
);

select is(
  (select sum(l.debito) - sum(l.credito) from public.asiento_lineas l
   where l.asiento_id = (select asiento_id from public.activos_fijos where id = (select id from _activos where clave = 'camioneta'))),
  0.00::numeric,
  'el asiento de compra está cuadrado'
);

insert into _activos (clave, id)
select 'dep1', public.depreciar_activo((select id from _activos where clave = 'camioneta'));

select ok(
  (select id from _activos where clave = 'dep1') is not null,
  'depreciar_activo devuelve el asiento de la depreciación'
);

select is(
  (select d.periodo from public.activo_depreciaciones d
   where d.activo_id = (select id from _activos where clave = 'camioneta')),
  '2026-01-01'::date,
  'la primera depreciación queda en el mes de enero 2026'
);

select is(
  (select d.monto from public.activo_depreciaciones d
   where d.activo_id = (select id from _activos where clave = 'camioneta')),
  10000.00::numeric,
  'la depreciación mensual es 10000.00'
);

select is(
  (select a.fecha from public.asientos a where a.id = (select id from _activos where clave = 'dep1')),
  '2026-01-31'::date,
  'el asiento se fecha al cierre del mes'
);

select is(
  (select sum(l.debito) from public.asiento_lineas l
   join public.cuentas c on c.id = l.cuenta_id
   where l.asiento_id = (select id from _activos where clave = 'dep1') and c.codigo = '6109'),
  10000.00::numeric,
  'la depreciación debita 10000.00 en 6109'
);

select is(
  (select sum(l.credito) from public.asiento_lineas l
   join public.cuentas c on c.id = l.cuenta_id
   where l.asiento_id = (select id from _activos where clave = 'dep1') and c.codigo = '1211'),
  10000.00::numeric,
  'la depreciación acredita 10000.00 en 1211'
);

select is(
  public.depreciar_activo(
    (select id from _activos where clave = 'camioneta'),
    '2026-01-15'::date
  ),
  (select id from _activos where clave = 'dep1'),
  'depreciar el mismo mes devuelve el asiento existente sin duplicarlo'
);

select is(
  (select count(*)::int from public.activo_depreciaciones d
   where d.activo_id = (select id from _activos where clave = 'camioneta')),
  1,
  'solo hay una depreciación del mismo mes'
);

insert into _activos (clave, id)
select 'dep2', public.depreciar_activo((select id from _activos where clave = 'camioneta'));

select is(
  (select d.periodo from public.activo_depreciaciones d
   where d.activo_id = (select id from _activos where clave = 'camioneta') and d.asiento_id = (select id from _activos where clave = 'dep2')),
  '2026-02-01'::date,
  'la siguiente depreciación es febrero 2026'
);

insert into _activos (clave, id)
select 'sin-asiento', public.crear_activo_fijo(jsonb_build_object(
  'nombre', 'Equipo sin contabilizar pgTAP',
  'fecha_adquisicion', '2026-03-10',
  'costo_unitario', 100000,
  'cantidad', 1,
  'monto_total', 100000,
  'fecha_inicio_depreciacion', '2026-03-01',
  'vida_util_meses', 3,
  'contabilizar_creacion', false
));

select ok(
  (select a.asiento_id from public.activos_fijos a where a.id = (select id from _activos where clave = 'sin-asiento')) is null,
  'si no se contabiliza la creación, el activo no tiene asiento'
);

select public.depreciar_activo((select id from _activos where clave = 'sin-asiento'));
select public.depreciar_activo((select id from _activos where clave = 'sin-asiento'));
select public.depreciar_activo((select id from _activos where clave = 'sin-asiento'));

select is(
  (select d.monto from public.activo_depreciaciones d
   where d.activo_id = (select id from _activos where clave = 'sin-asiento') and d.periodo = '2026-03-01'),
  33333.33::numeric,
  'el primer mes de 3 deprecia 33333.33'
);

select is(
  (select d.monto from public.activo_depreciaciones d
   where d.activo_id = (select id from _activos where clave = 'sin-asiento') and d.periodo = '2026-05-01'),
  33333.34::numeric,
  'el último mes absorbe el redondeo: 33333.34'
);

select is(
  (select sum(d.monto) from public.activo_depreciaciones d
   where d.activo_id = (select id from _activos where clave = 'sin-asiento')),
  100000.00::numeric,
  'las 3 depreciaciones suman el monto total'
);

select throws_ok(
  format(
    'select public.depreciar_activo(%L::uuid)',
    (select id from _activos where clave = 'sin-asiento')
  ),
  '23514',
  null,
  'no se puede depreciar un activo ya totalmente depreciado'
);

insert into _activos (clave, id)
select 'desordenado', public.crear_activo_fijo(jsonb_build_object(
  'nombre', 'Activo desordenado pgTAP',
  'fecha_adquisicion', '2026-01-01',
  'costo_unitario', 12000,
  'cantidad', 1,
  'monto_total', 12000,
  'fecha_inicio_depreciacion', '2026-01-01',
  'vida_util_meses', 12,
  'contabilizar_creacion', false
));

select throws_ok(
  format(
    'select public.depreciar_activo(%L::uuid, %L::date)',
    (select id from _activos where clave = 'desordenado'),
    '2026-02-01'
  ),
  '23514',
  null,
  'no se puede saltar un periodo: febrero antes que enero'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"72222222-2222-2222-2222-222222222222","role":"authenticated"}';

select throws_ok(
  format(
    'select public.crear_activo_fijo(%L::jsonb)',
    jsonb_build_object(
      'nombre', 'Activo de lector pgTAP',
      'costo_unitario', 1000,
      'cantidad', 1,
      'monto_total', 1000,
      'vida_util_meses', 12
    )::text
  ),
  '42501',
  null,
  'lector no puede crear activos fijos'
);

select throws_ok(
  format(
    'select public.depreciar_activo(%L::uuid)',
    (select id from _activos where clave = 'camioneta')
  ),
  '42501',
  null,
  'lector no puede depreciar activos fijos'
);

select * from finish();
rollback;

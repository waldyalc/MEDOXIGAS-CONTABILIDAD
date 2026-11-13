begin;
select plan(21);

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
select 'plan', public.crear_pago_recurrente(jsonb_build_object(
  'nombre', 'Alquiler local',
  'cuenta_gasto_id', (select id from public.cuentas where codigo = '6101'),
  'cuenta_pago_id', (select id from public.cuentas where codigo = '1101'),
  'subtotal', 1000.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'frecuencia_meses', 1,
  'fecha_inicio', current_date
));

insert into _ids (clave, id)
select 'gasto', public.generar_pago_recurrente((select id from _ids where clave = 'plan'));

select ok(
  (select id from _ids where clave = 'gasto') is not null,
  'generar_pago_recurrente devuelve el gasto del periodo'
);

select is(
  (select count(*)::int from public.gastos_menores where pago_recurrente_id = (select id from _ids where clave = 'plan')),
  1,
  'se genera un solo gasto menor'
);

select is(
  (select subtotal::numeric(14,2) from public.gastos_menores where id = (select id from _ids where clave = 'gasto')),
  1000.00::numeric(14,2),
  'el gasto usa el subtotal de la plantilla'
);

select is(
  (select itbis::numeric(14,2) from public.gastos_menores where id = (select id from _ids where clave = 'gasto')),
  180.00::numeric(14,2),
  'el gasto calcula el ITBIS de la plantilla'
);

select is(
  (select total::numeric(14,2) from public.gastos_menores where id = (select id from _ids where clave = 'gasto')),
  1180.00::numeric(14,2),
  'el gasto total es 1180.00'
);

select ok(
  (select ncf like 'B13%' from public.gastos_menores where id = (select id from _ids where clave = 'gasto')),
  'el gasto generado recibe NCF B13'
);

select is(
  (select periodo from public.gastos_menores where id = (select id from _ids where clave = 'gasto')),
  current_date,
  'el periodo generado es la fecha de inicio'
);

select is(
  (select pago_recurrente_id from public.gastos_menores where id = (select id from _ids where clave = 'gasto')),
  (select id from _ids where clave = 'plan'),
  'el gasto queda enlazado a la plantilla'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.gastos_menores where id = (select id from _ids where clave = 'gasto'))
     and c.codigo = '6101'),
  1000.00::numeric(14,2),
  'asiento del pago recurrente: debe gasto 6101 por 1000.00'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.gastos_menores where id = (select id from _ids where clave = 'gasto'))
     and c.codigo = '1105'),
  180.00::numeric(14,2),
  'asiento del pago recurrente: debe ITBIS adelantado 1105 por 180.00'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.gastos_menores where id = (select id from _ids where clave = 'gasto'))
     and c.codigo = '1101'),
  1180.00::numeric(14,2),
  'asiento del pago recurrente: haber caja 1101 por 1180.00'
);

select is(
  (select coalesce(sum(al.debito) - sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   where al.asiento_id = (select asiento_id from public.gastos_menores where id = (select id from _ids where clave = 'gasto'))),
  0.00::numeric(14,2),
  'asiento del pago recurrente cuadrado'
);

select is(
  public.generar_pago_recurrente((select id from _ids where clave = 'plan')),
  (select id from _ids where clave = 'gasto'),
  'generar dos veces el mismo periodo devuelve el mismo gasto'
);

select is(
  (select count(*)::int from public.gastos_menores where pago_recurrente_id = (select id from _ids where clave = 'plan')),
  1,
  'la generación es idempotente: no duplica el gasto'
);

update public.pagos_recurrentes set activo = false where id = (select id from _ids where clave = 'plan');

select throws_ok(
  $q$select public.generar_pago_recurrente((select id from _ids where clave = 'plan'))$q$,
  null,
  null,
  'una plantilla inactiva no genera pagos'
);

update public.pagos_recurrentes set activo = true where id = (select id from _ids where clave = 'plan');

insert into _ids (clave, id)
select 'plan_futuro', public.crear_pago_recurrente(jsonb_build_object(
  'nombre', 'Internet',
  'cuenta_gasto_id', (select id from public.cuentas where codigo = '6104'),
  'cuenta_pago_id', (select id from public.cuentas where codigo = '1102'),
  'subtotal', 500.00::numeric,
  'itbis_tasa', 0::numeric,
  'frecuencia_meses', 1,
  'fecha_inicio', (current_date + interval '1 month')::date
));

select is(
  public.generar_pago_recurrente((select id from _ids where clave = 'plan_futuro')),
  null::uuid,
  'una plantilla que empieza en el futuro no genera pago'
);

select is(
  public.actualizar_pago_recurrente(
    (select id from _ids where clave = 'plan'),
    jsonb_build_object(
      'nombre', 'Alquiler local actualizado',
      'cuenta_gasto_id', (select id from public.cuentas where codigo = '6101'),
      'cuenta_pago_id', (select id from public.cuentas where codigo = '1101'),
      'subtotal', 1200.00::numeric,
      'itbis_tasa', 18.00::numeric,
      'frecuencia_meses', 1,
      'fecha_inicio', current_date,
      'activo', true
    )
  ),
  (select id from _ids where clave = 'plan'),
  'actualizar_pago_recurrente devuelve la plantilla'
);

select is(
  public.generar_pago_recurrente((select id from _ids where clave = 'plan')),
  (select id from _ids where clave = 'gasto'),
  'actualizar la plantilla no duplica el periodo ya generado'
);

select is(
  (select count(*)::int from public.gastos_menores where pago_recurrente_id = (select id from _ids where clave = 'plan')),
  1,
  'sigue habiendo un solo gasto para el periodo'
);

insert into _ids (clave, id)
select 'plan_vencido', public.crear_pago_recurrente(jsonb_build_object(
  'nombre', 'Seguro vencido',
  'cuenta_gasto_id', (select id from public.cuentas where codigo = '6101'),
  'cuenta_pago_id', (select id from public.cuentas where codigo = '1102'),
  'subtotal', 750.00::numeric,
  'itbis_tasa', 0::numeric,
  'frecuencia_meses', 1,
  'fecha_inicio', (current_date - interval '2 months')::date,
  'vigencia_hasta', (current_date - interval '1 month')::date
));

select is(
  public.generar_pago_recurrente((select id from _ids where clave = 'plan_vencido')),
  null::uuid,
  'una plantilla fuera de vigencia no genera pago'
);

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  $q$select public.generar_pago_recurrente((select id from _ids where clave = 'plan'))$q$,
  '42501',
  null,
  'lector no puede generar pagos recurrentes'
);

select * from finish();
rollback;

begin;
select plan(27);

create temp table _periodos (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _periodos to authenticated;

insert into auth.users (id, email) values
  ('81111111-1111-1111-1111-111111111111', 'admin.periodos@prueba.local'),
  ('82222222-2222-2222-2222-222222222222', 'lector.periodos@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('81111111-1111-1111-1111-111111111111', 'Admin periodos', 'admin'),
  ('82222222-2222-2222-2222-222222222222', 'Lector periodos', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"81111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _periodos (clave, id)
select 'abierto', public.crear_asiento_manual(jsonb_build_object(
  'fecha', to_char(current_date, 'YYYY-MM-DD'),
  'descripcion', 'Asiento en periodo abierto pgTAP',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '1101'),
      'debito', 100,
      'credito', 0
    ),
    jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '3101'),
      'debito', 0,
      'credito', 100
    )
  )
));

select ok(
  (select id from _periodos where clave = 'abierto') is not null,
  'un asiento normal se crea con el periodo abierto'
);

select is(
  public.cerrar_periodo(date_trunc('month', current_date)::date)::text,
  date_trunc('month', current_date)::date::text,
  'cerrar_periodo devuelve el primer día del mes'
);

select is(
  (select p.estado from public.periodos_contables p
   where p.periodo = date_trunc('month', current_date)::date),
  'cerrado',
  'el mes queda cerrado'
);

select public.cerrar_periodo(date_trunc('month', current_date)::date);

select is(
  (select count(*)::int from public.periodos_contables p
   where p.periodo = date_trunc('month', current_date)::date),
  1,
  'cerrar dos veces el mismo mes no duplica el registro'
);

select throws_ok(
  format(
    'select public.crear_asiento_manual(%L::jsonb)',
    jsonb_build_object(
      'fecha', to_char(current_date, 'YYYY-MM-DD'),
      'descripcion', 'Asiento en periodo cerrado pgTAP',
      'lineas', jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', (select id from public.cuentas where codigo = '1101'),
          'debito', 100,
          'credito', 0
        ),
        jsonb_build_object(
          'cuenta_id', (select id from public.cuentas where codigo = '3101'),
          'debito', 0,
          'credito', 100
        )
      )
    )::text
  ),
  '23514',
  null,
  'un mes cerrado bloquea los asientos nuevos'
);

select public.reabrir_periodo(date_trunc('month', current_date)::date);

select is(
  (select p.estado from public.periodos_contables p
   where p.periodo = date_trunc('month', current_date)::date),
  'abierto',
  'reabrir_periodo vuelve a dejar el mes abierto'
);

insert into _periodos (clave, id)
select 'reabierto', public.crear_asiento_manual(jsonb_build_object(
  'fecha', to_char(current_date, 'YYYY-MM-DD'),
  'descripcion', 'Asiento tras reabrir pgTAP',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '1101'),
      'debito', 100,
      'credito', 0
    ),
    jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '3101'),
      'debito', 0,
      'credito', 100
    )
  )
));

select ok(
  (select id from _periodos where clave = 'reabierto') is not null,
  'tras reabrir, los asientos vuelven a funcionar'
);

insert into _periodos (clave, id)
select 'ingreso', public.crear_asiento_manual(jsonb_build_object(
  'fecha', '2026-03-15',
  'descripcion', 'Ingreso para cierre pgTAP',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '1101'),
      'debito', 10000,
      'credito', 0
    ),
    jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '4101'),
      'debito', 0,
      'credito', 10000
    )
  )
));

select ok(
  (select id from _periodos where clave = 'ingreso') is not null,
  'se crea el ingreso de prueba del año'
);

insert into _periodos (clave, id)
select 'gasto', public.crear_asiento_manual(jsonb_build_object(
  'fecha', '2026-04-10',
  'descripcion', 'Gasto para cierre pgTAP',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '6101'),
      'debito', 3000,
      'credito', 0
    ),
    jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '1101'),
      'debito', 0,
      'credito', 3000
    )
  )
));

select ok(
  (select id from _periodos where clave = 'gasto') is not null,
  'se crea el gasto de prueba del año'
);

insert into _periodos (clave, id)
select 'cierre', public.cerrar_resultados_anio(2026);

select ok(
  (select id from _periodos where clave = 'cierre') is not null,
  'cerrar_resultados_anio devuelve el asiento de cierre'
);

select is(
  (select sum(l.debito) from public.asiento_lineas l
   join public.cuentas c on c.id = l.cuenta_id
   where l.asiento_id = (select id from _periodos where clave = 'cierre') and c.codigo = '4101'),
  10000.00::numeric,
  'el cierre debita los ingresos: 10000.00 en 4101'
);

select is(
  (select sum(l.credito) from public.asiento_lineas l
   join public.cuentas c on c.id = l.cuenta_id
   where l.asiento_id = (select id from _periodos where clave = 'cierre') and c.codigo = '6101'),
  3000.00::numeric,
  'el cierre acredita los gastos: 3000.00 en 6101'
);

select is(
  (select sum(l.credito) from public.asiento_lineas l
   join public.cuentas c on c.id = l.cuenta_id
   where l.asiento_id = (select id from _periodos where clave = 'cierre') and c.codigo = '3202'),
  7000.00::numeric,
  'la utilidad del ejercicio queda en 7000.00'
);

select is(
  (select sum(l.debito) - sum(l.credito) from public.asiento_lineas l
   where l.asiento_id = (select id from _periodos where clave = 'cierre')),
  0.00::numeric,
  'el asiento de cierre está cuadrado'
);

select is(
  public.cerrar_resultados_anio(2026),
  (select id from _periodos where clave = 'cierre'),
  'cerrar el mismo año devuelve el asiento existente'
);

select is(
  (select count(*)::int from public.cierres_resultados c where c.anio = 2026),
  1,
  'solo hay un cierre de resultados por año'
);

select is(
  (select count(*)::int from public.asientos a where a.descripcion = 'Cierre de resultados 2026'),
  1,
  'el asiento de cierre no se duplica'
);

select is(
  (select sum(l.debito - l.credito) from public.asiento_lineas l
   join public.cuentas c on c.id = l.cuenta_id
   join public.asientos a on a.id = l.asiento_id
   where c.codigo = '4101' and a.fecha between '2026-01-01' and '2026-12-31'),
  0.00::numeric,
  'la cuenta 4101 queda en cero al cerrar el año'
);

select is(
  (select sum(l.debito - l.credito) from public.asiento_lineas l
   join public.cuentas c on c.id = l.cuenta_id
   join public.asientos a on a.id = l.asiento_id
   where c.codigo = '6101' and a.fecha between '2026-01-01' and '2026-12-31'),
  0.00::numeric,
  'la cuenta 6101 queda en cero al cerrar el año'
);

insert into _periodos (clave, id)
select 'gasto-menor', public.crear_gasto_menor(jsonb_build_object(
  'fecha', to_char(current_date, 'YYYY-MM-DD'),
  'descripcion', 'Gasto para anulación pgTAP',
  'subtotal', 100,
  'itbis_tasa', 0
));

select ok(
  (select id from _periodos where clave = 'gasto-menor') is not null,
  'se crea el gasto menor para probar la anulación'
);

select is(
  public.cerrar_periodo(date_trunc('month', current_date)::date)::text,
  date_trunc('month', current_date)::date::text,
  'se cierra el mes actual para probar la anulación'
);

select throws_ok(
  format(
    'select public.anular_documento(%L, %L::uuid)',
    'gasto_menor',
    (select id from _periodos where clave = 'gasto-menor')
  ),
  '23514',
  null,
  'un mes cerrado bloquea la anulación de documentos'
);

select public.reabrir_periodo(date_trunc('month', current_date)::date);

select public.cerrar_periodo('2026-05-01'::date);

insert into _periodos (clave, id)
select 'junio', public.crear_asiento_manual(jsonb_build_object(
  'fecha', '2026-06-10',
  'descripcion', 'Asiento de junio con mayo cerrado pgTAP',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '1101'),
      'debito', 50,
      'credito', 0
    ),
    jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '3101'),
      'debito', 0,
      'credito', 50
    )
  )
));

select ok(
  (select id from _periodos where clave = 'junio') is not null,
  'cerrar mayo no bloquea los asientos de junio'
);

select is(
  (select p.estado from public.periodos_contables p where p.periodo = '2026-05-01'::date),
  'cerrado',
  'mayo queda cerrado y junio abierto'
);

select is(
  (select c.asiento_id from public.cierres_resultados c where c.anio = 2026),
  (select id from _periodos where clave = 'cierre'),
  'el cierre del año queda enlazado a su asiento'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"82222222-2222-2222-2222-222222222222","role":"authenticated"}';

select throws_ok(
  format('select public.cerrar_periodo(%L::date)', '2026-07-01'),
  '42501',
  null,
  'lector no puede cerrar periodos'
);

select throws_ok(
  format('select public.cerrar_resultados_anio(%s)', 2026),
  '42501',
  null,
  'lector no puede cerrar resultados del año'
);

select * from finish();
rollback;

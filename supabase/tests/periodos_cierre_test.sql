begin;
select plan(27);

create temp table _periodos (clave text primary key, id uuid) on commit drop;
create temp table _anio (clave text primary key, valor int) on commit drop;
create temp table _saldos (clave text primary key, valor numeric(14,2)) on commit drop;
grant select, insert, update, delete on _periodos to authenticated;
grant select, insert, update, delete on _anio to authenticated;
grant select, insert, update, delete on _saldos to authenticated;

insert into auth.users (id, email) values
  ('81111111-1111-1111-1111-111111111111', 'admin.periodos@prueba.local'),
  ('82222222-2222-2222-2222-222222222222', 'lector.periodos@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('81111111-1111-1111-1111-111111111111', 'Admin periodos', 'admin'),
  ('82222222-2222-2222-2222-222222222222', 'Lector periodos', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"81111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- Usa el año más reciente sin cierre para que los datos reales de la base no
-- cambien los montos esperados (el cierre mueve TODO el año).
insert into _anio (clave, valor)
select 'cierre', coalesce(
  (
    select g.anio
    from generate_series(extract(year from current_date)::int, 2000, -1) as g(anio)
    where not exists (select 1 from public.cierres_resultados c where c.anio = g.anio)
    order by g.anio desc
    limit 1
  ),
  extract(year from current_date)::int
);

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

select public.reabrir_periodo(make_date((select valor from _anio where clave = 'cierre'), 3, 1));
select public.reabrir_periodo(make_date((select valor from _anio where clave = 'cierre'), 4, 1));

insert into _periodos (clave, id)
select 'ingreso', public.crear_asiento_manual(jsonb_build_object(
  'fecha', to_char(make_date((select valor from _anio where clave = 'cierre'), 3, 15), 'YYYY-MM-DD'),
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
  'fecha', to_char(make_date((select valor from _anio where clave = 'cierre'), 4, 10), 'YYYY-MM-DD'),
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

-- Saldos del año antes del cierre. La base puede tener datos reales: se
-- compara contra la diferencia que el cierre debe llevar a cero, no contra
-- montos absolutos del test.
insert into _saldos (clave, valor)
select '4101', round(coalesce(sum(l.debito - l.credito), 0), 2)
from public.asiento_lineas l
join public.cuentas c on c.id = l.cuenta_id
join public.asientos a on a.id = l.asiento_id
where c.codigo = '4101'
  and a.fecha between make_date((select valor from _anio where clave = 'cierre'), 1, 1)
                 and make_date((select valor from _anio where clave = 'cierre'), 12, 31);

insert into _saldos (clave, valor)
select '6101', round(coalesce(sum(l.debito - l.credito), 0), 2)
from public.asiento_lineas l
join public.cuentas c on c.id = l.cuenta_id
join public.asientos a on a.id = l.asiento_id
where c.codigo = '6101'
  and a.fecha between make_date((select valor from _anio where clave = 'cierre'), 1, 1)
                 and make_date((select valor from _anio where clave = 'cierre'), 12, 31);

insert into _saldos (clave, valor)
select 'resultado', round(coalesce(sum(l.debito - l.credito), 0), 2)
from public.asiento_lineas l
join public.cuentas c on c.id = l.cuenta_id
join public.asientos a on a.id = l.asiento_id
where c.tipo in ('ingreso', 'costo', 'gasto')
  and c.acepta_movimientos
  and a.fecha between make_date((select valor from _anio where clave = 'cierre'), 1, 1)
                 and make_date((select valor from _anio where clave = 'cierre'), 12, 31);

select public.reabrir_periodo(make_date((select valor from _anio where clave = 'cierre'), 12, 1));

insert into _periodos (clave, id)
select 'cierre', public.cerrar_resultados_anio((select valor from _anio where clave = 'cierre'));

select ok(
  (select id from _periodos where clave = 'cierre') is not null,
  'cerrar_resultados_anio devuelve el asiento de cierre'
);

select is(
  (select coalesce(sum(l.debito - l.credito), 0)::numeric(14,2) from public.asiento_lineas l
   join public.cuentas c on c.id = l.cuenta_id
   where l.asiento_id = (select id from _periodos where clave = 'cierre') and c.codigo = '4101'),
  -(select valor from _saldos where clave = '4101'),
  'el cierre lleva la cuenta 4101 a cero'
);

select is(
  (select coalesce(sum(l.debito - l.credito), 0)::numeric(14,2) from public.asiento_lineas l
   join public.cuentas c on c.id = l.cuenta_id
   where l.asiento_id = (select id from _periodos where clave = 'cierre') and c.codigo = '6101'),
  -(select valor from _saldos where clave = '6101'),
  'el cierre lleva la cuenta 6101 a cero'
);

select is(
  (select coalesce(sum(l.debito - l.credito), 0)::numeric(14,2) from public.asiento_lineas l
   join public.cuentas c on c.id = l.cuenta_id
   where l.asiento_id = (select id from _periodos where clave = 'cierre') and c.codigo = '3202'),
  -(select valor from _saldos where clave = 'resultado'),
  'la utilidad del ejercicio recibe el resultado del año'
);

select is(
  (select sum(l.debito) - sum(l.credito) from public.asiento_lineas l
   where l.asiento_id = (select id from _periodos where clave = 'cierre')),
  0.00::numeric,
  'el asiento de cierre está cuadrado'
);

select is(
  public.cerrar_resultados_anio((select valor from _anio where clave = 'cierre')),
  (select id from _periodos where clave = 'cierre'),
  'cerrar el mismo año devuelve el asiento existente'
);

select is(
  (select count(*)::int from public.cierres_resultados c
   where c.anio = (select valor from _anio where clave = 'cierre')),
  1,
  'solo hay un cierre de resultados por año'
);

select is(
  (select count(*)::int from public.asientos a
   where a.descripcion = 'Cierre de resultados ' || (select valor from _anio where clave = 'cierre')::text),
  1,
  'el asiento de cierre no se duplica'
);

select is(
  (select sum(l.debito - l.credito) from public.asiento_lineas l
   join public.cuentas c on c.id = l.cuenta_id
   join public.asientos a on a.id = l.asiento_id
   where c.codigo = '4101'
     and a.fecha between make_date((select valor from _anio where clave = 'cierre'), 1, 1)
                    and make_date((select valor from _anio where clave = 'cierre'), 12, 31)),
  0.00::numeric,
  'la cuenta 4101 queda en cero al cerrar el año'
);

select is(
  (select sum(l.debito - l.credito) from public.asiento_lineas l
   join public.cuentas c on c.id = l.cuenta_id
   join public.asientos a on a.id = l.asiento_id
   where c.codigo = '6101'
     and a.fecha between make_date((select valor from _anio where clave = 'cierre'), 1, 1)
                    and make_date((select valor from _anio where clave = 'cierre'), 12, 31)),
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

select public.cerrar_periodo(make_date((select valor from _anio where clave = 'cierre'), 5, 1));
select public.reabrir_periodo(make_date((select valor from _anio where clave = 'cierre'), 6, 1));

insert into _periodos (clave, id)
select 'junio', public.crear_asiento_manual(jsonb_build_object(
  'fecha', to_char(make_date((select valor from _anio where clave = 'cierre'), 6, 10), 'YYYY-MM-DD'),
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
  (select p.estado from public.periodos_contables p
   where p.periodo = make_date((select valor from _anio where clave = 'cierre'), 5, 1)),
  'cerrado',
  'mayo queda cerrado y junio abierto'
);

select is(
  (select c.asiento_id from public.cierres_resultados c
   where c.anio = (select valor from _anio where clave = 'cierre')),
  (select id from _periodos where clave = 'cierre'),
  'el cierre del año queda enlazado a su asiento'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"82222222-2222-2222-2222-222222222222","role":"authenticated"}';

select throws_ok(
  format(
    'select public.cerrar_periodo(%L::date)',
    make_date((select valor from _anio where clave = 'cierre'), 7, 1)
  ),
  '42501',
  null,
  'lector no puede cerrar periodos'
);

select throws_ok(
  format('select public.cerrar_resultados_anio(%s)', (select valor from _anio where clave = 'cierre')),
  '42501',
  null,
  'lector no puede cerrar resultados del año'
);

select * from finish();
rollback;

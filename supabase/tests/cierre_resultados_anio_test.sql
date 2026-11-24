begin;
select plan(15);

-- Auditoría 24-11-2026: el cierre anual solo aplica a ejercicios terminados,
-- marca los 12 meses del año y su asiento no contamina el Estado de
-- Resultados. Además, un año en `cierres_resultados` ya no admite asientos ni
-- reaperturas de meses.

create temp table _anio (clave text primary key, valor int) on commit drop;
create temp table _datos (clave text primary key, valor numeric(14,2)) on commit drop;
create temp table _cierre (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _anio to authenticated;
grant select, insert, update, delete on _datos to authenticated;
grant select, insert, update, delete on _cierre to authenticated;

insert into auth.users (id, email) values
  ('83333333-3333-3333-3333-333333333333', 'admin.cierre@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('83333333-3333-3333-3333-333333333333', 'Admin cierre', 'admin');

set local role authenticated;
set local request.jwt.claims = '{"sub":"83333333-3333-3333-3333-333333333333","role":"authenticated"}';

-- Año terminado más reciente sin cierre: los montos no dependen de datos
-- reales y el año en curso (prohibido) queda fuera.
insert into _anio (clave, valor)
select 'cierre', coalesce(
  (
    select g.anio
    from generate_series(extract(year from current_date)::int - 1, 2000, -1) as g(anio)
    where not exists (select 1 from public.cierres_resultados c where c.anio = g.anio)
    order by g.anio desc
    limit 1
  ),
  extract(year from current_date)::int - 1
);

select throws_ok(
  format('select public.cerrar_resultados_anio(%s)', extract(year from current_date)::int),
  '22023',
  null,
  'cerrar_resultados_anio rechaza el año en curso'
);

select throws_ok(
  format('select public.cerrar_resultados_anio(%s)', extract(year from current_date)::int + 1),
  '22023',
  null,
  'cerrar_resultados_anio rechaza un año futuro'
);

select ok(
  public.crear_asiento_manual(jsonb_build_object(
    'fecha', to_char(make_date((select valor from _anio where clave = 'cierre'), 3, 15), 'YYYY-MM-DD'),
    'descripcion', 'Ingreso para cierre anual pgTAP',
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
  )) is not null,
  'se crea el ingreso del año de prueba'
);

select ok(
  public.crear_asiento_manual(jsonb_build_object(
    'fecha', to_char(make_date((select valor from _anio where clave = 'cierre'), 4, 10), 'YYYY-MM-DD'),
    'descripcion', 'Gasto para cierre anual pgTAP',
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
  )) is not null,
  'se crea el gasto del año de prueba'
);

-- Saldos del P&G antes del cierre. Después del cierre deben ser idénticos: el
-- asiento de cierre no es actividad del período.
insert into _datos (clave, valor)
select 'pg_anio_antes', coalesce(sum(monto), 0)::numeric(14,2)
from public.reporte_estado_resultados(
  make_date((select valor from _anio where clave = 'cierre'), 1, 1),
  make_date((select valor from _anio where clave = 'cierre'), 12, 31)
);

insert into _datos (clave, valor)
select 'pg_centro_antes', coalesce(sum(monto), 0)::numeric(14,2)
from public.reporte_estado_resultados_centro(
  make_date((select valor from _anio where clave = 'cierre'), 1, 1),
  make_date((select valor from _anio where clave = 'cierre'), 12, 31),
  null
);

insert into _datos (clave, valor)
select 'pg_diciembre_antes', coalesce(sum(monto), 0)::numeric(14,2)
from public.reporte_estado_resultados(
  make_date((select valor from _anio where clave = 'cierre'), 12, 1),
  make_date((select valor from _anio where clave = 'cierre'), 12, 31)
);

select is(
  (select valor from _datos where clave = 'pg_anio_antes') > 0,
  true,
  'hay actividad de ingresos y gastos antes del cierre'
);

insert into _cierre (clave, id)
select 'asiento', public.cerrar_resultados_anio((select valor from _anio where clave = 'cierre'));

select ok(
  (select id from _cierre where clave = 'asiento') is not null,
  'cerrar_resultados_anio devuelve el asiento de cierre'
);

select is(
  (
    select count(*)::int
    from public.periodos_contables p
    where p.periodo between make_date((select valor from _anio where clave = 'cierre'), 1, 1)
                        and make_date((select valor from _anio where clave = 'cierre'), 12, 1)
      and p.estado = 'cerrado'
  ),
  12,
  'el cierre anual marca los 12 meses del año'
);

select is(
  (
    select coalesce(sum(monto), 0)::numeric(14,2)
    from public.reporte_estado_resultados(
      make_date((select valor from _anio where clave = 'cierre'), 1, 1),
      make_date((select valor from _anio where clave = 'cierre'), 12, 31)
    )
  ),
  (select valor from _datos where clave = 'pg_anio_antes'),
  'el asiento de cierre no aparece en el Estado de Resultados del año'
);

select is(
  (
    select coalesce(sum(monto), 0)::numeric(14,2)
    from public.reporte_estado_resultados_centro(
      make_date((select valor from _anio where clave = 'cierre'), 1, 1),
      make_date((select valor from _anio where clave = 'cierre'), 12, 31),
      null
    )
  ),
  (select valor from _datos where clave = 'pg_centro_antes'),
  'el asiento de cierre no aparece en el Estado de Resultados por centro'
);

select is(
  (
    select coalesce(sum(monto), 0)::numeric(14,2)
    from public.reporte_estado_resultados(
      make_date((select valor from _anio where clave = 'cierre'), 12, 1),
      make_date((select valor from _anio where clave = 'cierre'), 12, 31)
    )
  ),
  (select valor from _datos where clave = 'pg_diciembre_antes'),
  'el Estado de Resultados de diciembre tampoco muestra el asiento de cierre'
);

-- Se reabren los meses del año cerrado por fuera de la RPC (como haría un
-- administrador con SQL): el trigger debe bloquear igual por cierres_resultados.
reset role;
update public.periodos_contables
set estado = 'abierto', cerrado_en = null, cerrado_por = null
where periodo between make_date((select valor from _anio where clave = 'cierre'), 1, 1)
                  and make_date((select valor from _anio where clave = 'cierre'), 12, 1);

set local role authenticated;
set local request.jwt.claims = '{"sub":"83333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  format(
    'select public.crear_asiento_manual(%L::jsonb)',
    jsonb_build_object(
      'fecha', to_char(make_date((select valor from _anio where clave = 'cierre'), 6, 15), 'YYYY-MM-DD'),
      'descripcion', 'Asiento huérfano en año cerrado pgTAP',
      'lineas', jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', (select id from public.cuentas where codigo = '1101'),
          'debito', 100,
          'credito', 0
        ),
        jsonb_build_object(
          'cuenta_id', (select id from public.cuentas where codigo = '4101'),
          'debito', 0,
          'credito', 100
        )
      )
    )::text
  ),
  '23514',
  null,
  'un año en cierres_resultados bloquea asientos aunque sus meses estén abiertos'
);

select throws_ok(
  format(
    'select public.reabrir_periodo(%L::date)',
    make_date((select valor from _anio where clave = 'cierre'), 6, 1)
  ),
  '23514',
  null,
  'no se puede reabrir un mes de un año con resultados cerrados'
);

reset role;
update public.periodos_contables
set estado = 'cerrado', cerrado_en = now(), cerrado_por = null
where periodo between make_date((select valor from _anio where clave = 'cierre'), 1, 1)
                  and make_date((select valor from _anio where clave = 'cierre'), 12, 1);

set local role authenticated;
set local request.jwt.claims = '{"sub":"83333333-3333-3333-3333-333333333333","role":"authenticated"}';

select is(
  public.cerrar_resultados_anio((select valor from _anio where clave = 'cierre')),
  (select id from _cierre where clave = 'asiento'),
  'cerrar el mismo año devuelve el asiento existente'
);

select is(
  (select a.origen_tipo from public.asientos a where a.id = (select id from _cierre where clave = 'asiento')),
  'manual',
  'el asiento de cierre conserva origen manual (compatible con anular_documento)'
);

select ok(
  (
    select count(*) >= 3
    from public.asiento_lineas l
    where l.asiento_id = (select id from _cierre where clave = 'asiento')
  ),
  'el asiento de cierre conserva sus líneas en el libro diario'
);

select * from finish();
rollback;

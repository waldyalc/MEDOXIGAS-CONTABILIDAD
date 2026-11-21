-- Catálogos de Nómina: el candado de escritura.
--
-- La migración 20261125150000 revoca INSERT/UPDATE/DELETE directo de
-- `authenticated` en los cuatro catálogos y elimina la política FOR ALL del
-- admin. Toda mutación debe pasar por las RPC `security definer` de
-- 20261125140000. Este test lo verifica como admin, contador y lector, y
-- comprueba que las RPC siguen funcionando igual.

begin;
select plan(23);

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

insert into auth.users (id, email) values
  ('e1111111-1111-1111-1111-111111111111', 'admin.rlsnomina@prueba.local'),
  ('e2222222-2222-2222-2222-222222222222', 'contador.rlsnomina@prueba.local'),
  ('e3333333-3333-3333-3333-333333333333', 'lector.rlsnomina@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('e1111111-1111-1111-1111-111111111111', 'Admin RLS nómina', 'admin'),
  ('e2222222-2222-2222-2222-222222222222', 'Contador RLS nómina', 'contador'),
  ('e3333333-3333-3333-3333-333333333333', 'Lector RLS nómina', 'lector');

-- ---------------------------------------------------------------------------
-- Privilegios y políticas: solo SELECT, sin política FOR ALL
-- ---------------------------------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'public.nomina_parametros_rd', 'SELECT'),
  'authenticated conserva SELECT en nomina_parametros_rd'
);
select ok(
  has_table_privilege('authenticated', 'public.nomina_config_empresa', 'SELECT'),
  'authenticated conserva SELECT en nomina_config_empresa'
);
select ok(
  has_table_privilege('authenticated', 'public.nomina_conceptos', 'SELECT'),
  'authenticated conserva SELECT en nomina_conceptos'
);
select ok(
  has_table_privilege('authenticated', 'public.nomina_mapeo_contable', 'SELECT'),
  'authenticated conserva SELECT en nomina_mapeo_contable'
);

select ok(
  not has_table_privilege('authenticated', 'public.nomina_parametros_rd', 'INSERT'),
  'authenticated no puede INSERT directo en nomina_parametros_rd'
);
select ok(
  not has_table_privilege('authenticated', 'public.nomina_config_empresa', 'UPDATE'),
  'authenticated no puede UPDATE directo en nomina_config_empresa'
);
select ok(
  not has_table_privilege('authenticated', 'public.nomina_conceptos', 'INSERT'),
  'authenticated no puede INSERT directo en nomina_conceptos'
);
select ok(
  not has_table_privilege('authenticated', 'public.nomina_mapeo_contable', 'DELETE'),
  'authenticated no puede DELETE directo en nomina_mapeo_contable'
);

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'nomina_parametros_rd',
        'nomina_config_empresa',
        'nomina_conceptos',
        'nomina_mapeo_contable'
      )
      and cmd = 'ALL'
  ),
  0,
  'no quedan políticas FOR ALL en los catálogos'
);

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'nomina_parametros_rd',
        'nomina_config_empresa',
        'nomina_conceptos',
        'nomina_mapeo_contable'
      )
      and policyname like '%_admin_escritura'
  ),
  0,
  'la política *_admin_escritura fue eliminada'
);

-- ---------------------------------------------------------------------------
-- Admin: lectura sí, escritura directa no
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"e1111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  'select count(*) from public.nomina_parametros_rd',
  'el admin lee nomina_parametros_rd'
);

select throws_ok(
  'insert into public.nomina_conceptos (codigo, nombre, clase, es_sistema, activo) values (''RLS_TEST'', ''RLS'', ''ingreso'', false, true)',
  '42501',
  null,
  'el admin no puede INSERT directo en nomina_conceptos'
);

select throws_ok(
  'update public.nomina_parametros_rd set salario_minimo = 1',
  '42501',
  null,
  'el admin no puede UPDATE directo en nomina_parametros_rd'
);

select throws_ok(
  'update public.nomina_config_empresa set riesgo_laboral = ''tipo_1''',
  '42501',
  null,
  'el admin no puede UPDATE directo en nomina_config_empresa'
);

select throws_ok(
  'delete from public.nomina_mapeo_contable',
  '42501',
  null,
  'el admin no puede DELETE directo en nomina_mapeo_contable'
);

-- ---------------------------------------------------------------------------
-- Las RPC siguen funcionando (admin)
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'concepto_salario', c.id
from public.nomina_conceptos c
where c.codigo = 'SALARIO';

select lives_ok(
  format(
    $q$select public.nomina_actualizar_concepto(%L::uuid, %L::jsonb)$q$,
    (select id from _ids where clave = 'concepto_salario'),
    jsonb_build_object('nombre', 'Salario base')
  ),
  'la RPC nomina_actualizar_concepto sigue editando como admin'
);

select is(
  (
    select nombre
    from public.nomina_conceptos
    where codigo = 'SALARIO'
  ),
  'Salario base',
  'el cambio de la RPC quedó guardado'
);

select lives_ok(
  format(
    $q$select public.nomina_guardar_config_empresa(%L::jsonb)$q$,
    jsonb_build_object(
      'riesgo_laboral', 'tipo_2',
      'categoria_empresa', 'mediana',
      'aplica_infotep', true,
      'frecuencia_defecto', 'quincenal',
      'registrar_provisiones', false,
      'cuenta_pago_defecto_id', (select id from public.cuentas where codigo = '1101'),
      'cuenta_salarios_por_pagar_id', (select id from public.cuentas where codigo = '2107')
    )
  ),
  'la RPC nomina_guardar_config_empresa sigue guardando como admin'
);

select is(
  (
    select frecuencia_defecto
    from public.nomina_config_empresa
    where id = 1
  ),
  'quincenal',
  'la configuración guardada por la RPC se lee de vuelta'
);

-- ---------------------------------------------------------------------------
-- Contador y lector: sin escritura directa ni por RPC
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"e2222222-2222-2222-2222-222222222222","role":"authenticated"}';

select throws_ok(
  'update public.nomina_conceptos set activo = false',
  '42501',
  null,
  'el contador tampoco puede UPDATE directo en nomina_conceptos'
);

select throws_ok(
  format(
    $q$select public.nomina_actualizar_concepto(%L::uuid, %L::jsonb)$q$,
    (select id from _ids where clave = 'concepto_salario'),
    jsonb_build_object('nombre', 'Otra cosa')
  ),
  '42501',
  null,
  'el contador recibe 42501 al intentar la RPC de conceptos'
);

set local request.jwt.claims = '{"sub":"e3333333-3333-3333-3333-333333333333","role":"authenticated"}';

select lives_ok(
  'select count(*) from public.nomina_conceptos',
  'el lector lee nomina_conceptos'
);

select throws_ok(
  'insert into public.nomina_mapeo_contable (segmento, concepto_id) values (''administrativa'', gen_random_uuid())',
  '42501',
  null,
  'el lector no puede INSERT directo en nomina_mapeo_contable'
);

select * from finish();
rollback;

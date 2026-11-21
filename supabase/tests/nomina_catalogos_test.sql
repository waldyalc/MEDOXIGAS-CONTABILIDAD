-- Nómina RD (fase 3A): catálogos, configuración, mapeo contable, empleados y
-- novedades recurrentes. Contrato: docs/dominio-nomina.md §2 y §3.1–3.2.
--
-- No cubre periodos, recibos, cálculo ni pagos: eso es la fase 3B.

begin;
select plan(53);

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

insert into auth.users (id, email) values
  ('91111111-1111-1111-1111-111111111111', 'admin.nomina3a@prueba.local'),
  ('92222222-2222-2222-2222-222222222222', 'contador.nomina3a@prueba.local'),
  ('93333333-3333-3333-3333-333333333333', 'lector.nomina3a@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('91111111-1111-1111-1111-111111111111', 'Admin nómina 3A', 'admin'),
  ('92222222-2222-2222-2222-222222222222', 'Contador nómina 3A', 'contador'),
  ('93333333-3333-3333-3333-333333333333', 'Lector nómina 3A', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"91111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Parámetros RD 2026
-- ---------------------------------------------------------------------------

select is(
  (select salario_minimo from public.nomina_parametros_rd where anio = 2026),
  23223.00::numeric,
  'el salario mínimo 2026 es 23,223.00'
);

select is(
  (select tasa_sfs_empleado from public.nomina_parametros_rd where anio = 2026),
  3.040::numeric,
  'SFS empleado 2026 = 3.040 %'
);

select is(
  (select tasa_sfs_empleador from public.nomina_parametros_rd where anio = 2026),
  7.090::numeric,
  'SFS empleador 2026 = 7.090 %'
);

select is(
  (select tope_sfs_mensual from public.nomina_parametros_rd where anio = 2026),
  232230.00::numeric,
  'el tope mensual SFS 2026 es 10 salarios mínimos (232,230.00)'
);

select is(
  (select tasa_afp_empleado from public.nomina_parametros_rd where anio = 2026),
  2.870::numeric,
  'AFP empleado 2026 = 2.870 %'
);

select is(
  (select tasa_afp_empleador from public.nomina_parametros_rd where anio = 2026),
  7.100::numeric,
  'AFP empleador 2026 = 7.100 %'
);

select is(
  (select tope_afp_mensual from public.nomina_parametros_rd where anio = 2026),
  464460.00::numeric,
  'el tope mensual AFP 2026 es 20 salarios mínimos (464,460.00)'
);

select is(
  (select tope_srl_mensual from public.nomina_parametros_rd where anio = 2026),
  92892.00::numeric,
  'el tope mensual SRL 2026 es 4 salarios mínimos (92,892.00)'
);

select ok(
  (select tasa_srl_tipo_1 = 1.100
      and tasa_srl_tipo_2 = 1.150
      and tasa_srl_tipo_3 = 1.250
      and tasa_srl_tipo_4 = 1.300
   from public.nomina_parametros_rd where anio = 2026),
  'las tasas SRL 2026 son 1.10 / 1.15 / 1.25 / 1.30'
);

select is(
  (select tasa_infotep from public.nomina_parametros_rd where anio = 2026),
  1.000::numeric,
  'INFOTEP 2026 = 1.000 %'
);

select is(
  (select dias_mes_laboral from public.nomina_parametros_rd where anio = 2026),
  23.830::numeric,
  'el mes laboral 2026 tiene 23.830 días'
);

select is(
  (select horas_dia_laboral from public.nomina_parametros_rd where anio = 2026),
  8.000::numeric,
  'la jornada laboral 2026 tiene 8 horas'
);

select is(
  (select escala_isr_anual from public.nomina_parametros_rd where anio = 2026),
  '[
    { "desde": 0.00, "hasta": 416220.00, "tasa": 0.00, "monto_fijo": 0.00 },
    { "desde": 416220.00, "hasta": 624329.00, "tasa": 15.00, "monto_fijo": 0.00 },
    { "desde": 624329.00, "hasta": 867123.00, "tasa": 20.00, "monto_fijo": 31216.35 },
    { "desde": 867123.00, "hasta": null, "tasa": 25.00, "monto_fijo": 79775.15 }
  ]'::jsonb,
  'la escala ISR 2026 tiene los 4 tramos DGII exactos'
);

select is(
  (select count(*)::int from public.nomina_parametros_rd where anio = 2026),
  1,
  'la migración siembra una sola fila de parámetros para 2026'
);

-- ---------------------------------------------------------------------------
-- Configuración de la empresa
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.nomina_config_empresa),
  1,
  'existe una sola configuración de empresa'
);

select ok(
  (select riesgo_laboral = 'tipo_1'
      and categoria_empresa = 'pequena'
      and aplica_infotep
      and frecuencia_defecto = 'quincenal'
      and not registrar_provisiones
   from public.nomina_config_empresa where id = 1),
  'la configuración nace con los defaults de empresa'
);

select ok(
  exists (
    select 1
    from public.nomina_config_empresa n
    join public.cuentas cp
      on cp.id = n.cuenta_pago_defecto_id and cp.codigo = '1102'
    join public.cuentas cs
      on cs.id = n.cuenta_salarios_por_pagar_id and cs.codigo = '2107'
    where n.id = 1
  ),
  'la configuración apunta a Banco principal (1102) y Salarios por pagar (2107)'
);

select ok(
  (select contacto_tss_id is not null
      and contacto_infotep_id is not null
      and contacto_dgii_id is not null
   from public.nomina_config_empresa where id = 1),
  'la configuración nace con los contactos TSS, INFOTEP y DGII'
);

-- ---------------------------------------------------------------------------
-- Conceptos
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.nomina_conceptos),
  40,
  'la migración siembra 40 conceptos de nómina'
);

select is(
  (select count(*)::int from public.nomina_conceptos where clase = 'ingreso'),
  18,
  'son 18 ingresos'
);

select is(
  (select count(*)::int from public.nomina_conceptos where clase = 'deduccion'),
  15,
  'son 15 deducciones'
);

select is(
  (select count(*)::int from public.nomina_conceptos where clase = 'aporte_empleador'),
  4,
  'son 4 aportes patronales'
);

select is(
  (select count(*)::int from public.nomina_conceptos where clase = 'provision'),
  3,
  'son 3 provisiones'
);

select ok(
  (select bool_and(es_sistema) from public.nomina_conceptos),
  'los 40 conceptos sembrados son de sistema'
);

select ok(
  not exists (
    select 1
    from public.nomina_conceptos
    where clase <> 'ingreso'
      and (grava_tss or grava_isr or grava_infotep)
  ),
  'solo los ingresos pueden gravar TSS, ISR o INFOTEP'
);

reset role;
select throws_ok(
  $$insert into public.nomina_conceptos (codigo, nombre, clase)
    values ('SALARIO', 'Salario duplicado', 'ingreso')$$,
  '23505',
  null,
  'el código de concepto es único'
);
set local role authenticated;
set local request.jwt.claims = '{"sub":"91111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Mapeo contable
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.nomina_mapeo_contable),
  120,
  'la migración siembra 40 conceptos × 3 segmentos = 120 mapeos'
);

select is(
  (
    select count(*)::int
    from (
      select distinct segmento, concepto_id
      from public.nomina_mapeo_contable
    ) d
  ),
  120,
  'el mapeo es único por segmento y concepto'
);

select ok(
  not exists (
    select 1
    from public.nomina_mapeo_contable m
    join public.nomina_conceptos c on c.id = m.concepto_id
    where c.clase = 'ingreso'
      and (m.cuenta_gasto_id is null or m.cuenta_pasivo_id is not null)
  ),
  'cada ingreso mapea solo cuenta de gasto'
);

select ok(
  not exists (
    select 1
    from public.nomina_mapeo_contable m
    join public.nomina_conceptos c on c.id = m.concepto_id
    where c.clase = 'deduccion'
      and (m.cuenta_pasivo_id is null or m.cuenta_gasto_id is not null)
  ),
  'cada deducción mapea solo cuenta de pasivo'
);

select ok(
  not exists (
    select 1
    from public.nomina_mapeo_contable m
    join public.nomina_conceptos c on c.id = m.concepto_id
    where c.clase in ('aporte_empleador', 'provision')
      and (m.cuenta_gasto_id is null or m.cuenta_pasivo_id is null)
  ),
  'cada aporte patronal y provisión mapea gasto y pasivo'
);

reset role;
select throws_ok(
  format(
    $q$insert into public.nomina_mapeo_contable (
      segmento, concepto_id, cuenta_gasto_id
    ) values (
      'administrativa', %L,
      (select id from public.cuentas where codigo = '6110')
    )$q$,
    (select id from public.nomina_conceptos where codigo = 'SALARIO')::text
  ),
  '23505',
  null,
  'el mapeo no admite dos filas del mismo segmento y concepto'
);
set local role authenticated;
set local request.jwt.claims = '{"sub":"91111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Cuentas y contactos sembrados
-- ---------------------------------------------------------------------------

select ok(
  exists (
    select 1 from public.cuentas
    where codigo = '6110' and tipo = 'gasto'
      and acepta_movimientos and activa
  )
  and exists (
    select 1 from public.cuentas
    where codigo = '2107' and tipo = 'pasivo'
      and acepta_movimientos and activa
  ),
  'las cuentas 6110 y 2107 son de detalle y del tipo correcto'
);

select is(
  (
    select count(*)::int
    from public.cuentas
    where codigo in (
      '6110', '6111', '6112', '6113', '6114', '6115', '6116', '6117',
      '6118', '6119', '6120', '6121', '6122', '6123',
      '2107', '2108', '2109', '2110', '2111', '2112', '2113', '2114',
      '2115', '2116', '2117', '2118'
    )
  ),
  26,
  'la migración siembra las 26 cuentas contables de nómina'
);

select is(
  (
    select count(*)::int
    from public.contactos
    where lower(nombre) in (
      lower('Tesorería de la Seguridad Social (TSS)'),
      lower('Instituto Nacional de Formación Técnico Profesional (INFOTEP)'),
      lower('Dirección General de Impuestos Internos (DGII)')
    )
  ),
  3,
  'la migración siembra los contactos de TSS, INFOTEP y DGII'
);

-- Las tablas operativas no tienen grant de escritura: se prueban como el
-- dueño (postgres), igual que hará la RPC security definer de 3B.
reset role;

-- ---------------------------------------------------------------------------
-- Empleados
-- ---------------------------------------------------------------------------

with c as (
  insert into public.contactos (tipo, nombre, tipo_identificacion, rnc_cedula)
  values ('ambos', 'Empleado pgTAP 3A', 'cedula', '00113918205')
  returning id
)
insert into _ids (clave, id)
select 'contacto_empleado', id from c;

with e as (
  insert into public.empleados (
    contacto_id, tipo_identificacion, identificacion, primer_nombre,
    primer_apellido, correo, fecha_ingreso, frecuencia_pago, salario_mensual
  )
  select
    id, 'cedula', '00113918205', 'Ana', 'Pérez',
    'ana.perez@prueba.local', '2026-01-15', 'quincenal', 60000.00
  from _ids
  where clave = 'contacto_empleado'
  returning id
)
insert into _ids (clave, id)
select 'empleado', id from e;

select ok(
  exists (
    select 1
    from public.empleados e
    join public.contactos c on c.id = e.contacto_id
    where e.id = (select id from _ids where clave = 'empleado')
      and c.rnc_cedula = '00113918205'
  ),
  'el empleado queda vinculado a su contacto'
);

with c as (
  insert into public.contactos (tipo, nombre, tipo_identificacion)
  values ('ambos', 'Empleado cédula inválida pgTAP 3A', 'cedula')
  returning id
)
insert into _ids (clave, id)
select 'contacto_invalido', id from c;

select throws_ok(
  format(
    $q$insert into public.empleados (
      contacto_id, tipo_identificacion, identificacion, primer_nombre,
      primer_apellido, fecha_ingreso, frecuencia_pago, salario_mensual
    ) values (
      %L, 'cedula', '00113918204', 'Luis', 'Gómez',
      '2026-02-01', 'mensual', 50000
    )$q$,
    (select id from _ids where clave = 'contacto_invalido')::text
  ),
  '23514',
  null,
  'una cédula con dígito verificador errado se rechaza'
);

with c as (
  insert into public.contactos (tipo, nombre, tipo_identificacion, rnc_cedula)
  values ('ambos', 'Empleado pasaporte pgTAP 3A', 'pasaporte', 'AB12345')
  returning id
), e as (
  insert into public.empleados (
    contacto_id, tipo_identificacion, identificacion, primer_nombre,
    primer_apellido, fecha_ingreso, frecuencia_pago, salario_mensual
  )
  select id, 'pasaporte', 'AB12345', 'María', 'Santos',
    '2026-03-01', 'mensual', 45000
  from c
  returning id
)
insert into _ids (clave, id)
select 'empleado_pasaporte', id from e;

select is(
  (
    select tipo_identificacion
    from public.empleados
    where id = (select id from _ids where clave = 'empleado_pasaporte')
  ),
  'pasaporte',
  'el pasaporte se acepta sin validar dígito verificador'
);

select throws_ok(
  format(
    $q$insert into public.empleados (
      contacto_id, tipo_identificacion, identificacion, primer_nombre,
      primer_apellido, fecha_ingreso, frecuencia_pago, salario_mensual,
      tipo_contrato
    ) values (
      %L, 'pasaporte', 'CD67890', 'Pedro', 'Ruiz',
      '2026-04-01', 'mensual', 40000, 'definido'
    )$q$,
    (select id from _ids where clave = 'contacto_invalido')::text
  ),
  '23514',
  null,
  'un contrato definido exige fecha_fin'
);

-- ---------------------------------------------------------------------------
-- Novedades recurrentes
-- ---------------------------------------------------------------------------

with n as (
  insert into public.empleado_novedades_recurrentes (
    empleado_id, concepto_id, monto, fecha_inicio
  )
  select
    (select id from _ids where clave = 'empleado'),
    c.id,
    1500.00,
    '2026-01-01'
  from public.nomina_conceptos c
  where c.codigo = 'PRESTAMO'
  returning id
)
insert into _ids (clave, id)
select 'novedad', id from n;

select ok(
  exists (
    select 1
    from public.empleado_novedades_recurrentes n
    join public.nomina_conceptos c on c.id = n.concepto_id
    where n.id = (select id from _ids where clave = 'novedad')
      and c.codigo = 'PRESTAMO'
      and n.monto = 1500.00
  ),
  'la novedad recurrente guarda empleado, concepto y monto'
);

select throws_ok(
  format(
    $q$insert into public.empleado_novedades_recurrentes (
      empleado_id, concepto_id, monto, fecha_inicio
    ) values (%L, %L, 100, '2026-01-01')$q$,
    (select id from _ids where clave = 'empleado')::text,
    gen_random_uuid()::text
  ),
  '23503',
  null,
  'una novedad con concepto inexistente la rechaza la llave foránea'
);

select throws_ok(
  format(
    $q$insert into public.empleado_novedades_recurrentes (
      empleado_id, concepto_id, fecha_inicio
    ) values (
      %L,
      (select id from public.nomina_conceptos where codigo = 'PRESTAMO'),
      '2026-01-01'
    )$q$,
    (select id from _ids where clave = 'empleado')::text
  ),
  '23514',
  null,
  'una novedad exige monto o porcentaje, no ambos ni ninguno'
);

-- ---------------------------------------------------------------------------
-- Configuración única y check de asientos
-- ---------------------------------------------------------------------------

reset role;
select throws_ok(
  $$insert into public.nomina_config_empresa (id) values (2)$$,
  '23514',
  null,
  'solo puede existir la configuración id = 1'
);

insert into public.asientos (fecha, descripcion, origen_tipo, total)
values
  (current_date, 'Prueba nómina pgTAP 3A', 'nomina', 0),
  (current_date, 'Prueba pago nómina pgTAP 3A', 'pago_nomina', 0),
  (current_date, 'Prueba factura pgTAP 3A', 'factura', 0);

select is(
  (
    select count(*)::int
    from public.asientos
    where descripcion like 'Prueba % pgTAP 3A'
  ),
  3,
  'el check de asientos acepta nomina y pago_nomina sin perder factura'
);

select throws_ok(
  $$insert into public.asientos (descripcion, origen_tipo)
    values ('Prueba origen inválido pgTAP 3A', 'nomina_x')$$,
  '23514',
  null,
  'un origen de asiento desconocido se rechaza'
);

-- ---------------------------------------------------------------------------
-- RLS y permisos
-- ---------------------------------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'public.nomina_parametros_rd', 'SELECT')
  and has_table_privilege('authenticated', 'public.nomina_config_empresa', 'SELECT')
  and has_table_privilege('authenticated', 'public.nomina_conceptos', 'SELECT')
  and has_table_privilege('authenticated', 'public.nomina_mapeo_contable', 'SELECT')
  and has_table_privilege('authenticated', 'public.empleados', 'SELECT')
  and has_table_privilege('authenticated', 'public.empleado_novedades_recurrentes', 'SELECT'),
  'authenticated puede leer los catálogos y las tablas de nómina'
);

select ok(
  not has_table_privilege('authenticated', 'public.empleados', 'INSERT')
  and not has_table_privilege('authenticated', 'public.empleados', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.empleados', 'DELETE')
  and not has_table_privilege('authenticated', 'public.empleado_novedades_recurrentes', 'INSERT')
  and not has_table_privilege('authenticated', 'public.empleado_novedades_recurrentes', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.empleado_novedades_recurrentes', 'DELETE'),
  'las tablas operativas solo se escriben por RPC security definer'
);

select ok(
  not has_table_privilege('authenticated', 'public.nomina_parametros_rd', 'INSERT')
  and not has_table_privilege('authenticated', 'public.nomina_parametros_rd', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.nomina_config_empresa', 'INSERT')
  and not has_table_privilege('authenticated', 'public.nomina_config_empresa', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.nomina_conceptos', 'INSERT')
  and not has_table_privilege('authenticated', 'public.nomina_conceptos', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.nomina_mapeo_contable', 'INSERT')
  and not has_table_privilege('authenticated', 'public.nomina_mapeo_contable', 'UPDATE'),
  'los catálogos solo se escriben por RPC security definer'
);

select ok(
  not has_table_privilege('anon', 'public.nomina_parametros_rd', 'SELECT')
  and not has_table_privilege('anon', 'public.nomina_config_empresa', 'SELECT')
  and not has_table_privilege('anon', 'public.nomina_conceptos', 'SELECT')
  and not has_table_privilege('anon', 'public.nomina_mapeo_contable', 'SELECT')
  and not has_table_privilege('anon', 'public.empleados', 'SELECT')
  and not has_table_privilege('anon', 'public.empleado_novedades_recurrentes', 'SELECT'),
  'anon no ve nada de nómina'
);

-- Los parámetros de 2027 se siembran como dueño: la escritura directa de los
-- catálogos quedó cerrada en 20261125150000 (el admin usa la RPC).
reset role;

insert into public.nomina_parametros_rd (
  anio,
  salario_minimo,
  tasa_sfs_empleado,
  tasa_sfs_empleador,
  tope_sfs_mensual,
  tasa_afp_empleado,
  tasa_afp_empleador,
  tope_afp_mensual,
  tope_srl_mensual,
  tasa_srl_tipo_1,
  tasa_srl_tipo_2,
  tasa_srl_tipo_3,
  tasa_srl_tipo_4,
  tasa_infotep,
  dias_mes_laboral,
  horas_dia_laboral,
  escala_isr_anual
)
values (
  2027,
  23223.00,
  3.040,
  7.090,
  232230.00,
  2.870,
  7.100,
  464460.00,
  92892.00,
  1.100,
  1.150,
  1.250,
  1.300,
  1.000,
  23.830,
  8.000,
  (select escala_isr_anual from public.nomina_parametros_rd where anio = 2026)
);

select is(
  (select count(*)::int from public.nomina_parametros_rd where anio = 2027),
  1,
  'el dueño siembra los parámetros de un año nuevo'
);

reset role;

-- ---------------------------------------------------------------------------
-- Lector: lee, no escribe
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"93333333-3333-3333-3333-333333333333","role":"authenticated"}';

select is(
  (select count(*)::int from public.nomina_conceptos),
  40,
  'un lector puede leer los conceptos de nómina'
);

select throws_ok(
  $$insert into public.nomina_conceptos (codigo, nombre, clase)
    values ('LECTOR_NO', 'No debería entrar', 'ingreso')$$,
  '42501',
  null,
  'un lector no puede escribir los catálogos'
);

reset role;
set local role anon;

select throws_ok(
  'select count(*) from public.nomina_conceptos',
  '42501',
  null,
  'anon no lee los catálogos de nómina'
);

select * from finish();
rollback;

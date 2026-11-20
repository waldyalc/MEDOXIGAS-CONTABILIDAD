-- Nómina RD (fase 3D/3E): RPC de configuración, conceptos, empleados,
-- novedades recurrentes y agregar empleados a un periodo.
--
-- Contrato: docs/dominio-nomina.md §6.2–6.4 y el brief de la tarea.
-- Cubre: upserts de configuración/mapeo/parámetros, alta y edición de
-- conceptos, cédula normalizada y validada, unicidad, reglas del cambio de
-- estado, XOR de novedades, borrado protegido, agregar/revivir recibos sin
-- duplicar, RLS y el 42501 del lector.

begin;
select plan(84);

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

-- Helpers del test: arman el payload que envía `src/lib/nomina/acciones.ts`.
create function pg_temp.empleado_json(
  p_tipo text,
  p_identificacion text,
  p_primer_nombre text,
  p_primer_apellido text,
  p_segmento text,
  p_fecha_ingreso date,
  p_frecuencia text,
  p_salario text
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'tipo_identificacion', p_tipo,
    'identificacion', p_identificacion,
    'primer_nombre', p_primer_nombre,
    'primer_apellido', p_primer_apellido,
    'segmento_contable', p_segmento,
    'fecha_ingreso', p_fecha_ingreso,
    'frecuencia_pago', p_frecuencia,
    'salario_mensual', p_salario,
    'metodo_pago', 'efectivo'
  );
$$;

create function pg_temp.parametros_json(p_anio int, p_salario text)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'anio', p_anio,
    'salario_minimo', p_salario,
    'tasa_sfs_empleado', '3.040',
    'tasa_sfs_empleador', '7.090',
    'tope_sfs_mensual', '232230.00',
    'tasa_afp_empleado', '2.870',
    'tasa_afp_empleador', '7.100',
    'tope_afp_mensual', '464460.00',
    'tope_srl_mensual', '92892.00',
    'tasa_srl_tipo_1', '1.100',
    'tasa_srl_tipo_2', '1.150',
    'tasa_srl_tipo_3', '1.250',
    'tasa_srl_tipo_4', '1.300',
    'tasa_infotep', '1.000',
    'dias_mes_laboral', '23.830',
    'horas_dia_laboral', '8.000',
    'escala_isr_anual', jsonb_build_array(
      jsonb_build_object('desde', '0.00', 'hasta', '416220.00', 'tasa', '0.000', 'monto_fijo', '0.00'),
      jsonb_build_object('desde', '416220.00', 'hasta', '624329.00', 'tasa', '15.000', 'monto_fijo', '0.00'),
      jsonb_build_object('desde', '624329.00', 'hasta', '867123.00', 'tasa', '20.000', 'monto_fijo', '31216.35'),
      jsonb_build_object('desde', '867123.00', 'hasta', null, 'tasa', '25.000', 'monto_fijo', '79775.15')
    )
  );
$$;

insert into auth.users (id, email) values
  ('d1111111-1111-1111-1111-111111111111', 'admin.nomina3d@prueba.local'),
  ('d2222222-2222-2222-2222-222222222222', 'contador.nomina3d@prueba.local'),
  ('d3333333-3333-3333-3333-333333333333', 'lector.nomina3d@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('d1111111-1111-1111-1111-111111111111', 'Admin nómina 3D', 'admin'),
  ('d2222222-2222-2222-2222-222222222222', 'Contador nómina 3D', 'contador'),
  ('d3333333-3333-3333-3333-333333333333', 'Lector nómina 3D', 'lector');

-- Año 2025 cerrado: los parámetros de ese año no se pueden editar.
insert into public.periodos_contables (periodo, estado, cerrado_en)
values ('2025-01-01', 'cerrado', now())
on conflict (periodo) do update set estado = 'cerrado';

set local role authenticated;
set local request.jwt.claims = '{"sub":"d1111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Configuración de la empresa
-- ---------------------------------------------------------------------------

select lives_ok(
  format(
    $q$select public.nomina_guardar_config_empresa(%L::jsonb)$q$,
    jsonb_build_object(
      'riesgo_laboral', 'tipo_2',
      'categoria_empresa', 'mediana',
      'aplica_infotep', false,
      'frecuencia_defecto', 'mensual',
      'registrar_provisiones', true,
      'cuenta_pago_defecto_id', (select id from public.cuentas where codigo = '1101'),
      'cuenta_salarios_por_pagar_id', (select id from public.cuentas where codigo = '2107')
    )
  ),
  'el admin guarda la configuración de nómina'
);

select ok(
  (
    select riesgo_laboral = 'tipo_2'
      and categoria_empresa = 'mediana'
      and not aplica_infotep
      and frecuencia_defecto = 'mensual'
      and registrar_provisiones
      and cuenta_pago_defecto_id = (select id from public.cuentas where codigo = '1101')
      and cuenta_salarios_por_pagar_id = (select id from public.cuentas where codigo = '2107')
    from public.nomina_config_empresa
    where id = 1
  ),
  'la configuración parcial se guarda completa'
);

select ok(
  (
    select contacto_tss_id is not null
      and contacto_infotep_id is not null
      and contacto_dgii_id is not null
    from public.nomina_config_empresa
    where id = 1
  ),
  'la actualización parcial no borra los contactos TSS, INFOTEP y DGII'
);

select throws_ok(
  $q$select public.nomina_guardar_config_empresa('{"riesgo_laboral":"tipo_9"}'::jsonb)$q$,
  '22023',
  null,
  'un riesgo laboral inválido se rechaza'
);

select throws_ok(
  format(
    $q$select public.nomina_guardar_config_empresa(%L::jsonb)$q$,
    jsonb_build_object('cuenta_pago_defecto_id', (select id from public.cuentas where codigo = '6110'))
  ),
  '22023',
  null,
  'la cuenta de pago por defecto debe ser de caja o banco'
);

select throws_ok(
  format(
    $q$select public.nomina_guardar_config_empresa(%L::jsonb)$q$,
    jsonb_build_object('cuenta_salarios_por_pagar_id', (select id from public.cuentas where codigo = '1102'))
  ),
  '22023',
  null,
  'la cuenta de salarios por pagar debe ser de pasivo'
);

-- ---------------------------------------------------------------------------
-- Mapeo contable
-- ---------------------------------------------------------------------------

select is(
  public.nomina_guardar_mapeo_contable(
    jsonb_build_object(
      'mapeos', jsonb_build_array(
        jsonb_build_object(
          'segmento', 'ventas',
          'concepto_id', (select id from public.nomina_conceptos where codigo = 'SALARIO'),
          'cuenta_gasto_id', (select id from public.cuentas where codigo = '6112')
        )
      )
    )
  ),
  1,
  'guardar un mapeo devuelve cuántas filas guardó'
);

select ok(
  exists (
    select 1
    from public.nomina_mapeo_contable m
    join public.cuentas c on c.id = m.cuenta_gasto_id
    where m.segmento = 'ventas'
      and m.concepto_id = (select id from public.nomina_conceptos where codigo = 'SALARIO')
      and c.codigo = '6112'
      and m.cuenta_pasivo_id is null
  ),
  'el mapeo hace upsert por segmento y concepto'
);

select throws_ok(
  format(
    $q$select public.nomina_guardar_mapeo_contable(%L::jsonb)$q$,
    jsonb_build_object(
      'mapeos', jsonb_build_array(
        jsonb_build_object(
          'segmento', 'operativa',
          'concepto_id', (select id from public.nomina_conceptos where codigo = 'SALARIO'),
          'cuenta_gasto_id', (select id from public.cuentas where codigo = '6110'),
          'cuenta_pasivo_id', (select id from public.cuentas where codigo = '2107')
        )
      )
    )
  ),
  '22023',
  null,
  'un ingreso no lleva cuenta de pasivo'
);

select throws_ok(
  format(
    $q$select public.nomina_guardar_mapeo_contable(%L::jsonb)$q$,
    jsonb_build_object(
      'mapeos', jsonb_build_array(
        jsonb_build_object(
          'segmento', 'operativa',
          'concepto_id', (select id from public.nomina_conceptos where codigo = 'COMISION'),
          'cuenta_gasto_id', (select id from public.cuentas where codigo = '6')
        )
      )
    )
  ),
  '23514',
  null,
  'una cuenta de agrupación no se usa en el mapeo'
);

select throws_ok(
  format(
    $q$select public.nomina_guardar_mapeo_contable(%L::jsonb)$q$,
    jsonb_build_object(
      'mapeos', jsonb_build_array(
        jsonb_build_object(
          'segmento', 'operativa',
          'concepto_id', (select id from public.nomina_conceptos where codigo = 'AFP'),
          'cuenta_pasivo_id', (select id from public.cuentas where codigo = '1102')
        )
      )
    )
  ),
  '23514',
  null,
  'una deducción exige una cuenta de pasivo'
);

-- ---------------------------------------------------------------------------
-- Conceptos personalizados
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'concepto_bono', public.nomina_crear_concepto(
  jsonb_build_object(
    'codigo', 'bono_transporte',
    'nombre', 'Bono de transporte',
    'clase', 'ingreso'
  )
);

select ok(
  exists (
    select 1
    from public.nomina_conceptos
    where id = (select id from _ids where clave = 'concepto_bono')
      and codigo = 'BONO_TRANSPORTE'
      and clase = 'ingreso'
      and not es_sistema
      and activo
  ),
  'el alta de concepto normaliza el código y nace personalizado'
);

select throws_ok(
  $q$select public.nomina_crear_concepto(
    jsonb_build_object('codigo', 'Bono_Transporte', 'nombre', 'Duplicado', 'clase', 'ingreso')
  )$q$,
  '23505',
  null,
  'el código del concepto es único sin distinguir mayúsculas'
);

select throws_ok(
  $q$select public.nomina_crear_concepto(
    jsonb_build_object('codigo', '1MAL', 'nombre', 'Inválido', 'clase', 'ingreso')
  )$q$,
  '22023',
  null,
  'un código con formato inválido se rechaza'
);

select throws_ok(
  $q$select public.nomina_crear_concepto(
    jsonb_build_object('codigo', 'BONO_APORTE', 'nombre', 'Bono', 'clase', 'aporte_empleador', 'grava_tss', true)
  )$q$,
  '22023',
  null,
  'solo los ingresos pueden gravar TSS'
);

select lives_ok(
  format(
    $q$select public.nomina_actualizar_concepto(%L::uuid, '{"nombre":"Salario base","orden":11}'::jsonb)$q$,
    (select id from public.nomina_conceptos where codigo = 'SALARIO')
  ),
  'un concepto del sistema permite cambiar nombre y orden'
);

select ok(
  (
    select nombre = 'Salario base' and orden = 11 and es_sistema and grava_tss and clase = 'ingreso'
    from public.nomina_conceptos
    where codigo = 'SALARIO'
  ),
  'el concepto del sistema conserva su clase y sus indicadores'
);

select throws_ok(
  format(
    $q$select public.nomina_actualizar_concepto(%L::uuid, '{"activo":false}'::jsonb)$q$,
    (select id from public.nomina_conceptos where codigo = 'SALARIO')
  ),
  '23514',
  null,
  'un concepto del sistema no se desactiva'
);

select throws_ok(
  format(
    $q$select public.nomina_actualizar_concepto(%L::uuid, '{"grava_isr":false}'::jsonb)$q$,
    (select id from public.nomina_conceptos where codigo = 'SALARIO')
  ),
  '23514',
  null,
  'un concepto del sistema no cambia sus indicadores'
);

insert into _ids (clave, id)
select 'concepto_recargo', public.nomina_crear_concepto(
  jsonb_build_object(
    'codigo', 'recargo_nocturno',
    'nombre', 'Recargo nocturno',
    'clase', 'ingreso',
    'grava_tss', true,
    'orden', 190
  )
);

select lives_ok(
  format(
    $q$select public.nomina_actualizar_concepto(%L::uuid, %L::jsonb)$q$,
    (select id from _ids where clave = 'concepto_bono'),
    jsonb_build_object(
      'nombre', 'Bono de transporte (deducción)',
      'clase', 'deduccion',
      'activo', true,
      'orden', 130
    )
  ),
  'un concepto personalizado permite cambiar clase, nombre, estado y orden'
);

select ok(
  (
    select clase = 'deduccion'
      and nombre = 'Bono de transporte (deducción)'
      and not grava_tss and not grava_isr and not grava_infotep
      and activo
      and orden = 130
    from public.nomina_conceptos
    where id = (select id from _ids where clave = 'concepto_bono')
  ),
  'al pasar a deducción el concepto pierde los indicadores de TSS/ISR/INFOTEP'
);

-- ---------------------------------------------------------------------------
-- Parámetros legales
-- ---------------------------------------------------------------------------

select lives_ok(
  format(
    $q$select public.nomina_guardar_parametros_rd(%L::jsonb)$q$,
    pg_temp.parametros_json(2028, '23223.00')
  ),
  'el admin guarda los parámetros de un año nuevo'
);

select ok(
  (
    select salario_minimo = 23223.00
      and dias_mes_laboral = 23.830
      and jsonb_array_length(escala_isr_anual) = 4
    from public.nomina_parametros_rd
    where anio = 2028
  ),
  'los parámetros 2028 quedan con sus 4 tramos de ISR'
);

select lives_ok(
  format(
    $q$select public.nomina_guardar_parametros_rd(%L::jsonb)$q$,
    pg_temp.parametros_json(2028, '24000.00')
  ),
  'volver a guardar el mismo año actualiza la fila'
);

select is(
  (select salario_minimo from public.nomina_parametros_rd where anio = 2028),
  24000.00::numeric,
  'el upsert de parámetros conserva una sola fila por año'
);

select throws_ok(
  format(
    $q$select public.nomina_guardar_parametros_rd(%L::jsonb)$q$,
    pg_temp.parametros_json(2029, '23223.00') || jsonb_build_object('tasa_infotep', '-1')
  ),
  '22023',
  null,
  'una tasa negativa se rechaza'
);

select throws_ok(
  format(
    $q$select public.nomina_guardar_parametros_rd(%L::jsonb)$q$,
    pg_temp.parametros_json(2029, '23223.00') || jsonb_build_object('tope_sfs_mensual', '0')
  ),
  '22023',
  null,
  'un tope en cero se rechaza'
);

select throws_ok(
  format(
    $q$select public.nomina_guardar_parametros_rd(%L::jsonb)$q$,
    pg_temp.parametros_json(2029, '23223.00') || jsonb_build_object(
      'escala_isr_anual', jsonb_build_array(
        jsonb_build_object('desde', '0.00', 'hasta', '100.00', 'tasa', '0.000', 'monto_fijo', '0.00'),
        jsonb_build_object('desde', '100.00', 'hasta', null, 'tasa', '10.000', 'monto_fijo', '999.00')
      )
    )
  ),
  '22023',
  null,
  'una escala de ISR con monto fijo incoherente se rechaza'
);

select throws_ok(
  format(
    $q$select public.nomina_guardar_parametros_rd(%L::jsonb)$q$,
    pg_temp.parametros_json(2029, '23223.00') || jsonb_build_object(
      'escala_isr_anual', jsonb_build_array(
        jsonb_build_object('desde', '0.00', 'hasta', '100.00', 'tasa', '0.000', 'monto_fijo', '0.00'),
        jsonb_build_object('desde', '100.00', 'hasta', '200.00', 'tasa', '10.000', 'monto_fijo', '0.00')
      )
    )
  ),
  '22023',
  null,
  'el último tramo de la escala de ISR debe quedar abierto'
);

select throws_ok(
  format(
    $q$select public.nomina_guardar_parametros_rd(%L::jsonb)$q$,
    pg_temp.parametros_json(2025, '23223.00')
  ),
  '23514',
  null,
  'no se editan los parámetros de un año con periodos contables cerrados'
);

-- ---------------------------------------------------------------------------
-- Empleados
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'empleado_ana', public.nomina_crear_empleado(
  pg_temp.empleado_json(
    'cedula', '001-1391820-5', 'Ana', 'Pérez', 'administrativa', '2026-01-15', 'quincenal', '60000.00'
  ) || jsonb_build_object(
    'segundo_nombre', 'María',
    'segundo_apellido', 'Gómez',
    'correo', 'ana.perez@prueba.local',
    'telefono', '809-555-0001',
    'cargo', 'Analista',
    'clave_tss', '001'
  )
);

select ok(
  exists (
    select 1
    from public.empleados e
    join public.contactos c on c.id = e.contacto_id
    where e.id = (select id from _ids where clave = 'empleado_ana')
      and e.identificacion = '00113918205'
      and e.estado = 'activo'
      and c.nombre = 'Ana María Pérez Gómez'
      and c.rnc_cedula = '00113918205'
      and c.tipo = 'ambos'
      and c.tipo_identificacion = 'cedula'
  ),
  'el alta normaliza la cédula y crea el contacto con el nombre completo'
);

select throws_ok(
  format(
    $q$select public.nomina_crear_empleado(%L::jsonb)$q$,
    pg_temp.empleado_json(
      'cedula', '00113918204', 'Luis', 'Gómez', 'administrativa', '2026-02-01', 'mensual', '50000.00'
    )
  ),
  '22023',
  null,
  'una cédula con dígito verificador errado se rechaza'
);

select throws_ok(
  format(
    $q$select public.nomina_crear_empleado(%L::jsonb)$q$,
    pg_temp.empleado_json(
      'cedula', '00113918205', 'Otra', 'Persona', 'administrativa', '2026-02-01', 'mensual', '50000.00'
    )
  ),
  '23505',
  null,
  'no se repite la identificación de un empleado'
);

select throws_ok(
  format(
    $q$select public.nomina_crear_empleado(%L::jsonb)$q$,
    pg_temp.empleado_json(
      'pasaporte', 'ZZ10001', 'Luis', 'Ruiz', 'administrativa', '2026-02-01', 'mensual', '0'
    )
  ),
  '22023',
  null,
  'el salario mensual debe ser mayor que cero'
);

select throws_ok(
  format(
    $q$select public.nomina_crear_empleado(%L::jsonb)$q$,
    pg_temp.empleado_json(
      'pasaporte', 'ZZ10002', 'Luis', 'Ruiz', 'administrativa', '2026-02-01', 'mensual', '40000.00'
    ) || jsonb_build_object('tipo_contrato', 'definido')
  ),
  '22023',
  null,
  'un contrato definido exige fecha de fin'
);

select throws_ok(
  format(
    $q$select public.nomina_crear_empleado(%L::jsonb)$q$,
    pg_temp.empleado_json(
      'pasaporte', 'ZZ10003', 'Luis', 'Ruiz', 'administrativa', '2026-02-01', 'mensual', '40000.00'
    ) || jsonb_build_object('metodo_pago', 'transferencia')
  ),
  '22023',
  null,
  'la transferencia exige banco, tipo y número de cuenta'
);

insert into _ids (clave, id)
select 'empleado_pasaporte', public.nomina_crear_empleado(
  pg_temp.empleado_json(
    'pasaporte', 'AB12345', 'Pedro', 'Santos', 'operativa', '2026-02-01', 'quincenal', '45000.00'
  )
);

insert into _ids (clave, id)
select 'empleado_definido', public.nomina_crear_empleado(
  pg_temp.empleado_json(
    'cedula', '00108765439', 'Rosa', 'Martínez', 'ventas', '2026-03-01', 'mensual', '80000.00'
  ) || jsonb_build_object('tipo_contrato', 'definido', 'fecha_fin', '2026-12-31')
);

select ok(
  (select count(*)::int from _ids where clave in ('empleado_pasaporte', 'empleado_definido')) = 2,
  'el alta con pasaporte y con contrato definido también funciona'
);

select lives_ok(
  format(
    $q$select public.nomina_actualizar_empleado(%L::uuid, %L::jsonb)$q$,
    (select id from _ids where clave = 'empleado_ana'),
    jsonb_build_object(
      'primer_nombre', 'Ana Sofía',
      'cargo', 'Analista Senior',
      'correo', 'ana.sofia@prueba.local'
    )
  ),
  'el admin actualiza la ficha del empleado'
);

select ok(
  exists (
    select 1
    from public.empleados e
    join public.contactos c on c.id = e.contacto_id
    where e.id = (select id from _ids where clave = 'empleado_ana')
      and e.primer_nombre = 'Ana Sofía'
      and e.cargo = 'Analista Senior'
      and c.nombre = 'Ana Sofía María Pérez Gómez'
      and c.correo = 'ana.sofia@prueba.local'
  ),
  'la edición sincroniza el nombre y el correo del contacto'
);

select throws_ok(
  format(
    $q$select public.nomina_actualizar_empleado(%L::uuid, '{"cargo":"Nadie"}'::jsonb)$q$,
    gen_random_uuid()
  ),
  '22023',
  null,
  'actualizar un empleado inexistente da 22023'
);

select throws_ok(
  format(
    $q$select public.nomina_cambiar_estado_empleado(%L::uuid, 'inactivo')$q$,
    (select id from _ids where clave = 'empleado_definido')
  ),
  '22023',
  null,
  'inactivar exige la fecha de fin'
);

select lives_ok(
  format(
    $q$select public.nomina_cambiar_estado_empleado(%L::uuid, 'inactivo', %L::date)$q$,
    (select id from _ids where clave = 'empleado_definido'),
    '2026-12-31'
  ),
  'el contrato definido se inactiva con su fecha de fin'
);

select ok(
  (
    select estado = 'inactivo' and fecha_fin = '2026-12-31'
    from public.empleados
    where id = (select id from _ids where clave = 'empleado_definido')
  ),
  'el estado y la fecha de fin quedan guardados'
);

select throws_ok(
  format(
    $q$select public.nomina_cambiar_estado_empleado(%L::uuid, 'activo')$q$,
    (select id from _ids where clave = 'empleado_definido')
  ),
  '22023',
  null,
  'reactivar un contrato definido exige una fecha futura'
);

select lives_ok(
  format(
    $q$select public.nomina_cambiar_estado_empleado(%L::uuid, 'activo', %L::date)$q$,
    (select id from _ids where clave = 'empleado_definido'),
    '2027-03-31'
  ),
  'el contrato definido se reactiva con una fecha futura'
);

select throws_ok(
  format(
    $q$select public.nomina_cambiar_estado_empleado(%L::uuid, 'inactivo', %L::date)$q$,
    (select id from _ids where clave = 'empleado_pasaporte'),
    '2025-01-01'
  ),
  '22023',
  null,
  'la fecha de fin no puede ser anterior a la fecha de ingreso'
);

select lives_ok(
  format(
    $q$select public.nomina_cambiar_estado_empleado(%L::uuid, 'inactivo', %L::date)$q$,
    (select id from _ids where clave = 'empleado_pasaporte'),
    '2026-06-30'
  ),
  'un empleado indefinido se inactiva con fecha'
);

select lives_ok(
  format(
    $q$select public.nomina_cambiar_estado_empleado(%L::uuid, 'activo')$q$,
    (select id from _ids where clave = 'empleado_pasaporte')
  ),
  'un indefinido se reactiva sin fecha de fin'
);

select ok(
  (
    select estado = 'activo' and fecha_fin is null
    from public.empleados
    where id = (select id from _ids where clave = 'empleado_pasaporte')
  ),
  'reactivar un indefinido limpia la fecha de fin'
);

-- ---------------------------------------------------------------------------
-- Novedades recurrentes
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'novedad_prestamo', public.nomina_guardar_novedad_recurrente(
  jsonb_build_object(
    'empleado_id', (select id from _ids where clave = 'empleado_ana'),
    'concepto_id', (select id from public.nomina_conceptos where codigo = 'PRESTAMO'),
    'monto', '1500.00',
    'fecha_inicio', '2026-01-01'
  )
);

select ok(
  exists (
    select 1
    from public.empleado_novedades_recurrentes
    where id = (select id from _ids where clave = 'novedad_prestamo')
      and monto = 1500.00
      and porcentaje is null
      and activa
  ),
  'la novedad recurrente guarda el monto y queda activa'
);

select throws_ok(
  format(
    $q$select public.nomina_guardar_novedad_recurrente(%L::jsonb)$q$,
    jsonb_build_object(
      'empleado_id', (select id from _ids where clave = 'empleado_ana'),
      'concepto_id', (select id from public.nomina_conceptos where codigo = 'PRESTAMO'),
      'monto', '100.00',
      'porcentaje', '5.000',
      'fecha_inicio', '2026-01-01'
    )
  ),
  '22023',
  null,
  'la novedad no admite monto y porcentaje a la vez'
);

select throws_ok(
  format(
    $q$select public.nomina_guardar_novedad_recurrente(%L::jsonb)$q$,
    jsonb_build_object(
      'empleado_id', (select id from _ids where clave = 'empleado_ana'),
      'concepto_id', (select id from public.nomina_conceptos where codigo = 'PRESTAMO'),
      'fecha_inicio', '2026-01-01'
    )
  ),
  '22023',
  null,
  'la novedad exige monto o porcentaje'
);

select throws_ok(
  format(
    $q$select public.nomina_guardar_novedad_recurrente(%L::jsonb)$q$,
    jsonb_build_object(
      'empleado_id', (select id from _ids where clave = 'empleado_ana'),
      'concepto_id', (select id from public.nomina_conceptos where codigo = 'SALARIO'),
      'monto', '100.00',
      'fecha_inicio', '2026-01-01'
    )
  ),
  '23514',
  null,
  'un concepto que calcula el motor no se guarda como novedad'
);

select throws_ok(
  format(
    $q$select public.nomina_guardar_novedad_recurrente(%L::jsonb)$q$,
    jsonb_build_object(
      'empleado_id', (select id from _ids where clave = 'empleado_ana'),
      'concepto_id', (select id from public.nomina_conceptos where codigo = 'PRESTAMO'),
      'porcentaje', '150.000',
      'fecha_inicio', '2026-01-01'
    )
  ),
  '22023',
  null,
  'el porcentaje de la novedad no pasa de 100'
);

select throws_ok(
  format(
    $q$select public.nomina_guardar_novedad_recurrente(%L::jsonb)$q$,
    jsonb_build_object(
      'empleado_id', (select id from _ids where clave = 'empleado_ana'),
      'concepto_id', (select id from public.nomina_conceptos where codigo = 'PRESTAMO'),
      'monto', '100.00',
      'fecha_inicio', '2026-06-01',
      'fecha_fin', '2026-05-31'
    )
  ),
  '22023',
  null,
  'la vigencia de la novedad no termina antes de empezar'
);

select lives_ok(
  format(
    $q$select public.nomina_guardar_novedad_recurrente(%L::jsonb)$q$,
    jsonb_build_object(
      'id', (select id from _ids where clave = 'novedad_prestamo'),
      'empleado_id', (select id from _ids where clave = 'empleado_ana'),
      'concepto_id', (select id from public.nomina_conceptos where codigo = 'PRESTAMO'),
      'monto', '2000.00',
      'fecha_inicio', '2026-01-01'
    )
  ),
  'editar una novedad existente actualiza la fila'
);

select is(
  (select monto from public.empleado_novedades_recurrentes where id = (select id from _ids where clave = 'novedad_prestamo')),
  2000.00::numeric,
  'el monto de la novedad queda actualizado'
);

insert into _ids (clave, id)
select 'novedad_pension', public.nomina_guardar_novedad_recurrente(
  jsonb_build_object(
    'empleado_id', (select id from _ids where clave = 'empleado_ana'),
    'concepto_id', (select id from public.nomina_conceptos where codigo = 'PENSION_ALIMENTICIA'),
    'monto', '500.00',
    'fecha_inicio', '2026-01-01'
  )
);

select lives_ok(
  format(
    $q$select public.nomina_eliminar_novedad_recurrente(%L::uuid)$q$,
    (select id from _ids where clave = 'novedad_pension')
  ),
  'una novedad sin uso se puede borrar'
);

select is(
  (select count(*)::int from public.empleado_novedades_recurrentes where id = (select id from _ids where clave = 'novedad_pension')),
  0,
  'la novedad borrada ya no existe'
);

-- ---------------------------------------------------------------------------
-- Agregar empleados a un periodo
-- ---------------------------------------------------------------------------

reset role;
with p as (
  insert into public.nomina_periodos (codigo, frecuencia, fecha_inicio, fecha_fin, anio_fiscal)
  values ('2026-11-Q1', 'quincenal', '2026-11-01', '2026-11-15', 2026)
  returning id
)
insert into _ids (clave, id)
select 'periodo_q1', id from p;

set local role authenticated;
set local request.jwt.claims = '{"sub":"d1111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  public.nomina_agregar_empleados(
    (select id from _ids where clave = 'periodo_q1'),
    array(
      select id from _ids
      where clave in ('empleado_ana', 'empleado_pasaporte')
    )
  ),
  2,
  'agregar dos empleados elegibles crea dos recibos'
);

select is(
  (
    select count(*)::int
    from public.nomina_recibos
    where periodo_id = (select id from _ids where clave = 'periodo_q1')
  ),
  2,
  'el periodo queda con un recibo por empleado'
);

select ok(
  (
    select dias_trabajados = 11.915 and salario_base = 30000.00
    from public.nomina_recibos
    where periodo_id = (select id from _ids where clave = 'periodo_q1')
      and empleado_id = (select id from _ids where clave = 'empleado_ana')
  ),
  'la quincena completa de 60,000 son 11.915 días y 30,000.00'
);

insert into _ids (clave, id)
select 'recibo_ana', r.id
from public.nomina_recibos r
where r.periodo_id = (select id from _ids where clave = 'periodo_q1')
  and r.empleado_id = (select id from _ids where clave = 'empleado_ana');

insert into _ids (clave, id)
select 'recibo_pasaporte', r.id
from public.nomina_recibos r
where r.periodo_id = (select id from _ids where clave = 'periodo_q1')
  and r.empleado_id = (select id from _ids where clave = 'empleado_pasaporte');

select is(
  public.nomina_agregar_empleados(
    (select id from _ids where clave = 'periodo_q1'),
    array(
      select id from _ids
      where clave in ('empleado_ana', 'empleado_pasaporte')
    )
  ),
  0,
  'volver a agregar los mismos empleados no duplica recibos'
);

select is(
  (
    select count(*)::int
    from public.nomina_recibos
    where periodo_id = (select id from _ids where clave = 'periodo_q1')
  ),
  2,
  'sigue habiendo dos recibos'
);

reset role;
update public.nomina_periodos
set estado = 'pagado'
where id = (select id from _ids where clave = 'periodo_q1');
set local role authenticated;
set local request.jwt.claims = '{"sub":"d1111111-1111-1111-1111-111111111111","role":"authenticated"}';

select throws_ok(
  format(
    $q$select public.nomina_agregar_empleados(%L::uuid, array[%L::uuid])$q$,
    (select id from _ids where clave = 'periodo_q1'),
    (select id from _ids where clave = 'empleado_ana')
  ),
  '23514',
  null,
  'no se agregan empleados a un periodo pagado'
);

reset role;
update public.nomina_periodos
set estado = 'borrador'
where id = (select id from _ids where clave = 'periodo_q1');

-- Recibo contabilizado con líneas recurrentes: bloquea borrar la novedad y
-- desactivar el concepto que ya se usó.
with a as (
  insert into public.asientos (fecha, descripcion, origen_tipo, total)
  values ('2026-11-10', 'Asiento de prueba pgTAP nómina 3D', 'manual', 1000)
  returning id
)
insert into _ids (clave, id)
select 'asiento_prueba', id from a;

update public.nomina_recibos r
set
  estado = 'contabilizado',
  asiento_id = (select id from _ids where clave = 'asiento_prueba'),
  cuenta_salarios_por_pagar_id = (select id from public.cuentas where codigo = '2107'),
  total_ingresos = 1000,
  total_deducciones = 0,
  neto_pagar = 1000,
  costo_total_empresa = 1000
where r.id = (select id from _ids where clave = 'recibo_ana');

insert into public.nomina_recibo_lineas (recibo_id, concepto_id, clase, monto, origen)
values
  (
    (select id from _ids where clave = 'recibo_ana'),
    (select id from public.nomina_conceptos where codigo = 'PRESTAMO'),
    'deduccion',
    2000,
    'recurrente'
  ),
  (
    (select id from _ids where clave = 'recibo_ana'),
    (select id from _ids where clave = 'concepto_recargo'),
    'ingreso',
    500,
    'sistema'
  );

set local role authenticated;
set local request.jwt.claims = '{"sub":"d1111111-1111-1111-1111-111111111111","role":"authenticated"}';

select throws_ok(
  format(
    $q$select public.nomina_eliminar_novedad_recurrente(%L::uuid)$q$,
    (select id from _ids where clave = 'novedad_prestamo')
  ),
  '23514',
  null,
  'no se borra una novedad usada por un recibo contabilizado'
);

select throws_ok(
  format(
    $q$select public.nomina_actualizar_concepto(%L::uuid, '{"activo":false}'::jsonb)$q$,
    (select id from _ids where clave = 'concepto_recargo')
  ),
  '23514',
  null,
  'no se desactiva un concepto usado por un recibo contabilizado'
);

select ok(
  (select activo from public.nomina_conceptos where id = (select id from _ids where clave = 'concepto_recargo')),
  'el concepto usado sigue activo'
);

select throws_ok(
  format(
    $q$select public.nomina_cambiar_estado_empleado(%L::uuid, 'inactivo', %L::date)$q$,
    (select id from _ids where clave = 'empleado_ana'),
    '2026-11-30'
  ),
  '23514',
  null,
  'no se inactiva un empleado con recibos pendientes'
);

select throws_ok(
  format(
    $q$select public.nomina_actualizar_empleado(%L::uuid, %L::jsonb)$q$,
    (select id from _ids where clave = 'empleado_ana'),
    jsonb_build_object('tipo_identificacion', 'cedula', 'identificacion', '00112345673')
  ),
  '23514',
  null,
  'no se cambia la identificación de un empleado con recibos contabilizados'
);

reset role;
update public.nomina_recibos
set estado = 'anulado'
where id = (select id from _ids where clave = 'recibo_pasaporte');
set local role authenticated;
set local request.jwt.claims = '{"sub":"d1111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  public.nomina_agregar_empleados(
    (select id from _ids where clave = 'periodo_q1'),
    array(select id from _ids where clave = 'empleado_pasaporte')
  ),
  1,
  'agregar revive el recibo anulado del empleado'
);

select ok(
  (
    select estado = 'borrador'
      and asiento_id is null
      and cuenta_salarios_por_pagar_id is null
      and total_neto = 0
      and salario_base = 22500.00
    from public.nomina_recibos
    where id = (select id from _ids where clave = 'recibo_pasaporte')
  ),
  'el recibo revivido queda en borrador y con los totales en cero'
);

select is(
  (
    select estado
    from public.nomina_periodos
    where id = (select id from _ids where clave = 'periodo_q1')
  ),
  'borrador',
  'el periodo vuelve a borrador al revivir un recibo'
);

select is(
  public.nomina_agregar_empleados(
    (select id from _ids where clave = 'periodo_q1'),
    array(select id from _ids where clave = 'empleado_pasaporte')
  ),
  0,
  'un recibo revivido ya no se vuelve a agregar'
);

-- ---------------------------------------------------------------------------
-- RLS y permisos
-- ---------------------------------------------------------------------------

reset role;

select ok(
  has_table_privilege('authenticated', 'public.empleados', 'SELECT')
  and has_table_privilege('authenticated', 'public.empleado_novedades_recurrentes', 'SELECT')
  and not has_table_privilege('authenticated', 'public.empleados', 'INSERT')
  and not has_table_privilege('authenticated', 'public.empleados', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.empleados', 'DELETE')
  and not has_table_privilege('authenticated', 'public.empleado_novedades_recurrentes', 'INSERT'),
  'las tablas operativas solo se escriben por RPC security definer'
);

select ok(
  has_function_privilege('authenticated', 'public.nomina_guardar_config_empresa(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.nomina_guardar_mapeo_contable(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.nomina_guardar_parametros_rd(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.nomina_crear_concepto(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.nomina_actualizar_concepto(uuid, jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.nomina_crear_empleado(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.nomina_agregar_empleados(uuid, uuid[])', 'EXECUTE'),
  'authenticated ejecuta las RPC nuevas y el rol se valida dentro'
);

select ok(
  not has_table_privilege('anon', 'public.nomina_config_empresa', 'SELECT')
  and not has_table_privilege('anon', 'public.empleados', 'SELECT')
  and not has_table_privilege('anon', 'public.nomina_conceptos', 'SELECT'),
  'anon no ve nada de nómina'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d2222222-2222-2222-2222-222222222222","role":"authenticated"}';

select lives_ok(
  format(
    $q$select public.nomina_guardar_config_empresa(%L::jsonb)$q$,
    jsonb_build_object('riesgo_laboral', 'tipo_1')
  ),
  'el contador también puede guardar la configuración'
);

set local request.jwt.claims = '{"sub":"d3333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  $q$select public.nomina_guardar_config_empresa('{"riesgo_laboral":"tipo_1"}'::jsonb)$q$,
  '42501',
  null,
  'un lector no guarda la configuración de nómina'
);

select throws_ok(
  $q$select public.nomina_crear_concepto(
    jsonb_build_object('codigo', 'LECTOR_NO', 'nombre', 'No debe entrar', 'clase', 'ingreso')
  )$q$,
  '42501',
  null,
  'un lector no crea conceptos'
);

select throws_ok(
  format(
    $q$select public.nomina_crear_empleado(%L::jsonb)$q$,
    pg_temp.empleado_json(
      'pasaporte', 'LEC001', 'Lector', 'Prueba', 'administrativa', '2026-02-01', 'mensual', '30000.00'
    )
  ),
  '42501',
  null,
  'un lector no crea empleados'
);

select throws_ok(
  $q$insert into public.empleados (
    contacto_id, tipo_identificacion, identificacion, primer_nombre, primer_apellido,
    fecha_ingreso, frecuencia_pago, salario_mensual
  ) values (
    gen_random_uuid(), 'pasaporte', 'DIR001', 'Directo', 'Prohibido',
    '2026-02-01', 'mensual', 30000
  )$q$,
  '42501',
  null,
  'authenticated no escribe empleados directamente'
);

reset role;
set local role anon;

select throws_ok(
  'select count(*) from public.empleados',
  '42501',
  null,
  'anon no lee los empleados'
);

select ok(
  not has_function_privilege('anon', 'public.nomina_crear_empleado(jsonb)', 'EXECUTE'),
  'anon no ejecuta las RPC de nómina'
);

select * from finish();
rollback;

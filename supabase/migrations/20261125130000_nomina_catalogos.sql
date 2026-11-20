-- ---------------------------------------------------------------------------
-- Nómina RD (fase 3A): catálogos, configuración de empresa, conceptos,
-- mapeo contable, empleados y novedades recurrentes.
--
-- Contrato funcional: docs/dominio-nomina.md §2 y §3.1–3.2.
-- La parte operativa (periodos, recibos, líneas, cálculo, contabilización,
-- pagos y anulaciones) llega en la migración 3B; aquí NO hay funciones de
-- motor. Las tablas operativas solo se escriben desde RPC `security definer`
-- (se crean en 3B), por eso `authenticated` solo tiene SELECT.
--
-- Migración aditiva y reintentable:
-- · No borra ni cambia datos existentes.
-- · Las semillas usan `where not exists` / `on conflict do nothing`: nunca
--   pisan una fila que Waldy haya ajustado.
-- · El check de `asientos.origen_tipo` se reemplaza con la lista completa
--   (los 16 valores vigentes + 'pos_movimiento' + 'pos_diferencia' + 'nomina'
--   + 'pago_nomina').
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Parámetros legales por año fiscal
-- ---------------------------------------------------------------------------

create table if not exists public.nomina_parametros_rd (
  anio int primary key check (anio between 2000 and 2100),
  salario_minimo numeric(14,2) not null check (salario_minimo > 0),
  tasa_sfs_empleado numeric(6,3) not null
    check (tasa_sfs_empleado between 0 and 100),
  tasa_sfs_empleador numeric(6,3) not null
    check (tasa_sfs_empleador between 0 and 100),
  tope_sfs_mensual numeric(14,2) not null check (tope_sfs_mensual > 0),
  tasa_afp_empleado numeric(6,3) not null
    check (tasa_afp_empleado between 0 and 100),
  tasa_afp_empleador numeric(6,3) not null
    check (tasa_afp_empleador between 0 and 100),
  tope_afp_mensual numeric(14,2) not null check (tope_afp_mensual > 0),
  tope_srl_mensual numeric(14,2) not null check (tope_srl_mensual > 0),
  tasa_srl_tipo_1 numeric(6,3) not null
    check (tasa_srl_tipo_1 between 0 and 100),
  tasa_srl_tipo_2 numeric(6,3) not null
    check (tasa_srl_tipo_2 between 0 and 100),
  tasa_srl_tipo_3 numeric(6,3) not null
    check (tasa_srl_tipo_3 between 0 and 100),
  tasa_srl_tipo_4 numeric(6,3) not null
    check (tasa_srl_tipo_4 between 0 and 100),
  tasa_infotep numeric(6,3) not null
    check (tasa_infotep between 0 and 100),
  dias_mes_laboral numeric(6,3) not null
    check (dias_mes_laboral > 0 and dias_mes_laboral <= 31),
  horas_dia_laboral numeric(6,3) not null
    check (horas_dia_laboral > 0 and horas_dia_laboral <= 24),
  escala_isr_anual jsonb not null
    check (jsonb_typeof(escala_isr_anual) = 'array')
    check (jsonb_array_length(escala_isr_anual) > 0),
  actualizado_en timestamptz not null default now()
);

-- Semilla 2026. `on conflict do nothing`: si Waldy ajusta una tasa del año,
-- volver a correr la migración no la pisa.
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
  2026,
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
  '[
    { "desde": 0.00, "hasta": 416220.00, "tasa": 0.00, "monto_fijo": 0.00 },
    { "desde": 416220.00, "hasta": 624329.00, "tasa": 15.00, "monto_fijo": 0.00 },
    { "desde": 624329.00, "hasta": 867123.00, "tasa": 20.00, "monto_fijo": 31216.35 },
    { "desde": 867123.00, "hasta": null, "tasa": 25.00, "monto_fijo": 79775.15 }
  ]'::jsonb
)
on conflict (anio) do nothing;

-- ---------------------------------------------------------------------------
-- Configuración de la empresa para nómina (fila única)
-- ---------------------------------------------------------------------------

create table if not exists public.nomina_config_empresa (
  id int primary key default 1 check (id = 1),
  riesgo_laboral text not null default 'tipo_1'
    check (riesgo_laboral in ('tipo_1', 'tipo_2', 'tipo_3', 'tipo_4')),
  categoria_empresa text not null default 'pequena'
    check (categoria_empresa in ('micro', 'pequena', 'mediana', 'grande')),
  aplica_infotep boolean not null default true,
  frecuencia_defecto text not null default 'quincenal'
    check (frecuencia_defecto in ('quincenal', 'mensual')),
  cuenta_pago_defecto_id uuid references public.cuentas (id),
  cuenta_salarios_por_pagar_id uuid references public.cuentas (id),
  registrar_provisiones boolean not null default false,
  contacto_tss_id uuid references public.contactos (id),
  contacto_infotep_id uuid references public.contactos (id),
  contacto_dgii_id uuid references public.contactos (id),
  actualizado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Catálogo de conceptos de nómina
-- ---------------------------------------------------------------------------

create table if not exists public.nomina_conceptos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null check (codigo ~ '^[A-Z][A-Z0-9_]{2,39}$'),
  nombre text not null check (btrim(nombre) <> ''),
  clase text not null
    check (clase in ('ingreso', 'deduccion', 'aporte_empleador', 'provision')),
  grava_tss boolean not null default false,
  grava_isr boolean not null default false,
  grava_infotep boolean not null default false,
  es_sistema boolean not null default false,
  activo boolean not null default true,
  orden int not null default 100,
  creado_en timestamptz not null default now(),
  -- Solo los ingresos pueden entrar en las bases de TSS, ISR o INFOTEP.
  check (
    clase = 'ingreso'
    or (not grava_tss and not grava_isr and not grava_infotep)
  )
);

create unique index if not exists nomina_conceptos_codigo_unico
  on public.nomina_conceptos (lower(codigo));
create index if not exists nomina_conceptos_clase_activo_orden_idx
  on public.nomina_conceptos (clase, activo, orden);

-- 18 ingresos. TSS / ISR / INFOTEP marcan la base en la que entra el concepto.
insert into public.nomina_conceptos (
  codigo, nombre, clase, grava_tss, grava_isr, grava_infotep, es_sistema, orden
)
select
  v.codigo, v.nombre, 'ingreso', v.tss, v.isr, v.infotep, true, v.orden
from (values
  ('SALARIO', 'Salario', true, true, true, 10),
  ('COMISION', 'Comisión', true, true, true, 20),
  ('DIFERENCIAL_VACACIONES', 'Diferencial Vacaciones Ley', true, true, true, 30),
  ('PRIMA_NOCTURNA', 'Prima Nocturna', true, true, true, 40),
  ('HORAS_EXTRA_35', 'Horas Extra 35%', true, true, true, 50),
  ('HORAS_EXTRA_100', 'Horas Extra 100%', true, true, true, 60),
  ('VACACIONES', 'Vacaciones', true, true, true, 70),
  ('REGALIA_PASCUAL', 'Regalía Pascual', false, false, false, 80),
  ('BONIFICACION', 'Bonificación', true, true, true, 90),
  ('INCENTIVO', 'Incentivo', true, true, true, 100),
  ('GRATIFICACION', 'Gratificación', true, true, true, 110),
  ('BONO_PRODUCTIVIDAD', 'Bono de productividad', true, true, true, 120),
  ('CESANTIA', 'Cesantía', false, false, false, 130),
  ('PREAVISO', 'Preaviso', false, false, false, 140),
  ('VIATICOS', 'Viáticos', false, false, false, 150),
  ('DIETA', 'Dietas', false, false, false, 160),
  ('SUBSIDIO', 'Subsidios', false, false, false, 170),
  ('OTROS_INGRESOS', 'Otros Ingresos', true, true, true, 180)
) as v(codigo, nombre, tss, isr, infotep, orden)
where not exists (
  select 1 from public.nomina_conceptos c where lower(c.codigo) = lower(v.codigo)
);

-- 15 deducciones.
insert into public.nomina_conceptos (
  codigo, nombre, clase, grava_tss, grava_isr, grava_infotep, es_sistema, orden
)
select
  v.codigo, v.nombre, 'deduccion', false, false, false, true, v.orden
from (values
  ('SFS', 'SFS empleado 3.04%', 10),
  ('AFP', 'AFP empleado 2.87%', 20),
  ('ISR', 'ISR asalariados', 30),
  ('DEPENDIENTES', 'Aporte de Dependientes', 40),
  ('PRESTAMO', 'Préstamos', 50),
  ('LICENCIA_NO_REMUNERADA', 'Licencia no remunerada', 60),
  ('LICENCIA_MEDICA', 'Licencia médica', 70),
  ('PENSION_ALIMENTICIA', 'Pensión alimenticia', 80),
  ('COOPERATIVA', 'Cooperativa', 90),
  ('SEGURO_VIDA', 'Seguro de vida', 100),
  ('PLAN_RETIRO', 'Plan de retiro', 110),
  ('EMBARGO', 'Embargo judicial', 120),
  ('CUOTA_SINDICAL', 'Cuota sindical', 130),
  ('AHORRO', 'Ahorro programado', 140),
  ('OTROS_DESCUENTOS', 'Otros descuentos', 150)
) as v(codigo, nombre, orden)
where not exists (
  select 1 from public.nomina_conceptos c where lower(c.codigo) = lower(v.codigo)
);

-- 4 cargas patronales.
insert into public.nomina_conceptos (
  codigo, nombre, clase, grava_tss, grava_isr, grava_infotep, es_sistema, orden
)
select
  v.codigo, v.nombre, 'aporte_empleador', false, false, false, true, v.orden
from (values
  ('SFS_EMPLEADOR', 'SFS empleador 7.09%', 10),
  ('AFP_EMPLEADOR', 'AFP empleador 7.10%', 20),
  ('SRL', 'Seguro de riesgos laborales', 30),
  ('INFOTEP', 'INFOTEP 1.00%', 40)
) as v(codigo, nombre, orden)
where not exists (
  select 1 from public.nomina_conceptos c where lower(c.codigo) = lower(v.codigo)
);

-- 3 provisiones.
insert into public.nomina_conceptos (
  codigo, nombre, clase, grava_tss, grava_isr, grava_infotep, es_sistema, orden
)
select
  v.codigo, v.nombre, 'provision', false, false, false, true, v.orden
from (values
  ('PROVISION_NAVIDAD', 'Provisión regalía pascual', 10),
  ('PROVISION_VACACIONES', 'Provisión de vacaciones', 20),
  ('PROVISION_CESANTIA', 'Provisión de cesantía', 30)
) as v(codigo, nombre, orden)
where not exists (
  select 1 from public.nomina_conceptos c where lower(c.codigo) = lower(v.codigo)
);

-- ---------------------------------------------------------------------------
-- Cuentas contables de nómina
--
-- Solo se crean las que falten. No se toca 6109 (Gasto de depreciación) ni
-- ninguna cuenta existente con el mismo código.
-- ---------------------------------------------------------------------------

insert into public.cuentas (
  codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos, es_caja_banco
)
select
  v.codigo, v.nombre, v.tipo, v.naturaleza, p.id, true, false
from (values
  ('6110', 'Sueldos y salarios', 'gasto', 'debito', '6'),
  ('6111', 'Horas extras', 'gasto', 'debito', '6'),
  ('6112', 'Comisiones', 'gasto', 'debito', '6'),
  ('6113', 'Bonificaciones y otros ingresos', 'gasto', 'debito', '6'),
  ('6114', 'Aportes patronales SFS', 'gasto', 'debito', '6'),
  ('6115', 'Aportes patronales AFP', 'gasto', 'debito', '6'),
  ('6116', 'Seguro de riesgos laborales (SRL)', 'gasto', 'debito', '6'),
  ('6117', 'INFOTEP', 'gasto', 'debito', '6'),
  ('6118', 'Provisión de vacaciones', 'gasto', 'debito', '6'),
  ('6119', 'Provisión de regalía pascual', 'gasto', 'debito', '6'),
  ('6120', 'Provisión de cesantía', 'gasto', 'debito', '6'),
  ('6121', 'Otros gastos de nómina', 'gasto', 'debito', '6'),
  ('6122', 'Prestaciones laborales', 'gasto', 'debito', '6'),
  ('6123', 'Viáticos y dietas', 'gasto', 'debito', '6'),
  ('2107', 'Salarios por pagar', 'pasivo', 'credito', '21'),
  ('2108', 'Retenciones SFS por pagar', 'pasivo', 'credito', '21'),
  ('2109', 'Retenciones AFP por pagar', 'pasivo', 'credito', '21'),
  ('2110', 'ISR asalariados por pagar', 'pasivo', 'credito', '21'),
  ('2111', 'Aportes SFS por pagar', 'pasivo', 'credito', '21'),
  ('2112', 'Aportes AFP por pagar', 'pasivo', 'credito', '21'),
  ('2113', 'Acumulaciones SRL por pagar', 'pasivo', 'credito', '21'),
  ('2114', 'Acumulaciones INFOTEP por pagar', 'pasivo', 'credito', '21'),
  ('2115', 'Otras deducciones de nómina por pagar', 'pasivo', 'credito', '21'),
  ('2116', 'Provisiones de vacaciones por pagar', 'pasivo', 'credito', '21'),
  ('2117', 'Provisión de regalía pascual por pagar', 'pasivo', 'credito', '21'),
  ('2118', 'Provisiones de cesantía por pagar', 'pasivo', 'credito', '21')
) as v(codigo, nombre, tipo, naturaleza, padre_codigo)
join public.cuentas p on p.codigo = v.padre_codigo
where not exists (
  select 1 from public.cuentas c where c.codigo = v.codigo
);

-- ---------------------------------------------------------------------------
-- Contactos por defecto (TSS, INFOTEP y DGII)
--
-- No se inventan RNC: Waldy los completa en la ficha si los quiere. Se
-- comparan por nombre sin distinguir mayúsculas para no duplicarlos.
-- ---------------------------------------------------------------------------

insert into public.contactos (tipo, nombre, activo)
select 'proveedor', v.nombre, true
from (values
  ('Tesorería de la Seguridad Social (TSS)'),
  ('Instituto Nacional de Formación Técnico Profesional (INFOTEP)'),
  ('Dirección General de Impuestos Internos (DGII)')
) as v(nombre)
where not exists (
  select 1 from public.contactos c where lower(c.nombre) = lower(v.nombre)
);

-- ---------------------------------------------------------------------------
-- Mapeo contable por segmento
-- ---------------------------------------------------------------------------

create table if not exists public.nomina_mapeo_contable (
  id uuid primary key default gen_random_uuid(),
  segmento text not null
    check (segmento in ('administrativa', 'operativa', 'ventas')),
  concepto_id uuid not null references public.nomina_conceptos (id),
  cuenta_gasto_id uuid references public.cuentas (id),
  cuenta_pasivo_id uuid references public.cuentas (id),
  creado_en timestamptz not null default now(),
  unique (segmento, concepto_id),
  check (cuenta_gasto_id is not null or cuenta_pasivo_id is not null)
);

-- 40 conceptos × 3 segmentos = 120 filas. La obligación por clase (gasto para
-- ingresos, pasivo para deducciones y ambas para aportes/provisiones) la
-- valida la RPC al guardar; la semilla la cumple.
insert into public.nomina_mapeo_contable (
  segmento, concepto_id, cuenta_gasto_id, cuenta_pasivo_id
)
select
  s.segmento,
  nc.id,
  cg.id,
  cp.id
from (values
  ('SALARIO', '6110', null),
  ('COMISION', '6112', null),
  ('DIFERENCIAL_VACACIONES', '6110', null),
  ('PRIMA_NOCTURNA', '6110', null),
  ('HORAS_EXTRA_35', '6111', null),
  ('HORAS_EXTRA_100', '6111', null),
  ('VACACIONES', '6110', null),
  ('REGALIA_PASCUAL', '6113', null),
  ('BONIFICACION', '6113', null),
  ('INCENTIVO', '6113', null),
  ('GRATIFICACION', '6113', null),
  ('BONO_PRODUCTIVIDAD', '6113', null),
  ('CESANTIA', '6122', null),
  ('PREAVISO', '6122', null),
  ('VIATICOS', '6123', null),
  ('DIETA', '6123', null),
  ('SUBSIDIO', '6113', null),
  ('OTROS_INGRESOS', '6113', null),
  ('SFS', null, '2108'),
  ('AFP', null, '2109'),
  ('ISR', null, '2110'),
  ('DEPENDIENTES', null, '2115'),
  ('PRESTAMO', null, '2115'),
  ('LICENCIA_NO_REMUNERADA', null, '2115'),
  ('LICENCIA_MEDICA', null, '2115'),
  ('PENSION_ALIMENTICIA', null, '2115'),
  ('COOPERATIVA', null, '2115'),
  ('SEGURO_VIDA', null, '2115'),
  ('PLAN_RETIRO', null, '2115'),
  ('EMBARGO', null, '2115'),
  ('CUOTA_SINDICAL', null, '2115'),
  ('AHORRO', null, '2115'),
  ('OTROS_DESCUENTOS', null, '2115'),
  ('SFS_EMPLEADOR', '6114', '2111'),
  ('AFP_EMPLEADOR', '6115', '2112'),
  ('SRL', '6116', '2113'),
  ('INFOTEP', '6117', '2114'),
  ('PROVISION_NAVIDAD', '6119', '2117'),
  ('PROVISION_VACACIONES', '6118', '2116'),
  ('PROVISION_CESANTIA', '6120', '2118')
) as cc(codigo_concepto, codigo_gasto, codigo_pasivo)
join public.nomina_conceptos nc on nc.codigo = cc.codigo_concepto
cross join (values ('administrativa'), ('operativa'), ('ventas')) as s(segmento)
left join public.cuentas cg on cg.codigo = cc.codigo_gasto
left join public.cuentas cp on cp.codigo = cc.codigo_pasivo
where not exists (
  select 1
  from public.nomina_mapeo_contable m
  where m.segmento = s.segmento
    and m.concepto_id = nc.id
);

-- Configuración por defecto: solo si la fila no existe (no pisa ajustes de
-- Waldy). Las cuentas y contactos se resuelven por código/nombre después de
-- las semillas de arriba.
insert into public.nomina_config_empresa (
  id,
  cuenta_pago_defecto_id,
  cuenta_salarios_por_pagar_id,
  contacto_tss_id,
  contacto_infotep_id,
  contacto_dgii_id
)
select
  1,
  cp.id,
  cs.id,
  (select c.id from public.contactos c
    where lower(c.nombre) = lower('Tesorería de la Seguridad Social (TSS)')
    order by c.creado_en limit 1),
  (select c.id from public.contactos c
    where lower(c.nombre) = lower('Instituto Nacional de Formación Técnico Profesional (INFOTEP)')
    order by c.creado_en limit 1),
  (select c.id from public.contactos c
    where lower(c.nombre) = lower('Dirección General de Impuestos Internos (DGII)')
    order by c.creado_en limit 1)
from public.cuentas cp
cross join public.cuentas cs
where cp.codigo = '1102'
  and cs.codigo = '2107'
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Empleados
--
-- La ficha siempre va vinculada a un contacto para que el Libro Mayor y el
-- auxiliar por tercero funcionen. La creación/edición pasa por RPC
-- `security definer` (3B): aquí solo se concede lectura.
-- ---------------------------------------------------------------------------

create table if not exists public.empleados (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid not null unique references public.contactos (id),
  tipo_identificacion text not null
    check (tipo_identificacion in ('cedula', 'pasaporte', 'residencia')),
  identificacion text not null check (btrim(identificacion) <> ''),
  primer_nombre text not null check (btrim(primer_nombre) <> ''),
  segundo_nombre text,
  primer_apellido text not null check (btrim(primer_apellido) <> ''),
  segundo_apellido text,
  correo text check (
    correo is null
    or correo ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  telefono text,
  municipio text,
  direccion text,
  cargo text,
  area text,
  segmento_contable text not null default 'administrativa'
    check (segmento_contable in ('administrativa', 'operativa', 'ventas')),
  centro_costo_id uuid references public.centros_costo (id),
  tipo_contrato text not null default 'indefinido'
    check (tipo_contrato in ('indefinido', 'definido')),
  fecha_ingreso date not null,
  fecha_fin date,
  frecuencia_pago text not null
    check (frecuencia_pago in ('quincenal', 'mensual')),
  salario_mensual numeric(14,2) not null check (salario_mensual > 0),
  metodo_pago text not null default 'transferencia'
    check (metodo_pago in ('efectivo', 'transferencia', 'cheque')),
  banco_nombre text,
  tipo_cuenta_banco text
    check (tipo_cuenta_banco is null or tipo_cuenta_banco in ('ahorros', 'corriente')),
  numero_cuenta_banco text,
  clave_tss text check (clave_tss is null or clave_tss ~ '^[0-9]{3}$'),
  estado text not null default 'activo'
    check (estado in ('activo', 'suspendido', 'inactivo')),
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  unique (tipo_identificacion, identificacion),
  check (tipo_contrato = 'indefinido' or fecha_fin is not null),
  check (fecha_fin is null or fecha_fin >= fecha_ingreso),
  -- Cédula dominicana: 11 dígitos y dígito verificador DGII. Pasaporte y
  -- residencia no se validan (igual que contactos).
  check (
    tipo_identificacion <> 'cedula'
    or (
      identificacion ~ '^[0-9]{11}$'
      and public._rnc_digito_valido(identificacion)
    )
  )
);

create index if not exists empleados_estado_frecuencia_idx
  on public.empleados (estado, frecuencia_pago);
create index if not exists empleados_segmento_contable_idx
  on public.empleados (segmento_contable);
create index if not exists empleados_centro_costo_id_idx
  on public.empleados (centro_costo_id);

-- ---------------------------------------------------------------------------
-- Novedades recurrentes del empleado
-- ---------------------------------------------------------------------------

create table if not exists public.empleado_novedades_recurrentes (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados (id),
  concepto_id uuid not null references public.nomina_conceptos (id),
  monto numeric(14,2),
  porcentaje numeric(6,3),
  fecha_inicio date not null,
  fecha_fin date,
  activa boolean not null default true,
  notas text,
  creado_en timestamptz not null default now(),
  check ((monto is null) <> (porcentaje is null)),
  check (monto is null or monto > 0),
  check (porcentaje is null or (porcentaje > 0 and porcentaje <= 100)),
  check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

create index if not exists empleado_novedades_recurrentes_empleado_activa_idx
  on public.empleado_novedades_recurrentes (empleado_id, activa);
create index if not exists empleado_novedades_recurrentes_concepto_id_idx
  on public.empleado_novedades_recurrentes (concepto_id);

-- ---------------------------------------------------------------------------
-- Asientos: los orígenes de nómina
--
-- Se reemplaza el check vigente (20261124100000) con la lista COMPLETA: los
-- 16 valores actuales + 'pos_movimiento' + 'pos_diferencia' + 'nomina' +
-- 'pago_nomina'. La lista es la unión completa para que el orden de merge con
-- la migración POS no importe. No se pierde ninguno.
-- ---------------------------------------------------------------------------

do $$
declare
  v_nombre text;
begin
  select conname into v_nombre
  from pg_constraint
  where conrelid = 'public.asientos'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%origen_tipo%'
  limit 1;

  if v_nombre is not null then
    execute format('alter table public.asientos drop constraint %I', v_nombre);
  end if;
end;
$$;

alter table public.asientos
  add constraint asientos_origen_tipo_check check (origen_tipo in (
    'factura',
    'pago_recibido',
    'factura_proveedor',
    'pago_proveedor',
    'gasto_menor',
    'manual',
    'anulacion',
    'nota_credito_venta',
    'nota_credito_compra',
    'nota_debito',
    'transferencia',
    'deposito',
    'conciliacion',
    'ajuste_inventario',
    'saldo_inicial',
    'inventario_inicial',
    'pos_movimiento',
    'pos_diferencia',
    'nomina',
    'pago_nomina'
  ));

-- ---------------------------------------------------------------------------
-- RLS y permisos
--
-- Catálogos (@conservar en el reset): todos los perfiles leen; solo el admin
-- escribe directo (Configuración → Nómina).
-- Operativas (TRUNCATE en el reset): todos los perfiles leen; la escritura va
-- exclusivamente por RPC `security definer` (empleados en 3B).
-- ---------------------------------------------------------------------------

do $$
declare
  v_tabla text;
begin
  foreach v_tabla in array array[
    'nomina_parametros_rd',
    'nomina_config_empresa',
    'nomina_conceptos',
    'nomina_mapeo_contable'
  ] loop
    execute format('alter table public.%I enable row level security', v_tabla);
    execute format('revoke all on public.%I from anon', v_tabla);
    execute format('revoke all on public.%I from authenticated', v_tabla);
    execute format('grant select, insert, update on public.%I to authenticated', v_tabla);

    execute format(
      'drop policy if exists %I on public.%I',
      v_tabla || '_lectura',
      v_tabla
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.rol_actual()) is not null)',
      v_tabla || '_lectura',
      v_tabla
    );

    execute format(
      'drop policy if exists %I on public.%I',
      v_tabla || '_admin_escritura',
      v_tabla
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select public.rol_actual()) = ''admin'') with check ((select public.rol_actual()) = ''admin'')',
      v_tabla || '_admin_escritura',
      v_tabla
    );
  end loop;

  foreach v_tabla in array array[
    'empleados',
    'empleado_novedades_recurrentes'
  ] loop
    execute format('alter table public.%I enable row level security', v_tabla);
    execute format('revoke all on public.%I from anon', v_tabla);
    execute format('revoke all on public.%I from authenticated', v_tabla);
    execute format('grant select on public.%I to authenticated', v_tabla);

    execute format(
      'drop policy if exists %I on public.%I',
      v_tabla || '_lectura',
      v_tabla
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.rol_actual()) is not null)',
      v_tabla || '_lectura',
      v_tabla
    );
  end loop;
end;
$$;

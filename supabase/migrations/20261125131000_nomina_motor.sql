-- ---------------------------------------------------------------------------
-- Nómina RD — motor de cálculo, contabilización NO-*, pagos y anulaciones
--
-- Parte 2 de 2 del backend de nómina (contrato: docs/dominio-nomina.md).
-- Los catálogos, parámetros RD, conceptos, mapeo contable y empleados vienen
-- de 20261125130000_nomina_catalogos.sql; aquí solo viven las tablas
-- operativas y los RPC del ciclo secuencial:
--
--   crear periodo → calcular → contabilizar (NO-N por empleado) → pagar → colillas
--
-- · Tablas: nomina_periodos, nomina_recibos y nomina_recibo_lineas.
-- · Helpers internos: _nomina_crear_asiento (copia las validaciones de
--   _crear_asiento y además asigna tipo_entrada_id y codigo),
--   _nomina_revertir_asiento, _nomina_recalcular_periodo, _nomina_concepto_id,
--   _nomina_validar_cuenta y _nomina_insertar_linea.
-- · Cálculo: días prorrateados por ingreso/egreso, bases TSS con topes
--   proporcionales a la frecuencia, SFS/AFP del empleado y del empleador, ISR
--   por proyección anual DGII, SRL según riesgo, INFOTEP y provisiones.
-- · Contabilización: un asiento cuadrado por recibo, consecutivo NO-N con
--   FOR UPDATE, contactos (TSS, INFOTEP, DGII, empleado) y centro de costo.
-- · Pago: rechaza con 23514 si el recibo no está contabilizado; el débito usa
--   la cuenta de salarios por pagar guardada en el recibo.
-- · Anulación: primero el pago, después el recibo; el asiento NO-N se revierte
--   con un asiento de origen 'anulacion'.
--
-- RLS, grants y clasificación de reset los escribe la parte 1 (catálogos);
-- este archivo solo crea las tablas operativas.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Tablas operativas
-- ---------------------------------------------------------------------------

create table public.nomina_periodos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  frecuencia text not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  fecha_pago date,
  anio_fiscal int not null,
  estado text not null default 'borrador',
  total_salario numeric(14,2) not null default 0,
  total_ingresos numeric(14,2) not null default 0,
  total_deducciones numeric(14,2) not null default 0,
  total_aportes_empleador numeric(14,2) not null default 0,
  total_provisiones numeric(14,2) not null default 0,
  total_neto numeric(14,2) not null default 0,
  total_costo_empresa numeric(14,2) not null default 0,
  observaciones text,
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  constraint nomina_periodos_codigo_unico unique (codigo),
  constraint nomina_periodos_rango_unico unique (frecuencia, fecha_inicio, fecha_fin),
  constraint nomina_periodos_frecuencia_check check (frecuencia in ('quincenal', 'mensual')),
  constraint nomina_periodos_estado_check check (
    estado in ('borrador', 'calculado', 'contabilizado', 'pagado', 'anulado')
  ),
  constraint nomina_periodos_fechas_check check (fecha_fin >= fecha_inicio),
  constraint nomina_periodos_mismo_anio check (
    extract(year from fecha_inicio) = extract(year from fecha_fin)
  ),
  constraint nomina_periodos_anio_check check (anio_fiscal = extract(year from fecha_fin)::int),
  constraint nomina_periodos_codigo_formato check (codigo ~ '^[0-9]{4}-[0-9]{2}-(M|Q[12])$')
);

create table public.nomina_recibos (
  id uuid primary key default gen_random_uuid(),
  periodo_id uuid not null references public.nomina_periodos (id),
  empleado_id uuid not null references public.empleados (id),
  dias_trabajados numeric(6,3) not null default 0,
  salario_base numeric(14,2) not null default 0,
  base_tss numeric(14,2) not null default 0,
  base_sfs numeric(14,2) not null default 0,
  base_afp numeric(14,2) not null default 0,
  base_srl numeric(14,2) not null default 0,
  base_infotep numeric(14,2) not null default 0,
  base_isr numeric(14,2) not null default 0,
  total_ingresos numeric(14,2) not null default 0,
  total_deducciones numeric(14,2) not null default 0,
  total_aportes_empleador numeric(14,2) not null default 0,
  total_provisiones numeric(14,2) not null default 0,
  neto_pagar numeric(14,2) not null default 0,
  costo_total_empresa numeric(14,2) not null default 0,
  estado text not null default 'borrador',
  cuenta_salarios_por_pagar_id uuid references public.cuentas (id),
  asiento_id uuid references public.asientos (id),
  pago_asiento_id uuid references public.asientos (id),
  cuenta_pago_id uuid references public.cuentas (id),
  fecha_pagado date,
  colilla_enviada_en timestamptz,
  colilla_enviada_a text,
  creado_en timestamptz not null default now(),
  constraint nomina_recibos_periodo_empleado unique (periodo_id, empleado_id),
  constraint nomina_recibos_estado_check check (
    estado in ('borrador', 'calculado', 'contabilizado', 'pagado', 'anulado')
  ),
  constraint nomina_recibos_dias_check check (dias_trabajados >= 0),
  constraint nomina_recibos_neto_check check (neto_pagar >= 0),
  constraint nomina_recibos_pagado_fecha check (estado <> 'pagado' or fecha_pagado is not null),
  constraint nomina_recibos_contabilizado_asiento check (
    estado not in ('contabilizado', 'pagado') or asiento_id is not null
  ),
  constraint nomina_recibos_contabilizado_cuenta check (
    estado not in ('contabilizado', 'pagado') or cuenta_salarios_por_pagar_id is not null
  )
);

create table public.nomina_recibo_lineas (
  id uuid primary key default gen_random_uuid(),
  recibo_id uuid not null references public.nomina_recibos (id),
  concepto_id uuid not null references public.nomina_conceptos (id),
  clase text not null,
  cantidad numeric(10,3),
  porcentaje numeric(6,3),
  monto numeric(14,2) not null,
  origen text not null,
  notas text,
  orden int not null default 100,
  creado_en timestamptz not null default now(),
  constraint nomina_recibo_lineas_clase_check check (
    clase in ('ingreso', 'deduccion', 'aporte_empleador', 'provision')
  ),
  constraint nomina_recibo_lineas_origen_check check (origen in ('sistema', 'recurrente', 'manual')),
  constraint nomina_recibo_lineas_monto_check check (monto > 0),
  constraint nomina_recibo_lineas_cantidad_check check (cantidad is null or cantidad >= 0),
  constraint nomina_recibo_lineas_porcentaje_check check (porcentaje is null or porcentaje >= 0)
);

create index if not exists nomina_periodos_busqueda_idx
  on public.nomina_periodos (anio_fiscal, frecuencia, fecha_inicio desc);
create index if not exists nomina_recibos_periodo_idx on public.nomina_recibos (periodo_id);
create index if not exists nomina_recibos_empleado_idx on public.nomina_recibos (empleado_id);
create index if not exists nomina_recibos_estado_idx on public.nomina_recibos (estado);
create index if not exists nomina_recibo_lineas_recibo_idx on public.nomina_recibo_lineas (recibo_id);
create index if not exists nomina_recibo_lineas_concepto_idx on public.nomina_recibo_lineas (concepto_id);

-- Auditoría de estado y totales (los asientos ya se auditan por su trigger).
drop trigger if exists auditoria_nomina_periodos on public.nomina_periodos;
create trigger auditoria_nomina_periodos
  after insert or update or delete on public.nomina_periodos
  for each row
  execute function public._auditar('estado,total_neto,total_costo_empresa', 'codigo', 'nomina_periodo');

drop trigger if exists auditoria_nomina_recibos on public.nomina_recibos;
create trigger auditoria_nomina_recibos
  after insert or update or delete on public.nomina_recibos
  for each row
  execute function public._auditar('estado,neto_pagar,fecha_pagado', '', 'nomina_recibo');

-- ---------------------------------------------------------------------------
-- Helper: conceptos de nómina por código
-- ---------------------------------------------------------------------------

create or replace function public._nomina_concepto_id(p_codigo text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_activo boolean;
begin
  select c.id, c.activo into v_id, v_activo
  from public.nomina_conceptos c
  where lower(c.codigo) = lower(p_codigo);

  if v_id is null then
    raise exception 'Falta el concepto de nómina %.', p_codigo using errcode = '22023';
  end if;
  if not v_activo then
    raise exception 'El concepto de nómina % está inactivo.', p_codigo using errcode = '23514';
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helper: valida la cuenta de una línea del asiento de nómina
-- ---------------------------------------------------------------------------

create or replace function public._nomina_validar_cuenta(
  p_cuenta_id uuid,
  p_tipo text,
  p_concepto text,
  p_segmento text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cuenta public.cuentas%rowtype;
begin
  select * into v_cuenta from public.cuentas c where c.id = p_cuenta_id;
  if not found then
    raise exception 'No se encontró la cuenta contable del concepto % para el segmento %.',
      p_concepto, p_segmento using errcode = '22023';
  end if;

  if not v_cuenta.activa or not v_cuenta.acepta_movimientos then
    raise exception 'La cuenta % del concepto % para el segmento % está inactiva o no acepta movimientos.',
      v_cuenta.codigo, p_concepto, p_segmento using errcode = '23514';
  end if;

  if p_tipo = 'gasto' and v_cuenta.tipo not in ('gasto', 'costo') then
    raise exception 'La cuenta % del concepto % para el segmento % debe ser de gasto o costo.',
      v_cuenta.codigo, p_concepto, p_segmento using errcode = '23514';
  end if;

  if p_tipo = 'pasivo' and v_cuenta.tipo <> 'pasivo' then
    raise exception 'La cuenta % del concepto % para el segmento % debe ser de pasivo.',
      v_cuenta.codigo, p_concepto, p_segmento using errcode = '23514';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helper: inserta una línea del recibo (ignora montos en cero)
-- ---------------------------------------------------------------------------

create or replace function public._nomina_insertar_linea(
  p_recibo_id uuid,
  p_concepto_id uuid,
  p_clase text,
  p_cantidad numeric,
  p_porcentaje numeric,
  p_monto numeric,
  p_origen text,
  p_orden int
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_monto is null or p_monto <= 0 then
    return null;
  end if;

  insert into public.nomina_recibo_lineas (
    recibo_id, concepto_id, clase, cantidad, porcentaje, monto, origen, orden
  )
  values (
    p_recibo_id, p_concepto_id, p_clase, p_cantidad, p_porcentaje, round(p_monto, 2), p_origen,
    coalesce(p_orden, 100)
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helper: asiento de nómina con tipo de entrada y código (NO-N)
--
-- Replica las validaciones de _crear_asiento (2+ líneas, un solo lado por
-- línea, cuentas de detalle y cuadre exacto) y además guarda tipo_entrada_id
-- y codigo. No se modifica _crear_asiento: sus llamadas existentes viven en
-- funciones ya creadas y cambiarle la aridad dejaría dos versiones.
-- ---------------------------------------------------------------------------

create or replace function public._nomina_crear_asiento(
  p_fecha date,
  p_descripcion text,
  p_origen_tipo text,
  p_origen_id uuid,
  p_tipo_entrada_id uuid,
  p_codigo text,
  p_lineas jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asiento_id uuid;
  v_linea jsonb;
  v_cuenta_id uuid;
  v_debito numeric(14,2);
  v_credito numeric(14,2);
  v_debitos numeric(14,2) := 0;
  v_creditos numeric(14,2) := 0;
  v_lineas int;
begin
  if p_descripcion is null or trim(p_descripcion) = '' then
    raise exception 'La descripción del asiento es obligatoria.' using errcode = '22023';
  end if;

  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' then
    raise exception 'Las líneas del asiento son inválidas.' using errcode = '22023';
  end if;

  v_lineas := jsonb_array_length(p_lineas);
  if v_lineas < 2 then
    raise exception 'Un asiento requiere al menos 2 líneas.' using errcode = '23514';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_cuenta_id := nullif(v_linea->>'cuenta_id', '')::uuid;
    if v_cuenta_id is null then
      raise exception 'Cada línea del asiento requiere una cuenta.' using errcode = '22023';
    end if;

    v_debito := round(coalesce((v_linea->>'debito')::numeric, 0), 2);
    v_credito := round(coalesce((v_linea->>'credito')::numeric, 0), 2);

    if v_debito < 0 or v_credito < 0 then
      raise exception 'Los montos del asiento no pueden ser negativos.' using errcode = '22023';
    end if;

    if (v_debito = 0) = (v_credito = 0) then
      raise exception 'Cada línea debe llevar débito o crédito, nunca ambos.' using errcode = '23514';
    end if;

    if not exists (
      select 1 from public.cuentas c
      where c.id = v_cuenta_id and c.acepta_movimientos
    ) then
      raise exception 'La cuenta % no acepta movimientos.', v_cuenta_id using errcode = '23514';
    end if;

    v_debitos := v_debitos + v_debito;
    v_creditos := v_creditos + v_credito;
  end loop;

  if v_debitos <> v_creditos then
    raise exception 'El asiento está descuadrado (débitos %, créditos %).', v_debitos, v_creditos
      using errcode = '23514';
  end if;

  insert into public.asientos (
    fecha, descripcion, origen_tipo, origen_id, total, tipo_entrada_id, codigo, creado_por
  )
  values (
    coalesce(p_fecha, current_date), p_descripcion, p_origen_tipo, p_origen_id, v_debitos,
    p_tipo_entrada_id, p_codigo, auth.uid()
  )
  returning id into v_asiento_id;

  insert into public.asiento_lineas (
    asiento_id, cuenta_id, contacto_id, centro_costo_id, descripcion, debito, credito
  )
  select
    v_asiento_id,
    nullif(l->>'cuenta_id', '')::uuid,
    nullif(l->>'contacto_id', '')::uuid,
    nullif(l->>'centro_costo_id', '')::uuid,
    coalesce(l->>'descripcion', p_descripcion),
    round(coalesce((l->>'debito')::numeric, 0), 2),
    round(coalesce((l->>'credito')::numeric, 0), 2)
  from jsonb_array_elements(p_lineas) as l;

  return v_asiento_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helper: reversal de un asiento (líneas invertidas, anula_asiento_id)
-- ---------------------------------------------------------------------------

create or replace function public._nomina_revertir_asiento(
  p_asiento_id uuid,
  p_origen_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asiento public.asientos%rowtype;
  v_lineas jsonb;
  v_reversion uuid;
begin
  select * into v_asiento from public.asientos a where a.id = p_asiento_id;
  if not found then
    raise exception 'Asiento no encontrado.' using errcode = '22023';
  end if;

  if exists (select 1 from public.asientos a where a.anula_asiento_id = p_asiento_id) then
    raise exception 'El asiento ya fue revertido.' using errcode = '23514';
  end if;

  select jsonb_agg(jsonb_build_object(
    'cuenta_id', l.cuenta_id,
    'contacto_id', l.contacto_id,
    'centro_costo_id', l.centro_costo_id,
    'descripcion', 'Anulación: ' || left(coalesce(l.descripcion, ''), 70),
    'debito', l.credito,
    'credito', l.debito
  ) order by l.id)
  into v_lineas
  from public.asiento_lineas l
  where l.asiento_id = p_asiento_id;

  if v_lineas is null or jsonb_array_length(v_lineas) < 2 then
    raise exception 'El asiento no tiene líneas para revertir.' using errcode = '22023';
  end if;

  v_reversion := public._nomina_crear_asiento(
    current_date,
    'Anulación: ' || left(v_asiento.descripcion, 70),
    'anulacion',
    p_origen_id,
    null,
    null,
    v_lineas
  );

  update public.asientos a set anula_asiento_id = p_asiento_id where a.id = v_reversion;

  return v_reversion;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helper: recalcula totales y estado derivado del periodo
--
-- 1. Sin recibos no anulados → anulado.
-- 2. Todos pagados → pagado.
-- 3. Todos contabilizados o pagados → contabilizado.
-- 4. Todos calculados, contabilizados o pagados → calculado.
-- 5. En cualquier otro caso → borrador.
-- ---------------------------------------------------------------------------

create or replace function public._nomina_recalcular_periodo(p_periodo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_no_anulados int;
  v_pagados int;
  v_contabilizados int;
  v_calculados int;
  v_total_salario numeric(14,2);
  v_total_ingresos numeric(14,2);
  v_total_deducciones numeric(14,2);
  v_total_aportes numeric(14,2);
  v_total_provisiones numeric(14,2);
  v_total_neto numeric(14,2);
  v_total_costo numeric(14,2);
  v_estado text;
begin
  select
    count(*) filter (where r.estado <> 'anulado'),
    count(*) filter (where r.estado = 'pagado'),
    count(*) filter (where r.estado = 'contabilizado'),
    count(*) filter (where r.estado = 'calculado'),
    coalesce(sum(r.salario_base) filter (where r.estado <> 'anulado'), 0),
    coalesce(sum(r.total_ingresos) filter (where r.estado <> 'anulado'), 0),
    coalesce(sum(r.total_deducciones) filter (where r.estado <> 'anulado'), 0),
    coalesce(sum(r.total_aportes_empleador) filter (where r.estado <> 'anulado'), 0),
    coalesce(sum(r.total_provisiones) filter (where r.estado <> 'anulado'), 0),
    coalesce(sum(r.neto_pagar) filter (where r.estado <> 'anulado'), 0),
    coalesce(sum(r.costo_total_empresa) filter (where r.estado <> 'anulado'), 0)
  into
    v_no_anulados,
    v_pagados,
    v_contabilizados,
    v_calculados,
    v_total_salario,
    v_total_ingresos,
    v_total_deducciones,
    v_total_aportes,
    v_total_provisiones,
    v_total_neto,
    v_total_costo
  from public.nomina_recibos r
  where r.periodo_id = p_periodo_id;

  if v_no_anulados = 0 then
    v_estado := 'anulado';
  elsif v_pagados = v_no_anulados then
    v_estado := 'pagado';
  elsif v_pagados + v_contabilizados = v_no_anulados then
    v_estado := 'contabilizado';
  elsif v_pagados + v_contabilizados + v_calculados = v_no_anulados then
    v_estado := 'calculado';
  else
    v_estado := 'borrador';
  end if;

  update public.nomina_periodos p
  set
    estado = v_estado,
    total_salario = v_total_salario,
    total_ingresos = v_total_ingresos,
    total_deducciones = v_total_deducciones,
    total_aportes_empleador = v_total_aportes,
    total_provisiones = v_total_provisiones,
    total_neto = v_total_neto,
    total_costo_empresa = v_total_costo
  where p.id = p_periodo_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: crear periodo y sus recibos en borrador
-- ---------------------------------------------------------------------------

create or replace function public.nomina_crear_periodo(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_frecuencia text;
  v_inicio date;
  v_fin date;
  v_fecha_pago date;
  v_ultimo_dia date;
  v_anio int;
  v_codigo text;
  v_observaciones text;
  v_periodo_id uuid;
  v_factor numeric(6,3);
  v_dias_calendario int;
  v_dias_mes_laboral numeric;
  v_dias_laborales numeric;
  v_inicio_efectivo date;
  v_fin_efectivo date;
  v_dias_efectivos int;
  v_proporcion numeric;
  v_salario_base numeric(14,2);
  v_dias_trabajados numeric(6,3);
  v_emp record;
  v_recibo_id uuid;
  v_novedad record;
  v_recibos int := 0;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Datos del periodo de nómina requeridos.' using errcode = '22023';
  end if;

  v_frecuencia := nullif(trim(p->>'frecuencia'), '');
  if v_frecuencia is null or v_frecuencia not in ('quincenal', 'mensual') then
    raise exception 'La frecuencia debe ser quincenal o mensual.' using errcode = '22023';
  end if;

  if coalesce(trim(p->>'fecha_inicio'), '') = '' or coalesce(trim(p->>'fecha_fin'), '') = '' then
    raise exception 'Las fechas de inicio y fin del periodo son obligatorias.' using errcode = '22023';
  end if;

  v_inicio := (p->>'fecha_inicio')::date;
  v_fin := (p->>'fecha_fin')::date;
  v_fecha_pago := nullif(trim(p->>'fecha_pago'), '')::date;
  v_observaciones := nullif(trim(p->>'observaciones'), '');

  if v_fin < v_inicio then
    raise exception 'La fecha fin no puede ser anterior a la fecha inicio.' using errcode = '22023';
  end if;

  if extract(year from v_inicio) <> extract(year from v_fin) then
    raise exception 'El periodo no puede cruzar de año.' using errcode = '22023';
  end if;

  v_ultimo_dia := (date_trunc('month', v_inicio)::date + interval '1 month - 1 day')::date;

  if v_frecuencia = 'mensual' then
    if v_inicio <> date_trunc('month', v_inicio)::date or v_fin <> v_ultimo_dia then
      raise exception 'El periodo mensual debe ir del primer al último día del mes.' using errcode = '22023';
    end if;
  elsif extract(day from v_inicio)::int = 1 then
    if v_fin <> v_inicio + 14 then
      raise exception 'La primera quincena debe ir del día 1 al 15.' using errcode = '22023';
    end if;
  elsif extract(day from v_inicio)::int = 16 then
    if v_fin <> v_ultimo_dia then
      raise exception 'La segunda quincena debe ir del día 16 al último del mes.' using errcode = '22023';
    end if;
  else
    raise exception 'La quincena debe empezar el día 1 o el día 16.' using errcode = '22023';
  end if;

  v_anio := extract(year from v_fin)::int;
  select pr.dias_mes_laboral into v_dias_mes_laboral
  from public.nomina_parametros_rd pr
  where pr.anio = v_anio;
  if not found then
    raise exception 'No hay parámetros de nómina para el año %.', v_anio using errcode = '22023';
  end if;

  if v_frecuencia = 'mensual' then
    v_codigo := to_char(v_inicio, 'YYYY-MM') || '-M';
  elsif extract(day from v_inicio)::int = 1 then
    v_codigo := to_char(v_inicio, 'YYYY-MM') || '-Q1';
  else
    v_codigo := to_char(v_inicio, 'YYYY-MM') || '-Q2';
  end if;

  if exists (select 1 from public.nomina_periodos np where np.codigo = v_codigo) then
    raise exception 'Ya existe un periodo de nómina con ese código.' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.nomina_periodos np
    where np.frecuencia = v_frecuencia
      and np.estado <> 'anulado'
      and daterange(np.fecha_inicio, np.fecha_fin, '[]') && daterange(v_inicio, v_fin, '[]')
  ) then
    raise exception 'Ya existe un periodo de nómina de la misma frecuencia en ese rango de fechas.'
      using errcode = '23514';
  end if;

  insert into public.nomina_periodos (
    codigo, frecuencia, fecha_inicio, fecha_fin, fecha_pago, anio_fiscal, estado, observaciones
  )
  values (
    v_codigo, v_frecuencia, v_inicio, v_fin, v_fecha_pago, v_anio, 'borrador', v_observaciones
  )
  returning id into v_periodo_id;

  v_factor := case when v_frecuencia = 'mensual' then 1 else 0.5 end;
  v_dias_calendario := v_fin - v_inicio + 1;

  for v_emp in
    select e.*
    from public.empleados e
    where e.estado = 'activo'
      and e.frecuencia_pago = v_frecuencia
      and e.fecha_ingreso <= v_fin
      and (e.fecha_fin is null or e.fecha_fin >= v_inicio)
      and not exists (
        select 1
        from public.nomina_recibos r
        join public.nomina_periodos np on np.id = r.periodo_id
        where r.empleado_id = e.id
          and r.estado <> 'anulado'
          and daterange(np.fecha_inicio, np.fecha_fin, '[]') && daterange(v_inicio, v_fin, '[]')
      )
    order by e.primer_apellido, e.primer_nombre
  loop
    v_inicio_efectivo := greatest(v_inicio, v_emp.fecha_ingreso);
    v_fin_efectivo := least(v_fin, coalesce(v_emp.fecha_fin, v_fin));
    v_dias_efectivos := greatest(0, v_fin_efectivo - v_inicio_efectivo + 1);
    continue when v_dias_efectivos = 0;

    v_proporcion := v_dias_efectivos::numeric / v_dias_calendario;
    v_dias_laborales := v_dias_mes_laboral * v_factor;
    v_dias_trabajados := round(v_dias_laborales * v_proporcion, 3);
    v_salario_base := round(v_emp.salario_mensual * v_factor * v_proporcion, 2);

    insert into public.nomina_recibos (
      periodo_id, empleado_id, dias_trabajados, salario_base, estado
    )
    values (
      v_periodo_id, v_emp.id, v_dias_trabajados, v_salario_base, 'borrador'
    )
    returning id into v_recibo_id;

    -- Preview de las novedades recurrentes vigentes (sin prorrata).
    for v_novedad in
      select
        c.id as concepto_id,
        c.clase,
        c.orden,
        n.porcentaje,
        round(coalesce(n.monto, v_salario_base * n.porcentaje / 100), 2) as monto
      from public.empleado_novedades_recurrentes n
      join public.nomina_conceptos c on c.id = n.concepto_id
      where n.empleado_id = v_emp.id
        and n.activa
        and n.fecha_inicio <= v_fin
        and (n.fecha_fin is null or n.fecha_fin >= v_inicio)
        and c.activo
        and c.clase in ('ingreso', 'deduccion')
      order by c.orden, n.id
    loop
      perform public._nomina_insertar_linea(
        v_recibo_id,
        v_novedad.concepto_id,
        v_novedad.clase,
        null,
        v_novedad.porcentaje,
        v_novedad.monto,
        'recurrente',
        v_novedad.orden
      );
    end loop;

    v_recibos := v_recibos + 1;
  end loop;

  if v_recibos = 0 then
    raise exception 'No hay empleados activos con contrato vigente para el periodo de nómina.'
      using errcode = '22023';
  end if;

  return v_periodo_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: novedades manuales del recibo
-- ---------------------------------------------------------------------------

create or replace function public.nomina_guardar_novedad_recibo(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_recibo public.nomina_recibos%rowtype;
  v_empleado public.empleados%rowtype;
  v_params public.nomina_parametros_rd%rowtype;
  v_concepto public.nomina_conceptos%rowtype;
  v_linea public.nomina_recibo_lineas%rowtype;
  v_linea_id uuid;
  v_cantidad numeric(10,3);
  v_porcentaje numeric(6,3);
  v_monto numeric(14,2);
  v_factor numeric;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Datos de la novedad requeridos.' using errcode = '22023';
  end if;

  if nullif(trim(p->>'recibo_id'), '') is null then
    raise exception 'El recibo es obligatorio.' using errcode = '22023';
  end if;

  select * into v_recibo
  from public.nomina_recibos r
  where r.id = (p->>'recibo_id')::uuid
  for update;
  if not found then
    raise exception 'Recibo de nómina no encontrado.' using errcode = '22023';
  end if;
  if v_recibo.estado not in ('borrador', 'calculado') then
    raise exception 'El recibo está %; no se puede editar.', v_recibo.estado using errcode = '23514';
  end if;

  if nullif(trim(p->>'concepto_id'), '') is null then
    raise exception 'El concepto es obligatorio.' using errcode = '22023';
  end if;

  select * into v_concepto
  from public.nomina_conceptos c
  where c.id = (p->>'concepto_id')::uuid;
  if not found then
    raise exception 'Concepto de nómina no encontrado.' using errcode = '22023';
  end if;
  if not v_concepto.activo then
    raise exception 'El concepto de nómina % está inactivo.', v_concepto.codigo using errcode = '23514';
  end if;
  if v_concepto.clase not in ('ingreso', 'deduccion') then
    raise exception 'Solo se agregan ingresos y deducciones al recibo.' using errcode = '22023';
  end if;

  select * into v_empleado from public.empleados e where e.id = v_recibo.empleado_id;
  if not found then
    raise exception 'Empleado no encontrado.' using errcode = '22023';
  end if;

  v_cantidad := nullif(trim(p->>'cantidad'), '')::numeric;
  v_porcentaje := nullif(trim(p->>'porcentaje'), '')::numeric;
  v_monto := nullif(trim(p->>'monto'), '')::numeric;

  if v_concepto.es_sistema
     and lower(v_concepto.codigo) not in ('horas_extra_35', 'horas_extra_100') then
    raise exception 'El concepto % lo calcula el sistema y no se agrega a mano.', v_concepto.codigo
      using errcode = '23514';
  end if;

  if lower(v_concepto.codigo) in ('horas_extra_35', 'horas_extra_100') then
    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Las horas extra requieren una cantidad mayor que cero.' using errcode = '22023';
    end if;

    select * into v_params
    from public.nomina_parametros_rd pr
    where pr.anio = (
      select np.anio_fiscal from public.nomina_periodos np where np.id = v_recibo.periodo_id
    );
    if not found then
      raise exception 'No hay parámetros de nómina para el año del periodo.' using errcode = '22023';
    end if;

    v_factor := case when lower(v_concepto.codigo) = 'horas_extra_100' then 2.00 else 1.35 end;
    v_monto := round(
      v_empleado.salario_mensual / v_params.dias_mes_laboral / v_params.horas_dia_laboral
      * v_factor * v_cantidad,
      2
    );
    v_porcentaje := case when lower(v_concepto.codigo) = 'horas_extra_100' then 200.000 else 135.000 end;
  else
    if v_monto is not null and v_porcentaje is not null then
      raise exception 'Indica un monto o un porcentaje, no ambos.' using errcode = '22023';
    end if;
    if v_porcentaje is not null then
      if v_porcentaje <= 0 or v_porcentaje > 100 then
        raise exception 'El porcentaje debe ser mayor que cero y máximo 100.' using errcode = '22023';
      end if;
      v_monto := round(v_recibo.salario_base * v_porcentaje / 100, 2);
    elsif v_monto is null or v_monto <= 0 then
      raise exception 'Indica un monto o un porcentaje mayor que cero.' using errcode = '22023';
    end if;
  end if;

  if v_monto is null or v_monto <= 0 then
    raise exception 'El monto de la novedad debe ser mayor que cero.' using errcode = '22023';
  end if;

  if nullif(trim(p->>'id'), '') is not null then
    v_linea_id := (p->>'id')::uuid;
    select * into v_linea
    from public.nomina_recibo_lineas l
    where l.id = v_linea_id and l.recibo_id = v_recibo.id
    for update;
    if not found then
      raise exception 'La novedad del recibo no existe.' using errcode = '22023';
    end if;
    if v_linea.origen <> 'manual' then
      raise exception 'Solo se editan novedades manuales del recibo.' using errcode = '23514';
    end if;

    update public.nomina_recibo_lineas l
    set
      concepto_id = v_concepto.id,
      clase = v_concepto.clase,
      cantidad = v_cantidad,
      porcentaje = v_porcentaje,
      monto = v_monto,
      notas = case when p ? 'notas' then nullif(trim(p->>'notas'), '') else l.notas end,
      orden = v_concepto.orden
    where l.id = v_linea_id;
  else
    insert into public.nomina_recibo_lineas (
      recibo_id, concepto_id, clase, cantidad, porcentaje, monto, origen, notas, orden
    )
    values (
      v_recibo.id, v_concepto.id, v_concepto.clase, v_cantidad, v_porcentaje, v_monto, 'manual',
      nullif(trim(p->>'notas'), ''), v_concepto.orden
    )
    returning id into v_linea_id;
  end if;

  if v_recibo.estado = 'calculado' then
    update public.nomina_recibos r set estado = 'borrador' where r.id = v_recibo.id;
    perform public._nomina_recalcular_periodo(v_recibo.periodo_id);
  end if;

  return jsonb_build_object('linea_id', v_linea_id, 'monto', v_monto);
end;
$$;

create or replace function public.nomina_eliminar_novedad_recibo(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_linea public.nomina_recibo_lineas%rowtype;
  v_recibo public.nomina_recibos%rowtype;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select * into v_linea from public.nomina_recibo_lineas l where l.id = p_id;
  if not found then
    raise exception 'La novedad del recibo no existe.' using errcode = '22023';
  end if;

  select * into v_recibo
  from public.nomina_recibos r
  where r.id = v_linea.recibo_id
  for update;
  if not found then
    raise exception 'Recibo de nómina no encontrado.' using errcode = '22023';
  end if;
  if v_recibo.estado not in ('borrador', 'calculado') then
    raise exception 'El recibo está %; no se puede editar.', v_recibo.estado using errcode = '23514';
  end if;
  if v_linea.origen <> 'manual' then
    raise exception 'Solo se eliminan novedades manuales del recibo.' using errcode = '23514';
  end if;

  delete from public.nomina_recibo_lineas l where l.id = p_id;

  if v_recibo.estado = 'calculado' then
    update public.nomina_recibos r set estado = 'borrador' where r.id = v_recibo.id;
  end if;

  perform public._nomina_recalcular_periodo(v_recibo.periodo_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: cálculo de un recibo
-- ---------------------------------------------------------------------------

create or replace function public.nomina_calcular_recibo(p_recibo_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_recibo public.nomina_recibos%rowtype;
  v_periodo public.nomina_periodos%rowtype;
  v_empleado public.empleados%rowtype;
  v_params public.nomina_parametros_rd%rowtype;
  v_config public.nomina_config_empresa%rowtype;
  v_empleado_nombre text;
  v_factor numeric(6,3);
  v_periodos_por_mes int;
  v_dias_calendario int;
  v_inicio_efectivo date;
  v_fin_efectivo date;
  v_dias_efectivos int;
  v_proporcion numeric;
  v_dias_laborales numeric;
  v_dias_trabajados numeric(6,3);
  v_salario_base numeric(14,2);
  v_base_tss numeric(14,2);
  v_base_isr numeric(14,2);
  v_base_infotep numeric(14,2);
  v_base_sfs numeric(14,2);
  v_base_afp numeric(14,2);
  v_base_srl numeric(14,2);
  v_sfs numeric(14,2);
  v_afp numeric(14,2);
  v_isr numeric(14,2) := 0;
  v_sfs_empleador numeric(14,2);
  v_afp_empleador numeric(14,2);
  v_srl numeric(14,2);
  v_infotep numeric(14,2);
  v_tasa_srl numeric(6,3);
  v_total_ingresos numeric(14,2);
  v_total_deducciones numeric(14,2);
  v_total_aportes numeric(14,2);
  v_total_provisiones numeric(14,2);
  v_neto numeric(14,2);
  v_costo numeric(14,2);
  v_mes_inicio int;
  v_mes_fin int;
  v_meses int;
  v_periodos_restantes int;
  v_base_mensual_tss numeric;
  v_base_mensual_isr numeric;
  v_ingreso_anual numeric;
  v_sfs_proy numeric;
  v_afp_proy numeric;
  v_tss_anual numeric;
  v_base_gravable numeric;
  v_tramo jsonb;
  v_isr_anual numeric;
  v_antiguedad_5 boolean;
  v_dias_vacaciones numeric;
  v_dias_cesantia numeric;
  v_provision numeric(14,2);
  v_linea record;
  v_concepto_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select * into v_recibo
  from public.nomina_recibos r
  where r.id = p_recibo_id
  for update;
  if not found then
    raise exception 'Recibo de nómina no encontrado.' using errcode = '22023';
  end if;
  if v_recibo.estado not in ('borrador', 'calculado') then
    raise exception 'El recibo está %; no se puede calcular.', v_recibo.estado using errcode = '23514';
  end if;

  select * into v_periodo from public.nomina_periodos p where p.id = v_recibo.periodo_id;
  if not found then
    raise exception 'Periodo de nómina no encontrado.' using errcode = '22023';
  end if;

  select * into v_empleado from public.empleados e where e.id = v_recibo.empleado_id;
  if not found then
    raise exception 'Empleado no encontrado.' using errcode = '22023';
  end if;

  select c.nombre into v_empleado_nombre
  from public.contactos c
  where c.id = v_empleado.contacto_id;
  if v_empleado_nombre is null then
    raise exception 'El empleado no tiene un contacto vinculado.' using errcode = '22023';
  end if;

  select * into v_params from public.nomina_parametros_rd pr where pr.anio = v_periodo.anio_fiscal;
  if not found then
    raise exception 'No hay parámetros de nómina para el año %.', v_periodo.anio_fiscal
      using errcode = '22023';
  end if;

  select * into v_config from public.nomina_config_empresa ce where ce.id = 1;
  if not found then
    raise exception 'Falta la configuración de la empresa para la nómina.' using errcode = '22023';
  end if;

  v_factor := case when v_periodo.frecuencia = 'mensual' then 1 else 0.5 end;
  v_periodos_por_mes := case when v_periodo.frecuencia = 'mensual' then 1 else 2 end;
  v_dias_calendario := v_periodo.fecha_fin - v_periodo.fecha_inicio + 1;
  v_inicio_efectivo := greatest(v_periodo.fecha_inicio, v_empleado.fecha_ingreso);
  v_fin_efectivo := least(v_periodo.fecha_fin, coalesce(v_empleado.fecha_fin, v_periodo.fecha_fin));
  v_dias_efectivos := greatest(0, v_fin_efectivo - v_inicio_efectivo + 1);

  if v_dias_efectivos = 0 then
    raise exception 'El contrato del empleado no se cruza con el periodo %; anula el recibo.',
      v_periodo.codigo using errcode = '23514';
  end if;

  v_proporcion := v_dias_efectivos::numeric / v_dias_calendario;
  v_dias_laborales := v_params.dias_mes_laboral * v_factor;
  v_dias_trabajados := round(v_dias_laborales * v_proporcion, 3);
  v_salario_base := round(v_empleado.salario_mensual * v_factor * v_proporcion, 2);

  delete from public.nomina_recibo_lineas l
  where l.recibo_id = p_recibo_id and l.origen in ('sistema', 'recurrente');

  -- Salario del periodo.
  if v_salario_base > 0 then
    v_concepto_id := public._nomina_concepto_id('SALARIO');
    perform public._nomina_insertar_linea(
      p_recibo_id, v_concepto_id, 'ingreso', v_dias_trabajados, null, v_salario_base, 'sistema', 10
    );
  end if;

  -- Novedades recurrentes vigentes (se regeneran desde la ficha del empleado).
  if exists (
    select 1
    from public.empleado_novedades_recurrentes n
    join public.nomina_conceptos c on c.id = n.concepto_id
    where n.empleado_id = v_empleado.id
      and n.activa
      and n.fecha_inicio <= v_periodo.fecha_fin
      and (n.fecha_fin is null or n.fecha_fin >= v_periodo.fecha_inicio)
      and not c.activo
  ) then
    raise exception 'Una novedad recurrente del empleado usa un concepto de nómina inactivo.'
      using errcode = '23514';
  end if;

  for v_linea in
    select
      c.id as concepto_id,
      c.clase,
      c.orden,
      n.porcentaje,
      round(coalesce(n.monto, v_salario_base * n.porcentaje / 100), 2) as monto
    from public.empleado_novedades_recurrentes n
    join public.nomina_conceptos c on c.id = n.concepto_id
    where n.empleado_id = v_empleado.id
      and n.activa
      and n.fecha_inicio <= v_periodo.fecha_fin
      and (n.fecha_fin is null or n.fecha_fin >= v_periodo.fecha_inicio)
      and c.activo
      and c.clase in ('ingreso', 'deduccion')
    order by c.orden, n.id
  loop
    perform public._nomina_insertar_linea(
      p_recibo_id, v_linea.concepto_id, v_linea.clase, null, v_linea.porcentaje, v_linea.monto,
      'recurrente', v_linea.orden
    );
  end loop;

  -- Novedades manuales: se conservan; las horas extra recalculan su monto.
  for v_linea in
    select l.id, l.cantidad, c.codigo, c.activo
    from public.nomina_recibo_lineas l
    join public.nomina_conceptos c on c.id = l.concepto_id
    where l.recibo_id = p_recibo_id and l.origen = 'manual'
    order by l.id
  loop
    if not v_linea.activo then
      raise exception 'El concepto % de una novedad manual está inactivo.', v_linea.codigo
        using errcode = '23514';
    end if;

    if lower(v_linea.codigo) in ('horas_extra_35', 'horas_extra_100') then
      if v_linea.cantidad is null or v_linea.cantidad <= 0 then
        raise exception 'Las horas extra requieren una cantidad mayor que cero.' using errcode = '22023';
      end if;

      update public.nomina_recibo_lineas l
      set
        monto = round(
          v_empleado.salario_mensual / v_params.dias_mes_laboral / v_params.horas_dia_laboral
          * (case when lower(v_linea.codigo) = 'horas_extra_100' then 2.00 else 1.35 end)
          * v_linea.cantidad,
          2
        ),
        porcentaje = case
          when lower(v_linea.codigo) = 'horas_extra_100' then 200.000
          else 135.000
        end
      where l.id = v_linea.id;
    end if;
  end loop;

  -- Bases gravables.
  select
    coalesce(sum(l.monto) filter (where c.grava_tss), 0),
    coalesce(sum(l.monto) filter (where c.grava_isr), 0),
    coalesce(sum(l.monto) filter (where c.grava_infotep), 0)
  into v_base_tss, v_base_isr, v_base_infotep
  from public.nomina_recibo_lineas l
  join public.nomina_conceptos c on c.id = l.concepto_id
  where l.recibo_id = p_recibo_id and l.clase = 'ingreso';

  v_base_sfs := least(v_base_tss, round(v_params.tope_sfs_mensual * v_factor, 2));
  v_base_afp := least(v_base_tss, round(v_params.tope_afp_mensual * v_factor, 2));
  v_base_srl := least(v_base_tss, round(v_params.tope_srl_mensual * v_factor, 2));

  -- Retenciones del empleado.
  v_sfs := round(v_base_sfs * v_params.tasa_sfs_empleado / 100, 2);
  v_afp := round(v_base_afp * v_params.tasa_afp_empleado / 100, 2);

  -- ISR por proyección anual (DGII).
  v_base_mensual_tss := v_base_tss / (v_factor * v_proporcion);
  v_base_mensual_isr := v_base_isr / (v_factor * v_proporcion);
  v_mes_inicio := case
    when extract(year from v_empleado.fecha_ingreso)::int < v_periodo.anio_fiscal then 1
    else extract(month from v_empleado.fecha_ingreso)::int
  end;
  v_mes_fin := case
    when v_empleado.fecha_fin is not null
      and extract(year from v_empleado.fecha_fin)::int = v_periodo.anio_fiscal
      then extract(month from v_empleado.fecha_fin)::int
    else 12
  end;
  v_meses := greatest(1, v_mes_fin - v_mes_inicio + 1);
  -- Proyección por periodos de pago que faltan en el año (incluido este),
  -- no por meses completos: un ingreso a mitad de quincena no puede retener
  -- como si hubiera trabajado el mes entero.
  v_periodos_restantes := case
    when v_periodo.frecuencia = 'mensual'
      then v_mes_fin - extract(month from v_periodo.fecha_fin)::int + 1
    when extract(day from v_periodo.fecha_fin)::int <= 15
      then 2 * (v_mes_fin - extract(month from v_periodo.fecha_fin)::int) + 2
    else 2 * (v_mes_fin - extract(month from v_periodo.fecha_fin)::int) + 1
  end;
  v_periodos_restantes := greatest(1, v_periodos_restantes);
  if v_empleado.fecha_fin is not null
    and v_empleado.fecha_fin between v_periodo.fecha_inicio and v_periodo.fecha_fin then
    v_periodos_restantes := 1;
  end if;

  v_ingreso_anual := v_base_isr
    + (v_periodos_restantes - 1) * round(v_empleado.salario_mensual / v_periodos_por_mes, 2);
  v_sfs_proy := round(
    least(v_base_mensual_tss, v_params.tope_sfs_mensual) * v_params.tasa_sfs_empleado / 100, 2
  );
  v_afp_proy := round(
    least(v_base_mensual_tss, v_params.tope_afp_mensual) * v_params.tasa_afp_empleado / 100, 2
  );
  v_tss_anual := (v_sfs + v_afp)
    + (v_periodos_restantes - 1) * (v_sfs_proy + v_afp_proy);
  v_base_gravable := greatest(0, v_ingreso_anual - v_tss_anual);

  v_tramo := null;
  if v_base_gravable > 0 then
    select t.tramo into v_tramo
    from (
      select elem as tramo
      from jsonb_array_elements(v_params.escala_isr_anual) as elem
    ) as t
    where v_base_gravable > (t.tramo->>'desde')::numeric
    order by (t.tramo->>'desde')::numeric desc
    limit 1;
  end if;

  v_isr_anual := 0;
  if v_tramo is not null then
    v_isr_anual := coalesce((v_tramo->>'monto_fijo')::numeric, 0)
      + coalesce((v_tramo->>'tasa')::numeric, 0) / 100
        * (v_base_gravable - (v_tramo->>'desde')::numeric);
  end if;
  v_isr := greatest(0, round(v_isr_anual / v_periodos_restantes, 2));

  if v_sfs > 0 then
    v_concepto_id := public._nomina_concepto_id('SFS');
    perform public._nomina_insertar_linea(
      p_recibo_id, v_concepto_id, 'deduccion', null,
      round(v_params.tasa_sfs_empleado, 3), v_sfs, 'sistema', 200
    );
  end if;

  if v_afp > 0 then
    v_concepto_id := public._nomina_concepto_id('AFP');
    perform public._nomina_insertar_linea(
      p_recibo_id, v_concepto_id, 'deduccion', null,
      round(v_params.tasa_afp_empleado, 3), v_afp, 'sistema', 210
    );
  end if;

  if v_isr > 0 then
    v_concepto_id := public._nomina_concepto_id('ISR');
    perform public._nomina_insertar_linea(
      p_recibo_id, v_concepto_id, 'deduccion', null, null, v_isr, 'sistema', 220
    );
  end if;

  -- Cargas patronales.
  v_sfs_empleador := round(v_base_sfs * v_params.tasa_sfs_empleador / 100, 2);
  v_afp_empleador := round(v_base_afp * v_params.tasa_afp_empleador / 100, 2);

  v_tasa_srl := case v_config.riesgo_laboral
    when 'tipo_2' then v_params.tasa_srl_tipo_2
    when 'tipo_3' then v_params.tasa_srl_tipo_3
    when 'tipo_4' then v_params.tasa_srl_tipo_4
    else v_params.tasa_srl_tipo_1
  end;
  v_srl := round(v_base_srl * v_tasa_srl / 100, 2);
  v_infotep := round(v_base_infotep * v_params.tasa_infotep / 100, 2);

  if v_sfs_empleador > 0 then
    v_concepto_id := public._nomina_concepto_id('SFS_EMPLEADOR');
    perform public._nomina_insertar_linea(
      p_recibo_id, v_concepto_id, 'aporte_empleador', null,
      round(v_params.tasa_sfs_empleador, 3), v_sfs_empleador, 'sistema', 300
    );
  end if;

  if v_afp_empleador > 0 then
    v_concepto_id := public._nomina_concepto_id('AFP_EMPLEADOR');
    perform public._nomina_insertar_linea(
      p_recibo_id, v_concepto_id, 'aporte_empleador', null,
      round(v_params.tasa_afp_empleador, 3), v_afp_empleador, 'sistema', 310
    );
  end if;

  if v_srl > 0 then
    v_concepto_id := public._nomina_concepto_id('SRL');
    perform public._nomina_insertar_linea(
      p_recibo_id, v_concepto_id, 'aporte_empleador', null,
      round(v_tasa_srl, 3), v_srl, 'sistema', 320
    );
  end if;

  if v_config.aplica_infotep and v_infotep > 0 then
    v_concepto_id := public._nomina_concepto_id('INFOTEP');
    perform public._nomina_insertar_linea(
      p_recibo_id, v_concepto_id, 'aporte_empleador', null,
      round(v_params.tasa_infotep, 3), v_infotep, 'sistema', 330
    );
  end if;

  -- Provisiones (solo si la configuración lo pide).
  if v_config.registrar_provisiones then
    v_antiguedad_5 := v_empleado.fecha_ingreso <= (v_periodo.fecha_fin - interval '5 years')::date;

    v_provision := round(v_base_tss / 12, 2);
    if v_provision > 0 then
      v_concepto_id := public._nomina_concepto_id('PROVISION_NAVIDAD');
      perform public._nomina_insertar_linea(
        p_recibo_id, v_concepto_id, 'provision', null, null, v_provision, 'sistema', 400
      );
    end if;

    v_dias_vacaciones := case when v_antiguedad_5 then 18 else 14 end;
    v_provision := round(
      v_base_tss * v_dias_vacaciones / (v_params.dias_mes_laboral * 12), 2
    );
    if v_provision > 0 then
      v_concepto_id := public._nomina_concepto_id('PROVISION_VACACIONES');
      perform public._nomina_insertar_linea(
        p_recibo_id, v_concepto_id, 'provision', null, null, v_provision, 'sistema', 410
      );
    end if;

    v_dias_cesantia := case when v_antiguedad_5 then 23 else 21 end;
    v_provision := round(
      v_base_tss * v_dias_cesantia / (v_params.dias_mes_laboral * 12), 2
    );
    if v_provision > 0 then
      v_concepto_id := public._nomina_concepto_id('PROVISION_CESANTIA');
      perform public._nomina_insertar_linea(
        p_recibo_id, v_concepto_id, 'provision', null, null, v_provision, 'sistema', 420
      );
    end if;
  end if;

  -- Totales del recibo (suma de líneas ya redondeadas).
  select
    coalesce(sum(l.monto) filter (where l.clase = 'ingreso'), 0),
    coalesce(sum(l.monto) filter (where l.clase = 'deduccion'), 0),
    coalesce(sum(l.monto) filter (where l.clase = 'aporte_empleador'), 0),
    coalesce(sum(l.monto) filter (where l.clase = 'provision'), 0)
  into v_total_ingresos, v_total_deducciones, v_total_aportes, v_total_provisiones
  from public.nomina_recibo_lineas l
  where l.recibo_id = p_recibo_id;

  v_neto := v_total_ingresos - v_total_deducciones;
  if v_neto < 0 then
    raise exception 'Las deducciones (RD$%) superan los ingresos (RD$%) del recibo de %.',
      v_total_deducciones, v_total_ingresos, v_empleado_nombre using errcode = '23514';
  end if;

  v_costo := v_total_ingresos + v_total_aportes + v_total_provisiones;

  update public.nomina_recibos r
  set
    dias_trabajados = v_dias_trabajados,
    salario_base = v_salario_base,
    base_tss = v_base_tss,
    base_sfs = v_base_sfs,
    base_afp = v_base_afp,
    base_srl = v_base_srl,
    base_infotep = v_base_infotep,
    base_isr = v_base_isr,
    total_ingresos = v_total_ingresos,
    total_deducciones = v_total_deducciones,
    total_aportes_empleador = v_total_aportes,
    total_provisiones = v_total_provisiones,
    neto_pagar = v_neto,
    costo_total_empresa = v_costo,
    estado = 'calculado'
  where r.id = p_recibo_id;

  perform public._nomina_recalcular_periodo(v_periodo.id);

  return p_recibo_id;
end;
$$;

create or replace function public.nomina_calcular_periodo(p_periodo_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_periodo public.nomina_periodos%rowtype;
  v_recibo record;
  v_recibos int := 0;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select * into v_periodo from public.nomina_periodos p where p.id = p_periodo_id;
  if not found then
    raise exception 'Periodo de nómina no encontrado.' using errcode = '22023';
  end if;
  if v_periodo.estado in ('contabilizado', 'pagado', 'anulado') then
    raise exception 'El periodo % no se puede calcular en estado %.', v_periodo.codigo, v_periodo.estado
      using errcode = '23514';
  end if;

  for v_recibo in
    select r.id
    from public.nomina_recibos r
    where r.periodo_id = p_periodo_id
      and r.estado in ('borrador', 'calculado')
    order by r.creado_en, r.id
  loop
    perform public.nomina_calcular_recibo(v_recibo.id);
    v_recibos := v_recibos + 1;
  end loop;

  select * into v_periodo from public.nomina_periodos p where p.id = p_periodo_id;

  return jsonb_build_object(
    'recibos', v_recibos,
    'total_neto', v_periodo.total_neto,
    'total_costo_empresa', v_periodo.total_costo_empresa
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: contabilización NO-N (un asiento por empleado)
-- ---------------------------------------------------------------------------

create or replace function public.nomina_contabilizar_recibo(p_recibo_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_recibo public.nomina_recibos%rowtype;
  v_periodo public.nomina_periodos%rowtype;
  v_empleado public.empleados%rowtype;
  v_config public.nomina_config_empresa%rowtype;
  v_empleado_nombre text;
  v_tipo public.tipos_entrada_diario%rowtype;
  v_codigo text;
  v_lineas jsonb := '[]'::jsonb;
  v_linea record;
  v_contacto_linea uuid;
  v_asiento_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select * into v_recibo
  from public.nomina_recibos r
  where r.id = p_recibo_id
  for update;
  if not found then
    raise exception 'Recibo de nómina no encontrado.' using errcode = '22023';
  end if;
  if v_recibo.estado <> 'calculado' then
    raise exception 'El recibo no está calculado; contabilízalo antes.' using errcode = '23514';
  end if;

  select * into v_periodo from public.nomina_periodos p where p.id = v_recibo.periodo_id;
  if not found then
    raise exception 'Periodo de nómina no encontrado.' using errcode = '22023';
  end if;

  select * into v_empleado from public.empleados e where e.id = v_recibo.empleado_id;
  if not found then
    raise exception 'Empleado no encontrado.' using errcode = '22023';
  end if;

  select c.nombre into v_empleado_nombre
  from public.contactos c
  where c.id = v_empleado.contacto_id;
  if v_empleado_nombre is null then
    raise exception 'El empleado no tiene un contacto vinculado.' using errcode = '22023';
  end if;

  select * into v_config from public.nomina_config_empresa ce where ce.id = 1;
  if not found then
    raise exception 'Falta la configuración de la empresa para la nómina.' using errcode = '22023';
  end if;

  if v_config.cuenta_salarios_por_pagar_id is null then
    raise exception 'Configura la cuenta de salarios por pagar en la nómina.' using errcode = '22023';
  end if;
  perform public._nomina_validar_cuenta(
    v_config.cuenta_salarios_por_pagar_id, 'pasivo', 'SALARIO', v_empleado.segmento_contable
  );

  -- Líneas del asiento: gastos, cargas, provisiones, retenciones y neto.
  for v_linea in
    select
      l.clase as linea_clase,
      l.monto,
      c.codigo,
      c.nombre as concepto_nombre,
      c.orden,
      m.id as mapeo_id,
      m.cuenta_gasto_id,
      m.cuenta_pasivo_id
    from public.nomina_recibo_lineas l
    join public.nomina_conceptos c on c.id = l.concepto_id
    left join public.nomina_mapeo_contable m
      on m.concepto_id = l.concepto_id
      and m.segmento = v_empleado.segmento_contable
    where l.recibo_id = p_recibo_id
      and l.monto > 0
    order by c.orden, l.id
  loop
    if v_linea.mapeo_id is null then
      raise exception 'Falta el mapeo contable del concepto % para el segmento %.',
        v_linea.codigo, v_empleado.segmento_contable using errcode = '22023';
    end if;

    if v_linea.linea_clase = 'ingreso' then
      if v_linea.cuenta_gasto_id is null then
        raise exception 'El mapeo del concepto % del segmento % requiere cuenta de gasto.',
          v_linea.codigo, v_empleado.segmento_contable using errcode = '22023';
      end if;
      perform public._nomina_validar_cuenta(
        v_linea.cuenta_gasto_id, 'gasto', v_linea.codigo, v_empleado.segmento_contable
      );

      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_linea.cuenta_gasto_id,
        'contacto_id', v_empleado.contacto_id,
        'centro_costo_id', v_empleado.centro_costo_id,
        'descripcion', v_linea.concepto_nombre,
        'debito', v_linea.monto,
        'credito', 0
      ));
    elsif v_linea.linea_clase = 'deduccion' then
      if v_linea.cuenta_pasivo_id is null then
        raise exception 'El mapeo del concepto % del segmento % requiere cuenta de pasivo.',
          v_linea.codigo, v_empleado.segmento_contable using errcode = '22023';
      end if;
      perform public._nomina_validar_cuenta(
        v_linea.cuenta_pasivo_id, 'pasivo', v_linea.codigo, v_empleado.segmento_contable
      );

      v_contacto_linea := case
        when v_linea.codigo in ('SFS', 'AFP') then v_config.contacto_tss_id
        when v_linea.codigo = 'ISR' then v_config.contacto_dgii_id
        else v_empleado.contacto_id
      end;

      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_linea.cuenta_pasivo_id,
        'contacto_id', v_contacto_linea,
        'centro_costo_id', v_empleado.centro_costo_id,
        'descripcion', v_linea.concepto_nombre,
        'debito', 0,
        'credito', v_linea.monto
      ));
    elsif v_linea.linea_clase in ('aporte_empleador', 'provision') then
      if v_linea.cuenta_gasto_id is null or v_linea.cuenta_pasivo_id is null then
        raise exception 'El mapeo del concepto % del segmento % requiere cuenta de gasto y de pasivo.',
          v_linea.codigo, v_empleado.segmento_contable using errcode = '22023';
      end if;
      perform public._nomina_validar_cuenta(
        v_linea.cuenta_gasto_id, 'gasto', v_linea.codigo, v_empleado.segmento_contable
      );
      perform public._nomina_validar_cuenta(
        v_linea.cuenta_pasivo_id, 'pasivo', v_linea.codigo, v_empleado.segmento_contable
      );

      v_contacto_linea := case
        when v_linea.linea_clase = 'provision' then v_empleado.contacto_id
        when v_linea.codigo = 'INFOTEP' then v_config.contacto_infotep_id
        else v_config.contacto_tss_id
      end;

      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_linea.cuenta_gasto_id,
        'contacto_id', v_contacto_linea,
        'centro_costo_id', v_empleado.centro_costo_id,
        'descripcion', v_linea.concepto_nombre,
        'debito', v_linea.monto,
        'credito', 0
      ));
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_linea.cuenta_pasivo_id,
        'contacto_id', v_contacto_linea,
        'centro_costo_id', v_empleado.centro_costo_id,
        'descripcion', v_linea.concepto_nombre,
        'debito', 0,
        'credito', v_linea.monto
      ));
    end if;
  end loop;

  if v_recibo.neto_pagar > 0 then
    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', v_config.cuenta_salarios_por_pagar_id,
      'contacto_id', v_empleado.contacto_id,
      'centro_costo_id', v_empleado.centro_costo_id,
      'descripcion', 'Salario por pagar',
      'debito', 0,
      'credito', v_recibo.neto_pagar
    ));
  end if;

  -- Consecutivo NO: se bloquea y sube en la misma transacción del asiento.
  select * into v_tipo
  from public.tipos_entrada_diario t
  where t.prefijo = 'NO' and t.activo
  for update;
  if not found then
    raise exception 'No hay un tipo de entrada de diario activo con prefijo NO.' using errcode = '22023';
  end if;

  v_codigo := v_tipo.prefijo || '-' || v_tipo.siguiente;
  if exists (select 1 from public.asientos a where a.codigo = v_codigo) then
    raise exception 'Ya existe un asiento con el código %; ajusta el consecutivo del tipo NO.', v_codigo
      using errcode = '23505';
  end if;

  update public.tipos_entrada_diario t
  set siguiente = t.siguiente + 1
  where t.id = v_tipo.id;

  v_asiento_id := public._nomina_crear_asiento(
    v_periodo.fecha_fin,
    'Nómina ' || v_periodo.codigo || ' - ' || v_empleado_nombre,
    'nomina',
    p_recibo_id,
    v_tipo.id,
    v_codigo,
    v_lineas
  );

  update public.nomina_recibos r
  set
    asiento_id = v_asiento_id,
    cuenta_salarios_por_pagar_id = v_config.cuenta_salarios_por_pagar_id,
    estado = 'contabilizado'
  where r.id = p_recibo_id;

  perform public._nomina_recalcular_periodo(v_periodo.id);

  return v_asiento_id;
end;
$$;

create or replace function public.nomina_contabilizar_periodo(p_periodo_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_periodo public.nomina_periodos%rowtype;
  v_recibo record;
  v_asiento_id uuid;
  v_total_asiento numeric(14,2);
  v_asientos int := 0;
  v_total numeric(14,2) := 0;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select * into v_periodo from public.nomina_periodos p where p.id = p_periodo_id;
  if not found then
    raise exception 'Periodo de nómina no encontrado.' using errcode = '22023';
  end if;
  if v_periodo.estado = 'anulado' then
    raise exception 'El periodo % está anulado.', v_periodo.codigo using errcode = '23514';
  end if;

  if exists (
    select 1 from public.nomina_recibos r
    where r.periodo_id = p_periodo_id and r.estado = 'borrador'
  ) then
    raise exception 'Calcula la nómina del periodo antes de contabilizar.' using errcode = '23514';
  end if;

  for v_recibo in
    select r.id
    from public.nomina_recibos r
    join public.empleados e on e.id = r.empleado_id
    join public.contactos c on c.id = e.contacto_id
    where r.periodo_id = p_periodo_id
      and r.estado = 'calculado'
    order by c.nombre
  loop
    v_asiento_id := public.nomina_contabilizar_recibo(v_recibo.id);
    if v_asiento_id is not null then
      v_asientos := v_asientos + 1;
      select a.total into v_total_asiento from public.asientos a where a.id = v_asiento_id;
      v_total := v_total + coalesce(v_total_asiento, 0);
    end if;
  end loop;

  return jsonb_build_object('asientos', v_asientos, 'total', v_total);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: pago de nómina (candado: solo si está contabilizado)
-- ---------------------------------------------------------------------------

create or replace function public.nomina_pagar_recibo(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_recibo public.nomina_recibos%rowtype;
  v_periodo public.nomina_periodos%rowtype;
  v_empleado public.empleados%rowtype;
  v_config public.nomina_config_empresa%rowtype;
  v_empleado_nombre text;
  v_cuenta public.cuentas%rowtype;
  v_cuenta_pago_id uuid;
  v_fecha date;
  v_descripcion text;
  v_asiento_id uuid;
  v_lineas jsonb;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Datos del pago de nómina requeridos.' using errcode = '22023';
  end if;

  if nullif(trim(p->>'recibo_id'), '') is null then
    raise exception 'El recibo es obligatorio.' using errcode = '22023';
  end if;

  select * into v_recibo
  from public.nomina_recibos r
  where r.id = (p->>'recibo_id')::uuid
  for update;
  if not found then
    raise exception 'Recibo de nómina no encontrado.' using errcode = '22023';
  end if;
  if v_recibo.estado <> 'contabilizado' then
    raise exception 'El recibo no está contabilizado; no se puede pagar.' using errcode = '23514';
  end if;

  select * into v_periodo from public.nomina_periodos np where np.id = v_recibo.periodo_id;
  if not found then
    raise exception 'Periodo de nómina no encontrado.' using errcode = '22023';
  end if;

  select * into v_empleado from public.empleados e where e.id = v_recibo.empleado_id;
  if not found then
    raise exception 'Empleado no encontrado.' using errcode = '22023';
  end if;

  select c.nombre into v_empleado_nombre
  from public.contactos c
  where c.id = v_empleado.contacto_id;
  if v_empleado_nombre is null then
    raise exception 'El empleado no tiene un contacto vinculado.' using errcode = '22023';
  end if;

  select * into v_config from public.nomina_config_empresa ce where ce.id = 1;
  if not found then
    raise exception 'Falta la configuración de la empresa para la nómina.' using errcode = '22023';
  end if;

  v_cuenta_pago_id := nullif(trim(p->>'cuenta_pago_id'), '')::uuid;
  if v_cuenta_pago_id is null then
    v_cuenta_pago_id := v_config.cuenta_pago_defecto_id;
  end if;
  if v_cuenta_pago_id is null then
    raise exception 'Configura la cuenta de pago de la nómina.' using errcode = '22023';
  end if;

  select * into v_cuenta from public.cuentas c where c.id = v_cuenta_pago_id;
  if not found then
    raise exception 'Cuenta de pago no encontrada.' using errcode = '22023';
  end if;
  if not v_cuenta.activa or not v_cuenta.es_caja_banco then
    raise exception 'La cuenta % no es una cuenta de caja o banco activa.', v_cuenta.codigo
      using errcode = '23514';
  end if;

  v_fecha := coalesce(nullif(trim(p->>'fecha'), '')::date, current_date);
  v_descripcion := 'Pago de nómina ' || v_periodo.codigo || ' - ' || v_empleado_nombre;
  v_asiento_id := null;

  if v_recibo.neto_pagar > 0 then
    if v_recibo.cuenta_salarios_por_pagar_id is null then
      raise exception 'El recibo no tiene cuenta de salarios por pagar.' using errcode = '23514';
    end if;

    v_lineas := jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', v_recibo.cuenta_salarios_por_pagar_id,
        'contacto_id', v_empleado.contacto_id,
        'centro_costo_id', v_empleado.centro_costo_id,
        'descripcion', v_descripcion,
        'debito', v_recibo.neto_pagar,
        'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', v_cuenta_pago_id,
        'contacto_id', null,
        'centro_costo_id', null,
        'descripcion', v_descripcion,
        'debito', 0,
        'credito', v_recibo.neto_pagar
      )
    );

    v_asiento_id := public._nomina_crear_asiento(
      v_fecha, v_descripcion, 'pago_nomina', v_recibo.id, null, null, v_lineas
    );
  end if;

  update public.nomina_recibos r
  set
    estado = 'pagado',
    pago_asiento_id = v_asiento_id,
    cuenta_pago_id = v_cuenta_pago_id,
    fecha_pagado = v_fecha
  where r.id = v_recibo.id;

  perform public._nomina_recalcular_periodo(v_periodo.id);

  return v_asiento_id;
end;
$$;

create or replace function public.nomina_pagar_periodo(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_periodo public.nomina_periodos%rowtype;
  v_recibo record;
  v_asiento_id uuid;
  v_fecha date;
  v_cuenta_pago_id uuid;
  v_recibos int := 0;
  v_asientos int := 0;
  v_total numeric(14,2) := 0;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Datos del pago de nómina requeridos.' using errcode = '22023';
  end if;

  if nullif(trim(p->>'periodo_id'), '') is null then
    raise exception 'El periodo es obligatorio.' using errcode = '22023';
  end if;

  select * into v_periodo
  from public.nomina_periodos np
  where np.id = (p->>'periodo_id')::uuid;
  if not found then
    raise exception 'Periodo de nómina no encontrado.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.nomina_recibos r
    where r.periodo_id = v_periodo.id
      and r.estado in ('borrador', 'calculado')
  ) then
    raise exception 'Contabiliza la nómina del periodo antes de pagar.' using errcode = '23514';
  end if;

  v_fecha := coalesce(nullif(trim(p->>'fecha'), '')::date, current_date);
  v_cuenta_pago_id := nullif(trim(p->>'cuenta_pago_id'), '')::uuid;

  for v_recibo in
    select r.id, r.neto_pagar
    from public.nomina_recibos r
    join public.empleados e on e.id = r.empleado_id
    join public.contactos c on c.id = e.contacto_id
    where r.periodo_id = v_periodo.id
      and r.estado = 'contabilizado'
    order by c.nombre
  loop
    v_asiento_id := public.nomina_pagar_recibo(jsonb_build_object(
      'recibo_id', v_recibo.id,
      'fecha', v_fecha,
      'cuenta_pago_id', v_cuenta_pago_id
    ));
    v_recibos := v_recibos + 1;
    if v_asiento_id is not null then
      v_asientos := v_asientos + 1;
    end if;
    v_total := v_total + v_recibo.neto_pagar;
  end loop;

  return jsonb_build_object(
    'recibos', v_recibos,
    'asientos', v_asientos,
    'total_pagado', v_total
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: constancia de envío de colillas (no envía correo)
-- ---------------------------------------------------------------------------

create or replace function public.nomina_registrar_envio_colillas(p jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_periodo public.nomina_periodos%rowtype;
  v_ids jsonb;
  v_recibo record;
  v_encontrados int := 0;
  v_sellados int := 0;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Datos del envío de colillas requeridos.' using errcode = '22023';
  end if;

  if nullif(trim(p->>'periodo_id'), '') is null then
    raise exception 'El periodo es obligatorio.' using errcode = '22023';
  end if;

  select * into v_periodo
  from public.nomina_periodos np
  where np.id = (p->>'periodo_id')::uuid;
  if not found then
    raise exception 'Periodo de nómina no encontrado.' using errcode = '22023';
  end if;

  v_ids := p->'recibo_ids';
  if v_ids is null or jsonb_typeof(v_ids) <> 'array' or jsonb_array_length(v_ids) = 0 then
    raise exception 'Indica al menos un recibo para registrar el envío.' using errcode = '22023';
  end if;

  for v_recibo in
    select
      r.id,
      r.estado,
      coalesce(nullif(trim(p->>'enviado_a'), ''), e.correo) as destino
    from public.nomina_recibos r
    join public.empleados e on e.id = r.empleado_id
    where r.periodo_id = v_periodo.id
      and r.id in (
        select elem::uuid from jsonb_array_elements_text(v_ids) as t(elem)
      )
    for update of r
  loop
    v_encontrados := v_encontrados + 1;

    if v_recibo.estado = 'anulado' then
      raise exception 'El recibo está anulado; no se puede enviar su colilla.' using errcode = '23514';
    end if;
    if v_recibo.estado = 'borrador' then
      raise exception 'Calcula el recibo antes de enviar su colilla.' using errcode = '23514';
    end if;

    update public.nomina_recibos r
    set colilla_enviada_en = now(), colilla_enviada_a = v_recibo.destino
    where r.id = v_recibo.id;

    v_sellados := v_sellados + 1;
  end loop;

  if v_encontrados <> jsonb_array_length(v_ids) then
    raise exception 'Uno de los recibos no pertenece al periodo indicado.' using errcode = '22023';
  end if;

  return v_sellados;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: anulaciones (primero el pago, después el recibo)
-- ---------------------------------------------------------------------------

create or replace function public.nomina_anular_pago_recibo(p_recibo_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_recibo public.nomina_recibos%rowtype;
  v_reversion uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select * into v_recibo
  from public.nomina_recibos r
  where r.id = p_recibo_id
  for update;
  if not found then
    raise exception 'Recibo de nómina no encontrado.' using errcode = '22023';
  end if;
  if v_recibo.estado <> 'pagado' then
    raise exception 'El recibo no está pagado; no hay pago que anular.' using errcode = '23514';
  end if;

  v_reversion := null;
  if v_recibo.pago_asiento_id is not null then
    v_reversion := public._nomina_revertir_asiento(v_recibo.pago_asiento_id, v_recibo.id);
  end if;

  update public.nomina_recibos r
  set
    estado = 'contabilizado',
    pago_asiento_id = null,
    cuenta_pago_id = null,
    fecha_pagado = null
  where r.id = v_recibo.id;

  perform public._nomina_recalcular_periodo(v_recibo.periodo_id);

  return v_reversion;
end;
$$;

create or replace function public.nomina_anular_recibo(p_recibo_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_recibo public.nomina_recibos%rowtype;
  v_reversion uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select * into v_recibo
  from public.nomina_recibos r
  where r.id = p_recibo_id
  for update;
  if not found then
    raise exception 'Recibo de nómina no encontrado.' using errcode = '22023';
  end if;

  if v_recibo.estado = 'pagado' then
    raise exception 'El recibo está pagado; anula el pago antes de anular el recibo.' using errcode = '23514';
  end if;
  if v_recibo.estado = 'anulado' then
    raise exception 'El recibo ya está anulado.' using errcode = '23514';
  end if;

  v_reversion := null;
  if v_recibo.estado = 'contabilizado' and v_recibo.asiento_id is not null then
    v_reversion := public._nomina_revertir_asiento(v_recibo.asiento_id, v_recibo.id);
  end if;

  update public.nomina_recibos r set estado = 'anulado' where r.id = v_recibo.id;

  perform public._nomina_recalcular_periodo(v_recibo.periodo_id);

  return v_reversion;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lecturas (security invoker: respetan RLS)
-- ---------------------------------------------------------------------------

create or replace function public.nomina_resumen_periodo(p_periodo_id uuid)
returns table (
  recibo_id uuid,
  empleado_id uuid,
  empleado_nombre text,
  identificacion text,
  cargo text,
  segmento_contable text,
  dias_trabajados numeric,
  salario_base numeric,
  total_ingresos numeric,
  total_deducciones numeric,
  total_aportes_empleador numeric,
  total_provisiones numeric,
  neto_pagar numeric,
  costo_total_empresa numeric,
  estado text,
  asiento_codigo text,
  fecha_pagado date,
  colilla_enviada_en timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    r.id,
    e.id,
    c.nombre,
    e.identificacion,
    e.cargo,
    e.segmento_contable,
    r.dias_trabajados,
    r.salario_base,
    r.total_ingresos,
    r.total_deducciones,
    r.total_aportes_empleador,
    r.total_provisiones,
    r.neto_pagar,
    r.costo_total_empresa,
    r.estado,
    a.codigo,
    r.fecha_pagado,
    r.colilla_enviada_en
  from public.nomina_recibos r
  join public.empleados e on e.id = r.empleado_id
  join public.contactos c on c.id = e.contacto_id
  left join public.asientos a on a.id = r.asiento_id
  where r.periodo_id = p_periodo_id
  order by c.nombre;
$$;

create or replace function public.nomina_reporte_tss(p_anio int, p_mes int)
returns table (
  anio int,
  mes int,
  empleado_id uuid,
  empleado_nombre text,
  identificacion text,
  clave_tss text,
  periodos bigint,
  dias_trabajados numeric,
  salario_base numeric,
  base_sfs numeric,
  base_afp numeric,
  base_srl numeric,
  base_infotep numeric,
  base_isr numeric,
  sfs_empleado numeric,
  afp_empleado numeric,
  isr numeric,
  sfs_empleador numeric,
  afp_empleador numeric,
  srl numeric,
  infotep numeric,
  total_deducciones numeric,
  neto_pagar numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_anio is null or p_anio < 2000 or p_anio > 2100 then
    raise exception 'El año debe estar entre 2000 y 2100.' using errcode = '22023';
  end if;
  if p_mes is null or p_mes < 1 or p_mes > 12 then
    raise exception 'El mes debe estar entre 1 y 12.' using errcode = '22023';
  end if;

  return query
  with recibos as (
    select
      r.id,
      r.periodo_id,
      r.empleado_id,
      r.dias_trabajados,
      r.salario_base,
      r.base_sfs,
      r.base_afp,
      r.base_srl,
      r.base_infotep,
      r.base_isr,
      r.total_deducciones,
      r.neto_pagar
    from public.nomina_recibos r
    join public.nomina_periodos p on p.id = r.periodo_id
    where r.estado in ('contabilizado', 'pagado')
      and p.estado in ('contabilizado', 'pagado')
      and p.fecha_fin >= make_date(p_anio, p_mes, 1)
      and p.fecha_fin < (make_date(p_anio, p_mes, 1) + interval '1 month')
  ),
  lineas as (
    select
      r.id as recibo_id,
      coalesce(sum(l.monto) filter (where c.codigo = 'SFS'), 0) as sfs_empleado,
      coalesce(sum(l.monto) filter (where c.codigo = 'AFP'), 0) as afp_empleado,
      coalesce(sum(l.monto) filter (where c.codigo = 'ISR'), 0) as isr,
      coalesce(sum(l.monto) filter (where c.codigo = 'SFS_EMPLEADOR'), 0) as sfs_empleador,
      coalesce(sum(l.monto) filter (where c.codigo = 'AFP_EMPLEADOR'), 0) as afp_empleador,
      coalesce(sum(l.monto) filter (where c.codigo = 'SRL'), 0) as srl,
      coalesce(sum(l.monto) filter (where c.codigo = 'INFOTEP'), 0) as infotep
    from recibos r
    join public.nomina_recibo_lineas l on l.recibo_id = r.id
    join public.nomina_conceptos c on c.id = l.concepto_id
    group by r.id
  )
  select
    p_anio,
    p_mes,
    e.id,
    c.nombre,
    e.identificacion,
    e.clave_tss,
    count(distinct r.periodo_id),
    sum(r.dias_trabajados),
    sum(r.salario_base),
    sum(r.base_sfs),
    sum(r.base_afp),
    sum(r.base_srl),
    sum(r.base_infotep),
    sum(r.base_isr),
    sum(x.sfs_empleado),
    sum(x.afp_empleado),
    sum(x.isr),
    sum(x.sfs_empleador),
    sum(x.afp_empleador),
    sum(x.srl),
    sum(x.infotep),
    sum(r.total_deducciones),
    sum(r.neto_pagar)
  from recibos r
  join lineas x on x.recibo_id = r.id
  join public.empleados e on e.id = r.empleado_id
  join public.contactos c on c.id = e.contacto_id
  group by e.id, c.nombre, e.identificacion, e.clave_tss
  order by c.nombre;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de funciones
--
-- Escritura: solo authenticated; el rol se valida dentro de la función.
-- Lectura: authenticated (RLS filtra). Helpers: revocados de todos.
-- ---------------------------------------------------------------------------

revoke all on function public._nomina_concepto_id(text) from public, anon, authenticated;
revoke all on function public._nomina_validar_cuenta(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public._nomina_insertar_linea(uuid, uuid, text, numeric, numeric, numeric, text, int)
  from public, anon, authenticated;
revoke all on function public._nomina_crear_asiento(date, text, text, uuid, uuid, text, jsonb)
  from public, anon, authenticated;
revoke all on function public._nomina_revertir_asiento(uuid, uuid) from public, anon, authenticated;
revoke all on function public._nomina_recalcular_periodo(uuid) from public, anon, authenticated;

revoke all on function public.nomina_crear_periodo(jsonb) from public, anon, authenticated;
revoke all on function public.nomina_guardar_novedad_recibo(jsonb) from public, anon, authenticated;
revoke all on function public.nomina_eliminar_novedad_recibo(uuid) from public, anon, authenticated;
revoke all on function public.nomina_calcular_recibo(uuid) from public, anon, authenticated;
revoke all on function public.nomina_calcular_periodo(uuid) from public, anon, authenticated;
revoke all on function public.nomina_contabilizar_recibo(uuid) from public, anon, authenticated;
revoke all on function public.nomina_contabilizar_periodo(uuid) from public, anon, authenticated;
revoke all on function public.nomina_pagar_recibo(jsonb) from public, anon, authenticated;
revoke all on function public.nomina_pagar_periodo(jsonb) from public, anon, authenticated;
revoke all on function public.nomina_registrar_envio_colillas(jsonb) from public, anon, authenticated;
revoke all on function public.nomina_anular_pago_recibo(uuid) from public, anon, authenticated;
revoke all on function public.nomina_anular_recibo(uuid) from public, anon, authenticated;
revoke all on function public.nomina_resumen_periodo(uuid) from public, anon, authenticated;
revoke all on function public.nomina_reporte_tss(int, int) from public, anon, authenticated;

grant execute on function public.nomina_crear_periodo(jsonb) to authenticated;
grant execute on function public.nomina_guardar_novedad_recibo(jsonb) to authenticated;
grant execute on function public.nomina_eliminar_novedad_recibo(uuid) to authenticated;
grant execute on function public.nomina_calcular_recibo(uuid) to authenticated;
grant execute on function public.nomina_calcular_periodo(uuid) to authenticated;
grant execute on function public.nomina_contabilizar_recibo(uuid) to authenticated;
grant execute on function public.nomina_contabilizar_periodo(uuid) to authenticated;
grant execute on function public.nomina_pagar_recibo(jsonb) to authenticated;
grant execute on function public.nomina_pagar_periodo(jsonb) to authenticated;
grant execute on function public.nomina_registrar_envio_colillas(jsonb) to authenticated;
grant execute on function public.nomina_anular_pago_recibo(uuid) to authenticated;
grant execute on function public.nomina_anular_recibo(uuid) to authenticated;
grant execute on function public.nomina_resumen_periodo(uuid) to authenticated;
grant execute on function public.nomina_reporte_tss(int, int) to authenticated;

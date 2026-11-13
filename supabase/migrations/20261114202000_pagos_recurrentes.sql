-- ---------------------------------------------------------------------------
-- Pagos recurrentes (plantillas de gastos fijos)
--
-- Migración aditiva y reintentable: no borra ni cambia datos existentes.
-- - Tabla pagos_recurrentes con RLS de lectura.
-- - gastos_menores.pago_recurrente_id y gastos_menores.periodo.
-- - RPC crear_pago_recurrente y actualizar_pago_recurrente (admin/contador).
-- - RPC generar_pago_recurrente: crea el gasto menor del periodo con NCF B13.
--   Es idempotente por (pago_recurrente_id, periodo): si el periodo ya se
--   generó, devuelve el gasto existente sin duplicar asiento ni gasto.
--   Genera solo el último periodo vencido; no rellena periodos atrasados.
-- ---------------------------------------------------------------------------

create table if not exists public.pagos_recurrentes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  contacto_id uuid references public.contactos (id),
  cuenta_gasto_id uuid not null references public.cuentas (id),
  cuenta_pago_id uuid not null references public.cuentas (id),
  subtotal numeric(14,2) not null check (subtotal > 0),
  itbis_tasa numeric(5,2) not null default 0 check (itbis_tasa between 0 and 100),
  frecuencia_meses int not null check (frecuencia_meses >= 1),
  fecha_inicio date not null default current_date,
  vigencia_hasta date,
  notas text,
  activo boolean not null default true,
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  constraint pagos_recurrentes_vigencia check (
    vigencia_hasta is null or vigencia_hasta >= fecha_inicio
  )
);

alter table public.gastos_menores add column if not exists pago_recurrente_id uuid references public.pagos_recurrentes (id);
alter table public.gastos_menores add column if not exists periodo date;

create unique index if not exists gastos_menores_pago_recurrente_periodo_idx
  on public.gastos_menores (pago_recurrente_id, periodo)
  where pago_recurrente_id is not null;

create index if not exists pagos_recurrentes_contacto_id_idx on public.pagos_recurrentes (contacto_id);
create index if not exists pagos_recurrentes_cuenta_gasto_id_idx on public.pagos_recurrentes (cuenta_gasto_id);
create index if not exists pagos_recurrentes_cuenta_pago_id_idx on public.pagos_recurrentes (cuenta_pago_id);

-- ---------------------------------------------------------------------------
-- Validación compartida para crear y actualizar plantillas
-- ---------------------------------------------------------------------------

create or replace function public._validar_pago_recurrente(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text;
  v_contacto_id uuid;
  v_cuenta_gasto uuid;
  v_cuenta_pago uuid;
  v_cuenta public.cuentas%rowtype;
  v_subtotal numeric(14,2);
  v_itbis_tasa numeric(5,2);
  v_frecuencia int;
  v_fecha_inicio date;
  v_vigencia date;
begin
  v_nombre := nullif(trim(p->>'nombre'), '');
  if v_nombre is null then
    raise exception 'el nombre de la plantilla es obligatorio' using errcode = '22023';
  end if;

  v_contacto_id := nullif(p->>'contacto_id', '')::uuid;
  if v_contacto_id is not null and not exists (select 1 from public.contactos c where c.id = v_contacto_id) then
    raise exception 'contacto no encontrado' using errcode = '22023';
  end if;

  v_cuenta_gasto := nullif(p->>'cuenta_gasto_id', '')::uuid;
  if v_cuenta_gasto is null then
    raise exception 'la cuenta de gasto es obligatoria' using errcode = '22023';
  end if;
  select * into v_cuenta from public.cuentas c where c.id = v_cuenta_gasto and c.activa;
  if not found then
    raise exception 'cuenta de gasto no encontrada' using errcode = '22023';
  end if;
  if not v_cuenta.acepta_movimientos or v_cuenta.tipo not in ('gasto', 'costo') then
    raise exception 'elige una cuenta de detalle, no una cuenta padre' using errcode = '22023';
  end if;

  v_cuenta_pago := nullif(p->>'cuenta_pago_id', '')::uuid;
  if v_cuenta_pago is null then
    raise exception 'la cuenta de pago es obligatoria' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.cuentas c
    where c.id = v_cuenta_pago and c.activa and c.es_caja_banco
  ) then
    raise exception 'la cuenta de pago debe ser de caja o banco' using errcode = '22023';
  end if;

  v_subtotal := round(coalesce((p->>'subtotal')::numeric, 0), 2);
  if v_subtotal <= 0 then
    raise exception 'el monto del pago debe ser mayor a cero' using errcode = '22023';
  end if;

  v_itbis_tasa := round(coalesce((p->>'itbis_tasa')::numeric, 0), 2);
  if v_itbis_tasa < 0 or v_itbis_tasa > 100 then
    raise exception 'la tasa de ITBIS es inválida' using errcode = '22023';
  end if;

  v_frecuencia := coalesce((p->>'frecuencia_meses')::int, 0);
  if v_frecuencia < 1 then
    raise exception 'la frecuencia en meses debe ser mayor a cero' using errcode = '22023';
  end if;

  v_fecha_inicio := coalesce((p->>'fecha_inicio')::date, current_date);
  v_vigencia := nullif(p->>'vigencia_hasta', '')::date;
  if v_vigencia is not null and v_vigencia < v_fecha_inicio then
    raise exception 'la vigencia no puede terminar antes de la fecha de inicio' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'nombre', v_nombre,
    'contacto_id', v_contacto_id,
    'cuenta_gasto_id', v_cuenta_gasto,
    'cuenta_pago_id', v_cuenta_pago,
    'subtotal', v_subtotal,
    'itbis_tasa', v_itbis_tasa,
    'frecuencia_meses', v_frecuencia,
    'fecha_inicio', v_fecha_inicio,
    'vigencia_hasta', v_vigencia,
    'notas', nullif(trim(p->>'notas'), ''),
    'activo', coalesce(nullif(p->>'activo', '')::boolean, true)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: crear y actualizar plantillas
-- ---------------------------------------------------------------------------

create or replace function public.crear_pago_recurrente(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_datos jsonb;
  v_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del pago recurrente requeridos' using errcode = '22023';
  end if;

  v_datos := public._validar_pago_recurrente(p);

  insert into public.pagos_recurrentes (
    nombre, contacto_id, cuenta_gasto_id, cuenta_pago_id, subtotal, itbis_tasa,
    frecuencia_meses, fecha_inicio, vigencia_hasta, notas, activo, creado_por
  )
  values (
    v_datos->>'nombre',
    nullif(v_datos->>'contacto_id', '')::uuid,
    (v_datos->>'cuenta_gasto_id')::uuid,
    (v_datos->>'cuenta_pago_id')::uuid,
    (v_datos->>'subtotal')::numeric,
    (v_datos->>'itbis_tasa')::numeric,
    (v_datos->>'frecuencia_meses')::int,
    (v_datos->>'fecha_inicio')::date,
    nullif(v_datos->>'vigencia_hasta', '')::date,
    v_datos->>'notas',
    (v_datos->>'activo')::boolean,
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.actualizar_pago_recurrente(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_datos jsonb;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_id is null or p is null then
    raise exception 'datos del pago recurrente requeridos' using errcode = '22023';
  end if;

  if not exists (select 1 from public.pagos_recurrentes pr where pr.id = p_id) then
    raise exception 'pago recurrente no encontrado' using errcode = '22023';
  end if;

  v_datos := public._validar_pago_recurrente(p);

  update public.pagos_recurrentes
  set nombre = v_datos->>'nombre',
      contacto_id = nullif(v_datos->>'contacto_id', '')::uuid,
      cuenta_gasto_id = (v_datos->>'cuenta_gasto_id')::uuid,
      cuenta_pago_id = (v_datos->>'cuenta_pago_id')::uuid,
      subtotal = (v_datos->>'subtotal')::numeric,
      itbis_tasa = (v_datos->>'itbis_tasa')::numeric,
      frecuencia_meses = (v_datos->>'frecuencia_meses')::int,
      fecha_inicio = (v_datos->>'fecha_inicio')::date,
      vigencia_hasta = nullif(v_datos->>'vigencia_hasta', '')::date,
      notas = v_datos->>'notas',
      activo = (v_datos->>'activo')::boolean
  where id = p_id;

  return p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: generar el pago del periodo (idempotente)
-- ---------------------------------------------------------------------------

create or replace function public.generar_pago_recurrente(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_plan public.pagos_recurrentes%rowtype;
  v_periodo date;
  v_gasto_id uuid;
  v_periodos int;
  v_descripcion text;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_id is null then
    raise exception 'el pago recurrente es obligatorio' using errcode = '22023';
  end if;

  select * into v_plan
  from public.pagos_recurrentes pr
  where pr.id = p_id
  for update;

  if not found then
    raise exception 'pago recurrente no encontrado' using errcode = '22023';
  end if;
  if not v_plan.activo then
    raise exception 'el pago recurrente está inactivo' using errcode = '22023';
  end if;

  v_periodos := 0;
  while (
    (v_plan.fecha_inicio + make_interval(months => (v_periodos + 1) * v_plan.frecuencia_meses))::date
    <= current_date
  ) loop
    v_periodos := v_periodos + 1;
  end loop;

  v_periodo := (v_plan.fecha_inicio + make_interval(months => v_periodos * v_plan.frecuencia_meses))::date;

  if v_periodo > current_date then
    return null;
  end if;
  if v_plan.vigencia_hasta is not null and v_periodo > v_plan.vigencia_hasta then
    return null;
  end if;

  select gm.id into v_gasto_id
  from public.gastos_menores gm
  where gm.pago_recurrente_id = p_id and gm.periodo = v_periodo;

  if found then
    return v_gasto_id;
  end if;

  v_descripcion := 'Pago recurrente: ' || v_plan.nombre || ' (' || to_char(v_periodo, 'MM/YYYY') || ')';

  v_gasto_id := public.crear_gasto_menor(jsonb_build_object(
    'fecha', v_periodo,
    'descripcion', v_descripcion,
    'subtotal', v_plan.subtotal,
    'itbis_tasa', v_plan.itbis_tasa,
    'cuenta_gasto_id', v_plan.cuenta_gasto_id,
    'cuenta_pago_id', v_plan.cuenta_pago_id,
    'contacto_id', v_plan.contacto_id
  ));

  update public.gastos_menores
  set pago_recurrente_id = p_id,
      periodo = v_periodo
  where id = v_gasto_id;

  return v_gasto_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS y permisos
-- ---------------------------------------------------------------------------

alter table public.pagos_recurrentes enable row level security;
revoke all on public.pagos_recurrentes from anon;
revoke all on public.pagos_recurrentes from authenticated;
grant select on public.pagos_recurrentes to authenticated;
drop policy if exists pagos_recurrentes_lectura on public.pagos_recurrentes;
create policy pagos_recurrentes_lectura on public.pagos_recurrentes
  for select to authenticated
  using ((select public.rol_actual()) is not null);

revoke all on function public._validar_pago_recurrente(jsonb) from public, anon, authenticated;
revoke all on function public.crear_pago_recurrente(jsonb) from public, anon, authenticated;
grant execute on function public.crear_pago_recurrente(jsonb) to authenticated;
revoke all on function public.actualizar_pago_recurrente(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.actualizar_pago_recurrente(uuid, jsonb) to authenticated;
revoke all on function public.generar_pago_recurrente(uuid) from public, anon, authenticated;
grant execute on function public.generar_pago_recurrente(uuid) to authenticated;

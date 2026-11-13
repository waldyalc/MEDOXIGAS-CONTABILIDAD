-- ---------------------------------------------------------------------------
-- Control de periodos contables y cierre de resultados (aditivo)
--
-- · periodos_contables: un registro por mes. estado 'cerrado' bloquea la
--   creación o anulación de asientos con fecha en ese mes mediante el trigger
--   asientos_periodo_abierto sobre public.asientos.
-- · cerrar_periodo / reabrir_periodo: marcan o liberan un mes.
-- · cierres_resultados: guarda el asiento de cierre por año; su clave primaria
--   (anio) es lo que hace idempotente el cierre.
-- · cerrar_resultados_anio: crea un asiento al 31/12 que lleva a cero todas las
--   cuentas de ingreso, costo y gasto del año contra 3202 Utilidad del
--   ejercicio. Si el año ya se cerró, devuelve el mismo asiento.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.periodos_contables (
  periodo date primary key,
  estado text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
  cerrado_en timestamptz,
  cerrado_por uuid,
  actualizado_en timestamptz not null default now(),
  constraint periodos_contables_primer_dia check (periodo = date_trunc('month', periodo)::date)
);

create index periodos_contables_estado_idx on public.periodos_contables (estado);

create table public.cierres_resultados (
  anio int primary key check (anio between 2000 and 2100),
  asiento_id uuid not null references public.asientos (id),
  total numeric(14,2) not null default 0,
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now()
);

create index cierres_resultados_asiento_id_idx on public.cierres_resultados (asiento_id);

-- ---------------------------------------------------------------------------
-- Trigger: un mes cerrado no admite asientos nuevos ni anulaciones
-- (la anulación y la depreciación también insertan en public.asientos).
-- ---------------------------------------------------------------------------

create or replace function public._validar_periodo_abierto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mes date;
begin
  if new.fecha is null then
    return new;
  end if;

  v_mes := date_trunc('month', new.fecha)::date;

  if exists (
    select 1
    from public.periodos_contables p
    where p.periodo = v_mes
      and p.estado = 'cerrado'
  ) then
    raise exception 'el periodo % está cerrado; no se pueden crear ni anular asientos con esa fecha',
      to_char(v_mes, 'YYYY-MM')
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger asientos_periodo_abierto
before insert or update of fecha on public.asientos
for each row
execute function public._validar_periodo_abierto();

-- ---------------------------------------------------------------------------
-- RPC: cerrar y reabrir un mes
-- ---------------------------------------------------------------------------

create or replace function public.cerrar_periodo(p_periodo date)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_mes date;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_periodo is null then
    raise exception 'el periodo es obligatorio' using errcode = '22023';
  end if;

  v_mes := date_trunc('month', p_periodo)::date;

  if v_mes > date_trunc('month', current_date)::date then
    raise exception 'no se puede cerrar un periodo futuro' using errcode = '22023';
  end if;

  insert into public.periodos_contables as p (periodo, estado, cerrado_en, cerrado_por, actualizado_en)
  values (v_mes, 'cerrado', now(), auth.uid(), now())
  on conflict (periodo) do update
  set
    estado = 'cerrado',
    cerrado_en = case when p.estado = 'cerrado' then p.cerrado_en else now() end,
    cerrado_por = case when p.estado = 'cerrado' then p.cerrado_por else auth.uid() end,
    actualizado_en = now();

  return v_mes;
end;
$$;

create or replace function public.reabrir_periodo(p_periodo date)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_mes date;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_periodo is null then
    raise exception 'el periodo es obligatorio' using errcode = '22023';
  end if;

  v_mes := date_trunc('month', p_periodo)::date;

  insert into public.periodos_contables as p (periodo, estado, cerrado_en, cerrado_por, actualizado_en)
  values (v_mes, 'abierto', null, null, now())
  on conflict (periodo) do update
  set estado = 'abierto', cerrado_en = null, cerrado_por = null, actualizado_en = now();

  return v_mes;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: cierre de resultados del año contra 3202 Utilidad del ejercicio
-- ---------------------------------------------------------------------------

create or replace function public.cerrar_resultados_anio(p_anio int)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_anio int;
  v_fecha date;
  v_existente uuid;
  v_linea record;
  v_lineas jsonb := '[]'::jsonb;
  v_debitos numeric(14,2) := 0;
  v_creditos numeric(14,2) := 0;
  v_diferencia numeric(14,2);
  v_utilidad_id uuid;
  v_asiento_id uuid;
  v_total numeric(14,2);
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  v_anio := coalesce(p_anio, extract(year from current_date)::int);
  if v_anio < 2000 or v_anio > extract(year from current_date)::int then
    raise exception 'año inválido para cerrar resultados' using errcode = '22023';
  end if;

  -- Serializa dos cierres simultáneos del mismo año.
  perform pg_advisory_xact_lock(hashtext('cierre_resultados_' || v_anio::text));

  select c.asiento_id into v_existente
  from public.cierres_resultados c
  where c.anio = v_anio;

  if v_existente is not null then
    return v_existente;
  end if;

  v_fecha := make_date(v_anio, 12, 31);

  for v_linea in
    select
      c.id,
      c.codigo,
      c.nombre,
      round(sum(l.debito - l.credito), 2) as neto
    from public.asientos a
    join public.asiento_lineas l on l.asiento_id = a.id
    join public.cuentas c on c.id = l.cuenta_id
    where a.fecha between make_date(v_anio, 1, 1) and v_fecha
      and c.tipo in ('ingreso', 'costo', 'gasto')
      and c.acepta_movimientos
    group by c.id, c.codigo, c.nombre
    having round(sum(l.debito - l.credito), 2) <> 0
    order by c.codigo
  loop
    if v_linea.neto > 0 then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_linea.id,
        'descripcion', 'Cierre de ' || v_linea.codigo || ' ' || v_linea.nombre,
        'debito', 0,
        'credito', v_linea.neto
      ));
      v_creditos := v_creditos + v_linea.neto;
    else
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_linea.id,
        'descripcion', 'Cierre de ' || v_linea.codigo || ' ' || v_linea.nombre,
        'debito', -v_linea.neto,
        'credito', 0
      ));
      v_debitos := v_debitos + (-v_linea.neto);
    end if;
  end loop;

  if jsonb_array_length(v_lineas) = 0 then
    raise exception 'no hay saldos de ingresos, costos o gastos que cerrar en el año %', v_anio
      using errcode = '22023';
  end if;

  select c.id into v_utilidad_id
  from public.cuentas c
  where c.codigo = '3202';

  if v_utilidad_id is null then
    raise exception 'falta la cuenta 3202 Utilidad del ejercicio' using errcode = '22023';
  end if;

  v_diferencia := v_debitos - v_creditos;

  if v_diferencia > 0 then
    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', v_utilidad_id,
      'descripcion', 'Utilidad del ejercicio ' || v_anio,
      'debito', 0,
      'credito', v_diferencia
    ));
    v_creditos := v_creditos + v_diferencia;
  elsif v_diferencia < 0 then
    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', v_utilidad_id,
      'descripcion', 'Pérdida del ejercicio ' || v_anio,
      'debito', -v_diferencia,
      'credito', 0
    ));
    v_debitos := v_debitos + (-v_diferencia);
  end if;

  v_total := v_debitos;

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Cierre de resultados ' || v_anio,
    'manual',
    null,
    v_lineas
  );

  insert into public.cierres_resultados (anio, asiento_id, total, creado_por)
  values (v_anio, v_asiento_id, v_total, auth.uid());

  return v_asiento_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS y permisos
-- ---------------------------------------------------------------------------

alter table public.periodos_contables enable row level security;
alter table public.cierres_resultados enable row level security;

revoke all on public.periodos_contables from anon, authenticated;
revoke all on public.cierres_resultados from anon, authenticated;

grant select on public.periodos_contables to authenticated;
grant select on public.cierres_resultados to authenticated;

create policy periodos_contables_lectura on public.periodos_contables
  for select to authenticated
  using ((select public.rol_actual()) is not null);

create policy cierres_resultados_lectura on public.cierres_resultados
  for select to authenticated
  using ((select public.rol_actual()) is not null);

revoke all on function public._validar_periodo_abierto() from public, anon, authenticated;
revoke all on function public.cerrar_periodo(date) from public, anon, authenticated;
revoke all on function public.reabrir_periodo(date) from public, anon, authenticated;
revoke all on function public.cerrar_resultados_anio(int) from public, anon, authenticated;

grant execute on function public.cerrar_periodo(date) to authenticated;
grant execute on function public.reabrir_periodo(date) to authenticated;
grant execute on function public.cerrar_resultados_anio(int) to authenticated;

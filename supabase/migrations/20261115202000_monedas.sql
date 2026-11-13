-- ---------------------------------------------------------------------------
-- Monedas y tasas de cambio (solo configuración)
--
-- Migración aditiva y reintentable. Siembra DOP (base), USD y EUR y permite
-- registrar o corregir la tasa de una moneda por fecha. No cambia documentos
-- ni cálculos contables: los comprobantes siguen en DOP.
-- RLS: authenticated lee; las escrituras van solo por RPC (admin o contador).
-- ---------------------------------------------------------------------------

create table if not exists public.monedas (
  codigo text primary key check (codigo ~ '^[A-Z]{3}$'),
  nombre text not null,
  simbolo text not null,
  es_base boolean not null default false,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create unique index if not exists monedas_una_base on public.monedas (es_base) where es_base;

insert into public.monedas (codigo, nombre, simbolo, es_base, activo)
values
  ('DOP', 'Peso dominicano', 'RD$', true, true),
  ('USD', 'Dólar estadounidense', 'US$', false, true),
  ('EUR', 'Euro', '€', false, true)
on conflict (codigo) do nothing;

create table if not exists public.tasas_cambio (
  id uuid primary key default gen_random_uuid(),
  moneda_codigo text not null references public.monedas (codigo),
  fecha date not null default current_date,
  tasa numeric(18,6) not null check (tasa > 0),
  creado_en timestamptz not null default now(),
  unique (moneda_codigo, fecha)
);

create index if not exists tasas_cambio_fecha_idx on public.tasas_cambio (fecha);

-- ---------------------------------------------------------------------------
-- RPC: registrar o corregir la tasa de una moneda en una fecha
-- ---------------------------------------------------------------------------

create or replace function public.guardar_tasa_cambio(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_moneda public.monedas%rowtype;
  v_fecha date;
  v_tasa numeric(18,6);
  v_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la tasa requeridos' using errcode = '22023';
  end if;

  select * into v_moneda
  from public.monedas m
  where m.codigo = upper(trim(coalesce(p->>'moneda_codigo', '')));

  if not found then
    raise exception 'moneda no encontrada' using errcode = '22023';
  end if;
  if not v_moneda.activo then
    raise exception 'la moneda % está inactiva', v_moneda.codigo using errcode = '22023';
  end if;
  if v_moneda.es_base then
    raise exception 'la moneda base (%) no lleva tasa de cambio', v_moneda.codigo using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_tasa := round(coalesce((p->>'tasa')::numeric, 0), 6);
  if v_tasa <= 0 then
    raise exception 'la tasa de cambio debe ser mayor que cero' using errcode = '22023';
  end if;

  insert into public.tasas_cambio (moneda_codigo, fecha, tasa)
  values (v_moneda.codigo, v_fecha, v_tasa)
  on conflict (moneda_codigo, fecha) do update set tasa = excluded.tasa
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS y permisos
-- ---------------------------------------------------------------------------

alter table public.monedas enable row level security;
alter table public.tasas_cambio enable row level security;

revoke all on public.monedas from anon;
revoke all on public.monedas from authenticated;
grant select on public.monedas to authenticated;

revoke all on public.tasas_cambio from anon;
revoke all on public.tasas_cambio from authenticated;
grant select on public.tasas_cambio to authenticated;

drop policy if exists monedas_lectura on public.monedas;
create policy monedas_lectura on public.monedas
  for select to authenticated
  using ((select public.rol_actual()) is not null);

drop policy if exists tasas_cambio_lectura on public.tasas_cambio;
create policy tasas_cambio_lectura on public.tasas_cambio
  for select to authenticated
  using ((select public.rol_actual()) is not null);

revoke all on function public.guardar_tasa_cambio(jsonb) from public, anon, authenticated;
grant execute on function public.guardar_tasa_cambio(jsonb) to authenticated;

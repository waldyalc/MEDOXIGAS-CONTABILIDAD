-- ---------------------------------------------------------------------------
-- Configuración: empresa, términos de pago y usuarios
--
-- Migración aditiva y reintentable. No borra ni cambia datos existentes.
-- · empresa ya nació con rnc, direccion, telefono, correo y logo_url en el
--   motor contable; el add column if not exists solo cubre bases más viejas.
-- · terminos_pago se siembra con Contado, 8, 15, 30 y 60 días.
-- · actualizar_empresa exige rol admin; crear_termino_pago, admin o contador.
-- · listar_perfiles es de solo lectura y solo para admin (correo incluido).
-- RLS: authenticated lee; las escrituras van solo por RPC; anon no ve nada.
-- ---------------------------------------------------------------------------

alter table public.empresa
  add column if not exists rnc text,
  add column if not exists direccion text,
  add column if not exists telefono text,
  add column if not exists correo text,
  add column if not exists logo_url text;

-- ---------------------------------------------------------------------------
-- Términos de pago
-- ---------------------------------------------------------------------------

create table if not exists public.terminos_pago (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  dias int not null default 0 check (dias >= 0),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

insert into public.terminos_pago (nombre, dias, activo)
values
  ('Contado', 0, true),
  ('8 días', 8, true),
  ('15 días', 15, true),
  ('30 días', 30, true),
  ('60 días', 60, true)
on conflict (nombre) do nothing;

alter table public.terminos_pago enable row level security;

revoke all on public.terminos_pago from anon;
revoke all on public.terminos_pago from authenticated;
grant select on public.terminos_pago to authenticated;

drop policy if exists terminos_pago_lectura on public.terminos_pago;
create policy terminos_pago_lectura on public.terminos_pago
  for select to authenticated
  using ((select public.rol_actual()) is not null);

-- ---------------------------------------------------------------------------
-- RPC: actualizar los datos de la empresa (solo admin)
-- ---------------------------------------------------------------------------

create or replace function public.actualizar_empresa(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_nombre text;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol <> 'admin' then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la empresa requeridos' using errcode = '22023';
  end if;

  v_nombre := trim(coalesce(p->>'nombre', ''));
  if v_nombre = '' then
    raise exception 'el nombre de la empresa es obligatorio' using errcode = '22023';
  end if;

  update public.empresa
  set nombre = v_nombre,
      rnc = nullif(trim(coalesce(p->>'rnc', '')), ''),
      direccion = nullif(trim(coalesce(p->>'direccion', '')), ''),
      telefono = nullif(trim(coalesce(p->>'telefono', '')), ''),
      correo = nullif(trim(coalesce(p->>'correo', '')), ''),
      logo_url = nullif(trim(coalesce(p->>'logo_url', '')), '')
  where id = 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: crear un término de pago (admin o contador)
-- ---------------------------------------------------------------------------

create or replace function public.crear_termino_pago(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_nombre text;
  v_dias int;
  v_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del término de pago requeridos' using errcode = '22023';
  end if;

  v_nombre := trim(regexp_replace(coalesce(p->>'nombre', ''), '\s+', ' ', 'g'));
  if v_nombre = '' then
    raise exception 'el nombre del término de pago es obligatorio' using errcode = '22023';
  end if;

  v_dias := coalesce(nullif(p->>'dias', '')::int, 0);
  if v_dias < 0 then
    raise exception 'los días del término de pago no pueden ser negativos' using errcode = '22023';
  end if;

  begin
    insert into public.terminos_pago (nombre, dias)
    values (v_nombre, v_dias)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'el término de pago ya existe' using errcode = '23505';
  end;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Función de consulta de términos de pago (respetando RLS)
-- ---------------------------------------------------------------------------

create or replace function public.listar_terminos_pago()
returns table (id uuid, nombre text, dias int, activo boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.id, t.nombre, t.dias, t.activo
  from public.terminos_pago t
  order by t.dias, t.nombre;
$$;

-- ---------------------------------------------------------------------------
-- RPC: listar perfiles con correo (solo admin)
-- ---------------------------------------------------------------------------

create or replace function public.listar_perfiles()
returns table (user_id uuid, nombre text, correo text, rol text, creado_en timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rol text;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol <> 'admin' then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  return query
  select p.user_id, p.nombre, u.email::text, p.rol, p.creado_en
  from public.perfiles p
  left join auth.users u on u.id = p.user_id
  order by coalesce(p.nombre, u.email), p.user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de funciones
-- ---------------------------------------------------------------------------

revoke all on function public.actualizar_empresa(jsonb) from public, anon, authenticated;
grant execute on function public.actualizar_empresa(jsonb) to authenticated;

revoke all on function public.crear_termino_pago(jsonb) from public, anon, authenticated;
grant execute on function public.crear_termino_pago(jsonb) to authenticated;

revoke all on function public.listar_terminos_pago() from public, anon, authenticated;
grant execute on function public.listar_terminos_pago() to authenticated;

revoke all on function public.listar_perfiles() from public, anon, authenticated;
grant execute on function public.listar_perfiles() to authenticated;

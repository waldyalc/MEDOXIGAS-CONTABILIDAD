-- ---------------------------------------------------------------------------
-- Retenciones de ITBIS e ISR
--
-- Migración aditiva y reintentable. No borra ni reescribe datos existentes.
-- · Tabla retenciones: nombre, tipo (itbis/isr), porcentaje, cuenta cuando
--   retenemos (pasivo por pagar a la DGII) y cuenta cuando nos retienen
--   (activo/anticipo). Las cuentas nuevas se siembran con ON CONFLICT DO NOTHING.
-- · facturas.retenido y facturas_proveedor.retenido: el saldo pendiente pasa a
--   total - pagado - credito - retenido. Los pagos guardan su propio retenido.
-- · pago_recibido_retenciones y pago_proveedor_retenciones: detalle auditables.
-- · RPC listar_retenciones, crear_retencion y actualizar_retencion.
-- RLS: authenticated lee; las escrituras van solo por RPC; anon no ve nada.
--
-- VERIFICAR con DGII las tasas y las cuentas de las retenciones sembradas.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Cuentas contables de retención
-- ---------------------------------------------------------------------------

insert into public.cuentas (codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos, es_caja_banco)
select v.codigo, v.nombre, v.tipo, v.naturaleza, p.id, true, false
from (values
  ('1107', 'ITBIS retenido por clientes', 'activo', 'debito', '11'),
  ('1108', 'ISR retenido por clientes', 'activo', 'debito', '11'),
  ('2103', 'ITBIS retenido por pagar', 'pasivo', 'credito', '21'),
  ('2104', 'ISR retenido por pagar', 'pasivo', 'credito', '21')
) as v(codigo, nombre, tipo, naturaleza, padre_codigo)
join public.cuentas p on p.codigo = v.padre_codigo
on conflict (codigo) do nothing;

insert into public.config_contable (clave, cuenta_id)
select v.clave, c.id
from (values
  ('retencion_itbis_por_cobrar', '1107'),
  ('retencion_isr_por_cobrar', '1108'),
  ('retencion_itbis_por_pagar', '2103'),
  ('retencion_isr_por_pagar', '2104')
) as v(clave, codigo)
join public.cuentas c on c.codigo = v.codigo
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- Catálogo de retenciones
-- ---------------------------------------------------------------------------

create table if not exists public.retenciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  tipo text not null check (tipo in ('itbis', 'isr')),
  porcentaje numeric(5,2) not null check (porcentaje > 0 and porcentaje <= 100),
  cuenta_id uuid not null references public.cuentas (id),
  cuenta_anticipo_id uuid references public.cuentas (id),
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);

-- VERIFICAR con DGII: tasas y cuentas de las retenciones comunes en RD.
insert into public.retenciones (nombre, tipo, porcentaje, cuenta_id, cuenta_anticipo_id, activa)
select v.nombre, v.tipo, v.porcentaje, cp.id, ca.id, true
from (values
  ('ITBIS 30 %', 'itbis', 30, '2103', '1107'),
  ('ITBIS 100 %', 'itbis', 100, '2103', '1107'),
  ('ISR 10 % honorarios', 'isr', 10, '2104', '1108'),
  ('ISR 2 % servicios', 'isr', 2, '2104', '1108'),
  ('ISR 5 % alquileres', 'isr', 5, '2104', '1108')
) as v(nombre, tipo, porcentaje, codigo_pasivo, codigo_activo)
join public.cuentas cp on cp.codigo = v.codigo_pasivo
join public.cuentas ca on ca.codigo = v.codigo_activo
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------------------
-- Saldo con retenciones y detalle por pago
-- ---------------------------------------------------------------------------

alter table public.facturas add column if not exists retenido numeric(14,2) not null default 0;
alter table public.facturas_proveedor add column if not exists retenido numeric(14,2) not null default 0;
alter table public.pagos_recibidos add column if not exists retenido numeric(14,2) not null default 0;
alter table public.pagos_proveedor add column if not exists retenido numeric(14,2) not null default 0;

create table if not exists public.pago_recibido_retenciones (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid not null references public.pagos_recibidos (id) on delete cascade,
  retencion_id uuid not null references public.retenciones (id),
  base numeric(14,2) not null default 0 check (base >= 0),
  porcentaje numeric(5,2) not null default 0 check (porcentaje >= 0 and porcentaje <= 100),
  monto numeric(14,2) not null check (monto > 0),
  unique (pago_id, retencion_id)
);

create table if not exists public.pago_proveedor_retenciones (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid not null references public.pagos_proveedor (id) on delete cascade,
  retencion_id uuid not null references public.retenciones (id),
  base numeric(14,2) not null default 0 check (base >= 0),
  porcentaje numeric(5,2) not null default 0 check (porcentaje >= 0 and porcentaje <= 100),
  monto numeric(14,2) not null check (monto > 0),
  unique (pago_id, retencion_id)
);

create index if not exists pago_recibido_retenciones_pago_id_idx
  on public.pago_recibido_retenciones (pago_id);
create index if not exists pago_recibido_retenciones_retencion_id_idx
  on public.pago_recibido_retenciones (retencion_id);
create index if not exists pago_proveedor_retenciones_pago_id_idx
  on public.pago_proveedor_retenciones (pago_id);
create index if not exists pago_proveedor_retenciones_retencion_id_idx
  on public.pago_proveedor_retenciones (retencion_id);

alter table public.retenciones enable row level security;
alter table public.pago_recibido_retenciones enable row level security;
alter table public.pago_proveedor_retenciones enable row level security;

revoke all on public.retenciones from anon;
revoke all on public.retenciones from authenticated;
grant select on public.retenciones to authenticated;

revoke all on public.pago_recibido_retenciones from anon;
revoke all on public.pago_recibido_retenciones from authenticated;
grant select on public.pago_recibido_retenciones to authenticated;

revoke all on public.pago_proveedor_retenciones from anon;
revoke all on public.pago_proveedor_retenciones from authenticated;
grant select on public.pago_proveedor_retenciones to authenticated;

drop policy if exists retenciones_lectura on public.retenciones;
create policy retenciones_lectura on public.retenciones
  for select to authenticated
  using ((select public.rol_actual()) is not null);

drop policy if exists pago_recibido_retenciones_lectura on public.pago_recibido_retenciones;
create policy pago_recibido_retenciones_lectura on public.pago_recibido_retenciones
  for select to authenticated
  using ((select public.rol_actual()) is not null);

drop policy if exists pago_proveedor_retenciones_lectura on public.pago_proveedor_retenciones;
create policy pago_proveedor_retenciones_lectura on public.pago_proveedor_retenciones
  for select to authenticated
  using ((select public.rol_actual()) is not null);

-- ---------------------------------------------------------------------------
-- RPC: listar el catálogo de retenciones con sus cuentas
-- ---------------------------------------------------------------------------

create or replace function public.listar_retenciones()
returns table (
  id uuid,
  nombre text,
  tipo text,
  porcentaje numeric,
  cuenta_id uuid,
  cuenta_codigo text,
  cuenta_nombre text,
  cuenta_anticipo_id uuid,
  cuenta_anticipo_codigo text,
  cuenta_anticipo_nombre text,
  activa boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    r.id,
    r.nombre,
    r.tipo,
    r.porcentaje,
    r.cuenta_id,
    cp.codigo,
    cp.nombre,
    r.cuenta_anticipo_id,
    ca.codigo,
    ca.nombre,
    r.activa
  from public.retenciones r
  join public.cuentas cp on cp.id = r.cuenta_id
  left join public.cuentas ca on ca.id = r.cuenta_anticipo_id
  order by r.tipo, r.porcentaje, r.nombre;
$$;

-- ---------------------------------------------------------------------------
-- RPC: crear una retención (admin o contador)
-- ---------------------------------------------------------------------------

create or replace function public.crear_retencion(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_nombre text;
  v_tipo text;
  v_porcentaje numeric(5,2);
  v_cuenta public.cuentas%rowtype;
  v_anticipo_id uuid;
  v_activa boolean;
  v_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la retención requeridos' using errcode = '22023';
  end if;

  v_nombre := trim(regexp_replace(coalesce(p->>'nombre', ''), '\s+', ' ', 'g'));
  if v_nombre = '' then
    raise exception 'el nombre de la retención es obligatorio' using errcode = '22023';
  end if;

  v_tipo := coalesce(p->>'tipo', '');
  if v_tipo not in ('itbis', 'isr') then
    raise exception 'el tipo de retención debe ser itbis o isr' using errcode = '22023';
  end if;

  v_porcentaje := round(coalesce((p->>'porcentaje')::numeric, 0), 2);
  if v_porcentaje <= 0 or v_porcentaje > 100 then
    raise exception 'el porcentaje de la retención debe estar entre 0 y 100' using errcode = '22023';
  end if;

  select * into v_cuenta
  from public.cuentas c
  where c.id = (p->>'cuenta_id')::uuid and c.activa and c.acepta_movimientos;

  if not found then
    raise exception 'cuenta contable de la retención no encontrada' using errcode = '22023';
  end if;
  if v_cuenta.tipo <> 'pasivo' then
    raise exception 'la cuenta de la retención debe ser pasiva' using errcode = '22023';
  end if;

  if nullif(p->>'cuenta_anticipo_id', '') is not null then
    select c.id into v_anticipo_id
    from public.cuentas c
    where c.id = (p->>'cuenta_anticipo_id')::uuid and c.activa and c.acepta_movimientos;

    if v_anticipo_id is null then
      raise exception 'cuenta de anticipo de la retención no encontrada' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.cuentas c where c.id = v_anticipo_id and c.tipo = 'activo'
    ) then
      raise exception 'la cuenta de anticipo debe ser activa' using errcode = '22023';
    end if;
  end if;

  v_activa := coalesce((p->>'activa')::boolean, true);

  begin
    insert into public.retenciones (nombre, tipo, porcentaje, cuenta_id, cuenta_anticipo_id, activa)
    values (v_nombre, v_tipo, v_porcentaje, v_cuenta.id, v_anticipo_id, v_activa)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'la retención ya existe' using errcode = '23505';
  end;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: actualizar una retención (admin o contador)
-- ---------------------------------------------------------------------------

create or replace function public.actualizar_retencion(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_nombre text;
  v_tipo text;
  v_porcentaje numeric(5,2);
  v_cuenta public.cuentas%rowtype;
  v_anticipo_id uuid;
  v_activa boolean;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or nullif(p->>'id', '') is null then
    raise exception 'la retención es obligatoria' using errcode = '22023';
  end if;

  v_id := (p->>'id')::uuid;

  if not exists (select 1 from public.retenciones r where r.id = v_id) then
    raise exception 'retención no encontrada' using errcode = '22023';
  end if;

  v_nombre := trim(regexp_replace(coalesce(p->>'nombre', ''), '\s+', ' ', 'g'));
  if v_nombre = '' then
    raise exception 'el nombre de la retención es obligatorio' using errcode = '22023';
  end if;

  v_tipo := coalesce(p->>'tipo', '');
  if v_tipo not in ('itbis', 'isr') then
    raise exception 'el tipo de retención debe ser itbis o isr' using errcode = '22023';
  end if;

  v_porcentaje := round(coalesce((p->>'porcentaje')::numeric, 0), 2);
  if v_porcentaje <= 0 or v_porcentaje > 100 then
    raise exception 'el porcentaje de la retención debe estar entre 0 y 100' using errcode = '22023';
  end if;

  select * into v_cuenta
  from public.cuentas c
  where c.id = (p->>'cuenta_id')::uuid and c.activa and c.acepta_movimientos;

  if not found then
    raise exception 'cuenta contable de la retención no encontrada' using errcode = '22023';
  end if;
  if v_cuenta.tipo <> 'pasivo' then
    raise exception 'la cuenta de la retención debe ser pasiva' using errcode = '22023';
  end if;

  if nullif(p->>'cuenta_anticipo_id', '') is not null then
    select c.id into v_anticipo_id
    from public.cuentas c
    where c.id = (p->>'cuenta_anticipo_id')::uuid and c.activa and c.acepta_movimientos;

    if v_anticipo_id is null then
      raise exception 'cuenta de anticipo de la retención no encontrada' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.cuentas c where c.id = v_anticipo_id and c.tipo = 'activo'
    ) then
      raise exception 'la cuenta de anticipo debe ser activa' using errcode = '22023';
    end if;
  end if;

  v_activa := coalesce((p->>'activa')::boolean, true);

  begin
    update public.retenciones
    set nombre = v_nombre,
        tipo = v_tipo,
        porcentaje = v_porcentaje,
        cuenta_id = v_cuenta.id,
        cuenta_anticipo_id = v_anticipo_id,
        activa = v_activa
    where id = v_id;
  exception when unique_violation then
    raise exception 'ya existe una retención con ese nombre' using errcode = '23505';
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de funciones
-- ---------------------------------------------------------------------------

revoke all on function public.listar_retenciones() from public, anon, authenticated;
grant execute on function public.listar_retenciones() to authenticated;

revoke all on function public.crear_retencion(jsonb) from public, anon, authenticated;
grant execute on function public.crear_retencion(jsonb) to authenticated;

revoke all on function public.actualizar_retencion(jsonb) from public, anon, authenticated;
grant execute on function public.actualizar_retencion(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Transferencias entre almacenes de inventario.
--
-- Mueve existencia del almacén de origen al de destino sin asiento contable
-- (el costo total no cambia). La anulación revierte las cantidades.
-- Migración aditiva y reintentable. RLS activo; escrituras solo por RPC.
-- ---------------------------------------------------------------------------

create sequence if not exists public.transferencias_inventario_numero_seq;

create table if not exists public.transferencias_inventario (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique default nextval('public.transferencias_inventario_numero_seq'),
  fecha date not null default current_date,
  origen_id uuid not null references public.almacenes (id),
  destino_id uuid not null references public.almacenes (id),
  observaciones text,
  estado text not null default 'activa' check (estado in ('activa', 'anulada')),
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  constraint transferencias_inventario_almacenes_distintos check (origen_id <> destino_id)
);

create index if not exists transferencias_inventario_fecha_idx on public.transferencias_inventario (fecha);
create index if not exists transferencias_inventario_origen_id_idx on public.transferencias_inventario (origen_id);
create index if not exists transferencias_inventario_destino_id_idx on public.transferencias_inventario (destino_id);

create table if not exists public.transferencia_inventario_lineas (
  id uuid primary key default gen_random_uuid(),
  transferencia_id uuid not null references public.transferencias_inventario (id) on delete cascade,
  producto_id uuid not null references public.productos (id),
  cantidad numeric(14,2) not null check (cantidad > 0)
);

create index if not exists transferencia_inventario_lineas_transferencia_id_idx
  on public.transferencia_inventario_lineas (transferencia_id);
create index if not exists transferencia_inventario_lineas_producto_id_idx
  on public.transferencia_inventario_lineas (producto_id);

-- ---------------------------------------------------------------------------
-- RPC: crear transferencia
-- ---------------------------------------------------------------------------

create or replace function public.crear_transferencia_inventario(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_fecha date;
  v_origen uuid;
  v_destino uuid;
  v_observaciones text;
  v_lineas jsonb;
  v_linea jsonb;
  v_producto public.productos%rowtype;
  v_producto_id uuid;
  v_cantidad numeric(14,2);
  v_disponible numeric(14,2);
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la transferencia requeridos' using errcode = '22023';
  end if;

  v_origen := nullif(p->>'origen_id', '')::uuid;
  v_destino := nullif(p->>'destino_id', '')::uuid;

  if v_origen is null or v_destino is null then
    raise exception 'selecciona el almacén de origen y el de destino' using errcode = '22023';
  end if;
  if v_origen = v_destino then
    raise exception 'el almacén de origen y destino deben ser distintos' using errcode = '22023';
  end if;

  if not exists (select 1 from public.almacenes a where a.id = v_origen and a.activo) then
    raise exception 'almacén de origen no encontrado o inactivo' using errcode = '22023';
  end if;
  if not exists (select 1 from public.almacenes a where a.id = v_destino and a.activo) then
    raise exception 'almacén de destino no encontrado o inactivo' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_observaciones := nullif(trim(coalesce(p->>'observaciones', '')), '');

  v_lineas := coalesce(p->'lineas', '[]'::jsonb);
  if jsonb_typeof(v_lineas) <> 'array' or jsonb_array_length(v_lineas) = 0 then
    raise exception 'la transferencia requiere al menos un producto' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_lineas) e
    group by e->>'producto_id'
    having count(*) > 1
  ) then
    raise exception 'no repitas el mismo producto en la transferencia' using errcode = '22023';
  end if;

  insert into public.transferencias_inventario (fecha, origen_id, destino_id, observaciones)
  values (v_fecha, v_origen, v_destino, v_observaciones)
  returning id into v_id;

  for v_linea in select * from jsonb_array_elements(v_lineas) loop
    v_producto_id := nullif(v_linea->>'producto_id', '')::uuid;
    if v_producto_id is null then
      raise exception 'cada línea requiere un producto' using errcode = '22023';
    end if;

    select * into v_producto
    from public.productos pr
    where pr.id = v_producto_id and pr.activo;

    if not found then
      raise exception 'producto no encontrado o inactivo' using errcode = '22023';
    end if;
    if not v_producto.inventariable then
      raise exception 'el producto % no controla inventario', v_producto.nombre using errcode = '22023';
    end if;

    v_cantidad := round(coalesce((v_linea->>'cantidad')::numeric, 0), 2);
    if v_cantidad <= 0 then
      raise exception 'la cantidad a transferir debe ser mayor a cero' using errcode = '22023';
    end if;

    select e.cantidad into v_disponible
    from public.existencias e
    where e.producto_id = v_producto_id and e.almacen_id = v_origen
    for update;

    if coalesce(v_disponible, 0) < v_cantidad then
      raise exception 'no hay existencia suficiente de % en el almacén de origen', v_producto.nombre
        using errcode = '22023';
    end if;

    insert into public.transferencia_inventario_lineas (transferencia_id, producto_id, cantidad)
    values (v_id, v_producto_id, v_cantidad);

    perform public._sumar_existencia(v_producto_id, v_origen, -v_cantidad);
    perform public._sumar_existencia(v_producto_id, v_destino, v_cantidad);
  end loop;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: anular transferencia
-- ---------------------------------------------------------------------------

create or replace function public.anular_transferencia_inventario(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_transferencia public.transferencias_inventario%rowtype;
  v_linea public.transferencia_inventario_lineas%rowtype;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_id is null then
    raise exception 'la transferencia es obligatoria' using errcode = '22023';
  end if;

  select * into v_transferencia
  from public.transferencias_inventario t
  where t.id = p_id
  for update;

  if not found then
    raise exception 'transferencia no encontrada' using errcode = '22023';
  end if;
  if v_transferencia.estado = 'anulada' then
    raise exception 'la transferencia ya está anulada' using errcode = '22023';
  end if;

  for v_linea in
    select * from public.transferencia_inventario_lineas tl
    where tl.transferencia_id = p_id
    order by tl.id
  loop
    perform public._sumar_existencia(v_linea.producto_id, v_transferencia.destino_id, -v_linea.cantidad);
    perform public._sumar_existencia(v_linea.producto_id, v_transferencia.origen_id, v_linea.cantidad);
  end loop;

  update public.transferencias_inventario set estado = 'anulada' where id = p_id;

  return p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS y permisos
-- ---------------------------------------------------------------------------

do $$
declare
  v_tabla text;
begin
  foreach v_tabla in array array[
    'transferencias_inventario',
    'transferencia_inventario_lineas'
  ] loop
    execute format('alter table public.%I enable row level security', v_tabla);
    execute format('revoke all on public.%I from anon', v_tabla);
    execute format('revoke all on public.%I from authenticated', v_tabla);
    execute format('grant select on public.%I to authenticated', v_tabla);
    execute format('drop policy if exists %I on public.%I', v_tabla || '_lectura', v_tabla);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.rol_actual()) is not null)',
      v_tabla || '_lectura',
      v_tabla
    );
  end loop;
end;
$$;

revoke all on sequence public.transferencias_inventario_numero_seq from anon, authenticated;

revoke all on function public.crear_transferencia_inventario(jsonb) from public, anon, authenticated;
revoke all on function public.anular_transferencia_inventario(uuid) from public, anon, authenticated;

grant execute on function public.crear_transferencia_inventario(jsonb) to authenticated;
grant execute on function public.anular_transferencia_inventario(uuid) to authenticated;

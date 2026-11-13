-- ---------------------------------------------------------------------------
-- Órdenes de compra
--
-- Migración aditiva y reintentable: no borra ni cambia datos existentes.
-- - Tablas ordenes_compra y orden_compra_lineas con RLS de lectura.
-- - RPC crear_orden_compra (admin/contador): documento de control, sin
--   asiento contable y sin mover inventario.
-- - RPC vincular_orden_compra: marca la orden como convertida en factura de
--   proveedor cuando la factura se crea desde la orden.
-- ---------------------------------------------------------------------------

create sequence if not exists public.ordenes_compra_numero_seq;

create table if not exists public.ordenes_compra (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique default nextval('public.ordenes_compra_numero_seq'),
  contacto_id uuid not null references public.contactos (id),
  fecha date not null default current_date,
  fecha_entrega date not null default current_date,
  notas text,
  terminos text,
  subtotal numeric(14,2) not null default 0,
  itbis numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  estado text not null default 'abierta' check (estado in ('abierta', 'convertida', 'anulada')),
  factura_proveedor_id uuid references public.facturas_proveedor (id),
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now()
);

create table if not exists public.orden_compra_lineas (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes_compra (id) on delete cascade,
  producto_id uuid references public.productos (id),
  cuenta_id uuid references public.cuentas (id),
  descripcion text not null default '',
  cantidad numeric(14,2) not null check (cantidad > 0),
  costo numeric(14,2) not null default 0 check (costo >= 0),
  itbis_tasa numeric(5,2) not null default 0 check (itbis_tasa between 0 and 100),
  subtotal numeric(14,2) not null default 0,
  itbis numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  constraint orden_compra_lineas_destino check (producto_id is not null or cuenta_id is not null)
);

create index if not exists ordenes_compra_contacto_id_idx on public.ordenes_compra (contacto_id);
create index if not exists ordenes_compra_fecha_idx on public.ordenes_compra (fecha);
create index if not exists ordenes_compra_estado_idx on public.ordenes_compra (estado);
create index if not exists ordenes_compra_factura_proveedor_id_idx
  on public.ordenes_compra (factura_proveedor_id);
create index if not exists orden_compra_lineas_orden_id_idx on public.orden_compra_lineas (orden_id);
create index if not exists orden_compra_lineas_producto_id_idx on public.orden_compra_lineas (producto_id);
create index if not exists orden_compra_lineas_cuenta_id_idx on public.orden_compra_lineas (cuenta_id);

-- ---------------------------------------------------------------------------
-- RPC: crear orden de compra
-- ---------------------------------------------------------------------------

create or replace function public.crear_orden_compra(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_contacto public.contactos%rowtype;
  v_orden_id uuid;
  v_fecha date;
  v_fecha_entrega date;
  v_linea jsonb;
  v_producto public.productos%rowtype;
  v_producto_id uuid;
  v_cuenta_id uuid;
  v_cantidad numeric(14,2);
  v_costo numeric(14,2);
  v_itbis_tasa numeric(5,2);
  v_descripcion text;
  v_subtotal numeric(14,2);
  v_itbis numeric(14,2);
  v_total numeric(14,2);
  v_subtotal_orden numeric(14,2) := 0;
  v_itbis_orden numeric(14,2) := 0;
  v_total_orden numeric(14,2) := 0;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la orden de compra requeridos' using errcode = '22023';
  end if;

  if p->>'contacto_id' is null then
    raise exception 'el proveedor es obligatorio' using errcode = '22023';
  end if;

  select * into v_contacto
  from public.contactos c
  where c.id = (p->>'contacto_id')::uuid and c.activo;

  if not found then
    raise exception 'proveedor no encontrado' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_fecha_entrega := coalesce((p->>'fecha_entrega')::date, v_fecha);
  if v_fecha_entrega < v_fecha then
    raise exception 'la fecha de entrega no puede ser anterior a la fecha' using errcode = '22023';
  end if;

  if p->'lineas' is null
     or jsonb_typeof(p->'lineas') <> 'array'
     or jsonb_array_length(p->'lineas') = 0 then
    raise exception 'la orden de compra requiere al menos una línea' using errcode = '22023';
  end if;

  insert into public.ordenes_compra (
    contacto_id, fecha, fecha_entrega, notas, terminos, creado_por
  )
  values (
    v_contacto.id, v_fecha, v_fecha_entrega, p->>'notas', p->>'terminos', auth.uid()
  )
  returning id into v_orden_id;

  for v_linea in select * from jsonb_array_elements(p->'lineas') loop
    v_producto_id := nullif(v_linea->>'producto_id', '')::uuid;
    v_cuenta_id := nullif(v_linea->>'cuenta_id', '')::uuid;
    v_descripcion := null;

    if v_producto_id is not null then
      select * into v_producto
      from public.productos pr
      where pr.id = v_producto_id and pr.activo;

      if not found then
        raise exception 'producto no encontrado' using errcode = '22023';
      end if;
      v_descripcion := v_producto.nombre;
    elsif v_cuenta_id is null then
      raise exception 'cada línea requiere un producto o una cuenta' using errcode = '22023';
    end if;

    v_cantidad := round(coalesce((v_linea->>'cantidad')::numeric, 0), 2);
    if v_cantidad <= 0 then
      raise exception 'la cantidad debe ser mayor a cero' using errcode = '22023';
    end if;

    v_costo := round(coalesce((v_linea->>'costo')::numeric, 0), 2);
    if v_costo < 0 then
      raise exception 'el costo no puede ser negativo' using errcode = '22023';
    end if;

    v_itbis_tasa := round(coalesce((v_linea->>'itbis_tasa')::numeric, 0), 2);
    if v_itbis_tasa < 0 or v_itbis_tasa > 100 then
      raise exception 'la tasa de ITBIS es inválida' using errcode = '22023';
    end if;

    v_descripcion := coalesce(nullif(v_linea->>'descripcion', ''), v_descripcion, '');
    v_subtotal := round(v_cantidad * v_costo, 2);
    v_itbis := round(v_subtotal * v_itbis_tasa / 100, 2);
    v_total := round(v_subtotal + v_itbis, 2);

    insert into public.orden_compra_lineas (
      orden_id, producto_id, cuenta_id, descripcion, cantidad, costo, itbis_tasa,
      subtotal, itbis, total
    )
    values (
      v_orden_id, v_producto_id,
      case when v_producto_id is null then v_cuenta_id else null end,
      v_descripcion, v_cantidad, v_costo, v_itbis_tasa, v_subtotal, v_itbis, v_total
    );

    v_subtotal_orden := v_subtotal_orden + v_subtotal;
    v_itbis_orden := v_itbis_orden + v_itbis;
    v_total_orden := v_total_orden + v_total;
  end loop;

  if v_total_orden <= 0 then
    raise exception 'el total de la orden de compra debe ser mayor a cero' using errcode = '22023';
  end if;

  update public.ordenes_compra
  set subtotal = v_subtotal_orden,
      itbis = v_itbis_orden,
      total = v_total_orden
  where id = v_orden_id;

  return v_orden_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: vincular orden con la factura de proveedor generada
-- ---------------------------------------------------------------------------

create or replace function public.vincular_orden_compra(p_orden_id uuid, p_factura_proveedor_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_orden public.ordenes_compra%rowtype;
  v_factura public.facturas_proveedor%rowtype;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_orden_id is null or p_factura_proveedor_id is null then
    raise exception 'la orden y la factura son obligatorias' using errcode = '22023';
  end if;

  select * into v_orden
  from public.ordenes_compra oc
  where oc.id = p_orden_id
  for update;

  if not found then
    raise exception 'orden de compra no encontrada' using errcode = '22023';
  end if;
  if v_orden.estado = 'anulada' then
    raise exception 'la orden de compra está anulada' using errcode = '22023';
  end if;

  select * into v_factura
  from public.facturas_proveedor fp
  where fp.id = p_factura_proveedor_id;

  if not found then
    raise exception 'factura de proveedor no encontrada' using errcode = '22023';
  end if;
  if v_factura.contacto_id <> v_orden.contacto_id then
    raise exception 'la factura no pertenece al proveedor de la orden' using errcode = '22023';
  end if;

  if v_orden.estado = 'convertida' then
    if v_orden.factura_proveedor_id = p_factura_proveedor_id then
      return v_orden.id;
    end if;
    raise exception 'la orden de compra ya fue convertida en otra factura' using errcode = '22023';
  end if;

  update public.ordenes_compra
  set estado = 'convertida',
      factura_proveedor_id = p_factura_proveedor_id
  where id = p_orden_id;

  return v_orden.id;
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
    'ordenes_compra',
    'orden_compra_lineas'
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

revoke all on sequence public.ordenes_compra_numero_seq from anon, authenticated;

revoke all on function public.crear_orden_compra(jsonb) from public, anon, authenticated;
grant execute on function public.crear_orden_compra(jsonb) to authenticated;

revoke all on function public.vincular_orden_compra(uuid, uuid) from public, anon, authenticated;
grant execute on function public.vincular_orden_compra(uuid, uuid) to authenticated;

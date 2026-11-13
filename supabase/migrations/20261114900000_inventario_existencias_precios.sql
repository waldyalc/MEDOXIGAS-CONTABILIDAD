-- ---------------------------------------------------------------------------
-- Inventario por almacén, anulación de ajustes y listas de precios.
--
-- · existencias: cantidad por producto y almacén. Se siembra desde la
--   existencia global (`productos.cantidad`) en el almacén Principal.
--   `productos.cantidad` se mantiene como total (suma de almacenes).
-- · facturas, facturas_proveedor y notas de crédito guardan `almacen_id`.
--   Los documentos viejos sin almacén se tratan como Principal.
-- · ajustes_inventario.estado permite anular con el patrón anular_documento.
-- · listas_precios + producto_precios; contactos.lista_precio_id.
--
-- Migración aditiva y reintentable: no borra ni cambia datos existentes.
-- Integrador: las RPC compartidas conservan vendedor/centro (S15) y el NCF B04/E34 de
-- notas de crédito de compra (S9); solo se suma almacen_id y el movimiento por existencias.
-- RLS activo; las escrituras van solo por RPC (admin o contador).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Existencias por almacén
-- ---------------------------------------------------------------------------

create table if not exists public.existencias (
  producto_id uuid not null references public.productos (id) on delete cascade,
  almacen_id uuid not null references public.almacenes (id),
  cantidad numeric(14,2) not null default 0,
  primary key (producto_id, almacen_id)
);

create index if not exists existencias_almacen_id_idx on public.existencias (almacen_id);

insert into public.existencias (producto_id, almacen_id, cantidad)
select pr.id, a.id, pr.cantidad
from public.productos pr
cross join lateral (
  select al.id
  from public.almacenes al
  where al.es_principal
  order by al.creado_en
  limit 1
) a
where pr.inventariable
on conflict (producto_id, almacen_id) do nothing;

alter table public.facturas
  add column if not exists almacen_id uuid references public.almacenes (id);
alter table public.facturas_proveedor
  add column if not exists almacen_id uuid references public.almacenes (id);
alter table public.notas_credito_venta
  add column if not exists almacen_id uuid references public.almacenes (id);
alter table public.notas_credito_compra
  add column if not exists almacen_id uuid references public.almacenes (id);

create index if not exists facturas_almacen_id_idx on public.facturas (almacen_id);
create index if not exists facturas_proveedor_almacen_id_idx on public.facturas_proveedor (almacen_id);
create index if not exists notas_credito_venta_almacen_id_idx on public.notas_credito_venta (almacen_id);
create index if not exists notas_credito_compra_almacen_id_idx on public.notas_credito_compra (almacen_id);

alter table public.ajustes_inventario
  add column if not exists estado text not null default 'activo'
  check (estado in ('activo', 'anulada'));

-- ---------------------------------------------------------------------------
-- Listas de precios
-- ---------------------------------------------------------------------------

create table if not exists public.listas_precios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  es_principal boolean not null default false,
  tipo text not null default 'fijo' check (tipo in ('fijo', 'porcentaje')),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create unique index if not exists listas_precios_nombre_unico on public.listas_precios (lower(nombre));
create unique index if not exists listas_precios_un_principal
  on public.listas_precios (es_principal) where es_principal;

insert into public.listas_precios (nombre, es_principal, tipo)
select 'General', true, 'fijo'
where not exists (select 1 from public.listas_precios where es_principal)
  and not exists (select 1 from public.listas_precios where lower(nombre) = lower('General'))
on conflict do nothing;

create table if not exists public.producto_precios (
  producto_id uuid not null references public.productos (id) on delete cascade,
  lista_id uuid not null references public.listas_precios (id) on delete cascade,
  precio numeric(14,2) not null,
  primary key (producto_id, lista_id)
);

create index if not exists producto_precios_lista_id_idx on public.producto_precios (lista_id);

alter table public.contactos
  add column if not exists lista_precio_id uuid references public.listas_precios (id);

create index if not exists contactos_lista_precio_id_idx on public.contactos (lista_precio_id);

-- ---------------------------------------------------------------------------
-- Internas: almacén principal y movimientos de existencia
-- ---------------------------------------------------------------------------

create or replace function public._almacen_principal()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select al.id
  from public.almacenes al
  where al.activo
  order by al.es_principal desc, al.creado_en
  limit 1;
$$;

create or replace function public._sumar_existencia(
  p_producto_id uuid,
  p_almacen_id uuid,
  p_cantidad numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_almacen_id uuid;
begin
  if p_cantidad = 0 then
    return;
  end if;

  v_almacen_id := coalesce(p_almacen_id, public._almacen_principal());
  if v_almacen_id is null then
    raise exception 'no hay almacén principal' using errcode = '22023';
  end if;

  insert into public.existencias (producto_id, almacen_id, cantidad)
  values (p_producto_id, v_almacen_id, p_cantidad)
  on conflict (producto_id, almacen_id) do update
  set cantidad = public.existencias.cantidad + excluded.cantidad;
end;
$$;

create or replace function public._mover_existencia(
  p_producto_id uuid,
  p_almacen_id uuid,
  p_cantidad numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_cantidad = 0 then
    return;
  end if;

  perform public._sumar_existencia(p_producto_id, p_almacen_id, p_cantidad);

  update public.productos pr
  set cantidad = pr.cantidad + p_cantidad
  where pr.id = p_producto_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Listas de precios (RPC)
-- ---------------------------------------------------------------------------

create or replace function public.crear_lista_precio(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_nombre text;
  v_tipo text;
  v_principal boolean;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la lista de precios requeridos' using errcode = '22023';
  end if;

  v_nombre := trim(coalesce(p->>'nombre', ''));
  if v_nombre = '' then
    raise exception 'el nombre de la lista de precios es obligatorio' using errcode = '22023';
  end if;

  v_tipo := coalesce(nullif(p->>'tipo', ''), 'fijo');
  if v_tipo not in ('fijo', 'porcentaje') then
    raise exception 'el tipo de lista debe ser fijo o porcentaje' using errcode = '22023';
  end if;

  if exists (select 1 from public.listas_precios lp where lower(lp.nombre) = lower(v_nombre)) then
    raise exception 'ya existe una lista de precios con ese nombre' using errcode = '22023';
  end if;

  v_principal := coalesce((p->>'es_principal')::boolean, false);
  if v_principal then
    update public.listas_precios set es_principal = false where es_principal;
  end if;

  insert into public.listas_precios (nombre, es_principal, tipo, activo)
  values (v_nombre, v_principal, v_tipo, coalesce((p->>'activo')::boolean, true))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.actualizar_lista_precio(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_lista public.listas_precios%rowtype;
  v_nombre text;
  v_tipo text;
  v_principal boolean;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la lista de precios requeridos' using errcode = '22023';
  end if;

  select * into v_lista from public.listas_precios lp where lp.id = p_id for update;
  if not found then
    raise exception 'lista de precios no encontrada' using errcode = '22023';
  end if;

  v_nombre := v_lista.nombre;
  if p ? 'nombre' then
    v_nombre := trim(coalesce(p->>'nombre', ''));
    if v_nombre = '' then
      raise exception 'el nombre de la lista de precios es obligatorio' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.listas_precios lp
      where lower(lp.nombre) = lower(v_nombre)
        and lp.id <> p_id
    ) then
      raise exception 'ya existe una lista de precios con ese nombre' using errcode = '22023';
    end if;
  end if;

  v_tipo := v_lista.tipo;
  if p ? 'tipo' then
    v_tipo := nullif(p->>'tipo', '');
    if v_tipo is null or v_tipo not in ('fijo', 'porcentaje') then
      raise exception 'el tipo de lista debe ser fijo o porcentaje' using errcode = '22023';
    end if;
  end if;

  v_principal := v_lista.es_principal;
  if p ? 'es_principal' then
    v_principal := (p->>'es_principal')::boolean;
    if v_lista.es_principal and not v_principal then
      raise exception 'debe existir una lista de precios principal' using errcode = '22023';
    end if;
    if v_principal then
      update public.listas_precios set es_principal = false where es_principal and id <> p_id;
    end if;
  end if;

  update public.listas_precios lp
  set
    nombre = v_nombre,
    tipo = v_tipo,
    es_principal = v_principal,
    activo = case when p ? 'activo' then (p->>'activo')::boolean else lp.activo end
  where lp.id = p_id;

  return p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Productos: existencia inicial en Principal y precio por lista
-- ---------------------------------------------------------------------------

create or replace function public.crear_producto(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_tipo text;
  v_itbis numeric(5,2);
  v_categoria_id uuid;
  v_inventariable boolean;
  v_cantidad numeric(14,2);
  v_precios jsonb;
  v_precio_item jsonb;
  v_lista_id uuid;
  v_lista public.listas_precios%rowtype;
  v_precio numeric(14,2);
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del producto requeridos' using errcode = '22023';
  end if;

  v_tipo := coalesce(nullif(p->>'tipo', ''), 'producto');
  if v_tipo not in ('producto', 'servicio') then
    raise exception 'tipo de producto inválido' using errcode = '22023';
  end if;

  if coalesce(trim(p->>'nombre'), '') = '' then
    raise exception 'el nombre del producto es obligatorio' using errcode = '22023';
  end if;

  v_itbis := coalesce((p->>'itbis_tasa')::numeric, 18);
  if v_itbis not in (0, 16, 18) then
    raise exception 'la tasa de ITBIS debe ser 0, 16 o 18' using errcode = '22023';
  end if;

  v_categoria_id := nullif(p->>'categoria_id', '')::uuid;
  if v_categoria_id is not null
     and not exists (select 1 from public.categorias_productos c where c.id = v_categoria_id) then
    raise exception 'categoría no encontrada' using errcode = '22023';
  end if;

  v_inventariable := v_tipo = 'producto' and coalesce((p->>'inventariable')::boolean, false);
  v_cantidad := case
    when v_inventariable then round(coalesce((p->>'cantidad')::numeric, 0), 2)
    else 0
  end;

  insert into public.productos (
    tipo, nombre, referencia, descripcion, precio, itbis_tasa, inventariable, cantidad, costo,
    categoria_id, cuenta_ingreso_id, cuenta_costo_id, cuenta_inventario_id, activo
  )
  values (
    v_tipo,
    p->>'nombre',
    p->>'referencia',
    p->>'descripcion',
    round(coalesce((p->>'precio')::numeric, 0), 2),
    v_itbis,
    v_inventariable,
    v_cantidad,
    round(coalesce((p->>'costo')::numeric, 0), 2),
    v_categoria_id,
    nullif(p->>'cuenta_ingreso_id', '')::uuid,
    nullif(p->>'cuenta_costo_id', '')::uuid,
    nullif(p->>'cuenta_inventario_id', '')::uuid,
    coalesce((p->>'activo')::boolean, true)
  )
  returning id into v_id;

  if v_inventariable and v_cantidad <> 0 then
    perform public._sumar_existencia(v_id, public._almacen_principal(), v_cantidad);
  end if;

  v_precios := coalesce(p->'precios', '[]'::jsonb);
  if jsonb_typeof(v_precios) <> 'array' then
    raise exception 'los precios por lista deben ser una lista' using errcode = '22023';
  end if;

  for v_precio_item in select * from jsonb_array_elements(v_precios) loop
    v_lista_id := nullif(v_precio_item->>'lista_id', '')::uuid;
    if v_lista_id is null then
      raise exception 'cada precio requiere una lista' using errcode = '22023';
    end if;

    select * into v_lista
    from public.listas_precios lp
    where lp.id = v_lista_id and lp.activo;

    if not found then
      raise exception 'lista de precios no encontrada' using errcode = '22023';
    end if;

    if nullif(v_precio_item->>'precio', '') is null then
      continue;
    end if;

    v_precio := round((v_precio_item->>'precio')::numeric, 2);
    if v_lista.tipo = 'fijo' and v_precio < 0 then
      raise exception 'el precio de la lista no puede ser negativo' using errcode = '22023';
    end if;
    if v_lista.tipo = 'porcentaje' and (v_precio < -100 or v_precio > 1000) then
      raise exception 'el porcentaje de la lista debe estar entre -100 y 1000' using errcode = '22023';
    end if;

    insert into public.producto_precios (producto_id, lista_id, precio)
    values (v_id, v_lista_id, v_precio)
    on conflict (producto_id, lista_id) do update set precio = excluded.precio;
  end loop;

  return v_id;
end;
$$;

create or replace function public.actualizar_producto(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_tipo text;
  v_itbis numeric(5,2);
  v_categoria_id uuid;
  v_actual public.productos%rowtype;
  v_inventariable boolean;
  v_cantidad numeric(14,2);
  v_delta numeric(14,2);
  v_precios jsonb;
  v_precio_item jsonb;
  v_lista_id uuid;
  v_lista public.listas_precios%rowtype;
  v_precio numeric(14,2);
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del producto requeridos' using errcode = '22023';
  end if;

  select * into v_actual
  from public.productos pr
  where pr.id = p_id
  for update;

  if not found then
    raise exception 'producto no encontrado' using errcode = '22023';
  end if;

  v_tipo := coalesce(nullif(p->>'tipo', ''), 'producto');
  if v_tipo not in ('producto', 'servicio') then
    raise exception 'tipo de producto inválido' using errcode = '22023';
  end if;

  if p ? 'itbis_tasa' then
    v_itbis := (p->>'itbis_tasa')::numeric;
    if v_itbis is not null and v_itbis not in (0, 16, 18) then
      raise exception 'la tasa de ITBIS debe ser 0, 16 o 18' using errcode = '22023';
    end if;
  end if;

  if p ? 'categoria_id' then
    v_categoria_id := nullif(p->>'categoria_id', '')::uuid;
    if v_categoria_id is not null
       and not exists (select 1 from public.categorias_productos c where c.id = v_categoria_id) then
      raise exception 'categoría no encontrada' using errcode = '22023';
    end if;
  end if;

  v_inventariable := case
    when p ? 'inventariable' then
      (case when p ? 'tipo' then v_tipo else v_actual.tipo end) = 'producto'
      and (p->>'inventariable')::boolean
    else v_actual.inventariable
  end;
  v_cantidad := case
    when p ? 'cantidad' and v_inventariable then round((p->>'cantidad')::numeric, 2)
    when not v_inventariable then 0
    else v_actual.cantidad
  end;
  v_delta := round(v_cantidad - v_actual.cantidad, 2);

  update public.productos pr
  set
    tipo = case when p ? 'tipo' then v_tipo else pr.tipo end,
    nombre = case when p ? 'nombre' then p->>'nombre' else pr.nombre end,
    referencia = case when p ? 'referencia' then p->>'referencia' else pr.referencia end,
    descripcion = case when p ? 'descripcion' then p->>'descripcion' else pr.descripcion end,
    precio = case when p ? 'precio' then round((p->>'precio')::numeric, 2) else pr.precio end,
    itbis_tasa = case when p ? 'itbis_tasa' then v_itbis else pr.itbis_tasa end,
    inventariable = v_inventariable,
    cantidad = v_cantidad,
    costo = case when p ? 'costo' then round((p->>'costo')::numeric, 2) else pr.costo end,
    categoria_id = case when p ? 'categoria_id' then v_categoria_id else pr.categoria_id end,
    cuenta_ingreso_id = case when p ? 'cuenta_ingreso_id' then nullif(p->>'cuenta_ingreso_id', '')::uuid else pr.cuenta_ingreso_id end,
    cuenta_costo_id = case when p ? 'cuenta_costo_id' then nullif(p->>'cuenta_costo_id', '')::uuid else pr.cuenta_costo_id end,
    cuenta_inventario_id = case when p ? 'cuenta_inventario_id' then nullif(p->>'cuenta_inventario_id', '')::uuid else pr.cuenta_inventario_id end,
    activo = case when p ? 'activo' then (p->>'activo')::boolean else pr.activo end
  where pr.id = p_id
  returning pr.id into v_id;

  if v_delta <> 0 then
    perform public._sumar_existencia(p_id, public._almacen_principal(), v_delta);
  end if;

  v_precios := coalesce(p->'precios', '[]'::jsonb);
  if jsonb_typeof(v_precios) <> 'array' then
    raise exception 'los precios por lista deben ser una lista' using errcode = '22023';
  end if;

  for v_precio_item in select * from jsonb_array_elements(v_precios) loop
    v_lista_id := nullif(v_precio_item->>'lista_id', '')::uuid;
    if v_lista_id is null then
      raise exception 'cada precio requiere una lista' using errcode = '22023';
    end if;

    select * into v_lista
    from public.listas_precios lp
    where lp.id = v_lista_id and lp.activo;

    if not found then
      raise exception 'lista de precios no encontrada' using errcode = '22023';
    end if;

    if nullif(v_precio_item->>'precio', '') is null then
      delete from public.producto_precios pp
      where pp.producto_id = p_id and pp.lista_id = v_lista_id;
      continue;
    end if;

    v_precio := round((v_precio_item->>'precio')::numeric, 2);
    if v_lista.tipo = 'fijo' and v_precio < 0 then
      raise exception 'el precio de la lista no puede ser negativo' using errcode = '22023';
    end if;
    if v_lista.tipo = 'porcentaje' and (v_precio < -100 or v_precio > 1000) then
      raise exception 'el porcentaje de la lista debe estar entre -100 y 1000' using errcode = '22023';
    end if;

    insert into public.producto_precios (producto_id, lista_id, precio)
    values (p_id, v_lista_id, v_precio)
    on conflict (producto_id, lista_id) do update set precio = excluded.precio;
  end loop;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Contactos: lista de precios por defecto opcional
-- ---------------------------------------------------------------------------

create or replace function public.crear_contacto(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_tipo text;
  v_lista_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del contacto requeridos' using errcode = '22023';
  end if;

  v_tipo := coalesce(nullif(p->>'tipo', ''), 'cliente');
  if v_tipo not in ('cliente', 'proveedor', 'ambos') then
    raise exception 'tipo de contacto inválido' using errcode = '22023';
  end if;

  if coalesce(trim(p->>'nombre'), '') = '' then
    raise exception 'el nombre del contacto es obligatorio' using errcode = '22023';
  end if;

  v_lista_id := nullif(p->>'lista_precio_id', '')::uuid;
  if v_lista_id is not null
     and not exists (select 1 from public.listas_precios lp where lp.id = v_lista_id and lp.activo) then
    raise exception 'lista de precios no encontrada' using errcode = '22023';
  end if;

  insert into public.contactos (
    tipo, nombre, rnc_cedula, telefono, correo, direccion, cuenta_cxc_id, cuenta_cxp_id,
    lista_precio_id, activo
  )
  values (
    v_tipo,
    p->>'nombre',
    p->>'rnc_cedula',
    p->>'telefono',
    p->>'correo',
    p->>'direccion',
    nullif(p->>'cuenta_cxc_id', '')::uuid,
    nullif(p->>'cuenta_cxp_id', '')::uuid,
    v_lista_id,
    coalesce((p->>'activo')::boolean, true)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.actualizar_contacto(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_tipo text;
  v_lista_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del contacto requeridos' using errcode = '22023';
  end if;

  v_tipo := coalesce(nullif(p->>'tipo', ''), 'cliente');
  if v_tipo not in ('cliente', 'proveedor', 'ambos') then
    raise exception 'tipo de contacto inválido' using errcode = '22023';
  end if;

  if p ? 'lista_precio_id' then
    v_lista_id := nullif(p->>'lista_precio_id', '')::uuid;
    if v_lista_id is not null
       and not exists (select 1 from public.listas_precios lp where lp.id = v_lista_id and lp.activo) then
      raise exception 'lista de precios no encontrada' using errcode = '22023';
    end if;
  end if;

  update public.contactos c
  set
    tipo = case when p ? 'tipo' then v_tipo else c.tipo end,
    nombre = case when p ? 'nombre' then p->>'nombre' else c.nombre end,
    rnc_cedula = case when p ? 'rnc_cedula' then p->>'rnc_cedula' else c.rnc_cedula end,
    telefono = case when p ? 'telefono' then p->>'telefono' else c.telefono end,
    correo = case when p ? 'correo' then p->>'correo' else c.correo end,
    direccion = case when p ? 'direccion' then p->>'direccion' else c.direccion end,
    cuenta_cxc_id = case when p ? 'cuenta_cxc_id' then nullif(p->>'cuenta_cxc_id', '')::uuid else c.cuenta_cxc_id end,
    cuenta_cxp_id = case when p ? 'cuenta_cxp_id' then nullif(p->>'cuenta_cxp_id', '')::uuid else c.cuenta_cxp_id end,
    lista_precio_id = case when p ? 'lista_precio_id' then v_lista_id else c.lista_precio_id end,
    activo = case when p ? 'activo' then (p->>'activo')::boolean else c.activo end
  where c.id = p_id
  returning c.id into v_id;

  if v_id is null then
    raise exception 'contacto no encontrado' using errcode = '22023';
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Factura de venta: descuenta del almacén del documento
-- ---------------------------------------------------------------------------

create or replace function public.crear_factura(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_contacto public.contactos%rowtype;
  v_almacen_id uuid;
  v_factura_id uuid;
  v_numero int;
  v_ncf text;
  v_tipo text;
  v_fecha date;
  v_vencimiento date;
  v_vendedor_id uuid;
  v_centro_costo_id uuid;
  v_num public.numeraciones%rowtype;
  v_linea jsonb;
  v_pago jsonb;
  v_asiento_id uuid;
  v_asiento_lineas jsonb := '[]'::jsonb;
  v_producto_id uuid;
  v_producto_nombre text;
  v_producto_tipo text;
  v_producto_precio numeric(14,2);
  v_producto_itbis numeric(5,2);
  v_producto_costo numeric(14,2);
  v_producto_inventariable boolean;
  v_producto_cuenta_ingreso uuid;
  v_producto_cuenta_costo uuid;
  v_producto_cuenta_inventario uuid;
  v_cantidad numeric(14,2);
  v_precio numeric(14,2);
  v_descuento_pct numeric(5,2);
  v_itbis_tasa numeric(5,2);
  v_descripcion text;
  v_bruto numeric(14,2);
  v_descuento numeric(14,2);
  v_subtotal numeric(14,2);
  v_itbis numeric(14,2);
  v_total numeric(14,2);
  v_costo_unitario numeric(14,2);
  v_costo_total numeric(14,2);
  v_cuenta_ingreso uuid;
  v_subtotal_factura numeric(14,2) := 0;
  v_descuento_factura numeric(14,2) := 0;
  v_itbis_factura numeric(14,2) := 0;
  v_total_factura numeric(14,2) := 0;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la factura requeridos' using errcode = '22023';
  end if;

  v_tipo := p->>'tipo_comprobante';
  if v_tipo is null or v_tipo not in ('01', '02', '14', '15', '16') then
    raise exception 'tipo de comprobante inválido' using errcode = '22023';
  end if;

  if p->>'contacto_id' is null then
    raise exception 'el contacto es obligatorio' using errcode = '22023';
  end if;

  select * into v_contacto
  from public.contactos c
  where c.id = (p->>'contacto_id')::uuid and c.activo;

  if not found then
    raise exception 'contacto no encontrado' using errcode = '22023';
  end if;

  v_vendedor_id := nullif(p->>'vendedor_id', '')::uuid;
  if v_vendedor_id is not null
     and not exists (select 1 from public.vendedores v where v.id = v_vendedor_id and v.activo) then
    raise exception 'vendedor no encontrado o inactivo' using errcode = '22023';
  end if;

  v_centro_costo_id := nullif(p->>'centro_costo_id', '')::uuid;
  if v_centro_costo_id is not null
     and not exists (select 1 from public.centros_costo c where c.id = v_centro_costo_id and c.activo) then
    raise exception 'centro de costo no encontrado o inactivo' using errcode = '22023';
  end if;

  v_almacen_id := nullif(p->>'almacen_id', '')::uuid;
  if v_almacen_id is null then
    v_almacen_id := public._almacen_principal();
  end if;
  if v_almacen_id is null
     or not exists (select 1 from public.almacenes al where al.id = v_almacen_id and al.activo) then
    raise exception 'almacén no encontrado o inactivo' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_vencimiento := coalesce((p->>'vencimiento')::date, v_fecha);
  if v_vencimiento < v_fecha then
    raise exception 'el vencimiento no puede ser anterior a la fecha' using errcode = '22023';
  end if;

  if p->'lineas' is null
     or jsonb_typeof(p->'lineas') <> 'array'
     or jsonb_array_length(p->'lineas') = 0 then
    raise exception 'la factura requiere al menos una línea' using errcode = '22023';
  end if;

  select * into v_num
  from public.numeraciones n
  where n.tipo_comprobante = v_tipo and n.activa
  order by n.id
  limit 1
  for update;

  if not found then
    raise exception 'no hay numeración activa para el comprobante %', v_tipo using errcode = '22023';
  end if;
  if v_num.hasta is not null and v_num.siguiente > v_num.hasta then
    raise exception 'la numeración % está agotada', v_num.prefijo using errcode = '22023';
  end if;
  if v_num.vence is not null and v_num.vence < v_fecha then
    raise exception 'la numeración % está vencida', v_num.prefijo using errcode = '22023';
  end if;

  v_ncf := v_num.prefijo || lpad(v_num.siguiente::text, 8, '0');
  update public.numeraciones set siguiente = siguiente + 1 where id = v_num.id;

  insert into public.facturas (
    tipo_comprobante, ncf, contacto_id, vendedor_id, centro_costo_id, almacen_id, fecha, vencimiento,
    notas, terminos, pie, creado_por
  )
  values (
    v_tipo, v_ncf, v_contacto.id, v_vendedor_id, v_centro_costo_id, v_almacen_id, v_fecha, v_vencimiento,
    p->>'notas', p->>'terminos', p->>'pie', auth.uid()
  )
  returning id, numero into v_factura_id, v_numero;

  for v_linea in select * from jsonb_array_elements(p->'lineas') loop
    v_producto_id := nullif(v_linea->>'producto_id', '')::uuid;
    v_producto_nombre := null;
    v_producto_tipo := null;
    v_producto_precio := null;
    v_producto_itbis := null;
    v_producto_costo := null;
    v_producto_inventariable := false;
    v_producto_cuenta_ingreso := null;
    v_producto_cuenta_costo := null;
    v_producto_cuenta_inventario := null;

    if v_producto_id is not null then
      select
        pr.nombre, pr.tipo, pr.precio, pr.itbis_tasa, pr.costo, pr.inventariable,
        pr.cuenta_ingreso_id, pr.cuenta_costo_id, pr.cuenta_inventario_id
      into
        v_producto_nombre, v_producto_tipo, v_producto_precio, v_producto_itbis, v_producto_costo,
        v_producto_inventariable, v_producto_cuenta_ingreso, v_producto_cuenta_costo,
        v_producto_cuenta_inventario
      from public.productos pr
      where pr.id = v_producto_id and pr.activo;

      if not found then
        raise exception 'producto no encontrado' using errcode = '22023';
      end if;
    end if;

    v_cantidad := round(coalesce((v_linea->>'cantidad')::numeric, 0), 2);
    if v_cantidad <= 0 then
      raise exception 'la cantidad debe ser mayor a cero' using errcode = '22023';
    end if;

    v_precio := round(coalesce((v_linea->>'precio')::numeric, v_producto_precio, 0), 2);
    if v_precio < 0 then
      raise exception 'el precio no puede ser negativo' using errcode = '22023';
    end if;

    v_descuento_pct := round(coalesce((v_linea->>'descuento_pct')::numeric, 0), 2);
    if v_descuento_pct < 0 or v_descuento_pct > 100 then
      raise exception 'el descuento debe estar entre 0 y 100' using errcode = '22023';
    end if;

    v_itbis_tasa := round(coalesce((v_linea->>'itbis_tasa')::numeric, v_producto_itbis, 18), 2);
    if v_itbis_tasa < 0 or v_itbis_tasa > 100 then
      raise exception 'la tasa de ITBIS es inválida' using errcode = '22023';
    end if;

    v_descripcion := coalesce(nullif(v_linea->>'descripcion', ''), v_producto_nombre, '');

    v_bruto := round(v_cantidad * v_precio, 2);
    v_descuento := round(v_bruto * v_descuento_pct / 100, 2);
    v_subtotal := round(v_bruto - v_descuento, 2);
    v_itbis := round(v_subtotal * v_itbis_tasa / 100, 2);
    v_total := round(v_subtotal + v_itbis, 2);

    v_costo_unitario := case when v_producto_inventariable then round(coalesce(v_producto_costo, 0), 2) else 0 end;
    v_costo_total := round(v_cantidad * v_costo_unitario, 2);

    insert into public.factura_lineas (
      factura_id, producto_id, descripcion, cantidad, precio, descuento_pct, itbis_tasa,
      subtotal, itbis, total, costo_unitario
    )
    values (
      v_factura_id, v_producto_id, v_descripcion, v_cantidad, v_precio, v_descuento_pct, v_itbis_tasa,
      v_subtotal, v_itbis, v_total, v_costo_unitario
    );

    v_subtotal_factura := v_subtotal_factura + v_subtotal;
    v_descuento_factura := v_descuento_factura + v_descuento;
    v_itbis_factura := v_itbis_factura + v_itbis;
    v_total_factura := v_total_factura + v_total;

    v_cuenta_ingreso := coalesce(
      v_producto_cuenta_ingreso,
      case when v_producto_tipo = 'servicio'
        then public._cuenta_config('ventas_servicios')
        else public._cuenta_config('ventas')
      end
    );

    if v_subtotal > 0 then
      v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_cuenta_ingreso,
        'debito', 0,
        'credito', v_subtotal,
        'descripcion', 'Venta: ' || left(v_descripcion, 80)
      ));
    end if;

    if v_producto_inventariable then
      if v_costo_total > 0 then
        v_asiento_lineas := v_asiento_lineas || jsonb_build_array(
          jsonb_build_object(
            'cuenta_id', coalesce(v_producto_cuenta_costo, public._cuenta_config('costo_ventas')),
            'debito', v_costo_total,
            'credito', 0,
            'descripcion', 'Costo de venta: ' || left(v_descripcion, 80)
          ),
          jsonb_build_object(
            'cuenta_id', coalesce(v_producto_cuenta_inventario, public._cuenta_config('inventario')),
            'debito', 0,
            'credito', v_costo_total,
            'descripcion', 'Salida de inventario: ' || left(v_descripcion, 80)
          )
        );
      end if;

      perform public._mover_existencia(v_producto_id, v_almacen_id, -v_cantidad);
    end if;
  end loop;

  if v_total_factura <= 0 then
    raise exception 'el total de la factura debe ser mayor a cero' using errcode = '22023';
  end if;

  update public.facturas
  set subtotal = v_subtotal_factura,
      descuento = v_descuento_factura,
      itbis = v_itbis_factura,
      total = v_total_factura
  where id = v_factura_id;

  v_asiento_lineas := jsonb_build_array(jsonb_build_object(
    'cuenta_id', coalesce(v_contacto.cuenta_cxc_id, public._cuenta_config('cxc')),
    'debito', v_total_factura,
    'credito', 0,
    'contacto_id', v_contacto.id,
    'descripcion', 'CxC factura ' || v_ncf
  )) || v_asiento_lineas;

  if v_itbis_factura > 0 then
    v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', public._cuenta_config('itbis_por_pagar'),
      'debito', 0,
      'credito', v_itbis_factura,
      'descripcion', 'ITBIS factura ' || v_ncf
    ));
  end if;

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Factura ' || v_ncf,
    'factura',
    v_factura_id,
    v_asiento_lineas
  );

  update public.facturas set asiento_id = v_asiento_id where id = v_factura_id;

  if v_centro_costo_id is not null then
    update public.asiento_lineas
    set centro_costo_id = v_centro_costo_id
    where asiento_id = v_asiento_id;
  end if;

  v_pago := p->'pago';
  if v_pago is not null and jsonb_typeof(v_pago) = 'object' then
    perform public.registrar_pago_recibido(jsonb_build_object(
      'factura_id', v_factura_id,
      'contacto_id', v_contacto.id,
      'fecha', coalesce(v_pago->>'fecha', v_fecha::text),
      'cuenta_id', v_pago->>'cuenta_id',
      'metodo', coalesce(v_pago->>'metodo', 'efectivo'),
      'monto', v_pago->'monto',
      'notas', v_pago->>'notas'
    ));
  end if;

  return v_factura_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Factura de proveedor: suma al almacén del documento
-- ---------------------------------------------------------------------------

create or replace function public.crear_factura_proveedor(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_contacto public.contactos%rowtype;
  v_almacen_id uuid;
  v_factura_id uuid;
  v_numero int;
  v_ncf text;
  v_fecha date;
  v_vencimiento date;
  v_centro_costo_id uuid;
  v_linea jsonb;
  v_asiento_id uuid;
  v_asiento_lineas jsonb := '[]'::jsonb;
  v_producto_id uuid;
  v_cuenta_id uuid;
  v_cuenta_debito uuid;
  v_producto_nombre text;
  v_producto_costo numeric(14,2);
  v_producto_cantidad numeric(14,2);
  v_producto_inventariable boolean;
  v_producto_cuenta_costo uuid;
  v_producto_cuenta_inventario uuid;
  v_cantidad numeric(14,2);
  v_costo numeric(14,2);
  v_itbis_tasa numeric(5,2);
  v_descripcion text;
  v_subtotal numeric(14,2);
  v_itbis numeric(14,2);
  v_total numeric(14,2);
  v_nuevo_costo numeric(14,2);
  v_subtotal_factura numeric(14,2) := 0;
  v_itbis_factura numeric(14,2) := 0;
  v_total_factura numeric(14,2) := 0;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la factura de proveedor requeridos' using errcode = '22023';
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

  v_centro_costo_id := nullif(p->>'centro_costo_id', '')::uuid;
  if v_centro_costo_id is not null
     and not exists (select 1 from public.centros_costo c where c.id = v_centro_costo_id and c.activo) then
    raise exception 'centro de costo no encontrado o inactivo' using errcode = '22023';
  end if;

  v_almacen_id := nullif(p->>'almacen_id', '')::uuid;
  if v_almacen_id is null then
    v_almacen_id := public._almacen_principal();
  end if;
  if v_almacen_id is null
     or not exists (select 1 from public.almacenes al where al.id = v_almacen_id and al.activo) then
    raise exception 'almacén no encontrado o inactivo' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_vencimiento := coalesce((p->>'vencimiento')::date, v_fecha);
  if v_vencimiento < v_fecha then
    raise exception 'el vencimiento no puede ser anterior a la fecha' using errcode = '22023';
  end if;

  v_ncf := nullif(p->>'ncf', '');
  if v_ncf is not null and exists (select 1 from public.facturas_proveedor fp where fp.ncf = v_ncf) then
    raise exception 'el NCF del proveedor ya está registrado' using errcode = '22023';
  end if;

  if p->'lineas' is null
     or jsonb_typeof(p->'lineas') <> 'array'
     or jsonb_array_length(p->'lineas') = 0 then
    raise exception 'la factura de proveedor requiere al menos una línea' using errcode = '22023';
  end if;

  insert into public.facturas_proveedor (ncf, contacto_id, centro_costo_id, almacen_id, fecha, vencimiento, notas, creado_por)
  values (v_ncf, v_contacto.id, v_centro_costo_id, v_almacen_id, v_fecha, v_vencimiento, p->>'notas', auth.uid())
  returning id, numero into v_factura_id, v_numero;

  for v_linea in select * from jsonb_array_elements(p->'lineas') loop
    v_producto_id := nullif(v_linea->>'producto_id', '')::uuid;
    v_cuenta_id := nullif(v_linea->>'cuenta_id', '')::uuid;
    v_producto_nombre := null;
    v_producto_costo := null;
    v_producto_cantidad := null;
    v_producto_inventariable := false;
    v_producto_cuenta_costo := null;
    v_producto_cuenta_inventario := null;

    if v_producto_id is not null then
      select
        pr.nombre, pr.costo, pr.cantidad, pr.inventariable, pr.cuenta_costo_id, pr.cuenta_inventario_id
      into
        v_producto_nombre, v_producto_costo, v_producto_cantidad, v_producto_inventariable,
        v_producto_cuenta_costo, v_producto_cuenta_inventario
      from public.productos pr
      where pr.id = v_producto_id and pr.activo;

      if not found then
        raise exception 'producto no encontrado' using errcode = '22023';
      end if;
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

    v_descripcion := coalesce(nullif(v_linea->>'descripcion', ''), v_producto_nombre, '');
    v_subtotal := round(v_cantidad * v_costo, 2);
    v_itbis := round(v_subtotal * v_itbis_tasa / 100, 2);
    v_total := round(v_subtotal + v_itbis, 2);

    if v_producto_id is not null and v_producto_inventariable then
      v_cuenta_debito := coalesce(v_producto_cuenta_inventario, public._cuenta_config('inventario'));
    elsif v_producto_id is not null then
      v_cuenta_debito := coalesce(v_producto_cuenta_costo, public._cuenta_config('gastos_generales'));
    else
      v_cuenta_debito := v_cuenta_id;
    end if;

    insert into public.facturas_proveedor_lineas (
      factura_proveedor_id, producto_id, cuenta_id, descripcion, cantidad, costo, itbis_tasa,
      subtotal, itbis, total
    )
    values (
      v_factura_id,
      v_producto_id,
      case when v_producto_id is null then v_cuenta_id else null end,
      v_descripcion,
      v_cantidad,
      v_costo,
      v_itbis_tasa,
      v_subtotal,
      v_itbis,
      v_total
    );

    v_subtotal_factura := v_subtotal_factura + v_subtotal;
    v_itbis_factura := v_itbis_factura + v_itbis;
    v_total_factura := v_total_factura + v_total;

    if v_subtotal > 0 then
      v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_cuenta_debito,
        'debito', v_subtotal,
        'credito', 0,
        'descripcion', 'Compra: ' || left(v_descripcion, 80)
      ));
    end if;

    if v_producto_id is not null and v_producto_inventariable then
      if v_producto_cantidad > 0 then
        v_nuevo_costo := round(
          ((v_producto_cantidad * v_producto_costo) + (v_cantidad * v_costo)) / (v_producto_cantidad + v_cantidad),
          2
        );
      else
        v_nuevo_costo := v_costo;
      end if;

      perform public._mover_existencia(v_producto_id, v_almacen_id, v_cantidad);

      update public.productos pr
      set costo = v_nuevo_costo
      where pr.id = v_producto_id;
    end if;
  end loop;

  if v_total_factura <= 0 then
    raise exception 'el total de la factura de proveedor debe ser mayor a cero' using errcode = '22023';
  end if;

  update public.facturas_proveedor
  set subtotal = v_subtotal_factura,
      itbis = v_itbis_factura,
      total = v_total_factura
  where id = v_factura_id;

  v_asiento_lineas := jsonb_build_array(jsonb_build_object(
    'cuenta_id', coalesce(v_contacto.cuenta_cxp_id, public._cuenta_config('cxp')),
    'debito', 0,
    'credito', v_total_factura,
    'contacto_id', v_contacto.id,
    'descripcion', 'CxP factura proveedor ' || coalesce(v_ncf, v_numero::text)
  )) || v_asiento_lineas;

  if v_itbis_factura > 0 then
    v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', public._cuenta_config('itbis_adelantado'),
      'debito', v_itbis_factura,
      'credito', 0,
      'descripcion', 'ITBIS adelantado factura proveedor ' || coalesce(v_ncf, v_numero::text)
    ));
  end if;

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Factura proveedor ' || coalesce(v_ncf, v_numero::text),
    'factura_proveedor',
    v_factura_id,
    v_asiento_lineas
  );

  update public.facturas_proveedor set asiento_id = v_asiento_id where id = v_factura_id;

  if v_centro_costo_id is not null then
    update public.asiento_lineas
    set centro_costo_id = v_centro_costo_id
    where asiento_id = v_asiento_id;
  end if;

  return v_factura_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Nota de crédito de venta: devuelve al almacén del documento
-- ---------------------------------------------------------------------------

create or replace function public.crear_nota_credito_venta(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_factura public.facturas%rowtype;
  v_almacen_id uuid;
  v_cuenta_cxc uuid;
  v_nota_id uuid;
  v_num public.numeraciones%rowtype;
  v_ncf text;
  v_fecha date;
  v_devuelve boolean;
  v_linea jsonb;
  v_factura_linea public.factura_lineas%rowtype;
  v_acreditado numeric(14,2);
  v_cantidad numeric(14,2);
  v_precio numeric(14,2);
  v_descuento_pct numeric(5,2);
  v_itbis_tasa numeric(5,2);
  v_subtotal numeric(14,2);
  v_itbis numeric(14,2);
  v_total numeric(14,2);
  v_costo_unitario numeric(14,2);
  v_costo_total numeric(14,2);
  v_producto_id uuid;
  v_producto_tipo text;
  v_producto_inventariable boolean;
  v_producto_cuenta_ingreso uuid;
  v_producto_cuenta_costo uuid;
  v_producto_cuenta_inventario uuid;
  v_cuenta_ingreso uuid;
  v_subtotal_nota numeric(14,2) := 0;
  v_itbis_nota numeric(14,2) := 0;
  v_total_nota numeric(14,2) := 0;
  v_asiento_lineas jsonb := '[]'::jsonb;
  v_asiento_id uuid;
  v_nuevo_credito numeric(14,2);
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or p->>'factura_id' is null then
    raise exception 'la factura es obligatoria' using errcode = '22023';
  end if;

  select * into v_factura
  from public.facturas f
  where f.id = (p->>'factura_id')::uuid
  for update;

  if not found then
    raise exception 'factura no encontrada' using errcode = '22023';
  end if;
  if v_factura.estado = 'anulada' then
    raise exception 'la factura está anulada' using errcode = '22023';
  end if;

  if p->'lineas' is null
     or jsonb_typeof(p->'lineas') <> 'array'
     or jsonb_array_length(p->'lineas') = 0 then
    raise exception 'la nota de crédito requiere al menos una línea' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_devuelve := coalesce(nullif(p->>'devuelve_inventario', '')::boolean, true);

  select * into v_num
  from public.numeraciones n
  where n.tipo_comprobante = '04' and n.activa
  order by n.id
  limit 1
  for update;

  if not found then
    raise exception 'no hay numeración activa para notas de crédito (04)' using errcode = '22023';
  end if;
  if v_num.hasta is not null and v_num.siguiente > v_num.hasta then
    raise exception 'la numeración % está agotada', v_num.prefijo using errcode = '22023';
  end if;
  if v_num.vence is not null and v_num.vence < v_fecha then
    raise exception 'la numeración % está vencida', v_num.prefijo using errcode = '22023';
  end if;

  v_ncf := v_num.prefijo || lpad(v_num.siguiente::text, 8, '0');
  update public.numeraciones set siguiente = siguiente + 1 where id = v_num.id;

  v_almacen_id := nullif(p->>'almacen_id', '')::uuid;
  if v_almacen_id is null then
    v_almacen_id := coalesce(v_factura.almacen_id, public._almacen_principal());
  end if;
  if v_almacen_id is null
     or not exists (select 1 from public.almacenes al where al.id = v_almacen_id and al.activo) then
    raise exception 'almacén no encontrado o inactivo' using errcode = '22023';
  end if;

  insert into public.notas_credito_venta (
    ncf, factura_id, contacto_id, almacen_id, fecha, devuelve_inventario, notas, creado_por
  )
  values (
    v_ncf, v_factura.id, v_factura.contacto_id, v_almacen_id, v_fecha, v_devuelve, p->>'notas', auth.uid()
  )
  returning id into v_nota_id;

  for v_linea in select * from jsonb_array_elements(p->'lineas') loop
    if nullif(v_linea->>'factura_linea_id', '') is null then
      raise exception 'cada línea requiere la línea de la factura' using errcode = '22023';
    end if;

    select * into v_factura_linea
    from public.factura_lineas fl
    where fl.id = (v_linea->>'factura_linea_id')::uuid
      and fl.factura_id = v_factura.id;

    if not found then
      raise exception 'línea de factura no encontrada' using errcode = '22023';
    end if;

    v_cantidad := round(coalesce((v_linea->>'cantidad')::numeric, 0), 2);
    if v_cantidad <= 0 then
      raise exception 'la cantidad debe ser mayor a cero' using errcode = '22023';
    end if;

    select coalesce(sum(nl.cantidad), 0)
    into v_acreditado
    from public.nota_credito_venta_lineas nl
    join public.notas_credito_venta n on n.id = nl.nota_id
    where nl.factura_linea_id = v_factura_linea.id
      and n.estado = 'activa';

    if v_cantidad > round(v_factura_linea.cantidad - v_acreditado, 2) then
      raise exception 'la cantidad excede lo disponible por acreditar en la línea' using errcode = '22023';
    end if;

    v_precio := v_factura_linea.precio;
    v_descuento_pct := v_factura_linea.descuento_pct;
    v_itbis_tasa := v_factura_linea.itbis_tasa;
    v_costo_unitario := v_factura_linea.costo_unitario;

    v_subtotal := round(
      round(v_cantidad * v_precio, 2) - round(round(v_cantidad * v_precio, 2) * v_descuento_pct / 100, 2),
      2
    );
    v_itbis := round(v_subtotal * v_itbis_tasa / 100, 2);
    v_total := round(v_subtotal + v_itbis, 2);
    v_costo_total := round(v_cantidad * v_costo_unitario, 2);

    insert into public.nota_credito_venta_lineas (
      nota_id, factura_linea_id, producto_id, descripcion, cantidad, precio, descuento_pct,
      itbis_tasa, subtotal, itbis, total, costo_unitario
    )
    values (
      v_nota_id, v_factura_linea.id, v_factura_linea.producto_id, v_factura_linea.descripcion,
      v_cantidad, v_precio, v_descuento_pct, v_itbis_tasa, v_subtotal, v_itbis, v_total, v_costo_unitario
    );

    v_subtotal_nota := v_subtotal_nota + v_subtotal;
    v_itbis_nota := v_itbis_nota + v_itbis;
    v_total_nota := v_total_nota + v_total;

    v_producto_id := v_factura_linea.producto_id;
    v_producto_tipo := null;
    v_producto_inventariable := false;
    v_producto_cuenta_ingreso := null;
    v_producto_cuenta_costo := null;
    v_producto_cuenta_inventario := null;

    if v_producto_id is not null then
      select
        pr.tipo, pr.inventariable, pr.cuenta_ingreso_id, pr.cuenta_costo_id, pr.cuenta_inventario_id
      into
        v_producto_tipo, v_producto_inventariable, v_producto_cuenta_ingreso,
        v_producto_cuenta_costo, v_producto_cuenta_inventario
      from public.productos pr
      where pr.id = v_producto_id;

      if not found then
        v_producto_tipo := null;
        v_producto_inventariable := false;
        v_producto_cuenta_ingreso := null;
        v_producto_cuenta_costo := null;
        v_producto_cuenta_inventario := null;
      end if;
    end if;

    v_cuenta_ingreso := coalesce(
      v_producto_cuenta_ingreso,
      case when v_producto_tipo = 'servicio'
        then public._cuenta_config('ventas_servicios')
        else public._cuenta_config('ventas')
      end
    );

    if v_subtotal > 0 then
      v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_cuenta_ingreso,
        'debito', v_subtotal,
        'credito', 0,
        'descripcion', 'Devolución venta: ' || left(v_factura_linea.descripcion, 70)
      ));
    end if;

    if v_devuelve and v_producto_inventariable then
      if v_costo_total > 0 then
        v_asiento_lineas := v_asiento_lineas || jsonb_build_array(
          jsonb_build_object(
            'cuenta_id', coalesce(v_producto_cuenta_inventario, public._cuenta_config('inventario')),
            'debito', v_costo_total,
            'credito', 0,
            'descripcion', 'Devolución inventario: ' || left(v_factura_linea.descripcion, 70)
          ),
          jsonb_build_object(
            'cuenta_id', coalesce(v_producto_cuenta_costo, public._cuenta_config('costo_ventas')),
            'debito', 0,
            'credito', v_costo_total,
            'descripcion', 'Reversión costo de venta: ' || left(v_factura_linea.descripcion, 70)
          )
        );
      end if;

      perform public._mover_existencia(v_producto_id, v_almacen_id, v_cantidad);
    end if;
  end loop;

  if v_total_nota <= 0 then
    raise exception 'el total de la nota de crédito debe ser mayor a cero' using errcode = '22023';
  end if;

  v_nuevo_credito := round(v_factura.credito + v_total_nota, 2);
  if v_nuevo_credito > v_factura.total then
    raise exception 'el crédito de la nota excede el total de la factura' using errcode = '22023';
  end if;

  update public.notas_credito_venta
  set subtotal = v_subtotal_nota,
      itbis = v_itbis_nota,
      total = v_total_nota
  where id = v_nota_id;

  select c.cuenta_cxc_id into v_cuenta_cxc
  from public.contactos c
  where c.id = v_factura.contacto_id;

  v_asiento_lineas := jsonb_build_array(jsonb_build_object(
    'cuenta_id', coalesce(v_cuenta_cxc, public._cuenta_config('cxc')),
    'debito', 0,
    'credito', v_total_nota,
    'contacto_id', v_factura.contacto_id,
    'descripcion', 'CxC nota de crédito ' || v_ncf
  )) || v_asiento_lineas;

  if v_itbis_nota > 0 then
    v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', public._cuenta_config('itbis_por_pagar'),
      'debito', v_itbis_nota,
      'credito', 0,
      'descripcion', 'ITBIS nota de crédito ' || v_ncf
    ));
  end if;

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Nota de crédito ' || v_ncf,
    'nota_credito_venta',
    v_nota_id,
    v_asiento_lineas
  );

  update public.notas_credito_venta set asiento_id = v_asiento_id where id = v_nota_id;

  update public.facturas
  set credito = v_nuevo_credito,
      estado = case
        when round(v_factura.pagado + v_nuevo_credito, 2) >= v_factura.total then 'pagada'
        else 'abierta'
      end
  where id = v_factura.id;

  return v_nota_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Nota de crédito de compra: saca del almacén del documento
-- ---------------------------------------------------------------------------

create or replace function public.crear_nota_credito_compra(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_factura public.facturas_proveedor%rowtype;
  v_contacto public.contactos%rowtype;
  v_almacen_id uuid;
  v_nota_id uuid;
  v_ncf text;
  v_fecha date;
  v_devuelve boolean;
  v_linea jsonb;
  v_factura_linea public.facturas_proveedor_lineas%rowtype;
  v_acreditado numeric(14,2);
  v_cantidad numeric(14,2);
  v_costo numeric(14,2);
  v_itbis_tasa numeric(5,2);
  v_subtotal numeric(14,2);
  v_itbis numeric(14,2);
  v_total numeric(14,2);
  v_producto public.productos%rowtype;
  v_cuenta_credito uuid;
  v_cantidad_actual numeric(14,2);
  v_costo_actual numeric(14,2);
  v_cantidad_nueva numeric(14,2);
  v_costo_nuevo numeric(14,2);
  v_subtotal_nota numeric(14,2) := 0;
  v_itbis_nota numeric(14,2) := 0;
  v_total_nota numeric(14,2) := 0;
  v_asiento_lineas jsonb := '[]'::jsonb;
  v_asiento_id uuid;
  v_nuevo_credito numeric(14,2);
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or p->>'factura_proveedor_id' is null then
    raise exception 'la factura de proveedor es obligatoria' using errcode = '22023';
  end if;

  select * into v_factura
  from public.facturas_proveedor fp
  where fp.id = (p->>'factura_proveedor_id')::uuid
  for update;

  if not found then
    raise exception 'factura de proveedor no encontrada' using errcode = '22023';
  end if;
  if v_factura.estado = 'anulada' then
    raise exception 'la factura de proveedor está anulada' using errcode = '22023';
  end if;

  if p->'lineas' is null
     or jsonb_typeof(p->'lineas') <> 'array'
     or jsonb_array_length(p->'lineas') = 0 then
    raise exception 'la nota de crédito requiere al menos una línea' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_devuelve := coalesce(nullif(p->>'devuelve_inventario', '')::boolean, true);

  v_ncf := nullif(upper(trim(p->>'ncf')), '');
  if v_ncf is not null and v_ncf !~ '^(B04[0-9]{8}|E34[0-9]{10})$' then
    raise exception 'el NCF de la nota debe ser B04 + 8 dígitos o E34 + 10 dígitos' using errcode = '22023';
  end if;

  v_almacen_id := nullif(p->>'almacen_id', '')::uuid;
  if v_almacen_id is null then
    v_almacen_id := coalesce(v_factura.almacen_id, public._almacen_principal());
  end if;
  if v_almacen_id is null
     or not exists (select 1 from public.almacenes al where al.id = v_almacen_id and al.activo) then
    raise exception 'almacén no encontrado o inactivo' using errcode = '22023';
  end if;

  insert into public.notas_credito_compra (
    ncf, factura_proveedor_id, contacto_id, almacen_id, fecha, devuelve_inventario, notas, creado_por
  )
  values (
    v_ncf, v_factura.id, v_factura.contacto_id, v_almacen_id, v_fecha, v_devuelve, p->>'notas', auth.uid()
  )
  returning id into v_nota_id;

  for v_linea in select * from jsonb_array_elements(p->'lineas') loop
    if nullif(v_linea->>'factura_proveedor_linea_id', '') is null then
      raise exception 'cada línea requiere la línea de la factura de proveedor' using errcode = '22023';
    end if;

    select * into v_factura_linea
    from public.facturas_proveedor_lineas fpl
    where fpl.id = (v_linea->>'factura_proveedor_linea_id')::uuid
      and fpl.factura_proveedor_id = v_factura.id;

    if not found then
      raise exception 'línea de factura de proveedor no encontrada' using errcode = '22023';
    end if;

    v_cantidad := round(coalesce((v_linea->>'cantidad')::numeric, 0), 2);
    if v_cantidad <= 0 then
      raise exception 'la cantidad debe ser mayor a cero' using errcode = '22023';
    end if;

    select coalesce(sum(nl.cantidad), 0)
    into v_acreditado
    from public.nota_credito_compra_lineas nl
    join public.notas_credito_compra n on n.id = nl.nota_id
    where nl.factura_proveedor_linea_id = v_factura_linea.id
      and n.estado = 'activa';

    if v_cantidad > round(v_factura_linea.cantidad - v_acreditado, 2) then
      raise exception 'la cantidad excede lo disponible por acreditar en la línea' using errcode = '22023';
    end if;

    v_costo := v_factura_linea.costo;
    v_itbis_tasa := v_factura_linea.itbis_tasa;
    v_subtotal := round(v_cantidad * v_costo, 2);
    v_itbis := round(v_subtotal * v_itbis_tasa / 100, 2);
    v_total := round(v_subtotal + v_itbis, 2);

    insert into public.nota_credito_compra_lineas (
      nota_id, factura_proveedor_linea_id, producto_id, cuenta_id, descripcion,
      cantidad, costo, itbis_tasa, subtotal, itbis, total
    )
    values (
      v_nota_id, v_factura_linea.id, v_factura_linea.producto_id, v_factura_linea.cuenta_id,
      v_factura_linea.descripcion, v_cantidad, v_costo, v_itbis_tasa, v_subtotal, v_itbis, v_total
    );

    v_subtotal_nota := v_subtotal_nota + v_subtotal;
    v_itbis_nota := v_itbis_nota + v_itbis;
    v_total_nota := v_total_nota + v_total;

    v_cuenta_credito := null;
    if v_factura_linea.producto_id is not null then
      select * into v_producto
      from public.productos pr
      where pr.id = v_factura_linea.producto_id;

      if found then
        if v_producto.inventariable then
          v_cuenta_credito := coalesce(v_producto.cuenta_inventario_id, public._cuenta_config('inventario'));
        else
          v_cuenta_credito := coalesce(v_producto.cuenta_costo_id, public._cuenta_config('gastos_generales'));
        end if;
      end if;
    end if;
    if v_cuenta_credito is null then
      v_cuenta_credito := coalesce(v_factura_linea.cuenta_id, public._cuenta_config('gastos_generales'));
    end if;

    if v_subtotal > 0 then
      v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_cuenta_credito,
        'debito', 0,
        'credito', v_subtotal,
        'descripcion', 'Devolución compra: ' || left(v_factura_linea.descripcion, 70)
      ));
    end if;

    if v_devuelve
       and v_factura_linea.producto_id is not null
       and v_producto.inventariable then
      select pr.cantidad, pr.costo
      into v_cantidad_actual, v_costo_actual
      from public.productos pr
      where pr.id = v_producto.id
      for update;

      v_cantidad_nueva := v_cantidad_actual - v_cantidad;

      if v_cantidad_nueva > 0 then
        v_costo_nuevo := round(
          greatest(v_cantidad_actual * v_costo_actual - v_cantidad * v_costo, 0) / v_cantidad_nueva,
          2
        );
      elsif v_cantidad_nueva = 0 then
        v_costo_nuevo := 0;
      else
        v_costo_nuevo := v_costo_actual;
      end if;

      perform public._mover_existencia(v_producto.id, v_almacen_id, -v_cantidad);

      update public.productos pr
      set costo = v_costo_nuevo
      where pr.id = v_producto.id;
    end if;
  end loop;

  if v_total_nota <= 0 then
    raise exception 'el total de la nota de crédito debe ser mayor a cero' using errcode = '22023';
  end if;

  v_nuevo_credito := round(v_factura.credito + v_total_nota, 2);
  if v_nuevo_credito > v_factura.total then
    raise exception 'el crédito de la nota excede el total de la factura de proveedor' using errcode = '22023';
  end if;

  update public.notas_credito_compra
  set subtotal = v_subtotal_nota,
      itbis = v_itbis_nota,
      total = v_total_nota
  where id = v_nota_id;

  select * into v_contacto from public.contactos c where c.id = v_factura.contacto_id;

  v_asiento_lineas := jsonb_build_array(jsonb_build_object(
    'cuenta_id', coalesce(v_contacto.cuenta_cxp_id, public._cuenta_config('cxp')),
    'debito', v_total_nota,
    'credito', 0,
    'contacto_id', v_factura.contacto_id,
    'descripcion', 'CxP nota de crédito compra ' || coalesce(v_ncf, 'sin NCF')
  )) || v_asiento_lineas;

  if v_itbis_nota > 0 then
    v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', public._cuenta_config('itbis_adelantado'),
      'debito', 0,
      'credito', v_itbis_nota,
      'descripcion', 'ITBIS nota de crédito compra ' || coalesce(v_ncf, 'sin NCF')
    ));
  end if;

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Nota de crédito compra ' || coalesce(v_ncf, 'sin NCF'),
    'nota_credito_compra',
    v_nota_id,
    v_asiento_lineas
  );

  update public.notas_credito_compra set asiento_id = v_asiento_id where id = v_nota_id;

  update public.facturas_proveedor
  set credito = v_nuevo_credito,
      estado = case
        when round(v_factura.pagado + v_nuevo_credito, 2) >= v_factura.total then 'pagada'
        else 'abierta'
      end
  where id = v_factura.id;

  return v_nota_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ajuste de inventario: mueve la existencia del almacén elegido
-- ---------------------------------------------------------------------------

create or replace function public.crear_ajuste_inventario(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_almacen public.almacenes%rowtype;
  v_id uuid;
  v_numero int;
  v_fecha date;
  v_observaciones text;
  v_lineas jsonb;
  v_linea jsonb;
  v_producto public.productos%rowtype;
  v_producto_id uuid;
  v_tipo text;
  v_cantidad numeric(14,2);
  v_costo numeric(14,2);
  v_total_linea numeric(14,2);
  v_total numeric(14,2) := 0;
  v_cantidad_nueva numeric(14,2);
  v_costo_nuevo numeric(14,2);
  v_cuenta_inventario uuid;
  v_cuenta_ajuste uuid;
  v_asiento_lineas jsonb := '[]'::jsonb;
  v_asiento_id uuid;
  v_descripcion text;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del ajuste requeridos' using errcode = '22023';
  end if;

  if nullif(p->>'almacen_id', '') is null then
    raise exception 'selecciona el almacén del ajuste' using errcode = '22023';
  end if;

  select * into v_almacen
  from public.almacenes a
  where a.id = (p->>'almacen_id')::uuid
    and a.activo;

  if not found then
    raise exception 'almacén no encontrado o inactivo' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_observaciones := nullif(trim(coalesce(p->>'observaciones', '')), '');

  v_lineas := coalesce(p->'lineas', '[]'::jsonb);
  if jsonb_typeof(v_lineas) <> 'array' or jsonb_array_length(v_lineas) = 0 then
    raise exception 'el ajuste requiere al menos un producto' using errcode = '22023';
  end if;

  v_cuenta_ajuste := public._cuenta_config('ajuste_inventario');

  insert into public.ajustes_inventario (fecha, almacen_id, observaciones, total)
  values (v_fecha, v_almacen.id, v_observaciones, 0)
  returning id, numero into v_id, v_numero;

  for v_linea in select * from jsonb_array_elements(v_lineas) loop
    v_producto_id := nullif(v_linea->>'producto_id', '')::uuid;
    if v_producto_id is null then
      raise exception 'cada línea requiere un producto' using errcode = '22023';
    end if;

    select * into v_producto
    from public.productos pr
    where pr.id = v_producto_id
      and pr.activo
    for update;

    if not found then
      raise exception 'producto no encontrado o inactivo' using errcode = '22023';
    end if;

    if not v_producto.inventariable then
      raise exception 'el producto % no controla inventario', v_producto.nombre using errcode = '22023';
    end if;

    v_tipo := lower(coalesce(nullif(v_linea->>'tipo', ''), 'entrada'));
    if v_tipo not in ('entrada', 'salida') then
      raise exception 'el tipo de ajuste debe ser entrada o salida' using errcode = '22023';
    end if;

    v_cantidad := round(coalesce((v_linea->>'cantidad')::numeric, 0), 2);
    if v_cantidad <= 0 then
      raise exception 'la cantidad ajustada debe ser mayor a cero' using errcode = '22023';
    end if;

    v_costo := round(coalesce((v_linea->>'costo_unitario')::numeric, v_producto.costo), 2);
    if v_costo < 0 then
      raise exception 'el costo no puede ser negativo' using errcode = '22023';
    end if;

    v_total_linea := round(v_cantidad * v_costo, 2);
    if v_total_linea <= 0 then
      raise exception 'el costo del ajuste debe ser mayor a cero' using errcode = '22023';
    end if;

    if v_tipo = 'entrada' then
      v_cantidad_nueva := v_producto.cantidad + v_cantidad;
      if v_cantidad_nueva > 0 then
        v_costo_nuevo := round(
          (v_producto.cantidad * v_producto.costo + v_cantidad * v_costo) / v_cantidad_nueva,
          2
        );
      else
        v_costo_nuevo := v_costo;
      end if;
      v_costo_nuevo := greatest(v_costo_nuevo, 0);
    else
      v_cantidad_nueva := v_producto.cantidad - v_cantidad;
      v_costo_nuevo := v_producto.costo;
    end if;

    if v_tipo = 'entrada' then
      perform public._mover_existencia(v_producto.id, v_almacen.id, v_cantidad);
    else
      perform public._mover_existencia(v_producto.id, v_almacen.id, -v_cantidad);
    end if;

    update public.productos pr
    set costo = v_costo_nuevo
    where pr.id = v_producto.id;

    insert into public.ajuste_inventario_lineas (
      ajuste_id, producto_id, tipo, cantidad, costo_unitario, total
    )
    values (
      v_id, v_producto.id, v_tipo, v_cantidad, v_costo, v_total_linea
    );

    v_cuenta_inventario := coalesce(v_producto.cuenta_inventario_id, public._cuenta_config('inventario'));

    if v_tipo = 'entrada' then
      v_asiento_lineas := v_asiento_lineas || jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', v_cuenta_inventario,
          'debito', v_total_linea,
          'credito', 0,
          'descripcion', 'Entrada de inventario: ' || left(v_producto.nombre, 80)
        ),
        jsonb_build_object(
          'cuenta_id', v_cuenta_ajuste,
          'debito', 0,
          'credito', v_total_linea,
          'descripcion', 'Ajuste de inventario: ' || left(v_producto.nombre, 80)
        )
      );
    else
      v_asiento_lineas := v_asiento_lineas || jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', v_cuenta_ajuste,
          'debito', v_total_linea,
          'credito', 0,
          'descripcion', 'Ajuste de inventario: ' || left(v_producto.nombre, 80)
        ),
        jsonb_build_object(
          'cuenta_id', v_cuenta_inventario,
          'debito', 0,
          'credito', v_total_linea,
          'descripcion', 'Salida de inventario: ' || left(v_producto.nombre, 80)
        )
      );
    end if;

    v_total := v_total + v_total_linea;
  end loop;

  v_descripcion := coalesce(v_observaciones, 'Ajuste de inventario #' || v_numero);

  v_asiento_id := public._crear_asiento(
    v_fecha,
    v_descripcion,
    'ajuste_inventario',
    v_id,
    v_asiento_lineas
  );

  update public.ajustes_inventario
  set total = v_total,
      asiento_id = v_asiento_id
  where id = v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Anulación: ajustes de inventario y almacén del documento
-- ---------------------------------------------------------------------------

create or replace function public.anular_documento(p_tipo text, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_factura public.facturas%rowtype;
  v_factura_prov public.facturas_proveedor%rowtype;
  v_nota public.notas_credito_compra%rowtype;
  v_ajuste public.ajustes_inventario%rowtype;
  v_ajuste_linea public.ajuste_inventario_lineas%rowtype;
  v_pago public.pagos_recibidos%rowtype;
  v_pago_prov public.pagos_proveedor%rowtype;
  v_gasto public.gastos_menores%rowtype;
  v_asiento public.asientos%rowtype;
  v_asiento_id uuid;
  v_numero int;
  v_lineas jsonb;
  v_reversion_id uuid;
  v_prod_id uuid;
  v_cantidad numeric(14,2);
  v_costo_linea numeric(14,2);
  v_cantidad_actual numeric(14,2);
  v_costo_actual numeric(14,2);
  v_cantidad_nueva numeric(14,2);
  v_costo_nuevo numeric(14,2);
  v_nuevo_pagado numeric(14,2);
  v_nuevo_credito numeric(14,2);
  v_almacen_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_tipo is null or p_tipo not in (
    'factura', 'pago_recibido', 'factura_proveedor', 'pago_proveedor', 'gasto_menor',
    'nota_credito_compra', 'ajuste_inventario'
  ) then
    raise exception 'tipo de documento inválido' using errcode = '22023';
  end if;

  if p_id is null then
    raise exception 'el documento es obligatorio' using errcode = '22023';
  end if;

  if p_tipo = 'factura' then
    select * into v_factura from public.facturas f where f.id = p_id for update;
    if not found then
      raise exception 'factura no encontrada' using errcode = '22023';
    end if;
    if v_factura.estado = 'anulada' then
      raise exception 'la factura ya está anulada' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.pagos_recibidos pr
      where pr.factura_id = p_id and pr.estado = 'activo'
    ) then
      raise exception 'no se puede anular una factura con pagos activos' using errcode = 'P0001';
    end if;

    v_almacen_id := coalesce(v_factura.almacen_id, public._almacen_principal());

    for v_prod_id, v_cantidad in
      select fl.producto_id, fl.cantidad
      from public.factura_lineas fl
      join public.productos pr on pr.id = fl.producto_id
      where fl.factura_id = p_id and pr.inventariable
    loop
      perform public._mover_existencia(v_prod_id, v_almacen_id, v_cantidad);
    end loop;

    v_asiento_id := v_factura.asiento_id;
    v_numero := v_factura.numero;

    update public.facturas set estado = 'anulada', pagado = 0 where id = p_id;

  elsif p_tipo = 'pago_recibido' then
    select * into v_pago from public.pagos_recibidos pr where pr.id = p_id for update;
    if not found then
      raise exception 'pago no encontrado' using errcode = '22023';
    end if;
    if v_pago.estado = 'anulado' then
      raise exception 'el pago ya está anulado' using errcode = '22023';
    end if;

    v_asiento_id := v_pago.asiento_id;
    v_numero := v_pago.numero;

    update public.pagos_recibidos set estado = 'anulado' where id = p_id;

    if v_pago.factura_id is not null then
      select * into v_factura from public.facturas f where f.id = v_pago.factura_id for update;
      if found and v_factura.estado <> 'anulada' then
        v_nuevo_pagado := round(greatest(v_factura.pagado - v_pago.monto, 0), 2);
        update public.facturas
        set pagado = v_nuevo_pagado,
            estado = case when v_nuevo_pagado >= v_factura.total then 'pagada' else 'abierta' end
        where id = v_factura.id;
      end if;
    end if;

  elsif p_tipo = 'factura_proveedor' then
    select * into v_factura_prov from public.facturas_proveedor fp where fp.id = p_id for update;
    if not found then
      raise exception 'factura de proveedor no encontrada' using errcode = '22023';
    end if;
    if v_factura_prov.estado = 'anulada' then
      raise exception 'la factura de proveedor ya está anulada' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.pagos_proveedor pp
      where pp.factura_proveedor_id = p_id and pp.estado = 'activo'
    ) then
      raise exception 'no se puede anular una factura de proveedor con pagos activos' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.notas_credito_compra nc
      where nc.factura_proveedor_id = p_id and nc.estado = 'activa'
    ) then
      raise exception 'no se puede anular una factura de proveedor con notas de crédito activas' using errcode = 'P0001';
    end if;

    v_almacen_id := coalesce(v_factura_prov.almacen_id, public._almacen_principal());

    for v_prod_id, v_cantidad, v_costo_linea in
      select fpl.producto_id, fpl.cantidad, fpl.costo
      from public.facturas_proveedor_lineas fpl
      join public.productos pr on pr.id = fpl.producto_id
      where fpl.factura_proveedor_id = p_id and pr.inventariable
      order by fpl.id
    loop
      select pr.cantidad, pr.costo
      into v_cantidad_actual, v_costo_actual
      from public.productos pr
      where pr.id = v_prod_id
      for update;

      v_cantidad_nueva := v_cantidad_actual - v_cantidad;

      if v_cantidad_nueva > 0 then
        v_costo_nuevo := round(
          greatest(v_cantidad_actual * v_costo_actual - v_cantidad * v_costo_linea, 0)
          / v_cantidad_nueva,
          2
        );
      elsif v_cantidad_nueva = 0 then
        v_costo_nuevo := 0;
      else
        v_costo_nuevo := v_costo_actual;
      end if;

      perform public._mover_existencia(v_prod_id, v_almacen_id, -v_cantidad);

      update public.productos
      set costo = v_costo_nuevo
      where id = v_prod_id;
    end loop;

    v_asiento_id := v_factura_prov.asiento_id;
    v_numero := v_factura_prov.numero;

    update public.facturas_proveedor set estado = 'anulada', pagado = 0, credito = 0 where id = p_id;

  elsif p_tipo = 'pago_proveedor' then
    select * into v_pago_prov from public.pagos_proveedor pp where pp.id = p_id for update;
    if not found then
      raise exception 'pago a proveedor no encontrado' using errcode = '22023';
    end if;
    if v_pago_prov.estado = 'anulado' then
      raise exception 'el pago a proveedor ya está anulado' using errcode = '22023';
    end if;

    v_asiento_id := v_pago_prov.asiento_id;
    v_numero := v_pago_prov.numero;

    update public.pagos_proveedor set estado = 'anulado' where id = p_id;

    select * into v_factura_prov
    from public.facturas_proveedor fp
    where fp.id = v_pago_prov.factura_proveedor_id
    for update;

    if found and v_factura_prov.estado <> 'anulada' then
      v_nuevo_pagado := round(greatest(v_factura_prov.pagado - v_pago_prov.monto, 0), 2);
      update public.facturas_proveedor
      set pagado = v_nuevo_pagado,
          estado = case
            when round(v_nuevo_pagado + v_factura_prov.credito, 2) >= v_factura_prov.total then 'pagada'
            else 'abierta'
          end
      where id = v_factura_prov.id;
    end if;

  elsif p_tipo = 'ajuste_inventario' then
    select * into v_ajuste from public.ajustes_inventario ai where ai.id = p_id for update;
    if not found then
      raise exception 'ajuste de inventario no encontrado' using errcode = '22023';
    end if;
    if v_ajuste.estado = 'anulada' then
      raise exception 'el ajuste de inventario ya está anulado' using errcode = '22023';
    end if;

    for v_ajuste_linea in
      select * from public.ajuste_inventario_lineas ail
      where ail.ajuste_id = p_id
      order by ail.id
    loop
      if v_ajuste_linea.tipo = 'entrada' then
        perform public._mover_existencia(v_ajuste_linea.producto_id, v_ajuste.almacen_id, -v_ajuste_linea.cantidad);
      else
        perform public._mover_existencia(v_ajuste_linea.producto_id, v_ajuste.almacen_id, v_ajuste_linea.cantidad);
      end if;
    end loop;

    v_asiento_id := v_ajuste.asiento_id;
    v_numero := v_ajuste.numero;

    update public.ajustes_inventario set estado = 'anulada' where id = p_id;

  elsif p_tipo = 'nota_credito_compra' then
    select * into v_nota from public.notas_credito_compra nc where nc.id = p_id for update;
    if not found then
      raise exception 'nota de crédito de compra no encontrada' using errcode = '22023';
    end if;
    if v_nota.estado = 'anulada' then
      raise exception 'la nota de crédito ya está anulada' using errcode = '22023';
    end if;

    if v_nota.devuelve_inventario then
      v_almacen_id := coalesce(v_nota.almacen_id, public._almacen_principal());

      for v_prod_id, v_cantidad, v_costo_linea in
        select nl.producto_id, nl.cantidad, nl.costo
        from public.nota_credito_compra_lineas nl
        join public.productos pr on pr.id = nl.producto_id
        where nl.nota_id = p_id and pr.inventariable
        order by nl.id
      loop
        select pr.cantidad, pr.costo
        into v_cantidad_actual, v_costo_actual
        from public.productos pr
        where pr.id = v_prod_id
        for update;

        v_cantidad_nueva := v_cantidad_actual + v_cantidad;
        v_costo_nuevo := round(
          (v_cantidad_actual * v_costo_actual + v_cantidad * v_costo_linea) / v_cantidad_nueva,
          2
        );

        perform public._mover_existencia(v_prod_id, v_almacen_id, v_cantidad);

        update public.productos
        set costo = v_costo_nuevo
        where id = v_prod_id;
      end loop;
    end if;

    select * into v_factura_prov
    from public.facturas_proveedor fp
    where fp.id = v_nota.factura_proveedor_id
    for update;

    if found and v_factura_prov.estado <> 'anulada' then
      v_nuevo_credito := round(greatest(v_factura_prov.credito - v_nota.total, 0), 2);
      update public.facturas_proveedor
      set credito = v_nuevo_credito,
          estado = case
            when round(v_factura_prov.pagado + v_nuevo_credito, 2) >= v_factura_prov.total then 'pagada'
            else 'abierta'
          end
      where id = v_factura_prov.id;
    end if;

    v_asiento_id := v_nota.asiento_id;
    v_numero := v_nota.numero;

    update public.notas_credito_compra set estado = 'anulada' where id = p_id;

  else
    select * into v_gasto from public.gastos_menores gm where gm.id = p_id for update;
    if not found then
      raise exception 'gasto menor no encontrado' using errcode = '22023';
    end if;
    if v_gasto.estado = 'anulado' then
      raise exception 'el gasto menor ya está anulado' using errcode = '22023';
    end if;

    v_asiento_id := v_gasto.asiento_id;
    v_numero := v_gasto.numero;

    update public.gastos_menores set estado = 'anulado' where id = p_id;
  end if;

  if v_asiento_id is null then
    raise exception 'el documento no tiene asiento contable' using errcode = '22023';
  end if;

  select * into v_asiento from public.asientos a where a.id = v_asiento_id;
  if not found then
    raise exception 'asiento no encontrado' using errcode = '22023';
  end if;
  if exists (select 1 from public.asientos a where a.anula_asiento_id = v_asiento_id) then
    raise exception 'el asiento del documento ya fue anulado' using errcode = '22023';
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
  where l.asiento_id = v_asiento_id;

  if v_lineas is null or jsonb_array_length(v_lineas) < 2 then
    raise exception 'el asiento no tiene líneas para revertir' using errcode = '22023';
  end if;

  v_reversion_id := public._crear_asiento(
    current_date,
    'Anulación ' || p_tipo || ' #' || coalesce(v_numero::text, ''),
    'anulacion',
    p_id,
    v_lineas
  );

  update public.asientos set anula_asiento_id = v_asiento_id where id = v_reversion_id;

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
    'existencias',
    'listas_precios',
    'producto_precios'
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

revoke all on function public._almacen_principal() from public, anon, authenticated;
revoke all on function public._sumar_existencia(uuid, uuid, numeric) from public, anon, authenticated;
revoke all on function public._mover_existencia(uuid, uuid, numeric) from public, anon, authenticated;

revoke all on function public.crear_lista_precio(jsonb) from public, anon, authenticated;
revoke all on function public.actualizar_lista_precio(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.crear_producto(jsonb) from public, anon, authenticated;
revoke all on function public.actualizar_producto(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.crear_contacto(jsonb) from public, anon, authenticated;
revoke all on function public.actualizar_contacto(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.crear_factura(jsonb) from public, anon, authenticated;
revoke all on function public.crear_factura_proveedor(jsonb) from public, anon, authenticated;
revoke all on function public.crear_nota_credito_venta(jsonb) from public, anon, authenticated;
revoke all on function public.crear_nota_credito_compra(jsonb) from public, anon, authenticated;
revoke all on function public.crear_ajuste_inventario(jsonb) from public, anon, authenticated;
revoke all on function public.anular_documento(text, uuid) from public, anon, authenticated;

grant execute on function public.crear_lista_precio(jsonb) to authenticated;
grant execute on function public.actualizar_lista_precio(uuid, jsonb) to authenticated;
grant execute on function public.crear_producto(jsonb) to authenticated;
grant execute on function public.actualizar_producto(uuid, jsonb) to authenticated;
grant execute on function public.crear_contacto(jsonb) to authenticated;
grant execute on function public.actualizar_contacto(uuid, jsonb) to authenticated;
grant execute on function public.crear_factura(jsonb) to authenticated;
grant execute on function public.crear_factura_proveedor(jsonb) to authenticated;
grant execute on function public.crear_nota_credito_venta(jsonb) to authenticated;
grant execute on function public.crear_nota_credito_compra(jsonb) to authenticated;
grant execute on function public.crear_ajuste_inventario(jsonb) to authenticated;
grant execute on function public.anular_documento(text, uuid) to authenticated;

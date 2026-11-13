-- ---------------------------------------------------------------------------
-- Inventario: almacenes, categorías de productos y ajustes de inventario.
--
-- · almacenes: al menos el "Principal" (sembrado). Los ajustes eligen almacén.
-- · categorias_productos: categoría opcional del producto (categoria_id).
-- · ajustes_inventario + ajuste_inventario_lineas: entrada o salida por producto
--   con su costo; crea asiento y actualiza cantidad y costo promedio.
--
-- Asiento del ajuste (cuenta nueva "Ajustes de inventario", config
-- `ajuste_inventario`):
--   entrada: Dr inventario / Cr ajustes de inventario
--   salida:  Dr ajustes de inventario / Cr inventario
--
-- Migración aditiva: no borra ni cambia datos existentes. RLS activo; las
-- escrituras van solo por RPC (admin o contador).
-- ---------------------------------------------------------------------------

-- Origen de asiento nuevo (se conserva la lista completa anterior).
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
    'ajuste_inventario'
  ));

-- Cuenta y configuración del ajuste de inventario (aditivo y reintentable).
insert into public.cuentas (codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos)
select '5102', 'Ajustes de inventario', 'costo', 'debito', p.id, true
from public.cuentas p
where p.codigo = '5'
on conflict (codigo) do nothing;

insert into public.config_contable (clave, cuenta_id)
select 'ajuste_inventario', c.id
from public.cuentas c
where c.codigo = '5102'
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists public.almacenes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  es_principal boolean not null default false,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create unique index if not exists almacenes_nombre_unico on public.almacenes (lower(nombre));
create unique index if not exists almacenes_un_principal on public.almacenes (es_principal) where es_principal;

insert into public.almacenes (nombre, es_principal)
select 'Principal', true
where not exists (select 1 from public.almacenes where es_principal);

create table if not exists public.categorias_productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create unique index if not exists categorias_productos_nombre_unico on public.categorias_productos (lower(nombre));

alter table public.productos
  add column if not exists categoria_id uuid references public.categorias_productos (id);

create index if not exists productos_categoria_id_idx on public.productos (categoria_id);

create sequence if not exists public.ajustes_inventario_numero_seq;

create table if not exists public.ajustes_inventario (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique default nextval('public.ajustes_inventario_numero_seq'),
  fecha date not null default current_date,
  almacen_id uuid not null references public.almacenes (id),
  total numeric(14,2) not null default 0,
  observaciones text,
  asiento_id uuid references public.asientos (id),
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now()
);

create index if not exists ajustes_inventario_fecha_idx on public.ajustes_inventario (fecha);
create index if not exists ajustes_inventario_almacen_id_idx on public.ajustes_inventario (almacen_id);
create index if not exists ajustes_inventario_asiento_id_idx on public.ajustes_inventario (asiento_id);

create table if not exists public.ajuste_inventario_lineas (
  id uuid primary key default gen_random_uuid(),
  ajuste_id uuid not null references public.ajustes_inventario (id) on delete cascade,
  producto_id uuid not null references public.productos (id),
  tipo text not null check (tipo in ('entrada', 'salida')),
  cantidad numeric(14,2) not null check (cantidad > 0),
  costo_unitario numeric(14,2) not null default 0 check (costo_unitario >= 0),
  total numeric(14,2) not null default 0
);

create index if not exists ajuste_inventario_lineas_ajuste_id_idx
  on public.ajuste_inventario_lineas (ajuste_id);
create index if not exists ajuste_inventario_lineas_producto_id_idx
  on public.ajuste_inventario_lineas (producto_id);

-- ---------------------------------------------------------------------------
-- Almacenes (RPC)
-- ---------------------------------------------------------------------------

create or replace function public.crear_almacen(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_nombre text;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del almacén requeridos' using errcode = '22023';
  end if;

  v_nombre := trim(coalesce(p->>'nombre', ''));
  if v_nombre = '' then
    raise exception 'el nombre del almacén es obligatorio' using errcode = '22023';
  end if;

  if exists (select 1 from public.almacenes a where lower(a.nombre) = lower(v_nombre)) then
    raise exception 'ya existe un almacén con ese nombre' using errcode = '22023';
  end if;

  insert into public.almacenes (nombre, es_principal, activo)
  values (v_nombre, false, coalesce((p->>'activo')::boolean, true))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.actualizar_almacen(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_nombre text;
  v_activo boolean;
  v_principal boolean;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del almacén requeridos' using errcode = '22023';
  end if;

  select a.es_principal into v_principal from public.almacenes a where a.id = p_id;
  if v_principal is null then
    raise exception 'almacén no encontrado' using errcode = '22023';
  end if;

  v_nombre := trim(coalesce(p->>'nombre', ''));
  if p ? 'nombre' then
    if v_nombre = '' then
      raise exception 'el nombre del almacén es obligatorio' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.almacenes a
      where lower(a.nombre) = lower(v_nombre)
        and a.id <> p_id
    ) then
      raise exception 'ya existe un almacén con ese nombre' using errcode = '22023';
    end if;
  end if;

  v_activo := coalesce((p->>'activo')::boolean, true);
  if v_principal and p ? 'activo' and not v_activo then
    raise exception 'el almacén principal no se puede desactivar' using errcode = '22023';
  end if;

  update public.almacenes a
  set
    nombre = case when p ? 'nombre' then v_nombre else a.nombre end,
    activo = case when p ? 'activo' then v_activo else a.activo end
  where a.id = p_id
  returning a.id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Categorías de productos (RPC)
-- ---------------------------------------------------------------------------

create or replace function public.crear_categoria_producto(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_nombre text;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la categoría requeridos' using errcode = '22023';
  end if;

  v_nombre := trim(coalesce(p->>'nombre', ''));
  if v_nombre = '' then
    raise exception 'el nombre de la categoría es obligatorio' using errcode = '22023';
  end if;

  if exists (select 1 from public.categorias_productos c where lower(c.nombre) = lower(v_nombre)) then
    raise exception 'ya existe una categoría con ese nombre' using errcode = '22023';
  end if;

  insert into public.categorias_productos (nombre, descripcion, activo)
  values (
    v_nombre,
    nullif(trim(coalesce(p->>'descripcion', '')), ''),
    coalesce((p->>'activo')::boolean, true)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.actualizar_categoria_producto(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_nombre text;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la categoría requeridos' using errcode = '22023';
  end if;

  if not exists (select 1 from public.categorias_productos c where c.id = p_id) then
    raise exception 'categoría no encontrada' using errcode = '22023';
  end if;

  if p ? 'nombre' then
    v_nombre := trim(coalesce(p->>'nombre', ''));
    if v_nombre = '' then
      raise exception 'el nombre de la categoría es obligatorio' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.categorias_productos c
      where lower(c.nombre) = lower(v_nombre)
        and c.id <> p_id
    ) then
      raise exception 'ya existe una categoría con ese nombre' using errcode = '22023';
    end if;
  end if;

  update public.categorias_productos c
  set
    nombre = case when p ? 'nombre' then v_nombre else c.nombre end,
    descripcion = case when p ? 'descripcion' then nullif(trim(coalesce(p->>'descripcion', '')), '') else c.descripcion end,
    activo = case when p ? 'activo' then (p->>'activo')::boolean else c.activo end
  where c.id = p_id
  returning c.id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ajuste de inventario
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

    update public.productos pr
    set cantidad = v_cantidad_nueva,
        costo = v_costo_nuevo
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
-- Productos: crear y actualizar con categoría opcional
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
    coalesce((p->>'inventariable')::boolean, false),
    round(coalesce((p->>'cantidad')::numeric, 0), 2),
    round(coalesce((p->>'costo')::numeric, 0), 2),
    v_categoria_id,
    nullif(p->>'cuenta_ingreso_id', '')::uuid,
    nullif(p->>'cuenta_costo_id', '')::uuid,
    nullif(p->>'cuenta_inventario_id', '')::uuid,
    coalesce((p->>'activo')::boolean, true)
  )
  returning id into v_id;

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

  update public.productos pr
  set
    tipo = case when p ? 'tipo' then v_tipo else pr.tipo end,
    nombre = case when p ? 'nombre' then p->>'nombre' else pr.nombre end,
    referencia = case when p ? 'referencia' then p->>'referencia' else pr.referencia end,
    descripcion = case when p ? 'descripcion' then p->>'descripcion' else pr.descripcion end,
    precio = case when p ? 'precio' then round((p->>'precio')::numeric, 2) else pr.precio end,
    itbis_tasa = case when p ? 'itbis_tasa' then v_itbis else pr.itbis_tasa end,
    inventariable = case when p ? 'inventariable' then (p->>'inventariable')::boolean else pr.inventariable end,
    cantidad = case when p ? 'cantidad' then round((p->>'cantidad')::numeric, 2) else pr.cantidad end,
    costo = case when p ? 'costo' then round((p->>'costo')::numeric, 2) else pr.costo end,
    categoria_id = case when p ? 'categoria_id' then v_categoria_id else pr.categoria_id end,
    cuenta_ingreso_id = case when p ? 'cuenta_ingreso_id' then nullif(p->>'cuenta_ingreso_id', '')::uuid else pr.cuenta_ingreso_id end,
    cuenta_costo_id = case when p ? 'cuenta_costo_id' then nullif(p->>'cuenta_costo_id', '')::uuid else pr.cuenta_costo_id end,
    cuenta_inventario_id = case when p ? 'cuenta_inventario_id' then nullif(p->>'cuenta_inventario_id', '')::uuid else pr.cuenta_inventario_id end,
    activo = case when p ? 'activo' then (p->>'activo')::boolean else pr.activo end
  where pr.id = p_id
  returning pr.id into v_id;

  if v_id is null then
    raise exception 'producto no encontrado' using errcode = '22023';
  end if;

  return v_id;
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
    'almacenes',
    'categorias_productos',
    'ajustes_inventario',
    'ajuste_inventario_lineas'
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

revoke all on sequence public.ajustes_inventario_numero_seq from anon, authenticated;

revoke all on function public.crear_almacen(jsonb) from public, anon, authenticated;
revoke all on function public.actualizar_almacen(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.crear_categoria_producto(jsonb) from public, anon, authenticated;
revoke all on function public.actualizar_categoria_producto(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.crear_ajuste_inventario(jsonb) from public, anon, authenticated;

grant execute on function public.crear_almacen(jsonb) to authenticated;
grant execute on function public.actualizar_almacen(uuid, jsonb) to authenticated;
grant execute on function public.crear_categoria_producto(jsonb) to authenticated;
grant execute on function public.actualizar_categoria_producto(uuid, jsonb) to authenticated;
grant execute on function public.crear_ajuste_inventario(jsonb) to authenticated;

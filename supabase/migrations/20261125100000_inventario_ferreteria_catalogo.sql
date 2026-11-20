-- ---------------------------------------------------------------------------
-- Inventario nivel ferretería (fase 1A): catálogo, códigos de barra,
-- unidades de medida, combos, conteo físico y lecturas rápidas para el POS.
--
-- Solo agrega columnas, tablas, índices, políticas y RPC. No borra ni cambia
-- datos existentes. Todo es reintentable (`if not exists` / `create or
-- replace`). El motor de venta/compra que usa estos datos vive en
-- 20261125101000_inventario_ferreteria_motor.sql.
--
-- Contrato funcional: docs/dominio-inventario-ferreteria.md
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Búsqueda por trigrama
-- ---------------------------------------------------------------------------

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Productos y existencias: marca, favorito del POS y ubicación física
-- ---------------------------------------------------------------------------

alter table public.productos
  add column if not exists marca text,
  add column if not exists favorito_pos boolean not null default false,
  add column if not exists ubicacion text;

alter table public.existencias
  add column if not exists ubicacion text;

create index if not exists productos_nombre_trgm_idx
  on public.productos using gin (nombre extensions.gin_trgm_ops);
create index if not exists productos_referencia_trgm_idx
  on public.productos using gin (referencia extensions.gin_trgm_ops);
create index if not exists productos_marca_trgm_idx
  on public.productos using gin (marca extensions.gin_trgm_ops);
create index if not exists productos_activo_favorito_categoria_idx
  on public.productos (activo, favorito_pos, categoria_id);

-- Kardex instantáneo: índice por producto en las líneas que mueven stock.
-- El de ajuste_inventario_lineas ya existe desde 20261114500000; el
-- `if not exists` lo deja intacto.
create index if not exists factura_lineas_producto_id_idx
  on public.factura_lineas (producto_id);
create index if not exists facturas_proveedor_lineas_producto_id_idx
  on public.facturas_proveedor_lineas (producto_id);
create index if not exists ajuste_inventario_lineas_producto_id_idx
  on public.ajuste_inventario_lineas (producto_id);

-- ---------------------------------------------------------------------------
-- Unidades de medida por producto (conversión a la unidad base)
-- ---------------------------------------------------------------------------

create table if not exists public.producto_unidades (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos (id) on delete cascade,
  nombre text not null,
  factor_base numeric(14,4) not null check (factor_base > 0),
  precio numeric(14,2) check (precio is null or precio >= 0),
  es_compra boolean not null default false,
  es_venta boolean not null default true,
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);

create unique index if not exists producto_unidades_nombre_unico
  on public.producto_unidades (producto_id, lower(nombre));
create index if not exists producto_unidades_producto_id_idx
  on public.producto_unidades (producto_id);

-- ---------------------------------------------------------------------------
-- Códigos de barra: EAN/UPC de fabricante, SKU interno o código por empaque
-- ---------------------------------------------------------------------------

create table if not exists public.producto_codigos_barra (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos (id) on delete cascade,
  unidad_id uuid references public.producto_unidades (id),
  codigo text not null,
  principal boolean not null default false,
  creado_en timestamptz not null default now()
);

create unique index if not exists producto_codigos_barra_codigo_unico
  on public.producto_codigos_barra (lower(trim(codigo)));
create unique index if not exists producto_codigos_barra_un_principal
  on public.producto_codigos_barra (producto_id) where principal;
create index if not exists producto_codigos_barra_producto_id_idx
  on public.producto_codigos_barra (producto_id);
create index if not exists producto_codigos_barra_unidad_id_idx
  on public.producto_codigos_barra (unidad_id);

-- ---------------------------------------------------------------------------
-- Combos: componentes reales (no combos anidados)
-- ---------------------------------------------------------------------------

create table if not exists public.combo_componentes (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references public.productos (id) on delete cascade,
  componente_id uuid not null references public.productos (id),
  cantidad numeric(14,2) not null check (cantidad > 0),
  unique (combo_id, componente_id),
  check (combo_id <> componente_id)
);

create index if not exists combo_componentes_componente_id_idx
  on public.combo_componentes (componente_id);

-- ---------------------------------------------------------------------------
-- Conteo físico de inventario
-- ---------------------------------------------------------------------------

create sequence if not exists public.conteos_inventario_numero_seq;

create table if not exists public.conteos_inventario (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique default nextval('public.conteos_inventario_numero_seq'),
  almacen_id uuid not null references public.almacenes (id),
  fecha date not null default current_date,
  estado text not null default 'borrador' check (estado in ('borrador', 'aplicado', 'anulado')),
  ajuste_id uuid references public.ajustes_inventario (id),
  notas text,
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now()
);

create index if not exists conteos_inventario_almacen_id_idx
  on public.conteos_inventario (almacen_id);
create index if not exists conteos_inventario_fecha_idx
  on public.conteos_inventario (fecha);
create index if not exists conteos_inventario_ajuste_id_idx
  on public.conteos_inventario (ajuste_id);

create table if not exists public.conteo_inventario_lineas (
  id uuid primary key default gen_random_uuid(),
  conteo_id uuid not null references public.conteos_inventario (id) on delete cascade,
  producto_id uuid not null references public.productos (id),
  cantidad_sistema numeric(14,2) not null default 0,
  cantidad_contada numeric(14,2) not null check (cantidad_contada >= 0),
  diferencia numeric(14,2) not null default 0,
  notas text,
  unique (conteo_id, producto_id)
);

create index if not exists conteo_inventario_lineas_conteo_id_idx
  on public.conteo_inventario_lineas (conteo_id);
create index if not exists conteo_inventario_lineas_producto_id_idx
  on public.conteo_inventario_lineas (producto_id);

-- ---------------------------------------------------------------------------
-- Columnas de unidad en las líneas de documento
-- ---------------------------------------------------------------------------

alter table public.factura_lineas
  add column if not exists unidad_id uuid references public.producto_unidades (id),
  add column if not exists unidad_nombre text,
  add column if not exists factor_base numeric(14,4) not null default 1;

alter table public.cotizacion_lineas
  add column if not exists unidad_id uuid references public.producto_unidades (id),
  add column if not exists unidad_nombre text,
  add column if not exists factor_base numeric(14,4) not null default 1;

alter table public.nota_credito_venta_lineas
  add column if not exists unidad_id uuid references public.producto_unidades (id),
  add column if not exists unidad_nombre text,
  add column if not exists factor_base numeric(14,4) not null default 1;

alter table public.facturas_proveedor_lineas
  add column if not exists unidad_id uuid references public.producto_unidades (id),
  add column if not exists unidad_nombre text,
  add column if not exists factor_base numeric(14,4) not null default 1;

do $$
declare
  v_tabla text;
begin
  foreach v_tabla in array array[
    'factura_lineas',
    'cotizacion_lineas',
    'nota_credito_venta_lineas',
    'facturas_proveedor_lineas'
  ] loop
    if not exists (
      select 1
      from pg_constraint
      where conrelid = format('public.%I', v_tabla)::regclass
        and conname = v_tabla || '_factor_base_check'
    ) then
      execute format(
        'alter table public.%I add constraint %I check (factor_base > 0)',
        v_tabla,
        v_tabla || '_factor_base_check'
      );
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Internas de lectura: precio por lista y disponibilidad de un combo
--
-- Son security invoker: las llaman las lecturas del POS, que también son
-- invoker y respetan RLS. No usan _almacen_principal() porque esa función
-- está revocada para authenticated.
-- ---------------------------------------------------------------------------

create or replace function public._precio_lista(
  p_producto_id uuid,
  p_precio_base numeric,
  p_lista_id uuid
)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when lp.id is null then round(coalesce(p_precio_base, 0), 2)
    when pp.producto_id is null then round(coalesce(p_precio_base, 0), 2)
    when lp.tipo = 'fijo' then greatest(round(pp.precio, 2), 0)
    else greatest(round(coalesce(p_precio_base, 0) * (1 + pp.precio / 100), 2), 0)
  end
  from (select 1) as base
  left join public.listas_precios lp
    on lp.id = p_lista_id and lp.activo
  left join public.producto_precios pp
    on pp.producto_id = p_producto_id and pp.lista_id = lp.id;
$$;

create or replace function public._disponibilidad_combo(
  p_combo_id uuid,
  p_almacen_id uuid
)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select min(floor(coalesce(e.cantidad, 0) / cc.cantidad))
  from public.combo_componentes cc
  join public.productos pr on pr.id = cc.componente_id
  left join public.existencias e
    on e.producto_id = cc.componente_id and e.almacen_id = p_almacen_id
  where cc.combo_id = p_combo_id
    and pr.activo
    and pr.inventariable
    and not pr.vende_negativo;
$$;

-- ---------------------------------------------------------------------------
-- POS: búsqueda exacta por código de barra
-- ---------------------------------------------------------------------------

create or replace function public.pos_buscar_por_codigo_barra(
  p_codigo text,
  p_almacen_id uuid default null,
  p_lista_precio_id uuid default null
)
returns table (
  producto_id uuid,
  nombre text,
  referencia text,
  marca text,
  tipo text,
  unidad_id uuid,
  unidad_nombre text,
  factor_base numeric,
  precio numeric,
  itbis_tasa numeric,
  stock numeric,
  disponible numeric,
  imagen_path text,
  favorito_pos boolean,
  codigo text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with almacen as (
    select coalesce(
      p_almacen_id,
      (select a.id from public.almacenes a where a.activo order by a.es_principal desc, a.creado_en limit 1)
    ) as id
  )
  select
    pr.id,
    pr.nombre,
    pr.referencia,
    pr.marca,
    pr.tipo,
    cb.unidad_id,
    coalesce(pu.nombre, pr.unidad_medida),
    coalesce(pu.factor_base, 1),
    coalesce(
      pu.precio,
      round(public._precio_lista(pr.id, pr.precio, p_lista_precio_id) * coalesce(pu.factor_base, 1), 2)
    ),
    pr.itbis_tasa,
    coalesce(e.cantidad, 0),
    case
      when pr.tipo = 'combo' then public._disponibilidad_combo(pr.id, (select id from almacen))
      else coalesce(e.cantidad, 0)
    end,
    pr.imagen_path,
    pr.favorito_pos,
    cb.codigo
  from public.producto_codigos_barra cb
  join public.productos pr on pr.id = cb.producto_id
  left join public.producto_unidades pu
    on pu.id = cb.unidad_id and pu.producto_id = pr.id
  left join public.existencias e
    on e.producto_id = pr.id and e.almacen_id = (select id from almacen)
  where pr.activo
    and lower(btrim(cb.codigo)) = lower(btrim(p_codigo))
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- POS: catálogo paginado en una sola consulta
-- ---------------------------------------------------------------------------

create or replace function public.pos_catalogo_productos(
  p_almacen_id uuid default null,
  p_lista_precio_id uuid default null,
  p_busqueda text default null,
  p_categoria_id uuid default null,
  p_solo_favoritos boolean default false,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  producto_id uuid,
  nombre text,
  referencia text,
  marca text,
  tipo text,
  categoria_id uuid,
  favorito_pos boolean,
  imagen_path text,
  unidad_medida text,
  precio numeric,
  itbis_tasa numeric,
  stock numeric,
  disponible numeric,
  unidades jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with almacen as (
    select coalesce(
      p_almacen_id,
      (select a.id from public.almacenes a where a.activo order by a.es_principal desc, a.creado_en limit 1)
    ) as id
  )
  select
    pr.id,
    pr.nombre,
    pr.referencia,
    pr.marca,
    pr.tipo,
    pr.categoria_id,
    pr.favorito_pos,
    pr.imagen_path,
    pr.unidad_medida,
    public._precio_lista(pr.id, pr.precio, p_lista_precio_id),
    pr.itbis_tasa,
    coalesce(e.cantidad, 0),
    case
      when pr.tipo = 'combo' then public._disponibilidad_combo(pr.id, (select id from almacen))
      else coalesce(e.cantidad, 0)
    end,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pu.id,
        'nombre', pu.nombre,
        'factor_base', pu.factor_base,
        'precio', coalesce(
          pu.precio,
          round(public._precio_lista(pr.id, pr.precio, p_lista_precio_id) * pu.factor_base, 2)
        )
      ) order by pu.factor_base, pu.nombre)
      from public.producto_unidades pu
      where pu.producto_id = pr.id
        and pu.activa
        and pu.es_venta
    ), '[]'::jsonb)
  from public.productos pr
  left join public.existencias e
    on e.producto_id = pr.id and e.almacen_id = (select id from almacen)
  where pr.activo
    and pr.tipo in ('producto', 'servicio', 'combo')
    and (p_categoria_id is null or pr.categoria_id = p_categoria_id)
    and (not coalesce(p_solo_favoritos, false) or pr.favorito_pos)
    and (
      coalesce(btrim(p_busqueda), '') = ''
      or pr.nombre ilike '%' || btrim(p_busqueda) || '%'
      or coalesce(pr.referencia, '') ilike '%' || btrim(p_busqueda) || '%'
      or coalesce(pr.marca, '') ilike '%' || btrim(p_busqueda) || '%'
      or exists (
        select 1
        from public.producto_codigos_barra cb
        where cb.producto_id = pr.id
          and cb.codigo ilike '%' || btrim(p_busqueda) || '%'
      )
    )
  order by pr.favorito_pos desc, pr.nombre
  limit greatest(1, least(coalesce(p_limit, 50), 200))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- ---------------------------------------------------------------------------
-- Reporte de stock bajo por almacén
-- ---------------------------------------------------------------------------

create or replace function public.reporte_stock_bajo(p_almacen_id uuid default null)
returns table (
  producto_id uuid,
  nombre text,
  referencia text,
  marca text,
  ubicacion text,
  almacen_id uuid,
  cantidad numeric,
  minimo numeric,
  maximo numeric,
  faltante numeric,
  sugerido numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with almacen as (
    select coalesce(
      p_almacen_id,
      (select a.id from public.almacenes a where a.activo order by a.es_principal desc, a.creado_en limit 1)
    ) as id
  )
  select
    pr.id,
    pr.nombre,
    pr.referencia,
    pr.marca,
    coalesce(e.ubicacion, pr.ubicacion),
    (select id from almacen),
    coalesce(e.cantidad, 0),
    coalesce(e.minimo, 0),
    e.maximo,
    round(greatest(coalesce(e.minimo, 0) - coalesce(e.cantidad, 0), 0), 2),
    round(greatest(coalesce(e.maximo, coalesce(e.minimo, 0)) - coalesce(e.cantidad, 0), 0), 2)
  from public.productos pr
  left join public.existencias e
    on e.producto_id = pr.id and e.almacen_id = (select id from almacen)
  where pr.activo
    and pr.inventariable
    and (
      (coalesce(e.minimo, 0) > 0 and coalesce(e.cantidad, 0) <= coalesce(e.minimo, 0))
      or coalesce(e.cantidad, 0) < 0
    )
  order by (coalesce(e.cantidad, 0) - coalesce(e.minimo, 0)) asc, pr.nombre;
$$;

-- ---------------------------------------------------------------------------
-- Conteo físico: RPC
-- ---------------------------------------------------------------------------

create or replace function public.crear_conteo_inventario(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_almacen_id uuid;
  v_lineas jsonb;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del conteo requeridos' using errcode = '22023';
  end if;

  v_almacen_id := nullif(p->>'almacen_id', '')::uuid;
  if v_almacen_id is null then
    raise exception 'selecciona el almacén del conteo' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.almacenes a where a.id = v_almacen_id and a.activo
  ) then
    raise exception 'almacén no encontrado o inactivo' using errcode = '22023';
  end if;

  insert into public.conteos_inventario (almacen_id, fecha, notas)
  values (
    v_almacen_id,
    coalesce((p->>'fecha')::date, current_date),
    nullif(trim(coalesce(p->>'notas', '')), '')
  )
  returning id into v_id;

  v_lineas := p->'lineas';
  if v_lineas is not null and jsonb_typeof(v_lineas) = 'array' then
    perform public.guardar_lineas_conteo(v_id, jsonb_build_object('lineas', v_lineas));
  end if;

  return v_id;
end;
$$;

create or replace function public.guardar_lineas_conteo(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_conteo public.conteos_inventario%rowtype;
  v_lineas jsonb;
  v_linea jsonb;
  v_producto_id uuid;
  v_cantidad numeric(14,2);
  v_sistema numeric(14,2);
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_id is null then
    raise exception 'el conteo es obligatorio' using errcode = '22023';
  end if;

  select * into v_conteo
  from public.conteos_inventario c
  where c.id = p_id
  for update;

  if not found then
    raise exception 'conteo de inventario no encontrado' using errcode = '22023';
  end if;
  if v_conteo.estado <> 'borrador' then
    raise exception 'solo se pueden editar las líneas de un conteo en borrador' using errcode = '22023';
  end if;

  if p is null or jsonb_typeof(p->'lineas') <> 'array' then
    raise exception 'las líneas del conteo deben ser una lista' using errcode = '22023';
  end if;

  delete from public.conteo_inventario_lineas cl where cl.conteo_id = p_id;

  for v_linea in select * from jsonb_array_elements(p->'lineas') loop
    v_producto_id := nullif(v_linea->>'producto_id', '')::uuid;
    if v_producto_id is null then
      raise exception 'cada línea requiere un producto' using errcode = '22023';
    end if;

    if not exists (
      select 1
      from public.productos pr
      where pr.id = v_producto_id and pr.activo and pr.inventariable
    ) then
      raise exception 'producto no encontrado, inactivo o sin control de inventario' using errcode = '22023';
    end if;

    v_cantidad := round(coalesce((v_linea->>'cantidad_contada')::numeric, 0), 2);
    if v_cantidad < 0 then
      raise exception 'la cantidad contada no puede ser negativa' using errcode = '22023';
    end if;

    select coalesce(e.cantidad, 0)
    into v_sistema
    from public.existencias e
    where e.producto_id = v_producto_id
      and e.almacen_id = v_conteo.almacen_id;

    v_sistema := coalesce(v_sistema, 0);

    insert into public.conteo_inventario_lineas (
      conteo_id, producto_id, cantidad_sistema, cantidad_contada, diferencia, notas
    )
    values (
      p_id,
      v_producto_id,
      v_sistema,
      v_cantidad,
      round(v_cantidad - v_sistema, 2),
      nullif(trim(coalesce(v_linea->>'notas', '')), '')
    )
    on conflict (conteo_id, producto_id) do update
    set cantidad_sistema = excluded.cantidad_sistema,
        cantidad_contada = excluded.cantidad_contada,
        diferencia = excluded.diferencia,
        notas = excluded.notas;
  end loop;

  return p_id;
end;
$$;

create or replace function public.aplicar_conteo_inventario(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_conteo public.conteos_inventario%rowtype;
  v_ajuste_id uuid;
  v_lineas jsonb;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_id is null then
    raise exception 'el conteo es obligatorio' using errcode = '22023';
  end if;

  select * into v_conteo
  from public.conteos_inventario c
  where c.id = p_id
  for update;

  if not found then
    raise exception 'conteo de inventario no encontrado' using errcode = '22023';
  end if;
  if v_conteo.estado = 'anulado' then
    raise exception 'el conteo está anulado' using errcode = '22023';
  end if;
  if v_conteo.estado = 'aplicado' then
    raise exception 'el conteo ya está aplicado' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.conteo_inventario_lineas cl where cl.conteo_id = p_id
  ) then
    raise exception 'el conteo no tiene líneas' using errcode = '22023';
  end if;

  -- Congela la diferencia real contra el stock del momento de aplicar.
  update public.conteo_inventario_lineas cl
  set cantidad_sistema = coalesce(e.cantidad, 0),
      diferencia = round(cl.cantidad_contada - coalesce(e.cantidad, 0), 2)
  from public.productos pr
  left join public.existencias e
    on e.producto_id = pr.id and e.almacen_id = v_conteo.almacen_id
  where cl.conteo_id = p_id
    and pr.id = cl.producto_id;

  select jsonb_agg(jsonb_build_object(
    'producto_id', cl.producto_id,
    'tipo', case when cl.diferencia > 0 then 'entrada' else 'salida' end,
    'cantidad', abs(cl.diferencia),
    'costo_unitario', pr.costo
  ) order by cl.producto_id)
  into v_lineas
  from public.conteo_inventario_lineas cl
  join public.productos pr on pr.id = cl.producto_id
  where cl.conteo_id = p_id
    and cl.diferencia <> 0;

  if v_lineas is not null and jsonb_array_length(v_lineas) > 0 then
    v_ajuste_id := public.crear_ajuste_inventario(jsonb_build_object(
      'fecha', v_conteo.fecha,
      'almacen_id', v_conteo.almacen_id,
      'observaciones', 'Conteo de inventario #' || v_conteo.numero,
      'lineas', v_lineas
    ));
  end if;

  update public.conteos_inventario
  set estado = 'aplicado',
      ajuste_id = v_ajuste_id
  where id = p_id;

  return v_ajuste_id;
end;
$$;

create or replace function public.anular_conteo_inventario(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_conteo public.conteos_inventario%rowtype;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_id is null then
    raise exception 'el conteo es obligatorio' using errcode = '22023';
  end if;

  select * into v_conteo
  from public.conteos_inventario c
  where c.id = p_id
  for update;

  if not found then
    raise exception 'conteo de inventario no encontrado' using errcode = '22023';
  end if;

  if v_conteo.estado = 'aplicado' then
    raise exception 'un conteo aplicado se revierte anulando su ajuste de inventario' using errcode = '22023';
  end if;
  if v_conteo.estado = 'anulado' then
    raise exception 'el conteo ya está anulado' using errcode = '22023';
  end if;

  update public.conteos_inventario set estado = 'anulado' where id = p_id;

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
    'producto_unidades',
    'producto_codigos_barra',
    'combo_componentes',
    'conteos_inventario',
    'conteo_inventario_lineas'
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

revoke all on sequence public.conteos_inventario_numero_seq from anon, authenticated;

revoke all on function public._precio_lista(uuid, numeric, uuid) from public, anon, authenticated;
grant execute on function public._precio_lista(uuid, numeric, uuid) to authenticated;

revoke all on function public._disponibilidad_combo(uuid, uuid) from public, anon, authenticated;
grant execute on function public._disponibilidad_combo(uuid, uuid) to authenticated;

revoke all on function public.pos_buscar_por_codigo_barra(text, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.pos_catalogo_productos(uuid, uuid, text, uuid, boolean, int, int)
  from public, anon, authenticated;
revoke all on function public.reporte_stock_bajo(uuid)
  from public, anon, authenticated;

grant execute on function public.pos_buscar_por_codigo_barra(text, uuid, uuid) to authenticated;
grant execute on function public.pos_catalogo_productos(uuid, uuid, text, uuid, boolean, int, int) to authenticated;
grant execute on function public.reporte_stock_bajo(uuid) to authenticated;

revoke all on function public.crear_conteo_inventario(jsonb) from public, anon, authenticated;
revoke all on function public.guardar_lineas_conteo(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.aplicar_conteo_inventario(uuid) from public, anon, authenticated;
revoke all on function public.anular_conteo_inventario(uuid) from public, anon, authenticated;

grant execute on function public.crear_conteo_inventario(jsonb) to authenticated;
grant execute on function public.guardar_lineas_conteo(uuid, jsonb) to authenticated;
grant execute on function public.aplicar_conteo_inventario(uuid) to authenticated;
grant execute on function public.anular_conteo_inventario(uuid) to authenticated;

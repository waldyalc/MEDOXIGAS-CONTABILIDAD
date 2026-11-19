-- ---------------------------------------------------------------------------
-- Producto completo (como Alegra): unidad, almacén, venta en negativo e imagen
--
-- · productos.unidad_medida: unidad por defecto ("Unidad" si no se envía).
-- · productos.almacen_id: almacén donde entra la existencia inicial. Los
--   productos viejos quedan en el almacén principal (backfill); la columna no
--   es obligatoria en la base para no romper altas antiguas, pero el
--   formulario y las RPC la exigen.
-- · productos.vende_negativo: permite vender sin existencia (no cambia el
--   control de inventario; solo es la preferencia del producto).
-- · productos.imagen_path: ruta del objeto en el bucket `productos`.
-- · productos.tipo acepta `combo` además de `producto` y `servicio`.
-- · existencias.cantidad_inicial: cantidad con la que nació la existencia en
--   ese almacén (backfill = cantidad actual).
-- · existencias.minimo / maximo: puntos de reposición por almacén. El máximo
--   puede quedar vacío; el mínimo nunca es negativo ni mayor que el máximo.
--
-- Migración aditiva: no borra columnas ni cambia datos fuera del backfill.
-- RLS: `productos` y `existencias` ya la tienen activa con lectura autenticada
-- y escritura solo por RPC; aquí no se duplican ni se tocan esas políticas.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Columnas nuevas
-- ---------------------------------------------------------------------------

alter table public.productos
  add column if not exists unidad_medida text not null default 'Unidad',
  add column if not exists almacen_id uuid references public.almacenes (id),
  add column if not exists vende_negativo boolean not null default false,
  add column if not exists imagen_path text;

-- Backfill: el almacén principal es el que ya usaba la existencia sembrada.
update public.productos pr
set almacen_id = public._almacen_principal()
where pr.almacen_id is null;

create index if not exists productos_almacen_id_idx on public.productos (almacen_id);

alter table public.existencias
  add column if not exists cantidad_inicial numeric(14,2) not null default 0,
  add column if not exists minimo numeric(14,2) not null default 0,
  add column if not exists maximo numeric(14,2);

-- Backfill: la existencia actual es la inicial para lo que ya estaba cargado.
-- La cantidad inicial nunca queda negativa; la existencia actual sí puede
-- estar negativa (ventas sin stock) y no se toca.
update public.existencias e
set cantidad_inicial = greatest(e.cantidad, 0)
where e.cantidad_inicial = 0
  and e.cantidad <> 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.existencias'::regclass
      and conname = 'existencias_minimo_maximo_check'
  ) then
    alter table public.existencias
      add constraint existencias_minimo_maximo_check
      check (minimo >= 0 and (maximo is null or (maximo >= 0 and maximo >= minimo)));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tipos de producto: producto, servicio o combo
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.productos'::regclass
      and conname = 'productos_tipo_check'
      and pg_get_constraintdef(oid) not like '%combo%'
  ) then
    alter table public.productos drop constraint productos_tipo_check;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.productos'::regclass
      and conname = 'productos_tipo_check'
  ) then
    alter table public.productos
      add constraint productos_tipo_check check (tipo in ('producto', 'servicio', 'combo'));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Interna: min/max por almacén (no toca cantidades)
--
-- Acepta las dos formas que usan los formularios:
--   · `existencias`: [{almacen_id, minimo, maximo}, ...] para la tabla de
--     almacenes de la pantalla de edición.
--   · `minimo` y `maximo` sueltos: se aplican al almacén del producto.
-- Las cantidades actuales solo se mueven con ajustes o transferencias.
-- ---------------------------------------------------------------------------

create or replace function public._producto_guardar_minimos(
  p_producto_id uuid,
  p_almacen_id uuid,
  p jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_item jsonb;
  v_almacen_id uuid;
  v_minimo numeric(14,2);
  v_maximo numeric(14,2);
  v_minimo_actual numeric(14,2);
  v_maximo_actual numeric(14,2);
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p ? 'existencias' then
    if jsonb_typeof(p->'existencias') <> 'array' then
      raise exception 'las existencias por almacén deben ser una lista' using errcode = '22023';
    end if;

    for v_item in select * from jsonb_array_elements(p->'existencias') loop
      v_almacen_id := nullif(v_item->>'almacen_id', '')::uuid;
      if v_almacen_id is null then
        raise exception 'cada mínimo requiere un almacén' using errcode = '22023';
      end if;

      if not exists (
        select 1 from public.almacenes a where a.id = v_almacen_id and a.activo
      ) then
        raise exception 'almacén no encontrado o inactivo' using errcode = '22023';
      end if;

      v_minimo := round(coalesce((v_item->>'minimo')::numeric, 0), 2);
      v_maximo := nullif(v_item->>'maximo', '')::numeric;
      v_maximo := case when v_maximo is null then null else round(v_maximo, 2) end;

      if v_minimo < 0 then
        raise exception 'el mínimo no puede ser negativo' using errcode = '22023';
      end if;
      if v_maximo is not null and v_maximo < v_minimo then
        raise exception 'el máximo no puede ser menor que el mínimo' using errcode = '22023';
      end if;

      insert into public.existencias (
        producto_id, almacen_id, cantidad_inicial, minimo, maximo
      )
      values (p_producto_id, v_almacen_id, 0, v_minimo, v_maximo)
      on conflict (producto_id, almacen_id) do update
      set minimo = excluded.minimo,
          maximo = excluded.maximo;
    end loop;
  end if;

  if p ? 'minimo' or p ? 'maximo' then
    v_almacen_id := p_almacen_id;
    if v_almacen_id is null then
      raise exception 'selecciona el almacén del producto' using errcode = '22023';
    end if;

    select e.minimo, e.maximo
    into v_minimo_actual, v_maximo_actual
    from public.existencias e
    where e.producto_id = p_producto_id
      and e.almacen_id = v_almacen_id;

    v_minimo := case
      when p ? 'minimo' then round(coalesce((p->>'minimo')::numeric, 0), 2)
      else coalesce(v_minimo_actual, 0)
    end;
    v_maximo := case
      when p ? 'maximo' then nullif(p->>'maximo', '')::numeric
      else v_maximo_actual
    end;
    v_maximo := case when v_maximo is null then null else round(v_maximo, 2) end;

    if v_minimo < 0 then
      raise exception 'el mínimo no puede ser negativo' using errcode = '22023';
    end if;
    if v_maximo is not null and v_maximo < v_minimo then
      raise exception 'el máximo no puede ser menor que el mínimo' using errcode = '22023';
    end if;

    insert into public.existencias (producto_id, almacen_id, cantidad_inicial, minimo, maximo)
    values (p_producto_id, v_almacen_id, 0, v_minimo, v_maximo)
    on conflict (producto_id, almacen_id) do update
    set minimo = excluded.minimo,
        maximo = excluded.maximo;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Alta de producto (base del envoltorio de impuestos)
-- ---------------------------------------------------------------------------

create or replace function public._crear_producto_sin_impuestos(p jsonb)
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
  v_unidad text;
  v_almacen_id uuid;
  v_vende_negativo boolean;
  v_imagen_path text;
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
  if v_tipo not in ('producto', 'servicio', 'combo') then
    raise exception 'tipo de producto inválido' using errcode = '22023';
  end if;

  if coalesce(trim(p->>'nombre'), '') = '' then
    raise exception 'el nombre del producto es obligatorio' using errcode = '22023';
  end if;

  if p ? 'unidad_medida' then
    v_unidad := trim(coalesce(p->>'unidad_medida', ''));
    if v_unidad = '' then
      raise exception 'la unidad de medida es obligatoria' using errcode = '22023';
    end if;
  else
    v_unidad := 'Unidad';
  end if;

  v_almacen_id := nullif(p->>'almacen_id', '')::uuid;
  if v_almacen_id is null then
    v_almacen_id := public._almacen_principal();
  end if;
  if v_almacen_id is null
     or not exists (
       select 1 from public.almacenes a where a.id = v_almacen_id and a.activo
     ) then
    raise exception 'almacén no encontrado o inactivo' using errcode = '22023';
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

  v_vende_negativo := coalesce((p->>'vende_negativo')::boolean, false);
  v_imagen_path := nullif(trim(coalesce(p->>'imagen_path', '')), '');
  v_inventariable := v_tipo = 'producto' and coalesce((p->>'inventariable')::boolean, false);
  v_cantidad := case
    when v_inventariable then round(coalesce((p->>'cantidad')::numeric, 0), 2)
    else 0
  end;

  if v_cantidad < 0 then
    raise exception 'la cantidad inicial no puede ser negativa' using errcode = '22023';
  end if;

  insert into public.productos (
    tipo, nombre, referencia, descripcion, precio, itbis_tasa, inventariable, cantidad, costo,
    categoria_id, cuenta_ingreso_id, cuenta_costo_id, cuenta_inventario_id, activo,
    unidad_medida, almacen_id, vende_negativo, imagen_path
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
    coalesce((p->>'activo')::boolean, true),
    v_unidad,
    v_almacen_id,
    v_vende_negativo,
    v_imagen_path
  )
  returning id into v_id;

  if v_inventariable then
    perform public._sumar_existencia(v_id, v_almacen_id, v_cantidad);

    insert into public.existencias (producto_id, almacen_id)
    values (v_id, v_almacen_id)
    on conflict (producto_id, almacen_id) do nothing;

    update public.existencias e
    set cantidad_inicial = v_cantidad
    where e.producto_id = v_id
      and e.almacen_id = v_almacen_id;
  end if;

  perform public._producto_guardar_minimos(v_id, v_almacen_id, p);

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

-- ---------------------------------------------------------------------------
-- Edición de producto (base del envoltorio de impuestos)
-- ---------------------------------------------------------------------------

create or replace function public._actualizar_producto_sin_impuestos(p_id uuid, p jsonb)
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
  v_unidad text;
  v_almacen_id uuid;
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

  v_tipo := case
    when p ? 'tipo' then coalesce(nullif(p->>'tipo', ''), 'producto')
    else v_actual.tipo
  end;
  if v_tipo not in ('producto', 'servicio', 'combo') then
    raise exception 'tipo de producto inválido' using errcode = '22023';
  end if;

  if p ? 'unidad_medida' then
    v_unidad := trim(coalesce(p->>'unidad_medida', ''));
    if v_unidad = '' then
      raise exception 'la unidad de medida es obligatoria' using errcode = '22023';
    end if;
  end if;

  if p ? 'almacen_id' then
    v_almacen_id := nullif(p->>'almacen_id', '')::uuid;
    if v_almacen_id is null
       or not exists (
         select 1 from public.almacenes a where a.id = v_almacen_id and a.activo
       ) then
      raise exception 'almacén no encontrado o inactivo' using errcode = '22023';
    end if;
  else
    v_almacen_id := v_actual.almacen_id;
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

  v_inventariable := v_tipo = 'producto' and case
    when p ? 'inventariable' then (p->>'inventariable')::boolean
    else v_actual.inventariable
  end;
  v_cantidad := case
    when p ? 'cantidad' and v_inventariable then round((p->>'cantidad')::numeric, 2)
    when not v_inventariable then 0
    else v_actual.cantidad
  end;

  if v_cantidad < 0 then
    raise exception 'la cantidad no puede ser negativa' using errcode = '22023';
  end if;

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
    activo = case when p ? 'activo' then (p->>'activo')::boolean else pr.activo end,
    unidad_medida = case when p ? 'unidad_medida' then v_unidad else pr.unidad_medida end,
    almacen_id = case when p ? 'almacen_id' then v_almacen_id else pr.almacen_id end,
    vende_negativo = case when p ? 'vende_negativo' then (p->>'vende_negativo')::boolean else pr.vende_negativo end,
    imagen_path = case when p ? 'imagen_path' then nullif(trim(coalesce(p->>'imagen_path', '')), '') else pr.imagen_path end
  where pr.id = p_id
  returning pr.id into v_id;

  if v_delta <> 0 then
    perform public._sumar_existencia(p_id, v_almacen_id, v_delta);
  end if;

  perform public._producto_guardar_minimos(p_id, v_almacen_id, p);

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
-- Imagen del producto: bucket privado `productos`
--
-- Lectura para cualquier usuario autenticado (la ficha genera una URL
-- firmada) y subida solo admin o contador. No hay políticas de update ni
-- delete: la app sube objetos nuevos con nombre UUID y nunca los reemplaza ni
-- los borra (la limpieza de huérfanos queda pendiente). El bucket se crea una
-- vez y no se toca si ya existe.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists productos_lectura on storage.objects;
create policy productos_lectura on storage.objects
  for select to authenticated
  using (bucket_id = 'productos');

drop policy if exists productos_subir on storage.objects;
create policy productos_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'productos' and (select public.rol_actual()) in ('admin', 'contador'));

-- Si una versión anterior del archivo creó estas políticas, se retiran.
drop policy if exists productos_actualizar on storage.objects;
drop policy if exists productos_borrar on storage.objects;

-- ---------------------------------------------------------------------------
-- Permisos: la función interna no se expone a la app
-- ---------------------------------------------------------------------------

revoke all on function public._producto_guardar_minimos(uuid, uuid, jsonb)
  from public, anon, authenticated;

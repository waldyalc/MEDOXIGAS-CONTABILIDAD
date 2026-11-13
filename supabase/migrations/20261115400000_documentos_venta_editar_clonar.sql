-- ---------------------------------------------------------------------------
-- Documentos de venta: editar, clonar y convertir cotización en conduce
--
-- · Aditiva y reintentable: solo agrega columnas, índices y RPC.
-- · Cotizaciones y conduces siguen sin asiento contable ni movimiento de
--   inventario; editarlos recalcula sus líneas y totales.
-- · Solo se edita un documento abierto: convertido/facturado o anulado queda
--   bloqueado.
-- · cotización → conduce deja el vínculo en ambas tablas y marca la
--   cotización como convertida; el NCF y la numeración se asignan al guardar.
-- ---------------------------------------------------------------------------

alter table public.cotizaciones add column if not exists terminos text;
alter table public.cotizaciones add column if not exists remision_id uuid references public.remisiones (id);
alter table public.remisiones add column if not exists terminos text;
alter table public.remisiones add column if not exists cotizacion_id uuid references public.cotizaciones (id);

create index if not exists cotizaciones_remision_id_idx on public.cotizaciones (remision_id);
create index if not exists remisiones_cotizacion_id_idx on public.remisiones (cotizacion_id);

-- ---------------------------------------------------------------------------
-- Creación: guarda además los términos y condiciones
-- ---------------------------------------------------------------------------

create or replace function public.crear_cotizacion(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  v_id := public._crear_documento_no_contable('cotizacion', p);

  update public.cotizaciones
  set terminos = nullif(trim(coalesce(p->>'terminos', '')), '')
  where id = v_id;

  return v_id;
end;
$$;

create or replace function public.crear_remision(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  v_id := public._crear_documento_no_contable('remision', p);

  update public.remisiones
  set terminos = nullif(trim(coalesce(p->>'terminos', '')), '')
  where id = v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Edición de cotizaciones y conduces abiertos (sin asiento ni inventario)
-- ---------------------------------------------------------------------------

create or replace function public._editar_documento_no_contable(p_tipo text, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_contacto public.contactos%rowtype;
  v_id uuid;
  v_estado text;
  v_fecha date;
  v_vencimiento date;
  v_linea jsonb;
  v_producto_id uuid;
  v_producto_nombre text;
  v_producto_precio numeric(14,2);
  v_producto_itbis numeric(5,2);
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
  v_subtotal_doc numeric(14,2) := 0;
  v_descuento_doc numeric(14,2) := 0;
  v_itbis_doc numeric(14,2) := 0;
  v_total_doc numeric(14,2) := 0;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_tipo is null or p_tipo not in ('cotizacion', 'remision') then
    raise exception 'tipo de documento inválido' using errcode = '22023';
  end if;

  if p is null then
    raise exception 'datos del documento requeridos' using errcode = '22023';
  end if;

  v_id := nullif(p->>'id', '')::uuid;
  if v_id is null then
    raise exception 'el documento es obligatorio' using errcode = '22023';
  end if;

  if p_tipo = 'cotizacion' then
    select estado into v_estado from public.cotizaciones where id = v_id for update;
  else
    select estado into v_estado from public.remisiones where id = v_id for update;
  end if;

  if v_estado is null then
    raise exception 'documento no encontrado' using errcode = 'P0002';
  end if;
  if v_estado <> 'abierta' then
    raise exception 'el documento no está abierto' using errcode = '22023';
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

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_vencimiento := coalesce((p->>'vencimiento')::date, v_fecha);
  if v_vencimiento < v_fecha then
    raise exception 'el vencimiento no puede ser anterior a la fecha' using errcode = '22023';
  end if;

  if p->'lineas' is null
     or jsonb_typeof(p->'lineas') <> 'array'
     or jsonb_array_length(p->'lineas') = 0 then
    raise exception 'el documento requiere al menos una línea' using errcode = '22023';
  end if;

  if p_tipo = 'cotizacion' then
    update public.cotizaciones
    set contacto_id = v_contacto.id,
        fecha = v_fecha,
        vencimiento = v_vencimiento,
        notas = p->>'notas',
        terminos = nullif(trim(coalesce(p->>'terminos', '')), '')
    where id = v_id;

    delete from public.cotizacion_lineas where cotizacion_id = v_id;
  else
    update public.remisiones
    set contacto_id = v_contacto.id,
        fecha = v_fecha,
        vencimiento = v_vencimiento,
        notas = p->>'notas',
        terminos = nullif(trim(coalesce(p->>'terminos', '')), '')
    where id = v_id;

    delete from public.remision_lineas where remision_id = v_id;
  end if;

  for v_linea in select * from jsonb_array_elements(p->'lineas') loop
    v_producto_id := nullif(v_linea->>'producto_id', '')::uuid;
    v_producto_nombre := null;
    v_producto_precio := null;
    v_producto_itbis := null;

    if v_producto_id is not null then
      select pr.nombre, pr.precio, pr.itbis_tasa
      into v_producto_nombre, v_producto_precio, v_producto_itbis
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

    if p_tipo = 'cotizacion' then
      insert into public.cotizacion_lineas (
        cotizacion_id, producto_id, descripcion, cantidad, precio, descuento_pct,
        itbis_tasa, subtotal, itbis, total
      )
      values (
        v_id, v_producto_id, v_descripcion, v_cantidad, v_precio, v_descuento_pct,
        v_itbis_tasa, v_subtotal, v_itbis, v_total
      );
    else
      insert into public.remision_lineas (
        remision_id, producto_id, descripcion, cantidad, precio, descuento_pct,
        itbis_tasa, subtotal, itbis, total
      )
      values (
        v_id, v_producto_id, v_descripcion, v_cantidad, v_precio, v_descuento_pct,
        v_itbis_tasa, v_subtotal, v_itbis, v_total
      );
    end if;

    v_subtotal_doc := v_subtotal_doc + v_subtotal;
    v_descuento_doc := v_descuento_doc + v_descuento;
    v_itbis_doc := v_itbis_doc + v_itbis;
    v_total_doc := v_total_doc + v_total;
  end loop;

  if v_total_doc <= 0 then
    raise exception 'el total del documento debe ser mayor a cero' using errcode = '22023';
  end if;

  if p_tipo = 'cotizacion' then
    update public.cotizaciones
    set subtotal = v_subtotal_doc,
        descuento = v_descuento_doc,
        itbis = v_itbis_doc,
        total = v_total_doc
    where id = v_id;
  else
    update public.remisiones
    set subtotal = v_subtotal_doc,
        itbis = v_itbis_doc,
        total = v_total_doc
    where id = v_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.editar_cotizacion(p jsonb)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public._editar_documento_no_contable('cotizacion', p);
$$;

create or replace function public.editar_remision(p jsonb)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public._editar_documento_no_contable('remision', p);
$$;

-- ---------------------------------------------------------------------------
-- Cotización → conduce: crea el conduce y deja el vínculo en las dos fichas
-- ---------------------------------------------------------------------------

create or replace function public.crear_remision_desde_cotizacion(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_cotizacion public.cotizaciones%rowtype;
  v_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or (p->>'cotizacion_id') is null then
    raise exception 'la cotización es obligatoria' using errcode = '22023';
  end if;

  select * into v_cotizacion
  from public.cotizaciones c
  where c.id = (p->>'cotizacion_id')::uuid
  for update;

  if not found then
    raise exception 'cotización no encontrada' using errcode = '22023';
  end if;
  if v_cotizacion.estado <> 'abierta' then
    raise exception 'la cotización no está abierta' using errcode = '22023';
  end if;

  v_id := public._crear_documento_no_contable('remision', p - 'cotizacion_id');

  update public.remisiones
  set cotizacion_id = v_cotizacion.id,
      terminos = nullif(trim(coalesce(p->>'terminos', '')), '')
  where id = v_id;

  update public.cotizaciones
  set estado = 'convertida',
      remision_id = v_id
  where id = v_cotizacion.id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos: las escrituras siguen siendo solo por RPC
-- ---------------------------------------------------------------------------

revoke all on function public._editar_documento_no_contable(text, jsonb) from public, anon, authenticated;
revoke all on function public.crear_cotizacion(jsonb) from public, anon, authenticated;
revoke all on function public.crear_remision(jsonb) from public, anon, authenticated;
revoke all on function public.crear_remision_desde_cotizacion(jsonb) from public, anon, authenticated;
revoke all on function public.editar_cotizacion(jsonb) from public, anon, authenticated;
revoke all on function public.editar_remision(jsonb) from public, anon, authenticated;

grant execute on function public.crear_cotizacion(jsonb) to authenticated;
grant execute on function public.crear_remision(jsonb) to authenticated;
grant execute on function public.crear_remision_desde_cotizacion(jsonb) to authenticated;
grant execute on function public.editar_cotizacion(jsonb) to authenticated;
grant execute on function public.editar_remision(jsonb) to authenticated;

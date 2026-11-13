-- ---------------------------------------------------------------------------
-- Vendedores
--
-- Migración aditiva y reintentable. Crea el catálogo de vendedores, lo enlaza
-- de forma opcional a facturas, cotizaciones y remisiones (conduces) y
-- actualiza las RPC de creación para guardar el vendedor.
-- RLS: authenticated lee; las escrituras van solo por RPC (admin o contador).
-- ---------------------------------------------------------------------------

create table if not exists public.vendedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  identificacion text,
  observacion text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create unique index if not exists vendedores_nombre_unico on public.vendedores (lower(nombre));

alter table public.facturas
  add column if not exists vendedor_id uuid references public.vendedores (id);
alter table public.cotizaciones
  add column if not exists vendedor_id uuid references public.vendedores (id);
alter table public.remisiones
  add column if not exists vendedor_id uuid references public.vendedores (id);

create index if not exists facturas_vendedor_id_idx on public.facturas (vendedor_id);
create index if not exists cotizaciones_vendedor_id_idx on public.cotizaciones (vendedor_id);
create index if not exists remisiones_vendedor_id_idx on public.remisiones (vendedor_id);

-- ---------------------------------------------------------------------------
-- RPC: crear y actualizar vendedores
-- ---------------------------------------------------------------------------

create or replace function public.crear_vendedor(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_nombre text;
  v_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del vendedor requeridos' using errcode = '22023';
  end if;

  v_nombre := trim(coalesce(p->>'nombre', ''));
  if v_nombre = '' then
    raise exception 'el nombre del vendedor es obligatorio' using errcode = '22023';
  end if;

  if exists (select 1 from public.vendedores v where lower(v.nombre) = lower(v_nombre)) then
    raise exception 'ya existe un vendedor con ese nombre' using errcode = '22023';
  end if;

  insert into public.vendedores (nombre, identificacion, observacion, activo)
  values (
    v_nombre,
    nullif(trim(coalesce(p->>'identificacion', '')), ''),
    nullif(trim(coalesce(p->>'observacion', '')), ''),
    coalesce((p->>'activo')::boolean, true)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.actualizar_vendedor(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_nombre text;
  v_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del vendedor requeridos' using errcode = '22023';
  end if;

  if not exists (select 1 from public.vendedores v where v.id = p_id) then
    raise exception 'vendedor no encontrado' using errcode = '22023';
  end if;

  if p ? 'nombre' then
    v_nombre := trim(coalesce(p->>'nombre', ''));
    if v_nombre = '' then
      raise exception 'el nombre del vendedor es obligatorio' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.vendedores v
      where lower(v.nombre) = lower(v_nombre)
        and v.id <> p_id
    ) then
      raise exception 'ya existe un vendedor con ese nombre' using errcode = '22023';
    end if;
  end if;

  update public.vendedores v
  set
    nombre = case when p ? 'nombre' then v_nombre else v.nombre end,
    identificacion = case
      when p ? 'identificacion' then nullif(trim(coalesce(p->>'identificacion', '')), '')
      else v.identificacion
    end,
    observacion = case
      when p ? 'observacion' then nullif(trim(coalesce(p->>'observacion', '')), '')
      else v.observacion
    end,
    activo = case when p ? 'activo' then (p->>'activo')::boolean else v.activo end
  where v.id = p_id
  returning v.id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- crear_factura con vendedor opcional (misma lógica contable)
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
  v_factura_id uuid;
  v_numero int;
  v_ncf text;
  v_tipo text;
  v_fecha date;
  v_vencimiento date;
  v_vendedor_id uuid;
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
    tipo_comprobante, ncf, contacto_id, vendedor_id, fecha, vencimiento, notas, terminos, pie, creado_por
  )
  values (
    v_tipo, v_ncf, v_contacto.id, v_vendedor_id, v_fecha, v_vencimiento,
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

      update public.productos
      set cantidad = cantidad - v_cantidad
      where id = v_producto_id;
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
-- Cotizaciones y remisiones con vendedor opcional
-- ---------------------------------------------------------------------------

create or replace function public._crear_documento_no_contable(p_tipo text, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_contacto public.contactos%rowtype;
  v_id uuid;
  v_fecha date;
  v_vencimiento date;
  v_vendedor_id uuid;
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
    insert into public.cotizaciones (contacto_id, vendedor_id, fecha, vencimiento, notas, creado_por)
    values (v_contacto.id, v_vendedor_id, v_fecha, v_vencimiento, p->>'notas', auth.uid())
    returning id into v_id;
  else
    insert into public.remisiones (contacto_id, vendedor_id, fecha, vencimiento, notas, creado_por)
    values (v_contacto.id, v_vendedor_id, v_fecha, v_vencimiento, p->>'notas', auth.uid())
    returning id into v_id;
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

-- ---------------------------------------------------------------------------
-- Conversión a factura: conserva el vendedor del documento
-- ---------------------------------------------------------------------------

create or replace function public.convertir_a_factura(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_tipo_doc text;
  v_id uuid;
  v_tipo_comprobante text;
  v_contacto_id uuid;
  v_vendedor_id uuid;
  v_fecha date;
  v_vencimiento date;
  v_notas text;
  v_lineas jsonb;
  v_factura_id uuid;
  v_cotizacion public.cotizaciones%rowtype;
  v_remision public.remisiones%rowtype;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la conversión requeridos' using errcode = '22023';
  end if;

  v_tipo_doc := coalesce(p->>'tipo', p->>'p_tipo');
  if v_tipo_doc is null or v_tipo_doc not in ('cotizacion', 'remision') then
    raise exception 'tipo de documento inválido' using errcode = '22023';
  end if;

  v_id := nullif(coalesce(p->>'id', p->>'p_id'), '')::uuid;
  if v_id is null then
    raise exception 'el documento es obligatorio' using errcode = '22023';
  end if;

  v_tipo_comprobante := coalesce(nullif(p->>'tipo_comprobante', ''), '01');
  if v_tipo_comprobante not in ('01', '02') then
    raise exception 'tipo de comprobante inválido' using errcode = '22023';
  end if;

  if v_tipo_doc = 'cotizacion' then
    select * into v_cotizacion
    from public.cotizaciones c
    where c.id = v_id
    for update;

    if not found then
      raise exception 'cotización no encontrada' using errcode = '22023';
    end if;
    if v_cotizacion.estado <> 'abierta' then
      raise exception 'la cotización no está abierta' using errcode = '22023';
    end if;

    select jsonb_agg(jsonb_build_object(
      'producto_id', l.producto_id,
      'descripcion', l.descripcion,
      'cantidad', l.cantidad,
      'precio', l.precio,
      'descuento_pct', l.descuento_pct,
      'itbis_tasa', l.itbis_tasa
    ) order by l.id)
    into v_lineas
    from public.cotizacion_lineas l
    where l.cotizacion_id = v_id;

    v_contacto_id := v_cotizacion.contacto_id;
    v_vendedor_id := v_cotizacion.vendedor_id;
    v_fecha := v_cotizacion.fecha;
    v_vencimiento := v_cotizacion.vencimiento;
    v_notas := v_cotizacion.notas;
  else
    select * into v_remision
    from public.remisiones r
    where r.id = v_id
    for update;

    if not found then
      raise exception 'remisión no encontrada' using errcode = '22023';
    end if;
    if v_remision.estado <> 'abierta' then
      raise exception 'la remisión no está abierta' using errcode = '22023';
    end if;

    select jsonb_agg(jsonb_build_object(
      'producto_id', l.producto_id,
      'descripcion', l.descripcion,
      'cantidad', l.cantidad,
      'precio', l.precio,
      'descuento_pct', l.descuento_pct,
      'itbis_tasa', l.itbis_tasa
    ) order by l.id)
    into v_lineas
    from public.remision_lineas l
    where l.remision_id = v_id;

    v_contacto_id := v_remision.contacto_id;
    v_vendedor_id := v_remision.vendedor_id;
    v_fecha := v_remision.fecha;
    v_vencimiento := v_remision.vencimiento;
    v_notas := v_remision.notas;
  end if;

  if v_lineas is null or jsonb_array_length(v_lineas) = 0 then
    raise exception 'el documento no tiene líneas' using errcode = '22023';
  end if;

  v_factura_id := public.crear_factura(jsonb_build_object(
    'tipo_comprobante', v_tipo_comprobante,
    'contacto_id', v_contacto_id,
    'vendedor_id', v_vendedor_id,
    'fecha', v_fecha,
    'vencimiento', v_vencimiento,
    'notas', v_notas,
    'lineas', v_lineas
  ));

  if v_tipo_doc = 'cotizacion' then
    update public.cotizaciones
    set estado = 'convertida', factura_id = v_factura_id
    where id = v_id;
  else
    update public.remisiones
    set estado = 'convertida', factura_id = v_factura_id
    where id = v_id;
  end if;

  return v_factura_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS y permisos
-- ---------------------------------------------------------------------------

alter table public.vendedores enable row level security;

revoke all on public.vendedores from anon;
revoke all on public.vendedores from authenticated;
grant select on public.vendedores to authenticated;

drop policy if exists vendedores_lectura on public.vendedores;
create policy vendedores_lectura on public.vendedores
  for select to authenticated
  using ((select public.rol_actual()) is not null);

revoke all on function public.crear_vendedor(jsonb) from public, anon, authenticated;
revoke all on function public.actualizar_vendedor(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.crear_vendedor(jsonb) to authenticated;
grant execute on function public.actualizar_vendedor(uuid, jsonb) to authenticated;

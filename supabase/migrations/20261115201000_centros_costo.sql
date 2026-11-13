-- ---------------------------------------------------------------------------
-- Centros de costo
--
-- Migración aditiva y reintentable. Crea el catálogo de centros de costo, lo
-- enlaza de forma opcional a facturas, cotizaciones, remisiones y facturas de
-- proveedor y guarda el centro en cada línea de asiento (obligatorio por
-- línea en los asientos manuales).
--
-- · _crear_asiento copia el centro de costo de cada línea.
-- · crear_factura, _crear_documento_no_contable, crear_factura_proveedor y
--   convertir_a_factura aplican el centro del documento a todas sus líneas.
-- · anular_documento conserva el centro en el asiento de reversión.
-- · reporte_estado_resultados_centro filtra el estado de resultados por centro.
-- RLS: authenticated lee; las escrituras van solo por RPC (admin o contador).
-- ---------------------------------------------------------------------------

create table if not exists public.centros_costo (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nombre text not null,
  descripcion text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create unique index if not exists centros_costo_codigo_unico on public.centros_costo (lower(codigo));

alter table public.facturas
  add column if not exists centro_costo_id uuid references public.centros_costo (id);
alter table public.cotizaciones
  add column if not exists centro_costo_id uuid references public.centros_costo (id);
alter table public.remisiones
  add column if not exists centro_costo_id uuid references public.centros_costo (id);
alter table public.facturas_proveedor
  add column if not exists centro_costo_id uuid references public.centros_costo (id);
alter table public.asiento_lineas
  add column if not exists centro_costo_id uuid references public.centros_costo (id);

create index if not exists facturas_centro_costo_id_idx on public.facturas (centro_costo_id);
create index if not exists cotizaciones_centro_costo_id_idx on public.cotizaciones (centro_costo_id);
create index if not exists remisiones_centro_costo_id_idx on public.remisiones (centro_costo_id);
create index if not exists facturas_proveedor_centro_costo_id_idx on public.facturas_proveedor (centro_costo_id);
create index if not exists asiento_lineas_centro_costo_id_idx on public.asiento_lineas (centro_costo_id);

-- ---------------------------------------------------------------------------
-- RPC: crear y actualizar centros de costo
-- ---------------------------------------------------------------------------

create or replace function public.crear_centro_costo(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_codigo text;
  v_nombre text;
  v_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del centro de costo requeridos' using errcode = '22023';
  end if;

  v_codigo := trim(coalesce(p->>'codigo', ''));
  if v_codigo = '' then
    raise exception 'el código del centro de costo es obligatorio' using errcode = '22023';
  end if;

  v_nombre := trim(coalesce(p->>'nombre', ''));
  if v_nombre = '' then
    raise exception 'el nombre del centro de costo es obligatorio' using errcode = '22023';
  end if;

  if exists (select 1 from public.centros_costo c where lower(c.codigo) = lower(v_codigo)) then
    raise exception 'ya existe un centro de costo con ese código' using errcode = '22023';
  end if;

  insert into public.centros_costo (codigo, nombre, descripcion, activo)
  values (
    v_codigo,
    v_nombre,
    nullif(trim(coalesce(p->>'descripcion', '')), ''),
    coalesce((p->>'activo')::boolean, true)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.actualizar_centro_costo(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_codigo text;
  v_nombre text;
  v_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del centro de costo requeridos' using errcode = '22023';
  end if;

  if not exists (select 1 from public.centros_costo c where c.id = p_id) then
    raise exception 'centro de costo no encontrado' using errcode = '22023';
  end if;

  if p ? 'codigo' then
    v_codigo := trim(coalesce(p->>'codigo', ''));
    if v_codigo = '' then
      raise exception 'el código del centro de costo es obligatorio' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.centros_costo c
      where lower(c.codigo) = lower(v_codigo)
        and c.id <> p_id
    ) then
      raise exception 'ya existe un centro de costo con ese código' using errcode = '22023';
    end if;
  end if;

  if p ? 'nombre' then
    v_nombre := trim(coalesce(p->>'nombre', ''));
    if v_nombre = '' then
      raise exception 'el nombre del centro de costo es obligatorio' using errcode = '22023';
    end if;
  end if;

  update public.centros_costo c
  set
    codigo = case when p ? 'codigo' then v_codigo else c.codigo end,
    nombre = case when p ? 'nombre' then v_nombre else c.nombre end,
    descripcion = case
      when p ? 'descripcion' then nullif(trim(coalesce(p->>'descripcion', '')), '')
      else c.descripcion
    end,
    activo = case when p ? 'activo' then (p->>'activo')::boolean else c.activo end
  where c.id = p_id
  returning c.id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- _crear_asiento: cada línea puede llevar centro de costo
-- ---------------------------------------------------------------------------

create or replace function public._crear_asiento(
  p_fecha date,
  p_descripcion text,
  p_origen_tipo text,
  p_origen_id uuid,
  p_lineas jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asiento_id uuid;
  v_linea jsonb;
  v_cuenta_id uuid;
  v_debito numeric(14,2);
  v_credito numeric(14,2);
  v_debitos numeric(14,2) := 0;
  v_creditos numeric(14,2) := 0;
  v_total numeric(14,2);
  v_lineas int;
begin
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' then
    raise exception 'las líneas del asiento son inválidas' using errcode = '22023';
  end if;

  v_lineas := jsonb_array_length(p_lineas);
  if v_lineas < 2 then
    raise exception 'un asiento requiere al menos 2 líneas' using errcode = '23514';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_cuenta_id := nullif(v_linea->>'cuenta_id', '')::uuid;
    if v_cuenta_id is null then
      raise exception 'cada línea del asiento requiere una cuenta' using errcode = '22023';
    end if;

    v_debito := round(coalesce((v_linea->>'debito')::numeric, 0), 2);
    v_credito := round(coalesce((v_linea->>'credito')::numeric, 0), 2);

    if v_debito < 0 or v_credito < 0 then
      raise exception 'los montos del asiento no pueden ser negativos' using errcode = '22023';
    end if;

    if (v_debito = 0) = (v_credito = 0) then
      raise exception 'cada línea debe llevar débito o crédito, nunca ambos' using errcode = '23514';
    end if;

    if not exists (
      select 1 from public.cuentas c
      where c.id = v_cuenta_id and c.acepta_movimientos
    ) then
      raise exception 'la cuenta % no acepta movimientos', v_cuenta_id using errcode = '23514';
    end if;

    v_debitos := v_debitos + v_debito;
    v_creditos := v_creditos + v_credito;
  end loop;

  if v_debitos <> v_creditos then
    raise exception 'el asiento está descuadrado (débitos %, créditos %)', v_debitos, v_creditos
      using errcode = '23514';
  end if;

  v_total := v_debitos;

  insert into public.asientos (fecha, descripcion, origen_tipo, origen_id, total, creado_por)
  values (coalesce(p_fecha, current_date), p_descripcion, p_origen_tipo, p_origen_id, v_total, auth.uid())
  returning id into v_asiento_id;

  insert into public.asiento_lineas (
    asiento_id, cuenta_id, contacto_id, centro_costo_id, descripcion, debito, credito
  )
  select
    v_asiento_id,
    nullif(l->>'cuenta_id', '')::uuid,
    nullif(l->>'contacto_id', '')::uuid,
    nullif(l->>'centro_costo_id', '')::uuid,
    coalesce(l->>'descripcion', p_descripcion),
    round(coalesce((l->>'debito')::numeric, 0), 2),
    round(coalesce((l->>'credito')::numeric, 0), 2)
  from jsonb_array_elements(p_lineas) as l;

  return v_asiento_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- crear_factura con centro de costo opcional
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
    tipo_comprobante, ncf, contacto_id, vendedor_id, centro_costo_id, fecha, vencimiento,
    notas, terminos, pie, creado_por
  )
  values (
    v_tipo, v_ncf, v_contacto.id, v_vendedor_id, v_centro_costo_id, v_fecha, v_vencimiento,
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
-- Cotizaciones y remisiones con centro de costo opcional
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
  v_centro_costo_id uuid;
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

  v_centro_costo_id := nullif(p->>'centro_costo_id', '')::uuid;
  if v_centro_costo_id is not null
     and not exists (select 1 from public.centros_costo c where c.id = v_centro_costo_id and c.activo) then
    raise exception 'centro de costo no encontrado o inactivo' using errcode = '22023';
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
    insert into public.cotizaciones (contacto_id, vendedor_id, centro_costo_id, fecha, vencimiento, notas, creado_por)
    values (v_contacto.id, v_vendedor_id, v_centro_costo_id, v_fecha, v_vencimiento, p->>'notas', auth.uid())
    returning id into v_id;
  else
    insert into public.remisiones (contacto_id, vendedor_id, centro_costo_id, fecha, vencimiento, notas, creado_por)
    values (v_contacto.id, v_vendedor_id, v_centro_costo_id, v_fecha, v_vencimiento, p->>'notas', auth.uid())
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
-- Conversión a factura: conserva vendedor y centro de costo
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
  v_centro_costo_id uuid;
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
    v_centro_costo_id := v_cotizacion.centro_costo_id;
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
    v_centro_costo_id := v_remision.centro_costo_id;
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
    'centro_costo_id', v_centro_costo_id,
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
-- crear_factura_proveedor con centro de costo opcional
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

  insert into public.facturas_proveedor (ncf, contacto_id, centro_costo_id, fecha, vencimiento, notas, creado_por)
  values (v_ncf, v_contacto.id, v_centro_costo_id, v_fecha, v_vencimiento, p->>'notas', auth.uid())
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

      update public.productos
      set cantidad = v_producto_cantidad + v_cantidad,
          costo = v_nuevo_costo
      where id = v_producto_id;
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
-- Asientos manuales: centro de costo por línea
-- ---------------------------------------------------------------------------

create or replace function public.crear_asiento_manual(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_fecha date;
  v_descripcion text;
  v_lineas jsonb;
  v_linea jsonb;
  v_lineas_norm jsonb := '[]'::jsonb;
  v_cuenta public.cuentas%rowtype;
  v_cuenta_id uuid;
  v_contacto_id uuid;
  v_centro_costo_id uuid;
  v_debito numeric(14,2);
  v_credito numeric(14,2);
  v_debitos numeric(14,2) := 0;
  v_creditos numeric(14,2) := 0;
  v_asiento_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'datos del asiento requeridos' using errcode = '22023';
  end if;

  v_descripcion := nullif(trim(p->>'descripcion'), '');
  if v_descripcion is null then
    raise exception 'la descripción del asiento es obligatoria' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);

  v_lineas := p->'lineas';
  if v_lineas is null or jsonb_typeof(v_lineas) <> 'array' then
    raise exception 'las líneas del asiento son inválidas' using errcode = '22023';
  end if;

  if jsonb_array_length(v_lineas) < 2 then
    raise exception 'un asiento requiere al menos 2 líneas' using errcode = '23514';
  end if;

  for v_linea in select * from jsonb_array_elements(v_lineas) loop
    v_cuenta_id := nullif(v_linea->>'cuenta_id', '')::uuid;
    if v_cuenta_id is null then
      raise exception 'cada línea del asiento requiere una cuenta' using errcode = '22023';
    end if;

    v_contacto_id := nullif(v_linea->>'contacto_id', '')::uuid;
    if v_contacto_id is not null
       and not exists (select 1 from public.contactos c where c.id = v_contacto_id) then
      raise exception 'contacto no encontrado' using errcode = '22023';
    end if;

    v_centro_costo_id := nullif(v_linea->>'centro_costo_id', '')::uuid;
    if v_centro_costo_id is not null
       and not exists (select 1 from public.centros_costo c where c.id = v_centro_costo_id) then
      raise exception 'centro de costo no encontrado' using errcode = '22023';
    end if;

    select * into v_cuenta from public.cuentas c where c.id = v_cuenta_id;
    if not found then
      raise exception 'cuenta no encontrada' using errcode = '22023';
    end if;
    if not v_cuenta.activa then
      raise exception 'la cuenta % está inactiva', v_cuenta.codigo using errcode = '23514';
    end if;
    if not v_cuenta.acepta_movimientos then
      raise exception 'la cuenta % no acepta movimientos', v_cuenta.codigo using errcode = '23514';
    end if;

    v_debito := round(coalesce((v_linea->>'debito')::numeric, 0), 2);
    v_credito := round(coalesce((v_linea->>'credito')::numeric, 0), 2);

    if v_debito < 0 or v_credito < 0 then
      raise exception 'los montos del asiento no pueden ser negativos' using errcode = '22023';
    end if;

    if (v_debito = 0) = (v_credito = 0) then
      raise exception 'cada línea debe llevar débito o crédito, nunca ambos' using errcode = '23514';
    end if;

    v_debitos := v_debitos + v_debito;
    v_creditos := v_creditos + v_credito;

    v_lineas_norm := v_lineas_norm || jsonb_build_array(jsonb_build_object(
      'cuenta_id', v_cuenta_id,
      'contacto_id', v_contacto_id,
      'centro_costo_id', v_centro_costo_id,
      'descripcion', coalesce(nullif(trim(v_linea->>'descripcion'), ''), v_descripcion),
      'debito', v_debito,
      'credito', v_credito
    ));
  end loop;

  if v_debitos <> v_creditos then
    raise exception 'el asiento está descuadrado (débitos %, créditos %)', v_debitos, v_creditos
      using errcode = '23514';
  end if;

  v_asiento_id := public._crear_asiento(v_fecha, v_descripcion, 'manual', null, v_lineas_norm);

  return v_asiento_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Anulación: el asiento de reversión conserva el centro de costo
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
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_tipo is null or p_tipo not in (
    'factura', 'pago_recibido', 'factura_proveedor', 'pago_proveedor', 'gasto_menor',
    'nota_credito_compra'
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

    for v_prod_id, v_cantidad in
      select fl.producto_id, fl.cantidad
      from public.factura_lineas fl
      join public.productos pr on pr.id = fl.producto_id
      where fl.factura_id = p_id and pr.inventariable
    loop
      update public.productos set cantidad = cantidad + v_cantidad where id = v_prod_id;
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

      update public.productos
      set cantidad = v_cantidad_nueva,
          costo = v_costo_nuevo
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

  elsif p_tipo = 'nota_credito_compra' then
    select * into v_nota from public.notas_credito_compra nc where nc.id = p_id for update;
    if not found then
      raise exception 'nota de crédito de compra no encontrada' using errcode = '22023';
    end if;
    if v_nota.estado = 'anulada' then
      raise exception 'la nota de crédito ya está anulada' using errcode = '22023';
    end if;

    if v_nota.devuelve_inventario then
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

        update public.productos
        set cantidad = v_cantidad_nueva,
            costo = v_costo_nuevo
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
-- Estado de resultados filtrado por centro de costo
-- ---------------------------------------------------------------------------

create or replace function public.reporte_estado_resultados_centro(
  p_desde date,
  p_hasta date,
  p_centro_costo uuid default null
)
returns table (
  tipo text,
  cuenta_codigo text,
  cuenta_nombre text,
  monto numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.tipo,
    c.codigo,
    c.nombre,
    round(
      case
        when c.tipo = 'ingreso' then sum(l.credito) - sum(l.debito)
        else sum(l.debito) - sum(l.credito)
      end,
      2
    )
  from public.asientos a
  join public.asiento_lineas l on l.asiento_id = a.id
  join public.cuentas c on c.id = l.cuenta_id
  where a.fecha between p_desde and p_hasta
    and c.tipo in ('ingreso', 'costo', 'gasto')
    and (p_centro_costo is null or l.centro_costo_id = p_centro_costo)
  group by c.id, c.codigo, c.nombre, c.tipo
  having sum(l.debito) <> 0 or sum(l.credito) <> 0
  order by array_position(array['ingreso', 'costo', 'gasto'], c.tipo), c.codigo;
$$;

-- ---------------------------------------------------------------------------
-- RLS y permisos
-- ---------------------------------------------------------------------------

alter table public.centros_costo enable row level security;

revoke all on public.centros_costo from anon;
revoke all on public.centros_costo from authenticated;
grant select on public.centros_costo to authenticated;

drop policy if exists centros_costo_lectura on public.centros_costo;
create policy centros_costo_lectura on public.centros_costo
  for select to authenticated
  using ((select public.rol_actual()) is not null);

revoke all on function public.crear_centro_costo(jsonb) from public, anon, authenticated;
revoke all on function public.actualizar_centro_costo(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.reporte_estado_resultados_centro(date, date, uuid) from public, anon, authenticated;
grant execute on function public.crear_centro_costo(jsonb) to authenticated;
grant execute on function public.actualizar_centro_costo(uuid, jsonb) to authenticated;
grant execute on function public.reporte_estado_resultados_centro(date, date, uuid) to authenticated;

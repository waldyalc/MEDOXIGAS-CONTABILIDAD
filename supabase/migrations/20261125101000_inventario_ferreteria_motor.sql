-- ---------------------------------------------------------------------------
-- Inventario nivel ferretería (fase 1A): motor de unidades y combos.
--
-- · crear_factura / crear_nota_credito_venta / crear_factura_proveedor
--   convierten la cantidad de la presentación a la unidad base y mueven
--   existencias con esa cantidad.
-- · Los combos consumen y devuelven sus componentes, y costean la venta con
--   la suma de los costos promedio vigentes.
-- · crear_producto / actualizar_producto aceptan marca, favorito_pos,
--   ubicacion, unidades, codigos_barra y componentes.
-- · anular_documento devuelve el stock de combos y de líneas con unidad.
--
-- Depende de 20261125100000_inventario_ferreteria_catalogo.sql. Migración
-- aditiva y reintentable: solo CREATE OR REPLACE / renombres con guarda.
-- Contrato: docs/dominio-inventario-ferreteria.md
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Internas: factor de unidad, costo y movimiento de un combo
-- ---------------------------------------------------------------------------

create or replace function public._unidad_factor(
  p_producto_id uuid,
  p_unidad_id uuid
)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_factor numeric(14,4);
begin
  if p_unidad_id is null then
    return 1;
  end if;

  select pu.factor_base into v_factor
  from public.producto_unidades pu
  where pu.id = p_unidad_id
    and pu.producto_id = p_producto_id
    and pu.activa;

  if v_factor is null then
    raise exception 'unidad de medida no encontrada para el producto' using errcode = '22023';
  end if;

  return v_factor;
end;
$$;

create or replace function public._costo_combo(
  p_combo_id uuid,
  p_cantidad_base numeric
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(coalesce(sum(pr.costo * cc.cantidad * p_cantidad_base), 0), 2)
  from public.combo_componentes cc
  join public.productos pr on pr.id = cc.componente_id
  where cc.combo_id = p_combo_id
    and pr.inventariable;
$$;

create or replace function public._mover_combo_existencia(
  p_combo_id uuid,
  p_almacen_id uuid,
  p_cantidad_base numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_componente_id uuid;
  v_cantidad numeric(14,2);
begin
  if p_cantidad_base = 0 then
    return;
  end if;

  for v_componente_id, v_cantidad in
    select cc.componente_id, round(cc.cantidad * p_cantidad_base, 2)
    from public.combo_componentes cc
    join public.productos pr on pr.id = cc.componente_id
    where cc.combo_id = p_combo_id
      and pr.inventariable
    order by cc.componente_id
  loop
    perform public._mover_existencia(v_componente_id, p_almacen_id, v_cantidad);
  end loop;
end;
$$;

revoke all on function public._unidad_factor(uuid, uuid) from public, anon, authenticated;
revoke all on function public._costo_combo(uuid, numeric) from public, anon, authenticated;
revoke all on function public._mover_combo_existencia(uuid, uuid, numeric)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trigger: completa nombre y factor de la unidad en las líneas
--
-- Los motores de factura, compra y nota de crédito ya los envían. El trigger
-- cubre a cotizaciones y cualquier inserción futura: si llega `unidad_id`,
-- el nombre y el factor siempre salen de producto_unidades.
-- ---------------------------------------------------------------------------

create or replace function public._linea_completar_unidad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_factor numeric(14,4);
  v_nombre text;
begin
  if new.unidad_id is null then
    new.factor_base := coalesce(new.factor_base, 1);
    return new;
  end if;

  if new.producto_id is null then
    raise exception 'la unidad de medida requiere un producto' using errcode = '22023';
  end if;

  select pu.factor_base, pu.nombre
  into v_factor, v_nombre
  from public.producto_unidades pu
  where pu.id = new.unidad_id
    and pu.producto_id = new.producto_id;

  if v_factor is null then
    raise exception 'unidad de medida no encontrada para el producto' using errcode = '22023';
  end if;

  new.factor_base := v_factor;
  new.unidad_nombre := v_nombre;

  return new;
end;
$$;

drop trigger if exists factura_lineas_unidad on public.factura_lineas;
create trigger factura_lineas_unidad
before insert or update of producto_id, unidad_id on public.factura_lineas
for each row execute function public._linea_completar_unidad();

drop trigger if exists cotizacion_lineas_unidad on public.cotizacion_lineas;
create trigger cotizacion_lineas_unidad
before insert or update of producto_id, unidad_id on public.cotizacion_lineas
for each row execute function public._linea_completar_unidad();

drop trigger if exists nota_credito_venta_lineas_unidad on public.nota_credito_venta_lineas;
create trigger nota_credito_venta_lineas_unidad
before insert or update of producto_id, unidad_id on public.nota_credito_venta_lineas
for each row execute function public._linea_completar_unidad();

drop trigger if exists facturas_proveedor_lineas_unidad on public.facturas_proveedor_lineas;
create trigger facturas_proveedor_lineas_unidad
before insert or update of producto_id, unidad_id on public.facturas_proveedor_lineas
for each row execute function public._linea_completar_unidad();

-- ---------------------------------------------------------------------------
-- Venta: valida stock en unidad base y combos antes de numerar
--
-- Reemplaza el envoltorio de 20261118190224 (vende_negativo). El motor de
-- impuestos sigue vigente como _crear_factura_sin_control_stock.
-- ---------------------------------------------------------------------------

create or replace function public.crear_factura(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_almacen_id uuid;
  v_norm jsonb := '[]'::jsonb;
  v_linea jsonb;
  v_producto_id uuid;
  v_producto public.productos%rowtype;
  v_factor numeric(14,4);
  v_cantidad numeric(14,2);
  v_cantidad_base numeric(14,2);
  v_requerido numeric(14,2);
  v_disponible numeric(14,2);
  v_componente public.productos%rowtype;
  v_componente_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  -- Sin líneas o almacén inválido, el motor de siempre devuelve su error.
  if p is null or jsonb_typeof(p->'lineas') <> 'array' then
    return public._crear_factura_sin_control_stock(p);
  end if;

  v_almacen_id := nullif(p->>'almacen_id', '')::uuid;
  if v_almacen_id is null then
    v_almacen_id := public._almacen_principal();
  end if;

  if v_almacen_id is null
     or not exists (select 1 from public.almacenes al where al.id = v_almacen_id and al.activo) then
    return public._crear_factura_sin_control_stock(p);
  end if;

  -- Normaliza cada línea a cantidad base. Las líneas inválidas se dejan para
  -- que el motor lance su error de siempre.
  for v_linea in select * from jsonb_array_elements(p->'lineas') loop
    v_producto_id := nullif(v_linea->>'producto_id', '')::uuid;
    v_cantidad := round(coalesce((v_linea->>'cantidad')::numeric, 0), 2);

    if v_producto_id is not null and v_cantidad > 0 then
      select * into v_producto
      from public.productos pr
      where pr.id = v_producto_id and pr.activo;

      if found then
        v_factor := public._unidad_factor(v_producto_id, nullif(v_linea->>'unidad_id', '')::uuid);
        v_cantidad_base := round(v_cantidad * v_factor, 2);
        v_norm := v_norm || jsonb_build_array(jsonb_build_object(
          'producto_id', v_producto_id,
          'cantidad_base', v_cantidad_base,
          'tipo', v_producto.tipo
        ));
      end if;
    end if;
  end loop;

  -- Requerimiento total por producto: líneas simples + componentes de combos.
  -- Se recorre en orden fijo por producto_id para bloquear siempre igual.
  for v_componente_id, v_requerido in
    select x.producto_id, sum(x.cantidad_base)
    from (
      select (n->>'producto_id')::uuid as producto_id,
             (n->>'cantidad_base')::numeric as cantidad_base
      from jsonb_array_elements(v_norm) n
      where (n->>'tipo') <> 'combo'
      union all
      select cc.componente_id,
             round((n->>'cantidad_base')::numeric * cc.cantidad, 2)
      from jsonb_array_elements(v_norm) n
      join public.combo_componentes cc on cc.combo_id = (n->>'producto_id')::uuid
      where (n->>'tipo') = 'combo'
    ) x
    group by x.producto_id
    order by x.producto_id
  loop
    select * into v_componente
    from public.productos pr
    where pr.id = v_componente_id and pr.activo;

    if found
       and v_componente.inventariable
       and not coalesce(v_componente.vende_negativo, false) then
      select e.cantidad into v_disponible
      from public.existencias e
      where e.producto_id = v_componente_id
        and e.almacen_id = v_almacen_id
      for update;

      if coalesce(v_disponible, 0) < v_requerido then
        raise exception 'no hay existencia suficiente del producto %', v_componente.nombre
          using errcode = '22023';
      end if;
    end if;
  end loop;

  return public._crear_factura_sin_control_stock(p);
end;
$$;

revoke all on function public.crear_factura(jsonb) from public, anon, authenticated;
grant execute on function public.crear_factura(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Motor de venta: cantidad base, costo real de combos y línea con unidad
-- ---------------------------------------------------------------------------

create or replace function public._crear_factura_sin_impuestos(p jsonb)
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
  v_producto_unidad text;
  v_producto_cuenta_ingreso uuid;
  v_producto_cuenta_costo uuid;
  v_producto_cuenta_inventario uuid;
  v_unidad_id uuid;
  v_unidad_nombre text;
  v_factor numeric(14,4);
  v_cantidad numeric(14,2);
  v_cantidad_base numeric(14,2);
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
    v_unidad_id := nullif(v_linea->>'unidad_id', '')::uuid;
    v_producto_nombre := null;
    v_producto_tipo := null;
    v_producto_precio := null;
    v_producto_itbis := null;
    v_producto_costo := null;
    v_producto_inventariable := false;
    v_producto_unidad := null;
    v_producto_cuenta_ingreso := null;
    v_producto_cuenta_costo := null;
    v_producto_cuenta_inventario := null;
    v_factor := 1;
    v_unidad_nombre := null;

    if v_producto_id is null and v_unidad_id is not null then
      raise exception 'la unidad de medida requiere un producto' using errcode = '22023';
    end if;

    if v_producto_id is not null then
      select
        pr.nombre, pr.tipo, pr.precio, pr.itbis_tasa, pr.costo, pr.inventariable, pr.unidad_medida,
        pr.cuenta_ingreso_id, pr.cuenta_costo_id, pr.cuenta_inventario_id
      into
        v_producto_nombre, v_producto_tipo, v_producto_precio, v_producto_itbis, v_producto_costo,
        v_producto_inventariable, v_producto_unidad, v_producto_cuenta_ingreso,
        v_producto_cuenta_costo, v_producto_cuenta_inventario
      from public.productos pr
      where pr.id = v_producto_id and pr.activo;

      if not found then
        raise exception 'producto no encontrado' using errcode = '22023';
      end if;

      v_unidad_nombre := v_producto_unidad;
      if v_unidad_id is not null then
        select pu.nombre, pu.factor_base
        into v_unidad_nombre, v_factor
        from public.producto_unidades pu
        where pu.id = v_unidad_id
          and pu.producto_id = v_producto_id
          and pu.activa;

        if not found then
          raise exception 'unidad de medida no encontrada para el producto' using errcode = '22023';
        end if;
      end if;
    end if;

    v_cantidad := round(coalesce((v_linea->>'cantidad')::numeric, 0), 2);
    if v_cantidad <= 0 then
      raise exception 'la cantidad debe ser mayor a cero' using errcode = '22023';
    end if;

    v_cantidad_base := round(v_cantidad * v_factor, 2);

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

    v_costo_unitario := 0;
    v_costo_total := 0;

    if v_producto_tipo = 'combo' then
      if not exists (
        select 1 from public.combo_componentes cc where cc.combo_id = v_producto_id
      ) then
        raise exception 'el combo % no tiene componentes', v_producto_nombre using errcode = '22023';
      end if;

      v_costo_total := public._costo_combo(v_producto_id, v_cantidad_base);
      v_costo_unitario := case
        when v_cantidad > 0 then round(v_costo_total / v_cantidad, 2)
        else 0
      end;
    elsif v_producto_inventariable then
      v_costo_unitario := round(coalesce(v_producto_costo, 0) * v_factor, 2);
      v_costo_total := round(v_cantidad_base * coalesce(v_producto_costo, 0), 2);
    end if;

    insert into public.factura_lineas (
      factura_id, producto_id, descripcion, cantidad, precio, descuento_pct, itbis_tasa,
      subtotal, itbis, total, costo_unitario, unidad_id, unidad_nombre, factor_base
    )
    values (
      v_factura_id, v_producto_id, v_descripcion, v_cantidad, v_precio, v_descuento_pct, v_itbis_tasa,
      v_subtotal, v_itbis, v_total, v_costo_unitario, v_unidad_id, v_unidad_nombre, v_factor
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

    if v_producto_tipo = 'combo' or v_producto_inventariable then
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

      if v_producto_tipo = 'combo' then
        perform public._mover_combo_existencia(v_producto_id, v_almacen_id, -v_cantidad_base);
      else
        perform public._mover_existencia(v_producto_id, v_almacen_id, -v_cantidad_base);
      end if;
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

revoke all on function public._crear_factura_sin_impuestos(jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Compra: cantidad base, costo base y rechazo de combos
-- ---------------------------------------------------------------------------

create or replace function public._crear_factura_proveedor_sin_impuestos(p jsonb)
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
  v_producto_tipo text;
  v_producto_unidad text;
  v_producto_costo numeric(14,2);
  v_producto_cantidad numeric(14,2);
  v_producto_inventariable boolean;
  v_producto_cuenta_costo uuid;
  v_producto_cuenta_inventario uuid;
  v_unidad_id uuid;
  v_unidad_nombre text;
  v_factor numeric(14,4);
  v_cantidad numeric(14,2);
  v_cantidad_base numeric(14,2);
  v_costo numeric(14,2);
  v_costo_base numeric(14,2);
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
    v_unidad_id := nullif(v_linea->>'unidad_id', '')::uuid;
    v_producto_nombre := null;
    v_producto_tipo := null;
    v_producto_unidad := null;
    v_producto_costo := null;
    v_producto_cantidad := null;
    v_producto_inventariable := false;
    v_producto_cuenta_costo := null;
    v_producto_cuenta_inventario := null;
    v_factor := 1;
    v_unidad_nombre := null;

    if v_producto_id is null and v_unidad_id is not null then
      raise exception 'la unidad de medida requiere un producto' using errcode = '22023';
    end if;

    if v_producto_id is not null then
      select
        pr.nombre, pr.tipo, pr.unidad_medida, pr.costo, pr.cantidad, pr.inventariable,
        pr.cuenta_costo_id, pr.cuenta_inventario_id
      into
        v_producto_nombre, v_producto_tipo, v_producto_unidad, v_producto_costo, v_producto_cantidad,
        v_producto_inventariable, v_producto_cuenta_costo, v_producto_cuenta_inventario
      from public.productos pr
      where pr.id = v_producto_id and pr.activo;

      if not found then
        raise exception 'producto no encontrado' using errcode = '22023';
      end if;

      if v_producto_tipo = 'combo' then
        raise exception 'un combo no se puede comprar; registra sus componentes' using errcode = '22023';
      end if;

      v_unidad_nombre := v_producto_unidad;
      if v_unidad_id is not null then
        select pu.nombre, pu.factor_base
        into v_unidad_nombre, v_factor
        from public.producto_unidades pu
        where pu.id = v_unidad_id
          and pu.producto_id = v_producto_id
          and pu.activa;

        if not found then
          raise exception 'unidad de medida no encontrada para el producto' using errcode = '22023';
        end if;
      end if;
    elsif v_cuenta_id is null then
      raise exception 'cada línea requiere un producto o una cuenta' using errcode = '22023';
    end if;

    v_cantidad := round(coalesce((v_linea->>'cantidad')::numeric, 0), 2);
    if v_cantidad <= 0 then
      raise exception 'la cantidad debe ser mayor a cero' using errcode = '22023';
    end if;

    v_cantidad_base := round(v_cantidad * v_factor, 2);

    v_costo := round(coalesce((v_linea->>'costo')::numeric, 0), 2);
    if v_costo < 0 then
      raise exception 'el costo no puede ser negativo' using errcode = '22023';
    end if;

    v_costo_base := case
      when v_cantidad_base > 0 then round(v_costo * v_cantidad / v_cantidad_base, 2)
      else v_costo
    end;

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
      subtotal, itbis, total, unidad_id, unidad_nombre, factor_base
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
      v_total,
      v_unidad_id,
      v_unidad_nombre,
      v_factor
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
          ((v_producto_cantidad * v_producto_costo) + (v_cantidad_base * v_costo_base))
          / (v_producto_cantidad + v_cantidad_base),
          2
        );
      else
        v_nuevo_costo := v_costo_base;
      end if;

      perform public._mover_existencia(v_producto_id, v_almacen_id, v_cantidad_base);

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

revoke all on function public._crear_factura_proveedor_sin_impuestos(jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Nota de crédito de venta: devuelve cantidad base y componentes del combo
-- ---------------------------------------------------------------------------

create or replace function public._crear_nota_credito_venta_sin_impuestos(p jsonb)
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
  v_cuenta_devoluciones uuid;
  v_nota_id uuid;
  v_num public.numeraciones%rowtype;
  v_ncf text;
  v_fecha date;
  v_devuelve boolean;
  v_linea jsonb;
  v_factura_linea public.factura_lineas%rowtype;
  v_acreditado numeric(14,2);
  v_cantidad numeric(14,2);
  v_cantidad_base numeric(14,2);
  v_unidad_id uuid;
  v_unidad_nombre text;
  v_factor numeric(14,4);
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
  v_producto_costo numeric(14,2);
  v_producto_cuenta_costo uuid;
  v_producto_cuenta_inventario uuid;
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
  v_cuenta_devoluciones := public._cuenta_config('devoluciones_ventas');

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

    v_unidad_id := v_factura_linea.unidad_id;
    v_unidad_nombre := v_factura_linea.unidad_nombre;
    v_factor := coalesce(v_factura_linea.factor_base, 1);
    v_cantidad_base := round(v_cantidad * v_factor, 2);

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

    v_producto_id := v_factura_linea.producto_id;
    v_producto_tipo := null;
    v_producto_inventariable := false;
    v_producto_costo := 0;
    v_producto_cuenta_costo := null;
    v_producto_cuenta_inventario := null;

    if v_producto_id is not null then
      select
        pr.tipo, pr.inventariable, pr.costo, pr.cuenta_costo_id, pr.cuenta_inventario_id
      into
        v_producto_tipo, v_producto_inventariable, v_producto_costo,
        v_producto_cuenta_costo, v_producto_cuenta_inventario
      from public.productos pr
      where pr.id = v_producto_id;

      if not found then
        v_producto_tipo := null;
        v_producto_inventariable := false;
        v_producto_costo := 0;
        v_producto_cuenta_costo := null;
        v_producto_cuenta_inventario := null;
      end if;
    end if;

    -- Devolución al costo promedio VIGENTE (no al costo de la venta) y, en
    -- combos, a la suma de los componentes vigentes.
    if v_devuelve then
      if v_producto_tipo = 'combo' then
        if not exists (
          select 1 from public.combo_componentes cc where cc.combo_id = v_producto_id
        ) then
          raise exception 'el combo % no tiene componentes', v_factura_linea.descripcion using errcode = '22023';
        end if;
        v_costo_total := public._costo_combo(v_producto_id, v_cantidad_base);
      elsif v_producto_inventariable then
        v_costo_total := round(v_cantidad_base * coalesce(v_producto_costo, 0), 2);
      end if;

      v_costo_unitario := case
        when v_cantidad > 0 then round(v_costo_total / v_cantidad, 2)
        else 0
      end;
    end if;

    insert into public.nota_credito_venta_lineas (
      nota_id, factura_linea_id, producto_id, descripcion, cantidad, precio, descuento_pct,
      itbis_tasa, subtotal, itbis, total, costo_unitario, unidad_id, unidad_nombre, factor_base
    )
    values (
      v_nota_id, v_factura_linea.id, v_factura_linea.producto_id, v_factura_linea.descripcion,
      v_cantidad, v_precio, v_descuento_pct, v_itbis_tasa, v_subtotal, v_itbis, v_total, v_costo_unitario,
      v_unidad_id, v_unidad_nombre, v_factor
    );

    v_subtotal_nota := v_subtotal_nota + v_subtotal;
    v_itbis_nota := v_itbis_nota + v_itbis;
    v_total_nota := v_total_nota + v_total;

    if v_subtotal > 0 then
      v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_cuenta_devoluciones,
        'debito', v_subtotal,
        'credito', 0,
        'descripcion', 'Devolución venta: ' || left(v_factura_linea.descripcion, 70)
      ));
    end if;

    if v_devuelve and (v_producto_tipo = 'combo' or v_producto_inventariable) then
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

      if v_producto_tipo = 'combo' then
        perform public._mover_combo_existencia(v_producto_id, v_almacen_id, v_cantidad_base);
      else
        perform public._mover_existencia(v_producto_id, v_almacen_id, v_cantidad_base);
      end if;
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
        when round(v_factura.pagado + v_factura.retenido + v_nuevo_credito, 2) >= v_factura.total then 'pagada'
        else 'abierta'
      end
  where id = v_factura.id;

  return v_nota_id;
end;
$$;

revoke all on function public._crear_nota_credito_venta_sin_impuestos(jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Anulación: devuelve cantidad base y componentes de combos
--
-- La anulación vigente pasa a base; para facturas se usa esta versión. El
-- resto de documentos sigue delegando en la cadena existente.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regprocedure('public._anular_documento_ajustes(text, uuid)') is not null
     and to_regprocedure('public._anular_documento_ajustes_base(text, uuid)') is null then
    alter function public._anular_documento_ajustes(text, uuid)
      rename to _anular_documento_ajustes_base;
  end if;
end;
$$;

revoke all on function public._anular_documento_ajustes_base(text, uuid)
  from public, anon, authenticated;

create or replace function public._anular_documento_ajustes(p_tipo text, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_factura public.facturas%rowtype;
  v_factura_prov public.facturas_proveedor%rowtype;
  v_linea public.factura_lineas%rowtype;
  v_linea_prov public.facturas_proveedor_lineas%rowtype;
  v_producto_tipo text;
  v_producto_inventariable boolean;
  v_cantidad_base numeric(14,2);
  v_cantidad_actual numeric(14,2);
  v_costo_actual numeric(14,2);
  v_cantidad_nueva numeric(14,2);
  v_costo_nuevo numeric(14,2);
  v_costo_linea_base numeric(14,2);
  v_almacen_id uuid;
  v_asiento public.asientos%rowtype;
  v_asiento_id uuid;
  v_numero int;
  v_lineas jsonb;
  v_reversion_id uuid;
begin
  if p_tipo is null or p_tipo not in ('factura', 'factura_proveedor') then
    return public._anular_documento_ajustes_base(p_tipo, p_id);
  end if;

  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_id is null then
    raise exception 'el documento es obligatorio' using errcode = '22023';
  end if;

  if p_tipo = 'factura' then
    select * into v_factura
    from public.facturas f
    where f.id = p_id
    for update;

    if not found then
      raise exception 'factura no encontrada' using errcode = '22023';
    end if;
    if v_factura.estado = 'anulada' then
      raise exception 'la factura ya está anulada' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.pagos_recibidos pr
      where pr.factura_id = p_id and pr.estado = 'activo'
    ) or exists (
      select 1
      from public.pago_recibido_aplicaciones pa
      join public.pagos_recibidos pr on pr.id = pa.pago_id
      where pa.factura_id = p_id and pr.estado = 'activo'
    ) then
      raise exception 'no se puede anular una factura con pagos activos' using errcode = 'P0001';
    end if;

    v_almacen_id := coalesce(v_factura.almacen_id, public._almacen_principal());

    for v_linea in
      select * from public.factura_lineas fl
      where fl.factura_id = p_id
      order by fl.id
    loop
      if v_linea.producto_id is null then
        continue;
      end if;

      select pr.tipo, pr.inventariable
      into v_producto_tipo, v_producto_inventariable
      from public.productos pr
      where pr.id = v_linea.producto_id;

      if not found then
        continue;
      end if;

      v_cantidad_base := round(v_linea.cantidad * coalesce(v_linea.factor_base, 1), 2);

      if v_producto_tipo = 'combo' then
        perform public._mover_combo_existencia(v_linea.producto_id, v_almacen_id, v_cantidad_base);
      elsif v_producto_inventariable then
        perform public._mover_existencia(v_linea.producto_id, v_almacen_id, v_cantidad_base);
      end if;
    end loop;

    v_asiento_id := v_factura.asiento_id;
    v_numero := v_factura.numero;

    update public.facturas set estado = 'anulada', pagado = 0, retenido = 0 where id = p_id;
  else
    select * into v_factura_prov
    from public.facturas_proveedor fp
    where fp.id = p_id
    for update;

    if not found then
      raise exception 'factura de proveedor no encontrada' using errcode = '22023';
    end if;
    if v_factura_prov.estado = 'anulada' then
      raise exception 'la factura de proveedor ya está anulada' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.pagos_proveedor pp
      where pp.factura_proveedor_id = p_id and pp.estado = 'activo'
    ) or exists (
      select 1
      from public.pago_proveedor_aplicaciones pa
      join public.pagos_proveedor pp on pp.id = pa.pago_id
      where pa.factura_proveedor_id = p_id and pp.estado = 'activo'
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

    for v_linea_prov in
      select * from public.facturas_proveedor_lineas fpl
      where fpl.factura_proveedor_id = p_id
      order by fpl.id
    loop
      if v_linea_prov.producto_id is null then
        continue;
      end if;

      select pr.inventariable
      into v_producto_inventariable
      from public.productos pr
      where pr.id = v_linea_prov.producto_id;

      if not found or not v_producto_inventariable then
        continue;
      end if;

      v_cantidad_base := round(v_linea_prov.cantidad * coalesce(v_linea_prov.factor_base, 1), 2);
      if v_cantidad_base = 0 then
        continue;
      end if;

      v_costo_linea_base := round(v_linea_prov.costo * v_linea_prov.cantidad / v_cantidad_base, 2);

      select pr.cantidad, pr.costo
      into v_cantidad_actual, v_costo_actual
      from public.productos pr
      where pr.id = v_linea_prov.producto_id
      for update;

      v_cantidad_nueva := round(v_cantidad_actual - v_cantidad_base, 2);

      if v_cantidad_nueva > 0 then
        v_costo_nuevo := round(
          greatest(v_cantidad_actual * v_costo_actual - v_cantidad_base * v_costo_linea_base, 0)
          / v_cantidad_nueva,
          2
        );
      elsif v_cantidad_nueva = 0 then
        v_costo_nuevo := 0;
      else
        v_costo_nuevo := v_costo_actual;
      end if;

      perform public._mover_existencia(v_linea_prov.producto_id, v_almacen_id, -v_cantidad_base);

      update public.productos pr
      set costo = v_costo_nuevo
      where pr.id = v_linea_prov.producto_id;
    end loop;

    v_asiento_id := v_factura_prov.asiento_id;
    v_numero := v_factura_prov.numero;

    update public.facturas_proveedor
    set estado = 'anulada', pagado = 0, credito = 0, retenido = 0
    where id = p_id;
  end if;

  if v_asiento_id is null then
    raise exception 'el documento no tiene asiento contable' using errcode = '22023';
  end if;

  select * into v_asiento
  from public.asientos a
  where a.id = v_asiento_id;

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

revoke all on function public._anular_documento_ajustes(text, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Producto: marca, favorito, ubicación, unidades, códigos y componentes
-- ---------------------------------------------------------------------------

create or replace function public._producto_guardar_ferreteria(
  p_producto_id uuid,
  p jsonb,
  p_es_alta boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_producto public.productos%rowtype;
  v_componente public.productos%rowtype;
  v_almacen_id uuid;
  v_item jsonb;
  v_id uuid;
  v_nombre text;
  v_factor numeric(14,4);
  v_precio numeric(14,2);
  v_codigo text;
  v_unidad_id uuid;
  v_principal boolean;
  v_ids text[] := '{}';
  v_codigos text[] := '{}';
  v_componente_id uuid;
  v_cantidad numeric(14,2);
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select * into v_producto
  from public.productos pr
  where pr.id = p_producto_id
  for update;

  if not found then
    raise exception 'producto no encontrado' using errcode = '22023';
  end if;

  update public.productos pr
  set
    marca = case when p ? 'marca' then nullif(trim(coalesce(p->>'marca', '')), '') else pr.marca end,
    favorito_pos = case when p ? 'favorito_pos' then coalesce((p->>'favorito_pos')::boolean, false) else pr.favorito_pos end,
    ubicacion = case when p ? 'ubicacion' then nullif(trim(coalesce(p->>'ubicacion', '')), '') else pr.ubicacion end
  where pr.id = p_producto_id;

  -- La ubicación del producto se refleja en la fila de existencias del
  -- almacén indicado (o del almacén del producto si no se indica).
  if p ? 'ubicacion' then
    v_almacen_id := coalesce(
      nullif(p->>'almacen_id', '')::uuid,
      v_producto.almacen_id,
      public._almacen_principal()
    );

    if v_almacen_id is not null then
      insert into public.existencias (producto_id, almacen_id, ubicacion)
      values (p_producto_id, v_almacen_id, nullif(trim(coalesce(p->>'ubicacion', '')), ''))
      on conflict (producto_id, almacen_id) do update
      set ubicacion = excluded.ubicacion;
    end if;
  end if;

  if p ? 'existencias' then
    if jsonb_typeof(p->'existencias') <> 'array' then
      raise exception 'las existencias por almacén deben ser una lista' using errcode = '22023';
    end if;

    for v_item in select * from jsonb_array_elements(p->'existencias') loop
      if v_item ? 'ubicacion' then
        v_almacen_id := nullif(v_item->>'almacen_id', '')::uuid;
        if v_almacen_id is null then
          raise exception 'cada ubicación requiere un almacén' using errcode = '22023';
        end if;
        if not exists (
          select 1 from public.almacenes a where a.id = v_almacen_id and a.activo
        ) then
          raise exception 'almacén no encontrado o inactivo' using errcode = '22023';
        end if;

        insert into public.existencias (producto_id, almacen_id, ubicacion)
        values (p_producto_id, v_almacen_id, nullif(trim(coalesce(v_item->>'ubicacion', '')), ''))
        on conflict (producto_id, almacen_id) do update
        set ubicacion = excluded.ubicacion;
      end if;
    end loop;
  end if;

  -- Un producto que ya es componente de un combo no puede dejar de ser
  -- producto: eso crearía un combo anidado.
  if exists (
    select 1 from public.combo_componentes cc where cc.componente_id = p_producto_id
  ) and v_producto.tipo <> 'producto' then
    raise exception 'el producto es componente de un combo y debe seguir siendo un producto' using errcode = '22023';
  end if;

  if p ? 'unidades' then
    if jsonb_typeof(p->'unidades') <> 'array' then
      raise exception 'las unidades deben ser una lista' using errcode = '22023';
    end if;

    v_ids := '{}';
    for v_item in select * from jsonb_array_elements(p->'unidades') loop
      v_id := nullif(v_item->>'id', '')::uuid;
      v_nombre := trim(coalesce(v_item->>'nombre', ''));
      if v_nombre = '' then
        raise exception 'cada unidad requiere un nombre' using errcode = '22023';
      end if;

      v_factor := coalesce(nullif(v_item->>'factor_base', '')::numeric, 1);
      if v_factor <= 0 then
        raise exception 'el factor de la unidad debe ser mayor a cero' using errcode = '22023';
      end if;

      v_precio := nullif(v_item->>'precio', '')::numeric;
      if v_precio is not null then
        v_precio := round(v_precio, 2);
        if v_precio < 0 then
          raise exception 'el precio de la unidad no puede ser negativo' using errcode = '22023';
        end if;
      end if;

      if v_id is not null then
        update public.producto_unidades pu
        set nombre = v_nombre,
            factor_base = v_factor,
            precio = v_precio,
            es_compra = coalesce((v_item->>'es_compra')::boolean, pu.es_compra),
            es_venta = coalesce((v_item->>'es_venta')::boolean, pu.es_venta),
            activa = coalesce((v_item->>'activa')::boolean, pu.activa)
        where pu.id = v_id and pu.producto_id = p_producto_id
        returning pu.id into v_id;

        if v_id is null then
          raise exception 'unidad de medida no encontrada para el producto' using errcode = '22023';
        end if;
      else
        select pu.id into v_id
        from public.producto_unidades pu
        where pu.producto_id = p_producto_id and lower(pu.nombre) = lower(v_nombre);

        if v_id is not null then
          update public.producto_unidades pu
          set nombre = v_nombre,
              factor_base = v_factor,
              precio = v_precio,
              es_compra = coalesce((v_item->>'es_compra')::boolean, pu.es_compra),
              es_venta = coalesce((v_item->>'es_venta')::boolean, pu.es_venta),
              activa = coalesce((v_item->>'activa')::boolean, true)
          where pu.id = v_id;
        else
          insert into public.producto_unidades (
            producto_id, nombre, factor_base, precio, es_compra, es_venta, activa
          )
          values (
            p_producto_id,
            v_nombre,
            v_factor,
            v_precio,
            coalesce((v_item->>'es_compra')::boolean, false),
            coalesce((v_item->>'es_venta')::boolean, true),
            coalesce((v_item->>'activa')::boolean, true)
          )
          returning id into v_id;
        end if;
      end if;

      v_ids := array_append(v_ids, v_id::text);
    end loop;

    if not p_es_alta then
      update public.producto_unidades pu
      set activa = false
      where pu.producto_id = p_producto_id
        and pu.id::text <> all(v_ids);
    end if;
  end if;

  if p ? 'codigos_barra' then
    if jsonb_typeof(p->'codigos_barra') <> 'array' then
      raise exception 'los códigos de barra deben ser una lista' using errcode = '22023';
    end if;

    v_codigos := '{}';
    for v_item in select * from jsonb_array_elements(p->'codigos_barra') loop
      v_codigo := trim(coalesce(v_item->>'codigo', ''));
      if v_codigo = '' then
        raise exception 'el código de barra es obligatorio' using errcode = '22023';
      end if;

      v_unidad_id := nullif(v_item->>'unidad_id', '')::uuid;
      if v_unidad_id is not null and not exists (
        select 1 from public.producto_unidades pu
        where pu.id = v_unidad_id and pu.producto_id = p_producto_id
      ) then
        raise exception 'la unidad del código no pertenece al producto' using errcode = '22023';
      end if;

      if exists (
        select 1 from public.producto_codigos_barra cb
        where lower(trim(cb.codigo)) = lower(v_codigo)
          and cb.producto_id <> p_producto_id
      ) then
        raise exception 'el código de barra ya está registrado en otro producto' using errcode = '22023';
      end if;

      v_principal := coalesce((v_item->>'principal')::boolean, false);
      if v_principal then
        update public.producto_codigos_barra cb
        set principal = false
        where cb.producto_id = p_producto_id and cb.principal;
      end if;

      insert into public.producto_codigos_barra (producto_id, unidad_id, codigo, principal)
      values (p_producto_id, v_unidad_id, v_codigo, v_principal)
      on conflict (lower(trim(codigo))) do update
      set unidad_id = excluded.unidad_id,
          principal = excluded.principal;

      v_codigos := array_append(v_codigos, lower(v_codigo));
    end loop;

    if not p_es_alta then
      delete from public.producto_codigos_barra cb
      where cb.producto_id = p_producto_id
        and lower(trim(cb.codigo)) <> all(v_codigos);
    end if;
  end if;

  if p ? 'componentes' then
    if jsonb_typeof(p->'componentes') <> 'array' then
      raise exception 'los componentes deben ser una lista' using errcode = '22023';
    end if;

    if v_producto.tipo <> 'combo' and jsonb_array_length(p->'componentes') > 0 then
      raise exception 'solo un combo puede tener componentes' using errcode = '22023';
    end if;

    delete from public.combo_componentes cc where cc.combo_id = p_producto_id;

    if v_producto.tipo = 'combo' then
      for v_item in select * from jsonb_array_elements(p->'componentes') loop
        v_componente_id := nullif(v_item->>'componente_id', '')::uuid;
        if v_componente_id is null then
          raise exception 'cada componente requiere un producto' using errcode = '22023';
        end if;
        if v_componente_id = p_producto_id then
          raise exception 'un combo no puede ser componente de sí mismo' using errcode = '22023';
        end if;

        select * into v_componente
        from public.productos pr
        where pr.id = v_componente_id and pr.activo;

        if not found then
          raise exception 'componente no encontrado o inactivo' using errcode = '22023';
        end if;
        if v_componente.tipo = 'combo' then
          raise exception 'un combo no puede tener componentes que sean combos' using errcode = '22023';
        end if;
        if v_componente.tipo <> 'producto' then
          raise exception 'el componente de un combo debe ser un producto' using errcode = '22023';
        end if;

        v_cantidad := round(coalesce((v_item->>'cantidad')::numeric, 0), 2);
        if v_cantidad <= 0 then
          raise exception 'la cantidad del componente debe ser mayor a cero' using errcode = '22023';
        end if;

        insert into public.combo_componentes (combo_id, componente_id, cantidad)
        values (p_producto_id, v_componente_id, v_cantidad)
        on conflict (combo_id, componente_id) do update
        set cantidad = excluded.cantidad;
      end loop;
    end if;
  elsif v_producto.tipo <> 'combo' and exists (
    select 1 from public.combo_componentes cc where cc.combo_id = p_producto_id
  ) then
    raise exception 'el producto tiene componentes de combo; vacíalos antes de cambiar el tipo' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public._producto_guardar_ferreteria(uuid, jsonb, boolean)
  from public, anon, authenticated;

-- crear_producto / actualizar_producto: envuelven el alta con asiento de
-- inventario inicial y guardan los datos de ferretería.

do $$
begin
  if to_regprocedure('public.crear_producto(jsonb)') is not null
     and to_regprocedure('public._crear_producto_con_inventario_inicial(jsonb)') is null then
    alter function public.crear_producto(jsonb)
      rename to _crear_producto_con_inventario_inicial;
  end if;

  if to_regprocedure('public.actualizar_producto(uuid, jsonb)') is not null
     and to_regprocedure('public._actualizar_producto_con_inventario_inicial(uuid, jsonb)') is null then
    alter function public.actualizar_producto(uuid, jsonb)
      rename to _actualizar_producto_con_inventario_inicial;
  end if;
end;
$$;

revoke all on function public._crear_producto_con_inventario_inicial(jsonb)
  from public, anon, authenticated;
revoke all on function public._actualizar_producto_con_inventario_inicial(uuid, jsonb)
  from public, anon, authenticated;

create or replace function public.crear_producto(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  v_id := public._crear_producto_con_inventario_inicial(p);
  perform public._producto_guardar_ferreteria(v_id, p, true);
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
  v_id uuid;
begin
  v_id := public._actualizar_producto_con_inventario_inicial(p_id, p);
  perform public._producto_guardar_ferreteria(v_id, p, false);
  return v_id;
end;
$$;

revoke all on function public.crear_producto(jsonb) from public, anon, authenticated;
revoke all on function public.actualizar_producto(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.crear_producto(jsonb) to authenticated;
grant execute on function public.actualizar_producto(uuid, jsonb) to authenticated;

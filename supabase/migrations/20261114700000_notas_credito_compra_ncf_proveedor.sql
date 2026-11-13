-- ---------------------------------------------------------------------------
-- Notas de crédito de compras: NCF del proveedor (B04)
--
-- Migración aditiva y reintentable: no borra ni cambia datos existentes.
-- - El NCF de la nota lo emite el PROVEEDOR y se escribe a mano, como en la
--   factura de proveedor. Ya no se consume la numeración 03/B03 (esa es de
--   las notas de débito de venta).
-- - El NCF es opcional; si viene, debe ser B04 + 8 dígitos o E34 + 10 dígitos.
-- - crear_nota_credito_compra mantiene la misma firma (p jsonb).
-- ---------------------------------------------------------------------------

alter table public.notas_credito_compra alter column ncf drop not null;

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

  insert into public.notas_credito_compra (
    ncf, factura_proveedor_id, contacto_id, fecha, devuelve_inventario, notas, creado_por
  )
  values (
    v_ncf, v_factura.id, v_factura.contacto_id, v_fecha, v_devuelve, p->>'notas', auth.uid()
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

      update public.productos
      set cantidad = v_cantidad_nueva,
          costo = v_costo_nuevo
      where id = v_producto.id;
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

revoke all on function public.crear_nota_credito_compra(jsonb) from public, anon, authenticated;
grant execute on function public.crear_nota_credito_compra(jsonb) to authenticated;

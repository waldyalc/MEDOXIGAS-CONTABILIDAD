-- Integrador: anular_documento parte de las RPC actuales (stock por almacén, centro de costo y
-- anulación de ajustes) y suma el recálculo de retenido; no se aplica la versión original de la rama.
-- ---------------------------------------------------------------------------
-- Pagos con retenciones de ITBIS e ISR
--
-- Migración aditiva y reintentable. Mantiene la firma de las RPC jsonb.
-- · registrar_pago_recibido acepta p->'retenciones' (array de retencion_id).
--   El servidor recalcula base y monto: ITBIS sobre el ITBIS de la factura e
--   ISR sobre el subtotal neto. El cliente paga en caja/banco y la retención
--   queda como activo/anticipo (nos retuvieron).
-- · registrar_pago_proveedor hace lo contrario: retenemos al proveedor y la
--   retención queda como pasivo por pagar a la DGII.
-- · El saldo de la factura baja por monto + retenido y la retención no puede
--   aplicarse dos veces a la misma factura.
-- · anular_documento revierte monto y retenido del pago.
-- ---------------------------------------------------------------------------

create or replace function public.registrar_pago_recibido(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_pago_id uuid;
  v_factura public.facturas%rowtype;
  v_contacto public.contactos%rowtype;
  v_cuenta public.cuentas%rowtype;
  v_retencion public.retenciones%rowtype;
  v_retenciones jsonb;
  v_item jsonb;
  v_ids uuid[] := '{}';
  v_monto numeric(14,2);
  v_fecha date;
  v_metodo text;
  v_saldo numeric(14,2);
  v_nuevo_pagado numeric(14,2);
  v_nuevo_retenido numeric(14,2);
  v_retenido_total numeric(14,2) := 0;
  v_total_aplicado numeric(14,2);
  v_base numeric(14,2);
  v_monto_retencion numeric(14,2);
  v_cuenta_retencion uuid;
  v_asiento_id uuid;
  v_lineas jsonb;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del pago requeridos' using errcode = '22023';
  end if;

  v_monto := round(coalesce((p->>'monto')::numeric, 0), 2);
  if v_monto <= 0 then
    raise exception 'el monto del pago debe ser mayor a cero' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_metodo := coalesce(nullif(p->>'metodo', ''), 'efectivo');
  if v_metodo not in ('efectivo', 'transferencia', 'tarjeta', 'cheque') then
    raise exception 'método de pago inválido' using errcode = '22023';
  end if;

  if p->>'cuenta_id' is null then
    raise exception 'la cuenta de caja o banco es obligatoria' using errcode = '22023';
  end if;

  select * into v_cuenta
  from public.cuentas c
  where c.id = (p->>'cuenta_id')::uuid and c.activa;

  if not found then
    raise exception 'cuenta de caja o banco no encontrada' using errcode = '22023';
  end if;
  if not v_cuenta.es_caja_banco then
    raise exception 'la cuenta del pago debe ser de caja o banco' using errcode = '22023';
  end if;

  select coalesce(p->'retenciones', '[]'::jsonb) into v_retenciones;
  if jsonb_typeof(v_retenciones) <> 'array' then
    raise exception 'las retenciones deben venir en una lista' using errcode = '22023';
  end if;

  if p->>'factura_id' is not null then
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

    select * into v_contacto from public.contactos c where c.id = v_factura.contacto_id;
  else
    if jsonb_array_length(v_retenciones) > 0 then
      raise exception 'las retenciones requieren una factura' using errcode = '22023';
    end if;

    if p->>'contacto_id' is null then
      raise exception 'se requiere la factura o el contacto' using errcode = '22023';
    end if;

    select * into v_contacto
    from public.contactos c
    where c.id = (p->>'contacto_id')::uuid and c.activo;

    if not found then
      raise exception 'contacto no encontrado' using errcode = '22023';
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(v_retenciones)
  loop
    if v_item->>'retencion_id' is null then
      raise exception 'la retención es obligatoria' using errcode = '22023';
    end if;

    if (v_item->>'retencion_id')::uuid = any (v_ids) then
      raise exception 'la retención está repetida en el pago' using errcode = '22023';
    end if;

    select * into v_retencion
    from public.retenciones r
    where r.id = (v_item->>'retencion_id')::uuid and r.activa;

    if not found then
      raise exception 'retención no encontrada o inactiva' using errcode = '22023';
    end if;

    if exists (
      select 1
      from public.pago_recibido_retenciones prr
      join public.pagos_recibidos pr on pr.id = prr.pago_id
      where pr.factura_id = v_factura.id
        and pr.estado = 'activo'
        and prr.retencion_id = v_retencion.id
    ) then
      raise exception 'la retención % ya está aplicada a esta factura', v_retencion.nombre using errcode = '22023';
    end if;

    v_base := case when v_retencion.tipo = 'itbis' then v_factura.itbis else v_factura.subtotal end;
    v_monto_retencion := round(v_base * v_retencion.porcentaje / 100, 2);

    if v_monto_retencion <= 0 then
      raise exception 'la retención % no genera monto sobre esta factura', v_retencion.nombre using errcode = '22023';
    end if;

    v_ids := array_append(v_ids, v_retencion.id);
    v_retenido_total := round(v_retenido_total + v_monto_retencion, 2);
  end loop;

  if v_factura.id is not null then
    v_saldo := round(v_factura.total - v_factura.pagado - v_factura.credito - v_factura.retenido, 2);
    if v_saldo <= 0 then
      raise exception 'la factura ya está pagada' using errcode = '22023';
    end if;

    v_total_aplicado := round(v_monto + v_retenido_total, 2);
    if v_total_aplicado > v_saldo then
      raise exception 'el monto más las retenciones excede el saldo pendiente de la factura' using errcode = '22023';
    end if;
  end if;

  insert into public.pagos_recibidos (
    contacto_id, factura_id, fecha, cuenta_id, metodo, monto, retenido, notas, creado_por
  )
  values (
    v_contacto.id,
    case when v_factura.id is null then null else v_factura.id end,
    v_fecha,
    v_cuenta.id,
    v_metodo,
    v_monto,
    v_retenido_total,
    p->>'notas',
    auth.uid()
  )
  returning id into v_pago_id;

  for v_item in select * from jsonb_array_elements(v_retenciones)
  loop
    select * into v_retencion
    from public.retenciones r
    where r.id = (v_item->>'retencion_id')::uuid;

    v_base := case when v_retencion.tipo = 'itbis' then v_factura.itbis else v_factura.subtotal end;
    v_monto_retencion := round(v_base * v_retencion.porcentaje / 100, 2);

    insert into public.pago_recibido_retenciones (pago_id, retencion_id, base, porcentaje, monto)
    values (v_pago_id, v_retencion.id, v_base, v_retencion.porcentaje, v_monto_retencion);
  end loop;

  v_lineas := jsonb_build_array(
    jsonb_build_object(
      'cuenta_id', v_cuenta.id,
      'debito', v_monto,
      'credito', 0,
      'descripcion', 'Pago recibido'
    )
  );

  for v_item in select * from jsonb_array_elements(v_retenciones)
  loop
    select * into v_retencion
    from public.retenciones r
    where r.id = (v_item->>'retencion_id')::uuid;

    v_base := case when v_retencion.tipo = 'itbis' then v_factura.itbis else v_factura.subtotal end;
    v_monto_retencion := round(v_base * v_retencion.porcentaje / 100, 2);
    v_cuenta_retencion := coalesce(
      v_retencion.cuenta_anticipo_id,
      public._cuenta_config('retencion_' || v_retencion.tipo || '_por_cobrar')
    );

    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', v_cuenta_retencion,
      'debito', v_monto_retencion,
      'credito', 0,
      'contacto_id', v_contacto.id,
      'descripcion', 'Retención ' || v_retencion.nombre
    ));
  end loop;

  v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
    'cuenta_id', coalesce(v_contacto.cuenta_cxc_id, public._cuenta_config('cxc')),
    'debito', 0,
    'credito', round(v_monto + v_retenido_total, 2),
    'contacto_id', v_contacto.id,
    'descripcion', 'Pago recibido'
  ));

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Pago recibido' || case when v_factura.id is null then '' else ' factura ' || v_factura.numero::text end,
    'pago_recibido',
    v_pago_id,
    v_lineas
  );

  update public.pagos_recibidos set asiento_id = v_asiento_id where id = v_pago_id;

  if v_factura.id is not null then
    v_nuevo_pagado := round(v_factura.pagado + v_monto, 2);
    v_nuevo_retenido := round(v_factura.retenido + v_retenido_total, 2);
    update public.facturas
    set pagado = v_nuevo_pagado,
        retenido = v_nuevo_retenido,
        estado = case
          when round(v_nuevo_pagado + v_nuevo_retenido + v_factura.credito, 2) >= v_factura.total then 'pagada'
          else 'abierta'
        end
    where id = v_factura.id;
  end if;

  return v_pago_id;
end;
$$;

create or replace function public.registrar_pago_proveedor(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_pago_id uuid;
  v_factura public.facturas_proveedor%rowtype;
  v_contacto public.contactos%rowtype;
  v_cuenta public.cuentas%rowtype;
  v_retencion public.retenciones%rowtype;
  v_retenciones jsonb;
  v_item jsonb;
  v_ids uuid[] := '{}';
  v_monto numeric(14,2);
  v_fecha date;
  v_metodo text;
  v_saldo numeric(14,2);
  v_nuevo_pagado numeric(14,2);
  v_nuevo_retenido numeric(14,2);
  v_retenido_total numeric(14,2) := 0;
  v_total_aplicado numeric(14,2);
  v_base numeric(14,2);
  v_monto_retencion numeric(14,2);
  v_cuenta_retencion uuid;
  v_asiento_id uuid;
  v_lineas jsonb;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del pago requeridos' using errcode = '22023';
  end if;

  if p->>'factura_proveedor_id' is null then
    raise exception 'la factura de proveedor es obligatoria' using errcode = '22023';
  end if;

  v_monto := round(coalesce((p->>'monto')::numeric, 0), 2);
  if v_monto <= 0 then
    raise exception 'el monto del pago debe ser mayor a cero' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_metodo := coalesce(nullif(p->>'metodo', ''), 'efectivo');
  if v_metodo not in ('efectivo', 'transferencia', 'tarjeta', 'cheque') then
    raise exception 'método de pago inválido' using errcode = '22023';
  end if;

  if p->>'cuenta_id' is null then
    raise exception 'la cuenta de caja o banco es obligatoria' using errcode = '22023';
  end if;

  select * into v_cuenta
  from public.cuentas c
  where c.id = (p->>'cuenta_id')::uuid and c.activa;

  if not found then
    raise exception 'cuenta de caja o banco no encontrada' using errcode = '22023';
  end if;
  if not v_cuenta.es_caja_banco then
    raise exception 'la cuenta del pago debe ser de caja o banco' using errcode = '22023';
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

  select * into v_contacto from public.contactos c where c.id = v_factura.contacto_id;

  select coalesce(p->'retenciones', '[]'::jsonb) into v_retenciones;
  if jsonb_typeof(v_retenciones) <> 'array' then
    raise exception 'las retenciones deben venir en una lista' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(v_retenciones)
  loop
    if v_item->>'retencion_id' is null then
      raise exception 'la retención es obligatoria' using errcode = '22023';
    end if;

    if (v_item->>'retencion_id')::uuid = any (v_ids) then
      raise exception 'la retención está repetida en el pago' using errcode = '22023';
    end if;

    select * into v_retencion
    from public.retenciones r
    where r.id = (v_item->>'retencion_id')::uuid and r.activa;

    if not found then
      raise exception 'retención no encontrada o inactiva' using errcode = '22023';
    end if;

    if exists (
      select 1
      from public.pago_proveedor_retenciones ppr
      join public.pagos_proveedor pp on pp.id = ppr.pago_id
      where pp.factura_proveedor_id = v_factura.id
        and pp.estado = 'activo'
        and ppr.retencion_id = v_retencion.id
    ) then
      raise exception 'la retención % ya está aplicada a esta factura', v_retencion.nombre using errcode = '22023';
    end if;

    v_base := case when v_retencion.tipo = 'itbis' then v_factura.itbis else v_factura.subtotal end;
    v_monto_retencion := round(v_base * v_retencion.porcentaje / 100, 2);

    if v_monto_retencion <= 0 then
      raise exception 'la retención % no genera monto sobre esta factura', v_retencion.nombre using errcode = '22023';
    end if;

    v_ids := array_append(v_ids, v_retencion.id);
    v_retenido_total := round(v_retenido_total + v_monto_retencion, 2);
  end loop;

  v_saldo := round(v_factura.total - v_factura.pagado - v_factura.credito - v_factura.retenido, 2);
  if v_saldo <= 0 then
    raise exception 'la factura de proveedor ya está pagada' using errcode = '22023';
  end if;

  v_total_aplicado := round(v_monto + v_retenido_total, 2);
  if v_total_aplicado > v_saldo then
    raise exception 'el monto más las retenciones excede el saldo pendiente de la factura de proveedor'
      using errcode = '22023';
  end if;

  insert into public.pagos_proveedor (
    factura_proveedor_id, contacto_id, fecha, cuenta_id, metodo, monto, retenido, notas, creado_por
  )
  values (
    v_factura.id, v_contacto.id, v_fecha, v_cuenta.id, v_metodo, v_monto, v_retenido_total,
    p->>'notas', auth.uid()
  )
  returning id into v_pago_id;

  for v_item in select * from jsonb_array_elements(v_retenciones)
  loop
    select * into v_retencion
    from public.retenciones r
    where r.id = (v_item->>'retencion_id')::uuid;

    v_base := case when v_retencion.tipo = 'itbis' then v_factura.itbis else v_factura.subtotal end;
    v_monto_retencion := round(v_base * v_retencion.porcentaje / 100, 2);

    insert into public.pago_proveedor_retenciones (pago_id, retencion_id, base, porcentaje, monto)
    values (v_pago_id, v_retencion.id, v_base, v_retencion.porcentaje, v_monto_retencion);
  end loop;

  v_lineas := jsonb_build_array(
    jsonb_build_object(
      'cuenta_id', coalesce(v_contacto.cuenta_cxp_id, public._cuenta_config('cxp')),
      'debito', v_total_aplicado,
      'credito', 0,
      'contacto_id', v_contacto.id,
      'descripcion', 'Pago a proveedor factura ' || v_factura.numero::text
    ),
    jsonb_build_object(
      'cuenta_id', v_cuenta.id,
      'debito', 0,
      'credito', v_monto,
      'descripcion', 'Pago a proveedor'
    )
  );

  for v_item in select * from jsonb_array_elements(v_retenciones)
  loop
    select * into v_retencion
    from public.retenciones r
    where r.id = (v_item->>'retencion_id')::uuid;

    v_base := case when v_retencion.tipo = 'itbis' then v_factura.itbis else v_factura.subtotal end;
    v_monto_retencion := round(v_base * v_retencion.porcentaje / 100, 2);
    v_cuenta_retencion := coalesce(
      v_retencion.cuenta_id,
      public._cuenta_config('retencion_' || v_retencion.tipo || '_por_pagar')
    );

    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', v_cuenta_retencion,
      'debito', 0,
      'credito', v_monto_retencion,
      'contacto_id', v_contacto.id,
      'descripcion', 'Retención ' || v_retencion.nombre
    ));
  end loop;

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Pago a proveedor factura ' || v_factura.numero::text,
    'pago_proveedor',
    v_pago_id,
    v_lineas
  );

  update public.pagos_proveedor set asiento_id = v_asiento_id where id = v_pago_id;

  v_nuevo_pagado := round(v_factura.pagado + v_monto, 2);
  v_nuevo_retenido := round(v_factura.retenido + v_retenido_total, 2);
  update public.facturas_proveedor
  set pagado = v_nuevo_pagado,
      retenido = v_nuevo_retenido,
      estado = case
        when round(v_nuevo_pagado + v_nuevo_retenido + v_factura.credito, 2) >= v_factura.total then 'pagada'
        else 'abierta'
      end
  where id = v_factura.id;

  return v_pago_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Anulación: revierte también el retenido de los pagos
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
  v_nuevo_retenido numeric(14,2);
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

    update public.facturas set estado = 'anulada', pagado = 0, retenido = 0 where id = p_id;

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
        v_nuevo_retenido := round(greatest(v_factura.retenido - v_pago.retenido, 0), 2);
        update public.facturas
        set pagado = v_nuevo_pagado,
            retenido = v_nuevo_retenido,
            estado = case
              when round(v_nuevo_pagado + v_nuevo_retenido + v_factura.credito, 2) >= v_factura.total then 'pagada'
              else 'abierta'
            end
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

    update public.facturas_proveedor
    set estado = 'anulada', pagado = 0, credito = 0, retenido = 0
    where id = p_id;

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
      v_nuevo_retenido := round(greatest(v_factura_prov.retenido - v_pago_prov.retenido, 0), 2);
      update public.facturas_proveedor
      set pagado = v_nuevo_pagado,
          retenido = v_nuevo_retenido,
          estado = case
            when round(v_nuevo_pagado + v_nuevo_retenido + v_factura_prov.credito, 2) >= v_factura_prov.total then 'pagada'
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
            when round(v_factura_prov.pagado + v_nuevo_credito + v_factura_prov.retenido, 2) >= v_factura_prov.total then 'pagada'
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
-- Permisos de funciones
-- ---------------------------------------------------------------------------

revoke all on function public.registrar_pago_recibido(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_pago_recibido(jsonb) to authenticated;

revoke all on function public.registrar_pago_proveedor(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_pago_proveedor(jsonb) to authenticated;

revoke all on function public.anular_documento(text, uuid) from public, anon, authenticated;
grant execute on function public.anular_documento(text, uuid) to authenticated;

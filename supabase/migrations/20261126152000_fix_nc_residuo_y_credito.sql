-- ---------------------------------------------------------------------------
-- Notas de crédito de venta: residuo de líneas parciales y límite de crédito
--
-- Bug A: el subtotal y el ITBIS de una línea parcial se prorratean con
-- redondeo a 2 decimales. Varias NC parciales sobre la misma línea acumulan
-- ±0.01: la última unidad puede quedar bloqueada porque el crédito total
-- supera el de la factura, o la factura queda abierta por RD$0.01. Cuando la
-- cantidad de la NC agota la línea (lo ya acreditado + esta cantidad es igual
-- a la cantidad de la factura), el subtotal y el ITBIS se toman como RESIDUO:
-- la línea original menos lo ya acreditado por las NC activas. Así la suma de
-- todas las NC cuadra exacta con la factura.
--
-- Bug B: una NC manual podía dejar `facturas.credito` mayor que
-- total - pagado - retenido, es decir, un saldo a favor silencioso que el
-- reporte de CxC no muestra. Ahora se rechaza, salvo que el llamador pida
-- explícitamente `permite_saldo_a_favor = true`. Ese es el caso de
-- `pos_crear_devolucion`, donde el reembolso se elige en pantalla (efectivo,
-- crédito a factura o combinado) y el saldo a favor del cliente es
-- intencional (docs/dominio-pos.md §3.11).
--
-- Se reemplazan completos `_crear_nota_credito_venta_sin_impuestos` (motor) y
-- `pos_crear_devolucion` (solo agrega la marca del reembolso explícito).
-- Grants, security definer y search_path quedan intactos.
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
  v_acreditado_subtotal numeric(14,2);
  v_acreditado_itbis numeric(14,2);
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
  v_credito_disponible numeric(14,2);
  v_permite_saldo_a_favor boolean;
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

    select
      round(coalesce(sum(nl.cantidad), 0), 2),
      round(coalesce(sum(nl.subtotal), 0), 2),
      round(coalesce(sum(nl.itbis), 0), 2)
    into v_acreditado, v_acreditado_subtotal, v_acreditado_itbis
    from public.nota_credito_venta_lineas nl
    join public.notas_credito_venta n on n.id = nl.nota_id
    where nl.factura_linea_id = v_factura_linea.id
      and n.factura_id = v_factura.id
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

    -- Si esta NC agota la línea, el monto es exactamente lo que falta por
    -- acreditar: la línea de la factura menos lo ya acreditado. Evita el
    -- ±0.01 de prorratear varias parciales y que la última unidad se bloquee.
    if round(v_acreditado + v_cantidad, 2) = round(v_factura_linea.cantidad, 2) then
      v_subtotal := greatest(round(v_factura_linea.subtotal - v_acreditado_subtotal, 2), 0);
      v_itbis := greatest(round(v_factura_linea.itbis - v_acreditado_itbis, 2), 0);
    else
      v_subtotal := round(
        round(v_cantidad * v_precio, 2) - round(round(v_cantidad * v_precio, 2) * v_descuento_pct / 100, 2),
        2
      );
      v_itbis := round(v_subtotal * v_itbis_tasa / 100, 2);
    end if;
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

  -- Sin reembolso explícito, la NC no puede dejar crédito por encima de lo
  -- que la factura todavía debe. El POS sí puede: elige el reembolso en
  -- pantalla y el excedente queda como saldo a favor del cliente.
  v_credito_disponible := round(v_factura.total - v_factura.pagado - v_factura.retenido, 2);
  v_permite_saldo_a_favor := coalesce(
    nullif(p->>'permite_saldo_a_favor', '')::boolean,
    false
  );
  if v_nuevo_credito > v_credito_disponible and not v_permite_saldo_a_favor then
    raise exception 'la nota dejaría un crédito de % sobre una factura con % pendiente',
      v_nuevo_credito, greatest(v_credito_disponible, 0)
      using errcode = '22023';
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
-- POS: la devolución marca el crédito como saldo a favor intencional
--
-- Mismo cuerpo vigente de `pos_crear_devolucion`; solo se agrega
-- `permite_saldo_a_favor` a la llamada del motor. El POS ya valida en pantalla
-- el tipo de reembolso y que el efectivo no exceda lo pagado.
-- ---------------------------------------------------------------------------

create or replace function public.pos_crear_devolucion(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_terminal public.pos_terminales%rowtype;
  v_terminal_id uuid;
  v_turno public.pos_turnos%rowtype;
  v_turno_id uuid;
  v_factura public.facturas%rowtype;
  v_factura_id uuid;
  v_tipo_reembolso text;
  v_monto_efectivo numeric(14,2);
  v_monto_efectivo_informado boolean;
  v_cuenta_reembolso_id uuid;
  v_cuenta_reembolso public.cuentas%rowtype;
  v_esperado numeric(14,2);
  v_devuelto_previo numeric(14,2);
  v_pagado_disponible numeric(14,2);
  v_nota_id uuid;
  v_nota public.notas_credito_venta%rowtype;
  v_lineas jsonb;
  v_lineas_json jsonb := '[]'::jsonb;
  v_cuenta_cxc uuid;
  v_asiento_id uuid;
  v_total numeric(14,2);
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la devolución requeridos' using errcode = '22023';
  end if;

  v_terminal_id := nullif(p->>'terminal_id', '')::uuid;
  if v_terminal_id is null then
    raise exception 'la terminal no existe o está inactiva' using errcode = '22023';
  end if;

  select * into v_terminal
  from public.pos_terminales t
  where t.id = v_terminal_id
  for share;

  if not found or not v_terminal.activa then
    raise exception 'la terminal no existe o está inactiva' using errcode = '22023';
  end if;

  v_turno_id := nullif(p->>'turno_id', '')::uuid;
  if v_turno_id is not null then
    select * into v_turno
    from public.pos_turnos t
    where t.id = v_turno_id and t.terminal_id = v_terminal_id
    for update;

    if not found then
      raise exception 'el turno no pertenece a la terminal' using errcode = '22023';
    end if;
    if v_turno.estado <> 'abierto' then
      raise exception 'el turno ya está cerrado' using errcode = '22023';
    end if;
  else
    select * into v_turno
    from public.pos_turnos t
    where t.terminal_id = v_terminal_id and t.estado = 'abierto'
    order by t.abierto_en
    limit 1
    for update;

    if not found then
      raise exception 'no hay un turno abierto en la terminal %', v_terminal.nombre
        using errcode = '22023';
    end if;
    v_turno_id := v_turno.id;
  end if;

  v_factura_id := nullif(p->>'factura_id', '')::uuid;
  if v_factura_id is null then
    raise exception 'la factura no existe o está anulada' using errcode = '22023';
  end if;

  select * into v_factura
  from public.facturas f
  where f.id = v_factura_id
  for update;

  if not found or v_factura.estado = 'anulada' then
    raise exception 'la factura no existe o está anulada' using errcode = '22023';
  end if;

  if not (p ? 'lineas') or jsonb_typeof(p->'lineas') <> 'array' or jsonb_array_length(p->'lineas') = 0 then
    raise exception 'la devolución requiere al menos una línea' using errcode = '22023';
  end if;

  v_tipo_reembolso := nullif(btrim(coalesce(p->>'tipo_reembolso', '')), '');
  if v_tipo_reembolso is null
     or v_tipo_reembolso not in ('credito_factura', 'efectivo', 'combinado') then
    raise exception 'el tipo de reembolso no es válido' using errcode = '22023';
  end if;

  v_monto_efectivo_informado := p ? 'monto_reembolso_efectivo'
    and p->'monto_reembolso_efectivo' is not null
    and jsonb_typeof(p->'monto_reembolso_efectivo') <> 'null';

  v_monto_efectivo := case
    when v_monto_efectivo_informado then public._pos_monto(p->>'monto_reembolso_efectivo')
    else null
  end;

  if v_tipo_reembolso = 'credito_factura' then
    if coalesce(v_monto_efectivo, 0) <> 0 then
      raise exception 'el reembolso con crédito a factura no puede incluir efectivo'
        using errcode = '22023';
    end if;
    v_cuenta_reembolso_id := null;
  else
    v_cuenta_reembolso_id := coalesce(
      nullif(p->>'cuenta_reembolso_id', '')::uuid,
      v_terminal.cuenta_efectivo_id
    );

    if v_cuenta_reembolso_id <> v_terminal.cuenta_efectivo_id then
      raise exception 'la cuenta de reembolso debe ser la cuenta de efectivo de la terminal'
        using errcode = '22023';
    end if;

    select * into v_cuenta_reembolso
    from public.cuentas c
    where c.id = v_cuenta_reembolso_id and c.activa;

    if not found then
      raise exception 'la cuenta de reembolso debe ser la cuenta de efectivo de la terminal'
        using errcode = '22023';
    end if;

    if v_tipo_reembolso = 'combinado' and coalesce(v_monto_efectivo, 0) <= 0 then
      raise exception 'el reembolso combinado requiere efectivo y crédito mayores a cero'
        using errcode = '22023';
    end if;
  end if;

  v_esperado := (public._pos_resumen(v_turno_id)->'efectivo'->>'efectivo_esperado')::numeric;

  select coalesce(sum(n.monto_reembolso_efectivo), 0)
  into v_devuelto_previo
  from public.notas_credito_venta n
  where n.factura_id = v_factura_id and n.estado = 'activa';

  v_pagado_disponible := round(v_factura.pagado - v_devuelto_previo, 2);

  -- Validaciones previas con el monto informado (el total se conoce tras la NC).
  if v_monto_efectivo is not null and v_monto_efectivo > 0 and v_tipo_reembolso <> 'credito_factura' then
    if v_monto_efectivo > v_pagado_disponible then
      raise exception 'el efectivo devuelto no puede exceder lo pagado en la factura'
        using errcode = '22023';
    end if;
    if v_monto_efectivo > v_esperado then
      raise exception 'el efectivo devuelto no puede exceder el efectivo disponible en la caja'
        using errcode = '22023';
    end if;
  end if;

  v_nota_id := public.crear_nota_credito_venta(jsonb_build_object(
    'factura_id', v_factura_id,
    'fecha', coalesce((p->>'fecha')::date, current_date),
    'notas', nullif(btrim(coalesce(p->>'notas', '')), ''),
    'devuelve_inventario', true,
    'almacen_id', v_terminal.almacen_id,
    'permite_saldo_a_favor', true,
    'lineas', p->'lineas'
  ));

  select * into v_nota
  from public.notas_credito_venta n
  where n.id = v_nota_id;

  v_total := v_nota.total;

  if v_tipo_reembolso = 'credito_factura' then
    v_monto_efectivo := 0;
  elsif v_tipo_reembolso = 'efectivo' then
    if v_monto_efectivo is null then
      v_monto_efectivo := v_total;
    end if;
    if v_monto_efectivo <> v_total then
      raise exception 'el reembolso en efectivo debe ser igual al total de la devolución'
        using errcode = '22023';
    end if;
  else
    if v_monto_efectivo is null or v_monto_efectivo <= 0 or v_monto_efectivo >= v_total then
      raise exception 'el reembolso combinado requiere efectivo y crédito mayores a cero'
        using errcode = '22023';
    end if;
  end if;

  if v_monto_efectivo > v_total then
    raise exception 'el reembolso en efectivo no puede exceder el total de la devolución'
      using errcode = '22023';
  end if;
  if v_monto_efectivo > 0 and v_monto_efectivo > v_pagado_disponible then
    raise exception 'el efectivo devuelto no puede exceder lo pagado en la factura'
      using errcode = '22023';
  end if;
  if v_monto_efectivo > 0 and v_monto_efectivo > v_esperado then
    raise exception 'el efectivo devuelto no puede exceder el efectivo disponible en la caja'
      using errcode = '22023';
  end if;

  update public.notas_credito_venta n
  set turno_id = v_turno_id,
      tipo_reembolso = v_tipo_reembolso,
      monto_reembolso_efectivo = v_monto_efectivo,
      cuenta_reembolso_id = v_cuenta_reembolso_id
  where n.id = v_nota_id;

  if v_monto_efectivo > 0 then
    select coalesce(c.cuenta_cxc_id, public._cuenta_config('cxc'))
    into v_cuenta_cxc
    from public.contactos c
    where c.id = v_nota.contacto_id;

    v_asiento_id := public._crear_asiento(
      coalesce(v_nota.fecha, current_date),
      'Reembolso en efectivo NC ' || v_nota.ncf,
      'nota_credito_venta',
      v_nota_id,
      jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', coalesce(v_cuenta_cxc, public._cuenta_config('cxc')),
          'debito', v_monto_efectivo,
          'credito', 0,
          'contacto_id', v_nota.contacto_id,
          'centro_costo_id', v_terminal.centro_costo_id,
          'descripcion', 'Reembolso en efectivo NC ' || v_nota.ncf
        ),
        jsonb_build_object(
          'cuenta_id', v_cuenta_reembolso_id,
          'debito', 0,
          'credito', v_monto_efectivo,
          'centro_costo_id', v_terminal.centro_costo_id,
          'descripcion', 'Reembolso en efectivo NC ' || v_nota.ncf
        )
      )
    );
  end if;

  -- La parte reembolsada en efectivo deja de ser crédito a favor de la
  -- factura: la NC la acreditó a CxC y el asiento anterior la debitó, así que
  -- el submayor de la factura debe bajar igual para no divergir del mayor.
  if v_monto_efectivo > 0 then
    update public.facturas f
    set credito = round(f.credito - v_monto_efectivo, 2),
        estado = case
          when round(f.pagado + (f.credito - v_monto_efectivo), 2) >= f.total then 'pagada'
          else 'abierta'
        end
    where f.id = v_factura_id;
  end if;

  select * into v_nota
  from public.notas_credito_venta n
  where n.id = v_nota_id;

  select * into v_factura
  from public.facturas f
  where f.id = v_factura_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'factura_linea_id', nl.factura_linea_id,
    'producto_id', nl.producto_id,
    'descripcion', nl.descripcion,
    'cantidad', nl.cantidad,
    'unidad_nombre', nl.unidad_nombre,
    'factor_base', nl.factor_base,
    'precio', nl.precio,
    'descuento_pct', nl.descuento_pct,
    'itbis_tasa', nl.itbis_tasa,
    'subtotal', nl.subtotal,
    'itbis', nl.itbis,
    'total', nl.total,
    'costo_unitario', nl.costo_unitario
  ) order by nl.id), '[]'::jsonb)
  into v_lineas_json
  from public.nota_credito_venta_lineas nl
  where nl.nota_id = v_nota_id;

  return jsonb_build_object(
    'nota', jsonb_build_object(
      'id', v_nota.id,
      'numero', v_nota.numero,
      'ncf', v_nota.ncf,
      'factura_id', v_nota.factura_id,
      'contacto_id', v_nota.contacto_id,
      'fecha', v_nota.fecha,
      'subtotal', v_nota.subtotal,
      'itbis', v_nota.itbis,
      'total', v_nota.total,
      'estado', v_nota.estado,
      'devuelve_inventario', v_nota.devuelve_inventario,
      'tipo_reembolso', v_nota.tipo_reembolso,
      'monto_reembolso_efectivo', v_nota.monto_reembolso_efectivo,
      'cuenta_reembolso_id', v_nota.cuenta_reembolso_id,
      'turno_id', v_nota.turno_id,
      'notas', v_nota.notas,
      'asiento_id', v_nota.asiento_id,
      'asiento_reembolso_id', v_asiento_id
    ),
    'factura', jsonb_build_object(
      'id', v_factura.id,
      'numero', v_factura.numero,
      'ncf', v_factura.ncf,
      'total', v_factura.total,
      'pagado', v_factura.pagado,
      'credito', v_factura.credito,
      'estado', v_factura.estado,
      'saldo', round(v_factura.total - v_factura.pagado - v_factura.retenido - v_factura.credito, 2)
    ),
    'contacto', (
      select to_jsonb(c) from public.contactos c where c.id = v_nota.contacto_id
    ),
    'empresa', public._pos_empresa(),
    'terminal', jsonb_build_object(
      'id', v_terminal.id,
      'nombre', v_terminal.nombre,
      'plantilla_ticket', v_terminal.plantilla_ticket
    ),
    'turno', jsonb_build_object(
      'id', v_turno.id,
      'numero', v_turno.numero,
      'estado', v_turno.estado
    ),
    'lineas', v_lineas_json,
    'reembolso', jsonb_build_object(
      'tipo', v_tipo_reembolso,
      'efectivo', v_monto_efectivo,
      'credito', round(v_total - v_monto_efectivo, 2),
      'cuenta_id', v_cuenta_reembolso_id,
      'cuenta_nombre', (
        select c.nombre from public.cuentas c where c.id = v_cuenta_reembolso_id
      )
    ),
    'totales', jsonb_build_object(
      'subtotal', v_nota.subtotal,
      'itbis', v_nota.itbis,
      'total', v_nota.total,
      'efectivo', v_monto_efectivo,
      'credito', round(v_total - v_monto_efectivo, 2)
    ),
    'resumen', public._pos_resumen(v_turno_id)
  );
end;
$$;

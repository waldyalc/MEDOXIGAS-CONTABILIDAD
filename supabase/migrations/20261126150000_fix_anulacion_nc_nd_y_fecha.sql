-- ---------------------------------------------------------------------------
-- Anulación: facturas con notas activas, notas de crédito/débito de venta y
-- fecha real del asiento de reversa
--
-- Auditoría de main (26-11-2026). Tres defectos:
--
-- · A [Blocker]: anular una factura con notas de crédito o débito de venta
--   activas duplicaba la reposición de stock y la reversión contable (la NC
--   ya devolvió existencias y acreditó CxC) y dejaba facturas.credito > 0.
--   Ahora se rechaza con P0001 y, al anular, la factura queda con credito = 0.
--
-- · B [High]: anular_documento no soportaba nota_credito_venta ni
--   nota_debito_venta. Las dos ramas nuevas revierten exactamente lo que crean
--   _crear_nota_credito_venta_sin_impuestos y crear_nota_debito_venta:
--   el asiento del documento, la devolución de inventario de la NC (solo si
--   devuelve_inventario) y facturas.credito/estado. La ND no toca inventario
--   ni el saldo de la factura, así que solo revierte el asiento.
--
-- · C [High]: la fecha de anulación podía ser anterior a la del documento y el
--   asiento de reversa se fechaba con current_date (UTC). Ahora se valida
--   contra facturas.fecha / gastos_menores.fecha / notas_*.fecha, se exige el
--   periodo contable abierto y el asiento de reversa (factura, factura de
--   proveedor, gasto menor, NC y ND) usa esa fecha. El movimiento de
--   inventario no tiene fecha propia: solo el asiento queda fechado.
--
-- notas_debito_venta gana fecha_anulacion y motivo_anulacion_id (aditivo),
-- para guardar el motivo del 608 igual que la nota de crédito.
--
-- create or replace de _anular_documento_ajustes (firma nueva con p_fecha) y
-- anular_documento. No borra ni cambia datos existentes; los llamados sin
-- p_info mantienen el comportamiento anterior.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Trazabilidad de anulación de la nota de débito de venta
-- ---------------------------------------------------------------------------

alter table public.notas_debito_venta
  add column if not exists fecha_anulacion date,
  add column if not exists motivo_anulacion_id uuid references public.motivos_anulacion (id);

-- ---------------------------------------------------------------------------
-- _anular_documento_ajustes: agrega p_fecha y las ramas de venta
--
-- Cuerpo copiado de 20261125101000_inventario_ferreteria_motor.sql. La firma
-- pasa a (text, uuid, date): se elimina la versión de dos argumentos (era
-- interna y solo la llamaba anular_documento).
-- ---------------------------------------------------------------------------

drop function if exists public._anular_documento_ajustes(text, uuid);

create or replace function public._anular_documento_ajustes(
  p_tipo text,
  p_id uuid,
  p_fecha date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_factura public.facturas%rowtype;
  v_factura_prov public.facturas_proveedor%rowtype;
  v_nota_credito public.notas_credito_venta%rowtype;
  v_nota_credito_linea public.nota_credito_venta_lineas%rowtype;
  v_nota_debito public.notas_debito_venta%rowtype;
  v_gasto public.gastos_menores%rowtype;
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
  v_nuevo_credito numeric(14,2);
begin
  if p_tipo is null or p_tipo not in (
    'factura', 'factura_proveedor', 'nota_credito_venta', 'nota_debito_venta',
    'gasto_menor'
  ) then
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
    if exists (
      select 1 from public.notas_credito_venta nc
      where nc.factura_id = p_id and nc.estado = 'activa'
    ) or exists (
      select 1 from public.notas_debito_venta nd
      where nd.factura_id = p_id and nd.estado = 'activa'
    ) then
      raise exception 'no se puede anular una factura con notas de crédito o débito activas'
        using errcode = 'P0001';
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

    update public.facturas
    set estado = 'anulada', pagado = 0, retenido = 0, credito = 0
    where id = p_id;

  elsif p_tipo = 'nota_credito_venta' then
    select * into v_nota_credito
    from public.notas_credito_venta n
    where n.id = p_id
    for update;

    if not found then
      raise exception 'nota de crédito no encontrada' using errcode = '22023';
    end if;
    if v_nota_credito.estado = 'anulada' then
      raise exception 'la nota de crédito ya está anulada' using errcode = '22023';
    end if;

    -- Espejo de la creación: si la nota devolvió inventario, se retira otra vez.
    if v_nota_credito.devuelve_inventario then
      v_almacen_id := coalesce(v_nota_credito.almacen_id, public._almacen_principal());

      for v_nota_credito_linea in
        select * from public.nota_credito_venta_lineas nl
        where nl.nota_id = p_id
        order by nl.id
      loop
        if v_nota_credito_linea.producto_id is null then
          continue;
        end if;

        select pr.tipo, pr.inventariable
        into v_producto_tipo, v_producto_inventariable
        from public.productos pr
        where pr.id = v_nota_credito_linea.producto_id;

        if not found then
          continue;
        end if;

        v_cantidad_base := round(
          v_nota_credito_linea.cantidad * coalesce(v_nota_credito_linea.factor_base, 1),
          2
        );

        if v_producto_tipo = 'combo' then
          perform public._mover_combo_existencia(
            v_nota_credito_linea.producto_id, v_almacen_id, -v_cantidad_base
          );
        elsif v_producto_inventariable then
          perform public._mover_existencia(
            v_nota_credito_linea.producto_id, v_almacen_id, -v_cantidad_base
          );
        end if;
      end loop;
    end if;

    -- Espejo de la creación: la NC sumó su total al crédito de la factura.
    select * into v_factura
    from public.facturas f
    where f.id = v_nota_credito.factura_id
    for update;

    if found and v_factura.estado <> 'anulada' then
      v_nuevo_credito := round(greatest(v_factura.credito - v_nota_credito.total, 0), 2);
      update public.facturas
      set credito = v_nuevo_credito,
          estado = case
            when round(v_factura.pagado + v_factura.retenido + v_nuevo_credito, 2) >= v_factura.total then 'pagada'
            else 'abierta'
          end
      where id = v_factura.id;
    end if;

    v_asiento_id := v_nota_credito.asiento_id;
    v_numero := v_nota_credito.numero;

    update public.notas_credito_venta set estado = 'anulada' where id = p_id;

  elsif p_tipo = 'nota_debito_venta' then
    select * into v_nota_debito
    from public.notas_debito_venta n
    where n.id = p_id
    for update;

    if not found then
      raise exception 'nota de débito no encontrada' using errcode = '22023';
    end if;
    if v_nota_debito.estado = 'anulada' then
      raise exception 'la nota de débito ya está anulada' using errcode = '22023';
    end if;

    -- La ND no mueve inventario ni el saldo de la factura: solo el asiento.
    v_asiento_id := v_nota_debito.asiento_id;
    v_numero := v_nota_debito.numero;

    update public.notas_debito_venta set estado = 'anulada' where id = p_id;

  elsif p_tipo = 'gasto_menor' then
    select * into v_gasto
    from public.gastos_menores gm
    where gm.id = p_id
    for update;

    if not found then
      raise exception 'gasto menor no encontrado' using errcode = '22023';
    end if;
    if v_gasto.estado = 'anulado' then
      raise exception 'el gasto menor ya está anulado' using errcode = '22023';
    end if;

    v_asiento_id := v_gasto.asiento_id;
    v_numero := v_gasto.numero;

    update public.gastos_menores set estado = 'anulado' where id = p_id;

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
    coalesce(p_fecha, current_date),
    'Anulación ' || p_tipo || ' #' || coalesce(v_numero::text, ''),
    'anulacion',
    p_id,
    v_lineas
  );

  update public.asientos set anula_asiento_id = v_asiento_id where id = v_reversion_id;

  return p_id;
end;
$$;

revoke all on function public._anular_documento_ajustes(text, uuid, date)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- anular_documento: NC/ND de venta, fecha del documento y periodo abierto
-- ---------------------------------------------------------------------------

create or replace function public.anular_documento(
  p_tipo text,
  p_id uuid,
  p_info jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_fecha_texto text;
  v_motivo_texto text;
  v_fecha date;
  v_motivo_id uuid;
  v_doc_fecha date;
  v_mes date;
  v_resultado uuid;
begin
  -- Compatibilidad total: sin p_info se comporta igual que antes.
  if p_info is null or jsonb_typeof(p_info) = 'null' then
    return public._anular_documento_ajustes(p_tipo, p_id);
  end if;

  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_tipo is null or p_tipo not in (
    'factura', 'gasto_menor', 'nota_credito_venta', 'nota_debito_venta'
  ) then
    raise exception 'El tipo de documento no admite fecha y motivo de anulación.'
      using errcode = '22023';
  end if;

  v_fecha_texto := coalesce(
    nullif(p_info->>'fecha', ''),
    nullif(p_info->>'fecha_anulacion', '')
  );
  if v_fecha_texto is null or v_fecha_texto !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'La fecha de anulación no es válida.' using errcode = '22023';
  end if;

  begin
    v_fecha := v_fecha_texto::date;
  exception
    when others then
      raise exception 'La fecha de anulación no es válida.' using errcode = '22023';
  end;

  if v_fecha > current_date then
    raise exception 'La fecha de anulación no puede ser futura.' using errcode = '22023';
  end if;

  -- La anulación no puede fecharse antes del documento: eso movería la
  -- reversión a un periodo anterior al hecho y descuadraría el 608.
  if p_tipo = 'factura' then
    select f.fecha into v_doc_fecha from public.facturas f where f.id = p_id;
  elsif p_tipo = 'gasto_menor' then
    select g.fecha into v_doc_fecha from public.gastos_menores g where g.id = p_id;
  elsif p_tipo = 'nota_credito_venta' then
    select n.fecha into v_doc_fecha from public.notas_credito_venta n where n.id = p_id;
  else
    select n.fecha into v_doc_fecha from public.notas_debito_venta n where n.id = p_id;
  end if;

  if v_doc_fecha is not null and v_fecha < v_doc_fecha then
    raise exception 'La fecha de anulación no puede ser anterior a la fecha del documento.'
      using errcode = '22023';
  end if;

  -- Mismo candado que el trigger asientos_periodo_abierto, adelantado aquí
  -- para no mutar el documento antes de fallar.
  v_mes := date_trunc('month', v_fecha)::date;
  if exists (
    select 1
    from public.periodos_contables p
    where p.periodo = v_mes and p.estado = 'cerrado'
  ) then
    raise exception 'el periodo % está cerrado; no se pueden crear ni anular asientos con esa fecha',
      to_char(v_mes, 'YYYY-MM')
      using errcode = '23514';
  end if;

  v_motivo_texto := coalesce(
    nullif(p_info->>'motivo', ''),
    nullif(p_info->>'motivo_anulacion_id', '')
  );
  if v_motivo_texto is null then
    raise exception 'El motivo de anulación no existe o está inactivo.' using errcode = '22023';
  end if;

  begin
    v_motivo_id := v_motivo_texto::uuid;
  exception
    when others then
      raise exception 'El motivo de anulación no existe o está inactivo.' using errcode = '22023';
  end;

  if not exists (
    select 1
    from public.motivos_anulacion m
    where m.id = v_motivo_id and m.activo
  ) then
    raise exception 'El motivo de anulación no existe o está inactivo.' using errcode = '22023';
  end if;

  -- Anulación real con la fecha capturada: estado, existencias y asiento de
  -- reversa (fechado con v_fecha, no con current_date).
  v_resultado := public._anular_documento_ajustes(p_tipo, p_id, v_fecha);

  if p_tipo = 'factura' then
    update public.facturas
    set fecha_anulacion = v_fecha,
        motivo_anulacion_id = v_motivo_id
    where id = p_id;
  elsif p_tipo = 'gasto_menor' then
    update public.gastos_menores
    set fecha_anulacion = v_fecha,
        motivo_anulacion_id = v_motivo_id
    where id = p_id;
  elsif p_tipo = 'nota_credito_venta' then
    update public.notas_credito_venta
    set fecha_anulacion = v_fecha,
        motivo_anulacion_id = v_motivo_id
    where id = p_id;
  else
    update public.notas_debito_venta
    set fecha_anulacion = v_fecha,
        motivo_anulacion_id = v_motivo_id
    where id = p_id;
  end if;

  return v_resultado;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

revoke all on function public.anular_documento(text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.anular_documento(text, uuid, jsonb) to authenticated;

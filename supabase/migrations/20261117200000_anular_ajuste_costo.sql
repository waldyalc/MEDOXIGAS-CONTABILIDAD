-- ---------------------------------------------------------------------------
-- Anulación de ajustes de inventario: revierte el costo promedio de las entradas
--
-- La creación de un ajuste de entrada pondera el costo:
--   costo_nuevo = (cantidad_actual * costo_actual + cantidad * costo_linea)
--                 / (cantidad_actual + cantidad)
-- Pero anular_documento solo devolvía la cantidad; el costo quedaba inflado.
-- Esta migración envuelve la anulación vigente y, solo para
-- 'ajuste_inventario', deshace la ponderación con la fórmula inversa. Las
-- salidas no tocan el costo (la creación tampoco lo hace).
--
-- Migración aditiva: no cambia datos existentes ni el resto de documentos.
-- La anulación de compras ya revierte el costo desde 20261113270000.
-- ---------------------------------------------------------------------------

alter function public.anular_documento(text, uuid)
  rename to _anular_documento_base;

revoke all on function public._anular_documento_base(text, uuid)
  from public, anon, authenticated;

create or replace function public.anular_documento(p_tipo text, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_ajuste public.ajustes_inventario%rowtype;
  v_linea public.ajuste_inventario_lineas%rowtype;
  v_cantidad_actual numeric(14,2);
  v_costo_actual numeric(14,2);
  v_cantidad_nueva numeric(14,2);
  v_costo_nuevo numeric(14,2);
  v_asiento public.asientos%rowtype;
  v_lineas jsonb;
  v_reversion_id uuid;
begin
  if p_tipo is distinct from 'ajuste_inventario' then
    return public._anular_documento_base(p_tipo, p_id);
  end if;

  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_id is null then
    raise exception 'el documento es obligatorio' using errcode = '22023';
  end if;

  select * into v_ajuste
  from public.ajustes_inventario ai
  where ai.id = p_id
  for update;

  if not found then
    raise exception 'ajuste de inventario no encontrado' using errcode = '22023';
  end if;
  if v_ajuste.estado = 'anulada' then
    raise exception 'el ajuste de inventario ya está anulado' using errcode = '22023';
  end if;

  for v_linea in
    select * from public.ajuste_inventario_lineas ail
    where ail.ajuste_id = p_id
    order by ail.id
  loop
    if v_linea.tipo = 'entrada' then
      select pr.cantidad, pr.costo
      into v_cantidad_actual, v_costo_actual
      from public.productos pr
      where pr.id = v_linea.producto_id
      for update;

      v_cantidad_nueva := v_cantidad_actual - v_linea.cantidad;

      if v_cantidad_nueva > 0 then
        v_costo_nuevo := round(
          greatest(
            v_cantidad_actual * v_costo_actual - v_linea.cantidad * v_linea.costo_unitario,
            0
          ) / v_cantidad_nueva,
          2
        );
      elsif v_cantidad_nueva = 0 then
        v_costo_nuevo := 0;
      else
        v_costo_nuevo := v_costo_actual;
      end if;

      perform public._mover_existencia(
        v_linea.producto_id, v_ajuste.almacen_id, -v_linea.cantidad
      );

      update public.productos
      set costo = v_costo_nuevo
      where id = v_linea.producto_id;
    else
      perform public._mover_existencia(
        v_linea.producto_id, v_ajuste.almacen_id, v_linea.cantidad
      );
    end if;
  end loop;

  if v_ajuste.asiento_id is null then
    raise exception 'el documento no tiene asiento contable' using errcode = '22023';
  end if;

  select * into v_asiento
  from public.asientos a
  where a.id = v_ajuste.asiento_id;

  if not found then
    raise exception 'asiento no encontrado' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.asientos a where a.anula_asiento_id = v_ajuste.asiento_id
  ) then
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
  where l.asiento_id = v_ajuste.asiento_id;

  if v_lineas is null or jsonb_array_length(v_lineas) < 2 then
    raise exception 'el asiento no tiene líneas para revertir' using errcode = '22023';
  end if;

  v_reversion_id := public._crear_asiento(
    current_date,
    'Anulación ajuste_inventario #' || coalesce(v_ajuste.numero::text, ''),
    'anulacion',
    p_id,
    v_lineas
  );

  update public.asientos
  set anula_asiento_id = v_ajuste.asiento_id
  where id = v_reversion_id;

  update public.ajustes_inventario set estado = 'anulada' where id = p_id;

  return p_id;
end;
$$;

revoke all on function public.anular_documento(text, uuid)
  from public, anon, authenticated;
grant execute on function public.anular_documento(text, uuid) to authenticated;

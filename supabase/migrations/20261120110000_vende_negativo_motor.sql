-- ---------------------------------------------------------------------------
-- Control de stock en la venta: productos.vende_negativo
--
-- crear_factura descuenta la existencia sin validar nada: hoy se puede vender
-- sin stock siempre. Esta migración envuelve la función vigente con el patrón
-- de 20261115701000 (impuestos) y 20261117200000 (anulación de ajustes):
--
--   crear_factura → _crear_factura_sin_control_stock (antes, la de impuestos)
--
-- El wrapper revisa ANTES de consumir numeración o escribir ninguna fila que
-- cada producto inventariable con vende_negativo = false tenga existencia
-- suficiente en el almacén del documento (p.almacen_id, o el principal si no
-- viene). La cantidad exigida es la suma de las líneas de ese producto, con el
-- mismo redondeo por línea que usa el motor. Servicios y productos no
-- inventariables nunca se controlan; vende_negativo = true deja vender sin
-- existencia. Las líneas con cantidad <= 0 no se suman: el motor lanza su
-- error de siempre ('la cantidad debe ser mayor a cero').
--
-- La fila de existencias se toma con FOR UPDATE (como
-- crear_transferencia_inventario) recorriendo los productos en orden fijo,
-- para que dos facturas concurrentes no pasen ambas con el último stock.
--
-- Migración aditiva y reintentable: el guard de la columna la crea solo si la
-- migración del frente de productos no está aplicada todavía.
-- ---------------------------------------------------------------------------

alter table public.productos
  add column if not exists vende_negativo boolean not null default false;

do $$
begin
  if to_regprocedure('public.crear_factura(jsonb)') is not null
     and to_regprocedure('public._crear_factura_sin_control_stock(jsonb)') is null then
    alter function public.crear_factura(jsonb) rename to _crear_factura_sin_control_stock;
  end if;
end;
$$;

revoke all on function public._crear_factura_sin_control_stock(jsonb)
  from public, anon, authenticated;

create or replace function public.crear_factura(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_almacen_id uuid;
  v_producto_id uuid;
  v_producto_nombre text;
  v_inventariable boolean;
  v_vende_negativo boolean;
  v_requerido numeric(14,2);
  v_disponible numeric(14,2);
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  -- sin líneas no hay nada que controlar: el motor levanta sus errores de
  -- siempre (datos requeridos, al menos una línea)
  if p is null or jsonb_typeof(p->'lineas') <> 'array' then
    return public._crear_factura_sin_control_stock(p);
  end if;

  -- el mismo almacén que usará el motor: el del documento o el principal
  v_almacen_id := nullif(p->>'almacen_id', '')::uuid;
  if v_almacen_id is null then
    v_almacen_id := public._almacen_principal();
  end if;

  -- almacén inválido o sin almacenes: el motor lanza su error de siempre
  if v_almacen_id is null
     or not exists (select 1 from public.almacenes al where al.id = v_almacen_id and al.activo) then
    return public._crear_factura_sin_control_stock(p);
  end if;

  -- recorre los productos vendidos en orden fijo (por id) sumando las
  -- cantidades de sus líneas: dos líneas del mismo producto suman
  for v_producto_id, v_requerido in
    select (l->>'producto_id')::uuid, sum(round((l->>'cantidad')::numeric, 2))
    from jsonb_array_elements(p->'lineas') as l
    where nullif(l->>'producto_id', '') is not null
      and coalesce((l->>'cantidad')::numeric, 0) > 0
    group by (l->>'producto_id')::uuid
    order by 1
  loop
    select pr.nombre, pr.inventariable, pr.vende_negativo
      into v_producto_nombre, v_inventariable, v_vende_negativo
      from public.productos pr
      where pr.id = v_producto_id and pr.activo;

    -- producto inactivo o inexistente: el motor lanza 'producto no
    -- encontrado'; servicios y no inventariables nunca se controlan
    if v_inventariable and not coalesce(v_vende_negativo, false) then
      -- sin fila en existencias la cantidad disponible es 0; el FOR UPDATE
      -- serializa contra otra factura o ajuste concurrente del mismo stock
      select e.cantidad into v_disponible
      from public.existencias e
      where e.producto_id = v_producto_id and e.almacen_id = v_almacen_id
      for update;

      if coalesce(v_disponible, 0) < v_requerido then
        raise exception 'no hay existencia suficiente del producto %', v_producto_nombre
          using errcode = '22023';
      end if;
    end if;
  end loop;

  return public._crear_factura_sin_control_stock(p);
end;
$$;

revoke all on function public.crear_factura(jsonb) from public, anon, authenticated;
grant execute on function public.crear_factura(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Numeraciones: el último NCF emitido incluye las notas B03/B04 (F16)
--
-- Migración aditiva y reintentable: no borra ni cambia datos existentes.
-- actualizar_numeracion conserva su firma (p jsonb) y su comportamiento para
-- B01/B02/B13/B14/B15/B16; solo amplía el cálculo de "último NCF emitido".
--
-- Series propias por tabla:
--   · notas_debito_venta   -> numeración 03 / B03 (la consume la RPC).
--   · notas_credito_venta  -> numeración 04 / B04 (la consume la RPC).
--   · notas_credito_compra -> filas viejas con B03 (la consumían antes de
--     20261114700000). Desde esa migración su NCF es el del PROVEEDOR
--     (B04/E34), ajeno a nuestras series: por eso solo se mira cuando la
--     numeración que se edita es la 03. Mirarla siempre haría que un B04 de
--     un proveedor bloqueara la serie B04 propia.
--
-- Unicidad: NO se agrega un unique nuevo. Hoy cada tabla ya tiene unique(ncf)
-- (facturas, gastos_menores, notas_credito_venta, notas_debito_venta y
-- notas_credito_compra). Falta unicidad ENTRE tablas, que un índice
-- (tipo_comprobante, ncf) no puede dar: las tablas de notas no tienen
-- tipo_comprobante y un índice global rompería con un B04 de proveedor que
-- coincida con un B04 propio. Antes de proponer un candado entre tablas hay
-- que correr el conteo de docs/pruebas/ncf-unicidad.sql sobre la base real y
-- decidir con Contable. Mientras tanto, esta validación impide mover una
-- serie a un rango ya emitido en notas.
-- ---------------------------------------------------------------------------

create or replace function public.actualizar_numeracion(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_num public.numeraciones%rowtype;
  v_siguiente int;
  v_hasta int;
  v_vence date;
  v_ultimo int;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or nullif(p->>'id', '') is null then
    raise exception 'la numeración es obligatoria' using errcode = '22023';
  end if;

  v_id := (p->>'id')::uuid;

  select * into v_num
  from public.numeraciones n
  where n.id = v_id
  for update;

  if not found then
    raise exception 'numeración no encontrada' using errcode = '22023';
  end if;

  v_siguiente := v_num.siguiente;
  v_hasta := v_num.hasta;
  v_vence := v_num.vence;

  if p ? 'siguiente' then
    v_siguiente := (p->>'siguiente')::int;
    if v_siguiente is null or v_siguiente < 1 then
      raise exception 'el siguiente debe ser mayor o igual a 1' using errcode = '22023';
    end if;
  end if;

  if p ? 'hasta' then
    v_hasta := nullif(p->>'hasta', '')::int;
    if v_hasta is not null and v_hasta < 1 then
      raise exception 'el hasta debe ser mayor o igual a 1' using errcode = '22023';
    end if;
  end if;

  if (p ? 'siguiente' or p ? 'hasta')
     and v_hasta is not null
     and v_siguiente > v_hasta then
    raise exception 'el siguiente no puede ser mayor que el hasta' using errcode = '22023';
  end if;

  select max(v_max) into v_ultimo
  from (
    select coalesce((
      select max(substring(f.ncf from length(v_num.prefijo) + 1)::int)
      from public.facturas f
      where f.tipo_comprobante = v_num.tipo_comprobante
        and f.ncf like v_num.prefijo || '%'
    ), 0) as v_max
    union all
    select coalesce((
      select max(substring(gm.ncf from length(v_num.prefijo) + 1)::int)
      from public.gastos_menores gm
      where gm.ncf like v_num.prefijo || '%'
    ), 0)
    union all
    select coalesce((
      select max(substring(nd.ncf from length(v_num.prefijo) + 1)::int)
      from public.notas_debito_venta nd
      where v_num.tipo_comprobante = '03'
        and nd.ncf like v_num.prefijo || '%'
    ), 0)
    union all
    select coalesce((
      select max(substring(nc.ncf from length(v_num.prefijo) + 1)::int)
      from public.notas_credito_venta nc
      where v_num.tipo_comprobante = '04'
        and nc.ncf like v_num.prefijo || '%'
    ), 0)
    union all
    select coalesce((
      select max(substring(ncc.ncf from length(v_num.prefijo) + 1)::int)
      from public.notas_credito_compra ncc
      where v_num.tipo_comprobante = '03'
        and ncc.ncf like v_num.prefijo || '%'
    ), 0)
  ) s;

  if v_siguiente <= v_ultimo then
    raise exception 'el siguiente no puede ser menor o igual al último NCF emitido (%)', v_ultimo
      using errcode = '22023';
  end if;

  if p ? 'vence' then
    v_vence := nullif(p->>'vence', '')::date;
  end if;

  if p ? 'nombre' and coalesce(trim(p->>'nombre'), '') = '' then
    raise exception 'el nombre de la numeración es obligatorio' using errcode = '22023';
  end if;

  update public.numeraciones n
  set
    siguiente = v_siguiente,
    hasta = v_hasta,
    vence = v_vence,
    activa = case when p ? 'activa' then (p->>'activa')::boolean else n.activa end,
    nombre = case when p ? 'nombre' then p->>'nombre' else n.nombre end
  where n.id = v_id;

  return v_id;
end;
$$;

revoke all on function public.actualizar_numeracion(jsonb) from public, anon, authenticated;
grant execute on function public.actualizar_numeracion(jsonb) to authenticated;

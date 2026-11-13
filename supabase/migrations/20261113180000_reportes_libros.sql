-- ---------------------------------------------------------------------------
-- Reportes contables de libros (solo lectura, aditivo)
--
-- · reporte_movimientos: movimientos a nivel de línea con estado, tercero y
--   documento de origen; acepta códigos padre (incluye hijas por prefijo).
-- · reporte_saldos_tercero: saldo anterior, débitos y créditos por cuenta y
--   tercero.
-- · reporte_saldos_cuentas: saldo anterior, débitos y créditos por cuenta,
--   con opción de cierre anual para ingreso/costo/gasto.
--
-- No cambia tablas ni funciones existentes.
-- ---------------------------------------------------------------------------

create or replace function public.reporte_movimientos(
  p_desde date,
  p_hasta date,
  p_cuentas text[] default null,
  p_contacto uuid default null,
  p_origenes text[] default null
)
returns table (
  asiento_id uuid,
  asiento_numero int,
  fecha date,
  estado text,
  origen_tipo text,
  documento text,
  contacto_id uuid,
  tercero text,
  cuenta_id uuid,
  cuenta_codigo text,
  cuenta_nombre text,
  cuenta_naturaleza text,
  debito numeric,
  credito numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    a.id,
    a.numero,
    a.fecha,
    case
      when a.origen_tipo = 'anulacion'
        or exists (select 1 from public.asientos reversion where reversion.anula_asiento_id = a.id)
        then 'Anulado'
      else 'Contabilizado'
    end,
    a.origen_tipo,
    coalesce(f.ncf, fp.ncf, pr.numero::text, pp.numero::text, gm.ncf, gm.numero::text),
    coalesce(
      l.contacto_id,
      f.contacto_id,
      pr.contacto_id,
      fp.contacto_id,
      pp.contacto_id,
      gm.contacto_id
    ),
    ct.nombre,
    c.id,
    c.codigo,
    c.nombre,
    c.naturaleza,
    l.debito,
    l.credito
  from public.asientos a
  join public.asiento_lineas l on l.asiento_id = a.id
  join public.cuentas c on c.id = l.cuenta_id
  left join public.facturas f
    on a.origen_tipo = 'factura' and f.id = a.origen_id
  left join public.pagos_recibidos pr
    on a.origen_tipo = 'pago_recibido' and pr.id = a.origen_id
  left join public.facturas_proveedor fp
    on a.origen_tipo = 'factura_proveedor' and fp.id = a.origen_id
  left join public.pagos_proveedor pp
    on a.origen_tipo = 'pago_proveedor' and pp.id = a.origen_id
  left join public.gastos_menores gm
    on a.origen_tipo = 'gasto_menor' and gm.id = a.origen_id
  left join public.contactos ct
    on ct.id = coalesce(
      l.contacto_id,
      f.contacto_id,
      pr.contacto_id,
      fp.contacto_id,
      pp.contacto_id,
      gm.contacto_id
    )
  where a.fecha between p_desde and p_hasta
    and (
      p_origenes is null
      or cardinality(p_origenes) = 0
      or a.origen_tipo = any(p_origenes)
    )
    and (
      p_contacto is null
      or coalesce(
        l.contacto_id,
        f.contacto_id,
        pr.contacto_id,
        fp.contacto_id,
        pp.contacto_id,
        gm.contacto_id
      ) = p_contacto
    )
    and (
      p_cuentas is null
      or cardinality(p_cuentas) = 0
      or exists (
        select 1
        from unnest(p_cuentas) as filtro(codigo)
        where c.codigo like filtro.codigo || '%'
      )
    )
  order by a.fecha, a.numero, l.id;
$$;

create or replace function public.reporte_saldos_tercero(
  p_desde date,
  p_hasta date,
  p_cuentas text[] default null,
  p_contacto uuid default null,
  p_incluir_cero boolean default false
)
returns table (
  cuenta_id uuid,
  cuenta_codigo text,
  cuenta_nombre text,
  cuenta_tipo text,
  cuenta_naturaleza text,
  contacto_id uuid,
  tercero text,
  saldo_inicial numeric,
  debitos numeric,
  creditos numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with movimientos as (
    select
      c.id as cuenta_id,
      c.codigo as cuenta_codigo,
      c.nombre as cuenta_nombre,
      c.tipo as cuenta_tipo,
      c.naturaleza as cuenta_naturaleza,
      coalesce(
        l.contacto_id,
        f.contacto_id,
        pr.contacto_id,
        fp.contacto_id,
        pp.contacto_id,
        gm.contacto_id
      ) as contacto_id,
      a.fecha,
      l.debito,
      l.credito
    from public.asientos a
    join public.asiento_lineas l on l.asiento_id = a.id
    join public.cuentas c on c.id = l.cuenta_id
    left join public.facturas f
      on a.origen_tipo = 'factura' and f.id = a.origen_id
    left join public.pagos_recibidos pr
      on a.origen_tipo = 'pago_recibido' and pr.id = a.origen_id
    left join public.facturas_proveedor fp
      on a.origen_tipo = 'factura_proveedor' and fp.id = a.origen_id
    left join public.pagos_proveedor pp
      on a.origen_tipo = 'pago_proveedor' and pp.id = a.origen_id
    left join public.gastos_menores gm
      on a.origen_tipo = 'gasto_menor' and gm.id = a.origen_id
    where a.fecha <= p_hasta
      and (
        p_contacto is null
        or coalesce(
          l.contacto_id,
          f.contacto_id,
          pr.contacto_id,
          fp.contacto_id,
          pp.contacto_id,
          gm.contacto_id
        ) = p_contacto
      )
      and (
        p_cuentas is null
        or cardinality(p_cuentas) = 0
        or exists (
          select 1
          from unnest(p_cuentas) as filtro(codigo)
          where c.codigo like filtro.codigo || '%'
        )
      )
  ),
  agrupado as (
    select
      m.cuenta_id,
      m.cuenta_codigo,
      m.cuenta_nombre,
      m.cuenta_tipo,
      m.cuenta_naturaleza,
      m.contacto_id,
      round(sum(
        case
          when m.fecha < p_desde then
            case
              when m.cuenta_naturaleza = 'debito' then m.debito - m.credito
              else m.credito - m.debito
            end
          else 0
        end
      ), 2) as saldo_inicial,
      round(sum(case when m.fecha >= p_desde then m.debito else 0 end), 2) as debitos,
      round(sum(case when m.fecha >= p_desde then m.credito else 0 end), 2) as creditos
    from movimientos m
    group by
      m.cuenta_id,
      m.cuenta_codigo,
      m.cuenta_nombre,
      m.cuenta_tipo,
      m.cuenta_naturaleza,
      m.contacto_id
  )
  select
    a.cuenta_id,
    a.cuenta_codigo,
    a.cuenta_nombre,
    a.cuenta_tipo,
    a.cuenta_naturaleza,
    a.contacto_id,
    ct.nombre,
    a.saldo_inicial,
    a.debitos,
    a.creditos
  from agrupado a
  left join public.contactos ct on ct.id = a.contacto_id
  where p_incluir_cero
    or a.saldo_inicial <> 0
    or a.debitos <> 0
    or a.creditos <> 0
  order by a.cuenta_codigo, ct.nombre nulls first;
$$;

create or replace function public.reporte_saldos_cuentas(
  p_desde date,
  p_hasta date,
  p_cierre_anual boolean default false,
  p_cuentas text[] default null
)
returns table (
  cuenta_id uuid,
  cuenta_codigo text,
  cuenta_nombre text,
  cuenta_tipo text,
  cuenta_naturaleza text,
  padre_id uuid,
  saldo_inicial numeric,
  debitos numeric,
  creditos numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with lineas as (
    select
      c.id,
      c.codigo,
      c.nombre,
      c.tipo,
      c.naturaleza,
      c.padre_id,
      a.fecha,
      l.debito,
      l.credito
    from public.asientos a
    join public.asiento_lineas l on l.asiento_id = a.id
    join public.cuentas c on c.id = l.cuenta_id
    where a.fecha <= p_hasta
      and (
        p_cuentas is null
        or cardinality(p_cuentas) = 0
        or exists (
          select 1
          from unnest(p_cuentas) as filtro(codigo)
          where c.codigo like filtro.codigo || '%'
        )
      )
  ),
  agrupado as (
    select
      l.id,
      l.codigo,
      l.nombre,
      l.tipo,
      l.naturaleza,
      l.padre_id,
      round(sum(
        case
          when l.fecha < p_desde
            and (
              not p_cierre_anual
              or l.tipo not in ('ingreso', 'costo', 'gasto')
              or l.fecha >= date_trunc('year', p_desde)::date
            )
          then
            case
              when l.naturaleza = 'debito' then l.debito - l.credito
              else l.credito - l.debito
            end
          else 0
        end
      ), 2) as saldo_inicial,
      round(sum(case when l.fecha >= p_desde then l.debito else 0 end), 2) as debitos,
      round(sum(case when l.fecha >= p_desde then l.credito else 0 end), 2) as creditos
    from lineas l
    group by l.id, l.codigo, l.nombre, l.tipo, l.naturaleza, l.padre_id
  )
  select
    a.id,
    a.codigo,
    a.nombre,
    a.tipo,
    a.naturaleza,
    a.padre_id,
    a.saldo_inicial,
    a.debitos,
    a.creditos
  from agrupado a
  order by a.codigo;
$$;

revoke all on function public.reporte_movimientos(date, date, text[], uuid, text[]) from public, anon, authenticated;
revoke all on function public.reporte_saldos_tercero(date, date, text[], uuid, boolean) from public, anon, authenticated;
revoke all on function public.reporte_saldos_cuentas(date, date, boolean, text[]) from public, anon, authenticated;

grant execute on function public.reporte_movimientos(date, date, text[], uuid, text[]) to authenticated;
grant execute on function public.reporte_saldos_tercero(date, date, text[], uuid, boolean) to authenticated;
grant execute on function public.reporte_saldos_cuentas(date, date, boolean, text[]) to authenticated;

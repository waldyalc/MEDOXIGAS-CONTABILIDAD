-- ---------------------------------------------------------------------------
-- Resumen del negocio (Inicio)
--
-- Migración aditiva y reintentable. Una sola función de solo lectura agrega
-- tarjetas y serie para el Inicio, sin traer filas a la aplicación.
-- · Ventas: facturas de venta no anuladas, total con impuestos incluidos.
-- · CxC / CxP: facturas del periodo con saldo pendiente
--   (total - pagado - crédito - retenido); vencidas = vencimiento < hasta.
-- · Serie diaria si el periodo cae en un solo mes; mensual si abarca varios.
-- · La serie y la variación comparan contra el mismo rango del año anterior.
-- ---------------------------------------------------------------------------

create or replace function public.dashboard_resumen(p_desde date, p_hasta date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with parametros as (
    select
      coalesce(p_desde, current_date) as desde,
      coalesce(p_hasta, current_date) as hasta,
      date_trunc('month', coalesce(p_desde, current_date))
        = date_trunc('month', coalesce(p_hasta, current_date)) as diario
  ),
  ventas as (
    select f.id, f.contacto_id, f.fecha, f.total, f.itbis
    from public.facturas f
    cross join parametros p
    where f.estado <> 'anulada'
      and f.fecha between p.desde and p.hasta
  ),
  cxc as (
    select
      coalesce(sum(s.saldo), 0) as total,
      coalesce(sum(s.saldo) filter (where s.vencimiento >= p.hasta), 0) as vigentes_monto,
      count(*) filter (where s.vencimiento >= p.hasta) as vigentes_documentos,
      coalesce(sum(s.saldo) filter (where s.vencimiento < p.hasta), 0) as vencidas_monto,
      count(*) filter (where s.vencimiento < p.hasta) as vencidas_documentos
    from (
      select
        f.vencimiento,
        round(f.total - f.pagado - f.credito - f.retenido, 2) as saldo
      from public.facturas f
      cross join parametros p
      where f.estado <> 'anulada'
        and f.fecha between p.desde and p.hasta
        and f.total - f.pagado - f.credito - f.retenido > 0
    ) s
    cross join parametros p
  ),
  cxp as (
    select
      coalesce(sum(s.saldo), 0) as total,
      coalesce(sum(s.saldo) filter (where s.vencimiento >= p.hasta), 0) as vigentes_monto,
      count(*) filter (where s.vencimiento >= p.hasta) as vigentes_documentos,
      coalesce(sum(s.saldo) filter (where s.vencimiento < p.hasta), 0) as vencidas_monto,
      count(*) filter (where s.vencimiento < p.hasta) as vencidas_documentos
    from (
      select
        f.vencimiento,
        round(f.total - f.pagado - f.credito - f.retenido, 2) as saldo
      from public.facturas_proveedor f
      cross join parametros p
      where f.estado <> 'anulada'
        and f.fecha between p.desde and p.hasta
        and f.total - f.pagado - f.credito - f.retenido > 0
    ) s
    cross join parametros p
  ),
  ventas_resumen as (
    select
      coalesce(sum(v.total), 0) as total,
      coalesce(sum(v.itbis), 0) as itbis,
      count(distinct v.contacto_id) as clientes
    from ventas v
  ),
  unidades as (
    select coalesce(sum(l.cantidad), 0) as total
    from public.factura_lineas l
    join ventas v on v.id = l.factura_id
  ),
  devoluciones as (
    select coalesce(sum(n.total), 0) as total
    from public.notas_credito_venta n
    cross join parametros p
    where n.estado = 'activa'
      and n.fecha between p.desde and p.hasta
  ),
  anterior as (
    select coalesce(sum(f.total), 0) as total
    from public.facturas f
    cross join parametros p
    where f.estado <> 'anulada'
      and f.fecha between (p.desde - interval '1 year')::date and (p.hasta - interval '1 year')::date
  ),
  fechas as (
    select generate_series(
      case when p.diario then p.desde else date_trunc('month', p.desde)::date end,
      p.hasta,
      case when p.diario then interval '1 day' else interval '1 month' end
    )::date as fecha
    from parametros p
  ),
  serie_actual as (
    select
      case when p.diario then v.fecha else date_trunc('month', v.fecha)::date end as fecha,
      sum(v.total) as total
    from ventas v
    cross join parametros p
    group by 1
  ),
  serie_anterior as (
    select
      case
        when p.diario then (f.fecha + interval '1 year')::date
        else (date_trunc('month', f.fecha) + interval '1 year')::date
      end as fecha,
      sum(f.total) as total
    from public.facturas f
    cross join parametros p
    where f.estado <> 'anulada'
      and f.fecha between (p.desde - interval '1 year')::date and (p.hasta - interval '1 year')::date
    group by 1
  ),
  puntos as (
    select
      fe.fecha,
      coalesce(sa.total, 0) as actual,
      coalesce(sp.total, 0) as anterior
    from fechas fe
    left join serie_actual sa on sa.fecha = fe.fecha
    left join serie_anterior sp on sp.fecha = fe.fecha
  ),
  serie as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'etiqueta', to_char(fecha, 'YYYY-MM-DD'),
          'actual', actual,
          'anterior', anterior
        )
        order by fecha
      ),
      '[]'::jsonb
    ) as puntos
    from puntos
  )
  select jsonb_build_object(
    'desde', (select desde from parametros),
    'hasta', (select hasta from parametros),
    'es_diario', (select diario from parametros),
    'cxc', (
      select jsonb_build_object(
        'total', total,
        'vigentes', jsonb_build_object('monto', vigentes_monto, 'documentos', vigentes_documentos),
        'vencidas', jsonb_build_object('monto', vencidas_monto, 'documentos', vencidas_documentos)
      )
      from cxc
    ),
    'cxp', (
      select jsonb_build_object(
        'total', total,
        'vigentes', jsonb_build_object('monto', vigentes_monto, 'documentos', vigentes_documentos),
        'vencidas', jsonb_build_object('monto', vencidas_monto, 'documentos', vencidas_documentos)
      )
      from cxp
    ),
    'impuestos_venta', (select itbis from ventas_resumen),
    'productos_vendidos', (select total from unidades),
    'devoluciones_clientes', (select total from devoluciones),
    'clientes_con_ventas', (select clientes from ventas_resumen),
    'ventas', jsonb_build_object(
      'total', (select total from ventas_resumen),
      'anterior', (select total from anterior),
      'variacion', (
        select case
          when a.total > 0
            then round((vr.total - a.total) / a.total * 100, 2)
          else null
        end
        from ventas_resumen vr
        cross join anterior a
      ),
      'serie', (select puntos from serie)
    )
  );
$$;

revoke all on function public.dashboard_resumen(date, date) from public, anon, authenticated;
grant execute on function public.dashboard_resumen(date, date) to authenticated;

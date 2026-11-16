-- ---------------------------------------------------------------------------
-- Rendimiento de Inicio y catálogo de cuentas
--
-- Migración aditiva y reintentable (CREATE INDEX IF NOT EXISTS + CREATE OR
-- REPLACE). No borra datos, no toca políticas RLS ni la lógica contable.
--
-- Problema: las dos pantallas recalculaban el mayor completo de asiento_lineas
-- en cada visita.
--   · /dashboard (aviso de saldo negativo) llama saldos_caja_banco, que unía
--     TODAS las líneas de las cuentas de caja/banco con asientos para filtrar
--     por fecha.
--   · /dashboard/contabilidad pedía reporte_balance_comprobacion('1900-01-01',
--     hoy) solo para mostrar el saldo de cada cuenta del catálogo.
-- Con ~258k líneas, estos dos agregados son el trabajo de base más caro de
-- ambas pantallas, y ninguna de las dos necesita el mayor completo.
--
-- Cambios:
--   1. Índice de cobertura (cuenta_id) include (debito, credito) para sumar el
--      mayor por cuenta con un index-only scan.
--   2. saldos_caja_banco: suma el total por cuenta y le resta solo las líneas
--      de asientos con fecha posterior al corte (normalmente ninguna). Mismo
--      resultado que antes, sin unir cada línea con su asiento.
--   3. catalogo_saldos: nueva función de solo lectura que devuelve el saldo por
--      código de cuenta con la misma fórmula que reporte_balance_comprobacion
--      (débito - crédito o crédito - débito según la naturaleza) y el mismo
--      corte de fecha. El catálogo ya no pide el balance de comprobación
--      completo.
--
-- Pendiente de aplicar al remoto (lo aplica Coder). El índice de
-- 20261115900000_indices_rendimiento.sql sigue sin aplicar; estas consultas no
-- dependen de él (los índices base asientos_fecha_idx y
-- asiento_lineas_cuenta_id_idx ya existen), pero conviene aplicarlo también.
-- ---------------------------------------------------------------------------

-- Saldo por cuenta sin tocar el heap: las tres columnas que necesita el
-- agregado viajan en el índice.
create index if not exists asiento_lineas_cuenta_importes_idx
  on public.asiento_lineas (cuenta_id) include (debito, credito);

-- ---------------------------------------------------------------------------
-- Saldos de caja y banco (misma firma y mismo resultado que la versión de
-- 20261113180100_saldos_caja_banco.sql)
-- ---------------------------------------------------------------------------

create or replace function public.saldos_caja_banco(p_fecha date default current_date)
returns table (
  cuenta_id uuid,
  codigo text,
  nombre text,
  saldo numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with totales as (
    select l.cuenta_id, sum(l.debito) as debitos, sum(l.credito) as creditos
    from public.cuentas c
    join public.asiento_lineas l on l.cuenta_id = c.id
    where c.es_caja_banco
    group by l.cuenta_id
  ),
  posteriores as (
    select l.cuenta_id, sum(l.debito) as debitos, sum(l.credito) as creditos
    from public.asientos a
    join public.asiento_lineas l on l.asiento_id = a.id
    where a.fecha > coalesce(p_fecha, current_date)
    group by l.cuenta_id
  )
  select
    c.id,
    c.codigo,
    c.nombre,
    round(
      coalesce(t.debitos, 0) - coalesce(p.debitos, 0)
      - coalesce(t.creditos, 0) + coalesce(p.creditos, 0),
      2
    )
  from public.cuentas c
  left join totales t on t.cuenta_id = c.id
  left join posteriores p on p.cuenta_id = c.id
  where c.es_caja_banco
  order by c.codigo;
$$;

revoke all on function public.saldos_caja_banco(date) from public, anon, authenticated;
grant execute on function public.saldos_caja_banco(date) to authenticated;

-- ---------------------------------------------------------------------------
-- Saldo por cuenta para el catálogo (saldo al corte, como
-- reporte_balance_comprobacion('1900-01-01', p_hasta))
-- ---------------------------------------------------------------------------

create or replace function public.catalogo_saldos(p_hasta date default current_date)
returns table (
  cuenta_codigo text,
  saldo numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with totales as (
    select l.cuenta_id, sum(l.debito) as debitos, sum(l.credito) as creditos
    from public.asiento_lineas l
    group by l.cuenta_id
  ),
  posteriores as (
    select l.cuenta_id, sum(l.debito) as debitos, sum(l.credito) as creditos
    from public.asientos a
    join public.asiento_lineas l on l.asiento_id = a.id
    where a.fecha > coalesce(p_hasta, current_date)
    group by l.cuenta_id
  )
  select
    c.codigo,
    round(
      case
        when c.naturaleza = 'debito'
          then coalesce(t.debitos, 0) - coalesce(p.debitos, 0)
            - coalesce(t.creditos, 0) + coalesce(p.creditos, 0)
        else coalesce(t.creditos, 0) - coalesce(p.creditos, 0)
          - coalesce(t.debitos, 0) + coalesce(p.debitos, 0)
      end,
      2
    )
  from public.cuentas c
  left join totales t on t.cuenta_id = c.id
  left join posteriores p on p.cuenta_id = c.id
  where coalesce(t.debitos, 0) - coalesce(p.debitos, 0) <> 0
    or coalesce(t.creditos, 0) - coalesce(p.creditos, 0) <> 0
  order by c.codigo;
$$;

revoke all on function public.catalogo_saldos(date) from public, anon, authenticated;
grant execute on function public.catalogo_saldos(date) to authenticated;

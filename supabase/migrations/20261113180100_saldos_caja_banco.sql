-- ---------------------------------------------------------------------------
-- Saldos de cuentas de caja y banco (solo lectura, respeta RLS)
-- Migración aditiva: no toca tablas ni datos existentes.
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
  select
    c.id,
    c.codigo,
    c.nombre,
    round(
      coalesce(
        sum(l.debito - l.credito) filter (where a.fecha <= coalesce(p_fecha, current_date)),
        0
      ),
      2
    )
  from public.cuentas c
  left join public.asiento_lineas l on l.cuenta_id = c.id
  left join public.asientos a on a.id = l.asiento_id
  where c.es_caja_banco
  group by c.id, c.codigo, c.nombre
  order by c.codigo;
$$;

revoke all on function public.saldos_caja_banco(date) from public, anon, authenticated;
grant execute on function public.saldos_caja_banco(date) to authenticated;

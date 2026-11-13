-- ---------------------------------------------------------------------------
-- Reporte de cuentas por cobrar con retenciones
--
-- Aditiva: el saldo pendiente resta también lo retenido por los clientes.
-- Mantiene la firma de reporte_cxc(date).
-- ---------------------------------------------------------------------------

create or replace function public.reporte_cxc(p_fecha date)
returns table (
  contacto_id uuid,
  contacto_nombre text,
  factura_id uuid,
  numero int,
  ncf text,
  fecha date,
  vencimiento date,
  total numeric,
  pagado numeric,
  saldo numeric,
  dias_vencida int
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    f.contacto_id,
    c.nombre,
    f.id,
    f.numero,
    f.ncf,
    f.fecha,
    f.vencimiento,
    f.total,
    f.pagado,
    round(f.total - f.pagado - f.credito - f.retenido, 2),
    greatest(coalesce(p_fecha, current_date) - f.vencimiento, 0)
  from public.facturas f
  join public.contactos c on c.id = f.contacto_id
  where f.estado <> 'anulada'
    and f.total - f.pagado - f.credito - f.retenido > 0
  order by f.fecha, f.numero;
$$;

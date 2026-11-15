-- Cuadre D6: inventario por producto — kardex vs productos vs mayor contable.
-- SOLO LECTURA. Correr en el SQL Editor de Supabase.
-- Compara por producto: (a) cantidad del kardex reconstruido, (b) productos.cantidad,
-- (c) saldo del mayor (asiento_lineas con producto_id en cuentas de inventario/costo).

-- 1) Cantidad kardex vs productos.cantidad
with kardex as (
  select
    l.producto_id,
    sum(l.cantidad) filter (where f.estado <> 'anulada') as vendidas
  from public.factura_lineas l
  join public.facturas f on f.id = l.factura_id
  group by l.producto_id
),
kardex_compras as (
  select
    l.producto_id,
    sum(l.cantidad) filter (where f.estado <> 'anulada') as compradas
  from public.facturas_proveedor_lineas l
  join public.facturas_proveedor f on f.id = l.factura_proveedor_id
  group by l.producto_id
),
kardex_nc_venta as (
  select nl.producto_id, sum(nl.cantidad) as devueltas
  from public.nota_credito_venta_lineas nl
  join public.notas_credito_venta n on n.id = nl.nota_id
  where n.estado <> 'anulada'
  group by nl.producto_id
),
kardex_nc_compra as (
  select nl.producto_id, sum(nl.cantidad) as devueltas
  from public.nota_credito_compra_lineas nl
  join public.notas_credito_compra n on n.id = nl.nota_id
  where n.estado <> 'anulada'
  group by nl.producto_id
)
select
  p.id,
  p.nombre,
  coalesce(kc.compradas, 0) - coalesce(kv.vendidas, 0) + coalesce(nv.devueltas, 0) - coalesce(nc.devueltas, 0) as cantidad_kardex,
  p.cantidad as cantidad_tabla,
  p.cantidad - (coalesce(kc.compradas, 0) - coalesce(kv.vendidas, 0) + coalesce(nv.devueltas, 0) - coalesce(nc.devueltas, 0)) as diferencia
from public.productos p
left join kardex kv on kv.producto_id = p.id
left join kardex_compras kc on kc.producto_id = p.id
left join kardex_nc_venta nv on nv.producto_id = p.id
left join kardex_nc_compra nc on nc.producto_id = p.id
where p.inventariable
order by abs(p.cantidad - (coalesce(kc.compradas, 0) - coalesce(kv.vendidas, 0) + coalesce(nv.devueltas, 0) - coalesce(nc.devueltas, 0))) desc;

-- 2) Mayor por producto (asiento_lineas.producto_id en cuentas de inventario y costo de ventas)
select
  al.producto_id,
  p.nombre,
  c.codigo as cuenta,
  sum(al.debito) as debitos,
  sum(al.credito) as creditos,
  sum(al.debito - al.credito) as saldo_mayor
from public.asiento_lineas al
join public.asientos a on a.id = al.asiento_id and a.estado = 'confirmado'
join public.cuentas c on c.id = al.cuenta_id
left join public.productos p on p.id = al.producto_id
where al.producto_id is not null
  and (c.codigo like '1130%' or c.codigo like '5100%' or c.tipo in ('costo'))
group by al.producto_id, p.nombre, c.codigo
order by saldo_mayor desc;

-- 3) Valor productos.cantidad*costo vs mayor total de cuentas inventario
select
  sum(al.debito - al.credito) as mayor_inventario
from public.asiento_lineas al
join public.asientos a on a.id = al.asiento_id and a.estado = 'confirmado'
join public.cuentas c on c.id = al.cuenta_id
where c.codigo like '1130%';

select sum(cantidad * costo) as productos_cantidad_costo
from public.productos
where inventariable;

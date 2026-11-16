-- Verificación D6 (SOLO LECTURA): anulaciones y costo promedio.
-- Correr en el SQL Editor de Supabase. No modifica datos.
-- Diagnóstico: docs/pruebas/resultados/diagnostico-anulaciones-costo.md

-- 0) ¿Están aplicadas las migraciones del costeo?
select version, name
from supabase_migrations.schema_migrations
where version in (
  '20261113270000',
  '20261114900000',
  '20261116200000',
  '20261117200000'
)
order by version;

-- 1) ¿Se llena asiento_lineas.producto_id?
--    Si lineas_con_producto = 0, el mayor no se puede atribuir por producto
--    con el esquema actual; solo vale el total de cuentas 1130*.
select
  count(*) filter (where producto_id is not null) as lineas_con_producto,
  count(*) as lineas_totales
from public.asiento_lineas;

-- 2) Compras anuladas y su valor.
--    Las anuladas antes de aplicar 20261113270000 pudieron devolver la
--    cantidad sin revertir el costo promedio.
select
  fp.numero,
  fp.fecha,
  fp.creado_en,
  fp.total,
  (select coalesce(sum(fpl.cantidad), 0)
     from public.facturas_proveedor_lineas fpl
    where fpl.factura_proveedor_id = fp.id) as unidades,
  (select coalesce(sum(fpl.cantidad * fpl.costo), 0)
     from public.facturas_proveedor_lineas fpl
    where fpl.factura_proveedor_id = fp.id) as valor_lineas
from public.facturas_proveedor fp
where fp.estado = 'anulada'
order by fp.creado_en;

-- 3) Ajustes anulados con líneas de entrada: huella exacta del bug corregido
--    en 20261117200000 (antes, la cantidad volvía pero el costo no).
select
  ai.numero,
  ai.fecha,
  ai.creado_en,
  p.nombre as producto,
  ail.cantidad,
  ail.costo_unitario,
  ail.total as valor_entrada
from public.ajustes_inventario ai
join public.ajuste_inventario_lineas ail on ail.ajuste_id = ai.id
join public.productos p on p.id = ail.producto_id
where ai.estado = 'anulada'
  and ail.tipo = 'entrada'
order by ai.creado_en, ail.id;

select
  count(*) as ajustes_entrada_anulados,
  coalesce(sum(ail.total), 0) as valor_entrada_anulada
from public.ajustes_inventario ai
join public.ajuste_inventario_lineas ail on ail.ajuste_id = ai.id
where ai.estado = 'anulada'
  and ail.tipo = 'entrada';

-- 4) Brecha global D6 (misma definición del cuadre): productos vs mayor 1130*.
select
  (select coalesce(sum(cantidad * costo), 0)
     from public.productos
    where inventariable) as productos_cantidad_costo,
  (select coalesce(sum(al.debito - al.credito), 0)
     from public.asiento_lineas al
     join public.asientos a on a.id = al.asiento_id and a.estado = 'confirmado'
     join public.cuentas c on c.id = al.cuenta_id
    where c.codigo like '1130%') as mayor_inventario;

-- 5) Productos con más valor y su actividad. Crear un producto con stock
--    inicial o editar cantidad/costo en el formulario mueve existencias pero
--    no crea asiento: ese valor no tiene contrapartida en el mayor.
select
  p.id,
  p.nombre,
  p.cantidad,
  p.costo,
  round(p.cantidad * p.costo, 2) as valor,
  (select count(*) from public.factura_lineas fl where fl.producto_id = p.id) as lineas_venta,
  (select count(*) from public.facturas_proveedor_lineas fpl where fpl.producto_id = p.id) as lineas_compra,
  (select count(*) from public.ajuste_inventario_lineas ail where ail.producto_id = p.id) as lineas_ajuste
from public.productos p
where p.inventariable
  and p.cantidad * p.costo <> 0
order by abs(p.cantidad * p.costo) desc
limit 50;

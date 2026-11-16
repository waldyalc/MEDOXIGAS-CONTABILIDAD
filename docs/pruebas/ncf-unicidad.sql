-- ---------------------------------------------------------------------------
-- Unicidad de NCF entre tablas — SOLO LECTURA
--
-- Cada tabla ya tiene unique(ncf) por separado:
--   facturas, gastos_menores, notas_credito_venta, notas_debito_venta y
--   notas_credito_compra.
-- Lo que no existe es unicidad ENTRE tablas. La migración
-- 20261117300000_numeraciones_notas.sql cierra el hueco por la vía de
-- actualizar_numeracion (no deja mover una serie por debajo de un NCF ya
-- emitido en notas), pero no agrega un unique global. Antes de proponerlo,
-- corre esto en la base real.
--
-- Por qué no se agrega todavía:
--   · Un índice (tipo_comprobante, ncf) no puede cubrir varias tablas, y las
--     tablas de notas no tienen tipo_comprobante.
--   · notas_credito_compra guarda desde 20261114700000 el NCF del PROVEEDOR
--     (B04/E34), no uno nuestro. Un unique global podría chocar con un B04
--     propio legítimo o con un NCF de proveedor repetido entre compras.
--   · Falta evidencia de que hoy no haya choques. Este script la produce.
-- ---------------------------------------------------------------------------

-- 1) Resumen: ¿cuántos NCF aparecen en más de una tabla de las nuestras?
with emitidos as (
  select 'facturas' as origen, ncf from public.facturas
  union all
  select 'gastos_menores', ncf from public.gastos_menores where ncf is not null
  union all
  select 'notas_credito_venta', ncf from public.notas_credito_venta
  union all
  select 'notas_debito_venta', ncf from public.notas_debito_venta
  union all
  select 'notas_credito_compra_b03', ncf from public.notas_credito_compra
   where ncf like 'B03%'
),
choques as (
  select ncf, count(*) as apariciones
  from emitidos
  group by ncf
  having count(*) > 1
)
select
  (select count(*) from emitidos) as ncf_emitidos,
  (select count(*) from choques) as ncf_en_mas_de_una_tabla,
  (select coalesce(sum(apariciones), 0) from choques) as filas_involucradas;

-- 2) Detalle de los choques (si hay, esto bloquea cualquier unique global).
with emitidos as (
  select 'facturas' as origen, ncf from public.facturas
  union all
  select 'gastos_menores', ncf from public.gastos_menores where ncf is not null
  union all
  select 'notas_credito_venta', ncf from public.notas_credito_venta
  union all
  select 'notas_debito_venta', ncf from public.notas_debito_venta
  union all
  select 'notas_credito_compra_b03', ncf from public.notas_credito_compra
   where ncf like 'B03%'
)
select ncf, string_agg(origen, ', ' order by origen) as tablas
from emitidos
group by ncf
having count(*) > 1
order by ncf
limit 100;

-- 3) Cuántos NCF de proveedor (B04/E34) hay en notas de crédito de compra.
--    Esos NO son series nuestras: no deben entrar en un unique global.
select
  count(*) filter (where ncf like 'B04%') as notas_compra_b04_proveedor,
  count(*) filter (where ncf like 'E34%') as notas_compra_e34_proveedor,
  count(*) filter (where ncf like 'B03%') as notas_compra_b03_viejo,
  count(*) filter (where ncf is null) as notas_compra_sin_ncf
from public.notas_credito_compra;

-- 4) Sanidad: facturas cuyo tipo_comprobante no coincide con el prefijo del
--    NCF. Si hay filas, el índice por (tipo_comprobante, ncf) tampoco sería
--    confiable.
select f.tipo_comprobante, left(f.ncf, 3) as prefijo, count(*) as facturas
from public.facturas f
where (f.tipo_comprobante = '01' and f.ncf not like 'B01%')
   or (f.tipo_comprobante = '02' and f.ncf not like 'B02%')
   or (f.tipo_comprobante = '14' and f.ncf not like 'B14%')
   or (f.tipo_comprobante = '15' and f.ncf not like 'B15%')
   or (f.tipo_comprobante = '16' and f.ncf not like 'B16%')
group by f.tipo_comprobante, left(f.ncf, 3)
order by facturas desc;

-- ---------------------------------------------------------------------------
-- Decisión pendiente con Contable
--
-- 1. Si el punto 1 da 0, todavía falta decidir si un NCF de proveedor puede
--    repetirse entre compras (hoy notas_credito_compra exige unique por
--    tabla, pero no entre notas de compra y facturas de proveedor).
-- 2. Si se quiere candado entre tablas, la vía más simple es una función
--    trigger que consulte las otras tablas antes de insertar, con un mensaje
--    en español; un índice único no puede hacerlo.
-- 3. La validación de actualizar_numeracion ya evita el caso que produjo el
--    hallazgo F16 (mover una serie a un rango con NCF de notas). Un trigger
--    entre tablas sería una segunda capa, no un requisito para cerrar F16.
-- ---------------------------------------------------------------------------

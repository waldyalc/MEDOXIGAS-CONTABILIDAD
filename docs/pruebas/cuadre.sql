-- Medoxigas Contabilidad · Cuadre contable (SOLO LECTURA)
-- Se corre en Supabase → SQL Editor, ANTES de cargar datos (línea base) y
-- DESPUÉS de las pruebas 1 y 2. Devuelve una fila por chequeo.
-- Chequeos "absoluto": deben dar 0 siempre.
-- Chequeos "delta": se compara después − antes; la diferencia debe ser 0
-- (salvo inventario, que puede tener centavos de redondeo por costo promedio).
with
cfg as (
  select clave, cuenta_id from public.config_contable
  where clave in ('cxc', 'cxp', 'inventario', 'itbis_por_pagar', 'itbis_adelantado')
),
mayor as (
  select c.clave, coalesce(sum(l.debito - l.credito), 0) as saldo
  from cfg c left join public.asiento_lineas l on l.cuenta_id = c.cuenta_id
  group by c.clave
),
fac as (
  select * from public.facturas where estado <> 'anulada'
),
fp as (
  select * from public.facturas_proveedor where estado <> 'anulada'
),
ncf_b as (
  select left(ncf, 3) as prefijo, substring(ncf from 4)::bigint as n
  from public.facturas
  where ncf ~ '^B[0-9]{2}[0-9]+$'
)
select 'A1 asientos descuadrados (absoluto)' as chequeo, count(*)::numeric as valor
from (select asiento_id from public.asiento_lineas group by asiento_id
      having round(sum(debito) - sum(credito), 2) <> 0) x
union all
select 'A2 facturas con saldo negativo (absoluto)', count(*)
from fac where round(total - pagado - credito - retenido, 2) < 0
union all
select 'A3 compras con saldo negativo (absoluto)', count(*)
from fp where round(total - pagado - credito - retenido, 2) < 0
union all
select 'A4 facturas pagada con saldo o abierta sin saldo (absoluto)', count(*)
from fac
where (estado = 'pagada' and round(total - pagado - credito - retenido, 2) > 0)
   or (estado = 'abierta' and round(total - pagado - credito - retenido, 2) <= 0)
union all
select 'A5 facturas anuladas sin asiento de reverso (absoluto)', count(*)
from public.facturas f
where f.estado = 'anulada' and f.asiento_id is not null
  and not exists (select 1 from public.asientos a where a.anula_asiento_id = f.asiento_id)
union all
select 'A6 productos con existencia por almacén distinta del total (absoluto)', count(*)
from public.productos p
left join (select producto_id, sum(cantidad) s from public.existencias group by producto_id) e
  on e.producto_id = p.id
where p.inventariable and round(p.cantidad - coalesce(e.s, 0), 4) <> 0
union all
select 'A7 NCF repetidos en facturas (absoluto)', count(*)
from (select ncf from public.facturas group by ncf having count(*) > 1) x
union all
select 'D1 huecos en NCF B de facturas (delta)', coalesce(sum(huecos), 0)
from (select prefijo, (max(n) - min(n) + 1) - count(distinct n) as huecos
      from ncf_b group by prefijo) x
union all
select 'D2 CxC mayor menos saldo de facturas (delta)',
  (select saldo from mayor where clave = 'cxc')
  - (select coalesce(sum(total - pagado - credito - retenido), 0) from fac)
union all
select 'D3 CxP mayor más saldo de compras (delta)',
  (select saldo from mayor where clave = 'cxp')
  + (select coalesce(sum(total - pagado - credito - retenido), 0) from fp)
union all
select 'D4 ITBIS por pagar mayor más ITBIS ventas netas (delta)',
  (select saldo from mayor where clave = 'itbis_por_pagar')
  + (select coalesce(sum(itbis), 0) from fac)
  - (select coalesce(sum(itbis), 0) from public.notas_credito_venta where estado <> 'anulada')
union all
select 'D5 ITBIS adelantado mayor menos ITBIS compras (delta)',
  (select saldo from mayor where clave = 'itbis_adelantado')
  - (select coalesce(sum(itbis), 0) from fp)
union all
select 'D6 inventario mayor menos cantidad x costo (delta, redondeo)',
  (select saldo from mayor where clave = 'inventario')
  - (select coalesce(sum(cantidad * costo), 0) from public.productos where inventariable)
union all
select 'I1 facturas ZZTEST', count(*)
from public.facturas f join public.contactos c on c.id = f.contacto_id
where c.nombre like 'ZZTEST-%'
union all
select 'I2 tamaño de la base en MB', round(pg_database_size(current_database()) / 1048576.0, 1);

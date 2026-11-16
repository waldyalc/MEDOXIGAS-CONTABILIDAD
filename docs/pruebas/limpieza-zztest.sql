-- ---------------------------------------------------------------------------
-- ZZTEST: inventario de datos de prueba y plan de borrado — SOLO LECTURA
--
-- La base real tiene ~19.5 mil documentos de prueba creados por
-- tests/carga/carga.ts y los escenarios C1-C8. NO se borran aquí: el sistema
-- no expone borrado físico y Waldy todavía no ha dado el OK. Este archivo
-- solo cuenta y deja escrito el orden de borrado para cuando lo apruebe.
--
-- Marcador: contactos y productos con nombre ZZTEST-*. Los documentos de
-- prueba cuelgan de esos contactos. Las líneas, asientos y pagos se cuentan
-- por su padre.
--
-- NO EJECUTES EL BLOQUE DE BORRADO DEL FINAL. Está comentado a propósito.
-- ---------------------------------------------------------------------------

-- 1) Contactos y productos de prueba.
select
  (select count(*) from public.contactos where nombre ilike 'ZZTEST%') as contactos_zztest,
  (select count(*) from public.productos where nombre ilike 'ZZTEST%') as productos_zztest;

-- 2) Documentos de venta de prueba.
with zc as (
  select id from public.contactos where nombre ilike 'ZZTEST%'
),
zf as (
  select id from public.facturas where contacto_id in (select id from zc)
)
select
  (select count(*) from zf) as facturas_zztest,
  (select count(*) from public.factura_lineas where factura_id in (select id from zf)) as factura_lineas_zztest,
  (select count(*) from public.pagos_recibidos
   where contacto_id in (select id from zc) or factura_id in (select id from zf)) as pagos_recibidos_zztest,
  (select count(*) from public.notas_credito_venta
   where contacto_id in (select id from zc) or factura_id in (select id from zf)) as notas_credito_venta_zztest,
  (select count(*) from public.nota_credito_venta_lineas
   where nota_id in (select id from public.notas_credito_venta
                     where contacto_id in (select id from zc) or factura_id in (select id from zf))) as nota_credito_venta_lineas_zztest,
  (select count(*) from public.notas_debito_venta
   where contacto_id in (select id from zc) or factura_id in (select id from zf)) as notas_debito_venta_zztest,
  (select count(*) from public.nota_debito_venta_lineas
   where nota_id in (select id from public.notas_debito_venta
                     where contacto_id in (select id from zc) or factura_id in (select id from zf))) as nota_debito_venta_lineas_zztest;

-- 3) Compras y gastos de prueba.
with zc as (
  select id from public.contactos where nombre ilike 'ZZTEST%'
),
zfp as (
  select id from public.facturas_proveedor where contacto_id in (select id from zc)
)
select
  (select count(*) from zfp) as facturas_proveedor_zztest,
  (select count(*) from public.facturas_proveedor_lineas where factura_proveedor_id in (select id from zfp)) as facturas_proveedor_lineas_zztest,
  (select count(*) from public.pagos_proveedor
   where contacto_id in (select id from zc) or factura_proveedor_id in (select id from zfp)) as pagos_proveedor_zztest,
  (select count(*) from public.notas_credito_compra
   where contacto_id in (select id from zc) or factura_proveedor_id in (select id from zfp)) as notas_credito_compra_zztest,
  (select count(*) from public.nota_credito_compra_lineas
   where nota_id in (select id from public.notas_credito_compra
                     where contacto_id in (select id from zc) or factura_proveedor_id in (select id from zfp))) as nota_credito_compra_lineas_zztest,
  (select count(*) from public.gastos_menores
   where contacto_id in (select id from zc) or descripcion ilike 'ZZTEST%') as gastos_menores_zztest;

-- 4) Otros documentos comerciales de prueba.
with zc as (
  select id from public.contactos where nombre ilike 'ZZTEST%'
)
select
  (select count(*) from public.cotizaciones where contacto_id in (select id from zc)) as cotizaciones_zztest,
  (select count(*) from public.remisiones where contacto_id in (select id from zc)) as remisiones_zztest,
  (select count(*) from public.ordenes_compra where contacto_id in (select id from zc)) as ordenes_compra_zztest,
  (select count(*) from public.facturas_recurrentes where contacto_id in (select id from zc)) as facturas_recurrentes_zztest,
  (select count(*) from public.pagos_recurrentes where contacto_id in (select id from zc)) as pagos_recurrentes_zztest;

-- 5) Asientos y líneas: estimado por contacto de la línea o descripción.
select
  (select count(*) from public.asientos a
   where a.descripcion ilike '%ZZTEST%'
      or exists (
        select 1
        from public.asiento_lineas l
        join public.contactos c on c.id = l.contacto_id
        where l.asiento_id = a.id and c.nombre ilike 'ZZTEST%'
      )) as asientos_zztest,
  (select count(*) from public.asiento_lineas l
   where exists (
     select 1
     from public.asientos a
     join public.asiento_lineas l2 on l2.asiento_id = a.id
     join public.contactos c on c.id = l2.contacto_id
     where a.id = l.asiento_id and c.nombre ilike 'ZZTEST%'
   )) as asiento_lineas_zztest;

-- 6) Volumen total de los documentos que se borrarían (para dimensionar).
with zc as (
  select id from public.contactos where nombre ilike 'ZZTEST%'
)
select
  (select count(*) from public.facturas where contacto_id in (select id from zc))
  + (select count(*) from public.pagos_recibidos where contacto_id in (select id from zc))
  + (select count(*) from public.facturas_proveedor where contacto_id in (select id from zc))
  + (select count(*) from public.pagos_proveedor where contacto_id in (select id from zc))
  + (select count(*) from public.gastos_menores where contacto_id in (select id from zc))
  + (select count(*) from public.notas_credito_venta where contacto_id in (select id from zc))
  + (select count(*) from public.notas_debito_venta where contacto_id in (select id from zc))
  + (select count(*) from public.notas_credito_compra where contacto_id in (select id from zc))
  as documentos_zztest_estimados;

-- ---------------------------------------------------------------------------
-- Junio 2020: quedó ABIERTO
--
-- El test de concurrencia C6 cerró y reabrió junio 2020; al terminar lo dejó
-- en estado 'abierto' como pedía el plan (RESULTADOS.md de la sesión de
-- pruebas). No se toca aquí. Estado actual:
-- ---------------------------------------------------------------------------

select p.periodo, p.estado, p.cerrado_en, p.actualizado_en
from public.periodos_contables p
where p.periodo = '2020-06-01';

-- Para cerrarlo hace falta:
--   1. Decidir con Waldy si los asientos de junio 2020 son ZZTEST y si se
--      borran antes o se quedan. Cerrar el mes no borra nada: solo bloquea
--      asientos nuevos con esa fecha.
--   2. Contable revisa el balance de junio 2020 y confirma que no hay
--      ajustes pendientes.
--   3. Waldy da el OK (es un cambio de datos reales).
--   4. Cerrar desde /dashboard/contabilidad/periodos o con
--      select public.cerrar_periodo('2020-06-01'); como admin.
--   5. Verificar que quede 'cerrado' y anotarlo en HANDOFF.md.

-- ---------------------------------------------------------------------------
-- PLAN DE BORRADO — COMENTADO, NO EJECUTAR
--
-- Requisitos antes de descomentar:
--   · OK explícito de Waldy y respaldo/point-in-time de Supabase.
--   · Copia de este inventario antes y después.
--   · Ventana sin usuarios.
--   · Revisión de Coder. El sistema no tiene borrado físico: esto salta el
--     motor de anulación a propósito y debe ser la última opción.
--
-- Orden sugerido (hijos antes que padres). Los DELETE de líneas pueden
-- omitirse si la FK tiene ON DELETE CASCADE, pero se dejan explícitos.
--
-- begin;
--
-- -- 1) Documentos de venta.
-- delete from public.nota_credito_venta_lineas
--  where nota_id in (select id from public.notas_credito_venta
--                    where contacto_id in (select id from public.contactos where nombre ilike 'ZZTEST%'));
-- delete from public.nota_debito_venta_lineas
--  where nota_id in (select id from public.notas_debito_venta
--                    where contacto_id in (select id from public.contactos where nombre ilike 'ZZTEST%'));
-- delete from public.notas_credito_venta
--  where contacto_id in (select id from public.contactos where nombre ilike 'ZZTEST%');
-- delete from public.notas_debito_venta
--  where contacto_id in (select id from public.contactos where nombre ilike 'ZZTEST%');
-- delete from public.pagos_recibidos
--  where contacto_id in (select id from public.contactos where nombre ilike 'ZZTEST%');
-- delete from public.factura_lineas
--  where factura_id in (select id from public.facturas
--                       where contacto_id in (select id from public.contactos where nombre ilike 'ZZTEST%'));
-- delete from public.facturas
--  where contacto_id in (select id from public.contactos where nombre ilike 'ZZTEST%');
--
-- -- 2) Compras y gastos.
-- delete from public.nota_credito_compra_lineas
--  where nota_id in (select id from public.notas_credito_compra
--                    where contacto_id in (select id from public.contactos where nombre ilike 'ZZTEST%'));
-- delete from public.notas_credito_compra
--  where contacto_id in (select id from public.contactos where nombre ilike 'ZZTEST%');
-- delete from public.pagos_proveedor
--  where contacto_id in (select id from public.contactos where nombre ilike 'ZZTEST%');
-- delete from public.facturas_proveedor_lineas
--  where factura_proveedor_id in (select id from public.facturas_proveedor
--                                 where contacto_id in (select id from public.contactos where nombre ilike 'ZZTEST%'));
-- delete from public.facturas_proveedor
--  where contacto_id in (select id from public.contactos where nombre ilike 'ZZTEST%');
-- delete from public.gastos_menores
--  where contacto_id in (select id from public.contactos where nombre ilike 'ZZTEST%');
--
-- -- 3) Otros documentos comerciales.
-- delete from public.cotizacion_lineas
--  where cotizacion_id in (select id from public.cotizaciones
--                          where contacto_id in (select id from public.contactos where nombre ilike 'ZZTEST%'));
-- delete from public.remision_lineas
--  where remision_id in (select id from public.remisiones
--                        where contacto_id in (select id from public.contactos where nombre ilike 'ZZTEST%'));
-- delete from public.orden_compra_lineas
--  where orden_id in (select id from public.ordenes_compra
--                     where contacto_id in (select id from public.contactos where nombre ilike 'ZZTEST%'));
-- delete from public.factura_recurrente_lineas
--  where recurrente_id in (select id from public.facturas_recurrentes
--                          where contacto_id in (select id from public.contactos where nombre ilike 'ZZTEST%'));
-- delete from public.cotizaciones
--  where contacto_id in (select id from public.contactos where nombre ilike 'ZZTEST%');
-- delete from public.remisiones
--  where contacto_id in (select id from public.contactos where nombre ilike 'ZZTEST%');
-- delete from public.ordenes_compra
--  where contacto_id in (select id from public.contactos where nombre ilike 'ZZTEST%');
-- delete from public.facturas_recurrentes
--  where contacto_id in (select id from public.contactos where nombre ilike 'ZZTEST%');
-- delete from public.pagos_recurrentes
--  where contacto_id in (select id from public.contactos where nombre ilike 'ZZTEST%');
--
-- -- 4) Asientos huérfanos de los documentos borrados.
-- delete from public.asiento_lineas
--  where asiento_id in (select id from public.asientos a
--                       where a.descripcion ilike '%ZZTEST%'
--                          or exists (select 1 from public.asiento_lineas l
--                                     join public.contactos c on c.id = l.contacto_id
--                                     where l.asiento_id = a.id and c.nombre ilike 'ZZTEST%'));
-- delete from public.asientos a
--  where a.descripcion ilike '%ZZTEST%'
--     or exists (select 1 from public.asiento_lineas l
--                join public.contactos c on c.id = l.contacto_id
--                where l.asiento_id = a.id and c.nombre ilike 'ZZTEST%');
--
-- -- 5) Contactos y productos al final.
-- delete from public.existencias
--  where producto_id in (select id from public.productos where nombre ilike 'ZZTEST%');
-- delete from public.productos where nombre ilike 'ZZTEST%';
-- delete from public.contactos where nombre ilike 'ZZTEST%';
--
-- commit;
--
-- Después: repetir los conteos del inicio (deben dar 0), correr
-- docs/pruebas/cuadre.sql y revisar que las series de numeraciones no se
-- hayan movido. Nunca hacer esto sin el OK de Waldy.
-- ---------------------------------------------------------------------------

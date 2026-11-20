-- ===========================================================================
-- MEDOXIGAS CONTABILIDAD · RESET A BASE VIRGEN
-- Proyecto Supabase: MEDOXIGAS-CONTABILIDAD (ljfdhrnvlsfaweuvnqxz)
-- ===========================================================================
--
-- QUÉ HACE
--   Deja la base sin NINGÚN documento ni dato de usuario/prueba: facturas,
--   compras, pagos, notas, cotizaciones, conduces, órdenes, recurrentes,
--   inventario, bancos, activos, periodos, asientos, contactos, productos,
--   adjuntos y auditoría quedan en 0 filas. Reinicia la numeración de los
--   documentos y de las líneas, y deja las series fiscales y los tipos de
--   entrada de diario en `siguiente = 1`.
--
-- QUÉ NO TOCA (nunca)
--   · auth.users y public.perfiles  → usuarios y roles reales.
--   · public.empresa               → la fila id = 1 se conserva tal cual.
--   · public.cuentas / public.config_contable → catálogo y configuración.
--   · Semillas: impuestos, retenciones, monedas, términos de pago,
--     plantillas de impresión, almacén principal y lista de precios general.
--   · Esquema, migraciones, RLS, funciones, triggers y buckets.
--
-- CÓMO EJECUTARLO (léelo entero antes)
--   1. Respaldo listo (Supabase → Database → Backups). Esto NO se deshace.
--   2. App cerrada: nadie escribiendo desde la web ni desde local.
--   3. SQL Editor de Supabase → pega TODO este archivo → Run.
--      (No uses "Run selection": el script es una sola transacción.)
--   4. Si algo falla, Postgres revierte TODO solo: la base queda como estaba.
--   5. Después del COMMIT corre a mano el bloque de VERIFICACIÓN del final.
--
-- ATOMICIDAD
--   Todo va entre BEGIN y COMMIT. Antes de confirmar, un bloque DO comprueba
--   que las tablas vaciadas quedaron en 0, que los catálogos siguen ahí, que
--   las series son 8, los tipos 13 y las secuencias están en 1. Si algo no
--   cuadra, lanza excepción y no se confirma nada.
--
-- TRIGGERS Y LOCKS
--   TRUNCATE no dispara triggers FOR EACH ROW (auditoría, asiento cuadrado,
--   periodo cerrado). No hay ningún trigger BEFORE/AFTER TRUNCATE en el
--   esquema. TRUNCATE ... RESTART IDENTITY CASCADE es instantáneo aunque
--   haya cientos de miles de líneas.
--
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0) Guardas: si esta no es la base del sistema, no se toca nada.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.empresa') is null
     or to_regclass('public.perfiles') is null
     or to_regclass('public.asientos') is null
     or to_regclass('public.numeraciones') is null then
    raise exception 'Esta base no es MEDOXIGAS-CONTABILIDAD (faltan tablas del motor). No se tocó nada.';
  end if;

  if not exists (select 1 from public.perfiles) then
    raise exception 'public.perfiles está vacía: se aborta para no dejar el sistema sin usuarios.';
  end if;

  if not exists (select 1 from public.config_contable) then
    raise exception 'public.config_contable está vacía: se aborta para no dejar el motor sin cuentas.';
  end if;
end $$;

-- ===========================================================================
-- 0.1) INVENTARIO DE LAS 64 TABLAS DE public
-- ===========================================================================
-- 51 se vacían (paso 1) y 13 se conservan (paso 3). Los marcadores
-- @conservar son el candado: src/lib/supabase/reset-virgen.test.ts compara
-- esta lista + el TRUNCATE contra TODAS las tablas de supabase/migrations y
-- falla si una tabla queda sin clasificar.
--
-- @conservar public.perfiles
-- @conservar public.empresa
-- @conservar public.cuentas
-- @conservar public.config_contable
-- @conservar public.impuestos
-- @conservar public.retenciones
-- @conservar public.monedas
-- @conservar public.terminos_pago
-- @conservar public.plantillas_impresion
-- @conservar public.almacenes
-- @conservar public.listas_precios
-- @conservar public.numeraciones
-- @conservar public.tipos_entrada_diario

-- ===========================================================================
-- 1) VACIAR las tablas de documentos, usuario y prueba
-- ===========================================================================
-- Un solo TRUNCATE: atómico e instantáneo. RESTART IDENTITY reinicia las
-- secuencias que pertenecen a una columna; las secuencias de numeración se
-- reinician aparte en el paso 2. CASCADE arrastra las hijas que dependan por
-- FK (todas están en esta lista).

truncate table
  public.activo_depreciaciones,
  public.activos_fijos,
  public.adjuntos,
  public.ajuste_inventario_lineas,
  public.ajustes_inventario,
  public.asiento_lineas,
  public.asientos,
  public.auditoria,
  public.categorias_productos,
  public.centros_costo,
  public.cierres_resultados,
  public.conciliacion_movimientos,
  public.conciliaciones,
  public.contactos,
  public.cotizacion_lineas,
  public.cotizaciones,
  public.existencias,
  public.factura_lineas,
  public.factura_recurrente_generaciones,
  public.factura_recurrente_lineas,
  public.facturas,
  public.facturas_proveedor,
  public.facturas_proveedor_lineas,
  public.facturas_recurrentes,
  public.gastos_menores,
  public.nota_credito_compra_lineas,
  public.nota_credito_venta_lineas,
  public.nota_debito_venta_lineas,
  public.notas_credito_compra,
  public.notas_credito_venta,
  public.notas_debito_venta,
  public.orden_compra_lineas,
  public.ordenes_compra,
  public.pago_proveedor_aplicacion_retenciones,
  public.pago_proveedor_aplicaciones,
  public.pago_proveedor_retenciones,
  public.pago_recibido_aplicacion_retenciones,
  public.pago_recibido_aplicaciones,
  public.pago_recibido_retenciones,
  public.pagos_proveedor,
  public.pagos_recibidos,
  public.pagos_recurrentes,
  public.periodos_contables,
  public.producto_precios,
  public.productos,
  public.remision_lineas,
  public.remisiones,
  public.tasas_cambio,
  public.transferencia_inventario_lineas,
  public.transferencias_inventario,
  public.vendedores
restart identity cascade;

-- ===========================================================================
-- 2) SECUENCIAS de documentos: volver a 1
-- ===========================================================================
-- Las numeraciones usan secuencias creadas con CREATE SEQUENCE y
-- nextval('...'), que NO son propiedad de la columna: RESTART IDENTITY no las
-- toca. Este bloque reinicia TODAS las secuencias de public (documentos y
-- orden de líneas), incluidas las que agregue una migración futura.

do $$
declare
  v_secuencia text;
begin
  for v_secuencia in
    select s.sequencename
    from pg_sequences s
    where s.schemaname = 'public'
    order by s.sequencename
  loop
    execute format('alter sequence public.%I restart with 1', v_secuencia);
  end loop;
end $$;

-- ===========================================================================
-- 3) CATÁLOGOS: limpiar SOLO lo que dejaron las pruebas
-- ===========================================================================
-- Las cuentas, impuestos, retenciones, monedas, términos y plantillas base
-- se conservan. Se borran únicamente filas con marca de prueba
-- (ZZTEST / E2E- / Prueba) y siempre que nada las esté usando.

-- 3.1 Cuentas contables de prueba (bancos E2E, cuentas ZZTEST…).
--     Nunca borra una cuenta con hijas ni referenciada por la configuración
--     contable, retenciones o impuestos. El catálogo base no lleva esas
--     marcas, así que queda intacto.
delete from public.cuentas c
where (
    c.nombre ilike '%ZZTEST%'
    or c.nombre ilike '%E2E-%'
    or c.nombre ilike '%Prueba%'
  )
  and not exists (select 1 from public.cuentas h where h.padre_id = c.id)
  and not exists (select 1 from public.config_contable k where k.cuenta_id = c.id)
  and not exists (
    select 1 from public.retenciones r
    where r.cuenta_id = c.id or r.cuenta_anticipo_id = c.id
  )
  and not exists (select 1 from public.impuestos i where i.cuenta_id = c.id);

-- 3.2 Impuestos de prueba.
delete from public.impuestos i
where (
    i.codigo ilike '%ZZTEST%'
    or i.codigo ilike 'E2E-%'
    or i.nombre ilike '%ZZTEST%'
    or i.nombre ilike '%E2E-%'
    or i.nombre ilike '%Prueba%'
  )
  and not exists (select 1 from public.productos p where p.impuesto_id = i.id);

-- 3.3 Retenciones de prueba (los pagos ya están vacíos).
delete from public.retenciones r
where (
    r.nombre ilike '%ZZTEST%'
    or r.nombre ilike '%E2E-%'
    or r.nombre ilike '%Prueba%'
  )
  and not exists (select 1 from public.pago_recibido_retenciones x where x.retencion_id = r.id)
  and not exists (select 1 from public.pago_proveedor_retenciones x where x.retencion_id = r.id)
  and not exists (select 1 from public.pago_recibido_aplicacion_retenciones x where x.retencion_id = r.id)
  and not exists (select 1 from public.pago_proveedor_aplicacion_retenciones x where x.retencion_id = r.id);

-- 3.4 Monedas de prueba (las tasas de cambio ya están vacías).
delete from public.monedas m
where (
    m.codigo ilike '%ZZTEST%'
    or m.codigo ilike 'E2E-%'
    or m.nombre ilike '%ZZTEST%'
    or m.nombre ilike '%E2E-%'
    or m.nombre ilike '%Prueba%'
  )
  and not exists (select 1 from public.tasas_cambio t where t.moneda_codigo = m.codigo);

-- 3.5 Términos de pago de prueba.
delete from public.terminos_pago t
where (
    t.nombre ilike '%ZZTEST%'
    or t.nombre ilike '%E2E-%'
    or t.nombre ilike '%Prueba%'
  );

-- 3.6 Plantillas de impresión: la tabla solo admite factura/cotizacion/conduce
--     (check constraint), así que no puede tener filas de prueba. No se toca.

-- 3.7 Almacenes: dejar solo el principal.
--     Primero garantiza que exista uno principal; después borra los extra.
update public.almacenes a
set es_principal = true
where a.id = (select b.id from public.almacenes b order by b.creado_en, b.id limit 1)
  and not exists (select 1 from public.almacenes p where p.es_principal);

insert into public.almacenes (nombre, es_principal)
select 'Principal', true
where not exists (select 1 from public.almacenes);

delete from public.almacenes a
where not a.es_principal
  and exists (select 1 from public.almacenes p where p.es_principal);

-- 3.8 Listas de precios: dejar solo la principal (mismo criterio).
update public.listas_precios l
set es_principal = true
where l.id = (select b.id from public.listas_precios b order by b.creado_en, b.id limit 1)
  and not exists (select 1 from public.listas_precios p where p.es_principal);

insert into public.listas_precios (nombre, es_principal, tipo)
select 'General', true, 'fijo'
where not exists (select 1 from public.listas_precios);

delete from public.listas_precios l
where not l.es_principal
  and exists (select 1 from public.listas_precios p where p.es_principal);

-- 3.9 Numeraciones: solo las 8 series fiscales del sistema, en 1.
--     Primero quita duplicados de un mismo tipo+prefijo (las RPC usan la de
--     id más bajo, así que las demás nunca se consumirían).
with repetidas as (
  select n.id
  from (
    select
      id,
      row_number() over (partition by tipo_comprobante, prefijo order by id) as posicion
    from public.numeraciones
  ) n
  where n.posicion > 1
)
delete from public.numeraciones x
using repetidas r
where x.id = r.id;

delete from public.numeraciones
where prefijo not in ('B01', 'B02', 'B03', 'B04', 'B13', 'B14', 'B15', 'B16');

-- Repone cualquier serie fiscal que falte (idempotente; no toca las que ya
-- están, solo les reinicia el consecutivo).
insert into public.numeraciones (tipo_comprobante, nombre, prefijo, siguiente, hasta, activa)
select v.tipo_comprobante, v.nombre, v.prefijo, 1, 100000, true
from (values
  ('01', 'Crédito fiscal', 'B01'),
  ('02', 'Consumo', 'B02'),
  ('03', 'Notas de débito', 'B03'),
  ('04', 'Notas de crédito', 'B04'),
  ('13', 'Gastos menores', 'B13'),
  ('14', 'Régimen especial', 'B14'),
  ('15', 'Gubernamental', 'B15'),
  ('16', 'Exportaciones', 'B16')
) as v(tipo_comprobante, nombre, prefijo)
where not exists (
  select 1 from public.numeraciones n where n.prefijo = v.prefijo
);

update public.numeraciones set siguiente = 1 where siguiente <> 1;

-- 3.10 Tipos de entrada de diario: solo los 13 del sistema, en 1.
delete from public.tipos_entrada_diario
where prefijo not in (
  'AC', 'DTB', 'A', 'CA', 'CPC', 'CPP', 'D', 'IMP', 'ING', 'NO', 'PV', 'RET', 'SI'
);

insert into public.tipos_entrada_diario (nombre, prefijo, siguiente, activo)
select v.nombre, v.prefijo, 1, true
from (values
  ('Ajuste contable', 'AC'),
  ('Ajustes por diferencia en tasa de bancos', 'DTB'),
  ('Amortizaciones', 'A'),
  ('Cierre de periodos contables', 'CA'),
  ('Cuentas por cobrar', 'CPC'),
  ('Cuentas por pagar', 'CPP'),
  ('Depreciaciones', 'D'),
  ('Impuestos', 'IMP'),
  ('Ingresos', 'ING'),
  ('Nómina', 'NO'),
  ('Provisiones', 'PV'),
  ('Retenciones', 'RET'),
  ('Saldos iniciales', 'SI')
) as v(nombre, prefijo)
where not exists (
  select 1 from public.tipos_entrada_diario t where t.prefijo = v.prefijo
);

update public.tipos_entrada_diario set siguiente = 1 where siguiente <> 1;

-- ===========================================================================
-- 4) EMPRESA: intacta
-- ===========================================================================
-- La fila id = 1 conserva nombre, RNC, dirección y logo. Si quieres cambiar
-- los datos de la empresa, hazlo en la app: Configuración > Empresa.
-- Solo se repone la fila si alguien la hubiera borrado (no debería existir).
insert into public.empresa (id, nombre)
select 1, 'MEDOXIGAS ALC, SRL'
where not exists (select 1 from public.empresa where id = 1);

-- ===========================================================================
-- 5) VERIFICACIÓN DENTRO DE LA TRANSACCIÓN
-- ===========================================================================
-- Si algo de esto falla, el COMMIT no ocurre y la base queda como estaba.
-- La lista del array es la MISMA del TRUNCATE (el candado de Vitest exige
-- que coincidan). Si agregas una tabla arriba, agrégala aquí.

do $$
declare
  v_tabla text;
  v_filas bigint;
begin
  foreach v_tabla in array array[
    'activo_depreciaciones',
    'activos_fijos',
    'adjuntos',
    'ajuste_inventario_lineas',
    'ajustes_inventario',
    'asiento_lineas',
    'asientos',
    'auditoria',
    'categorias_productos',
    'centros_costo',
    'cierres_resultados',
    'conciliacion_movimientos',
    'conciliaciones',
    'contactos',
    'cotizacion_lineas',
    'cotizaciones',
    'existencias',
    'factura_lineas',
    'factura_recurrente_generaciones',
    'factura_recurrente_lineas',
    'facturas',
    'facturas_proveedor',
    'facturas_proveedor_lineas',
    'facturas_recurrentes',
    'gastos_menores',
    'nota_credito_compra_lineas',
    'nota_credito_venta_lineas',
    'nota_debito_venta_lineas',
    'notas_credito_compra',
    'notas_credito_venta',
    'notas_debito_venta',
    'orden_compra_lineas',
    'ordenes_compra',
    'pago_proveedor_aplicacion_retenciones',
    'pago_proveedor_aplicaciones',
    'pago_proveedor_retenciones',
    'pago_recibido_aplicacion_retenciones',
    'pago_recibido_aplicaciones',
    'pago_recibido_retenciones',
    'pagos_proveedor',
    'pagos_recibidos',
    'pagos_recurrentes',
    'periodos_contables',
    'producto_precios',
    'productos',
    'remision_lineas',
    'remisiones',
    'tasas_cambio',
    'transferencia_inventario_lineas',
    'transferencias_inventario',
    'vendedores'
  ] loop
    execute format('select count(*) from public.%I', v_tabla) into v_filas;
    if v_filas <> 0 then
      raise exception 'public.% quedó con % filas: se revierte todo el reset.', v_tabla, v_filas;
    end if;
  end loop;

  if (select count(*) from public.numeraciones) <> 8 then
    select count(*) into v_filas from public.numeraciones;
    raise exception 'numeraciones debería tener 8 series fiscales y tiene %.', v_filas;
  end if;

  if exists (select 1 from public.numeraciones where siguiente <> 1) then
    raise exception 'numeraciones tiene series con siguiente <> 1: se revierte todo.';
  end if;

  if (select count(*) from public.tipos_entrada_diario) <> 13 then
    select count(*) into v_filas from public.tipos_entrada_diario;
    raise exception 'tipos_entrada_diario debería tener 13 tipos y tiene %.', v_filas;
  end if;

  if exists (select 1 from public.tipos_entrada_diario where siguiente <> 1) then
    raise exception 'tipos_entrada_diario tiene tipos con siguiente <> 1: se revierte todo.';
  end if;

  if (select count(*) from public.empresa) <> 1 then
    raise exception 'empresa debe tener exactamente 1 fila.';
  end if;

  if not exists (select 1 from public.perfiles) then
    raise exception 'perfiles quedó vacía: se revierte todo.';
  end if;

  if not exists (select 1 from public.cuentas) then
    raise exception 'cuentas quedó vacía: se revierte todo.';
  end if;

  if (select count(*) from public.almacenes) <> 1 then
    select count(*) into v_filas from public.almacenes;
    raise exception 'almacenes debe quedar con 1 almacén principal y tiene %.', v_filas;
  end if;

  if (select count(*) from public.listas_precios) <> 1 then
    select count(*) into v_filas from public.listas_precios;
    raise exception 'listas_precios debe quedar con 1 lista principal y tiene %.', v_filas;
  end if;

  if exists (
    select 1
    from pg_sequences s
    where s.schemaname = 'public'
      and (case when s.is_called then s.last_value + 1 else coalesce(s.last_value, 1) end) <> 1
  ) then
    raise exception 'alguna secuencia de public no quedó en 1: se revierte todo.';
  end if;
end $$;

commit;

-- ===========================================================================
-- 6) VERIFICACIÓN DE SOLO LECTURA (correr después del COMMIT)
-- ===========================================================================
-- No cambia nada. Si una tabla transaccional muestra filas distintas de 0,
-- algo volvió a escribir después del reset (app abierta, E2E, un cron…).

-- 6.1 Todas las tablas que deben quedar en 0.
select tabla, filas, filas = 0 as en_cero
from (
  select 'activo_depreciaciones' as tabla, count(*) as filas from public.activo_depreciaciones
  union all select 'activos_fijos', count(*) from public.activos_fijos
  union all select 'adjuntos', count(*) from public.adjuntos
  union all select 'ajuste_inventario_lineas', count(*) from public.ajuste_inventario_lineas
  union all select 'ajustes_inventario', count(*) from public.ajustes_inventario
  union all select 'asiento_lineas', count(*) from public.asiento_lineas
  union all select 'asientos', count(*) from public.asientos
  union all select 'auditoria', count(*) from public.auditoria
  union all select 'categorias_productos', count(*) from public.categorias_productos
  union all select 'centros_costo', count(*) from public.centros_costo
  union all select 'cierres_resultados', count(*) from public.cierres_resultados
  union all select 'conciliacion_movimientos', count(*) from public.conciliacion_movimientos
  union all select 'conciliaciones', count(*) from public.conciliaciones
  union all select 'contactos', count(*) from public.contactos
  union all select 'cotizacion_lineas', count(*) from public.cotizacion_lineas
  union all select 'cotizaciones', count(*) from public.cotizaciones
  union all select 'existencias', count(*) from public.existencias
  union all select 'factura_lineas', count(*) from public.factura_lineas
  union all select 'factura_recurrente_generaciones', count(*) from public.factura_recurrente_generaciones
  union all select 'factura_recurrente_lineas', count(*) from public.factura_recurrente_lineas
  union all select 'facturas', count(*) from public.facturas
  union all select 'facturas_proveedor', count(*) from public.facturas_proveedor
  union all select 'facturas_proveedor_lineas', count(*) from public.facturas_proveedor_lineas
  union all select 'facturas_recurrentes', count(*) from public.facturas_recurrentes
  union all select 'gastos_menores', count(*) from public.gastos_menores
  union all select 'nota_credito_compra_lineas', count(*) from public.nota_credito_compra_lineas
  union all select 'nota_credito_venta_lineas', count(*) from public.nota_credito_venta_lineas
  union all select 'nota_debito_venta_lineas', count(*) from public.nota_debito_venta_lineas
  union all select 'notas_credito_compra', count(*) from public.notas_credito_compra
  union all select 'notas_credito_venta', count(*) from public.notas_credito_venta
  union all select 'notas_debito_venta', count(*) from public.notas_debito_venta
  union all select 'orden_compra_lineas', count(*) from public.orden_compra_lineas
  union all select 'ordenes_compra', count(*) from public.ordenes_compra
  union all select 'pago_proveedor_aplicacion_retenciones', count(*) from public.pago_proveedor_aplicacion_retenciones
  union all select 'pago_proveedor_aplicaciones', count(*) from public.pago_proveedor_aplicaciones
  union all select 'pago_proveedor_retenciones', count(*) from public.pago_proveedor_retenciones
  union all select 'pago_recibido_aplicacion_retenciones', count(*) from public.pago_recibido_aplicacion_retenciones
  union all select 'pago_recibido_aplicaciones', count(*) from public.pago_recibido_aplicaciones
  union all select 'pago_recibido_retenciones', count(*) from public.pago_recibido_retenciones
  union all select 'pagos_proveedor', count(*) from public.pagos_proveedor
  union all select 'pagos_recibidos', count(*) from public.pagos_recibidos
  union all select 'pagos_recurrentes', count(*) from public.pagos_recurrentes
  union all select 'periodos_contables', count(*) from public.periodos_contables
  union all select 'producto_precios', count(*) from public.producto_precios
  union all select 'productos', count(*) from public.productos
  union all select 'remision_lineas', count(*) from public.remision_lineas
  union all select 'remisiones', count(*) from public.remisiones
  union all select 'tasas_cambio', count(*) from public.tasas_cambio
  union all select 'transferencia_inventario_lineas', count(*) from public.transferencia_inventario_lineas
  union all select 'transferencias_inventario', count(*) from public.transferencias_inventario
  union all select 'vendedores', count(*) from public.vendedores
) conteos
order by tabla;

-- 6.2 Catálogos conservados (cada fila trae su referencia esperada).
select 'empresa' as tabla, count(*) as filas, '1 fila; nombre y logo intactos' as esperado from public.empresa
union all select 'perfiles', count(*), 'usuarios y roles reales (>= 1)' from public.perfiles
union all select 'cuentas', count(*), 'catálogo base + cuentas reales' from public.cuentas
union all select 'config_contable', count(*), 'configuración del motor' from public.config_contable
union all select 'impuestos', count(*), 'semilla = 7' from public.impuestos
union all select 'retenciones', count(*), 'semilla = 5' from public.retenciones
union all select 'monedas', count(*), 'semilla = 3' from public.monedas
union all select 'terminos_pago', count(*), 'semilla = 5' from public.terminos_pago
union all select 'plantillas_impresion', count(*), 'semilla = 3' from public.plantillas_impresion
union all select 'almacenes', count(*), 'exactamente 1 (principal)' from public.almacenes
union all select 'listas_precios', count(*), 'exactamente 1 (principal)' from public.listas_precios
union all select 'numeraciones', count(*), 'exactamente 8 (B01…B16)' from public.numeraciones
union all select 'tipos_entrada_diario', count(*), 'exactamente 13' from public.tipos_entrada_diario
order by tabla;

-- 6.3 Series y tipos con su consecutivo (todo debe decir 1).
select 'numeracion' as clase, tipo_comprobante as tipo, prefijo, nombre, siguiente, activa
from public.numeraciones
union all
select 'tipo_entrada' as clase, prefijo as tipo, prefijo, nombre, siguiente, activo
from public.tipos_entrada_diario
order by clase, tipo, prefijo;

-- 6.4 Secuencias: `proximo_valor` debe ser 1 en todas.
select
  sequencename as secuencia,
  last_value,
  is_called,
  case when is_called then last_value + 1 else coalesce(last_value, 1) end as proximo_valor
from pg_sequences
where schemaname = 'public'
order by sequencename;

-- 6.5 Espacio: tamaño por tabla (las vaciadas bajan a unos pocos kB) y total.
select
  c.relname as tabla,
  pg_size_pretty(pg_total_relation_size(c.oid)) as tamano
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by pg_total_relation_size(c.oid) desc;

select
  current_database() as base,
  pg_size_pretty(pg_database_size(current_database())) as tamano_total;

-- 6.6 Datos de la empresa: mira `logo_url` antes de vaciar el bucket
--     `productos`, porque el logo también vive ahí.
select id, nombre, rnc, correo, logo_url from public.empresa;

-- 6.7 Archivos que quedan en los buckets de la app (deben ir a 0; ver el .md).
select bucket_id, count(*) as objetos
from storage.objects
where bucket_id in ('productos', 'documentos')
group by bucket_id
order by bucket_id;

-- ===========================================================================
-- 7) NOTAS FINALES (no son SQL)
-- ===========================================================================
--
-- ESPACIO EN DISCO
--   TRUNCATE ya estrena archivo vacío: el disco de esas tablas se libera en
--   el mismo COMMIT. VACUUM FULL no hace falta. Si aun así quieres compactar
--   las tablas conservadas (perfiles, cuentas, catálogos), córrelo FUERA de
--   esta transacción, uno por tabla y en una ventana sin tráfico:
--       vacuum full public.perfiles;
--       vacuum full public.cuentas;
--       vacuum full public.config_contable;
--   (VACUUM no puede ir dentro de BEGIN/COMMIT y bloquea la tabla mientras
--   corre; con estas tablas tarda menos de un segundo.)
--
-- STORAGE
--   Este script toca SOLO el esquema public. Los archivos viven aparte:
--   vacía los buckets `productos` y `documentos` desde Storage en el panel de
--   Supabase (ver docs/pruebas/RESET-VIRGEN.md, paso 3). En `productos`
--   conserva el objeto del logo de la empresa si `empresa.logo_url` lo usa.
--
-- POSTGRESQL LOCAL
--   Si algún día lo corres contra `supabase start`, el dueño también es
--   superusuario y RLS no estorba (RLS no aplica a los dueños de las tablas).
-- ===========================================================================

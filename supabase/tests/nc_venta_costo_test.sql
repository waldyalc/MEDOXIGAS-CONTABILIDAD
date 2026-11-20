begin;
select plan(16);

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin'),
  ('33333333-3333-3333-3333-333333333333', 'Lector', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Cuenta de devoluciones en ventas
-- ---------------------------------------------------------------------------

select is(
  (select c.nombre
   from public.config_contable cc
   join public.cuentas c on c.id = cc.cuenta_id
   where cc.clave = 'devoluciones_ventas'),
  'Devoluciones en ventas',
  'la cuenta Devoluciones en ventas existe y está configurada'
);

select ok(
  (select c.tipo = 'ingreso' and c.acepta_movimientos and c.activa
   from public.config_contable cc
   join public.cuentas c on c.id = cc.cuenta_id
   where cc.clave = 'devoluciones_ventas'),
  'la cuenta es de ingresos, activa y acepta movimientos'
);

select is(
  (select c.padre_id
   from public.config_contable cc
   join public.cuentas c on c.id = cc.cuenta_id
   where cc.clave = 'devoluciones_ventas'),
  (select c.id from public.cuentas c where c.codigo = '4'),
  'la cuenta cuelga del grupo Ingresos'
);

-- ---------------------------------------------------------------------------
-- Datos: producto a 500, venta de 2, entrada a 900 (promedio 580)
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'contacto', public.crear_contacto(jsonb_build_object(
  'tipo', 'cliente',
  'nombre', 'Cliente NC costo pgTAP'
));

insert into _ids (clave, id)
select 'producto', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Producto NC costo pgTAP',
  'precio', 800.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'inventariable', true,
  'cantidad', 10.00::numeric,
  'costo', 500.00::numeric
));

insert into _ids (clave, id)
select 'factura', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-20',
  'vencimiento', '2026-12-20',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 2.00::numeric,
    'precio', 800.00::numeric
  ))
));

insert into _ids (clave, id)
select 'factura_linea', fl.id
from public.factura_lineas fl
where fl.factura_id = (select id from _ids where clave = 'factura');

select is(
  (select fl.costo_unitario
   from public.factura_lineas fl
   where fl.id = (select id from _ids where clave = 'factura_linea')),
  500.00::numeric(14,2),
  'la venta guarda el costo original de 500.00'
);

select is(
  (select coalesce(sum(l.debito), 0)::numeric(14,2)
   from public.asiento_lineas l
   join public.cuentas c on c.id = l.cuenta_id
   where l.asiento_id = (select asiento_id from public.facturas where id = (select id from _ids where clave = 'factura'))
     and c.codigo = '5101'),
  1000.00::numeric(14,2),
  'la venta costeó 2 × 500 = 1,000.00'
);

select public.crear_ajuste_inventario(jsonb_build_object(
  'fecha', '2026-11-20',
  'almacen_id', (select a.id from public.almacenes a where a.es_principal),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'tipo', 'entrada',
    'cantidad', 2.00::numeric,
    'costo_unitario', 900.00::numeric
  ))
));

select is(
  (select p.costo from public.productos p where p.id = (select id from _ids where clave = 'producto')),
  580.00::numeric(14,2),
  'la entrada deja el costo promedio en 580.00'
);

-- ---------------------------------------------------------------------------
-- NC: reingresa al promedio vigente y debita Devoluciones en ventas
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'nota', public.crear_nota_credito_venta(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'factura'),
  'fecha', '2026-11-20',
  'devuelve_inventario', true,
  'lineas', jsonb_build_array(jsonb_build_object(
    'factura_linea_id', (select id from _ids where clave = 'factura_linea'),
    'cantidad', 2.00::numeric
  ))
));

select is(
  (select nl.costo_unitario
   from public.nota_credito_venta_lineas nl
   where nl.nota_id = (select id from _ids where clave = 'nota')),
  580.00::numeric(14,2),
  'la línea de la NC reingresa al costo promedio vigente de 580.00'
);

select is(
  (select coalesce(sum(l.debito), 0)::numeric(14,2)
   from public.asiento_lineas l
   join public.cuentas c on c.id = l.cuenta_id
   where l.asiento_id = (select asiento_id from public.notas_credito_venta where id = (select id from _ids where clave = 'nota'))
     and c.codigo = '1104'),
  1160.00::numeric(14,2),
  'el asiento debita inventario por 2 × 580 = 1,160.00'
);

select is(
  (select coalesce(sum(l.credito), 0)::numeric(14,2)
   from public.asiento_lineas l
   join public.cuentas c on c.id = l.cuenta_id
   where l.asiento_id = (select asiento_id from public.notas_credito_venta where id = (select id from _ids where clave = 'nota'))
     and c.codigo = '5101'),
  1160.00::numeric(14,2),
  'el asiento revierte costo de ventas por 1,160.00 (no por el costo original)'
);

select is(
  (select coalesce(sum(l.debito), 0)::numeric(14,2)
   from public.asiento_lineas l
   join public.config_contable cc on cc.cuenta_id = l.cuenta_id and cc.clave = 'devoluciones_ventas'
   where l.asiento_id = (select asiento_id from public.notas_credito_venta where id = (select id from _ids where clave = 'nota'))),
  1600.00::numeric(14,2),
  'el asiento debita Devoluciones en ventas por el subtotal de 1,600.00'
);

select is(
  (select coalesce(sum(l.debito), 0)::numeric(14,2)
   from public.asiento_lineas l
   join public.cuentas c on c.id = l.cuenta_id
   where l.asiento_id = (select asiento_id from public.notas_credito_venta where id = (select id from _ids where clave = 'nota'))
     and c.codigo = '4101'),
  0.00::numeric(14,2),
  'la NC ya no debita la cuenta de ventas 4101'
);

select is(
  (select round(sum(l.debito) - sum(l.credito), 2)::numeric(14,2)
   from public.asiento_lineas l
   where l.asiento_id = (select asiento_id from public.notas_credito_venta where id = (select id from _ids where clave = 'nota'))),
  0.00::numeric(14,2),
  'el asiento de la NC está cuadrado'
);

select is(
  (select total::numeric(14,2) from public.notas_credito_venta where id = (select id from _ids where clave = 'nota')),
  1888.00::numeric(14,2),
  'la NC mantiene su total de 1,888.00'
);

select is(
  (select p.costo from public.productos p where p.id = (select id from _ids where clave = 'producto')),
  580.00::numeric(14,2),
  'el promedio del producto no cambia tras el reingreso'
);

select is(
  (select p.cantidad from public.productos p where p.id = (select id from _ids where clave = 'producto')),
  12.00::numeric(14,2),
  'la devolución sube la existencia de 10 a 12'
);

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  $q$select public.crear_nota_credito_venta('{}'::jsonb)$q$,
  '42501',
  'sin permiso',
  'el rol lector no puede crear notas de crédito'
);

select * from finish();
rollback;

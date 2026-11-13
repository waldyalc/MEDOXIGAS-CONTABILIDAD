begin;
select plan(26);

create temp table _ids (clave text primary key, id uuid) on commit drop;
create temp table _valores (clave text primary key, valor text) on commit drop;
grant select, insert, update, delete on _ids to authenticated;
grant select, insert, update, delete on _valores to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local'),
  ('22222222-2222-2222-2222-222222222222', 'contador@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector@prueba.local');
insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Contador', 'contador'),
  ('33333333-3333-3333-3333-333333333333', 'Lector', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id)
select 'contacto', public.crear_contacto(jsonb_build_object(
  'tipo', 'proveedor',
  'nombre', 'Proveedor Nota Crédito'
));

insert into _ids (clave, id)
select 'producto', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Cemento Nota Crédito',
  'precio', 650.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'inventariable', true,
  'cantidad', 10.00::numeric,
  'costo', 300.00::numeric
));

insert into _ids (clave, id)
select 'factura', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 5.00::numeric,
    'costo', 400.00::numeric,
    'itbis_tasa', 18.00::numeric
  ))
));

insert into _ids (clave, id)
select 'linea', fpl.id
from public.facturas_proveedor_lineas fpl
where fpl.factura_proveedor_id = (select id from _ids where clave = 'factura');

insert into _valores (clave, valor)
select 'numeracion_antes', n.siguiente::text
from public.numeraciones n
where n.tipo_comprobante = '03'
order by n.id
limit 1;

select is(
  (select total::numeric(14,2) from public.facturas_proveedor where id = (select id from _ids where clave = 'factura')),
  2360.00::numeric(14,2),
  'factura de proveedor: total 2360.00'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where id = (select id from _ids where clave = 'producto')),
  15.00::numeric(14,2),
  'la compra sube la existencia a 15'
);

select ok(
  abs((select costo from public.productos where id = (select id from _ids where clave = 'producto')) - 333.33) < 0.01,
  'costo promedio después de la compra = 333.33'
);

select throws_ok(
  $q$select public.crear_nota_credito_compra(jsonb_build_object(
    'factura_proveedor_id', (select id from _ids where clave = 'factura'),
    'ncf', 'B0300000001',
    'lineas', jsonb_build_array(jsonb_build_object(
      'factura_proveedor_linea_id', (select id from _ids where clave = 'linea'),
      'cantidad', 1
    ))
  ))$q$,
  '22023',
  null,
  'un NCF que no es B04/E34 se rechaza'
);

insert into _ids (clave, id)
select 'nota', public.crear_nota_credito_compra(jsonb_build_object(
  'factura_proveedor_id', (select id from _ids where clave = 'factura'),
  'fecha', '2026-11-13',
  'ncf', 'B0400000001',
  'notas', 'Devolución de 2 unidades',
  'lineas', jsonb_build_array(jsonb_build_object(
    'factura_proveedor_linea_id', (select id from _ids where clave = 'linea'),
    'cantidad', 2.00::numeric
  ))
));

select is(
  (select ncf from public.notas_credito_compra where id = (select id from _ids where clave = 'nota')),
  'B0400000001',
  'la nota guarda el NCF B04 del proveedor'
);

select is(
  (select siguiente::text from public.numeraciones where tipo_comprobante = '03' order by id limit 1),
  (select valor from _valores where clave = 'numeracion_antes'),
  'la nota no consume la numeración 03/B03'
);

select is(
  (select subtotal::numeric(14,2) from public.notas_credito_compra where id = (select id from _ids where clave = 'nota')),
  800.00::numeric(14,2),
  'nota de compra: subtotal 800.00'
);

select is(
  (select itbis::numeric(14,2) from public.notas_credito_compra where id = (select id from _ids where clave = 'nota')),
  144.00::numeric(14,2),
  'nota de compra: ITBIS 144.00'
);

select is(
  (select total::numeric(14,2) from public.notas_credito_compra where id = (select id from _ids where clave = 'nota')),
  944.00::numeric(14,2),
  'nota de compra: total 944.00'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.notas_credito_compra where id = (select id from _ids where clave = 'nota'))
     and c.codigo = '2101'),
  944.00::numeric(14,2),
  'asiento nota compra: debe CxP 2101 por 944.00'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.notas_credito_compra where id = (select id from _ids where clave = 'nota'))
     and c.codigo = '1104'),
  800.00::numeric(14,2),
  'asiento nota compra: haber inventario 1104 por 800.00'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.notas_credito_compra where id = (select id from _ids where clave = 'nota'))
     and c.codigo = '1105'),
  144.00::numeric(14,2),
  'asiento nota compra: haber ITBIS adelantado 1105 por 144.00'
);

select is(
  (select coalesce(sum(al.debito) - sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   where al.asiento_id = (select asiento_id from public.notas_credito_compra where id = (select id from _ids where clave = 'nota'))),
  0.00::numeric(14,2),
  'asiento de la nota de compra cuadrado'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where id = (select id from _ids where clave = 'producto')),
  13.00::numeric(14,2),
  'la devolución baja la existencia a 13'
);

select ok(
  abs((select costo from public.productos where id = (select id from _ids where clave = 'producto')) - 323.07) < 0.01,
  'costo promedio después de la devolución = 323.07'
);

select is(
  (select credito::numeric(14,2) from public.facturas_proveedor where id = (select id from _ids where clave = 'factura')),
  944.00::numeric(14,2),
  'factura de proveedor: crédito acumulado 944.00'
);

select is(
  (select round(total - pagado - credito, 2)::numeric(14,2)
   from public.facturas_proveedor
   where id = (select id from _ids where clave = 'factura')),
  1416.00::numeric(14,2),
  'factura de proveedor: saldo por pagar 1416.00'
);

select throws_ok(
  $q$select public.crear_nota_credito_compra(jsonb_build_object(
    'factura_proveedor_id', (select id from _ids where clave = 'factura'),
    'lineas', jsonb_build_array(jsonb_build_object(
      'factura_proveedor_linea_id', (select id from _ids where clave = 'linea'),
      'cantidad', 4
    ))
  ))$q$,
  null,
  null,
  'segunda nota por más de lo disponible falla'
);

select throws_ok(
  $q$select public.registrar_pago_proveedor(jsonb_build_object(
    'factura_proveedor_id', (select id from _ids where clave = 'factura'),
    'fecha', '2026-11-13',
    'cuenta_id', (select id from public.cuentas where codigo = '1102'),
    'metodo', 'transferencia',
    'monto', 1417
  ))$q$,
  null,
  null,
  'pago mayor al saldo después de la nota falla'
);

select public.registrar_pago_proveedor(jsonb_build_object(
  'factura_proveedor_id', (select id from _ids where clave = 'factura'),
  'fecha', '2026-11-13',
  'cuenta_id', (select id from public.cuentas where codigo = '1102'),
  'metodo', 'transferencia',
  'monto', 1416
));

select is(
  (select estado from public.facturas_proveedor where id = (select id from _ids where clave = 'factura')),
  'pagada',
  'el pago del saldo restante marca la factura pagada'
);

select public.anular_documento('nota_credito_compra', (select id from _ids where clave = 'nota'));

select is(
  (select estado from public.notas_credito_compra where id = (select id from _ids where clave = 'nota')),
  'anulada',
  'la nota de compra queda anulada'
);

select is(
  (select credito::numeric(14,2) from public.facturas_proveedor where id = (select id from _ids where clave = 'factura')),
  0.00::numeric(14,2),
  'la anulación de la nota deja el crédito en 0'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where id = (select id from _ids where clave = 'producto')),
  15.00::numeric(14,2),
  'la anulación de la nota devuelve la existencia a 15'
);

select ok(
  abs((select costo from public.productos where id = (select id from _ids where clave = 'producto')) - 333.33) < 0.01,
  'la anulación de la nota recalcula el costo promedio = 333.33'
);

select is(
  (select a.origen_tipo
   from public.asientos a
   join public.notas_credito_compra n on n.asiento_id = a.id
   where n.id = (select id from _ids where clave = 'nota')),
  'nota_credito_compra',
  'asiento con origen_tipo nota_credito_compra'
);

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  $q$select public.crear_nota_credito_compra('{}'::jsonb)$q$,
  '42501',
  null,
  'lector no puede crear notas de crédito de compra'
);

select * from finish();
rollback;

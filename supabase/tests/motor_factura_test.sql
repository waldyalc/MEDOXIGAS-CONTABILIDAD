begin;
select plan(20);

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

select public.crear_contacto(jsonb_build_object(
  'tipo', 'cliente',
  'nombre', 'Factura Cliente'
));

select public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Factura Producto',
  'precio', 650.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'inventariable', true,
  'cantidad', 10.00::numeric,
  'costo', 390.00::numeric
));

select public.crear_producto(jsonb_build_object(
  'tipo', 'servicio',
  'nombre', 'Factura Servicio',
  'precio', 1000.00::numeric,
  'itbis_tasa', 18.00::numeric
));

select public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from public.contactos where nombre = 'Factura Cliente'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from public.productos where nombre = 'Factura Producto'),
      'cantidad', 2.00::numeric,
      'precio', 650.00::numeric
    ),
    jsonb_build_object(
      'producto_id', (select id from public.productos where nombre = 'Factura Servicio'),
      'cantidad', 1.00::numeric,
      'precio', 1000.00::numeric
    )
  )
));

select public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from public.contactos where nombre = 'Factura Cliente'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from public.productos where nombre = 'Factura Servicio'),
      'cantidad', 1.00::numeric,
      'precio', 100.00::numeric
    )
  )
));

select is(
  (select tipo_comprobante from public.facturas where ncf = 'B0200000001'),
  '02',
  'tipo_comprobante de la factura es 02'
);

select is(
  (select ncf from public.facturas order by numero limit 1),
  'B0200000001',
  'primer NCF de la numeración es B0200000001'
);

select is(
  (select subtotal::numeric(14,2) from public.facturas where ncf = 'B0200000001'),
  2300.00::numeric(14,2),
  'subtotal de la factura'
);

select is(
  (select itbis::numeric(14,2) from public.facturas where ncf = 'B0200000001'),
  414.00::numeric(14,2),
  'itbis de la factura'
);

select is(
  (select total::numeric(14,2) from public.facturas where ncf = 'B0200000001'),
  2714.00::numeric(14,2),
  'total de la factura'
);

select is(
  (select estado from public.facturas where ncf = 'B0200000001'),
  'abierta',
  'estado inicial de la factura'
);

select is(
  (select fl.subtotal::numeric(14,2)
   from public.factura_lineas fl
   join public.facturas f on f.id = fl.factura_id
   join public.productos p on p.id = fl.producto_id
   where f.ncf = 'B0200000001' and p.nombre = 'Factura Producto'),
  1300.00::numeric(14,2),
  'subtotal de la línea de producto'
);

select is(
  (select fl.itbis::numeric(14,2)
   from public.factura_lineas fl
   join public.facturas f on f.id = fl.factura_id
   join public.productos p on p.id = fl.producto_id
   where f.ncf = 'B0200000001' and p.nombre = 'Factura Producto'),
  234.00::numeric(14,2),
  'itbis de la línea de producto'
);

select is(
  (select fl.subtotal::numeric(14,2)
   from public.factura_lineas fl
   join public.facturas f on f.id = fl.factura_id
   join public.productos p on p.id = fl.producto_id
   where f.ncf = 'B0200000001' and p.nombre = 'Factura Servicio'),
  1000.00::numeric(14,2),
  'subtotal de la línea de servicio'
);

select is(
  (select fl.itbis::numeric(14,2)
   from public.factura_lineas fl
   join public.facturas f on f.id = fl.factura_id
   join public.productos p on p.id = fl.producto_id
   where f.ncf = 'B0200000001' and p.nombre = 'Factura Servicio'),
  180.00::numeric(14,2),
  'itbis de la línea de servicio'
);

select is(
  (select fl.costo_unitario::numeric(14,2)
   from public.factura_lineas fl
   join public.facturas f on f.id = fl.factura_id
   join public.productos p on p.id = fl.producto_id
   where f.ncf = 'B0200000001' and p.nombre = 'Factura Producto'),
  390.00::numeric(14,2),
  'costo_unitario de la línea de producto'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.facturas where ncf = 'B0200000001')
     and c.codigo = '1103'),
  2714.00::numeric(14,2),
  'asiento: debe cuentas por cobrar 1103'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.facturas where ncf = 'B0200000001')
     and c.codigo = '4101'),
  1300.00::numeric(14,2),
  'asiento: haber ventas de productos 4101'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.facturas where ncf = 'B0200000001')
     and c.codigo = '4102'),
  1000.00::numeric(14,2),
  'asiento: haber ventas de servicios 4102'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.facturas where ncf = 'B0200000001')
     and c.codigo = '2102'),
  414.00::numeric(14,2),
  'asiento: haber ITBIS por pagar 2102'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.facturas where ncf = 'B0200000001')
     and c.codigo = '5101'),
  780.00::numeric(14,2),
  'asiento: debe costo de ventas 5101'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.facturas where ncf = 'B0200000001')
     and c.codigo = '1104'),
  780.00::numeric(14,2),
  'asiento: haber inventario 1104'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where nombre = 'Factura Producto'),
  8.00::numeric(14,2),
  'existencia del producto baja a 8'
);

select is(
  (select coalesce(sum(al.debito) - sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   where al.asiento_id = (select asiento_id from public.facturas where ncf = 'B0200000001')),
  0.00::numeric(14,2),
  'asiento de la factura cuadrado'
);

select is(
  (select count(*)::int from public.facturas where ncf = 'B0200000002'),
  1,
  'segundo NCF B0200000002'
);

select * from finish();
rollback;

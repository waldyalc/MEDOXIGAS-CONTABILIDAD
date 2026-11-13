begin;
select plan(20);

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

insert into _valores (clave, valor)
select 'ncf1', n.prefijo || lpad(n.siguiente::text, 8, '0')
from public.numeraciones n
where n.tipo_comprobante = '02' and n.activa
order by n.id
limit 1;

insert into _valores (clave, valor)
select 'ncf2', n.prefijo || lpad((n.siguiente + 1)::text, 8, '0')
from public.numeraciones n
where n.tipo_comprobante = '02' and n.activa
order by n.id
limit 1;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id)
select 'contacto', public.crear_contacto(jsonb_build_object(
  'tipo', 'cliente',
  'nombre', 'Factura Cliente'
));

insert into _ids (clave, id)
select 'producto', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Factura Producto',
  'precio', 650.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'inventariable', true,
  'cantidad', 10.00::numeric,
  'costo', 390.00::numeric
));

insert into _ids (clave, id)
select 'servicio', public.crear_producto(jsonb_build_object(
  'tipo', 'servicio',
  'nombre', 'Factura Servicio',
  'precio', 1000.00::numeric,
  'itbis_tasa', 18.00::numeric
));

insert into _ids (clave, id)
select 'factura1', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'producto'),
      'cantidad', 2.00::numeric,
      'precio', 650.00::numeric
    ),
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'servicio'),
      'cantidad', 1.00::numeric,
      'precio', 1000.00::numeric
    )
  )
));

insert into _ids (clave, id)
select 'factura2', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'servicio'),
      'cantidad', 1.00::numeric,
      'precio', 100.00::numeric
    )
  )
));

select is(
  (select tipo_comprobante from public.facturas where id = (select id from _ids where clave = 'factura1')),
  '02',
  'tipo_comprobante de la factura es 02'
);

select is(
  (select ncf from public.facturas where id = (select id from _ids where clave = 'factura1')),
  (select valor from _valores where clave = 'ncf1'),
  'primer NCF de la numeración'
);

select is(
  (select subtotal::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura1')),
  2300.00::numeric(14,2),
  'subtotal de la factura'
);

select is(
  (select itbis::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura1')),
  414.00::numeric(14,2),
  'itbis de la factura'
);

select is(
  (select total::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura1')),
  2714.00::numeric(14,2),
  'total de la factura'
);

select is(
  (select estado from public.facturas where id = (select id from _ids where clave = 'factura1')),
  'abierta',
  'estado inicial de la factura'
);

select is(
  (select fl.subtotal::numeric(14,2)
   from public.factura_lineas fl
   where fl.factura_id = (select id from _ids where clave = 'factura1')
     and fl.producto_id = (select id from _ids where clave = 'producto')),
  1300.00::numeric(14,2),
  'subtotal de la línea de producto'
);

select is(
  (select fl.itbis::numeric(14,2)
   from public.factura_lineas fl
   where fl.factura_id = (select id from _ids where clave = 'factura1')
     and fl.producto_id = (select id from _ids where clave = 'producto')),
  234.00::numeric(14,2),
  'itbis de la línea de producto'
);

select is(
  (select fl.subtotal::numeric(14,2)
   from public.factura_lineas fl
   where fl.factura_id = (select id from _ids where clave = 'factura1')
     and fl.producto_id = (select id from _ids where clave = 'servicio')),
  1000.00::numeric(14,2),
  'subtotal de la línea de servicio'
);

select is(
  (select fl.itbis::numeric(14,2)
   from public.factura_lineas fl
   where fl.factura_id = (select id from _ids where clave = 'factura1')
     and fl.producto_id = (select id from _ids where clave = 'servicio')),
  180.00::numeric(14,2),
  'itbis de la línea de servicio'
);

select is(
  (select fl.costo_unitario::numeric(14,2)
   from public.factura_lineas fl
   where fl.factura_id = (select id from _ids where clave = 'factura1')
     and fl.producto_id = (select id from _ids where clave = 'producto')),
  390.00::numeric(14,2),
  'costo_unitario de la línea de producto'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.facturas where id = (select id from _ids where clave = 'factura1'))
     and c.codigo = '1103'),
  2714.00::numeric(14,2),
  'asiento: debe cuentas por cobrar 1103'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.facturas where id = (select id from _ids where clave = 'factura1'))
     and c.codigo = '4101'),
  1300.00::numeric(14,2),
  'asiento: haber ventas de productos 4101'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.facturas where id = (select id from _ids where clave = 'factura1'))
     and c.codigo = '4102'),
  1000.00::numeric(14,2),
  'asiento: haber ventas de servicios 4102'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.facturas where id = (select id from _ids where clave = 'factura1'))
     and c.codigo = '2102'),
  414.00::numeric(14,2),
  'asiento: haber ITBIS por pagar 2102'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.facturas where id = (select id from _ids where clave = 'factura1'))
     and c.codigo = '5101'),
  780.00::numeric(14,2),
  'asiento: debe costo de ventas 5101'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.facturas where id = (select id from _ids where clave = 'factura1'))
     and c.codigo = '1104'),
  780.00::numeric(14,2),
  'asiento: haber inventario 1104'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where id = (select id from _ids where clave = 'producto')),
  8.00::numeric(14,2),
  'existencia del producto baja a 8'
);

select is(
  (select coalesce(sum(al.debito) - sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   where al.asiento_id = (select asiento_id from public.facturas where id = (select id from _ids where clave = 'factura1'))),
  0.00::numeric(14,2),
  'asiento de la factura cuadrado'
);

select is(
  (select ncf from public.facturas where id = (select id from _ids where clave = 'factura2')),
  (select valor from _valores where clave = 'ncf2'),
  'segundo NCF de la numeración'
);

select * from finish();
rollback;

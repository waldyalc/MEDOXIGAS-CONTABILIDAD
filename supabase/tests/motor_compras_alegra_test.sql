begin;
select plan(14);

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

select public.crear_contacto(
  '{"tipo":"proveedor","nombre":"Proveedor Alegra"}'::jsonb
);

select public.crear_producto(
  '{"tipo":"producto","nombre":"Producto Alegra","precio":650,"itbis_tasa":18,"inventariable":true,"cantidad":0,"costo":0}'::jsonb
);

select public.crear_factura_proveedor(jsonb_build_object(
  'ncf', 'B0100000050',
  'contacto_id', (select id from public.contactos where nombre = 'Proveedor Alegra'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from public.productos where nombre = 'Producto Alegra'),
      'cantidad', 100,
      'costo', 390,
      'itbis_tasa', 18
    )
  )
));

select is(
  (select fp.subtotal from public.facturas_proveedor fp
    where fp.contacto_id = (select id from public.contactos where nombre = 'Proveedor Alegra')),
  39000.00::numeric,
  'factura proveedor subtotal = 39000.00'
);

select is(
  (select fp.itbis from public.facturas_proveedor fp
    where fp.contacto_id = (select id from public.contactos where nombre = 'Proveedor Alegra')),
  7020.00::numeric,
  'factura proveedor itbis = 7020.00'
);

select is(
  (select fp.total from public.facturas_proveedor fp
    where fp.contacto_id = (select id from public.contactos where nombre = 'Proveedor Alegra')),
  46020.00::numeric,
  'factura proveedor total = 46020.00'
);

select is(
  (select fp.ncf from public.facturas_proveedor fp
    where fp.contacto_id = (select id from public.contactos where nombre = 'Proveedor Alegra')),
  'B0100000050',
  'la factura de proveedor guarda el NCF B0100000050'
);

select is(
  (select coalesce(sum(al.debito), 0)
     from public.facturas_proveedor fp
     join public.asiento_lineas al on al.asiento_id = fp.asiento_id
     join public.cuentas c on c.id = al.cuenta_id
    where fp.contacto_id = (select id from public.contactos where nombre = 'Proveedor Alegra')
      and c.codigo = '1104'),
  39000.00::numeric,
  'asiento factura proveedor: Dr 1104 inventario = 39000.00'
);

select is(
  (select coalesce(sum(al.debito), 0)
     from public.facturas_proveedor fp
     join public.asiento_lineas al on al.asiento_id = fp.asiento_id
     join public.cuentas c on c.id = al.cuenta_id
    where fp.contacto_id = (select id from public.contactos where nombre = 'Proveedor Alegra')
      and c.codigo = '1105'),
  7020.00::numeric,
  'asiento factura proveedor: Dr 1105 ITBIS adelantado = 7020.00'
);

select is(
  (select coalesce(sum(al.credito), 0)
     from public.facturas_proveedor fp
     join public.asiento_lineas al on al.asiento_id = fp.asiento_id
     join public.cuentas c on c.id = al.cuenta_id
    where fp.contacto_id = (select id from public.contactos where nombre = 'Proveedor Alegra')
      and c.codigo = '2101'),
  46020.00::numeric,
  'asiento factura proveedor: Cr 2101 CxP = 46020.00'
);

select is(
  (select p.cantidad from public.productos p where p.nombre = 'Producto Alegra'),
  100.00::numeric,
  'el producto inventariable sube a 100 de existencia'
);

select is(
  (select p.costo from public.productos p where p.nombre = 'Producto Alegra'),
  390.00::numeric,
  'el producto inventariable toma costo 390.00'
);

select is(
  (select sum(al.debito) - sum(al.credito)
     from public.facturas_proveedor fp
     join public.asiento_lineas al on al.asiento_id = fp.asiento_id
    where fp.contacto_id = (select id from public.contactos where nombre = 'Proveedor Alegra')),
  0::numeric,
  'asiento de la factura de proveedor cuadrado'
);

select public.registrar_pago_proveedor(jsonb_build_object(
  'factura_proveedor_id', (select id from public.facturas_proveedor
                            where contacto_id = (select id from public.contactos where nombre = 'Proveedor Alegra')),
  'fecha', '2026-11-13',
  'cuenta_id', (select id from public.cuentas where codigo = '1102'),
  'metodo', 'transferencia',
  'monto', 46020
));

select is(
  (select coalesce(sum(al.debito), 0)
     from public.pagos_proveedor pp
     join public.asiento_lineas al on al.asiento_id = pp.asiento_id
     join public.cuentas c on c.id = al.cuenta_id
    where pp.factura_proveedor_id = (select id from public.facturas_proveedor
                                      where contacto_id = (select id from public.contactos where nombre = 'Proveedor Alegra'))
      and c.codigo = '2101'),
  46020.00::numeric,
  'asiento pago proveedor: Dr 2101 = 46020.00'
);

select is(
  (select coalesce(sum(al.credito), 0)
     from public.pagos_proveedor pp
     join public.asiento_lineas al on al.asiento_id = pp.asiento_id
     join public.cuentas c on c.id = al.cuenta_id
    where pp.factura_proveedor_id = (select id from public.facturas_proveedor
                                      where contacto_id = (select id from public.contactos where nombre = 'Proveedor Alegra'))
      and c.codigo = '1102'),
  46020.00::numeric,
  'asiento pago proveedor: Cr 1102 = 46020.00'
);

select is(
  (select fp.pagado from public.facturas_proveedor fp
    where fp.contacto_id = (select id from public.contactos where nombre = 'Proveedor Alegra')),
  46020.00::numeric,
  'la factura de proveedor queda pagada por 46020.00'
);

select is(
  (select fp.estado from public.facturas_proveedor fp
    where fp.contacto_id = (select id from public.contactos where nombre = 'Proveedor Alegra')),
  'pagada',
  'la factura de proveedor queda en estado pagada'
);

select * from finish();
rollback;

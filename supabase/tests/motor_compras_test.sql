begin;
select plan(13);

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
  '{"tipo":"proveedor","nombre":"Compra Proveedor"}'::jsonb
);

select public.crear_producto(
  '{"tipo":"producto","nombre":"Compra Producto","precio":650,"itbis_tasa":18,"inventariable":true,"cantidad":10,"costo":300}'::jsonb
);

select public.crear_factura_proveedor(
  jsonb_build_object(
    'contacto_id', (select id from public.contactos where nombre = 'Compra Proveedor'),
    'fecha', '2026-11-13',
    'vencimiento', '2026-12-13',
    'lineas', jsonb_build_array(
      jsonb_build_object(
        'producto_id', (select id from public.productos where nombre = 'Compra Producto'),
        'cantidad', 5,
        'costo', 400,
        'itbis_tasa', 18
      ),
      jsonb_build_object(
        'cuenta_id', (select id from public.cuentas where codigo = '6101'),
        'descripcion', 'Servicios',
        'cantidad', 1,
        'costo', 1000,
        'itbis_tasa', 18
      )
    )
  )
);

select public.registrar_pago_proveedor(
  jsonb_build_object(
    'factura_proveedor_id', (select id from public.facturas_proveedor
                              where contacto_id = (select id from public.contactos where nombre = 'Compra Proveedor')),
    'fecha', '2026-11-13',
    'cuenta_id', (select id from public.cuentas where codigo = '1102'),
    'metodo', 'transferencia',
    'monto', 1000
  )
);

select is(
  (select subtotal from public.facturas_proveedor
    where contacto_id = (select id from public.contactos where nombre = 'Compra Proveedor')),
  3000.00::numeric,
  'factura proveedor subtotal = 3000.00'
);

select is(
  (select itbis from public.facturas_proveedor
    where contacto_id = (select id from public.contactos where nombre = 'Compra Proveedor')),
  540.00::numeric,
  'factura proveedor itbis = 540.00'
);

select is(
  (select total from public.facturas_proveedor
    where contacto_id = (select id from public.contactos where nombre = 'Compra Proveedor')),
  3540.00::numeric,
  'factura proveedor total = 3540.00'
);

select is(
  (select coalesce(sum(al.debito), 0)
     from public.facturas_proveedor fp
     join public.asiento_lineas al on al.asiento_id = fp.asiento_id
     join public.cuentas c on c.id = al.cuenta_id
    where fp.contacto_id = (select id from public.contactos where nombre = 'Compra Proveedor')
      and c.codigo = '1104'),
  2000.00::numeric,
  'asiento factura proveedor: Dr 1104 inventario = 2000.00'
);

select is(
  (select coalesce(sum(al.debito), 0)
     from public.facturas_proveedor fp
     join public.asiento_lineas al on al.asiento_id = fp.asiento_id
     join public.cuentas c on c.id = al.cuenta_id
    where fp.contacto_id = (select id from public.contactos where nombre = 'Compra Proveedor')
      and c.codigo = '6101'),
  1000.00::numeric,
  'asiento factura proveedor: Dr 6101 gasto = 1000.00'
);

select is(
  (select coalesce(sum(al.debito), 0)
     from public.facturas_proveedor fp
     join public.asiento_lineas al on al.asiento_id = fp.asiento_id
     join public.cuentas c on c.id = al.cuenta_id
    where fp.contacto_id = (select id from public.contactos where nombre = 'Compra Proveedor')
      and c.codigo = '1105'),
  540.00::numeric,
  'asiento factura proveedor: Dr 1105 ITBIS adelantado = 540.00'
);

select is(
  (select coalesce(sum(al.credito), 0)
     from public.facturas_proveedor fp
     join public.asiento_lineas al on al.asiento_id = fp.asiento_id
     join public.cuentas c on c.id = al.cuenta_id
    where fp.contacto_id = (select id from public.contactos where nombre = 'Compra Proveedor')
      and c.codigo = '2101'),
  3540.00::numeric,
  'asiento factura proveedor: Cr 2101 CxP = 3540.00'
);

select is(
  (select cantidad from public.productos where nombre = 'Compra Producto'),
  15.00::numeric,
  'producto cantidad sube a 15.00'
);

select ok(
  abs((select costo from public.productos where nombre = 'Compra Producto') - 333.33) < 0.01,
  'producto costo promedio = 333.33'
);

select is(
  (select pagado from public.facturas_proveedor
    where contacto_id = (select id from public.contactos where nombre = 'Compra Proveedor')),
  1000.00::numeric,
  'factura proveedor pagado = 1000.00'
);

select is(
  (select coalesce(sum(al.debito), 0)
     from public.pagos_proveedor pp
     join public.asiento_lineas al on al.asiento_id = pp.asiento_id
     join public.cuentas c on c.id = al.cuenta_id
    where pp.factura_proveedor_id = (select id from public.facturas_proveedor
                                      where contacto_id = (select id from public.contactos where nombre = 'Compra Proveedor'))
      and c.codigo = '2101'),
  1000.00::numeric,
  'asiento pago proveedor: Dr 2101 = 1000.00'
);

select is(
  (select coalesce(sum(al.credito), 0)
     from public.pagos_proveedor pp
     join public.asiento_lineas al on al.asiento_id = pp.asiento_id
     join public.cuentas c on c.id = al.cuenta_id
    where pp.factura_proveedor_id = (select id from public.facturas_proveedor
                                      where contacto_id = (select id from public.contactos where nombre = 'Compra Proveedor'))
      and c.codigo = '1102'),
  1000.00::numeric,
  'asiento pago proveedor: Cr 1102 = 1000.00'
);

select is(
  (select sum(al.debito) - sum(al.credito)
     from public.facturas_proveedor fp
     join public.asiento_lineas al on al.asiento_id = fp.asiento_id
    where fp.contacto_id = (select id from public.contactos where nombre = 'Compra Proveedor')),
  0::numeric,
  'asiento factura proveedor cuadrado'
);

select * from finish();
rollback;

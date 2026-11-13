begin;
select plan(11);

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

select public.crear_contacto('{"tipo":"cliente","nombre":"Pago Cliente"}'::jsonb);

select public.crear_producto('{"tipo":"servicio","nombre":"Pago Servicio","precio":1000,"itbis_tasa":18}'::jsonb);

select public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from public.contactos where nombre = 'Pago Cliente'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from public.productos where nombre = 'Pago Servicio'),
    'cantidad', 1,
    'precio', 1000
  ))
));

select public.registrar_pago_recibido(jsonb_build_object(
  'factura_id', (select id from public.facturas where ncf = 'B0200000001'),
  'fecha', '2026-11-13',
  'cuenta_id', (select id from public.cuentas where codigo = '1101'),
  'metodo', 'efectivo',
  'monto', 500
));

select is(
  (select estado from public.facturas where ncf = 'B0200000001'),
  'abierta',
  'pago parcial deja la factura abierta'
);

select is(
  (select pagado::numeric from public.facturas where ncf = 'B0200000001'),
  '500.00'::numeric,
  'pago parcial acumula pagado 500.00'
);

select is(
  (select sum(l.debito)::numeric
     from public.asiento_lineas l
     join public.cuentas c on c.id = l.cuenta_id
    where l.asiento_id = (
            select p.asiento_id
              from public.pagos_recibidos p
             where p.factura_id = (select id from public.facturas where ncf = 'B0200000001')
             order by p.numero asc
             limit 1
          )
      and c.codigo = '1101'),
  '500.00'::numeric,
  'el asiento del pago parcial debita caja 500.00'
);

select is(
  (select sum(l.credito)::numeric
     from public.asiento_lineas l
     join public.cuentas c on c.id = l.cuenta_id
    where l.asiento_id = (
            select p.asiento_id
              from public.pagos_recibidos p
             where p.factura_id = (select id from public.facturas where ncf = 'B0200000001')
             order by p.numero asc
             limit 1
          )
      and c.codigo = '1103'),
  '500.00'::numeric,
  'el asiento del pago parcial acredita cuentas por cobrar 500.00'
);

select throws_ok($q$select public.registrar_pago_recibido(jsonb_build_object('factura_id',(select id from public.facturas where ncf='B0200000001'),'fecha','2026-11-13','cuenta_id',(select id from public.cuentas where codigo='1101'),'metodo','efectivo','monto',700))$q$, null, null, 'sobrepago lanza error');

select public.registrar_pago_recibido(jsonb_build_object(
  'factura_id', (select id from public.facturas where ncf = 'B0200000001'),
  'fecha', '2026-11-13',
  'cuenta_id', (select id from public.cuentas where codigo = '1101'),
  'metodo', 'efectivo',
  'monto', 680
));

select is(
  (select estado from public.facturas where ncf = 'B0200000001'),
  'pagada',
  'pago del resto marca la factura pagada'
);

select is(
  (select pagado::numeric from public.facturas where ncf = 'B0200000001'),
  '1180.00'::numeric,
  'la factura 1 acumula pagado 1180.00'
);

select public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from public.contactos where nombre = 'Pago Cliente'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from public.productos where nombre = 'Pago Servicio'),
    'cantidad', 1,
    'precio', 500
  )),
  'pago', jsonb_build_object(
    'cuenta_id', (select id from public.cuentas where codigo = '1101'),
    'metodo', 'efectivo',
    'monto', 590,
    'fecha', '2026-11-13'
  )
));

select is(
  (select estado from public.facturas where ncf = 'B0200000002'),
  'pagada',
  'factura 2 creada con pago nace pagada'
);

select is(
  (select pagado::numeric from public.facturas where ncf = 'B0200000002'),
  '590.00'::numeric,
  'la factura 2 acumula pagado 590.00'
);

select is(
  (select sum(l.debito)::numeric
     from public.asiento_lineas l
     join public.cuentas c on c.id = l.cuenta_id
    where l.asiento_id = (
            select p.asiento_id
              from public.pagos_recibidos p
             where p.factura_id = (select id from public.facturas where ncf = 'B0200000002')
             order by p.numero desc
             limit 1
          )
      and c.codigo = '1101'),
  '590.00'::numeric,
  'el asiento del pago de factura 2 debita caja 590.00'
);

select is(
  (select sum(l.credito)::numeric
     from public.asiento_lineas l
     join public.cuentas c on c.id = l.cuenta_id
    where l.asiento_id = (
            select p.asiento_id
              from public.pagos_recibidos p
             where p.factura_id = (select id from public.facturas where ncf = 'B0200000002')
             order by p.numero desc
             limit 1
          )
      and c.codigo = '1103'),
  '590.00'::numeric,
  'el asiento del pago de factura 2 acredita cuentas por cobrar 590.00'
);

select * from finish();
rollback;

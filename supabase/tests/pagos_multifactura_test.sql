begin;
select plan(39);

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'admin.multipago@prueba.local'),
  ('55555555-5555-5555-5555-555555555555', 'contador.multipago@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('44444444-4444-4444-4444-444444444444', 'Admin multipago', 'admin'),
  ('55555555-5555-5555-5555-555555555555', 'Contador multipago', 'contador');

set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Pago recibido a dos facturas con una retención
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'cliente', public.crear_contacto('{"tipo":"cliente","nombre":"Cliente Multipago"}'::jsonb);

insert into _ids (clave, id)
select 'producto', public.crear_producto(
  '{"tipo":"servicio","nombre":"Servicio Multipago","precio":1000,"itbis_tasa":18}'::jsonb
);

insert into _ids (clave, id)
select 'factura1', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'cliente'),
  'fecha', '2026-11-16',
  'vencimiento', '2026-12-16',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 1,
    'precio', 1000
  ))
));

insert into _ids (clave, id)
select 'factura2', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'cliente'),
  'fecha', '2026-11-16',
  'vencimiento', '2026-12-16',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 2,
    'precio', 1000
  ))
));

insert into _ids (clave, id)
select 'pago', public.registrar_pago_recibido_multi(
  jsonb_build_object(
    'contacto_id', (select id from _ids where clave = 'cliente'),
    'fecha', '2026-11-16',
    'cuenta_id', (select id from public.cuentas where codigo = '1101'),
    'metodo', 'efectivo'
  ),
  jsonb_build_array(
    jsonb_build_object(
      'factura_id', (select id from _ids where clave = 'factura1'),
      'monto', 500,
      'retenciones', jsonb_build_array(jsonb_build_object(
        'retencion_id', (select id from public.retenciones where nombre = 'ITBIS 30 %')
      ))
    ),
    jsonb_build_object(
      'factura_id', (select id from _ids where clave = 'factura2'),
      'monto', 1000
    )
  )
);

select is(
  (select count(*)::int from _ids where clave = 'pago'),
  1,
  'el pago multifactura se registra'
);

select is(
  (select monto::numeric from public.pagos_recibidos where id = (select id from _ids where clave = 'pago')),
  '1500.00'::numeric,
  'el recibo guarda 1500.00 en caja'
);

select is(
  (select retenido::numeric from public.pagos_recibidos where id = (select id from _ids where clave = 'pago')),
  '54.00'::numeric,
  'el recibo guarda 54.00 retenidos'
);

select is(
  (select pagado::numeric from public.facturas where id = (select id from _ids where clave = 'factura1')),
  '500.00'::numeric,
  'la primera factura baja 500.00 de su saldo'
);

select is(
  (select retenido::numeric from public.facturas where id = (select id from _ids where clave = 'factura1')),
  '54.00'::numeric,
  'la primera factura guarda 54.00 retenidos'
);

select is(
  (select pagado::numeric from public.facturas where id = (select id from _ids where clave = 'factura2')),
  '1000.00'::numeric,
  'la segunda factura baja 1000.00 de su saldo'
);

select is(
  (select count(*)::int from public.pago_recibido_aplicaciones
   where pago_id = (select id from _ids where clave = 'pago')),
  2,
  'el pago guarda dos aplicaciones'
);

select is(
  (select sum(l.credito)::numeric
     from public.asiento_lineas l
     join public.cuentas c on c.id = l.cuenta_id
    where l.asiento_id = (select asiento_id from public.pagos_recibidos where id = (select id from _ids where clave = 'pago'))
      and c.codigo = '1103'),
  '1554.00'::numeric,
  'el asiento acredita la CxC por las dos facturas más la retención'
);

select is(
  (select sum(l.debito)::numeric
     from public.asiento_lineas l
     join public.cuentas c on c.id = l.cuenta_id
    where l.asiento_id = (select asiento_id from public.pagos_recibidos where id = (select id from _ids where clave = 'pago'))
      and c.codigo = '1107'),
  '54.00'::numeric,
  'el asiento debita 54.00 en ITBIS retenido por clientes'
);

select is(
  (select sum(l.debito)::numeric
     from public.asiento_lineas l
     join public.cuentas c on c.id = l.cuenta_id
    where l.asiento_id = (select asiento_id from public.pagos_recibidos where id = (select id from _ids where clave = 'pago'))
      and c.codigo = '1101'),
  '1500.00'::numeric,
  'el asiento debita 1500.00 en caja general'
);

select is(
  (select sum(l.debito)::numeric - sum(l.credito)::numeric
     from public.asiento_lineas l
    where l.asiento_id = (select asiento_id from public.pagos_recibidos where id = (select id from _ids where clave = 'pago'))),
  '0.00'::numeric,
  'el asiento del pago multifactura cuadra'
);

select throws_ok(
  format(
    'select public.registrar_pago_recibido_multi(%L::jsonb, %L::jsonb)',
    jsonb_build_object(
      'contacto_id', (select id from _ids where clave = 'cliente'),
      'fecha', '2026-11-16',
      'cuenta_id', (select id from public.cuentas where codigo = '1101'),
      'metodo', 'efectivo'
    ),
    jsonb_build_array(jsonb_build_object(
      'factura_id', (select id from _ids where clave = 'factura1'),
      'monto', 700
    ))
  ),
  '22023',
  null,
  'no se puede recibir más que el saldo pendiente de la factura'
);

select throws_ok(
  format(
    'select public.registrar_pago_recibido_multi(%L::jsonb, %L::jsonb)',
    jsonb_build_object(
      'contacto_id', (select id from _ids where clave = 'cliente'),
      'fecha', '2026-11-16',
      'cuenta_id', (select id from public.cuentas where codigo = '1101'),
      'metodo', 'efectivo'
    ),
    jsonb_build_array(jsonb_build_object(
      'factura_id', (select id from _ids where clave = 'factura1'),
      'monto', 100,
      'retenciones', jsonb_build_array(jsonb_build_object(
        'retencion_id', (select id from public.retenciones where nombre = 'ITBIS 30 %')
      ))
    ))
  ),
  '22023',
  null,
  'la misma retención no se aplica dos veces a la factura'
);

select lives_ok(
  format('select public.anular_documento(%L, %L)', 'pago_recibido', (select id from _ids where clave = 'pago')),
  'se anula el pago multifactura'
);

select is(
  (select pagado::numeric from public.facturas where id = (select id from _ids where clave = 'factura1')),
  '0.00'::numeric,
  'la anulación devuelve el pago de la primera factura'
);

select is(
  (select retenido::numeric from public.facturas where id = (select id from _ids where clave = 'factura1')),
  '0.00'::numeric,
  'la anulación devuelve la retención de la primera factura'
);

select is(
  (select pagado::numeric from public.facturas where id = (select id from _ids where clave = 'factura2')),
  '0.00'::numeric,
  'la anulación devuelve el pago de la segunda factura'
);

select is(
  (select estado from public.pagos_recibidos where id = (select id from _ids where clave = 'pago')),
  'anulado',
  'el recibo multifactura queda anulado'
);

-- ---------------------------------------------------------------------------
-- Otros ingresos: una línea de ingreso con ITBIS
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'pago_otros', public.registrar_pago_recibido_multi(
  jsonb_build_object(
    'contacto_id', (select id from _ids where clave = 'cliente'),
    'fecha', '2026-11-16',
    'cuenta_id', (select id from public.cuentas where codigo = '1101'),
    'metodo', 'efectivo',
    'otros_ingresos', jsonb_build_array(jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '4101'),
      'descripcion', 'Ingreso suelto',
      'monto', 1000,
      'itbis_tasa', 18
    ))
  ),
  '[]'::jsonb
);

select is(
  (select monto::numeric from public.pagos_recibidos where id = (select id from _ids where clave = 'pago_otros')),
  '1180.00'::numeric,
  'otros ingresos suma el ITBIS al monto del recibo'
);

select is(
  (select count(*)::int from public.pago_recibido_aplicaciones
   where pago_id = (select id from _ids where clave = 'pago_otros')),
  0,
  'un recibo de otros ingresos no crea aplicaciones a facturas'
);

select is(
  (select sum(l.credito)::numeric
     from public.asiento_lineas l
     join public.cuentas c on c.id = l.cuenta_id
    where l.asiento_id = (select asiento_id from public.pagos_recibidos where id = (select id from _ids where clave = 'pago_otros'))
      and c.codigo = '4101'),
  '1000.00'::numeric,
  'el asiento acredita la cuenta de ingreso'
);

select is(
  (select sum(l.credito)::numeric
     from public.asiento_lineas l
     join public.cuentas c on c.id = l.cuenta_id
    where l.asiento_id = (select asiento_id from public.pagos_recibidos where id = (select id from _ids where clave = 'pago_otros'))
      and c.codigo = '2102'),
  '180.00'::numeric,
  'el asiento acredita el ITBIS por pagar'
);

select is(
  (select sum(l.debito)::numeric
     from public.asiento_lineas l
     join public.cuentas c on c.id = l.cuenta_id
    where l.asiento_id = (select asiento_id from public.pagos_recibidos where id = (select id from _ids where clave = 'pago_otros'))
      and c.codigo = '1101'),
  '1180.00'::numeric,
  'el asiento debita el total del recibo en caja'
);

-- ---------------------------------------------------------------------------
-- Pago a proveedor a dos facturas con una retención
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'proveedor', public.crear_contacto('{"tipo":"proveedor","nombre":"Proveedor Multipago"}'::jsonb);

insert into _ids (clave, id)
select 'compra1', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'proveedor'),
  'fecha', '2026-11-16',
  'vencimiento', '2026-12-16',
  'lineas', jsonb_build_array(jsonb_build_object(
    'cuenta_id', (select id from public.cuentas where codigo = '6101'),
    'descripcion', 'Servicio recibido 1',
    'cantidad', 1,
    'costo', 1000,
    'itbis_tasa', 18
  ))
));

insert into _ids (clave, id)
select 'compra2', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'proveedor'),
  'fecha', '2026-11-16',
  'vencimiento', '2026-12-16',
  'lineas', jsonb_build_array(jsonb_build_object(
    'cuenta_id', (select id from public.cuentas where codigo = '6101'),
    'descripcion', 'Servicio recibido 2',
    'cantidad', 1,
    'costo', 500,
    'itbis_tasa', 18
  ))
));

insert into _ids (clave, id)
select 'pago_prov', public.registrar_pago_proveedor_multi(
  jsonb_build_object(
    'contacto_id', (select id from _ids where clave = 'proveedor'),
    'fecha', '2026-11-16',
    'cuenta_id', (select id from public.cuentas where codigo = '1102'),
    'metodo', 'transferencia'
  ),
  jsonb_build_array(
    jsonb_build_object(
      'factura_proveedor_id', (select id from _ids where clave = 'compra1'),
      'monto', 600,
      'retenciones', jsonb_build_array(jsonb_build_object(
        'retencion_id', (select id from public.retenciones where nombre = 'ISR 10 % honorarios')
      ))
    ),
    jsonb_build_object(
      'factura_proveedor_id', (select id from _ids where clave = 'compra2'),
      'monto', 300
    )
  )
);

select is(
  (select count(*)::int from _ids where clave = 'pago_prov'),
  1,
  'el pago a proveedor multifactura se registra'
);

select is(
  (select monto::numeric from public.pagos_proveedor where id = (select id from _ids where clave = 'pago_prov')),
  '900.00'::numeric,
  'el pago a proveedor guarda 900.00'
);

select is(
  (select retenido::numeric from public.pagos_proveedor where id = (select id from _ids where clave = 'pago_prov')),
  '100.00'::numeric,
  'el pago a proveedor guarda 100.00 retenidos'
);

select is(
  (select pagado::numeric from public.facturas_proveedor where id = (select id from _ids where clave = 'compra1')),
  '600.00'::numeric,
  'la primera compra baja 600.00 de su saldo'
);

select is(
  (select retenido::numeric from public.facturas_proveedor where id = (select id from _ids where clave = 'compra1')),
  '100.00'::numeric,
  'la primera compra guarda 100.00 retenidos'
);

select is(
  (select pagado::numeric from public.facturas_proveedor where id = (select id from _ids where clave = 'compra2')),
  '300.00'::numeric,
  'la segunda compra baja 300.00 de su saldo'
);

select is(
  (select count(*)::int from public.pago_proveedor_aplicaciones
   where pago_id = (select id from _ids where clave = 'pago_prov')),
  2,
  'el pago a proveedor guarda dos aplicaciones'
);

select is(
  (select sum(l.debito)::numeric
     from public.asiento_lineas l
     join public.cuentas c on c.id = l.cuenta_id
    where l.asiento_id = (select asiento_id from public.pagos_proveedor where id = (select id from _ids where clave = 'pago_prov'))
      and c.codigo = '2101'),
  '1000.00'::numeric,
  'el asiento debita la CxP por las dos facturas más la retención'
);

select is(
  (select sum(l.credito)::numeric
     from public.asiento_lineas l
     join public.cuentas c on c.id = l.cuenta_id
    where l.asiento_id = (select asiento_id from public.pagos_proveedor where id = (select id from _ids where clave = 'pago_prov'))
      and c.codigo = '1102'),
  '900.00'::numeric,
  'el asiento acredita 900.00 en el banco'
);

select is(
  (select sum(l.credito)::numeric
     from public.asiento_lineas l
     join public.cuentas c on c.id = l.cuenta_id
    where l.asiento_id = (select asiento_id from public.pagos_proveedor where id = (select id from _ids where clave = 'pago_prov'))
      and c.codigo = '2104'),
  '100.00'::numeric,
  'el asiento acredita el ISR retenido por pagar'
);

select throws_ok(
  format(
    'select public.registrar_pago_proveedor_multi(%L::jsonb, %L::jsonb)',
    jsonb_build_object(
      'contacto_id', (select id from _ids where clave = 'proveedor'),
      'fecha', '2026-11-16',
      'cuenta_id', (select id from public.cuentas where codigo = '1102'),
      'metodo', 'transferencia'
    ),
    jsonb_build_array(jsonb_build_object(
      'factura_proveedor_id', (select id from _ids where clave = 'compra1'),
      'monto', 500
    ))
  ),
  '22023',
  null,
  'no se puede pagar más que el saldo pendiente de la compra'
);

select lives_ok(
  format('select public.anular_documento(%L, %L)', 'pago_proveedor', (select id from _ids where clave = 'pago_prov')),
  'se anula el pago a proveedor multifactura'
);

select is(
  (select pagado::numeric from public.facturas_proveedor where id = (select id from _ids where clave = 'compra1')),
  '0.00'::numeric,
  'la anulación devuelve el pago de la primera compra'
);

select is(
  (select retenido::numeric from public.facturas_proveedor where id = (select id from _ids where clave = 'compra1')),
  '0.00'::numeric,
  'la anulación devuelve la retención de la primera compra'
);

select is(
  (select pagado::numeric from public.facturas_proveedor where id = (select id from _ids where clave = 'compra2')),
  '0.00'::numeric,
  'la anulación devuelve el pago de la segunda compra'
);

select is(
  (select estado from public.pagos_proveedor where id = (select id from _ids where clave = 'pago_prov')),
  'anulado',
  'el pago a proveedor multifactura queda anulado'
);

select * from finish();
rollback;

begin;
select plan(27);

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local'),
  ('22222222-2222-2222-2222-222222222222', 'contador@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Contador', 'contador'),
  ('33333333-3333-3333-3333-333333333333', 'Lector', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Semilla del catálogo y cuentas
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.retenciones
   where nombre in ('ITBIS 30 %', 'ITBIS 100 %', 'ISR 10 % honorarios', 'ISR 2 % servicios', 'ISR 5 % alquileres')),
  5,
  'la semilla deja las 5 retenciones comunes'
);

select ok(
  exists (select 1 from public.cuentas where codigo = '1107' and tipo = 'activo' and acepta_movimientos),
  'existe la cuenta 1107 ITBIS retenido por clientes'
);

select ok(
  exists (select 1 from public.cuentas where codigo = '2104' and tipo = 'pasivo' and acepta_movimientos),
  'existe la cuenta 2104 ISR retenido por pagar'
);

select is(
  (select count(*)::int from public.listar_retenciones()
   where nombre in ('ITBIS 30 %', 'ITBIS 100 %', 'ISR 10 % honorarios', 'ISR 2 % servicios', 'ISR 5 % alquileres')),
  5,
  'listar_retenciones devuelve las retenciones sembradas'
);

select lives_ok(
  format(
    'select public.crear_retencion(%L::jsonb)',
    jsonb_build_object(
      'nombre', 'ISR 1 % prueba',
      'tipo', 'isr',
      'porcentaje', 1,
      'cuenta_id', (select id from public.cuentas where codigo = '2104'),
      'cuenta_anticipo_id', (select id from public.cuentas where codigo = '1108')
    )
  ),
  'contador crea una retención'
);

select throws_ok(
  format(
    'select public.crear_retencion(%L::jsonb)',
    jsonb_build_object(
      'nombre', 'ISR 1 % prueba',
      'tipo', 'isr',
      'porcentaje', 1,
      'cuenta_id', (select id from public.cuentas where codigo = '2104')
    )
  ),
  '23505',
  null,
  'no se puede repetir el nombre de la retención'
);

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  format(
    'select public.crear_retencion(%L::jsonb)',
    jsonb_build_object(
      'nombre', 'ISR lector',
      'tipo', 'isr',
      'porcentaje', 1,
      'cuenta_id', (select id from public.cuentas where codigo = '2104')
    )
  ),
  '42501',
  null,
  'lector no puede crear retenciones'
);

-- ---------------------------------------------------------------------------
-- Pago recibido: nos retienen ITBIS 30 %
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

insert into _ids (clave, id)
select 'contacto', public.crear_contacto('{"tipo":"cliente","nombre":"Cliente Retención"}'::jsonb);

insert into _ids (clave, id)
select 'producto', public.crear_producto('{"tipo":"servicio","nombre":"Servicio Retención","precio":1000,"itbis_tasa":18}'::jsonb);

insert into _ids (clave, id)
select 'factura', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 1,
    'precio', 1000
  ))
));

insert into _ids (clave, id)
select 'pago', public.registrar_pago_recibido(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'factura'),
  'fecha', '2026-11-13',
  'cuenta_id', (select id from public.cuentas where codigo = '1101'),
  'metodo', 'efectivo',
  'monto', 1126,
  'retenciones', jsonb_build_array(jsonb_build_object(
    'retencion_id', (select id from public.retenciones where nombre = 'ITBIS 30 %')
  ))
));

select is(
  (select retenido::numeric from public.facturas where id = (select id from _ids where clave = 'factura')),
  '54.00'::numeric,
  'la factura guarda 54.00 de ITBIS retenido al 30 %'
);

select is(
  (select pagado::numeric from public.facturas where id = (select id from _ids where clave = 'factura')),
  '1126.00'::numeric,
  'el pago recibido guarda 1126.00 en caja'
);

select is(
  (select estado from public.facturas where id = (select id from _ids where clave = 'factura')),
  'pagada',
  'pagado más retenido completa la factura'
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
  (select sum(l.credito)::numeric
     from public.asiento_lineas l
     join public.cuentas c on c.id = l.cuenta_id
    where l.asiento_id = (select asiento_id from public.pagos_recibidos where id = (select id from _ids where clave = 'pago'))
      and c.codigo = '1103'),
  '1180.00'::numeric,
  'el asiento acredita la CxC por monto más retenido'
);

select is(
  (select base::numeric from public.pago_recibido_retenciones
   where pago_id = (select id from _ids where clave = 'pago')),
  '180.00'::numeric,
  'la base de la retención es el ITBIS de la factura'
);

select is(
  (select monto::numeric from public.pago_recibido_retenciones
   where pago_id = (select id from _ids where clave = 'pago')),
  '54.00'::numeric,
  'el detalle de la retención guarda 54.00'
);

select throws_ok(
  format(
    'select public.registrar_pago_recibido(%L::jsonb)',
    jsonb_build_object(
      'factura_id', (select id from _ids where clave = 'factura'),
      'fecha', '2026-11-13',
      'cuenta_id', (select id from public.cuentas where codigo = '1101'),
      'metodo', 'efectivo',
      'monto', 1,
      'retenciones', jsonb_build_array(jsonb_build_object(
        'retencion_id', (select id from public.retenciones where nombre = 'ITBIS 30 %')
      ))
    )
  ),
  '22023',
  null,
  'la misma retención no se aplica dos veces a la factura'
);

insert into _ids (clave, id)
select 'factura2', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 1,
    'precio', 1000
  ))
));

select throws_ok(
  format(
    'select public.registrar_pago_recibido(%L::jsonb)',
    jsonb_build_object(
      'factura_id', (select id from _ids where clave = 'factura2'),
      'fecha', '2026-11-13',
      'cuenta_id', (select id from public.cuentas where codigo = '1101'),
      'metodo', 'efectivo',
      'monto', 1150,
      'retenciones', jsonb_build_array(jsonb_build_object(
        'retencion_id', (select id from public.retenciones where nombre = 'ITBIS 30 %')
      ))
    )
  ),
  '22023',
  null,
  'monto más retenido no puede exceder el saldo'
);

select lives_ok(
  format('select public.anular_documento(%L, %L)', 'pago_recibido', (select id from _ids where clave = 'pago')),
  'se anula el pago recibido'
);

select is(
  (select retenido::numeric from public.facturas where id = (select id from _ids where clave = 'factura')),
  '0.00'::numeric,
  'la anulación devuelve el retenido de la factura'
);

select is(
  (select estado from public.facturas where id = (select id from _ids where clave = 'factura')),
  'abierta',
  'la factura vuelve a abierta al anular el pago'
);

select is(
  (select estado from public.pagos_recibidos where id = (select id from _ids where clave = 'pago')),
  'anulado',
  'el pago queda anulado'
);

-- ---------------------------------------------------------------------------
-- Pago a proveedor: retenemos ISR 10 %
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'proveedor', public.crear_contacto('{"tipo":"proveedor","nombre":"Proveedor Retención"}'::jsonb);

insert into _ids (clave, id)
select 'compra', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'proveedor'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(jsonb_build_object(
    'cuenta_id', (select id from public.cuentas where codigo = '6101'),
    'descripcion', 'Servicio recibido',
    'cantidad', 1,
    'costo', 1000,
    'itbis_tasa', 18
  ))
));

insert into _ids (clave, id)
select 'pago_prov', public.registrar_pago_proveedor(jsonb_build_object(
  'factura_proveedor_id', (select id from _ids where clave = 'compra'),
  'fecha', '2026-11-13',
  'cuenta_id', (select id from public.cuentas where codigo = '1102'),
  'metodo', 'transferencia',
  'monto', 1080,
  'retenciones', jsonb_build_array(jsonb_build_object(
    'retencion_id', (select id from public.retenciones where nombre = 'ISR 10 % honorarios')
  ))
));

select is(
  (select retenido::numeric from public.facturas_proveedor where id = (select id from _ids where clave = 'compra')),
  '100.00'::numeric,
  'la compra guarda 100.00 de ISR retenido al 10 %'
);

select is(
  (select estado from public.facturas_proveedor where id = (select id from _ids where clave = 'compra')),
  'pagada',
  'pagado más retenido completa la compra'
);

select is(
  (select sum(l.credito)::numeric
     from public.asiento_lineas l
     join public.cuentas c on c.id = l.cuenta_id
    where l.asiento_id = (select asiento_id from public.pagos_proveedor where id = (select id from _ids where clave = 'pago_prov'))
      and c.codigo = '2104'),
  '100.00'::numeric,
  'el asiento acredita 100.00 en ISR retenido por pagar'
);

select is(
  (select sum(l.debito)::numeric
     from public.asiento_lineas l
     join public.cuentas c on c.id = l.cuenta_id
    where l.asiento_id = (select asiento_id from public.pagos_proveedor where id = (select id from _ids where clave = 'pago_prov'))
      and c.codigo = '2101'),
  '1180.00'::numeric,
  'el asiento debita la CxP por monto más retenido'
);

select lives_ok(
  format('select public.anular_documento(%L, %L)', 'pago_proveedor', (select id from _ids where clave = 'pago_prov')),
  'se anula el pago a proveedor'
);

select is(
  (select retenido::numeric from public.facturas_proveedor where id = (select id from _ids where clave = 'compra')),
  '0.00'::numeric,
  'la anulación devuelve el retenido de la compra'
);

-- ---------------------------------------------------------------------------
-- RLS: authenticated no escribe directo en el catálogo
-- ---------------------------------------------------------------------------

select throws_ok(
  format(
    'insert into public.retenciones (nombre, tipo, porcentaje, cuenta_id) values (%L, %L, %L, %L)',
    'Directa', 'isr', 1, (select id from public.cuentas where codigo = '2104')
  ),
  '42501',
  null,
  'authenticated no puede insertar retenciones directamente'
);

select * from finish();
rollback;

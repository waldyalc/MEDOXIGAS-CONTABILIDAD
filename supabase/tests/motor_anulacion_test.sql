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

select public.crear_contacto(jsonb_build_object(
  'tipo', 'cliente',
  'nombre', 'Anula Cliente'
));

select public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Anula Producto',
  'precio', 650.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'inventariable', true,
  'cantidad', 10.00::numeric,
  'costo', 390.00::numeric
));

select public.crear_producto(jsonb_build_object(
  'tipo', 'servicio',
  'nombre', 'Anula Servicio',
  'precio', 1000.00::numeric,
  'itbis_tasa', 18.00::numeric
));

select public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from public.contactos where nombre = 'Anula Cliente'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from public.productos where nombre = 'Anula Producto'),
      'cantidad', 2.00::numeric,
      'precio', 650.00::numeric
    )
  )
));

select public.anular_documento('factura', (select id from public.facturas where ncf = 'B0200000001'));

select is(
  (select estado from public.facturas where ncf = 'B0200000001'),
  'anulada',
  'factura anulada queda en estado anulada'
);

select ok(
  exists(
    select 1
    from public.asientos a
    where a.origen_tipo = 'anulacion'
      and a.anula_asiento_id = (select asiento_id from public.facturas where ncf = 'B0200000001')
  ),
  'existe asiento de anulación con anula_asiento_id del asiento original'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select id from public.asientos where origen_tipo = 'anulacion' order by numero desc limit 1)
     and c.codigo = '4101'),
  1300.00::numeric(14,2),
  'anulación: debe ventas de productos 4101'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select id from public.asientos where origen_tipo = 'anulacion' order by numero desc limit 1)
     and c.codigo = '2102'),
  234.00::numeric(14,2),
  'anulación: debe ITBIS por pagar 2102'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select id from public.asientos where origen_tipo = 'anulacion' order by numero desc limit 1)
     and c.codigo = '1103'),
  1534.00::numeric(14,2),
  'anulación: haber cuentas por cobrar 1103'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select id from public.asientos where origen_tipo = 'anulacion' order by numero desc limit 1)
     and c.codigo = '5101'),
  780.00::numeric(14,2),
  'anulación: haber costo de ventas 5101'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select id from public.asientos where origen_tipo = 'anulacion' order by numero desc limit 1)
     and c.codigo = '1104'),
  780.00::numeric(14,2),
  'anulación: debe inventario 1104'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where nombre = 'Anula Producto'),
  10.00::numeric(14,2),
  'existencia del producto restaurada a 10'
);

select is(
  (select coalesce(sum(debito) - sum(credito), 0)::numeric(14,2)
   from public.asiento_lineas),
  0.00::numeric(14,2),
  'suma global de asiento_lineas cuadrada'
);

select public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from public.contactos where nombre = 'Anula Cliente'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from public.productos where nombre = 'Anula Servicio'),
      'cantidad', 1.00::numeric,
      'precio', 1000.00::numeric
    )
  ),
  'pago', jsonb_build_object(
    'cuenta_id', (select id from public.cuentas where codigo = '1101'),
    'metodo', 'efectivo',
    'monto', 1180.00::numeric,
    'fecha', '2026-11-13'
  )
));

select throws_ok($q$select public.anular_documento('factura', (select id from public.facturas where ncf='B0200000002'))$q$, null, null, 'factura con pago activo no se anula');

select is(
  (select estado from public.facturas where ncf = 'B0200000002'),
  'pagada',
  'factura con pago activo sigue pagada'
);

reset role;

select throws_ok($q$
  do $$
  declare v_asiento uuid; v_cuenta uuid;
  begin
    insert into public.asientos (fecha, descripcion, origen_tipo, total)
    values ('2026-11-13', 'asiento descuadrado', 'manual', 0)
    returning id into v_asiento;
    select id into v_cuenta from public.cuentas where codigo = '1101';
    insert into public.asiento_lineas (asiento_id, cuenta_id, descripcion, debito)
    values (v_asiento, v_cuenta, 'debe', 100);
    insert into public.asiento_lineas (asiento_id, cuenta_id, descripcion, credito)
    values (v_asiento, v_cuenta, 'haber', 90);
    set constraints all immediate;
  end
  $$;
$q$, null, null, 'asiento descuadrado falla con constraints immediate');

select is(
  (select coalesce(sum(debito) - sum(credito), 0)::numeric(14,2)
   from public.asiento_lineas),
  0.00::numeric(14,2),
  'suma global sigue cuadrada tras el intento fallido'
);

select is(
  (select count(*)::int from public.asientos where descripcion = 'asiento descuadrado'),
  0,
  'el asiento descuadrado no quedó guardado'
);

select * from finish();
rollback;

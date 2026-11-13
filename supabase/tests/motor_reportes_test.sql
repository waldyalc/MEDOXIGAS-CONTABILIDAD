begin;
select plan(10);

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
  'nombre', 'Reporte Cliente'
));

select public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Reporte Producto',
  'precio', 650.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'inventariable', true,
  'cantidad', 10.00::numeric,
  'costo', 390.00::numeric
));

select public.crear_producto(jsonb_build_object(
  'tipo', 'servicio',
  'nombre', 'Reporte Servicio',
  'precio', 1000.00::numeric,
  'itbis_tasa', 18.00::numeric
));

select public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from public.contactos where nombre = 'Reporte Cliente'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from public.productos where nombre = 'Reporte Producto'),
      'cantidad', 2.00::numeric,
      'precio', 650.00::numeric
    ),
    jsonb_build_object(
      'producto_id', (select id from public.productos where nombre = 'Reporte Servicio'),
      'cantidad', 1.00::numeric,
      'precio', 1000.00::numeric
    )
  )
));

select public.registrar_pago_recibido(jsonb_build_object(
  'factura_id', (select id from public.facturas where ncf = 'B0200000001'),
  'fecha', '2026-11-13',
  'cuenta_id', (select id from public.cuentas where codigo = '1101'),
  'metodo', 'efectivo',
  'monto', 500.00::numeric
));

select public.crear_gasto_menor(jsonb_build_object(
  'fecha', '2026-11-13',
  'descripcion', 'Reporte Gasto',
  'subtotal', 1000.00::numeric,
  'itbis_tasa', 18.00::numeric
));

select is(
  (select coalesce(sum(debitos), 0)::numeric(14,2)
   from public.reporte_balance_comprobacion('2026-01-01', '2026-12-31')),
  (select coalesce(sum(creditos), 0)::numeric(14,2)
   from public.reporte_balance_comprobacion('2026-01-01', '2026-12-31')),
  'balance de comprobación cuadrado: débitos = créditos'
);

select ok(
  (select coalesce(sum(debitos), 0) > 0
   from public.reporte_balance_comprobacion('2026-01-01', '2026-12-31')),
  'balance de comprobación tiene movimientos'
);

select is(
  (select saldo::numeric(14,2)
   from public.reporte_balance_comprobacion('2026-01-01', '2026-12-31')
   where cuenta_codigo = '1103'),
  2214.00::numeric(14,2),
  'balance: saldo de cuentas por cobrar 1103'
);

select is(
  (select coalesce(sum(monto), 0)::numeric(14,2)
   from public.reporte_estado_resultados('2026-01-01', '2026-12-31')
   where tipo = 'ingreso'),
  2300.00::numeric(14,2),
  'estado de resultados: total ingresos'
);

select is(
  (select coalesce(sum(monto), 0)::numeric(14,2)
   from public.reporte_estado_resultados('2026-01-01', '2026-12-31')
   where tipo = 'costo'),
  780.00::numeric(14,2),
  'estado de resultados: total costos'
);

select is(
  (select coalesce(sum(monto), 0)::numeric(14,2)
   from public.reporte_estado_resultados('2026-01-01', '2026-12-31')
   where tipo = 'gasto'),
  1000.00::numeric(14,2),
  'estado de resultados: total gastos'
);

select is(
  (select coalesce(sum(
     case
       when tipo = 'ingreso' then monto
       when tipo in ('costo', 'gasto') then -monto
       else 0
     end
   ), 0)::numeric(14,2)
   from public.reporte_estado_resultados('2026-01-01', '2026-12-31')),
  520.00::numeric(14,2),
  'estado de resultados: utilidad = ingresos - costos - gastos'
);

select is(
  (select saldo::numeric(14,2)
   from public.reporte_cxc('2026-11-13')
   where ncf = 'B0200000001'),
  2214.00::numeric(14,2),
  'reporte_cxc: saldo de la factura B0200000001'
);

select is(
  (select total::numeric(14,2)
   from public.reporte_cxc('2026-11-13')
   where ncf = 'B0200000001'),
  2714.00::numeric(14,2),
  'reporte_cxc: total de la factura B0200000001'
);

select is(
  (select contacto_nombre
   from public.reporte_cxc('2026-11-13')
   where ncf = 'B0200000001'),
  'Reporte Cliente',
  'reporte_cxc: nombre del contacto'
);

select * from finish();
rollback;

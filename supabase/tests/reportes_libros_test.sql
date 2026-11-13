begin;
select plan(17);

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local');
insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id)
select 'cliente', public.crear_contacto(jsonb_build_object(
  'tipo', 'cliente',
  'nombre', 'Cliente Libros'
));

insert into _ids (clave, id)
select 'proveedor', public.crear_contacto(jsonb_build_object(
  'tipo', 'proveedor',
  'nombre', 'Proveedor Libros'
));

insert into _ids (clave, id)
select 'producto', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Producto Libros',
  'precio', 650.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'inventariable', true,
  'cantidad', 100.00::numeric,
  'costo', 390.00::numeric
));

insert into _ids (clave, id)
select 'servicio', public.crear_producto(jsonb_build_object(
  'tipo', 'servicio',
  'nombre', 'Servicio Libros',
  'precio', 1000.00::numeric,
  'itbis_tasa', 18.00::numeric
));

insert into _ids (clave, id)
select 'factura_anterior', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'cliente'),
  'fecha', '2097-12-20',
  'vencimiento', '2098-01-19',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 2.00::numeric,
    'precio', 650.00::numeric
  ))
));

insert into _ids (clave, id)
select 'pago_cliente', public.registrar_pago_recibido(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'factura_anterior'),
  'fecha', '2098-01-05',
  'cuenta_id', (select id from public.cuentas where codigo = '1101'),
  'metodo', 'efectivo',
  'monto', 500.00::numeric
));

insert into _ids (clave, id)
select 'factura_actual', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'cliente'),
  'fecha', '2098-01-10',
  'vencimiento', '2098-02-09',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'servicio'),
    'cantidad', 1.00::numeric,
    'precio', 1000.00::numeric
  ))
));

insert into _ids (clave, id)
select 'compra', public.crear_factura_proveedor(jsonb_build_object(
  'ncf', 'PROV-LIBROS-001',
  'contacto_id', (select id from _ids where clave = 'proveedor'),
  'fecha', '2098-01-15',
  'vencimiento', '2098-02-14',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 10.00::numeric,
    'costo', 390.00::numeric,
    'itbis_tasa', 18.00::numeric
  ))
));

insert into _ids (clave, id)
select 'pago_proveedor', public.registrar_pago_proveedor(jsonb_build_object(
  'factura_proveedor_id', (select id from _ids where clave = 'compra'),
  'fecha', '2098-01-20',
  'cuenta_id', (select id from public.cuentas where codigo = '1101'),
  'metodo', 'efectivo',
  'monto', 2000.00::numeric
));

select public.anular_documento('factura', (select id from _ids where clave = 'factura_actual'));

select is(
  (select distinct tercero
   from public.reporte_movimientos('2098-01-01', '2098-01-31')
   where asiento_id = (select asiento_id from public.facturas where id = (select id from _ids where clave = 'factura_actual'))
     and cuenta_codigo = '4102'),
  'Cliente Libros',
  'movimientos: el tercero sale del documento de origen aunque la línea no lo lleve'
);

select is(
  (select distinct documento
   from public.reporte_movimientos('2098-01-01', '2098-01-31')
   where asiento_id = (select asiento_id from public.facturas where id = (select id from _ids where clave = 'factura_actual'))),
  (select ncf from public.facturas where id = (select id from _ids where clave = 'factura_actual')),
  'movimientos: el documento es el NCF de la factura'
);

select ok(
  (select count(*) > 0
   from public.reporte_movimientos('2098-01-01', '2098-01-31', null, null, array['factura'])),
  'movimientos: el filtro de tipo de registro devuelve facturas'
);

select is(
  (select count(*)
   from public.reporte_movimientos('2098-01-01', '2098-01-31', null, null, array['factura'])
   where origen_tipo <> 'factura'),
  0::bigint,
  'movimientos: el filtro de tipo de registro excluye otros orígenes'
);

select is(
  (select count(*)
   from public.reporte_movimientos('2098-01-01', '2098-01-31', array['11'])
   where cuenta_codigo not like '11%'),
  0::bigint,
  'movimientos: una cuenta padre incluye solo sus hijas'
);

select is(
  (select distinct estado
   from public.reporte_movimientos('2098-01-01', '2098-01-31')
   where asiento_id = (select asiento_id from public.facturas where id = (select id from _ids where clave = 'factura_actual'))),
  'Anulado',
  'movimientos: el asiento anulado figura como Anulado'
);

select is(
  (select distinct estado
   from public.reporte_movimientos('2000-01-01', '2999-12-31', null, null, array['anulacion'])
   where asiento_id = (
     select a.id
     from public.asientos a
     where a.anula_asiento_id = (select asiento_id from public.facturas where id = (select id from _ids where clave = 'factura_actual'))
   )),
  'Anulado',
  'movimientos: el asiento de anulación figura como Anulado'
);

-- anular_documento fecha la reversión con current_date (hoy, antes de 2098),
-- así que la anulación de factura_actual (1,180.00) cae en el saldo anterior:
-- 1,534.00 de factura_anterior menos 1,180.00 de la reversión.
select is(
  (select saldo_inicial::numeric(14,2)
   from public.reporte_saldos_tercero('2098-01-01', '2098-01-31', null, (select id from _ids where clave = 'cliente'))
   where cuenta_codigo = '1103'),
  (1534.00 - 1180.00)::numeric(14,2),
  'saldos por tercero: saldo anterior de cuentas por cobrar'
);

select is(
  (select debitos::numeric(14,2)
   from public.reporte_saldos_tercero('2098-01-01', '2098-01-31', null, (select id from _ids where clave = 'cliente'))
   where cuenta_codigo = '1103'),
  1180.00::numeric(14,2),
  'saldos por tercero: débitos del período'
);

select is(
  (select creditos::numeric(14,2)
   from public.reporte_saldos_tercero('2098-01-01', '2098-01-31', null, (select id from _ids where clave = 'cliente'))
   where cuenta_codigo = '1103'),
  500.00::numeric(14,2),
  'saldos por tercero: créditos del período'
);

select is(
  (select creditos::numeric(14,2)
   from public.reporte_saldos_tercero('2098-01-01', '2098-01-31', null, (select id from _ids where clave = 'proveedor'))
   where cuenta_codigo = '2101'),
  4602.00::numeric(14,2),
  'saldos por tercero: créditos de cuentas por pagar del proveedor'
);

select is(
  (select debitos::numeric(14,2)
   from public.reporte_saldos_tercero('2098-01-01', '2098-01-31', null, (select id from _ids where clave = 'proveedor'))
   where cuenta_codigo = '2101'),
  2000.00::numeric(14,2),
  'saldos por tercero: débitos del pago al proveedor'
);

select is(
  (select saldo_inicial::numeric(14,2)
   from public.reporte_saldos_cuentas('2098-01-01', '2098-01-31', false)
   where cuenta_codigo = '1103')
  - coalesce((
      select saldo_inicial
      from public.reporte_saldos_cuentas('2097-12-20', '2097-12-31', false)
      where cuenta_codigo = '1103'
    ), 0)::numeric(14,2),
  1534.00::numeric(14,2),
  'saldos por cuenta: saldo anterior'
);

select is(
  (select debitos::numeric(14,2)
   from public.reporte_saldos_cuentas('2098-01-01', '2098-01-31', false)
   where cuenta_codigo = '1103'),
  1180.00::numeric(14,2),
  'saldos por cuenta: débitos del período'
);

select is(
  (select saldo_inicial::numeric(14,2)
   from public.reporte_saldos_cuentas('2098-01-01', '2098-01-31', false)
   where cuenta_codigo = '4101')
  - coalesce((
      select saldo_inicial
      from public.reporte_saldos_cuentas('2097-12-20', '2097-12-31', false)
      where cuenta_codigo = '4101'
    ), 0)::numeric(14,2),
  1300.00::numeric(14,2),
  'saldos por cuenta: sin cierre anual incluye ingresos anteriores'
);

select is(
  (select saldo_inicial::numeric(14,2)
   from public.reporte_saldos_cuentas('2098-01-01', '2098-01-31', true)
   where cuenta_codigo = '4101'),
  0.00::numeric(14,2),
  'saldos por cuenta: con cierre anual los ingresos empiezan el 1 de enero'
);

select is(
  (select sum(debito)::numeric(14,2) - sum(credito)::numeric(14,2)
   from public.reporte_movimientos('2098-01-01', '2098-01-31')),
  0.00::numeric(14,2),
  'movimientos: débitos iguales a créditos en el período'
);

select * from finish();
rollback;

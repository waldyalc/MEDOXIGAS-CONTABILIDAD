begin;
select plan(16);

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local');
insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id)
select 'contacto', public.crear_contacto(jsonb_build_object(
  'tipo', 'cliente',
  'nombre', 'Numeraciones Notas Cliente'
));

insert into _ids (clave, id)
select 'proveedor', public.crear_contacto(jsonb_build_object(
  'tipo', 'proveedor',
  'nombre', 'Numeraciones Notas Proveedor'
));

insert into _ids (clave, id)
select 'servicio', public.crear_producto(jsonb_build_object(
  'tipo', 'servicio',
  'nombre', 'Numeraciones Notas Servicio',
  'precio', 100.00::numeric,
  'itbis_tasa', 18.00::numeric
));

insert into _ids (clave, id)
select 'num02', n.id from public.numeraciones n
where n.tipo_comprobante = '02' order by n.id limit 1;

insert into _ids (clave, id)
select 'num03', n.id from public.numeraciones n
where n.tipo_comprobante = '03' order by n.id limit 1;

insert into _ids (clave, id)
select 'num04', n.id from public.numeraciones n
where n.tipo_comprobante = '04' order by n.id limit 1;

insert into _ids (clave, id)
select 'num13', n.id from public.numeraciones n
where n.tipo_comprobante = '13' order by n.id limit 1;

insert into _ids (clave, id)
select 'cuenta_gasto', c.id from public.cuentas c where c.codigo = '6105';

insert into _ids (clave, id)
select 'cuenta_pago', cc.cuenta_id from public.config_contable cc where cc.clave = 'caja_chica';

insert into _ids (clave, id)
select 'factura', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-17',
  'vencimiento', '2026-12-17',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'servicio'),
    'cantidad', 2.00::numeric,
    'precio', 100.00::numeric
  ))
));

insert into _ids (clave, id)
select 'linea_factura', fl.id
from public.factura_lineas fl
where fl.factura_id = (select id from _ids where clave = 'factura')
order by fl.id
limit 1;

insert into _ids (clave, id)
select 'nota_credito', public.crear_nota_credito_venta(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'factura'),
  'fecha', '2026-11-17',
  'lineas', jsonb_build_array(jsonb_build_object(
    'factura_linea_id', (select id from _ids where clave = 'linea_factura'),
    'cantidad', 1.00::numeric
  ))
));

select is(
  (select ncf from public.notas_credito_venta where id = (select id from _ids where clave = 'nota_credito')),
  'B0400000001',
  'la nota de crédito de venta emite B04'
);

insert into _ids (clave, id)
select 'nota_debito', public.crear_nota_debito_venta(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'factura'),
  'tipo', 'texto',
  'fecha', '2026-11-17',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'servicio'),
    'cantidad', 1.00::numeric,
    'precio', 50.00::numeric
  ))
));

select is(
  (select ncf from public.notas_debito_venta where id = (select id from _ids where clave = 'nota_debito')),
  'B0300000001',
  'la nota de débito de venta emite B03'
);

insert into _ids (clave, id)
select 'gasto', public.crear_gasto_menor(jsonb_build_object(
  'fecha', '2026-11-17',
  'descripcion', 'Numeraciones Notas Gasto',
  'subtotal', 50.00::numeric,
  'itbis_tasa', 0::numeric,
  'cuenta_gasto_id', (select id from _ids where clave = 'cuenta_gasto'),
  'cuenta_pago_id', (select id from _ids where clave = 'cuenta_pago')
));

select is(
  (select ncf from public.gastos_menores where id = (select id from _ids where clave = 'gasto')),
  'B1300000001',
  'el gasto menor sigue emitiendo B13'
);

select throws_ok(
  $$select public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num02'),
    'siguiente', 1
  ))$$,
  '22023',
  null,
  'B02 no baja por debajo del último NCF de facturas'
);

select is(
  public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num02'),
    'siguiente', 2
  )),
  (select id from _ids where clave = 'num02'),
  'B02 acepta un siguiente válido'
);

select throws_ok(
  $$select public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num13'),
    'siguiente', 1
  ))$$,
  '22023',
  null,
  'B13 no baja por debajo del último NCF de gastos menores'
);

select is(
  public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num13'),
    'siguiente', 2
  )),
  (select id from _ids where clave = 'num13'),
  'B13 acepta un siguiente válido'
);

select throws_ok(
  $$select public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num04'),
    'siguiente', 1
  ))$$,
  '22023',
  null,
  'B04 no baja por debajo del último NCF de notas de crédito de venta'
);

select is(
  public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num04'),
    'siguiente', 2
  )),
  (select id from _ids where clave = 'num04'),
  'B04 acepta un siguiente válido'
);

select throws_ok(
  $$select public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num03'),
    'siguiente', 1
  ))$$,
  '22023',
  null,
  'B03 no baja por debajo del último NCF de notas de débito de venta'
);

select is(
  public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num03'),
    'siguiente', 2
  )),
  (select id from _ids where clave = 'num03'),
  'B03 acepta un siguiente válido'
);

reset role;

insert into public.facturas_proveedor (contacto_id, fecha, vencimiento)
values ((select id from _ids where clave = 'proveedor'), '2026-11-17', '2026-12-17');

insert into public.notas_credito_compra (ncf, factura_proveedor_id, contacto_id, fecha)
values (
  'B0300000500',
  (select fp.id from public.facturas_proveedor fp
   where fp.contacto_id = (select id from _ids where clave = 'proveedor')
   order by fp.id limit 1),
  (select id from _ids where clave = 'proveedor'),
  '2026-11-17'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select throws_ok(
  $$select public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num03'),
    'siguiente', 500
  ))$$,
  '22023',
  null,
  'B03 tampoco baja por debajo de una nota de crédito de compra vieja con B03'
);

select is(
  public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num03'),
    'siguiente', 501
  )),
  (select id from _ids where clave = 'num03'),
  'B03 acepta el siguiente después del B03 viejo de compras'
);

reset role;

insert into public.notas_credito_compra (ncf, factura_proveedor_id, contacto_id, fecha)
values (
  'B0400009000',
  (select fp.id from public.facturas_proveedor fp
   where fp.contacto_id = (select id from _ids where clave = 'proveedor')
   order by fp.id limit 1),
  (select id from _ids where clave = 'proveedor'),
  '2026-11-17'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num04'),
    'siguiente', 3
  )),
  (select id from _ids where clave = 'num04'),
  'un B04 de proveedor en compras no bloquea la serie B04 propia'
);

select is(
  (select siguiente from public.numeraciones where id = (select id from _ids where clave = 'num04')),
  3,
  'el siguiente de B04 queda guardado'
);

select is(
  (select siguiente from public.numeraciones where id = (select id from _ids where clave = 'num03')),
  501,
  'el siguiente de B03 queda guardado'
);

reset role;
select * from finish();
rollback;

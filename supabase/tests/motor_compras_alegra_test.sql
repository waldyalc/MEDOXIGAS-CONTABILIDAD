begin;
select plan(14);

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
values ('ncf', 'B01' || lpad((floor(random() * 90000000) + 10000000)::int::text, 8, '0'));

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id)
select 'contacto', public.crear_contacto(
  '{"tipo":"proveedor","nombre":"Proveedor Alegra"}'::jsonb
);

insert into _ids (clave, id)
select 'producto', public.crear_producto(
  '{"tipo":"producto","nombre":"Producto Alegra","precio":650,"itbis_tasa":18,"inventariable":true,"cantidad":0,"costo":0}'::jsonb
);

insert into _ids (clave, id)
select 'factura_proveedor', public.crear_factura_proveedor(jsonb_build_object(
  'ncf', (select valor from _valores where clave = 'ncf'),
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'producto'),
      'cantidad', 100,
      'costo', 390,
      'itbis_tasa', 18
    )
  )
));

select is(
  (select fp.subtotal from public.facturas_proveedor fp
    where fp.id = (select id from _ids where clave = 'factura_proveedor')),
  39000.00::numeric,
  'factura proveedor subtotal = 39000.00'
);

select is(
  (select fp.itbis from public.facturas_proveedor fp
    where fp.id = (select id from _ids where clave = 'factura_proveedor')),
  7020.00::numeric,
  'factura proveedor itbis = 7020.00'
);

select is(
  (select fp.total from public.facturas_proveedor fp
    where fp.id = (select id from _ids where clave = 'factura_proveedor')),
  46020.00::numeric,
  'factura proveedor total = 46020.00'
);

select is(
  (select fp.ncf from public.facturas_proveedor fp
    where fp.id = (select id from _ids where clave = 'factura_proveedor')),
  (select valor from _valores where clave = 'ncf'),
  'la factura de proveedor guarda el NCF único de la corrida'
);

select is(
  (select coalesce(sum(al.debito), 0)
     from public.facturas_proveedor fp
     join public.asiento_lineas al on al.asiento_id = fp.asiento_id
     join public.cuentas c on c.id = al.cuenta_id
    where fp.id = (select id from _ids where clave = 'factura_proveedor')
      and c.codigo = '1104'),
  39000.00::numeric,
  'asiento factura proveedor: Dr 1104 inventario = 39000.00'
);

select is(
  (select coalesce(sum(al.debito), 0)
     from public.facturas_proveedor fp
     join public.asiento_lineas al on al.asiento_id = fp.asiento_id
     join public.cuentas c on c.id = al.cuenta_id
    where fp.id = (select id from _ids where clave = 'factura_proveedor')
      and c.codigo = '1105'),
  7020.00::numeric,
  'asiento factura proveedor: Dr 1105 ITBIS adelantado = 7020.00'
);

select is(
  (select coalesce(sum(al.credito), 0)
     from public.facturas_proveedor fp
     join public.asiento_lineas al on al.asiento_id = fp.asiento_id
     join public.cuentas c on c.id = al.cuenta_id
    where fp.id = (select id from _ids where clave = 'factura_proveedor')
      and c.codigo = '2101'),
  46020.00::numeric,
  'asiento factura proveedor: Cr 2101 CxP = 46020.00'
);

select is(
  (select p.cantidad from public.productos p where p.id = (select id from _ids where clave = 'producto')),
  100.00::numeric,
  'el producto inventariable sube a 100 de existencia'
);

select is(
  (select p.costo from public.productos p where p.id = (select id from _ids where clave = 'producto')),
  390.00::numeric,
  'el producto inventariable toma costo 390.00'
);

select is(
  (select sum(al.debito) - sum(al.credito)
     from public.facturas_proveedor fp
     join public.asiento_lineas al on al.asiento_id = fp.asiento_id
    where fp.id = (select id from _ids where clave = 'factura_proveedor')),
  0::numeric,
  'asiento de la factura de proveedor cuadrado'
);

select public.registrar_pago_proveedor(jsonb_build_object(
  'factura_proveedor_id', (select id from _ids where clave = 'factura_proveedor'),
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
    where pp.factura_proveedor_id = (select id from _ids where clave = 'factura_proveedor')
      and c.codigo = '2101'),
  46020.00::numeric,
  'asiento pago proveedor: Dr 2101 = 46020.00'
);

select is(
  (select coalesce(sum(al.credito), 0)
     from public.pagos_proveedor pp
     join public.asiento_lineas al on al.asiento_id = pp.asiento_id
     join public.cuentas c on c.id = al.cuenta_id
    where pp.factura_proveedor_id = (select id from _ids where clave = 'factura_proveedor')
      and c.codigo = '1102'),
  46020.00::numeric,
  'asiento pago proveedor: Cr 1102 = 46020.00'
);

select is(
  (select fp.pagado from public.facturas_proveedor fp
    where fp.id = (select id from _ids where clave = 'factura_proveedor')),
  46020.00::numeric,
  'la factura de proveedor queda pagada por 46020.00'
);

select is(
  (select fp.estado from public.facturas_proveedor fp
    where fp.id = (select id from _ids where clave = 'factura_proveedor')),
  'pagada',
  'la factura de proveedor queda en estado pagada'
);

select * from finish();
rollback;

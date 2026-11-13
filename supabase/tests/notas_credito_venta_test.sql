begin;
select plan(26);

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

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id)
select 'contacto', public.crear_contacto(jsonb_build_object(
  'tipo', 'cliente',
  'nombre', 'Nota Crédito Cliente'
));

insert into _ids (clave, id)
select 'producto', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Nota Crédito Producto',
  'precio', 650.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'inventariable', true,
  'cantidad', 10.00::numeric,
  'costo', 390.00::numeric
));

insert into _ids (clave, id)
select 'factura1', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 2.00::numeric,
    'precio', 650.00::numeric
  ))
));

insert into _ids (clave, id)
select 'factura_linea1', fl.id
from public.factura_lineas fl
where fl.factura_id = (select id from _ids where clave = 'factura1');

insert into _valores (clave, valor)
select 'ncf_nota', n.prefijo || lpad(n.siguiente::text, 8, '0')
from public.numeraciones n
where n.tipo_comprobante = '04' and n.activa
order by n.id
limit 1;

select is(
  (select total::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura1')),
  1534.00::numeric(14,2),
  'factura de 2 unidades: total 1534.00'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.facturas where id = (select id from _ids where clave = 'factura1'))
     and c.codigo = '1103'),
  1534.00::numeric(14,2),
  'factura: debe cuentas por cobrar 1103 por 1534.00'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where id = (select id from _ids where clave = 'producto')),
  8.00::numeric(14,2),
  'existencia del producto baja a 8 con la factura'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.facturas where id = (select id from _ids where clave = 'factura1'))
     and c.codigo = '5101'),
  780.00::numeric(14,2),
  'factura: debe costo de ventas 5101 por 780.00'
);

insert into _ids (clave, id)
select 'nota1', public.crear_nota_credito_venta(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'factura1'),
  'fecha', '2026-11-13',
  'notas', 'Devolución de 1 unidad',
  'lineas', jsonb_build_array(jsonb_build_object(
    'factura_linea_id', (select id from _ids where clave = 'factura_linea1'),
    'cantidad', 1.00::numeric
  ))
));

select is(
  (select ncf from public.notas_credito_venta where id = (select id from _ids where clave = 'nota1')),
  (select valor from _valores where clave = 'ncf_nota'),
  'la nota usa el siguiente NCF B04'
);

select is(
  (select subtotal::numeric(14,2) from public.notas_credito_venta where id = (select id from _ids where clave = 'nota1')),
  650.00::numeric(14,2),
  'nota: subtotal 650.00'
);

select is(
  (select itbis::numeric(14,2) from public.notas_credito_venta where id = (select id from _ids where clave = 'nota1')),
  117.00::numeric(14,2),
  'nota: ITBIS 117.00'
);

select is(
  (select total::numeric(14,2) from public.notas_credito_venta where id = (select id from _ids where clave = 'nota1')),
  767.00::numeric(14,2),
  'nota: total 767.00'
);

select is(
  (select cantidad::numeric(14,2)
   from public.nota_credito_venta_lineas
   where nota_id = (select id from _ids where clave = 'nota1')),
  1.00::numeric(14,2),
  'nota: línea de 1 unidad'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.notas_credito_venta where id = (select id from _ids where clave = 'nota1'))
     and c.codigo = '4101'),
  650.00::numeric(14,2),
  'asiento nota: debe ventas de productos 4101'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.notas_credito_venta where id = (select id from _ids where clave = 'nota1'))
     and c.codigo = '2102'),
  117.00::numeric(14,2),
  'asiento nota: debe ITBIS por pagar 2102'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.notas_credito_venta where id = (select id from _ids where clave = 'nota1'))
     and c.codigo = '1103'),
  767.00::numeric(14,2),
  'asiento nota: haber cuentas por cobrar 1103'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.notas_credito_venta where id = (select id from _ids where clave = 'nota1'))
     and c.codigo = '1104'),
  390.00::numeric(14,2),
  'asiento nota: debe inventario 1104'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.notas_credito_venta where id = (select id from _ids where clave = 'nota1'))
     and c.codigo = '5101'),
  390.00::numeric(14,2),
  'asiento nota: haber costo de ventas 5101'
);

select is(
  (select coalesce(sum(al.debito) - sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   where al.asiento_id = (select asiento_id from public.notas_credito_venta where id = (select id from _ids where clave = 'nota1'))),
  0.00::numeric(14,2),
  'asiento de la nota cuadrado'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where id = (select id from _ids where clave = 'producto')),
  9.00::numeric(14,2),
  'la devolución sube la existencia a 9'
);

select is(
  (select credito::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura1')),
  767.00::numeric(14,2),
  'factura: credito acumulado 767.00'
);

select is(
  (select round(total - pagado - credito, 2)::numeric(14,2)
   from public.facturas
   where id = (select id from _ids where clave = 'factura1')),
  767.00::numeric(14,2),
  'factura: saldo pendiente 767.00'
);

select is(
  (select estado from public.facturas where id = (select id from _ids where clave = 'factura1')),
  'abierta',
  'la factura sigue abierta'
);

select is(
  (select a.origen_tipo
   from public.asientos a
   join public.notas_credito_venta n on n.asiento_id = a.id
   where n.id = (select id from _ids where clave = 'nota1')),
  'nota_credito_venta',
  'asiento con origen_tipo nota_credito_venta'
);

select throws_ok(
  $q$select public.crear_nota_credito_venta(jsonb_build_object(
    'factura_id', (select id from _ids where clave = 'factura1'),
    'lineas', jsonb_build_array(jsonb_build_object(
      'factura_linea_id', (select id from _ids where clave = 'factura_linea1'),
      'cantidad', 2
    ))
  ))$q$,
  null,
  null,
  'segunda nota por más de lo disponible falla'
);

insert into _ids (clave, id)
select 'factura2', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 1.00::numeric,
    'precio', 650.00::numeric
  ))
));

insert into _ids (clave, id)
select 'factura_linea2', fl.id
from public.factura_lineas fl
where fl.factura_id = (select id from _ids where clave = 'factura2');

select public.anular_documento('factura', (select id from _ids where clave = 'factura2'));

select throws_ok(
  $q$select public.crear_nota_credito_venta(jsonb_build_object(
    'factura_id', (select id from _ids where clave = 'factura2'),
    'lineas', jsonb_build_array(jsonb_build_object(
      'factura_linea_id', (select id from _ids where clave = 'factura_linea2'),
      'cantidad', 1
    ))
  ))$q$,
  null,
  null,
  'nota contra factura anulada falla'
);

select throws_ok(
  $q$select public.registrar_pago_recibido(jsonb_build_object(
    'factura_id', (select id from _ids where clave = 'factura1'),
    'fecha', '2026-11-13',
    'cuenta_id', (select id from public.cuentas where codigo = '1101'),
    'metodo', 'efectivo',
    'monto', 768
  ))$q$,
  null,
  null,
  'pago mayor al saldo restante falla'
);

select public.registrar_pago_recibido(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'factura1'),
  'fecha', '2026-11-13',
  'cuenta_id', (select id from public.cuentas where codigo = '1101'),
  'metodo', 'efectivo',
  'monto', 767
));

select is(
  (select estado from public.facturas where id = (select id from _ids where clave = 'factura1')),
  'pagada',
  'pago del saldo restante marca la factura pagada'
);

select is(
  (select count(*)::int
   from public.reporte_cxc('2026-11-30')
   where factura_id = (select id from _ids where clave = 'factura1')),
  0,
  'CxC omite la factura saldada con nota y pago'
);

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  $q$select public.crear_nota_credito_venta('{}'::jsonb)$q$,
  '42501',
  null,
  'lector no puede crear notas de crédito'
);

select * from finish();
rollback;

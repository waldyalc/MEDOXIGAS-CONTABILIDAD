begin;
select plan(18);

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
  'nombre', 'Nota Débito Cliente'
));

insert into _ids (clave, id)
select 'otro_contacto', public.crear_contacto(jsonb_build_object(
  'tipo', 'cliente',
  'nombre', 'Nota Débito Otro Cliente'
));

insert into _ids (clave, id)
select 'producto', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Nota Débito Producto',
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

insert into _valores (clave, valor)
select 'ncf_nota', n.prefijo || lpad(n.siguiente::text, 8, '0')
from public.numeraciones n
where n.tipo_comprobante = '03' and n.activa
order by n.id
limit 1;

select is(
  (select total::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura1')),
  1534.00::numeric(14,2),
  'factura base: total 1534.00'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where id = (select id from _ids where clave = 'producto')),
  8.00::numeric(14,2),
  'factura base: existencia 8'
);

insert into _ids (clave, id)
select 'nota1', public.crear_nota_debito_venta(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'factura1'),
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'tipo', 'montos',
  'fecha', '2026-11-13',
  'notas', 'Cargo por flete',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'producto'),
      'cantidad', 1.00::numeric,
      'precio', 650.00::numeric,
      'itbis_tasa', 18.00::numeric
    ),
    jsonb_build_object(
      'descripcion', 'Cargo por flete',
      'cantidad', 1.00::numeric,
      'precio', 500.00::numeric,
      'itbis_tasa', 18.00::numeric
    )
  )
));

select is(
  (select ncf from public.notas_debito_venta where id = (select id from _ids where clave = 'nota1')),
  (select valor from _valores where clave = 'ncf_nota'),
  'la nota usa el siguiente NCF B03'
);

select is(
  (select subtotal::numeric(14,2) from public.notas_debito_venta where id = (select id from _ids where clave = 'nota1')),
  1150.00::numeric(14,2),
  'nota: subtotal 1150.00'
);

select is(
  (select descuento::numeric(14,2) from public.notas_debito_venta where id = (select id from _ids where clave = 'nota1')),
  0.00::numeric(14,2),
  'nota: descuento 0.00'
);

select is(
  (select itbis::numeric(14,2) from public.notas_debito_venta where id = (select id from _ids where clave = 'nota1')),
  207.00::numeric(14,2),
  'nota: ITBIS 207.00'
);

select is(
  (select total::numeric(14,2) from public.notas_debito_venta where id = (select id from _ids where clave = 'nota1')),
  1357.00::numeric(14,2),
  'nota: total 1357.00'
);

select is(
  (select count(*)::int
   from public.nota_debito_venta_lineas
   where nota_id = (select id from _ids where clave = 'nota1')),
  2,
  'nota: dos líneas'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.notas_debito_venta where id = (select id from _ids where clave = 'nota1'))
     and c.codigo = '1103'),
  1357.00::numeric(14,2),
  'asiento nota: debe cuentas por cobrar 1103 por 1357.00'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.notas_debito_venta where id = (select id from _ids where clave = 'nota1'))
     and c.codigo = '4101'),
  1150.00::numeric(14,2),
  'asiento nota: haber ventas 4101 por 1150.00'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.notas_debito_venta where id = (select id from _ids where clave = 'nota1'))
     and c.codigo = '2102'),
  207.00::numeric(14,2),
  'asiento nota: haber ITBIS por pagar 2102 por 207.00'
);

select is(
  (select coalesce(sum(al.debito) - sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   where al.asiento_id = (select asiento_id from public.notas_debito_venta where id = (select id from _ids where clave = 'nota1'))),
  0.00::numeric(14,2),
  'asiento de la nota cuadrado'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where id = (select id from _ids where clave = 'producto')),
  8.00::numeric(14,2),
  'la nota de débito no mueve inventario'
);

select is(
  (select a.origen_tipo
   from public.asientos a
   join public.notas_debito_venta n on n.asiento_id = a.id
   where n.id = (select id from _ids where clave = 'nota1')),
  'nota_debito',
  'asiento con origen_tipo nota_debito'
);

select is(
  (select estado from public.facturas where id = (select id from _ids where clave = 'factura1')),
  'abierta',
  'la factura asociada sigue abierta'
);

select throws_ok(
  $q$select public.crear_nota_debito_venta(jsonb_build_object(
    'factura_id', (select id from _ids where clave = 'factura1'),
    'contacto_id', (select id from _ids where clave = 'otro_contacto'),
    'tipo', 'texto',
    'lineas', jsonb_build_array(jsonb_build_object('descripcion', 'Cargo', 'cantidad', 1, 'precio', 10))
  ))$q$,
  null,
  null,
  'la factura debe pertenecer al cliente indicado'
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

select public.anular_documento('factura', (select id from _ids where clave = 'factura2'));

select throws_ok(
  $q$select public.crear_nota_debito_venta(jsonb_build_object(
    'factura_id', (select id from _ids where clave = 'factura2'),
    'tipo', 'texto',
    'lineas', jsonb_build_array(jsonb_build_object('descripcion', 'Cargo', 'cantidad', 1, 'precio', 10))
  ))$q$,
  null,
  null,
  'nota de débito contra factura anulada falla'
);

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  $q$select public.crear_nota_debito_venta('{}'::jsonb)$q$,
  '42501',
  null,
  'lector no puede crear notas de débito'
);

select * from finish();
rollback;

begin;
select plan(22);

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

insert into _valores (clave, valor)
select 'inicio', (date_trunc('month', current_date) - interval '1 month')::date::text;

insert into _valores (clave, valor)
select 'periodo', date_trunc('month', current_date)::date::text;

insert into _valores (clave, valor)
select 'siguiente', (date_trunc('month', current_date) + interval '1 month')::date::text;

insert into _ids (clave, id)
select 'contacto', public.crear_contacto(jsonb_build_object(
  'tipo', 'cliente',
  'nombre', 'Recurrente Cliente'
));

insert into _ids (clave, id)
select 'producto', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Recurrente Producto',
  'precio', 650.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'inventariable', true,
  'cantidad', 10.00::numeric,
  'costo', 390.00::numeric
));

insert into _ids (clave, id)
select 'recurrente1', public.crear_factura_recurrente(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'tipo_comprobante', '02',
  'fecha_inicio', (select valor from _valores where clave = 'inicio')::date,
  'frecuencia_meses', 1,
  'plazo_dias', 30,
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 2.00::numeric,
    'precio', 650.00::numeric,
    'itbis_tasa', 18.00::numeric
  ))
));

select is(
  (select count(*)::int
   from public.factura_recurrente_lineas
   where recurrente_id = (select id from _ids where clave = 'recurrente1')),
  1,
  'la plantilla guarda sus líneas'
);

insert into _ids (clave, id)
select 'factura1', public.generar_factura_recurrente(
  (select id from _ids where clave = 'recurrente1')
);

select isnt(
  (select id from _ids where clave = 'factura1'),
  null,
  'la generación devuelve la factura'
);

select is(
  (select fecha from public.facturas where id = (select id from _ids where clave = 'factura1')),
  (select valor from _valores where clave = 'periodo')::date,
  'la factura se fecha al inicio del periodo vigente'
);

select is(
  (select vencimiento from public.facturas where id = (select id from _ids where clave = 'factura1')),
  ((select valor from _valores where clave = 'periodo')::date + 30),
  'el vencimiento aplica el plazo de pago'
);

select is(
  (select total::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura1')),
  1534.00::numeric(14,2),
  'la factura generada suma 1534.00'
);

select is(
  (select count(*)::int from public.factura_lineas where factura_id = (select id from _ids where clave = 'factura1')),
  1,
  'la factura generada copia las líneas de la plantilla'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.facturas where id = (select id from _ids where clave = 'factura1'))
     and c.codigo = '1103'),
  1534.00::numeric(14,2),
  'asiento: debe cuentas por cobrar 1103'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.facturas where id = (select id from _ids where clave = 'factura1'))
     and c.codigo = '4101'),
  1300.00::numeric(14,2),
  'asiento: haber ventas 4101'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.facturas where id = (select id from _ids where clave = 'factura1'))
     and c.codigo = '2102'),
  234.00::numeric(14,2),
  'asiento: haber ITBIS por pagar 2102'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where id = (select id from _ids where clave = 'producto')),
  8.00::numeric(14,2),
  'la generación descuenta inventario a través del motor'
);

select is(
  (select periodo from public.factura_recurrente_generaciones
   where recurrente_id = (select id from _ids where clave = 'recurrente1')),
  (select valor from _valores where clave = 'periodo')::date,
  'la generación registra el periodo'
);

select is(
  public.generar_factura_recurrente((select id from _ids where clave = 'recurrente1')),
  (select id from _ids where clave = 'factura1'),
  'generar de nuevo el mismo periodo devuelve la misma factura'
);

select is(
  (select count(*)::int
   from public.factura_recurrente_generaciones
   where recurrente_id = (select id from _ids where clave = 'recurrente1')),
  1,
  'el periodo generado no se duplica'
);

select is(
  (select count(*)::int
   from public.facturas
   where contacto_id = (select id from _ids where clave = 'contacto')),
  1,
  'solo existe una factura del periodo'
);

insert into _ids (clave, id)
select 'factura2', public.generar_factura_recurrente(
  (select id from _ids where clave = 'recurrente1'),
  (select valor from _valores where clave = 'siguiente')::date
);

select isnt(
  (select id from _ids where clave = 'factura2'),
  (select id from _ids where clave = 'factura1'),
  'el siguiente periodo genera otra factura'
);

select is(
  (select count(*)::int
   from public.factura_recurrente_generaciones
   where recurrente_id = (select id from _ids where clave = 'recurrente1')),
  2,
  'quedan dos periodos generados'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where id = (select id from _ids where clave = 'producto')),
  6.00::numeric(14,2),
  'el segundo periodo vuelve a descontar inventario'
);

select throws_ok(
  $q$select public.crear_factura_recurrente(jsonb_build_object(
    'contacto_id', (select id from _ids where clave = 'contacto'),
    'fecha_inicio', '2026-11-13',
    'vigencia_hasta', '2026-11-01',
    'lineas', jsonb_build_array(jsonb_build_object('descripcion', 'Cuota', 'cantidad', 1, 'precio', 10))
  ))$q$,
  null,
  null,
  'la vigencia no puede ser anterior al inicio'
);

select throws_ok(
  $q$select public.crear_factura_recurrente(jsonb_build_object(
    'contacto_id', (select id from _ids where clave = 'contacto'),
    'fecha_inicio', '2026-11-13',
    'lineas', '[]'::jsonb
  ))$q$,
  null,
  null,
  'la plantilla requiere al menos una línea'
);

insert into _ids (clave, id)
select 'futura', public.crear_factura_recurrente(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha_inicio', (current_date + 30),
  'lineas', jsonb_build_array(jsonb_build_object('descripcion', 'Cuota futura', 'cantidad', 1, 'precio', 10))
));

select throws_ok(
  $q$select public.generar_factura_recurrente((select id from _ids where clave = 'futura'))$q$,
  null,
  null,
  'no se puede generar antes de la fecha de inicio'
);

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  $q$select public.crear_factura_recurrente('{}'::jsonb)$q$,
  '42501',
  null,
  'lector no puede crear facturas recurrentes'
);

select throws_ok(
  $q$select public.generar_factura_recurrente((select id from _ids where clave = 'recurrente1'))$q$,
  '42501',
  null,
  'lector no puede generar facturas recurrentes'
);

select * from finish();
rollback;

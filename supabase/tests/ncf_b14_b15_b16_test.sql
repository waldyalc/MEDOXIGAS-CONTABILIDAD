begin;
select plan(15);

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

select is(
  (select count(*)::int
   from public.numeraciones n
   where (n.tipo_comprobante, n.nombre, n.prefijo) in (
     ('14', 'Régimen especial', 'B14'),
     ('15', 'Gubernamental', 'B15'),
     ('16', 'Exportaciones', 'B16')
   )
     and n.siguiente = 1
     and n.hasta = 100000
     and n.vence is null
     and n.activa),
  3,
  'semillas B14/B15/B16 con siguiente 1, hasta 100000 y sin vence'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id)
select 'contacto', public.crear_contacto(jsonb_build_object(
  'tipo', 'cliente',
  'nombre', 'NCF Cliente'
));

insert into _ids (clave, id)
select 'servicio', public.crear_producto(jsonb_build_object(
  'tipo', 'servicio',
  'nombre', 'NCF Servicio',
  'precio', 100.00::numeric,
  'itbis_tasa', 18.00::numeric
));

insert into _ids (clave, id)
select 'num14', n.id from public.numeraciones n
where n.tipo_comprobante = '14' order by n.id limit 1;

insert into _ids (clave, id)
select 'num15', n.id from public.numeraciones n
where n.tipo_comprobante = '15' order by n.id limit 1;

insert into _ids (clave, id)
select 'num16', n.id from public.numeraciones n
where n.tipo_comprobante = '16' order by n.id limit 1;

insert into _ids (clave, id)
select 'factura14', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '14',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'servicio'),
    'cantidad', 1.00::numeric,
    'precio', 100.00::numeric
  ))
));

select is(
  (select tipo_comprobante from public.facturas where id = (select id from _ids where clave = 'factura14')),
  '14',
  'factura tipo 14'
);

select is(
  (select ncf from public.facturas where id = (select id from _ids where clave = 'factura14')),
  'B1400000001',
  'NCF B14 generado'
);

select is(
  (select siguiente from public.numeraciones where id = (select id from _ids where clave = 'num14')),
  2,
  'siguiente de B14 pasa a 2'
);

insert into _ids (clave, id)
select 'factura15', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '15',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'servicio'),
    'cantidad', 1.00::numeric,
    'precio', 100.00::numeric
  ))
));

select is(
  (select ncf from public.facturas where id = (select id from _ids where clave = 'factura15')),
  'B1500000001',
  'NCF B15 generado'
);

select is(
  (select siguiente from public.numeraciones where id = (select id from _ids where clave = 'num15')),
  2,
  'siguiente de B15 pasa a 2'
);

insert into _ids (clave, id)
select 'factura16', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '16',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'servicio'),
    'cantidad', 1.00::numeric,
    'precio', 100.00::numeric
  ))
));

select is(
  (select ncf from public.facturas where id = (select id from _ids where clave = 'factura16')),
  'B1600000001',
  'NCF B16 generado'
);

select is(
  (select siguiente from public.numeraciones where id = (select id from _ids where clave = 'num16')),
  2,
  'siguiente de B16 pasa a 2'
);

select throws_ok(
  $$select public.crear_factura(jsonb_build_object(
    'tipo_comprobante', '03',
    'contacto_id', (select id from _ids where clave = 'contacto'),
    'lineas', jsonb_build_array(jsonb_build_object('cantidad', 1, 'precio', 100))
  ))$$,
  '22023',
  'tipo de comprobante inválido',
  'tipo de comprobante 03 rechazado'
);

select is(
  public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num16'),
    'vence', '2026-11-12'
  )),
  (select id from _ids where clave = 'num16'),
  'actualizar_numeracion devuelve la numeración'
);

select is(
  (select vence from public.numeraciones where id = (select id from _ids where clave = 'num16')),
  '2026-11-12'::date,
  'actualizar_numeracion guarda el vence'
);

select throws_ok(
  $$select public.crear_factura(jsonb_build_object(
    'tipo_comprobante', '16',
    'contacto_id', (select id from _ids where clave = 'contacto'),
    'fecha', '2026-11-13',
    'vencimiento', '2026-12-13',
    'lineas', jsonb_build_array(jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'servicio'),
      'cantidad', 1,
      'precio', 100
    ))
  ))$$,
  '22023',
  'la numeración B16 está vencida',
  'factura con numeración vencida'
);

reset role;
update public.numeraciones set hasta = 1 where id = (select id from _ids where clave = 'num15');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select throws_ok(
  $$select public.crear_factura(jsonb_build_object(
    'tipo_comprobante', '15',
    'contacto_id', (select id from _ids where clave = 'contacto'),
    'fecha', '2026-11-13',
    'vencimiento', '2026-12-13',
    'lineas', jsonb_build_array(jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'servicio'),
      'cantidad', 1,
      'precio', 100
    ))
  ))$$,
  '22023',
  'la numeración B15 está agotada',
  'factura con numeración agotada'
);

select throws_ok(
  $$select public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num14'),
    'siguiente', 1
  ))$$,
  '22023',
  null,
  'no reduce siguiente por debajo del último NCF emitido'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  $$select public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num16'),
    'vence', '2027-01-01'
  ))$$,
  '42501',
  'sin permiso',
  'lector no puede actualizar numeraciones'
);

reset role;
select * from finish();
rollback;

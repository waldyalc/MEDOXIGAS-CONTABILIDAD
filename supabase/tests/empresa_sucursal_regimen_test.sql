-- POS 10: sucursal y régimen del encabezado del ticket 80 mm.
-- Cubre la migración 20261126121000_empresa_sucursal_regimen.sql:
--   1. empresa.sucursal y empresa.regimen existen.
--   2. solo admin escribe: actualizar_empresa guarda y limpia las claves.
--   3. contador y lector reciben 42501.
begin;
select plan(7);

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

select is(
  (select count(*)::int
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'empresa'
     and column_name in ('sucursal', 'regimen')),
  2,
  'empresa tiene las columnas sucursal y regimen'
);

select lives_ok(
  format(
    'select public.actualizar_empresa(%L::jsonb)',
    jsonb_build_object(
      'nombre', 'Empresa sucursal pgTAP',
      'sucursal', 'Sucursal Central',
      'regimen', 'Régimen Simplificado'
    )
  ),
  'admin guarda sucursal y régimen'
);

select is(
  (select sucursal || '|' || regimen from public.empresa where id = 1),
  'Sucursal Central|Régimen Simplificado',
  'sucursal y régimen se guardan con el resto de la empresa'
);

select lives_ok(
  format(
    'select public.actualizar_empresa(%L::jsonb)',
    jsonb_build_object(
      'nombre', 'Empresa sucursal pgTAP',
      'sucursal', '  ',
      'regimen', ''
    )
  ),
  'admin limpia sucursal y régimen con texto en blanco'
);

select is(
  (select sucursal is null and regimen is null from public.empresa where id = 1),
  true,
  'los campos en blanco quedan nulos'
);

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select throws_ok(
  format(
    'select public.actualizar_empresa(%L::jsonb)',
    jsonb_build_object('nombre', 'Contador', 'sucursal', 'Sucursal contador')
  ),
  '42501',
  'sin permiso',
  'contador no cambia la empresa ni la sucursal'
);

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  format(
    'select public.actualizar_empresa(%L::jsonb)',
    jsonb_build_object('nombre', 'Lector', 'regimen', 'Régimen lector')
  ),
  '42501',
  'sin permiso',
  'lector no cambia la empresa ni el régimen'
);

select * from finish();
rollback;

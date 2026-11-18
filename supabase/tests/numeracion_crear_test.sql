begin;
select plan(11);

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local'),
  ('22222222-2222-2222-2222-222222222222', 'lector@prueba.local');
insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Lector', 'lector');

-- Los ocho tipos fiscales ya tienen su serie sembrada; para probar el alta de
-- una serie fiscal se libera el tipo 15 dentro de esta transacción.
delete from public.numeraciones where tipo_comprobante = '15';

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id)
select 'num15', public.crear_numeracion(jsonb_build_object(
  'tipo_comprobante', '15',
  'nombre', 'Gubernamental alterna',
  'siguiente', 50,
  'hasta', 100000
));

select is(
  (select prefijo from public.numeraciones where id = (select id from _ids where clave = 'num15')),
  'B15',
  'el alta de una serie fiscal fija el prefijo en B + tipo'
);

select is(
  (select siguiente from public.numeraciones where id = (select id from _ids where clave = 'num15')),
  50,
  'el siguiente queda guardado'
);

select is(
  (select activa from public.numeraciones where id = (select id from _ids where clave = 'num15')),
  true,
  'la serie queda activa por defecto'
);

insert into _ids (clave, id)
select 'numzz', public.crear_numeracion(jsonb_build_object(
  'tipo_comprobante', '00',
  'nombre', 'Recibos internos',
  'prefijo', 'zz',
  'siguiente', 1
));

select is(
  (select prefijo from public.numeraciones where id = (select id from _ids where clave = 'numzz')),
  'ZZ',
  'una numeración sin NCF guarda el prefijo libre en mayúsculas'
);

select throws_ok(
  $$select public.crear_numeracion(jsonb_build_object(
    'tipo_comprobante', '02',
    'nombre', 'Consumo duplicada'
  ))$$,
  '22023',
  'ya existe una numeración para ese tipo y prefijo',
  'no se puede crear otra serie del mismo tipo y prefijo'
);

select throws_ok(
  $$select public.crear_numeracion(jsonb_build_object(
    'tipo_comprobante', '00',
    'nombre', 'Recibos repetidos',
    'prefijo', 'ZZ'
  ))$$,
  '22023',
  'ya existe una numeración para ese tipo y prefijo',
  'tampoco se repite un prefijo sin NCF'
);

select throws_ok(
  $$select public.crear_numeracion(jsonb_build_object(
    'tipo_comprobante', '99',
    'nombre', 'Tipo raro'
  ))$$,
  '22023',
  'tipo de documento inválido',
  'el tipo debe estar en la lista válida'
);

select throws_ok(
  $$select public.crear_numeracion(jsonb_build_object(
    'tipo_comprobante', '00',
    'nombre', 'Sin prefijo'
  ))$$,
  '22023',
  'el prefijo es obligatorio',
  'una numeración sin NCF exige prefijo'
);

select throws_ok(
  $$select public.crear_numeracion(jsonb_build_object(
    'tipo_comprobante', '00',
    'nombre', 'Prefijo fiscal',
    'prefijo', 'B01'
  ))$$,
  '22023',
  'ese prefijo está reservado para comprobantes fiscales',
  'un prefijo sin NCF no puede usar un reservado fiscal'
);

select throws_ok(
  $$select public.crear_numeracion(jsonb_build_object(
    'tipo_comprobante', '00',
    'nombre', 'Recibos internos dos',
    'prefijo', 'RC',
    'siguiente', 0
  ))$$,
  '22023',
  'el siguiente debe ser mayor o igual a 1',
  'el siguiente no puede ser menor que 1'
);

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select throws_ok(
  $$select public.crear_numeracion(jsonb_build_object(
    'tipo_comprobante', '00',
    'nombre', 'Recibos del lector',
    'prefijo', 'LR'
  ))$$,
  '42501',
  'sin permiso',
  'un lector no puede crear numeraciones'
);

reset role;
select * from finish();
rollback;

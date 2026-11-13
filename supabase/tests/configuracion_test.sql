begin;
select plan(26);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local'),
  ('22222222-2222-2222-2222-222222222222', 'contador@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector@prueba.local');
insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Contador', 'contador'),
  ('33333333-3333-3333-3333-333333333333', 'Lector', 'lector');

-- ---------------------------------------------------------------------------
-- Semilla de términos de pago
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.terminos_pago),
  5,
  'la semilla deja 5 términos de pago'
);

select ok(
  (select array_agg(nombre order by dias) = array['Contado', '8 días', '15 días', '30 días', '60 días']
   from public.terminos_pago),
  'los términos sembrados son Contado, 8, 15, 30 y 60 días'
);

-- ---------------------------------------------------------------------------
-- Empresa
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  format(
    'select public.actualizar_empresa(%L::jsonb)',
    jsonb_build_object(
      'nombre', 'Empresa de prueba',
      'rnc', '101010101',
      'direccion', 'Calle 1',
      'telefono', '809-555-0000',
      'correo', 'empresa@prueba.local',
      'logo_url', 'https://ejemplo.local/logos/logo.png'
    )
  ),
  'admin actualiza los datos de la empresa'
);

select is(
  (select nombre from public.empresa where id = 1),
  'Empresa de prueba',
  'el nombre de la empresa se guarda'
);

select is(
  (select rnc || '|' || direccion || '|' || telefono || '|' || correo || '|' || logo_url
   from public.empresa where id = 1),
  '101010101|Calle 1|809-555-0000|empresa@prueba.local|https://ejemplo.local/logos/logo.png',
  'los campos opcionales de la empresa se guardan'
);

select throws_ok(
  format('select public.actualizar_empresa(%L::jsonb)', jsonb_build_object('nombre', '  ')),
  '22023',
  null,
  'el nombre de la empresa no puede quedar vacío'
);

select throws_ok(
  $$update public.empresa set nombre = 'Directo' where id = 1$$,
  '42501',
  null,
  'authenticated no puede actualizar la empresa directamente'
);

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select throws_ok(
  format('select public.actualizar_empresa(%L::jsonb)', jsonb_build_object('nombre', 'Contador')),
  '42501',
  null,
  'contador no puede cambiar la empresa'
);

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  format('select public.actualizar_empresa(%L::jsonb)', jsonb_build_object('nombre', 'Lector')),
  '42501',
  null,
  'lector no puede cambiar la empresa'
);

-- ---------------------------------------------------------------------------
-- Términos de pago
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  (select count(*)::int from public.terminos_pago),
  5,
  'authenticated puede leer los términos de pago'
);

select is(
  (select count(*)::int from public.listar_terminos_pago()),
  5,
  'listar_terminos_pago devuelve los 5 términos'
);

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select ok(
  public.crear_termino_pago(jsonb_build_object('nombre', '45 días', 'dias', 45)) is not null,
  'contador crea un término de pago'
);

select is(
  (select dias from public.terminos_pago where nombre = '45 días'),
  45,
  'el término creado guarda sus días'
);

select throws_ok(
  format('select public.crear_termino_pago(%L::jsonb)', jsonb_build_object('nombre', '45 días', 'dias', 45)),
  '23505',
  null,
  'no se puede repetir el nombre de un término de pago'
);

select throws_ok(
  format('select public.crear_termino_pago(%L::jsonb)', jsonb_build_object('nombre', 'Negativo', 'dias', -1)),
  '22023',
  null,
  'los días no pueden ser negativos'
);

select is(
  (select count(*)::int from public.listar_terminos_pago()),
  6,
  'la consulta de términos incluye el término nuevo'
);

select throws_ok(
  $$insert into public.terminos_pago (nombre, dias) values ('Directo', 7)$$,
  '42501',
  null,
  'authenticated no puede insertar términos de pago directamente'
);

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  format('select public.crear_termino_pago(%L::jsonb)', jsonb_build_object('nombre', '90 días', 'dias', 90)),
  '42501',
  null,
  'lector no puede crear términos de pago'
);

-- ---------------------------------------------------------------------------
-- Usuarios
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  (select count(*)::int from public.listar_perfiles()),
  3,
  'admin lista los 3 perfiles'
);

select is(
  (select correo from public.listar_perfiles() where nombre = 'Contador'),
  'contador@prueba.local',
  'listar_perfiles incluye el correo del usuario'
);

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select throws_ok(
  'select public.listar_perfiles()',
  '42501',
  null,
  'contador no puede listar los perfiles'
);

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  'select public.listar_perfiles()',
  '42501',
  null,
  'lector no puede listar los perfiles'
);

-- ---------------------------------------------------------------------------
-- Bucket y políticas de logos
-- ---------------------------------------------------------------------------

reset role;

select is(
  (select public from storage.buckets where id = 'logos'),
  true,
  'el bucket logos existe y es público'
);

select is(
  (select file_size_limit from storage.buckets where id = 'logos'),
  2097152::bigint,
  'el bucket logos limita los archivos a 2 MB'
);

select is(
  (select count(*)::int
   from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname like 'logos\_%'),
  4,
  'el bucket logos tiene cuatro políticas (leer y admin para subir, actualizar y borrar)'
);

reset role;
set local role anon;

select throws_ok(
  'select * from public.terminos_pago',
  '42501',
  null,
  'anon no puede leer los términos de pago'
);

select * from finish();
rollback;

begin;
select plan(21);

insert into auth.users (id, email) values
  ('d1d1d1d1-1111-1111-1111-111111111111', 'admin.adjuntos@prueba.local'),
  ('d2d2d2d2-2222-2222-2222-222222222222', 'lector.adjuntos@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('d1d1d1d1-1111-1111-1111-111111111111', 'Admin adjuntos', 'admin'),
  ('d2d2d2d2-2222-2222-2222-222222222222', 'Lector adjuntos', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d1d1d1d1-1111-1111-1111-111111111111","role":"authenticated"}';

select public.crear_contacto('{"nombre":"Cliente Adjuntos","tipo":"cliente"}'::jsonb);

-- ---------------------------------------------------------------------------
-- subir_adjunto: registra el archivo ya subido al bucket
-- ---------------------------------------------------------------------------

select public.subir_adjunto(jsonb_build_object(
  'entidad_tipo', 'contacto',
  'entidad_id', (select id from public.contactos where nombre = 'Cliente Adjuntos'),
  'path', (select 'contacto/' || id || '/contrato.pdf' from public.contactos where nombre = 'Cliente Adjuntos'),
  'nombre', 'contrato.pdf',
  'mime', 'application/pdf',
  'bytes', 2048
));

select ok(
  (select id from public.adjuntos where nombre = 'contrato.pdf') is not null,
  'subir_adjunto registra el archivo'
);

select is(
  (select a.entidad_tipo from public.adjuntos a where a.nombre = 'contrato.pdf'),
  'contacto',
  'el adjunto guarda el tipo de entidad'
);

select is(
  (select a.creado_por from public.adjuntos a where a.nombre = 'contrato.pdf'),
  'd1d1d1d1-1111-1111-1111-111111111111'::uuid,
  'el adjunto guarda quién lo subió'
);

select is(
  (select a.creado_por_nombre from public.adjuntos a where a.nombre = 'contrato.pdf'),
  'Admin adjuntos',
  'el adjunto desnormaliza el nombre del que sube'
);

select is(
  (select public.descargar_adjunto((select id from public.adjuntos where nombre = 'contrato.pdf'))->>'path'),
  (select 'contacto/' || id || '/contrato.pdf' from public.contactos where nombre = 'Cliente Adjuntos'),
  'descargar_adjunto devuelve la ruta del objeto'
);

select is(
  (select public.descargar_adjunto((select id from public.adjuntos where nombre = 'contrato.pdf'))->>'mime'),
  'application/pdf',
  'descargar_adjunto devuelve el mime'
);

-- ---------------------------------------------------------------------------
-- Validaciones de subir_adjunto
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.subir_adjunto(jsonb_build_object(
      'entidad_tipo', 'asiento',
      'entidad_id', gen_random_uuid(),
      'path', 'asiento/x/a.pdf', 'nombre', 'a.pdf', 'mime', 'application/pdf', 'bytes', 1))$$,
  '22023',
  'tipo de entidad inválido',
  'rechaza un tipo de entidad fuera de la lista'
);

select throws_ok(
  $$select public.subir_adjunto(jsonb_build_object(
      'entidad_tipo', 'contacto',
      'entidad_id', gen_random_uuid(),
      'path', 'contacto/x/a.pdf', 'nombre', 'a.pdf', 'mime', 'application/pdf', 'bytes', 1))$$,
  '22023',
  'la entidad no existe',
  'rechaza una entidad que no existe'
);

select throws_ok(
  $$select public.subir_adjunto(jsonb_build_object(
      'entidad_tipo', 'contacto',
      'entidad_id', (select id from public.contactos where nombre = 'Cliente Adjuntos'),
      'path', 'producto/otro/a.pdf', 'nombre', 'a.pdf', 'mime', 'application/pdf', 'bytes', 1))$$,
  '22023',
  'la ruta del archivo no corresponde a la entidad',
  'rechaza una ruta que no empieza por la carpeta de la entidad'
);

select throws_ok(
  $$select public.subir_adjunto(jsonb_build_object(
      'entidad_tipo', 'contacto',
      'entidad_id', (select id from public.contactos where nombre = 'Cliente Adjuntos'),
      'path', (select 'contacto/' || id || '/hoja.xlsx' from public.contactos where nombre = 'Cliente Adjuntos'),
      'nombre', 'hoja.xlsx', 'mime', 'application/vnd.ms-excel', 'bytes', 10))$$,
  '22023',
  'el archivo debe ser PNG, JPG o PDF',
  'rechaza un mime fuera de PNG, JPG o PDF'
);

select throws_ok(
  $$insert into public.adjuntos (entidad_tipo, entidad_id, path, nombre, mime)
     values ('contacto', (select id from public.contactos where nombre = 'Cliente Adjuntos'),
             'contacto/x/directo.pdf', 'directo.pdf', 'application/pdf')$$,
  '42501',
  null,
  'un autenticado no puede insertar adjuntos directo (solo por RPC)'
);

select throws_ok(
  $$select public.descargar_adjunto(gen_random_uuid())$$,
  '22023',
  'adjunto no encontrado',
  'descargar un adjunto que no existe falla'
);

-- ---------------------------------------------------------------------------
-- El lector lee y descarga, pero no sube ni borra
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"d2d2d2d2-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from public.adjuntos where nombre = 'contrato.pdf'),
  1,
  'el lector lee los adjuntos por RLS'
);

select ok(
  public.descargar_adjunto((select id from public.adjuntos where nombre = 'contrato.pdf')) is not null,
  'el lector puede descargar adjuntos'
);

select throws_ok(
  $$select public.subir_adjunto(jsonb_build_object(
      'entidad_tipo', 'contacto',
      'entidad_id', (select id from public.contactos where nombre = 'Cliente Adjuntos'),
      'path', 'contacto/x/lector.pdf', 'nombre', 'lector.pdf', 'mime', 'application/pdf', 'bytes', 1))$$,
  '42501',
  'sin permiso',
  'un lector no puede subir adjuntos'
);

select throws_ok(
  $$select public.borrar_adjunto((select id from public.adjuntos where nombre = 'contrato.pdf'))$$,
  '42501',
  'sin permiso',
  'un lector no puede borrar adjuntos'
);

-- ---------------------------------------------------------------------------
-- Borrar: solo admin/contador; quita la fila
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"d1d1d1d1-1111-1111-1111-111111111111","role":"authenticated"}';

select public.borrar_adjunto((select id from public.adjuntos where nombre = 'contrato.pdf'));

select is(
  (select count(*)::int from public.adjuntos where nombre = 'contrato.pdf'),
  0,
  'borrar_adjunto elimina la fila'
);

-- ---------------------------------------------------------------------------
-- Bucket y permisos de funciones
-- ---------------------------------------------------------------------------

reset role;

select is(
  (select public from storage.buckets where id = 'documentos'),
  false,
  'el bucket documentos existe y es privado'
);

select is(
  (select file_size_limit from storage.buckets where id = 'documentos'),
  10485760::bigint,
  'el bucket documentos limita los archivos a 10 MB'
);

select is(
  (select count(*)::int
   from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname like 'documentos\_%'),
  2,
  'el bucket documentos solo tiene lectura y subida'
);

select ok(
  not has_function_privilege('anon', 'public.subir_adjunto(jsonb)', 'execute')
    and has_function_privilege('authenticated', 'public.subir_adjunto(jsonb)', 'execute'),
  'solo authenticated puede ejecutar las RPC de adjuntos'
);

select * from finish();
rollback;

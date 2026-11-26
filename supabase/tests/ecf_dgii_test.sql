begin;
select plan(50);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin-ecf@prueba.local'),
  ('22222222-2222-2222-2222-222222222222', 'contador-ecf@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector-ecf@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin e-CF', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Contador e-CF', 'contador'),
  ('33333333-3333-3333-3333-333333333333', 'Lector e-CF', 'lector');

-- ---------------------------------------------------------------------------
-- Estructura, índices únicos, privilegios y políticas
-- ---------------------------------------------------------------------------

select ok(
  to_regclass('public.ecf_config') is not null
  and to_regclass('public.ecf_envios') is not null
  and to_regclass('public.ecf_recibidos') is not null,
  'existen ecf_config, ecf_envios y ecf_recibidos'
);

select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in (
     to_regclass('public.ecf_config')::oid,
     to_regclass('public.ecf_envios')::oid,
     to_regclass('public.ecf_recibidos')::oid
   )),
  'RLS está activo en las tres tablas e-CF'
);

select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name = 'ecf_config'),
  14,
  'ecf_config tiene las 14 columnas del contrato multi-RNC'
);

select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name = 'ecf_envios'),
  24,
  'ecf_envios tiene las 24 columnas de trazabilidad y reintentos'
);

select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name = 'ecf_recibidos'),
  29,
  'ecf_recibidos tiene las 29 columnas de la bandeja de recepción'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.ecf_config'::regclass
      and contype = 'p'
      and pg_get_constraintdef(oid) like 'PRIMARY KEY (rnc)%'
  ),
  'ecf_config usa rnc como llave primaria para aislar cada empresa'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.ecf_envios'::regclass
      and contype = 'u'
      and conname = 'ecf_envios_rnc_ambiente_encf_key'
  ),
  'ecf_envios tiene unicidad idempotente por RNC, ambiente y e-NCF'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.ecf_recibidos'::regclass
      and contype = 'u'
      and conname = 'ecf_recibidos_receptor_emisor_encf_key'
  ),
  'ecf_recibidos tiene unicidad por receptor, emisor y e-NCF'
);

select ok(
  has_column_privilege('authenticated', 'public.ecf_config', 'rnc', 'SELECT')
  and has_column_privilege('authenticated', 'public.ecf_config', 'razon_social', 'SELECT')
  and has_column_privilege('authenticated', 'public.ecf_config', 'cert_huella_sha256', 'SELECT'),
  'authenticated puede seleccionar columnas de metadatos de ecf_config'
);

select ok(
  not has_column_privilege('authenticated', 'public.ecf_config', 'cert_cifrado', 'SELECT')
  and not has_column_privilege('authenticated', 'public.ecf_config', 'cert_pass_cifrada', 'SELECT'),
  'los secretos cifrados del certificado no tienen SELECT directo'
);

select ok(
  has_table_privilege('authenticated', 'public.ecf_config', 'INSERT')
  and has_table_privilege('authenticated', 'public.ecf_config', 'UPDATE')
  and has_table_privilege('authenticated', 'public.ecf_config', 'DELETE'),
  'authenticated tiene privilegios de escritura en ecf_config sujetos a RLS admin'
);

select ok(
  has_table_privilege('authenticated', 'public.ecf_envios', 'SELECT')
  and has_table_privilege('authenticated', 'public.ecf_envios', 'INSERT')
  and has_table_privilege('authenticated', 'public.ecf_envios', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.ecf_envios', 'DELETE'),
  'ecf_envios permite leer/insertar/actualizar por RLS y no borrar'
);

select ok(
  has_table_privilege('authenticated', 'public.ecf_recibidos', 'SELECT')
  and has_table_privilege('authenticated', 'public.ecf_recibidos', 'INSERT')
  and has_table_privilege('authenticated', 'public.ecf_recibidos', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.ecf_recibidos', 'DELETE'),
  'ecf_recibidos permite leer/insertar/actualizar por RLS y no borrar'
);

select ok(
  not has_table_privilege('anon', 'public.ecf_config', 'SELECT')
  and not has_table_privilege('anon', 'public.ecf_envios', 'SELECT')
  and not has_table_privilege('anon', 'public.ecf_recibidos', 'SELECT'),
  'anon no tiene privilegios de lectura en las tablas e-CF'
);

select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public'
     and tablename in ('ecf_config', 'ecf_envios', 'ecf_recibidos')),
  10,
  'hay 4 políticas en ecf_config y 3 en cada tabla operativa'
);

-- ---------------------------------------------------------------------------
-- Constraints de formato y dominio fiscal
-- ---------------------------------------------------------------------------

select throws_ok(
  $q$insert into public.ecf_config (rnc, razon_social) values ('123', 'RNC corto')$q$,
  '23514',
  null,
  'ecf_config rechaza un RNC que no tiene 9 u 11 dígitos'
);

select throws_ok(
  $q$insert into public.ecf_config (rnc, razon_social, ambiente) values ('131488791', 'OXYMAT SRL', 'local')$q$,
  '23514',
  null,
  'ecf_config solo acepta los ambientes testecf, certecf y ecf'
);

select throws_ok(
  $q$insert into public.ecf_envios (rnc_emisor, documento_tipo, tipo_ecf, encf, estado)
     values ('131488791', 'otro', '31', 'E310000000001', 'pendiente')$q$,
  '23514',
  null,
  'ecf_envios rechaza un documento_tipo fuera del contrato'
);

select throws_ok(
  $q$insert into public.ecf_envios (rnc_emisor, documento_tipo, tipo_ecf, encf, estado)
     values ('131488791', 'factura', '31', 'B0100000001', 'pendiente')$q$,
  '23514',
  null,
  'ecf_envios rechaza un comprobante que no es e-NCF electrónico'
);

select throws_ok(
  $q$insert into public.ecf_envios (rnc_emisor, documento_tipo, tipo_ecf, encf, estado)
     values ('131488791', 'factura', '31', 'E310000000001', 'extraviado')$q$,
  '23514',
  null,
  'ecf_envios rechaza un estado fuera de la máquina DGII'
);

select throws_ok(
  $q$insert into public.ecf_recibidos (rnc_receptor, rnc_emisor, razon_social_emisor, tipo_ecf, encf, xml_original)
     values ('123', '131999999', 'PROVEEDOR DE PRUEBA SRL', '31', 'E310000000001', '<ECF/>')$q$,
  '23514',
  null,
  'ecf_recibidos rechaza un RNC receptor inválido'
);

select throws_ok(
  $q$insert into public.ecf_recibidos (rnc_receptor, rnc_emisor, razon_social_emisor, tipo_ecf, encf, xml_original)
     values ('131488791', '131999999', 'PROVEEDOR DE PRUEBA SRL', '31', 'E3101', '<ECF/>')$q$,
  '23514',
  null,
  'ecf_recibidos rechaza un e-NCF incompleto'
);

select throws_ok(
  $q$insert into public.ecf_recibidos (rnc_receptor, rnc_emisor, razon_social_emisor, tipo_ecf, encf, monto_total, xml_original)
     values ('131488791', '131999999', 'PROVEEDOR DE PRUEBA SRL', '31', 'E310000000001', -1, '<ECF/>')$q$,
  '23514',
  null,
  'ecf_recibidos rechaza montos fiscales negativos'
);

select throws_ok(
  $q$insert into public.ecf_recibidos (rnc_receptor, rnc_emisor, razon_social_emisor, tipo_ecf, encf, xml_original, items_resumen)
     values ('131488791', '131999999', 'PROVEEDOR DE PRUEBA SRL', '31', 'E310000000001', '<ECF/>', '{}'::jsonb)$q$,
  '23514',
  null,
  'ecf_recibidos exige items_resumen como arreglo JSON'
);

select throws_ok(
  $q$insert into public.ecf_recibidos (rnc_receptor, rnc_emisor, razon_social_emisor, tipo_ecf, encf, xml_original, estado_acecf)
     values ('131488791', '131999999', 'PROVEEDOR DE PRUEBA SRL', '31', 'E310000000001', '<ECF/>', 'observado')$q$,
  '23514',
  null,
  'ecf_recibidos solo acepta pendiente, aprobado o rechazado en ACECF'
);

-- ---------------------------------------------------------------------------
-- Multi-RNC e idempotencia
-- ---------------------------------------------------------------------------

insert into public.ecf_config (rnc, razon_social, ambiente, activo, dominio_base)
values
  ('131488791', 'OXYMAT SRL', 'testecf', true, 'https://app.medoxigas.com'),
  ('130893489', 'MEDOXIGAS ALC, SRL', 'testecf', true, 'https://app.medoxigas.com');

select is(
  (select count(*)::int from public.ecf_config where rnc in ('131488791', '130893489')),
  2,
  'conviven aislados los RNC de OXYMAT y MEDOXIGAS en ecf_config'
);

insert into public.ecf_envios (rnc_emisor, documento_tipo, tipo_ecf, encf, estado)
values
  ('131488791', 'factura', '31', 'E310000000001', 'pendiente'),
  ('130893489', 'factura', '31', 'E310000000001', 'pendiente');

select is(
  (select count(*)::int from public.ecf_envios where encf = 'E310000000001'),
  2,
  'el mismo e-NCF puede existir una vez por cada RNC emisor'
);

insert into public.ecf_envios (rnc_emisor, documento_tipo, tipo_ecf, encf, ambiente, estado)
values ('131488791', 'factura', '31', 'E310000000001', 'certecf', 'pendiente');

select is(
  (select count(*)::int from public.ecf_envios where encf = 'E310000000001'),
  3,
  'la unicidad de envíos separa además los ambientes testecf y certecf'
);

select throws_ok(
  $q$insert into public.ecf_envios (rnc_emisor, documento_tipo, tipo_ecf, encf, ambiente, estado)
     values ('131488791', 'factura', '31', 'E310000000001', 'testecf', 'pendiente')$q$,
  '23505',
  null,
  'ecf_envios impide duplicar el mismo RNC, ambiente y e-NCF'
);

insert into public.ecf_recibidos (rnc_receptor, rnc_emisor, razon_social_emisor, tipo_ecf, encf, xml_original)
values
  ('131488791', '131999999', 'PROVEEDOR DE PRUEBA SRL', '31', 'E310000000101', '<ECF/>'),
  ('130893489', '131999999', 'PROVEEDOR DE PRUEBA SRL', '31', 'E310000000101', '<ECF/>');

select is(
  (select count(*)::int from public.ecf_recibidos where encf = 'E310000000101'),
  2,
  'el mismo comprobante de un proveedor puede recibirse en cada RNC receptor'
);

select throws_ok(
  $q$insert into public.ecf_recibidos (rnc_receptor, rnc_emisor, razon_social_emisor, tipo_ecf, encf, xml_original)
     values ('131488791', '131999999', 'PROVEEDOR DE PRUEBA SRL', '31', 'E310000000101', '<ECF/>')$q$,
  '23505',
  null,
  'ecf_recibidos impide duplicados cuando el proveedor reintenta'
);

-- ---------------------------------------------------------------------------
-- RLS en ejecución: admin
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  (select count(rnc)::int from public.ecf_config where rnc in ('131488791', '130893489')),
  2,
  'admin lee los metadatos de ambos RNC'
);

insert into public.ecf_config (rnc, razon_social, cert_cifrado, cert_pass_cifrada)
values ('132000000', 'CONFIG TEMPORAL ECF', 'cifrado-de-prueba', 'pass-cifrada-de-prueba');

select ok(
  exists (select 1 from public.ecf_config where rnc = '132000000'),
  'admin puede insertar configuración e-CF'
);

update public.ecf_config set ambiente = 'certecf' where rnc = '132000000';

select is(
  (select ambiente from public.ecf_config where rnc = '132000000'),
  'certecf',
  'admin puede actualizar configuración e-CF'
);

delete from public.ecf_config where rnc = '132000000';

select ok(
  not exists (select 1 from public.ecf_config where rnc = '132000000'),
  'admin puede borrar configuración e-CF'
);

select throws_ok(
  $q$select cert_cifrado from public.ecf_config limit 1$q$,
  '42501',
  null,
  'ni admin puede seleccionar directo el certificado cifrado'
);

-- ---------------------------------------------------------------------------
-- RLS en ejecución: contador
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(rnc)::int from public.ecf_config where rnc in ('131488791', '130893489')),
  2,
  'contador lee los metadatos de ambos RNC'
);

select throws_ok(
  $q$insert into public.ecf_config (rnc, razon_social) values ('132000001', 'CONFIG SIN PERMISO')$q$,
  '42501',
  null,
  'contador no puede insertar configuración e-CF'
);

insert into public.ecf_envios (rnc_emisor, documento_tipo, tipo_ecf, encf, ambiente, estado)
values ('131488791', 'prueba', '31', 'E310000000002', 'testecf', 'pendiente');

select ok(
  exists (select 1 from public.ecf_envios where encf = 'E310000000002'),
  'contador puede insertar trazabilidad de envíos'
);

update public.ecf_envios set estado = 'en_proceso' where encf = 'E310000000002';

select is(
  (select estado from public.ecf_envios where encf = 'E310000000002'),
  'en_proceso',
  'contador puede actualizar el estado de un envío'
);

insert into public.ecf_recibidos (rnc_receptor, rnc_emisor, razon_social_emisor, tipo_ecf, encf, xml_original)
values ('131488791', '131999999', 'PROVEEDOR DE PRUEBA SRL', '31', 'E310000000102', '<ECF/>');

select ok(
  exists (select 1 from public.ecf_recibidos where encf = 'E310000000102'),
  'contador puede insertar comprobantes recibidos'
);

update public.ecf_recibidos set estado_acecf = 'aprobado' where encf = 'E310000000102';

select is(
  (select estado_acecf from public.ecf_recibidos where encf = 'E310000000102'),
  'aprobado',
  'contador puede actualizar la aprobación comercial'
);

-- ---------------------------------------------------------------------------
-- RLS en ejecución: lector
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select is(
  (select count(rnc)::int from public.ecf_config where rnc in ('131488791', '130893489')),
  0,
  'lector no lee ni los metadatos de ecf_config'
);

select ok(
  (select count(*) from public.ecf_envios) > 0,
  'lector sí puede consultar la trazabilidad de envíos'
);

select ok(
  (select count(*) from public.ecf_recibidos) > 0,
  'lector sí puede consultar la bandeja de recibidos'
);

select throws_ok(
  $q$insert into public.ecf_envios (rnc_emisor, documento_tipo, tipo_ecf, encf, estado)
     values ('131488791', 'prueba', '31', 'E310000000003', 'pendiente')$q$,
  '42501',
  null,
  'lector no puede insertar envíos'
);

select throws_ok(
  $q$insert into public.ecf_recibidos (rnc_receptor, rnc_emisor, razon_social_emisor, tipo_ecf, encf, xml_original)
     values ('131488791', '131999999', 'PROVEEDOR DE PRUEBA SRL', '31', 'E310000000103', '<ECF/>')$q$,
  '42501',
  null,
  'lector no puede insertar recibidos'
);

-- ---------------------------------------------------------------------------
-- RLS en ejecución: anon no ve nada
-- ---------------------------------------------------------------------------

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $q$select count(rnc) from public.ecf_config$q$,
  '42501',
  null,
  'anon no puede leer ecf_config'
);

select throws_ok(
  $q$select count(*) from public.ecf_envios$q$,
  '42501',
  null,
  'anon no puede leer ecf_envios'
);

select throws_ok(
  $q$select count(*) from public.ecf_recibidos$q$,
  '42501',
  null,
  'anon no puede leer ecf_recibidos'
);

reset role;
select * from finish();
rollback;

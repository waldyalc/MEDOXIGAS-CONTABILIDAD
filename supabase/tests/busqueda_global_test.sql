-- ---------------------------------------------------------------------------
-- Búsqueda global · pgTAP (docs/busqueda-global.md §3.10)
--
-- Pruebas de la RPC public.buscar_global (migración 20261118100000):
--   1.  anon recibe 42501; authenticated con rol recibe JSON.
--   2.  Encuentra una factura por NCF exacto y por número exacto.
--   3.  Encuentra facturas por el nombre del cliente (el join).
--   4.  #1258 busca número; B0100000123 busca NCF; 101123456 busca RNC
--       (no se cruzan).
--   5.  desde/hasta de octubre ordenan primero las de octubre y no
--       esconden las demás.
--   6.  monto ordena por cercanía.
--   7.  "Peña" encuentra "PENA" y "peña" (unaccent).
--   8.  limite=4 respeta el tope; el tope duro es 200; desplazamiento
--       no repite filas.
--   9.  Un término de 1 carácter devuelve vacío.
--   10. Ninguna fila se repite (entidad, id único).
--   11. Una factura anulada aparece con su estado.
--
-- Los datos se insertan directo (sin RPC) con números y NCF fijos para
-- controlar exactamente qué debe coincidir; todo va en rollback.
-- ---------------------------------------------------------------------------

begin;
select plan(32);

-- ---------------------------------------------------------------------------
-- Datos de prueba (como superusuario, antes de tomar un rol)
-- ---------------------------------------------------------------------------

create temp table _ids (clave text primary key, id uuid) on commit drop;
create temp table _res (clave text primary key, res jsonb) on commit drop;
grant select on _ids to authenticated;
grant select, insert on _res to authenticated;

-- Vista auxiliar: una fila por resultado, con el orden original del grupo.
create temp view _filas_res as
select r.clave,
       g.grupo->>'entidad' as entidad,
       (g.grupo->>'total')::int as total_grupo,
       x.orden,
       x.valor as resultado
from _res r
cross join lateral jsonb_array_elements(r.res->'grupos') with ordinality as g(grupo, gorden)
cross join lateral jsonb_array_elements(g.grupo->'resultados') with ordinality as x(valor, orden);
grant select on _filas_res to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector@prueba.local'),
  ('44444444-4444-4444-4444-444444444444', 'sinperfil@prueba.local');
insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin'),
  ('33333333-3333-3333-3333-333333333333', 'Lector', 'lector');
-- El usuario 44... NO tiene fila en perfiles: el guard lo debe rechazar.

insert into public.contactos (tipo, nombre, rnc_cedula) values
  ('cliente', 'ZZQ Cliente Uno', '101123456'),
  ('cliente', 'PENA GARCIA', null),
  ('cliente', 'peña jimenez', null);

insert into _ids (clave, id)
select 'cliente', id from public.contactos where nombre = 'ZZQ Cliente Uno';

insert into public.facturas (numero, tipo_comprobante, ncf, contacto_id, fecha, vencimiento, total, estado) values
  (1258, '02', 'B0100000123', (select id from _ids where clave = 'cliente'), date '2026-11-05', date '2026-12-31', 4700.00, 'abierta'),
  (1259, '02', 'B0100000124', (select id from _ids where clave = 'cliente'), date '2026-10-12', date '2026-12-31', 4550.00, 'abierta'),
  (1260, '02', 'B0100000125', (select id from _ids where clave = 'cliente'), date '2026-10-03', date '2026-12-31', 4500.00, 'abierta'),
  (1261, '02', 'B0100000126', (select id from _ids where clave = 'cliente'), date '2026-09-28', date '2026-12-31', 4600.00, 'abierta'),
  (1262, '02', 'B0100000127', (select id from _ids where clave = 'cliente'), date '2026-08-15', date '2026-12-31', 5000.00, 'anulada');

insert into _ids (clave, id)
select 'f_nov', id from public.facturas where ncf = 'B0100000123';
insert into _ids (clave, id)
select 'f_anulada', id from public.facturas where ncf = 'B0100000127';

-- 205 gastos para probar el tope duro de 200 y el desplazamiento.
insert into public.gastos_menores (descripcion, fecha)
select 'ZZQ Gasto Masivo ' || g, date '2026-10-01'
from generate_series(1, 205) g;

-- ---------------------------------------------------------------------------
-- Prueba 1 · roles y permisos
-- ---------------------------------------------------------------------------

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$select public.buscar_global('{"texto":"zzq"}'::jsonb)$$,
  '42501', null,
  'Prueba 1: anon recibe 42501'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select throws_ok(
  $$select public.buscar_global('{"texto":"zzq"}'::jsonb)$$,
  '42501', null,
  'Prueba 1: authenticated sin perfil recibe 42501 (guard)'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _res (clave, res) values
  ('admin', public.buscar_global(jsonb_build_object('texto', 'zzq'))),
  ('ncf', public.buscar_global(jsonb_build_object('ncf', 'B0100000123'))),
  ('numero', public.buscar_global(jsonb_build_object('numero', 1258))),
  ('rnc', public.buscar_global(jsonb_build_object('identificacion', '101123456'))),
  ('nombre_cliente', public.buscar_global(jsonb_build_object('texto', 'zzq cliente uno', 'limite', 200))),
  ('fecha', public.buscar_global(jsonb_build_object(
    'texto', 'zzq cliente uno', 'desde', '2026-10-01', 'hasta', '2026-10-31', 'limite', 200))),
  ('monto', public.buscar_global(jsonb_build_object('texto', 'zzq cliente uno', 'monto', 4500, 'limite', 200))),
  ('pena', public.buscar_global(jsonb_build_object('texto', 'Peña'))),
  ('corto', public.buscar_global(jsonb_build_object('texto', 'x'))),
  ('amplio', public.buscar_global(jsonb_build_object('texto', 'zzq', 'limite', 200))),
  ('exacto_y_texto', public.buscar_global(jsonb_build_object(
    'texto', 'zzq cliente uno', 'ncf', 'B0100000123', 'limite', 200))),
  ('sin_anulados', public.buscar_global(jsonb_build_object(
    'texto', 'zzq cliente uno', 'incluir_anulados', false, 'limite', 200))),
  ('tope4', public.buscar_global(jsonb_build_object('texto', 'zzq cliente uno', 'limite', 4))),
  ('gastos_p1', public.buscar_global(jsonb_build_object(
    'entidad', 'gasto_menor', 'texto', 'zzq gasto masivo', 'limite', 200))),
  ('gastos_p2', public.buscar_global(jsonb_build_object(
    'entidad', 'gasto_menor', 'texto', 'zzq gasto masivo', 'limite', 200, 'desplazamiento', 200)));

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

insert into _res (clave, res) values
  ('lector', public.buscar_global(jsonb_build_object('texto', 'zzq')));

select is(
  (select jsonb_typeof(res)::text from _res where clave = 'admin'),
  'object',
  'Prueba 1: authenticated con rol (admin) recibe un JSON'
);

select is(
  (select jsonb_typeof(res)::text from _res where clave = 'lector'),
  'object',
  'Prueba 1: lector también busca (los tres roles leen igual)'
);

select ok(
  (select res ? 'grupos' and res ? 'total' and res ? 'hayMas' and res ? 'ms'
   from _res where clave = 'admin'),
  'Prueba 1: la respuesta trae grupos, total, hayMas y ms'
);

-- ---------------------------------------------------------------------------
-- Prueba 2 · exactos por NCF y por número
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int
   from _filas_res
   where clave = 'ncf' and entidad = 'factura'
     and resultado->>'id' = (select id::text from _ids where clave = 'f_nov')),
  1,
  'Prueba 2: encuentra la factura por NCF exacto'
);

select is(
  (select count(*)::int
   from _filas_res
   where clave = 'numero' and entidad = 'factura'
     and resultado->>'id' = (select id::text from _ids where clave = 'f_nov')),
  1,
  'Prueba 2: encuentra la factura por número exacto'
);

-- ---------------------------------------------------------------------------
-- Prueba 3 · por el nombre del cliente (el join)
-- ---------------------------------------------------------------------------

select is(
  (select distinct total_grupo from _filas_res where clave = 'nombre_cliente' and entidad = 'factura'),
  5,
  'Prueba 3: encuentra las 5 facturas por el nombre del cliente (join)'
);

-- ---------------------------------------------------------------------------
-- Prueba 4 · número, NCF y RNC no se cruzan
-- ---------------------------------------------------------------------------

select is(
  (select res->>'total' from _res where clave = 'numero'),
  '1',
  'Prueba 4: #1258 busca el número y solo eso'
);

select ok(
  (select not exists (select 1 from _filas_res where clave = 'numero' and entidad = 'contacto')),
  'Prueba 4: el número no cruza a contactos'
);

select is(
  (select res->>'total' from _res where clave = 'ncf'),
  '1',
  'Prueba 4: B0100000123 busca el NCF y solo eso'
);

select ok(
  (select not exists (select 1 from _filas_res where clave = 'ncf' and entidad = 'contacto')),
  'Prueba 4: el NCF no cruza a contactos'
);

select is(
  (select resultado->>'rango'
   from _filas_res
   where clave = 'rnc' and entidad = 'contacto'
   limit 1),
  '1',
  'Prueba 4: el RNC encuentra el contacto como coincidencia exacta'
);

select ok(
  (select exists (select 1 from _filas_res where clave = 'rnc' and entidad = 'factura')),
  'Prueba 4: el RNC también trae las facturas del cliente (relación, rango 5)'
);

-- ---------------------------------------------------------------------------
-- Prueba 5 · desde/hasta ordenan, no esconden
-- ---------------------------------------------------------------------------

select is(
  (select string_agg(fr.resultado->>'fecha', ',' order by fr.orden)
   from _filas_res fr
   where fr.clave = 'fecha' and fr.entidad = 'factura'),
  '2026-10-12,2026-10-03,2026-11-05,2026-09-28,2026-08-15',
  'Prueba 5: octubre primero (en_rango) y el resto después, sin esconder'
);

select is(
  (select distinct total_grupo from _filas_res where clave = 'fecha' and entidad = 'factura'),
  5,
  'Prueba 5: en modo todos las 5 facturas siguen contando'
);

-- ---------------------------------------------------------------------------
-- Prueba 6 · monto ordena por cercanía
-- ---------------------------------------------------------------------------

select is(
  (select string_agg(fr.resultado->>'monto', ',' order by fr.orden)
   from _filas_res fr
   where fr.clave = 'monto' and fr.entidad = 'factura'),
  '4500.00,4550.00,4600.00,4700.00,5000.00',
  'Prueba 6: monto 4500 ordena por cercanía (4500, 4550, 4600, 4700, 5000)'
);

-- ---------------------------------------------------------------------------
-- Prueba 7 · unaccent: Peña = PENA = peña
-- ---------------------------------------------------------------------------

select ok(
  (select exists (
    select 1 from _filas_res
    where clave = 'pena' and resultado->>'titulo' = 'PENA GARCIA')),
  'Prueba 7: "Peña" encuentra "PENA GARCIA"'
);

select ok(
  (select exists (
    select 1 from _filas_res
    where clave = 'pena' and resultado->>'titulo' = 'peña jimenez')),
  'Prueba 7: "Peña" encuentra "peña jimenez"'
);

-- ---------------------------------------------------------------------------
-- Prueba 8 · límites y desplazamiento
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from _filas_res where clave = 'tope4' and entidad = 'factura'),
  4,
  'Prueba 8: limite=4 respeta el tope por grupo (hay 5 facturas)'
);

select is(
  (select count(*)::int from _filas_res where clave = 'gastos_p1'),
  200,
  'Prueba 8: el tope duro por categoría son 200 (hay 205 gastos)'
);

select is(
  (select res->>'hayMas' from _res where clave = 'gastos_p1'),
  'true',
  'Prueba 8: hayMas avisa que quedan filas por ver'
);

select is(
  (select count(*)::int from _filas_res where clave = 'gastos_p2'),
  5,
  'Prueba 8: desplazamiento=200 trae solo las 5 restantes'
);

select is(
  (select count(*)::int
   from _filas_res a
   join _filas_res b
     on b.clave = 'gastos_p2' and a.resultado->>'id' = b.resultado->>'id'
   where a.clave = 'gastos_p1'),
  0,
  'Prueba 8: desplazamiento no repite filas'
);

-- ---------------------------------------------------------------------------
-- Prueba 9 · término de 1 carácter
-- ---------------------------------------------------------------------------

select is(
  (select res->>'total' from _res where clave = 'corto'),
  '0',
  'Prueba 9: un término de 1 carácter devuelve total 0'
);

select is(
  (select jsonb_array_length(res->'grupos') from _res where clave = 'corto'),
  0,
  'Prueba 9: un término de 1 carácter no devuelve grupos'
);

-- ---------------------------------------------------------------------------
-- Prueba 10 · ninguna fila se repite
-- ---------------------------------------------------------------------------

select is(
  (select res->>'total' from _res where clave = 'amplio'),
  '207',
  'Prueba 10: total con tope 200+ (1 contacto + 5 facturas + 201 gastos)'
);

select is(
  (select count(*)::int from _filas_res where clave = 'amplio'),
  (select count(distinct entidad || ':' || (resultado->>'id'))::int
   from _filas_res where clave = 'amplio'),
  'Prueba 10: ninguna fila se repite (entidad, id único)'
);

select is(
  (select count(*)::int
   from _filas_res
   where clave = 'exacto_y_texto'
     and resultado->>'id' = (select id::text from _ids where clave = 'f_nov')),
  1,
  'Prueba 10: una fila que coincide por NCF y por cliente sale una sola vez'
);

select is(
  (select resultado->>'rango'
   from _filas_res
   where clave = 'exacto_y_texto'
     and resultado->>'id' = (select id::text from _ids where clave = 'f_nov')
   limit 1),
  '1',
  'Prueba 10: gana el rango del identificador exacto'
);

-- ---------------------------------------------------------------------------
-- Prueba 11 · la factura anulada aparece con su estado
-- ---------------------------------------------------------------------------

select is(
  (select resultado->>'estado'
   from _filas_res
   where clave = 'nombre_cliente' and entidad = 'factura'
     and resultado->>'id' = (select id::text from _ids where clave = 'f_anulada')
   limit 1),
  'anulada',
  'Prueba 11: la factura anulada aparece con su estado'
);

select ok(
  (select not exists (
    select 1 from _filas_res
    where clave = 'sin_anulados'
      and resultado->>'id' = (select id::text from _ids where clave = 'f_anulada'))),
  'Prueba 11: incluir_anulados=false la esconde'
);

select * from finish();
rollback;

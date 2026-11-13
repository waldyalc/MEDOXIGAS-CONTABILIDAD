begin;
select plan(5);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.perfiles'::regclass),
  'RLS activo en perfiles'
);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@prueba.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'lector@prueba.local');
insert into public.perfiles (user_id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin', 'admin'),
  ('00000000-0000-0000-0000-0000000000b2', 'Lector', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';

select is((select count(*)::int from public.perfiles), 1, 'authenticated solo ve su propio perfil');
select is((select rol from public.perfiles), 'lector', 'el perfil visible es el suyo');
select throws_ok(
  $$insert into public.perfiles (user_id, rol) values ('00000000-0000-0000-0000-0000000000b2', 'admin')$$,
  '42501', null, 'authenticated no puede crear perfiles'
);

reset role;
set local role anon;
select throws_ok($$select * from public.perfiles$$, '42501', null, 'anon no lee perfiles');

select * from finish();
rollback;

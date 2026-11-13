begin;
select plan(21);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector@prueba.local');
insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin'),
  ('33333333-3333-3333-3333-333333333333', 'Lector', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select ok(
  public.crear_cuenta(jsonb_build_object(
    'codigo', '1201',
    'nombre', 'Caja sucursal',
    'tipo', 'activo',
    'naturaleza', 'debito',
    'padre_id', (select id from public.cuentas where codigo = '11'),
    'es_caja_banco', true
  )) is not null,
  'admin crea la cuenta 1201 y recibe su id'
);

select is(
  (select c.tipo || '/' || c.naturaleza || '/' || p.codigo
   from public.cuentas c
   join public.cuentas p on p.id = c.padre_id
   where c.codigo = '1201'),
  'activo/debito/11',
  'la cuenta 1201 tiene tipo activo, naturaleza débito y padre 11'
);

select is(
  (select nombre from public.cuentas where codigo = '1201'),
  'Caja sucursal',
  'el nombre de la cuenta se guarda'
);

select ok(
  (select acepta_movimientos and es_caja_banco and activa
   from public.cuentas where codigo = '1201'),
  '1201 acepta movimientos, es caja/banco y está activa'
);

select is(
  public.actualizar_cuenta(jsonb_build_object(
    'id', (select id from public.cuentas where codigo = '1201'),
    'nombre', 'Caja sucursal norte'
  )),
  (select id from public.cuentas where codigo = '1201'),
  'actualizar_cuenta devuelve el id de la cuenta'
);

select is(
  (select nombre from public.cuentas where codigo = '1201'),
  'Caja sucursal norte',
  'actualizar_cuenta cambia el nombre'
);

select throws_ok(
  format('select public.crear_cuenta(%L::jsonb)', jsonb_build_object(
    'codigo', '1201',
    'nombre', 'Duplicada',
    'tipo', 'activo',
    'naturaleza', 'debito'
  )),
  '23505',
  null,
  'crear con código duplicado falla'
);

select throws_ok(
  format('select public.crear_cuenta(%L::jsonb)', jsonb_build_object(
    'codigo', '1202',
    'nombre', 'Sin padre',
    'tipo', 'activo',
    'naturaleza', 'debito',
    'padre_id', '00000000-0000-0000-0000-000000000000'
  )),
  '22023',
  null,
  'crear con padre inexistente falla'
);

select throws_ok(
  format('select public.crear_cuenta(%L::jsonb)', jsonb_build_object(
    'codigo', '1202',
    'nombre', 'Tipo distinto al padre',
    'tipo', 'pasivo',
    'naturaleza', 'credito',
    'padre_id', (select id from public.cuentas where codigo = '11')
  )),
  '22023',
  null,
  'crear con tipo distinto al padre falla'
);

select throws_ok(
  format('select public.crear_cuenta(%L::jsonb)', jsonb_build_object(
    'codigo', '  ',
    'nombre', 'Sin código',
    'tipo', 'activo',
    'naturaleza', 'debito'
  )),
  '22023',
  null,
  'crear sin código falla'
);

select throws_ok(
  format('select public.crear_cuenta(%L::jsonb)', jsonb_build_object(
    'codigo', '1203',
    'nombre', 'Tipo inválido',
    'tipo', 'otro',
    'naturaleza', 'debito'
  )),
  '22023',
  null,
  'crear con tipo inválido falla'
);

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  format('select public.crear_cuenta(%L::jsonb)', jsonb_build_object(
    'codigo', '1204',
    'nombre', 'No permitida',
    'tipo', 'activo',
    'naturaleza', 'debito'
  )),
  '42501',
  null,
  'lector no puede crear cuentas'
);

select throws_ok(
  format('select public.actualizar_cuenta(%L::jsonb)', jsonb_build_object(
    'id', (select id from public.cuentas where codigo = '1201'),
    'nombre', 'No permitida'
  )),
  '42501',
  null,
  'lector no puede actualizar cuentas'
);

reset role;

insert into public.asientos (fecha, descripcion, origen_tipo, total)
values ('2099-01-01', 'Prueba movimientos cuenta 1201', 'manual', 10.00);

insert into public.asiento_lineas (asiento_id, cuenta_id, descripcion, debito, credito)
select
  a.id,
  c.id,
  'Prueba',
  case when c.codigo = '1201' then 10.00 else 0 end,
  case when c.codigo = '1101' then 10.00 else 0 end
from public.asientos a
join public.cuentas c on c.codigo in ('1201', '1101')
where a.descripcion = 'Prueba movimientos cuenta 1201';

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select ok(
  exists(
    select 1
    from public.asiento_lineas l
    join public.cuentas c on c.id = l.cuenta_id
    where c.codigo = '1201'
  ),
  'la cuenta 1201 queda con movimientos'
);

select throws_ok(
  format('select public.actualizar_cuenta(%L::jsonb)', jsonb_build_object(
    'id', (select id from public.cuentas where codigo = '1201'),
    'codigo', '1299'
  )),
  '22023',
  null,
  'no se cambia el código de una cuenta con movimientos'
);

select throws_ok(
  format('select public.actualizar_cuenta(%L::jsonb)', jsonb_build_object(
    'id', (select id from public.cuentas where codigo = '1201'),
    'tipo', 'gasto'
  )),
  '22023',
  null,
  'no se cambia el tipo de una cuenta con movimientos'
);

select is(
  public.actualizar_cuenta(jsonb_build_object(
    'id', (select id from public.cuentas where codigo = '1201'),
    'nombre', 'Caja sucursal actualizada'
  )),
  (select id from public.cuentas where codigo = '1201'),
  'con movimientos todavía se puede actualizar'
);

select is(
  (select nombre from public.cuentas where codigo = '1201'),
  'Caja sucursal actualizada',
  'el nombre sí cambia aunque haya movimientos'
);

select is(
  (select count(*)::int
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'borrar_cuenta'),
  0,
  'no existe la función borrar_cuenta'
);

select is(
  (select count(*)::int
   from pg_policies
   where schemaname = 'public' and tablename = 'cuentas' and cmd = 'DELETE'),
  0,
  'cuentas no tiene política de borrado'
);

select throws_ok(
  $$delete from public.cuentas where codigo = '1201'$$,
  '42501',
  null,
  'authenticated no puede borrar cuentas directamente'
);

select * from finish();
rollback;

begin;
select plan(14);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local');
insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select ok(
  public.crear_cuenta(jsonb_build_object(
    'codigo', '1251',
    'nombre', 'Agrupadora de prueba',
    'tipo', 'activo',
    'naturaleza', 'debito'
  )) is not null,
  'se crea la cuenta agrupadora 1251'
);

select ok(
  public.crear_cuenta(jsonb_build_object(
    'codigo', '125101',
    'nombre', 'Subcuenta de prueba',
    'tipo', 'activo',
    'naturaleza', 'debito',
    'padre_id', (select id from public.cuentas where codigo = '1251')
  )) is not null,
  'se crea la subcuenta 125101 bajo 1251'
);

select throws_ok(
  format('select public.actualizar_cuenta(%L::jsonb)', jsonb_build_object(
    'id', (select id from public.cuentas where codigo = '1251'),
    'tipo', 'gasto'
  )),
  '22023',
  null,
  'no se cambia el tipo de una cuenta agrupadora con subcuentas de otro tipo'
);

select is(
  (select tipo from public.cuentas where codigo = '1251'),
  'activo',
  'la cuenta agrupadora conserva su tipo'
);

select is(
  (select tipo from public.cuentas where codigo = '125101'),
  'activo',
  'la subcuenta conserva su tipo'
);

select ok(
  public.crear_cuenta(jsonb_build_object(
    'codigo', '1252',
    'nombre', 'Cuenta con movimientos',
    'tipo', 'activo',
    'naturaleza', 'debito'
  )) is not null,
  'se crea la cuenta 1252 para probar la bandera con movimientos'
);

select ok(
  public.crear_cuenta(jsonb_build_object(
    'codigo', '1253',
    'nombre', 'Cuenta sin movimientos',
    'tipo', 'activo',
    'naturaleza', 'debito'
  )) is not null,
  'se crea la cuenta 1253 sin movimientos'
);

reset role;

insert into public.asientos (fecha, descripcion, origen_tipo, total)
values ('2099-01-01', 'Prueba movimientos cuenta 1252', 'manual', 25.00);

insert into public.asiento_lineas (asiento_id, cuenta_id, descripcion, debito, credito)
select
  a.id,
  c.id,
  'Prueba',
  case when c.codigo = '1252' then 25.00 else 0 end,
  case when c.codigo = '1101' then 25.00 else 0 end
from public.asientos a
join public.cuentas c on c.codigo in ('1252', '1101')
where a.descripcion = 'Prueba movimientos cuenta 1252';

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select ok(
  exists(
    select 1
    from public.asiento_lineas l
    join public.cuentas c on c.id = l.cuenta_id
    where c.codigo = '1252'
  ),
  'la cuenta 1252 queda con movimientos'
);

select throws_ok(
  format('select public.actualizar_cuenta(%L::jsonb)', jsonb_build_object(
    'id', (select id from public.cuentas where codigo = '1252'),
    'acepta_movimientos', false
  )),
  '22023',
  null,
  'no se deja de aceptar movimientos en una cuenta que ya tiene líneas'
);

select ok(
  (select acepta_movimientos from public.cuentas where codigo = '1252'),
  'la cuenta con movimientos sigue aceptando movimientos'
);

select is(
  public.actualizar_cuenta(jsonb_build_object(
    'id', (select id from public.cuentas where codigo = '1252'),
    'nombre', 'Cuenta con movimientos renombrada'
  )),
  (select id from public.cuentas where codigo = '1252'),
  'con movimientos todavía se puede renombrar la cuenta'
);

select is(
  public.actualizar_cuenta(jsonb_build_object(
    'id', (select id from public.cuentas where codigo = '1252'),
    'acepta_movimientos', true
  )),
  (select id from public.cuentas where codigo = '1252'),
  'reenviar acepta_movimientos = true en una cuenta con movimientos no falla'
);

select is(
  public.actualizar_cuenta(jsonb_build_object(
    'id', (select id from public.cuentas where codigo = '1253'),
    'acepta_movimientos', false
  )),
  (select id from public.cuentas where codigo = '1253'),
  'una cuenta sin movimientos sí puede dejar de aceptar movimientos'
);

select is(
  public.actualizar_cuenta(jsonb_build_object(
    'id', (select id from public.cuentas where codigo = '1253'),
    'tipo', 'gasto'
  )),
  (select id from public.cuentas where codigo = '1253'),
  'una cuenta sin movimientos ni hijas sí puede cambiar de tipo'
);

select * from finish();
rollback;

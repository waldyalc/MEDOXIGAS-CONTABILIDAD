begin;
select plan(8);

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local');
insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id)
select 'cuenta_gasto', c.id from public.cuentas c where c.codigo = '6105';

insert into _ids (clave, id)
select 'cuenta_pago', cc.cuenta_id from public.config_contable cc where cc.clave = 'caja_chica';

insert into _ids (clave, id)
select 'gasto', public.crear_gasto_menor(jsonb_build_object(
  'fecha', '2026-11-24',
  'descripcion', 'Gasto para prefijos Sin NCF',
  'subtotal', 50.00::numeric,
  'itbis_tasa', 0::numeric,
  'cuenta_gasto_id', (select id from _ids where clave = 'cuenta_gasto'),
  'cuenta_pago_id', (select id from _ids where clave = 'cuenta_pago')
));

select is(
  (select ncf from public.gastos_menores where id = (select id from _ids where clave = 'gasto')),
  'B1300000001',
  'el gasto menor emite B1300000001'
);

insert into _ids (clave, id)
select 'num_b1', public.crear_numeracion(jsonb_build_object(
  'tipo_comprobante', '00',
  'nombre', 'Sin NCF prefijo B1',
  'prefijo', 'B1',
  'siguiente', 7
));

select is(
  (select prefijo from public.numeraciones where id = (select id from _ids where clave = 'num_b1')),
  'B1',
  'la serie Sin NCF queda con prefijo B1'
);

select lives_ok(
  format('select public.actualizar_numeracion(%L::jsonb)', jsonb_build_object(
    'id', (select id from _ids where clave = 'num_b1'),
    'siguiente', 1
  )),
  'editar la serie Sin NCF B1 no cruza con el gasto B1300000001'
);

select is(
  (select siguiente from public.numeraciones where id = (select id from _ids where clave = 'num_b1')),
  1,
  'la serie Sin NCF B1 guarda el siguiente indicado'
);

insert into _ids (clave, id)
select 'num_b', public.crear_numeracion(jsonb_build_object(
  'tipo_comprobante', '00',
  'nombre', 'Sin NCF prefijo B',
  'prefijo', 'B',
  'siguiente', 9
));

select lives_ok(
  format('select public.actualizar_numeracion(%L::jsonb)', jsonb_build_object(
    'id', (select id from _ids where clave = 'num_b'),
    'siguiente', 1
  )),
  'editar la serie Sin NCF B no cruza con los NCF B13'
);

select is(
  (select siguiente from public.numeraciones where id = (select id from _ids where clave = 'num_b')),
  1,
  'la serie Sin NCF B guarda el siguiente indicado'
);

insert into _ids (clave, id)
select 'num13', n.id from public.numeraciones n
where n.tipo_comprobante = '13' order by n.id limit 1;

select throws_ok(
  format('select public.actualizar_numeracion(%L::jsonb)', jsonb_build_object(
    'id', (select id from _ids where clave = 'num13'),
    'siguiente', 1
  )),
  '22023',
  null,
  'la serie 13 sí sigue bloqueada por debajo del último B13 emitido'
);

select is(
  public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num13'),
    'siguiente', 2
  )),
  (select id from _ids where clave = 'num13'),
  'la serie 13 acepta el siguiente después del último B13'
);

select * from finish();
rollback;

begin;
select plan(9);

insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'admin.manual@prueba.local'),
  ('55555555-5555-5555-5555-555555555555', 'contador.manual@prueba.local'),
  ('66666666-6666-6666-6666-666666666666', 'lector.manual@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('44444444-4444-4444-4444-444444444444', 'Admin manual', 'admin'),
  ('55555555-5555-5555-5555-555555555555', 'Contador manual', 'contador'),
  ('66666666-6666-6666-6666-666666666666', 'Lector manual', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select ok(
  public.crear_asiento_manual(
    jsonb_build_object(
      'fecha', '2026-11-13',
      'descripcion', 'Asiento manual pgTAP',
      'lineas', jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', (select id from public.cuentas where codigo = '1101'),
          'debito', 100,
          'credito', 0
        ),
        jsonb_build_object(
          'cuenta_id', (select id from public.cuentas where codigo = '3101'),
          'debito', 0,
          'credito', 100
        )
      )
    )
  ) is not null,
  'crear_asiento_manual devuelve el id del asiento'
);

select is(
  (select a.origen_tipo from public.asientos a where a.descripcion = 'Asiento manual pgTAP'),
  'manual',
  'el asiento queda con origen_tipo manual'
);

select is(
  (select a.total from public.asientos a where a.descripcion = 'Asiento manual pgTAP'),
  100.00::numeric,
  'el total del asiento manual es 100.00'
);

select is(
  (select count(*)::int
   from public.asientos a
   join public.asiento_lineas al on al.asiento_id = a.id
   where a.descripcion = 'Asiento manual pgTAP'),
  2,
  'el asiento manual tiene 2 líneas'
);

select is(
  (select sum(al.debito)
   from public.asientos a
   join public.asiento_lineas al on al.asiento_id = a.id
   join public.cuentas c on c.id = al.cuenta_id
   where a.descripcion = 'Asiento manual pgTAP' and c.codigo = '1101'),
  100.00::numeric,
  'el asiento debita 100.00 en la cuenta 1101'
);

select is(
  (select sum(al.credito)
   from public.asientos a
   join public.asiento_lineas al on al.asiento_id = a.id
   join public.cuentas c on c.id = al.cuenta_id
   where a.descripcion = 'Asiento manual pgTAP' and c.codigo = '3101'),
  100.00::numeric,
  'el asiento acredita 100.00 en la cuenta 3101'
);

select throws_ok(
  format(
    'select public.crear_asiento_manual(%L::jsonb)',
    jsonb_build_object(
      'fecha', '2026-11-13',
      'descripcion', 'Asiento manual descuadrado pgTAP',
      'lineas', jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', (select id from public.cuentas where codigo = '1101'),
          'debito', 100,
          'credito', 0
        ),
        jsonb_build_object(
          'cuenta_id', (select id from public.cuentas where codigo = '3101'),
          'debito', 0,
          'credito', 80
        )
      )
    )::text
  ),
  '23514',
  null,
  'rechaza un asiento con débitos distintos a los créditos'
);

select throws_ok(
  format(
    'select public.crear_asiento_manual(%L::jsonb)',
    jsonb_build_object(
      'fecha', '2026-11-13',
      'descripcion', 'Asiento manual cuenta padre pgTAP',
      'lineas', jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', (select id from public.cuentas where codigo = '1'),
          'debito', 100,
          'credito', 0
        ),
        jsonb_build_object(
          'cuenta_id', (select id from public.cuentas where codigo = '3101'),
          'debito', 0,
          'credito', 100
        )
      )
    )::text
  ),
  '23514',
  null,
  'rechaza una cuenta padre que no acepta movimientos'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';

select throws_ok(
  format(
    'select public.crear_asiento_manual(%L::jsonb)',
    jsonb_build_object(
      'fecha', '2026-11-13',
      'descripcion', 'Asiento manual lector pgTAP',
      'lineas', jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', (select id from public.cuentas where codigo = '1101'),
          'debito', 100,
          'credito', 0
        ),
        jsonb_build_object(
          'cuenta_id', (select id from public.cuentas where codigo = '3101'),
          'debito', 0,
          'credito', 100
        )
      )
    )::text
  ),
  '42501',
  null,
  'lector no puede crear asientos manuales'
);

select * from finish();
rollback;

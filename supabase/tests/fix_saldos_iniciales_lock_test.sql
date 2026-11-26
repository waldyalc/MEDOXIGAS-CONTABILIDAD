begin;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local');
insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin');

select ok(
  (select p.prosrc like '%pg_advisory_xact_lock%'
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'registrar_saldos_iniciales'),
  'registrar_saldos_iniciales toma un advisory lock de transacción'
);

select ok(
  (select p.prosrc like '%''saldos_iniciales''%'
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'registrar_saldos_iniciales'),
  'el lock usa la clave saldos_iniciales'
);

select ok(
  (select position('pg_advisory_xact_lock' in p.prosrc) > 0
      and position('pg_advisory_xact_lock' in p.prosrc)
        < position('ya tiene un saldo inicial registrado' in p.prosrc)
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'registrar_saldos_iniciales'),
  'el lock se toma antes del chequeo de saldo ya registrado'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select ok(
  public.registrar_saldos_iniciales(jsonb_build_object(
    'fecha', '2026-01-15',
    'lineas', jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', (select c.id from public.cuentas c where c.codigo = '1104'),
        'debito', 100.00,
        'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', (select c.cuenta_id from public.config_contable c where c.clave = 'ajustes_iniciales'),
        'debito', 0,
        'credito', 100.00
      )
    )
  )) is not null,
  'se registra el primer saldo inicial'
);

select throws_ok(
  format(
    'select public.registrar_saldos_iniciales(%L::jsonb)',
    jsonb_build_object(
      'lineas', jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', (select c.id from public.cuentas c where c.codigo = '1104'),
          'debito', 100.00, 'credito', 0
        ),
        jsonb_build_object(
          'cuenta_id', (select c.cuenta_id from public.config_contable c where c.clave = 'ajustes_iniciales'),
          'debito', 0, 'credito', 100.00
        )
      )
    )::text
  ),
  '23514',
  null,
  'la misma cuenta no admite un segundo saldo inicial'
);

select is(
  (select count(*)::int from public.asientos a where a.origen_tipo = 'saldo_inicial'),
  1,
  'el intento duplicado no deja asientos extra'
);

select ok(
  public.registrar_saldos_iniciales(jsonb_build_object(
    'lineas', jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', (select c.id from public.cuentas c where c.codigo = '1105'),
        'debito', 50.00,
        'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', (select c.cuenta_id from public.config_contable c where c.clave = 'ajustes_iniciales'),
        'debito', 0,
        'credito', 50.00
      )
    )
  )) is not null,
  'otra cuenta sí puede registrar su saldo inicial'
);

select is(
  (select count(*)::int from public.asientos a where a.origen_tipo = 'saldo_inicial'),
  2,
  'cada registro válido crea su propio asiento'
);

select * from finish();
rollback;

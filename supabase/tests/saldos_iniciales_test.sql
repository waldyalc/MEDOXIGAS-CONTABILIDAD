begin;
select plan(24);

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin'),
  ('33333333-3333-3333-3333-333333333333', 'Lector', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id)
select 'ajustes', c.cuenta_id
from public.config_contable c
where c.clave = 'ajustes_iniciales';

select is(
  (select c.nombre from public.cuentas c where c.id = (select id from _ids where clave = 'ajustes')),
  'Ajustes iniciales',
  'la cuenta Ajustes iniciales existe'
);

select ok(
  (select c.tipo = 'capital' and c.naturaleza = 'credito' and c.acepta_movimientos and c.activa
   from public.cuentas c where c.id = (select id from _ids where clave = 'ajustes')),
  'Ajustes iniciales es de patrimonio, crédito, activa y acepta movimientos'
);

select is(
  (select c.padre_id from public.cuentas c where c.id = (select id from _ids where clave = 'ajustes')),
  (select c.id from public.cuentas c where c.codigo = '3'),
  'Ajustes iniciales cuelga de Capital'
);

insert into _ids (clave, id)
select 'asiento_1', public.registrar_saldos_iniciales(jsonb_build_object(
  'fecha', '2026-01-15',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'cuenta_id', (select c.id from public.cuentas c where c.codigo = '1104'),
      'debito', 96900.00,
      'credito', 0
    ),
    jsonb_build_object(
      'cuenta_id', (select c.id from public.cuentas c where c.codigo = '2101'),
      'debito', 0,
      'credito', 50000.00
    ),
    jsonb_build_object(
      'cuenta_id', (select id from _ids where clave = 'ajustes'),
      'debito', 0,
      'credito', 46900.00
    )
  )
));

select is(
  (select a.origen_tipo from public.asientos a where a.id = (select id from _ids where clave = 'asiento_1')),
  'saldo_inicial',
  'el registro genera un asiento con origen_tipo saldo_inicial'
);

select is(
  (select a.fecha from public.asientos a where a.id = (select id from _ids where clave = 'asiento_1')),
  '2026-01-15'::date,
  'el asiento guarda la fecha indicada'
);

select is(
  (select a.descripcion from public.asientos a where a.id = (select id from _ids where clave = 'asiento_1')),
  'Saldos iniciales',
  'la descripción por defecto es Saldos iniciales'
);

select is(
  (select count(*) from public.asiento_lineas l
   where l.asiento_id = (select id from _ids where clave = 'asiento_1')),
  3::bigint,
  'el asiento tiene una línea por cuenta'
);

select is(
  (select sum(l.debito)
   from public.asiento_lineas l
   where l.asiento_id = (select id from _ids where clave = 'asiento_1')
     and l.cuenta_id = (select c.id from public.cuentas c where c.codigo = '1104')),
  96900.00::numeric,
  'el asiento debita 96,900 en Inventario'
);

select is(
  (select sum(l.credito)
   from public.asiento_lineas l
   where l.asiento_id = (select id from _ids where clave = 'asiento_1')
     and l.cuenta_id = (select id from _ids where clave = 'ajustes')),
  46900.00::numeric,
  'la contrapartida acredita 46,900 en Ajustes iniciales'
);

select is(
  (select a.total from public.asientos a where a.id = (select id from _ids where clave = 'asiento_1')),
  96900.00::numeric,
  'el asiento registra el total debitado'
);

insert into _ids (clave, id)
select 'asiento_2', public.registrar_saldos_iniciales(jsonb_build_object(
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'cuenta_id', (select c.id from public.cuentas c where c.codigo = '1105'),
      'debito', 1200.00,
      'credito', 0
    ),
    jsonb_build_object(
      'cuenta_id', (select id from _ids where clave = 'ajustes'),
      'debito', 0,
      'credito', 1200.00
    )
  )
));

select ok(
  (select id from _ids where clave = 'asiento_2') is not null,
  'un segundo registro vuelve a usar Ajustes iniciales como contrapartida'
);

select is(
  (select a.fecha from public.asientos a where a.id = (select id from _ids where clave = 'asiento_2')),
  current_date,
  'sin fecha el asiento usa la de hoy'
);

select is(
  (select count(*) from public.asientos a where a.origen_tipo = 'saldo_inicial'),
  2::bigint,
  'cada guardado crea su propio asiento saldo_inicial'
);

select throws_ok(
  format(
    'select public.registrar_saldos_iniciales(%L::jsonb)',
    jsonb_build_object(
      'lineas', jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', (select c.id from public.cuentas c where c.codigo = '1104'),
          'debito', 1000, 'credito', 0
        ),
        jsonb_build_object(
          'cuenta_id', (select c.id from public.cuentas c where c.codigo = '2101'),
          'debito', 0, 'credito', 1000
        )
      )
    )::text
  ),
  '23514',
  null,
  'una cuenta con saldo inicial ya registrado no admite otra carga'
);

select throws_ok(
  format(
    'select public.registrar_saldos_iniciales(%L::jsonb)',
    jsonb_build_object(
      'lineas', jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', (select c.id from public.cuentas c where c.codigo = '1103'),
          'debito', 5000, 'credito', 0
        ),
        jsonb_build_object(
          'cuenta_id', (select c.id from public.cuentas c where c.codigo = '2101'),
          'debito', 0, 'credito', 4000
        )
      )
    )::text
  ),
  '23514',
  null,
  'un registro descuadrado no se guarda'
);

select throws_ok(
  format(
    'select public.registrar_saldos_iniciales(%L::jsonb)',
    jsonb_build_object(
      'lineas', jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', (select c.id from public.cuentas c where c.codigo = '1103'),
          'debito', -100, 'credito', 0
        ),
        jsonb_build_object(
          'cuenta_id', (select c.id from public.cuentas c where c.codigo = '2101'),
          'debito', 0, 'credito', 0
        )
      )
    )::text
  ),
  '22023',
  null,
  'un monto negativo se rechaza'
);

select throws_ok(
  format(
    'select public.registrar_saldos_iniciales(%L::jsonb)',
    jsonb_build_object(
      'lineas', jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', (select c.id from public.cuentas c where c.codigo = '1103'),
          'debito', 100, 'credito', 100
        )
      )
    )::text
  ),
  '23514',
  null,
  'una línea con débito y crédito se rechaza'
);

select throws_ok(
  format(
    'select public.registrar_saldos_iniciales(%L::jsonb)',
    jsonb_build_object(
      'lineas', jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', (select c.id from public.cuentas c where c.codigo = '1103'),
          'debito', 0, 'credito', 0
        )
      )
    )::text
  ),
  '23514',
  null,
  'una línea sin monto se rechaza'
);

select throws_ok(
  format(
    'select public.registrar_saldos_iniciales(%L::jsonb)',
    jsonb_build_object(
      'lineas', jsonb_build_array(
        jsonb_build_object('cuenta_id', gen_random_uuid(), 'debito', 100, 'credito', 0),
        jsonb_build_object(
          'cuenta_id', (select c.id from public.cuentas c where c.codigo = '2101'),
          'debito', 0, 'credito', 100
        )
      )
    )::text
  ),
  '22023',
  null,
  'una cuenta inexistente se rechaza'
);

select throws_ok(
  format(
    'select public.registrar_saldos_iniciales(%L::jsonb)',
    jsonb_build_object(
      'lineas', jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', (select c.id from public.cuentas c where c.codigo = '1'),
          'debito', 100, 'credito', 0
        ),
        jsonb_build_object(
          'cuenta_id', (select c.id from public.cuentas c where c.codigo = '2101'),
          'debito', 0, 'credito', 100
        )
      )
    )::text
  ),
  '23514',
  null,
  'una cuenta de agrupación no acepta saldo inicial'
);

select throws_ok(
  format(
    'select public.registrar_saldos_iniciales(%L::jsonb)',
    jsonb_build_object(
      'lineas', jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', (select c.id from public.cuentas c where c.codigo = '1101'),
          'debito', 100, 'credito', 0
        ),
        jsonb_build_object(
          'cuenta_id', (select c.id from public.cuentas c where c.codigo = '2101'),
          'debito', 0, 'credito', 100
        )
      )
    )::text
  ),
  '23514',
  null,
  'una cuenta de caja o banco carga su saldo desde Bancos'
);

select throws_ok(
  format(
    'select public.registrar_saldos_iniciales(%L::jsonb)',
    jsonb_build_object(
      'lineas', jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', (select c.id from public.cuentas c where c.codigo = '1103'),
          'debito', 100, 'credito', 0
        ),
        jsonb_build_object(
          'cuenta_id', (select c.id from public.cuentas c where c.codigo = '1103'),
          'debito', 0, 'credito', 100
        )
      )
    )::text
  ),
  '22023',
  null,
  'una cuenta repetida en el registro se rechaza'
);

select throws_ok(
  'select public.registrar_saldos_iniciales(''{"lineas": []}''::jsonb)',
  '22023',
  null,
  'un registro sin líneas se rechaza'
);

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  format(
    'select public.registrar_saldos_iniciales(%L::jsonb)',
    jsonb_build_object(
      'lineas', jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', (select c.id from public.cuentas c where c.codigo = '4101'),
          'debito', 100, 'credito', 0
        ),
        jsonb_build_object(
          'cuenta_id', (select c.id from public.cuentas c where c.codigo = '2101'),
          'debito', 0, 'credito', 100
        )
      )
    )::text
  ),
  '42501',
  null,
  'lector no puede registrar saldos iniciales'
);

select * from finish();
rollback;

begin;
select plan(16);

insert into auth.users (id, email) values
  ('77777777-7777-7777-7777-777777777777', 'admin.tipos@prueba.local'),
  ('88888888-8888-8888-8888-888888888888', 'lector.tipos@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('77777777-7777-7777-7777-777777777777', 'Admin tipos', 'admin'),
  ('88888888-8888-8888-8888-888888888888', 'Lector tipos', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}';

-- Semilla de los 13 tipos de Alegra (ALEGRA.md 11.2)
select is(
  (select count(*)::int from public.tipos_entrada_diario),
  13,
  'la migración siembra los 13 tipos de entrada de diario'
);

select ok(
  (select t.activo and t.siguiente = 1
   from public.tipos_entrada_diario t where t.prefijo = 'AC'),
  'el tipo Ajuste contable (AC) queda activo con el consecutivo en 1'
);

-- Crear un tipo nuevo (el prefijo se normaliza a mayúsculas)
select ok(
  public.crear_tipo_entrada_diario(
    jsonb_build_object('nombre', 'Tipo de prueba', 'prefijo', 'xz')
  ) is not null,
  'crear_tipo_entrada_diario devuelve el id del tipo'
);

select is(
  (select t.prefijo from public.tipos_entrada_diario t where t.nombre = 'Tipo de prueba'),
  'XZ',
  'el prefijo se guarda en mayúsculas'
);

select throws_ok(
  format(
    'select public.crear_tipo_entrada_diario(%L::jsonb)',
    jsonb_build_object('nombre', 'Otro ajuste', 'prefijo', 'AC')::text
  ),
  '22023',
  null,
  'rechaza un prefijo duplicado'
);

select throws_ok(
  format(
    'select public.crear_tipo_entrada_diario(%L::jsonb)',
    jsonb_build_object('nombre', 'Prefijo malo', 'prefijo', '1X')::text
  ),
  '22023',
  null,
  'rechaza un prefijo que no empieza con letra'
);

-- Asiento sin tipo: cae al default 'AC' y toma el código AC-1
select ok(
  public.crear_asiento_manual(
    jsonb_build_object(
      'fecha', '2026-11-18',
      'descripcion', 'Asiento sin tipo pgTAP',
      'lineas', jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', (select id from public.cuentas where codigo = '1101'),
          'debito', 50,
          'credito', 0
        ),
        jsonb_build_object(
          'cuenta_id', (select id from public.cuentas where codigo = '3101'),
          'debito', 0,
          'credito', 50
        )
      )
    )
  ) is not null,
  'crear_asiento_manual sin tipo sigue funcionando'
);

select is(
  (select a.codigo from public.asientos a where a.descripcion = 'Asiento sin tipo pgTAP'),
  'AC-1',
  'el asiento sin tipo toma el código AC-1 del tipo por defecto'
);

select is(
  (select t.siguiente from public.tipos_entrada_diario t where t.prefijo = 'AC'),
  2,
  'el consecutivo de AC sube a 2 tras el asiento'
);

-- Asiento con tipo elegido: usa el prefijo del tipo y su propio consecutivo
select is(
  (select a.codigo
   from public.asientos a
   where a.id = public.crear_asiento_manual(
     jsonb_build_object(
       'fecha', '2026-11-18',
       'descripcion', 'Asiento con tipo pgTAP',
       'tipo_entrada_id', (select id from public.tipos_entrada_diario where prefijo = 'DTB'),
       'lineas', jsonb_build_array(
         jsonb_build_object(
           'cuenta_id', (select id from public.cuentas where codigo = '1101'),
           'debito', 25,
           'credito', 0
         ),
         jsonb_build_object(
           'cuenta_id', (select id from public.cuentas where codigo = '3101'),
           'debito', 0,
           'credito', 25
         )
       )
     )
   )),
  'DTB-1',
  'el asiento con tipo DTB toma el código DTB-1'
);

select is(
  (select a.codigo
   from public.asientos a
   where a.id = public.crear_asiento_manual(
     jsonb_build_object(
       'fecha', '2026-11-18',
       'descripcion', 'Asiento con tipo dos pgTAP',
       'tipo_entrada_id', (select id from public.tipos_entrada_diario where prefijo = 'DTB'),
       'lineas', jsonb_build_array(
         jsonb_build_object(
           'cuenta_id', (select id from public.cuentas where codigo = '1101'),
           'debito', 25,
           'credito', 0
         ),
         jsonb_build_object(
           'cuenta_id', (select id from public.cuentas where codigo = '3101'),
           'debito', 0,
           'credito', 25
         )
       )
     )
   )),
  'DTB-2',
  'el segundo asiento del mismo tipo toma DTB-2'
);

-- Tipo inactivo: no se puede usar ni cambiar su prefijo si ya tiene asientos
select ok(
  public.actualizar_tipo_entrada_diario(
    (select id from public.tipos_entrada_diario where prefijo = 'IMP'),
    jsonb_build_object('activo', false)
  ) is not null,
  'actualizar_tipo_entrada_diario desactiva el tipo'
);

select throws_ok(
  format(
    'select public.crear_asiento_manual(%L::jsonb)',
    jsonb_build_object(
      'fecha', '2026-11-18',
      'descripcion', 'Asiento tipo inactivo pgTAP',
      'tipo_entrada_id', (select id from public.tipos_entrada_diario where prefijo = 'IMP'),
      'lineas', jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', (select id from public.cuentas where codigo = '1101'),
          'debito', 10,
          'credito', 0
        ),
        jsonb_build_object(
          'cuenta_id', (select id from public.cuentas where codigo = '3101'),
          'debito', 0,
          'credito', 10
        )
      )
    )::text
  ),
  '23514',
  null,
  'rechaza un asiento con un tipo inactivo'
);

select throws_ok(
  format(
    'select public.actualizar_tipo_entrada_diario(%L::uuid, %L::jsonb)',
    (select id from public.tipos_entrada_diario where prefijo = 'AC'),
    jsonb_build_object('prefijo', 'AJ')::text
  ),
  '23514',
  null,
  'rechaza cambiar el prefijo de un tipo que ya tiene asientos'
);

-- Permisos: el lector no crea ni edita tipos
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}';

select throws_ok(
  format(
    'select public.crear_tipo_entrada_diario(%L::jsonb)',
    jsonb_build_object('nombre', 'Tipo lector', 'prefijo', 'TL')::text
  ),
  '42501',
  null,
  'lector no puede crear tipos de entrada'
);

reset role;
set local role anon;

select throws_ok(
  'select count(*) from public.tipos_entrada_diario',
  '42501',
  null,
  'anon no lee los tipos de entrada de diario'
);

select * from finish();
rollback;

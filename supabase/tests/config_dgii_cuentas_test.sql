-- Clasificación DGII de cuentas (606: categoría + tipo de compra; 607: tipo de ingreso)
-- y RPC actualizar_clasificacion_dgii. Alegra clasifica por cuenta contable.

begin;
select plan(19);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local'),
  ('22222222-2222-2222-2222-222222222222', 'contador@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector@prueba.local');
insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Contador', 'contador'),
  ('33333333-3333-3333-3333-333333333333', 'Lector', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Semilla por nombre de cuenta
-- ---------------------------------------------------------------------------

select is(
  (select tipo_ingreso from public.cuentas where nombre = 'Ventas de productos'),
  '1',
  'Ventas de productos queda con tipo de ingreso 1 (operaciones)'
);

select is(
  (select tipo_ingreso from public.cuentas where nombre = 'Ventas de servicios'),
  '1',
  'Ventas de servicios queda con tipo de ingreso 1 (operaciones)'
);

select is(
  (select categoria_dgii || '/' || tipo_compra from public.cuentas where nombre = 'Inventario de mercancía'),
  '09/bienes',
  'Inventario de mercancía queda en categoría 09 y tipo de compra bienes'
);

select is(
  (select categoria_dgii || '/' || tipo_compra from public.cuentas where nombre = 'Costo de ventas'),
  '09/bienes',
  'Costo de ventas queda en categoría 09 y tipo de compra bienes'
);

select is(
  (select categoria_dgii || '/' || tipo_compra from public.cuentas where nombre = 'Gastos generales'),
  '02/servicio',
  'Gastos generales queda en categoría 02 y tipo de compra servicio'
);

select ok(
  (select categoria_dgii is null and tipo_compra is null and tipo_ingreso is null
   from public.cuentas where codigo = '6102'),
  'una cuenta no sembrada queda sin clasificar (null) para excluirse del reporte'
);

-- ---------------------------------------------------------------------------
-- RPC actualizar_clasificacion_dgii
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  public.actualizar_clasificacion_dgii(jsonb_build_object(
    'cuenta_id', (select id from public.cuentas where codigo = '6102'),
    'categoria_dgii', '06',
    'tipo_compra', 'servicio',
    'tipo_ingreso', '6'
  )),
  (select id from public.cuentas where codigo = '6102'),
  'contador clasifica una cuenta y recibe su id'
);

select is(
  (select categoria_dgii || '/' || tipo_compra || '/' || tipo_ingreso
   from public.cuentas where codigo = '6102'),
  '06/servicio/6',
  'la clasificación se guarda en la cuenta'
);

select is(
  public.actualizar_clasificacion_dgii(jsonb_build_object(
    'cuenta_id', (select id from public.cuentas where codigo = '6102'),
    'categoria_dgii', null,
    'tipo_compra', null,
    'tipo_ingreso', null
  )),
  (select id from public.cuentas where codigo = '6102'),
  'pasar null limpia la clasificación'
);

select ok(
  (select categoria_dgii is null and tipo_compra is null and tipo_ingreso is null
   from public.cuentas where codigo = '6102'),
  'la cuenta queda sin clasificar tras limpiarla con null'
);

select throws_ok(
  format(
    'select public.actualizar_clasificacion_dgii(%L::jsonb)',
    jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '6102'),
      'categoria_dgii', '99'
    )
  ),
  '22023',
  'categoría DGII inválida',
  'una categoría DGII fuera de 01..10 se rechaza'
);

select throws_ok(
  format(
    'select public.actualizar_clasificacion_dgii(%L::jsonb)',
    jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '6102'),
      'tipo_compra', 'otro'
    )
  ),
  '22023',
  'tipo de compra inválido',
  'un tipo de compra distinto de bienes/servicio se rechaza'
);

select throws_ok(
  format(
    'select public.actualizar_clasificacion_dgii(%L::jsonb)',
    jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '6102'),
      'tipo_ingreso', '7'
    )
  ),
  '22023',
  'tipo de ingreso inválido',
  'un tipo de ingreso fuera de 1..6 se rechaza'
);

select throws_ok(
  format(
    'select public.actualizar_clasificacion_dgii(%L::jsonb)',
    jsonb_build_object(
      'cuenta_id', '00000000-0000-0000-0000-000000000000',
      'categoria_dgii', '02'
    )
  ),
  '22023',
  'cuenta no encontrada',
  'clasificar una cuenta inexistente falla'
);

select throws_ok(
  format(
    'select public.actualizar_clasificacion_dgii(%L::jsonb)',
    jsonb_build_object('cuenta_id', 'no-es-un-uuid', 'categoria_dgii', '02')
  ),
  '22023',
  'cuenta no encontrada',
  'un cuenta_id que no es uuid falla con el mensaje en español'
);

select throws_ok(
  format(
    'select public.actualizar_clasificacion_dgii(%L::jsonb)',
    jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '4'),
      'tipo_ingreso', '1'
    )
  ),
  '22023',
  'solo se clasifican cuentas de movimiento',
  'una cuenta de agrupación no se puede clasificar'
);

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  format(
    'select public.actualizar_clasificacion_dgii(%L::jsonb)',
    jsonb_build_object(
      'cuenta_id', (select id from public.cuentas where codigo = '6102'),
      'categoria_dgii', '02'
    )
  ),
  '42501',
  null,
  'lector no puede clasificar cuentas'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  format(
    'select public.actualizar_clasificacion_dgii(%L::jsonb)',
    jsonb_build_object(
      'cuenta_id', '00000000-0000-0000-0000-000000000000',
      'categoria_dgii', '02'
    )
  ),
  '42501',
  null,
  'anon no puede ejecutar la RPC de clasificación'
);

reset role;

select ok(
  has_function_privilege('authenticated', 'public.actualizar_clasificacion_dgii(jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.actualizar_clasificacion_dgii(jsonb)', 'execute'),
  'solo authenticated ejecuta actualizar_clasificacion_dgii'
);

select * from finish();
rollback;

-- Validación del dígito verificador DGII de RNC (9 dígitos) y cédula (11)
-- al crear o actualizar contactos, como hace Alegra.
--
-- RNC: pesos [7,9,8,6,5,4,3,2] sobre los primeros 8 dígitos; dv = 11 - resto,
-- con 10 → 1 y 11 → 2 (algoritmo corregido en 20261126130000_rnc_digito_dgii).
-- Vectores reales del catálogo de la DGII: 131712789 (FRINET SRL), 130893489
-- (MEDOXIGAS ALC SRL), 131488791 (OXYMAT SRL), 132000013 (DIMARDI M&M SRL),
-- 101007151 (ROSEDAL CXA) y 531068592 (JUSTINA SUERO AMADOR). 402123455 es el
-- RNC de la prueba de Alegra; 132000015 fue rechazado por Alegra.

begin;
select plan(23);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local'),
  ('22222222-2222-2222-2222-222222222222', 'contador@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector@prueba.local');
insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Contador', 'contador'),
  ('33333333-3333-3333-3333-333333333333', 'Lector', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- RNC: 9 dígitos y dígito verificador
-- ---------------------------------------------------------------------------

select ok(
  public.crear_contacto(jsonb_build_object(
    'tipo', 'proveedor',
    'nombre', 'RNC válido uno',
    'tipo_identificacion', 'rnc',
    'rnc_cedula', '132000013'
  )) is not null,
  'el RNC real 132000013 pasa la validación y crea el contacto'
);

select ok(
  public.crear_contacto(jsonb_build_object(
    'tipo', 'cliente',
    'nombre', 'RNC válido dos',
    'tipo_identificacion', 'rnc',
    'rnc_cedula', '402123455'
  )) is not null,
  'el RNC 402123455 de la prueba de Alegra pasa la validación y crea el contacto'
);

-- El RNC que rechazaba el algoritmo viejo: 131712789 es FRINET SRL, inscrito
-- en la DGII (el caso que reportó Waldy en producción).
select ok(
  public.crear_contacto(jsonb_build_object(
    'tipo', 'cliente',
    'nombre', 'RNC FRINET',
    'tipo_identificacion', 'rnc',
    'rnc_cedula', '131712789'
  )) is not null,
  'el RNC real 131712789 (FRINET SRL) se acepta tras corregir el algoritmo'
);

select throws_ok(
  format(
    'select public.crear_contacto(%L::jsonb)',
    jsonb_build_object(
      'tipo', 'proveedor',
      'nombre', 'RNC inválido',
      'tipo_identificacion', 'rnc',
      'rnc_cedula', '132000015'
    )
  ),
  '22023',
  'La comprobación del dígito verificador de la identificación: 132000015 fue errónea.',
  'el RNC 132000015 se rechaza con el mensaje literal de Alegra'
);

-- Candado del bug: con los pesos viejos (que ignoraban el primer dígito)
-- 902123455 pasaba; con el algoritmo de la DGII el dv es 3, no 5.
select throws_ok(
  format(
    'select public.crear_contacto(%L::jsonb)',
    jsonb_build_object(
      'tipo', 'proveedor',
      'nombre', 'RNC del algoritmo viejo',
      'tipo_identificacion', 'rnc',
      'rnc_cedula', '902123455'
    )
  ),
  '22023',
  'La comprobación del dígito verificador de la identificación: 902123455 fue errónea.',
  'un RNC que solo pasaba con los pesos viejos se rechaza'
);

select throws_ok(
  format(
    'select public.crear_contacto(%L::jsonb)',
    jsonb_build_object(
      'tipo', 'proveedor',
      'nombre', 'RNC corto',
      'tipo_identificacion', 'rnc',
      'rnc_cedula', '13200001'
    )
  ),
  '22023',
  'El RNC debe tener 9 dígitos.',
  'un RNC de 8 dígitos se rechaza'
);

select throws_ok(
  format(
    'select public.crear_contacto(%L::jsonb)',
    jsonb_build_object(
      'tipo', 'proveedor',
      'nombre', 'RNC con letras',
      'tipo_identificacion', 'rnc',
      'rnc_cedula', '13200001A'
    )
  ),
  '22023',
  'El RNC debe tener 9 dígitos.',
  'un RNC con caracteres que no son dígitos se rechaza'
);

-- ---------------------------------------------------------------------------
-- Cédula: 11 dígitos y dígito verificador
-- ---------------------------------------------------------------------------

-- 00113918205: pesos [1,2,1,2,1,2,1,2,1,2] sobre los 10 primeros, suma 25,
-- dv = (10 - (25 % 10)) % 10 = 5.
select ok(
  public.crear_contacto(jsonb_build_object(
    'tipo', 'cliente',
    'nombre', 'Cédula válida',
    'tipo_identificacion', 'cedula',
    'rnc_cedula', '00113918205'
  )) is not null,
  'una cédula de 11 dígitos con dígito verificador correcto pasa'
);

select throws_ok(
  format(
    'select public.crear_contacto(%L::jsonb)',
    jsonb_build_object(
      'tipo', 'cliente',
      'nombre', 'Cédula inválida',
      'tipo_identificacion', 'cedula',
      'rnc_cedula', '00113918204'
    )
  ),
  '22023',
  'La comprobación del dígito verificador de la identificación: 00113918204 fue errónea.',
  'una cédula con dígito verificador errado se rechaza'
);

select throws_ok(
  format(
    'select public.crear_contacto(%L::jsonb)',
    jsonb_build_object(
      'tipo', 'cliente',
      'nombre', 'Cédula corta',
      'tipo_identificacion', 'cedula',
      'rnc_cedula', '0011391820'
    )
  ),
  '22023',
  'La cédula debe tener 11 dígitos.',
  'una cédula de 10 dígitos se rechaza'
);

-- ---------------------------------------------------------------------------
-- Pasaporte y valor vacío: sin validación
-- ---------------------------------------------------------------------------

select ok(
  public.crear_contacto(jsonb_build_object(
    'tipo', 'cliente',
    'nombre', 'Pasaporte',
    'tipo_identificacion', 'pasaporte',
    'rnc_cedula', 'AB-12345'
  )) is not null,
  'el pasaporte no se valida'
);

select ok(
  public.crear_contacto(jsonb_build_object(
    'tipo', 'cliente',
    'nombre', 'RNC vacío',
    'tipo_identificacion', 'rnc',
    'rnc_cedula', ''
  )) is not null,
  'un rnc_cedula vacío pasa sin validación'
);

-- ---------------------------------------------------------------------------
-- actualizar_contacto
-- ---------------------------------------------------------------------------

select throws_ok(
  format(
    'select public.actualizar_contacto(%L::uuid, %L::jsonb)',
    (select id from public.contactos where nombre = 'RNC válido uno'),
    jsonb_build_object('tipo_identificacion', 'rnc', 'rnc_cedula', '132000015')
  ),
  '22023',
  'La comprobación del dígito verificador de la identificación: 132000015 fue errónea.',
  'actualizar un contacto con un RNC inválido se rechaza'
);

select is(
  public.actualizar_contacto(
    (select id from public.contactos where nombre = 'RNC válido uno'),
    jsonb_build_object('rnc_cedula', '402123455')
  ),
  (select id from public.contactos where nombre = 'RNC válido uno'),
  'actualizar solo el RNC usa el tipo guardado y acepta uno válido'
);

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  format(
    'select public.crear_contacto(%L::jsonb)',
    jsonb_build_object('tipo', 'cliente', 'nombre', 'No permitido')
  ),
  '42501',
  null,
  'lector no puede crear contactos'
);

select throws_ok(
  format(
    'select public.actualizar_contacto(%L::uuid, %L::jsonb)',
    (select id from public.contactos where nombre = 'RNC válido uno'),
    jsonb_build_object('nombre', 'No permitido')
  ),
  '42501',
  null,
  'lector no puede actualizar contactos'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  format(
    'select public.crear_contacto(%L::jsonb)',
    jsonb_build_object('tipo', 'cliente', 'nombre', 'Anon')
  ),
  '42501',
  null,
  'anon no puede crear contactos'
);

reset role;

select ok(
  has_function_privilege('authenticated', 'public.crear_contacto(jsonb)', 'execute')
    and has_function_privilege('authenticated', 'public.actualizar_contacto(uuid, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.crear_contacto(jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.actualizar_contacto(uuid, jsonb)', 'execute'),
  'solo authenticated ejecuta crear_contacto y actualizar_contacto'
);

select ok(
  not has_function_privilege('authenticated', 'public._rnc_digito_valido(text)', 'execute')
    and not has_function_privilege('anon', 'public._rnc_digito_valido(text)', 'execute'),
  'el validador _rnc_digito_valido es interno'
);

select ok(
  not has_function_privilege('authenticated', 'public._crear_contacto_limite(jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public._actualizar_contacto_limite(uuid, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public._crear_contacto_limite(jsonb)', 'execute'),
  'las versiones renombradas de los contactos son internas'
);

select ok(
  public._rnc_digito_valido('132000013')
    and public._rnc_digito_valido('402123455')
    and public._rnc_digito_valido('131712789')
    and public._rnc_digito_valido('130893489')
    and public._rnc_digito_valido('1-31-71278-9')
    and not public._rnc_digito_valido('132000015')
    and not public._rnc_digito_valido('902123455')
    and not public._rnc_digito_valido('123'),
  'el validador acepta los RNC reales, ignora separadores y rechaza largos distintos'
);

select ok(
  public._rnc_digito_valido('531068592')
    and public._rnc_digito_valido('101007151')
    and not public._rnc_digito_valido('531068590')
    and not public._rnc_digito_valido('101007150'),
  'el validador usa 2 cuando el resto es 0 y 1 cuando el resto es 1 (catálogo DGII)'
);

select ok(
  public._rnc_digito_valido('00113918205')
    and not public._rnc_digito_valido('00113918204')
    and not public._rnc_digito_valido('0011391820'),
  'el validador de cédula acepta el dv correcto y rechaza el errado o el largo incorrecto'
);

select * from finish();
rollback;

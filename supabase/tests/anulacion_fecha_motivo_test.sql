begin;
select plan(19);

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'admin.anulacion@prueba.local'),
  ('55555555-5555-5555-5555-555555555555', 'lector.anulacion@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('44444444-4444-4444-4444-444444444444', 'Admin anulación', 'admin'),
  ('55555555-5555-5555-5555-555555555555', 'Lector anulación', 'lector');

-- Motivo inactivo para probar el rechazo (el rollback lo revierte).
insert into public.motivos_anulacion (nombre, codigo_dgii, activo)
values ('Motivo inactivo de prueba', '10', false);

set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Semilla del catálogo y RLS de lectura
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.motivos_anulacion where activo),
  10,
  'la migración siembra los 10 motivos de anulación activos'
);

select is(
  (select string_agg(codigo_dgii, ',' order by codigo_dgii)
   from public.motivos_anulacion where activo),
  '01,02,03,04,05,06,07,08,09,10',
  'los códigos DGII del catálogo van de 01 a 10 sin huecos ni repetidos'
);

select is(
  (select codigo_dgii from public.motivos_anulacion where nombre = 'Devolución de productos'),
  '06',
  'Devolución de productos se mapea al 06 oficial de la DGII'
);

select is(
  (select count(*)::int from public.motivos_anulacion),
  11,
  'authenticated con perfil ve todo el catálogo (10 sembrados + 1 inactivo de prueba)'
);

-- ---------------------------------------------------------------------------
-- Datos de prueba
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'contacto', public.crear_contacto(jsonb_build_object(
  'tipo', 'cliente',
  'nombre', 'Anulación Fiscal Cliente',
  'tipo_identificacion', 'rnc',
  'rnc_cedula', '402123455'
));

insert into _ids (clave, id)
select 'servicio', public.crear_producto(jsonb_build_object(
  'tipo', 'servicio',
  'nombre', 'Anulación Servicio',
  'precio', 1000.00::numeric,
  'itbis_tasa', 18.00::numeric
));

insert into _ids (clave, id)
select v.clave, public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'servicio'),
    'cantidad', 1.00::numeric,
    'precio', 1000.00::numeric
  ))
))
from (values ('factura_con_motivo'), ('factura_sin_info'), ('factura_errores')) as v(clave);

insert into _ids (clave, id)
select 'asiento_con_motivo', f.asiento_id
from public.facturas f
where f.id = (select id from _ids where clave = 'factura_con_motivo');

insert into _ids (clave, id)
select 'motivo_devolucion', m.id
from public.motivos_anulacion m
where m.nombre = 'Devolución de productos';

insert into _ids (clave, id)
select 'motivo_inactivo', m.id
from public.motivos_anulacion m
where m.nombre = 'Motivo inactivo de prueba';

-- ---------------------------------------------------------------------------
-- Anulación con fecha y motivo
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'factura_con_motivo_anulada', public.anular_documento(
  'factura',
  (select id from _ids where clave = 'factura_con_motivo'),
  jsonb_build_object(
    'fecha', to_char(current_date, 'YYYY-MM-DD'),
    'motivo', (select id from _ids where clave = 'motivo_devolucion')
  )
);

select is(
  (select f.fecha_anulacion
   from public.facturas f
   where f.id = (select id from _ids where clave = 'factura_con_motivo')),
  current_date,
  'la factura anulada guarda la fecha de anulación'
);

select is(
  (select f.motivo_anulacion_id
   from public.facturas f
   where f.id = (select id from _ids where clave = 'factura_con_motivo')),
  (select id from _ids where clave = 'motivo_devolucion'),
  'la factura anulada guarda el motivo de anulación'
);

select is(
  (select f.estado
   from public.facturas f
   where f.id = (select id from _ids where clave = 'factura_con_motivo')),
  'anulada',
  'la factura con fecha y motivo queda en estado anulada'
);

select ok(
  exists (
    select 1
    from public.asientos a
    where a.origen_tipo = 'anulacion'
      and a.anula_asiento_id = (select id from _ids where clave = 'asiento_con_motivo')
  ),
  'la anulación con fecha y motivo genera el asiento de reversa'
);

-- ---------------------------------------------------------------------------
-- Compatibilidad: sin p_info no se guardan fecha ni motivo
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'factura_sin_info_anulada', public.anular_documento(
  'factura',
  (select id from _ids where clave = 'factura_sin_info')
);

select ok(
  (select f.estado = 'anulada'
      and f.fecha_anulacion is null
      and f.motivo_anulacion_id is null
   from public.facturas f
   where f.id = (select id from _ids where clave = 'factura_sin_info')),
  'sin p_info la anulación mantiene el comportamiento anterior (fecha y motivo nulos)'
);

-- ---------------------------------------------------------------------------
-- Validaciones de p_info
-- ---------------------------------------------------------------------------

select throws_ok(
  format(
    'select public.anular_documento(%L, %L::uuid, %L::jsonb)',
    'factura',
    (select id from _ids where clave = 'factura_errores'),
    jsonb_build_object(
      'fecha', to_char(current_date, 'YYYY-MM-DD'),
      'motivo', gen_random_uuid()::text
    )::text
  ),
  '22023',
  'El motivo de anulación no existe o está inactivo.',
  'rechaza un motivo que no existe'
);

select throws_ok(
  format(
    'select public.anular_documento(%L, %L::uuid, %L::jsonb)',
    'factura',
    (select id from _ids where clave = 'factura_errores'),
    jsonb_build_object(
      'fecha', to_char(current_date, 'YYYY-MM-DD'),
      'motivo', (select id from _ids where clave = 'motivo_inactivo')
    )::text
  ),
  '22023',
  'El motivo de anulación no existe o está inactivo.',
  'rechaza un motivo inactivo'
);

select throws_ok(
  format(
    'select public.anular_documento(%L, %L::uuid, %L::jsonb)',
    'factura',
    (select id from _ids where clave = 'factura_errores'),
    jsonb_build_object(
      'fecha', to_char(current_date + 1, 'YYYY-MM-DD'),
      'motivo', (select id from _ids where clave = 'motivo_devolucion')
    )::text
  ),
  '22023',
  'La fecha de anulación no puede ser futura.',
  'rechaza una fecha de anulación futura'
);

select throws_ok(
  format(
    'select public.anular_documento(%L, %L::uuid, %L::jsonb)',
    'factura',
    (select id from _ids where clave = 'factura_errores'),
    jsonb_build_object(
      'fecha', '2026-02-31',
      'motivo', (select id from _ids where clave = 'motivo_devolucion')
    )::text
  ),
  '22023',
  'La fecha de anulación no es válida.',
  'rechaza una fecha de anulación inválida'
);

select throws_ok(
  format(
    'select public.anular_documento(%L, %L::uuid, %L::jsonb)',
    'pago_recibido',
    gen_random_uuid(),
    jsonb_build_object(
      'fecha', to_char(current_date, 'YYYY-MM-DD'),
      'motivo', (select id from _ids where clave = 'motivo_devolucion')
    )::text
  ),
  '22023',
  'El tipo de documento no admite fecha y motivo de anulación.',
  'rechaza fecha y motivo en un tipo que no los admite'
);

-- ---------------------------------------------------------------------------
-- Gasto menor: también persiste fecha y motivo
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'gasto', public.crear_gasto_menor(jsonb_build_object(
  'fecha', '2026-11-13',
  'descripcion', 'Gasto para anular con motivo',
  'subtotal', 500,
  'cuenta_gasto_id', (select id from public.cuentas where codigo = '6105')
));

insert into _ids (clave, id)
select 'gasto_anulado', public.anular_documento(
  'gasto_menor',
  (select id from _ids where clave = 'gasto'),
  jsonb_build_object(
    'fecha', to_char(current_date, 'YYYY-MM-DD'),
    'motivo', (select id from _ids where clave = 'motivo_devolucion')
  )
);

select is(
  (select g.fecha_anulacion
   from public.gastos_menores g
   where g.id = (select id from _ids where clave = 'gasto')),
  current_date,
  'el gasto menor anulado guarda la fecha de anulación'
);

select is(
  (select g.motivo_anulacion_id
   from public.gastos_menores g
   where g.id = (select id from _ids where clave = 'gasto')),
  (select id from _ids where clave = 'motivo_devolucion'),
  'el gasto menor anulado guarda el motivo de anulación'
);

-- ---------------------------------------------------------------------------
-- Doble anulación: la detecta el motor base
-- ---------------------------------------------------------------------------

select throws_ok(
  format(
    'select public.anular_documento(%L, %L::uuid, %L::jsonb)',
    'factura',
    (select id from _ids where clave = 'factura_con_motivo'),
    jsonb_build_object(
      'fecha', to_char(current_date, 'YYYY-MM-DD'),
      'motivo', (select id from _ids where clave = 'motivo_devolucion')
    )::text
  ),
  '22023',
  'la factura ya está anulada',
  'la doble anulación falla con el error de estado del motor'
);

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

select throws_ok(
  format(
    'select public.anular_documento(%L, %L::uuid, %L::jsonb)',
    'factura',
    (select id from _ids where clave = 'factura_errores'),
    jsonb_build_object(
      'fecha', to_char(current_date, 'YYYY-MM-DD'),
      'motivo', (select id from _ids where clave = 'motivo_devolucion')
    )::text
  ),
  '42501',
  'sin permiso',
  'el lector no puede anular con fecha y motivo'
);

reset role;
set local role anon;

select throws_ok(
  'select count(*) from public.motivos_anulacion',
  '42501',
  null,
  'anon no ve el catálogo de motivos de anulación'
);

select * from finish();
rollback;

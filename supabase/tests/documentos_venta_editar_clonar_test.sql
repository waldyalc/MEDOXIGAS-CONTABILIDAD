begin;
select plan(31);

create temp table _ids (clave text primary key, id uuid) on commit drop;
create temp table _valores (clave text primary key, valor text) on commit drop;
grant select, insert, update, delete on _ids to authenticated;
grant select, insert, update, delete on _valores to authenticated;

select ok(
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cotizaciones' and column_name = 'remision_id'
  ),
  'cotizaciones tiene remision_id'
);

select ok(
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'remisiones' and column_name = 'cotizacion_id'
  ),
  'remisiones tiene cotizacion_id'
);

select ok(
  coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.cotizaciones')), false),
  'RLS activo en cotizaciones'
);
select ok(
  coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.remisiones')), false),
  'RLS activo en remisiones'
);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector@prueba.local');
insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin'),
  ('33333333-3333-3333-3333-333333333333', 'Lector', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id)
select 'contacto', public.crear_contacto(jsonb_build_object(
  'tipo', 'cliente',
  'nombre', 'Cliente Documentos'
));

insert into _ids (clave, id)
select 'producto', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Producto Documentos',
  'precio', 650.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'inventariable', true,
  'cantidad', 10.00::numeric,
  'costo', 390.00::numeric
));

insert into _valores (clave, valor)
select 'asientos_antes', count(*)::text from public.asientos;

insert into _ids (clave, id)
select 'cotizacion', public.crear_cotizacion(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-15',
  'vencimiento', '2026-11-22',
  'notas', 'Nota original',
  'terminos', 'Términos originales',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'producto'),
      'cantidad', 2.00::numeric
    )
  )
));

select is(
  (select terminos from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  'Términos originales',
  'crear_cotizacion guarda los términos'
);

select is(
  (select estado from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  'abierta',
  'la cotización nace abierta'
);

insert into _valores (clave, valor)
select 'cotizacion_numero', numero::text
from public.cotizaciones
where id = (select id from _ids where clave = 'cotizacion');

select public.editar_cotizacion(jsonb_build_object(
  'id', (select id from _ids where clave = 'cotizacion'),
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-15',
  'vencimiento', '2026-11-25',
  'notas', 'Nota editada',
  'terminos', 'Términos editados',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'producto'),
      'cantidad', 3.00::numeric
    )
  )
));

select is(
  (select total::numeric(14,2) from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  2301.00::numeric(14,2),
  'editar recalcula el total de la cotización'
);

select is(
  (select cantidad::numeric(14,2) from public.cotizacion_lineas where cotizacion_id = (select id from _ids where clave = 'cotizacion')),
  3.00::numeric(14,2),
  'editar reemplaza la cantidad de la línea'
);

select is(
  (select count(*)::int from public.cotizacion_lineas where cotizacion_id = (select id from _ids where clave = 'cotizacion')),
  1,
  'editar no duplica líneas'
);

select is(
  (select notas from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  'Nota editada',
  'editar actualiza las notas'
);

select is(
  (select terminos from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  'Términos editados',
  'editar actualiza los términos'
);

select is(
  (select numero from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  (select valor::int from _valores where clave = 'cotizacion_numero'),
  'editar conserva la numeración'
);

select is(
  (select estado from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  'abierta',
  'editar deja la cotización abierta'
);

select is(
  (select count(*)::int from public.asientos),
  (select valor::int from _valores where clave = 'asientos_antes'),
  'editar la cotización no genera asiento'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where id = (select id from _ids where clave = 'producto')),
  10.00::numeric(14,2),
  'editar la cotización no mueve inventario'
);

insert into _ids (clave, id)
select 'remision', public.crear_remision_desde_cotizacion(jsonb_build_object(
  'cotizacion_id', (select id from _ids where clave = 'cotizacion'),
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-15',
  'vencimiento', '2026-11-15',
  'notas', 'Nota del conduce',
  'terminos', 'Términos del conduce',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'producto'),
      'cantidad', 1.00::numeric
    )
  )
));

select is(
  (select cotizacion_id from public.remisiones where id = (select id from _ids where clave = 'remision')),
  (select id from _ids where clave = 'cotizacion'),
  'el conduce apunta a la cotización'
);

select is(
  (select remision_id from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  (select id from _ids where clave = 'remision'),
  'la cotización apunta al conduce'
);

select is(
  (select estado from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  'convertida',
  'la cotización queda convertida al crear el conduce'
);

select isnt(
  (select numero from public.remisiones where id = (select id from _ids where clave = 'remision')),
  null,
  'el conduce recibe su propia numeración'
);

select is(
  (select total::numeric(14,2) from public.remisiones where id = (select id from _ids where clave = 'remision')),
  767.00::numeric(14,2),
  'el conduce conserva el precio y el ITBIS de las líneas'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where id = (select id from _ids where clave = 'producto')),
  10.00::numeric(14,2),
  'el conduce no mueve inventario'
);

select is(
  (select count(*)::int from public.asientos),
  (select valor::int from _valores where clave = 'asientos_antes'),
  'el conduce no genera asiento'
);

select throws_ok(
  format(
    'select public.crear_remision_desde_cotizacion(%L::jsonb)',
    jsonb_build_object(
      'cotizacion_id', (select id from _ids where clave = 'cotizacion'),
      'contacto_id', (select id from _ids where clave = 'contacto'),
      'lineas', jsonb_build_array(
        jsonb_build_object(
          'producto_id', (select id from _ids where clave = 'producto'),
          'cantidad', 1.00::numeric
        )
      )
    )::text
  ),
  '22023',
  null,
  'una cotización convertida no crea otro conduce'
);

select throws_ok(
  format(
    'select public.editar_cotizacion(%L::jsonb)',
    jsonb_build_object(
      'id', (select id from _ids where clave = 'cotizacion'),
      'contacto_id', (select id from _ids where clave = 'contacto'),
      'lineas', jsonb_build_array(
        jsonb_build_object(
          'producto_id', (select id from _ids where clave = 'producto'),
          'cantidad', 1.00::numeric
        )
      )
    )::text
  ),
  '22023',
  null,
  'una cotización convertida no se edita'
);

select public.editar_remision(jsonb_build_object(
  'id', (select id from _ids where clave = 'remision'),
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-15',
  'vencimiento', '2026-11-18',
  'notas', 'Conduce editado',
  'terminos', 'Términos del conduce editados',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'producto'),
      'cantidad', 2.00::numeric
    )
  )
));

select is(
  (select total::numeric(14,2) from public.remisiones where id = (select id from _ids where clave = 'remision')),
  1534.00::numeric(14,2),
  'editar recalcula el total del conduce'
);

select is(
  (select cotizacion_id from public.remisiones where id = (select id from _ids where clave = 'remision')),
  (select id from _ids where clave = 'cotizacion'),
  'editar el conduce conserva el vínculo con la cotización'
);

select is(
  (select estado from public.remisiones where id = (select id from _ids where clave = 'remision')),
  'abierta',
  'editar deja el conduce abierto'
);

insert into _ids (clave, id)
select 'cotizacion_factura', public.crear_cotizacion(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-15',
  'vencimiento', '2026-11-15',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'producto'),
      'cantidad', 2.00::numeric
    )
  )
));

insert into _ids (clave, id)
select 'factura', public.convertir_a_factura(jsonb_build_object(
  'tipo', 'cotizacion',
  'id', (select id from _ids where clave = 'cotizacion_factura'),
  'tipo_comprobante', '02'
));

select is(
  (select total::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura')),
  1534.00::numeric(14,2),
  'convertir a factura sigue funcionando'
);

select is(
  (select estado from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion_factura')),
  'convertida',
  'la cotización convertida a factura queda convertida'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  format(
    'select public.editar_cotizacion(%L::jsonb)',
    jsonb_build_object(
      'id', (select id from _ids where clave = 'cotizacion_factura'),
      'contacto_id', (select id from _ids where clave = 'contacto'),
      'lineas', jsonb_build_array(
        jsonb_build_object(
          'producto_id', (select id from _ids where clave = 'producto'),
          'cantidad', 1.00::numeric
        )
      )
    )::text
  ),
  '42501',
  null,
  'lector no puede editar cotizaciones'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select throws_ok(
  $q$update public.cotizaciones set notas = 'directo'$q$,
  '42501',
  null,
  'authenticated no edita cotizaciones directo'
);

select * from finish();
rollback;

begin;
select plan(30);

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

insert into auth.users (id, email) values
  ('66666666-6666-6666-6666-666666666666', 'admin.anulacion.nc@prueba.local'),
  ('77777777-7777-7777-7777-777777777777', 'lector.anulacion.nc@prueba.local');
insert into public.perfiles (user_id, nombre, rol) values
  ('66666666-6666-6666-6666-666666666666', 'Admin anulación NC', 'admin'),
  ('77777777-7777-7777-7777-777777777777', 'Lector anulación NC', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Datos de prueba: el producto arranca con 10 unidades y costo 50.
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'contacto', public.crear_contacto(jsonb_build_object(
  'tipo', 'cliente',
  'nombre', 'Anulación NC/ND Cliente'
));

insert into _ids (clave, id)
select 'producto', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Anulación NC/ND Producto',
  'precio', 100.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'inventariable', true,
  'cantidad', 10.00::numeric,
  'costo', 50.00::numeric
));

-- Factura con una NC activa (para el bloqueo A).
insert into _ids (clave, id)
select 'factura_nc', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', to_char(current_date - 10, 'YYYY-MM-DD'),
  'vencimiento', to_char(current_date - 5, 'YYYY-MM-DD'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 2.00::numeric,
    'precio', 100.00::numeric
  ))
));

insert into _ids (clave, id)
select 'factura_nc_linea', fl.id
from public.factura_lineas fl
where fl.factura_id = (select id from _ids where clave = 'factura_nc');

-- Factura con una ND activa (también bloquea la anulación de la factura).
insert into _ids (clave, id)
select 'factura_nd', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', to_char(current_date - 10, 'YYYY-MM-DD'),
  'vencimiento', to_char(current_date - 5, 'YYYY-MM-DD'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 1.00::numeric,
    'precio', 100.00::numeric
  ))
));

-- Facturas para fechas y periodo.
insert into _ids (clave, id)
select 'factura_fecha', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', to_char(current_date - 3, 'YYYY-MM-DD'),
  'vencimiento', to_char(current_date - 1, 'YYYY-MM-DD'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 1.00::numeric,
    'precio', 100.00::numeric
  ))
));

insert into _ids (clave, id)
select 'factura_periodo', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', to_char(current_date - 2, 'YYYY-MM-DD'),
  'vencimiento', to_char(current_date - 1, 'YYYY-MM-DD'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 1.00::numeric,
    'precio', 100.00::numeric
  ))
));

insert into _ids (clave, id)
select 'factura_credito', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', to_char(current_date - 10, 'YYYY-MM-DD'),
  'vencimiento', to_char(current_date - 5, 'YYYY-MM-DD'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 1.00::numeric,
    'precio', 100.00::numeric
  ))
));

insert into _ids (clave, id)
select 'motivo', m.id
from public.motivos_anulacion m
where m.nombre = 'Devolución de productos';

-- ---------------------------------------------------------------------------
-- Semilla: la NC devuelve 1 unidad y suma su total al crédito de la factura.
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'nota_credito', public.crear_nota_credito_venta(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'factura_nc'),
  'fecha', to_char(current_date - 8, 'YYYY-MM-DD'),
  'notas', 'Devolución de 1 unidad',
  'lineas', jsonb_build_array(jsonb_build_object(
    'factura_linea_id', (select id from _ids where clave = 'factura_nc_linea'),
    'cantidad', 1.00::numeric
  ))
));

insert into _ids (clave, id)
select 'nota_debito', public.crear_nota_debito_venta(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'factura_nd'),
  'tipo', 'texto',
  'fecha', to_char(current_date - 8, 'YYYY-MM-DD'),
  'notas', 'Cargo por flete',
  'lineas', jsonb_build_array(jsonb_build_object(
    'descripcion', 'Cargo por flete',
    'cantidad', 1.00::numeric,
    'precio', 50.00::numeric,
    'itbis_tasa', 0.00::numeric
  ))
));

select is(
  (select total::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura_nc')),
  236.00::numeric(14,2),
  'factura base: 2 unidades con ITBIS dan 236.00'
);

select is(
  (select credito::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura_nc')),
  118.00::numeric(14,2),
  'la NC suma 118.00 al crédito de la factura'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where id = (select id from _ids where clave = 'producto')),
  5.00::numeric(14,2),
  'la NC devuelve la unidad: quedan 5 de 10 menos las 5 facturadas'
);

-- ---------------------------------------------------------------------------
-- A: una factura con NC o ND activa no se puede anular.
-- ---------------------------------------------------------------------------

select throws_ok(
  format(
    'select public.anular_documento(%L, %L::uuid)',
    'factura',
    (select id from _ids where clave = 'factura_nc')
  ),
  'P0001',
  'no se puede anular una factura con notas de crédito o débito activas',
  'una factura con nota de crédito activa no se anula'
);

select throws_ok(
  format(
    'select public.anular_documento(%L, %L::uuid)',
    'factura',
    (select id from _ids where clave = 'factura_nd')
  ),
  'P0001',
  'no se puede anular una factura con notas de crédito o débito activas',
  'una factura con nota de débito activa no se anula'
);

-- ---------------------------------------------------------------------------
-- C: la fecha de anulación no puede ser anterior a la del documento.
-- ---------------------------------------------------------------------------

select throws_ok(
  format(
    'select public.anular_documento(%L, %L::uuid, %L::jsonb)',
    'nota_credito_venta',
    (select id from _ids where clave = 'nota_credito'),
    jsonb_build_object(
      'fecha', to_char(current_date - 9, 'YYYY-MM-DD'),
      'motivo', (select id from _ids where clave = 'motivo')
    )::text
  ),
  '22023',
  'La fecha de anulación no puede ser anterior a la fecha del documento.',
  'la anulación de la NC rechaza una fecha anterior a la nota'
);

-- ---------------------------------------------------------------------------
-- B: anular la NC revierte asiento, inventario y crédito, con fecha real.
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'nota_credito_anulada', public.anular_documento(
  'nota_credito_venta',
  (select id from _ids where clave = 'nota_credito'),
  jsonb_build_object(
    'fecha', to_char(current_date - 6, 'YYYY-MM-DD'),
    'motivo', (select id from _ids where clave = 'motivo')
  )
);

select is(
  (select estado from public.notas_credito_venta where id = (select id from _ids where clave = 'nota_credito')),
  'anulada',
  'la nota de crédito queda anulada'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where id = (select id from _ids where clave = 'producto')),
  4.00::numeric(14,2),
  'anular la NC retira la unidad que había devuelto al inventario'
);

select is(
  (select credito::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura_nc')),
  0.00::numeric(14,2),
  'anular la NC devuelve el crédito de la factura a 0'
);

select is(
  (select estado from public.facturas where id = (select id from _ids where clave = 'factura_nc')),
  'abierta',
  'la factura vuelve a abierta al anular su nota de crédito'
);

select ok(
  exists (
    select 1
    from public.asientos a
    where a.origen_tipo = 'anulacion'
      and a.anula_asiento_id = (
        select asiento_id from public.notas_credito_venta
        where id = (select id from _ids where clave = 'nota_credito')
      )
  ),
  'anular la NC genera su asiento de reversa'
);

select is(
  (
    select a.fecha
    from public.asientos a
    where a.anula_asiento_id = (
      select asiento_id from public.notas_credito_venta
      where id = (select id from _ids where clave = 'nota_credito')
    )
  ),
  current_date - 6,
  'el asiento de reversa de la NC se ficha con la fecha de anulación, no con hoy'
);

select is(
  (select fecha_anulacion from public.notas_credito_venta where id = (select id from _ids where clave = 'nota_credito')),
  current_date - 6,
  'la NC guarda la fecha de anulación'
);

select is(
  (select motivo_anulacion_id from public.notas_credito_venta where id = (select id from _ids where clave = 'nota_credito')),
  (select id from _ids where clave = 'motivo'),
  'la NC guarda el motivo de anulación'
);

-- ---------------------------------------------------------------------------
-- B: anular la ND solo revierte su asiento y no toca inventario ni crédito.
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'nota_debito_anulada', public.anular_documento(
  'nota_debito_venta',
  (select id from _ids where clave = 'nota_debito'),
  jsonb_build_object(
    'fecha', to_char(current_date - 5, 'YYYY-MM-DD'),
    'motivo', (select id from _ids where clave = 'motivo')
  )
);

select is(
  (select estado from public.notas_debito_venta where id = (select id from _ids where clave = 'nota_debito')),
  'anulada',
  'la nota de débito queda anulada'
);

select is(
  (select fecha_anulacion from public.notas_debito_venta where id = (select id from _ids where clave = 'nota_debito')),
  current_date - 5,
  'la ND guarda la fecha de anulación'
);

select ok(
  exists (
    select 1
    from public.asientos a
    where a.origen_tipo = 'anulacion'
      and a.anula_asiento_id = (
        select asiento_id from public.notas_debito_venta
        where id = (select id from _ids where clave = 'nota_debito')
      )
  ),
  'anular la ND genera su asiento de reversa'
);

select is(
  (
    select a.fecha
    from public.asientos a
    where a.anula_asiento_id = (
      select asiento_id from public.notas_debito_venta
      where id = (select id from _ids where clave = 'nota_debito')
    )
  ),
  current_date - 5,
  'el asiento de reversa de la ND se ficha con la fecha de anulación'
);

select is(
  (select credito::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura_nd')),
  0.00::numeric(14,2),
  'la ND nunca tocó el crédito de la factura'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where id = (select id from _ids where clave = 'producto')),
  4.00::numeric(14,2),
  'anular la ND no mueve inventario'
);

select throws_ok(
  format(
    'select public.anular_documento(%L, %L::uuid)',
    'nota_credito_venta',
    (select id from _ids where clave = 'nota_credito')
  ),
  '22023',
  'la nota de crédito ya está anulada',
  'la doble anulación de la NC se rechaza'
);

-- ---------------------------------------------------------------------------
-- A/C: ya sin notas activas, la factura se anula con fecha y credito = 0.
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'factura_nc_anulada', public.anular_documento(
  'factura',
  (select id from _ids where clave = 'factura_nc'),
  jsonb_build_object(
    'fecha', to_char(current_date - 4, 'YYYY-MM-DD'),
    'motivo', (select id from _ids where clave = 'motivo')
  )
);

select is(
  (select estado from public.facturas where id = (select id from _ids where clave = 'factura_nc')),
  'anulada',
  'sin notas activas la factura se anula'
);

select is(
  (select cantidad::numeric(14,2) from public.productos where id = (select id from _ids where clave = 'producto')),
  6.00::numeric(14,2),
  'anular la factura repone sus 2 unidades una sola vez'
);

select is(
  (select credito::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura_nc')),
  0.00::numeric(14,2),
  'la factura anulada queda con credito = 0'
);

select is(
  (
    select a.fecha
    from public.asientos a
    where a.anula_asiento_id = (
      select asiento_id from public.facturas
      where id = (select id from _ids where clave = 'factura_nc')
    )
  ),
  current_date - 4,
  'el asiento de reversa de la factura se ficha con la fecha de anulación'
);

select is(
  (select fecha_anulacion from public.facturas where id = (select id from _ids where clave = 'factura_nc')),
  current_date - 4,
  'la factura guarda la fecha de anulación'
);

-- Crédito previo sin notas (dato desviado): al anular se limpia igual.
reset role;
update public.facturas
set credito = 25
where id = (select id from _ids where clave = 'factura_credito');
set local role authenticated;
set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';

select public.anular_documento('factura', (select id from _ids where clave = 'factura_credito'));

select is(
  (select credito::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura_credito')),
  0.00::numeric(14,2),
  'anular una factura con crédito previo lo deja en 0'
);

-- ---------------------------------------------------------------------------
-- C: fecha anterior al documento y periodo cerrado.
-- ---------------------------------------------------------------------------

select throws_ok(
  format(
    'select public.anular_documento(%L, %L::uuid, %L::jsonb)',
    'factura',
    (select id from _ids where clave = 'factura_fecha'),
    jsonb_build_object(
      'fecha', to_char(current_date - 4, 'YYYY-MM-DD'),
      'motivo', (select id from _ids where clave = 'motivo')
    )::text
  ),
  '22023',
  'La fecha de anulación no puede ser anterior a la fecha del documento.',
  'rechaza una fecha de anulación anterior a la factura'
);

select public.cerrar_periodo(date_trunc('month', current_date - 1)::date);

select throws_ok(
  format(
    'select public.anular_documento(%L, %L::uuid, %L::jsonb)',
    'factura',
    (select id from _ids where clave = 'factura_periodo'),
    jsonb_build_object(
      'fecha', to_char(current_date - 1, 'YYYY-MM-DD'),
      'motivo', (select id from _ids where clave = 'motivo')
    )::text
  ),
  '23514',
  null,
  'rechaza una fecha de anulación en un periodo cerrado'
);

-- ---------------------------------------------------------------------------
-- Permisos: un lector no anula notas.
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}';

select throws_ok(
  format(
    'select public.anular_documento(%L, %L::uuid, %L::jsonb)',
    'nota_credito_venta',
    (select id from _ids where clave = 'nota_credito'),
    jsonb_build_object(
      'fecha', to_char(current_date - 4, 'YYYY-MM-DD'),
      'motivo', (select id from _ids where clave = 'motivo')
    )::text
  ),
  '42501',
  'sin permiso',
  'el lector no puede anular una nota de crédito'
);

select * from finish();
rollback;

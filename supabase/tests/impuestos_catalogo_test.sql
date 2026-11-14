begin;
select plan(23);

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

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
-- Catálogo
-- ---------------------------------------------------------------------------

select is((select count(*)::int from public.impuestos), 7, 'el catálogo siembra los siete impuestos');
select is((select tarifa from public.impuestos where codigo = 'cdt'), 2.00::numeric, 'CDT es 2 %');
select is((select tarifa from public.impuestos where codigo = 'propina'), 10.00::numeric, 'propina es 10 %');
select is(
  (select c.codigo from public.impuestos i join public.cuentas c on c.id = i.cuenta_id where i.codigo = 'itbis-18'),
  '2102',
  'ITBIS 18 % usa la cuenta de ITBIS por pagar'
);
select is(
  (select c.codigo from public.impuestos i join public.cuentas c on c.id = i.cuenta_id where i.codigo = 'cdt'),
  '2105',
  'CDT usa la cuenta 2105'
);
select is(
  (select c.codigo from public.impuestos i join public.cuentas c on c.id = i.cuenta_id where i.codigo = 'propina'),
  '2106',
  'propina usa la cuenta 2106'
);
select is(
  (select cuenta_id from public.impuestos where codigo = 'exento'),
  null,
  'exento no tiene cuenta contable'
);

insert into _ids (clave, id)
select 'contacto', public.crear_contacto(jsonb_build_object('tipo', 'cliente', 'nombre', 'Impuestos Cliente'));

insert into _ids (clave, id)
select 'producto', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Impuestos Producto',
  'precio', 100.00::numeric,
  'itbis_tasa', 18.00::numeric
));

insert into _ids (clave, id)
select 'factura', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'producto'),
      'cantidad', 1.00::numeric,
      'precio', 100.00::numeric,
      'itbis_tasa', 18.00::numeric
    ),
    jsonb_build_object(
      'impuesto_id', (select id from public.impuestos where codigo = 'cdt'),
      'descripcion', 'Telecomunicaciones',
      'cantidad', 1.00::numeric,
      'precio', 100.00::numeric
    ),
    jsonb_build_object(
      'impuesto_id', (select id from public.impuestos where codigo = 'propina'),
      'descripcion', 'Servicio con propina',
      'cantidad', 1.00::numeric,
      'precio', 100.00::numeric
    )
  )
));

select is(
  (select itbis::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura')),
  18.00::numeric(14,2),
  'la factura deja en itbis solo el ITBIS'
);
select is(
  (select otros_impuestos::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura')),
  2.00::numeric(14,2),
  'el CDT va a otros_impuestos'
);
select is(
  (select propina::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura')),
  10.00::numeric(14,2),
  'la propina va a su propia columna'
);
select is(
  (select total::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura')),
  330.00::numeric(14,2),
  'el total suma base, ITBIS, CDT y propina'
);
select is(
  (select count(*)::int
   from public.factura_lineas
   where factura_id = (select id from _ids where clave = 'factura')
     and impuesto_id is not null),
  3,
  'cada línea guarda su impuesto del catálogo'
);

select is(
  (select sum(l.credito)::numeric(14,2)
   from public.asiento_lineas l
   join public.facturas f on f.asiento_id = l.asiento_id
   join public.cuentas c on c.id = l.cuenta_id
   where f.id = (select id from _ids where clave = 'factura') and c.codigo = '2102'),
  18.00::numeric(14,2),
  'el asiento acredita el ITBIS a 2102'
);
select is(
  (select sum(l.credito)::numeric(14,2)
   from public.asiento_lineas l
   join public.facturas f on f.asiento_id = l.asiento_id
   join public.cuentas c on c.id = l.cuenta_id
   where f.id = (select id from _ids where clave = 'factura') and c.codigo = '2105'),
  2.00::numeric(14,2),
  'el asiento acredita el CDT a 2105'
);
select is(
  (select sum(l.credito)::numeric(14,2)
   from public.asiento_lineas l
   join public.facturas f on f.asiento_id = l.asiento_id
   join public.cuentas c on c.id = l.cuenta_id
   where f.id = (select id from _ids where clave = 'factura') and c.codigo = '2106'),
  10.00::numeric(14,2),
  'el asiento acredita la propina a 2106'
);
select is(
  (select sum(l.debito)::numeric(14,2) - sum(l.credito)::numeric(14,2)
   from public.asiento_lineas l
   join public.facturas f on f.asiento_id = l.asiento_id
   where f.id = (select id from _ids where clave = 'factura')),
  0.00::numeric(14,2),
  'el asiento sigue cuadrado'
);

-- Compatibilidad con documentos viejos que solo mandan itbis_tasa.
insert into _ids (clave, id)
select 'factura16', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(jsonb_build_object(
    'descripcion', 'Vieja 16',
    'cantidad', 1.00::numeric,
    'precio', 100.00::numeric,
    'itbis_tasa', 16.00::numeric
  ))
));

select is(
  (select itbis::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura16')),
  16.00::numeric(14,2),
  'una factura vieja al 16 % sigue calculando 16 %'
);
select is(
  (select l.impuesto_id from public.factura_lineas l where l.factura_id = (select id from _ids where clave = 'factura16')),
  (select id from public.impuestos where codigo = 'itbis-16'),
  'la línea vieja se mapea al impuesto del catálogo'
);

-- Exento se distingue de ITBIS 0 %.
insert into _ids (clave, id)
select 'factura_exenta', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(jsonb_build_object(
    'impuesto_id', (select id from public.impuestos where codigo = 'exento'),
    'descripcion', 'Venta exenta',
    'cantidad', 1.00::numeric,
    'precio', 100.00::numeric
  ))
));

select is(
  (select l.impuesto_id from public.factura_lineas l where l.factura_id = (select id from _ids where clave = 'factura_exenta')),
  (select id from public.impuestos where codigo = 'exento'),
  'la línea exenta conserva el impuesto Exento'
);

-- Compra con CDT: se debita a su cuenta de pasivo.
insert into _ids (clave, id)
select 'compra', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(jsonb_build_object(
    'cuenta_id', (select id from public.cuentas where codigo = '6101'),
    'impuesto_id', (select id from public.impuestos where codigo = 'cdt'),
    'descripcion', 'Compra con CDT',
    'cantidad', 1.00::numeric,
    'costo', 100.00::numeric
  ))
));

select is(
  (select otros_impuestos::numeric(14,2) from public.facturas_proveedor where id = (select id from _ids where clave = 'compra')),
  2.00::numeric(14,2),
  'la compra guarda el CDT en otros_impuestos'
);
select is(
  (select sum(l.debito)::numeric(14,2)
   from public.asiento_lineas l
   join public.facturas_proveedor f on f.asiento_id = l.asiento_id
   join public.cuentas c on c.id = l.cuenta_id
   where f.id = (select id from _ids where clave = 'compra') and c.codigo = '2105'),
  2.00::numeric(14,2),
  'la compra debita el CDT a 2105'
);

-- Nota de crédito de venta: revierte el ITBIS contra 2102.
insert into _ids (clave, id)
select 'nota', public.crear_nota_credito_venta(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'factura'),
  'fecha', '2026-11-14',
  'lineas', jsonb_build_array(jsonb_build_object(
    'factura_linea_id', (
      select fl.id from public.factura_lineas fl
      where fl.factura_id = (select id from _ids where clave = 'factura')
        and fl.itbis_tasa = 18
      limit 1
    ),
    'cantidad', 1.00::numeric
  ))
));

select is(
  (select itbis::numeric(14,2) from public.notas_credito_venta where id = (select id from _ids where clave = 'nota')),
  18.00::numeric(14,2),
  'la nota de crédito conserva el ITBIS'
);
select is(
  (select sum(l.debito)::numeric(14,2)
   from public.asiento_lineas l
   join public.notas_credito_venta n on n.asiento_id = l.asiento_id
   join public.cuentas c on c.id = l.cuenta_id
   where n.id = (select id from _ids where clave = 'nota') and c.codigo = '2102'),
  18.00::numeric(14,2),
  'la nota de crédito debita el ITBIS de 2102'
);

select * from finish();
rollback;

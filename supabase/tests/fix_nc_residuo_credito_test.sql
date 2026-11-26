begin;
select plan(25);

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

insert into auth.users (id, email) values
  ('a1a1a1a1-1111-1111-1111-111111111111', 'admin-nc-residuo@prueba.local');
insert into public.perfiles (user_id, nombre, rol) values
  ('a1a1a1a1-1111-1111-1111-111111111111', 'Admin NC residuo', 'admin');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id)
select 'contacto', public.crear_contacto(jsonb_build_object(
  'tipo', 'cliente',
  'nombre', 'Cliente NC residuo'
));

insert into _ids (clave, id)
select 'producto', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Producto NC residuo',
  'precio', 33.33::numeric,
  'itbis_tasa', 18.00::numeric,
  'inventariable', true,
  'cantidad', 20.00::numeric,
  'costo', 10.00::numeric
));

-- ---------------------------------------------------------------------------
-- Bug A: tres NC parciales agotan la línea y cuadran exactas
--
-- Factura de 3 x 33.33 con 10 % de descuento:
--   bruto 99.99, descuento 10.00, subtotal 89.99, ITBIS 16.20, total 106.19.
-- Cada NC de 1 unidad prorratea 30.00 + 5.40 = 35.40; la tercera debe tomar
-- el residuo 29.99 + 5.40 = 35.39. Con el prorrateo viejo la tercera nota
-- intenta 35.40 y el crédito total (106.20) supera la factura: se bloqueaba.
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'factura_a', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-20',
  'vencimiento', '2026-12-20',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 3.00::numeric,
    'precio', 33.33::numeric,
    'descuento_pct', 10.00::numeric
  ))
));

insert into _ids (clave, id)
select 'factura_linea_a', fl.id
from public.factura_lineas fl
where fl.factura_id = (select id from _ids where clave = 'factura_a');

select is(
  (select subtotal::numeric(14,2) from public.factura_lineas
    where id = (select id from _ids where clave = 'factura_linea_a')),
  89.99::numeric(14,2),
  'la línea de la factura vale 89.99 con el descuento'
);

insert into _ids (clave, id)
select 'nota_a1', public.crear_nota_credito_venta(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'factura_a'),
  'fecha', '2026-11-20',
  'lineas', jsonb_build_array(jsonb_build_object(
    'factura_linea_id', (select id from _ids where clave = 'factura_linea_a'),
    'cantidad', 1.00::numeric
  ))
));

insert into _ids (clave, id)
select 'nota_a2', public.crear_nota_credito_venta(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'factura_a'),
  'fecha', '2026-11-20',
  'lineas', jsonb_build_array(jsonb_build_object(
    'factura_linea_id', (select id from _ids where clave = 'factura_linea_a'),
    'cantidad', 1.00::numeric
  ))
));

select is(
  (select total::numeric(14,2) from public.notas_credito_venta
    where id = (select id from _ids where clave = 'nota_a1')),
  35.40::numeric(14,2),
  'la NC parcial prorratea 30.00 + 5.40'
);

select is(
  (select total::numeric(14,2) from public.notas_credito_venta
    where id = (select id from _ids where clave = 'nota_a2')),
  35.40::numeric(14,2),
  'la segunda NC parcial prorratea igual'
);

insert into _ids (clave, id)
select 'nota_a3', public.crear_nota_credito_venta(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'factura_a'),
  'fecha', '2026-11-20',
  'lineas', jsonb_build_array(jsonb_build_object(
    'factura_linea_id', (select id from _ids where clave = 'factura_linea_a'),
    'cantidad', 1.00::numeric
  ))
));

select is(
  (select count(*)::int
   from public.notas_credito_venta n
   where n.factura_id = (select id from _ids where clave = 'factura_a')
     and n.estado = 'activa'),
  3,
  'la última unidad sí se puede devolver'
);

select is(
  (select nl.subtotal::numeric(14,2)
   from public.nota_credito_venta_lineas nl
   where nl.nota_id = (select id from _ids where clave = 'nota_a3')),
  29.99::numeric(14,2),
  'la NC que agota la línea toma el subtotal como residuo'
);

select is(
  (select nl.itbis::numeric(14,2)
   from public.nota_credito_venta_lineas nl
   where nl.nota_id = (select id from _ids where clave = 'nota_a3')),
  5.40::numeric(14,2),
  'la NC que agota la línea toma el ITBIS como residuo'
);

select is(
  (select nl.total::numeric(14,2)
   from public.nota_credito_venta_lineas nl
   where nl.nota_id = (select id from _ids where clave = 'nota_a3')),
  35.39::numeric(14,2),
  'la NC que agota la línea totaliza 35.39, no 35.40'
);

select is(
  (select sum(nl.subtotal)::numeric(14,2)
   from public.nota_credito_venta_lineas nl
   where nl.factura_linea_id = (select id from _ids where clave = 'factura_linea_a')),
  89.99::numeric(14,2),
  'la suma de subtotales de las NC cuadra con la línea de la factura'
);

select is(
  (select sum(nl.itbis)::numeric(14,2)
   from public.nota_credito_venta_lineas nl
   where nl.factura_linea_id = (select id from _ids where clave = 'factura_linea_a')),
  16.20::numeric(14,2),
  'la suma de ITBIS de las NC cuadra con la línea de la factura'
);

select is(
  (select credito::numeric(14,2) from public.facturas
    where id = (select id from _ids where clave = 'factura_a')),
  106.19::numeric(14,2),
  'la factura queda acreditada por su total exacto'
);

select is(
  (select round(total - pagado - retenido - credito, 2)::numeric(14,2)
   from public.facturas
   where id = (select id from _ids where clave = 'factura_a')),
  0.00::numeric(14,2),
  'no queda saldo abierto de RD$0.01'
);

select is(
  (select estado from public.facturas
    where id = (select id from _ids where clave = 'factura_a')),
  'pagada',
  'la factura queda pagada con el crédito'
);

select is(
  (select cantidad::numeric(14,2) from public.existencias
    where producto_id = (select id from _ids where clave = 'producto')
      and almacen_id = (select al.id from public.almacenes al where al.es_principal limit 1)),
  20.00::numeric(14,2),
  'las tres unidades devueltas reingresan al inventario'
);

select throws_ok(
  $q$select public.crear_nota_credito_venta(jsonb_build_object(
    'factura_id', (select id from _ids where clave = 'factura_a'),
    'lineas', jsonb_build_array(jsonb_build_object(
      'factura_linea_id', (select id from _ids where clave = 'factura_linea_a'),
      'cantidad', 1
    ))
  ))$q$,
  '22023',
  'la cantidad excede lo disponible por acreditar en la línea',
  'no se acredita más cantidad de la que tiene la línea'
);

-- ---------------------------------------------------------------------------
-- Bug B: NC manual sobre factura pagada no puede sobreacreditar el saldo
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'factura_b', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-21',
  'vencimiento', '2026-12-21',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 1.00::numeric,
    'precio', 100.00::numeric,
    'itbis_tasa', 0.00::numeric
  ))
));

insert into _ids (clave, id)
select 'factura_linea_b', fl.id
from public.factura_lineas fl
where fl.factura_id = (select id from _ids where clave = 'factura_b');

select is(
  (select total::numeric(14,2) from public.facturas
    where id = (select id from _ids where clave = 'factura_b')),
  100.00::numeric(14,2),
  'la factura pagada vale 100.00'
);

select public.registrar_pago_recibido(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'factura_b'),
  'fecha', '2026-11-21',
  'cuenta_id', (select id from public.cuentas where codigo = '1101'),
  'metodo', 'efectivo',
  'monto', 100.00::numeric
));

select is(
  (select pagado::numeric(14,2) from public.facturas
    where id = (select id from _ids where clave = 'factura_b')),
  100.00::numeric(14,2),
  'la factura queda pagada antes de la NC'
);

select throws_ok(
  $q$select public.crear_nota_credito_venta(jsonb_build_object(
    'factura_id', (select id from _ids where clave = 'factura_b'),
    'fecha', '2026-11-21',
    'lineas', jsonb_build_array(jsonb_build_object(
      'factura_linea_id', (select id from _ids where clave = 'factura_linea_b'),
      'cantidad', 1
    ))
  ))$q$,
  '22023',
  'la nota dejaría un crédito de 100.00 sobre una factura con 0.00 pendiente',
  'una NC manual sobre factura pagada rechaza el sobrecrédito'
);

insert into _ids (clave, id)
select 'nota_b', public.crear_nota_credito_venta(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'factura_b'),
  'fecha', '2026-11-21',
  'permite_saldo_a_favor', true,
  'lineas', jsonb_build_array(jsonb_build_object(
    'factura_linea_id', (select id from _ids where clave = 'factura_linea_b'),
    'cantidad', 1.00::numeric
  ))
));

select is(
  (select total::numeric(14,2) from public.notas_credito_venta
    where id = (select id from _ids where clave = 'nota_b')),
  100.00::numeric(14,2),
  'el reembolso explícito sí puede dejar saldo a favor'
);

select is(
  (select credito::numeric(14,2) from public.facturas
    where id = (select id from _ids where clave = 'factura_b')),
  100.00::numeric(14,2),
  'el saldo a favor explícito queda como crédito de la factura'
);

-- ---------------------------------------------------------------------------
-- NC sobre factura sin pagar: sigue funcionando
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'factura_c', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-22',
  'vencimiento', '2026-12-22',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 1.00::numeric,
    'precio', 100.00::numeric,
    'itbis_tasa', 0.00::numeric
  ))
));

insert into _ids (clave, id)
select 'factura_linea_c', fl.id
from public.factura_lineas fl
where fl.factura_id = (select id from _ids where clave = 'factura_c');

select is(
  (select total::numeric(14,2) from public.facturas
    where id = (select id from _ids where clave = 'factura_c')),
  100.00::numeric(14,2),
  'la factura sin pagar vale 100.00'
);

insert into _ids (clave, id)
select 'nota_c', public.crear_nota_credito_venta(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'factura_c'),
  'fecha', '2026-11-22',
  'lineas', jsonb_build_array(jsonb_build_object(
    'factura_linea_id', (select id from _ids where clave = 'factura_linea_c'),
    'cantidad', 1.00::numeric
  ))
));

select is(
  (select total::numeric(14,2) from public.notas_credito_venta
    where id = (select id from _ids where clave = 'nota_c')),
  100.00::numeric(14,2),
  'la NC sobre factura sin pagar sigue funcionando'
);

select is(
  (select credito::numeric(14,2) from public.facturas
    where id = (select id from _ids where clave = 'factura_c')),
  100.00::numeric(14,2),
  'la NC acredita el total pendiente de la factura sin pagar'
);

-- ---------------------------------------------------------------------------
-- NC sobre factura parcialmente pagada: solo hasta lo pendiente
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'factura_d', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-23',
  'vencimiento', '2026-12-23',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 1.00::numeric,
    'precio', 100.00::numeric,
    'itbis_tasa', 0.00::numeric
  ))
));

insert into _ids (clave, id)
select 'factura_linea_d', fl.id
from public.factura_lineas fl
where fl.factura_id = (select id from _ids where clave = 'factura_d');

select public.registrar_pago_recibido(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'factura_d'),
  'fecha', '2026-11-23',
  'cuenta_id', (select id from public.cuentas where codigo = '1101'),
  'metodo', 'efectivo',
  'monto', 40.00::numeric
));

insert into _ids (clave, id)
select 'nota_d1', public.crear_nota_credito_venta(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'factura_d'),
  'fecha', '2026-11-23',
  'lineas', jsonb_build_array(jsonb_build_object(
    'factura_linea_id', (select id from _ids where clave = 'factura_linea_d'),
    'cantidad', 0.50::numeric
  ))
));

select is(
  (select total::numeric(14,2) from public.notas_credito_venta
    where id = (select id from _ids where clave = 'nota_d1')),
  50.00::numeric(14,2),
  'la NC parcial sobre factura con abono usa el prorrateo'
);

select is(
  (select credito::numeric(14,2) from public.facturas
    where id = (select id from _ids where clave = 'factura_d')),
  50.00::numeric(14,2),
  'la NC acredita solo lo que todavía se debe'
);

select throws_ok(
  $q$select public.crear_nota_credito_venta(jsonb_build_object(
    'factura_id', (select id from _ids where clave = 'factura_d'),
    'fecha', '2026-11-23',
    'lineas', jsonb_build_array(jsonb_build_object(
      'factura_linea_id', (select id from _ids where clave = 'factura_linea_d'),
      'cantidad', 0.50
    ))
  ))$q$,
  '22023',
  'la nota dejaría un crédito de 100.00 sobre una factura con 60.00 pendiente',
  'la segunda NC excede lo pendiente de la factura parcialmente pagada'
);

select * from finish();
rollback;

-- ---------------------------------------------------------------------------
-- NCF manual por numeración (fase 1: facturas de venta)
--
-- Cubre: manual no consume la serie, validaciones de prefijo, rango,
-- vencimiento y duplicado, regresión de la automática y el paso de manual a
-- automática en actualizar_numeracion.
-- Corre con "authenticated", como la app: nunca con service_role.
-- ---------------------------------------------------------------------------
begin;
select plan(40);

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

insert into _ids (clave, id)
select 'contacto', public.crear_contacto(jsonb_build_object(
  'tipo', 'cliente',
  'nombre', 'NCF Manual Cliente'
));

insert into _ids (clave, id)
select 'servicio', public.crear_producto(jsonb_build_object(
  'tipo', 'servicio',
  'nombre', 'NCF Manual Servicio',
  'precio', 100.00::numeric,
  'itbis_tasa', 18.00::numeric
));

insert into _ids (clave, id)
select 'num01', n.id from public.numeraciones n
where n.tipo_comprobante = '01' order by n.id limit 1;

insert into _ids (clave, id)
select 'num02', n.id from public.numeraciones n
where n.tipo_comprobante = '02' order by n.id limit 1;

insert into _ids (clave, id)
select 'num15', n.id from public.numeraciones n
where n.tipo_comprobante = '15' order by n.id limit 1;

insert into _ids (clave, id)
select 'num16', n.id from public.numeraciones n
where n.tipo_comprobante = '16' order by n.id limit 1;

-- ---------------------------------------------------------------------------
-- 1. La serie pasa a manual
-- ---------------------------------------------------------------------------
select lives_ok(
  $q$select public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num02'),
    'automatica', false
  ))$q$,
  'B02 pasa a manual'
);

-- ---------------------------------------------------------------------------
-- 2. Factura manual: guarda el NCF y NO consume la serie
-- ---------------------------------------------------------------------------
insert into _ids (clave, id)
select 'factura_manual', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-17',
  'vencimiento', '2026-12-17',
  'ncf_manual', 'B0200000042',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'servicio'),
    'cantidad', 1.00::numeric,
    'precio', 100.00::numeric
  ))
));

select is(
  (select ncf from public.facturas where id = (select id from _ids where clave = 'factura_manual')),
  'B0200000042',
  'guarda el NCF escrito a mano'
);

select is(
  (select siguiente from public.numeraciones where id = (select id from _ids where clave = 'num02')),
  1,
  'el NCF manual no consume la serie'
);

-- ---------------------------------------------------------------------------
-- 3. Factura manual con ITBIS y pago: el wrapper conserva ncf_manual
-- ---------------------------------------------------------------------------
insert into _ids (clave, id)
select 'factura_pago', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-17',
  'vencimiento', '2026-12-17',
  'ncf_manual', 'B0200000043',
  'pago', jsonb_build_object(
    'fecha', '2026-11-17',
    'cuenta_id', (select id from public.cuentas where codigo = '1101'),
    'metodo', 'efectivo',
    'monto', 118.00::numeric
  ),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'servicio'),
    'cantidad', 1.00::numeric,
    'precio', 100.00::numeric
  ))
));

select is(
  (select ncf from public.facturas where id = (select id from _ids where clave = 'factura_pago')),
  'B0200000043',
  'el wrapper de impuestos y pago no pierde el NCF manual'
);

select is(
  (select itbis::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura_pago')),
  18.00::numeric(14,2),
  'el ITBIS se calcula igual en una factura manual'
);

select is(
  (select sum(al.credito)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.facturas where id = (select id from _ids where clave = 'factura_pago'))
     and c.codigo = '2102'),
  18.00::numeric(14,2),
  'el ITBIS se acredita en 2102'
);

select is(
  (select estado from public.facturas where id = (select id from _ids where clave = 'factura_pago')),
  'pagada',
  'el pago de la factura manual se registra'
);

select is(
  (select siguiente from public.numeraciones where id = (select id from _ids where clave = 'num02')),
  1,
  'la factura manual con pago tampoco consume la serie'
);

-- ---------------------------------------------------------------------------
-- 4. Manual sin NCF
-- ---------------------------------------------------------------------------
select throws_ok(
  $q$select public.crear_factura(jsonb_build_object(
    'tipo_comprobante', '02',
    'contacto_id', (select id from _ids where clave = 'contacto'),
    'fecha', '2026-11-17',
    'vencimiento', '2026-12-17',
    'lineas', jsonb_build_array(jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'servicio'),
      'cantidad', 1,
      'precio', 100
    ))
  ))$q$,
  '22023',
  'la numeración B02 es manual; esta factura necesita un NCF escrito a mano',
  'la serie manual exige el NCF'
);

-- ---------------------------------------------------------------------------
-- 5. Prefijo de otra serie
-- ---------------------------------------------------------------------------
select throws_ok(
  $q$select public.crear_factura(jsonb_build_object(
    'tipo_comprobante', '02',
    'contacto_id', (select id from _ids where clave = 'contacto'),
    'fecha', '2026-11-17',
    'vencimiento', '2026-12-17',
    'ncf_manual', 'B0100000044',
    'lineas', jsonb_build_array(jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'servicio'),
      'cantidad', 1,
      'precio', 100
    ))
  ))$q$,
  '22023',
  'el NCF B0100000044 no corresponde a la numeración B02',
  'rechaza un prefijo de otra serie'
);

-- ---------------------------------------------------------------------------
-- 6. NCF duplicado
-- ---------------------------------------------------------------------------
select throws_ok(
  $q$select public.crear_factura(jsonb_build_object(
    'tipo_comprobante', '02',
    'contacto_id', (select id from _ids where clave = 'contacto'),
    'fecha', '2026-11-17',
    'vencimiento', '2026-12-17',
    'ncf_manual', 'B0200000042',
    'lineas', jsonb_build_array(jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'servicio'),
      'cantidad', 1,
      'precio', 100
    ))
  ))$q$,
  '22023',
  'el NCF B0200000042 ya fue usado en otra factura',
  'rechaza un NCF ya usado'
);

select is(
  (select count(*)::int from public.facturas where ncf = 'B0200000042'),
  1,
  'el NCF duplicado no crea una segunda factura'
);

-- ---------------------------------------------------------------------------
-- 7. Número fuera de rango (hasta)
-- ---------------------------------------------------------------------------
select lives_ok(
  $q$select public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num02'),
    'hasta', 50
  ))$q$,
  'en manual se puede bajar el hasta, aunque el contador quede atrás'
);

select throws_ok(
  $q$select public.crear_factura(jsonb_build_object(
    'tipo_comprobante', '02',
    'contacto_id', (select id from _ids where clave = 'contacto'),
    'fecha', '2026-11-17',
    'vencimiento', '2026-12-17',
    'ncf_manual', 'B0200000051',
    'lineas', jsonb_build_array(jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'servicio'),
      'cantidad', 1,
      'precio', 100
    ))
  ))$q$,
  '22023',
  'el NCF B0200000051 está fuera de la serie B02 (hasta 50)',
  'rechaza un número mayor que el hasta'
);

select lives_ok(
  $q$select public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num02'),
    'hasta', 100000
  ))$q$,
  'restaura el hasta de B02'
);

-- ---------------------------------------------------------------------------
-- 8. Número cero y formato de 7 dígitos
-- ---------------------------------------------------------------------------
select throws_ok(
  $q$select public.crear_factura(jsonb_build_object(
    'tipo_comprobante', '02',
    'contacto_id', (select id from _ids where clave = 'contacto'),
    'fecha', '2026-11-17',
    'vencimiento', '2026-12-17',
    'ncf_manual', 'B0200000000',
    'lineas', jsonb_build_array(jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'servicio'),
      'cantidad', 1,
      'precio', 100
    ))
  ))$q$,
  '22023',
  'el NCF B0200000000 no es válido: el número debe ser mayor que cero',
  'rechaza el número cero'
);

select throws_ok(
  $q$select public.crear_factura(jsonb_build_object(
    'tipo_comprobante', '02',
    'contacto_id', (select id from _ids where clave = 'contacto'),
    'fecha', '2026-11-17',
    'vencimiento', '2026-12-17',
    'ncf_manual', 'B020000042',
    'lineas', jsonb_build_array(jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'servicio'),
      'cantidad', 1,
      'precio', 100
    ))
  ))$q$,
  '22023',
  null,
  'rechaza un NCF que no tiene 8 dígitos'
);

-- ---------------------------------------------------------------------------
-- 9. Ceros a la izquierda, minúscula y espacios se normalizan
-- ---------------------------------------------------------------------------
insert into _ids (clave, id)
select 'factura_ceros', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-17',
  'vencimiento', '2026-12-17',
  'ncf_manual', ' b0200000007 ',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'servicio'),
    'cantidad', 1,
    'precio', 100
  ))
));

select is(
  (select ncf from public.facturas where id = (select id from _ids where clave = 'factura_ceros')),
  'B0200000007',
  'normaliza minúscula, espacios y ceros a la izquierda'
);

-- ---------------------------------------------------------------------------
-- 10. Serie vencida
-- ---------------------------------------------------------------------------
select lives_ok(
  $q$select public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num02'),
    'vence', '2026-01-01'
  ))$q$,
  'pone el vence de B02 en el pasado'
);

select throws_ok(
  $q$select public.crear_factura(jsonb_build_object(
    'tipo_comprobante', '02',
    'contacto_id', (select id from _ids where clave = 'contacto'),
    'fecha', '2026-11-17',
    'vencimiento', '2026-12-17',
    'ncf_manual', 'B0200000045',
    'lineas', jsonb_build_array(jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'servicio'),
      'cantidad', 1,
      'precio', 100
    ))
  ))$q$,
  '22023',
  'la numeración B02 está vencida',
  'rechaza una serie vencida en manual'
);

select lives_ok(
  $q$select public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num02'),
    'vence', null
  ))$q$,
  'quita el vence de B02'
);

-- ---------------------------------------------------------------------------
-- 11. Sin numeración activa
-- ---------------------------------------------------------------------------
select lives_ok(
  $q$select public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num15'),
    'activa', false
  ))$q$,
  'desactiva B15'
);

select throws_ok(
  $q$select public.crear_factura(jsonb_build_object(
    'tipo_comprobante', '15',
    'contacto_id', (select id from _ids where clave = 'contacto'),
    'fecha', '2026-11-17',
    'vencimiento', '2026-12-17',
    'lineas', jsonb_build_array(jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'servicio'),
      'cantidad', 1,
      'precio', 100
    ))
  ))$q$,
  '22023',
  'no hay numeración activa para el comprobante 15',
  'sin numeración activa no hay factura'
);

select is(
  (select count(*)::int from public.facturas where tipo_comprobante = '15'),
  0,
  'no queda factura del tipo sin numeración activa'
);

select lives_ok(
  $q$select public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num15'),
    'activa', true
  ))$q$,
  'reactiva B15'
);

-- ---------------------------------------------------------------------------
-- 12. Automática con ncf_manual
-- ---------------------------------------------------------------------------
select throws_ok(
  $q$select public.crear_factura(jsonb_build_object(
    'tipo_comprobante', '16',
    'contacto_id', (select id from _ids where clave = 'contacto'),
    'fecha', '2026-11-17',
    'vencimiento', '2026-12-17',
    'ncf_manual', 'B1600000001',
    'lineas', jsonb_build_array(jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'servicio'),
      'cantidad', 1,
      'precio', 100
    ))
  ))$q$,
  '22023',
  'la numeración B16 es automática; el NCF no se escribe a mano',
  'una serie automática rechaza el NCF manual'
);

select is(
  (select siguiente from public.numeraciones where id = (select id from _ids where clave = 'num16')),
  1,
  'el rechazo no consume la serie automática'
);

-- ---------------------------------------------------------------------------
-- 13. Regresión: la automática sigue igual
-- ---------------------------------------------------------------------------
insert into _ids (clave, id)
select 'factura16', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '16',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-17',
  'vencimiento', '2026-12-17',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'servicio'),
    'cantidad', 1.00::numeric,
    'precio', 100.00::numeric
  ))
));

select is(
  (select ncf from public.facturas where id = (select id from _ids where clave = 'factura16')),
  'B1600000001',
  'la numeración automática sigue generando prefijo + siguiente'
);

select is(
  (select siguiente from public.numeraciones where id = (select id from _ids where clave = 'num16')),
  2,
  'la factura automática avanza siguiente en 1'
);

-- ---------------------------------------------------------------------------
-- 14. Volver a automática con el contador atrasado
--    Último NCF de B02 emitido a mano: 43.
-- ---------------------------------------------------------------------------
select throws_ok(
  $q$select public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num02'),
    'automatica', true,
    'siguiente', 5
  ))$q$,
  '22023',
  'no puedes activar la numeración automática: el siguiente (5) debe ser mayor que el último NCF emitido (43)',
  'no se puede activar automática con el siguiente atrasado'
);

select lives_ok(
  $q$select public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num02'),
    'automatica', true,
    'siguiente', 44
  ))$q$,
  'vuelve a automática con el siguiente por encima del último NCF'
);

select is(
  (select (n.automatica)::text || ':' || n.siguiente
   from public.numeraciones n where n.id = (select id from _ids where clave = 'num02')),
  'true:44',
  'la serie queda automática y con el contador sano'
);

-- ---------------------------------------------------------------------------
-- 15. Preferida: una sola, activa
-- ---------------------------------------------------------------------------
select lives_ok(
  $q$select public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num01'),
    'preferida', true
  ))$q$,
  'B01 se marca preferida'
);

select lives_ok(
  $q$select public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num02'),
    'preferida', true
  ))$q$,
  'B02 se marca preferida y limpia la anterior'
);

select is(
  (select count(*)::int from public.numeraciones where preferida),
  1,
  'solo hay una numeración preferida'
);

select is(
  (select prefijo from public.numeraciones where preferida),
  'B02',
  'la preferida es la última marcada'
);

select throws_ok(
  $q$select public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from public.numeraciones where tipo_comprobante = '03' order by id limit 1),
    'automatica', false
  ))$q$,
  '22023',
  'la numeración automática o manual solo aplica a facturas de venta',
  'una nota de débito no admite el modo manual'
);

select throws_ok(
  $q$select public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from _ids where clave = 'num02'),
    'activa', false,
    'preferida', true
  ))$q$,
  '22023',
  'una numeración preferida debe estar activa',
  'una preferida no puede quedar inactiva'
);

-- ---------------------------------------------------------------------------
-- 16. Roles y función interna
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  $q$select public.crear_factura(jsonb_build_object(
    'tipo_comprobante', '02',
    'contacto_id', (select id from _ids where clave = 'contacto'),
    'fecha', '2026-11-17',
    'vencimiento', '2026-12-17',
    'ncf_manual', 'B0200000046',
    'lineas', jsonb_build_array(jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'servicio'),
      'cantidad', 1,
      'precio', 100
    ))
  ))$q$,
  '42501',
  'sin permiso',
  'el lector no puede crear una factura manual'
);

select throws_ok(
  $q$select public._ncf_factura('02', current_date, null)$q$,
  '42501',
  null,
  '_ncf_factura no se concede a authenticated'
);

reset role;
select * from finish();
rollback;

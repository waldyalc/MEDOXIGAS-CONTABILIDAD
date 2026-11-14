begin;
select plan(36);

insert into auth.users (id, email) values
  ('aaaaaaaa-1111-1111-1111-111111111111', 'admin.inventario2@prueba.local'),
  ('bbbbbbbb-2222-2222-2222-222222222222', 'lector.inventario2@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('aaaaaaaa-1111-1111-1111-111111111111', 'Admin Inventario 2', 'admin'),
  ('bbbbbbbb-2222-2222-2222-222222222222', 'Lector Inventario 2', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-1111-1111-111111111111","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Producto con existencia inicial en el almacén Principal
-- ---------------------------------------------------------------------------

select public.crear_producto(
  '{"tipo":"producto","nombre":"Producto Test Inventario 2","precio":650,"itbis_tasa":18,"inventariable":true,"cantidad":10,"costo":100}'::jsonb
);

select is(
  (select cantidad from public.productos where nombre = 'Producto Test Inventario 2'),
  10.00::numeric,
  'crear_producto guarda la existencia total'
);

select is(
  (select e.cantidad
     from public.existencias e
     join public.productos p on p.id = e.producto_id
     join public.almacenes a on a.id = e.almacen_id
    where p.nombre = 'Producto Test Inventario 2' and a.es_principal),
  10.00::numeric,
  'crear_producto siembra la existencia en el almacén Principal'
);

-- ---------------------------------------------------------------------------
-- Almacén de prueba y transferencia
-- ---------------------------------------------------------------------------

select public.crear_almacen('{"nombre":"Bodega Test Inventario 2"}'::jsonb);

select is(
  (select count(*) from public.almacenes where nombre = 'Bodega Test Inventario 2'),
  1::bigint,
  'crear_almacen agrega la bodega de prueba'
);

select public.crear_transferencia_inventario(
  jsonb_build_object(
    'fecha', '2026-11-14',
    'origen_id', (select id from public.almacenes where es_principal),
    'destino_id', (select id from public.almacenes where nombre = 'Bodega Test Inventario 2'),
    'lineas', jsonb_build_array(jsonb_build_object(
      'producto_id', (select id from public.productos where nombre = 'Producto Test Inventario 2'),
      'cantidad', 3
    ))
  )
);

select is(
  (select e.cantidad
     from public.existencias e
     join public.productos p on p.id = e.producto_id
     join public.almacenes a on a.id = e.almacen_id
    where p.nombre = 'Producto Test Inventario 2' and a.es_principal),
  7.00::numeric,
  'la transferencia baja la existencia del almacén de origen'
);

select is(
  (select e.cantidad
     from public.existencias e
     join public.productos p on p.id = e.producto_id
     join public.almacenes a on a.id = e.almacen_id
    where p.nombre = 'Producto Test Inventario 2' and a.nombre = 'Bodega Test Inventario 2'),
  3.00::numeric,
  'la transferencia sube la existencia del almacén de destino'
);

select is(
  (select cantidad from public.productos where nombre = 'Producto Test Inventario 2'),
  10.00::numeric,
  'la transferencia no cambia la existencia total'
);

select is(
  (select estado from public.transferencias_inventario order by numero desc limit 1),
  'activa',
  'la transferencia nace activa'
);

select is(
  (select count(*) from public.transferencia_inventario_lineas where transferencia_id = (
    select id from public.transferencias_inventario order by numero desc limit 1
  )),
  1::bigint,
  'la transferencia guarda sus líneas'
);

select public.anular_transferencia_inventario(
  (select id from public.transferencias_inventario order by numero desc limit 1)
);

select is(
  (select e.cantidad
     from public.existencias e
     join public.productos p on p.id = e.producto_id
     join public.almacenes a on a.id = e.almacen_id
    where p.nombre = 'Producto Test Inventario 2' and a.es_principal),
  10.00::numeric,
  'anular la transferencia devuelve la existencia al origen'
);

select is(
  (select e.cantidad
     from public.existencias e
     join public.productos p on p.id = e.producto_id
     join public.almacenes a on a.id = e.almacen_id
    where p.nombre = 'Producto Test Inventario 2' and a.nombre = 'Bodega Test Inventario 2'),
  0.00::numeric,
  'anular la transferencia deja el destino en cero'
);

select is(
  (select estado from public.transferencias_inventario order by numero desc limit 1),
  'anulada',
  'anular la transferencia la marca anulada'
);

select throws_ok(
  $q$select public.anular_transferencia_inventario(
    (select id from public.transferencias_inventario order by numero desc limit 1)
  )$q$,
  '22023',
  null,
  'no permite anular dos veces la misma transferencia'
);

select throws_ok(
  $q$select public.crear_transferencia_inventario(jsonb_build_object(
    'origen_id', (select id from public.almacenes where es_principal),
    'destino_id', (select id from public.almacenes where nombre = 'Bodega Test Inventario 2'),
    'lineas', jsonb_build_array(jsonb_build_object(
      'producto_id', (select id from public.productos where nombre = 'Producto Test Inventario 2'),
      'cantidad', 999
    ))
  ))$q$,
  '22023',
  null,
  'rechaza transferir más de la existencia disponible'
);

select throws_ok(
  $q$select public.crear_transferencia_inventario(jsonb_build_object(
    'origen_id', (select id from public.almacenes where es_principal),
    'destino_id', (select id from public.almacenes where nombre = 'Bodega Test Inventario 2'),
    'lineas', jsonb_build_array(
      jsonb_build_object(
        'producto_id', (select id from public.productos where nombre = 'Producto Test Inventario 2'),
        'cantidad', 1
      ),
      jsonb_build_object(
        'producto_id', (select id from public.productos where nombre = 'Producto Test Inventario 2'),
        'cantidad', 1
      )
    )
  ))$q$,
  '22023',
  null,
  'rechaza repetir el mismo producto en una transferencia'
);

-- ---------------------------------------------------------------------------
-- Ajuste: mueve existencia y se puede anular
-- ---------------------------------------------------------------------------

select public.crear_ajuste_inventario(
  jsonb_build_object(
    'fecha', '2026-11-14',
    'almacen_id', (select id from public.almacenes where es_principal),
    'lineas', jsonb_build_array(jsonb_build_object(
      'producto_id', (select id from public.productos where nombre = 'Producto Test Inventario 2'),
      'tipo', 'salida',
      'cantidad', 2
    ))
  )
);

select is(
  (select cantidad from public.productos where nombre = 'Producto Test Inventario 2'),
  8.00::numeric,
  'el ajuste de salida baja la existencia total'
);

select is(
  (select e.cantidad
     from public.existencias e
     join public.productos p on p.id = e.producto_id
     join public.almacenes a on a.id = e.almacen_id
    where p.nombre = 'Producto Test Inventario 2' and a.es_principal),
  8.00::numeric,
  'el ajuste de salida baja la existencia del almacén'
);

select is(
  (select estado from public.ajustes_inventario order by numero desc limit 1),
  'activo',
  'el ajuste nace activo'
);

select is(
  (select coalesce(sum(al.debito) - sum(al.credito), 0)
     from public.ajustes_inventario ai
     join public.asiento_lineas al on al.asiento_id = ai.asiento_id
    where ai.id = (select id from public.ajustes_inventario order by numero desc limit 1)),
  0::numeric,
  'el asiento del ajuste está cuadrado'
);

select public.anular_documento(
  'ajuste_inventario',
  (select id from public.ajustes_inventario order by numero desc limit 1)
);

select is(
  (select cantidad from public.productos where nombre = 'Producto Test Inventario 2'),
  10.00::numeric,
  'anular el ajuste devuelve la existencia total'
);

select is(
  (select e.cantidad
     from public.existencias e
     join public.productos p on p.id = e.producto_id
     join public.almacenes a on a.id = e.almacen_id
    where p.nombre = 'Producto Test Inventario 2' and a.es_principal),
  10.00::numeric,
  'anular el ajuste devuelve la existencia al almacén'
);

select is(
  (select estado from public.ajustes_inventario order by numero desc limit 1),
  'anulada',
  'anular el ajuste lo marca anulado'
);

select ok(
  exists (
    select 1
    from public.asientos r
    join public.ajustes_inventario ai on ai.asiento_id = r.anula_asiento_id
    where ai.id = (select id from public.ajustes_inventario order by numero desc limit 1)
  ),
  'anular el ajuste crea el asiento de reversión'
);

select throws_ok(
  $q$select public.anular_documento(
    'ajuste_inventario',
    (select id from public.ajustes_inventario order by numero desc limit 1)
  )$q$,
  '22023',
  null,
  'no permite anular dos veces el mismo ajuste'
);

-- ---------------------------------------------------------------------------
-- Listas de precios y contacto
-- ---------------------------------------------------------------------------

select public.crear_lista_precio(
  '{"nombre":"Lista Test Inventario 2","tipo":"porcentaje"}'::jsonb
);

select is(
  (select tipo from public.listas_precios where nombre = 'Lista Test Inventario 2'),
  'porcentaje',
  'crear_lista_precio guarda el tipo porcentaje'
);

select public.actualizar_producto(
  (select id from public.productos where nombre = 'Producto Test Inventario 2'),
  jsonb_build_object(
    'precios', jsonb_build_array(jsonb_build_object(
      'lista_id', (select id from public.listas_precios where nombre = 'Lista Test Inventario 2'),
      'precio', 10
    ))
  )
);

select is(
  (select pp.precio
     from public.producto_precios pp
     join public.productos p on p.id = pp.producto_id
     join public.listas_precios lp on lp.id = pp.lista_id
    where p.nombre = 'Producto Test Inventario 2' and lp.nombre = 'Lista Test Inventario 2'),
  10.00::numeric,
  'actualizar_producto guarda el precio por lista'
);

select public.crear_contacto(
  jsonb_build_object(
    'nombre', 'Cliente Lista Test Inventario 2',
    'tipo', 'cliente',
    'lista_precio_id', (select id from public.listas_precios where nombre = 'Lista Test Inventario 2')
  )
);

select is(
  (select lista_precio_id from public.contactos where nombre = 'Cliente Lista Test Inventario 2'),
  (select id from public.listas_precios where nombre = 'Lista Test Inventario 2'),
  'crear_contacto guarda la lista de precios por defecto'
);

select throws_ok(
  $q$select public.crear_contacto(
    jsonb_build_object(
      'nombre', 'Cliente Lista Inválida Inventario 2',
      'tipo', 'cliente',
      'lista_precio_id', '00000000-0000-0000-0000-000000000001'
    )
  )$q$,
  '22023',
  null,
  'rechaza una lista de precios inexistente'
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'public.existencias', 'SELECT')
  and has_table_privilege('authenticated', 'public.listas_precios', 'SELECT')
  and has_table_privilege('authenticated', 'public.producto_precios', 'SELECT'),
  'authenticated puede leer existencias y listas de precios'
);

select ok(
  not has_table_privilege('authenticated', 'public.existencias', 'INSERT')
  and not has_table_privilege('authenticated', 'public.existencias', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.existencias', 'DELETE'),
  'authenticated no escribe directo en existencias'
);

-- ---------------------------------------------------------------------------
-- Factura de venta: descuenta del almacén del documento
-- ---------------------------------------------------------------------------

select public.crear_transferencia_inventario(
  jsonb_build_object(
    'fecha', '2026-11-14',
    'origen_id', (select id from public.almacenes where es_principal),
    'destino_id', (select id from public.almacenes where nombre = 'Bodega Test Inventario 2'),
    'lineas', jsonb_build_array(jsonb_build_object(
      'producto_id', (select id from public.productos where nombre = 'Producto Test Inventario 2'),
      'cantidad', 4
    ))
  )
);

select is(
  (select e.cantidad
     from public.existencias e
     join public.productos p on p.id = e.producto_id
     join public.almacenes a on a.id = e.almacen_id
    where p.nombre = 'Producto Test Inventario 2' and a.nombre = 'Bodega Test Inventario 2'),
  4.00::numeric,
  'la segunda transferencia deja 4 en la bodega'
);

select is(
  (select e.cantidad
     from public.existencias e
     join public.productos p on p.id = e.producto_id
     join public.almacenes a on a.id = e.almacen_id
    where p.nombre = 'Producto Test Inventario 2' and a.es_principal),
  6.00::numeric,
  'la segunda transferencia deja 6 en el Principal'
);

select public.crear_factura(
  jsonb_build_object(
    'tipo_comprobante', '02',
    'contacto_id', (select id from public.contactos where nombre = 'Cliente Lista Test Inventario 2'),
    'almacen_id', (select id from public.almacenes where nombre = 'Bodega Test Inventario 2'),
    'fecha', '2026-11-14',
    'vencimiento', '2026-11-14',
    'lineas', jsonb_build_array(jsonb_build_object(
      'producto_id', (select id from public.productos where nombre = 'Producto Test Inventario 2'),
      'cantidad', 1,
      'precio', 650
    ))
  )
);

select is(
  (select e.cantidad
     from public.existencias e
     join public.productos p on p.id = e.producto_id
     join public.almacenes a on a.id = e.almacen_id
    where p.nombre = 'Producto Test Inventario 2' and a.nombre = 'Bodega Test Inventario 2'),
  3.00::numeric,
  'la factura descuenta del almacén indicado'
);

select is(
  (select cantidad from public.productos where nombre = 'Producto Test Inventario 2'),
  9.00::numeric,
  'la factura baja la existencia total'
);

select public.anular_documento(
  'factura',
  (select f.id
     from public.facturas f
     join public.contactos c on c.id = f.contacto_id
    where c.nombre = 'Cliente Lista Test Inventario 2'
    order by f.numero desc
    limit 1)
);

select is(
  (select e.cantidad
     from public.existencias e
     join public.productos p on p.id = e.producto_id
     join public.almacenes a on a.id = e.almacen_id
    where p.nombre = 'Producto Test Inventario 2' and a.nombre = 'Bodega Test Inventario 2'),
  4.00::numeric,
  'anular la factura devuelve la existencia a su almacén'
);

select is(
  (select cantidad from public.productos where nombre = 'Producto Test Inventario 2'),
  10.00::numeric,
  'anular la factura restaura la existencia total'
);

set local request.jwt.claims = '{"sub":"bbbbbbbb-2222-2222-2222-222222222222","role":"authenticated"}';

select throws_ok(
  $q$select public.crear_transferencia_inventario(jsonb_build_object(
    'origen_id', (select id from public.almacenes where es_principal),
    'destino_id', (select id from public.almacenes where nombre = 'Bodega Test Inventario 2'),
    'lineas', jsonb_build_array(jsonb_build_object(
      'producto_id', (select id from public.productos where nombre = 'Producto Test Inventario 2'),
      'cantidad', 1
    ))
  ))$q$,
  '42501',
  null,
  'el rol lector no puede crear transferencias'
);

select * from finish();
rollback;

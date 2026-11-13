begin;
select plan(26);

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
-- Almacenes
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from public.almacenes where es_principal),
  1::bigint,
  'hay un almacén principal sembrado'
);

select is(
  (select nombre from public.almacenes where es_principal),
  'Principal',
  'el almacén principal se llama Principal'
);

select public.crear_almacen('{"nombre":"Sucursal"}'::jsonb);

select is(
  (select count(*) from public.almacenes),
  2::bigint,
  'crear_almacen agrega un almacén'
);

select public.actualizar_almacen(
  (select id from public.almacenes where nombre = 'Sucursal'),
  '{"nombre":"Sucursal Norte"}'::jsonb
);

select is(
  (select nombre from public.almacenes where nombre = 'Sucursal Norte'),
  'Sucursal Norte',
  'actualizar_almacen cambia el nombre'
);

-- ---------------------------------------------------------------------------
-- Categorías
-- ---------------------------------------------------------------------------

select public.crear_categoria_producto(
  '{"nombre":"Herramientas","descripcion":"Herramientas de trabajo"}'::jsonb
);

select is(
  (select nombre from public.categorias_productos where nombre = 'Herramientas'),
  'Herramientas',
  'crear_categoria_producto guarda la categoría'
);

select public.actualizar_categoria_producto(
  (select id from public.categorias_productos where nombre = 'Herramientas'),
  '{"nombre":"Herramientas manuales"}'::jsonb
);

select is(
  (select nombre from public.categorias_productos where nombre = 'Herramientas manuales'),
  'Herramientas manuales',
  'actualizar_categoria_producto cambia el nombre'
);

-- ---------------------------------------------------------------------------
-- Producto con categoría
-- ---------------------------------------------------------------------------

select public.crear_producto(
  jsonb_build_object(
    'tipo', 'producto',
    'nombre', 'Cemento gris 42.5kg',
    'precio', 650,
    'itbis_tasa', 18,
    'inventariable', true,
    'cantidad', 10,
    'costo', 100,
    'categoria_id', (select id from public.categorias_productos where nombre = 'Herramientas manuales')
  )
);

select public.crear_producto(
  '{"tipo":"servicio","nombre":"Transporte","precio":500,"itbis_tasa":18}'::jsonb
);

select is(
  (select c.nombre
     from public.productos p
     join public.categorias_productos c on c.id = p.categoria_id
    where p.nombre = 'Cemento gris 42.5kg'),
  'Herramientas manuales',
  'crear_producto guarda la categoría'
);

-- ---------------------------------------------------------------------------
-- Ajuste de entrada
-- ---------------------------------------------------------------------------

select public.crear_ajuste_inventario(
  jsonb_build_object(
    'fecha', '2026-11-14',
    'almacen_id', (select id from public.almacenes where es_principal),
    'observaciones', 'Conteo físico',
    'lineas', jsonb_build_array(
      jsonb_build_object(
        'producto_id', (select id from public.productos where nombre = 'Cemento gris 42.5kg'),
        'tipo', 'entrada',
        'cantidad', 5,
        'costo_unitario', 120
      )
    )
  )
);

select is(
  (select cantidad from public.productos where nombre = 'Cemento gris 42.5kg'),
  15.00::numeric,
  'entrada: la cantidad sube de 10 a 15'
);

select is(
  (select costo from public.productos where nombre = 'Cemento gris 42.5kg'),
  106.67::numeric,
  'entrada: el costo promedio pasa a 106.67'
);

select is(
  (select total from public.ajustes_inventario order by numero limit 1),
  600.00::numeric,
  'entrada: el total ajustado es 600.00'
);

select is(
  (select almacen_id::text from public.ajustes_inventario order by numero limit 1),
  (select id::text from public.almacenes where es_principal),
  'el ajuste guarda el almacén Principal'
);

select is(
  (select a.origen_tipo
     from public.ajustes_inventario ai
     join public.asientos a on a.id = ai.asiento_id
    order by ai.numero
    limit 1),
  'ajuste_inventario',
  'el asiento usa origen ajuste_inventario'
);

select is(
  (select sum(al.debito) - sum(al.credito)
     from public.ajustes_inventario ai
     join public.asiento_lineas al on al.asiento_id = ai.asiento_id
    where ai.numero = 1),
  0::numeric,
  'asiento del ajuste cuadrado'
);

select is(
  (select coalesce(sum(al.debito), 0)
     from public.ajustes_inventario ai
     join public.asiento_lineas al on al.asiento_id = ai.asiento_id
     join public.cuentas c on c.id = al.cuenta_id
    where ai.numero = 1
      and c.codigo = '1104'),
  600.00::numeric,
  'entrada: Dr 1104 inventario = 600.00'
);

select is(
  (select coalesce(sum(al.credito), 0)
     from public.ajustes_inventario ai
     join public.asiento_lineas al on al.asiento_id = ai.asiento_id
     join public.cuentas c on c.id = al.cuenta_id
    where ai.numero = 1
      and c.codigo = '5102'),
  600.00::numeric,
  'entrada: Cr 5102 ajustes de inventario = 600.00'
);

select is(
  (select tipo from public.ajuste_inventario_lineas order by id limit 1),
  'entrada',
  'la línea guarda el tipo entrada'
);

-- ---------------------------------------------------------------------------
-- Ajuste de salida (costo en blanco: toma el promedio del producto)
-- ---------------------------------------------------------------------------

select public.crear_ajuste_inventario(
  jsonb_build_object(
    'fecha', '2026-11-14',
    'almacen_id', (select id from public.almacenes where es_principal),
    'lineas', jsonb_build_array(
      jsonb_build_object(
        'producto_id', (select id from public.productos where nombre = 'Cemento gris 42.5kg'),
        'tipo', 'salida',
        'cantidad', 3
      )
    )
  )
);

select is(
  (select cantidad from public.productos where nombre = 'Cemento gris 42.5kg'),
  12.00::numeric,
  'salida: la cantidad baja de 15 a 12'
);

select is(
  (select costo from public.productos where nombre = 'Cemento gris 42.5kg'),
  106.67::numeric,
  'salida: el costo promedio no cambia'
);

select is(
  (select total from public.ajustes_inventario order by numero desc limit 1),
  320.01::numeric,
  'salida: el total ajustado es 3 x 106.67 = 320.01'
);

select is(
  (select coalesce(sum(al.debito), 0)
     from public.ajustes_inventario ai
     join public.asiento_lineas al on al.asiento_id = ai.asiento_id
     join public.cuentas c on c.id = al.cuenta_id
    where ai.numero = 2
      and c.codigo = '5102'),
  320.01::numeric,
  'salida: Dr 5102 ajustes de inventario = 320.01'
);

select is(
  (select coalesce(sum(al.credito), 0)
     from public.ajustes_inventario ai
     join public.asiento_lineas al on al.asiento_id = ai.asiento_id
     join public.cuentas c on c.id = al.cuenta_id
    where ai.numero = 2
      and c.codigo = '1104'),
  320.01::numeric,
  'salida: Cr 1104 inventario = 320.01'
);

-- ---------------------------------------------------------------------------
-- Validaciones
-- ---------------------------------------------------------------------------

select throws_ok(
  $q$select public.crear_ajuste_inventario(jsonb_build_object(
    'fecha', '2026-11-14',
    'almacen_id', (select id from public.almacenes where es_principal),
    'lineas', '[]'::jsonb
  ))$q$,
  '22023',
  null,
  'rechaza un ajuste sin líneas'
);

select throws_ok(
  $q$select public.crear_ajuste_inventario(jsonb_build_object(
    'fecha', '2026-11-14',
    'almacen_id', (select id from public.almacenes where es_principal),
    'lineas', jsonb_build_array(jsonb_build_object(
      'producto_id', (select id from public.productos where nombre = 'Transporte'),
      'tipo', 'entrada',
      'cantidad', 1,
      'costo_unitario', 100
    ))
  ))$q$,
  '22023',
  null,
  'rechaza un producto que no controla inventario'
);

-- ---------------------------------------------------------------------------
-- RLS y rol lector
-- ---------------------------------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'public.almacenes', 'SELECT')
  and has_table_privilege('authenticated', 'public.categorias_productos', 'SELECT')
  and has_table_privilege('authenticated', 'public.ajustes_inventario', 'SELECT')
  and has_table_privilege('authenticated', 'public.ajuste_inventario_lineas', 'SELECT'),
  'authenticated puede leer las tablas de inventario'
);

select ok(
  not has_table_privilege('authenticated', 'public.ajustes_inventario', 'INSERT')
  and not has_table_privilege('authenticated', 'public.ajustes_inventario', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.ajustes_inventario', 'DELETE'),
  'authenticated no escribe directo en ajustes_inventario'
);

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  $q$select public.crear_ajuste_inventario(jsonb_build_object(
    'fecha', '2026-11-14',
    'almacen_id', (select id from public.almacenes where es_principal),
    'lineas', jsonb_build_array(jsonb_build_object(
      'producto_id', (select id from public.productos where nombre = 'Cemento gris 42.5kg'),
      'tipo', 'entrada',
      'cantidad', 1,
      'costo_unitario', 100
    ))
  ))$q$,
  '42501',
  null,
  'el rol lector no puede crear ajustes'
);

select * from finish();
rollback;

begin;
select plan(22);

insert into auth.users (id, email) values
  ('c1c1c1c1-1111-1111-1111-111111111111', 'admin.campos.alegra@prueba.local'),
  ('c2c2c2c2-2222-2222-2222-222222222222', 'lector.campos.alegra@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('c1c1c1c1-1111-1111-1111-111111111111', 'Admin campos Alegra', 'admin'),
  ('c2c2c2c2-2222-2222-2222-222222222222', 'Lector campos Alegra', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"c1c1c1c1-1111-1111-1111-111111111111","role":"authenticated"}';

select public.crear_almacen('{"nombre":"Bodega Campos Alegra"}'::jsonb);

-- ---------------------------------------------------------------------------
-- Alta con los campos nuevos: combo, unidad, almacén, imagen y min/max
-- ---------------------------------------------------------------------------

select public.crear_producto(jsonb_build_object(
  'tipo', 'combo',
  'nombre', 'Combo Campos Alegra',
  'unidad_medida', 'Caja',
  'almacen_id', (select id from public.almacenes where es_principal),
  'vende_negativo', true,
  'imagen_path', 'productos/combo-alegra.png',
  'inventariable', true,
  'cantidad', 5,
  'costo', 100,
  'precio', 200,
  'itbis_tasa', 18,
  'existencias', jsonb_build_array(
    jsonb_build_object(
      'almacen_id', (select id from public.almacenes where es_principal),
      'minimo', 2,
      'maximo', 20
    ),
    jsonb_build_object(
      'almacen_id', (select id from public.almacenes where nombre = 'Bodega Campos Alegra'),
      'minimo', 1,
      'maximo', 10
    )
  )
));

select ok(
  (select id from public.productos where nombre = 'Combo Campos Alegra') is not null,
  'crear_producto acepta el tipo combo'
);

select is(
  (select p.tipo from public.productos p where p.nombre = 'Combo Campos Alegra'),
  'combo',
  'el producto combo conserva su tipo'
);

select is(
  (select p.unidad_medida from public.productos p where p.nombre = 'Combo Campos Alegra'),
  'Caja',
  'crear_producto guarda la unidad de medida'
);

select is(
  (select a.nombre
     from public.productos p
     join public.almacenes a on a.id = p.almacen_id
    where p.nombre = 'Combo Campos Alegra'),
  'Principal',
  'crear_producto guarda el almacén del producto'
);

select is(
  (select p.vende_negativo from public.productos p where p.nombre = 'Combo Campos Alegra'),
  true,
  'crear_producto guarda la venta en negativo'
);

select is(
  (select p.imagen_path from public.productos p where p.nombre = 'Combo Campos Alegra'),
  'productos/combo-alegra.png',
  'crear_producto guarda la ruta de la imagen'
);

select is(
  (select p.inventariable from public.productos p where p.nombre = 'Combo Campos Alegra'),
  false,
  'un combo no controla inventario'
);

select is(
  (select e.cantidad_inicial
     from public.existencias e
     join public.productos p on p.id = e.producto_id
     join public.almacenes a on a.id = e.almacen_id
    where p.nombre = 'Combo Campos Alegra' and a.es_principal),
  0.00::numeric,
  'un combo sin inventario no siembra cantidad inicial'
);

select is(
  (select e.minimo
     from public.existencias e
     join public.productos p on p.id = e.producto_id
     join public.almacenes a on a.id = e.almacen_id
    where p.nombre = 'Combo Campos Alegra' and a.es_principal),
  2.00::numeric,
  'crear_producto guarda el mínimo por almacén'
);

select is(
  (select count(*)
     from public.existencias e
     join public.productos p on p.id = e.producto_id
    where p.nombre = 'Combo Campos Alegra'),
  2::bigint,
  'crear_producto registra los mínimos de los dos almacenes'
);

-- ---------------------------------------------------------------------------
-- Edición: unidad, venta en negativo, imagen y min/max sin tocar cantidades
-- ---------------------------------------------------------------------------

select public.actualizar_producto(
  (select id from public.productos where nombre = 'Combo Campos Alegra'),
  jsonb_build_object(
    'unidad_medida', 'Libra',
    'vende_negativo', false,
    'imagen_path', 'productos/combo-alegra-2.png',
    'existencias', jsonb_build_array(
      jsonb_build_object(
        'almacen_id', (select id from public.almacenes where es_principal),
        'minimo', 3,
        'maximo', 30
      )
    )
  )
);

select is(
  (select p.unidad_medida from public.productos p where p.nombre = 'Combo Campos Alegra'),
  'Libra',
  'actualizar_producto cambia la unidad de medida'
);

select is(
  (select p.vende_negativo from public.productos p where p.nombre = 'Combo Campos Alegra'),
  false,
  'actualizar_producto cambia la venta en negativo'
);

select is(
  (select p.imagen_path from public.productos p where p.nombre = 'Combo Campos Alegra'),
  'productos/combo-alegra-2.png',
  'actualizar_producto cambia la imagen'
);

select is(
  (select e.maximo
     from public.existencias e
     join public.productos p on p.id = e.producto_id
     join public.almacenes a on a.id = e.almacen_id
    where p.nombre = 'Combo Campos Alegra' and a.es_principal),
  30.00::numeric,
  'actualizar_producto cambia el máximo por almacén'
);

select is(
  (select e.cantidad
     from public.existencias e
     join public.productos p on p.id = e.producto_id
     join public.almacenes a on a.id = e.almacen_id
    where p.nombre = 'Combo Campos Alegra' and a.es_principal),
  0.00::numeric,
  'editar los mínimos no mueve la cantidad actual'
);

-- Se crea un producto inventariable para comprobar que la cantidad no cambia.
select public.crear_producto(
  '{"tipo":"producto","nombre":"Producto Campos Alegra","precio":10,"inventariable":true,"cantidad":7}'::jsonb
);

select public.actualizar_producto(
  (select id from public.productos where nombre = 'Producto Campos Alegra'),
  '{"minimo":2,"maximo":15}'::jsonb
);

select is(
  (select e.cantidad_inicial
     from public.existencias e
     join public.productos p on p.id = e.producto_id
     join public.almacenes a on a.id = e.almacen_id
    where p.nombre = 'Producto Campos Alegra' and a.es_principal),
  7.00::numeric,
  'la cantidad inicial de un producto inventariable es su alta'
);

select is(
  (select e.cantidad
     from public.existencias e
     join public.productos p on p.id = e.producto_id
     join public.almacenes a on a.id = e.almacen_id
    where p.nombre = 'Producto Campos Alegra' and a.es_principal),
  7.00::numeric,
  'actualizar mínimos sueltos tampoco mueve la cantidad'
);

select is(
  (select p.unidad_medida from public.productos p where p.nombre = 'Producto Campos Alegra'),
  'Unidad',
  'la unidad por defecto es Unidad'
);

-- ---------------------------------------------------------------------------
-- Validaciones
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.crear_producto('{"tipo":"paquete","nombre":"Inválido"}'::jsonb)$$,
  '22023',
  'tipo de producto inválido',
  'rechaza un tipo que no sea producto, servicio o combo'
);

select throws_ok(
  $$select public.crear_producto('{"tipo":"producto","nombre":"Sin unidad","unidad_medida":"  "}'::jsonb)$$,
  '22023',
  'la unidad de medida es obligatoria',
  'rechaza una unidad de medida vacía'
);

select throws_ok(
  $$select public.actualizar_producto(
      (select id from public.productos where nombre = 'Producto Campos Alegra'),
      '{"minimo":10,"maximo":5}'::jsonb
    )$$,
  '22023',
  'el máximo no puede ser menor que el mínimo',
  'rechaza un máximo menor que el mínimo'
);

-- ---------------------------------------------------------------------------
-- El lector no puede escribir
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"c2c2c2c2-2222-2222-2222-222222222222","role":"authenticated"}';

select throws_ok(
  $$select public.crear_producto('{"tipo":"producto","nombre":"Lector no puede"}'::jsonb)$$,
  '42501',
  'sin permiso',
  'un lector no puede crear productos'
);

select * from finish();
rollback;

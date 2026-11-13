begin;
select plan(37);

create temp table _ids (clave text primary key, id uuid) on commit drop;
create temp table _valores (clave text primary key, valor text) on commit drop;
grant select, insert, update, delete on _ids to authenticated;
grant select, insert, update, delete on _valores to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local'),
  ('22222222-2222-2222-2222-222222222222', 'contador@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Contador', 'contador'),
  ('33333333-3333-3333-3333-333333333333', 'Lector', 'lector');

insert into _valores (clave, valor)
values ('ncf_proveedor', 'B01' || lpad((floor(random() * 90000000) + 10000000)::int::text, 8, '0'));

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id)
select 'contacto_constructora', public.crear_contacto(
  '{"tipo":"cliente","nombre":"Constructora Prueba CMP"}'::jsonb
);

insert into _ids (clave, id)
select 'contacto_juan', public.crear_contacto(
  '{"tipo":"cliente","nombre":"Juan Pérez CMP"}'::jsonb
);

insert into _ids (clave, id)
select 'contacto_proveedor', public.crear_contacto(
  '{"tipo":"proveedor","nombre":"Cementos Prueba CMP"}'::jsonb
);

insert into _ids (clave, id)
select v.clave, public.crear_producto(v.datos)
from (values
  ('cemento', jsonb_build_object('tipo', 'producto', 'nombre', 'Cemento gris CMP', 'precio', 650.00::numeric, 'itbis_tasa', 18.00::numeric, 'inventariable', true, 'cantidad', 50.00::numeric, 'costo', 390.00::numeric)),
  ('varilla', jsonb_build_object('tipo', 'producto', 'nombre', 'Varilla CMP', 'precio', 380.00::numeric, 'itbis_tasa', 18.00::numeric, 'inventariable', true, 'cantidad', 50.00::numeric, 'costo', 228.00::numeric)),
  ('tubo', jsonb_build_object('tipo', 'producto', 'nombre', 'Tubo PVC CMP', 'precio', 150.00::numeric, 'itbis_tasa', 18.00::numeric, 'inventariable', true, 'cantidad', 50.00::numeric, 'costo', 90.00::numeric)),
  ('pintura', jsonb_build_object('tipo', 'producto', 'nombre', 'Pintura galón CMP', 'precio', 1450.00::numeric, 'itbis_tasa', 18.00::numeric, 'inventariable', true, 'cantidad', 50.00::numeric, 'costo', 870.00::numeric)),
  ('clavos', jsonb_build_object('tipo', 'producto', 'nombre', 'Clavos CMP', 'precio', 85.00::numeric, 'itbis_tasa', 18.00::numeric, 'inventariable', true, 'cantidad', 50.00::numeric, 'costo', 51.00::numeric)),
  ('cable', jsonb_build_object('tipo', 'producto', 'nombre', 'Cable THHN CMP', 'precio', 45.00::numeric, 'itbis_tasa', 18.00::numeric, 'inventariable', true, 'cantidad', 50.00::numeric, 'costo', 27.00::numeric)),
  ('llave', jsonb_build_object('tipo', 'producto', 'nombre', 'Llave de paso CMP', 'precio', 350.00::numeric, 'itbis_tasa', 18.00::numeric, 'inventariable', true, 'cantidad', 50.00::numeric, 'costo', 210.00::numeric)),
  ('bombillo', jsonb_build_object('tipo', 'producto', 'nombre', 'Bombillo LED CMP', 'precio', 120.00::numeric, 'itbis_tasa', 18.00::numeric, 'inventariable', true, 'cantidad', 50.00::numeric, 'costo', 72.00::numeric))
) as v(clave, datos);

insert into _ids (clave, id)
select 'factura_b01', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '01',
  'contacto_id', (select id from _ids where clave = 'contacto_constructora'),
  'fecha', '2097-11-13',
  'vencimiento', '2097-12-13',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'cemento'),
      'cantidad', 10.00::numeric,
      'precio', 650.00::numeric
    ),
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'varilla'),
      'cantidad', 20.00::numeric,
      'precio', 380.00::numeric
    )
  )
));

insert into _ids (clave, id)
select 'factura_b02', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto_juan'),
  'fecha', '2097-11-13',
  'vencimiento', '2097-12-13',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'tubo'),
      'cantidad', 10.00::numeric,
      'precio', 150.00::numeric
    ),
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'pintura'),
      'cantidad', 2.00::numeric,
      'precio', 1450.00::numeric
    )
  ),
  'pago', jsonb_build_object(
    'cuenta_id', (select id from public.cuentas where codigo = '1101'),
    'metodo', 'efectivo',
    'monto', 5192.00::numeric
  )
));

insert into _ids (clave, id)
select 'pago_b01', public.registrar_pago_recibido(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'factura_b01'),
  'fecha', '2097-11-13',
  'cuenta_id', (select id from public.cuentas where codigo = '1101'),
  'metodo', 'transferencia',
  'monto', 8000.00::numeric
));

insert into _ids (clave, id)
select 'factura_proveedor', public.crear_factura_proveedor(jsonb_build_object(
  'ncf', (select valor from _valores where clave = 'ncf_proveedor'),
  'contacto_id', (select id from _ids where clave = 'contacto_proveedor'),
  'fecha', '2097-11-13',
  'vencimiento', '2097-12-13',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'cemento'),
      'cantidad', 100.00::numeric,
      'costo', 390.00::numeric,
      'itbis_tasa', 18.00::numeric
    )
  )
));

insert into _ids (clave, id)
select 'pago_proveedor', public.registrar_pago_proveedor(jsonb_build_object(
  'factura_proveedor_id', (select id from _ids where clave = 'factura_proveedor'),
  'fecha', '2097-11-13',
  'cuenta_id', (select id from public.cuentas where codigo = '1102'),
  'metodo', 'transferencia',
  'monto', 46020.00::numeric
));

insert into _ids (clave, id)
select 'gasto_combustible', public.crear_gasto_menor(jsonb_build_object(
  'fecha', '2097-11-13',
  'descripcion', 'Transporte CMP',
  'subtotal', 500.00::numeric,
  'cuenta_gasto_id', (select id from public.cuentas where codigo = '6105'),
  'cuenta_pago_id', (select id from public.cuentas where codigo = '1106')
));

insert into _ids (clave, id)
select 'gasto_agua', public.crear_gasto_menor(jsonb_build_object(
  'fecha', '2097-11-13',
  'descripcion', 'Agua CMP',
  'subtotal', 250.00::numeric,
  'cuenta_gasto_id', (select id from public.cuentas where codigo = '6106'),
  'cuenta_pago_id', (select id from public.cuentas where codigo = '1106')
));

insert into _ids (clave, id)
select 'gasto_papeleria', public.crear_gasto_menor(jsonb_build_object(
  'fecha', '2097-11-13',
  'descripcion', 'Papelería CMP',
  'subtotal', 300.00::numeric,
  'cuenta_gasto_id', (select id from public.cuentas where codigo = '6107'),
  'cuenta_pago_id', (select id from public.cuentas where codigo = '1106')
));

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.facturas f
   join public.asiento_lineas al on al.asiento_id = f.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where f.id = (select id from _ids where clave = 'factura_b01')
     and c.codigo = '1103'),
  16638.00::numeric(14,2),
  'FV B01: Dr 1103 CxC = 16638.00'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.facturas f
   join public.asiento_lineas al on al.asiento_id = f.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where f.id = (select id from _ids where clave = 'factura_b01')
     and c.codigo = '4101'),
  14100.00::numeric(14,2),
  'FV B01: Cr 4101 Ventas = 14100.00'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.facturas f
   join public.asiento_lineas al on al.asiento_id = f.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where f.id = (select id from _ids where clave = 'factura_b01')
     and c.codigo = '2102'),
  2538.00::numeric(14,2),
  'FV B01: Cr 2102 ITBIS por pagar = 2538.00'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.facturas f
   join public.asiento_lineas al on al.asiento_id = f.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where f.id = (select id from _ids where clave = 'factura_b01')
     and c.codigo = '5101'),
  8460.00::numeric(14,2),
  'FV B01: Dr 5101 Costo de ventas = 8460.00'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.facturas f
   join public.asiento_lineas al on al.asiento_id = f.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where f.id = (select id from _ids where clave = 'factura_b01')
     and c.codigo = '1104'),
  8460.00::numeric(14,2),
  'FV B01: Cr 1104 Inventarios = 8460.00'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.facturas f
   join public.asiento_lineas al on al.asiento_id = f.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where f.id = (select id from _ids where clave = 'factura_b02')
     and c.codigo = '1103'),
  5192.00::numeric(14,2),
  'FV B02: Dr 1103 CxC = 5192.00'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.facturas f
   join public.asiento_lineas al on al.asiento_id = f.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where f.id = (select id from _ids where clave = 'factura_b02')
     and c.codigo = '4101'),
  4400.00::numeric(14,2),
  'FV B02: Cr 4101 Ventas = 4400.00'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.facturas f
   join public.asiento_lineas al on al.asiento_id = f.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where f.id = (select id from _ids where clave = 'factura_b02')
     and c.codigo = '2102'),
  792.00::numeric(14,2),
  'FV B02: Cr 2102 ITBIS por pagar = 792.00'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.facturas f
   join public.asiento_lineas al on al.asiento_id = f.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where f.id = (select id from _ids where clave = 'factura_b02')
     and c.codigo = '5101'),
  2640.00::numeric(14,2),
  'FV B02: Dr 5101 Costo de ventas = 2640.00'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.facturas f
   join public.asiento_lineas al on al.asiento_id = f.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where f.id = (select id from _ids where clave = 'factura_b02')
     and c.codigo = '1104'),
  2640.00::numeric(14,2),
  'FV B02: Cr 1104 Inventarios = 2640.00'
);

-- DIFERENCIA vs Alegra: Alegra cobró la B02 con "Tarjeta de crédito empresarial";
-- aquí usamos a propósito Caja general (1101), que es la regla de nuestro motor.
select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.pagos_recibidos p
   join public.asiento_lineas al on al.asiento_id = p.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where p.factura_id = (select id from _ids where clave = 'factura_b02')
     and c.codigo = '1101'),
  5192.00::numeric(14,2),
  'pago B02: Dr 1101 Caja general = 5192.00'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.pagos_recibidos p
   join public.asiento_lineas al on al.asiento_id = p.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where p.factura_id = (select id from _ids where clave = 'factura_b02')
     and c.codigo = '1103'),
  5192.00::numeric(14,2),
  'pago B02: Cr 1103 CxC = 5192.00'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.pagos_recibidos p
   join public.asiento_lineas al on al.asiento_id = p.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where p.factura_id = (select id from _ids where clave = 'factura_b01')
     and c.codigo = '1101'),
  8000.00::numeric(14,2),
  'pago recibido B01: Dr 1101 Caja general = 8000.00'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.pagos_recibidos p
   join public.asiento_lineas al on al.asiento_id = p.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where p.factura_id = (select id from _ids where clave = 'factura_b01')
     and c.codigo = '1103'),
  8000.00::numeric(14,2),
  'pago recibido B01: Cr 1103 CxC = 8000.00'
);

select is(
  (select (f.total - f.pagado)::numeric(14,2)
   from public.facturas f
   where f.id = (select id from _ids where clave = 'factura_b01')),
  8638.00::numeric(14,2),
  'saldo pendiente de la B01 = 8638.00'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.facturas_proveedor fp
   join public.asiento_lineas al on al.asiento_id = fp.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where fp.id = (select id from _ids where clave = 'factura_proveedor')
     and c.codigo = '1104'),
  39000.00::numeric(14,2),
  'FP: Dr 1104 Inventarios = 39000.00'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.facturas_proveedor fp
   join public.asiento_lineas al on al.asiento_id = fp.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where fp.id = (select id from _ids where clave = 'factura_proveedor')
     and c.codigo = '1105'),
  7020.00::numeric(14,2),
  'FP: Dr 1105 ITBIS a favor = 7020.00'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.facturas_proveedor fp
   join public.asiento_lineas al on al.asiento_id = fp.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where fp.id = (select id from _ids where clave = 'factura_proveedor')
     and c.codigo = '2101'),
  46020.00::numeric(14,2),
  'FP: Cr 2101 CxP = 46020.00'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.pagos_proveedor pp
   join public.asiento_lineas al on al.asiento_id = pp.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where pp.factura_proveedor_id = (select id from _ids where clave = 'factura_proveedor')
     and c.codigo = '2101'),
  46020.00::numeric(14,2),
  'pago proveedor: Dr 2101 CxP = 46020.00'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.pagos_proveedor pp
   join public.asiento_lineas al on al.asiento_id = pp.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where pp.factura_proveedor_id = (select id from _ids where clave = 'factura_proveedor')
     and c.codigo = '1102'),
  46020.00::numeric(14,2),
  'pago proveedor: Cr 1102 Banco = 46020.00'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.gastos_menores g
   join public.asiento_lineas al on al.asiento_id = g.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where g.id = (select id from _ids where clave = 'gasto_combustible')
     and c.codigo = '6105'),
  500.00::numeric(14,2),
  'gasto menor 1: Dr 6105 Combustibles = 500.00'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.gastos_menores g
   join public.asiento_lineas al on al.asiento_id = g.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where g.id = (select id from _ids where clave = 'gasto_combustible')
     and c.codigo = '1106'),
  500.00::numeric(14,2),
  'gasto menor 1: Cr 1106 Caja chica = 500.00'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.gastos_menores g
   join public.asiento_lineas al on al.asiento_id = g.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where g.id = (select id from _ids where clave = 'gasto_agua')
     and c.codigo = '6106'),
  250.00::numeric(14,2),
  'gasto menor 2: Dr 6106 Agua = 250.00'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.gastos_menores g
   join public.asiento_lineas al on al.asiento_id = g.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where g.id = (select id from _ids where clave = 'gasto_agua')
     and c.codigo = '1106'),
  250.00::numeric(14,2),
  'gasto menor 2: Cr 1106 Caja chica = 250.00'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.gastos_menores g
   join public.asiento_lineas al on al.asiento_id = g.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where g.id = (select id from _ids where clave = 'gasto_papeleria')
     and c.codigo = '6107'),
  300.00::numeric(14,2),
  'gasto menor 3: Dr 6107 Papelería = 300.00'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.gastos_menores g
   join public.asiento_lineas al on al.asiento_id = g.asiento_id
   join public.cuentas c on c.id = al.cuenta_id
   where g.id = (select id from _ids where clave = 'gasto_papeleria')
     and c.codigo = '1106'),
  300.00::numeric(14,2),
  'gasto menor 3: Cr 1106 Caja chica = 300.00'
);

select is(
  (select p.cantidad::numeric(14,2)
   from public.productos p
   where p.id = (select id from _ids where clave = 'cemento')),
  140.00::numeric(14,2),
  'existencia final de Cemento = 140'
);

select is(
  (select p.cantidad::numeric(14,2)
   from public.productos p
   where p.id = (select id from _ids where clave = 'varilla')),
  30.00::numeric(14,2),
  'existencia final de Varilla = 30'
);

select is(
  (select p.cantidad::numeric(14,2)
   from public.productos p
   where p.id = (select id from _ids where clave = 'tubo')),
  40.00::numeric(14,2),
  'existencia final de Tubo PVC = 40'
);

select is(
  (select p.cantidad::numeric(14,2)
   from public.productos p
   where p.id = (select id from _ids where clave = 'pintura')),
  48.00::numeric(14,2),
  'existencia final de Pintura = 48'
);

select is(
  (select count(*)::int
   from public.productos p
   where p.id in (
     select id from _ids
     where clave in ('clavos', 'cable', 'llave', 'bombillo')
   )
     and p.cantidad = 50),
  4,
  'los demás productos conservan 50 unidades'
);

select is(
  (select coalesce(sum(monto), 0)::numeric(14,2)
   from public.reporte_estado_resultados('2097-11-13', '2097-11-13')
   where tipo = 'ingreso'),
  18500.00::numeric(14,2),
  'estado de resultados: ingresos = 18500.00'
);

select is(
  (select coalesce(sum(monto), 0)::numeric(14,2)
   from public.reporte_estado_resultados('2097-11-13', '2097-11-13')
   where tipo = 'costo'),
  11100.00::numeric(14,2),
  'estado de resultados: costos = 11100.00'
);

select is(
  (select coalesce(sum(monto), 0)::numeric(14,2)
   from public.reporte_estado_resultados('2097-11-13', '2097-11-13')
   where tipo = 'gasto'),
  1050.00::numeric(14,2),
  'estado de resultados: gastos = 1050.00'
);

select is(
  (select coalesce(sum(case when tipo = 'ingreso' then monto else -monto end), 0)::numeric(14,2)
   from public.reporte_estado_resultados('2097-11-13', '2097-11-13')),
  6350.00::numeric(14,2),
  'estado de resultados: utilidad = 6350.00'
);

select is(
  (select coalesce(sum(p.cantidad * p.costo), 0)::numeric(14,2)
   from public.productos p
   where p.id in (
     select id from _ids
     where clave in ('cemento', 'varilla', 'tubo', 'pintura', 'clavos', 'cable', 'llave', 'bombillo')
   )),
  124800.00::numeric(14,2),
  'valor de inventario = 124800.00'
);

select is(
  (select coalesce(sum(r.saldo), 0)::numeric(14,2)
   from public.reporte_cxc('2097-11-13') r
   where r.factura_id in (
     (select id from _ids where clave = 'factura_b01'),
     (select id from _ids where clave = 'factura_b02')
   )),
  8638.00::numeric(14,2),
  'reporte_cxc: por cobrar de las facturas del test = 8638.00'
);

select * from finish();
rollback;

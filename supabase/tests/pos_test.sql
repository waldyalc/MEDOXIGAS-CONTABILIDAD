begin;
select plan(91);

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

-- La migración de tablas siembra las cuentas de arqueo. Si el entorno de la
-- prueba no las tiene, se crean aquí para que el cierre sea determinista.
insert into public.config_contable (clave, cuenta_id)
select 'sobrante_caja', c.id from public.cuentas c where c.codigo = '4101'
on conflict (clave) do nothing;

insert into public.config_contable (clave, cuenta_id)
select 'faltante_caja', c.id from public.cuentas c where c.codigo = '6101'
on conflict (clave) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id)
select 'almacen', a.id from public.almacenes a where a.es_principal limit 1;

insert into _ids (clave, id)
select 'numeracion', n.id from public.numeraciones n
where n.tipo_comprobante = '02' and n.activa
order by n.id limit 1;

insert into _ids (clave, id)
select 'caja', public.crear_cuenta(jsonb_build_object(
  'codigo', '1901', 'nombre', 'Caja POS pgTAP', 'tipo', 'activo', 'naturaleza', 'debito',
  'es_caja_banco', true, 'acepta_movimientos', true
));

insert into _ids (clave, id)
select 'banco', public.crear_cuenta(jsonb_build_object(
  'codigo', '1902', 'nombre', 'Banco POS pgTAP', 'tipo', 'activo', 'naturaleza', 'debito',
  'es_caja_banco', true, 'acepta_movimientos', true
));

insert into _ids (clave, id)
select 'tarjeta', public.crear_cuenta(jsonb_build_object(
  'codigo', '1903', 'nombre', 'Tarjeta POS pgTAP', 'tipo', 'activo', 'naturaleza', 'debito',
  'es_caja_banco', true, 'acepta_movimientos', true
));

insert into _ids (clave, id)
select 'caja2', public.crear_cuenta(jsonb_build_object(
  'codigo', '1904', 'nombre', 'Caja POS 2 pgTAP', 'tipo', 'activo', 'naturaleza', 'debito',
  'es_caja_banco', true, 'acepta_movimientos', true
));

insert into _ids (clave, id)
select 'consumidor', public.crear_contacto(jsonb_build_object(
  'tipo', 'cliente', 'nombre', 'Consumidor Final POS pgTAP'
));

insert into _ids (clave, id)
select 'cliente', public.crear_contacto(jsonb_build_object(
  'tipo', 'cliente', 'nombre', 'Cliente POS pgTAP', 'limite_credito', '1000'
));

-- ---------------------------------------------------------------------------
-- Terminales
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'terminal', public.pos_crear_terminal(jsonb_build_object(
  'nombre', 'Caja POS pgTAP',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'cuenta_efectivo_id', (select id from _ids where clave = 'caja'),
  'cuenta_tarjeta_debito_id', (select id from _ids where clave = 'tarjeta'),
  'cuenta_transferencia_id', (select id from _ids where clave = 'banco'),
  'numeracion_defecto_id', (select id from _ids where clave = 'numeracion'),
  'contacto_defecto_id', (select id from _ids where clave = 'consumidor')
));

select is(
  (select nombre from public.pos_terminales where id = (select id from _ids where clave = 'terminal')),
  'Caja POS pgTAP',
  'pos_crear_terminal guarda la terminal'
);

select is(
  (select activa from public.pos_terminales where id = (select id from _ids where clave = 'terminal')),
  true,
  'la terminal nace activa'
);

select is(
  (select plantilla_ticket->>'estilo' from public.pos_terminales
    where id = (select id from _ids where clave = 'terminal')),
  'clasico',
  'la plantilla del ticket arranca con el estilo clásico'
);

select throws_ok(
  $q$select public.pos_crear_terminal(jsonb_build_object(
    'nombre', 'Caja inválida pgTAP',
    'almacen_id', (select id from _ids where clave = 'almacen'),
    'cuenta_efectivo_id', (select id from public.cuentas where codigo = '1103'),
    'numeracion_defecto_id', (select id from _ids where clave = 'numeracion'),
    'contacto_defecto_id', (select id from _ids where clave = 'consumidor')
  ))$q$,
  '22023',
  'la cuenta de efectivo debe ser una cuenta de caja o banco activa',
  'la cuenta de efectivo debe ser de caja o banco'
);

select throws_ok(
  $q$select public.pos_crear_terminal(jsonb_build_object(
    'nombre', 'Caja repetida pgTAP',
    'almacen_id', (select id from _ids where clave = 'almacen'),
    'cuenta_efectivo_id', (select id from _ids where clave = 'caja'),
    'numeracion_defecto_id', (select id from _ids where clave = 'numeracion'),
    'contacto_defecto_id', (select id from _ids where clave = 'consumidor')
  ))$q$,
  '22023',
  'ya existe una terminal activa con esa cuenta de efectivo',
  'dos terminales activas no comparten el cajón'
);

select throws_ok(
  $q$select public.pos_crear_terminal(jsonb_build_object(
    'nombre', 'Caja POS pgTAP',
    'almacen_id', (select id from _ids where clave = 'almacen'),
    'cuenta_efectivo_id', (select id from _ids where clave = 'caja2'),
    'numeracion_defecto_id', (select id from _ids where clave = 'numeracion'),
    'contacto_defecto_id', (select id from _ids where clave = 'consumidor')
  ))$q$,
  '22023',
  'ya existe una terminal con ese nombre',
  'el nombre de la terminal es único'
);

-- ---------------------------------------------------------------------------
-- Turno: apertura, candado y base
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'turno', (public.pos_abrir_turno(jsonb_build_object(
  'terminal_id', (select id from _ids where clave = 'terminal'),
  'base_inicial', 100
))->'turno'->>'id')::uuid;

select is(
  (select estado from public.pos_turnos where id = (select id from _ids where clave = 'turno')),
  'abierto',
  'pos_abrir_turno deja el turno abierto'
);

select is(
  (select base_inicial from public.pos_turnos where id = (select id from _ids where clave = 'turno')),
  100::numeric,
  'el turno guarda la base inicial'
);

select is(
  ((public.pos_resumen_turno((select id from _ids where clave = 'turno')))->'resumen'->'efectivo'->>'efectivo_esperado')::numeric,
  100::numeric,
  'sin movimientos el efectivo esperado es la base inicial'
);

select throws_ok(
  $q$select public.pos_abrir_turno(jsonb_build_object(
    'terminal_id', (select id from _ids where clave = 'terminal')
  ))$q$,
  '22023',
  null,
  'no se abre un segundo turno en la misma terminal'
);

select throws_ok(
  $q$select public.pos_abrir_turno(jsonb_build_object(
    'terminal_id', (select id from _ids where clave = 'terminal'),
    'base_inicial', -5
  ))$q$,
  '22023',
  'la base inicial no puede ser negativa',
  'la base inicial no puede ser negativa'
);

-- ---------------------------------------------------------------------------
-- Venta simple en efectivo
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'venta_simple', (public.pos_completar_venta(jsonb_build_object(
  'terminal_id', (select id from _ids where clave = 'terminal'),
  'venta_simple', jsonb_build_object('descripcion', 'Venta simple pgTAP', 'monto', 100, 'itbis_tasa', 0),
  'pagos', jsonb_build_array(jsonb_build_object(
    'metodo', 'efectivo', 'monto', 100, 'monto_recibido', 100
  ))
))->'factura'->>'id')::uuid;

select is(
  (select total from public.facturas where id = (select id from _ids where clave = 'venta_simple')),
  100::numeric,
  'la venta simple crea una factura por el monto exacto'
);

select is(
  (select origen from public.facturas where id = (select id from _ids where clave = 'venta_simple')),
  'pos',
  'la factura del POS queda con origen pos'
);

select is(
  (select turno_id from public.facturas where id = (select id from _ids where clave = 'venta_simple')),
  (select id from _ids where clave = 'turno'),
  'la factura queda ligada al turno'
);

select is(
  (select monto_recibido from public.facturas where id = (select id from _ids where clave = 'venta_simple')),
  100::numeric,
  'monto_recibido guarda el efectivo entregado'
);

select is(
  (select cambio from public.facturas where id = (select id from _ids where clave = 'venta_simple')),
  0::numeric,
  'sin excedente el cambio es cero'
);

select is(
  (select estado from public.facturas where id = (select id from _ids where clave = 'venta_simple')),
  'pagada',
  'con pago completo la factura queda pagada'
);

select is(
  ((public.pos_resumen_turno((select id from _ids where clave = 'turno')))->'resumen'->'efectivo'->>'efectivo_esperado')::numeric,
  200::numeric,
  'la venta en efectivo sube el esperado por lo aplicado'
);

-- ---------------------------------------------------------------------------
-- Venta con producto y pago combinado (efectivo + tarjeta)
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'producto', public.crear_producto(jsonb_build_object(
  'tipo', 'producto', 'nombre', 'Martillo POS pgTAP', 'referencia', 'MART-POS',
  'precio', 100, 'itbis_tasa', 18, 'inventariable', true, 'cantidad', 10, 'costo', 40
));

insert into _ids (clave, id)
select 'venta_combo', (public.pos_completar_venta(jsonb_build_object(
  'terminal_id', (select id from _ids where clave = 'terminal'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 2
  )),
  'pagos', jsonb_build_array(
    jsonb_build_object('metodo', 'efectivo', 'monto', 100, 'monto_recibido', 150),
    jsonb_build_object('metodo', 'tarjeta_debito', 'monto', 136)
  )
))->'factura'->>'id')::uuid;

insert into _ids (clave, id)
select 'venta_combo_linea', fl.id
from public.factura_lineas fl
where fl.factura_id = (select id from _ids where clave = 'venta_combo');

select is(
  (select total from public.facturas where id = (select id from _ids where clave = 'venta_combo')),
  236::numeric,
  'el motor calcula 2 x 100 + 18 por ciento de ITBIS'
);

select is(
  (select itbis from public.facturas where id = (select id from _ids where clave = 'venta_combo')),
  36::numeric,
  'el ITBIS de la venta combinada es 36'
);

select is(
  (select monto_recibido from public.facturas where id = (select id from _ids where clave = 'venta_combo')),
  150::numeric,
  'monto_recibido suma solo el efectivo bruto'
);

select is(
  (select cambio from public.facturas where id = (select id from _ids where clave = 'venta_combo')),
  50::numeric,
  'el cambio se calcula solo sobre el efectivo'
);

select is(
  (select pagado from public.facturas where id = (select id from _ids where clave = 'venta_combo')),
  236::numeric,
  'el pago combinado cubre el total'
);

select is(
  (select count(*) from public.pagos_recibidos
    where factura_id = (select id from _ids where clave = 'venta_combo')),
  2::bigint,
  'el pago combinado crea un recibo por método'
);

select is(
  (select metodo from public.pagos_recibidos
    where factura_id = (select id from _ids where clave = 'venta_combo')
      and cuenta_id = (select id from _ids where clave = 'tarjeta')),
  'tarjeta',
  'la tarjeta de débito se registra como tarjeta'
);

select is(
  (select cantidad from public.existencias
    where producto_id = (select id from _ids where clave = 'producto')
      and almacen_id = (select id from _ids where clave = 'almacen')),
  8::numeric,
  'la venta descarga el inventario del almacén de la terminal'
);

select is(
  ((public.pos_resumen_turno((select id from _ids where clave = 'turno')))->'resumen'
     ->'ventas'->'por_metodo'->>'efectivo')::numeric,
  200::numeric,
  'el esperado suma lo aplicado en efectivo, no lo recibido'
);

-- ---------------------------------------------------------------------------
-- Crédito: Consumidor Final bloqueado y límite del contacto
-- ---------------------------------------------------------------------------

select throws_ok(
  $q$select public.pos_completar_venta(jsonb_build_object(
    'terminal_id', (select id from _ids where clave = 'terminal'),
    'venta_simple', jsonb_build_object('descripcion', 'Crédito CF pgTAP', 'monto', 50, 'itbis_tasa', 0)
  ))$q$,
  '22023',
  'no se puede vender a crédito al Consumidor Final; selecciona un cliente o cobra el total',
  'no se fía al Consumidor Final'
);

insert into _ids (clave, id)
select 'venta_credito', (public.pos_completar_venta(jsonb_build_object(
  'terminal_id', (select id from _ids where clave = 'terminal'),
  'contacto_id', (select id from _ids where clave = 'cliente'),
  'venta_simple', jsonb_build_object('descripcion', 'Crédito cliente pgTAP', 'monto', 50, 'itbis_tasa', 0)
))->'factura'->>'id')::uuid;

select is(
  (select estado from public.facturas where id = (select id from _ids where clave = 'venta_credito')),
  'abierta',
  'la venta a crédito nace abierta'
);

select is(
  (select pagado from public.facturas where id = (select id from _ids where clave = 'venta_credito')),
  0::numeric,
  'la venta a crédito no registra pago'
);

select throws_ok(
  $q$select public.pos_completar_venta(jsonb_build_object(
    'terminal_id', (select id from _ids where clave = 'terminal'),
    'contacto_id', (select id from _ids where clave = 'cliente'),
    'venta_simple', jsonb_build_object('descripcion', 'Excede límite pgTAP', 'monto', 1000, 'itbis_tasa', 0)
  ))$q$,
  '22023',
  null,
  'la venta que excede el límite de crédito se rechaza'
);

select is(
  ((public.pos_resumen_turno((select id from _ids where clave = 'turno')))->'resumen'->'efectivo'->>'efectivo_esperado')::numeric,
  300::numeric,
  'una venta a crédito no mueve el efectivo esperado'
);

-- ---------------------------------------------------------------------------
-- Cotización rápida y conversión
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'cotizacion', (public.pos_crear_cotizacion(jsonb_build_object(
  'terminal_id', (select id from _ids where clave = 'terminal'),
  'venta_simple', jsonb_build_object('descripcion', 'Cotización pgTAP', 'monto', 100, 'itbis_tasa', 0)
))->'cotizacion'->>'id')::uuid;

select is(
  (select origen from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  'pos',
  'la cotización rápida queda con origen pos'
);

select is(
  (select turno_id from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  (select id from _ids where clave = 'turno'),
  'la cotización rápida queda ligada al turno abierto'
);

select is(
  (select total from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  100::numeric,
  'la cotización rápida copia el total de la venta simple'
);

insert into _ids (clave, id)
select 'venta_cotizacion', (public.pos_completar_venta(jsonb_build_object(
  'terminal_id', (select id from _ids where clave = 'terminal'),
  'cotizacion_id', (select id from _ids where clave = 'cotizacion'),
  'pagos', jsonb_build_array(jsonb_build_object('metodo', 'efectivo', 'monto', 100))
))->'factura'->>'id')::uuid;

select is(
  (select estado from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  'convertida',
  'convertir la cotización la deja convertida'
);

select is(
  (select factura_id from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  (select id from _ids where clave = 'venta_cotizacion'),
  'la cotización convertida apunta a la factura'
);

select is(
  (select origen from public.facturas where id = (select id from _ids where clave = 'venta_cotizacion')),
  'pos',
  'la factura de la cotización es una venta POS'
);

select throws_ok(
  $q$select public.pos_completar_venta(jsonb_build_object(
    'terminal_id', (select id from _ids where clave = 'terminal'),
    'cotizacion_id', (select id from _ids where clave = 'cotizacion'),
    'pagos', jsonb_build_array(jsonb_build_object('metodo', 'efectivo', 'monto', 100))
  ))$q$,
  '22023',
  'la cotización no existe o no está abierta',
  'no se convierte dos veces la misma cotización'
);

-- ---------------------------------------------------------------------------
-- Movimientos de turno: ingreso, retiro y gasto menor
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'mov_ingreso', (public.pos_registrar_movimiento_turno(jsonb_build_object(
  'turno_id', (select id from _ids where clave = 'turno'),
  'tipo', 'ingreso',
  'motivo', 'fondo_caja',
  'monto', 500,
  'cuenta_contrapartida_id', (select id from _ids where clave = 'banco')
))->'movimiento'->>'id')::uuid;

select is(
  (select a.origen_tipo
   from public.pos_turno_movimientos m
   join public.asientos a on a.id = m.asiento_id
   where m.id = (select id from _ids where clave = 'mov_ingreso')),
  'pos_movimiento',
  'el ingreso directo genera un asiento pos_movimiento'
);

select is(
  (select sum(l.debito)
   from public.pos_turno_movimientos m
   join public.asiento_lineas l on l.asiento_id = m.asiento_id
   where m.id = (select id from _ids where clave = 'mov_ingreso')
     and l.cuenta_id = (select id from _ids where clave = 'caja')),
  500::numeric,
  'el ingreso debita la caja de la terminal'
);

select is(
  (select sum(l.credito)
   from public.pos_turno_movimientos m
   join public.asiento_lineas l on l.asiento_id = m.asiento_id
   where m.id = (select id from _ids where clave = 'mov_ingreso')
     and l.cuenta_id = (select id from _ids where clave = 'banco')),
  500::numeric,
  'el ingreso acredita la cuenta de contrapartida'
);

insert into _ids (clave, id)
select 'mov_retiro', (public.pos_registrar_movimiento_turno(jsonb_build_object(
  'turno_id', (select id from _ids where clave = 'turno'),
  'tipo', 'retiro',
  'motivo', 'retiro_caja',
  'monto', 200,
  'cuenta_contrapartida_id', (select id from public.cuentas where codigo = '6101')
))->'movimiento'->>'id')::uuid;

select is(
  (select sum(l.debito)
   from public.pos_turno_movimientos m
   join public.asiento_lineas l on l.asiento_id = m.asiento_id
   where m.id = (select id from _ids where clave = 'mov_retiro')
     and l.cuenta_id = (select id from public.cuentas where codigo = '6101')),
  200::numeric,
  'el retiro debita la cuenta de contrapartida'
);

select is(
  (select sum(l.credito)
   from public.pos_turno_movimientos m
   join public.asiento_lineas l on l.asiento_id = m.asiento_id
   where m.id = (select id from _ids where clave = 'mov_retiro')
     and l.cuenta_id = (select id from _ids where clave = 'caja')),
  200::numeric,
  'el retiro acredita la caja de la terminal'
);

select throws_ok(
  $q$select public.pos_registrar_movimiento_turno(jsonb_build_object(
    'turno_id', (select id from _ids where clave = 'turno'),
    'tipo', 'retiro',
    'motivo', 'retiro_caja',
    'monto', 99999,
    'cuenta_contrapartida_id', (select id from public.cuentas where codigo = '6101')
  ))$q$,
  '22023',
  'el retiro deja la caja en negativo',
  'un retiro mayor al efectivo disponible se rechaza'
);

insert into _ids (clave, id)
select 'mov_gasto', (public.pos_registrar_movimiento_turno(jsonb_build_object(
  'turno_id', (select id from _ids where clave = 'turno'),
  'tipo', 'retiro',
  'motivo', 'gasto_menor',
  'monto', 118,
  'subtotal', 100,
  'itbis_tasa', 18,
  'descripcion', 'Gasto POS pgTAP',
  'cuenta_gasto_id', (select id from public.cuentas where codigo = '6101')
))->'movimiento'->>'id')::uuid;

select ok(
  (select gasto_menor_id from public.pos_turno_movimientos
    where id = (select id from _ids where clave = 'mov_gasto')) is not null,
  'el gasto menor queda ligado al movimiento del turno'
);

select is(
  (select sum(l.credito)
   from public.pos_turno_movimientos m
   join public.asiento_lineas l on l.asiento_id = m.asiento_id
   where m.id = (select id from _ids where clave = 'mov_gasto')
     and l.cuenta_id = (select id from _ids where clave = 'caja')),
  118::numeric,
  'el gasto menor sale de la caja de la terminal por el total'
);

select is(
  ((public.pos_resumen_turno((select id from _ids where clave = 'turno')))->'resumen'->'efectivo'->>'efectivo_esperado')::numeric,
  582::numeric,
  'el esperado suma ventas e ingresos y resta retiros'
);

-- ---------------------------------------------------------------------------
-- Devolución combinada con inventario y asiento de reembolso
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'nota', (public.pos_crear_devolucion(jsonb_build_object(
  'terminal_id', (select id from _ids where clave = 'terminal'),
  'factura_id', (select id from _ids where clave = 'venta_combo'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'factura_linea_id', (select id from _ids where clave = 'venta_combo_linea'),
    'cantidad', 1
  )),
  'tipo_reembolso', 'combinado',
  'monto_reembolso_efectivo', 60
))->'nota'->>'id')::uuid;

select is(
  (select total from public.notas_credito_venta where id = (select id from _ids where clave = 'nota')),
  118::numeric,
  'la nota de crédito repite precio e ITBIS de la línea devuelta'
);

select is(
  (select tipo_reembolso from public.notas_credito_venta where id = (select id from _ids where clave = 'nota')),
  'combinado',
  'la devolución combinada guarda su tipo de reembolso'
);

select is(
  (select monto_reembolso_efectivo from public.notas_credito_venta
    where id = (select id from _ids where clave = 'nota')),
  60::numeric,
  'la parte en efectivo del reembolso queda guardada'
);

select is(
  (select turno_id from public.notas_credito_venta where id = (select id from _ids where clave = 'nota')),
  (select id from _ids where clave = 'turno'),
  'la nota de crédito queda ligada al turno'
);

select is(
  (select cantidad from public.existencias
    where producto_id = (select id from _ids where clave = 'producto')
      and almacen_id = (select id from _ids where clave = 'almacen')),
  9::numeric,
  'la devolución reingresa la unidad al almacén'
);

select is(
  (select sum(l.debito)
   from public.notas_credito_venta n
   join public.asiento_lineas l on l.asiento_id = n.asiento_id
   where n.id = (select id from _ids where clave = 'nota')
     and l.cuenta_id = (select cuenta_id from public.config_contable where clave = 'inventario')),
  40::numeric,
  'el inventario vuelve al costo promedio vigente'
);

select is(
  (select sum(l.credito)
   from public.notas_credito_venta n
   join public.asiento_lineas l on l.asiento_id = n.asiento_id
   where n.id = (select id from _ids where clave = 'nota')
     and l.cuenta_id = (select cuenta_id from public.config_contable where clave = 'cxc')),
  118::numeric,
  'la nota de crédito acredita la CxC por el total'
);

select is(
  (select count(*)
   from public.asientos a
   where a.origen_tipo = 'nota_credito_venta'
     and a.origen_id = (select id from _ids where clave = 'nota')),
  2::bigint,
  'la devolución con efectivo crea el asiento de la NC y el del reembolso'
);

select is(
  (select sum(l.debito)
   from public.asientos a
   join public.asiento_lineas l on l.asiento_id = a.id
   where a.origen_tipo = 'nota_credito_venta'
     and a.origen_id = (select id from _ids where clave = 'nota')
     and a.id <> (select asiento_id from public.notas_credito_venta where id = (select id from _ids where clave = 'nota'))
     and l.cuenta_id = (select cuenta_id from public.config_contable where clave = 'cxc')),
  60::numeric,
  'el reembolso debita la CxC por la parte en efectivo'
);

select is(
  (select sum(l.credito)
   from public.asientos a
   join public.asiento_lineas l on l.asiento_id = a.id
   where a.origen_tipo = 'nota_credito_venta'
     and a.origen_id = (select id from _ids where clave = 'nota')
     and a.id <> (select asiento_id from public.notas_credito_venta where id = (select id from _ids where clave = 'nota'))
     and l.cuenta_id = (select id from _ids where clave = 'caja')),
  60::numeric,
  'el reembolso acredita la caja de la terminal'
);

select is(
  (select credito from public.facturas where id = (select id from _ids where clave = 'venta_combo')),
  58::numeric,
  'la factura original acumula solo la parte a crédito de la nota'
);

select throws_ok(
  $q$select public.pos_crear_devolucion(jsonb_build_object(
    'terminal_id', (select id from _ids where clave = 'terminal'),
    'factura_id', (select id from _ids where clave = 'venta_combo'),
    'lineas', jsonb_build_array(jsonb_build_object(
      'factura_linea_id', (select id from _ids where clave = 'venta_combo_linea'),
      'cantidad', 1
    )),
    'tipo_reembolso', 'credito_factura',
    'monto_reembolso_efectivo', 10
  ))$q$,
  '22023',
  'el reembolso con crédito a factura no puede incluir efectivo',
  'el crédito a factura no admite efectivo'
);

-- ---------------------------------------------------------------------------
-- Resumen del turno
-- ---------------------------------------------------------------------------

select is(
  ((public.pos_resumen_turno((select id from _ids where clave = 'turno')))->'resumen'->'ventas'->>'total')::numeric,
  486::numeric,
  'el resumen suma las ventas POS del turno'
);

select is(
  ((public.pos_resumen_turno((select id from _ids where clave = 'turno')))->'resumen'->'ventas'->>'cobrado')::numeric,
  436::numeric,
  'el resumen separa lo cobrado de lo que quedó a crédito'
);

select is(
  ((public.pos_resumen_turno((select id from _ids where clave = 'turno')))->'resumen'
     ->'ventas'->'por_metodo'->>'tarjeta')::numeric,
  136::numeric,
  'el resumen agrupa los pagos con tarjeta'
);

select is(
  ((public.pos_resumen_turno((select id from _ids where clave = 'turno')))->'resumen'
     ->'ventas'->'por_metodo'->>'credito')::numeric,
  50::numeric,
  'el resumen informa el saldo a crédito de las ventas'
);

select is(
  ((public.pos_resumen_turno((select id from _ids where clave = 'turno')))->'resumen'->'ingresos'->>'total')::numeric,
  500::numeric,
  'el resumen suma los ingresos directos'
);

select is(
  ((public.pos_resumen_turno((select id from _ids where clave = 'turno')))->'resumen'->'retiros'->>'total')::numeric,
  318::numeric,
  'el resumen suma los retiros y gastos menores'
);

select is(
  ((public.pos_resumen_turno((select id from _ids where clave = 'turno')))->'resumen'->'devoluciones'->>'efectivo')::numeric,
  60::numeric,
  'el resumen informa las devoluciones en efectivo'
);

select is(
  ((public.pos_resumen_turno((select id from _ids where clave = 'turno')))->'resumen'
     ->'efectivo'->>'efectivo_esperado')::numeric,
  522::numeric,
  'el efectivo esperado aplica base + ventas + ingresos - retiros - devoluciones'
);

select is(
  jsonb_array_length((public.pos_resumen_turno((select id from _ids where clave = 'turno')))->'resumen'->'movimientos'),
  3,
  'el resumen lista los tres movimientos del turno'
);

-- ---------------------------------------------------------------------------
-- Cierre del turno
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'cierre', (public.pos_cerrar_turno(jsonb_build_object(
  'turno_id', (select id from _ids where clave = 'turno'),
  'efectivo_real', 522
))->'turno'->>'id')::uuid;

select is(
  (select estado from public.pos_turnos where id = (select id from _ids where clave = 'turno')),
  'cerrado',
  'pos_cerrar_turno deja el turno cerrado'
);

select is(
  (select diferencia from public.pos_turnos where id = (select id from _ids where clave = 'turno')),
  0::numeric,
  'un arqueo exacto deja diferencia cero'
);

select ok(
  (select asiento_diferencia_id from public.pos_turnos
    where id = (select id from _ids where clave = 'turno')) is null,
  'sin diferencia no se crea asiento de arqueo'
);

select is(
  (select efectivo_esperado from public.pos_turnos where id = (select id from _ids where clave = 'turno')),
  522::numeric,
  'el cierre congela el efectivo esperado'
);

select is(
  ((public.pos_resumen_turno((select id from _ids where clave = 'turno')))->'resumen'
     ->'efectivo'->>'congelado')::boolean,
  true,
  'un turno cerrado devuelve el resumen congelado'
);

select throws_ok(
  $q$select public.pos_cerrar_turno(jsonb_build_object(
    'turno_id', (select id from _ids where clave = 'turno'),
    'efectivo_real', 0
  ))$q$,
  '22023',
  'el turno ya está cerrado',
  'un turno no se cierra dos veces'
);

select throws_ok(
  $q$select public.pos_completar_venta(jsonb_build_object(
    'terminal_id', (select id from _ids where clave = 'terminal'),
    'venta_simple', jsonb_build_object('descripcion', 'Cerrado pgTAP', 'monto', 10, 'itbis_tasa', 0)
  ))$q$,
  '22023',
  'no hay un turno abierto en la terminal Caja POS pgTAP',
  'no se vende sin turno abierto'
);

select throws_ok(
  $q$select public.pos_crear_devolucion(jsonb_build_object(
    'terminal_id', (select id from _ids where clave = 'terminal'),
    'factura_id', (select id from _ids where clave = 'venta_combo'),
    'lineas', jsonb_build_array(jsonb_build_object(
      'factura_linea_id', (select id from _ids where clave = 'venta_combo_linea'),
      'cantidad', 1
    )),
    'tipo_reembolso', 'credito_factura'
  ))$q$,
  '22023',
  'no hay un turno abierto en la terminal Caja POS pgTAP',
  'no se devuelve sin turno abierto'
);

insert into _ids (clave, id)
select 'turno2', (public.pos_abrir_turno(jsonb_build_object(
  'terminal_id', (select id from _ids where clave = 'terminal')
))->'turno'->>'id')::uuid;

select is(
  (select estado from public.pos_turnos where id = (select id from _ids where clave = 'turno2')),
  'abierto',
  'cerrar el turno libera la terminal para uno nuevo'
);

insert into _ids (clave, id)
select 'venta2', (public.pos_completar_venta(jsonb_build_object(
  'terminal_id', (select id from _ids where clave = 'terminal'),
  'venta_simple', jsonb_build_object('descripcion', 'Sobrante pgTAP', 'monto', 100, 'itbis_tasa', 0),
  'pagos', jsonb_build_array(jsonb_build_object('metodo', 'efectivo', 'monto', 100))
))->'factura'->>'id')::uuid;

select public.pos_cerrar_turno(jsonb_build_object(
  'turno_id', (select id from _ids where clave = 'turno2'),
  'efectivo_real', 110
));

select is(
  (select diferencia from public.pos_turnos where id = (select id from _ids where clave = 'turno2')),
  10::numeric,
  'el sobrante queda como diferencia positiva'
);

select ok(
  (select asiento_diferencia_id from public.pos_turnos
    where id = (select id from _ids where clave = 'turno2')) is not null,
  'el sobrante registra su asiento de diferencia'
);

select is(
  (select sum(l.debito)
   from public.pos_turnos t
   join public.asiento_lineas l on l.asiento_id = t.asiento_diferencia_id
   where t.id = (select id from _ids where clave = 'turno2')
     and l.cuenta_id = (select id from _ids where clave = 'caja')),
  10::numeric,
  'el sobrante debita la caja'
);

select is(
  (select sum(l.credito)
   from public.pos_turnos t
   join public.asiento_lineas l on l.asiento_id = t.asiento_diferencia_id
   where t.id = (select id from _ids where clave = 'turno2')
     and l.cuenta_id = (select cuenta_id from public.config_contable where clave = 'sobrante_caja')),
  10::numeric,
  'el sobrante acredita la cuenta de sobrantes'
);

select is(
  (select origen_tipo
   from public.pos_turnos t
   join public.asientos a on a.id = t.asiento_diferencia_id
   where t.id = (select id from _ids where clave = 'turno2')),
  'pos_diferencia',
  'el asiento del arqueo usa el origen pos_diferencia'
);

insert into _ids (clave, id)
select 'turno3', (public.pos_abrir_turno(jsonb_build_object(
  'terminal_id', (select id from _ids where clave = 'terminal')
))->'turno'->>'id')::uuid;

select public.pos_completar_venta(jsonb_build_object(
  'terminal_id', (select id from _ids where clave = 'terminal'),
  'venta_simple', jsonb_build_object('descripcion', 'Faltante pgTAP', 'monto', 100, 'itbis_tasa', 0),
  'pagos', jsonb_build_array(jsonb_build_object('metodo', 'efectivo', 'monto', 100))
));

select public.pos_cerrar_turno(jsonb_build_object(
  'turno_id', (select id from _ids where clave = 'turno3'),
  'efectivo_real', 90,
  'registrar_diferencia', false
));

select is(
  (select diferencia from public.pos_turnos where id = (select id from _ids where clave = 'turno3')),
  (-10)::numeric,
  'el faltante queda como diferencia negativa'
);

select ok(
  (select asiento_diferencia_id from public.pos_turnos
    where id = (select id from _ids where clave = 'turno3')) is null,
  'sin registrar la diferencia el arqueo no genera asiento'
);

-- ---------------------------------------------------------------------------
-- RLS y roles
-- ---------------------------------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'public.pos_terminales', 'SELECT')
  and has_table_privilege('authenticated', 'public.pos_turnos', 'SELECT')
  and has_table_privilege('authenticated', 'public.pos_turno_movimientos', 'SELECT'),
  'authenticated puede leer las tablas del POS'
);

select ok(
  not has_table_privilege('authenticated', 'public.pos_terminales', 'INSERT')
  and not has_table_privilege('authenticated', 'public.pos_turnos', 'INSERT')
  and not has_table_privilege('authenticated', 'public.pos_turnos', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.pos_turnos', 'DELETE')
  and not has_table_privilege('authenticated', 'public.pos_turno_movimientos', 'INSERT'),
  'authenticated no escribe directo en las tablas del POS'
);

select ok(
  not has_table_privilege('anon', 'public.pos_terminales', 'SELECT')
  and not has_table_privilege('anon', 'public.pos_turnos', 'SELECT')
  and not has_table_privilege('anon', 'public.pos_turno_movimientos', 'SELECT'),
  'anon no lee las tablas del POS'
);

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select is(
  ((public.pos_resumen_turno((select id from _ids where clave = 'turno')))->'resumen'
     ->'efectivo'->>'efectivo_esperado')::numeric,
  522::numeric,
  'el rol lector consulta el resumen congelado'
);

select throws_ok(
  $q$select public.pos_abrir_turno(jsonb_build_object(
    'terminal_id', (select id from _ids where clave = 'terminal')
  ))$q$,
  '42501',
  'sin permiso',
  'el rol lector no abre turnos'
);

select throws_ok(
  $q$select public.pos_crear_terminal(jsonb_build_object(
    'nombre', 'Caja lector pgTAP',
    'almacen_id', (select id from _ids where clave = 'almacen'),
    'cuenta_efectivo_id', (select id from _ids where clave = 'caja2'),
    'numeracion_defecto_id', (select id from _ids where clave = 'numeracion'),
    'contacto_defecto_id', (select id from _ids where clave = 'consumidor')
  ))$q$,
  '42501',
  'sin permiso',
  'el rol lector no configura terminales'
);

select * from finish();
rollback;

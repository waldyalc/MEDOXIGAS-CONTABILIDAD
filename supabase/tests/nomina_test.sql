begin;
select plan(92);

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;
create temp table _nums (clave text primary key, valor numeric) on commit drop;
grant select, insert, update, delete on _nums to authenticated;
create temp table _json (clave text primary key, valor jsonb) on commit drop;
grant select, insert, update, delete on _json to authenticated;

insert into auth.users (id, email) values
  ('c1c1c1c1-1111-4111-8111-111111111111', 'admin.nomina@prueba.local'),
  ('c2c2c2c2-2222-4222-8222-222222222222', 'lector.nomina@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('c1c1c1c1-1111-4111-8111-111111111111', 'Admin nómina', 'admin'),
  ('c2c2c2c2-2222-4222-8222-222222222222', 'Lector nómina', 'lector');

-- ---------------------------------------------------------------------------
-- Datos de prueba (el dueño de la base escribe directo: RLS se prueba abajo)
-- ---------------------------------------------------------------------------

insert into public.centros_costo (codigo, nombre)
values ('CC-NOM-PGTAP', 'Centro nómina pgTAP');

insert into _ids (clave, id)
select 'centro', c.id from public.centros_costo c where c.codigo = 'CC-NOM-PGTAP';

insert into public.contactos (tipo, nombre, activo) values
  ('ambos', 'Empleado A pgTAP Nómina', true),
  ('ambos', 'Empleado B pgTAP Nómina', true),
  ('ambos', 'Empleado C pgTAP Nómina', true),
  ('ambos', 'Empleado D pgTAP Nómina', true),
  ('ambos', 'Empleado E pgTAP Nómina', true);

insert into public.empleados (
  contacto_id, tipo_identificacion, identificacion, primer_nombre, primer_apellido,
  segmento_contable, centro_costo_id, tipo_contrato, fecha_ingreso, frecuencia_pago,
  salario_mensual, metodo_pago, estado
)
select
  c.id,
  'pasaporte',
  v.identificacion,
  v.nombre,
  'Prueba',
  'administrativa',
  (select id from _ids where clave = 'centro'),
  'indefinido',
  v.ingreso::date,
  v.frecuencia,
  v.salario,
  'efectivo',
  'activo'
from (
  values
    ('PA-NOM-A', 'Empleado A pgTAP Nómina', '2024-01-01', 'mensual', 30000.00),
    ('PA-NOM-B', 'Empleado B pgTAP Nómina', '2024-01-01', 'mensual', 100000.00),
    ('PA-NOM-C', 'Empleado C pgTAP Nómina', '2024-01-01', 'quincenal', 500000.00),
    ('PA-NOM-D', 'Empleado D pgTAP Nómina', '2024-01-01', 'quincenal', 60000.00),
    ('PA-NOM-E', 'Empleado E pgTAP Nómina', '2026-11-25', 'quincenal', 60000.00)
) as v (identificacion, nombre, ingreso, frecuencia, salario)
join public.contactos c on c.nombre = v.nombre;

insert into _ids (clave, id)
select
  case e.identificacion
    when 'PA-NOM-A' then 'emp_a'
    when 'PA-NOM-B' then 'emp_b'
    when 'PA-NOM-C' then 'emp_c'
    when 'PA-NOM-D' then 'emp_d'
    when 'PA-NOM-E' then 'emp_e'
  end,
  e.id
from public.empleados e
where e.identificacion like 'PA-NOM-%';

-- Préstamo recurrente de D (caso NO-1 del contrato): 1,500 por quincena.
insert into public.empleado_novedades_recurrentes (
  empleado_id, concepto_id, monto, fecha_inicio, activa
)
select
  (select id from _ids where clave = 'emp_d'),
  c.id,
  1500.00,
  '2026-01-01',
  true
from public.nomina_conceptos c
where c.codigo = 'PRESTAMO';

-- ---------------------------------------------------------------------------
-- Rol de trabajo
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"c1c1c1c1-1111-4111-8111-111111111111","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- RLS de las tablas operativas
-- ---------------------------------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'public.nomina_periodos', 'SELECT')
  and has_table_privilege('authenticated', 'public.nomina_recibos', 'SELECT')
  and has_table_privilege('authenticated', 'public.nomina_recibo_lineas', 'SELECT'),
  'authenticated puede leer los periodos, recibos y líneas de nómina'
);

select ok(
  not has_table_privilege('authenticated', 'public.nomina_periodos', 'INSERT')
  and not has_table_privilege('authenticated', 'public.nomina_periodos', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.nomina_periodos', 'DELETE')
  and not has_table_privilege('authenticated', 'public.nomina_recibos', 'INSERT')
  and not has_table_privilege('authenticated', 'public.nomina_recibos', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.nomina_recibo_lineas', 'INSERT')
  and not has_table_privilege('authenticated', 'public.nomina_recibo_lineas', 'DELETE'),
  'authenticated no escribe directo en las tablas de nómina'
);

select ok(
  not has_table_privilege('anon', 'public.nomina_periodos', 'SELECT')
  and not has_table_privilege('anon', 'public.nomina_recibos', 'SELECT')
  and not has_table_privilege('anon', 'public.nomina_recibo_lineas', 'SELECT'),
  'anon no lee las tablas de nómina'
);

-- ---------------------------------------------------------------------------
-- Periodos: rangos estándar, prorrata y preview de recurrentes
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'periodo_m', public.nomina_crear_periodo(jsonb_build_object(
  'frecuencia', 'mensual',
  'fecha_inicio', '2026-11-01',
  'fecha_fin', '2026-11-30',
  'fecha_pago', '2026-11-30'
));

insert into _ids (clave, id)
select 'periodo_q', public.nomina_crear_periodo(jsonb_build_object(
  'frecuencia', 'quincenal',
  'fecha_inicio', '2026-11-16',
  'fecha_fin', '2026-11-30'
));

insert into _ids (clave, id)
select 'recibo_' || lower(right(e.identificacion, 1)), r.id
from public.nomina_recibos r
join public.empleados e on e.id = r.empleado_id
where r.periodo_id = (select id from _ids where clave = 'periodo_m');

insert into _ids (clave, id)
select 'recibo_' || lower(right(e.identificacion, 1)), r.id
from public.nomina_recibos r
join public.empleados e on e.id = r.empleado_id
where r.periodo_id = (select id from _ids where clave = 'periodo_q');

select is(
  (select p.codigo from public.nomina_periodos p where p.id = (select id from _ids where clave = 'periodo_m')),
  '2026-11-M',
  'el periodo mensual deriva el código 2026-11-M'
);

select is(
  (select p.estado from public.nomina_periodos p where p.id = (select id from _ids where clave = 'periodo_m')),
  'borrador',
  'el periodo nace en borrador'
);

select is(
  (select count(*)::int from public.nomina_recibos r
   where r.periodo_id = (select id from _ids where clave = 'periodo_m')),
  2,
  'el periodo mensual solo incluye a los empleados mensuales'
);

select is(
  (select r.dias_trabajados from public.nomina_recibos r
   where r.id = (select id from _ids where clave = 'recibo_a')),
  23.830::numeric,
  'el mes completo son 23.830 días laborales'
);

select is(
  (select r.salario_base from public.nomina_recibos r
   where r.id = (select id from _ids where clave = 'recibo_a')),
  30000.00::numeric,
  'el salario base del mes completo es el salario mensual'
);

select is(
  (select p.codigo from public.nomina_periodos p where p.id = (select id from _ids where clave = 'periodo_q')),
  '2026-11-Q2',
  'la segunda quincena deriva el código 2026-11-Q2'
);

select is(
  (select count(*)::int from public.nomina_recibos r
   where r.periodo_id = (select id from _ids where clave = 'periodo_q')),
  3,
  'el periodo quincenal solo incluye a los empleados quincenales'
);

select is(
  (select r.dias_trabajados from public.nomina_recibos r
   where r.id = (select id from _ids where clave = 'recibo_e')),
  4.766::numeric,
  'un ingreso a mitad de quincena prorratea los días (11.915 × 0.4)'
);

select is(
  (select r.salario_base from public.nomina_recibos r
   where r.id = (select id from _ids where clave = 'recibo_e')),
  12000.00::numeric,
  'la prorrata usa la proporción exacta: 60,000 × 0.5 × 6/15'
);

select is(
  (select l.monto from public.nomina_recibo_lineas l
   where l.recibo_id = (select id from _ids where clave = 'recibo_d')
     and l.origen = 'recurrente'),
  1500.00::numeric,
  'el borrador copia las novedades recurrentes vigentes como preview'
);

select throws_ok(
  $q$select public.nomina_crear_periodo('{"frecuencia":"quincenal","fecha_inicio":"2026-11-01","fecha_fin":"2026-11-20"}'::jsonb)$q$,
  '22023',
  'La primera quincena debe ir del día 1 al 15.',
  'un rango no estándar de quincena se rechaza'
);

select throws_ok(
  $q$select public.nomina_crear_periodo('{"frecuencia":"mensual","fecha_inicio":"2026-11-01","fecha_fin":"2026-11-30"}'::jsonb)$q$,
  '23505',
  'Ya existe un periodo de nómina con ese código.',
  'no se repite el periodo del mismo mes y frecuencia'
);

-- ---------------------------------------------------------------------------
-- Novedades manuales: horas extra 35 % y 100 %
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'linea_100',
  (public.nomina_guardar_novedad_recibo(jsonb_build_object(
    'recibo_id', (select id from _ids where clave = 'recibo_d'),
    'concepto_id', (select id from public.nomina_conceptos where codigo = 'HORAS_EXTRA_100'),
    'cantidad', 2
  ))->>'linea_id')::uuid;

select is(
  (select l.monto from public.nomina_recibo_lineas l
   where l.id = (select id from _ids where clave = 'linea_100')),
  1258.92::numeric,
  '2 horas extra al 100 % sobre 60,000: 1,258.92'
);

select public.nomina_eliminar_novedad_recibo((select id from _ids where clave = 'linea_100'));

select is(
  (select count(*)::int from public.nomina_recibo_lineas l
   where l.recibo_id = (select id from _ids where clave = 'recibo_d')
     and l.origen = 'manual'),
  0,
  'eliminar la novedad manual borra la línea del recibo'
);

insert into _ids (clave, id)
select 'linea_35',
  (public.nomina_guardar_novedad_recibo(jsonb_build_object(
    'recibo_id', (select id from _ids where clave = 'recibo_d'),
    'concepto_id', (select id from public.nomina_conceptos where codigo = 'HORAS_EXTRA_35'),
    'cantidad', 5
  ))->>'linea_id')::uuid;

select is(
  (select l.monto from public.nomina_recibo_lineas l
   where l.id = (select id from _ids where clave = 'linea_35')),
  2124.42::numeric,
  '5 horas extra al 35 % sobre 60,000: 2,124.42'
);

-- ---------------------------------------------------------------------------
-- Cálculo del periodo mensual (casos A y B del contrato)
-- ---------------------------------------------------------------------------

select public.nomina_calcular_periodo((select id from _ids where clave = 'periodo_m'));

select is(
  (select p.estado from public.nomina_periodos p where p.id = (select id from _ids where clave = 'periodo_m')),
  'calculado',
  'calcular el periodo lo deja en calculado'
);

select is(
  (select r.base_sfs from public.nomina_recibos r
   where r.id = (select id from _ids where clave = 'recibo_a')),
  30000.00::numeric,
  'caso A: la base SFS del mes completo es el salario'
);

select is(
  (select l.monto from public.nomina_recibo_lineas l
   join public.nomina_conceptos c on c.id = l.concepto_id
   where l.recibo_id = (select id from _ids where clave = 'recibo_a') and c.codigo = 'SFS'),
  912.00::numeric,
  'caso A: SFS del empleado 3.04 % = 912.00'
);

select is(
  (select l.monto from public.nomina_recibo_lineas l
   join public.nomina_conceptos c on c.id = l.concepto_id
   where l.recibo_id = (select id from _ids where clave = 'recibo_a') and c.codigo = 'AFP'),
  861.00::numeric,
  'caso A: AFP del empleado 2.87 % = 861.00'
);

select is(
  (select count(*)::int from public.nomina_recibo_lineas l
   join public.nomina_conceptos c on c.id = l.concepto_id
   where l.recibo_id = (select id from _ids where clave = 'recibo_a') and c.codigo = 'ISR'),
  0,
  'caso A: sin ISR no se crea línea'
);

select is(
  (select r.neto_pagar from public.nomina_recibos r
   where r.id = (select id from _ids where clave = 'recibo_a')),
  28227.00::numeric,
  'caso A: neto a pagar 28,227.00'
);

select is(
  (select r.total_aportes_empleador from public.nomina_recibos r
   where r.id = (select id from _ids where clave = 'recibo_a')),
  4887.00::numeric,
  'caso A: cargas patronales 4,887.00'
);

select is(
  (select r.costo_total_empresa from public.nomina_recibos r
   where r.id = (select id from _ids where clave = 'recibo_a')),
  34887.00::numeric,
  'caso A: costo total de la empresa 34,887.00'
);

select is(
  (select p.total_neto from public.nomina_periodos p where p.id = (select id from _ids where clave = 'periodo_m')),
  110211.63::numeric,
  'el periodo suma los netos de sus recibos (28,227.00 + 81,984.63)'
);

select is(
  (select l.monto from public.nomina_recibo_lineas l
   join public.nomina_conceptos c on c.id = l.concepto_id
   where l.recibo_id = (select id from _ids where clave = 'recibo_b') and c.codigo = 'ISR'),
  12105.37::numeric,
  'caso B: ISR por proyección anual 12,105.37'
);

select is(
  (select r.neto_pagar from public.nomina_recibos r
   where r.id = (select id from _ids where clave = 'recibo_b')),
  81984.63::numeric,
  'caso B: neto a pagar 81,984.63'
);

select is(
  (select r.costo_total_empresa from public.nomina_recibos r
   where r.id = (select id from _ids where clave = 'recibo_b')),
  116211.81::numeric,
  'caso B: costo total de la empresa 116,211.81'
);

-- ---------------------------------------------------------------------------
-- Cálculo del periodo quincenal (casos C, D y E del contrato)
-- ---------------------------------------------------------------------------

select public.nomina_calcular_periodo((select id from _ids where clave = 'periodo_q'));

select is(
  (select r.base_sfs from public.nomina_recibos r
   where r.id = (select id from _ids where clave = 'recibo_c')),
  116115.00::numeric,
  'caso C: la base SFS quincenal topa en 232,230 / 2'
);

select is(
  (select r.base_afp from public.nomina_recibos r
   where r.id = (select id from _ids where clave = 'recibo_c')),
  232230.00::numeric,
  'caso C: la base AFP quincenal topa en 464,460 / 2'
);

select is(
  (select r.base_srl from public.nomina_recibos r
   where r.id = (select id from _ids where clave = 'recibo_c')),
  46446.00::numeric,
  'caso C: la base SRL quincenal topa en 92,892 / 2'
);

select is(
  (select l.monto from public.nomina_recibo_lineas l
   join public.nomina_conceptos c on c.id = l.concepto_id
   where l.recibo_id = (select id from _ids where clave = 'recibo_c') and c.codigo = 'SFS'),
  3529.90::numeric,
  'caso C: SFS del empleado 3,529.90'
);

select is(
  (select l.monto from public.nomina_recibo_lineas l
   join public.nomina_conceptos c on c.id = l.concepto_id
   where l.recibo_id = (select id from _ids where clave = 'recibo_c') and c.codigo = 'AFP'),
  6665.00::numeric,
  'caso C: AFP del empleado 6,665.00'
);

select is(
  (select l.monto from public.nomina_recibo_lineas l
   join public.nomina_conceptos c on c.id = l.concepto_id
   where l.recibo_id = (select id from _ids where clave = 'recibo_c') and c.codigo = 'ISR'),
  54242.71::numeric,
  'caso C: ISR de la quincena 54,242.71'
);

select is(
  (select r.neto_pagar from public.nomina_recibos r
   where r.id = (select id from _ids where clave = 'recibo_c')),
  185562.39::numeric,
  'caso C: neto a pagar 185,562.39'
);

select is(
  (select r.costo_total_empresa from public.nomina_recibos r
   where r.id = (select id from _ids where clave = 'recibo_c')),
  277731.79::numeric,
  'caso C: costo total de la empresa 277,731.79'
);

select is(
  (select l.monto from public.nomina_recibo_lineas l
   join public.nomina_conceptos c on c.id = l.concepto_id
   where l.recibo_id = (select id from _ids where clave = 'recibo_d') and c.codigo = 'SFS'),
  976.58::numeric,
  'caso NO-1: el SFS incluye las horas extra en la base (976.58)'
);

select is(
  (select l.monto from public.nomina_recibo_lineas l
   join public.nomina_conceptos c on c.id = l.concepto_id
   where l.recibo_id = (select id from _ids where clave = 'recibo_d') and c.codigo = 'AFP'),
  921.97::numeric,
  'caso NO-1: el AFP incluye las horas extra en la base (921.97)'
);

select is(
  (select l.monto from public.nomina_recibo_lineas l
   join public.nomina_conceptos c on c.id = l.concepto_id
   where l.recibo_id = (select id from _ids where clave = 'recibo_d') and c.codigo = 'ISR'),
  2143.11::numeric,
  'caso NO-1: ISR del periodo 2,143.11'
);

select is(
  (select l.monto from public.nomina_recibo_lineas l
   join public.nomina_conceptos c on c.id = l.concepto_id
   where l.recibo_id = (select id from _ids where clave = 'recibo_d') and c.codigo = 'PRESTAMO'),
  1500.00::numeric,
  'caso NO-1: el préstamo recurrente se aplica una vez (1,500.00)'
);

select is(
  (select r.neto_pagar from public.nomina_recibos r
   where r.id = (select id from _ids where clave = 'recibo_d')),
  26582.76::numeric,
  'caso NO-1: neto a pagar 26,582.76'
);

select is(
  (select r.costo_total_empresa from public.nomina_recibos r
   where r.id = (select id from _ids where clave = 'recibo_d')),
  37357.48::numeric,
  'caso NO-1: costo total de la empresa 37,357.48'
);

select is(
  (select l.monto from public.nomina_recibo_lineas l
   join public.nomina_conceptos c on c.id = l.concepto_id
   where l.recibo_id = (select id from _ids where clave = 'recibo_e') and c.codigo = 'SFS'),
  364.80::numeric,
  'caso E: SFS prorrateado 364.80'
);

select is(
  (select l.monto from public.nomina_recibo_lineas l
   join public.nomina_conceptos c on c.id = l.concepto_id
   where l.recibo_id = (select id from _ids where clave = 'recibo_e') and c.codigo = 'AFP'),
  344.40::numeric,
  'caso E: AFP prorrateado 344.40'
);

select is(
  (select r.neto_pagar from public.nomina_recibos r
   where r.id = (select id from _ids where clave = 'recibo_e')),
  11290.80::numeric,
  'caso E: neto a pagar 11,290.80'
);

select is(
  (select r.costo_total_empresa from public.nomina_recibos r
   where r.id = (select id from _ids where clave = 'recibo_e')),
  13954.80::numeric,
  'caso E: costo total de la empresa 13,954.80'
);

-- ---------------------------------------------------------------------------
-- Contabilización NO-N por empleado
-- ---------------------------------------------------------------------------

insert into _nums (clave, valor)
select 'no_siguiente', t.siguiente from public.tipos_entrada_diario t where t.prefijo = 'NO';

insert into _nums (clave, valor)
select 'asientos_m',
  (public.nomina_contabilizar_periodo((select id from _ids where clave = 'periodo_m'))->>'asientos')::numeric;

insert into _ids (clave, id)
select 'asiento_a', r.asiento_id from public.nomina_recibos r
where r.id = (select id from _ids where clave = 'recibo_a');

select is(
  (select valor::int from _nums where clave = 'asientos_m'),
  2,
  'contabilizar el periodo mensual crea un asiento por empleado'
);

select is(
  (select a.codigo from public.asientos a where a.id = (select id from _ids where clave = 'asiento_a')),
  'NO-' || (select valor::int::text from _nums where clave = 'no_siguiente'),
  'el primer comprobante usa el consecutivo NO vigente'
);

select is(
  (select a.codigo from public.asientos a where a.id = (
     select r.asiento_id from public.nomina_recibos r
     where r.id = (select id from _ids where clave = 'recibo_b'))),
  'NO-' || ((select valor from _nums where clave = 'no_siguiente') + 1)::int::text,
  'el segundo comprobante toma el consecutivo siguiente'
);

select is(
  (select count(*)::int from public.asiento_lineas al
   where al.asiento_id = (select id from _ids where clave = 'asiento_a')),
  12,
  'el asiento del caso A tiene 12 líneas'
);

select is(
  (select sum(al.debito) from public.asiento_lineas al
   where al.asiento_id = (select id from _ids where clave = 'asiento_a')),
  34887.00::numeric,
  'el asiento del caso A debita 34,887.00'
);

select is(
  (select sum(al.credito) from public.asiento_lineas al
   where al.asiento_id = (select id from _ids where clave = 'asiento_a')),
  34887.00::numeric,
  'el asiento del caso A acredita 34,887.00'
);

select ok(
  (select al.debito = 30000.00
     and al.contacto_id = (select e.contacto_id from public.empleados e where e.identificacion = 'PA-NOM-A')
     and al.centro_costo_id = (select id from _ids where clave = 'centro')
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select id from _ids where clave = 'asiento_a') and c.codigo = '6110'),
  'el salario va al débito de 6110 con el empleado y su centro de costo'
);

select ok(
  (select count(*) = 2
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select id from _ids where clave = 'asiento_a')
     and c.codigo in ('2108', '2109')
     and al.contacto_id = (select ce.contacto_tss_id from public.nomina_config_empresa ce where ce.id = 1)),
  'SFS y AFP retenidos se acreditan contra el contacto TSS'
);

select ok(
  (select coalesce(sum(al.credito), 0) = 4587.00
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select id from _ids where clave = 'asiento_a')
     and c.codigo in ('2111', '2112', '2113')
     and al.contacto_id = (select ce.contacto_tss_id from public.nomina_config_empresa ce where ce.id = 1)),
  'SFS, AFP y SRL del empleador se acreditan contra el contacto TSS'
);

select ok(
  (select al.credito = 300.00
     and al.contacto_id = (select ce.contacto_infotep_id from public.nomina_config_empresa ce where ce.id = 1)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select id from _ids where clave = 'asiento_a') and c.codigo = '2114'),
  'INFOTEP se acredita contra su propio contacto'
);

select ok(
  (select al.credito = 28227.00
     and al.contacto_id = (select e.contacto_id from public.empleados e where e.identificacion = 'PA-NOM-A')
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select id from _ids where clave = 'asiento_a') and c.codigo = '2107'),
  'el neto se acredita a salarios por pagar contra el empleado'
);

-- Periodo de diciembre: sirve para el candado de contabilización y provisiones.
insert into _ids (clave, id)
select 'periodo_dic', public.nomina_crear_periodo(jsonb_build_object(
  'frecuencia', 'mensual',
  'fecha_inicio', '2026-12-01',
  'fecha_fin', '2026-12-31'
));

insert into _ids (clave, id)
select 'recibo_a_dic', r.id
from public.nomina_recibos r
join public.empleados e on e.id = r.empleado_id
where r.periodo_id = (select id from _ids where clave = 'periodo_dic')
  and e.identificacion = 'PA-NOM-A';

insert into _ids (clave, id)
select 'recibo_b_dic', r.id
from public.nomina_recibos r
join public.empleados e on e.id = r.empleado_id
where r.periodo_id = (select id from _ids where clave = 'periodo_dic')
  and e.identificacion = 'PA-NOM-B';

select throws_ok(
  $q$select public.nomina_contabilizar_recibo((select id from _ids where clave = 'recibo_a_dic'))$q$,
  '23514',
  'El recibo no está calculado; contabilízalo antes.',
  'no se contabiliza un recibo en borrador'
);

-- ---------------------------------------------------------------------------
-- Pago: candado, asiento y estado del periodo
-- ---------------------------------------------------------------------------

select throws_ok(
  $q$select public.nomina_pagar_recibo(jsonb_build_object('recibo_id', (select id from _ids where clave = 'recibo_d')))$q$,
  '23514',
  'El recibo no está contabilizado; no se puede pagar.',
  'el pago rechaza un recibo que no está contabilizado'
);

insert into _ids (clave, id)
select 'pago_a', public.nomina_pagar_recibo(jsonb_build_object(
  'recibo_id', (select id from _ids where clave = 'recibo_a'),
  'fecha', '2026-11-30',
  'cuenta_pago_id', (select id from public.cuentas where codigo = '1102')
));

select is(
  (select r.estado from public.nomina_recibos r where r.id = (select id from _ids where clave = 'recibo_a')),
  'pagado',
  'pagar deja el recibo en pagado'
);

select ok(
  (select count(*) = 1
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select id from _ids where clave = 'pago_a')
     and c.codigo = '2107'
     and al.debito = 28227.00
     and al.contacto_id = (select e.contacto_id from public.empleados e where e.identificacion = 'PA-NOM-A'))
  and
  (select count(*) = 1
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select id from _ids where clave = 'pago_a')
     and c.codigo = '1102'
     and al.credito = 28227.00
     and al.contacto_id is null),
  'el pago debita salarios por pagar contra el empleado y acredita el banco'
);

select is(
  (select p.estado from public.nomina_periodos p where p.id = (select id from _ids where clave = 'periodo_m')),
  'contabilizado',
  'con un recibo pagado y otro contabilizado el periodo sigue contabilizado'
);

insert into _json (clave, valor)
select 'pago_periodo', public.nomina_pagar_periodo(jsonb_build_object(
  'periodo_id', (select id from _ids where clave = 'periodo_m'),
  'fecha', '2026-11-30'
));

select is(
  (select (valor->>'recibos')::int from _json where clave = 'pago_periodo'),
  1,
  'pagar el periodo paga los recibos contabilizados (el otro ya estaba pagado)'
);

select is(
  (select (valor->>'total_pagado')::numeric from _json where clave = 'pago_periodo'),
  81984.63::numeric,
  'pagar el periodo suma el neto del recibo pagado'
);

select is(
  (select p.estado from public.nomina_periodos p where p.id = (select id from _ids where clave = 'periodo_m')),
  'pagado',
  'con todos los recibos pagados el periodo pasa a pagado'
);

select is(
  public.nomina_registrar_envio_colillas(jsonb_build_object(
    'periodo_id', (select id from _ids where clave = 'periodo_m'),
    'recibo_ids', jsonb_build_array(
      (select id from _ids where clave = 'recibo_a'),
      (select id from _ids where clave = 'recibo_b')
    ),
    'enviado_a', 'nomina@prueba.local'
  )),
  2,
  'el envío de colillas sella los dos recibos del periodo'
);

select is(
  (select r.colilla_enviada_a from public.nomina_recibos r
   where r.id = (select id from _ids where clave = 'recibo_a')),
  'nomina@prueba.local',
  'la colilla guarda el destinatario indicado'
);

select throws_ok(
  $q$select public.nomina_pagar_periodo(jsonb_build_object('periodo_id', (select id from _ids where clave = 'periodo_q')))$q$,
  '23514',
  'Contabiliza la nómina del periodo antes de pagar.',
  'pagar un periodo con recibos calculados se rechaza completo'
);

select throws_ok(
  $q$select public.nomina_anular_recibo((select id from _ids where clave = 'recibo_a'))$q$,
  '23514',
  'El recibo está pagado; anula el pago antes de anular el recibo.',
  'un recibo pagado no se anula sin anular el pago'
);

-- ---------------------------------------------------------------------------
-- Lecturas: resumen del periodo y reporte TSS
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.nomina_resumen_periodo((select id from _ids where clave = 'periodo_m'))),
  2,
  'el resumen del periodo devuelve una fila por recibo'
);

select is(
  (select r.asiento_codigo from public.nomina_resumen_periodo((select id from _ids where clave = 'periodo_m')) r
   where r.identificacion = 'PA-NOM-A'),
  'NO-' || (select valor::int::text from _nums where clave = 'no_siguiente'),
  'el resumen expone el código del comprobante NO'
);

select is(
  (select count(*)::int from public.nomina_reporte_tss(2026, 11)),
  2,
  'el reporte TSS solo incluye periodos contabilizados o pagados del mes'
);

select is(
  (select r.sfs_empleado from public.nomina_reporte_tss(2026, 11) r where r.identificacion = 'PA-NOM-A'),
  912.00::numeric,
  'el reporte TSS toma el SFS retenido del recibo'
);

select throws_ok(
  $q$select * from public.nomina_reporte_tss(2026, 13)$q$,
  '22023',
  'El mes debe estar entre 1 y 12.',
  'el reporte TSS valida el mes'
);

-- ---------------------------------------------------------------------------
-- Anulaciones en orden inverso
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'reversion_pago_a', public.nomina_anular_pago_recibo((select id from _ids where clave = 'recibo_a'));

select is(
  (select r.estado from public.nomina_recibos r where r.id = (select id from _ids where clave = 'recibo_a')),
  'contabilizado',
  'anular el pago devuelve el recibo a contabilizado'
);

select is(
  (select a.anula_asiento_id from public.asientos a where a.id = (select id from _ids where clave = 'reversion_pago_a')),
  (select id from _ids where clave = 'pago_a'),
  'la reversa del pago apunta al asiento de pago'
);

select is(
  (select sum(al.credito) from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select id from _ids where clave = 'reversion_pago_a') and c.codigo = '2107'),
  28227.00::numeric,
  'la reversa del pago vuelve a acreditar salarios por pagar por el neto'
);

select is(
  (select p.estado from public.nomina_periodos p where p.id = (select id from _ids where clave = 'periodo_m')),
  'contabilizado',
  'anular el pago devuelve el periodo a contabilizado'
);

insert into _ids (clave, id)
select 'reversion_no_a', public.nomina_anular_recibo((select id from _ids where clave = 'recibo_a'));

select is(
  (select r.estado from public.nomina_recibos r where r.id = (select id from _ids where clave = 'recibo_a')),
  'anulado',
  'anular el recibo lo deja en anulado'
);

select is(
  (select a.anula_asiento_id from public.asientos a where a.id = (select id from _ids where clave = 'reversion_no_a')),
  (select id from _ids where clave = 'asiento_a'),
  'la reversa del recibo apunta al comprobante NO'
);

select is(
  (select count(*)::int
   from (
     select al.cuenta_id
     from public.asiento_lineas al
     where al.asiento_id in (
       select id from _ids
       where clave in ('asiento_a', 'reversion_no_a', 'pago_a', 'reversion_pago_a')
     )
     group by al.cuenta_id
     having sum(al.debito) <> sum(al.credito)
   ) as descuadres),
  0,
  'los asientos del recibo anulado suman cero por cuenta'
);

select is(
  (select p.estado from public.nomina_periodos p where p.id = (select id from _ids where clave = 'periodo_m')),
  'pagado',
  'con el recibo anulado y el otro pagado el periodo queda pagado'
);

select public.nomina_anular_recibo((select id from _ids where clave = 'recibo_b_dic'));

select ok(
  (select r.estado = 'anulado' and r.asiento_id is null
   from public.nomina_recibos r where r.id = (select id from _ids where clave = 'recibo_b_dic'))
  and not exists (
    select 1 from public.asientos a
    where a.origen_tipo = 'anulacion'
      and a.origen_id = (select id from _ids where clave = 'recibo_b_dic')
  ),
  'anular un recibo en borrador no crea asiento ni reversa'
);

-- ---------------------------------------------------------------------------
-- Provisiones (configuración encendida por el dueño de la base)
-- ---------------------------------------------------------------------------

reset role;
update public.nomina_config_empresa set registrar_provisiones = true where id = 1;
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1c1c1c1-1111-4111-8111-111111111111","role":"authenticated"}';

select public.nomina_calcular_periodo((select id from _ids where clave = 'periodo_dic'));

select is(
  (select r.total_provisiones from public.nomina_recibos r
   where r.id = (select id from _ids where clave = 'recibo_a_dic')),
  6171.85::numeric,
  'las tres provisiones suman 6,171.85'
);

select is(
  (select l.monto from public.nomina_recibo_lineas l
   join public.nomina_conceptos c on c.id = l.concepto_id
   where l.recibo_id = (select id from _ids where clave = 'recibo_a_dic')
     and c.codigo = 'PROVISION_NAVIDAD'),
  2500.00::numeric,
  'la provisión de regalía es un doceavo (2,500.00)'
);

select is(
  (select l.monto from public.nomina_recibo_lineas l
   join public.nomina_conceptos c on c.id = l.concepto_id
   where l.recibo_id = (select id from _ids where clave = 'recibo_a_dic')
     and c.codigo = 'PROVISION_VACACIONES'),
  1468.74::numeric,
  'la provisión de vacaciones es 1,468.74'
);

select is(
  (select l.monto from public.nomina_recibo_lineas l
   join public.nomina_conceptos c on c.id = l.concepto_id
   where l.recibo_id = (select id from _ids where clave = 'recibo_a_dic')
     and c.codigo = 'PROVISION_CESANTIA'),
  2203.11::numeric,
  'la provisión de cesantía es 2,203.11'
);

select is(
  (select r.costo_total_empresa from public.nomina_recibos r
   where r.id = (select id from _ids where clave = 'recibo_a_dic')),
  41058.85::numeric,
  'con provisiones el costo total sube a 41,058.85'
);

-- ---------------------------------------------------------------------------
-- Permisos: el lector lee pero no escribe
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"c2c2c2c2-2222-4222-8222-222222222222","role":"authenticated"}';

select throws_ok(
  $q$select public.nomina_crear_periodo('{}'::jsonb)$q$,
  '42501',
  'sin permiso',
  'el rol lector no puede crear periodos de nómina'
);

select is(
  (select count(*)::int from public.nomina_resumen_periodo((select id from _ids where clave = 'periodo_m'))),
  2,
  'el rol lector puede leer el resumen del periodo'
);

select * from finish();
rollback;

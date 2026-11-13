-- Medoxigas Contabilidad · Motor contable de doble partida
--
-- Implementa el contrato de docs/contrato-db.md: empresa, catálogo de cuentas,
-- configuración contable, contactos, productos, numeraciones, facturas,
-- compras, pagos, gastos menores, asientos y reportes.
--
-- Reglas:
--   · RLS activo en todas las tablas; anon no ve nada y authenticated solo lee.
--   · Las escrituras van por RPC security definer (admin/contador).
--   · Todo asiento se valida con un trigger de restricción diferido.

-- ---------------------------------------------------------------------------
-- Empresa
-- ---------------------------------------------------------------------------

create table public.empresa (
  id int primary key default 1 check (id = 1),
  nombre text not null,
  rnc text,
  direccion text,
  telefono text,
  correo text,
  logo_url text
);

insert into public.empresa (id, nombre) values (1, 'MEDOXIGAS ALC, SRL');

-- ---------------------------------------------------------------------------
-- Secuencias internas de numeración de documentos
-- ---------------------------------------------------------------------------

create sequence public.asientos_numero_seq;
create sequence public.facturas_numero_seq;
create sequence public.pagos_recibidos_numero_seq;
create sequence public.facturas_proveedor_numero_seq;
create sequence public.pagos_proveedor_numero_seq;
create sequence public.gastos_menores_numero_seq;

-- ---------------------------------------------------------------------------
-- Catálogo de cuentas
-- ---------------------------------------------------------------------------

create table public.cuentas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  tipo text not null check (tipo in ('activo', 'pasivo', 'capital', 'ingreso', 'costo', 'gasto')),
  naturaleza text not null check (naturaleza in ('debito', 'credito')),
  padre_id uuid references public.cuentas (id),
  acepta_movimientos boolean not null default true,
  es_caja_banco boolean not null default false,
  activa boolean not null default true
);

insert into public.cuentas (codigo, nombre, tipo, naturaleza, acepta_movimientos)
values
  ('1', 'Activos', 'activo', 'debito', false),
  ('2', 'Pasivos', 'pasivo', 'credito', false),
  ('3', 'Capital', 'capital', 'credito', false),
  ('4', 'Ingresos', 'ingreso', 'credito', false),
  ('5', 'Costos', 'costo', 'debito', false),
  ('6', 'Gastos', 'gasto', 'debito', false);

insert into public.cuentas (codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos)
select v.codigo, v.nombre, v.tipo, v.naturaleza, p.id, false
from (values
  ('11', 'Activos corrientes', 'activo', 'debito', '1'),
  ('21', 'Pasivos corrientes', 'pasivo', 'credito', '2')
) as v(codigo, nombre, tipo, naturaleza, padre_codigo)
join public.cuentas p on p.codigo = v.padre_codigo;

insert into public.cuentas (codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos, es_caja_banco)
select v.codigo, v.nombre, v.tipo, v.naturaleza, p.id, true, v.caja
from (values
  ('1101', 'Caja general', 'activo', 'debito', '11', true),
  ('1102', 'Banco principal', 'activo', 'debito', '11', true),
  ('1103', 'Cuentas por cobrar clientes', 'activo', 'debito', '11', false),
  ('1104', 'Inventario de mercancía', 'activo', 'debito', '11', false),
  ('1105', 'ITBIS adelantado en compras', 'activo', 'debito', '11', false),
  ('2101', 'Cuentas por pagar proveedores', 'pasivo', 'credito', '21', false),
  ('2102', 'ITBIS por pagar', 'pasivo', 'credito', '21', false),
  ('3101', 'Capital social', 'capital', 'credito', '3', false),
  ('3201', 'Resultados acumulados', 'capital', 'credito', '3', false),
  ('4101', 'Ventas de productos', 'ingreso', 'credito', '4', false),
  ('4102', 'Ventas de servicios', 'ingreso', 'credito', '4', false),
  ('5101', 'Costo de ventas', 'costo', 'debito', '5', false),
  ('6101', 'Gastos generales', 'gasto', 'debito', '6', false),
  ('6102', 'Gastos de caja menor', 'gasto', 'debito', '6', false),
  ('6103', 'Combustible y transporte', 'gasto', 'debito', '6', false),
  ('6104', 'Servicios (luz, agua, teléfono)', 'gasto', 'debito', '6', false)
) as v(codigo, nombre, tipo, naturaleza, padre_codigo, caja)
join public.cuentas p on p.codigo = v.padre_codigo;

create table public.config_contable (
  clave text primary key,
  cuenta_id uuid not null references public.cuentas (id)
);

insert into public.config_contable (clave, cuenta_id)
select v.clave, c.id
from (values
  ('caja', '1101'),
  ('banco', '1102'),
  ('cxc', '1103'),
  ('inventario', '1104'),
  ('itbis_adelantado', '1105'),
  ('cxp', '2101'),
  ('itbis_por_pagar', '2102'),
  ('ventas', '4101'),
  ('ventas_servicios', '4102'),
  ('costo_ventas', '5101'),
  ('gastos_generales', '6101')
) as v(clave, codigo)
join public.cuentas c on c.codigo = v.codigo;

-- ---------------------------------------------------------------------------
-- Contactos y productos
-- ---------------------------------------------------------------------------

create table public.contactos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'cliente' check (tipo in ('cliente', 'proveedor', 'ambos')),
  nombre text not null,
  rnc_cedula text,
  telefono text,
  correo text,
  direccion text,
  cuenta_cxc_id uuid references public.cuentas (id),
  cuenta_cxp_id uuid references public.cuentas (id),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'producto' check (tipo in ('producto', 'servicio')),
  nombre text not null,
  referencia text,
  descripcion text,
  precio numeric(14,2) not null default 0,
  itbis_tasa numeric(5,2) not null default 18 check (itbis_tasa in (0, 16, 18)),
  inventariable boolean not null default false,
  cantidad numeric(14,2) not null default 0,
  costo numeric(14,2) not null default 0,
  cuenta_ingreso_id uuid references public.cuentas (id),
  cuenta_costo_id uuid references public.cuentas (id),
  cuenta_inventario_id uuid references public.cuentas (id),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Numeraciones de comprobantes fiscales
-- ---------------------------------------------------------------------------

create table public.numeraciones (
  id uuid primary key default gen_random_uuid(),
  tipo_comprobante text not null,
  nombre text not null,
  prefijo text not null,
  siguiente int not null default 1 check (siguiente >= 1),
  hasta int check (hasta is null or hasta >= 1),
  vence date,
  activa boolean not null default true
);

insert into public.numeraciones (tipo_comprobante, nombre, prefijo, siguiente, hasta, activa)
values
  ('01', 'Crédito fiscal', 'B01', 1, 100000, true),
  ('02', 'Consumo', 'B02', 1, 100000, true);

-- ---------------------------------------------------------------------------
-- Asientos contables
-- ---------------------------------------------------------------------------

create table public.asientos (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique default nextval('public.asientos_numero_seq'),
  fecha date not null default current_date,
  descripcion text not null,
  origen_tipo text not null check (origen_tipo in (
    'factura', 'pago_recibido', 'factura_proveedor', 'pago_proveedor', 'gasto_menor', 'manual', 'anulacion'
  )),
  origen_id uuid,
  anula_asiento_id uuid references public.asientos (id),
  total numeric(14,2) not null default 0,
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now()
);

create table public.asiento_lineas (
  id uuid primary key default gen_random_uuid(),
  asiento_id uuid not null references public.asientos (id) on delete cascade,
  cuenta_id uuid not null references public.cuentas (id),
  contacto_id uuid references public.contactos (id),
  descripcion text,
  debito numeric(14,2) not null default 0 check (debito >= 0),
  credito numeric(14,2) not null default 0 check (credito >= 0),
  constraint asiento_lineas_un_solo_lado check ((debito = 0) <> (credito = 0))
);

-- ---------------------------------------------------------------------------
-- Facturas de venta
-- ---------------------------------------------------------------------------

create table public.facturas (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique default nextval('public.facturas_numero_seq'),
  tipo_comprobante text not null,
  ncf text not null unique,
  contacto_id uuid not null references public.contactos (id),
  fecha date not null default current_date,
  vencimiento date not null,
  subtotal numeric(14,2) not null default 0,
  descuento numeric(14,2) not null default 0,
  itbis numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  pagado numeric(14,2) not null default 0,
  estado text not null default 'abierta' check (estado in ('abierta', 'pagada', 'anulada')),
  notas text,
  terminos text,
  pie text,
  asiento_id uuid references public.asientos (id),
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now()
);

create table public.factura_lineas (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas (id) on delete cascade,
  producto_id uuid references public.productos (id),
  descripcion text not null default '',
  cantidad numeric(14,2) not null,
  precio numeric(14,2) not null default 0,
  descuento_pct numeric(5,2) not null default 0 check (descuento_pct between 0 and 100),
  itbis_tasa numeric(5,2) not null default 18,
  subtotal numeric(14,2) not null default 0,
  itbis numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  costo_unitario numeric(14,2) not null default 0
);

-- ---------------------------------------------------------------------------
-- Pagos recibidos
-- ---------------------------------------------------------------------------

create table public.pagos_recibidos (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique default nextval('public.pagos_recibidos_numero_seq'),
  contacto_id uuid not null references public.contactos (id),
  factura_id uuid references public.facturas (id),
  fecha date not null default current_date,
  cuenta_id uuid not null references public.cuentas (id),
  metodo text not null default 'efectivo' check (metodo in ('efectivo', 'transferencia', 'tarjeta', 'cheque')),
  monto numeric(14,2) not null check (monto > 0),
  estado text not null default 'activo' check (estado in ('activo', 'anulado')),
  notas text,
  asiento_id uuid references public.asientos (id),
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Facturas de proveedor (compras)
-- ---------------------------------------------------------------------------

create table public.facturas_proveedor (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique default nextval('public.facturas_proveedor_numero_seq'),
  ncf text unique,
  contacto_id uuid not null references public.contactos (id),
  fecha date not null default current_date,
  vencimiento date not null,
  subtotal numeric(14,2) not null default 0,
  itbis numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  pagado numeric(14,2) not null default 0,
  estado text not null default 'abierta' check (estado in ('abierta', 'pagada', 'anulada')),
  notas text,
  asiento_id uuid references public.asientos (id),
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now()
);

create table public.facturas_proveedor_lineas (
  id uuid primary key default gen_random_uuid(),
  factura_proveedor_id uuid not null references public.facturas_proveedor (id) on delete cascade,
  producto_id uuid references public.productos (id),
  cuenta_id uuid references public.cuentas (id),
  descripcion text not null default '',
  cantidad numeric(14,2) not null,
  costo numeric(14,2) not null default 0,
  itbis_tasa numeric(5,2) not null default 0,
  subtotal numeric(14,2) not null default 0,
  itbis numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  constraint facturas_proveedor_lineas_destino check (producto_id is not null or cuenta_id is not null)
);

create table public.pagos_proveedor (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique default nextval('public.pagos_proveedor_numero_seq'),
  factura_proveedor_id uuid not null references public.facturas_proveedor (id),
  contacto_id uuid not null references public.contactos (id),
  fecha date not null default current_date,
  cuenta_id uuid not null references public.cuentas (id),
  metodo text not null default 'efectivo' check (metodo in ('efectivo', 'transferencia', 'tarjeta', 'cheque')),
  monto numeric(14,2) not null check (monto > 0),
  estado text not null default 'activo' check (estado in ('activo', 'anulado')),
  notas text,
  asiento_id uuid references public.asientos (id),
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Gastos menores
-- ---------------------------------------------------------------------------

create table public.gastos_menores (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique default nextval('public.gastos_menores_numero_seq'),
  fecha date not null default current_date,
  contacto_id uuid references public.contactos (id),
  cuenta_gasto_id uuid not null references public.cuentas (id),
  cuenta_pago_id uuid not null references public.cuentas (id),
  descripcion text not null,
  subtotal numeric(14,2) not null default 0,
  itbis_tasa numeric(5,2) not null default 0,
  itbis numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  estado text not null default 'activo' check (estado in ('activo', 'anulado')),
  asiento_id uuid references public.asientos (id),
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

create index cuentas_padre_id_idx on public.cuentas (padre_id);
create index config_contable_cuenta_id_idx on public.config_contable (cuenta_id);
create index contactos_cuenta_cxc_id_idx on public.contactos (cuenta_cxc_id);
create index contactos_cuenta_cxp_id_idx on public.contactos (cuenta_cxp_id);
create index productos_cuenta_ingreso_id_idx on public.productos (cuenta_ingreso_id);
create index productos_cuenta_costo_id_idx on public.productos (cuenta_costo_id);
create index productos_cuenta_inventario_id_idx on public.productos (cuenta_inventario_id);
create index numeraciones_tipo_activa_idx on public.numeraciones (tipo_comprobante, activa);

create index asientos_fecha_idx on public.asientos (fecha);
create index asientos_origen_idx on public.asientos (origen_tipo, origen_id);
create index asientos_anula_asiento_id_idx on public.asientos (anula_asiento_id);
create index asientos_creado_por_idx on public.asientos (creado_por);
create index asiento_lineas_asiento_id_idx on public.asiento_lineas (asiento_id);
create index asiento_lineas_cuenta_id_idx on public.asiento_lineas (cuenta_id);
create index asiento_lineas_contacto_id_idx on public.asiento_lineas (contacto_id);

create index facturas_contacto_id_idx on public.facturas (contacto_id);
create index facturas_fecha_idx on public.facturas (fecha);
create index facturas_vencimiento_idx on public.facturas (vencimiento);
create index facturas_estado_idx on public.facturas (estado);
create index facturas_asiento_id_idx on public.facturas (asiento_id);
create index factura_lineas_factura_id_idx on public.factura_lineas (factura_id);
create index factura_lineas_producto_id_idx on public.factura_lineas (producto_id);

create index pagos_recibidos_contacto_id_idx on public.pagos_recibidos (contacto_id);
create index pagos_recibidos_factura_id_idx on public.pagos_recibidos (factura_id);
create index pagos_recibidos_cuenta_id_idx on public.pagos_recibidos (cuenta_id);
create index pagos_recibidos_fecha_idx on public.pagos_recibidos (fecha);
create index pagos_recibidos_asiento_id_idx on public.pagos_recibidos (asiento_id);

create index facturas_proveedor_contacto_id_idx on public.facturas_proveedor (contacto_id);
create index facturas_proveedor_fecha_idx on public.facturas_proveedor (fecha);
create index facturas_proveedor_estado_idx on public.facturas_proveedor (estado);
create index facturas_proveedor_asiento_id_idx on public.facturas_proveedor (asiento_id);
create index facturas_proveedor_lineas_factura_id_idx on public.facturas_proveedor_lineas (factura_proveedor_id);
create index facturas_proveedor_lineas_producto_id_idx on public.facturas_proveedor_lineas (producto_id);
create index facturas_proveedor_lineas_cuenta_id_idx on public.facturas_proveedor_lineas (cuenta_id);

create index pagos_proveedor_factura_id_idx on public.pagos_proveedor (factura_proveedor_id);
create index pagos_proveedor_contacto_id_idx on public.pagos_proveedor (contacto_id);
create index pagos_proveedor_cuenta_id_idx on public.pagos_proveedor (cuenta_id);
create index pagos_proveedor_fecha_idx on public.pagos_proveedor (fecha);
create index pagos_proveedor_asiento_id_idx on public.pagos_proveedor (asiento_id);

create index gastos_menores_contacto_id_idx on public.gastos_menores (contacto_id);
create index gastos_menores_cuenta_gasto_id_idx on public.gastos_menores (cuenta_gasto_id);
create index gastos_menores_cuenta_pago_id_idx on public.gastos_menores (cuenta_pago_id);
create index gastos_menores_fecha_idx on public.gastos_menores (fecha);
create index gastos_menores_asiento_id_idx on public.gastos_menores (asiento_id);

-- ---------------------------------------------------------------------------
-- Roles y helpers internos
-- ---------------------------------------------------------------------------

create or replace function public.rol_actual()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.rol
  from public.perfiles p
  where p.user_id = auth.uid();
$$;

create or replace function public._cuenta_config(p_clave text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cuenta_id uuid;
begin
  select c.cuenta_id into v_cuenta_id
  from public.config_contable c
  where c.clave = p_clave;

  if v_cuenta_id is null then
    raise exception 'falta configurar la cuenta contable %', p_clave using errcode = '22023';
  end if;

  return v_cuenta_id;
end;
$$;

alter table public.gastos_menores
  alter column cuenta_gasto_id set default public._cuenta_config('gastos_generales'),
  alter column cuenta_pago_id set default public._cuenta_config('caja');

-- ---------------------------------------------------------------------------
-- Validaciones de asientos
-- ---------------------------------------------------------------------------

create or replace function public._validar_cuenta_movimiento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.cuentas c
    where c.id = new.cuenta_id
      and c.acepta_movimientos
  ) then
    raise exception 'la cuenta % no acepta movimientos', new.cuenta_id using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger asiento_lineas_cuenta_movimiento
before insert or update of cuenta_id on public.asiento_lineas
for each row
execute function public._validar_cuenta_movimiento();

create or replace function public._validar_asiento_cuadrado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_debitos numeric(14,2);
  v_creditos numeric(14,2);
  v_lineas int;
begin
  select coalesce(sum(l.debito), 0), coalesce(sum(l.credito), 0), count(*)
  into v_debitos, v_creditos, v_lineas
  from public.asiento_lineas l
  where l.asiento_id = new.asiento_id;

  if v_lineas < 2 then
    raise exception 'el asiento % requiere al menos 2 líneas', new.asiento_id using errcode = '23514';
  end if;

  if v_debitos <> v_creditos then
    raise exception 'el asiento % está descuadrado (débitos %, créditos %)', new.asiento_id, v_debitos, v_creditos
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and old.asiento_id <> new.asiento_id then
    select coalesce(sum(l.debito), 0), coalesce(sum(l.credito), 0), count(*)
    into v_debitos, v_creditos, v_lineas
    from public.asiento_lineas l
    where l.asiento_id = old.asiento_id;

    if v_lineas < 2 or v_debitos <> v_creditos then
      raise exception 'el asiento % está descuadrado', old.asiento_id using errcode = '23514';
    end if;
  end if;

  return null;
end;
$$;

create constraint trigger asiento_lineas_cuadrado
after insert or update on public.asiento_lineas
deferrable initially deferred
for each row
execute function public._validar_asiento_cuadrado();

create or replace function public._crear_asiento(
  p_fecha date,
  p_descripcion text,
  p_origen_tipo text,
  p_origen_id uuid,
  p_lineas jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asiento_id uuid;
  v_linea jsonb;
  v_cuenta_id uuid;
  v_debito numeric(14,2);
  v_credito numeric(14,2);
  v_debitos numeric(14,2) := 0;
  v_creditos numeric(14,2) := 0;
  v_total numeric(14,2);
  v_lineas int;
begin
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' then
    raise exception 'las líneas del asiento son inválidas' using errcode = '22023';
  end if;

  v_lineas := jsonb_array_length(p_lineas);
  if v_lineas < 2 then
    raise exception 'un asiento requiere al menos 2 líneas' using errcode = '23514';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_cuenta_id := nullif(v_linea->>'cuenta_id', '')::uuid;
    if v_cuenta_id is null then
      raise exception 'cada línea del asiento requiere una cuenta' using errcode = '22023';
    end if;

    v_debito := round(coalesce((v_linea->>'debito')::numeric, 0), 2);
    v_credito := round(coalesce((v_linea->>'credito')::numeric, 0), 2);

    if v_debito < 0 or v_credito < 0 then
      raise exception 'los montos del asiento no pueden ser negativos' using errcode = '22023';
    end if;

    if (v_debito = 0) = (v_credito = 0) then
      raise exception 'cada línea debe llevar débito o crédito, nunca ambos' using errcode = '23514';
    end if;

    if not exists (
      select 1 from public.cuentas c
      where c.id = v_cuenta_id and c.acepta_movimientos
    ) then
      raise exception 'la cuenta % no acepta movimientos', v_cuenta_id using errcode = '23514';
    end if;

    v_debitos := v_debitos + v_debito;
    v_creditos := v_creditos + v_credito;
  end loop;

  if v_debitos <> v_creditos then
    raise exception 'el asiento está descuadrado (débitos %, créditos %)', v_debitos, v_creditos
      using errcode = '23514';
  end if;

  v_total := v_debitos;

  insert into public.asientos (fecha, descripcion, origen_tipo, origen_id, total, creado_por)
  values (coalesce(p_fecha, current_date), p_descripcion, p_origen_tipo, p_origen_id, v_total, auth.uid())
  returning id into v_asiento_id;

  insert into public.asiento_lineas (asiento_id, cuenta_id, contacto_id, descripcion, debito, credito)
  select
    v_asiento_id,
    nullif(l->>'cuenta_id', '')::uuid,
    nullif(l->>'contacto_id', '')::uuid,
    coalesce(l->>'descripcion', p_descripcion),
    round(coalesce((l->>'debito')::numeric, 0), 2),
    round(coalesce((l->>'credito')::numeric, 0), 2)
  from jsonb_array_elements(p_lineas) as l;

  return v_asiento_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Contactos
-- ---------------------------------------------------------------------------

create or replace function public.crear_contacto(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_tipo text;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del contacto requeridos' using errcode = '22023';
  end if;

  v_tipo := coalesce(nullif(p->>'tipo', ''), 'cliente');
  if v_tipo not in ('cliente', 'proveedor', 'ambos') then
    raise exception 'tipo de contacto inválido' using errcode = '22023';
  end if;

  if coalesce(trim(p->>'nombre'), '') = '' then
    raise exception 'el nombre del contacto es obligatorio' using errcode = '22023';
  end if;

  insert into public.contactos (
    tipo, nombre, rnc_cedula, telefono, correo, direccion, cuenta_cxc_id, cuenta_cxp_id, activo
  )
  values (
    v_tipo,
    p->>'nombre',
    p->>'rnc_cedula',
    p->>'telefono',
    p->>'correo',
    p->>'direccion',
    nullif(p->>'cuenta_cxc_id', '')::uuid,
    nullif(p->>'cuenta_cxp_id', '')::uuid,
    coalesce((p->>'activo')::boolean, true)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.actualizar_contacto(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_tipo text;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del contacto requeridos' using errcode = '22023';
  end if;

  v_tipo := coalesce(nullif(p->>'tipo', ''), 'cliente');
  if v_tipo not in ('cliente', 'proveedor', 'ambos') then
    raise exception 'tipo de contacto inválido' using errcode = '22023';
  end if;

  update public.contactos c
  set
    tipo = case when p ? 'tipo' then v_tipo else c.tipo end,
    nombre = case when p ? 'nombre' then p->>'nombre' else c.nombre end,
    rnc_cedula = case when p ? 'rnc_cedula' then p->>'rnc_cedula' else c.rnc_cedula end,
    telefono = case when p ? 'telefono' then p->>'telefono' else c.telefono end,
    correo = case when p ? 'correo' then p->>'correo' else c.correo end,
    direccion = case when p ? 'direccion' then p->>'direccion' else c.direccion end,
    cuenta_cxc_id = case when p ? 'cuenta_cxc_id' then nullif(p->>'cuenta_cxc_id', '')::uuid else c.cuenta_cxc_id end,
    cuenta_cxp_id = case when p ? 'cuenta_cxp_id' then nullif(p->>'cuenta_cxp_id', '')::uuid else c.cuenta_cxp_id end,
    activo = case when p ? 'activo' then (p->>'activo')::boolean else c.activo end
  where c.id = p_id
  returning c.id into v_id;

  if v_id is null then
    raise exception 'contacto no encontrado' using errcode = '22023';
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Productos
-- ---------------------------------------------------------------------------

create or replace function public.crear_producto(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_tipo text;
  v_itbis numeric(5,2);
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del producto requeridos' using errcode = '22023';
  end if;

  v_tipo := coalesce(nullif(p->>'tipo', ''), 'producto');
  if v_tipo not in ('producto', 'servicio') then
    raise exception 'tipo de producto inválido' using errcode = '22023';
  end if;

  if coalesce(trim(p->>'nombre'), '') = '' then
    raise exception 'el nombre del producto es obligatorio' using errcode = '22023';
  end if;

  v_itbis := coalesce((p->>'itbis_tasa')::numeric, 18);
  if v_itbis not in (0, 16, 18) then
    raise exception 'la tasa de ITBIS debe ser 0, 16 o 18' using errcode = '22023';
  end if;

  insert into public.productos (
    tipo, nombre, referencia, descripcion, precio, itbis_tasa, inventariable, cantidad, costo,
    cuenta_ingreso_id, cuenta_costo_id, cuenta_inventario_id, activo
  )
  values (
    v_tipo,
    p->>'nombre',
    p->>'referencia',
    p->>'descripcion',
    round(coalesce((p->>'precio')::numeric, 0), 2),
    v_itbis,
    coalesce((p->>'inventariable')::boolean, false),
    round(coalesce((p->>'cantidad')::numeric, 0), 2),
    round(coalesce((p->>'costo')::numeric, 0), 2),
    nullif(p->>'cuenta_ingreso_id', '')::uuid,
    nullif(p->>'cuenta_costo_id', '')::uuid,
    nullif(p->>'cuenta_inventario_id', '')::uuid,
    coalesce((p->>'activo')::boolean, true)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.actualizar_producto(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_tipo text;
  v_itbis numeric(5,2);
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del producto requeridos' using errcode = '22023';
  end if;

  v_tipo := coalesce(nullif(p->>'tipo', ''), 'producto');
  if v_tipo not in ('producto', 'servicio') then
    raise exception 'tipo de producto inválido' using errcode = '22023';
  end if;

  if p ? 'itbis_tasa' then
    v_itbis := (p->>'itbis_tasa')::numeric;
    if v_itbis is not null and v_itbis not in (0, 16, 18) then
      raise exception 'la tasa de ITBIS debe ser 0, 16 o 18' using errcode = '22023';
    end if;
  end if;

  update public.productos pr
  set
    tipo = case when p ? 'tipo' then v_tipo else pr.tipo end,
    nombre = case when p ? 'nombre' then p->>'nombre' else pr.nombre end,
    referencia = case when p ? 'referencia' then p->>'referencia' else pr.referencia end,
    descripcion = case when p ? 'descripcion' then p->>'descripcion' else pr.descripcion end,
    precio = case when p ? 'precio' then round((p->>'precio')::numeric, 2) else pr.precio end,
    itbis_tasa = case when p ? 'itbis_tasa' then v_itbis else pr.itbis_tasa end,
    inventariable = case when p ? 'inventariable' then (p->>'inventariable')::boolean else pr.inventariable end,
    cantidad = case when p ? 'cantidad' then round((p->>'cantidad')::numeric, 2) else pr.cantidad end,
    costo = case when p ? 'costo' then round((p->>'costo')::numeric, 2) else pr.costo end,
    cuenta_ingreso_id = case when p ? 'cuenta_ingreso_id' then nullif(p->>'cuenta_ingreso_id', '')::uuid else pr.cuenta_ingreso_id end,
    cuenta_costo_id = case when p ? 'cuenta_costo_id' then nullif(p->>'cuenta_costo_id', '')::uuid else pr.cuenta_costo_id end,
    cuenta_inventario_id = case when p ? 'cuenta_inventario_id' then nullif(p->>'cuenta_inventario_id', '')::uuid else pr.cuenta_inventario_id end,
    activo = case when p ? 'activo' then (p->>'activo')::boolean else pr.activo end
  where pr.id = p_id
  returning pr.id into v_id;

  if v_id is null then
    raise exception 'producto no encontrado' using errcode = '22023';
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Factura de venta
-- ---------------------------------------------------------------------------

create or replace function public.crear_factura(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_contacto public.contactos%rowtype;
  v_factura_id uuid;
  v_numero int;
  v_ncf text;
  v_tipo text;
  v_fecha date;
  v_vencimiento date;
  v_num public.numeraciones%rowtype;
  v_linea jsonb;
  v_pago jsonb;
  v_asiento_id uuid;
  v_asiento_lineas jsonb := '[]'::jsonb;
  v_producto_id uuid;
  v_producto_nombre text;
  v_producto_tipo text;
  v_producto_precio numeric(14,2);
  v_producto_itbis numeric(5,2);
  v_producto_costo numeric(14,2);
  v_producto_inventariable boolean;
  v_producto_cuenta_ingreso uuid;
  v_producto_cuenta_costo uuid;
  v_producto_cuenta_inventario uuid;
  v_cantidad numeric(14,2);
  v_precio numeric(14,2);
  v_descuento_pct numeric(5,2);
  v_itbis_tasa numeric(5,2);
  v_descripcion text;
  v_bruto numeric(14,2);
  v_descuento numeric(14,2);
  v_subtotal numeric(14,2);
  v_itbis numeric(14,2);
  v_total numeric(14,2);
  v_costo_unitario numeric(14,2);
  v_costo_total numeric(14,2);
  v_cuenta_ingreso uuid;
  v_subtotal_factura numeric(14,2) := 0;
  v_descuento_factura numeric(14,2) := 0;
  v_itbis_factura numeric(14,2) := 0;
  v_total_factura numeric(14,2) := 0;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la factura requeridos' using errcode = '22023';
  end if;

  v_tipo := p->>'tipo_comprobante';
  if v_tipo is null or v_tipo not in ('01', '02') then
    raise exception 'tipo de comprobante inválido' using errcode = '22023';
  end if;

  if p->>'contacto_id' is null then
    raise exception 'el contacto es obligatorio' using errcode = '22023';
  end if;

  select * into v_contacto
  from public.contactos c
  where c.id = (p->>'contacto_id')::uuid and c.activo;

  if not found then
    raise exception 'contacto no encontrado' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_vencimiento := coalesce((p->>'vencimiento')::date, v_fecha);
  if v_vencimiento < v_fecha then
    raise exception 'el vencimiento no puede ser anterior a la fecha' using errcode = '22023';
  end if;

  if p->'lineas' is null
     or jsonb_typeof(p->'lineas') <> 'array'
     or jsonb_array_length(p->'lineas') = 0 then
    raise exception 'la factura requiere al menos una línea' using errcode = '22023';
  end if;

  select * into v_num
  from public.numeraciones n
  where n.tipo_comprobante = v_tipo and n.activa
  order by n.id
  limit 1
  for update;

  if not found then
    raise exception 'no hay numeración activa para el comprobante %', v_tipo using errcode = '22023';
  end if;
  if v_num.hasta is not null and v_num.siguiente > v_num.hasta then
    raise exception 'la numeración % está agotada', v_num.prefijo using errcode = '22023';
  end if;
  if v_num.vence is not null and v_num.vence < v_fecha then
    raise exception 'la numeración % está vencida', v_num.prefijo using errcode = '22023';
  end if;

  v_ncf := v_num.prefijo || lpad(v_num.siguiente::text, 8, '0');
  update public.numeraciones set siguiente = siguiente + 1 where id = v_num.id;

  insert into public.facturas (
    tipo_comprobante, ncf, contacto_id, fecha, vencimiento, notas, terminos, pie, creado_por
  )
  values (
    v_tipo, v_ncf, v_contacto.id, v_fecha, v_vencimiento, p->>'notas', p->>'terminos', p->>'pie', auth.uid()
  )
  returning id, numero into v_factura_id, v_numero;

  for v_linea in select * from jsonb_array_elements(p->'lineas') loop
    v_producto_id := nullif(v_linea->>'producto_id', '')::uuid;
    v_producto_nombre := null;
    v_producto_tipo := null;
    v_producto_precio := null;
    v_producto_itbis := null;
    v_producto_costo := null;
    v_producto_inventariable := false;
    v_producto_cuenta_ingreso := null;
    v_producto_cuenta_costo := null;
    v_producto_cuenta_inventario := null;

    if v_producto_id is not null then
      select
        pr.nombre, pr.tipo, pr.precio, pr.itbis_tasa, pr.costo, pr.inventariable,
        pr.cuenta_ingreso_id, pr.cuenta_costo_id, pr.cuenta_inventario_id
      into
        v_producto_nombre, v_producto_tipo, v_producto_precio, v_producto_itbis, v_producto_costo,
        v_producto_inventariable, v_producto_cuenta_ingreso, v_producto_cuenta_costo,
        v_producto_cuenta_inventario
      from public.productos pr
      where pr.id = v_producto_id and pr.activo;

      if not found then
        raise exception 'producto no encontrado' using errcode = '22023';
      end if;
    end if;

    v_cantidad := round(coalesce((v_linea->>'cantidad')::numeric, 0), 2);
    if v_cantidad <= 0 then
      raise exception 'la cantidad debe ser mayor a cero' using errcode = '22023';
    end if;

    v_precio := round(coalesce((v_linea->>'precio')::numeric, v_producto_precio, 0), 2);
    if v_precio < 0 then
      raise exception 'el precio no puede ser negativo' using errcode = '22023';
    end if;

    v_descuento_pct := round(coalesce((v_linea->>'descuento_pct')::numeric, 0), 2);
    if v_descuento_pct < 0 or v_descuento_pct > 100 then
      raise exception 'el descuento debe estar entre 0 y 100' using errcode = '22023';
    end if;

    v_itbis_tasa := round(coalesce((v_linea->>'itbis_tasa')::numeric, v_producto_itbis, 18), 2);
    if v_itbis_tasa < 0 or v_itbis_tasa > 100 then
      raise exception 'la tasa de ITBIS es inválida' using errcode = '22023';
    end if;

    v_descripcion := coalesce(nullif(v_linea->>'descripcion', ''), v_producto_nombre, '');

    v_bruto := round(v_cantidad * v_precio, 2);
    v_descuento := round(v_bruto * v_descuento_pct / 100, 2);
    v_subtotal := round(v_bruto - v_descuento, 2);
    v_itbis := round(v_subtotal * v_itbis_tasa / 100, 2);
    v_total := round(v_subtotal + v_itbis, 2);

    v_costo_unitario := case when v_producto_inventariable then round(coalesce(v_producto_costo, 0), 2) else 0 end;
    v_costo_total := round(v_cantidad * v_costo_unitario, 2);

    insert into public.factura_lineas (
      factura_id, producto_id, descripcion, cantidad, precio, descuento_pct, itbis_tasa,
      subtotal, itbis, total, costo_unitario
    )
    values (
      v_factura_id, v_producto_id, v_descripcion, v_cantidad, v_precio, v_descuento_pct, v_itbis_tasa,
      v_subtotal, v_itbis, v_total, v_costo_unitario
    );

    v_subtotal_factura := v_subtotal_factura + v_subtotal;
    v_descuento_factura := v_descuento_factura + v_descuento;
    v_itbis_factura := v_itbis_factura + v_itbis;
    v_total_factura := v_total_factura + v_total;

    v_cuenta_ingreso := coalesce(
      v_producto_cuenta_ingreso,
      case when v_producto_tipo = 'servicio'
        then public._cuenta_config('ventas_servicios')
        else public._cuenta_config('ventas')
      end
    );

    if v_subtotal > 0 then
      v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_cuenta_ingreso,
        'debito', 0,
        'credito', v_subtotal,
        'descripcion', 'Venta: ' || left(v_descripcion, 80)
      ));
    end if;

    if v_producto_inventariable then
      if v_costo_total > 0 then
        v_asiento_lineas := v_asiento_lineas || jsonb_build_array(
          jsonb_build_object(
            'cuenta_id', coalesce(v_producto_cuenta_costo, public._cuenta_config('costo_ventas')),
            'debito', v_costo_total,
            'credito', 0,
            'descripcion', 'Costo de venta: ' || left(v_descripcion, 80)
          ),
          jsonb_build_object(
            'cuenta_id', coalesce(v_producto_cuenta_inventario, public._cuenta_config('inventario')),
            'debito', 0,
            'credito', v_costo_total,
            'descripcion', 'Salida de inventario: ' || left(v_descripcion, 80)
          )
        );
      end if;

      update public.productos
      set cantidad = cantidad - v_cantidad
      where id = v_producto_id;
    end if;
  end loop;

  if v_total_factura <= 0 then
    raise exception 'el total de la factura debe ser mayor a cero' using errcode = '22023';
  end if;

  update public.facturas
  set subtotal = v_subtotal_factura,
      descuento = v_descuento_factura,
      itbis = v_itbis_factura,
      total = v_total_factura
  where id = v_factura_id;

  v_asiento_lineas := jsonb_build_array(jsonb_build_object(
    'cuenta_id', coalesce(v_contacto.cuenta_cxc_id, public._cuenta_config('cxc')),
    'debito', v_total_factura,
    'credito', 0,
    'contacto_id', v_contacto.id,
    'descripcion', 'CxC factura ' || v_ncf
  )) || v_asiento_lineas;

  if v_itbis_factura > 0 then
    v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', public._cuenta_config('itbis_por_pagar'),
      'debito', 0,
      'credito', v_itbis_factura,
      'descripcion', 'ITBIS factura ' || v_ncf
    ));
  end if;

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Factura ' || v_ncf,
    'factura',
    v_factura_id,
    v_asiento_lineas
  );

  update public.facturas set asiento_id = v_asiento_id where id = v_factura_id;

  v_pago := p->'pago';
  if v_pago is not null and jsonb_typeof(v_pago) = 'object' then
    perform public.registrar_pago_recibido(jsonb_build_object(
      'factura_id', v_factura_id,
      'contacto_id', v_contacto.id,
      'fecha', coalesce(v_pago->>'fecha', v_fecha::text),
      'cuenta_id', v_pago->>'cuenta_id',
      'metodo', coalesce(v_pago->>'metodo', 'efectivo'),
      'monto', v_pago->'monto',
      'notas', v_pago->>'notas'
    ));
  end if;

  return v_factura_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pagos recibidos
-- ---------------------------------------------------------------------------

create or replace function public.registrar_pago_recibido(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_pago_id uuid;
  v_factura public.facturas%rowtype;
  v_contacto public.contactos%rowtype;
  v_cuenta public.cuentas%rowtype;
  v_monto numeric(14,2);
  v_fecha date;
  v_metodo text;
  v_saldo numeric(14,2);
  v_nuevo_pagado numeric(14,2);
  v_asiento_id uuid;
  v_lineas jsonb;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del pago requeridos' using errcode = '22023';
  end if;

  v_monto := round(coalesce((p->>'monto')::numeric, 0), 2);
  if v_monto <= 0 then
    raise exception 'el monto del pago debe ser mayor a cero' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_metodo := coalesce(nullif(p->>'metodo', ''), 'efectivo');
  if v_metodo not in ('efectivo', 'transferencia', 'tarjeta', 'cheque') then
    raise exception 'método de pago inválido' using errcode = '22023';
  end if;

  if p->>'cuenta_id' is null then
    raise exception 'la cuenta de caja o banco es obligatoria' using errcode = '22023';
  end if;

  select * into v_cuenta
  from public.cuentas c
  where c.id = (p->>'cuenta_id')::uuid and c.activa;

  if not found then
    raise exception 'cuenta de caja o banco no encontrada' using errcode = '22023';
  end if;
  if not v_cuenta.es_caja_banco then
    raise exception 'la cuenta del pago debe ser de caja o banco' using errcode = '22023';
  end if;

  if p->>'factura_id' is not null then
    select * into v_factura
    from public.facturas f
    where f.id = (p->>'factura_id')::uuid
    for update;

    if not found then
      raise exception 'factura no encontrada' using errcode = '22023';
    end if;
    if v_factura.estado = 'anulada' then
      raise exception 'la factura está anulada' using errcode = '22023';
    end if;

    v_saldo := round(v_factura.total - v_factura.pagado, 2);
    if v_saldo <= 0 then
      raise exception 'la factura ya está pagada' using errcode = '22023';
    end if;
    if v_monto > v_saldo then
      raise exception 'el monto excede el saldo pendiente de la factura' using errcode = '22023';
    end if;

    select * into v_contacto from public.contactos c where c.id = v_factura.contacto_id;
  else
    if p->>'contacto_id' is null then
      raise exception 'se requiere la factura o el contacto' using errcode = '22023';
    end if;

    select * into v_contacto
    from public.contactos c
    where c.id = (p->>'contacto_id')::uuid and c.activo;

    if not found then
      raise exception 'contacto no encontrado' using errcode = '22023';
    end if;
  end if;

  insert into public.pagos_recibidos (
    contacto_id, factura_id, fecha, cuenta_id, metodo, monto, notas, creado_por
  )
  values (
    v_contacto.id,
    case when v_factura.id is null then null else v_factura.id end,
    v_fecha,
    v_cuenta.id,
    v_metodo,
    v_monto,
    p->>'notas',
    auth.uid()
  )
  returning id into v_pago_id;

  v_lineas := jsonb_build_array(
    jsonb_build_object(
      'cuenta_id', v_cuenta.id,
      'debito', v_monto,
      'credito', 0,
      'descripcion', 'Pago recibido'
    ),
    jsonb_build_object(
      'cuenta_id', coalesce(v_contacto.cuenta_cxc_id, public._cuenta_config('cxc')),
      'debito', 0,
      'credito', v_monto,
      'contacto_id', v_contacto.id,
      'descripcion', 'Pago recibido'
    )
  );

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Pago recibido' || case when v_factura.id is null then '' else ' factura ' || v_factura.numero::text end,
    'pago_recibido',
    v_pago_id,
    v_lineas
  );

  update public.pagos_recibidos set asiento_id = v_asiento_id where id = v_pago_id;

  if v_factura.id is not null then
    v_nuevo_pagado := round(v_factura.pagado + v_monto, 2);
    update public.facturas
    set pagado = v_nuevo_pagado,
        estado = case when v_nuevo_pagado >= v_factura.total then 'pagada' else 'abierta' end
    where id = v_factura.id;
  end if;

  return v_pago_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Facturas de proveedor
-- ---------------------------------------------------------------------------

create or replace function public.crear_factura_proveedor(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_contacto public.contactos%rowtype;
  v_factura_id uuid;
  v_numero int;
  v_ncf text;
  v_fecha date;
  v_vencimiento date;
  v_linea jsonb;
  v_asiento_id uuid;
  v_asiento_lineas jsonb := '[]'::jsonb;
  v_producto_id uuid;
  v_cuenta_id uuid;
  v_cuenta_debito uuid;
  v_producto_nombre text;
  v_producto_costo numeric(14,2);
  v_producto_cantidad numeric(14,2);
  v_producto_inventariable boolean;
  v_producto_cuenta_costo uuid;
  v_producto_cuenta_inventario uuid;
  v_cantidad numeric(14,2);
  v_costo numeric(14,2);
  v_itbis_tasa numeric(5,2);
  v_descripcion text;
  v_subtotal numeric(14,2);
  v_itbis numeric(14,2);
  v_total numeric(14,2);
  v_nuevo_costo numeric(14,2);
  v_subtotal_factura numeric(14,2) := 0;
  v_itbis_factura numeric(14,2) := 0;
  v_total_factura numeric(14,2) := 0;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la factura de proveedor requeridos' using errcode = '22023';
  end if;

  if p->>'contacto_id' is null then
    raise exception 'el proveedor es obligatorio' using errcode = '22023';
  end if;

  select * into v_contacto
  from public.contactos c
  where c.id = (p->>'contacto_id')::uuid and c.activo;

  if not found then
    raise exception 'proveedor no encontrado' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_vencimiento := coalesce((p->>'vencimiento')::date, v_fecha);
  if v_vencimiento < v_fecha then
    raise exception 'el vencimiento no puede ser anterior a la fecha' using errcode = '22023';
  end if;

  v_ncf := nullif(p->>'ncf', '');
  if v_ncf is not null and exists (select 1 from public.facturas_proveedor fp where fp.ncf = v_ncf) then
    raise exception 'el NCF del proveedor ya está registrado' using errcode = '22023';
  end if;

  if p->'lineas' is null
     or jsonb_typeof(p->'lineas') <> 'array'
     or jsonb_array_length(p->'lineas') = 0 then
    raise exception 'la factura de proveedor requiere al menos una línea' using errcode = '22023';
  end if;

  insert into public.facturas_proveedor (ncf, contacto_id, fecha, vencimiento, notas, creado_por)
  values (v_ncf, v_contacto.id, v_fecha, v_vencimiento, p->>'notas', auth.uid())
  returning id, numero into v_factura_id, v_numero;

  for v_linea in select * from jsonb_array_elements(p->'lineas') loop
    v_producto_id := nullif(v_linea->>'producto_id', '')::uuid;
    v_cuenta_id := nullif(v_linea->>'cuenta_id', '')::uuid;
    v_producto_nombre := null;
    v_producto_costo := null;
    v_producto_cantidad := null;
    v_producto_inventariable := false;
    v_producto_cuenta_costo := null;
    v_producto_cuenta_inventario := null;

    if v_producto_id is not null then
      select
        pr.nombre, pr.costo, pr.cantidad, pr.inventariable, pr.cuenta_costo_id, pr.cuenta_inventario_id
      into
        v_producto_nombre, v_producto_costo, v_producto_cantidad, v_producto_inventariable,
        v_producto_cuenta_costo, v_producto_cuenta_inventario
      from public.productos pr
      where pr.id = v_producto_id and pr.activo;

      if not found then
        raise exception 'producto no encontrado' using errcode = '22023';
      end if;
    elsif v_cuenta_id is null then
      raise exception 'cada línea requiere un producto o una cuenta' using errcode = '22023';
    end if;

    v_cantidad := round(coalesce((v_linea->>'cantidad')::numeric, 0), 2);
    if v_cantidad <= 0 then
      raise exception 'la cantidad debe ser mayor a cero' using errcode = '22023';
    end if;

    v_costo := round(coalesce((v_linea->>'costo')::numeric, 0), 2);
    if v_costo < 0 then
      raise exception 'el costo no puede ser negativo' using errcode = '22023';
    end if;

    v_itbis_tasa := round(coalesce((v_linea->>'itbis_tasa')::numeric, 0), 2);
    if v_itbis_tasa < 0 or v_itbis_tasa > 100 then
      raise exception 'la tasa de ITBIS es inválida' using errcode = '22023';
    end if;

    v_descripcion := coalesce(nullif(v_linea->>'descripcion', ''), v_producto_nombre, '');
    v_subtotal := round(v_cantidad * v_costo, 2);
    v_itbis := round(v_subtotal * v_itbis_tasa / 100, 2);
    v_total := round(v_subtotal + v_itbis, 2);

    if v_producto_id is not null and v_producto_inventariable then
      v_cuenta_debito := coalesce(v_producto_cuenta_inventario, public._cuenta_config('inventario'));
    elsif v_producto_id is not null then
      v_cuenta_debito := coalesce(v_producto_cuenta_costo, public._cuenta_config('gastos_generales'));
    else
      v_cuenta_debito := v_cuenta_id;
    end if;

    insert into public.facturas_proveedor_lineas (
      factura_proveedor_id, producto_id, cuenta_id, descripcion, cantidad, costo, itbis_tasa,
      subtotal, itbis, total
    )
    values (
      v_factura_id,
      v_producto_id,
      case when v_producto_id is null then v_cuenta_id else null end,
      v_descripcion,
      v_cantidad,
      v_costo,
      v_itbis_tasa,
      v_subtotal,
      v_itbis,
      v_total
    );

    v_subtotal_factura := v_subtotal_factura + v_subtotal;
    v_itbis_factura := v_itbis_factura + v_itbis;
    v_total_factura := v_total_factura + v_total;

    if v_subtotal > 0 then
      v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_cuenta_debito,
        'debito', v_subtotal,
        'credito', 0,
        'descripcion', 'Compra: ' || left(v_descripcion, 80)
      ));
    end if;

    if v_producto_id is not null and v_producto_inventariable then
      if v_producto_cantidad > 0 then
        v_nuevo_costo := round(
          ((v_producto_cantidad * v_producto_costo) + (v_cantidad * v_costo)) / (v_producto_cantidad + v_cantidad),
          2
        );
      else
        v_nuevo_costo := v_costo;
      end if;

      update public.productos
      set cantidad = v_producto_cantidad + v_cantidad,
          costo = v_nuevo_costo
      where id = v_producto_id;
    end if;
  end loop;

  if v_total_factura <= 0 then
    raise exception 'el total de la factura de proveedor debe ser mayor a cero' using errcode = '22023';
  end if;

  update public.facturas_proveedor
  set subtotal = v_subtotal_factura,
      itbis = v_itbis_factura,
      total = v_total_factura
  where id = v_factura_id;

  v_asiento_lineas := jsonb_build_array(jsonb_build_object(
    'cuenta_id', coalesce(v_contacto.cuenta_cxp_id, public._cuenta_config('cxp')),
    'debito', 0,
    'credito', v_total_factura,
    'contacto_id', v_contacto.id,
    'descripcion', 'CxP factura proveedor ' || coalesce(v_ncf, v_numero::text)
  )) || v_asiento_lineas;

  if v_itbis_factura > 0 then
    v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', public._cuenta_config('itbis_adelantado'),
      'debito', v_itbis_factura,
      'credito', 0,
      'descripcion', 'ITBIS adelantado factura proveedor ' || coalesce(v_ncf, v_numero::text)
    ));
  end if;

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Factura proveedor ' || coalesce(v_ncf, v_numero::text),
    'factura_proveedor',
    v_factura_id,
    v_asiento_lineas
  );

  update public.facturas_proveedor set asiento_id = v_asiento_id where id = v_factura_id;

  return v_factura_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pagos a proveedores
-- ---------------------------------------------------------------------------

create or replace function public.registrar_pago_proveedor(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_pago_id uuid;
  v_factura public.facturas_proveedor%rowtype;
  v_contacto public.contactos%rowtype;
  v_cuenta public.cuentas%rowtype;
  v_monto numeric(14,2);
  v_fecha date;
  v_metodo text;
  v_saldo numeric(14,2);
  v_nuevo_pagado numeric(14,2);
  v_asiento_id uuid;
  v_lineas jsonb;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del pago requeridos' using errcode = '22023';
  end if;

  if p->>'factura_proveedor_id' is null then
    raise exception 'la factura de proveedor es obligatoria' using errcode = '22023';
  end if;

  v_monto := round(coalesce((p->>'monto')::numeric, 0), 2);
  if v_monto <= 0 then
    raise exception 'el monto del pago debe ser mayor a cero' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_metodo := coalesce(nullif(p->>'metodo', ''), 'efectivo');
  if v_metodo not in ('efectivo', 'transferencia', 'tarjeta', 'cheque') then
    raise exception 'método de pago inválido' using errcode = '22023';
  end if;

  if p->>'cuenta_id' is null then
    raise exception 'la cuenta de caja o banco es obligatoria' using errcode = '22023';
  end if;

  select * into v_cuenta
  from public.cuentas c
  where c.id = (p->>'cuenta_id')::uuid and c.activa;

  if not found then
    raise exception 'cuenta de caja o banco no encontrada' using errcode = '22023';
  end if;
  if not v_cuenta.es_caja_banco then
    raise exception 'la cuenta del pago debe ser de caja o banco' using errcode = '22023';
  end if;

  select * into v_factura
  from public.facturas_proveedor fp
  where fp.id = (p->>'factura_proveedor_id')::uuid
  for update;

  if not found then
    raise exception 'factura de proveedor no encontrada' using errcode = '22023';
  end if;
  if v_factura.estado = 'anulada' then
    raise exception 'la factura de proveedor está anulada' using errcode = '22023';
  end if;

  v_saldo := round(v_factura.total - v_factura.pagado, 2);
  if v_saldo <= 0 then
    raise exception 'la factura de proveedor ya está pagada' using errcode = '22023';
  end if;
  if v_monto > v_saldo then
    raise exception 'el monto excede el saldo pendiente de la factura de proveedor' using errcode = '22023';
  end if;

  select * into v_contacto from public.contactos c where c.id = v_factura.contacto_id;

  insert into public.pagos_proveedor (
    factura_proveedor_id, contacto_id, fecha, cuenta_id, metodo, monto, notas, creado_por
  )
  values (
    v_factura.id, v_contacto.id, v_fecha, v_cuenta.id, v_metodo, v_monto, p->>'notas', auth.uid()
  )
  returning id into v_pago_id;

  v_lineas := jsonb_build_array(
    jsonb_build_object(
      'cuenta_id', coalesce(v_contacto.cuenta_cxp_id, public._cuenta_config('cxp')),
      'debito', v_monto,
      'credito', 0,
      'contacto_id', v_contacto.id,
      'descripcion', 'Pago a proveedor factura ' || v_factura.numero::text
    ),
    jsonb_build_object(
      'cuenta_id', v_cuenta.id,
      'debito', 0,
      'credito', v_monto,
      'descripcion', 'Pago a proveedor'
    )
  );

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Pago a proveedor factura ' || v_factura.numero::text,
    'pago_proveedor',
    v_pago_id,
    v_lineas
  );

  update public.pagos_proveedor set asiento_id = v_asiento_id where id = v_pago_id;

  v_nuevo_pagado := round(v_factura.pagado + v_monto, 2);
  update public.facturas_proveedor
  set pagado = v_nuevo_pagado,
      estado = case when v_nuevo_pagado >= v_factura.total then 'pagada' else 'abierta' end
  where id = v_factura.id;

  return v_pago_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gastos menores
-- ---------------------------------------------------------------------------

create or replace function public.crear_gasto_menor(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_gasto_id uuid;
  v_fecha date;
  v_contacto_id uuid;
  v_cuenta_gasto uuid;
  v_cuenta_pago uuid;
  v_descripcion text;
  v_subtotal numeric(14,2);
  v_itbis_tasa numeric(5,2);
  v_itbis numeric(14,2);
  v_total numeric(14,2);
  v_asiento_id uuid;
  v_lineas jsonb;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del gasto requeridos' using errcode = '22023';
  end if;

  v_descripcion := nullif(trim(p->>'descripcion'), '');
  if v_descripcion is null then
    raise exception 'la descripción del gasto es obligatoria' using errcode = '22023';
  end if;

  v_subtotal := round(coalesce((p->>'subtotal')::numeric, 0), 2);
  if v_subtotal <= 0 then
    raise exception 'el subtotal del gasto debe ser mayor a cero' using errcode = '22023';
  end if;

  v_itbis_tasa := round(coalesce((p->>'itbis_tasa')::numeric, 0), 2);
  if v_itbis_tasa < 0 or v_itbis_tasa > 100 then
    raise exception 'la tasa de ITBIS es inválida' using errcode = '22023';
  end if;

  v_itbis := round(v_subtotal * v_itbis_tasa / 100, 2);
  v_total := round(v_subtotal + v_itbis, 2);

  v_fecha := coalesce((p->>'fecha')::date, current_date);

  v_contacto_id := nullif(p->>'contacto_id', '')::uuid;
  if v_contacto_id is not null and not exists (select 1 from public.contactos c where c.id = v_contacto_id) then
    raise exception 'contacto no encontrado' using errcode = '22023';
  end if;

  v_cuenta_gasto := coalesce(
    nullif(p->>'cuenta_gasto_id', '')::uuid,
    public._cuenta_config('gastos_generales')
  );
  v_cuenta_pago := coalesce(
    nullif(p->>'cuenta_pago_id', '')::uuid,
    public._cuenta_config('caja')
  );

  if not exists (select 1 from public.cuentas c where c.id = v_cuenta_gasto and c.activa) then
    raise exception 'cuenta de gasto no encontrada' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.cuentas c
    where c.id = v_cuenta_pago and c.activa and c.es_caja_banco
  ) then
    raise exception 'la cuenta de pago debe ser de caja o banco' using errcode = '22023';
  end if;

  insert into public.gastos_menores (
    fecha, contacto_id, cuenta_gasto_id, cuenta_pago_id, descripcion,
    subtotal, itbis_tasa, itbis, total, creado_por
  )
  values (
    v_fecha, v_contacto_id, v_cuenta_gasto, v_cuenta_pago, v_descripcion,
    v_subtotal, v_itbis_tasa, v_itbis, v_total, auth.uid()
  )
  returning id into v_gasto_id;

  v_lineas := jsonb_build_array(
    jsonb_build_object(
      'cuenta_id', v_cuenta_gasto,
      'debito', v_subtotal,
      'credito', 0,
      'contacto_id', v_contacto_id,
      'descripcion', left(v_descripcion, 80)
    ),
    jsonb_build_object(
      'cuenta_id', v_cuenta_pago,
      'debito', 0,
      'credito', v_total,
      'descripcion', 'Pago gasto menor'
    )
  );

  if v_itbis > 0 then
    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', public._cuenta_config('itbis_adelantado'),
      'debito', v_itbis,
      'credito', 0,
      'descripcion', 'ITBIS gasto menor'
    ));
  end if;

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Gasto menor: ' || left(v_descripcion, 80),
    'gasto_menor',
    v_gasto_id,
    v_lineas
  );

  update public.gastos_menores set asiento_id = v_asiento_id where id = v_gasto_id;

  return v_gasto_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Anulación de documentos
-- ---------------------------------------------------------------------------

create or replace function public.anular_documento(p_tipo text, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_factura public.facturas%rowtype;
  v_factura_prov public.facturas_proveedor%rowtype;
  v_pago public.pagos_recibidos%rowtype;
  v_pago_prov public.pagos_proveedor%rowtype;
  v_gasto public.gastos_menores%rowtype;
  v_asiento public.asientos%rowtype;
  v_asiento_id uuid;
  v_numero int;
  v_lineas jsonb;
  v_reversion_id uuid;
  v_prod_id uuid;
  v_cantidad numeric(14,2);
  v_nuevo_pagado numeric(14,2);
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_tipo is null or p_tipo not in (
    'factura', 'pago_recibido', 'factura_proveedor', 'pago_proveedor', 'gasto_menor'
  ) then
    raise exception 'tipo de documento inválido' using errcode = '22023';
  end if;

  if p_id is null then
    raise exception 'el documento es obligatorio' using errcode = '22023';
  end if;

  if p_tipo = 'factura' then
    select * into v_factura from public.facturas f where f.id = p_id for update;
    if not found then
      raise exception 'factura no encontrada' using errcode = '22023';
    end if;
    if v_factura.estado = 'anulada' then
      raise exception 'la factura ya está anulada' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.pagos_recibidos pr
      where pr.factura_id = p_id and pr.estado = 'activo'
    ) then
      raise exception 'no se puede anular una factura con pagos activos' using errcode = 'P0001';
    end if;

    for v_prod_id, v_cantidad in
      select fl.producto_id, fl.cantidad
      from public.factura_lineas fl
      join public.productos pr on pr.id = fl.producto_id
      where fl.factura_id = p_id and pr.inventariable
    loop
      update public.productos set cantidad = cantidad + v_cantidad where id = v_prod_id;
    end loop;

    v_asiento_id := v_factura.asiento_id;
    v_numero := v_factura.numero;

    update public.facturas set estado = 'anulada', pagado = 0 where id = p_id;

  elsif p_tipo = 'pago_recibido' then
    select * into v_pago from public.pagos_recibidos pr where pr.id = p_id for update;
    if not found then
      raise exception 'pago no encontrado' using errcode = '22023';
    end if;
    if v_pago.estado = 'anulado' then
      raise exception 'el pago ya está anulado' using errcode = '22023';
    end if;

    v_asiento_id := v_pago.asiento_id;
    v_numero := v_pago.numero;

    update public.pagos_recibidos set estado = 'anulado' where id = p_id;

    if v_pago.factura_id is not null then
      select * into v_factura from public.facturas f where f.id = v_pago.factura_id for update;
      if found and v_factura.estado <> 'anulada' then
        v_nuevo_pagado := round(greatest(v_factura.pagado - v_pago.monto, 0), 2);
        update public.facturas
        set pagado = v_nuevo_pagado,
            estado = case when v_nuevo_pagado >= v_factura.total then 'pagada' else 'abierta' end
        where id = v_factura.id;
      end if;
    end if;

  elsif p_tipo = 'factura_proveedor' then
    select * into v_factura_prov from public.facturas_proveedor fp where fp.id = p_id for update;
    if not found then
      raise exception 'factura de proveedor no encontrada' using errcode = '22023';
    end if;
    if v_factura_prov.estado = 'anulada' then
      raise exception 'la factura de proveedor ya está anulada' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.pagos_proveedor pp
      where pp.factura_proveedor_id = p_id and pp.estado = 'activo'
    ) then
      raise exception 'no se puede anular una factura de proveedor con pagos activos' using errcode = 'P0001';
    end if;

    for v_prod_id, v_cantidad in
      select fpl.producto_id, fpl.cantidad
      from public.facturas_proveedor_lineas fpl
      join public.productos pr on pr.id = fpl.producto_id
      where fpl.factura_proveedor_id = p_id and pr.inventariable
    loop
      update public.productos set cantidad = cantidad - v_cantidad where id = v_prod_id;
    end loop;

    v_asiento_id := v_factura_prov.asiento_id;
    v_numero := v_factura_prov.numero;

    update public.facturas_proveedor set estado = 'anulada', pagado = 0 where id = p_id;

  elsif p_tipo = 'pago_proveedor' then
    select * into v_pago_prov from public.pagos_proveedor pp where pp.id = p_id for update;
    if not found then
      raise exception 'pago a proveedor no encontrado' using errcode = '22023';
    end if;
    if v_pago_prov.estado = 'anulado' then
      raise exception 'el pago a proveedor ya está anulado' using errcode = '22023';
    end if;

    v_asiento_id := v_pago_prov.asiento_id;
    v_numero := v_pago_prov.numero;

    update public.pagos_proveedor set estado = 'anulado' where id = p_id;

    select * into v_factura_prov
    from public.facturas_proveedor fp
    where fp.id = v_pago_prov.factura_proveedor_id
    for update;

    if found and v_factura_prov.estado <> 'anulada' then
      v_nuevo_pagado := round(greatest(v_factura_prov.pagado - v_pago_prov.monto, 0), 2);
      update public.facturas_proveedor
      set pagado = v_nuevo_pagado,
          estado = case when v_nuevo_pagado >= v_factura_prov.total then 'pagada' else 'abierta' end
      where id = v_factura_prov.id;
    end if;

  else
    select * into v_gasto from public.gastos_menores gm where gm.id = p_id for update;
    if not found then
      raise exception 'gasto menor no encontrado' using errcode = '22023';
    end if;
    if v_gasto.estado = 'anulado' then
      raise exception 'el gasto menor ya está anulado' using errcode = '22023';
    end if;

    v_asiento_id := v_gasto.asiento_id;
    v_numero := v_gasto.numero;

    update public.gastos_menores set estado = 'anulado' where id = p_id;
  end if;

  if v_asiento_id is null then
    raise exception 'el documento no tiene asiento contable' using errcode = '22023';
  end if;

  select * into v_asiento from public.asientos a where a.id = v_asiento_id;
  if not found then
    raise exception 'asiento no encontrado' using errcode = '22023';
  end if;
  if exists (select 1 from public.asientos a where a.anula_asiento_id = v_asiento_id) then
    raise exception 'el asiento del documento ya fue anulado' using errcode = '22023';
  end if;

  select jsonb_agg(jsonb_build_object(
    'cuenta_id', l.cuenta_id,
    'contacto_id', l.contacto_id,
    'descripcion', 'Anulación: ' || left(coalesce(l.descripcion, ''), 70),
    'debito', l.credito,
    'credito', l.debito
  ) order by l.id)
  into v_lineas
  from public.asiento_lineas l
  where l.asiento_id = v_asiento_id;

  if v_lineas is null or jsonb_array_length(v_lineas) < 2 then
    raise exception 'el asiento no tiene líneas para revertir' using errcode = '22023';
  end if;

  v_reversion_id := public._crear_asiento(
    current_date,
    'Anulación ' || p_tipo || ' #' || coalesce(v_numero::text, ''),
    'anulacion',
    p_id,
    v_lineas
  );

  update public.asientos set anula_asiento_id = v_asiento_id where id = v_reversion_id;

  return p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reportes
-- ---------------------------------------------------------------------------

create or replace function public.reporte_libro_diario(p_desde date, p_hasta date)
returns table (
  asiento_numero int,
  fecha date,
  asiento_descripcion text,
  origen_tipo text,
  cuenta_codigo text,
  cuenta_nombre text,
  debito numeric,
  credito numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    a.numero,
    a.fecha,
    a.descripcion,
    a.origen_tipo,
    c.codigo,
    c.nombre,
    l.debito,
    l.credito
  from public.asientos a
  join public.asiento_lineas l on l.asiento_id = a.id
  join public.cuentas c on c.id = l.cuenta_id
  where a.fecha between p_desde and p_hasta
  order by a.fecha, a.numero, l.id;
$$;

create or replace function public.reporte_balance_comprobacion(p_desde date, p_hasta date)
returns table (
  cuenta_codigo text,
  cuenta_nombre text,
  tipo text,
  debitos numeric,
  creditos numeric,
  saldo numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.codigo,
    c.nombre,
    c.tipo,
    round(sum(l.debito), 2),
    round(sum(l.credito), 2),
    case
      when c.naturaleza = 'debito' then round(sum(l.debito) - sum(l.credito), 2)
      else round(sum(l.credito) - sum(l.debito), 2)
    end
  from public.asientos a
  join public.asiento_lineas l on l.asiento_id = a.id
  join public.cuentas c on c.id = l.cuenta_id
  where a.fecha between p_desde and p_hasta
  group by c.id, c.codigo, c.nombre, c.tipo, c.naturaleza
  having sum(l.debito) <> 0 or sum(l.credito) <> 0
  order by c.codigo;
$$;

create or replace function public.reporte_estado_resultados(p_desde date, p_hasta date)
returns table (
  tipo text,
  cuenta_codigo text,
  cuenta_nombre text,
  monto numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.tipo,
    c.codigo,
    c.nombre,
    round(
      case
        when c.tipo = 'ingreso' then sum(l.credito) - sum(l.debito)
        else sum(l.debito) - sum(l.credito)
      end,
      2
    )
  from public.asientos a
  join public.asiento_lineas l on l.asiento_id = a.id
  join public.cuentas c on c.id = l.cuenta_id
  where a.fecha between p_desde and p_hasta
    and c.tipo in ('ingreso', 'costo', 'gasto')
  group by c.id, c.codigo, c.nombre, c.tipo
  having sum(l.debito) <> 0 or sum(l.credito) <> 0
  order by array_position(array['ingreso', 'costo', 'gasto'], c.tipo), c.codigo;
$$;

create or replace function public.reporte_cxc(p_fecha date)
returns table (
  contacto_id uuid,
  contacto_nombre text,
  factura_id uuid,
  numero int,
  ncf text,
  fecha date,
  vencimiento date,
  total numeric,
  pagado numeric,
  saldo numeric,
  dias_vencida int
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    f.contacto_id,
    c.nombre,
    f.id,
    f.numero,
    f.ncf,
    f.fecha,
    f.vencimiento,
    f.total,
    f.pagado,
    round(f.total - f.pagado, 2),
    greatest(coalesce(p_fecha, current_date) - f.vencimiento, 0)
  from public.facturas f
  join public.contactos c on c.id = f.contacto_id
  where f.estado <> 'anulada'
    and f.total - f.pagado > 0
  order by f.fecha, f.numero;
$$;

-- ---------------------------------------------------------------------------
-- RLS y permisos de tablas
-- ---------------------------------------------------------------------------

do $$
declare
  v_tabla text;
begin
  foreach v_tabla in array array[
    'empresa',
    'cuentas',
    'config_contable',
    'contactos',
    'productos',
    'numeraciones',
    'asientos',
    'asiento_lineas',
    'facturas',
    'factura_lineas',
    'pagos_recibidos',
    'facturas_proveedor',
    'facturas_proveedor_lineas',
    'pagos_proveedor',
    'gastos_menores'
  ] loop
    execute format('alter table public.%I enable row level security', v_tabla);
    execute format('revoke all on public.%I from anon', v_tabla);
    execute format('revoke all on public.%I from authenticated', v_tabla);
    execute format('grant select on public.%I to authenticated', v_tabla);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.rol_actual()) is not null)',
      v_tabla || '_lectura',
      v_tabla
    );
  end loop;
end;
$$;

revoke all on sequence public.asientos_numero_seq from anon, authenticated;
revoke all on sequence public.facturas_numero_seq from anon, authenticated;
revoke all on sequence public.pagos_recibidos_numero_seq from anon, authenticated;
revoke all on sequence public.facturas_proveedor_numero_seq from anon, authenticated;
revoke all on sequence public.pagos_proveedor_numero_seq from anon, authenticated;
revoke all on sequence public.gastos_menores_numero_seq from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Permisos de funciones
-- ---------------------------------------------------------------------------

revoke all on function public.rol_actual() from public, anon, authenticated;
grant execute on function public.rol_actual() to authenticated;

revoke all on function public._cuenta_config(text) from public, anon, authenticated;
revoke all on function public._crear_asiento(date, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public._validar_cuenta_movimiento() from public, anon, authenticated;
revoke all on function public._validar_asiento_cuadrado() from public, anon, authenticated;

revoke all on function public.crear_contacto(jsonb) from public, anon, authenticated;
revoke all on function public.actualizar_contacto(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.crear_producto(jsonb) from public, anon, authenticated;
revoke all on function public.actualizar_producto(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.crear_factura(jsonb) from public, anon, authenticated;
revoke all on function public.registrar_pago_recibido(jsonb) from public, anon, authenticated;
revoke all on function public.crear_factura_proveedor(jsonb) from public, anon, authenticated;
revoke all on function public.registrar_pago_proveedor(jsonb) from public, anon, authenticated;
revoke all on function public.crear_gasto_menor(jsonb) from public, anon, authenticated;
revoke all on function public.anular_documento(text, uuid) from public, anon, authenticated;

grant execute on function public.crear_contacto(jsonb) to authenticated;
grant execute on function public.actualizar_contacto(uuid, jsonb) to authenticated;
grant execute on function public.crear_producto(jsonb) to authenticated;
grant execute on function public.actualizar_producto(uuid, jsonb) to authenticated;
grant execute on function public.crear_factura(jsonb) to authenticated;
grant execute on function public.registrar_pago_recibido(jsonb) to authenticated;
grant execute on function public.crear_factura_proveedor(jsonb) to authenticated;
grant execute on function public.registrar_pago_proveedor(jsonb) to authenticated;
grant execute on function public.crear_gasto_menor(jsonb) to authenticated;
grant execute on function public.anular_documento(text, uuid) to authenticated;

revoke all on function public.reporte_libro_diario(date, date) from public, anon, authenticated;
revoke all on function public.reporte_balance_comprobacion(date, date) from public, anon, authenticated;
revoke all on function public.reporte_estado_resultados(date, date) from public, anon, authenticated;
revoke all on function public.reporte_cxc(date) from public, anon, authenticated;

grant execute on function public.reporte_libro_diario(date, date) to authenticated;
grant execute on function public.reporte_balance_comprobacion(date, date) to authenticated;
grant execute on function public.reporte_estado_resultados(date, date) to authenticated;
grant execute on function public.reporte_cxc(date) to authenticated;

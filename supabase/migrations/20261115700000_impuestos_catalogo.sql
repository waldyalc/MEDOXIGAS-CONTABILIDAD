-- ---------------------------------------------------------------------------
-- Catálogo de impuestos (ITBIS, CDT, propina legal y exento)
--
-- Migración aditiva y reintentable. No borra ni reescribe datos:
--   * Tabla impuestos con código, nombre, grupo/tipo, tarifa, cuenta contable
--     por pagar y estado.
--   * Semilla de Alegra: Ninguno, ITBIS 18 %, ITBIS 16 %, ITBIS 0 %, CDT 2 %,
--     Propina 10 % y Exento 0 %.
--   * Cuentas 2105 (CDT por pagar) y 2106 (Propina legal por pagar) como
--     subcuentas de Pasivos corrientes; ITBIS usa la cuenta ya configurada.
--   * impuesto_id en productos y en las líneas de todos los documentos.
--   * otros_impuestos y propina en las cabeceras para no mezclarlos con ITBIS.
--   * Trigger que completa impuesto_id por tarifa en documentos viejos o en
--     llamadas que todavía solo mandan itbis_tasa (18/16/0).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Cuentas para CDT y propina legal
-- ---------------------------------------------------------------------------

insert into public.cuentas (codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos, es_caja_banco)
select v.codigo, v.nombre, 'pasivo', 'credito', p.id, true, false
from (values
  ('2105', 'CDT por pagar'),
  ('2106', 'Propina legal por pagar')
) as v(codigo, nombre)
join public.cuentas p on p.codigo = '21'
where not exists (select 1 from public.cuentas c where c.codigo = v.codigo);

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------

create table if not exists public.impuestos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  tipo text not null check (tipo in ('ninguno', 'itbis', 'otro', 'propina', 'exento')),
  tarifa numeric(5,2) not null default 0 check (tarifa >= 0 and tarifa <= 100),
  cuenta_id uuid references public.cuentas (id),
  activo boolean not null default true,
  orden int not null default 0,
  creado_en timestamptz not null default now()
);

insert into public.impuestos (codigo, nombre, tipo, tarifa, cuenta_id, activo, orden)
select v.codigo, v.nombre, v.tipo, v.tarifa, c.id, true, v.orden
from (values
  ('ninguno', 'Ninguno', 'ninguno', 0.00::numeric, null::text, 0),
  ('itbis-18', 'ITBIS', 'itbis', 18.00::numeric, '2102', 10),
  ('itbis-16', 'ITBIS 16%', 'itbis', 16.00::numeric, '2102', 11),
  ('itbis-0', 'ITBIS 0%', 'itbis', 0.00::numeric, '2102', 12),
  ('cdt', 'CDT', 'otro', 2.00::numeric, '2105', 20),
  ('propina', 'Propina', 'propina', 10.00::numeric, '2106', 30),
  ('exento', 'Exento', 'exento', 0.00::numeric, null::text, 40)
) as v(codigo, nombre, tipo, tarifa, cuenta_codigo, orden)
left join public.cuentas c on c.codigo = v.cuenta_codigo
on conflict (codigo) do nothing;

-- ---------------------------------------------------------------------------
-- Referencias en documentos
-- ---------------------------------------------------------------------------

alter table public.productos add column if not exists impuesto_id uuid references public.impuestos (id);
alter table public.factura_lineas add column if not exists impuesto_id uuid references public.impuestos (id);
alter table public.facturas_proveedor_lineas add column if not exists impuesto_id uuid references public.impuestos (id);
alter table public.nota_credito_venta_lineas add column if not exists impuesto_id uuid references public.impuestos (id);
alter table public.nota_debito_venta_lineas add column if not exists impuesto_id uuid references public.impuestos (id);
alter table public.nota_credito_compra_lineas add column if not exists impuesto_id uuid references public.impuestos (id);
alter table public.cotizacion_lineas add column if not exists impuesto_id uuid references public.impuestos (id);
alter table public.remision_lineas add column if not exists impuesto_id uuid references public.impuestos (id);
alter table public.orden_compra_lineas add column if not exists impuesto_id uuid references public.impuestos (id);
alter table public.factura_recurrente_lineas add column if not exists impuesto_id uuid references public.impuestos (id);
alter table public.gastos_menores add column if not exists impuesto_id uuid references public.impuestos (id);
alter table public.pagos_recurrentes add column if not exists impuesto_id uuid references public.impuestos (id);

alter table public.facturas add column if not exists otros_impuestos numeric(14,2) not null default 0;
alter table public.facturas add column if not exists propina numeric(14,2) not null default 0;
alter table public.facturas_proveedor add column if not exists otros_impuestos numeric(14,2) not null default 0;
alter table public.facturas_proveedor add column if not exists propina numeric(14,2) not null default 0;
alter table public.gastos_menores add column if not exists otros_impuestos numeric(14,2) not null default 0;
alter table public.gastos_menores add column if not exists propina numeric(14,2) not null default 0;
alter table public.notas_credito_venta add column if not exists otros_impuestos numeric(14,2) not null default 0;
alter table public.notas_credito_venta add column if not exists propina numeric(14,2) not null default 0;
alter table public.notas_debito_venta add column if not exists otros_impuestos numeric(14,2) not null default 0;
alter table public.notas_debito_venta add column if not exists propina numeric(14,2) not null default 0;
alter table public.notas_credito_compra add column if not exists otros_impuestos numeric(14,2) not null default 0;
alter table public.notas_credito_compra add column if not exists propina numeric(14,2) not null default 0;
alter table public.cotizaciones add column if not exists otros_impuestos numeric(14,2) not null default 0;
alter table public.cotizaciones add column if not exists propina numeric(14,2) not null default 0;
alter table public.remisiones add column if not exists otros_impuestos numeric(14,2) not null default 0;
alter table public.remisiones add column if not exists propina numeric(14,2) not null default 0;
alter table public.ordenes_compra add column if not exists otros_impuestos numeric(14,2) not null default 0;
alter table public.ordenes_compra add column if not exists propina numeric(14,2) not null default 0;

create index if not exists productos_impuesto_id_idx on public.productos (impuesto_id);
create index if not exists factura_lineas_impuesto_id_idx on public.factura_lineas (impuesto_id);
create index if not exists facturas_proveedor_lineas_impuesto_id_idx on public.facturas_proveedor_lineas (impuesto_id);
create index if not exists nota_credito_venta_lineas_impuesto_id_idx on public.nota_credito_venta_lineas (impuesto_id);
create index if not exists nota_debito_venta_lineas_impuesto_id_idx on public.nota_debito_venta_lineas (impuesto_id);
create index if not exists nota_credito_compra_lineas_impuesto_id_idx on public.nota_credito_compra_lineas (impuesto_id);
create index if not exists cotizacion_lineas_impuesto_id_idx on public.cotizacion_lineas (impuesto_id);
create index if not exists remision_lineas_impuesto_id_idx on public.remision_lineas (impuesto_id);
create index if not exists orden_compra_lineas_impuesto_id_idx on public.orden_compra_lineas (impuesto_id);
create index if not exists gastos_menores_impuesto_id_idx on public.gastos_menores (impuesto_id);

-- Orden de inserción de las líneas: los wrappers del motor lo usan para
-- asociar cada línea del JSON con la fila insertada.
do $$
declare
  v_tabla text;
begin
  foreach v_tabla in array array[
    'factura_lineas',
    'facturas_proveedor_lineas',
    'nota_credito_venta_lineas',
    'nota_debito_venta_lineas',
    'nota_credito_compra_lineas',
    'cotizacion_lineas',
    'remision_lineas',
    'orden_compra_lineas'
  ] loop
    execute format('alter table public.%I add column if not exists orden bigint', v_tabla);
    execute format('create sequence if not exists public.%I_orden_seq', v_tabla);
    execute format(
      'update public.%I t set orden = s.rn
         from (select id, row_number() over (order by id) as rn from public.%I) s
        where t.id = s.id and t.orden is null',
      v_tabla,
      v_tabla
    );
    execute format('select setval(%L, greatest(coalesce((select max(orden) from public.%I), 0), 1))',
      'public.' || v_tabla || '_orden_seq', v_tabla);
    execute format('alter table public.%I alter column orden set default nextval(%L::regclass)',
      v_tabla, 'public.' || v_tabla || '_orden_seq');
    execute format('alter table public.%I alter column orden set not null', v_tabla);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helpers internos
-- ---------------------------------------------------------------------------

create or replace function public._impuesto_id_por_tasa(p_tasa numeric)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select i.id
  from public.impuestos i
  where i.activo
    and i.tarifa = round(coalesce(p_tasa, 0), 2)
  order by case when i.tipo = 'itbis' then 0 else 1 end, i.orden, i.codigo
  limit 1;
$$;

create or replace function public._resolver_impuesto(p_impuesto_id uuid, p_tasa numeric)
returns public.impuestos
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_impuesto public.impuestos%rowtype;
begin
  if p_impuesto_id is not null then
    select * into v_impuesto
    from public.impuestos i
    where i.id = p_impuesto_id and i.activo;

    if not found then
      raise exception 'impuesto no encontrado o inactivo' using errcode = '22023';
    end if;

    return v_impuesto;
  end if;

  select * into v_impuesto
  from public.impuestos i
  where i.activo
    and i.tarifa = round(coalesce(p_tasa, 0), 2)
  order by case when i.tipo = 'itbis' then 0 else 1 end, i.orden, i.codigo
  limit 1;

  if not found then
    if round(coalesce(p_tasa, 0), 2) <> 0 then
      raise exception 'la tarifa % no está en el catálogo de impuestos', p_tasa using errcode = '22023';
    end if;
    select * into v_impuesto from public.impuestos i where i.codigo = 'ninguno';
  end if;

  return v_impuesto;
end;
$$;

create or replace function public._fijar_impuesto_linea()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.impuesto_id is null then
    new.impuesto_id := public._impuesto_id_por_tasa(new.itbis_tasa);
  end if;
  return new;
end;
$$;

do $$
declare
  v_tabla text;
begin
  foreach v_tabla in array array[
    'productos',
    'factura_lineas',
    'facturas_proveedor_lineas',
    'nota_credito_venta_lineas',
    'nota_debito_venta_lineas',
    'nota_credito_compra_lineas',
    'cotizacion_lineas',
    'remision_lineas',
    'orden_compra_lineas',
    'factura_recurrente_lineas',
    'gastos_menores',
    'pagos_recurrentes'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'fijar_impuesto_' || v_tabla, v_tabla);
    execute format(
      'create trigger %I before insert on public.%I for each row execute function public._fijar_impuesto_linea()',
      'fijar_impuesto_' || v_tabla,
      v_tabla
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: catálogo de solo lectura para usuarios con sesión
-- ---------------------------------------------------------------------------

alter table public.impuestos enable row level security;
revoke all on public.impuestos from anon, authenticated;
grant select on public.impuestos to authenticated;
drop policy if exists impuestos_lectura on public.impuestos;
create policy impuestos_lectura on public.impuestos
  for select to authenticated
  using ((select public.rol_actual()) is not null);

revoke all on function public._impuesto_id_por_tasa(numeric) from public, anon, authenticated;
revoke all on function public._resolver_impuesto(uuid, numeric) from public, anon, authenticated;
revoke all on function public._fijar_impuesto_linea() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Notas de débito de venta (NCF B03) ligadas a una factura
--
-- Migración aditiva y reintentable: no borra ni cambia datos existentes.
-- · Numeración 03/B03 automática.
-- · Tablas notas_debito_venta y nota_debito_venta_lineas con RLS de lectura.
-- · RPC crear_nota_debito_venta (admin/contador) con el mismo asiento de una
--   factura: Dr Cuentas por cobrar / Cr Ventas / Cr ITBIS por pagar. No mueve
--   inventario ni modifica el saldo de la factura; suma al saldo del cliente.
-- ---------------------------------------------------------------------------

insert into public.numeraciones (tipo_comprobante, nombre, prefijo, siguiente, hasta, activa)
select '03', 'Notas de débito', 'B03', 1, 100000, true
where not exists (
  select 1 from public.numeraciones n where n.tipo_comprobante = '03'
);

alter table public.asientos drop constraint if exists asientos_origen_tipo_check;
alter table public.asientos
  add constraint asientos_origen_tipo_check check (origen_tipo in (
    'factura', 'pago_recibido', 'factura_proveedor', 'pago_proveedor', 'gasto_menor',
    'manual', 'anulacion', 'nota_credito_venta', 'nota_credito_compra', 'nota_debito',
    'transferencia', 'deposito', 'conciliacion'
  ));

create sequence if not exists public.notas_debito_venta_numero_seq;

create table if not exists public.notas_debito_venta (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique default nextval('public.notas_debito_venta_numero_seq'),
  ncf text not null unique,
  factura_id uuid not null references public.facturas (id),
  contacto_id uuid not null references public.contactos (id),
  tipo text not null check (tipo in ('texto', 'montos')),
  fecha date not null default current_date,
  subtotal numeric(14,2) not null default 0,
  descuento numeric(14,2) not null default 0,
  itbis numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  estado text not null default 'activa' check (estado in ('activa', 'anulada')),
  notas text,
  asiento_id uuid references public.asientos (id),
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now()
);

create table if not exists public.nota_debito_venta_lineas (
  id uuid primary key default gen_random_uuid(),
  nota_id uuid not null references public.notas_debito_venta (id) on delete cascade,
  producto_id uuid references public.productos (id),
  descripcion text not null default '',
  cantidad numeric(14,2) not null check (cantidad > 0),
  precio numeric(14,2) not null default 0,
  descuento_pct numeric(5,2) not null default 0 check (descuento_pct between 0 and 100),
  itbis_tasa numeric(5,2) not null default 0,
  subtotal numeric(14,2) not null default 0,
  itbis numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0
);

create index if not exists notas_debito_venta_factura_id_idx on public.notas_debito_venta (factura_id);
create index if not exists notas_debito_venta_contacto_id_idx on public.notas_debito_venta (contacto_id);
create index if not exists notas_debito_venta_fecha_idx on public.notas_debito_venta (fecha);
create index if not exists notas_debito_venta_asiento_id_idx on public.notas_debito_venta (asiento_id);
create index if not exists nota_debito_venta_lineas_nota_id_idx on public.nota_debito_venta_lineas (nota_id);
create index if not exists nota_debito_venta_lineas_producto_id_idx on public.nota_debito_venta_lineas (producto_id);

-- ---------------------------------------------------------------------------
-- RPC: crear nota de débito de venta
-- ---------------------------------------------------------------------------

create or replace function public.crear_nota_debito_venta(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_factura public.facturas%rowtype;
  v_contacto public.contactos%rowtype;
  v_nota_id uuid;
  v_num public.numeraciones%rowtype;
  v_ncf text;
  v_fecha date;
  v_tipo text;
  v_linea jsonb;
  v_producto_id uuid;
  v_producto_nombre text;
  v_producto_tipo text;
  v_producto_precio numeric(14,2);
  v_producto_itbis numeric(5,2);
  v_producto_cuenta_ingreso uuid;
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
  v_cuenta_ingreso uuid;
  v_subtotal_nota numeric(14,2) := 0;
  v_descuento_nota numeric(14,2) := 0;
  v_itbis_nota numeric(14,2) := 0;
  v_total_nota numeric(14,2) := 0;
  v_asiento_lineas jsonb := '[]'::jsonb;
  v_asiento_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or nullif(p->>'factura_id', '') is null then
    raise exception 'la factura es obligatoria' using errcode = '22023';
  end if;

  v_tipo := p->>'tipo';
  if v_tipo is null or v_tipo not in ('texto', 'montos') then
    raise exception 'tipo de nota de débito inválido' using errcode = '22023';
  end if;

  select * into v_factura
  from public.facturas f
  where f.id = (p->>'factura_id')::uuid;

  if not found then
    raise exception 'factura no encontrada' using errcode = '22023';
  end if;
  if v_factura.estado = 'anulada' then
    raise exception 'la factura está anulada' using errcode = '22023';
  end if;

  select * into v_contacto
  from public.contactos c
  where c.id = v_factura.contacto_id;

  if not found then
    raise exception 'contacto no encontrado' using errcode = '22023';
  end if;

  if nullif(p->>'contacto_id', '') is not null
     and (p->>'contacto_id')::uuid <> v_factura.contacto_id then
    raise exception 'la factura no pertenece al cliente indicado' using errcode = '22023';
  end if;

  if p->'lineas' is null
     or jsonb_typeof(p->'lineas') <> 'array'
     or jsonb_array_length(p->'lineas') = 0 then
    raise exception 'la nota de débito requiere al menos una línea' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);

  select * into v_num
  from public.numeraciones n
  where n.tipo_comprobante = '03' and n.activa
  order by n.id
  limit 1
  for update;

  if not found then
    raise exception 'no hay numeración activa para notas de débito (03)' using errcode = '22023';
  end if;
  if v_num.hasta is not null and v_num.siguiente > v_num.hasta then
    raise exception 'la numeración % está agotada', v_num.prefijo using errcode = '22023';
  end if;
  if v_num.vence is not null and v_num.vence < v_fecha then
    raise exception 'la numeración % está vencida', v_num.prefijo using errcode = '22023';
  end if;

  v_ncf := v_num.prefijo || lpad(v_num.siguiente::text, 8, '0');
  update public.numeraciones set siguiente = siguiente + 1 where id = v_num.id;

  insert into public.notas_debito_venta (
    ncf, factura_id, contacto_id, tipo, fecha, notas, creado_por
  )
  values (
    v_ncf, v_factura.id, v_factura.contacto_id, v_tipo, v_fecha, p->>'notas', auth.uid()
  )
  returning id into v_nota_id;

  for v_linea in select * from jsonb_array_elements(p->'lineas') loop
    v_producto_id := nullif(v_linea->>'producto_id', '')::uuid;
    v_producto_nombre := null;
    v_producto_tipo := null;
    v_producto_precio := null;
    v_producto_itbis := null;
    v_producto_cuenta_ingreso := null;

    if v_producto_id is not null then
      select pr.nombre, pr.tipo, pr.precio, pr.itbis_tasa, pr.cuenta_ingreso_id
      into v_producto_nombre, v_producto_tipo, v_producto_precio, v_producto_itbis, v_producto_cuenta_ingreso
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
    if v_descripcion = '' then
      raise exception 'cada línea requiere un producto o una descripción' using errcode = '22023';
    end if;

    v_bruto := round(v_cantidad * v_precio, 2);
    v_descuento := round(v_bruto * v_descuento_pct / 100, 2);
    v_subtotal := round(v_bruto - v_descuento, 2);
    v_itbis := round(v_subtotal * v_itbis_tasa / 100, 2);
    v_total := round(v_subtotal + v_itbis, 2);

    insert into public.nota_debito_venta_lineas (
      nota_id, producto_id, descripcion, cantidad, precio, descuento_pct,
      itbis_tasa, subtotal, itbis, total
    )
    values (
      v_nota_id, v_producto_id, v_descripcion, v_cantidad, v_precio, v_descuento_pct,
      v_itbis_tasa, v_subtotal, v_itbis, v_total
    );

    v_subtotal_nota := v_subtotal_nota + v_subtotal;
    v_descuento_nota := v_descuento_nota + v_descuento;
    v_itbis_nota := v_itbis_nota + v_itbis;
    v_total_nota := v_total_nota + v_total;

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
        'descripcion', 'Cargo nota de débito: ' || left(v_descripcion, 70)
      ));
    end if;
  end loop;

  if v_total_nota <= 0 then
    raise exception 'el total de la nota de débito debe ser mayor a cero' using errcode = '22023';
  end if;

  update public.notas_debito_venta
  set subtotal = v_subtotal_nota,
      descuento = v_descuento_nota,
      itbis = v_itbis_nota,
      total = v_total_nota
  where id = v_nota_id;

  v_asiento_lineas := jsonb_build_array(jsonb_build_object(
    'cuenta_id', coalesce(v_contacto.cuenta_cxc_id, public._cuenta_config('cxc')),
    'debito', v_total_nota,
    'credito', 0,
    'contacto_id', v_contacto.id,
    'descripcion', 'CxC nota de débito ' || v_ncf
  )) || v_asiento_lineas;

  if v_itbis_nota > 0 then
    v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', public._cuenta_config('itbis_por_pagar'),
      'debito', 0,
      'credito', v_itbis_nota,
      'descripcion', 'ITBIS nota de débito ' || v_ncf
    ));
  end if;

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Nota de débito ' || v_ncf,
    'nota_debito',
    v_nota_id,
    v_asiento_lineas
  );

  update public.notas_debito_venta set asiento_id = v_asiento_id where id = v_nota_id;

  return v_nota_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS y permisos
-- ---------------------------------------------------------------------------

do $$
declare
  v_tabla text;
begin
  foreach v_tabla in array array[
    'notas_debito_venta',
    'nota_debito_venta_lineas'
  ] loop
    execute format('alter table public.%I enable row level security', v_tabla);
    execute format('revoke all on public.%I from anon', v_tabla);
    execute format('revoke all on public.%I from authenticated', v_tabla);
    execute format('grant select on public.%I to authenticated', v_tabla);
    execute format('drop policy if exists %I on public.%I', v_tabla || '_lectura', v_tabla);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.rol_actual()) is not null)',
      v_tabla || '_lectura',
      v_tabla
    );
  end loop;
end;
$$;

revoke all on sequence public.notas_debito_venta_numero_seq from anon, authenticated;

revoke all on function public.crear_nota_debito_venta(jsonb) from public, anon, authenticated;
grant execute on function public.crear_nota_debito_venta(jsonb) to authenticated;

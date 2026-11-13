-- ---------------------------------------------------------------------------
-- Notas de crédito de venta (NCF B04) ligadas a una factura
--
-- Migración aditiva y reintentable: no borra ni cambia datos existentes.
-- · Numeración 04/B04 automática.
-- · Tablas notas_credito_venta y nota_credito_venta_lineas con RLS de lectura.
-- · facturas.credito: el saldo pendiente pasa a total - pagado - credito.
-- · RPC crear_nota_credito_venta (admin/contador) con asiento de reversión.
-- ---------------------------------------------------------------------------

insert into public.numeraciones (tipo_comprobante, nombre, prefijo, siguiente, hasta, activa)
select '04', 'Notas de crédito', 'B04', 1, 100000, true
where not exists (
  select 1 from public.numeraciones n where n.tipo_comprobante = '04'
);

-- Origen de asiento: lista completa para documentos actuales y futuros.
alter table public.asientos drop constraint if exists asientos_origen_tipo_check;
alter table public.asientos
  add constraint asientos_origen_tipo_check check (origen_tipo in (
    'factura', 'pago_recibido', 'factura_proveedor', 'pago_proveedor', 'gasto_menor',
    'manual', 'anulacion', 'nota_credito_venta', 'nota_credito_compra', 'nota_debito',
    'transferencia', 'deposito'
  ));

alter table public.facturas add column if not exists credito numeric(14,2) not null default 0;

create sequence if not exists public.notas_credito_venta_numero_seq;

create table if not exists public.notas_credito_venta (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique default nextval('public.notas_credito_venta_numero_seq'),
  ncf text not null unique,
  factura_id uuid not null references public.facturas (id),
  contacto_id uuid not null references public.contactos (id),
  fecha date not null default current_date,
  subtotal numeric(14,2) not null default 0,
  itbis numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  devuelve_inventario boolean not null default true,
  estado text not null default 'activa' check (estado in ('activa', 'anulada')),
  notas text,
  asiento_id uuid references public.asientos (id),
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now()
);

create table if not exists public.nota_credito_venta_lineas (
  id uuid primary key default gen_random_uuid(),
  nota_id uuid not null references public.notas_credito_venta (id) on delete cascade,
  factura_linea_id uuid not null references public.factura_lineas (id),
  producto_id uuid references public.productos (id),
  descripcion text not null default '',
  cantidad numeric(14,2) not null check (cantidad > 0),
  precio numeric(14,2) not null default 0,
  descuento_pct numeric(5,2) not null default 0 check (descuento_pct between 0 and 100),
  itbis_tasa numeric(5,2) not null default 0,
  subtotal numeric(14,2) not null default 0,
  itbis numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  costo_unitario numeric(14,2) not null default 0
);

create index if not exists notas_credito_venta_factura_id_idx on public.notas_credito_venta (factura_id);
create index if not exists notas_credito_venta_contacto_id_idx on public.notas_credito_venta (contacto_id);
create index if not exists notas_credito_venta_fecha_idx on public.notas_credito_venta (fecha);
create index if not exists notas_credito_venta_asiento_id_idx on public.notas_credito_venta (asiento_id);
create index if not exists nota_credito_venta_lineas_nota_id_idx on public.nota_credito_venta_lineas (nota_id);
create index if not exists nota_credito_venta_lineas_factura_linea_id_idx on public.nota_credito_venta_lineas (factura_linea_id);
create index if not exists nota_credito_venta_lineas_producto_id_idx on public.nota_credito_venta_lineas (producto_id);

-- ---------------------------------------------------------------------------
-- RPC: crear nota de crédito de venta
-- ---------------------------------------------------------------------------

create or replace function public.crear_nota_credito_venta(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_factura public.facturas%rowtype;
  v_cuenta_cxc uuid;
  v_nota_id uuid;
  v_num public.numeraciones%rowtype;
  v_ncf text;
  v_fecha date;
  v_devuelve boolean;
  v_linea jsonb;
  v_factura_linea public.factura_lineas%rowtype;
  v_acreditado numeric(14,2);
  v_cantidad numeric(14,2);
  v_precio numeric(14,2);
  v_descuento_pct numeric(5,2);
  v_itbis_tasa numeric(5,2);
  v_subtotal numeric(14,2);
  v_itbis numeric(14,2);
  v_total numeric(14,2);
  v_costo_unitario numeric(14,2);
  v_costo_total numeric(14,2);
  v_producto_id uuid;
  v_producto_tipo text;
  v_producto_inventariable boolean;
  v_producto_cuenta_ingreso uuid;
  v_producto_cuenta_costo uuid;
  v_producto_cuenta_inventario uuid;
  v_cuenta_ingreso uuid;
  v_subtotal_nota numeric(14,2) := 0;
  v_itbis_nota numeric(14,2) := 0;
  v_total_nota numeric(14,2) := 0;
  v_asiento_lineas jsonb := '[]'::jsonb;
  v_asiento_id uuid;
  v_nuevo_credito numeric(14,2);
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or p->>'factura_id' is null then
    raise exception 'la factura es obligatoria' using errcode = '22023';
  end if;

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

  if p->'lineas' is null
     or jsonb_typeof(p->'lineas') <> 'array'
     or jsonb_array_length(p->'lineas') = 0 then
    raise exception 'la nota de crédito requiere al menos una línea' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_devuelve := coalesce(nullif(p->>'devuelve_inventario', '')::boolean, true);

  select * into v_num
  from public.numeraciones n
  where n.tipo_comprobante = '04' and n.activa
  order by n.id
  limit 1
  for update;

  if not found then
    raise exception 'no hay numeración activa para notas de crédito (04)' using errcode = '22023';
  end if;
  if v_num.hasta is not null and v_num.siguiente > v_num.hasta then
    raise exception 'la numeración % está agotada', v_num.prefijo using errcode = '22023';
  end if;
  if v_num.vence is not null and v_num.vence < v_fecha then
    raise exception 'la numeración % está vencida', v_num.prefijo using errcode = '22023';
  end if;

  v_ncf := v_num.prefijo || lpad(v_num.siguiente::text, 8, '0');
  update public.numeraciones set siguiente = siguiente + 1 where id = v_num.id;

  insert into public.notas_credito_venta (
    ncf, factura_id, contacto_id, fecha, devuelve_inventario, notas, creado_por
  )
  values (
    v_ncf, v_factura.id, v_factura.contacto_id, v_fecha, v_devuelve, p->>'notas', auth.uid()
  )
  returning id into v_nota_id;

  for v_linea in select * from jsonb_array_elements(p->'lineas') loop
    if nullif(v_linea->>'factura_linea_id', '') is null then
      raise exception 'cada línea requiere la línea de la factura' using errcode = '22023';
    end if;

    select * into v_factura_linea
    from public.factura_lineas fl
    where fl.id = (v_linea->>'factura_linea_id')::uuid
      and fl.factura_id = v_factura.id;

    if not found then
      raise exception 'línea de factura no encontrada' using errcode = '22023';
    end if;

    v_cantidad := round(coalesce((v_linea->>'cantidad')::numeric, 0), 2);
    if v_cantidad <= 0 then
      raise exception 'la cantidad debe ser mayor a cero' using errcode = '22023';
    end if;

    select coalesce(sum(nl.cantidad), 0)
    into v_acreditado
    from public.nota_credito_venta_lineas nl
    join public.notas_credito_venta n on n.id = nl.nota_id
    where nl.factura_linea_id = v_factura_linea.id
      and n.estado = 'activa';

    if v_cantidad > round(v_factura_linea.cantidad - v_acreditado, 2) then
      raise exception 'la cantidad excede lo disponible por acreditar en la línea' using errcode = '22023';
    end if;

    v_precio := v_factura_linea.precio;
    v_descuento_pct := v_factura_linea.descuento_pct;
    v_itbis_tasa := v_factura_linea.itbis_tasa;
    v_costo_unitario := v_factura_linea.costo_unitario;

    v_subtotal := round(
      round(v_cantidad * v_precio, 2) - round(round(v_cantidad * v_precio, 2) * v_descuento_pct / 100, 2),
      2
    );
    v_itbis := round(v_subtotal * v_itbis_tasa / 100, 2);
    v_total := round(v_subtotal + v_itbis, 2);
    v_costo_total := round(v_cantidad * v_costo_unitario, 2);

    insert into public.nota_credito_venta_lineas (
      nota_id, factura_linea_id, producto_id, descripcion, cantidad, precio, descuento_pct,
      itbis_tasa, subtotal, itbis, total, costo_unitario
    )
    values (
      v_nota_id, v_factura_linea.id, v_factura_linea.producto_id, v_factura_linea.descripcion,
      v_cantidad, v_precio, v_descuento_pct, v_itbis_tasa, v_subtotal, v_itbis, v_total, v_costo_unitario
    );

    v_subtotal_nota := v_subtotal_nota + v_subtotal;
    v_itbis_nota := v_itbis_nota + v_itbis;
    v_total_nota := v_total_nota + v_total;

    v_producto_id := v_factura_linea.producto_id;
    v_producto_tipo := null;
    v_producto_inventariable := false;
    v_producto_cuenta_ingreso := null;
    v_producto_cuenta_costo := null;
    v_producto_cuenta_inventario := null;

    if v_producto_id is not null then
      select
        pr.tipo, pr.inventariable, pr.cuenta_ingreso_id, pr.cuenta_costo_id, pr.cuenta_inventario_id
      into
        v_producto_tipo, v_producto_inventariable, v_producto_cuenta_ingreso,
        v_producto_cuenta_costo, v_producto_cuenta_inventario
      from public.productos pr
      where pr.id = v_producto_id;

      if not found then
        v_producto_tipo := null;
        v_producto_inventariable := false;
        v_producto_cuenta_ingreso := null;
        v_producto_cuenta_costo := null;
        v_producto_cuenta_inventario := null;
      end if;
    end if;

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
        'debito', v_subtotal,
        'credito', 0,
        'descripcion', 'Devolución venta: ' || left(v_factura_linea.descripcion, 70)
      ));
    end if;

    if v_devuelve and v_producto_inventariable then
      if v_costo_total > 0 then
        v_asiento_lineas := v_asiento_lineas || jsonb_build_array(
          jsonb_build_object(
            'cuenta_id', coalesce(v_producto_cuenta_inventario, public._cuenta_config('inventario')),
            'debito', v_costo_total,
            'credito', 0,
            'descripcion', 'Devolución inventario: ' || left(v_factura_linea.descripcion, 70)
          ),
          jsonb_build_object(
            'cuenta_id', coalesce(v_producto_cuenta_costo, public._cuenta_config('costo_ventas')),
            'debito', 0,
            'credito', v_costo_total,
            'descripcion', 'Reversión costo de venta: ' || left(v_factura_linea.descripcion, 70)
          )
        );
      end if;

      update public.productos
      set cantidad = cantidad + v_cantidad
      where id = v_producto_id;
    end if;
  end loop;

  if v_total_nota <= 0 then
    raise exception 'el total de la nota de crédito debe ser mayor a cero' using errcode = '22023';
  end if;

  v_nuevo_credito := round(v_factura.credito + v_total_nota, 2);
  if v_nuevo_credito > v_factura.total then
    raise exception 'el crédito de la nota excede el total de la factura' using errcode = '22023';
  end if;

  update public.notas_credito_venta
  set subtotal = v_subtotal_nota,
      itbis = v_itbis_nota,
      total = v_total_nota
  where id = v_nota_id;

  select c.cuenta_cxc_id into v_cuenta_cxc
  from public.contactos c
  where c.id = v_factura.contacto_id;

  v_asiento_lineas := jsonb_build_array(jsonb_build_object(
    'cuenta_id', coalesce(v_cuenta_cxc, public._cuenta_config('cxc')),
    'debito', 0,
    'credito', v_total_nota,
    'contacto_id', v_factura.contacto_id,
    'descripcion', 'CxC nota de crédito ' || v_ncf
  )) || v_asiento_lineas;

  if v_itbis_nota > 0 then
    v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', public._cuenta_config('itbis_por_pagar'),
      'debito', v_itbis_nota,
      'credito', 0,
      'descripcion', 'ITBIS nota de crédito ' || v_ncf
    ));
  end if;

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Nota de crédito ' || v_ncf,
    'nota_credito_venta',
    v_nota_id,
    v_asiento_lineas
  );

  update public.notas_credito_venta set asiento_id = v_asiento_id where id = v_nota_id;

  update public.facturas
  set credito = v_nuevo_credito,
      estado = case
        when round(v_factura.pagado + v_nuevo_credito, 2) >= v_factura.total then 'pagada'
        else 'abierta'
      end
  where id = v_factura.id;

  return v_nota_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Saldo pendiente: total - pagado - credito
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

    v_saldo := round(v_factura.total - v_factura.pagado - v_factura.credito, 2);
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
        estado = case
          when round(v_nuevo_pagado + v_factura.credito, 2) >= v_factura.total then 'pagada'
          else 'abierta'
        end
    where id = v_factura.id;
  end if;

  return v_pago_id;
end;
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
    round(f.total - f.pagado - f.credito, 2),
    greatest(coalesce(p_fecha, current_date) - f.vencimiento, 0)
  from public.facturas f
  join public.contactos c on c.id = f.contacto_id
  where f.estado <> 'anulada'
    and f.total - f.pagado - f.credito > 0
  order by f.fecha, f.numero;
$$;

-- ---------------------------------------------------------------------------
-- RLS y permisos
-- ---------------------------------------------------------------------------

do $$
declare
  v_tabla text;
begin
  foreach v_tabla in array array[
    'notas_credito_venta',
    'nota_credito_venta_lineas'
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

revoke all on sequence public.notas_credito_venta_numero_seq from anon, authenticated;

revoke all on function public.crear_nota_credito_venta(jsonb) from public, anon, authenticated;
grant execute on function public.crear_nota_credito_venta(jsonb) to authenticated;

revoke all on function public.registrar_pago_recibido(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_pago_recibido(jsonb) to authenticated;

revoke all on function public.reporte_cxc(date) from public, anon, authenticated;
grant execute on function public.reporte_cxc(date) to authenticated;

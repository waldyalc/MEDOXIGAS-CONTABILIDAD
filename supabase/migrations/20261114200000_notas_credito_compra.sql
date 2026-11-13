-- ---------------------------------------------------------------------------
-- Notas de crédito de compras (devolución a proveedor, NCF B03)
--
-- Migración aditiva y reintentable: no borra ni cambia datos existentes.
-- - Numeración 03/B03 automática.
-- - Tablas notas_credito_compra y nota_credito_compra_lineas con RLS de lectura.
-- - facturas_proveedor.credito: el saldo por pagar pasa a total - pagado - credito.
-- - RPC crear_nota_credito_compra (admin/contador) con asiento de reversión:
--     Dr Cuentas por pagar proveedores (total)
--     Cr Inventario o cuenta de gasto (subtotal)
--     Cr ITBIS adelantado en compras (ITBIS)
-- - anular_documento revierte inventario y crédito de la nota.
-- ---------------------------------------------------------------------------

insert into public.numeraciones (tipo_comprobante, nombre, prefijo, siguiente, hasta, activa)
select '03', 'Notas de crédito en compras', 'B03', 1, 100000, true
where not exists (
  select 1 from public.numeraciones n where n.tipo_comprobante = '03'
);

alter table public.facturas_proveedor add column if not exists credito numeric(14,2) not null default 0;

create sequence if not exists public.notas_credito_compra_numero_seq;

create table if not exists public.notas_credito_compra (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique default nextval('public.notas_credito_compra_numero_seq'),
  ncf text not null unique,
  factura_proveedor_id uuid not null references public.facturas_proveedor (id),
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

create table if not exists public.nota_credito_compra_lineas (
  id uuid primary key default gen_random_uuid(),
  nota_id uuid not null references public.notas_credito_compra (id) on delete cascade,
  factura_proveedor_linea_id uuid not null references public.facturas_proveedor_lineas (id),
  producto_id uuid references public.productos (id),
  cuenta_id uuid references public.cuentas (id),
  descripcion text not null default '',
  cantidad numeric(14,2) not null check (cantidad > 0),
  costo numeric(14,2) not null default 0,
  itbis_tasa numeric(5,2) not null default 0,
  subtotal numeric(14,2) not null default 0,
  itbis numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0
);

create index if not exists notas_credito_compra_factura_proveedor_id_idx
  on public.notas_credito_compra (factura_proveedor_id);
create index if not exists notas_credito_compra_contacto_id_idx
  on public.notas_credito_compra (contacto_id);
create index if not exists notas_credito_compra_fecha_idx
  on public.notas_credito_compra (fecha);
create index if not exists notas_credito_compra_asiento_id_idx
  on public.notas_credito_compra (asiento_id);
create index if not exists nota_credito_compra_lineas_nota_id_idx
  on public.nota_credito_compra_lineas (nota_id);
create index if not exists nota_credito_compra_lineas_factura_linea_id_idx
  on public.nota_credito_compra_lineas (factura_proveedor_linea_id);
create index if not exists nota_credito_compra_lineas_producto_id_idx
  on public.nota_credito_compra_lineas (producto_id);

-- ---------------------------------------------------------------------------
-- RPC: crear nota de crédito de compra
-- ---------------------------------------------------------------------------

create or replace function public.crear_nota_credito_compra(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_factura public.facturas_proveedor%rowtype;
  v_contacto public.contactos%rowtype;
  v_nota_id uuid;
  v_num public.numeraciones%rowtype;
  v_ncf text;
  v_fecha date;
  v_devuelve boolean;
  v_linea jsonb;
  v_factura_linea public.facturas_proveedor_lineas%rowtype;
  v_acreditado numeric(14,2);
  v_cantidad numeric(14,2);
  v_costo numeric(14,2);
  v_itbis_tasa numeric(5,2);
  v_subtotal numeric(14,2);
  v_itbis numeric(14,2);
  v_total numeric(14,2);
  v_producto public.productos%rowtype;
  v_cuenta_credito uuid;
  v_cantidad_actual numeric(14,2);
  v_costo_actual numeric(14,2);
  v_cantidad_nueva numeric(14,2);
  v_costo_nuevo numeric(14,2);
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

  if p is null or p->>'factura_proveedor_id' is null then
    raise exception 'la factura de proveedor es obligatoria' using errcode = '22023';
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

  if p->'lineas' is null
     or jsonb_typeof(p->'lineas') <> 'array'
     or jsonb_array_length(p->'lineas') = 0 then
    raise exception 'la nota de crédito requiere al menos una línea' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_devuelve := coalesce(nullif(p->>'devuelve_inventario', '')::boolean, true);

  select * into v_num
  from public.numeraciones n
  where n.tipo_comprobante = '03' and n.activa
  order by n.id
  limit 1
  for update;

  if not found then
    raise exception 'no hay numeración activa para notas de crédito en compras (03)' using errcode = '22023';
  end if;
  if v_num.hasta is not null and v_num.siguiente > v_num.hasta then
    raise exception 'la numeración % está agotada', v_num.prefijo using errcode = '22023';
  end if;
  if v_num.vence is not null and v_num.vence < v_fecha then
    raise exception 'la numeración % está vencida', v_num.prefijo using errcode = '22023';
  end if;

  v_ncf := v_num.prefijo || lpad(v_num.siguiente::text, 8, '0');
  update public.numeraciones set siguiente = siguiente + 1 where id = v_num.id;

  insert into public.notas_credito_compra (
    ncf, factura_proveedor_id, contacto_id, fecha, devuelve_inventario, notas, creado_por
  )
  values (
    v_ncf, v_factura.id, v_factura.contacto_id, v_fecha, v_devuelve, p->>'notas', auth.uid()
  )
  returning id into v_nota_id;

  for v_linea in select * from jsonb_array_elements(p->'lineas') loop
    if nullif(v_linea->>'factura_proveedor_linea_id', '') is null then
      raise exception 'cada línea requiere la línea de la factura de proveedor' using errcode = '22023';
    end if;

    select * into v_factura_linea
    from public.facturas_proveedor_lineas fpl
    where fpl.id = (v_linea->>'factura_proveedor_linea_id')::uuid
      and fpl.factura_proveedor_id = v_factura.id;

    if not found then
      raise exception 'línea de factura de proveedor no encontrada' using errcode = '22023';
    end if;

    v_cantidad := round(coalesce((v_linea->>'cantidad')::numeric, 0), 2);
    if v_cantidad <= 0 then
      raise exception 'la cantidad debe ser mayor a cero' using errcode = '22023';
    end if;

    select coalesce(sum(nl.cantidad), 0)
    into v_acreditado
    from public.nota_credito_compra_lineas nl
    join public.notas_credito_compra n on n.id = nl.nota_id
    where nl.factura_proveedor_linea_id = v_factura_linea.id
      and n.estado = 'activa';

    if v_cantidad > round(v_factura_linea.cantidad - v_acreditado, 2) then
      raise exception 'la cantidad excede lo disponible por acreditar en la línea' using errcode = '22023';
    end if;

    v_costo := v_factura_linea.costo;
    v_itbis_tasa := v_factura_linea.itbis_tasa;
    v_subtotal := round(v_cantidad * v_costo, 2);
    v_itbis := round(v_subtotal * v_itbis_tasa / 100, 2);
    v_total := round(v_subtotal + v_itbis, 2);

    insert into public.nota_credito_compra_lineas (
      nota_id, factura_proveedor_linea_id, producto_id, cuenta_id, descripcion,
      cantidad, costo, itbis_tasa, subtotal, itbis, total
    )
    values (
      v_nota_id, v_factura_linea.id, v_factura_linea.producto_id, v_factura_linea.cuenta_id,
      v_factura_linea.descripcion, v_cantidad, v_costo, v_itbis_tasa, v_subtotal, v_itbis, v_total
    );

    v_subtotal_nota := v_subtotal_nota + v_subtotal;
    v_itbis_nota := v_itbis_nota + v_itbis;
    v_total_nota := v_total_nota + v_total;

    v_cuenta_credito := null;
    if v_factura_linea.producto_id is not null then
      select * into v_producto
      from public.productos pr
      where pr.id = v_factura_linea.producto_id;

      if found then
        if v_producto.inventariable then
          v_cuenta_credito := coalesce(v_producto.cuenta_inventario_id, public._cuenta_config('inventario'));
        else
          v_cuenta_credito := coalesce(v_producto.cuenta_costo_id, public._cuenta_config('gastos_generales'));
        end if;
      end if;
    end if;
    if v_cuenta_credito is null then
      v_cuenta_credito := coalesce(v_factura_linea.cuenta_id, public._cuenta_config('gastos_generales'));
    end if;

    if v_subtotal > 0 then
      v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_cuenta_credito,
        'debito', 0,
        'credito', v_subtotal,
        'descripcion', 'Devolución compra: ' || left(v_factura_linea.descripcion, 70)
      ));
    end if;

    if v_devuelve
       and v_factura_linea.producto_id is not null
       and v_producto.inventariable then
      select pr.cantidad, pr.costo
      into v_cantidad_actual, v_costo_actual
      from public.productos pr
      where pr.id = v_producto.id
      for update;

      v_cantidad_nueva := v_cantidad_actual - v_cantidad;

      if v_cantidad_nueva > 0 then
        v_costo_nuevo := round(
          greatest(v_cantidad_actual * v_costo_actual - v_cantidad * v_costo, 0) / v_cantidad_nueva,
          2
        );
      elsif v_cantidad_nueva = 0 then
        v_costo_nuevo := 0;
      else
        v_costo_nuevo := v_costo_actual;
      end if;

      update public.productos
      set cantidad = v_cantidad_nueva,
          costo = v_costo_nuevo
      where id = v_producto.id;
    end if;
  end loop;

  if v_total_nota <= 0 then
    raise exception 'el total de la nota de crédito debe ser mayor a cero' using errcode = '22023';
  end if;

  v_nuevo_credito := round(v_factura.credito + v_total_nota, 2);
  if v_nuevo_credito > v_factura.total then
    raise exception 'el crédito de la nota excede el total de la factura de proveedor' using errcode = '22023';
  end if;

  update public.notas_credito_compra
  set subtotal = v_subtotal_nota,
      itbis = v_itbis_nota,
      total = v_total_nota
  where id = v_nota_id;

  select * into v_contacto from public.contactos c where c.id = v_factura.contacto_id;

  v_asiento_lineas := jsonb_build_array(jsonb_build_object(
    'cuenta_id', coalesce(v_contacto.cuenta_cxp_id, public._cuenta_config('cxp')),
    'debito', v_total_nota,
    'credito', 0,
    'contacto_id', v_factura.contacto_id,
    'descripcion', 'CxP nota de crédito compra ' || v_ncf
  )) || v_asiento_lineas;

  if v_itbis_nota > 0 then
    v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', public._cuenta_config('itbis_adelantado'),
      'debito', 0,
      'credito', v_itbis_nota,
      'descripcion', 'ITBIS nota de crédito compra ' || v_ncf
    ));
  end if;

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Nota de crédito compra ' || v_ncf,
    'nota_credito_compra',
    v_nota_id,
    v_asiento_lineas
  );

  update public.notas_credito_compra set asiento_id = v_asiento_id where id = v_nota_id;

  update public.facturas_proveedor
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
-- Saldo por pagar: total - pagado - credito
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

  v_saldo := round(v_factura.total - v_factura.pagado - v_factura.credito, 2);
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
      estado = case
        when round(v_nuevo_pagado + v_factura.credito, 2) >= v_factura.total then 'pagada'
        else 'abierta'
      end
  where id = v_factura.id;

  return v_pago_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Anulación: agrega nota_credito_compra y conserva la reversión de costo
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
  v_nota public.notas_credito_compra%rowtype;
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
  v_costo_linea numeric(14,2);
  v_cantidad_actual numeric(14,2);
  v_costo_actual numeric(14,2);
  v_cantidad_nueva numeric(14,2);
  v_costo_nuevo numeric(14,2);
  v_nuevo_pagado numeric(14,2);
  v_nuevo_credito numeric(14,2);
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_tipo is null or p_tipo not in (
    'factura', 'pago_recibido', 'factura_proveedor', 'pago_proveedor', 'gasto_menor',
    'nota_credito_compra'
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
    if exists (
      select 1 from public.notas_credito_compra nc
      where nc.factura_proveedor_id = p_id and nc.estado = 'activa'
    ) then
      raise exception 'no se puede anular una factura de proveedor con notas de crédito activas' using errcode = 'P0001';
    end if;

    for v_prod_id, v_cantidad, v_costo_linea in
      select fpl.producto_id, fpl.cantidad, fpl.costo
      from public.facturas_proveedor_lineas fpl
      join public.productos pr on pr.id = fpl.producto_id
      where fpl.factura_proveedor_id = p_id and pr.inventariable
      order by fpl.id
    loop
      select pr.cantidad, pr.costo
      into v_cantidad_actual, v_costo_actual
      from public.productos pr
      where pr.id = v_prod_id
      for update;

      v_cantidad_nueva := v_cantidad_actual - v_cantidad;

      if v_cantidad_nueva > 0 then
        v_costo_nuevo := round(
          greatest(v_cantidad_actual * v_costo_actual - v_cantidad * v_costo_linea, 0)
          / v_cantidad_nueva,
          2
        );
      elsif v_cantidad_nueva = 0 then
        v_costo_nuevo := 0;
      else
        v_costo_nuevo := v_costo_actual;
      end if;

      update public.productos
      set cantidad = v_cantidad_nueva,
          costo = v_costo_nuevo
      where id = v_prod_id;
    end loop;

    v_asiento_id := v_factura_prov.asiento_id;
    v_numero := v_factura_prov.numero;

    update public.facturas_proveedor set estado = 'anulada', pagado = 0, credito = 0 where id = p_id;

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
          estado = case
            when round(v_nuevo_pagado + v_factura_prov.credito, 2) >= v_factura_prov.total then 'pagada'
            else 'abierta'
          end
      where id = v_factura_prov.id;
    end if;

  elsif p_tipo = 'nota_credito_compra' then
    select * into v_nota from public.notas_credito_compra nc where nc.id = p_id for update;
    if not found then
      raise exception 'nota de crédito de compra no encontrada' using errcode = '22023';
    end if;
    if v_nota.estado = 'anulada' then
      raise exception 'la nota de crédito ya está anulada' using errcode = '22023';
    end if;

    if v_nota.devuelve_inventario then
      for v_prod_id, v_cantidad, v_costo_linea in
        select nl.producto_id, nl.cantidad, nl.costo
        from public.nota_credito_compra_lineas nl
        join public.productos pr on pr.id = nl.producto_id
        where nl.nota_id = p_id and pr.inventariable
        order by nl.id
      loop
        select pr.cantidad, pr.costo
        into v_cantidad_actual, v_costo_actual
        from public.productos pr
        where pr.id = v_prod_id
        for update;

        v_cantidad_nueva := v_cantidad_actual + v_cantidad;
        v_costo_nuevo := round(
          (v_cantidad_actual * v_costo_actual + v_cantidad * v_costo_linea) / v_cantidad_nueva,
          2
        );

        update public.productos
        set cantidad = v_cantidad_nueva,
            costo = v_costo_nuevo
        where id = v_prod_id;
      end loop;
    end if;

    select * into v_factura_prov
    from public.facturas_proveedor fp
    where fp.id = v_nota.factura_proveedor_id
    for update;

    if found and v_factura_prov.estado <> 'anulada' then
      v_nuevo_credito := round(greatest(v_factura_prov.credito - v_nota.total, 0), 2);
      update public.facturas_proveedor
      set credito = v_nuevo_credito,
          estado = case
            when round(v_factura_prov.pagado + v_nuevo_credito, 2) >= v_factura_prov.total then 'pagada'
            else 'abierta'
          end
      where id = v_factura_prov.id;
    end if;

    v_asiento_id := v_nota.asiento_id;
    v_numero := v_nota.numero;

    update public.notas_credito_compra set estado = 'anulada' where id = p_id;

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
-- RLS y permisos
-- ---------------------------------------------------------------------------

do $$
declare
  v_tabla text;
begin
  foreach v_tabla in array array[
    'notas_credito_compra',
    'nota_credito_compra_lineas'
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

revoke all on sequence public.notas_credito_compra_numero_seq from anon, authenticated;

revoke all on function public.crear_nota_credito_compra(jsonb) from public, anon, authenticated;
grant execute on function public.crear_nota_credito_compra(jsonb) to authenticated;

revoke all on function public.registrar_pago_proveedor(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_pago_proveedor(jsonb) to authenticated;

revoke all on function public.anular_documento(text, uuid) from public, anon, authenticated;
grant execute on function public.anular_documento(text, uuid) to authenticated;

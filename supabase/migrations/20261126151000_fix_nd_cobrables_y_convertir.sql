-- ---------------------------------------------------------------------------
-- Notas de débito cobrables en CxC + conversión con B14/B15/B16
--
-- Bug A (High): la nota de débito de venta (NCF B03) debita CxC (1103) en su
-- asiento, pero no aparecía en reporte_cxc y registrar_pago_recibido no podía
-- cobrarla, así que el cargo quedaba para siempre en el aire.
--   · pagos_recibidos.nota_debito_id: el cobro de una ND se guarda como un
--     pago recibido normal (mismo asiento Dr caja/banco / Cr CxC) ligado a la
--     nota. El pagado se calcula con los pagos activos, sin duplicar el dato
--     en la nota: anular el pago devuelve el saldo solo, igual que el motor
--     ya hace con facturas.pagado.
--   · reporte_cxc devuelve una fila por factura y una por ND activa, con la
--     misma forma de fila. En la columna factura_id va el id del documento
--     (la factura o la ND), porque la firma no se puede cambiar sin romper a
--     los consumidores.
--   · registrar_pago_recibido acepta p->'nota_debito_id' en lugar de
--     factura_id. Las retenciones siguen siendo solo de facturas.
--
-- Bug B (Medium): convertir_a_factura solo aceptaba comprobantes 01 y 02,
-- aunque crear_factura ya emite 14, 15 y 16. La numeración destino la decide
-- crear_factura por la serie elegida (numeraciones.tipo_comprobante), no el
-- tipo del documento origen (cotización o conduce).
--
-- Migración aditiva y reintentable: no borra ni reescribe datos existentes.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Vínculo pago ↔ nota de débito de venta
-- ---------------------------------------------------------------------------

alter table public.pagos_recibidos
  add column if not exists nota_debito_id uuid references public.notas_debito_venta (id);

create index if not exists pagos_recibidos_nota_debito_id_idx
  on public.pagos_recibidos (nota_debito_id);

alter table public.pagos_recibidos
  drop constraint if exists pagos_recibidos_documento_unico;

-- Un pago aplica a una factura o a una nota de débito, nunca a las dos.
alter table public.pagos_recibidos
  add constraint pagos_recibidos_documento_unico
  check (factura_id is null or nota_debito_id is null);

-- ---------------------------------------------------------------------------
-- CxC: facturas + notas de débito de venta activas
-- ---------------------------------------------------------------------------

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
    u.contacto_id,
    u.contacto_nombre,
    u.factura_id,
    u.numero,
    u.ncf,
    u.fecha,
    u.vencimiento,
    u.total,
    u.pagado,
    u.saldo,
    greatest(coalesce(p_fecha, current_date) - u.vencimiento, 0)
  from (
    select
      f.contacto_id,
      c.nombre as contacto_nombre,
      f.id as factura_id,
      f.numero,
      f.ncf,
      f.fecha,
      f.vencimiento,
      f.total,
      f.pagado,
      round(f.total - f.pagado - f.credito - f.retenido, 2) as saldo
    from public.facturas f
    join public.contactos c on c.id = f.contacto_id
    where f.estado <> 'anulada'
      and f.total - f.pagado - f.credito - f.retenido > 0

    union all

    select
      nd.contacto_id,
      c.nombre,
      nd.id,
      nd.numero,
      nd.ncf,
      nd.fecha,
      nd.fecha,
      nd.total,
      coalesce(pagos.monto, 0),
      round(nd.total - coalesce(pagos.monto, 0), 2)
    from public.notas_debito_venta nd
    join public.contactos c on c.id = nd.contacto_id
    left join lateral (
      select sum(pr.monto) as monto
      from public.pagos_recibidos pr
      where pr.nota_debito_id = nd.id
        and pr.estado = 'activo'
    ) pagos on true
    where nd.estado = 'activa'
      and nd.total - coalesce(pagos.monto, 0) > 0
  ) u
  order by u.fecha, u.numero;
$$;

-- ---------------------------------------------------------------------------
-- Registrar pago recibido: acepta factura_id o nota_debito_id
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
  v_nota public.notas_debito_venta%rowtype;
  v_contacto public.contactos%rowtype;
  v_cuenta public.cuentas%rowtype;
  v_retencion public.retenciones%rowtype;
  v_retenciones jsonb;
  v_item jsonb;
  v_ids uuid[] := '{}';
  v_monto numeric(14,2);
  v_fecha date;
  v_metodo text;
  v_saldo numeric(14,2);
  v_pagado_nota numeric(14,2);
  v_nuevo_pagado numeric(14,2);
  v_nuevo_retenido numeric(14,2);
  v_retenido_total numeric(14,2) := 0;
  v_total_aplicado numeric(14,2);
  v_base numeric(14,2);
  v_monto_retencion numeric(14,2);
  v_cuenta_retencion uuid;
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

  select coalesce(p->'retenciones', '[]'::jsonb) into v_retenciones;
  if jsonb_typeof(v_retenciones) <> 'array' then
    raise exception 'las retenciones deben venir en una lista' using errcode = '22023';
  end if;

  if nullif(p->>'factura_id', '') is not null
     and nullif(p->>'nota_debito_id', '') is not null then
    raise exception 'el pago no puede aplicar a una factura y a una nota de débito a la vez'
      using errcode = '22023';
  end if;

  if nullif(p->>'factura_id', '') is not null then
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

    select * into v_contacto from public.contactos c where c.id = v_factura.contacto_id;
  elsif nullif(p->>'nota_debito_id', '') is not null then
    select * into v_nota
    from public.notas_debito_venta nd
    where nd.id = (p->>'nota_debito_id')::uuid
    for update;

    if not found then
      raise exception 'nota de débito no encontrada' using errcode = '22023';
    end if;
    if v_nota.estado = 'anulada' then
      raise exception 'la nota de débito está anulada' using errcode = '22023';
    end if;

    if jsonb_array_length(v_retenciones) > 0 then
      raise exception 'las retenciones requieren una factura' using errcode = '22023';
    end if;

    if nullif(p->>'contacto_id', '') is not null
       and (p->>'contacto_id')::uuid <> v_nota.contacto_id then
      raise exception 'la nota de débito no pertenece al cliente indicado' using errcode = '22023';
    end if;

    select * into v_contacto from public.contactos c where c.id = v_nota.contacto_id;

    if not found then
      raise exception 'contacto no encontrado' using errcode = '22023';
    end if;
  else
    if jsonb_array_length(v_retenciones) > 0 then
      raise exception 'las retenciones requieren una factura' using errcode = '22023';
    end if;

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

  for v_item in select * from jsonb_array_elements(v_retenciones)
  loop
    if v_item->>'retencion_id' is null then
      raise exception 'la retención es obligatoria' using errcode = '22023';
    end if;

    if (v_item->>'retencion_id')::uuid = any (v_ids) then
      raise exception 'la retención está repetida en el pago' using errcode = '22023';
    end if;

    select * into v_retencion
    from public.retenciones r
    where r.id = (v_item->>'retencion_id')::uuid and r.activa;

    if not found then
      raise exception 'retención no encontrada o inactiva' using errcode = '22023';
    end if;

    if exists (
      select 1
      from public.pago_recibido_retenciones prr
      join public.pagos_recibidos pr on pr.id = prr.pago_id
      where pr.factura_id = v_factura.id
        and pr.estado = 'activo'
        and prr.retencion_id = v_retencion.id
    ) then
      raise exception 'la retención % ya está aplicada a esta factura', v_retencion.nombre using errcode = '22023';
    end if;

    v_base := case when v_retencion.tipo = 'itbis' then v_factura.itbis else v_factura.subtotal end;
    v_monto_retencion := round(v_base * v_retencion.porcentaje / 100, 2);

    if v_monto_retencion <= 0 then
      raise exception 'la retención % no genera monto sobre esta factura', v_retencion.nombre using errcode = '22023';
    end if;

    v_ids := array_append(v_ids, v_retencion.id);
    v_retenido_total := round(v_retenido_total + v_monto_retencion, 2);
  end loop;

  if v_factura.id is not null then
    v_saldo := round(v_factura.total - v_factura.pagado - v_factura.credito - v_factura.retenido, 2);
    if v_saldo <= 0 then
      raise exception 'la factura ya está pagada' using errcode = '22023';
    end if;

    v_total_aplicado := round(v_monto + v_retenido_total, 2);
    if v_total_aplicado > v_saldo then
      raise exception 'el monto más las retenciones excede el saldo pendiente de la factura' using errcode = '22023';
    end if;
  elsif v_nota.id is not null then
    select coalesce(sum(pr.monto), 0)
    into v_pagado_nota
    from public.pagos_recibidos pr
    where pr.nota_debito_id = v_nota.id
      and pr.estado = 'activo';

    v_saldo := round(v_nota.total - v_pagado_nota, 2);
    if v_saldo <= 0 then
      raise exception 'la nota de débito ya está pagada' using errcode = '22023';
    end if;
    if v_monto > v_saldo then
      raise exception 'el monto excede el saldo pendiente de la nota de débito' using errcode = '22023';
    end if;
  end if;

  insert into public.pagos_recibidos (
    contacto_id, factura_id, nota_debito_id, fecha, cuenta_id, metodo, monto, retenido, notas, creado_por
  )
  values (
    v_contacto.id,
    case when v_factura.id is null then null else v_factura.id end,
    case when v_nota.id is null then null else v_nota.id end,
    v_fecha,
    v_cuenta.id,
    v_metodo,
    v_monto,
    v_retenido_total,
    p->>'notas',
    auth.uid()
  )
  returning id into v_pago_id;

  for v_item in select * from jsonb_array_elements(v_retenciones)
  loop
    select * into v_retencion
    from public.retenciones r
    where r.id = (v_item->>'retencion_id')::uuid;

    v_base := case when v_retencion.tipo = 'itbis' then v_factura.itbis else v_factura.subtotal end;
    v_monto_retencion := round(v_base * v_retencion.porcentaje / 100, 2);

    insert into public.pago_recibido_retenciones (pago_id, retencion_id, base, porcentaje, monto)
    values (v_pago_id, v_retencion.id, v_base, v_retencion.porcentaje, v_monto_retencion);
  end loop;

  v_lineas := jsonb_build_array(
    jsonb_build_object(
      'cuenta_id', v_cuenta.id,
      'debito', v_monto,
      'credito', 0,
      'descripcion', 'Pago recibido'
    )
  );

  for v_item in select * from jsonb_array_elements(v_retenciones)
  loop
    select * into v_retencion
    from public.retenciones r
    where r.id = (v_item->>'retencion_id')::uuid;

    v_base := case when v_retencion.tipo = 'itbis' then v_factura.itbis else v_factura.subtotal end;
    v_monto_retencion := round(v_base * v_retencion.porcentaje / 100, 2);
    v_cuenta_retencion := coalesce(
      v_retencion.cuenta_anticipo_id,
      public._cuenta_config('retencion_' || v_retencion.tipo || '_por_cobrar')
    );

    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', v_cuenta_retencion,
      'debito', v_monto_retencion,
      'credito', 0,
      'contacto_id', v_contacto.id,
      'descripcion', 'Retención ' || v_retencion.nombre
    ));
  end loop;

  v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
    'cuenta_id', coalesce(v_contacto.cuenta_cxc_id, public._cuenta_config('cxc')),
    'debito', 0,
    'credito', round(v_monto + v_retenido_total, 2),
    'contacto_id', v_contacto.id,
    'descripcion', 'Pago recibido'
  ));

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Pago recibido' || case
      when v_factura.id is not null then ' factura ' || v_factura.numero::text
      when v_nota.id is not null then ' nota de débito ' || v_nota.ncf
      else ''
    end,
    'pago_recibido',
    v_pago_id,
    v_lineas
  );

  update public.pagos_recibidos set asiento_id = v_asiento_id where id = v_pago_id;

  if v_factura.id is not null then
    v_nuevo_pagado := round(v_factura.pagado + v_monto, 2);
    v_nuevo_retenido := round(v_factura.retenido + v_retenido_total, 2);
    update public.facturas
    set pagado = v_nuevo_pagado,
        retenido = v_nuevo_retenido,
        estado = case
          when round(v_nuevo_pagado + v_nuevo_retenido + v_factura.credito, 2) >= v_factura.total then 'pagada'
          else 'abierta'
        end
    where id = v_factura.id;
  end if;

  return v_pago_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Conversión cotización/conduce: la serie destino puede ser 14, 15 o 16
-- ---------------------------------------------------------------------------

create or replace function public.convertir_a_factura(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_tipo_doc text;
  v_id uuid;
  v_tipo_comprobante text;
  v_contacto_id uuid;
  v_vendedor_id uuid;
  v_centro_costo_id uuid;
  v_fecha date;
  v_vencimiento date;
  v_notas text;
  v_lineas jsonb;
  v_factura_id uuid;
  v_cotizacion public.cotizaciones%rowtype;
  v_remision public.remisiones%rowtype;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la conversión requeridos' using errcode = '22023';
  end if;

  v_tipo_doc := coalesce(p->>'tipo', p->>'p_tipo');
  if v_tipo_doc is null or v_tipo_doc not in ('cotizacion', 'remision') then
    raise exception 'tipo de documento inválido' using errcode = '22023';
  end if;

  v_id := nullif(coalesce(p->>'id', p->>'p_id'), '')::uuid;
  if v_id is null then
    raise exception 'el documento es obligatorio' using errcode = '22023';
  end if;

  v_tipo_comprobante := coalesce(nullif(p->>'tipo_comprobante', ''), '01');
  if v_tipo_comprobante not in ('01', '02', '14', '15', '16') then
    raise exception 'tipo de comprobante inválido' using errcode = '22023';
  end if;

  if v_tipo_doc = 'cotizacion' then
    select * into v_cotizacion
    from public.cotizaciones c
    where c.id = v_id
    for update;

    if not found then
      raise exception 'cotización no encontrada' using errcode = '22023';
    end if;
    if v_cotizacion.estado <> 'abierta' then
      raise exception 'la cotización no está abierta' using errcode = '22023';
    end if;

    select jsonb_agg(jsonb_build_object(
      'producto_id', l.producto_id,
      'descripcion', l.descripcion,
      'cantidad', l.cantidad,
      'precio', l.precio,
      'descuento_pct', l.descuento_pct,
      'itbis_tasa', l.itbis_tasa,
      'impuesto_id', l.impuesto_id
    ) order by l.id)
    into v_lineas
    from public.cotizacion_lineas l
    where l.cotizacion_id = v_id;

    v_contacto_id := v_cotizacion.contacto_id;
    v_vendedor_id := v_cotizacion.vendedor_id;
    v_centro_costo_id := v_cotizacion.centro_costo_id;
    v_fecha := v_cotizacion.fecha;
    v_vencimiento := v_cotizacion.vencimiento;
    v_notas := v_cotizacion.notas;
  else
    select * into v_remision
    from public.remisiones r
    where r.id = v_id
    for update;

    if not found then
      raise exception 'remisión no encontrada' using errcode = '22023';
    end if;
    if v_remision.estado <> 'abierta' then
      raise exception 'la remisión no está abierta' using errcode = '22023';
    end if;

    select jsonb_agg(jsonb_build_object(
      'producto_id', l.producto_id,
      'descripcion', l.descripcion,
      'cantidad', l.cantidad,
      'precio', l.precio,
      'descuento_pct', l.descuento_pct,
      'itbis_tasa', l.itbis_tasa,
      'impuesto_id', l.impuesto_id
    ) order by l.id)
    into v_lineas
    from public.remision_lineas l
    where l.remision_id = v_id;

    v_contacto_id := v_remision.contacto_id;
    v_vendedor_id := v_remision.vendedor_id;
    v_centro_costo_id := v_remision.centro_costo_id;
    v_fecha := v_remision.fecha;
    v_vencimiento := v_remision.vencimiento;
    v_notas := v_remision.notas;
  end if;

  if v_lineas is null or jsonb_array_length(v_lineas) = 0 then
    raise exception 'el documento no tiene líneas' using errcode = '22023';
  end if;

  v_factura_id := public.crear_factura(jsonb_build_object(
    'tipo_comprobante', v_tipo_comprobante,
    'contacto_id', v_contacto_id,
    'vendedor_id', v_vendedor_id,
    'centro_costo_id', v_centro_costo_id,
    'fecha', v_fecha,
    'vencimiento', v_vencimiento,
    'notas', v_notas,
    'lineas', v_lineas
  ));

  if v_tipo_doc = 'cotizacion' then
    update public.cotizaciones
    set estado = 'convertida', factura_id = v_factura_id
    where id = v_id;
  else
    update public.remisiones
    set estado = 'convertida', factura_id = v_factura_id
    where id = v_id;
  end if;

  return v_factura_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos (se conservan los de las versiones anteriores)
-- ---------------------------------------------------------------------------

revoke all on function public.reporte_cxc(date) from public, anon, authenticated;
grant execute on function public.reporte_cxc(date) to authenticated;

revoke all on function public.registrar_pago_recibido(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_pago_recibido(jsonb) to authenticated;

revoke all on function public.convertir_a_factura(jsonb) from public, anon, authenticated;
grant execute on function public.convertir_a_factura(jsonb) to authenticated;

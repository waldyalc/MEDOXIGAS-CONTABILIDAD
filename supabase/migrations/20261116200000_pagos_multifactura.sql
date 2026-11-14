-- ---------------------------------------------------------------------------
-- Pagos con varias facturas (recibidos y a proveedores)
--
-- Migración aditiva y reintentable. No borra ni reescribe datos existentes.
-- · pago_recibido_aplicaciones / pago_proveedor_aplicaciones: el detalle real
--   pago↔factura (monto y retenido por factura). Las tablas de retenciones por
--   aplicación guardan base, porcentaje y monto de cada retención.
-- · registrar_pago_recibido_multi y registrar_pago_proveedor_multi: crean UN
--   recibo/pago con UN asiento que aplica a varias facturas y, si se quiere,
--   líneas de otros ingresos/egresos.
-- · registrar_pago_recibido y registrar_pago_proveedor quedan intactas para los
--   pagos viejos de una sola factura y para el pago dentro de la factura.
-- · anular_documento revierte las aplicaciones nuevas y conserva la anulación
--   de los pagos viejos.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Aplicaciones pago ↔ factura
-- ---------------------------------------------------------------------------

create table if not exists public.pago_recibido_aplicaciones (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid not null references public.pagos_recibidos (id) on delete cascade,
  factura_id uuid not null references public.facturas (id),
  monto numeric(14,2) not null check (monto > 0),
  retenido numeric(14,2) not null default 0 check (retenido >= 0),
  unique (pago_id, factura_id)
);

create table if not exists public.pago_proveedor_aplicaciones (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid not null references public.pagos_proveedor (id) on delete cascade,
  factura_proveedor_id uuid not null references public.facturas_proveedor (id),
  monto numeric(14,2) not null check (monto > 0),
  retenido numeric(14,2) not null default 0 check (retenido >= 0),
  unique (pago_id, factura_proveedor_id)
);

create table if not exists public.pago_recibido_aplicacion_retenciones (
  id uuid primary key default gen_random_uuid(),
  aplicacion_id uuid not null references public.pago_recibido_aplicaciones (id) on delete cascade,
  retencion_id uuid not null references public.retenciones (id),
  base numeric(14,2) not null default 0 check (base >= 0),
  porcentaje numeric(5,2) not null default 0 check (porcentaje >= 0 and porcentaje <= 100),
  monto numeric(14,2) not null check (monto > 0),
  unique (aplicacion_id, retencion_id)
);

create table if not exists public.pago_proveedor_aplicacion_retenciones (
  id uuid primary key default gen_random_uuid(),
  aplicacion_id uuid not null references public.pago_proveedor_aplicaciones (id) on delete cascade,
  retencion_id uuid not null references public.retenciones (id),
  base numeric(14,2) not null default 0 check (base >= 0),
  porcentaje numeric(5,2) not null default 0 check (porcentaje >= 0 and porcentaje <= 100),
  monto numeric(14,2) not null check (monto > 0),
  unique (aplicacion_id, retencion_id)
);

create index if not exists pago_recibido_aplicaciones_pago_id_idx
  on public.pago_recibido_aplicaciones (pago_id);
create index if not exists pago_recibido_aplicaciones_factura_id_idx
  on public.pago_recibido_aplicaciones (factura_id);
create index if not exists pago_proveedor_aplicaciones_pago_id_idx
  on public.pago_proveedor_aplicaciones (pago_id);
create index if not exists pago_proveedor_aplicaciones_factura_id_idx
  on public.pago_proveedor_aplicaciones (factura_proveedor_id);
create index if not exists pago_recibido_aplicacion_retenciones_aplicacion_id_idx
  on public.pago_recibido_aplicacion_retenciones (aplicacion_id);
create index if not exists pago_proveedor_aplicacion_retenciones_aplicacion_id_idx
  on public.pago_proveedor_aplicacion_retenciones (aplicacion_id);

-- Un pago a proveedor sin factura (solo otros egresos) deja el vínculo vacío.
alter table public.pagos_proveedor alter column factura_proveedor_id drop not null;

-- ---------------------------------------------------------------------------
-- RLS: lectura para cualquier usuario con perfil; escritura solo por RPC
-- ---------------------------------------------------------------------------

alter table public.pago_recibido_aplicaciones enable row level security;
alter table public.pago_proveedor_aplicaciones enable row level security;
alter table public.pago_recibido_aplicacion_retenciones enable row level security;
alter table public.pago_proveedor_aplicacion_retenciones enable row level security;

revoke all on public.pago_recibido_aplicaciones from anon;
revoke all on public.pago_recibido_aplicaciones from authenticated;
grant select on public.pago_recibido_aplicaciones to authenticated;

revoke all on public.pago_proveedor_aplicaciones from anon;
revoke all on public.pago_proveedor_aplicaciones from authenticated;
grant select on public.pago_proveedor_aplicaciones to authenticated;

revoke all on public.pago_recibido_aplicacion_retenciones from anon;
revoke all on public.pago_recibido_aplicacion_retenciones from authenticated;
grant select on public.pago_recibido_aplicacion_retenciones to authenticated;

revoke all on public.pago_proveedor_aplicacion_retenciones from anon;
revoke all on public.pago_proveedor_aplicacion_retenciones from authenticated;
grant select on public.pago_proveedor_aplicacion_retenciones to authenticated;

drop policy if exists pago_recibido_aplicaciones_lectura on public.pago_recibido_aplicaciones;
create policy pago_recibido_aplicaciones_lectura on public.pago_recibido_aplicaciones
  for select to authenticated
  using ((select public.rol_actual()) is not null);

drop policy if exists pago_proveedor_aplicaciones_lectura on public.pago_proveedor_aplicaciones;
create policy pago_proveedor_aplicaciones_lectura on public.pago_proveedor_aplicaciones
  for select to authenticated
  using ((select public.rol_actual()) is not null);

drop policy if exists pago_recibido_aplicacion_retenciones_lectura
  on public.pago_recibido_aplicacion_retenciones;
create policy pago_recibido_aplicacion_retenciones_lectura
  on public.pago_recibido_aplicacion_retenciones
  for select to authenticated
  using ((select public.rol_actual()) is not null);

drop policy if exists pago_proveedor_aplicacion_retenciones_lectura
  on public.pago_proveedor_aplicacion_retenciones;
create policy pago_proveedor_aplicacion_retenciones_lectura
  on public.pago_proveedor_aplicacion_retenciones
  for select to authenticated
  using ((select public.rol_actual()) is not null);

-- ---------------------------------------------------------------------------
-- Registrar pago recibido con varias facturas y/u otros ingresos
--
-- p_encabezado: contacto_id, fecha, cuenta_id, metodo, notas, centro_costo_id,
--               otros_ingresos = [{ cuenta_id, descripcion, monto, itbis_tasa }]
-- p_aplicaciones: [{ factura_id, monto, retenciones: [{ retencion_id }] }]
-- El servidor recalcula las retenciones y el ITBIS; nunca confía en el cliente.
-- ---------------------------------------------------------------------------

create or replace function public.registrar_pago_recibido_multi(p_encabezado jsonb, p_aplicaciones jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_contacto public.contactos%rowtype;
  v_cuenta public.cuentas%rowtype;
  v_factura public.facturas%rowtype;
  v_retencion public.retenciones%rowtype;
  v_cuenta_ingreso public.cuentas%rowtype;
  v_aplicaciones jsonb;
  v_otros jsonb;
  v_validada jsonb := '[]'::jsonb;
  v_otros_validados jsonb := '[]'::jsonb;
  v_retenciones_app jsonb;
  v_item jsonb;
  v_ret jsonb;
  v_centro_costo_id uuid;
  v_fecha date;
  v_metodo text;
  v_pago_id uuid;
  v_aplicacion_id uuid;
  v_primera_factura uuid;
  v_factura_ids uuid[] := '{}';
  v_ids uuid[] := '{}';
  v_monto numeric(14,2);
  v_cash numeric(14,2) := 0;
  v_retenido_total numeric(14,2) := 0;
  v_retenido_app numeric(14,2);
  v_saldo numeric(14,2);
  v_base numeric(14,2);
  v_monto_retencion numeric(14,2);
  v_cuenta_retencion uuid;
  v_itbis_tasa numeric(5,2);
  v_itbis numeric(14,2);
  v_total numeric(14,2);
  v_descripcion text;
  v_asiento_id uuid;
  v_asiento_lineas jsonb := '[]'::jsonb;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_encabezado is null then
    raise exception 'datos del pago requeridos' using errcode = '22023';
  end if;

  if p_encabezado->>'contacto_id' is null then
    raise exception 'el cliente es obligatorio' using errcode = '22023';
  end if;

  select * into v_contacto
  from public.contactos c
  where c.id = (p_encabezado->>'contacto_id')::uuid and c.activo;

  if not found then
    raise exception 'contacto no encontrado' using errcode = '22023';
  end if;
  if v_contacto.tipo not in ('cliente', 'ambos') then
    raise exception 'el contacto no es cliente' using errcode = '22023';
  end if;

  v_fecha := coalesce((p_encabezado->>'fecha')::date, current_date);
  v_metodo := coalesce(nullif(p_encabezado->>'metodo', ''), 'efectivo');
  if v_metodo not in ('efectivo', 'transferencia', 'tarjeta', 'cheque') then
    raise exception 'método de pago inválido' using errcode = '22023';
  end if;

  if p_encabezado->>'cuenta_id' is null then
    raise exception 'la cuenta de caja o banco es obligatoria' using errcode = '22023';
  end if;

  select * into v_cuenta
  from public.cuentas c
  where c.id = (p_encabezado->>'cuenta_id')::uuid and c.activa;

  if not found then
    raise exception 'cuenta de caja o banco no encontrada' using errcode = '22023';
  end if;
  if not v_cuenta.es_caja_banco then
    raise exception 'la cuenta del pago debe ser de caja o banco' using errcode = '22023';
  end if;

  v_centro_costo_id := nullif(p_encabezado->>'centro_costo_id', '')::uuid;
  if v_centro_costo_id is not null
     and not exists (
       select 1 from public.centros_costo c
       where c.id = v_centro_costo_id and c.activo
     ) then
    raise exception 'centro de costo no encontrado o inactivo' using errcode = '22023';
  end if;

  v_aplicaciones := coalesce(p_aplicaciones, '[]'::jsonb);
  if jsonb_typeof(v_aplicaciones) <> 'array' then
    raise exception 'las aplicaciones deben venir en una lista' using errcode = '22023';
  end if;

  v_otros := coalesce(p_encabezado->'otros_ingresos', '[]'::jsonb);
  if jsonb_typeof(v_otros) <> 'array' then
    raise exception 'los otros ingresos deben venir en una lista' using errcode = '22023';
  end if;

  if jsonb_array_length(v_aplicaciones) + jsonb_array_length(v_otros) = 0 then
    raise exception 'agrega al menos una factura o un ingreso' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(v_aplicaciones)
  loop
    if v_item->>'factura_id' is null then
      raise exception 'la factura es obligatoria' using errcode = '22023';
    end if;

    if (v_item->>'factura_id')::uuid = any (v_factura_ids) then
      raise exception 'la factura está repetida en el pago' using errcode = '22023';
    end if;

    v_monto := round(coalesce((v_item->>'monto')::numeric, 0), 2);
    if v_monto <= 0 then
      raise exception 'el monto recibido de cada factura debe ser mayor a cero' using errcode = '22023';
    end if;

    select * into v_factura
    from public.facturas f
    where f.id = (v_item->>'factura_id')::uuid
    for update;

    if not found then
      raise exception 'factura no encontrada' using errcode = '22023';
    end if;
    if v_factura.estado = 'anulada' then
      raise exception 'la factura % está anulada', v_factura.numero using errcode = '22023';
    end if;
    if v_factura.contacto_id <> v_contacto.id then
      raise exception 'la factura % no pertenece al cliente', v_factura.numero using errcode = '22023';
    end if;

    v_saldo := round(v_factura.total - v_factura.pagado - v_factura.credito - v_factura.retenido, 2);
    if v_saldo <= 0 then
      raise exception 'la factura % ya está pagada', v_factura.numero using errcode = '22023';
    end if;

    v_retenciones_app := '[]'::jsonb;
    v_retenido_app := 0;
    v_ids := '{}';

    if v_item->'retenciones' is not null then
      if jsonb_typeof(v_item->'retenciones') <> 'array' then
        raise exception 'las retenciones deben venir en una lista' using errcode = '22023';
      end if;

      for v_ret in select * from jsonb_array_elements(v_item->'retenciones')
      loop
        if v_ret->>'retencion_id' is null then
          raise exception 'la retención es obligatoria' using errcode = '22023';
        end if;

        if (v_ret->>'retencion_id')::uuid = any (v_ids) then
          raise exception 'la retención está repetida en la factura %', v_factura.numero
            using errcode = '22023';
        end if;

        select * into v_retencion
        from public.retenciones r
        where r.id = (v_ret->>'retencion_id')::uuid and r.activa;

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
        ) or exists (
          select 1
          from public.pago_recibido_aplicacion_retenciones par
          join public.pago_recibido_aplicaciones pa on pa.id = par.aplicacion_id
          join public.pagos_recibidos pr on pr.id = pa.pago_id
          where pa.factura_id = v_factura.id
            and pr.estado = 'activo'
            and par.retencion_id = v_retencion.id
        ) then
          raise exception 'la retención % ya está aplicada a la factura %',
            v_retencion.nombre, v_factura.numero using errcode = '22023';
        end if;

        v_base := case when v_retencion.tipo = 'itbis' then v_factura.itbis else v_factura.subtotal end;
        v_monto_retencion := round(v_base * v_retencion.porcentaje / 100, 2);

        if v_monto_retencion <= 0 then
          raise exception 'la retención % no genera monto sobre la factura %',
            v_retencion.nombre, v_factura.numero using errcode = '22023';
        end if;

        v_ids := array_append(v_ids, v_retencion.id);
        v_retenido_app := round(v_retenido_app + v_monto_retencion, 2);
        v_retenciones_app := v_retenciones_app || jsonb_build_array(jsonb_build_object(
          'retencion_id', v_retencion.id,
          'base', v_base,
          'porcentaje', v_retencion.porcentaje,
          'monto', v_monto_retencion
        ));
      end loop;
    end if;

    if round(v_monto + v_retenido_app, 2) > v_saldo then
      raise exception 'el monto más las retenciones supera el saldo de la factura %',
        v_factura.numero using errcode = '22023';
    end if;

    v_factura_ids := array_append(v_factura_ids, v_factura.id);
    if v_primera_factura is null then
      v_primera_factura := v_factura.id;
    end if;

    v_cash := round(v_cash + v_monto, 2);
    v_retenido_total := round(v_retenido_total + v_retenido_app, 2);

    v_validada := v_validada || jsonb_build_array(jsonb_build_object(
      'factura_id', v_factura.id,
      'numero', v_factura.numero,
      'monto', v_monto,
      'retenido', v_retenido_app,
      'retenciones', v_retenciones_app
    ));
  end loop;

  for v_item in select * from jsonb_array_elements(v_otros)
  loop
    if v_item->>'cuenta_id' is null then
      raise exception 'la cuenta del ingreso es obligatoria' using errcode = '22023';
    end if;

    v_monto := round(coalesce((v_item->>'monto')::numeric, 0), 2);
    if v_monto <= 0 then
      raise exception 'el monto del ingreso debe ser mayor a cero' using errcode = '22023';
    end if;

    select * into v_cuenta_ingreso
    from public.cuentas c
    where c.id = (v_item->>'cuenta_id')::uuid and c.activa and c.acepta_movimientos;

    if not found then
      raise exception 'cuenta de ingreso no encontrada' using errcode = '22023';
    end if;
    if v_cuenta_ingreso.tipo <> 'ingreso' then
      raise exception 'la cuenta % no es de ingreso', v_cuenta_ingreso.codigo using errcode = '22023';
    end if;

    v_itbis_tasa := round(coalesce((v_item->>'itbis_tasa')::numeric, 0), 2);
    if v_itbis_tasa not in (0, 16, 18) then
      raise exception 'tasa de ITBIS inválida' using errcode = '22023';
    end if;

    v_itbis := round(v_monto * v_itbis_tasa / 100, 2);
    v_total := round(v_monto + v_itbis, 2);
    v_descripcion := coalesce(nullif(v_item->>'descripcion', ''), v_cuenta_ingreso.nombre);

    v_cash := round(v_cash + v_total, 2);
    v_otros_validados := v_otros_validados || jsonb_build_array(jsonb_build_object(
      'cuenta_id', v_cuenta_ingreso.id,
      'descripcion', v_descripcion,
      'monto', v_monto,
      'itbis', v_itbis,
      'total', v_total
    ));
  end loop;

  if v_cash <= 0 then
    raise exception 'el monto del pago debe ser mayor a cero' using errcode = '22023';
  end if;

  insert into public.pagos_recibidos (
    contacto_id, factura_id, fecha, cuenta_id, metodo, monto, retenido, notas, creado_por
  )
  values (
    v_contacto.id,
    v_primera_factura,
    v_fecha,
    v_cuenta.id,
    v_metodo,
    v_cash,
    v_retenido_total,
    nullif(p_encabezado->>'notas', ''),
    auth.uid()
  )
  returning id into v_pago_id;

  for v_item in select * from jsonb_array_elements(v_validada)
  loop
    insert into public.pago_recibido_aplicaciones (pago_id, factura_id, monto, retenido)
    values (
      v_pago_id,
      (v_item->>'factura_id')::uuid,
      (v_item->>'monto')::numeric,
      (v_item->>'retenido')::numeric
    )
    returning id into v_aplicacion_id;

    for v_ret in select * from jsonb_array_elements(v_item->'retenciones')
    loop
      insert into public.pago_recibido_aplicacion_retenciones (
        aplicacion_id, retencion_id, base, porcentaje, monto
      )
      values (
        v_aplicacion_id,
        (v_ret->>'retencion_id')::uuid,
        (v_ret->>'base')::numeric,
        (v_ret->>'porcentaje')::numeric,
        (v_ret->>'monto')::numeric
      );
    end loop;
  end loop;

  -- Compatibilidad con reportes y vistas viejas: un pago de una sola factura
  -- también deja su detalle en la tabla de retenciones histórica.
  if jsonb_array_length(v_validada) = 1 then
    for v_ret in select * from jsonb_array_elements(v_validada->0->'retenciones')
    loop
      insert into public.pago_recibido_retenciones (pago_id, retencion_id, base, porcentaje, monto)
      values (
        v_pago_id,
        (v_ret->>'retencion_id')::uuid,
        (v_ret->>'base')::numeric,
        (v_ret->>'porcentaje')::numeric,
        (v_ret->>'monto')::numeric
      )
      on conflict (pago_id, retencion_id) do nothing;
    end loop;
  end if;

  v_asiento_lineas := jsonb_build_array(jsonb_build_object(
    'cuenta_id', v_cuenta.id,
    'debito', v_cash,
    'credito', 0,
    'centro_costo_id', v_centro_costo_id,
    'descripcion', 'Recibo de caja'
  ));

  for v_item in select * from jsonb_array_elements(v_validada)
  loop
    v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', coalesce(v_contacto.cuenta_cxc_id, public._cuenta_config('cxc')),
      'debito', 0,
      'credito', round((v_item->>'monto')::numeric + (v_item->>'retenido')::numeric, 2),
      'contacto_id', v_contacto.id,
      'centro_costo_id', v_centro_costo_id,
      'descripcion', 'Pago recibido factura ' || (v_item->>'numero')
    ));

    for v_ret in select * from jsonb_array_elements(v_item->'retenciones')
    loop
      select * into v_retencion
      from public.retenciones r
      where r.id = (v_ret->>'retencion_id')::uuid;

      v_cuenta_retencion := coalesce(
        v_retencion.cuenta_anticipo_id,
        public._cuenta_config('retencion_' || v_retencion.tipo || '_por_cobrar')
      );

      v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_cuenta_retencion,
        'debito', (v_ret->>'monto')::numeric,
        'credito', 0,
        'contacto_id', v_contacto.id,
        'centro_costo_id', v_centro_costo_id,
        'descripcion', 'Retención ' || v_retencion.nombre
      ));
    end loop;
  end loop;

  for v_item in select * from jsonb_array_elements(v_otros_validados)
  loop
    v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', (v_item->>'cuenta_id')::uuid,
      'debito', 0,
      'credito', (v_item->>'monto')::numeric,
      'contacto_id', v_contacto.id,
      'centro_costo_id', v_centro_costo_id,
      'descripcion', v_item->>'descripcion'
    ));

    if (v_item->>'itbis')::numeric > 0 then
      v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', public._cuenta_config('itbis_por_pagar'),
        'debito', 0,
        'credito', (v_item->>'itbis')::numeric,
        'contacto_id', v_contacto.id,
        'centro_costo_id', v_centro_costo_id,
        'descripcion', 'ITBIS ' || (v_item->>'descripcion')
      ));
    end if;
  end loop;

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Recibo de caja #' || (select pr.numero from public.pagos_recibidos pr where pr.id = v_pago_id),
    'pago_recibido',
    v_pago_id,
    v_asiento_lineas
  );

  update public.pagos_recibidos set asiento_id = v_asiento_id where id = v_pago_id;

  for v_item in select * from jsonb_array_elements(v_validada)
  loop
    select * into v_factura
    from public.facturas f
    where f.id = (v_item->>'factura_id')::uuid
    for update;

    if found and v_factura.estado <> 'anulada' then
      v_monto := round(v_factura.pagado + (v_item->>'monto')::numeric, 2);
      v_saldo := round(v_factura.retenido + (v_item->>'retenido')::numeric, 2);

      update public.facturas
      set pagado = v_monto,
          retenido = v_saldo,
          estado = case
            when round(v_monto + v_saldo + v_factura.credito, 2) >= v_factura.total then 'pagada'
            else 'abierta'
          end
      where id = v_factura.id;
    end if;
  end loop;

  return v_pago_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Registrar pago a proveedor con varias facturas y/u otros egresos
--
-- p_encabezado: contacto_id, fecha, cuenta_id, metodo, notas, centro_costo_id,
--               otros_egresos = [{ cuenta_id, descripcion, monto, itbis_tasa }]
-- p_aplicaciones: [{ factura_proveedor_id, monto, retenciones: [{ retencion_id }] }]
-- ---------------------------------------------------------------------------

create or replace function public.registrar_pago_proveedor_multi(p_encabezado jsonb, p_aplicaciones jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_contacto public.contactos%rowtype;
  v_cuenta public.cuentas%rowtype;
  v_factura public.facturas_proveedor%rowtype;
  v_retencion public.retenciones%rowtype;
  v_cuenta_gasto public.cuentas%rowtype;
  v_aplicaciones jsonb;
  v_otros jsonb;
  v_validada jsonb := '[]'::jsonb;
  v_otros_validados jsonb := '[]'::jsonb;
  v_retenciones_app jsonb;
  v_item jsonb;
  v_ret jsonb;
  v_centro_costo_id uuid;
  v_fecha date;
  v_metodo text;
  v_pago_id uuid;
  v_aplicacion_id uuid;
  v_primera_factura uuid;
  v_factura_ids uuid[] := '{}';
  v_ids uuid[] := '{}';
  v_monto numeric(14,2);
  v_cash numeric(14,2) := 0;
  v_retenido_total numeric(14,2) := 0;
  v_retenido_app numeric(14,2);
  v_saldo numeric(14,2);
  v_base numeric(14,2);
  v_monto_retencion numeric(14,2);
  v_cuenta_retencion uuid;
  v_itbis_tasa numeric(5,2);
  v_itbis numeric(14,2);
  v_total numeric(14,2);
  v_descripcion text;
  v_asiento_id uuid;
  v_asiento_lineas jsonb := '[]'::jsonb;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_encabezado is null then
    raise exception 'datos del pago requeridos' using errcode = '22023';
  end if;

  if p_encabezado->>'contacto_id' is null then
    raise exception 'el proveedor es obligatorio' using errcode = '22023';
  end if;

  select * into v_contacto
  from public.contactos c
  where c.id = (p_encabezado->>'contacto_id')::uuid and c.activo;

  if not found then
    raise exception 'contacto no encontrado' using errcode = '22023';
  end if;
  if v_contacto.tipo not in ('proveedor', 'ambos') then
    raise exception 'el contacto no es proveedor' using errcode = '22023';
  end if;

  v_fecha := coalesce((p_encabezado->>'fecha')::date, current_date);
  v_metodo := coalesce(nullif(p_encabezado->>'metodo', ''), 'efectivo');
  if v_metodo not in ('efectivo', 'transferencia', 'tarjeta', 'cheque') then
    raise exception 'método de pago inválido' using errcode = '22023';
  end if;

  if p_encabezado->>'cuenta_id' is null then
    raise exception 'la cuenta de caja o banco es obligatoria' using errcode = '22023';
  end if;

  select * into v_cuenta
  from public.cuentas c
  where c.id = (p_encabezado->>'cuenta_id')::uuid and c.activa;

  if not found then
    raise exception 'cuenta de caja o banco no encontrada' using errcode = '22023';
  end if;
  if not v_cuenta.es_caja_banco then
    raise exception 'la cuenta del pago debe ser de caja o banco' using errcode = '22023';
  end if;

  v_centro_costo_id := nullif(p_encabezado->>'centro_costo_id', '')::uuid;
  if v_centro_costo_id is not null
     and not exists (
       select 1 from public.centros_costo c
       where c.id = v_centro_costo_id and c.activo
     ) then
    raise exception 'centro de costo no encontrado o inactivo' using errcode = '22023';
  end if;

  v_aplicaciones := coalesce(p_aplicaciones, '[]'::jsonb);
  if jsonb_typeof(v_aplicaciones) <> 'array' then
    raise exception 'las aplicaciones deben venir en una lista' using errcode = '22023';
  end if;

  v_otros := coalesce(p_encabezado->'otros_egresos', '[]'::jsonb);
  if jsonb_typeof(v_otros) <> 'array' then
    raise exception 'los otros egresos deben venir en una lista' using errcode = '22023';
  end if;

  if jsonb_array_length(v_aplicaciones) + jsonb_array_length(v_otros) = 0 then
    raise exception 'agrega al menos una factura o un egreso' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(v_aplicaciones)
  loop
    if v_item->>'factura_proveedor_id' is null then
      raise exception 'la factura de proveedor es obligatoria' using errcode = '22023';
    end if;

    if (v_item->>'factura_proveedor_id')::uuid = any (v_factura_ids) then
      raise exception 'la factura está repetida en el pago' using errcode = '22023';
    end if;

    v_monto := round(coalesce((v_item->>'monto')::numeric, 0), 2);
    if v_monto <= 0 then
      raise exception 'el monto pagado de cada factura debe ser mayor a cero' using errcode = '22023';
    end if;

    select * into v_factura
    from public.facturas_proveedor fp
    where fp.id = (v_item->>'factura_proveedor_id')::uuid
    for update;

    if not found then
      raise exception 'factura de proveedor no encontrada' using errcode = '22023';
    end if;
    if v_factura.estado = 'anulada' then
      raise exception 'la factura de proveedor % está anulada', v_factura.numero using errcode = '22023';
    end if;
    if v_factura.contacto_id <> v_contacto.id then
      raise exception 'la factura % no pertenece al proveedor', v_factura.numero using errcode = '22023';
    end if;

    v_saldo := round(v_factura.total - v_factura.pagado - v_factura.credito - v_factura.retenido, 2);
    if v_saldo <= 0 then
      raise exception 'la factura de proveedor % ya está pagada', v_factura.numero using errcode = '22023';
    end if;

    v_retenciones_app := '[]'::jsonb;
    v_retenido_app := 0;
    v_ids := '{}';

    if v_item->'retenciones' is not null then
      if jsonb_typeof(v_item->'retenciones') <> 'array' then
        raise exception 'las retenciones deben venir en una lista' using errcode = '22023';
      end if;

      for v_ret in select * from jsonb_array_elements(v_item->'retenciones')
      loop
        if v_ret->>'retencion_id' is null then
          raise exception 'la retención es obligatoria' using errcode = '22023';
        end if;

        if (v_ret->>'retencion_id')::uuid = any (v_ids) then
          raise exception 'la retención está repetida en la factura %', v_factura.numero
            using errcode = '22023';
        end if;

        select * into v_retencion
        from public.retenciones r
        where r.id = (v_ret->>'retencion_id')::uuid and r.activa;

        if not found then
          raise exception 'retención no encontrada o inactiva' using errcode = '22023';
        end if;

        if exists (
          select 1
          from public.pago_proveedor_retenciones ppr
          join public.pagos_proveedor pp on pp.id = ppr.pago_id
          where pp.factura_proveedor_id = v_factura.id
            and pp.estado = 'activo'
            and ppr.retencion_id = v_retencion.id
        ) or exists (
          select 1
          from public.pago_proveedor_aplicacion_retenciones par
          join public.pago_proveedor_aplicaciones pa on pa.id = par.aplicacion_id
          join public.pagos_proveedor pp on pp.id = pa.pago_id
          where pa.factura_proveedor_id = v_factura.id
            and pp.estado = 'activo'
            and par.retencion_id = v_retencion.id
        ) then
          raise exception 'la retención % ya está aplicada a la factura %',
            v_retencion.nombre, v_factura.numero using errcode = '22023';
        end if;

        v_base := case when v_retencion.tipo = 'itbis' then v_factura.itbis else v_factura.subtotal end;
        v_monto_retencion := round(v_base * v_retencion.porcentaje / 100, 2);

        if v_monto_retencion <= 0 then
          raise exception 'la retención % no genera monto sobre la factura %',
            v_retencion.nombre, v_factura.numero using errcode = '22023';
        end if;

        v_ids := array_append(v_ids, v_retencion.id);
        v_retenido_app := round(v_retenido_app + v_monto_retencion, 2);
        v_retenciones_app := v_retenciones_app || jsonb_build_array(jsonb_build_object(
          'retencion_id', v_retencion.id,
          'base', v_base,
          'porcentaje', v_retencion.porcentaje,
          'monto', v_monto_retencion
        ));
      end loop;
    end if;

    if round(v_monto + v_retenido_app, 2) > v_saldo then
      raise exception 'el monto más las retenciones supera el saldo de la factura de proveedor %',
        v_factura.numero using errcode = '22023';
    end if;

    v_factura_ids := array_append(v_factura_ids, v_factura.id);
    if v_primera_factura is null then
      v_primera_factura := v_factura.id;
    end if;

    v_cash := round(v_cash + v_monto, 2);
    v_retenido_total := round(v_retenido_total + v_retenido_app, 2);

    v_validada := v_validada || jsonb_build_array(jsonb_build_object(
      'factura_proveedor_id', v_factura.id,
      'numero', v_factura.numero,
      'monto', v_monto,
      'retenido', v_retenido_app,
      'retenciones', v_retenciones_app
    ));
  end loop;

  for v_item in select * from jsonb_array_elements(v_otros)
  loop
    if v_item->>'cuenta_id' is null then
      raise exception 'la cuenta del egreso es obligatoria' using errcode = '22023';
    end if;

    v_monto := round(coalesce((v_item->>'monto')::numeric, 0), 2);
    if v_monto <= 0 then
      raise exception 'el monto del egreso debe ser mayor a cero' using errcode = '22023';
    end if;

    select * into v_cuenta_gasto
    from public.cuentas c
    where c.id = (v_item->>'cuenta_id')::uuid and c.activa and c.acepta_movimientos;

    if not found then
      raise exception 'cuenta de egreso no encontrada' using errcode = '22023';
    end if;
    if v_cuenta_gasto.tipo not in ('gasto', 'costo') then
      raise exception 'la cuenta % no es de gasto o costo', v_cuenta_gasto.codigo using errcode = '22023';
    end if;

    v_itbis_tasa := round(coalesce((v_item->>'itbis_tasa')::numeric, 0), 2);
    if v_itbis_tasa not in (0, 16, 18) then
      raise exception 'tasa de ITBIS inválida' using errcode = '22023';
    end if;

    v_itbis := round(v_monto * v_itbis_tasa / 100, 2);
    v_total := round(v_monto + v_itbis, 2);
    v_descripcion := coalesce(nullif(v_item->>'descripcion', ''), v_cuenta_gasto.nombre);

    v_cash := round(v_cash + v_total, 2);
    v_otros_validados := v_otros_validados || jsonb_build_array(jsonb_build_object(
      'cuenta_id', v_cuenta_gasto.id,
      'descripcion', v_descripcion,
      'monto', v_monto,
      'itbis', v_itbis,
      'total', v_total
    ));
  end loop;

  if v_cash <= 0 then
    raise exception 'el monto del pago debe ser mayor a cero' using errcode = '22023';
  end if;

  insert into public.pagos_proveedor (
    factura_proveedor_id, contacto_id, fecha, cuenta_id, metodo, monto, retenido, notas, creado_por
  )
  values (
    v_primera_factura,
    v_contacto.id,
    v_fecha,
    v_cuenta.id,
    v_metodo,
    v_cash,
    v_retenido_total,
    nullif(p_encabezado->>'notas', ''),
    auth.uid()
  )
  returning id into v_pago_id;

  for v_item in select * from jsonb_array_elements(v_validada)
  loop
    insert into public.pago_proveedor_aplicaciones (pago_id, factura_proveedor_id, monto, retenido)
    values (
      v_pago_id,
      (v_item->>'factura_proveedor_id')::uuid,
      (v_item->>'monto')::numeric,
      (v_item->>'retenido')::numeric
    )
    returning id into v_aplicacion_id;

    for v_ret in select * from jsonb_array_elements(v_item->'retenciones')
    loop
      insert into public.pago_proveedor_aplicacion_retenciones (
        aplicacion_id, retencion_id, base, porcentaje, monto
      )
      values (
        v_aplicacion_id,
        (v_ret->>'retencion_id')::uuid,
        (v_ret->>'base')::numeric,
        (v_ret->>'porcentaje')::numeric,
        (v_ret->>'monto')::numeric
      );
    end loop;
  end loop;

  -- Compatibilidad con reportes y vistas viejas: un pago de una sola factura
  -- también deja su detalle en la tabla de retenciones histórica.
  if jsonb_array_length(v_validada) = 1 then
    for v_ret in select * from jsonb_array_elements(v_validada->0->'retenciones')
    loop
      insert into public.pago_proveedor_retenciones (pago_id, retencion_id, base, porcentaje, monto)
      values (
        v_pago_id,
        (v_ret->>'retencion_id')::uuid,
        (v_ret->>'base')::numeric,
        (v_ret->>'porcentaje')::numeric,
        (v_ret->>'monto')::numeric
      )
      on conflict (pago_id, retencion_id) do nothing;
    end loop;
  end if;

  for v_item in select * from jsonb_array_elements(v_validada)
  loop
    v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', coalesce(v_contacto.cuenta_cxp_id, public._cuenta_config('cxp')),
      'debito', round((v_item->>'monto')::numeric + (v_item->>'retenido')::numeric, 2),
      'credito', 0,
      'contacto_id', v_contacto.id,
      'centro_costo_id', v_centro_costo_id,
      'descripcion', 'Pago a proveedor factura ' || (v_item->>'numero')
    ));

    for v_ret in select * from jsonb_array_elements(v_item->'retenciones')
    loop
      select * into v_retencion
      from public.retenciones r
      where r.id = (v_ret->>'retencion_id')::uuid;

      v_cuenta_retencion := coalesce(
        v_retencion.cuenta_id,
        public._cuenta_config('retencion_' || v_retencion.tipo || '_por_pagar')
      );

      v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_cuenta_retencion,
        'debito', 0,
        'credito', (v_ret->>'monto')::numeric,
        'contacto_id', v_contacto.id,
        'centro_costo_id', v_centro_costo_id,
        'descripcion', 'Retención ' || v_retencion.nombre
      ));
    end loop;
  end loop;

  for v_item in select * from jsonb_array_elements(v_otros_validados)
  loop
    v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', (v_item->>'cuenta_id')::uuid,
      'debito', (v_item->>'monto')::numeric,
      'credito', 0,
      'contacto_id', v_contacto.id,
      'centro_costo_id', v_centro_costo_id,
      'descripcion', v_item->>'descripcion'
    ));

    if (v_item->>'itbis')::numeric > 0 then
      v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', public._cuenta_config('itbis_adelantado'),
        'debito', (v_item->>'itbis')::numeric,
        'credito', 0,
        'contacto_id', v_contacto.id,
        'centro_costo_id', v_centro_costo_id,
        'descripcion', 'ITBIS ' || (v_item->>'descripcion')
      ));
    end if;
  end loop;

  v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
    'cuenta_id', v_cuenta.id,
    'debito', 0,
    'credito', v_cash,
    'centro_costo_id', v_centro_costo_id,
    'descripcion', 'Pago a proveedor'
  ));

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Pago a proveedor #' || (select pp.numero from public.pagos_proveedor pp where pp.id = v_pago_id),
    'pago_proveedor',
    v_pago_id,
    v_asiento_lineas
  );

  update public.pagos_proveedor set asiento_id = v_asiento_id where id = v_pago_id;

  for v_item in select * from jsonb_array_elements(v_validada)
  loop
    select * into v_factura
    from public.facturas_proveedor fp
    where fp.id = (v_item->>'factura_proveedor_id')::uuid
    for update;

    if found and v_factura.estado <> 'anulada' then
      v_monto := round(v_factura.pagado + (v_item->>'monto')::numeric, 2);
      v_saldo := round(v_factura.retenido + (v_item->>'retenido')::numeric, 2);

      update public.facturas_proveedor
      set pagado = v_monto,
          retenido = v_saldo,
          estado = case
            when round(v_monto + v_saldo + v_factura.credito, 2) >= v_factura.total then 'pagada'
            else 'abierta'
          end
      where id = v_factura.id;
    end if;
  end loop;

  return v_pago_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Anulación: revierte las aplicaciones nuevas y conserva los pagos viejos
-- (parte de la versión fusionada S15, con stock por almacén y centro de costo)
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
  v_ajuste public.ajustes_inventario%rowtype;
  v_ajuste_linea public.ajuste_inventario_lineas%rowtype;
  v_pago public.pagos_recibidos%rowtype;
  v_pago_prov public.pagos_proveedor%rowtype;
  v_aplicacion public.pago_recibido_aplicaciones%rowtype;
  v_aplicacion_prov public.pago_proveedor_aplicaciones%rowtype;
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
  v_nuevo_retenido numeric(14,2);
  v_almacen_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_tipo is null or p_tipo not in (
    'factura', 'pago_recibido', 'factura_proveedor', 'pago_proveedor', 'gasto_menor',
    'nota_credito_compra', 'ajuste_inventario'
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
    ) or exists (
      select 1
      from public.pago_recibido_aplicaciones pa
      join public.pagos_recibidos pr on pr.id = pa.pago_id
      where pa.factura_id = p_id and pr.estado = 'activo'
    ) then
      raise exception 'no se puede anular una factura con pagos activos' using errcode = 'P0001';
    end if;

    v_almacen_id := coalesce(v_factura.almacen_id, public._almacen_principal());

    for v_prod_id, v_cantidad in
      select fl.producto_id, fl.cantidad
      from public.factura_lineas fl
      join public.productos pr on pr.id = fl.producto_id
      where fl.factura_id = p_id and pr.inventariable
    loop
      perform public._mover_existencia(v_prod_id, v_almacen_id, v_cantidad);
    end loop;

    v_asiento_id := v_factura.asiento_id;
    v_numero := v_factura.numero;

    update public.facturas set estado = 'anulada', pagado = 0, retenido = 0 where id = p_id;

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

    if exists (select 1 from public.pago_recibido_aplicaciones pa where pa.pago_id = p_id) then
      for v_aplicacion in
        select * from public.pago_recibido_aplicaciones pa where pa.pago_id = p_id
      loop
        select * into v_factura
        from public.facturas f
        where f.id = v_aplicacion.factura_id
        for update;

        if found and v_factura.estado <> 'anulada' then
          v_nuevo_pagado := round(greatest(v_factura.pagado - v_aplicacion.monto, 0), 2);
          v_nuevo_retenido := round(greatest(v_factura.retenido - v_aplicacion.retenido, 0), 2);
          update public.facturas
          set pagado = v_nuevo_pagado,
              retenido = v_nuevo_retenido,
              estado = case
                when round(v_nuevo_pagado + v_nuevo_retenido + v_factura.credito, 2) >= v_factura.total then 'pagada'
                else 'abierta'
              end
          where id = v_factura.id;
        end if;
      end loop;
    elsif v_pago.factura_id is not null then
      select * into v_factura from public.facturas f where f.id = v_pago.factura_id for update;
      if found and v_factura.estado <> 'anulada' then
        v_nuevo_pagado := round(greatest(v_factura.pagado - v_pago.monto, 0), 2);
        v_nuevo_retenido := round(greatest(v_factura.retenido - v_pago.retenido, 0), 2);
        update public.facturas
        set pagado = v_nuevo_pagado,
            retenido = v_nuevo_retenido,
            estado = case
              when round(v_nuevo_pagado + v_nuevo_retenido + v_factura.credito, 2) >= v_factura.total then 'pagada'
              else 'abierta'
            end
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
    ) or exists (
      select 1
      from public.pago_proveedor_aplicaciones pa
      join public.pagos_proveedor pp on pp.id = pa.pago_id
      where pa.factura_proveedor_id = p_id and pp.estado = 'activo'
    ) then
      raise exception 'no se puede anular una factura de proveedor con pagos activos' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.notas_credito_compra nc
      where nc.factura_proveedor_id = p_id and nc.estado = 'activa'
    ) then
      raise exception 'no se puede anular una factura de proveedor con notas de crédito activas' using errcode = 'P0001';
    end if;

    v_almacen_id := coalesce(v_factura_prov.almacen_id, public._almacen_principal());

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

      perform public._mover_existencia(v_prod_id, v_almacen_id, -v_cantidad);

      update public.productos
      set costo = v_costo_nuevo
      where id = v_prod_id;
    end loop;

    v_asiento_id := v_factura_prov.asiento_id;
    v_numero := v_factura_prov.numero;

    update public.facturas_proveedor
    set estado = 'anulada', pagado = 0, credito = 0, retenido = 0
    where id = p_id;

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

    if exists (select 1 from public.pago_proveedor_aplicaciones pa where pa.pago_id = p_id) then
      for v_aplicacion_prov in
        select * from public.pago_proveedor_aplicaciones pa where pa.pago_id = p_id
      loop
        select * into v_factura_prov
        from public.facturas_proveedor fp
        where fp.id = v_aplicacion_prov.factura_proveedor_id
        for update;

        if found and v_factura_prov.estado <> 'anulada' then
          v_nuevo_pagado := round(greatest(v_factura_prov.pagado - v_aplicacion_prov.monto, 0), 2);
          v_nuevo_retenido := round(greatest(v_factura_prov.retenido - v_aplicacion_prov.retenido, 0), 2);
          update public.facturas_proveedor
          set pagado = v_nuevo_pagado,
              retenido = v_nuevo_retenido,
              estado = case
                when round(v_nuevo_pagado + v_nuevo_retenido + v_factura_prov.credito, 2) >= v_factura_prov.total then 'pagada'
                else 'abierta'
              end
          where id = v_factura_prov.id;
        end if;
      end loop;
    elsif v_pago_prov.factura_proveedor_id is not null then
      select * into v_factura_prov
      from public.facturas_proveedor fp
      where fp.id = v_pago_prov.factura_proveedor_id
      for update;

      if found and v_factura_prov.estado <> 'anulada' then
        v_nuevo_pagado := round(greatest(v_factura_prov.pagado - v_pago_prov.monto, 0), 2);
        v_nuevo_retenido := round(greatest(v_factura_prov.retenido - v_pago_prov.retenido, 0), 2);
        update public.facturas_proveedor
        set pagado = v_nuevo_pagado,
            retenido = v_nuevo_retenido,
            estado = case
              when round(v_nuevo_pagado + v_nuevo_retenido + v_factura_prov.credito, 2) >= v_factura_prov.total then 'pagada'
              else 'abierta'
            end
        where id = v_factura_prov.id;
      end if;
    end if;

  elsif p_tipo = 'ajuste_inventario' then
    select * into v_ajuste from public.ajustes_inventario ai where ai.id = p_id for update;
    if not found then
      raise exception 'ajuste de inventario no encontrado' using errcode = '22023';
    end if;
    if v_ajuste.estado = 'anulada' then
      raise exception 'el ajuste de inventario ya está anulado' using errcode = '22023';
    end if;

    for v_ajuste_linea in
      select * from public.ajuste_inventario_lineas ail
      where ail.ajuste_id = p_id
      order by ail.id
    loop
      if v_ajuste_linea.tipo = 'entrada' then
        perform public._mover_existencia(v_ajuste_linea.producto_id, v_ajuste.almacen_id, -v_ajuste_linea.cantidad);
      else
        perform public._mover_existencia(v_ajuste_linea.producto_id, v_ajuste.almacen_id, v_ajuste_linea.cantidad);
      end if;
    end loop;

    v_asiento_id := v_ajuste.asiento_id;
    v_numero := v_ajuste.numero;

    update public.ajustes_inventario set estado = 'anulada' where id = p_id;

  elsif p_tipo = 'nota_credito_compra' then
    select * into v_nota from public.notas_credito_compra nc where nc.id = p_id for update;
    if not found then
      raise exception 'nota de crédito de compra no encontrada' using errcode = '22023';
    end if;
    if v_nota.estado = 'anulada' then
      raise exception 'la nota de crédito ya está anulada' using errcode = '22023';
    end if;

    if v_nota.devuelve_inventario then
      v_almacen_id := coalesce(v_nota.almacen_id, public._almacen_principal());

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

        perform public._mover_existencia(v_prod_id, v_almacen_id, v_cantidad);

        update public.productos
        set costo = v_costo_nuevo
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
            when round(v_factura_prov.pagado + v_nuevo_credito + v_factura_prov.retenido, 2) >= v_factura_prov.total then 'pagada'
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
    'centro_costo_id', l.centro_costo_id,
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
-- Permisos
-- ---------------------------------------------------------------------------

revoke all on function public.registrar_pago_recibido_multi(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_pago_recibido_multi(jsonb, jsonb) to authenticated;

revoke all on function public.registrar_pago_proveedor_multi(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_pago_proveedor_multi(jsonb, jsonb) to authenticated;

revoke all on function public.anular_documento(text, uuid) from public, anon, authenticated;
grant execute on function public.anular_documento(text, uuid) to authenticated;

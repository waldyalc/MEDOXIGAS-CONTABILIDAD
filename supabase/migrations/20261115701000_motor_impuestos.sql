-- ---------------------------------------------------------------------------
-- Motor: cada impuesto se acredita (ventas) o debita (compras) en su cuenta
--
-- Los documentos se siguen creando con las funciones de siempre, ahora
-- renombradas a *_sin_impuestos. Los wrappers de este archivo:
--   1. resuelven cada línea contra el catálogo (por impuesto_id o por tarifa),
--   2. guardan impuesto_id en la línea,
--   3. separan en la cabecera ITBIS, otros impuestos y propina,
--   4. dividen la línea única de ITBIS del asiento por cuenta de impuesto.
--
-- La propina legal y el CDT nunca se suman al ITBIS de 606/607/IT-1 porque
-- quedan en columnas propias.
-- ---------------------------------------------------------------------------

do $$
declare
  v_nombre text;
begin
  foreach v_nombre in array array[
    'crear_factura',
    'crear_factura_proveedor',
    'crear_nota_credito_venta',
    'crear_nota_debito_venta',
    'crear_nota_credito_compra',
    'crear_gasto_menor',
    'crear_orden_compra',
    'crear_producto'
  ] loop
    if to_regprocedure('public.' || v_nombre || '(jsonb)') is not null
       and to_regprocedure('public._' || v_nombre || '_sin_impuestos(jsonb)') is null then
      execute format('alter function public.%I(jsonb) rename to %I', v_nombre, '_' || v_nombre || '_sin_impuestos');
    end if;
  end loop;

  if to_regprocedure('public._crear_documento_no_contable(text, jsonb)') is not null
     and to_regprocedure('public._crear_documento_no_contable_sin_impuestos(text, jsonb)') is null then
    alter function public._crear_documento_no_contable(text, jsonb)
      rename to _crear_documento_no_contable_sin_impuestos;
  end if;

  if to_regprocedure('public.actualizar_producto(uuid, jsonb)') is not null
     and to_regprocedure('public._actualizar_producto_sin_impuestos(uuid, jsonb)') is null then
    alter function public.actualizar_producto(uuid, jsonb)
      rename to _actualizar_producto_sin_impuestos;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helpers de preparación, sincronización y división
-- ---------------------------------------------------------------------------

create or replace function public._impuestos_preparar(p_lineas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linea jsonb;
  v_orden bigint;
  v_salida jsonb := '[]'::jsonb;
  v_impuesto public.impuestos%rowtype;
  v_impuesto_id uuid;
  v_tasa numeric(5,2);
begin
  create temp table if not exists pg_temp._impuestos_lineas (
    orden bigint primary key,
    impuesto_id uuid,
    cuenta_id uuid,
    tipo text
  ) on commit drop;

  truncate pg_temp._impuestos_lineas;

  for v_linea, v_orden in
    select value, ordinality from jsonb_array_elements(p_lineas) with ordinality
  loop
    v_impuesto_id := nullif(v_linea->>'impuesto_id', '')::uuid;
    v_tasa := nullif(v_linea->>'itbis_tasa', '')::numeric;

    if v_impuesto_id is not null or v_tasa is not null then
      v_impuesto := public._resolver_impuesto(v_impuesto_id, v_tasa);
      insert into pg_temp._impuestos_lineas (orden, impuesto_id, cuenta_id, tipo)
      values (v_orden, v_impuesto.id, v_impuesto.cuenta_id, v_impuesto.tipo);

      v_linea := v_linea || jsonb_build_object(
        'impuesto_id', v_impuesto.id,
        'itbis_tasa', v_impuesto.tarifa
      );
    else
      insert into pg_temp._impuestos_lineas (orden, impuesto_id, cuenta_id, tipo)
      values (v_orden, null, null, null);
    end if;

    v_salida := v_salida || jsonb_build_array(v_linea);
  end loop;

  return v_salida;
end;
$$;

create or replace function public._impuestos_preparar_fuente(p_lineas jsonb, p_tabla text, p_clave text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linea jsonb;
  v_orden bigint;
  v_salida jsonb := '[]'::jsonb;
  v_fuente_id uuid;
  v_impuesto_id uuid;
  v_tasa numeric(5,2);
  v_impuesto public.impuestos%rowtype;
begin
  create temp table if not exists pg_temp._impuestos_lineas (
    orden bigint primary key,
    impuesto_id uuid,
    cuenta_id uuid,
    tipo text
  ) on commit drop;

  truncate pg_temp._impuestos_lineas;

  for v_linea, v_orden in
    select value, ordinality from jsonb_array_elements(p_lineas) with ordinality
  loop
    v_fuente_id := nullif(v_linea->>p_clave, '')::uuid;
    if v_fuente_id is null then
      raise exception 'cada línea requiere su línea de origen' using errcode = '22023';
    end if;

    execute format('select impuesto_id, itbis_tasa from public.%I where id = $1', p_tabla)
      into v_impuesto_id, v_tasa
      using v_fuente_id;

    if not found then
      raise exception 'línea de origen no encontrada' using errcode = '22023';
    end if;

    v_impuesto := public._resolver_impuesto(v_impuesto_id, v_tasa);

    insert into pg_temp._impuestos_lineas (orden, impuesto_id, cuenta_id, tipo)
    values (v_orden, v_impuesto.id, v_impuesto.cuenta_id, v_impuesto.tipo);

    v_salida := v_salida || jsonb_build_array(v_linea || jsonb_build_object(
      'impuesto_id', v_impuesto.id,
      'itbis_tasa', v_impuesto.tarifa
    ));
  end loop;

  return v_salida;
end;
$$;

create or replace function public._impuestos_sincronizar(p_tabla text, p_clave text, p_documento_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  execute format($f$
    update public.%I l
       set impuesto_id = coalesce(t.impuesto_id, public._impuesto_id_por_tasa(l.itbis_tasa))
      from (
        select id, row_number() over (order by orden) as rn
        from public.%I
        where %I = $1
      ) x
      join pg_temp._impuestos_lineas t on t.orden = x.rn
     where l.id = x.id
  $f$, p_tabla, p_tabla, p_clave)
  using p_documento_id;
end;
$$;

create or replace function public._impuestos_actualizar_totales(
  p_tabla_documento text,
  p_documento_id uuid,
  p_tabla_lineas text,
  p_clave text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  execute format($f$
    update public.%I d
       set itbis = x.itbis,
           otros_impuestos = x.otros,
           propina = x.propina
      from (
        select
          coalesce(sum(l.itbis) filter (
            where coalesce(i.tipo, case when l.itbis_tasa = 2 then 'otro'
                                        when l.itbis_tasa = 10 then 'propina'
                                        else 'itbis' end) = 'itbis'
          ), 0) as itbis,
          coalesce(sum(l.itbis) filter (
            where coalesce(i.tipo, case when l.itbis_tasa = 2 then 'otro'
                                        when l.itbis_tasa = 10 then 'propina'
                                        else 'itbis' end) = 'otro'
          ), 0) as otros,
          coalesce(sum(l.itbis) filter (
            where coalesce(i.tipo, case when l.itbis_tasa = 2 then 'otro'
                                        when l.itbis_tasa = 10 then 'propina'
                                        else 'itbis' end) = 'propina'
          ), 0) as propina
        from public.%I l
        left join public.impuestos i on i.id = l.impuesto_id
        where l.%I = $1
      ) x
     where d.id = $1
  $f$, p_tabla_documento, p_tabla_lineas, p_clave)
  using p_documento_id;
end;
$$;

create or replace function public._impuestos_dividir_asiento(
  p_asiento_id uuid,
  p_cuenta_impuesto uuid,
  p_tabla_lineas text,
  p_clave text,
  p_documento_id uuid,
  p_lado text,
  p_etiqueta text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original public.asiento_lineas%rowtype;
  v_grupo record;
begin
  if p_asiento_id is null then
    return;
  end if;
  if p_lado not in ('debito', 'credito') then
    raise exception 'lado de asiento inválido' using errcode = '22023';
  end if;

  select * into v_original
  from public.asiento_lineas l
  where l.asiento_id = p_asiento_id
    and l.cuenta_id = p_cuenta_impuesto
    and l.descripcion like 'ITBIS%'
    and case when p_lado = 'debito' then l.debito > 0 else l.credito > 0 end
  order by l.id
  limit 1;

  if not found then
    return;
  end if;

  delete from public.asiento_lineas where id = v_original.id;

  for v_grupo in execute format($f$
    select
      coalesce(case when i.tipo = 'itbis' then $2 else i.cuenta_id end, $2) as cuenta_id,
      coalesce(min(i.nombre), 'Impuesto') as nombre,
      sum(l.itbis) as monto
    from public.%I l
    left join public.impuestos i on i.id = l.impuesto_id
    where l.%I = $1
      and l.itbis > 0
    group by coalesce(case when i.tipo = 'itbis' then $2 else i.cuenta_id end, $2)
  $f$, p_tabla_lineas, p_clave)
  using p_documento_id, p_cuenta_impuesto
  loop
    if v_grupo.monto is null or v_grupo.monto <= 0 then
      continue;
    end if;
    if v_grupo.cuenta_id is null then
      raise exception 'el impuesto % no tiene cuenta contable configurada', v_grupo.nombre
        using errcode = '22023';
    end if;

    insert into public.asiento_lineas (
      asiento_id, cuenta_id, contacto_id, centro_costo_id, descripcion, debito, credito
    )
    values (
      p_asiento_id,
      v_grupo.cuenta_id,
      v_original.contacto_id,
      v_original.centro_costo_id,
      v_grupo.nombre || ' ' || p_etiqueta,
      case when p_lado = 'debito' then v_grupo.monto else 0 end,
      case when p_lado = 'credito' then v_grupo.monto else 0 end
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Wrappers de documentos de venta
-- ---------------------------------------------------------------------------

create or replace function public.crear_factura(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_asiento_id uuid;
  v_cuenta_itbis uuid;
  v_pago jsonb;
  v_fecha date;
begin
  if p is null or jsonb_typeof(p->'lineas') <> 'array' then
    return public._crear_factura_sin_impuestos(p);
  end if;

  v_pago := p->'pago';
  v_fecha := coalesce((p->>'fecha')::date, current_date);

  -- El pago se registra después de separar los impuestos: las retenciones de
  -- ITBIS no deben tomar la propina ni el CDT como ITBIS.
  v_id := public._crear_factura_sin_impuestos(
    (p - 'pago') || jsonb_build_object('lineas', public._impuestos_preparar(p->'lineas'))
  );

  perform public._impuestos_sincronizar('factura_lineas', 'factura_id', v_id);
  perform public._impuestos_actualizar_totales('facturas', v_id, 'factura_lineas', 'factura_id');

  select asiento_id into v_asiento_id from public.facturas where id = v_id;
  v_cuenta_itbis := public._cuenta_config('itbis_por_pagar');
  perform public._impuestos_dividir_asiento(
    v_asiento_id, v_cuenta_itbis, 'factura_lineas', 'factura_id', v_id, 'credito', 'factura'
  );

  if v_pago is not null and jsonb_typeof(v_pago) = 'object' then
    perform public.registrar_pago_recibido(jsonb_build_object(
      'factura_id', v_id,
      'contacto_id', p->>'contacto_id',
      'fecha', coalesce(v_pago->>'fecha', v_fecha::text),
      'cuenta_id', v_pago->>'cuenta_id',
      'metodo', coalesce(v_pago->>'metodo', 'efectivo'),
      'monto', v_pago->'monto',
      'notas', v_pago->>'notas'
    ));
  end if;

  return v_id;
end;
$$;

create or replace function public.crear_nota_debito_venta(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_asiento_id uuid;
  v_cuenta_itbis uuid;
begin
  if p is null or jsonb_typeof(p->'lineas') <> 'array' then
    return public._crear_nota_debito_venta_sin_impuestos(p);
  end if;

  v_id := public._crear_nota_debito_venta_sin_impuestos(p || jsonb_build_object(
    'lineas', public._impuestos_preparar(p->'lineas')
  ));

  perform public._impuestos_sincronizar('nota_debito_venta_lineas', 'nota_id', v_id);
  perform public._impuestos_actualizar_totales('notas_debito_venta', v_id, 'nota_debito_venta_lineas', 'nota_id');

  select asiento_id into v_asiento_id from public.notas_debito_venta where id = v_id;
  v_cuenta_itbis := public._cuenta_config('itbis_por_pagar');
  perform public._impuestos_dividir_asiento(
    v_asiento_id, v_cuenta_itbis, 'nota_debito_venta_lineas', 'nota_id', v_id, 'credito', 'nota de débito'
  );

  return v_id;
end;
$$;

create or replace function public.crear_nota_credito_venta(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_asiento_id uuid;
  v_cuenta_itbis uuid;
begin
  if p is null or jsonb_typeof(p->'lineas') <> 'array' then
    return public._crear_nota_credito_venta_sin_impuestos(p);
  end if;

  v_id := public._crear_nota_credito_venta_sin_impuestos(p || jsonb_build_object(
    'lineas', public._impuestos_preparar_fuente(p->'lineas', 'factura_lineas', 'factura_linea_id')
  ));

  perform public._impuestos_sincronizar('nota_credito_venta_lineas', 'nota_id', v_id);
  perform public._impuestos_actualizar_totales('notas_credito_venta', v_id, 'nota_credito_venta_lineas', 'nota_id');

  select asiento_id into v_asiento_id from public.notas_credito_venta where id = v_id;
  v_cuenta_itbis := public._cuenta_config('itbis_por_pagar');
  perform public._impuestos_dividir_asiento(
    v_asiento_id, v_cuenta_itbis, 'nota_credito_venta_lineas', 'nota_id', v_id, 'debito', 'nota de crédito'
  );

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Wrappers de compras y gastos
-- ---------------------------------------------------------------------------

create or replace function public.crear_factura_proveedor(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_asiento_id uuid;
  v_cuenta_itbis uuid;
begin
  if p is null or jsonb_typeof(p->'lineas') <> 'array' then
    return public._crear_factura_proveedor_sin_impuestos(p);
  end if;

  v_id := public._crear_factura_proveedor_sin_impuestos(p || jsonb_build_object(
    'lineas', public._impuestos_preparar(p->'lineas')
  ));

  perform public._impuestos_sincronizar('facturas_proveedor_lineas', 'factura_proveedor_id', v_id);
  perform public._impuestos_actualizar_totales(
    'facturas_proveedor', v_id, 'facturas_proveedor_lineas', 'factura_proveedor_id'
  );

  select asiento_id into v_asiento_id from public.facturas_proveedor where id = v_id;
  v_cuenta_itbis := public._cuenta_config('itbis_adelantado');
  perform public._impuestos_dividir_asiento(
    v_asiento_id, v_cuenta_itbis, 'facturas_proveedor_lineas', 'factura_proveedor_id', v_id,
    'debito', 'factura proveedor'
  );

  return v_id;
end;
$$;

create or replace function public.crear_nota_credito_compra(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_asiento_id uuid;
  v_cuenta_itbis uuid;
begin
  if p is null or jsonb_typeof(p->'lineas') <> 'array' then
    return public._crear_nota_credito_compra_sin_impuestos(p);
  end if;

  v_id := public._crear_nota_credito_compra_sin_impuestos(p || jsonb_build_object(
    'lineas', public._impuestos_preparar_fuente(p->'lineas', 'facturas_proveedor_lineas', 'factura_proveedor_linea_id')
  ));

  perform public._impuestos_sincronizar('nota_credito_compra_lineas', 'nota_id', v_id);
  perform public._impuestos_actualizar_totales('notas_credito_compra', v_id, 'nota_credito_compra_lineas', 'nota_id');

  select asiento_id into v_asiento_id from public.notas_credito_compra where id = v_id;
  v_cuenta_itbis := public._cuenta_config('itbis_adelantado');
  perform public._impuestos_dividir_asiento(
    v_asiento_id, v_cuenta_itbis, 'nota_credito_compra_lineas', 'nota_id', v_id,
    'credito', 'nota de crédito compra'
  );

  return v_id;
end;
$$;

create or replace function public.crear_gasto_menor(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_asiento_id uuid;
  v_original public.asiento_lineas%rowtype;
  v_impuesto public.impuestos%rowtype;
  v_cuenta_impuesto uuid;
  v_monto_impuesto numeric(14,2);
begin
  if p is null then
    return public._crear_gasto_menor_sin_impuestos(p);
  end if;

  v_impuesto := public._resolver_impuesto(
    nullif(p->>'impuesto_id', '')::uuid,
    coalesce(nullif(p->>'itbis_tasa', '')::numeric, 0)
  );

  v_id := public._crear_gasto_menor_sin_impuestos(p || jsonb_build_object(
    'impuesto_id', v_impuesto.id,
    'itbis_tasa', v_impuesto.tarifa
  ));

  select itbis into v_monto_impuesto from public.gastos_menores where id = v_id;

  update public.gastos_menores
  set impuesto_id = v_impuesto.id,
      itbis = case when v_impuesto.tipo = 'itbis' then v_monto_impuesto else 0 end,
      otros_impuestos = case when v_impuesto.tipo = 'otro' then v_monto_impuesto else 0 end,
      propina = case when v_impuesto.tipo = 'propina' then v_monto_impuesto else 0 end
  where id = v_id;

  select asiento_id into v_asiento_id from public.gastos_menores where id = v_id;

  select * into v_original
  from public.asiento_lineas l
  where l.asiento_id = v_asiento_id
    and l.cuenta_id = public._cuenta_config('itbis_adelantado')
    and l.descripcion like 'ITBIS%'
    and l.debito > 0
  order by l.id
  limit 1;

  if found then
    v_cuenta_impuesto := case
      when v_impuesto.tipo = 'itbis' then public._cuenta_config('itbis_adelantado')
      else v_impuesto.cuenta_id
    end;

    if v_cuenta_impuesto is null then
      raise exception 'el impuesto % no tiene cuenta contable configurada', v_impuesto.nombre
        using errcode = '22023';
    end if;

    update public.asiento_lineas
    set cuenta_id = v_cuenta_impuesto,
        descripcion = v_impuesto.nombre || ' gasto menor'
    where id = v_original.id;
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Wrappers de documentos sin asiento
-- ---------------------------------------------------------------------------

create or replace function public._crear_documento_no_contable(p_tipo text, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_tabla_lineas text;
  v_clave text;
  v_tabla_documento text;
begin
  if p is null or jsonb_typeof(p->'lineas') <> 'array' then
    return public._crear_documento_no_contable_sin_impuestos(p_tipo, p);
  end if;

  v_id := public._crear_documento_no_contable_sin_impuestos(
    p_tipo,
    p || jsonb_build_object('lineas', public._impuestos_preparar(p->'lineas'))
  );

  if p_tipo = 'cotizacion' then
    v_tabla_documento := 'cotizaciones';
    v_tabla_lineas := 'cotizacion_lineas';
    v_clave := 'cotizacion_id';
  else
    v_tabla_documento := 'remisiones';
    v_tabla_lineas := 'remision_lineas';
    v_clave := 'remision_id';
  end if;

  perform public._impuestos_sincronizar(v_tabla_lineas, v_clave, v_id);
  perform public._impuestos_actualizar_totales(v_tabla_documento, v_id, v_tabla_lineas, v_clave);

  return v_id;
end;
$$;

create or replace function public.crear_orden_compra(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p is null or jsonb_typeof(p->'lineas') <> 'array' then
    return public._crear_orden_compra_sin_impuestos(p);
  end if;

  v_id := public._crear_orden_compra_sin_impuestos(p || jsonb_build_object(
    'lineas', public._impuestos_preparar(p->'lineas')
  ));

  perform public._impuestos_sincronizar('orden_compra_lineas', 'orden_id', v_id);
  perform public._impuestos_actualizar_totales('ordenes_compra', v_id, 'orden_compra_lineas', 'orden_id');

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Wrappers de productos
-- ---------------------------------------------------------------------------

create or replace function public.crear_producto(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_impuesto public.impuestos%rowtype;
  v_tasa_base numeric(5,2);
begin
  if p is null then
    return public._crear_producto_sin_impuestos(p);
  end if;

  v_impuesto := public._resolver_impuesto(
    nullif(p->>'impuesto_id', '')::uuid,
    coalesce(nullif(p->>'itbis_tasa', '')::numeric, 18)
  );

  -- La función base solo acepta 0/16/18; el wrapper guarda después la tarifa
  -- real del catálogo (CDT 2 % o propina 10 %) con su impuesto_id.
  v_tasa_base := case when v_impuesto.tarifa in (0, 16, 18) then v_impuesto.tarifa else 0 end;

  v_id := public._crear_producto_sin_impuestos(p || jsonb_build_object(
    'impuesto_id', v_impuesto.id,
    'itbis_tasa', v_tasa_base
  ));

  update public.productos
  set impuesto_id = v_impuesto.id,
      itbis_tasa = v_impuesto.tarifa
  where id = v_id;

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
  v_id uuid;
  v_impuesto public.impuestos%rowtype;
  v_tasa_base numeric(5,2);
begin
  if p is null then
    return public._actualizar_producto_sin_impuestos(p_id, p);
  end if;

  if p ? 'impuesto_id' or p ? 'itbis_tasa' then
    v_impuesto := public._resolver_impuesto(
      nullif(p->>'impuesto_id', '')::uuid,
      coalesce(nullif(p->>'itbis_tasa', '')::numeric, 18)
    );

    v_tasa_base := case when v_impuesto.tarifa in (0, 16, 18) then v_impuesto.tarifa else 0 end;

    v_id := public._actualizar_producto_sin_impuestos(p_id, p || jsonb_build_object(
      'impuesto_id', v_impuesto.id,
      'itbis_tasa', v_tasa_base
    ));

    update public.productos
    set impuesto_id = v_impuesto.id,
        itbis_tasa = v_impuesto.tarifa
    where id = v_id;

    return v_id;
  end if;

  return public._actualizar_producto_sin_impuestos(p_id, p);
end;
$$;

-- ---------------------------------------------------------------------------
-- Conversión cotización/conduce: conserva el impuesto de cada línea
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
  if v_tipo_comprobante not in ('01', '02') then
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
-- Permisos: solo las RPC públicas quedan expuestas a authenticated
-- ---------------------------------------------------------------------------

revoke all on function public._crear_factura_sin_impuestos(jsonb) from public, anon, authenticated;
revoke all on function public._crear_factura_proveedor_sin_impuestos(jsonb) from public, anon, authenticated;
revoke all on function public._crear_nota_credito_venta_sin_impuestos(jsonb) from public, anon, authenticated;
revoke all on function public._crear_nota_debito_venta_sin_impuestos(jsonb) from public, anon, authenticated;
revoke all on function public._crear_nota_credito_compra_sin_impuestos(jsonb) from public, anon, authenticated;
revoke all on function public._crear_gasto_menor_sin_impuestos(jsonb) from public, anon, authenticated;
revoke all on function public._crear_documento_no_contable_sin_impuestos(text, jsonb) from public, anon, authenticated;
revoke all on function public._crear_orden_compra_sin_impuestos(jsonb) from public, anon, authenticated;
revoke all on function public._crear_producto_sin_impuestos(jsonb) from public, anon, authenticated;
revoke all on function public._actualizar_producto_sin_impuestos(uuid, jsonb) from public, anon, authenticated;

revoke all on function public._impuestos_preparar(jsonb) from public, anon, authenticated;
revoke all on function public._impuestos_preparar_fuente(jsonb, text, text) from public, anon, authenticated;
revoke all on function public._impuestos_sincronizar(text, text, uuid) from public, anon, authenticated;
revoke all on function public._impuestos_actualizar_totales(text, uuid, text, text) from public, anon, authenticated;
revoke all on function public._impuestos_dividir_asiento(uuid, uuid, text, text, uuid, text, text)
  from public, anon, authenticated;

revoke all on function public.crear_factura(jsonb) from public, anon, authenticated;
revoke all on function public.crear_factura_proveedor(jsonb) from public, anon, authenticated;
revoke all on function public.crear_nota_credito_venta(jsonb) from public, anon, authenticated;
revoke all on function public.crear_nota_debito_venta(jsonb) from public, anon, authenticated;
revoke all on function public.crear_nota_credito_compra(jsonb) from public, anon, authenticated;
revoke all on function public.crear_gasto_menor(jsonb) from public, anon, authenticated;
revoke all on function public._crear_documento_no_contable(text, jsonb) from public, anon, authenticated;
revoke all on function public.crear_orden_compra(jsonb) from public, anon, authenticated;
revoke all on function public.crear_producto(jsonb) from public, anon, authenticated;
revoke all on function public.actualizar_producto(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.convertir_a_factura(jsonb) from public, anon, authenticated;

grant execute on function public.crear_factura(jsonb) to authenticated;
grant execute on function public.crear_factura_proveedor(jsonb) to authenticated;
grant execute on function public.crear_nota_credito_venta(jsonb) to authenticated;
grant execute on function public.crear_nota_debito_venta(jsonb) to authenticated;
grant execute on function public.crear_nota_credito_compra(jsonb) to authenticated;
grant execute on function public.crear_gasto_menor(jsonb) to authenticated;
grant execute on function public.crear_orden_compra(jsonb) to authenticated;
grant execute on function public.crear_producto(jsonb) to authenticated;
grant execute on function public.actualizar_producto(uuid, jsonb) to authenticated;
grant execute on function public.convertir_a_factura(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Punto de venta (POS) — RPCs atómicas (fase 2A, parte 2 de 2)
--
-- Depende de 20261125120000_pos_tablas.sql, que crea las tablas pos_*, las
-- columnas de turno/origen/reembolso en los documentos y las cuentas semilla
-- de sobrante/faltante. Aquí solo viven las RPC: no se crean tablas ni
-- columnas.
--
-- · Todo va en una transacción: si un paso falla, no queda factura, pago,
--   movimiento ni asiento a medias.
-- · security definer + search_path = '' + rol admin/contador. Errores en
--   español: 22023 para validación y 42501 sin permiso.
-- · Orden de bloqueo: pos_terminales → pos_turnos → motor (numeraciones,
--   existencias, facturas) → contactos (solo si la venta queda a crédito).
-- · Contrato funcional: docs/dominio-pos.md §3.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Helpers internos
-- ---------------------------------------------------------------------------

-- Importe desde un payload jsonb: null/vacío = null, formato inválido = 22023
-- y siempre redondeado a 2 decimales.
create or replace function public._pos_monto(p_valor text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_valor is null or btrim(p_valor) = '' then
    return null;
  end if;

  if btrim(p_valor) !~ '^-?[0-9]{1,12}(\.[0-9]{1,4})?$' then
    raise exception 'el monto no es un número válido' using errcode = '22023';
  end if;

  return round(btrim(p_valor)::numeric, 2);
end;
$$;

create or replace function public._pos_booleano(p_valor text, p_defecto boolean)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_valor is null or btrim(p_valor) = '' then
    return p_defecto;
  end if;

  if btrim(p_valor) in ('true', 't', '1') then
    return true;
  end if;
  if btrim(p_valor) in ('false', 'f', '0') then
    return false;
  end if;

  raise exception 'el valor booleano no es válido' using errcode = '22023';
end;
$$;

create or replace function public._pos_empresa()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(e)
  from public.empresa e
  where e.id = 1;
$$;

create or replace function public._pos_usuario(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(btrim(p.nombre), '')
  from public.perfiles p
  where p.user_id = p_user_id;
$$;

-- Plantilla del ticket: mezcla la enviada sobre la actual (o el default en el
-- alta) y valida claves, enums, toggles y longitud del pie.
create or replace function public._pos_plantilla_ticket(
  p_actual jsonb,
  p_nueva jsonb
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_default jsonb := jsonb_build_object(
    'estilo', 'clasico',
    'ancho_mm', 80,
    'fuente', 'clasica',
    'tamano_letra', 'mediana',
    'interlineado', 'normal',
    'mostrar_logo', true,
    'mostrar_vendedor', true,
    'mostrar_descripcion', true,
    'mostrar_referencia', false,
    'mostrar_precio_unitario', true,
    'mostrar_unidad', true,
    'precios_con_impuestos', true,
    'pie_ticket', null
  );
  v_claves text[] := array[
    'estilo', 'ancho_mm', 'fuente', 'tamano_letra', 'interlineado', 'mostrar_logo',
    'mostrar_vendedor', 'mostrar_descripcion', 'mostrar_referencia',
    'mostrar_precio_unitario', 'mostrar_unidad', 'precios_con_impuestos', 'pie_ticket'
  ];
  v_toggles text[] := array[
    'mostrar_logo', 'mostrar_vendedor', 'mostrar_descripcion', 'mostrar_referencia',
    'mostrar_precio_unitario', 'mostrar_unidad', 'precios_con_impuestos'
  ];
  v_resultado jsonb;
  v_clave text;
  v_toggle text;
  v_pie text;
begin
  if p_nueva is null or jsonb_typeof(p_nueva) = 'null' then
    return coalesce(p_actual, v_default);
  end if;

  if jsonb_typeof(p_nueva) <> 'object' then
    raise exception 'la plantilla del ticket debe ser un objeto' using errcode = '22023';
  end if;

  for v_clave in select jsonb_object_keys(p_nueva) loop
    if not (v_clave = any (v_claves)) then
      raise exception 'la plantilla del ticket tiene un campo desconocido: %', v_clave
        using errcode = '22023';
    end if;
  end loop;

  v_resultado := coalesce(p_actual, v_default) || p_nueva;

  if coalesce(v_resultado->>'estilo', '') not in ('clasico', 'minimalista', 'detallado') then
    raise exception 'la plantilla del ticket tiene un valor inválido para %', 'estilo'
      using errcode = '22023';
  end if;

  if jsonb_typeof(v_resultado->'ancho_mm') <> 'number' then
    raise exception 'la plantilla del ticket tiene un valor inválido para %', 'ancho_mm'
      using errcode = '22023';
  end if;

  if (v_resultado->>'ancho_mm')::numeric not in (80, 57) then
    raise exception 'la plantilla del ticket tiene un valor inválido para %', 'ancho_mm'
      using errcode = '22023';
  end if;

  if coalesce(v_resultado->>'fuente', '') not in ('clasica', 'moderna', 'compacta') then
    raise exception 'la plantilla del ticket tiene un valor inválido para %', 'fuente'
      using errcode = '22023';
  end if;

  if coalesce(v_resultado->>'tamano_letra', '') not in ('pequena', 'mediana', 'grande') then
    raise exception 'la plantilla del ticket tiene un valor inválido para %', 'tamano_letra'
      using errcode = '22023';
  end if;

  if coalesce(v_resultado->>'interlineado', '') not in ('compacto', 'normal', 'amplio') then
    raise exception 'la plantilla del ticket tiene un valor inválido para %', 'interlineado'
      using errcode = '22023';
  end if;

  foreach v_toggle in array v_toggles loop
    if jsonb_typeof(v_resultado -> v_toggle) <> 'boolean' then
      raise exception 'la plantilla del ticket tiene un valor inválido para %', v_toggle
        using errcode = '22023';
    end if;
  end loop;

  if jsonb_typeof(v_resultado->'pie_ticket') = 'string' then
    v_pie := btrim(v_resultado->>'pie_ticket');
    if length(v_pie) > 500 then
      raise exception 'la plantilla del ticket tiene un valor inválido para %', 'pie_ticket'
        using errcode = '22023';
    end if;
    if v_pie = '' then
      v_resultado := jsonb_set(v_resultado, '{pie_ticket}', 'null'::jsonb);
    else
      v_resultado := jsonb_set(v_resultado, '{pie_ticket}', to_jsonb(v_pie));
    end if;
  elsif jsonb_typeof(v_resultado->'pie_ticket') <> 'null' then
    raise exception 'la plantilla del ticket tiene un valor inválido para %', 'pie_ticket'
      using errcode = '22023';
  end if;

  return v_resultado;
end;
$$;

-- Valida una cuenta de cobro de una terminal (cajón o banco activo, y que no
-- sea el cajón de esta u otra terminal activa).
create or replace function public._pos_validar_cuenta_cobro(
  p_cuenta_id uuid,
  p_etiqueta text,
  p_cuenta_efectivo_id uuid,
  p_terminal_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cuenta public.cuentas%rowtype;
begin
  select * into v_cuenta
  from public.cuentas c
  where c.id = p_cuenta_id;

  if not found or not v_cuenta.activa or not v_cuenta.es_caja_banco then
    raise exception 'la cuenta de % debe ser una cuenta de caja o banco activa', p_etiqueta
      using errcode = '22023';
  end if;

  if p_cuenta_id = p_cuenta_efectivo_id then
    raise exception 'la cuenta de % no puede ser un cajón de efectivo', p_etiqueta
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.pos_terminales t
    where t.activa
      and t.cuenta_efectivo_id = p_cuenta_id
      and t.id <> coalesce(p_terminal_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) then
    raise exception 'la cuenta de % no puede ser un cajón de efectivo', p_etiqueta
      using errcode = '22023';
  end if;
end;
$$;

-- Resuelve las líneas del carrito: producto/unidad, precio de lista y tasas.
-- Siempre devuelve precio e itbis_tasa explícitos, para que el motor no caiga
-- en el 18 por defecto de las líneas libres.
create or replace function public._pos_resolver_lineas(
  p_lineas jsonb,
  p_lista_precio_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_linea jsonb;
  v_salida jsonb := '[]'::jsonb;
  v_producto public.productos%rowtype;
  v_unidad public.producto_unidades%rowtype;
  v_producto_id uuid;
  v_unidad_id uuid;
  v_tiene_producto boolean;
  v_con_unidad boolean;
  v_descripcion text;
  v_cantidad numeric(14,2);
  v_precio numeric(14,2);
  v_descuento numeric(5,2);
  v_itbis numeric(5,2);
begin
  if p_lineas is null
     or jsonb_typeof(p_lineas) <> 'array'
     or jsonb_array_length(p_lineas) = 0 then
    raise exception 'la venta requiere al menos una línea' using errcode = '22023';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_producto_id := nullif(v_linea->>'producto_id', '')::uuid;
    v_unidad_id := nullif(v_linea->>'unidad_id', '')::uuid;
    v_tiene_producto := false;
    v_con_unidad := false;

    if v_producto_id is not null then
      select * into v_producto
      from public.productos pr
      where pr.id = v_producto_id and pr.activo;

      if not found then
        raise exception 'el producto o la unidad de medida no existe o está inactivo'
          using errcode = '22023';
      end if;
      v_tiene_producto := true;
    end if;

    if v_unidad_id is not null then
      if not v_tiene_producto then
        raise exception 'la unidad de medida requiere un producto' using errcode = '22023';
      end if;
      if v_producto.tipo = 'combo' then
        raise exception 'un combo no admite unidad de medida' using errcode = '22023';
      end if;

      select * into v_unidad
      from public.producto_unidades pu
      where pu.id = v_unidad_id
        and pu.producto_id = v_producto_id
        and pu.activa;

      if not found then
        raise exception 'el producto o la unidad de medida no existe o está inactivo'
          using errcode = '22023';
      end if;
      v_con_unidad := true;
    end if;

    v_cantidad := public._pos_monto(v_linea->>'cantidad');
    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'la cantidad debe ser mayor a cero' using errcode = '22023';
    end if;

    v_descuento := coalesce(public._pos_monto(v_linea->>'descuento_pct'), 0);
    if v_descuento < 0 or v_descuento > 100 then
      raise exception 'el descuento debe estar entre 0 y 100' using errcode = '22023';
    end if;

    v_itbis := public._pos_monto(v_linea->>'itbis_tasa');
    if v_itbis is null then
      v_itbis := case when v_tiene_producto then v_producto.itbis_tasa else 0 end;
    end if;
    if v_itbis < 0 or v_itbis > 100 then
      raise exception 'la tasa de ITBIS es inválida' using errcode = '22023';
    end if;

    v_descripcion := nullif(btrim(coalesce(v_linea->>'descripcion', '')), '');
    if v_descripcion is null and v_tiene_producto then
      v_descripcion := v_producto.nombre;
    end if;
    if v_descripcion is null then
      raise exception 'la línea libre requiere una descripción' using errcode = '22023';
    end if;

    v_precio := public._pos_monto(v_linea->>'precio');
    if v_precio is null then
      if not v_tiene_producto then
        raise exception 'la línea libre requiere un precio' using errcode = '22023';
      end if;

      if not v_con_unidad then
        v_precio := public._precio_lista(v_producto_id, v_producto.precio, p_lista_precio_id);
      elsif v_unidad.precio is not null then
        v_precio := round(v_unidad.precio, 2);
      else
        v_precio := round(
          public._precio_lista(v_producto_id, v_producto.precio, p_lista_precio_id) * v_unidad.factor_base,
          2
        );
      end if;
    end if;

    if v_precio < 0 then
      raise exception 'el precio no puede ser negativo' using errcode = '22023';
    end if;

    v_salida := v_salida || jsonb_build_array(jsonb_build_object(
      'producto_id', v_producto_id,
      'descripcion', v_descripcion,
      'cantidad', v_cantidad,
      'unidad_id', v_unidad_id,
      'precio', v_precio,
      'descuento_pct', v_descuento,
      'itbis_tasa', v_itbis,
      'impuesto_id', nullif(v_linea->>'impuesto_id', '')::uuid
    ));
  end loop;

  return v_salida;
end;
$$;

-- Bloque resumen del turno (docs/dominio-pos.md §3.9). Lo reutilizan el
-- resumen, la apertura, los movimientos, la devolución y el cierre.
--
-- security invoker: cuando entra por pos_resumen_turno (también invoker) corre
-- con RLS; cuando lo llama una RPC definer corre con los privilegios del dueño.
create or replace function public._pos_resumen(p_turno_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_turno public.pos_turnos%rowtype;
  v_terminal public.pos_terminales%rowtype;
  v_ventas_total numeric(14,2) := 0;
  v_ventas_cantidad int := 0;
  v_cobrado numeric(14,2) := 0;
  v_efectivo numeric(14,2) := 0;
  v_tarjeta numeric(14,2) := 0;
  v_transferencia numeric(14,2) := 0;
  v_por_cuenta jsonb := '[]'::jsonb;
  v_ingresos_total numeric(14,2) := 0;
  v_ingresos_cantidad int := 0;
  v_ingresos_motivos jsonb := '{}'::jsonb;
  v_retiros_total numeric(14,2) := 0;
  v_retiros_cantidad int := 0;
  v_retiros_motivos jsonb := '{}'::jsonb;
  v_devoluciones_cantidad int := 0;
  v_devoluciones_total numeric(14,2) := 0;
  v_devoluciones_efectivo numeric(14,2) := 0;
  v_movimientos jsonb := '[]'::jsonb;
  v_esperado numeric(14,2);
  v_credito numeric(14,2);
begin
  select * into v_turno
  from public.pos_turnos t
  where t.id = p_turno_id;

  if not found then
    raise exception 'el turno no existe' using errcode = '22023';
  end if;

  select * into v_terminal
  from public.pos_terminales t
  where t.id = v_turno.terminal_id;

  -- Ventas del turno y pagos iniciales (los que no vienen de un cobro).
  select
    coalesce(sum(f.total), 0),
    count(*)::int
  into v_ventas_total, v_ventas_cantidad
  from public.facturas f
  where f.origen = 'pos'
    and f.turno_id = p_turno_id
    and f.estado <> 'anulada';

  select coalesce(sum(p.monto), 0)
  into v_cobrado
  from public.pagos_recibidos p
  join public.facturas f on f.id = p.factura_id
  where f.origen = 'pos'
    and f.turno_id = p_turno_id
    and f.estado <> 'anulada'
    and p.turno_id = p_turno_id
    and p.estado = 'activo'
    and not exists (
      select 1
      from public.pos_turno_movimientos m
      where m.pago_recibido_id = p.id
    );

  select
    coalesce(sum(p.monto) filter (
      where p.metodo = 'efectivo' and p.cuenta_id = v_terminal.cuenta_efectivo_id
    ), 0),
    coalesce(sum(p.monto) filter (where p.metodo = 'tarjeta'), 0),
    coalesce(sum(p.monto) filter (where p.metodo = 'transferencia'), 0)
  into v_efectivo, v_tarjeta, v_transferencia
  from public.pagos_recibidos p
  join public.facturas f on f.id = p.factura_id
  where f.origen = 'pos'
    and f.turno_id = p_turno_id
    and f.estado <> 'anulada'
    and p.turno_id = p_turno_id
    and p.estado = 'activo'
    and not exists (
      select 1
      from public.pos_turno_movimientos m
      where m.pago_recibido_id = p.id
    );

  v_credito := round(v_ventas_total - v_cobrado, 2);

  select coalesce(jsonb_agg(x.detalle order by x.cuenta_nombre, x.metodo), '[]'::jsonb)
  into v_por_cuenta
  from (
    select
      c.nombre as cuenta_nombre,
      p.metodo,
      jsonb_build_object(
        'cuenta_id', p.cuenta_id,
        'cuenta_nombre', c.nombre,
        'metodo', p.metodo,
        'monto', round(sum(p.monto), 2)
      ) as detalle
    from public.pagos_recibidos p
    join public.facturas f on f.id = p.factura_id
    left join public.cuentas c on c.id = p.cuenta_id
    where f.origen = 'pos'
      and f.turno_id = p_turno_id
      and f.estado <> 'anulada'
      and p.turno_id = p_turno_id
      and p.estado = 'activo'
      and not exists (
        select 1
        from public.pos_turno_movimientos m
        where m.pago_recibido_id = p.id
      )
    group by p.cuenta_id, c.nombre, p.metodo
  ) x;

  -- Movimientos vigentes: un cobro cuenta si su pago está activo y un gasto si
  -- su gasto menor está activo. Los directos siempre cuentan.
  select
    coalesce(sum(m.monto), 0),
    count(*)::int,
    jsonb_build_object(
      'fondo_caja', coalesce(sum(m.monto) filter (where m.motivo = 'fondo_caja'), 0),
      'cobro_factura', coalesce(sum(m.monto) filter (where m.motivo = 'cobro_factura'), 0),
      'otro', coalesce(sum(m.monto) filter (where m.motivo = 'otro'), 0)
    )
  into v_ingresos_total, v_ingresos_cantidad, v_ingresos_motivos
  from public.pos_turno_movimientos m
  left join public.pagos_recibidos p on p.id = m.pago_recibido_id
  left join public.gastos_menores g on g.id = m.gasto_menor_id
  where m.turno_id = p_turno_id
    and m.tipo = 'ingreso'
    and (m.pago_recibido_id is null or coalesce(p.estado, '') = 'activo')
    and (m.gasto_menor_id is null or coalesce(g.estado, '') = 'activo');

  select
    coalesce(sum(m.monto), 0),
    count(*)::int,
    jsonb_build_object(
      'retiro_caja', coalesce(sum(m.monto) filter (where m.motivo = 'retiro_caja'), 0),
      'gasto_menor', coalesce(sum(m.monto) filter (where m.motivo = 'gasto_menor'), 0),
      'deposito_banco', coalesce(sum(m.monto) filter (where m.motivo = 'deposito_banco'), 0),
      'otro', coalesce(sum(m.monto) filter (where m.motivo = 'otro'), 0)
    )
  into v_retiros_total, v_retiros_cantidad, v_retiros_motivos
  from public.pos_turno_movimientos m
  left join public.pagos_recibidos p on p.id = m.pago_recibido_id
  left join public.gastos_menores g on g.id = m.gasto_menor_id
  where m.turno_id = p_turno_id
    and m.tipo = 'retiro'
    and (m.pago_recibido_id is null or coalesce(p.estado, '') = 'activo')
    and (m.gasto_menor_id is null or coalesce(g.estado, '') = 'activo');

  select
    count(*)::int,
    coalesce(sum(n.total), 0),
    coalesce(sum(n.monto_reembolso_efectivo), 0)
  into v_devoluciones_cantidad, v_devoluciones_total, v_devoluciones_efectivo
  from public.notas_credito_venta n
  where n.turno_id = p_turno_id
    and n.estado = 'activa';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'numero', m.numero,
    'turno_id', m.turno_id,
    'tipo', m.tipo,
    'motivo', m.motivo,
    'monto', m.monto,
    'cuenta_contrapartida_id', m.cuenta_contrapartida_id,
    'cuenta_nombre', cc.nombre,
    'contacto_id', m.contacto_id,
    'factura_id', m.factura_id,
    'factura_numero', f.numero,
    'pago_recibido_id', m.pago_recibido_id,
    'gasto_menor_id', m.gasto_menor_id,
    'asiento_id', m.asiento_id,
    'notas', m.notas,
    'creado_en', m.creado_en,
    'creado_por', m.creado_por,
    'vigente', case
      when m.pago_recibido_id is not null and coalesce(p.estado, '') <> 'activo' then false
      when m.gasto_menor_id is not null and coalesce(g.estado, '') <> 'activo' then false
      else true
    end
  ) order by m.numero), '[]'::jsonb)
  into v_movimientos
  from public.pos_turno_movimientos m
  left join public.cuentas cc on cc.id = m.cuenta_contrapartida_id
  left join public.facturas f on f.id = m.factura_id
  left join public.pagos_recibidos p on p.id = m.pago_recibido_id
  left join public.gastos_menores g on g.id = m.gasto_menor_id
  where m.turno_id = p_turno_id;

  v_esperado := round(
    v_turno.base_inicial + v_efectivo + v_ingresos_total - v_retiros_total - v_devoluciones_efectivo,
    2
  );

  if v_turno.estado = 'cerrado' then
    v_esperado := v_turno.efectivo_esperado;
  end if;

  return jsonb_build_object(
    'ventas', jsonb_build_object(
      'total', v_ventas_total,
      'cantidad', v_ventas_cantidad,
      'cobrado', v_cobrado,
      'por_metodo', jsonb_build_object(
        'efectivo', v_efectivo,
        'tarjeta', v_tarjeta,
        'transferencia', v_transferencia,
        'credito', v_credito
      ),
      'por_cuenta', v_por_cuenta
    ),
    'ingresos', jsonb_build_object(
      'total', v_ingresos_total,
      'cantidad', v_ingresos_cantidad,
      'por_motivo', v_ingresos_motivos
    ),
    'retiros', jsonb_build_object(
      'total', v_retiros_total,
      'cantidad', v_retiros_cantidad,
      'por_motivo', v_retiros_motivos
    ),
    'devoluciones', jsonb_build_object(
      'cantidad', v_devoluciones_cantidad,
      'total', v_devoluciones_total,
      'efectivo', v_devoluciones_efectivo,
      'credito', round(v_devoluciones_total - v_devoluciones_efectivo, 2)
    ),
    'efectivo', jsonb_build_object(
      'base_inicial', v_turno.base_inicial,
      'ventas_efectivo', v_efectivo,
      'ingresos_efectivo', v_ingresos_total,
      'retiros_efectivo', v_retiros_total,
      'devoluciones_efectivo', v_devoluciones_efectivo,
      'efectivo_esperado', v_esperado,
      'efectivo_real', v_turno.efectivo_real,
      'diferencia', v_turno.diferencia,
      'congelado', v_turno.estado = 'cerrado'
    ),
    'movimientos', v_movimientos
  );
end;
$$;

revoke all on function public._pos_monto(text) from public, anon, authenticated;
revoke all on function public._pos_booleano(text, boolean) from public, anon, authenticated;
revoke all on function public._pos_empresa() from public, anon, authenticated;
revoke all on function public._pos_usuario(uuid) from public, anon, authenticated;
revoke all on function public._pos_plantilla_ticket(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public._pos_validar_cuenta_cobro(uuid, text, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public._pos_resolver_lineas(jsonb, uuid) from public, anon, authenticated;
revoke all on function public._pos_resumen(uuid) from public, anon, authenticated;
-- lo llama pos_resumen_turno (security invoker): corre con RLS del llamador.
grant execute on function public._pos_resumen(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Terminales
-- ---------------------------------------------------------------------------

create or replace function public.pos_crear_terminal(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_nombre text;
  v_almacen_id uuid;
  v_cuenta_efectivo_id uuid;
  v_cuenta_debito_id uuid;
  v_cuenta_credito_id uuid;
  v_cuenta_transferencia_id uuid;
  v_numeracion_id uuid;
  v_lista_id uuid;
  v_contacto_id uuid;
  v_centro_costo_id uuid;
  v_plantilla jsonb;
  v_activa boolean;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la terminal requeridos' using errcode = '22023';
  end if;

  v_nombre := nullif(btrim(coalesce(p->>'nombre', '')), '');
  if v_nombre is null or length(v_nombre) > 80 then
    raise exception 'el nombre de la terminal es obligatorio' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.pos_terminales t
    where lower(btrim(t.nombre)) = lower(v_nombre)
  ) then
    raise exception 'ya existe una terminal con ese nombre' using errcode = '22023';
  end if;

  v_almacen_id := nullif(p->>'almacen_id', '')::uuid;
  if v_almacen_id is null
     or not exists (select 1 from public.almacenes a where a.id = v_almacen_id and a.activo) then
    raise exception 'el almacén de la terminal no existe o está inactivo' using errcode = '22023';
  end if;

  v_cuenta_efectivo_id := nullif(p->>'cuenta_efectivo_id', '')::uuid;
  if v_cuenta_efectivo_id is null
     or not exists (
       select 1 from public.cuentas c
       where c.id = v_cuenta_efectivo_id and c.activa and c.es_caja_banco
     ) then
    raise exception 'la cuenta de efectivo debe ser una cuenta de caja o banco activa'
      using errcode = '22023';
  end if;

  v_activa := public._pos_booleano(p->>'activa', true);

  if v_activa and exists (
    select 1 from public.pos_terminales t
    where t.activa and t.cuenta_efectivo_id = v_cuenta_efectivo_id
  ) then
    raise exception 'ya existe una terminal activa con esa cuenta de efectivo' using errcode = '22023';
  end if;

  v_cuenta_debito_id := nullif(p->>'cuenta_tarjeta_debito_id', '')::uuid;
  if v_cuenta_debito_id is not null then
    perform public._pos_validar_cuenta_cobro(
      v_cuenta_debito_id, 'tarjeta de débito', v_cuenta_efectivo_id, null
    );
  end if;

  v_cuenta_credito_id := nullif(p->>'cuenta_tarjeta_credito_id', '')::uuid;
  if v_cuenta_credito_id is not null then
    perform public._pos_validar_cuenta_cobro(
      v_cuenta_credito_id, 'tarjeta de crédito', v_cuenta_efectivo_id, null
    );
  end if;

  v_cuenta_transferencia_id := nullif(p->>'cuenta_transferencia_id', '')::uuid;
  if v_cuenta_transferencia_id is not null then
    perform public._pos_validar_cuenta_cobro(
      v_cuenta_transferencia_id, 'transferencia', v_cuenta_efectivo_id, null
    );
  end if;

  v_numeracion_id := nullif(p->>'numeracion_defecto_id', '')::uuid;
  if v_numeracion_id is null
     or not exists (
       select 1 from public.numeraciones n
       where n.id = v_numeracion_id
         and n.activa
         and n.tipo_comprobante in ('01', '02', '14', '15', '16')
     ) then
    raise exception 'la numeración de la terminal no existe, está inactiva o no es de factura de venta'
      using errcode = '22023';
  end if;

  v_lista_id := nullif(p->>'lista_precio_defecto_id', '')::uuid;
  if v_lista_id is not null
     and not exists (select 1 from public.listas_precios lp where lp.id = v_lista_id and lp.activo) then
    raise exception 'la lista de precios o el centro de costo no existe o está inactivo'
      using errcode = '22023';
  end if;

  v_centro_costo_id := nullif(p->>'centro_costo_id', '')::uuid;
  if v_centro_costo_id is not null
     and not exists (select 1 from public.centros_costo cc where cc.id = v_centro_costo_id and cc.activo) then
    raise exception 'la lista de precios o el centro de costo no existe o está inactivo'
      using errcode = '22023';
  end if;

  v_contacto_id := nullif(p->>'contacto_defecto_id', '')::uuid;
  if v_contacto_id is null
     or not exists (
       select 1 from public.contactos c
       where c.id = v_contacto_id and c.activo and c.tipo in ('cliente', 'ambos')
     ) then
    raise exception 'el contacto por defecto debe ser un cliente activo' using errcode = '22023';
  end if;

  v_plantilla := public._pos_plantilla_ticket(null, p->'plantilla_ticket');

  begin
    insert into public.pos_terminales (
      nombre, almacen_id, cuenta_efectivo_id, cuenta_tarjeta_debito_id,
      cuenta_tarjeta_credito_id, cuenta_transferencia_id, numeracion_defecto_id,
      lista_precio_defecto_id, contacto_defecto_id, centro_costo_id, plantilla_ticket, activa
    )
    values (
      v_nombre, v_almacen_id, v_cuenta_efectivo_id, v_cuenta_debito_id,
      v_cuenta_credito_id, v_cuenta_transferencia_id, v_numeracion_id,
      v_lista_id, v_contacto_id, v_centro_costo_id, v_plantilla, v_activa
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'ya existe una terminal con ese nombre' using errcode = '22023';
  end;

  return v_id;
end;
$$;

create or replace function public.pos_actualizar_terminal(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_terminal public.pos_terminales%rowtype;
  v_nombre text;
  v_almacen_id uuid;
  v_cuenta_efectivo_id uuid;
  v_cuenta_debito_id uuid;
  v_cuenta_credito_id uuid;
  v_cuenta_transferencia_id uuid;
  v_numeracion_id uuid;
  v_lista_id uuid;
  v_contacto_id uuid;
  v_centro_costo_id uuid;
  v_plantilla jsonb;
  v_activa boolean;
  v_turno_abierto boolean;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_id is null then
    raise exception 'la terminal no existe' using errcode = '22023';
  end if;

  select * into v_terminal
  from public.pos_terminales t
  where t.id = p_id
  for update;

  if not found then
    raise exception 'la terminal no existe' using errcode = '22023';
  end if;

  if p is null then
    raise exception 'datos de la terminal requeridos' using errcode = '22023';
  end if;

  v_turno_abierto := exists (
    select 1 from public.pos_turnos t
    where t.terminal_id = p_id and t.estado = 'abierto'
  );

  if v_turno_abierto then
    if p ? 'activa' and not public._pos_booleano(p->>'activa', v_terminal.activa) then
      raise exception 'no se puede desactivar una terminal con un turno abierto' using errcode = '22023';
    end if;

    if (p ? 'cuenta_efectivo_id'
        and nullif(p->>'cuenta_efectivo_id', '')::uuid is distinct from v_terminal.cuenta_efectivo_id)
       or (p ? 'almacen_id'
        and nullif(p->>'almacen_id', '')::uuid is distinct from v_terminal.almacen_id)
       or (p ? 'numeracion_defecto_id'
        and nullif(p->>'numeracion_defecto_id', '')::uuid is distinct from v_terminal.numeracion_defecto_id) then
      raise exception 'cierra el turno antes de cambiar la cuenta de efectivo, el almacén o la numeración'
        using errcode = '22023';
    end if;
  end if;

  v_nombre := case
    when p ? 'nombre' then nullif(btrim(coalesce(p->>'nombre', '')), '')
    else v_terminal.nombre
  end;
  if v_nombre is null or length(v_nombre) > 80 then
    raise exception 'el nombre de la terminal es obligatorio' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.pos_terminales t
    where lower(btrim(t.nombre)) = lower(v_nombre) and t.id <> p_id
  ) then
    raise exception 'ya existe una terminal con ese nombre' using errcode = '22023';
  end if;

  v_almacen_id := case
    when p ? 'almacen_id' then nullif(p->>'almacen_id', '')::uuid
    else v_terminal.almacen_id
  end;
  if v_almacen_id is null
     or not exists (select 1 from public.almacenes a where a.id = v_almacen_id and a.activo) then
    raise exception 'el almacén de la terminal no existe o está inactivo' using errcode = '22023';
  end if;

  v_cuenta_efectivo_id := case
    when p ? 'cuenta_efectivo_id' then nullif(p->>'cuenta_efectivo_id', '')::uuid
    else v_terminal.cuenta_efectivo_id
  end;
  if v_cuenta_efectivo_id is null
     or not exists (
       select 1 from public.cuentas c
       where c.id = v_cuenta_efectivo_id and c.activa and c.es_caja_banco
     ) then
    raise exception 'la cuenta de efectivo debe ser una cuenta de caja o banco activa'
      using errcode = '22023';
  end if;

  v_activa := case
    when p ? 'activa' then public._pos_booleano(p->>'activa', v_terminal.activa)
    else v_terminal.activa
  end;

  if v_activa and exists (
    select 1 from public.pos_terminales t
    where t.activa and t.cuenta_efectivo_id = v_cuenta_efectivo_id and t.id <> p_id
  ) then
    raise exception 'ya existe una terminal activa con esa cuenta de efectivo' using errcode = '22023';
  end if;

  v_cuenta_debito_id := case
    when p ? 'cuenta_tarjeta_debito_id' then nullif(p->>'cuenta_tarjeta_debito_id', '')::uuid
    else v_terminal.cuenta_tarjeta_debito_id
  end;
  if v_cuenta_debito_id is not null then
    perform public._pos_validar_cuenta_cobro(
      v_cuenta_debito_id, 'tarjeta de débito', v_cuenta_efectivo_id, p_id
    );
  end if;

  v_cuenta_credito_id := case
    when p ? 'cuenta_tarjeta_credito_id' then nullif(p->>'cuenta_tarjeta_credito_id', '')::uuid
    else v_terminal.cuenta_tarjeta_credito_id
  end;
  if v_cuenta_credito_id is not null then
    perform public._pos_validar_cuenta_cobro(
      v_cuenta_credito_id, 'tarjeta de crédito', v_cuenta_efectivo_id, p_id
    );
  end if;

  v_cuenta_transferencia_id := case
    when p ? 'cuenta_transferencia_id' then nullif(p->>'cuenta_transferencia_id', '')::uuid
    else v_terminal.cuenta_transferencia_id
  end;
  if v_cuenta_transferencia_id is not null then
    perform public._pos_validar_cuenta_cobro(
      v_cuenta_transferencia_id, 'transferencia', v_cuenta_efectivo_id, p_id
    );
  end if;

  v_numeracion_id := case
    when p ? 'numeracion_defecto_id' then nullif(p->>'numeracion_defecto_id', '')::uuid
    else v_terminal.numeracion_defecto_id
  end;
  if v_numeracion_id is null
     or not exists (
       select 1 from public.numeraciones n
       where n.id = v_numeracion_id
         and n.activa
         and n.tipo_comprobante in ('01', '02', '14', '15', '16')
     ) then
    raise exception 'la numeración de la terminal no existe, está inactiva o no es de factura de venta'
      using errcode = '22023';
  end if;

  v_lista_id := case
    when p ? 'lista_precio_defecto_id' then nullif(p->>'lista_precio_defecto_id', '')::uuid
    else v_terminal.lista_precio_defecto_id
  end;
  if v_lista_id is not null
     and not exists (select 1 from public.listas_precios lp where lp.id = v_lista_id and lp.activo) then
    raise exception 'la lista de precios o el centro de costo no existe o está inactivo'
      using errcode = '22023';
  end if;

  v_centro_costo_id := case
    when p ? 'centro_costo_id' then nullif(p->>'centro_costo_id', '')::uuid
    else v_terminal.centro_costo_id
  end;
  if v_centro_costo_id is not null
     and not exists (select 1 from public.centros_costo cc where cc.id = v_centro_costo_id and cc.activo) then
    raise exception 'la lista de precios o el centro de costo no existe o está inactivo'
      using errcode = '22023';
  end if;

  v_contacto_id := case
    when p ? 'contacto_defecto_id' then nullif(p->>'contacto_defecto_id', '')::uuid
    else v_terminal.contacto_defecto_id
  end;
  if v_contacto_id is null
     or not exists (
       select 1 from public.contactos c
       where c.id = v_contacto_id and c.activo and c.tipo in ('cliente', 'ambos')
     ) then
    raise exception 'el contacto por defecto debe ser un cliente activo' using errcode = '22023';
  end if;

  v_plantilla := case
    when p ? 'plantilla_ticket' then public._pos_plantilla_ticket(v_terminal.plantilla_ticket, p->'plantilla_ticket')
    else v_terminal.plantilla_ticket
  end;

  begin
    update public.pos_terminales t
    set nombre = v_nombre,
        almacen_id = v_almacen_id,
        cuenta_efectivo_id = v_cuenta_efectivo_id,
        cuenta_tarjeta_debito_id = v_cuenta_debito_id,
        cuenta_tarjeta_credito_id = v_cuenta_credito_id,
        cuenta_transferencia_id = v_cuenta_transferencia_id,
        numeracion_defecto_id = v_numeracion_id,
        lista_precio_defecto_id = v_lista_id,
        contacto_defecto_id = v_contacto_id,
        centro_costo_id = v_centro_costo_id,
        plantilla_ticket = v_plantilla,
        activa = v_activa,
        actualizado_en = now()
    where t.id = p_id;
  exception when unique_violation then
    raise exception 'ya existe una terminal con ese nombre' using errcode = '22023';
  end;

  return p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Turnos
-- ---------------------------------------------------------------------------

create or replace function public.pos_abrir_turno(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_terminal public.pos_terminales%rowtype;
  v_terminal_id uuid;
  v_turno_id uuid;
  v_numero int;
  v_base numeric(14,2);
  v_observaciones text;
  v_abierto int;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del turno requeridos' using errcode = '22023';
  end if;

  v_terminal_id := nullif(p->>'terminal_id', '')::uuid;
  if v_terminal_id is null then
    raise exception 'la terminal no existe o está inactiva' using errcode = '22023';
  end if;

  select * into v_terminal
  from public.pos_terminales t
  where t.id = v_terminal_id
  for update;

  if not found or not v_terminal.activa then
    raise exception 'la terminal no existe o está inactiva' using errcode = '22023';
  end if;

  v_base := coalesce(public._pos_monto(p->>'base_inicial'), 0);
  if v_base < 0 then
    raise exception 'la base inicial no puede ser negativa' using errcode = '22023';
  end if;

  v_observaciones := nullif(btrim(coalesce(p->>'observaciones', '')), '');
  if v_observaciones is not null and length(v_observaciones) > 500 then
    raise exception 'las observaciones no pueden exceder 500 caracteres' using errcode = '22023';
  end if;

  select count(*)::int into v_abierto
  from public.pos_turnos t
  where t.terminal_id = v_terminal_id and t.estado = 'abierto';

  if v_abierto > 0 then
    select t.numero into v_numero
    from public.pos_turnos t
    where t.terminal_id = v_terminal_id and t.estado = 'abierto'
    order by t.abierto_en
    limit 1;

    raise exception 'la terminal ya tiene un turno abierto (turno No %)', v_numero
      using errcode = '22023';
  end if;

  begin
    insert into public.pos_turnos (terminal_id, abierto_por, base_inicial, observaciones)
    values (v_terminal_id, auth.uid(), v_base, v_observaciones)
    returning id, numero into v_turno_id, v_numero;
  exception when unique_violation then
    raise exception 'la terminal ya tiene un turno abierto' using errcode = '22023';
  end;

  return jsonb_build_object(
    'turno', jsonb_build_object(
      'id', v_turno_id,
      'numero', v_numero,
      'terminal_id', v_terminal_id,
      'abierto_por', auth.uid(),
      'abierto_en', (select t.abierto_en from public.pos_turnos t where t.id = v_turno_id),
      'base_inicial', v_base,
      'estado', 'abierto'
    ),
    'terminal', jsonb_build_object(
      'id', v_terminal.id,
      'nombre', v_terminal.nombre,
      'almacen_id', v_terminal.almacen_id,
      'cuenta_efectivo_id', v_terminal.cuenta_efectivo_id
    ),
    'empresa', public._pos_empresa(),
    'resumen', public._pos_resumen(v_turno_id)
  );
end;
$$;

create or replace function public.pos_registrar_movimiento_turno(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_turno public.pos_turnos%rowtype;
  v_terminal public.pos_terminales%rowtype;
  v_turno_id uuid;
  v_terminal_id uuid;
  v_tipo text;
  v_motivo text;
  v_monto numeric(14,2);
  v_notas text;
  v_esperado numeric(14,2);
  v_movimiento_id uuid;
  v_numero int;
  v_asiento_id uuid;
  v_cuenta_contrapartida_id uuid;
  v_contacto_id uuid;
  v_cuenta public.cuentas%rowtype;
  v_factura public.facturas%rowtype;
  v_factura_id uuid;
  v_saldo numeric(14,2);
  v_pago_id uuid;
  v_pago_numero int;
  v_pago_asiento_id uuid;
  v_cuenta_gasto_id uuid;
  v_cuenta_gasto public.cuentas%rowtype;
  v_descripcion text;
  v_subtotal numeric(14,2);
  v_itbis_tasa numeric(5,2);
  v_gasto_id uuid;
  v_gasto_asiento_id uuid;
  v_lineas jsonb;
  v_descripcion_asiento text;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del movimiento requeridos' using errcode = '22023';
  end if;

  v_turno_id := nullif(p->>'turno_id', '')::uuid;
  if v_turno_id is null then
    raise exception 'el turno no existe' using errcode = '22023';
  end if;

  select t.terminal_id into v_terminal_id
  from public.pos_turnos t
  where t.id = v_turno_id;

  if v_terminal_id is null then
    raise exception 'el turno no existe' using errcode = '22023';
  end if;

  select * into v_terminal
  from public.pos_terminales t
  where t.id = v_terminal_id
  for share;

  select * into v_turno
  from public.pos_turnos t
  where t.id = v_turno_id
  for update;

  if not found then
    raise exception 'el turno no existe' using errcode = '22023';
  end if;
  if v_turno.estado <> 'abierto' then
    raise exception 'el turno ya está cerrado' using errcode = '22023';
  end if;

  v_tipo := nullif(btrim(coalesce(p->>'tipo', '')), '');
  v_motivo := nullif(btrim(coalesce(p->>'motivo', '')), '');

  if v_motivo is null
     or v_motivo not in ('fondo_caja', 'cobro_factura', 'retiro_caja', 'gasto_menor', 'deposito_banco', 'otro')
     or v_tipo is null
     or v_tipo not in ('ingreso', 'retiro') then
    raise exception 'el motivo del movimiento no corresponde al tipo' using errcode = '22023';
  end if;

  if v_motivo in ('fondo_caja', 'cobro_factura') and v_tipo <> 'ingreso' then
    raise exception 'el motivo del movimiento no corresponde al tipo' using errcode = '22023';
  end if;
  if v_motivo in ('retiro_caja', 'gasto_menor', 'deposito_banco') and v_tipo <> 'retiro' then
    raise exception 'el motivo del movimiento no corresponde al tipo' using errcode = '22023';
  end if;

  v_monto := public._pos_monto(p->>'monto');
  if v_monto is null or v_monto <= 0 then
    raise exception 'el monto del movimiento debe ser mayor a cero' using errcode = '22023';
  end if;

  v_notas := nullif(btrim(coalesce(p->>'notas', '')), '');
  if v_notas is not null and length(v_notas) > 500 then
    raise exception 'las notas no pueden exceder 500 caracteres' using errcode = '22023';
  end if;

  v_esperado := (public._pos_resumen(v_turno_id)->'efectivo'->>'efectivo_esperado')::numeric;

  v_movimiento_id := gen_random_uuid();
  v_numero := nextval('public.pos_turno_movimientos_numero_seq');

  if v_motivo = 'cobro_factura' then
    v_factura_id := nullif(p->>'factura_id', '')::uuid;
    if v_factura_id is null then
      raise exception 'la factura no existe o está anulada' using errcode = '22023';
    end if;

    select * into v_factura
    from public.facturas f
    where f.id = v_factura_id
    for update;

    if not found or v_factura.estado = 'anulada' then
      raise exception 'la factura no existe o está anulada' using errcode = '22023';
    end if;

    v_saldo := round(v_factura.total - v_factura.pagado - v_factura.retenido - v_factura.credito, 2);
    if v_saldo <= 0 then
      raise exception 'la factura no tiene saldo pendiente' using errcode = '22023';
    end if;
    if v_monto > v_saldo then
      raise exception 'el monto del cobro excede el saldo de la factura' using errcode = '22023';
    end if;

    v_pago_id := public.registrar_pago_recibido(jsonb_build_object(
      'factura_id', v_factura_id,
      'contacto_id', v_factura.contacto_id,
      'fecha', current_date,
      'cuenta_id', v_terminal.cuenta_efectivo_id,
      'metodo', 'efectivo',
      'monto', v_monto,
      'notas', v_notas
    ));

    update public.pagos_recibidos p
    set turno_id = v_turno_id
    where p.id = v_pago_id
    returning p.numero, p.asiento_id into v_pago_numero, v_pago_asiento_id;

    select coalesce(c.cuenta_cxc_id, public._cuenta_config('cxc'))
    into v_cuenta_contrapartida_id
    from public.contactos c
    where c.id = v_factura.contacto_id;

    v_cuenta_contrapartida_id := coalesce(
      v_cuenta_contrapartida_id,
      public._cuenta_config('cxc')
    );
    v_contacto_id := v_factura.contacto_id;
    v_asiento_id := v_pago_asiento_id;
    v_descripcion_asiento := 'Cobro de factura ' || v_factura.numero::text;

    insert into public.pos_turno_movimientos (
      id, numero, turno_id, tipo, motivo, monto, cuenta_contrapartida_id, contacto_id,
      factura_id, asiento_id, pago_recibido_id, gasto_menor_id, notas, creado_por
    )
    values (
      v_movimiento_id, v_numero, v_turno_id, 'ingreso', 'cobro_factura', v_monto,
      v_cuenta_contrapartida_id, v_contacto_id, v_factura_id, v_asiento_id, v_pago_id,
      null, v_notas, auth.uid()
    );

  elsif v_motivo = 'gasto_menor' then
    v_cuenta_gasto_id := nullif(p->>'cuenta_gasto_id', '')::uuid;
    if v_cuenta_gasto_id is null then
      raise exception 'la cuenta de gasto no existe, está inactiva o no es de gasto'
        using errcode = '22023';
    end if;

    select * into v_cuenta_gasto
    from public.cuentas c
    where c.id = v_cuenta_gasto_id;

    if not found
       or not v_cuenta_gasto.activa
       or not v_cuenta_gasto.acepta_movimientos
       or v_cuenta_gasto.tipo not in ('gasto', 'costo') then
      raise exception 'la cuenta de gasto no existe, está inactiva o no es de gasto'
        using errcode = '22023';
    end if;

    v_descripcion := nullif(btrim(coalesce(p->>'descripcion', '')), '');
    if v_descripcion is null then
      raise exception 'la descripción del gasto es obligatoria' using errcode = '22023';
    end if;

    v_subtotal := coalesce(public._pos_monto(p->>'subtotal'), v_monto);
    v_itbis_tasa := coalesce(public._pos_monto(p->>'itbis_tasa'), 0);

    if v_itbis_tasa < 0 or v_itbis_tasa > 100 then
      raise exception 'la tasa de ITBIS es inválida' using errcode = '22023';
    end if;

    if round(v_subtotal + round(v_subtotal * v_itbis_tasa / 100, 2), 2) <> v_monto then
      raise exception 'el ITBIS del gasto no cuadra con el monto' using errcode = '22023';
    end if;

    if v_monto > v_esperado then
      raise exception 'el retiro deja la caja en negativo' using errcode = '22023';
    end if;

    v_contacto_id := nullif(p->>'contacto_id', '')::uuid;

    v_gasto_id := public.crear_gasto_menor(jsonb_build_object(
      'fecha', current_date,
      'descripcion', v_descripcion,
      'subtotal', v_subtotal,
      'itbis_tasa', v_itbis_tasa,
      'cuenta_gasto_id', v_cuenta_gasto_id,
      'cuenta_pago_id', v_terminal.cuenta_efectivo_id,
      'contacto_id', v_contacto_id
    ));

    select g.asiento_id into v_gasto_asiento_id
    from public.gastos_menores g
    where g.id = v_gasto_id;

    v_cuenta_contrapartida_id := v_cuenta_gasto_id;
    v_asiento_id := v_gasto_asiento_id;
    v_descripcion_asiento := v_descripcion;

    insert into public.pos_turno_movimientos (
      id, numero, turno_id, tipo, motivo, monto, cuenta_contrapartida_id, contacto_id,
      factura_id, asiento_id, pago_recibido_id, gasto_menor_id, notas, creado_por
    )
    values (
      v_movimiento_id, v_numero, v_turno_id, 'retiro', 'gasto_menor', v_monto,
      v_cuenta_contrapartida_id, v_contacto_id, null, v_asiento_id, null, v_gasto_id,
      v_notas, auth.uid()
    );

  else
    v_cuenta_contrapartida_id := nullif(p->>'cuenta_contrapartida_id', '')::uuid;

    select * into v_cuenta
    from public.cuentas c
    where c.id = v_cuenta_contrapartida_id;

    if v_cuenta_contrapartida_id is null
       or not found
       or not v_cuenta.activa
       or not v_cuenta.acepta_movimientos then
      raise exception 'la cuenta de contrapartida no existe, está inactiva o no acepta movimientos'
        using errcode = '22023';
    end if;

    if v_cuenta_contrapartida_id = v_terminal.cuenta_efectivo_id then
      raise exception 'la cuenta de contrapartida debe ser distinta de la cuenta de efectivo'
        using errcode = '22023';
    end if;

    if v_motivo = 'deposito_banco' and not v_cuenta.es_caja_banco then
      raise exception 'para depositar al banco, la cuenta de destino debe ser de caja o banco'
        using errcode = '22023';
    end if;

    if v_tipo = 'retiro' and v_monto > v_esperado then
      raise exception 'el retiro deja la caja en negativo' using errcode = '22023';
    end if;

    v_contacto_id := nullif(p->>'contacto_id', '')::uuid;

    if v_tipo = 'ingreso' then
      v_lineas := jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', v_terminal.cuenta_efectivo_id,
          'debito', v_monto,
          'credito', 0,
          'centro_costo_id', v_terminal.centro_costo_id,
          'descripcion', 'Ingreso de caja ' || v_numero::text
        ),
        jsonb_build_object(
          'cuenta_id', v_cuenta_contrapartida_id,
          'debito', 0,
          'credito', v_monto,
          'contacto_id', v_contacto_id,
          'centro_costo_id', v_terminal.centro_costo_id,
          'descripcion', 'Ingreso de caja ' || v_numero::text
        )
      );
    else
      v_lineas := jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', v_cuenta_contrapartida_id,
          'debito', v_monto,
          'credito', 0,
          'contacto_id', v_contacto_id,
          'centro_costo_id', v_terminal.centro_costo_id,
          'descripcion', 'Retiro de caja ' || v_numero::text
        ),
        jsonb_build_object(
          'cuenta_id', v_terminal.cuenta_efectivo_id,
          'debito', 0,
          'credito', v_monto,
          'centro_costo_id', v_terminal.centro_costo_id,
          'descripcion', 'Retiro de caja ' || v_numero::text
        )
      );
    end if;

    v_descripcion_asiento := 'Movimiento de caja ' || v_numero::text || ' · ' || v_motivo;

    v_asiento_id := public._crear_asiento(
      current_date,
      v_descripcion_asiento,
      'pos_movimiento',
      v_movimiento_id,
      v_lineas
    );

    insert into public.pos_turno_movimientos (
      id, numero, turno_id, tipo, motivo, monto, cuenta_contrapartida_id, contacto_id,
      factura_id, asiento_id, pago_recibido_id, gasto_menor_id, notas, creado_por
    )
    values (
      v_movimiento_id, v_numero, v_turno_id, v_tipo, v_motivo, v_monto,
      v_cuenta_contrapartida_id, v_contacto_id, null, v_asiento_id, null, null,
      v_notas, auth.uid()
    );
  end if;

  return jsonb_build_object(
    'movimiento', jsonb_build_object(
      'id', v_movimiento_id,
      'numero', v_numero,
      'turno_id', v_turno_id,
      'tipo', v_tipo,
      'motivo', v_motivo,
      'monto', v_monto,
      'cuenta_contrapartida_id', v_cuenta_contrapartida_id,
      'cuenta_nombre', (select c.nombre from public.cuentas c where c.id = v_cuenta_contrapartida_id),
      'contacto_id', v_contacto_id,
      'factura_id', v_factura_id,
      'factura_numero', v_factura.numero,
      'factura_ncf', v_factura.ncf,
      'pago_recibido_id', v_pago_id,
      'gasto_menor_id', v_gasto_id,
      'asiento_id', v_asiento_id,
      'notas', v_notas,
      'creado_en', (select m.creado_en from public.pos_turno_movimientos m where m.id = v_movimiento_id),
      'creado_por', auth.uid(),
      'cajero', public._pos_usuario(auth.uid())
    ),
    'turno', jsonb_build_object(
      'id', v_turno.id,
      'numero', v_turno.numero,
      'estado', v_turno.estado,
      'base_inicial', v_turno.base_inicial
    ),
    'terminal', jsonb_build_object(
      'id', v_terminal.id,
      'nombre', v_terminal.nombre,
      'plantilla_ticket', v_terminal.plantilla_ticket
    ),
    'empresa', public._pos_empresa(),
    'asiento', (
      select jsonb_build_object(
        'id', a.id, 'numero', a.numero, 'fecha', a.fecha,
        'descripcion', a.descripcion, 'total', a.total
      )
      from public.asientos a
      where a.id = v_asiento_id
    ),
    'plantilla_ticket', v_terminal.plantilla_ticket,
    'resumen', public._pos_resumen(v_turno_id)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Venta
-- ---------------------------------------------------------------------------

create or replace function public.pos_completar_venta(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_terminal public.pos_terminales%rowtype;
  v_terminal_id uuid;
  v_turno public.pos_turnos%rowtype;
  v_turno_id uuid;
  v_fuentes int := 0;
  v_cotizacion public.cotizaciones%rowtype;
  v_cotizacion_id uuid;
  v_contacto public.contactos%rowtype;
  v_contacto_id uuid;
  v_contacto_payload uuid;
  v_lista_id uuid;
  v_numeracion public.numeraciones%rowtype;
  v_numeracion_id uuid;
  v_tipo text;
  v_fecha date;
  v_vencimiento date;
  v_vendedor_id uuid;
  v_centro_costo_id uuid;
  v_notas text;
  v_terminos text;
  v_pie text;
  v_lineas_in jsonb;
  v_lineas jsonb;
  v_simple jsonb;
  v_descripcion_simple text;
  v_monto_simple numeric(14,2);
  v_factura_id uuid;
  v_factura public.facturas%rowtype;
  v_pagos_in jsonb;
  v_pago jsonb;
  v_pagos_norm jsonb := '[]'::jsonb;
  v_pagos_json jsonb := '[]'::jsonb;
  v_metodo_pos text;
  v_metodo_db text;
  v_monto numeric(14,2);
  v_recibido numeric(14,2);
  v_cuenta_pago uuid;
  v_cuenta_nombre text;
  v_total_aplicado numeric(14,2) := 0;
  v_efectivo_recibido numeric(14,2) := 0;
  v_efectivo_aplicado numeric(14,2) := 0;
  v_cambio numeric(14,2) := 0;
  v_nuevo_saldo numeric(14,2);
  v_saldo_actual numeric(14,2);
  v_pago_id uuid;
  v_pago_numero int;
  v_pago_estado text;
  v_cambio_asignado boolean := false;
  v_lineas_json jsonb := '[]'::jsonb;
  v_impuestos jsonb := '[]'::jsonb;
  v_totales jsonb;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la venta requeridos' using errcode = '22023';
  end if;

  v_terminal_id := nullif(p->>'terminal_id', '')::uuid;
  if v_terminal_id is null then
    raise exception 'la terminal no existe o está inactiva' using errcode = '22023';
  end if;

  -- 1. Terminal y turno (orden de bloqueo: terminal → turno → motor).
  select * into v_terminal
  from public.pos_terminales t
  where t.id = v_terminal_id
  for share;

  if not found or not v_terminal.activa then
    raise exception 'la terminal no existe o está inactiva' using errcode = '22023';
  end if;

  v_turno_id := nullif(p->>'turno_id', '')::uuid;
  if v_turno_id is not null then
    select * into v_turno
    from public.pos_turnos t
    where t.id = v_turno_id and t.terminal_id = v_terminal_id
    for update;

    if not found then
      raise exception 'el turno no pertenece a la terminal' using errcode = '22023';
    end if;
    if v_turno.estado <> 'abierto' then
      raise exception 'el turno ya está cerrado' using errcode = '22023';
    end if;
  else
    select * into v_turno
    from public.pos_turnos t
    where t.terminal_id = v_terminal_id and t.estado = 'abierto'
    order by t.abierto_en
    limit 1
    for update;

    if not found then
      raise exception 'no hay un turno abierto en la terminal %', v_terminal.nombre
        using errcode = '22023';
    end if;
    v_turno_id := v_turno.id;
  end if;

  -- 2. Fuente de la venta: líneas, venta simple o cotización (exactamente una).
  if p ? 'lineas' and jsonb_typeof(p->'lineas') = 'array' and jsonb_array_length(p->'lineas') > 0 then
    v_fuentes := v_fuentes + 1;
  end if;
  if p ? 'venta_simple' and jsonb_typeof(p->'venta_simple') = 'object' then
    v_fuentes := v_fuentes + 1;
  end if;
  if nullif(p->>'cotizacion_id', '') is not null then
    v_fuentes := v_fuentes + 1;
  end if;

  if v_fuentes <> 1 then
    raise exception 'indica líneas, venta simple o una cotización, no varias a la vez'
      using errcode = '22023';
  end if;

  -- 3. Contacto, lista, numeración, fechas y vendedor.
  v_contacto_payload := nullif(p->>'contacto_id', '')::uuid;
  v_cotizacion_id := nullif(p->>'cotizacion_id', '')::uuid;

  if v_cotizacion_id is not null then
    select * into v_cotizacion
    from public.cotizaciones c
    where c.id = v_cotizacion_id
    for update;

    if not found or v_cotizacion.estado <> 'abierta' then
      raise exception 'la cotización no existe o no está abierta' using errcode = '22023';
    end if;

    if v_contacto_payload is not null and v_contacto_payload <> v_cotizacion.contacto_id then
      raise exception 'la cotización pertenece a otro contacto' using errcode = '22023';
    end if;

    v_contacto_id := v_cotizacion.contacto_id;
    v_vendedor_id := coalesce(nullif(p->>'vendedor_id', '')::uuid, v_cotizacion.vendedor_id);
    v_centro_costo_id := v_cotizacion.centro_costo_id;
  else
    v_contacto_id := coalesce(v_contacto_payload, v_terminal.contacto_defecto_id);
    v_vendedor_id := nullif(p->>'vendedor_id', '')::uuid;
    v_centro_costo_id := v_terminal.centro_costo_id;
  end if;

  select * into v_contacto
  from public.contactos c
  where c.id = v_contacto_id and c.activo;

  if not found then
    raise exception 'el contacto no existe o está inactivo' using errcode = '22023';
  end if;

  v_lista_id := coalesce(nullif(p->>'lista_precio_id', '')::uuid, v_terminal.lista_precio_defecto_id);
  if v_lista_id is not null
     and not exists (select 1 from public.listas_precios lp where lp.id = v_lista_id and lp.activo) then
    raise exception 'la lista de precios o el centro de costo no existe o está inactivo'
      using errcode = '22023';
  end if;

  v_numeracion_id := nullif(p->>'numeracion_id', '')::uuid;
  if v_numeracion_id is not null then
    select * into v_numeracion
    from public.numeraciones n
    where n.id = v_numeracion_id;

    if not found
       or not v_numeracion.activa
       or v_numeracion.tipo_comprobante not in ('01', '02', '14', '15', '16') then
      raise exception 'la numeración de la terminal no existe, está inactiva o no es de factura de venta'
        using errcode = '22023';
    end if;
    v_tipo := v_numeracion.tipo_comprobante;
  else
    v_tipo := nullif(btrim(coalesce(p->>'tipo_comprobante', '')), '');

    if v_tipo is not null then
      if v_tipo not in ('01', '02', '14', '15', '16') then
        raise exception 'tipo de comprobante inválido' using errcode = '22023';
      end if;
    else
      select n.tipo_comprobante into v_tipo
      from public.numeraciones n
      where n.id = v_terminal.numeracion_defecto_id;

      if v_tipo is null then
        raise exception 'la numeración de la terminal no existe, está inactiva o no es de factura de venta'
          using errcode = '22023';
      end if;
    end if;
  end if;

  if v_vendedor_id is not null
     and not exists (select 1 from public.vendedores v where v.id = v_vendedor_id and v.activo) then
    raise exception 'vendedor no encontrado o inactivo' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_vencimiento := coalesce((p->>'vencimiento')::date, v_fecha);
  if v_vencimiento < v_fecha then
    raise exception 'el vencimiento no puede ser anterior a la fecha' using errcode = '22023';
  end if;

  -- 4. Líneas resueltas.
  if v_cotizacion_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'producto_id', cl.producto_id,
      'descripcion', cl.descripcion,
      'cantidad', cl.cantidad,
      'unidad_id', cl.unidad_id,
      'precio', cl.precio,
      'descuento_pct', cl.descuento_pct,
      'itbis_tasa', cl.itbis_tasa,
      'impuesto_id', cl.impuesto_id
    ) order by cl.id), '[]'::jsonb)
    into v_lineas
    from public.cotizacion_lineas cl
    where cl.cotizacion_id = v_cotizacion_id;

    if jsonb_array_length(v_lineas) = 0 then
      raise exception 'la cotización no tiene líneas' using errcode = '22023';
    end if;
  elsif p ? 'venta_simple' and jsonb_typeof(p->'venta_simple') = 'object' then
    v_simple := p->'venta_simple';
    v_descripcion_simple := nullif(btrim(coalesce(v_simple->>'descripcion', '')), '');
    v_monto_simple := public._pos_monto(v_simple->>'monto');

    if v_descripcion_simple is null or v_monto_simple is null or v_monto_simple <= 0 then
      raise exception 'la venta simple requiere una descripción y un monto mayor a cero'
        using errcode = '22023';
    end if;

    v_lineas := public._pos_resolver_lineas(jsonb_build_array(jsonb_build_object(
      'descripcion', v_descripcion_simple,
      'cantidad', 1,
      'precio', v_monto_simple,
      'descuento_pct', 0,
      'itbis_tasa', coalesce(public._pos_monto(v_simple->>'itbis_tasa'), 0)
    )), v_lista_id);
  else
    v_lineas_in := p->'lineas';
    v_lineas := public._pos_resolver_lineas(v_lineas_in, v_lista_id);
  end if;

  -- 5. Factura real: NCF, ITBIS, inventario y asiento (sin pago todavía).
  v_notas := case
    when p ? 'notas' then nullif(btrim(coalesce(p->>'notas', '')), '')
    when v_cotizacion_id is not null then v_cotizacion.notas
    else null
  end;
  v_terminos := case
    when p ? 'terminos' then nullif(btrim(coalesce(p->>'terminos', '')), '')
    when v_cotizacion_id is not null then v_cotizacion.terminos
    else null
  end;
  v_pie := case
    when p ? 'pie' then nullif(btrim(coalesce(p->>'pie', '')), '')
    else null
  end;

  v_factura_id := public.crear_factura(jsonb_build_object(
    'tipo_comprobante', v_tipo,
    'contacto_id', v_contacto_id,
    'fecha', v_fecha,
    'vencimiento', v_vencimiento,
    'notas', v_notas,
    'terminos', v_terminos,
    'pie', v_pie,
    'vendedor_id', v_vendedor_id,
    'centro_costo_id', v_centro_costo_id,
    'almacen_id', v_terminal.almacen_id,
    'lineas', v_lineas
  ));

  select * into v_factura
  from public.facturas f
  where f.id = v_factura_id;

  -- 6. Pagos: validación, cambio solo sobre efectivo y crédito.
  v_pagos_in := coalesce(p->'pagos', '[]'::jsonb);
  if jsonb_typeof(v_pagos_in) <> 'array' then
    raise exception 'los pagos deben venir en una lista' using errcode = '22023';
  end if;

  for v_pago in select * from jsonb_array_elements(v_pagos_in) loop
    v_metodo_pos := nullif(btrim(coalesce(v_pago->>'metodo', '')), '');
    if v_metodo_pos is null
       or v_metodo_pos not in ('efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia') then
      raise exception 'el método de pago no es válido' using errcode = '22023';
    end if;

    v_metodo_db := case
      when v_metodo_pos = 'efectivo' then 'efectivo'
      when v_metodo_pos = 'transferencia' then 'transferencia'
      else 'tarjeta'
    end;

    v_monto := public._pos_monto(v_pago->>'monto');
    if v_monto is null or v_monto <= 0 then
      raise exception 'el monto del pago debe ser mayor a cero' using errcode = '22023';
    end if;

    v_cuenta_pago := nullif(v_pago->>'cuenta_id', '')::uuid;
    if v_cuenta_pago is null then
      v_cuenta_pago := case v_metodo_pos
        when 'efectivo' then v_terminal.cuenta_efectivo_id
        when 'tarjeta_debito' then v_terminal.cuenta_tarjeta_debito_id
        when 'tarjeta_credito' then v_terminal.cuenta_tarjeta_credito_id
        else v_terminal.cuenta_transferencia_id
      end;

      if v_cuenta_pago is null then
        raise exception 'la terminal no tiene una cuenta configurada para %',
          replace(v_metodo_pos, '_', ' ') using errcode = '22023';
      end if;
    end if;

    if not exists (
      select 1 from public.cuentas c
      where c.id = v_cuenta_pago and c.activa and c.es_caja_banco
    ) then
      raise exception 'la cuenta de % debe ser una cuenta de caja o banco activa',
        replace(v_metodo_pos, '_', ' ') using errcode = '22023';
    end if;

    if v_metodo_pos = 'efectivo' then
      if v_cuenta_pago <> v_terminal.cuenta_efectivo_id then
        raise exception 'el efectivo solo puede ir a la cuenta de efectivo de la terminal'
          using errcode = '22023';
      end if;

      v_recibido := coalesce(public._pos_monto(v_pago->>'monto_recibido'), v_monto);
      if v_recibido < v_monto then
        raise exception 'el monto recibido en efectivo no puede ser menor al monto del pago'
          using errcode = '22023';
      end if;

      v_efectivo_recibido := round(v_efectivo_recibido + v_recibido, 2);
      v_efectivo_aplicado := round(v_efectivo_aplicado + v_monto, 2);
    else
      if v_cuenta_pago = v_terminal.cuenta_efectivo_id or exists (
        select 1 from public.pos_terminales t
        where t.activa and t.cuenta_efectivo_id = v_cuenta_pago
      ) then
        raise exception 'una tarjeta o transferencia no puede acreditarse a un cajón de efectivo'
          using errcode = '22023';
      end if;

      if v_pago ? 'monto_recibido'
         and jsonb_typeof(v_pago->'monto_recibido') <> 'null'
         and public._pos_monto(v_pago->>'monto_recibido') is distinct from v_monto then
        raise exception 'solo el efectivo admite monto recibido y cambio' using errcode = '22023';
      end if;

      v_recibido := null;
    end if;

    v_total_aplicado := round(v_total_aplicado + v_monto, 2);

    v_pagos_norm := v_pagos_norm || jsonb_build_array(jsonb_build_object(
      'metodo_pos', v_metodo_pos,
      'metodo_db', v_metodo_db,
      'monto', v_monto,
      'cuenta_id', v_cuenta_pago,
      'monto_recibido', v_recibido
    ));
  end loop;

  if v_total_aplicado > v_factura.total then
    raise exception 'la suma de los pagos no puede exceder el total de la venta'
      using errcode = '22023';
  end if;

  v_nuevo_saldo := round(v_factura.total - v_total_aplicado, 2);
  v_cambio := round(v_efectivo_recibido - v_efectivo_aplicado, 2);

  if v_nuevo_saldo > 0 and v_cambio > 0 then
    raise exception 'no se puede dar cambio en una venta que queda a crédito' using errcode = '22023';
  end if;

  if v_nuevo_saldo > 0 then
    if v_contacto.id = v_terminal.contacto_defecto_id then
      raise exception 'no se puede vender a crédito al Consumidor Final; selecciona un cliente o cobra el total'
        using errcode = '22023';
    end if;

    select * into v_contacto
    from public.contactos c
    where c.id = v_contacto_id
    for update;

    -- La factura recién creada ya está en la tabla: se excluye del saldo previo.
    select coalesce(sum(round(f.total - f.pagado - f.retenido - f.credito, 2)), 0)
    into v_saldo_actual
    from public.facturas f
    where f.contacto_id = v_contacto_id
      and f.id <> v_factura_id
      and f.estado <> 'anulada'
      and round(f.total - f.pagado - f.retenido - f.credito, 2) > 0;

    if v_contacto.limite_credito is not null
       and round(v_saldo_actual + v_nuevo_saldo, 2) > v_contacto.limite_credito then
      raise exception 'la venta a crédito excede el límite del contacto (límite %, saldo actual %, saldo nuevo %)',
        v_contacto.limite_credito, v_saldo_actual, v_nuevo_saldo using errcode = '22023';
    end if;
  end if;

  -- 7. Un recibo por método, ligado al turno.
  for v_pago in select * from jsonb_array_elements(v_pagos_norm) loop
    v_metodo_pos := v_pago->>'metodo_pos';
    v_cuenta_pago := (v_pago->>'cuenta_id')::uuid;
    v_monto := (v_pago->>'monto')::numeric;

    v_pago_id := public.registrar_pago_recibido(jsonb_build_object(
      'factura_id', v_factura_id,
      'contacto_id', v_contacto_id,
      'fecha', v_fecha,
      'cuenta_id', v_cuenta_pago,
      'metodo', v_pago->>'metodo_db',
      'monto', v_monto
    ));

    update public.pagos_recibidos p
    set turno_id = v_turno_id
    where p.id = v_pago_id
    returning p.numero, p.estado into v_pago_numero, v_pago_estado;

    select c.nombre into v_cuenta_nombre
    from public.cuentas c
    where c.id = v_cuenta_pago;

    v_pagos_json := v_pagos_json || jsonb_build_array(jsonb_build_object(
      'id', v_pago_id,
      'numero', v_pago_numero,
      'fecha', v_fecha,
      'metodo', v_pago->>'metodo_db',
      'metodo_pos', v_metodo_pos,
      'cuenta_id', v_cuenta_pago,
      'cuenta_nombre', v_cuenta_nombre,
      'monto', v_monto,
      'monto_recibido', coalesce((v_pago->>'monto_recibido')::numeric, v_monto),
      'cambio', case
        when v_metodo_pos = 'efectivo' and not v_cambio_asignado then v_cambio
        else 0
      end,
      'estado', v_pago_estado
    ));

    if v_metodo_pos = 'efectivo' then
      v_cambio_asignado := true;
    end if;
  end loop;

  -- 8. Trazabilidad POS en la factura.
  update public.facturas f
  set origen = 'pos',
      turno_id = v_turno_id,
      monto_recibido = round(v_efectivo_recibido, 2),
      cambio = round(v_cambio, 2)
  where f.id = v_factura_id;

  if v_cotizacion_id is not null then
    update public.cotizaciones c
    set estado = 'convertida',
        factura_id = v_factura_id
    where c.id = v_cotizacion_id;
  end if;

  select * into v_factura
  from public.facturas f
  where f.id = v_factura_id;

  -- 9. Payload completo para imprimir.
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', fl.id,
    'producto_id', fl.producto_id,
    'producto_nombre', pr.nombre,
    'referencia', pr.referencia,
    'descripcion', fl.descripcion,
    'cantidad', fl.cantidad,
    'unidad_id', fl.unidad_id,
    'unidad_nombre', fl.unidad_nombre,
    'factor_base', fl.factor_base,
    'precio', fl.precio,
    'descuento_pct', fl.descuento_pct,
    'itbis_tasa', fl.itbis_tasa,
    'impuesto_id', fl.impuesto_id,
    'subtotal', fl.subtotal,
    'itbis', fl.itbis,
    'total', fl.total,
    'costo_unitario', fl.costo_unitario
  ) order by fl.id), '[]'::jsonb)
  into v_lineas_json
  from public.factura_lineas fl
  left join public.productos pr on pr.id = fl.producto_id
  where fl.factura_id = v_factura_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'codigo', i.codigo,
    'nombre', i.nombre,
    'tipo', i.tipo,
    'tarifa', i.tarifa,
    'cuenta_id', i.cuenta_id,
    'activo', i.activo,
    'orden', i.orden
  ) order by i.orden), '[]'::jsonb)
  into v_impuestos
  from public.impuestos i
  where i.id in (
    select fl.impuesto_id
    from public.factura_lineas fl
    where fl.factura_id = v_factura_id and fl.impuesto_id is not null
  );

  v_totales := jsonb_build_object(
    'subtotal', v_factura.subtotal,
    'descuento', v_factura.descuento,
    'itbis', v_factura.itbis,
    'otros_impuestos', v_factura.otros_impuestos,
    'propina', v_factura.propina,
    'total', v_factura.total,
    'pagado', v_factura.pagado,
    'retenido', v_factura.retenido,
    'credito', v_factura.credito,
    'saldo', round(v_factura.total - v_factura.pagado - v_factura.retenido - v_factura.credito, 2),
    'monto_recibido', v_factura.monto_recibido,
    'cambio', v_factura.cambio
  );

  return jsonb_build_object(
    'factura', jsonb_build_object(
      'id', v_factura.id,
      'numero', v_factura.numero,
      'ncf', v_factura.ncf,
      'tipo_comprobante', v_factura.tipo_comprobante,
      'fecha', v_factura.fecha,
      'vencimiento', v_factura.vencimiento,
      'estado', v_factura.estado,
      'subtotal', v_factura.subtotal,
      'descuento', v_factura.descuento,
      'itbis', v_factura.itbis,
      'otros_impuestos', v_factura.otros_impuestos,
      'propina', v_factura.propina,
      'total', v_factura.total,
      'pagado', v_factura.pagado,
      'retenido', v_factura.retenido,
      'credito', v_factura.credito,
      'saldo', round(v_factura.total - v_factura.pagado - v_factura.retenido - v_factura.credito, 2),
      'monto_recibido', v_factura.monto_recibido,
      'cambio', v_factura.cambio,
      'notas', v_factura.notas,
      'terminos', v_factura.terminos,
      'pie', v_factura.pie,
      'origen', v_factura.origen,
      'turno_id', v_factura.turno_id,
      'almacen_id', v_factura.almacen_id,
      'vendedor_id', v_factura.vendedor_id,
      'centro_costo_id', v_factura.centro_costo_id,
      'asiento_id', v_factura.asiento_id
    ),
    'contacto', to_jsonb(v_contacto),
    'empresa', public._pos_empresa(),
    'terminal', jsonb_build_object(
      'id', v_terminal.id,
      'nombre', v_terminal.nombre,
      'plantilla_ticket', v_terminal.plantilla_ticket
    ),
    'turno', jsonb_build_object(
      'id', v_turno.id,
      'numero', v_turno.numero,
      'abierto_en', v_turno.abierto_en,
      'base_inicial', v_turno.base_inicial,
      'efectivo_esperado_actual',
        (public._pos_resumen(v_turno_id)->'efectivo'->>'efectivo_esperado')::numeric
    ),
    'cajero', public._pos_usuario(auth.uid()),
    'vendedor', (
      select jsonb_build_object('id', v.id, 'nombre', v.nombre)
      from public.vendedores v
      where v.id = v_factura.vendedor_id
    ),
    'almacen', (
      select jsonb_build_object('id', a.id, 'nombre', a.nombre)
      from public.almacenes a
      where a.id = v_factura.almacen_id
    ),
    'lista_precio', (
      select jsonb_build_object('id', lp.id, 'nombre', lp.nombre)
      from public.listas_precios lp
      where lp.id = v_lista_id
    ),
    'lineas', v_lineas_json,
    'pagos', v_pagos_json,
    'impuestos', v_impuestos,
    'totales', v_totales,
    'ncf_vence', (
      select n.vence
      from public.numeraciones n
      where v_factura.ncf like n.prefijo || '%'
      order by length(n.prefijo) desc
      limit 1
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Cotización rápida
-- ---------------------------------------------------------------------------

create or replace function public.pos_crear_cotizacion(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_terminal public.pos_terminales%rowtype;
  v_terminal_id uuid;
  v_turno_id uuid;
  v_fuentes int := 0;
  v_contacto public.contactos%rowtype;
  v_contacto_id uuid;
  v_lista_id uuid;
  v_fecha date;
  v_vencimiento date;
  v_vendedor_id uuid;
  v_lineas jsonb;
  v_simple jsonb;
  v_descripcion_simple text;
  v_monto_simple numeric(14,2);
  v_cotizacion_id uuid;
  v_cotizacion public.cotizaciones%rowtype;
  v_linea jsonb;
  v_lineas_json jsonb := '[]'::jsonb;
  v_impuestos jsonb := '[]'::jsonb;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la cotización requeridos' using errcode = '22023';
  end if;

  v_terminal_id := nullif(p->>'terminal_id', '')::uuid;
  if v_terminal_id is null then
    raise exception 'la terminal no existe o está inactiva' using errcode = '22023';
  end if;

  select * into v_terminal
  from public.pos_terminales t
  where t.id = v_terminal_id
  for share;

  if not found or not v_terminal.activa then
    raise exception 'la terminal no existe o está inactiva' using errcode = '22023';
  end if;

  if p ? 'lineas' and jsonb_typeof(p->'lineas') = 'array' and jsonb_array_length(p->'lineas') > 0 then
    v_fuentes := v_fuentes + 1;
  end if;
  if p ? 'venta_simple' and jsonb_typeof(p->'venta_simple') = 'object' then
    v_fuentes := v_fuentes + 1;
  end if;

  if v_fuentes <> 1 then
    raise exception 'indica líneas, venta simple o una cotización, no varias a la vez'
      using errcode = '22023';
  end if;

  v_contacto_id := coalesce(nullif(p->>'contacto_id', '')::uuid, v_terminal.contacto_defecto_id);

  select * into v_contacto
  from public.contactos c
  where c.id = v_contacto_id and c.activo;

  if not found then
    raise exception 'el contacto no existe o está inactivo' using errcode = '22023';
  end if;

  v_lista_id := coalesce(nullif(p->>'lista_precio_id', '')::uuid, v_terminal.lista_precio_defecto_id);
  if v_lista_id is not null
     and not exists (select 1 from public.listas_precios lp where lp.id = v_lista_id and lp.activo) then
    raise exception 'la lista de precios o el centro de costo no existe o está inactivo'
      using errcode = '22023';
  end if;

  v_vendedor_id := nullif(p->>'vendedor_id', '')::uuid;
  if v_vendedor_id is not null
     and not exists (select 1 from public.vendedores v where v.id = v_vendedor_id and v.activo) then
    raise exception 'vendedor no encontrado o inactivo' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_vencimiento := coalesce((p->>'vencimiento')::date, v_fecha);
  if v_vencimiento < v_fecha then
    raise exception 'el vencimiento no puede ser anterior a la fecha' using errcode = '22023';
  end if;

  if p ? 'venta_simple' and jsonb_typeof(p->'venta_simple') = 'object' then
    v_simple := p->'venta_simple';
    v_descripcion_simple := nullif(btrim(coalesce(v_simple->>'descripcion', '')), '');
    v_monto_simple := public._pos_monto(v_simple->>'monto');

    if v_descripcion_simple is null or v_monto_simple is null or v_monto_simple <= 0 then
      raise exception 'la venta simple requiere una descripción y un monto mayor a cero'
        using errcode = '22023';
    end if;

    v_lineas := public._pos_resolver_lineas(jsonb_build_array(jsonb_build_object(
      'descripcion', v_descripcion_simple,
      'cantidad', 1,
      'precio', v_monto_simple,
      'descuento_pct', 0,
      'itbis_tasa', coalesce(public._pos_monto(v_simple->>'itbis_tasa'), 0)
    )), v_lista_id);
  else
    v_lineas := public._pos_resolver_lineas(p->'lineas', v_lista_id);
  end if;

  -- Mismas líneas repetidas con unidades distintas no se pueden emparejar
  -- después para completar la unidad (ver el update de abajo).
  if exists (
    select 1
    from (
      select
        coalesce(l->>'producto_id', '') as producto,
        coalesce(l->>'descripcion', '') as descripcion,
        coalesce(l->>'cantidad', '') as cantidad,
        coalesce(l->>'precio', '') as precio,
        coalesce(l->>'descuento_pct', '') as descuento,
        count(distinct coalesce(l->>'unidad_id', '')) as unidades
      from jsonb_array_elements(v_lineas) l
      group by 1, 2, 3, 4, 5
    ) x
    where x.unidades > 1
  ) then
    raise exception 'no se pueden cotizar dos líneas iguales con unidades distintas'
      using errcode = '22023';
  end if;

  v_cotizacion_id := public.crear_cotizacion(jsonb_build_object(
    'contacto_id', v_contacto_id,
    'fecha', v_fecha,
    'vencimiento', v_vencimiento,
    'notas', nullif(btrim(coalesce(p->>'notas', '')), ''),
    'terminos', nullif(btrim(coalesce(p->>'terminos', '')), ''),
    'vendedor_id', v_vendedor_id,
    'centro_costo_id', v_terminal.centro_costo_id,
    'lineas', v_lineas
  ));

  -- El motor de cotizaciones todavía no escribe unidad_id; la columna y el
  -- trigger existen desde la fase 1 de inventario, así que se completa aquí
  -- emparejando por los valores exactos que el motor copió del payload.
  for v_linea in select * from jsonb_array_elements(v_lineas) loop
    if nullif(v_linea->>'unidad_id', '') is null then
      continue;
    end if;

    update public.cotizacion_lineas cl
    set unidad_id = (v_linea->>'unidad_id')::uuid
    where cl.cotizacion_id = v_cotizacion_id
      and cl.producto_id = (v_linea->>'producto_id')::uuid
      and cl.descripcion = (v_linea->>'descripcion')
      and cl.cantidad = (v_linea->>'cantidad')::numeric
      and cl.precio = (v_linea->>'precio')::numeric
      and cl.descuento_pct = (v_linea->>'descuento_pct')::numeric
      and cl.unidad_id is null;
  end loop;

  select t.id into v_turno_id
  from public.pos_turnos t
  where t.terminal_id = v_terminal_id and t.estado = 'abierto'
  order by t.abierto_en
  limit 1;

  update public.cotizaciones c
  set origen = 'pos',
      turno_id = v_turno_id
  where c.id = v_cotizacion_id;

  select * into v_cotizacion
  from public.cotizaciones c
  where c.id = v_cotizacion_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', cl.id,
    'producto_id', cl.producto_id,
    'producto_nombre', pr.nombre,
    'referencia', pr.referencia,
    'descripcion', cl.descripcion,
    'cantidad', cl.cantidad,
    'unidad_id', cl.unidad_id,
    'unidad_nombre', cl.unidad_nombre,
    'factor_base', cl.factor_base,
    'precio', cl.precio,
    'descuento_pct', cl.descuento_pct,
    'itbis_tasa', cl.itbis_tasa,
    'subtotal', cl.subtotal,
    'itbis', cl.itbis,
    'total', cl.total
  ) order by cl.id), '[]'::jsonb)
  into v_lineas_json
  from public.cotizacion_lineas cl
  left join public.productos pr on pr.id = cl.producto_id
  where cl.cotizacion_id = v_cotizacion_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'codigo', i.codigo,
    'nombre', i.nombre,
    'tipo', i.tipo,
    'tarifa', i.tarifa,
    'cuenta_id', i.cuenta_id,
    'activo', i.activo,
    'orden', i.orden
  ) order by i.orden), '[]'::jsonb)
  into v_impuestos
  from public.impuestos i
  where i.id in (
    select cl.impuesto_id
    from public.cotizacion_lineas cl
    where cl.cotizacion_id = v_cotizacion_id and cl.impuesto_id is not null
  );

  return jsonb_build_object(
    'cotizacion', jsonb_build_object(
      'id', v_cotizacion.id,
      'numero', v_cotizacion.numero,
      'contacto_id', v_cotizacion.contacto_id,
      'fecha', v_cotizacion.fecha,
      'vencimiento', v_cotizacion.vencimiento,
      'estado', v_cotizacion.estado,
      'subtotal', v_cotizacion.subtotal,
      'descuento', v_cotizacion.descuento,
      'itbis', v_cotizacion.itbis,
      'otros_impuestos', v_cotizacion.otros_impuestos,
      'propina', v_cotizacion.propina,
      'total', v_cotizacion.total,
      'notas', v_cotizacion.notas,
      'terminos', v_cotizacion.terminos,
      'vendedor_id', v_cotizacion.vendedor_id,
      'centro_costo_id', v_cotizacion.centro_costo_id,
      'origen', v_cotizacion.origen,
      'turno_id', v_cotizacion.turno_id
    ),
    'contacto', to_jsonb(v_contacto),
    'empresa', public._pos_empresa(),
    'terminal', jsonb_build_object(
      'id', v_terminal.id,
      'nombre', v_terminal.nombre,
      'plantilla_ticket', v_terminal.plantilla_ticket
    ),
    'turno', (
      select jsonb_build_object(
        'id', t.id, 'numero', t.numero, 'estado', t.estado, 'base_inicial', t.base_inicial
      )
      from public.pos_turnos t
      where t.id = v_turno_id
    ),
    'vendedor', (
      select jsonb_build_object('id', v.id, 'nombre', v.nombre)
      from public.vendedores v
      where v.id = v_cotizacion.vendedor_id
    ),
    'lineas', v_lineas_json,
    'impuestos', v_impuestos,
    'totales', jsonb_build_object(
      'subtotal', v_cotizacion.subtotal,
      'descuento', v_cotizacion.descuento,
      'itbis', v_cotizacion.itbis,
      'otros_impuestos', v_cotizacion.otros_impuestos,
      'propina', v_cotizacion.propina,
      'total', v_cotizacion.total
    ),
    'plantilla_ticket', v_terminal.plantilla_ticket,
    'lista_precio', (
      select jsonb_build_object('id', lp.id, 'nombre', lp.nombre)
      from public.listas_precios lp
      where lp.id = v_lista_id
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Devolución (nota de crédito B04 + reembolso en efectivo)
-- ---------------------------------------------------------------------------

create or replace function public.pos_crear_devolucion(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_terminal public.pos_terminales%rowtype;
  v_terminal_id uuid;
  v_turno public.pos_turnos%rowtype;
  v_turno_id uuid;
  v_factura public.facturas%rowtype;
  v_factura_id uuid;
  v_tipo_reembolso text;
  v_monto_efectivo numeric(14,2);
  v_monto_efectivo_informado boolean;
  v_cuenta_reembolso_id uuid;
  v_cuenta_reembolso public.cuentas%rowtype;
  v_esperado numeric(14,2);
  v_devuelto_previo numeric(14,2);
  v_pagado_disponible numeric(14,2);
  v_nota_id uuid;
  v_nota public.notas_credito_venta%rowtype;
  v_lineas jsonb;
  v_lineas_json jsonb := '[]'::jsonb;
  v_cuenta_cxc uuid;
  v_asiento_id uuid;
  v_total numeric(14,2);
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la devolución requeridos' using errcode = '22023';
  end if;

  v_terminal_id := nullif(p->>'terminal_id', '')::uuid;
  if v_terminal_id is null then
    raise exception 'la terminal no existe o está inactiva' using errcode = '22023';
  end if;

  select * into v_terminal
  from public.pos_terminales t
  where t.id = v_terminal_id
  for share;

  if not found or not v_terminal.activa then
    raise exception 'la terminal no existe o está inactiva' using errcode = '22023';
  end if;

  v_turno_id := nullif(p->>'turno_id', '')::uuid;
  if v_turno_id is not null then
    select * into v_turno
    from public.pos_turnos t
    where t.id = v_turno_id and t.terminal_id = v_terminal_id
    for update;

    if not found then
      raise exception 'el turno no pertenece a la terminal' using errcode = '22023';
    end if;
    if v_turno.estado <> 'abierto' then
      raise exception 'el turno ya está cerrado' using errcode = '22023';
    end if;
  else
    select * into v_turno
    from public.pos_turnos t
    where t.terminal_id = v_terminal_id and t.estado = 'abierto'
    order by t.abierto_en
    limit 1
    for update;

    if not found then
      raise exception 'no hay un turno abierto en la terminal %', v_terminal.nombre
        using errcode = '22023';
    end if;
    v_turno_id := v_turno.id;
  end if;

  v_factura_id := nullif(p->>'factura_id', '')::uuid;
  if v_factura_id is null then
    raise exception 'la factura no existe o está anulada' using errcode = '22023';
  end if;

  select * into v_factura
  from public.facturas f
  where f.id = v_factura_id
  for update;

  if not found or v_factura.estado = 'anulada' then
    raise exception 'la factura no existe o está anulada' using errcode = '22023';
  end if;

  if not (p ? 'lineas') or jsonb_typeof(p->'lineas') <> 'array' or jsonb_array_length(p->'lineas') = 0 then
    raise exception 'la devolución requiere al menos una línea' using errcode = '22023';
  end if;

  v_tipo_reembolso := nullif(btrim(coalesce(p->>'tipo_reembolso', '')), '');
  if v_tipo_reembolso is null
     or v_tipo_reembolso not in ('credito_factura', 'efectivo', 'combinado') then
    raise exception 'el tipo de reembolso no es válido' using errcode = '22023';
  end if;

  v_monto_efectivo_informado := p ? 'monto_reembolso_efectivo'
    and p->'monto_reembolso_efectivo' is not null
    and jsonb_typeof(p->'monto_reembolso_efectivo') <> 'null';

  v_monto_efectivo := case
    when v_monto_efectivo_informado then public._pos_monto(p->>'monto_reembolso_efectivo')
    else null
  end;

  if v_tipo_reembolso = 'credito_factura' then
    if coalesce(v_monto_efectivo, 0) <> 0 then
      raise exception 'el reembolso con crédito a factura no puede incluir efectivo'
        using errcode = '22023';
    end if;
    v_cuenta_reembolso_id := null;
  else
    v_cuenta_reembolso_id := coalesce(
      nullif(p->>'cuenta_reembolso_id', '')::uuid,
      v_terminal.cuenta_efectivo_id
    );

    if v_cuenta_reembolso_id <> v_terminal.cuenta_efectivo_id then
      raise exception 'la cuenta de reembolso debe ser la cuenta de efectivo de la terminal'
        using errcode = '22023';
    end if;

    select * into v_cuenta_reembolso
    from public.cuentas c
    where c.id = v_cuenta_reembolso_id and c.activa;

    if not found then
      raise exception 'la cuenta de reembolso debe ser la cuenta de efectivo de la terminal'
        using errcode = '22023';
    end if;

    if v_tipo_reembolso = 'combinado' and coalesce(v_monto_efectivo, 0) <= 0 then
      raise exception 'el reembolso combinado requiere efectivo y crédito mayores a cero'
        using errcode = '22023';
    end if;
  end if;

  v_esperado := (public._pos_resumen(v_turno_id)->'efectivo'->>'efectivo_esperado')::numeric;

  select coalesce(sum(n.monto_reembolso_efectivo), 0)
  into v_devuelto_previo
  from public.notas_credito_venta n
  where n.factura_id = v_factura_id and n.estado = 'activa';

  v_pagado_disponible := round(v_factura.pagado - v_devuelto_previo, 2);

  -- Validaciones previas con el monto informado (el total se conoce tras la NC).
  if v_monto_efectivo is not null and v_monto_efectivo > 0 and v_tipo_reembolso <> 'credito_factura' then
    if v_monto_efectivo > v_pagado_disponible then
      raise exception 'el efectivo devuelto no puede exceder lo pagado en la factura'
        using errcode = '22023';
    end if;
    if v_monto_efectivo > v_esperado then
      raise exception 'el efectivo devuelto no puede exceder el efectivo disponible en la caja'
        using errcode = '22023';
    end if;
  end if;

  v_nota_id := public.crear_nota_credito_venta(jsonb_build_object(
    'factura_id', v_factura_id,
    'fecha', coalesce((p->>'fecha')::date, current_date),
    'notas', nullif(btrim(coalesce(p->>'notas', '')), ''),
    'devuelve_inventario', true,
    'almacen_id', v_terminal.almacen_id,
    'lineas', p->'lineas'
  ));

  select * into v_nota
  from public.notas_credito_venta n
  where n.id = v_nota_id;

  v_total := v_nota.total;

  if v_tipo_reembolso = 'credito_factura' then
    v_monto_efectivo := 0;
  elsif v_tipo_reembolso = 'efectivo' then
    if v_monto_efectivo is null then
      v_monto_efectivo := v_total;
    end if;
    if v_monto_efectivo <> v_total then
      raise exception 'el reembolso en efectivo debe ser igual al total de la devolución'
        using errcode = '22023';
    end if;
  else
    if v_monto_efectivo is null or v_monto_efectivo <= 0 or v_monto_efectivo >= v_total then
      raise exception 'el reembolso combinado requiere efectivo y crédito mayores a cero'
        using errcode = '22023';
    end if;
  end if;

  if v_monto_efectivo > v_total then
    raise exception 'el reembolso en efectivo no puede exceder el total de la devolución'
      using errcode = '22023';
  end if;
  if v_monto_efectivo > 0 and v_monto_efectivo > v_pagado_disponible then
    raise exception 'el efectivo devuelto no puede exceder lo pagado en la factura'
      using errcode = '22023';
  end if;
  if v_monto_efectivo > 0 and v_monto_efectivo > v_esperado then
    raise exception 'el efectivo devuelto no puede exceder el efectivo disponible en la caja'
      using errcode = '22023';
  end if;

  update public.notas_credito_venta n
  set turno_id = v_turno_id,
      tipo_reembolso = v_tipo_reembolso,
      monto_reembolso_efectivo = v_monto_efectivo,
      cuenta_reembolso_id = v_cuenta_reembolso_id
  where n.id = v_nota_id;

  if v_monto_efectivo > 0 then
    select coalesce(c.cuenta_cxc_id, public._cuenta_config('cxc'))
    into v_cuenta_cxc
    from public.contactos c
    where c.id = v_nota.contacto_id;

    v_asiento_id := public._crear_asiento(
      coalesce(v_nota.fecha, current_date),
      'Reembolso en efectivo NC ' || v_nota.ncf,
      'nota_credito_venta',
      v_nota_id,
      jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', coalesce(v_cuenta_cxc, public._cuenta_config('cxc')),
          'debito', v_monto_efectivo,
          'credito', 0,
          'contacto_id', v_nota.contacto_id,
          'centro_costo_id', v_terminal.centro_costo_id,
          'descripcion', 'Reembolso en efectivo NC ' || v_nota.ncf
        ),
        jsonb_build_object(
          'cuenta_id', v_cuenta_reembolso_id,
          'debito', 0,
          'credito', v_monto_efectivo,
          'centro_costo_id', v_terminal.centro_costo_id,
          'descripcion', 'Reembolso en efectivo NC ' || v_nota.ncf
        )
      )
    );
  end if;

  -- La parte reembolsada en efectivo deja de ser crédito a favor de la
  -- factura: la NC la acreditó a CxC y el asiento anterior la debitó, así que
  -- el submayor de la factura debe bajar igual para no divergir del mayor.
  if v_monto_efectivo > 0 then
    update public.facturas f
    set credito = round(f.credito - v_monto_efectivo, 2),
        estado = case
          when round(f.pagado + (f.credito - v_monto_efectivo), 2) >= f.total then 'pagada'
          else 'abierta'
        end
    where f.id = v_factura_id;
  end if;

  select * into v_nota
  from public.notas_credito_venta n
  where n.id = v_nota_id;

  select * into v_factura
  from public.facturas f
  where f.id = v_factura_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'factura_linea_id', nl.factura_linea_id,
    'producto_id', nl.producto_id,
    'descripcion', nl.descripcion,
    'cantidad', nl.cantidad,
    'unidad_nombre', nl.unidad_nombre,
    'factor_base', nl.factor_base,
    'precio', nl.precio,
    'descuento_pct', nl.descuento_pct,
    'itbis_tasa', nl.itbis_tasa,
    'subtotal', nl.subtotal,
    'itbis', nl.itbis,
    'total', nl.total,
    'costo_unitario', nl.costo_unitario
  ) order by nl.id), '[]'::jsonb)
  into v_lineas_json
  from public.nota_credito_venta_lineas nl
  where nl.nota_id = v_nota_id;

  return jsonb_build_object(
    'nota', jsonb_build_object(
      'id', v_nota.id,
      'numero', v_nota.numero,
      'ncf', v_nota.ncf,
      'factura_id', v_nota.factura_id,
      'contacto_id', v_nota.contacto_id,
      'fecha', v_nota.fecha,
      'subtotal', v_nota.subtotal,
      'itbis', v_nota.itbis,
      'total', v_nota.total,
      'estado', v_nota.estado,
      'devuelve_inventario', v_nota.devuelve_inventario,
      'tipo_reembolso', v_nota.tipo_reembolso,
      'monto_reembolso_efectivo', v_nota.monto_reembolso_efectivo,
      'cuenta_reembolso_id', v_nota.cuenta_reembolso_id,
      'turno_id', v_nota.turno_id,
      'notas', v_nota.notas,
      'asiento_id', v_nota.asiento_id,
      'asiento_reembolso_id', v_asiento_id
    ),
    'factura', jsonb_build_object(
      'id', v_factura.id,
      'numero', v_factura.numero,
      'ncf', v_factura.ncf,
      'total', v_factura.total,
      'pagado', v_factura.pagado,
      'credito', v_factura.credito,
      'estado', v_factura.estado,
      'saldo', round(v_factura.total - v_factura.pagado - v_factura.retenido - v_factura.credito, 2)
    ),
    'contacto', (
      select to_jsonb(c) from public.contactos c where c.id = v_nota.contacto_id
    ),
    'empresa', public._pos_empresa(),
    'terminal', jsonb_build_object(
      'id', v_terminal.id,
      'nombre', v_terminal.nombre,
      'plantilla_ticket', v_terminal.plantilla_ticket
    ),
    'turno', jsonb_build_object(
      'id', v_turno.id,
      'numero', v_turno.numero,
      'estado', v_turno.estado
    ),
    'lineas', v_lineas_json,
    'reembolso', jsonb_build_object(
      'tipo', v_tipo_reembolso,
      'efectivo', v_monto_efectivo,
      'credito', round(v_total - v_monto_efectivo, 2),
      'cuenta_id', v_cuenta_reembolso_id,
      'cuenta_nombre', (
        select c.nombre from public.cuentas c where c.id = v_cuenta_reembolso_id
      )
    ),
    'totales', jsonb_build_object(
      'subtotal', v_nota.subtotal,
      'itbis', v_nota.itbis,
      'total', v_nota.total,
      'efectivo', v_monto_efectivo,
      'credito', round(v_total - v_monto_efectivo, 2)
    ),
    'resumen', public._pos_resumen(v_turno_id)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Resumen del turno (lectura abierta a cualquier rol con perfil)
-- ---------------------------------------------------------------------------

create or replace function public.pos_resumen_turno(p_turno_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_turno public.pos_turnos%rowtype;
  v_terminal public.pos_terminales%rowtype;
begin
  if p_turno_id is null then
    raise exception 'el turno no existe' using errcode = '22023';
  end if;

  select * into v_turno
  from public.pos_turnos t
  where t.id = p_turno_id;

  if not found then
    raise exception 'el turno no existe' using errcode = '22023';
  end if;

  select * into v_terminal
  from public.pos_terminales t
  where t.id = v_turno.terminal_id;

  return jsonb_build_object(
    'turno', jsonb_build_object(
      'id', v_turno.id,
      'numero', v_turno.numero,
      'terminal_id', v_turno.terminal_id,
      'abierto_por', v_turno.abierto_por,
      'cerrado_por', v_turno.cerrado_por,
      'abierto_en', v_turno.abierto_en,
      'cerrado_en', v_turno.cerrado_en,
      'estado', v_turno.estado,
      'base_inicial', v_turno.base_inicial,
      'efectivo_esperado', v_turno.efectivo_esperado,
      'efectivo_real', v_turno.efectivo_real,
      'diferencia', v_turno.diferencia,
      'asiento_diferencia_id', v_turno.asiento_diferencia_id,
      'observaciones', v_turno.observaciones
    ),
    'terminal', jsonb_build_object(
      'id', v_terminal.id,
      'nombre', v_terminal.nombre,
      'almacen_id', v_terminal.almacen_id,
      'cuenta_efectivo_id', v_terminal.cuenta_efectivo_id,
      'plantilla_ticket', v_terminal.plantilla_ticket
    ),
    'empresa', (
      select to_jsonb(e) from public.empresa e where e.id = 1
    ),
    'resumen', public._pos_resumen(p_turno_id)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Cierre del turno
-- ---------------------------------------------------------------------------

create or replace function public.pos_cerrar_turno(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_turno public.pos_turnos%rowtype;
  v_terminal public.pos_terminales%rowtype;
  v_turno_id uuid;
  v_terminal_id uuid;
  v_real numeric(14,2);
  v_diferencia numeric(14,2);
  v_esperado numeric(14,2);
  v_observaciones text;
  v_registrar boolean;
  v_cuenta_id uuid;
  v_asiento_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del cierre requeridos' using errcode = '22023';
  end if;

  v_turno_id := nullif(p->>'turno_id', '')::uuid;
  if v_turno_id is null then
    raise exception 'el turno no existe' using errcode = '22023';
  end if;

  select t.terminal_id into v_terminal_id
  from public.pos_turnos t
  where t.id = v_turno_id;

  if v_terminal_id is null then
    raise exception 'el turno no existe' using errcode = '22023';
  end if;

  select * into v_terminal
  from public.pos_terminales t
  where t.id = v_terminal_id
  for share;

  select * into v_turno
  from public.pos_turnos t
  where t.id = v_turno_id
  for update;

  if not found then
    raise exception 'el turno no existe' using errcode = '22023';
  end if;
  if v_turno.estado <> 'abierto' then
    raise exception 'el turno ya está cerrado' using errcode = '22023';
  end if;

  if not (p ? 'efectivo_real')
     or p->'efectivo_real' is null
     or jsonb_typeof(p->'efectivo_real') = 'null'
     or btrim(coalesce(p->>'efectivo_real', '')) = '' then
    raise exception 'el efectivo real es obligatorio' using errcode = '22023';
  end if;

  v_real := public._pos_monto(p->>'efectivo_real');
  if v_real is null or v_real < 0 then
    raise exception 'el efectivo real no puede ser negativo' using errcode = '22023';
  end if;

  v_observaciones := nullif(btrim(coalesce(p->>'observaciones', '')), '');
  if v_observaciones is not null and length(v_observaciones) > 500 then
    raise exception 'las observaciones no pueden exceder 500 caracteres' using errcode = '22023';
  end if;

  v_registrar := public._pos_booleano(p->>'registrar_diferencia', true);

  v_esperado := (public._pos_resumen(v_turno_id)->'efectivo'->>'efectivo_esperado')::numeric;

  if v_esperado < 0 then
    raise exception 'el efectivo esperado es negativo; revisa los pagos y devoluciones del turno antes de cerrar'
      using errcode = '22023';
  end if;

  v_diferencia := round(v_real - v_esperado, 2);

  if v_registrar and v_diferencia <> 0 then
    if v_diferencia > 0 then
      select c.id into v_cuenta_id
      from public.config_contable cc
      join public.cuentas c on c.id = cc.cuenta_id
      where cc.clave = 'sobrante_caja'
        and c.activa
        and c.acepta_movimientos;

      if v_cuenta_id is null then
        raise exception 'no hay una cuenta configurada para sobrante o faltante de caja'
          using errcode = '22023';
      end if;

      v_asiento_id := public._crear_asiento(
        current_date,
        'Diferencia de cierre del turno ' || v_turno.numero::text,
        'pos_diferencia',
        v_turno_id,
        jsonb_build_array(
          jsonb_build_object(
            'cuenta_id', v_terminal.cuenta_efectivo_id,
            'debito', v_diferencia,
            'credito', 0,
            'centro_costo_id', v_terminal.centro_costo_id,
            'descripcion', 'Sobrante de caja turno ' || v_turno.numero::text
          ),
          jsonb_build_object(
            'cuenta_id', v_cuenta_id,
            'debito', 0,
            'credito', v_diferencia,
            'centro_costo_id', v_terminal.centro_costo_id,
            'descripcion', 'Sobrante de caja turno ' || v_turno.numero::text
          )
        )
      );
    else
      select c.id into v_cuenta_id
      from public.config_contable cc
      join public.cuentas c on c.id = cc.cuenta_id
      where cc.clave = 'faltante_caja'
        and c.activa
        and c.acepta_movimientos;

      if v_cuenta_id is null then
        raise exception 'no hay una cuenta configurada para sobrante o faltante de caja'
          using errcode = '22023';
      end if;

      v_asiento_id := public._crear_asiento(
        current_date,
        'Diferencia de cierre del turno ' || v_turno.numero::text,
        'pos_diferencia',
        v_turno_id,
        jsonb_build_array(
          jsonb_build_object(
            'cuenta_id', v_cuenta_id,
            'debito', abs(v_diferencia),
            'credito', 0,
            'centro_costo_id', v_terminal.centro_costo_id,
            'descripcion', 'Faltante de caja turno ' || v_turno.numero::text
          ),
          jsonb_build_object(
            'cuenta_id', v_terminal.cuenta_efectivo_id,
            'debito', 0,
            'credito', abs(v_diferencia),
            'centro_costo_id', v_terminal.centro_costo_id,
            'descripcion', 'Faltante de caja turno ' || v_turno.numero::text
          )
        )
      );
    end if;
  end if;

  update public.pos_turnos t
  set estado = 'cerrado',
      cerrado_por = auth.uid(),
      cerrado_en = now(),
      efectivo_esperado = v_esperado,
      efectivo_real = v_real,
      diferencia = v_diferencia,
      asiento_diferencia_id = v_asiento_id,
      observaciones = coalesce(v_observaciones, t.observaciones)
  where t.id = v_turno_id;

  select * into v_turno
  from public.pos_turnos t
  where t.id = v_turno_id;

  return jsonb_build_object(
    'turno', jsonb_build_object(
      'id', v_turno.id,
      'numero', v_turno.numero,
      'terminal_id', v_turno.terminal_id,
      'abierto_por', v_turno.abierto_por,
      'cerrado_por', v_turno.cerrado_por,
      'abierto_en', v_turno.abierto_en,
      'cerrado_en', v_turno.cerrado_en,
      'estado', v_turno.estado,
      'base_inicial', v_turno.base_inicial,
      'efectivo_esperado', v_turno.efectivo_esperado,
      'efectivo_real', v_turno.efectivo_real,
      'diferencia', v_turno.diferencia,
      'asiento_diferencia_id', v_turno.asiento_diferencia_id,
      'observaciones', v_turno.observaciones
    ),
    'terminal', jsonb_build_object(
      'id', v_terminal.id,
      'nombre', v_terminal.nombre,
      'plantilla_ticket', v_terminal.plantilla_ticket
    ),
    'empresa', public._pos_empresa(),
    'resumen', public._pos_resumen(v_turno_id),
    'asiento_diferencia', (
      select jsonb_build_object(
        'id', a.id, 'numero', a.numero, 'fecha', a.fecha,
        'descripcion', a.descripcion, 'total', a.total
      )
      from public.asientos a
      where a.id = v_asiento_id
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

revoke all on function public.pos_crear_terminal(jsonb) from public, anon, authenticated;
revoke all on function public.pos_actualizar_terminal(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.pos_abrir_turno(jsonb) from public, anon, authenticated;
revoke all on function public.pos_registrar_movimiento_turno(jsonb) from public, anon, authenticated;
revoke all on function public.pos_completar_venta(jsonb) from public, anon, authenticated;
revoke all on function public.pos_crear_cotizacion(jsonb) from public, anon, authenticated;
revoke all on function public.pos_crear_devolucion(jsonb) from public, anon, authenticated;
revoke all on function public.pos_resumen_turno(uuid) from public, anon, authenticated;
revoke all on function public.pos_cerrar_turno(jsonb) from public, anon, authenticated;

grant execute on function public.pos_crear_terminal(jsonb) to authenticated;
grant execute on function public.pos_actualizar_terminal(uuid, jsonb) to authenticated;
grant execute on function public.pos_abrir_turno(jsonb) to authenticated;
grant execute on function public.pos_registrar_movimiento_turno(jsonb) to authenticated;
grant execute on function public.pos_completar_venta(jsonb) to authenticated;
grant execute on function public.pos_crear_cotizacion(jsonb) to authenticated;
grant execute on function public.pos_crear_devolucion(jsonb) to authenticated;
grant execute on function public.pos_resumen_turno(uuid) to authenticated;
grant execute on function public.pos_cerrar_turno(jsonb) to authenticated;

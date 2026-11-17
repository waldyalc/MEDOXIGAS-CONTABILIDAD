-- ---------------------------------------------------------------------------
-- NCF manual por numeración: fase 1, solo facturas de venta (01, 02, 14, 15, 16)
--
-- Una numeración puede ser automática (como hoy: el sistema asigna
-- prefijo + siguiente y avanza) o manual (el usuario escribe el NCF y
-- "siguiente" no se consume).
--
-- Migración aditiva y reintentable:
--   · columnas nuevas con default: todas las filas existentes siguen
--     automáticas y ninguna preferida;
--   · un índice parcial para que exista como máximo una preferida;
--   · CREATE OR REPLACE de funciones, sin borrar ni reescribir datos.
--
-- Depende de 20261117300000_numeraciones_notas.sql: actualizar_numeracion se
-- reemplaza partiendo de esa versión (la que vigila las notas B03/B04), no de
-- la de 20261113210000.
--
-- El NCF se decide en un único lugar (_ncf_factura). _crear_factura_sin_impuestos
-- solo la llama: el wrapper público crear_factura ya pasa su payload completo
-- (incluido "ncf_manual") tanto en la ruta normal como en el fallback.
-- ---------------------------------------------------------------------------

alter table public.numeraciones
  add column if not exists automatica boolean not null default true,
  add column if not exists preferida  boolean not null default false;

comment on column public.numeraciones.automatica is
  'true = crear_factura asigna prefijo+siguiente y avanza; false = el NCF se escribe a mano y siguiente no se consume.';
comment on column public.numeraciones.preferida is
  'Serie que sale primero al crear una factura de venta. Máximo una preferida en la fase 1.';

-- Como máximo una fila preferida. Si en el futuro las notas también usan
-- "preferida", este índice se reemplaza por (documento, preferida) cuando
-- exista la columna documento.
create unique index if not exists numeraciones_preferida_uidx
  on public.numeraciones (preferida)
  where preferida;

-- ---------------------------------------------------------------------------
-- _ncf_factura: única fuente de verdad del NCF de una factura de venta
--
-- Automática: valida agotada y vencida (en ese orden, como hoy), asigna
-- prefijo+siguiente y avanza. Manual: valida vencida, prefijo, rango y
-- duplicado, y NO toca siguiente.
--
-- Bloquea la fila de numeración en los dos modos: serializa las facturas de la
-- misma serie y hace que el chequeo de duplicado vea lo que acaba de commitear
-- otra sesión (también serializa contra actualizar_numeracion).
-- ---------------------------------------------------------------------------
create or replace function public._ncf_factura(
  p_tipo text,
  p_fecha date,
  p_ncf_manual text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_num public.numeraciones%rowtype;
  v_ncf text;
  v_numero int;
begin
  -- Misma selección que hoy: activa del tipo, id más bajo, bloqueada.
  select * into v_num
  from public.numeraciones n
  where n.tipo_comprobante = p_tipo
    and n.activa
  order by n.id
  limit 1
  for update;

  if not found then
    raise exception 'no hay numeración activa para el comprobante %', p_tipo
      using errcode = '22023';
  end if;

  -- -----------------------------------------------------------------------
  -- Automática: mismo orden y mensajes que hoy (agotada antes que vencida).
  -- -----------------------------------------------------------------------
  if coalesce(v_num.automatica, true) then
    if nullif(btrim(p_ncf_manual), '') is not null then
      raise exception 'la numeración % es automática; el NCF no se escribe a mano', v_num.prefijo
        using errcode = '22023';
    end if;

    if v_num.hasta is not null and v_num.siguiente > v_num.hasta then
      raise exception 'la numeración % está agotada', v_num.prefijo
        using errcode = '22023';
    end if;

    if v_num.vence is not null and v_num.vence < p_fecha then
      raise exception 'la numeración % está vencida', v_num.prefijo
        using errcode = '22023';
    end if;

    v_ncf := v_num.prefijo || lpad(v_num.siguiente::text, 8, '0');
    update public.numeraciones
       set siguiente = siguiente + 1
     where id = v_num.id;

    return v_ncf;
  end if;

  -- -----------------------------------------------------------------------
  -- Manual: valida, pero NO toca siguiente.
  -- -----------------------------------------------------------------------
  if v_num.vence is not null and v_num.vence < p_fecha then
    raise exception 'la numeración % está vencida', v_num.prefijo
      using errcode = '22023';
  end if;

  if nullif(btrim(p_ncf_manual), '') is null then
    raise exception 'la numeración % es manual; esta factura necesita un NCF escrito a mano', v_num.prefijo
      using errcode = '22023';
  end if;

  v_ncf := upper(btrim(p_ncf_manual));

  if length(v_ncf) <> length(v_num.prefijo) + 8
     or left(v_ncf, length(v_num.prefijo)) <> v_num.prefijo
     or substring(v_ncf from length(v_num.prefijo) + 1) !~ '^[0-9]{8}$' then
    raise exception 'el NCF % no corresponde a la numeración %', v_ncf, v_num.prefijo
      using errcode = '22023';
  end if;

  v_numero := substring(v_ncf from length(v_num.prefijo) + 1)::int;

  if v_numero < 1 then
    raise exception 'el NCF % no es válido: el número debe ser mayor que cero', v_ncf
      using errcode = '22023';
  end if;

  if v_num.hasta is not null and v_numero > v_num.hasta then
    raise exception 'el NCF % está fuera de la serie % (hasta %)', v_ncf, v_num.prefijo, v_num.hasta
      using errcode = '22023';
  end if;

  if exists (select 1 from public.facturas f where f.ncf = v_ncf) then
    raise exception 'el NCF % ya fue usado en otra factura', v_ncf
      using errcode = '22023';
  end if;

  return v_ncf;
end;
$$;

revoke all on function public._ncf_factura(text, date, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- _crear_factura_sin_impuestos: el bloque de NCF se delega en _ncf_factura
--
-- El resto del cuerpo es textual al de 20261115500000 (renombrado por
-- 20261115701000): contacto, vendedor, centro de costo, almacén, líneas,
-- inventario, asiento y pago no cambian.
-- ---------------------------------------------------------------------------

create or replace function public._crear_factura_sin_impuestos(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_contacto public.contactos%rowtype;
  v_almacen_id uuid;
  v_factura_id uuid;
  v_numero int;
  v_ncf text;
  v_tipo text;
  v_fecha date;
  v_vencimiento date;
  v_vendedor_id uuid;
  v_centro_costo_id uuid;
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
  if v_tipo is null or v_tipo not in ('01', '02', '14', '15', '16') then
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

  v_vendedor_id := nullif(p->>'vendedor_id', '')::uuid;
  if v_vendedor_id is not null
     and not exists (select 1 from public.vendedores v where v.id = v_vendedor_id and v.activo) then
    raise exception 'vendedor no encontrado o inactivo' using errcode = '22023';
  end if;

  v_centro_costo_id := nullif(p->>'centro_costo_id', '')::uuid;
  if v_centro_costo_id is not null
     and not exists (select 1 from public.centros_costo c where c.id = v_centro_costo_id and c.activo) then
    raise exception 'centro de costo no encontrado o inactivo' using errcode = '22023';
  end if;

  v_almacen_id := nullif(p->>'almacen_id', '')::uuid;
  if v_almacen_id is null then
    v_almacen_id := public._almacen_principal();
  end if;
  if v_almacen_id is null
     or not exists (select 1 from public.almacenes al where al.id = v_almacen_id and al.activo) then
    raise exception 'almacén no encontrado o inactivo' using errcode = '22023';
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

  -- El NCF (automático o manual) lo decide una sola función: _ncf_factura.
  -- En automática consume un número; en manual no toca "siguiente".
  v_ncf := public._ncf_factura(v_tipo, v_fecha, p->>'ncf_manual');

  insert into public.facturas (
    tipo_comprobante, ncf, contacto_id, vendedor_id, centro_costo_id, almacen_id, fecha, vencimiento,
    notas, terminos, pie, creado_por
  )
  values (
    v_tipo, v_ncf, v_contacto.id, v_vendedor_id, v_centro_costo_id, v_almacen_id, v_fecha, v_vencimiento,
    p->>'notas', p->>'terminos', p->>'pie', auth.uid()
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

      perform public._mover_existencia(v_producto_id, v_almacen_id, -v_cantidad);
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

  if v_centro_costo_id is not null then
    update public.asiento_lineas
    set centro_costo_id = v_centro_costo_id
    where asiento_id = v_asiento_id;
  end if;

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

revoke all on function public._crear_factura_sin_impuestos(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- actualizar_numeracion: acepta automatica y preferida
--
-- Se parte de la versión de 20261117300000 (F16: el último NCF emitido incluye
-- facturas, gastos menores y notas B03/B04). Cambios:
--   · automatica/preferida solo para facturas de venta (01, 02, 14, 15, 16);
--   · una preferida debe quedar activa y limpia las demás;
--   · en manual "siguiente" es solo referencia: no se compara con "hasta" ni
--     con el último NCF emitido;
--   · al volver a automática, "siguiente" debe superar el último NCF emitido
--     (incluidos los manuales) para no repetir un número.
-- ---------------------------------------------------------------------------
create or replace function public.actualizar_numeracion(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_num public.numeraciones%rowtype;
  v_siguiente int;
  v_hasta int;
  v_vence date;
  v_ultimo int;
  v_automatica boolean;
  v_preferida boolean;
  v_activa boolean;
  v_tipo text;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or nullif(p->>'id', '') is null then
    raise exception 'la numeración es obligatoria' using errcode = '22023';
  end if;

  v_id := (p->>'id')::uuid;

  select * into v_num
  from public.numeraciones n
  where n.id = v_id
  for update;

  if not found then
    raise exception 'numeración no encontrada' using errcode = '22023';
  end if;

  v_siguiente := v_num.siguiente;
  v_hasta := v_num.hasta;
  v_vence := v_num.vence;
  v_automatica := coalesce(v_num.automatica, true);
  v_preferida := coalesce(v_num.preferida, false);
  v_activa := v_num.activa;
  v_tipo := v_num.tipo_comprobante;

  if p ? 'siguiente' then
    v_siguiente := (p->>'siguiente')::int;
    if v_siguiente is null or v_siguiente < 1 then
      raise exception 'el siguiente debe ser mayor o igual a 1' using errcode = '22023';
    end if;
  end if;

  if p ? 'hasta' then
    v_hasta := nullif(p->>'hasta', '')::int;
    if v_hasta is not null and v_hasta < 1 then
      raise exception 'el hasta debe ser mayor o igual a 1' using errcode = '22023';
    end if;
  end if;

  if p ? 'activa' then
    v_activa := coalesce((p->>'activa')::boolean, v_activa);
  end if;

  if p ? 'automatica' then
    if v_tipo not in ('01', '02', '14', '15', '16') then
      raise exception 'la numeración automática o manual solo aplica a facturas de venta'
        using errcode = '22023';
    end if;
    v_automatica := coalesce((p->>'automatica')::boolean, v_automatica);
  end if;

  if p ? 'preferida' then
    if (p->>'preferida')::boolean and v_tipo not in ('01', '02', '14', '15', '16') then
      raise exception 'la numeración preferida solo aplica a facturas de venta'
        using errcode = '22023';
    end if;
    v_preferida := coalesce((p->>'preferida')::boolean, v_preferida);
  end if;

  if v_preferida and not v_activa then
    raise exception 'una numeración preferida debe estar activa'
      using errcode = '22023';
  end if;

  -- En manual "siguiente" es una referencia: solo la automática lo acota.
  if v_automatica
     and (p ? 'siguiente' or p ? 'hasta' or p ? 'automatica')
     and v_hasta is not null
     and v_siguiente > v_hasta then
    raise exception 'el siguiente no puede ser mayor que el hasta' using errcode = '22023';
  end if;

  select max(v_max) into v_ultimo
  from (
    select coalesce((
      select max(substring(f.ncf from length(v_num.prefijo) + 1)::int)
      from public.facturas f
      where f.tipo_comprobante = v_num.tipo_comprobante
        and f.ncf like v_num.prefijo || '%'
    ), 0) as v_max
    union all
    select coalesce((
      select max(substring(gm.ncf from length(v_num.prefijo) + 1)::int)
      from public.gastos_menores gm
      where gm.ncf like v_num.prefijo || '%'
    ), 0)
    union all
    select coalesce((
      select max(substring(nd.ncf from length(v_num.prefijo) + 1)::int)
      from public.notas_debito_venta nd
      where v_num.tipo_comprobante = '03'
        and nd.ncf like v_num.prefijo || '%'
    ), 0)
    union all
    select coalesce((
      select max(substring(nc.ncf from length(v_num.prefijo) + 1)::int)
      from public.notas_credito_venta nc
      where v_num.tipo_comprobante = '04'
        and nc.ncf like v_num.prefijo || '%'
    ), 0)
    union all
    select coalesce((
      select max(substring(ncc.ncf from length(v_num.prefijo) + 1)::int)
      from public.notas_credito_compra ncc
      where v_num.tipo_comprobante = '03'
        and ncc.ncf like v_num.prefijo || '%'
    ), 0)
  ) s;

  if v_automatica and v_siguiente <= v_ultimo then
    if p ? 'automatica' then
      raise exception 'no puedes activar la numeración automática: el siguiente (%) debe ser mayor que el último NCF emitido (%)',
        v_siguiente, v_ultimo
        using errcode = '22023';
    else
      raise exception 'el siguiente no puede ser menor o igual al último NCF emitido (%)', v_ultimo
        using errcode = '22023';
    end if;
  end if;

  if p ? 'vence' then
    v_vence := nullif(p->>'vence', '')::date;
  end if;

  if p ? 'nombre' and coalesce(trim(p->>'nombre'), '') = '' then
    raise exception 'el nombre de la numeración es obligatorio' using errcode = '22023';
  end if;

  if v_preferida then
    update public.numeraciones n
       set preferida = false
     where n.preferida
       and n.id <> v_id;
  end if;

  update public.numeraciones n
  set
    siguiente = v_siguiente,
    hasta = v_hasta,
    vence = v_vence,
    activa = v_activa,
    automatica = v_automatica,
    preferida = v_preferida,
    nombre = case when p ? 'nombre' then p->>'nombre' else n.nombre end
  where n.id = v_id;

  return v_id;
end;
$$;

revoke all on function public.actualizar_numeracion(jsonb) from public, anon, authenticated;
grant execute on function public.actualizar_numeracion(jsonb) to authenticated;

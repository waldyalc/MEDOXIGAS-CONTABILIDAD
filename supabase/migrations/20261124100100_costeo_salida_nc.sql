-- ---------------------------------------------------------------------------
-- Costeo de salidas y notas de crédito de venta (Alegra, Prueba 3 y NC B04)
--
-- · Salidas de ajuste de inventario: el costo se fuerza SIEMPRE al costo
--   promedio vigente del producto. Alegra bloquea el campo en la salida; aquí
--   el envoltorio reescribe 'costo_unitario' antes de delegar en la base, así
--   el asiento y el total salen al promedio aunque el cliente envíe otro valor.
-- · Notas de crédito de venta: la mercancía devuelta reingresa al costo
--   promedio VIGENTE al momento de la NC (no al costo de la venta original),
--   con cuenta propia "Devoluciones en ventas" en el grupo Ingresos. Así el
--   promedio del producto no cambia con el reingreso.
-- · config_contable.devoluciones_ventas: la NC y el motor ubican la cuenta por
--   clave, igual que el resto de cuentas automáticas.
--
-- Migración aditiva y reintentable: no cambia documentos existentes.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Cuenta de devoluciones en ventas (grupo Ingresos)
-- ---------------------------------------------------------------------------

do $$
declare
  v_ingresos_id uuid;
  v_cuenta_id uuid;
  v_siguiente int;
  v_codigo text;
begin
  select c.id into v_cuenta_id
  from public.cuentas c
  where c.tipo = 'ingreso'
    and c.acepta_movimientos
    and c.activa
    and c.nombre = 'Devoluciones en ventas'
  order by c.codigo
  limit 1;

  if v_cuenta_id is null then
    select c.id into v_ingresos_id
    from public.cuentas c
    where c.codigo = '4';

    if v_ingresos_id is null then
      raise exception 'no existe la cuenta de ingresos' using errcode = '22023';
    end if;

    select max(c.codigo::int) into v_siguiente
    from public.cuentas c
    where c.padre_id = v_ingresos_id
      and c.codigo ~ '^[0-9]+$';

    v_codigo := (coalesce(v_siguiente, 4100) + 1)::text;
    while exists (select 1 from public.cuentas c where c.codigo = v_codigo) loop
      v_codigo := (v_codigo::int + 1)::text;
    end loop;

    insert into public.cuentas (
      codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos
    )
    values (
      v_codigo, 'Devoluciones en ventas', 'ingreso', 'credito', v_ingresos_id, true
    )
    returning id into v_cuenta_id;
  end if;

  insert into public.config_contable (clave, cuenta_id)
  values ('devoluciones_ventas', v_cuenta_id)
  on conflict (clave) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ajuste de inventario: el ajuste vigente pasa a base y las salidas se
-- costean al promedio del producto
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regprocedure('public.crear_ajuste_inventario(jsonb)') is not null
     and to_regprocedure('public._crear_ajuste_inventario_base(jsonb)') is null then
    alter function public.crear_ajuste_inventario(jsonb)
      rename to _crear_ajuste_inventario_base;
  end if;
end;
$$;

revoke all on function public._crear_ajuste_inventario_base(jsonb)
  from public, anon, authenticated;

create or replace function public.crear_ajuste_inventario(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linea jsonb;
  v_norm jsonb := '[]'::jsonb;
  v_producto_id uuid;
  v_costo numeric(14,2);
begin
  if p is null or jsonb_typeof(p->'lineas') <> 'array' then
    return public._crear_ajuste_inventario_base(p);
  end if;

  for v_linea in select * from jsonb_array_elements(p->'lineas') loop
    -- Solo las salidas: Alegra bloquea su costo al promedio vigente. Las
    -- entradas conservan el costo editable que envió la pantalla.
    if lower(coalesce(nullif(v_linea->>'tipo', ''), 'entrada')) = 'salida' then
      v_producto_id := nullif(v_linea->>'producto_id', '')::uuid;
      if v_producto_id is not null then
        select pr.costo into v_costo
        from public.productos pr
        where pr.id = v_producto_id;

        if found then
          v_linea := v_linea || jsonb_build_object('costo_unitario', v_costo);
        end if;
      end if;
    end if;

    v_norm := v_norm || jsonb_build_array(v_linea);
  end loop;

  return public._crear_ajuste_inventario_base(
    p || jsonb_build_object('lineas', v_norm)
  );
end;
$$;

revoke all on function public.crear_ajuste_inventario(jsonb)
  from public, anon, authenticated;
grant execute on function public.crear_ajuste_inventario(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Nota de crédito de venta: reingreso al costo promedio vigente y débito a
-- "Devoluciones en ventas"
-- ---------------------------------------------------------------------------

create or replace function public._crear_nota_credito_venta_sin_impuestos(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_factura public.facturas%rowtype;
  v_almacen_id uuid;
  v_cuenta_cxc uuid;
  v_cuenta_devoluciones uuid;
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
  v_producto_inventariable boolean;
  v_producto_costo numeric(14,2);
  v_producto_cuenta_costo uuid;
  v_producto_cuenta_inventario uuid;
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
  v_cuenta_devoluciones := public._cuenta_config('devoluciones_ventas');

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

  v_almacen_id := nullif(p->>'almacen_id', '')::uuid;
  if v_almacen_id is null then
    v_almacen_id := coalesce(v_factura.almacen_id, public._almacen_principal());
  end if;
  if v_almacen_id is null
     or not exists (select 1 from public.almacenes al where al.id = v_almacen_id and al.activo) then
    raise exception 'almacén no encontrado o inactivo' using errcode = '22023';
  end if;

  insert into public.notas_credito_venta (
    ncf, factura_id, contacto_id, almacen_id, fecha, devuelve_inventario, notas, creado_por
  )
  values (
    v_ncf, v_factura.id, v_factura.contacto_id, v_almacen_id, v_fecha, v_devuelve, p->>'notas', auth.uid()
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

    v_producto_id := v_factura_linea.producto_id;
    v_producto_inventariable := false;
    v_producto_costo := 0;
    v_producto_cuenta_costo := null;
    v_producto_cuenta_inventario := null;

    if v_producto_id is not null then
      select
        pr.inventariable, pr.costo, pr.cuenta_costo_id, pr.cuenta_inventario_id
      into
        v_producto_inventariable, v_producto_costo,
        v_producto_cuenta_costo, v_producto_cuenta_inventario
      from public.productos pr
      where pr.id = v_producto_id;

      if not found then
        v_producto_inventariable := false;
        v_producto_costo := 0;
        v_producto_cuenta_costo := null;
        v_producto_cuenta_inventario := null;
      end if;
    end if;

    -- Devolución al costo promedio VIGENTE (no al costo de la venta): el
    -- reingreso no mueve el promedio del producto, como en Alegra.
    if v_devuelve and v_producto_inventariable then
      v_costo_unitario := v_producto_costo;
    end if;

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

    if v_subtotal > 0 then
      v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_cuenta_devoluciones,
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

      perform public._mover_existencia(v_producto_id, v_almacen_id, v_cantidad);
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
        when round(v_factura.pagado + v_factura.retenido + v_nuevo_credito, 2) >= v_factura.total then 'pagada'
        else 'abierta'
      end
  where id = v_factura.id;

  return v_nota_id;
end;
$$;

revoke all on function public._crear_nota_credito_venta_sin_impuestos(jsonb)
  from public, anon, authenticated;

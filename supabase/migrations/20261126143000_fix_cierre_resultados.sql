-- ---------------------------------------------------------------------------
-- Fix del cierre anual de resultados (auditoría 24-11-2026)
--
-- Bugs en `20261114300100_periodos_cierre.sql`:
--   · `cerrar_resultados_anio` aceptaba el año en curso (`v_anio <= año
--     actual`), así que se podía "cerrar" un ejercicio que todavía no termina.
--   · El cierre no cerraba los 12 meses del año y ni `_validar_periodo_abierto`
--     ni `reabrir_periodo` miraban `cierres_resultados`: después del cierre se
--     podían crear asientos de ingreso/costo/gasto en ese año que ya nunca se
--     cerrarían (huérfanos), o reabrir un mes y volver a mover el año cerrado.
--   · El asiento de cierre (31/12) entraba en el Estado de Resultados, así que
--     el P&G anual quedaba en RD$0.00.
--
-- Arreglo:
--   · Solo se cierran ejercicios terminados: `p_anio < año actual`. Si falta
--     el año, el default pasa a ser el año anterior.
--   · El cierre marca en `periodos_contables` los 12 meses del año (respeta la
--     fecha y el usuario de los meses que ya estaban cerrados).
--   · `_validar_periodo_abierto` y `reabrir_periodo` rechazan cualquier
--     fecha/periodo de un año presente en `cierres_resultados`.
--   · `reporte_estado_resultados` y `reporte_estado_resultados_centro`
--     excluyen el asiento de cierre por `cierres_resultados.asiento_id`.
--
-- Migración aditiva: solo `create or replace function` (cuerpos copiados de su
-- migración original con el parche mínimo) y los mismos grants. No toca datos,
-- no reescribe migraciones aplicadas y conserva `origen_tipo = 'manual'` del
-- asiento de cierre para no romper `anular_documento` ni el CHECK vigente.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Trigger: un año con resultados cerrados no admite asientos nuevos ni
-- anulaciones, aunque sus meses se hubieran reabierto por fuera.
-- ---------------------------------------------------------------------------

create or replace function public._validar_periodo_abierto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mes date;
  v_anio int;
begin
  if new.fecha is null then
    return new;
  end if;

  v_mes := date_trunc('month', new.fecha)::date;
  v_anio := extract(year from new.fecha)::int;

  if exists (
    select 1
    from public.cierres_resultados c
    where c.anio = v_anio
  ) then
    raise exception 'el año % tiene los resultados cerrados; no se pueden crear ni anular asientos con esa fecha',
      v_anio
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.periodos_contables p
    where p.periodo = v_mes
      and p.estado = 'cerrado'
  ) then
    raise exception 'el periodo % está cerrado; no se pueden crear ni anular asientos con esa fecha',
      to_char(v_mes, 'YYYY-MM')
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: reabrir un mes. Un año con resultados cerrados no se reabre.
-- ---------------------------------------------------------------------------

create or replace function public.reabrir_periodo(p_periodo date)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_mes date;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_periodo is null then
    raise exception 'el periodo es obligatorio' using errcode = '22023';
  end if;

  v_mes := date_trunc('month', p_periodo)::date;

  if exists (
    select 1
    from public.cierres_resultados c
    where c.anio = extract(year from v_mes)::int
  ) then
    raise exception 'el año % tiene los resultados cerrados; no se puede reabrir el periodo',
      extract(year from v_mes)::int
      using errcode = '23514';
  end if;

  insert into public.periodos_contables as p (periodo, estado, cerrado_en, cerrado_por, actualizado_en)
  values (v_mes, 'abierto', null, null, now())
  on conflict (periodo) do update
  set estado = 'abierto', cerrado_en = null, cerrado_por = null, actualizado_en = now();

  return v_mes;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: cierre de resultados del año contra 3202 Utilidad del ejercicio.
-- Solo ejercicios terminados; al cerrar marca los 12 meses del año.
-- ---------------------------------------------------------------------------

create or replace function public.cerrar_resultados_anio(p_anio int)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_anio int;
  v_fecha date;
  v_existente uuid;
  v_linea record;
  v_lineas jsonb := '[]'::jsonb;
  v_debitos numeric(14,2) := 0;
  v_creditos numeric(14,2) := 0;
  v_diferencia numeric(14,2);
  v_utilidad_id uuid;
  v_asiento_id uuid;
  v_total numeric(14,2);
  v_mes int;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  -- Solo se cierran ejercicios terminados: el año en curso sigue abierto.
  v_anio := coalesce(p_anio, extract(year from current_date)::int - 1);

  if v_anio < 2000 then
    raise exception 'año inválido para cerrar resultados' using errcode = '22023';
  end if;

  if v_anio >= extract(year from current_date)::int then
    raise exception 'solo se pueden cerrar los resultados de años terminados; el año % está en curso', v_anio
      using errcode = '22023';
  end if;

  -- Serializa dos cierres simultáneos del mismo año.
  perform pg_advisory_xact_lock(hashtext('cierre_resultados_' || v_anio::text));

  select c.asiento_id into v_existente
  from public.cierres_resultados c
  where c.anio = v_anio;

  if v_existente is not null then
    return v_existente;
  end if;

  v_fecha := make_date(v_anio, 12, 31);

  for v_linea in
    select
      c.id,
      c.codigo,
      c.nombre,
      round(sum(l.debito - l.credito), 2) as neto
    from public.asientos a
    join public.asiento_lineas l on l.asiento_id = a.id
    join public.cuentas c on c.id = l.cuenta_id
    where a.fecha between make_date(v_anio, 1, 1) and v_fecha
      and c.tipo in ('ingreso', 'costo', 'gasto')
      and c.acepta_movimientos
    group by c.id, c.codigo, c.nombre
    having round(sum(l.debito - l.credito), 2) <> 0
    order by c.codigo
  loop
    if v_linea.neto > 0 then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_linea.id,
        'descripcion', 'Cierre de ' || v_linea.codigo || ' ' || v_linea.nombre,
        'debito', 0,
        'credito', v_linea.neto
      ));
      v_creditos := v_creditos + v_linea.neto;
    else
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_linea.id,
        'descripcion', 'Cierre de ' || v_linea.codigo || ' ' || v_linea.nombre,
        'debito', -v_linea.neto,
        'credito', 0
      ));
      v_debitos := v_debitos + (-v_linea.neto);
    end if;
  end loop;

  if jsonb_array_length(v_lineas) = 0 then
    raise exception 'no hay saldos de ingresos, costos o gastos que cerrar en el año %', v_anio
      using errcode = '22023';
  end if;

  select c.id into v_utilidad_id
  from public.cuentas c
  where c.codigo = '3202';

  if v_utilidad_id is null then
    raise exception 'falta la cuenta 3202 Utilidad del ejercicio' using errcode = '22023';
  end if;

  v_diferencia := v_debitos - v_creditos;

  if v_diferencia > 0 then
    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', v_utilidad_id,
      'descripcion', 'Utilidad del ejercicio ' || v_anio,
      'debito', 0,
      'credito', v_diferencia
    ));
    v_creditos := v_creditos + v_diferencia;
  elsif v_diferencia < 0 then
    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', v_utilidad_id,
      'descripcion', 'Pérdida del ejercicio ' || v_anio,
      'debito', -v_diferencia,
      'credito', 0
    ));
    v_debitos := v_debitos + (-v_diferencia);
  end if;

  v_total := v_debitos;

  -- El asiento de cierre se crea antes de marcar el año: el trigger
  -- `_validar_periodo_abierto` rechaza asientos de años ya cerrados.
  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Cierre de resultados ' || v_anio,
    'manual',
    null,
    v_lineas
  );

  insert into public.cierres_resultados (anio, asiento_id, total, creado_por)
  values (v_anio, v_asiento_id, v_total, auth.uid());

  -- Cierra los 12 meses del año (los que ya estaban cerrados conservan su
  -- fecha y usuario de cierre). Sin esto, un mes abierto dejaba pasar
  -- asientos de ingresos/costos/gastos que el cierre anual ya no recogería.
  for v_mes in 1..12 loop
    insert into public.periodos_contables as p (periodo, estado, cerrado_en, cerrado_por, actualizado_en)
    values (make_date(v_anio, v_mes, 1), 'cerrado', now(), auth.uid(), now())
    on conflict (periodo) do update
    set
      estado = 'cerrado',
      cerrado_en = case when p.estado = 'cerrado' then p.cerrado_en else now() end,
      cerrado_por = case when p.estado = 'cerrado' then p.cerrado_por else auth.uid() end,
      actualizado_en = now();
  end loop;

  return v_asiento_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reportes: el asiento de cierre no es actividad del período. Se excluye del
-- Estado de Resultados (si no, el año cerrado queda en RD$0.00).
-- ---------------------------------------------------------------------------

create or replace function public.reporte_estado_resultados(p_desde date, p_hasta date)
returns table (
  tipo text,
  cuenta_codigo text,
  cuenta_nombre text,
  monto numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.tipo,
    c.codigo,
    c.nombre,
    round(
      case
        when c.tipo = 'ingreso' then sum(l.credito) - sum(l.debito)
        else sum(l.debito) - sum(l.credito)
      end,
      2
    )
  from public.asientos a
  join public.asiento_lineas l on l.asiento_id = a.id
  join public.cuentas c on c.id = l.cuenta_id
  where a.fecha between p_desde and p_hasta
    and c.tipo in ('ingreso', 'costo', 'gasto')
    and not exists (
      select 1
      from public.cierres_resultados cr
      where cr.asiento_id = a.id
    )
  group by c.id, c.codigo, c.nombre, c.tipo
  having sum(l.debito) <> 0 or sum(l.credito) <> 0
  order by array_position(array['ingreso', 'costo', 'gasto'], c.tipo), c.codigo;
$$;

create or replace function public.reporte_estado_resultados_centro(
  p_desde date,
  p_hasta date,
  p_centro_costo uuid default null
)
returns table (
  tipo text,
  cuenta_codigo text,
  cuenta_nombre text,
  monto numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.tipo,
    c.codigo,
    c.nombre,
    round(
      case
        when c.tipo = 'ingreso' then sum(l.credito) - sum(l.debito)
        else sum(l.debito) - sum(l.credito)
      end,
      2
    )
  from public.asientos a
  join public.asiento_lineas l on l.asiento_id = a.id
  join public.cuentas c on c.id = l.cuenta_id
  where a.fecha between p_desde and p_hasta
    and c.tipo in ('ingreso', 'costo', 'gasto')
    and (p_centro_costo is null or l.centro_costo_id = p_centro_costo)
    and not exists (
      select 1
      from public.cierres_resultados cr
      where cr.asiento_id = a.id
    )
  group by c.id, c.codigo, c.nombre, c.tipo
  having sum(l.debito) <> 0 or sum(l.credito) <> 0
  order by array_position(array['ingreso', 'costo', 'gasto'], c.tipo), c.codigo;
$$;

-- ---------------------------------------------------------------------------
-- Permisos: los mismos de su migración original (create or replace no los
-- cambia; se repiten para que la migración sea explícita e idempotente).
-- ---------------------------------------------------------------------------

revoke all on function public._validar_periodo_abierto() from public, anon, authenticated;
revoke all on function public.reabrir_periodo(date) from public, anon, authenticated;
revoke all on function public.cerrar_resultados_anio(int) from public, anon, authenticated;
revoke all on function public.reporte_estado_resultados(date, date) from public, anon, authenticated;
revoke all on function public.reporte_estado_resultados_centro(date, date, uuid) from public, anon, authenticated;

grant execute on function public.reabrir_periodo(date) to authenticated;
grant execute on function public.cerrar_resultados_anio(int) to authenticated;
grant execute on function public.reporte_estado_resultados(date, date) to authenticated;
grant execute on function public.reporte_estado_resultados_centro(date, date, uuid) to authenticated;

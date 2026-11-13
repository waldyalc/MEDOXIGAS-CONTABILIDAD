-- ---------------------------------------------------------------------------
-- Caja chica y gastos menores con B13 automático (como Alegra)
-- Migración aditiva y reintentable: no borra ni cambia datos existentes.
-- ---------------------------------------------------------------------------

insert into public.cuentas (codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos, es_caja_banco)
select '1106', 'Caja chica', 'activo', 'debito', p.id, true, true
from public.cuentas p
where p.codigo = '11'
on conflict (codigo) do nothing;

insert into public.cuentas (codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos)
select v.codigo, v.nombre, 'gasto', 'debito', p.id, true
from (values
  ('6105', 'Combustibles y lubricantes'),
  ('6106', 'Agua'),
  ('6107', 'Papelería y útiles de oficina')
) as v(codigo, nombre)
join public.cuentas p on p.codigo = '6'
on conflict (codigo) do nothing;

insert into public.config_contable (clave, cuenta_id)
select 'caja_chica', c.id
from public.cuentas c
where c.codigo = '1106'
on conflict (clave) do nothing;

insert into public.numeraciones (tipo_comprobante, nombre, prefijo, siguiente, hasta, activa)
select '13', 'Gastos menores', 'B13', 1, 100000, true
where not exists (
  select 1 from public.numeraciones n where n.tipo_comprobante = '13'
);

alter table public.gastos_menores add column if not exists ncf text unique;

alter table public.gastos_menores
  alter column cuenta_pago_id set default public._cuenta_config('caja_chica');

create or replace function public.crear_gasto_menor(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_gasto_id uuid;
  v_fecha date;
  v_contacto_id uuid;
  v_cuenta_gasto uuid;
  v_cuenta_pago uuid;
  v_cuenta public.cuentas%rowtype;
  v_descripcion text;
  v_subtotal numeric(14,2);
  v_itbis_tasa numeric(5,2);
  v_itbis numeric(14,2);
  v_total numeric(14,2);
  v_num public.numeraciones%rowtype;
  v_ncf text;
  v_asiento_id uuid;
  v_lineas jsonb;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del gasto requeridos' using errcode = '22023';
  end if;

  v_descripcion := nullif(trim(p->>'descripcion'), '');
  if v_descripcion is null then
    raise exception 'la descripción del gasto es obligatoria' using errcode = '22023';
  end if;

  v_subtotal := round(coalesce((p->>'subtotal')::numeric, 0), 2);
  if v_subtotal <= 0 then
    raise exception 'el subtotal del gasto debe ser mayor a cero' using errcode = '22023';
  end if;

  v_itbis_tasa := round(coalesce((p->>'itbis_tasa')::numeric, 0), 2);
  if v_itbis_tasa < 0 or v_itbis_tasa > 100 then
    raise exception 'la tasa de ITBIS es inválida' using errcode = '22023';
  end if;

  v_itbis := round(v_subtotal * v_itbis_tasa / 100, 2);
  v_total := round(v_subtotal + v_itbis, 2);

  v_fecha := coalesce((p->>'fecha')::date, current_date);

  v_contacto_id := nullif(p->>'contacto_id', '')::uuid;
  if v_contacto_id is not null and not exists (select 1 from public.contactos c where c.id = v_contacto_id) then
    raise exception 'contacto no encontrado' using errcode = '22023';
  end if;

  v_cuenta_gasto := coalesce(
    nullif(p->>'cuenta_gasto_id', '')::uuid,
    public._cuenta_config('gastos_generales')
  );
  v_cuenta_pago := coalesce(
    nullif(p->>'cuenta_pago_id', '')::uuid,
    public._cuenta_config('caja_chica')
  );

  select * into v_cuenta
  from public.cuentas c
  where c.id = v_cuenta_gasto and c.activa;

  if not found then
    raise exception 'cuenta de gasto no encontrada' using errcode = '22023';
  end if;
  if not v_cuenta.acepta_movimientos or v_cuenta.tipo not in ('gasto', 'costo') then
    raise exception 'Elige una cuenta de detalle, no una cuenta padre' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.cuentas c
    where c.id = v_cuenta_pago and c.activa and c.es_caja_banco
  ) then
    raise exception 'la cuenta de pago debe ser de caja o banco' using errcode = '22023';
  end if;

  select * into v_num
  from public.numeraciones n
  where n.tipo_comprobante = '13' and n.activa
  order by n.id
  limit 1
  for update;

  if not found then
    raise exception 'no hay numeración activa para gastos menores (13)' using errcode = '22023';
  end if;
  if v_num.hasta is not null and v_num.siguiente > v_num.hasta then
    raise exception 'la numeración % está agotada', v_num.prefijo using errcode = '22023';
  end if;
  if v_num.vence is not null and v_num.vence < v_fecha then
    raise exception 'la numeración % está vencida', v_num.prefijo using errcode = '22023';
  end if;

  v_ncf := v_num.prefijo || lpad(v_num.siguiente::text, 8, '0');
  update public.numeraciones set siguiente = siguiente + 1 where id = v_num.id;

  insert into public.gastos_menores (
    ncf, fecha, contacto_id, cuenta_gasto_id, cuenta_pago_id, descripcion,
    subtotal, itbis_tasa, itbis, total, creado_por
  )
  values (
    v_ncf, v_fecha, v_contacto_id, v_cuenta_gasto, v_cuenta_pago, v_descripcion,
    v_subtotal, v_itbis_tasa, v_itbis, v_total, auth.uid()
  )
  returning id into v_gasto_id;

  v_lineas := jsonb_build_array(
    jsonb_build_object(
      'cuenta_id', v_cuenta_gasto,
      'debito', v_subtotal,
      'credito', 0,
      'contacto_id', v_contacto_id,
      'descripcion', left(v_descripcion, 80)
    ),
    jsonb_build_object(
      'cuenta_id', v_cuenta_pago,
      'debito', 0,
      'credito', v_total,
      'descripcion', 'Pago gasto menor'
    )
  );

  if v_itbis > 0 then
    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', public._cuenta_config('itbis_adelantado'),
      'debito', v_itbis,
      'credito', 0,
      'descripcion', 'ITBIS gasto menor'
    ));
  end if;

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Gasto menor: ' || left(v_descripcion, 80),
    'gasto_menor',
    v_gasto_id,
    v_lineas
  );

  update public.gastos_menores set asiento_id = v_asiento_id where id = v_gasto_id;

  return v_gasto_id;
end;
$$;

revoke all on function public.crear_gasto_menor(jsonb) from public, anon, authenticated;
grant execute on function public.crear_gasto_menor(jsonb) to authenticated;

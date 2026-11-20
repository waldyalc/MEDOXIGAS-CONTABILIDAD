-- ---------------------------------------------------------------------------
-- Clasificación DGII por cuenta contable y validación del dígito verificador
-- de RNC/cédula en los contactos.
--
-- Alegra clasifica cada renglón del 606 por la CUENTA contable del gasto/costo:
--   · Categoría DGII (columna "Tipo de bienes y servicios comprados" del 606)
--   · Tipo de compra (bienes/servicio: decide en qué columna del 606 cae el monto)
-- y cada renglón del 607 por el Tipo de ingreso de la cuenta de ingreso.
-- Una cuenta sin clasificar deja el documento FUERA del reporte (los reportes
-- de F2 lo excluyen con el motivo literal de Alegra); null = sin clasificar.
--
-- Categoría DGII (códigos del 606):
--   01 Gastos de personal
--   02 Gastos por trabajos, suministros y servicios
--   03 Arrendamientos
--   04 Gastos de activos fijos
--   05 Gastos de representación
--   06 Otras deducciones admitidas
--   07 Gastos financieros
--   08 Gastos extraordinarios
--   09 Compras y gastos que hacen parte del costo de venta
--   10 Adquisiciones de activos
--
-- Tipo de compra (606): 'bienes' | 'servicio'
--
-- Tipo de ingreso (607), a 1 dígito como lo exporta Alegra:
--   1 Ingresos por operaciones (No financieros)
--   2 Ingresos financieros
--   3 Ingresos extraordinarios
--   4 Ingresos por arrendamientos
--   5 Ingresos por ventas de activos depreciables
--   6 Otros ingresos
--
-- También se valida el dígito verificador DGII del RNC (9 dígitos) y de la
-- cédula (11 dígitos) al crear o actualizar un contacto, como hace Alegra
-- (rechazó 132000015 y aceptó 132000013 y 402123455). Pasaporte y valor vacío
-- no se validan.
--
-- Migración aditiva y reintentable: columnas con IF NOT EXISTS, semilla con
-- coalesce (no pisa lo configurado a mano) y retenciones con ON CONFLICT.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Clasificación fiscal de las cuentas
-- ---------------------------------------------------------------------------

alter table public.cuentas
  add column if not exists categoria_dgii text
    check (categoria_dgii is null or categoria_dgii in (
      '01', '02', '03', '04', '05', '06', '07', '08', '09', '10'
    )),
  add column if not exists tipo_compra text
    check (tipo_compra is null or tipo_compra in ('bienes', 'servicio')),
  add column if not exists tipo_ingreso text
    check (tipo_ingreso is null or tipo_ingreso in ('1', '2', '3', '4', '5', '6'));

comment on column public.cuentas.categoria_dgii is
  'Categoría DGII del 606 (Tipo de bienes y servicios comprados): '
  '01 Gastos de personal; 02 Gastos por trabajos, suministros y servicios; '
  '03 Arrendamientos; 04 Gastos de activos fijos; 05 Gastos de representación; '
  '06 Otras deducciones admitidas; 07 Gastos financieros; '
  '08 Gastos extraordinarios; 09 Compras y gastos que hacen parte del costo de venta; '
  '10 Adquisiciones de activos. Null = sin clasificar (el documento se excluye del 606).';

comment on column public.cuentas.tipo_compra is
  'Tipo de compra del 606: bienes o servicio. Decide en qué columna del 606 '
  'cae el monto del renglón. Null = sin clasificar (el documento se excluye del 606).';

comment on column public.cuentas.tipo_ingreso is
  'Tipo de ingreso del 607 (a 1 dígito, como exporta Alegra): '
  '1 Ingresos por operaciones (No financieros); 2 Ingresos financieros; '
  '3 Ingresos extraordinarios; 4 Ingresos por arrendamientos; '
  '5 Ingresos por ventas de activos depreciables; 6 Otros ingresos. '
  'Null = sin clasificar (el documento se excluye del 607).';

-- Semilla por nombre de cuenta (idempotente: no pisa una clasificación ya
-- puesta). Las cuentas sin clasificar quedan en null a propósito.
update public.cuentas c
set categoria_dgii = coalesce(c.categoria_dgii, v.categoria_dgii),
    tipo_compra = coalesce(c.tipo_compra, v.tipo_compra),
    tipo_ingreso = coalesce(c.tipo_ingreso, v.tipo_ingreso)
from (values
  ('Ventas de productos', null, null, '1'),
  ('Ventas de servicios', null, null, '1'),
  ('Inventario de mercancía', '09', 'bienes', null),
  ('Costo de ventas', '09', 'bienes', null),
  ('Gastos generales', '02', 'servicio', null)
) as v(nombre, categoria_dgii, tipo_compra, tipo_ingreso)
where c.nombre = v.nombre;

-- ---------------------------------------------------------------------------
-- RPC: clasificación DGII de una cuenta (solo admin/contador)
-- ---------------------------------------------------------------------------

create or replace function public.actualizar_clasificacion_dgii(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_cuenta public.cuentas%rowtype;
  v_categoria text;
  v_tipo_compra text;
  v_tipo_ingreso text;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or nullif(p->>'cuenta_id', '') is null then
    raise exception 'la cuenta es obligatoria' using errcode = '22023';
  end if;

  begin
    v_id := (p->>'cuenta_id')::uuid;
  exception when invalid_text_representation then
    raise exception 'cuenta no encontrada' using errcode = '22023';
  end;

  select * into v_cuenta
  from public.cuentas c
  where c.id = v_id;

  if not found then
    raise exception 'cuenta no encontrada' using errcode = '22023';
  end if;
  if not v_cuenta.acepta_movimientos then
    raise exception 'solo se clasifican cuentas de movimiento' using errcode = '22023';
  end if;

  if p ? 'categoria_dgii' then
    v_categoria := nullif(trim(p->>'categoria_dgii'), '');
    if v_categoria is not null and v_categoria not in (
      '01', '02', '03', '04', '05', '06', '07', '08', '09', '10'
    ) then
      raise exception 'categoría DGII inválida' using errcode = '22023';
    end if;
  end if;

  if p ? 'tipo_compra' then
    v_tipo_compra := nullif(trim(p->>'tipo_compra'), '');
    if v_tipo_compra is not null and v_tipo_compra not in ('bienes', 'servicio') then
      raise exception 'tipo de compra inválido' using errcode = '22023';
    end if;
  end if;

  if p ? 'tipo_ingreso' then
    v_tipo_ingreso := nullif(trim(p->>'tipo_ingreso'), '');
    if v_tipo_ingreso is not null and v_tipo_ingreso not in ('1', '2', '3', '4', '5', '6') then
      raise exception 'tipo de ingreso inválido' using errcode = '22023';
    end if;
  end if;

  update public.cuentas c
  set categoria_dgii = case when p ? 'categoria_dgii' then v_categoria else c.categoria_dgii end,
      tipo_compra = case when p ? 'tipo_compra' then v_tipo_compra else c.tipo_compra end,
      tipo_ingreso = case when p ? 'tipo_ingreso' then v_tipo_ingreso else c.tipo_ingreso end
  where c.id = v_id;

  return v_id;
end;
$$;

revoke all on function public.actualizar_clasificacion_dgii(jsonb)
  from public, anon, authenticated;
grant execute on function public.actualizar_clasificacion_dgii(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Dígito verificador DGII de RNC (9) y cédula (11)
--
-- RNC: se ignoran los separadores, los pesos [7,9,8,6,4,3,2] se aplican a
-- los dígitos en posiciones 2..8 (el primero NO se pondera), resto = suma % 11,
-- dv = (11 - resto) % 11 y se compara con el noveno dígito.
-- Cédula: pesos [1,2,1,2,1,2,1,2,1,2] sobre los 10 primeros; si el producto
-- es >= 10 se le restan 9; dv = (10 - (suma % 10)) % 10 contra el dígito 11.
-- Cualquier otra longitud es inválida.
-- ---------------------------------------------------------------------------

create or replace function public._rnc_digito_valido(p_valor text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digitos text;
  v_pesos_rnc int[] := array[7, 9, 8, 6, 4, 3, 2];
  v_pesos_cedula int[] := array[1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
  v_suma int := 0;
  v_producto int;
  v_dv int;
  i int;
begin
  v_digitos := regexp_replace(coalesce(p_valor, ''), '[^0-9]', '', 'g');

  if length(v_digitos) = 9 then
    for i in 1..7 loop
      v_suma := v_suma + substr(v_digitos, i + 1, 1)::int * v_pesos_rnc[i];
    end loop;

    v_dv := (11 - (v_suma % 11)) % 11;
    return v_dv = substr(v_digitos, 9, 1)::int;
  end if;

  if length(v_digitos) = 11 then
    for i in 1..10 loop
      v_producto := substr(v_digitos, i, 1)::int * v_pesos_cedula[i];
      if v_producto >= 10 then
        v_producto := v_producto - 9;
      end if;
      v_suma := v_suma + v_producto;
    end loop;

    v_dv := (10 - (v_suma % 10)) % 10;
    return v_dv = substr(v_digitos, 11, 1)::int;
  end if;

  return false;
end;
$$;

revoke all on function public._rnc_digito_valido(text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- crear_contacto / actualizar_contacto: validan el dígito verificador antes
-- de delegar en las versiones vigentes (renombradas como internas).
-- ---------------------------------------------------------------------------

alter function public.crear_contacto(jsonb)
  rename to _crear_contacto_limite;

revoke all on function public._crear_contacto_limite(jsonb)
  from public, anon, authenticated;

alter function public.actualizar_contacto(uuid, jsonb)
  rename to _actualizar_contacto_limite;

revoke all on function public._actualizar_contacto_limite(uuid, jsonb)
  from public, anon, authenticated;

create or replace function public.crear_contacto(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_tipo_identificacion text;
  v_valor text;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  v_tipo_identificacion := nullif(p->>'tipo_identificacion', '');
  v_valor := nullif(trim(p->>'rnc_cedula'), '');

  if v_valor is not null and v_tipo_identificacion = 'rnc' then
    if v_valor !~ '^[0-9]{9}$' then
      raise exception 'El RNC debe tener 9 dígitos.' using errcode = '22023';
    end if;
    if not public._rnc_digito_valido(v_valor) then
      raise exception 'La comprobación del dígito verificador de la identificación: % fue errónea.',
        v_valor using errcode = '22023';
    end if;
  elsif v_valor is not null and v_tipo_identificacion = 'cedula' then
    if v_valor !~ '^[0-9]{11}$' then
      raise exception 'La cédula debe tener 11 dígitos.' using errcode = '22023';
    end if;
    if not public._rnc_digito_valido(v_valor) then
      raise exception 'La comprobación del dígito verificador de la identificación: % fue errónea.',
        v_valor using errcode = '22023';
    end if;
  end if;

  return public._crear_contacto_limite(p);
end;
$$;

create or replace function public.actualizar_contacto(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_contacto public.contactos%rowtype;
  v_tipo_identificacion text;
  v_valor text;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del contacto requeridos' using errcode = '22023';
  end if;

  -- Solo se valida cuando el formulario envía la identificación; así una
  -- edición de otros campos no bloquea contactos viejos con datos inválidos.
  if p ? 'tipo_identificacion' or p ? 'rnc_cedula' then
    select * into v_contacto
    from public.contactos c
    where c.id = p_id;

    if not found then
      raise exception 'contacto no encontrado' using errcode = '22023';
    end if;

    v_tipo_identificacion := case
      when p ? 'tipo_identificacion' then nullif(p->>'tipo_identificacion', '')
      else v_contacto.tipo_identificacion
    end;
    v_valor := case
      when p ? 'rnc_cedula' then nullif(trim(p->>'rnc_cedula'), '')
      else nullif(trim(v_contacto.rnc_cedula), '')
    end;

    if v_valor is not null and v_tipo_identificacion = 'rnc' then
      if v_valor !~ '^[0-9]{9}$' then
        raise exception 'El RNC debe tener 9 dígitos.' using errcode = '22023';
      end if;
      if not public._rnc_digito_valido(v_valor) then
        raise exception 'La comprobación del dígito verificador de la identificación: % fue errónea.',
          v_valor using errcode = '22023';
      end if;
    elsif v_valor is not null and v_tipo_identificacion = 'cedula' then
      if v_valor !~ '^[0-9]{11}$' then
        raise exception 'La cédula debe tener 11 dígitos.' using errcode = '22023';
      end if;
      if not public._rnc_digito_valido(v_valor) then
        raise exception 'La comprobación del dígito verificador de la identificación: % fue errónea.',
          v_valor using errcode = '22023';
      end if;
    end if;
  end if;

  return public._actualizar_contacto_limite(p_id, p);
end;
$$;

revoke all on function public.crear_contacto(jsonb)
  from public, anon, authenticated;
grant execute on function public.crear_contacto(jsonb) to authenticated;

revoke all on function public.actualizar_contacto(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.actualizar_contacto(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Retenciones del diálogo de venta de Alegra
--
-- Cubre las opciones del diálogo de factura de venta: Retención ITBIS
-- (30/75/100 %), Alquileres (10/15 %), Honorarios por servicios (10/15 %),
-- Otras rentas Ley 11-92 (10/15 %) y Otras rentas Decreto 139-98 (2 %).
-- ITBIS 30 %, ITBIS 100 %, ISR 10 % honorarios e ISR 5 % alquileres ya vienen
-- de la semilla de 20261115100000; aquí van las que faltan, sin duplicarlas.
-- ---------------------------------------------------------------------------

-- Nota: el SELECT va en un WITH a propósito. Un INSERT ... SELECT cuyo SELECT
-- termina en JOIN ... ON seguido de ON CONFLICT es una ambigüedad sintáctica
-- conocida del parser de Postgres; separado en CTE no hay ambigüedad posible.
with faltantes as (
  select v.nombre, v.tipo, v.porcentaje, cp.id as cuenta_id, ca.id as cuenta_anticipo_id
  from (values
    ('ITBIS 75 %', 'itbis', 75, '2103', '1107'),
    ('ISR 10 % alquileres', 'isr', 10, '2104', '1108'),
    ('ISR 15 % honorarios', 'isr', 15, '2104', '1108'),
    ('ISR 15 % alquileres', 'isr', 15, '2104', '1108'),
    ('ISR 10 % otras rentas', 'isr', 10, '2104', '1108'),
    ('ISR 15 % otras rentas', 'isr', 15, '2104', '1108'),
    ('ISR 2 % otras rentas', 'isr', 2, '2104', '1108')
  ) as v(nombre, tipo, porcentaje, codigo_pasivo, codigo_activo)
  join public.cuentas cp on cp.codigo = v.codigo_pasivo
  join public.cuentas ca on ca.codigo = v.codigo_activo
)
insert into public.retenciones (nombre, tipo, porcentaje, cuenta_id, cuenta_anticipo_id, activa)
select nombre, tipo, porcentaje, cuenta_id, cuenta_anticipo_id, true
from faltantes
on conflict (nombre) do nothing;

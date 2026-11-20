-- ---------------------------------------------------------------------------
-- Nómina RD (fase 3D/3E): RPC de configuración, empleados y novedades
-- recurrentes.
--
-- Las fases 3A (catálogos) y 3B (motor) crearon las tablas y el ciclo
-- periodo → cálculo → contabilización → pago. Faltaban las RPC que la capa
-- TypeScript (`src/lib/nomina/acciones.ts`) ya invoca para guardar la
-- configuración de la empresa, el mapeo contable, los parámetros legales, la
-- ficha del empleado y sus novedades recurrentes, más `nomina_agregar_empleados`
-- (la vía para corregir la plantilla de un periodo existente) y el alta/edición
-- de conceptos personalizados (Configuración → Nómina → Conceptos).
--
-- Contrato: docs/dominio-nomina.md §6.2–6.4.
--
-- Reglas comunes: security definer, search_path = '', rol admin/contador
-- (lector recibe 42501), errores en español y escritura solo por estas RPC.
-- No crea tablas, no cambia RLS y no toca datos sembrados.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Helpers de entrada
-- ---------------------------------------------------------------------------

-- Convierte un texto JSON a uuid sin dejar escapar un 22P02 en inglés.
create or replace function public._nomina_uuid(p_valor text, p_mensaje text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_texto text := nullif(btrim(coalesce(p_valor, '')), '');
  v_uuid uuid;
begin
  if v_texto is null then
    return null;
  end if;

  begin
    v_uuid := v_texto::uuid;
  exception
    when invalid_text_representation then
      raise exception '%', p_mensaje using errcode = '22023';
  end;

  return v_uuid;
end;
$$;

-- Convierte un texto JSON a numeric con mensaje en español.
create or replace function public._nomina_numero(p_valor text, p_mensaje text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_texto text := nullif(btrim(coalesce(p_valor, '')), '');
  v_numero numeric;
begin
  if v_texto is null then
    return null;
  end if;

  begin
    v_numero := v_texto::numeric;
  exception
    when invalid_text_representation then
      raise exception '%', p_mensaje using errcode = '22023';
  end;

  return v_numero;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helper: valida la ficha del empleado antes de guardarla
--
-- Recibe la fila ya normalizada. Duplica a propósito los checks de la tabla
-- para devolver mensajes en español con el código correcto (22023) en vez del
-- texto genérico de una restricción.
-- ---------------------------------------------------------------------------

create or replace function public._nomina_validar_empleado(p_empleado public.empleados)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_empleado.tipo_identificacion is null
     or p_empleado.tipo_identificacion not in ('cedula', 'pasaporte', 'residencia') then
    raise exception 'El tipo de identificación no es válido.' using errcode = '22023';
  end if;

  if p_empleado.tipo_identificacion = 'cedula' then
    if p_empleado.identificacion is null or p_empleado.identificacion !~ '^[0-9]{11}$' then
      raise exception 'La cédula debe tener 11 dígitos.' using errcode = '22023';
    end if;
    if not public._rnc_digito_valido(p_empleado.identificacion) then
      raise exception 'La comprobación del dígito verificador de la identificación: % fue errónea.',
        p_empleado.identificacion using errcode = '22023';
    end if;
  elsif p_empleado.identificacion is null or btrim(p_empleado.identificacion) = '' then
    raise exception 'La identificación es obligatoria.' using errcode = '22023';
  end if;

  if p_empleado.primer_nombre is null or btrim(p_empleado.primer_nombre) = '' then
    raise exception 'El primer nombre es obligatorio.' using errcode = '22023';
  end if;

  if p_empleado.primer_apellido is null or btrim(p_empleado.primer_apellido) = '' then
    raise exception 'El primer apellido es obligatorio.' using errcode = '22023';
  end if;

  if p_empleado.fecha_ingreso is null then
    raise exception 'La fecha de ingreso es obligatoria.' using errcode = '22023';
  end if;

  if p_empleado.tipo_contrato is null or p_empleado.tipo_contrato not in ('indefinido', 'definido') then
    raise exception 'El tipo de contrato no es válido.' using errcode = '22023';
  end if;

  if p_empleado.tipo_contrato = 'definido' and p_empleado.fecha_fin is null then
    raise exception 'El contrato definido necesita una fecha de fin.' using errcode = '22023';
  end if;

  if p_empleado.fecha_fin is not null and p_empleado.fecha_fin < p_empleado.fecha_ingreso then
    raise exception 'La fecha de fin no puede ser anterior a la fecha de ingreso.' using errcode = '22023';
  end if;

  if p_empleado.frecuencia_pago is null
     or p_empleado.frecuencia_pago not in ('quincenal', 'mensual') then
    raise exception 'La frecuencia de pago debe ser quincenal o mensual.' using errcode = '22023';
  end if;

  if p_empleado.segmento_contable is null
     or p_empleado.segmento_contable not in ('administrativa', 'operativa', 'ventas') then
    raise exception 'El segmento contable no es válido.' using errcode = '22023';
  end if;

  if p_empleado.salario_mensual is null or p_empleado.salario_mensual <= 0 then
    raise exception 'El salario mensual debe ser mayor que cero.' using errcode = '22023';
  end if;

  if p_empleado.metodo_pago is null
     or p_empleado.metodo_pago not in ('efectivo', 'transferencia', 'cheque') then
    raise exception 'El método de pago no es válido.' using errcode = '22023';
  end if;

  if p_empleado.metodo_pago = 'transferencia' then
    if coalesce(btrim(p_empleado.banco_nombre), '') = ''
       or coalesce(btrim(p_empleado.numero_cuenta_banco), '') = ''
       or p_empleado.tipo_cuenta_banco is null then
      raise exception 'Si el pago es por transferencia, indica el banco, el tipo y el número de cuenta.'
        using errcode = '22023';
    end if;
  end if;

  if p_empleado.tipo_cuenta_banco is not null
     and p_empleado.tipo_cuenta_banco not in ('ahorros', 'corriente') then
    raise exception 'El tipo de cuenta bancaria no es válido.' using errcode = '22023';
  end if;

  if p_empleado.clave_tss is not null and p_empleado.clave_tss !~ '^[0-9]{3}$' then
    raise exception 'La clave TSS debe tener 3 dígitos.' using errcode = '22023';
  end if;

  if p_empleado.correo is not null
     and p_empleado.correo !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'El correo no tiene un formato válido.' using errcode = '22023';
  end if;

  if p_empleado.centro_costo_id is not null
     and not exists (
       select 1 from public.centros_costo cc where cc.id = p_empleado.centro_costo_id
     ) then
    raise exception 'El centro de costo no existe.' using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helper: resuelve o crea el contacto del empleado
--
-- Si ya existe un contacto con la misma identificación y tipo mapeado, se
-- vincula (nunca se duplica). Si ese contacto ya pertenece a otro empleado,
-- falla con 23505. Si no existe, se crea con el nombre completo.
-- ---------------------------------------------------------------------------

create or replace function public._nomina_contacto_empleado(p_empleado public.empleados)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo_identificacion text;
  v_nombre text;
  v_contacto_id uuid;
begin
  v_tipo_identificacion := case p_empleado.tipo_identificacion
    when 'cedula' then 'cedula'
    else 'pasaporte'
  end;

  v_nombre := btrim(regexp_replace(
    concat_ws(
      ' ',
      p_empleado.primer_nombre,
      p_empleado.segundo_nombre,
      p_empleado.primer_apellido,
      p_empleado.segundo_apellido
    ),
    '\s+', ' ', 'g'
  ));

  select c.id into v_contacto_id
  from public.contactos c
  where c.rnc_cedula = p_empleado.identificacion
    and c.tipo_identificacion = v_tipo_identificacion
  order by c.creado_en, c.id
  limit 1;

  if v_contacto_id is not null then
    if exists (select 1 from public.empleados e where e.contacto_id = v_contacto_id) then
      raise exception 'Ya existe un empleado con esa identificación.' using errcode = '23505';
    end if;
    return v_contacto_id;
  end if;

  insert into public.contactos (
    tipo, nombre, rnc_cedula, tipo_identificacion, correo, telefono, direccion, activo
  )
  values (
    'ambos', v_nombre, p_empleado.identificacion, v_tipo_identificacion,
    p_empleado.correo, p_empleado.telefono, p_empleado.direccion, true
  )
  returning id into v_contacto_id;

  return v_contacto_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helper: sincroniza el contacto vinculado con la ficha del empleado
-- ---------------------------------------------------------------------------

create or replace function public._nomina_sincronizar_contacto(
  p_contacto_id uuid,
  p_empleado public.empleados
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.contactos c
  set
    nombre = btrim(regexp_replace(
      concat_ws(
        ' ',
        p_empleado.primer_nombre,
        p_empleado.segundo_nombre,
        p_empleado.primer_apellido,
        p_empleado.segundo_apellido
      ),
      '\s+', ' ', 'g'
    )),
    rnc_cedula = p_empleado.identificacion,
    tipo_identificacion = case p_empleado.tipo_identificacion
      when 'cedula' then 'cedula'
      else 'pasaporte'
    end,
    correo = p_empleado.correo,
    telefono = p_empleado.telefono,
    direccion = p_empleado.direccion
  where c.id = p_contacto_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: configuración de la empresa (fila única id = 1)
--
-- Actualización parcial: las claves omitidas no cambian; una clave null borra
-- el valor opcional. Si la fila no existe, se crea con los defaults.
-- ---------------------------------------------------------------------------

create or replace function public.nomina_guardar_config_empresa(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_config public.nomina_config_empresa%rowtype;
  v_cuenta public.cuentas%rowtype;
  v_riesgo text;
  v_categoria text;
  v_frecuencia text;
  v_cuenta_pago uuid;
  v_cuenta_salarios uuid;
  v_contacto_tss uuid;
  v_contacto_infotep uuid;
  v_contacto_dgii uuid;
  v_aplica_infotep boolean;
  v_provisiones boolean;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Datos de la configuración de nómina requeridos.' using errcode = '22023';
  end if;

  insert into public.nomina_config_empresa (id) values (1)
  on conflict (id) do nothing;

  select * into v_config
  from public.nomina_config_empresa c
  where c.id = 1
  for update;

  v_riesgo := case
    when p ? 'riesgo_laboral' then nullif(btrim(p->>'riesgo_laboral'), '')
    else v_config.riesgo_laboral
  end;
  if v_riesgo is null or v_riesgo not in ('tipo_1', 'tipo_2', 'tipo_3', 'tipo_4') then
    raise exception 'El riesgo laboral no es válido.' using errcode = '22023';
  end if;

  v_categoria := case
    when p ? 'categoria_empresa' then nullif(btrim(p->>'categoria_empresa'), '')
    else v_config.categoria_empresa
  end;
  if v_categoria is null or v_categoria not in ('micro', 'pequena', 'mediana', 'grande') then
    raise exception 'La categoría de la empresa no es válida.' using errcode = '22023';
  end if;

  v_frecuencia := case
    when p ? 'frecuencia_defecto' then nullif(btrim(p->>'frecuencia_defecto'), '')
    else v_config.frecuencia_defecto
  end;
  if v_frecuencia is null or v_frecuencia not in ('quincenal', 'mensual') then
    raise exception 'La frecuencia por defecto no es válida.' using errcode = '22023';
  end if;

  if p ? 'aplica_infotep' then
    if p->>'aplica_infotep' is null then
      raise exception 'El indicador de INFOTEP no es válido.' using errcode = '22023';
    end if;
    v_aplica_infotep := (p->>'aplica_infotep')::boolean;
  else
    v_aplica_infotep := v_config.aplica_infotep;
  end if;

  if p ? 'registrar_provisiones' then
    if p->>'registrar_provisiones' is null then
      raise exception 'El indicador de provisiones no es válido.' using errcode = '22023';
    end if;
    v_provisiones := (p->>'registrar_provisiones')::boolean;
  else
    v_provisiones := v_config.registrar_provisiones;
  end if;

  v_cuenta_pago := case
    when p ? 'cuenta_pago_defecto_id' then
      public._nomina_uuid(p->>'cuenta_pago_defecto_id', 'La cuenta de pago por defecto no es válida.')
    else v_config.cuenta_pago_defecto_id
  end;
  if v_cuenta_pago is not null then
    select * into v_cuenta from public.cuentas c where c.id = v_cuenta_pago;
    if not found then
      raise exception 'La cuenta de pago por defecto no existe.' using errcode = '22023';
    end if;
    if not v_cuenta.activa or not v_cuenta.es_caja_banco then
      raise exception 'La cuenta de pago por defecto debe ser una cuenta de caja o banco activa.'
        using errcode = '22023';
    end if;
  end if;

  v_cuenta_salarios := case
    when p ? 'cuenta_salarios_por_pagar_id' then
      public._nomina_uuid(
        p->>'cuenta_salarios_por_pagar_id',
        'La cuenta de salarios por pagar no es válida.'
      )
    else v_config.cuenta_salarios_por_pagar_id
  end;
  if v_cuenta_salarios is not null then
    select * into v_cuenta from public.cuentas c where c.id = v_cuenta_salarios;
    if not found then
      raise exception 'La cuenta de salarios por pagar no existe.' using errcode = '22023';
    end if;
    if not v_cuenta.activa or not v_cuenta.acepta_movimientos then
      raise exception 'La cuenta de salarios por pagar debe estar activa y aceptar movimientos.'
        using errcode = '22023';
    end if;
    if v_cuenta.tipo <> 'pasivo' then
      raise exception 'La cuenta de salarios por pagar debe ser de pasivo.' using errcode = '22023';
    end if;
  end if;

  v_contacto_tss := case
    when p ? 'contacto_tss_id' then
      public._nomina_uuid(p->>'contacto_tss_id', 'El contacto de TSS no es válido.')
    else v_config.contacto_tss_id
  end;
  if v_contacto_tss is not null
     and not exists (select 1 from public.contactos c where c.id = v_contacto_tss) then
    raise exception 'El contacto de TSS no existe.' using errcode = '22023';
  end if;

  v_contacto_infotep := case
    when p ? 'contacto_infotep_id' then
      public._nomina_uuid(p->>'contacto_infotep_id', 'El contacto de INFOTEP no es válido.')
    else v_config.contacto_infotep_id
  end;
  if v_contacto_infotep is not null
     and not exists (select 1 from public.contactos c where c.id = v_contacto_infotep) then
    raise exception 'El contacto de INFOTEP no existe.' using errcode = '22023';
  end if;

  v_contacto_dgii := case
    when p ? 'contacto_dgii_id' then
      public._nomina_uuid(p->>'contacto_dgii_id', 'El contacto de DGII no es válido.')
    else v_config.contacto_dgii_id
  end;
  if v_contacto_dgii is not null
     and not exists (select 1 from public.contactos c where c.id = v_contacto_dgii) then
    raise exception 'El contacto de DGII no existe.' using errcode = '22023';
  end if;

  update public.nomina_config_empresa c
  set
    riesgo_laboral = v_riesgo,
    categoria_empresa = v_categoria,
    aplica_infotep = v_aplica_infotep,
    frecuencia_defecto = v_frecuencia,
    cuenta_pago_defecto_id = v_cuenta_pago,
    cuenta_salarios_por_pagar_id = v_cuenta_salarios,
    registrar_provisiones = v_provisiones,
    contacto_tss_id = v_contacto_tss,
    contacto_infotep_id = v_contacto_infotep,
    contacto_dgii_id = v_contacto_dgii,
    actualizado_en = now()
  where c.id = 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: mapeo contable por segmento
--
-- Recibe { mapeos: [{ segmento, concepto_id, cuenta_gasto_id?, cuenta_pasivo_id? }] }
-- y hace upsert por (segmento, concepto_id). Valida la obligación por clase:
--   ingreso             → solo gasto (6110…6123)
--   deducción           → solo pasivo (2108…2115)
--   aporte y provisión  → gasto y pasivo
-- ---------------------------------------------------------------------------

create or replace function public.nomina_guardar_mapeo_contable(p jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_mapeos jsonb;
  v_fila jsonb;
  v_segmento text;
  v_concepto public.nomina_conceptos%rowtype;
  v_gasto uuid;
  v_pasivo uuid;
  v_guardados int := 0;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Datos del mapeo contable requeridos.' using errcode = '22023';
  end if;

  v_mapeos := p->'mapeos';
  if v_mapeos is null or jsonb_typeof(v_mapeos) <> 'array' then
    raise exception 'Los mapeos contables son inválidos.' using errcode = '22023';
  end if;
  if jsonb_array_length(v_mapeos) = 0 then
    raise exception 'Indica al menos un mapeo contable.' using errcode = '22023';
  end if;

  for v_fila in select * from jsonb_array_elements(v_mapeos) loop
    if jsonb_typeof(v_fila) <> 'object' then
      raise exception 'Cada mapeo contable debe ser un objeto.' using errcode = '22023';
    end if;

    v_segmento := nullif(btrim(v_fila->>'segmento'), '');
    if v_segmento is null or v_segmento not in ('administrativa', 'operativa', 'ventas') then
      raise exception 'El segmento contable no es válido.' using errcode = '22023';
    end if;

    if nullif(btrim(v_fila->>'concepto_id'), '') is null then
      raise exception 'El concepto del mapeo contable es obligatorio.' using errcode = '22023';
    end if;

    select * into v_concepto
    from public.nomina_conceptos c
    where c.id = public._nomina_uuid(v_fila->>'concepto_id', 'El concepto del mapeo contable no es válido.');
    if not found then
      raise exception 'Concepto de nómina no encontrado.' using errcode = '22023';
    end if;

    v_gasto := public._nomina_uuid(v_fila->>'cuenta_gasto_id', 'La cuenta de gasto no es válida.');
    v_pasivo := public._nomina_uuid(v_fila->>'cuenta_pasivo_id', 'La cuenta de pasivo no es válida.');

    if v_concepto.clase = 'ingreso' then
      if v_gasto is null then
        raise exception 'El concepto % es un ingreso y necesita cuenta de gasto.', v_concepto.codigo
          using errcode = '22023';
      end if;
      if v_pasivo is not null then
        raise exception 'El concepto % es un ingreso y no lleva cuenta de pasivo.', v_concepto.codigo
          using errcode = '22023';
      end if;
    elsif v_concepto.clase = 'deduccion' then
      if v_pasivo is null then
        raise exception 'El concepto % es una deducción y necesita cuenta de pasivo.', v_concepto.codigo
          using errcode = '22023';
      end if;
      if v_gasto is not null then
        raise exception 'El concepto % es una deducción y no lleva cuenta de gasto.', v_concepto.codigo
          using errcode = '22023';
      end if;
    else
      if v_gasto is null or v_pasivo is null then
        raise exception 'El concepto % necesita cuenta de gasto y de pasivo.', v_concepto.codigo
          using errcode = '22023';
      end if;
    end if;

    if v_gasto is not null then
      perform public._nomina_validar_cuenta(v_gasto, 'gasto', v_concepto.codigo, v_segmento);
    end if;
    if v_pasivo is not null then
      perform public._nomina_validar_cuenta(v_pasivo, 'pasivo', v_concepto.codigo, v_segmento);
    end if;

    insert into public.nomina_mapeo_contable (
      segmento, concepto_id, cuenta_gasto_id, cuenta_pasivo_id
    )
    values (v_segmento, v_concepto.id, v_gasto, v_pasivo)
    on conflict (segmento, concepto_id) do update
    set
      cuenta_gasto_id = excluded.cuenta_gasto_id,
      cuenta_pasivo_id = excluded.cuenta_pasivo_id;

    v_guardados := v_guardados + 1;
  end loop;

  return v_guardados;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: parámetros legales de RD por año
--
-- Upsert completo por `anio`. Todas las claves son obligatorias. Rechaza
-- editar un año con algún mes cerrado en `periodos_contables` (23514) y valida
-- la escala de ISR: 4 tramos coherentes, desde/hasta encadenados, último
-- abierto y monto_fijo igual al impuesto acumulado del tramo anterior.
-- ---------------------------------------------------------------------------

create or replace function public.nomina_guardar_parametros_rd(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_anio_num numeric;
  v_anio int;
  v_salario_minimo numeric;
  v_sfs_empleado numeric;
  v_sfs_empleador numeric;
  v_tope_sfs numeric;
  v_afp_empleado numeric;
  v_afp_empleador numeric;
  v_tope_afp numeric;
  v_tope_srl numeric;
  v_srl_1 numeric;
  v_srl_2 numeric;
  v_srl_3 numeric;
  v_srl_4 numeric;
  v_infotep numeric;
  v_dias numeric;
  v_horas numeric;
  v_escala jsonb;
  v_tramos int;
  v_indice int;
  v_tramo jsonb;
  v_desde numeric;
  v_hasta numeric;
  v_tasa numeric;
  v_monto_fijo numeric;
  v_prev_hasta numeric;
  v_esperado numeric := 0;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Datos de los parámetros de nómina requeridos.' using errcode = '22023';
  end if;

  if not (
    p ? 'anio' and p ? 'salario_minimo'
    and p ? 'tasa_sfs_empleado' and p ? 'tasa_sfs_empleador' and p ? 'tope_sfs_mensual'
    and p ? 'tasa_afp_empleado' and p ? 'tasa_afp_empleador' and p ? 'tope_afp_mensual'
    and p ? 'tope_srl_mensual'
    and p ? 'tasa_srl_tipo_1' and p ? 'tasa_srl_tipo_2'
    and p ? 'tasa_srl_tipo_3' and p ? 'tasa_srl_tipo_4'
    and p ? 'tasa_infotep' and p ? 'dias_mes_laboral' and p ? 'horas_dia_laboral'
    and p ? 'escala_isr_anual'
  ) then
    raise exception 'Faltan datos de los parámetros de nómina.' using errcode = '22023';
  end if;

  v_anio_num := public._nomina_numero(p->>'anio', 'El año debe ser un número.');
  if v_anio_num is null or v_anio_num <> trunc(v_anio_num)
     or v_anio_num < 2000 or v_anio_num > 2100 then
    raise exception 'El año debe estar entre 2000 y 2100.' using errcode = '22023';
  end if;
  v_anio := v_anio_num::int;

  v_salario_minimo := public._nomina_numero(p->>'salario_minimo', 'El salario mínimo no es válido.');
  if v_salario_minimo is null or v_salario_minimo <= 0 then
    raise exception 'El salario mínimo debe ser mayor que cero.' using errcode = '22023';
  end if;

  v_sfs_empleado := public._nomina_numero(p->>'tasa_sfs_empleado', 'La tasa de SFS del empleado no es válida.');
  if v_sfs_empleado is null or v_sfs_empleado < 0 or v_sfs_empleado > 100 then
    raise exception 'La tasa de SFS del empleado debe estar entre 0 y 100.' using errcode = '22023';
  end if;

  v_sfs_empleador := public._nomina_numero(p->>'tasa_sfs_empleador', 'La tasa de SFS del empleador no es válida.');
  if v_sfs_empleador is null or v_sfs_empleador < 0 or v_sfs_empleador > 100 then
    raise exception 'La tasa de SFS del empleador debe estar entre 0 y 100.' using errcode = '22023';
  end if;

  v_tope_sfs := public._nomina_numero(p->>'tope_sfs_mensual', 'El tope de SFS no es válido.');
  if v_tope_sfs is null or v_tope_sfs <= 0 then
    raise exception 'El tope mensual de SFS debe ser mayor que cero.' using errcode = '22023';
  end if;

  v_afp_empleado := public._nomina_numero(p->>'tasa_afp_empleado', 'La tasa de AFP del empleado no es válida.');
  if v_afp_empleado is null or v_afp_empleado < 0 or v_afp_empleado > 100 then
    raise exception 'La tasa de AFP del empleado debe estar entre 0 y 100.' using errcode = '22023';
  end if;

  v_afp_empleador := public._nomina_numero(p->>'tasa_afp_empleador', 'La tasa de AFP del empleador no es válida.');
  if v_afp_empleador is null or v_afp_empleador < 0 or v_afp_empleador > 100 then
    raise exception 'La tasa de AFP del empleador debe estar entre 0 y 100.' using errcode = '22023';
  end if;

  v_tope_afp := public._nomina_numero(p->>'tope_afp_mensual', 'El tope de AFP no es válido.');
  if v_tope_afp is null or v_tope_afp <= 0 then
    raise exception 'El tope mensual de AFP debe ser mayor que cero.' using errcode = '22023';
  end if;

  v_tope_srl := public._nomina_numero(p->>'tope_srl_mensual', 'El tope de SRL no es válido.');
  if v_tope_srl is null or v_tope_srl <= 0 then
    raise exception 'El tope mensual de SRL debe ser mayor que cero.' using errcode = '22023';
  end if;

  v_srl_1 := public._nomina_numero(p->>'tasa_srl_tipo_1', 'La tasa SRL tipo 1 no es válida.');
  if v_srl_1 is null or v_srl_1 < 0 or v_srl_1 > 100 then
    raise exception 'La tasa SRL tipo 1 debe estar entre 0 y 100.' using errcode = '22023';
  end if;

  v_srl_2 := public._nomina_numero(p->>'tasa_srl_tipo_2', 'La tasa SRL tipo 2 no es válida.');
  if v_srl_2 is null or v_srl_2 < 0 or v_srl_2 > 100 then
    raise exception 'La tasa SRL tipo 2 debe estar entre 0 y 100.' using errcode = '22023';
  end if;

  v_srl_3 := public._nomina_numero(p->>'tasa_srl_tipo_3', 'La tasa SRL tipo 3 no es válida.');
  if v_srl_3 is null or v_srl_3 < 0 or v_srl_3 > 100 then
    raise exception 'La tasa SRL tipo 3 debe estar entre 0 y 100.' using errcode = '22023';
  end if;

  v_srl_4 := public._nomina_numero(p->>'tasa_srl_tipo_4', 'La tasa SRL tipo 4 no es válida.');
  if v_srl_4 is null or v_srl_4 < 0 or v_srl_4 > 100 then
    raise exception 'La tasa SRL tipo 4 debe estar entre 0 y 100.' using errcode = '22023';
  end if;

  v_infotep := public._nomina_numero(p->>'tasa_infotep', 'La tasa de INFOTEP no es válida.');
  if v_infotep is null or v_infotep < 0 or v_infotep > 100 then
    raise exception 'La tasa de INFOTEP debe estar entre 0 y 100.' using errcode = '22023';
  end if;

  v_dias := public._nomina_numero(p->>'dias_mes_laboral', 'Los días del mes laboral no son válidos.');
  if v_dias is null or v_dias <= 0 or v_dias > 31 then
    raise exception 'Los días del mes laboral deben ser mayores que cero y máximo 31.' using errcode = '22023';
  end if;

  v_horas := public._nomina_numero(p->>'horas_dia_laboral', 'Las horas del día laboral no son válidas.');
  if v_horas is null or v_horas <= 0 or v_horas > 24 then
    raise exception 'Las horas del día laboral deben ser mayores que cero y máximo 24.' using errcode = '22023';
  end if;

  v_escala := p->'escala_isr_anual';
  if jsonb_typeof(v_escala) <> 'array' then
    raise exception 'La escala de ISR debe ser una lista de tramos.' using errcode = '22023';
  end if;

  v_tramos := jsonb_array_length(v_escala);
  if v_tramos < 1 then
    raise exception 'La escala de ISR debe tener al menos un tramo.' using errcode = '22023';
  end if;
  if v_tramos > 20 then
    raise exception 'La escala de ISR no puede pasar de 20 tramos.' using errcode = '22023';
  end if;

  v_prev_hasta := null;
  v_esperado := 0;

  for v_indice in 0 .. v_tramos - 1 loop
    v_tramo := v_escala->v_indice;
    if jsonb_typeof(v_tramo) <> 'object' then
      raise exception 'Cada tramo de la escala de ISR debe ser un objeto.' using errcode = '22023';
    end if;

    v_desde := public._nomina_numero(v_tramo->>'desde', 'El desde de la escala de ISR no es válido.');
    v_hasta := public._nomina_numero(v_tramo->>'hasta', 'El hasta de la escala de ISR no es válido.');
    v_tasa := public._nomina_numero(v_tramo->>'tasa', 'La tasa de la escala de ISR no es válida.');
    v_monto_fijo := public._nomina_numero(v_tramo->>'monto_fijo', 'El monto fijo de la escala de ISR no es válido.');

    if v_desde is null or v_tasa is null or v_monto_fijo is null then
      raise exception 'Cada tramo de la escala de ISR necesita desde, tasa y monto fijo.'
        using errcode = '22023';
    end if;

    if v_desde < 0 or v_monto_fijo < 0 or v_tasa < 0 or v_tasa > 100 then
      raise exception 'Los valores de la escala de ISR no son válidos.' using errcode = '22023';
    end if;

    if v_indice = 0 then
      if v_desde <> 0 then
        raise exception 'La escala de ISR debe empezar en 0.' using errcode = '22023';
      end if;
    elsif v_prev_hasta is null or v_desde <> v_prev_hasta then
      raise exception 'Cada tramo de la escala de ISR debe empezar donde termina el anterior.'
        using errcode = '22023';
    end if;

    if v_indice < v_tramos - 1 then
      if v_hasta is null or v_hasta <= v_desde then
        raise exception 'Solo el último tramo de la escala de ISR queda abierto.' using errcode = '22023';
      end if;
    elsif v_hasta is not null then
      raise exception 'El último tramo de la escala de ISR debe quedar abierto (sin hasta).'
        using errcode = '22023';
    end if;

    if abs(v_monto_fijo - v_esperado) > 0.005 then
      raise exception 'El monto fijo del tramo % no coincide con el impuesto acumulado del tramo anterior.',
        v_indice + 1 using errcode = '22023';
    end if;

    v_prev_hasta := v_hasta;
    v_esperado := v_monto_fijo + (v_tasa / 100) * (coalesce(v_hasta, v_desde) - v_desde);
  end loop;

  if exists (
    select 1
    from public.periodos_contables pc
    where pc.estado = 'cerrado'
      and extract(year from pc.periodo)::int = v_anio
  ) then
    raise exception 'El año % tiene periodos contables cerrados; no se pueden cambiar sus parámetros de nómina.',
      v_anio using errcode = '23514';
  end if;

  insert into public.nomina_parametros_rd (
    anio, salario_minimo,
    tasa_sfs_empleado, tasa_sfs_empleador, tope_sfs_mensual,
    tasa_afp_empleado, tasa_afp_empleador, tope_afp_mensual,
    tope_srl_mensual,
    tasa_srl_tipo_1, tasa_srl_tipo_2, tasa_srl_tipo_3, tasa_srl_tipo_4,
    tasa_infotep, dias_mes_laboral, horas_dia_laboral, escala_isr_anual, actualizado_en
  )
  values (
    v_anio, v_salario_minimo,
    v_sfs_empleado, v_sfs_empleador, v_tope_sfs,
    v_afp_empleado, v_afp_empleador, v_tope_afp,
    v_tope_srl,
    v_srl_1, v_srl_2, v_srl_3, v_srl_4,
    v_infotep, v_dias, v_horas, v_escala, now()
  )
  on conflict (anio) do update
  set
    salario_minimo = excluded.salario_minimo,
    tasa_sfs_empleado = excluded.tasa_sfs_empleado,
    tasa_sfs_empleador = excluded.tasa_sfs_empleador,
    tope_sfs_mensual = excluded.tope_sfs_mensual,
    tasa_afp_empleado = excluded.tasa_afp_empleado,
    tasa_afp_empleador = excluded.tasa_afp_empleador,
    tope_afp_mensual = excluded.tope_afp_mensual,
    tope_srl_mensual = excluded.tope_srl_mensual,
    tasa_srl_tipo_1 = excluded.tasa_srl_tipo_1,
    tasa_srl_tipo_2 = excluded.tasa_srl_tipo_2,
    tasa_srl_tipo_3 = excluded.tasa_srl_tipo_3,
    tasa_srl_tipo_4 = excluded.tasa_srl_tipo_4,
    tasa_infotep = excluded.tasa_infotep,
    dias_mes_laboral = excluded.dias_mes_laboral,
    horas_dia_laboral = excluded.horas_dia_laboral,
    escala_isr_anual = excluded.escala_isr_anual,
    actualizado_en = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: crear concepto personalizado
--
-- Solo crea conceptos personalizados (`es_sistema = false`). Normaliza el
-- código a mayúsculas y exige el formato ^[A-Z][A-Z0-9_]{2,39}$. El nombre es
-- la etiqueta visible y la descripción de la línea del asiento. Los flags de
-- TSS/ISR/INFOTEP solo valen para ingresos.
-- ---------------------------------------------------------------------------

create or replace function public.nomina_crear_concepto(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_codigo text;
  v_nombre text;
  v_clase text;
  v_grava_tss boolean := false;
  v_grava_isr boolean := false;
  v_grava_infotep boolean := false;
  v_activo boolean := true;
  v_orden_num numeric;
  v_orden int := 100;
  v_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Datos del concepto de nómina requeridos.' using errcode = '22023';
  end if;

  v_codigo := upper(nullif(btrim(p->>'codigo'), ''));
  if v_codigo is null or v_codigo !~ '^[A-Z][A-Z0-9_]{2,39}$' then
    raise exception 'El código del concepto no es válido: mayúsculas, números y guion bajo, de 3 a 40 caracteres, empezando por letra.'
      using errcode = '22023';
  end if;

  v_nombre := nullif(btrim(p->>'nombre'), '');
  if v_nombre is null then
    raise exception 'El nombre del concepto es obligatorio.' using errcode = '22023';
  end if;

  v_clase := nullif(btrim(p->>'clase'), '');
  if v_clase is null or v_clase not in ('ingreso', 'deduccion', 'aporte_empleador', 'provision') then
    raise exception 'La clase del concepto no es válida.' using errcode = '22023';
  end if;

  if p ? 'grava_tss' then
    if p->>'grava_tss' is null then
      raise exception 'El indicador de TSS del concepto no es válido.' using errcode = '22023';
    end if;
    v_grava_tss := (p->>'grava_tss')::boolean;
  end if;

  if p ? 'grava_isr' then
    if p->>'grava_isr' is null then
      raise exception 'El indicador de ISR del concepto no es válido.' using errcode = '22023';
    end if;
    v_grava_isr := (p->>'grava_isr')::boolean;
  end if;

  if p ? 'grava_infotep' then
    if p->>'grava_infotep' is null then
      raise exception 'El indicador de INFOTEP del concepto no es válido.' using errcode = '22023';
    end if;
    v_grava_infotep := (p->>'grava_infotep')::boolean;
  end if;

  if v_clase <> 'ingreso' and (v_grava_tss or v_grava_isr or v_grava_infotep) then
    raise exception 'Solo los ingresos pueden gravar TSS, ISR o INFOTEP.' using errcode = '22023';
  end if;

  if p ? 'activo' then
    if p->>'activo' is null then
      raise exception 'El estado del concepto no es válido.' using errcode = '22023';
    end if;
    v_activo := (p->>'activo')::boolean;
  end if;

  if p ? 'orden' then
    v_orden_num := public._nomina_numero(p->>'orden', 'El orden del concepto no es válido.');
    if v_orden_num is null or v_orden_num <> trunc(v_orden_num)
       or v_orden_num < 0 or v_orden_num > 100000 then
      raise exception 'El orden del concepto debe ser un entero entre 0 y 100000.' using errcode = '22023';
    end if;
    v_orden := v_orden_num::int;
  end if;

  if exists (
    select 1 from public.nomina_conceptos c where lower(c.codigo) = lower(v_codigo)
  ) then
    raise exception 'Ya existe un concepto de nómina con ese código.' using errcode = '23505';
  end if;

  insert into public.nomina_conceptos (
    codigo, nombre, clase, grava_tss, grava_isr, grava_infotep, es_sistema, activo, orden
  )
  values (
    v_codigo, v_nombre, v_clase, v_grava_tss, v_grava_isr, v_grava_infotep, false, v_activo, v_orden
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: actualizar concepto
--
-- El código y `es_sistema` nunca cambian. En un concepto del sistema solo se
-- permiten `nombre` y `orden` (no se desactiva ni se cambian clase o flags).
-- En uno personalizado se permite también clase, flags, activo y orden. No se
-- desactiva un concepto usado por un recibo contabilizado o pagado.
-- ---------------------------------------------------------------------------

create or replace function public.nomina_actualizar_concepto(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_concepto public.nomina_conceptos%rowtype;
  v_codigo text;
  v_nombre text;
  v_clase text;
  v_grava_tss boolean;
  v_grava_isr boolean;
  v_grava_infotep boolean;
  v_activo boolean;
  v_orden_num numeric;
  v_orden int;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_id is null then
    raise exception 'El concepto es obligatorio.' using errcode = '22023';
  end if;

  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Datos del concepto de nómina requeridos.' using errcode = '22023';
  end if;

  select * into v_concepto
  from public.nomina_conceptos c
  where c.id = p_id
  for update;
  if not found then
    raise exception 'Concepto de nómina no encontrado.' using errcode = '22023';
  end if;

  if p ? 'codigo' then
    v_codigo := upper(nullif(btrim(p->>'codigo'), ''));
    if v_codigo is distinct from v_concepto.codigo then
      raise exception 'El código de un concepto no se cambia.' using errcode = '23514';
    end if;
  end if;

  if v_concepto.es_sistema then
    if p ? 'clase' then
      if nullif(btrim(p->>'clase'), '') is distinct from v_concepto.clase then
        raise exception 'La clase de un concepto del sistema no se cambia.' using errcode = '23514';
      end if;
    end if;

    if p ? 'activo' then
      if p->>'activo' is null or (p->>'activo')::boolean is distinct from v_concepto.activo then
        raise exception 'Los conceptos del sistema no se desactivan.' using errcode = '23514';
      end if;
    end if;

    if (p ? 'grava_tss' and (p->>'grava_tss')::boolean is distinct from v_concepto.grava_tss)
       or (p ? 'grava_isr' and (p->>'grava_isr')::boolean is distinct from v_concepto.grava_isr)
       or (p ? 'grava_infotep' and (p->>'grava_infotep')::boolean is distinct from v_concepto.grava_infotep) then
      raise exception 'Los indicadores de un concepto del sistema no se cambian.' using errcode = '23514';
    end if;

    v_nombre := case
      when p ? 'nombre' then nullif(btrim(p->>'nombre'), '')
      else v_concepto.nombre
    end;
    if v_nombre is null then
      raise exception 'El nombre del concepto es obligatorio.' using errcode = '22023';
    end if;

    v_orden := v_concepto.orden;
    if p ? 'orden' then
      v_orden_num := public._nomina_numero(p->>'orden', 'El orden del concepto no es válido.');
      if v_orden_num is null or v_orden_num <> trunc(v_orden_num)
         or v_orden_num < 0 or v_orden_num > 100000 then
        raise exception 'El orden del concepto debe ser un entero entre 0 y 100000.' using errcode = '22023';
      end if;
      v_orden := v_orden_num::int;
    end if;

    update public.nomina_conceptos c
    set nombre = v_nombre, orden = v_orden
    where c.id = p_id;

    return p_id;
  end if;

  v_nombre := case
    when p ? 'nombre' then nullif(btrim(p->>'nombre'), '')
    else v_concepto.nombre
  end;
  if v_nombre is null then
    raise exception 'El nombre del concepto es obligatorio.' using errcode = '22023';
  end if;

  v_clase := case
    when p ? 'clase' then nullif(btrim(p->>'clase'), '')
    else v_concepto.clase
  end;
  if v_clase is null or v_clase not in ('ingreso', 'deduccion', 'aporte_empleador', 'provision') then
    raise exception 'La clase del concepto no es válida.' using errcode = '22023';
  end if;

  v_grava_tss := case
    when p ? 'grava_tss' then (p->>'grava_tss')::boolean
    else v_concepto.grava_tss
  end;
  v_grava_isr := case
    when p ? 'grava_isr' then (p->>'grava_isr')::boolean
    else v_concepto.grava_isr
  end;
  v_grava_infotep := case
    when p ? 'grava_infotep' then (p->>'grava_infotep')::boolean
    else v_concepto.grava_infotep
  end;

  if v_grava_tss is null or v_grava_isr is null or v_grava_infotep is null then
    raise exception 'Los indicadores del concepto no son válidos.' using errcode = '22023';
  end if;

  if v_clase <> 'ingreso' then
    if (p ? 'grava_tss' and v_grava_tss)
       or (p ? 'grava_isr' and v_grava_isr)
       or (p ? 'grava_infotep' and v_grava_infotep) then
      raise exception 'Solo los ingresos pueden gravar TSS, ISR o INFOTEP.' using errcode = '22023';
    end if;
    v_grava_tss := false;
    v_grava_isr := false;
    v_grava_infotep := false;
  end if;

  v_activo := case
    when p ? 'activo' then (p->>'activo')::boolean
    else v_concepto.activo
  end;
  if v_activo is null then
    raise exception 'El estado del concepto no es válido.' using errcode = '22023';
  end if;

  v_orden := v_concepto.orden;
  if p ? 'orden' then
    v_orden_num := public._nomina_numero(p->>'orden', 'El orden del concepto no es válido.');
    if v_orden_num is null or v_orden_num <> trunc(v_orden_num)
       or v_orden_num < 0 or v_orden_num > 100000 then
      raise exception 'El orden del concepto debe ser un entero entre 0 y 100000.' using errcode = '22023';
    end if;
    v_orden := v_orden_num::int;
  end if;

  if not v_activo and v_concepto.activo and exists (
    select 1
    from public.nomina_recibo_lineas l
    join public.nomina_recibos r on r.id = l.recibo_id
    where l.concepto_id = p_id
      and r.estado in ('contabilizado', 'pagado')
  ) then
    raise exception 'El concepto % se usó en un recibo contabilizado; no se puede desactivar.',
      v_concepto.codigo using errcode = '23514';
  end if;

  update public.nomina_conceptos c
  set
    nombre = v_nombre,
    clase = v_clase,
    grava_tss = v_grava_tss,
    grava_isr = v_grava_isr,
    grava_infotep = v_grava_infotep,
    activo = v_activo,
    orden = v_orden
  where c.id = p_id;

  return p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: crear empleado
--
-- Normaliza la cédula a dígitos, valida el dígito verificador DGII, la
-- unicidad de la identificación, el salario y las fechas; crea o vincula el
-- contacto con el nombre completo y devuelve el id del empleado.
-- ---------------------------------------------------------------------------

create or replace function public.nomina_crear_empleado(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_emp public.empleados%rowtype;
  v_contacto_id uuid;
  v_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Datos del empleado requeridos.' using errcode = '22023';
  end if;

  v_emp.tipo_identificacion := nullif(btrim(p->>'tipo_identificacion'), '');
  v_emp.identificacion := case
    when v_emp.tipo_identificacion = 'cedula' then
      regexp_replace(coalesce(p->>'identificacion', ''), '[^0-9]', '', 'g')
    else nullif(btrim(p->>'identificacion'), '')
  end;
  v_emp.primer_nombre := nullif(btrim(p->>'primer_nombre'), '');
  v_emp.segundo_nombre := nullif(btrim(p->>'segundo_nombre'), '');
  v_emp.primer_apellido := nullif(btrim(p->>'primer_apellido'), '');
  v_emp.segundo_apellido := nullif(btrim(p->>'segundo_apellido'), '');
  v_emp.correo := nullif(btrim(p->>'correo'), '');
  v_emp.telefono := nullif(btrim(p->>'telefono'), '');
  v_emp.municipio := nullif(btrim(p->>'municipio'), '');
  v_emp.direccion := nullif(btrim(p->>'direccion'), '');
  v_emp.cargo := nullif(btrim(p->>'cargo'), '');
  v_emp.area := nullif(btrim(p->>'area'), '');
  v_emp.segmento_contable := coalesce(nullif(btrim(p->>'segmento_contable'), ''), 'administrativa');
  v_emp.centro_costo_id := public._nomina_uuid(p->>'centro_costo_id', 'El centro de costo no es válido.');
  v_emp.tipo_contrato := coalesce(nullif(btrim(p->>'tipo_contrato'), ''), 'indefinido');
  v_emp.fecha_ingreso := nullif(btrim(p->>'fecha_ingreso'), '')::date;
  v_emp.fecha_fin := nullif(btrim(p->>'fecha_fin'), '')::date;
  v_emp.frecuencia_pago := nullif(btrim(p->>'frecuencia_pago'), '');
  v_emp.salario_mensual := public._nomina_numero(p->>'salario_mensual', 'El salario mensual no es válido.');
  v_emp.metodo_pago := coalesce(nullif(btrim(p->>'metodo_pago'), ''), 'transferencia');
  v_emp.banco_nombre := nullif(btrim(p->>'banco_nombre'), '');
  v_emp.tipo_cuenta_banco := nullif(btrim(p->>'tipo_cuenta_banco'), '');
  v_emp.numero_cuenta_banco := nullif(btrim(p->>'numero_cuenta_banco'), '');
  v_emp.clave_tss := nullif(btrim(p->>'clave_tss'), '');
  v_emp.estado := 'activo';

  perform public._nomina_validar_empleado(v_emp);

  if exists (
    select 1
    from public.empleados e
    where e.tipo_identificacion = v_emp.tipo_identificacion
      and e.identificacion = v_emp.identificacion
  ) then
    raise exception 'Ya existe un empleado con esa identificación.' using errcode = '23505';
  end if;

  v_contacto_id := public._nomina_uuid(p->>'contacto_id', 'El contacto no es válido.');
  if v_contacto_id is not null then
    if not exists (select 1 from public.contactos c where c.id = v_contacto_id) then
      raise exception 'El contacto no existe.' using errcode = '22023';
    end if;
    if exists (select 1 from public.empleados e where e.contacto_id = v_contacto_id) then
      raise exception 'Ese contacto ya está vinculado a otro empleado.' using errcode = '23505';
    end if;
  else
    v_contacto_id := public._nomina_contacto_empleado(v_emp);
  end if;

  insert into public.empleados (
    contacto_id, tipo_identificacion, identificacion,
    primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
    correo, telefono, municipio, direccion, cargo, area,
    segmento_contable, centro_costo_id, tipo_contrato, fecha_ingreso, fecha_fin,
    frecuencia_pago, salario_mensual, metodo_pago, banco_nombre, tipo_cuenta_banco,
    numero_cuenta_banco, clave_tss, estado
  )
  values (
    v_contacto_id, v_emp.tipo_identificacion, v_emp.identificacion,
    v_emp.primer_nombre, v_emp.segundo_nombre, v_emp.primer_apellido, v_emp.segundo_apellido,
    v_emp.correo, v_emp.telefono, v_emp.municipio, v_emp.direccion, v_emp.cargo, v_emp.area,
    v_emp.segmento_contable, v_emp.centro_costo_id, v_emp.tipo_contrato, v_emp.fecha_ingreso,
    v_emp.fecha_fin, v_emp.frecuencia_pago, v_emp.salario_mensual, v_emp.metodo_pago,
    v_emp.banco_nombre, v_emp.tipo_cuenta_banco, v_emp.numero_cuenta_banco, v_emp.clave_tss,
    'activo'
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: actualizar empleado
--
-- Actualización parcial con las mismas validaciones. La identificación no se
-- puede cambiar si el empleado ya tiene recibos contabilizados o pagados.
-- Sincroniza nombre, identificación, correo, teléfono y dirección del contacto.
-- ---------------------------------------------------------------------------

create or replace function public.nomina_actualizar_empleado(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_actual public.empleados%rowtype;
  v_emp public.empleados%rowtype;
  v_contacto_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_id is null then
    raise exception 'El empleado es obligatorio.' using errcode = '22023';
  end if;

  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Datos del empleado requeridos.' using errcode = '22023';
  end if;

  select * into v_actual
  from public.empleados e
  where e.id = p_id
  for update;
  if not found then
    raise exception 'Empleado no encontrado.' using errcode = '22023';
  end if;

  v_emp := v_actual;

  if p ? 'tipo_identificacion' then
    v_emp.tipo_identificacion := nullif(btrim(p->>'tipo_identificacion'), '');
  end if;

  if p ? 'identificacion' or p ? 'tipo_identificacion' then
    if v_emp.tipo_identificacion = 'cedula' then
      v_emp.identificacion := regexp_replace(
        coalesce(p->>'identificacion', v_actual.identificacion), '[^0-9]', '', 'g'
      );
    else
      v_emp.identificacion := nullif(btrim(
        coalesce(p->>'identificacion', v_actual.identificacion)
      ), '');
    end if;
  end if;

  if p ? 'primer_nombre' then v_emp.primer_nombre := nullif(btrim(p->>'primer_nombre'), ''); end if;
  if p ? 'segundo_nombre' then v_emp.segundo_nombre := nullif(btrim(p->>'segundo_nombre'), ''); end if;
  if p ? 'primer_apellido' then v_emp.primer_apellido := nullif(btrim(p->>'primer_apellido'), ''); end if;
  if p ? 'segundo_apellido' then v_emp.segundo_apellido := nullif(btrim(p->>'segundo_apellido'), ''); end if;
  if p ? 'correo' then v_emp.correo := nullif(btrim(p->>'correo'), ''); end if;
  if p ? 'telefono' then v_emp.telefono := nullif(btrim(p->>'telefono'), ''); end if;
  if p ? 'municipio' then v_emp.municipio := nullif(btrim(p->>'municipio'), ''); end if;
  if p ? 'direccion' then v_emp.direccion := nullif(btrim(p->>'direccion'), ''); end if;
  if p ? 'cargo' then v_emp.cargo := nullif(btrim(p->>'cargo'), ''); end if;
  if p ? 'area' then v_emp.area := nullif(btrim(p->>'area'), ''); end if;

  if p ? 'segmento_contable' then
    v_emp.segmento_contable := nullif(btrim(p->>'segmento_contable'), '');
  end if;
  if p ? 'centro_costo_id' then
    v_emp.centro_costo_id := public._nomina_uuid(p->>'centro_costo_id', 'El centro de costo no es válido.');
  end if;
  if p ? 'tipo_contrato' then
    v_emp.tipo_contrato := nullif(btrim(p->>'tipo_contrato'), '');
  end if;
  if p ? 'fecha_ingreso' then
    v_emp.fecha_ingreso := nullif(btrim(p->>'fecha_ingreso'), '')::date;
  end if;
  if p ? 'fecha_fin' then
    v_emp.fecha_fin := nullif(btrim(p->>'fecha_fin'), '')::date;
  end if;
  if p ? 'frecuencia_pago' then
    v_emp.frecuencia_pago := nullif(btrim(p->>'frecuencia_pago'), '');
  end if;
  if p ? 'salario_mensual' then
    v_emp.salario_mensual := public._nomina_numero(p->>'salario_mensual', 'El salario mensual no es válido.');
  end if;
  if p ? 'metodo_pago' then
    v_emp.metodo_pago := nullif(btrim(p->>'metodo_pago'), '');
  end if;
  if p ? 'banco_nombre' then
    v_emp.banco_nombre := nullif(btrim(p->>'banco_nombre'), '');
  end if;
  if p ? 'tipo_cuenta_banco' then
    v_emp.tipo_cuenta_banco := nullif(btrim(p->>'tipo_cuenta_banco'), '');
  end if;
  if p ? 'numero_cuenta_banco' then
    v_emp.numero_cuenta_banco := nullif(btrim(p->>'numero_cuenta_banco'), '');
  end if;
  if p ? 'clave_tss' then
    v_emp.clave_tss := nullif(btrim(p->>'clave_tss'), '');
  end if;

  perform public._nomina_validar_empleado(v_emp);

  if (v_emp.tipo_identificacion <> v_actual.tipo_identificacion
      or v_emp.identificacion <> v_actual.identificacion)
     and exists (
       select 1
       from public.nomina_recibos r
       where r.empleado_id = p_id
         and r.estado in ('contabilizado', 'pagado')
     ) then
    raise exception 'No se puede cambiar la identificación de un empleado con recibos contabilizados.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.empleados e
    where e.tipo_identificacion = v_emp.tipo_identificacion
      and e.identificacion = v_emp.identificacion
      and e.id <> p_id
  ) then
    raise exception 'Ya existe un empleado con esa identificación.' using errcode = '23505';
  end if;

  v_contacto_id := v_actual.contacto_id;
  if p ? 'contacto_id' then
    v_contacto_id := public._nomina_uuid(p->>'contacto_id', 'El contacto no es válido.');
    if v_contacto_id is null then
      raise exception 'El contacto es obligatorio.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.contactos c where c.id = v_contacto_id) then
      raise exception 'El contacto no existe.' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.empleados e
      where e.contacto_id = v_contacto_id and e.id <> p_id
    ) then
      raise exception 'Ese contacto ya está vinculado a otro empleado.' using errcode = '23505';
    end if;
  end if;

  update public.empleados e
  set
    contacto_id = v_contacto_id,
    tipo_identificacion = v_emp.tipo_identificacion,
    identificacion = v_emp.identificacion,
    primer_nombre = v_emp.primer_nombre,
    segundo_nombre = v_emp.segundo_nombre,
    primer_apellido = v_emp.primer_apellido,
    segundo_apellido = v_emp.segundo_apellido,
    correo = v_emp.correo,
    telefono = v_emp.telefono,
    municipio = v_emp.municipio,
    direccion = v_emp.direccion,
    cargo = v_emp.cargo,
    area = v_emp.area,
    segmento_contable = v_emp.segmento_contable,
    centro_costo_id = v_emp.centro_costo_id,
    tipo_contrato = v_emp.tipo_contrato,
    fecha_ingreso = v_emp.fecha_ingreso,
    fecha_fin = v_emp.fecha_fin,
    frecuencia_pago = v_emp.frecuencia_pago,
    salario_mensual = v_emp.salario_mensual,
    metodo_pago = v_emp.metodo_pago,
    banco_nombre = v_emp.banco_nombre,
    tipo_cuenta_banco = v_emp.tipo_cuenta_banco,
    numero_cuenta_banco = v_emp.numero_cuenta_banco,
    clave_tss = v_emp.clave_tss
  where e.id = p_id;

  perform public._nomina_sincronizar_contacto(v_contacto_id, v_emp);

  return p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: cambiar estado del empleado
--
-- activo, suspendido o inactivo. Inactivar exige fecha de fin y rechaza al
-- empleado con recibos pendientes (borrador, calculado o contabilizado).
-- Reactivar un contrato definido exige una fecha de fin futura; un contrato
-- indefinido limpia la fecha de fin.
-- ---------------------------------------------------------------------------

create or replace function public.nomina_cambiar_estado_empleado(
  p_id uuid,
  p_estado text,
  p_fecha_fin date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_emp public.empleados%rowtype;
  v_estado text;
  v_fecha_fin date;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_id is null then
    raise exception 'El empleado es obligatorio.' using errcode = '22023';
  end if;

  select * into v_emp
  from public.empleados e
  where e.id = p_id
  for update;
  if not found then
    raise exception 'Empleado no encontrado.' using errcode = '22023';
  end if;

  v_estado := nullif(btrim(p_estado), '');
  if v_estado is null or v_estado not in ('activo', 'suspendido', 'inactivo') then
    raise exception 'El estado del empleado no es válido.' using errcode = '22023';
  end if;

  if v_estado = 'inactivo' then
    if p_fecha_fin is null then
      raise exception 'Indica la fecha de fin para inactivar al empleado.' using errcode = '22023';
    end if;
    if p_fecha_fin < v_emp.fecha_ingreso then
      raise exception 'La fecha de fin no puede ser anterior a la fecha de ingreso.' using errcode = '22023';
    end if;
    if exists (
      select 1
      from public.nomina_recibos r
      where r.empleado_id = p_id
        and r.estado in ('borrador', 'calculado', 'contabilizado')
    ) then
      raise exception 'El empleado tiene recibos de nómina pendientes; anúlalos o págalos antes de inactivarlo.'
        using errcode = '23514';
    end if;
    v_fecha_fin := p_fecha_fin;
  elsif v_estado = 'activo' then
    if v_emp.tipo_contrato = 'definido' then
      if p_fecha_fin is null or p_fecha_fin <= current_date then
        raise exception 'Un contrato definido necesita una fecha de fin futura para reactivarse.'
          using errcode = '22023';
      end if;
      v_fecha_fin := p_fecha_fin;
    else
      v_fecha_fin := null;
    end if;
  else
    if p_fecha_fin is not null then
      if p_fecha_fin < v_emp.fecha_ingreso then
        raise exception 'La fecha de fin no puede ser anterior a la fecha de ingreso.'
          using errcode = '22023';
      end if;
      v_fecha_fin := p_fecha_fin;
    else
      v_fecha_fin := v_emp.fecha_fin;
    end if;
  end if;

  update public.empleados e
  set estado = v_estado, fecha_fin = v_fecha_fin
  where e.id = p_id;

  return p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: guardar novedad recurrente
--
-- Exactamente uno de monto o porcentaje, con vigencias coherentes y un
-- concepto activo de clase ingreso o deducción. Los conceptos que calcula el
-- motor (SALARIO, SFS, AFP, ISR) y las clases aporte/provisión no se permiten.
-- Con `id` actualiza; sin `id` inserta.
-- ---------------------------------------------------------------------------

create or replace function public.nomina_guardar_novedad_recurrente(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_novedad public.empleado_novedades_recurrentes%rowtype;
  v_empleado_id uuid;
  v_concepto public.nomina_conceptos%rowtype;
  v_id uuid;
  v_existe boolean := false;
  v_monto numeric(14,2);
  v_porcentaje numeric(6,3);
  v_fecha_inicio date;
  v_fecha_fin date;
  v_activa boolean;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Datos de la novedad recurrente requeridos.' using errcode = '22023';
  end if;

  v_id := public._nomina_uuid(p->>'id', 'La novedad recurrente no es válida.');

  if nullif(btrim(p->>'empleado_id'), '') is null then
    raise exception 'Selecciona un empleado válido.' using errcode = '22023';
  end if;
  v_empleado_id := public._nomina_uuid(p->>'empleado_id', 'Selecciona un empleado válido.');
  if not exists (select 1 from public.empleados e where e.id = v_empleado_id) then
    raise exception 'Empleado no encontrado.' using errcode = '22023';
  end if;

  if nullif(btrim(p->>'concepto_id'), '') is null then
    raise exception 'Selecciona un concepto válido.' using errcode = '22023';
  end if;

  select * into v_concepto
  from public.nomina_conceptos c
  where c.id = public._nomina_uuid(p->>'concepto_id', 'Selecciona un concepto válido.');
  if not found then
    raise exception 'Concepto de nómina no encontrado.' using errcode = '22023';
  end if;
  if not v_concepto.activo then
    raise exception 'El concepto de nómina % está inactivo.', v_concepto.codigo using errcode = '23514';
  end if;
  if v_concepto.clase not in ('ingreso', 'deduccion') then
    raise exception 'Solo los ingresos y las deducciones pueden ser novedades recurrentes.'
      using errcode = '23514';
  end if;
  if lower(v_concepto.codigo) in ('salario', 'sfs', 'afp', 'isr') then
    raise exception 'El concepto % lo calcula el motor y no se guarda como novedad recurrente.',
      v_concepto.codigo using errcode = '23514';
  end if;

  if v_id is not null then
    select * into v_novedad
    from public.empleado_novedades_recurrentes n
    where n.id = v_id
    for update;
    if not found then
      raise exception 'La novedad recurrente no existe.' using errcode = '22023';
    end if;
    if v_novedad.empleado_id <> v_empleado_id then
      raise exception 'La novedad recurrente no existe.' using errcode = '22023';
    end if;
    v_existe := true;
  end if;

  -- La pantalla envía solo monto o solo porcentaje: el que no viene se limpia
  -- para permitir cambiar de un tipo al otro sin chocar con el XOR de la tabla.
  if p ? 'monto' and p ? 'porcentaje' then
    v_monto := public._nomina_numero(p->>'monto', 'El monto de la novedad no es válido.');
    v_porcentaje := public._nomina_numero(p->>'porcentaje', 'El porcentaje de la novedad no es válido.');
  elsif p ? 'monto' then
    v_monto := public._nomina_numero(p->>'monto', 'El monto de la novedad no es válido.');
    v_porcentaje := null;
  elsif p ? 'porcentaje' then
    v_porcentaje := public._nomina_numero(p->>'porcentaje', 'El porcentaje de la novedad no es válido.');
    v_monto := null;
  else
    v_monto := v_novedad.monto;
    v_porcentaje := v_novedad.porcentaje;
  end if;

  if (v_monto is null) = (v_porcentaje is null) then
    raise exception 'Indica un monto o un porcentaje, no ambos.' using errcode = '22023';
  end if;
  if v_monto is not null and v_monto <= 0 then
    raise exception 'El monto de la novedad debe ser mayor que cero.' using errcode = '22023';
  end if;
  if v_porcentaje is not null and (v_porcentaje <= 0 or v_porcentaje > 100) then
    raise exception 'El porcentaje de la novedad debe ser mayor que cero y máximo 100.' using errcode = '22023';
  end if;

  v_fecha_inicio := case
    when p ? 'fecha_inicio' then nullif(btrim(p->>'fecha_inicio'), '')::date
    else v_novedad.fecha_inicio
  end;
  if v_fecha_inicio is null then
    raise exception 'La fecha de inicio de la novedad es obligatoria.' using errcode = '22023';
  end if;

  v_fecha_fin := case
    when p ? 'fecha_fin' then nullif(btrim(p->>'fecha_fin'), '')::date
    else v_novedad.fecha_fin
  end;
  if v_fecha_fin is not null and v_fecha_fin < v_fecha_inicio then
    raise exception 'La fecha de fin no puede ser anterior a la fecha de inicio.' using errcode = '22023';
  end if;

  if p ? 'activa' then
    if p->>'activa' is null then
      raise exception 'El estado de la novedad no es válido.' using errcode = '22023';
    end if;
    v_activa := (p->>'activa')::boolean;
  elsif v_existe then
    v_activa := v_novedad.activa;
  else
    v_activa := true;
  end if;

  if v_existe then
    update public.empleado_novedades_recurrentes n
    set
      concepto_id = v_concepto.id,
      monto = v_monto,
      porcentaje = v_porcentaje,
      fecha_inicio = v_fecha_inicio,
      fecha_fin = v_fecha_fin,
      activa = v_activa,
      notas = case
        when p ? 'notas' then nullif(btrim(p->>'notas'), '')
        else n.notas
      end
    where n.id = v_id;
  else
    insert into public.empleado_novedades_recurrentes (
      empleado_id, concepto_id, monto, porcentaje, fecha_inicio, fecha_fin, activa, notas
    )
    values (
      v_empleado_id, v_concepto.id, v_monto, v_porcentaje, v_fecha_inicio, v_fecha_fin,
      v_activa, nullif(btrim(p->>'notas'), '')
    )
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: eliminar novedad recurrente
--
-- Borra la fila solo si nunca se usó en un recibo contabilizado o pagado; en
-- ese caso hay que apagarla (activa = false) para conservar la traza.
-- ---------------------------------------------------------------------------

create or replace function public.nomina_eliminar_novedad_recurrente(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_novedad public.empleado_novedades_recurrentes%rowtype;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_id is null then
    raise exception 'La novedad recurrente es obligatoria.' using errcode = '22023';
  end if;

  select * into v_novedad
  from public.empleado_novedades_recurrentes n
  where n.id = p_id
  for update;
  if not found then
    raise exception 'La novedad recurrente no existe.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.nomina_recibo_lineas l
    join public.nomina_recibos r on r.id = l.recibo_id
    where r.empleado_id = v_novedad.empleado_id
      and l.concepto_id = v_novedad.concepto_id
      and l.origen = 'recurrente'
      and r.estado in ('contabilizado', 'pagado')
  ) then
    raise exception 'La novedad recurrente ya se usó en un recibo contabilizado; apágala en lugar de borrarla.'
      using errcode = '23514';
  end if;

  delete from public.empleado_novedades_recurrentes n where n.id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: agregar empleados a un periodo
--
-- Solo periodo borrador o calculado (o anulado, que revive a borrador).
-- Crea el recibo que falte sin duplicar (periodo_id, empleado_id), salta al
-- empleado no elegible y al que ya tiene un recibo no anulado en un periodo
-- que se cruce, y revive un recibo anulado del mismo empleado. Devuelve cuántos
-- creó o revivió.
-- ---------------------------------------------------------------------------

create or replace function public.nomina_agregar_empleados(
  p_periodo_id uuid,
  p_empleado_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_periodo public.nomina_periodos%rowtype;
  v_params public.nomina_parametros_rd%rowtype;
  v_empleado public.empleados%rowtype;
  v_recibo public.nomina_recibos%rowtype;
  v_empleado_id uuid;
  v_recibo_id uuid;
  v_factor numeric(6,3);
  v_dias_calendario int;
  v_inicio_efectivo date;
  v_fin_efectivo date;
  v_dias_efectivos int;
  v_proporcion numeric;
  v_dias_trabajados numeric(6,3);
  v_salario_base numeric(14,2);
  v_dias_mes_laboral numeric;
  v_novedad record;
  v_creados int := 0;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_periodo_id is null then
    raise exception 'El periodo de nómina es obligatorio.' using errcode = '22023';
  end if;

  select * into v_periodo
  from public.nomina_periodos p
  where p.id = p_periodo_id
  for update;
  if not found then
    raise exception 'Periodo de nómina no encontrado.' using errcode = '22023';
  end if;

  if v_periodo.estado not in ('borrador', 'calculado', 'anulado') then
    raise exception 'El periodo está %; solo se agregan empleados a un periodo en borrador o calculado.',
      v_periodo.estado using errcode = '23514';
  end if;

  if p_empleado_ids is null or cardinality(p_empleado_ids) = 0 then
    raise exception 'Indica al menos un empleado para agregar al periodo.' using errcode = '22023';
  end if;

  select * into v_params
  from public.nomina_parametros_rd pr
  where pr.anio = v_periodo.anio_fiscal;
  if not found then
    raise exception 'No hay parámetros de nómina para el año %.', v_periodo.anio_fiscal
      using errcode = '22023';
  end if;

  v_factor := case when v_periodo.frecuencia = 'mensual' then 1 else 0.5 end;
  v_dias_calendario := v_periodo.fecha_fin - v_periodo.fecha_inicio + 1;
  v_dias_mes_laboral := v_params.dias_mes_laboral;

  foreach v_empleado_id in array p_empleado_ids loop
    select * into v_empleado from public.empleados e where e.id = v_empleado_id;
    if not found then
      raise exception 'Empleado no encontrado.' using errcode = '22023';
    end if;

    -- No elegible: inactivo, otra frecuencia o contrato fuera del periodo.
    if v_empleado.estado <> 'activo'
       or v_empleado.frecuencia_pago <> v_periodo.frecuencia
       or v_empleado.fecha_ingreso > v_periodo.fecha_fin
       or (v_empleado.fecha_fin is not null and v_empleado.fecha_fin < v_periodo.fecha_inicio) then
      continue;
    end if;

    -- Sin doble pago: ya tiene recibo no anulado en un periodo que se cruza.
    if exists (
      select 1
      from public.nomina_recibos r
      join public.nomina_periodos np on np.id = r.periodo_id
      where r.empleado_id = v_empleado.id
        and r.estado <> 'anulado'
        and np.id <> v_periodo.id
        and daterange(np.fecha_inicio, np.fecha_fin, '[]')
          && daterange(v_periodo.fecha_inicio, v_periodo.fecha_fin, '[]')
    ) then
      continue;
    end if;

    select * into v_recibo
    from public.nomina_recibos r
    where r.periodo_id = v_periodo.id
      and r.empleado_id = v_empleado.id
    for update;

    if found and v_recibo.estado <> 'anulado' then
      continue;
    end if;

    v_inicio_efectivo := greatest(v_periodo.fecha_inicio, v_empleado.fecha_ingreso);
    v_fin_efectivo := least(v_periodo.fecha_fin, coalesce(v_empleado.fecha_fin, v_periodo.fecha_fin));
    v_dias_efectivos := greatest(0, v_fin_efectivo - v_inicio_efectivo + 1);
    continue when v_dias_efectivos = 0;

    v_proporcion := v_dias_efectivos::numeric / v_dias_calendario;
    v_dias_trabajados := round(v_dias_mes_laboral * v_factor * v_proporcion, 3);
    v_salario_base := round(v_empleado.salario_mensual * v_factor * v_proporcion, 2);

    if found then
      -- Revive el recibo anulado: limpia el ciclo anterior y vuelve a borrador.
      update public.nomina_recibos r
      set
        dias_trabajados = v_dias_trabajados,
        salario_base = v_salario_base,
        base_tss = 0,
        base_sfs = 0,
        base_afp = 0,
        base_srl = 0,
        base_infotep = 0,
        base_isr = 0,
        total_ingresos = 0,
        total_deducciones = 0,
        total_aportes_empleador = 0,
        total_provisiones = 0,
        neto_pagar = 0,
        costo_total_empresa = 0,
        estado = 'borrador',
        cuenta_salarios_por_pagar_id = null,
        asiento_id = null,
        pago_asiento_id = null,
        cuenta_pago_id = null,
        fecha_pagado = null,
        colilla_enviada_en = null,
        colilla_enviada_a = null
      where r.id = v_recibo.id;

      delete from public.nomina_recibo_lineas l where l.recibo_id = v_recibo.id;
      v_recibo_id := v_recibo.id;
    else
      insert into public.nomina_recibos (
        periodo_id, empleado_id, dias_trabajados, salario_base, estado
      )
      values (
        v_periodo.id, v_empleado.id, v_dias_trabajados, v_salario_base, 'borrador'
      )
      returning id into v_recibo_id;
    end if;

    -- Preview de las novedades recurrentes vigentes (sin prorrata).
    for v_novedad in
      select
        c.id as concepto_id,
        c.clase,
        c.orden,
        n.porcentaje,
        round(coalesce(n.monto, v_salario_base * n.porcentaje / 100), 2) as monto
      from public.empleado_novedades_recurrentes n
      join public.nomina_conceptos c on c.id = n.concepto_id
      where n.empleado_id = v_empleado.id
        and n.activa
        and n.fecha_inicio <= v_periodo.fecha_fin
        and (n.fecha_fin is null or n.fecha_fin >= v_periodo.fecha_inicio)
        and c.activo
        and c.clase in ('ingreso', 'deduccion')
      order by c.orden, n.id
    loop
      perform public._nomina_insertar_linea(
        v_recibo_id,
        v_novedad.concepto_id,
        v_novedad.clase,
        null,
        v_novedad.porcentaje,
        v_novedad.monto,
        'recurrente',
        v_novedad.orden
      );
    end loop;

    v_creados := v_creados + 1;
  end loop;

  perform public._nomina_recalcular_periodo(v_periodo.id);

  return v_creados;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos
--
-- Escritura: solo authenticated; el rol se valida dentro de la función.
-- Helpers: revocados de todos (los llaman las RPC security definer).
-- ---------------------------------------------------------------------------

revoke all on function public._nomina_uuid(text, text) from public, anon, authenticated;
revoke all on function public._nomina_numero(text, text) from public, anon, authenticated;
revoke all on function public._nomina_validar_empleado(public.empleados) from public, anon, authenticated;
revoke all on function public._nomina_contacto_empleado(public.empleados) from public, anon, authenticated;
revoke all on function public._nomina_sincronizar_contacto(uuid, public.empleados)
  from public, anon, authenticated;

revoke all on function public.nomina_guardar_config_empresa(jsonb) from public, anon, authenticated;
revoke all on function public.nomina_guardar_mapeo_contable(jsonb) from public, anon, authenticated;
revoke all on function public.nomina_guardar_parametros_rd(jsonb) from public, anon, authenticated;
revoke all on function public.nomina_crear_concepto(jsonb) from public, anon, authenticated;
revoke all on function public.nomina_actualizar_concepto(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.nomina_crear_empleado(jsonb) from public, anon, authenticated;
revoke all on function public.nomina_actualizar_empleado(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.nomina_cambiar_estado_empleado(uuid, text, date)
  from public, anon, authenticated;
revoke all on function public.nomina_guardar_novedad_recurrente(jsonb)
  from public, anon, authenticated;
revoke all on function public.nomina_eliminar_novedad_recurrente(uuid)
  from public, anon, authenticated;
revoke all on function public.nomina_agregar_empleados(uuid, uuid[])
  from public, anon, authenticated;

grant execute on function public.nomina_guardar_config_empresa(jsonb) to authenticated;
grant execute on function public.nomina_guardar_mapeo_contable(jsonb) to authenticated;
grant execute on function public.nomina_guardar_parametros_rd(jsonb) to authenticated;
grant execute on function public.nomina_crear_concepto(jsonb) to authenticated;
grant execute on function public.nomina_actualizar_concepto(uuid, jsonb) to authenticated;
grant execute on function public.nomina_crear_empleado(jsonb) to authenticated;
grant execute on function public.nomina_actualizar_empleado(uuid, jsonb) to authenticated;
grant execute on function public.nomina_cambiar_estado_empleado(uuid, text, date) to authenticated;
grant execute on function public.nomina_guardar_novedad_recurrente(jsonb) to authenticated;
grant execute on function public.nomina_eliminar_novedad_recurrente(uuid) to authenticated;
grant execute on function public.nomina_agregar_empleados(uuid, uuid[]) to authenticated;

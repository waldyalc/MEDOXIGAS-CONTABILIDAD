-- ---------------------------------------------------------------------------
-- Punto de venta (fase 2A, parte 1): SOLO esquema.
--
-- Crea las tablas del POS (terminales, turnos y movimientos de caja), extiende
-- los documentos de venta con su trazabilidad de turno/origen, amplía el CHECK
-- de origen de asientos y siembra las cuentas de sobrante/faltante de caja.
--
-- NO crea ninguna función `pos_*`: las RPC viven en la migración siguiente.
--
-- Todo es aditivo y reintentable. No borra ni cambia datos existentes: las
-- facturas, cotizaciones, pagos y notas actuales quedan `origen =
-- 'contabilidad'` y sin turno; las notas actuales quedan `credito_factura` con
-- reembolso 0.
--
-- Contrato funcional: docs/dominio-pos.md
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1) Terminales del POS (catálogo/configuración, `@conservar` en el reset)
-- ---------------------------------------------------------------------------

create table if not exists public.pos_terminales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  almacen_id uuid not null references public.almacenes (id),
  cuenta_efectivo_id uuid not null references public.cuentas (id),
  cuenta_tarjeta_debito_id uuid references public.cuentas (id),
  cuenta_tarjeta_credito_id uuid references public.cuentas (id),
  cuenta_transferencia_id uuid references public.cuentas (id),
  numeracion_defecto_id uuid not null references public.numeraciones (id),
  lista_precio_defecto_id uuid references public.listas_precios (id),
  contacto_defecto_id uuid not null references public.contactos (id),
  centro_costo_id uuid references public.centros_costo (id),
  plantilla_ticket jsonb not null default '{
    "estilo": "clasico",
    "ancho_mm": 80,
    "fuente": "clasica",
    "tamano_letra": "mediana",
    "interlineado": "normal",
    "mostrar_logo": true,
    "mostrar_vendedor": true,
    "mostrar_descripcion": true,
    "mostrar_referencia": false,
    "mostrar_precio_unitario": true,
    "mostrar_unidad": true,
    "precios_con_impuestos": true,
    "pie_ticket": null
  }'::jsonb,
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint pos_terminales_nombre_check check (btrim(nombre) <> '' and length(nombre) <= 80),
  constraint pos_terminales_plantilla_objeto_check check (jsonb_typeof(plantilla_ticket) = 'object')
);

create unique index if not exists pos_terminales_nombre_unico
  on public.pos_terminales (lower(btrim(nombre)));
-- Dos terminales activas no comparten cajón: el arqueo de una contaminaría el
-- de la otra. Las cuentas de tarjeta/transferencia sí pueden compartirse.
create unique index if not exists pos_terminales_cuenta_efectivo_unica
  on public.pos_terminales (cuenta_efectivo_id) where activa;
create index if not exists pos_terminales_almacen_id_idx
  on public.pos_terminales (almacen_id);

-- ---------------------------------------------------------------------------
-- 2) Turnos de caja (transaccional)
-- ---------------------------------------------------------------------------

create sequence if not exists public.pos_turnos_numero_seq;

create table if not exists public.pos_turnos (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique default nextval('public.pos_turnos_numero_seq'),
  terminal_id uuid not null references public.pos_terminales (id),
  abierto_por uuid not null default auth.uid(),
  cerrado_por uuid,
  abierto_en timestamptz not null default now(),
  cerrado_en timestamptz,
  estado text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
  base_inicial numeric(14,2) not null default 0 check (base_inicial >= 0),
  efectivo_esperado numeric(14,2) check (efectivo_esperado is null or efectivo_esperado >= 0),
  efectivo_real numeric(14,2) check (efectivo_real is null or efectivo_real >= 0),
  diferencia numeric(14,2),
  asiento_diferencia_id uuid references public.asientos (id),
  observaciones text,
  constraint pos_turnos_cierre_check check (
    (
      estado = 'abierto'
      and cerrado_por is null
      and cerrado_en is null
      and efectivo_esperado is null
      and efectivo_real is null
      and diferencia is null
      and asiento_diferencia_id is null
    )
    or (
      estado = 'cerrado'
      and cerrado_por is not null
      and cerrado_en is not null
      and efectivo_esperado is not null
      and efectivo_real is not null
      and diferencia is not null
      and diferencia = round(efectivo_real - efectivo_esperado, 2)
    )
  ),
  constraint pos_turnos_observaciones_check check (observaciones is null or length(observaciones) <= 500)
);

-- Candado de concurrencia: una terminal no puede tener dos turnos abiertos ni
-- por carrera. Es la última defensa; la RPC además bloquea la terminal.
create unique index if not exists pos_turnos_terminal_abierto_uniq
  on public.pos_turnos (terminal_id) where estado = 'abierto';
create index if not exists pos_turnos_terminal_id_idx on public.pos_turnos (terminal_id);
create index if not exists pos_turnos_abierto_en_idx on public.pos_turnos (abierto_en);
create index if not exists pos_turnos_estado_idx on public.pos_turnos (estado);

-- ---------------------------------------------------------------------------
-- 3) Movimientos de caja del turno (transaccional)
-- ---------------------------------------------------------------------------

create sequence if not exists public.pos_turno_movimientos_numero_seq;

create table if not exists public.pos_turno_movimientos (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique default nextval('public.pos_turno_movimientos_numero_seq'),
  turno_id uuid not null references public.pos_turnos (id),
  tipo text not null check (tipo in ('ingreso', 'retiro')),
  motivo text not null
    constraint pos_turno_movimientos_motivo_valores_check check (motivo in (
    'fondo_caja',
    'cobro_factura',
    'retiro_caja',
    'gasto_menor',
    'deposito_banco',
    'otro'
  )),
  monto numeric(14,2) not null check (monto > 0),
  cuenta_contrapartida_id uuid not null references public.cuentas (id),
  contacto_id uuid references public.contactos (id),
  factura_id uuid references public.facturas (id),
  asiento_id uuid not null references public.asientos (id),
  pago_recibido_id uuid references public.pagos_recibidos (id),
  gasto_menor_id uuid references public.gastos_menores (id),
  notas text,
  creado_por uuid not null default auth.uid(),
  creado_en timestamptz not null default now(),
  constraint pos_turno_movimientos_motivo_check check (
    case motivo
      when 'fondo_caja' then
        tipo = 'ingreso' and factura_id is null and pago_recibido_id is null and gasto_menor_id is null
      when 'cobro_factura' then
        tipo = 'ingreso' and factura_id is not null and pago_recibido_id is not null
          and gasto_menor_id is null
      when 'retiro_caja' then
        tipo = 'retiro' and factura_id is null and pago_recibido_id is null and gasto_menor_id is null
      when 'gasto_menor' then
        tipo = 'retiro' and gasto_menor_id is not null and factura_id is null
          and pago_recibido_id is null
      when 'deposito_banco' then
        tipo = 'retiro' and factura_id is null and pago_recibido_id is null and gasto_menor_id is null
      else
        factura_id is null and pago_recibido_id is null and gasto_menor_id is null
    end
  ),
  constraint pos_turno_movimientos_notas_check check (notas is null or length(notas) <= 500)
);

create index if not exists pos_turno_movimientos_turno_id_idx
  on public.pos_turno_movimientos (turno_id);
create index if not exists pos_turno_movimientos_creado_en_idx
  on public.pos_turno_movimientos (creado_en);
-- Un pago o un gasto no puede quedar ligado a dos movimientos de caja.
create unique index if not exists pos_turno_movimientos_pago_unico
  on public.pos_turno_movimientos (pago_recibido_id) where pago_recibido_id is not null;
create unique index if not exists pos_turno_movimientos_gasto_unico
  on public.pos_turno_movimientos (gasto_menor_id) where gasto_menor_id is not null;

-- ---------------------------------------------------------------------------
-- 4) Extensiones aditivas a los documentos de venta
-- ---------------------------------------------------------------------------

alter table public.facturas
  add column if not exists turno_id uuid references public.pos_turnos (id),
  add column if not exists origen text not null default 'contabilidad',
  add column if not exists monto_recibido numeric(14,2),
  add column if not exists cambio numeric(14,2);

alter table public.cotizaciones
  add column if not exists origen text not null default 'contabilidad',
  add column if not exists turno_id uuid references public.pos_turnos (id);

alter table public.pagos_recibidos
  add column if not exists turno_id uuid references public.pos_turnos (id);

alter table public.notas_credito_venta
  add column if not exists turno_id uuid references public.pos_turnos (id),
  add column if not exists tipo_reembolso text not null default 'credito_factura',
  add column if not exists monto_reembolso_efectivo numeric(14,2) not null default 0,
  add column if not exists cuenta_reembolso_id uuid references public.cuentas (id);

create index if not exists facturas_turno_id_idx on public.facturas (turno_id);
create index if not exists facturas_origen_idx on public.facturas (origen);
create index if not exists cotizaciones_turno_id_idx on public.cotizaciones (turno_id);
create index if not exists pagos_recibidos_turno_id_idx on public.pagos_recibidos (turno_id);
create index if not exists notas_credito_venta_turno_id_idx
  on public.notas_credito_venta (turno_id);

-- Checks nombrados e idempotentes: si la columna ya existía (base migrada a
-- mano) la restricción se agrega igual una sola vez.
do $$
declare
  v_tabla text;
  v_nombre text;
  v_expresion text;
begin
  for v_tabla, v_nombre, v_expresion in
    select * from (values
      ('facturas', 'facturas_origen_check', $q$origen in ('contabilidad', 'pos')$q$),
      (
        'facturas',
        'facturas_monto_recibido_check',
        $q$monto_recibido is null or monto_recibido >= 0$q$
      ),
      (
        'facturas',
        'facturas_cambio_check',
        $q$cambio is null or (
          monto_recibido is not null and cambio >= 0 and cambio <= monto_recibido
        )$q$
      ),
      ('cotizaciones', 'cotizaciones_origen_check', $q$origen in ('contabilidad', 'pos')$q$),
      (
        'notas_credito_venta',
        'notas_credito_venta_tipo_reembolso_check',
        $q$tipo_reembolso in ('credito_factura', 'efectivo', 'combinado')$q$
      ),
      (
        'notas_credito_venta',
        'notas_credito_venta_monto_reembolso_check',
        $q$monto_reembolso_efectivo >= 0$q$
      ),
      (
        'notas_credito_venta',
        'notas_credito_venta_reembolso_check',
        $q$(
          tipo_reembolso = 'credito_factura'
          and monto_reembolso_efectivo = 0
          and cuenta_reembolso_id is null
        ) or (
          tipo_reembolso in ('efectivo', 'combinado')
          and monto_reembolso_efectivo > 0
          and cuenta_reembolso_id is not null
        )$q$
      )
    ) as v(tabla, nombre, expresion)
  loop
    if not exists (
      select 1
      from pg_constraint
      where conrelid = format('public.%I', v_tabla)::regclass
        and conname = v_nombre
    ) then
      execute format(
        'alter table public.%I add constraint %I check (%s)',
        v_tabla,
        v_nombre,
        v_expresion
      );
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) Origen de asientos: lista completa (suma pos_movimiento y pos_diferencia)
-- ---------------------------------------------------------------------------

do $$
declare
  v_nombre text;
begin
  select conname into v_nombre
  from pg_constraint
  where conrelid = 'public.asientos'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%origen_tipo%'
  limit 1;

  if v_nombre is not null then
    execute format('alter table public.asientos drop constraint %I', v_nombre);
  end if;
end;
$$;

alter table public.asientos
  add constraint asientos_origen_tipo_check check (origen_tipo in (
    'factura',
    'pago_recibido',
    'factura_proveedor',
    'pago_proveedor',
    'gasto_menor',
    'manual',
    'anulacion',
    'nota_credito_venta',
    'nota_credito_compra',
    'nota_debito',
    'transferencia',
    'deposito',
    'conciliacion',
    'ajuste_inventario',
    'saldo_inicial',
    'inventario_inicial',
    'pos_movimiento',
    'pos_diferencia',
    'nomina',
    'pago_nomina'
  ));

-- ---------------------------------------------------------------------------
-- 6) Semillas idempotentes: sobrante y faltante de caja
-- ---------------------------------------------------------------------------

do $$
declare
  v_cuenta_id uuid;
  v_grupo_id uuid;
  v_siguiente int;
  v_codigo text;
  v_seeds constant jsonb := jsonb_build_array(
    jsonb_build_object(
      'nombre', 'Sobrantes de caja',
      'clave', 'sobrante_caja',
      'grupo', '4',
      'tipo', 'ingreso',
      'naturaleza', 'credito',
      'base', 4104
    ),
    jsonb_build_object(
      'nombre', 'Faltantes de caja',
      'clave', 'faltante_caja',
      'grupo', '6',
      'tipo', 'gasto',
      'naturaleza', 'debito',
      'base', 6108
    )
  );
  v_seed jsonb;
begin
  for v_seed in select * from jsonb_array_elements(v_seeds) loop
    select c.id into v_grupo_id
    from public.cuentas c
    where c.codigo = v_seed ->> 'grupo';

    if v_grupo_id is null then
      raise exception 'no existe la cuenta de grupo %', v_seed ->> 'grupo'
        using errcode = '22023';
    end if;

    select c.id into v_cuenta_id
    from public.cuentas c
    where c.padre_id = v_grupo_id
      and c.tipo = v_seed ->> 'tipo'
      and c.acepta_movimientos
      and c.activa
      and lower(btrim(c.nombre)) = lower(btrim(v_seed ->> 'nombre'))
    order by c.codigo
    limit 1;

    if v_cuenta_id is null then
      select max(c.codigo::int) into v_siguiente
      from public.cuentas c
      where c.padre_id = v_grupo_id
        and c.codigo ~ '^[0-9]+$';

      v_codigo := greatest(
        coalesce(v_siguiente, (v_seed ->> 'base')::int) + 1,
        (v_seed ->> 'base')::int
      )::text;
      while exists (select 1 from public.cuentas c where c.codigo = v_codigo) loop
        v_codigo := (v_codigo::int + 1)::text;
      end loop;

      insert into public.cuentas (
        codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos
      )
      values (
        v_codigo,
        v_seed ->> 'nombre',
        v_seed ->> 'tipo',
        v_seed ->> 'naturaleza',
        v_grupo_id,
        true
      )
      returning id into v_cuenta_id;
    end if;

    insert into public.config_contable (clave, cuenta_id)
    values (v_seed ->> 'clave', v_cuenta_id)
    on conflict (clave) do nothing;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) Auditoría (reutiliza _auditar; no se audita el TRUNCATE del reset)
-- ---------------------------------------------------------------------------

drop trigger if exists auditoria_pos_terminales on public.pos_terminales;
create trigger auditoria_pos_terminales
  after insert or update on public.pos_terminales
  for each row
  execute function public._auditar(
    'nombre,almacen_id,cuenta_efectivo_id,cuenta_tarjeta_debito_id,cuenta_tarjeta_credito_id,cuenta_transferencia_id,numeracion_defecto_id,contacto_defecto_id,activa',
    'nombre',
    'terminal_pos'
  );

drop trigger if exists auditoria_pos_turnos on public.pos_turnos;
create trigger auditoria_pos_turnos
  after insert or update on public.pos_turnos
  for each row
  execute function public._auditar(
    'estado,base_inicial,efectivo_esperado,efectivo_real,diferencia,observaciones',
    'numero',
    'turno_pos'
  );

drop trigger if exists auditoria_pos_turno_movimientos on public.pos_turno_movimientos;
create trigger auditoria_pos_turno_movimientos
  after insert on public.pos_turno_movimientos
  for each row
  execute function public._auditar('monto,tipo,motivo', 'numero', 'movimiento_pos');

-- ---------------------------------------------------------------------------
-- 8) RLS y permisos: anon nada, authenticated lee, escritura solo por RPC
-- ---------------------------------------------------------------------------

do $$
declare
  v_tabla text;
begin
  foreach v_tabla in array array[
    'pos_terminales',
    'pos_turnos',
    'pos_turno_movimientos'
  ] loop
    execute format('alter table public.%I enable row level security', v_tabla);
    execute format('revoke all on public.%I from anon', v_tabla);
    execute format('revoke all on public.%I from authenticated', v_tabla);
    execute format('grant select on public.%I to authenticated', v_tabla);
    execute format('drop policy if exists %I on public.%I', v_tabla || '_leer', v_tabla);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.rol_actual()) is not null)',
      v_tabla || '_leer',
      v_tabla
    );
  end loop;
end;
$$;

revoke all on sequence public.pos_turnos_numero_seq from anon, authenticated;
revoke all on sequence public.pos_turno_movimientos_numero_seq from anon, authenticated;

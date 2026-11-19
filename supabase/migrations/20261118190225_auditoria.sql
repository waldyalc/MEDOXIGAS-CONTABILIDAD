-- ---------------------------------------------------------------------------
-- Auditoría: quién creó, quién modificó y quién anuló cada dato
--
-- Migración aditiva y reintentable: no toca tablas, datos ni políticas
-- existentes. Solo agrega:
--
-- · Tabla `auditoria` (append-only) + índices de lectura.
-- · RLS: todos los roles con perfil (admin, contador, lector) pueden LEER;
--   nadie puede escribir desde la app (ni siquiera admin): las filas las
--   inserta el trigger `security definer` y no hay grants de escritura.
-- · `public._auditar()`: helper de trigger. Cada tabla vigilada pasa por
--   TG_ARGV: [0] campos a comparar en UPDATE (coma), [1] campos de etiqueta
--   (coma, el primero no vacío gana: NCF, número, nombre) y [2] entidad.
--   La fila se lee con to_jsonb(new/old) para no depender de columnas fijas.
--   Solo audita usuarios autenticados (auth.uid()): service_role y la consola
--   SQL no generan ruido. En UPDATE sin cambios en los campos vigilados no
--   se inserta nada (un pago parcial que solo mueve `pagado` no es ruido).
-- · 8 triggers after insert or update or delete en las tablas críticas.
-- · RPC `obtener_auditoria(p jsonb)` de solo lectura (security invoker,
--   respeta RLS) con filtros y paginación; el dinero viaja como texto.
--
-- Nota: `asientos` no tiene columna `estado` (ver 20261113140000): se vigilan
-- `descripcion` y `total`.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Tabla de auditoría (append-only)
-- ---------------------------------------------------------------------------

create table if not exists public.auditoria (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users (id),
  usuario_nombre text not null default '',
  accion text not null check (accion in ('crear', 'modificar', 'anular')),
  entidad text not null,
  entidad_id uuid,
  entidad_etiqueta text not null default '',
  cambios jsonb not null default '[]',
  creado_en timestamptz not null default now()
);

create index if not exists auditoria_entidad_idx on public.auditoria (entidad, entidad_id);
create index if not exists auditoria_usuario_idx on public.auditoria (usuario_id);
create index if not exists auditoria_fecha_idx on public.auditoria (creado_en desc);

-- ---------------------------------------------------------------------------
-- RLS: lectura para todos los roles con perfil, escritura para nadie
-- ---------------------------------------------------------------------------

alter table public.auditoria enable row level security;

revoke all on public.auditoria from anon;
revoke all on public.auditoria from authenticated;
grant select on public.auditoria to authenticated;

drop policy if exists auditoria_lectura on public.auditoria;
create policy auditoria_lectura on public.auditoria
  for select to authenticated
  using ((select public.rol_actual()) is not null);

-- ---------------------------------------------------------------------------
-- Helper de trigger
--
-- TG_ARGV[0]: campos a comparar en UPDATE, separados por coma.
-- TG_ARGV[1]: campos de etiqueta (coma): el primero no vacío es la etiqueta
--             (NCF de la factura, número del pago, nombre del contacto…).
-- TG_ARGV[2]: entidad singular ('factura', 'contacto', …).
-- ---------------------------------------------------------------------------

create or replace function public._auditar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_accion text;
  v_entidad text;
  v_fila jsonb;
  v_vieja jsonb;
  v_id uuid;
  v_etiqueta text;
  v_campo text;
  v_cambios jsonb := '[]';
  v_anterior text;
  v_nuevo text;
  v_usuario uuid;
  v_nombre text;
begin
  v_accion := case tg_op when 'INSERT' then 'crear' when 'UPDATE' then 'modificar' when 'DELETE' then 'anular' end;
  v_entidad := tg_argv[2];
  v_usuario := auth.uid();

  -- Solo auditar usuarios autenticados (no system ni service_role).
  if v_usuario is null then
    return coalesce(new, old);
  end if;

  v_fila := coalesce(to_jsonb(new), to_jsonb(old));
  v_vieja := to_jsonb(old);
  v_id := (v_fila ->> 'id')::uuid;

  select p.nombre into v_nombre
  from public.perfiles p
  where p.user_id = v_usuario;

  -- Etiqueta para mostrar: primer campo no vacío de TG_ARGV[1], si no el id.
  v_etiqueta := '';
  foreach v_campo in array coalesce(string_to_array(coalesce(tg_argv[1], ''), ','), '{}') loop
    if v_etiqueta = '' and nullif(btrim(coalesce(v_fila ->> btrim(v_campo), '')), '') is not null then
      v_etiqueta := btrim(v_fila ->> btrim(v_campo));
    end if;
  end loop;
  v_etiqueta := coalesce(nullif(v_etiqueta, ''), v_id::text);

  -- En UPDATE: qué campos vigilados cambiaron (TG_ARGV[0]).
  if tg_op = 'UPDATE' then
    foreach v_campo in array coalesce(string_to_array(coalesce(tg_argv[0], ''), ','), '{}') loop
      v_anterior := v_vieja ->> btrim(v_campo);
      v_nuevo := v_fila ->> btrim(v_campo);
      if v_anterior is distinct from v_nuevo then
        v_cambios := v_cambios || jsonb_build_object(
          'campo', btrim(v_campo),
          'anterior', v_anterior,
          'nuevo', v_nuevo
        );
      end if;
    end loop;

    -- Sin cambios en los campos vigilados no se audita: sería ruido.
    if jsonb_array_length(v_cambios) = 0 then
      return new;
    end if;
  end if;

  insert into public.auditoria (
    usuario_id, usuario_nombre, accion, entidad, entidad_id, entidad_etiqueta, cambios
  )
  values (
    v_usuario, coalesce(v_nombre, ''), v_accion, v_entidad, v_id, coalesce(v_etiqueta, ''), v_cambios
  );

  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers: una tabla crítica, un trigger con su configuración
-- ---------------------------------------------------------------------------

drop trigger if exists auditoria_facturas on public.facturas;
create trigger auditoria_facturas
  after insert or update or delete on public.facturas
  for each row
  execute function public._auditar('estado,total,vencimiento,contacto_id', 'ncf', 'factura');

drop trigger if exists auditoria_facturas_proveedor on public.facturas_proveedor;
create trigger auditoria_facturas_proveedor
  after insert or update or delete on public.facturas_proveedor
  for each row
  execute function public._auditar('estado,total,ncf', 'ncf,numero', 'factura_proveedor');

drop trigger if exists auditoria_contactos on public.contactos;
create trigger auditoria_contactos
  after insert or update or delete on public.contactos
  for each row
  execute function public._auditar('nombre,rnc_cedula,correo,telefono,activo', 'nombre', 'contacto');

drop trigger if exists auditoria_productos on public.productos;
create trigger auditoria_productos
  after insert or update or delete on public.productos
  for each row
  execute function public._auditar('nombre,precio,costo,activo,cantidad', 'nombre', 'producto');

drop trigger if exists auditoria_pagos_recibidos on public.pagos_recibidos;
create trigger auditoria_pagos_recibidos
  after insert or update or delete on public.pagos_recibidos
  for each row
  execute function public._auditar('monto,metodo,estado', 'numero', 'pago_recibido');

drop trigger if exists auditoria_pagos_proveedor on public.pagos_proveedor;
create trigger auditoria_pagos_proveedor
  after insert or update or delete on public.pagos_proveedor
  for each row
  execute function public._auditar('monto,metodo,estado', 'numero', 'pago_proveedor');

drop trigger if exists auditoria_notas_credito_venta on public.notas_credito_venta;
create trigger auditoria_notas_credito_venta
  after insert or update or delete on public.notas_credito_venta
  for each row
  execute function public._auditar('total,estado', 'ncf', 'nota_credito');

-- `asientos` no tiene columna estado: se vigilan descripcion y total.
drop trigger if exists auditoria_asientos on public.asientos;
create trigger auditoria_asientos
  after insert or update or delete on public.asientos
  for each row
  execute function public._auditar('descripcion,total', 'numero', 'asiento');

-- ---------------------------------------------------------------------------
-- RPC de consulta (solo lectura, respeta RLS)
--
-- p: {entidad?, entidad_id?, usuario_id?, accion?, desde?, hasta?,
--     limite?, desplazamiento?, usuarios?}
-- Devuelve: {total, entradas: [{id, usuario_id, usuario_nombre, accion,
-- entidad, entidad_id, entidad_etiqueta, cambios, creado_en}],
-- usuarios: [{id, nombre}]} — `usuarios` (distintos de toda la tabla) solo
-- se llena con p.usuarios = 'true' para las opciones del filtro.
-- ---------------------------------------------------------------------------

create or replace function public.obtener_auditoria(p jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
-- Los filtros llegan como variables plpgsql: un plan genérico no puede
-- plegar `v_entidad is null` a falso y pierde los índices (misma lección que
-- buscar_global §3.8). Con custom plan el valor real participa en cada planeo.
set plan_cache_mode = 'force_custom_plan'
as $$
declare
  v_entidad text;
  v_entidad_id uuid;
  v_usuario_id uuid;
  v_accion text;
  v_desde date;
  v_hasta date;
  v_limite int;
  v_desplazamiento int;
  v_total int;
  v_entradas jsonb;
  v_usuarios jsonb;
begin
  -- Parámetros defensivos: el borde de la app valida, aquí no se confía.
  v_entidad := case
    when p->>'entidad' in ('factura', 'factura_proveedor', 'contacto', 'producto',
                           'pago_recibido', 'pago_proveedor', 'nota_credito', 'asiento')
    then p->>'entidad' else null end;

  v_entidad_id := case
    when (p->>'entidad_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (p->>'entidad_id')::uuid else null end;

  v_usuario_id := case
    when (p->>'usuario_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (p->>'usuario_id')::uuid else null end;

  v_accion := case
    when p->>'accion' in ('crear', 'modificar', 'anular') then p->>'accion' else null end;

  v_desde := case when p->>'desde' ~ '^\d{4}-\d{2}-\d{2}$' then (p->>'desde')::date else null end;
  v_hasta := case when p->>'hasta' ~ '^\d{4}-\d{2}-\d{2}$' then (p->>'hasta')::date else null end;

  v_limite := case
    when (p->>'limite') ~ '^\d+$' then least((p->>'limite')::int, 100) else 25 end;
  v_limite := greatest(v_limite, 1);

  v_desplazamiento := case
    when (p->>'desplazamiento') ~ '^\d+$' then (p->>'desplazamiento')::int else 0 end;

  select count(*) into v_total
  from public.auditoria a
  where (v_entidad is null or a.entidad = v_entidad)
    and (v_entidad_id is null or a.entidad_id = v_entidad_id)
    and (v_usuario_id is null or a.usuario_id = v_usuario_id)
    and (v_accion is null or a.accion = v_accion)
    and (v_desde is null or a.creado_en >= v_desde::timestamptz)
    and (v_hasta is null or a.creado_en < (v_hasta + 1)::timestamptz);

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_entradas
  from (
    select a.id, a.usuario_id, a.usuario_nombre, a.accion, a.entidad, a.entidad_id,
           a.entidad_etiqueta, a.cambios, a.creado_en
    from public.auditoria a
    where (v_entidad is null or a.entidad = v_entidad)
      and (v_entidad_id is null or a.entidad_id = v_entidad_id)
      and (v_usuario_id is null or a.usuario_id = v_usuario_id)
      and (v_accion is null or a.accion = v_accion)
      and (v_desde is null or a.creado_en >= v_desde::timestamptz)
      and (v_hasta is null or a.creado_en < (v_hasta + 1)::timestamptz)
    order by a.creado_en desc, a.id desc
    limit v_limite offset v_desplazamiento
  ) t;

  if p->>'usuarios' = 'true' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object('id', t.usuario_id, 'nombre', t.usuario_nombre)
        order by t.usuario_nombre, t.usuario_id
      ),
      '[]'::jsonb
    ) into v_usuarios
    from (
      select distinct a.usuario_id, a.usuario_nombre
      from public.auditoria a
      where a.usuario_id is not null
    ) t;
  else
    v_usuarios := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'total', v_total,
    'entradas', v_entradas,
    'usuarios', v_usuarios
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de funciones
-- ---------------------------------------------------------------------------

revoke all on function public._auditar() from public, anon, authenticated;

revoke all on function public.obtener_auditoria(jsonb) from public, anon, authenticated;
grant execute on function public.obtener_auditoria(jsonb) to authenticated;

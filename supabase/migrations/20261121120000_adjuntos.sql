-- ---------------------------------------------------------------------------
-- Adjuntos en documentos y fichas
--
-- · public.adjuntos: metadatos de cada archivo (qué entidad lo tiene, la ruta
--   del objeto en el bucket `documentos`, nombre, mime y tamaño). Una entidad
--   es un contacto, un producto, una factura de venta, una factura de
--   proveedor o un pago recibido.
-- · `creado_por_nombre` se guarda desnormalizado (mismo criterio que
--   auditoria.usuario_nombre): `perfiles` solo deja leer la fila propia, así
--   que el nombre del que subió no se puede resolver con un join en la app.
-- · RLS: lectura para cualquier usuario con perfil (admin, contador o
--   lector); las escrituras van solo por RPC security definer con rol
--   admin o contador. No hay políticas de insert/update/delete.
-- · Bucket privado `documentos` (PNG, JPG y PDF de hasta 10 MB): lectura para
--   autenticados (la app genera URLs firmadas) y subida solo admin/contador,
--   el mismo patrón del bucket `productos`. No hay políticas de update ni
--   delete: los objetos se borran dentro de `borrar_adjunto`.
--
-- Las rutas de los objetos tienen la forma
-- `<entidad_tipo>/<entidad_id>/<uuid>.<ext>`: el cliente sube el archivo y
-- `subir_adjunto` exige ese prefijo para que un adjunto no registre objetos
-- de otra entidad. Migración aditiva y reintentable.
-- ---------------------------------------------------------------------------

create table public.adjuntos (
  id uuid primary key default gen_random_uuid(),
  entidad_tipo text not null check (
    entidad_tipo in ('contacto', 'producto', 'factura', 'factura_proveedor', 'pago')
  ),
  entidad_id uuid not null,
  path text not null unique,
  nombre text not null,
  mime text not null,
  bytes integer not null default 0 check (bytes >= 0),
  creado_por uuid default auth.uid(),
  creado_por_nombre text,
  creado_en timestamptz not null default now()
);

create index adjuntos_entidad_idx on public.adjuntos (entidad_tipo, entidad_id);

alter table public.adjuntos enable row level security;

revoke all on public.adjuntos from anon;
revoke all on public.adjuntos from authenticated;
grant select on public.adjuntos to authenticated;

create policy adjuntos_lectura on public.adjuntos
  for select to authenticated
  using ((select public.rol_actual()) is not null);

-- ---------------------------------------------------------------------------
-- Registrar el adjunto (el archivo ya está subido al bucket `documentos`)
--
-- La entidad debe existir, el path debe tener el prefijo
-- `<entidad_tipo>/<entidad_id>/`, el mime se limita a lo que acepta el bucket
-- y el tamaño no puede pasar de 10 MB.
-- ---------------------------------------------------------------------------

create or replace function public.subir_adjunto(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_tipo text;
  v_entidad uuid;
  v_path text;
  v_nombre text;
  v_mime text;
  v_bytes bigint;
  v_id uuid;
  v_nombre_usuario text;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del adjunto requeridos' using errcode = '22023';
  end if;

  v_tipo := nullif(trim(coalesce(p->>'entidad_tipo', '')), '');
  if v_tipo is null or v_tipo not in ('contacto', 'producto', 'factura', 'factura_proveedor', 'pago') then
    raise exception 'tipo de entidad inválido' using errcode = '22023';
  end if;

  v_entidad := nullif(p->>'entidad_id', '')::uuid;
  if v_entidad is null then
    raise exception 'la entidad es obligatoria' using errcode = '22023';
  end if;

  if not case v_tipo
    when 'contacto' then exists (select 1 from public.contactos c where c.id = v_entidad)
    when 'producto' then exists (select 1 from public.productos pr where pr.id = v_entidad)
    when 'factura' then exists (select 1 from public.facturas f where f.id = v_entidad)
    when 'factura_proveedor' then exists (select 1 from public.facturas_proveedor fp where fp.id = v_entidad)
    else exists (select 1 from public.pagos_recibidos pg where pg.id = v_entidad)
  end then
    raise exception 'la entidad no existe' using errcode = '22023';
  end if;

  v_path := nullif(trim(coalesce(p->>'path', '')), '');
  if v_path is null then
    raise exception 'la ruta del archivo es obligatoria' using errcode = '22023';
  end if;
  if v_path not like v_tipo || '/' || v_entidad || '/%' then
    raise exception 'la ruta del archivo no corresponde a la entidad' using errcode = '22023';
  end if;

  v_nombre := nullif(trim(coalesce(p->>'nombre', '')), '');
  if v_nombre is null then
    raise exception 'el nombre del archivo es obligatorio' using errcode = '22023';
  end if;

  v_mime := nullif(trim(coalesce(p->>'mime', '')), '');
  if v_mime is null or v_mime not in ('image/png', 'image/jpeg', 'application/pdf') then
    raise exception 'el archivo debe ser PNG, JPG o PDF' using errcode = '22023';
  end if;

  v_bytes := case
    when coalesce(p->>'bytes', '') ~ '^\d+$' then (p->>'bytes')::bigint
    else -1
  end;
  if v_bytes < 0 then
    raise exception 'el tamaño del archivo no es válido' using errcode = '22023';
  end if;
  if v_bytes > 10485760 then
    raise exception 'el archivo no puede pesar más de 10 MB' using errcode = '22023';
  end if;

  select coalesce(pr.nombre, u.email::text)
  into v_nombre_usuario
  from public.perfiles pr
  left join auth.users u on u.id = pr.user_id
  where pr.user_id = auth.uid();

  insert into public.adjuntos (
    entidad_tipo, entidad_id, path, nombre, mime, bytes, creado_por, creado_por_nombre
  )
  values (v_tipo, v_entidad, v_path, v_nombre, v_mime, v_bytes, auth.uid(), v_nombre_usuario)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Borrar el adjunto y su objeto en el bucket (misma transacción)
-- ---------------------------------------------------------------------------

create or replace function public.borrar_adjunto(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_adjunto public.adjuntos%rowtype;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select * into v_adjunto
  from public.adjuntos a
  where a.id = p_id
  for update;

  if not found then
    raise exception 'adjunto no encontrado' using errcode = '22023';
  end if;

  delete from storage.objects o
  where o.bucket_id = 'documentos' and o.name = v_adjunto.path;

  delete from public.adjuntos a where a.id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Descargar: devuelve la ruta y el nombre para que la app firme la URL
-- ---------------------------------------------------------------------------

create or replace function public.descargar_adjunto(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_adjunto public.adjuntos%rowtype;
begin
  v_rol := public.rol_actual();
  if v_rol is null then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select * into v_adjunto
  from public.adjuntos a
  where a.id = p_id;

  if not found then
    raise exception 'adjunto no encontrado' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'id', v_adjunto.id,
    'nombre', v_adjunto.nombre,
    'path', v_adjunto.path,
    'mime', v_adjunto.mime,
    'bytes', v_adjunto.bytes
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Bucket privado `documentos` (mismo patrón que `productos`)
--
-- Lectura para cualquier autenticado (la app genera URLs firmadas) y subida
-- solo admin o contador. Sin políticas de update ni delete: el borrado del
-- objeto lo hace `borrar_adjunto` como definer.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 10485760, array['image/png', 'image/jpeg', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists documentos_lectura on storage.objects;
create policy documentos_lectura on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos');

drop policy if exists documentos_subir on storage.objects;
create policy documentos_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos' and (select public.rol_actual()) in ('admin', 'contador'));

-- ---------------------------------------------------------------------------
-- Permisos de funciones
-- ---------------------------------------------------------------------------

revoke all on function public.subir_adjunto(jsonb) from public, anon, authenticated;
grant execute on function public.subir_adjunto(jsonb) to authenticated;

revoke all on function public.borrar_adjunto(uuid) from public, anon, authenticated;
grant execute on function public.borrar_adjunto(uuid) to authenticated;

revoke all on function public.descargar_adjunto(uuid) from public, anon, authenticated;
grant execute on function public.descargar_adjunto(uuid) to authenticated;

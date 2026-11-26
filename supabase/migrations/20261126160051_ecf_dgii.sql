-- e-CF DGII: configuración multi-RNC, envíos emitidos y comprobantes recibidos.
--
-- Migración aditiva y reintentable. No aplica datos ni borra filas existentes.
-- Las contraseñas/certificados cifrados solo se escriben desde cuentas admin;
-- los SELECT de la aplicación quedan limitados a metadatos no sensibles.

-- ---------------------------------------------------------------------------
-- 1) Configuración por RNC emisor/receptor
-- ---------------------------------------------------------------------------

create table if not exists public.ecf_config (
  rnc text primary key,
  razon_social text not null,
  ambiente text not null default 'testecf',
  activo boolean not null default false,
  dominio_base text,
  cert_cifrado text,
  cert_pass_cifrada text,
  cert_titular text,
  cert_numero_serie text,
  cert_valido_hasta timestamptz,
  cert_huella_sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) default auth.uid(),
  constraint ecf_config_rnc_check check (rnc ~ '^[0-9]{9}([0-9]{2})?$'),
  constraint ecf_config_razon_social_check check (btrim(razon_social) <> ''),
  constraint ecf_config_ambiente_check check (ambiente in ('testecf', 'certecf', 'ecf')),
  constraint ecf_config_dominio_base_check check (dominio_base is null or btrim(dominio_base) <> ''),
  constraint ecf_config_cert_cifrado_check check (cert_cifrado is null or btrim(cert_cifrado) <> ''),
  constraint ecf_config_cert_pass_check check (cert_pass_cifrada is null or btrim(cert_pass_cifrada) <> '')
);

comment on table public.ecf_config is 'Configuración e-CF DGII por RNC del grupo (certificados cifrados, ambiente y activación).';
comment on column public.ecf_config.cert_cifrado is 'Certificado digital cifrado con AES-256-GCM; nunca se expone por SELECT directo.';
comment on column public.ecf_config.cert_pass_cifrada is 'Contraseña del certificado cifrada con AES-256-GCM; nunca se expone por SELECT directo.';

create index if not exists ecf_config_activo_idx on public.ecf_config (activo);
create index if not exists ecf_config_ambiente_idx on public.ecf_config (ambiente);

-- ---------------------------------------------------------------------------
-- 2) Envíos emitidos y cola de contingencia/reintentos
-- ---------------------------------------------------------------------------

create table if not exists public.ecf_envios (
  id uuid primary key default gen_random_uuid(),
  rnc_emisor text not null,
  documento_tipo text not null,
  documento_id uuid,
  tipo_ecf text not null,
  encf text not null,
  es_rfce boolean not null default false,
  ambiente text not null default 'testecf',
  estado text not null,
  track_id text,
  codigo_seguridad text,
  url_qr text,
  fecha_hora_firma text,
  xml_firmado text,
  xml_rfce text,
  respuesta_dgii jsonb,
  mensajes text[],
  secuencia_utilizada boolean,
  intentos integer not null default 0,
  ultimo_intento_at timestamptz,
  proximo_reintento_at timestamptz,
  contingencia_offline boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ecf_envios_rnc_emisor_check check (rnc_emisor ~ '^[0-9]{9}([0-9]{2})?$'),
  constraint ecf_envios_documento_tipo_check check (
    documento_tipo in ('factura', 'nota_credito', 'nota_debito', 'compra', 'gasto_menor', 'anulacion', 'prueba')
  ),
  constraint ecf_envios_tipo_ecf_check check (tipo_ecf in ('31', '32', '33', '34', '41', '43', '44', '45', '46', '47')),
  constraint ecf_envios_encf_check check (encf ~ '^E(31|32|33|34|41|43|44|45|46|47)[0-9]{10}$'),
  constraint ecf_envios_ambiente_check check (ambiente in ('testecf', 'certecf', 'ecf')),
  constraint ecf_envios_estado_check check (
    estado in ('pendiente', 'en_proceso', 'aceptado', 'aceptado_condicional', 'rechazado', 'error_red')
  ),
  constraint ecf_envios_codigo_seguridad_check check (codigo_seguridad is null or length(codigo_seguridad) = 6),
  constraint ecf_envios_intentos_check check (intentos >= 0),
  constraint ecf_envios_rnc_ambiente_encf_key unique (rnc_emisor, ambiente, encf)
);

comment on table public.ecf_envios is 'Trazabilidad e-CF emitidos hacia DGII: XML firmado, TrackId, estados, reintentos y contingencia 72h.';

create index if not exists ecf_envios_documento_idx on public.ecf_envios (documento_tipo, documento_id);
create index if not exists ecf_envios_estado_idx on public.ecf_envios (estado);
create index if not exists ecf_envios_reintento_idx
  on public.ecf_envios (proximo_reintento_at)
  where proximo_reintento_at is not null;
create index if not exists ecf_envios_track_id_idx on public.ecf_envios (track_id) where track_id is not null;

-- ---------------------------------------------------------------------------
-- 3) Comprobantes electrónicos recibidos de proveedores
-- ---------------------------------------------------------------------------

create table if not exists public.ecf_recibidos (
  id uuid primary key default gen_random_uuid(),
  rnc_receptor text not null,
  rnc_emisor text not null,
  razon_social_emisor text not null,
  correo_emisor text,
  tipo_ecf text not null,
  encf text not null,
  fecha_emision date,
  moneda text not null default 'DOP',
  monto_gravado numeric(14,2) not null default 0,
  monto_exento numeric(14,2) not null default 0,
  total_itbis numeric(14,2) not null default 0,
  monto_total numeric(14,2) not null default 0,
  codigo_seguridad text,
  firma_valida boolean not null default false,
  estado_arecf text not null default '0',
  codigo_motivo_no_recibido text,
  estado_acecf text not null default 'pendiente',
  motivo_rechazo text,
  fecha_acecf timestamptz,
  xml_original text not null,
  xml_arecf text,
  xml_acecf text,
  items_resumen jsonb not null default '[]'::jsonb,
  factura_compra_id uuid references public.facturas_proveedor (id),
  origen text not null default 'dgii',
  recibido_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ecf_recibidos_rnc_receptor_check check (rnc_receptor ~ '^[0-9]{9}([0-9]{2})?$'),
  constraint ecf_recibidos_rnc_emisor_check check (rnc_emisor ~ '^[0-9]{9}([0-9]{2})?$'),
  constraint ecf_recibidos_razon_social_check check (btrim(razon_social_emisor) <> ''),
  constraint ecf_recibidos_tipo_ecf_check check (tipo_ecf in ('31', '32', '33', '34', '41', '43', '44', '45', '46', '47')),
  constraint ecf_recibidos_encf_check check (encf ~ '^E(31|32|33|34|41|43|44|45|46|47)[0-9]{10}$'),
  constraint ecf_recibidos_moneda_check check (moneda ~ '^[A-Z]{3}$'),
  constraint ecf_recibidos_monto_gravado_check check (monto_gravado >= 0),
  constraint ecf_recibidos_monto_exento_check check (monto_exento >= 0),
  constraint ecf_recibidos_total_itbis_check check (total_itbis >= 0),
  constraint ecf_recibidos_monto_total_check check (monto_total >= 0),
  constraint ecf_recibidos_codigo_seguridad_check check (codigo_seguridad is null or length(codigo_seguridad) = 6),
  constraint ecf_recibidos_estado_arecf_check check (estado_arecf in ('0', '1')),
  constraint ecf_recibidos_motivo_no_recibido_check check (
    codigo_motivo_no_recibido is null or codigo_motivo_no_recibido in ('1', '2', '3', '4')
  ),
  constraint ecf_recibidos_estado_acecf_check check (estado_acecf in ('pendiente', 'aprobado', 'rechazado')),
  constraint ecf_recibidos_xml_original_check check (btrim(xml_original) <> ''),
  constraint ecf_recibidos_items_resumen_check check (jsonb_typeof(items_resumen) = 'array'),
  constraint ecf_recibidos_origen_check check (origen in ('dgii', 'importacion_manual')),
  constraint ecf_recibidos_receptor_emisor_encf_key unique (rnc_receptor, rnc_emisor, encf)
);

comment on table public.ecf_recibidos is 'Bandeja fiscal de e-CF recibidos por RNC receptor, con ARECF/ACECF y enlace al registro de compras.';

create index if not exists ecf_recibidos_receptor_idx on public.ecf_recibidos (rnc_receptor, recibido_at);
create index if not exists ecf_recibidos_emisor_idx on public.ecf_recibidos (rnc_emisor, encf);
create index if not exists ecf_recibidos_estado_acecf_idx on public.ecf_recibidos (estado_acecf);
create index if not exists ecf_recibidos_factura_compra_idx
  on public.ecf_recibidos (factura_compra_id)
  where factura_compra_id is not null;

-- ---------------------------------------------------------------------------
-- 4) RLS y privilegios por rol
-- ---------------------------------------------------------------------------

alter table public.ecf_config enable row level security;
alter table public.ecf_envios enable row level security;
alter table public.ecf_recibidos enable row level security;

revoke all on public.ecf_config from anon;
revoke all on public.ecf_envios from anon;
revoke all on public.ecf_recibidos from anon;
revoke all on public.ecf_config from authenticated;
revoke all on public.ecf_envios from authenticated;
revoke all on public.ecf_recibidos from authenticated;

-- ecf_config: admin/contador leen metadatos; solo admin inserta, actualiza o borra.
-- Los dos secretos cifrados quedan fuera incluso del SELECT directo de authenticated.
grant select (
  rnc,
  razon_social,
  ambiente,
  activo,
  dominio_base,
  cert_titular,
  cert_numero_serie,
  cert_valido_hasta,
  cert_huella_sha256,
  created_at,
  updated_at,
  updated_by
) on public.ecf_config to authenticated;
grant insert, update, delete on public.ecf_config to authenticated;

drop policy if exists ecf_config_leer_admin_contador on public.ecf_config;
create policy ecf_config_leer_admin_contador on public.ecf_config
  for select to authenticated
  using ((select public.rol_actual()) in ('admin', 'contador'));

drop policy if exists ecf_config_insertar_admin on public.ecf_config;
create policy ecf_config_insertar_admin on public.ecf_config
  for insert to authenticated
  with check ((select public.rol_actual()) = 'admin');

drop policy if exists ecf_config_actualizar_admin on public.ecf_config;
create policy ecf_config_actualizar_admin on public.ecf_config
  for update to authenticated
  using ((select public.rol_actual()) = 'admin')
  with check ((select public.rol_actual()) = 'admin');

drop policy if exists ecf_config_borrar_admin on public.ecf_config;
create policy ecf_config_borrar_admin on public.ecf_config
  for delete to authenticated
  using ((select public.rol_actual()) = 'admin');

-- ecf_envios: evidencia fiscal legible por los tres roles con perfil; escritura
-- operativa solo admin/contador y sin DELETE físico desde la aplicación.
grant select, insert, update on public.ecf_envios to authenticated;

drop policy if exists ecf_envios_leer_roles on public.ecf_envios;
create policy ecf_envios_leer_roles on public.ecf_envios
  for select to authenticated
  using ((select public.rol_actual()) in ('admin', 'contador', 'lector'));

drop policy if exists ecf_envios_insertar_admin_contador on public.ecf_envios;
create policy ecf_envios_insertar_admin_contador on public.ecf_envios
  for insert to authenticated
  with check ((select public.rol_actual()) in ('admin', 'contador'));

drop policy if exists ecf_envios_actualizar_admin_contador on public.ecf_envios;
create policy ecf_envios_actualizar_admin_contador on public.ecf_envios
  for update to authenticated
  using ((select public.rol_actual()) in ('admin', 'contador'))
  with check ((select public.rol_actual()) in ('admin', 'contador'));

-- ecf_recibidos: bandeja legible por admin/contador/lector; recepción y
-- clasificación escriben solo admin/contador, sin borrado físico.
grant select, insert, update on public.ecf_recibidos to authenticated;

drop policy if exists ecf_recibidos_leer_roles on public.ecf_recibidos;
create policy ecf_recibidos_leer_roles on public.ecf_recibidos
  for select to authenticated
  using ((select public.rol_actual()) in ('admin', 'contador', 'lector'));

drop policy if exists ecf_recibidos_insertar_admin_contador on public.ecf_recibidos;
create policy ecf_recibidos_insertar_admin_contador on public.ecf_recibidos
  for insert to authenticated
  with check ((select public.rol_actual()) in ('admin', 'contador'));

drop policy if exists ecf_recibidos_actualizar_admin_contador on public.ecf_recibidos;
create policy ecf_recibidos_actualizar_admin_contador on public.ecf_recibidos
  for update to authenticated
  using ((select public.rol_actual()) in ('admin', 'contador'))
  with check ((select public.rol_actual()) in ('admin', 'contador'));

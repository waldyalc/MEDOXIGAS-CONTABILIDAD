-- Medoxigas Contabilidad · Perfiles y roles
--
-- `perfiles` guarda el rol de cada usuario (admin, contador, lector).
-- Cada usuario solo lee su propio perfil. Nadie escribe desde la app:
-- los perfiles los crea el administrador (service_role / SQL).

create table public.perfiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nombre text,
  rol text not null check (rol in ('admin', 'contador', 'lector')),
  creado_en timestamptz not null default now()
);

alter table public.perfiles enable row level security;

revoke all on public.perfiles from anon;
revoke insert, update, delete, truncate on public.perfiles from authenticated;
grant select on public.perfiles to authenticated;

create policy perfiles_leer_propio on public.perfiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

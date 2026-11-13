-- ---------------------------------------------------------------------------
-- Storage para el logo de la empresa
--
-- Bucket público `logos`: cualquiera con la URL pública lo ve, pero solo el
-- rol admin puede subir, reemplazar o borrar archivos. El bucket se crea una
-- sola vez y no se toca si ya existe.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists logos_lectura on storage.objects;
create policy logos_lectura on storage.objects
  for select to authenticated
  using (bucket_id = 'logos');

drop policy if exists logos_admin_subir on storage.objects;
create policy logos_admin_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'logos' and (select public.rol_actual()) = 'admin');

drop policy if exists logos_admin_actualizar on storage.objects;
create policy logos_admin_actualizar on storage.objects
  for update to authenticated
  using (bucket_id = 'logos' and (select public.rol_actual()) = 'admin')
  with check (bucket_id = 'logos' and (select public.rol_actual()) = 'admin');

drop policy if exists logos_admin_borrar on storage.objects;
create policy logos_admin_borrar on storage.objects
  for delete to authenticated
  using (bucket_id = 'logos' and (select public.rol_actual()) = 'admin');

-- ---------------------------------------------------------------------------
-- Auditoría: vigilar también el límite de crédito de los contactos.
--
-- El trigger original (20261120100000_auditoria.sql) compara
-- nombre/rnc_cedula/correo/telefono/activo: subir o bajar el límite de crédito
-- de un cliente es una decisión de negocio y debe dejar rastro en el trace.
-- Se recrea el trigger sumando el campo a la lista vigilada, con el mismo
-- patrón reintentable (drop + create) del archivo de auditoría.
-- ---------------------------------------------------------------------------

drop trigger if exists auditoria_contactos on public.contactos;

create trigger auditoria_contactos
  after insert or update or delete on public.contactos
  for each row
  execute function public._auditar('nombre,rnc_cedula,correo,telefono,activo,limite_credito', 'nombre', 'contacto');

alter table public.contactos
  add column if not exists limite_credito numeric(14,2);

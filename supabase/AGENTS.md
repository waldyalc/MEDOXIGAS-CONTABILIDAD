# Supabase — reglas para agentes

Proyecto **MEDOXIGAS-CONTABILIDAD** (`ljfdhrnvlsfaweuvnqxz`, ca-central-1). Tablas: `perfiles` (rol por usuario: `admin`, `contador`, `lector`).

## Comandos (solo local, NUNCA contra producción)

```bash
supabase start        # levanta la pila local (Docker)
supabase test db      # pgTAP: supabase/tests/*_test.sql (hace rollback solo)
pnpm db:types         # regenera src/lib/supabase/types.ts tras cada migración
```

## Migraciones

- Archivo nuevo en `supabase/migrations/`, nunca editar uno aplicado. Nada que borre o cambie datos sin OK de Waldy.
- Probar en local (`supabase start` + `supabase db reset`) o en `BEGIN/ROLLBACK` antes de aplicar.

## RLS (núcleo de seguridad)

- RLS activo en toda tabla de `public`. `anon` no ve nada. `authenticated` lee según su rol; las escrituras de negocio van por RPC (security definer, rol leído de `perfiles`, `set search_path = ''`), sin DELETE físico en documentos contables (se anulan).
- `perfiles`: cada usuario lee solo su fila; nadie escribe desde la app (los crea el admin por SQL/service_role).
- `service_role` jamás en el cliente ni en prompts: la app solo usa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clave publicable).
- Nunca cambiar una política para que un test pase sin el OK de Waldy; nunca desactivar RLS.
- pgTAP: `tests/perfiles_test.sql` (RLS activo, solo su fila, insert negado, anon sin lectura).

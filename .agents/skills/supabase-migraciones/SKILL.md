---
name: supabase-migraciones
description: Dónde viven las migraciones, cómo se nombran con timestamp UTC real, la obligación de RLS, y que el agente solo escribe el archivo (nunca aplica en el remoto ni usa service_role).
---

# Migraciones de Supabase

Viven en `supabase/migrations/`. El proyecto es **MEDOXIGAS-CONTABILIDAD** (`ljfdhrnvlsfaweuvnqxz`) y es la única base. La app solo usa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Detalle de tablas y RPC: `supabase/AGENTS.md` y `docs/contrato-db.md` (revisa también las migraciones posteriores; esas guías pueden ir atrasadas).

## Nombre del archivo

`YYYYMMDDHHMMSS_descripcion_en_snake_case.sql`, en UTC real y **estrictamente mayor** que el último archivo ya existente. Ejemplos reales:

- `20261113132637_perfiles.sql`
- `20261113140000_motor_contable.sql`
- `20261123000000_tipos_entrada_diario.sql`

El timestamp debe ser una fecha y hora válidas: nada de horas 25, minutos 99, ni fechas futuras inventadas. Si dudas, usa la hora UTC actual (`date -u +%Y%m%d%H%M%S`) y asegúrate de que supere a la última migración.

Nunca edites una migración que ya está en el repo o aplicada. Cualquier cambio va en un archivo nuevo, aditivo y reintentable. Nada que borre o reescriba datos sin OK de Waldy.

## Qué puedes hacer tú

- Escribir el archivo `.sql` y, si aplica, el test pgTAP en `supabase/tests/<nombre>_test.sql`.
- Regenerar tipos en local con `pnpm db:types` cuando el Orquestador lo pida, y commitear `src/lib/supabase/types.ts` (no lo edites a mano).

## Qué no puedes hacer

- No apliques la migración al proyecto remoto (`supabase db push`, `supabase db execute`, `--linked`, `--db-url`, el dashboard ni SQL contra la base real). El Orquestador la revisa y, con OK de Waldy si toca datos, la aplica.
- No uses ni pidas la clave `service_role`. No la pongas en el cliente, en un script ni en un prompt.
- No desactives RLS ni cambies una política solo para que un test pase.

## RLS

Toda tabla nueva en `public` lleva `enable row level security` y políticas explícitas. El patrón del repo: `anon` no ve nada; `authenticated` lee según el rol; las escrituras de negocio van por RPC `security definer`. Ejemplos: `20261113132637_perfiles.sql`, el bucle de RLS en `20261113140000_motor_contable.sql`, y tablas posteriores como `conciliaciones`, `adjuntos` y `auditoria`.

## Cómo probar (solo local)

```bash
supabase start
# opcional, para ver la migración desde cero: supabase db reset
supabase test db
```

Nunca esos comandos contra producción o el proyecto vinculado. En CI, el job **`db`** corre `supabase test db` y verifica que `types.ts` esté al día.

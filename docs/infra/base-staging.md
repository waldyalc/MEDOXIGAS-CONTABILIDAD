# Base de datos de staging / pruebas — propuesta (pendiente de Waldy)

Auditoría VPS, 23-11-2026. **Nada de esto está aplicado**: son opciones para
que Waldy decida. No se crearon proyectos nuevos ni se tocaron credenciales.

## Cómo está hoy (verificado 23-11-2026, confirmado por Waldy)

- **Un solo proyecto Supabase para Contabilidad:** `ljfdhrnvlsfaweuvnqxz`
  (región ca-central-1, plan gratis, org «MEDOXIGAS operacioens») y es
  **producción**: es la base que usa https://medoxigas-contabilidad.vercel.app,
  donde Waldy hace su prueba real del mes (MSG-55). Antes figuraba en los docs
  como «proyecto de prueba»; eso ya se corrigió.
- **`.env.local` del VPS** (checkout principal y todos los worktrees, que lo
  enlazan) apunta al mismo proyecto de producción. Lo usan el preview 3010
  (`medoxigas-preview.service`), los dev servers de los hijos y el usuario
  ZZTEST — **solo para leer**.
- Regla vigente (`AGENTS.md`): los agentes **leen** producción solo con
  usuarios ZZTEST y **nunca escriben datos ni aplican migraciones** sin el OK
  de Waldy; las pruebas con escritura van a Postgres local
  (`scripts/pgtap-local.sh`). El e2e de CI soporta un proyecto aparte vía
  secrets (`E2E_SUPABASE_URL`/`E2E_SUPABASE_ANON_KEY`).

## Problema

Los agentes escribieron datos de prueba (documentos ZZTEST) sobre la misma
base que sirve a producción — donde Waldy hoy hace su prueba real del mes.
La regla nueva ya prohíbe escrituras, pero un segundo proyecto eliminaría el
riesgo de raíz y devolvería un espacio donde probar con escritura libre.

## Opciones

### A) Segundo proyecto Supabase gratis para agentes (recomendada)

Crear un proyecto aparte en la misma org (plan gratis cubre 2 proyectos por
org; verificar el límite vigente en el panel). Quedaría:

| Uso | Proyecto |
| --- | --- |
| Producción + preview 3010 + `prueba` de Vercel | `ljfdhrnvlsfaweuvnqxz` (o el actual de prod) |
| Dev servers de hijos, e2e local, pgTAP manual | **proyecto nuevo «medoxigas-staging»** |

- Migraciones: `supabase db push` enlazado al proyecto nuevo, o `db reset`
  local y dump. Semilla: datos ZZTEST nuevos creados allí (nunca copiar ni
  sembrar nada en producción).
- `.env.local` del checkout principal deja de compartirse: los worktrees
  enlazarían un `.env.staging` con la URL/anon del proyecto nuevo (cambia la
  línea de `scripts/t3-worktree-setup.sh`, un sitio solo).
- Coste: $0 en plan gratis; trabajo: ~1 h (crear proyecto, push de
  migraciones, semilla ZZTEST, apuntar worktrees y secrets `E2E_*` de GitHub).

### B) `supabase start` local en Docker dentro del VPS

La pila oficial del CLI levanta Postgres + Auth + Storage + Realtime en
Docker. Es la réplica más fiel (misma versión, mismos defaults, `supabase test db`
nativo).

- **Coste en RAM:** la pila completa (Kong, GoTrue, PostgREST, Realtime,
  Storage, Studio, Postgres) son ~1.5–2.5 GB residentes mientras corre. Con el
  VPS hoy al límite solo es viable si se levanta **bajo demanda**
  (`supabase start` → pruebas → `supabase stop`), nunca como servicio fijo.
- Requiere instalar Docker (~150 MB de disco, daemon ~100–300 MB RAM idle
  también bajo demanda con `systemctl start docker` solo al usarlo).
- **No aplicado**: se deja como plan B si la opción A no convence o para tests
  aislados sin tocar ni staging.

### C) Postgres pelado para pgTAP (ya aplicado en infra)

Para `supabase test db` / pgTAP **sin** pila completa ya existe
`scripts/pgtap-local.sh`: levanta un Postgres desechable en /tmp, aplica las
migraciones y corre `supabase/tests/*.sql`. Se instaló `postgresql-18` +
`pgtap` vía apt **sin servicio** (binarios solos; ver sección pgTAP del
reporte). Es suficiente para validar migraciones y RLS, pero no replica Auth,
Storage ni Edge → no sirve como base de app (de ahí las opciones A/B).

## Recomendación

Opción **A** cuando haya ventana: devuelve un espacio donde los agentes pueden
escribir datos de prueba sin tocar la base que Waldy usa en producción.
Mientras tanto, la opción C ya cubre pgTAP local y la regla queda:
`ljfdhrnvlsfaweuvnqxz` es **producción** — los agentes solo la leen con
ZZTEST; las pruebas con escritura van a Postgres local.

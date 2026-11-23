# Base de datos de staging / pruebas — propuesta (pendiente de Waldy)

Auditoría VPS, 23-11-2026. **Nada de esto está aplicado**: son opciones para
que Waldy decida. No se crearon proyectos nuevos ni se tocaron credenciales.

## Cómo está hoy (verificado 23-11-2026)

- **Un solo proyecto Supabase para Contabilidad:** `ljfdhrnvlsfaweuvnqxz`
  (región ca-central-1, plan gratis, org «MEDOXIGAS operacioens»). En
  `AGENTS.md` figura como **«proyecto de prueba»**; la base de producción y la
  de Medoxigas-OPP son otros proyectos que el VPS no toca.
- **`.env.local` del VPS** (checkout principal y todos los worktrees, que lo
  enlazan) apunta a `ljfdhrnvlsfaweuvnqxz`. Es la base que usa el preview 3010
  (`medoxigas-preview.service`), los dev servers de los hijos y el usuario
  ZZTEST. Contiene datos falsos/semilla de prueba (~32 k documentos).
- **Vercel** (medoxigas-contabilidad.vercel.app) tiene sus propias variables
  de entorno, invisibles desde el VPS. Si apuntan al mismo proyecto, la
  «producción» lee los datos que los agentes escriben como ZZTEST; si apuntan
  a otro, el riesgo ya está acotado. **Confirmar en Vercel → Settings →
  Environment Variables** cuál es el caso (decisión de Waldy).
- Regla vigente (`AGENTS.md`): Supabase remoto solo se toca con OK de Waldy;
  los agentes prueban contra el proyecto de prueba o contra `supabase start`
  local. El e2e de CI ya soporta un proyecto aparte vía secrets
  (`E2E_SUPABASE_URL`/`E2E_SUPABASE_ANON_KEY`).

## Problema

Los agentes escriben datos de prueba (documentos ZZTEST) sobre la misma base
que sirve al preview y —posiblemente— a la web pública. Si esa base un día se
vuelve «la de verdad», cada agente es un riesgo de datos corruptos.

## Opciones

### A) Segundo proyecto Supabase gratis para agentes (recomendada)

Crear un proyecto aparte en la misma org (plan gratis cubre 2 proyectos por
org; verificar el límite vigente en el panel). Quedaría:

| Uso | Proyecto |
| --- | --- |
| Producción + preview 3010 + `prueba` de Vercel | `ljfdhrnvlsfaweuvnqxz` (o el actual de prod) |
| Dev servers de hijos, e2e local, pgTAP manual | **proyecto nuevo «medoxigas-staging»** |

- Migraciones: `supabase db push` enlazado al proyecto nuevo, o `db reset`
  local y dump. Semilla: los mismos datos ZZTEST que hoy.
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

Opción **A** cuando haya ventana: separa de verdad lo que los agentes escriben
de lo que Waldy ve en el preview y en producción, sin cargar más el VPS.
Mientras tanto, la opción C ya cubre pgTAP local y la regla queda: **los
agentes nunca prueban contra producción** — solo `ljfdhrnvlsfaweuvnqxz`
(prueba) o Postgres local; y en la base de prueba, solo datos ZZTEST.

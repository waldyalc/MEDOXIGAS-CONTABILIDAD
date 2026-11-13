# MEDOXIGAS ALC, SRL — OPP

ERP interno de la planta de oxígeno líquido. Esta versión tiene un solo módulo: **Producción** (merma de LOX).

El frontend usa la plantilla **Studio Admin** (`arhamkhnz/next-shadcn-admin-dashboard-baseui`, MIT) como base:
shell con sidebar, header con búsqueda, panel de Preferencias (tema, fuente, modo claro/oscuro/sistema, diseño)
y modo oscuro. El sidebar muestra solo Producción.

## Correr en local

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Abre http://localhost:3000. Sin sesión, la app manda a `/login`.

## Variables

En `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clave anon o publishable)

No subas secretos. No hay registro público: el usuario se crea a mano en Supabase → Authentication. El pipeline que escribe usa la service role, fuera de esta app.

## Estructura

- Rutas: `src/app/(main)/dashboard/produccion/page.tsx` (Server Component chico, solo compone).
- Componentes de la pantalla: `.../produccion/_components/`. Consultas: `src/lib/produccion.ts`. Formato es-DO: `src/lib/formato.ts`.
- Menú: `src/navigation/sidebar/sidebar-items.ts`.
- Auth: `src/lib/supabase/server.ts` y `src/proxy.ts` (el middleware de Next.js 16 exige sesión en todo salvo `/login`).
- Login: `src/app/login/` (diseño v2 de la plantilla, en español, solo email y contraseña contra Supabase Auth).
- Tema de marca "Medoxigas": `src/styles/presets/medoxigas.css` (preset por defecto; tokens `--primary`, `--ring`,
  `--chart-1`, `--sidebar-*`, `--brand-dark`).

## Migraciones

`supabase/migrations/20261030140000_produccion.sql`

En el proyecto de Supabase:

```bash
supabase db push
```

O pega el SQL en el editor. En Postgres pelado, crea antes los roles que Supabase ya trae y luego aplica el archivo:

```sql
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
```

La base arranca vacía, salvo el tanque `TM-22820` (22,820 kg, nivel bajo 3,000 kg, aviso 1.55 MPa, alivio 1.58 MPa). La meta de merma esperada va en `tanques.merma_esperada_pct` y queda vacía hasta que se cargue.

Para importar: `isos.nombre` y `lecturas_reloj.msg_id` son únicos (upsert). `llenados.msg_id` puede ser nulo en histórico. `llenados.kg` se calcula solo (cilindros × 8 + termos × 208). Si fijas ids a mano, ajusta la secuencia:

```sql
select setval(pg_get_serial_sequence('public.isos', 'id'), (select max(id) from public.isos));
```

# Medoxigas Contabilidad

Sistema de contabilidad y facturación de **MEDOXIGAS ALC, SRL**, inspirado en Alegra sin copiar su código, textos ni diseño. El estudio de sus flujos de trabajo vive en `docs/alegra/`.

Esta versión es el **cascarón**: login con Supabase Auth (correo/contraseña y Google) y un dashboard **Inicio** con menú lateral. Los módulos siguientes aparecen en el menú deshabilitados con el badge «soon»: Facturación, Clientes, Productos, Gastos, Bancos y Reportes.

## Cómo correr

Requiere Node.js 22 LTS y pnpm 10.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Abre http://localhost:3000. Sin sesión, la app manda a `/login`.

## Variables de entorno

En `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clave anon o publishable)

No subas secretos. No hay registro público: los usuarios se crean a mano en Supabase → Authentication y el administrador les asigna su fila en `perfiles`.

## Roles y acceso

La tabla `public.perfiles` guarda el rol de cada usuario:

- `admin`
- `contador`
- `lector`

Un usuario sin fila en `perfiles` o con un rol no válido va a `/unauthorized`. La app solo lee el perfil propio; no lo crea ni lo modifica.

## Estructura

- Inicio: `src/app/(main)/dashboard/page.tsx` (Server Component chico, solo compone).
- Menú lateral: `src/navigation/sidebar/sidebar-items.ts`.
- Rol del usuario: `src/lib/auth/rol.ts`.
- Clientes de Supabase: `src/lib/supabase/` (`server.ts`, `client.ts`, `proxy.ts`).
- Middleware de Next.js 16: `src/proxy.ts` (exige sesión en todo salvo `/login`).
- Login: `src/app/login/` y `src/components/login-form.tsx` (en español, correo/contraseña y Google contra Supabase Auth).

## Base de datos y migraciones

Migración existente: `supabase/migrations/20261113132637_perfiles.sql`. Crea la tabla `perfiles` con RLS y lectura únicamente del perfil propio; la columna `rol` acepta `admin`, `contador` y `lector`.

Después de cada migración, regenera los tipos:

```bash
pnpm db:types
```

Las migraciones se prueban solo en local:

```bash
supabase start
supabase test db
```

## Calidad

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm build
pnpm test:e2e
```

El humo de navegador (`pnpm test:e2e`) se salta si no están definidas `E2E_EMAIL` y `E2E_PASSWORD`.

# Handoff — Medoxigas Contabilidad

## Arranque del proyecto (13 nov 2026)
- Repo `waldyalc/MEDOXIGAS-CONTABILIDAD` (privado), ramas `main` (producción) y `prueba`.
- Base tomada de Medoxigas-OPP (misma configuración: Next 16, pnpm, Biome, Vitest, Playwright, husky, CI, gitleaks, flujo Supabase local) **sin** sus módulos de negocio.
- Supabase `MEDOXIGAS-CONTABILIDAD` (`ljfdhrnvlsfaweuvnqxz`, ca-central-1, gratis). Migración `20261113132637_perfiles.sql` aplicada; `types.ts` generado desde el proyecto.
- Vercel `medoxigas-contabilidad` (mismo equipo que OPP): producción desde `main`, alias fijo de `prueba` en medoxigas-contabilidad-prueba.vercel.app. Variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clave publicable).
- App: login (correo + contraseña y botón Google) y dashboard vacío con menú; módulos futuros como "Próximamente".

## Pendiente
- Crear el usuario de Waldy en Supabase Auth y su fila en `perfiles` con rol `admin` (SQL con OK de Waldy).
- Google: activar el proveedor Google en Supabase Auth (Client ID/secret de Google Cloud) y agregar las URL de redirección de producción y prueba. Hasta entonces el botón Google da error y se entra con correo y contraseña.
- Supabase Auth → URL Configuration: Site URL = producción y Redirect URLs de prueba.
- Estudio de Alegra con la cuenta de prueba que da Waldy → `docs/alegra/`.
- Secrets de GitHub para el humo e2e (opcional): `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`.

---
name: localhost
description: Levantar o comprobar el servidor de desarrollo en un worktree de T3 Code en Windows (puerto, .env.local, login y la misma base de producción).
---

# Localhost

Localhost es la app corriendo en la computadora de Waldy con `pnpm dev`. Sirve para ver un cambio antes de subirlo a `prueba`. No es un ambiente aparte: las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` de `.env.local` apuntan al **mismo proyecto Supabase** que producción y prueba. Lo que crees o borres aquí queda en la base real.

## Dónde corres

- Estás en Windows (PowerShell), en un worktree de T3: `C:\Users\wardy\.t3\worktrees\MEDOXIGAS-CONTABILIDAD\<rama>`.
- La copia principal de Waldy está en `C:\Users\wardy\proyectos\MEDOXIGAS-CONTABILIDAD`. El puerto **3000** es de él. No lo ocupes ni lo mates.

## `.env.local`

Los worktrees no traen `.env.local` (está en `.gitignore`, patrón `.env*` con excepción de `.env.example`). Cópialo una vez por worktree:

```powershell
Copy-Item C:\Users\wardy\proyectos\MEDOXIGAS-CONTABILIDAD\.env.local .env.local
```

- Nunca imprimas su contenido, ni lo pongas en un commit, en el chat o en un log.
- No lo crees a mano con claves. Si no existe en la copia principal, dilo y para. `.env.example` solo muestra los nombres de las variables, sin secretos.

## Cómo levantarlo

Si falta `node_modules`, corre `pnpm install`. Luego usa un puerto libre distinto de 3000 (3001 de preferencia):

```powershell
pnpm dev -p 3001
```

Si 3001 está ocupado, prueba 3002, 3003, etc. Para comprobar que responde:

```powershell
(Invoke-WebRequest -UseBasicParsing http://localhost:3001/login).StatusCode
```

Un `200` en `/login` significa que el servidor está arriba.

## Login (no lo evites)

`src/proxy.ts` (middleware de Next.js 16) llama a `updateSession` en `src/lib/supabase/proxy.ts`. Sin sesión, cualquier ruta que no sea `/login`, `/auth/callback` o un ícono redirige a `/login`. Si ya hay sesión, `/login` redirige a `/dashboard`.

- No crees rutas temporales ni toques `src/proxy.ts` (ni un `middleware.ts`) para saltarte el login.
- Si el login te bloquea la revisión visual, sáltate esa parte y repórtalo. No inventes usuarios ni uses secretos de `.env.local` para entrar.

## Datos

Como localhost usa la misma base que producción: **solo lectura**. No crees, edites ni borres contactos, facturas, asientos ni ningún dato real. Para probar cálculos, usa los tests (`pnpm test` o `supabase test db` en local).

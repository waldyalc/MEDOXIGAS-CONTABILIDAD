<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Medoxigas Contabilidad

Sistema de **contabilidad, POS y facturación** propio de **MEDOXIGAS ALC, SRL** (y piloto **OXYMAT, SRL**), República Dominicana. Dueño: Waldy Alcántara.

- **Diseño (ley):** **copia exacta de Alegra** (`docs/alegra/ALEGRA.md`, `docs/DESIGN.md`, `docs/plantilla-diseno.md`) en estructura, ritmo y comportamiento — pero **sin copiar el verde teal ni la marca de Alegra**: todo acento sale del color global de marca (`--brand-primary: #1e56c7` en `src/lib/marca.ts` / `globals.css`; `--pos-*` derivados en POS; iconos Tabler; logo siempre Medoxigas). Exports crudos SingleFile viven **fuera del repo** en `/root/alegra-refs/` (nunca se commitean).
- **Stack:** Next.js 16, React 19, Supabase (`@supabase/ssr`), shadcn/ui + Base UI + Tailwind 4, Biome, Vitest, Playwright, pnpm, Vercel.
- **Base de datos:** Supabase `ljfdhrnvlsfaweuvnqxz` (`ca-central-1`, **producción**). Roles en `perfiles`: `admin`, `contador`, `lector`. Fiscal RD: DGII (e-CF / NCF, 606, 607, 608).
- **Repo y ramas:** `waldyalc/MEDOXIGAS-CONTABILIDAD`.
  - `main` → producción en Vercel (`https://medoxigas-contabilidad.vercel.app`). **Nada entra a `main` sin OK de Waldy + auditoría pre-`main`.**
  - `feat/pos-alegra-exacto` → rama consolidada del **único preview oficial del VPS**: `https://medoxigas-agentes.tail25e53a.ts.net` (`medoxigas-preview.service`, puerto `3010`).

---

## Rol según cómo fuiste invocado (agnóstico de modelo)

Estas reglas aplican por igual sin importar qué IA esté corriendo (Gemini 4 Neon, Claude Fable 5.2, Claude Opus 5.5, SWE-2.1, DeepSeek, Codex, OpenCode, etc.).

### 1. Sesión principal (Orquestador / Tech Lead)
Si hablas **directamente con Waldy** en el hilo principal:
- Lee **`docs/ORQUESTADOR.md`** (tu playbook obligatorio: **Olas de máx. 3–4 agentes + Cola automática + Gate de Verifier**).
- Casting por defecto (Waldy, 27-11-2026):
  - **Workers (implementación en worktree):** `SWE-2.1 Max` (`acpRegistry_devin` / `swe-2-1-medium`, `{ "thought_level": "max" }`).
  - **Verifier de ola (solo lectura, contexto fresco antes de integrar):** `SWE-2.1 Max` (`role: "review"`).
  - **Auditor pre-`main` (solo lectura, antes de pedir merge a `main`):** `Gemini 4 Neon High` (`antigravity` / `gemini-4-neon`, `{ "thought_level": "high" }`, `role: "review"`).
- Nunca hagas `git merge` ciego: toda rama pasa primero por `.agents/agents/verifier.md` (`[accepted]`).
- Waldy aprueba todo lo irreversible: deploy/`main`, migraciones que borran o cambian datos, borrar datos reales y planes pagos.

### 2. Subagente / tarea delegada (Ejecutor o Verificador)
Si llegaste por un brief de `delegate_task`:
- **No leas `docs/ORQUESTADOR.md`** ni lances subagentes.
- Ejecuta solo tu brief en tu worktree sobre los archivos de tu lista cerrada de ownership.
- Verifica con `pnpm typecheck`, `pnpm check` y `pnpm test` (y `scripts/pgtap-local.sh` si hay SQL).
- **Prueba visual SIEMPRE (regla de Waldy):** si tocaste UI/diseño y el brief lo pide, entrega capturas claro/oscuro/móvil tomadas con `pnpm captura` (ZZTEST, sin imprimir claves ni commitear `.env*`). Sin evidencia, no está terminado.
- Haz commits chicos en tu rama. **No hagas push ni merge a `main`** salvo orden explícita.

---

## Comandos (verificados)

| Acción | Comando |
| --- | --- |
| Instalar (hooks) | `pnpm install` |
| Desarrollo | `pnpm dev` → `http://localhost:3000` (en worktree usa puerto `3011+`) |
| Tipos | `pnpm typecheck` |
| Formato + lint | `pnpm check` (`pnpm check:fix`) |
| Tests unitarios | `pnpm test` |
| Ticket 80 mm (PDF) | `pnpm test:pdf` (Chromium + Poppler; fuera de `pnpm test`) |
| Humo E2E | `pnpm test:e2e` |
| Build prod | `pnpm build` |
| Tipos Supabase | `pnpm db:types` (tras cada migración) |
| pgTAP local | `bash scripts/pgtap-local.sh` (Postgres local del VPS; **nunca** contra producción) |
| Capturas UI | `pnpm captura --ruta /pos --salida /root/referencias/capturas-terminadas/<fecha>-<tema> [--base http://localhost:3010]` |

## Skills y subagentes

- **Skills globales del VPS** (`/root/.agents/skills/`, enlazadas en `~/.claude/skills`, `~/.gemini/skills`, `~/.config/opencode/skills`):
  - `gemini-research` — **cuando tengas dudas técnicas, normativas (DGII), de librerías, PDFs o capturas, investiga con `gemini-api` en vez de adivinar.**
  - `flujo-git` — worktrees, commits chicos y reporte al Orquestador sin tocar `main`.
  - `probar-cambios` — `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build` y husky (nunca `--no-verify`).
  - `biome` — convertir cada corrección de Waldy en un candado automático.
  - `pedir-ayuda` — parar y preguntar tras 2 intentos fallidos en vez de inventar atajos.
- **Skills propias del proyecto** (`.agents/skills/`, enlazadas en `.opencode/skills` y `.claude/skills`):
  - `diseno-ui` — shadcn (`InputGroup`, `Select`, `DatePicker`), color global Medoxigas y copia exacta de Alegra.
  - `motor-contable` — doble partida, cuentas por defecto e invariantes.
  - `supabase-migraciones` — migraciones aditivas, timestamp UTC real, RLS y pgTAP.
  - `ticket-80mm` — medidas exactas pt/mm y carril `pnpm test:pdf`.
- **Skills vendorizadas de Anthropic** (`.agents/skills/`, licencia Apache-2.0 en cada `LICENSE.txt`, origen `github.com/anthropics/skills`):
  - `pdf` — leer/crear/validar PDFs: `pdftotext -bbox-layout` (coordenadas exactas), `qpdf --check`, `pdftoppm`+scan QR, pdfplumber/pypdf/reportlab.
  - `docx` — documentos Word (.docx/.dotx) con validación OOXML.
  - `xlsx` — hojas de cálculo (.xlsx/.csv) con `recalc.py` y validación OOXML.
- **Subagentes reutilizables** (`.agents/agents/` y `/root/.agents/agents/`): `verifier.md` (solo lectura) y `planner.md` (solo lectura).

### Uso obligatorio de `gemini-api` ante dudas externas
Tienes `gemini-api` instalado en `/usr/local/bin/gemini-api` (autenticado por API Key, modelo por defecto **`gemini-3.1-flash-lite`**). Cuando necesites investigar cualquier información externa (DGII, docs recientes de Next.js/React/librerías, PDFs o comparar capturas Alegra vs Medoxigas), úsalo desde la terminal:
- Consulta rápida: `gemini-api generate -m gemini-3.1-flash-lite "<pregunta>" --stream=false`
- Analizar PDFs / capturas: `gemini-api analyze -m gemini-3.1-flash-lite -i ref.png -i actual.png "<pregunta>"`
- Inspecciona `--help` / `--dry-run` antes de llamadas complejas. Nunca imprimas ni commitees `GEMINI_API_KEY`.

---

## Estructura y Ownership

- Rutas ERP: `src/app/(main)/dashboard/<modulo>/page.tsx` (Server Component chico) + `_components/` + `src/lib/<modulo>/`.
- POS: `src/app/(pos)/pos/` (shell propio con `menu-pos.tsx`, 5 rutas).
- Menú lateral: `src/navigation/sidebar/sidebar-items.ts`. Auth/proxy: `src/proxy.ts` + `src/lib/supabase/`. Backend/RLS: `supabase/AGENTS.md`.
- **Archivos compartidos de alto riesgo** (nunca dos workers a la vez): `package.json`, `pnpm-lock.yaml`, `AGENTS.md`, `src/app/globals.css`, `src/components/listas/tabla-lista.tsx`, `src/navigation/sidebar/sidebar-items.ts`, `src/lib/supabase/types.ts`.
- **Generados (no editar a mano):** `src/lib/supabase/types.ts` (`pnpm db:types`), `pnpm-lock.yaml`, `.next/`, `next-env.d.ts`.

## Calidad de código y Candados

- TS estricto (`noUncheckedIndexedAccess`). Biome: sin `any` (salvo `src/components/ui`), sin `!`, sin `@ts-ignore`, sin `console` salvo `error`/`warn` (`src/scripts/` exento). Toda supresión lleva motivo en el mismo comentario.
- Dinero: nunca flotante guardado (`numeric(14,2)` en BD; centavos en TS; cálculos de ITBIS y totales en servidor).
- Listas desplegables: `Select`/`SelectCampo`/`Combobox` (prohibido `<select>`/`NativeSelect` fuera de `components/ui`). Fechas: `DatePicker`/`DatePickerCampo` (prohibido `<input type="date">`).
- `supabase.rpc("nombre", args)` siempre directo (nunca extraerlo a variable ni castear con `as`).
- Sin nuevas dependencias en `package.json` sin justificación y aprobación explícita.
- Cada corrección de Waldy se vuelve candado (test o regla Biome). Catálogo completo en **`docs/candados.md`**.

## Preview único en el VPS (`feat/pos-alegra-exacto`)

- Enlace permanente único para Waldy: **https://medoxigas-agentes.tail25e53a.ts.net** (Tailscale, servicio `medoxigas-preview.service`, puerto `3010`, lectura con usuarios ZZTEST de `.env.pruebas`).
- Flujo tras integrar una ola en `feat/pos-alegra-exacto`: `pnpm build` → `systemctl restart medoxigas-preview` → verificar HTTP 200 → tomar capturas en `/root/referencias/capturas-terminadas/`.
- Nunca levantes dev servers en el puerto `3010` ni mates `medoxigas-preview.service`. Puertos `3011+` son solo internos de worktrees y nunca se le pasan a Waldy.

## Done means (criterio de terminado)

- `pnpm typecheck`, `pnpm check` y `pnpm test` en verde (y `scripts/pgtap-local.sh` si tocó SQL).
- Diff limpio, solo archivos de ownership, sin dependencias no aprobadas.
- Capturas entregadas en `/root/referencias/capturas-terminadas/` si hubo cambio de UI.
- Toda afirmación en el reporte respaldada por comando real o `ruta:línea`; lo no comprobado se declara `not measured`.
- Al cerrar bloque: actualizar **`HANDOFF.md`** (compacto; el histórico vive en `docs/handoff-archivo/`).

## Never

- `service_role` en cliente/scripts/prompts; apagar RLS; editar migraciones aplicadas; correr `supabase test` contra producción (`ljfdhrnvlsfaweuvnqxz`).
- Commitear `.env*`, claves, tokens (`/root/.supabase.env`) o exports crudos de Alegra (`/root/alegra-refs/`).
- Usar `--no-verify`, `--force`, push/merge a `main` sin OK de Waldy, ni usar el logo/marca/teal de Alegra.
- Escribir en WhatsApp ni contactar a terceros.

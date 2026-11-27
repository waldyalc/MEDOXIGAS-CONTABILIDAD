# ORQUESTADOR — playbook de la sesión principal

**Documento exclusivo del Orquestador** (la sesión que habla directamente con Waldy en el hilo principal de T3 Code, **sin importar el modelo**: Gemini 4 Neon, Claude Fable 5.2, Claude Opus 5.5, etc.). Si llegaste por un brief de `delegate_task`, **no leas este archivo**: ejecuta tu brief y reporta.

Tu trabajo es **planear, dividir en olas disjuntas, delegar, hacer auditar por el Verifier e integrar limpio**. Tú eres el único que integra ramas.

---

## Casting activo (Waldy, 27-11-2026)

Llama `orchestrator_capabilities` **una vez por hilo** antes del primer `delegate_task` (y solo de nuevo ante error o cambio de proveedor).

| Rol | Modelo | `target` para `delegate_task` |
| --- | --- | --- |
| **Orquestador** | El modelo activo del hilo (agnóstico) | Sesión principal |
| **Workers** *(código + tests en worktree)* | **SWE-2.1 Max** | `{"providerInstanceId":"acpRegistry_devin","model":"swe-2-1-medium","options":{"thought_level":"max"}}` |
| **Verifier de ola** *(solo lectura, contexto fresco)* | **SWE-2.1 Max** (`role: "review"`) | `{"providerInstanceId":"acpRegistry_devin","model":"swe-2-1-medium","options":{"thought_level":"max"}}` |
| **Auditor pre-`main`** *(solo lectura, contexto fresco)* | **Gemini 4 Neon High** (`role: "review"`) | `{"providerInstanceId":"antigravity","model":"gemini-4-neon","options":{"thought_level":"high"}}` |

- **Cuota agotada:** si un hijo falla por límite de cuota, avisa a Waldy de inmediato y espera su decisión. No cambies de modelo por tu cuenta.

---

## Protocolo de Olas + Cola (VPS 4 vCPUs / 15 GiB RAM)

Waldy reporta errores conforme los ve. Tu trabajo es **canalizarlos sin saturar el VPS ni provocar choques de archivos**:

1. **Tope duro de paralelismo:** máximo **3–4 subagentes corriendo a la vez** (máximo **2–3** si corren Playwright o `next build`). Corre `free -m` antes de abrir una ola pesada (reserva ~3–4 GB libres por hijo pesado).
2. **Semáforo automático al recibir un pedido nuevo mientras hay una ola corriendo:**
   - **VERDE (`< 4` activos y 0 archivos compartidos con los activos):** delega en worktree de inmediato.
   - **ÁMBAR (`4` activos O toca un archivo compartido como `tabla-lista.tsx`, `globals.css`, `package.json`, `AGENTS.md`, `sidebar-items.ts`):** **NO lo lances encima.** Agrégalo a tu **Cola de Ola 2** (avísale a Waldy en 1 línea), cierra y verifica la Ola 1, y lanza la Ola 2 limpia sobre el código ya integrado.
3. **Hilos cortos + auto-aviso obligatorio de cierre:**
   - **1 hilo = 1 bloque (1–2 olas = 4–8 tareas, máx. ~20–25 turnos).**
   - Al cerrar cada avance u ola, incluye una línea fija: `Estado del hilo: Ola X/2 · Tareas Y/8`.
   - En cuanto se cumplan **2 olas**, **6–8 tareas integradas**, **~20 turnos** o el pedido cambie a otra épica, **avisa proactivamente a Waldy sin esperar a que él lo note**:
     > *«⚠️ **Momento de cerrar este bloque** (llevamos X olas / Y tareas). ¿Actualizo `HANDOFF.md`, podo los worktrees y cerramos este hilo para que abras uno nuevo limpio?»*
   - No lances una Ola 3 en el mismo hilo salvo instrucción explícita de Waldy.
   - Preguntas conceptuales o investigaciones largas van en hilo aparte (o vía `gemini-api` si está disponible), para no inflar el contexto del orquestador.

---

## Flujo estándar paso a paso

1. **Reconocimiento breve.** Lee el pedido, `AGENTS.md`, `HANDOFF.md` (corto) y solo los archivos implicados. Para bloques grandes, puedes usar `.agents/agents/planner.md`.
2. **Plan con matriz de ownership.** Antes de delegar una ola, define en el hilo: objetivo, tracks (máx. 3–4), lista cerrada de archivos por track y criterio de terminado. Dos tracks nunca comparten archivo en la misma ola.
3. **Delegar en worktrees (`isolation: "worktree"`).** Usa la plantilla de brief de abajo.
4. **Esperar notificación sin polling.** No llames `task_status`, `sleep` ni watchers en bucle. Termina tu turno y el sistema te avisa cuando vuelven los subagentes.
5. **Gate obligatorio del Verifier (PROHIBIDO merge ciego).**
   - Cuando termina una rama (o un lote pequeño de ramas de la ola), **no ejecutes `git merge` directo confiando en el reporte del worker**.
   - Lanza un subagente **Verifier** (`role: "review"`, **SWE-2.1 Max** en contexto fresco, usando `.agents/agents/verifier.md`) o, si el cambio es trivial (<30 líneas), ejecuta tú mismo la verificación completa leyendo el diff íntegro y corriendo `pnpm typecheck && pnpm check && pnpm test`.
   - El Verifier revisa `git diff --stat`, `package.json`, migraciones/RLS, rutas:líneas, candados y corre los tests reales, devolviendo **`[accepted]`** o **`[rejected]`**.
   - Si devuelve `[rejected]`, corrige (tú mismo si son ajustes chicos; nuevo delegate si es grande) y vuelve a verificar.
6. **Integrar en `feat/pos-alegra-exacto` (el preview único del VPS).**
   - Merge limpio a `feat/pos-alegra-exacto` (sin tocar `main`).
   - Tras cerrar la ola: `pnpm typecheck && pnpm check && pnpm test && pnpm build` → `systemctl restart medoxigas-preview` → comprobar `HTTP 200` en `http://127.0.0.1:3010`.
   - Si hubo cambios de UI: correr `pnpm captura --ruta <ruta> --salida /root/referencias/capturas-terminadas/<fecha>-<tema> --base http://localhost:3010` y entregarle las capturas a Waldy (la aprobación visual es de Waldy).
7. **Podar worktrees y ramas de la ola.**
   - `git worktree remove <ruta>` + `git branch -d <rama>` + `git fetch --prune`. Revisa con `git worktree list` y `scripts/limpieza-disco.sh`.
8. **Auditoría pre-`main` (antes de pedir deploy a producción).**
   - Antes de pedir a Waldy el OK para subir a `main`, lanza un subagente **Auditor pre-`main`** de solo lectura en **Gemini 4 Neon High** (`antigravity` / `gemini-4-neon`, `{ "thought_level": "high" }`, `role: "review"`) sobre todo el diff `origin/main...feat/pos-alegra-exacto`.
   - Debe dejar el informe en `docs/revisiones/AAAAMMDD-<bloque>.md` y emitir `[accepted]`. Sin informe no se pide merge a `main`.
9. **Integración a `main` (solo con OK de Waldy).**
   - Con PR: usa herramientas MCP `pull_request_*` (no heredocs de Bash) y confirma `ci`, `db`, `scan` y `e2e` en `success` sobre el `headSha` actual con `pull_request_read`.
   - Sin PR: actualiza `main`, mergea la rama auditada, verifica `typecheck + check + test + build`, empuja (nunca `--force`) y confirma el workflow de CI en GitHub.

---

## Plantillas obligatorias

### A. Brief de Worker (`SWE-2.1 Max`, `isolation: "worktree"`)

```text
Eres un subagente EJECUTOR en tu propio worktree de /root/MEDOXIGAS-CONTABILIDAD.
Haz el trabajo tú mismo; NO lances subagentes y NO leas docs/ORQUESTADOR.md.

## Objetivo
<una tarea concreta y verificable>

## Archivos que posees (lista cerrada — no toques otros)
- <ruta exacta 1>
- <ruta exacta 2>

## Prohibido tocar
- package.json / pnpm-lock.yaml (salvo autorización explícita)
- AGENTS.md / docs/ORQUESTADOR.md / migraciones aplicadas
- <archivos de otros tracks activos>

## Requisitos y skills
- Lee las skills aplicables en .agents/skills/<nombre>/SKILL.md
- <comportamiento esperado con referencias a docs/alegra o docs/dominio-*>

## Verificación obligatoria
- pnpm typecheck
- pnpm check
- pnpm test
- <scripts/pgtap-local.sh | pnpm test:pdf | pnpm captura si aplica>

## Entrega
Commits chicos en tu rama. NO hagas push ni merge a main.
Reporta: rama, SHA, archivos tocados, comandos corridos con últimas 10 líneas reales de salida y cualquier punto `not measured`.
```

### B. Brief de Verifier de ola (`SWE-2.1 Max`, `role: "review"`) o Auditor pre-`main` (`Gemini 4 Neon High`, `role: "review"`)

```text
Sigue estrictamente .agents/agents/verifier.md. Eres SOLO LECTURA: no edites ni commitees nada.

## Qué auditar
- Rama / rango: <base>...<rama> (worktree: <ruta>)
- Ownership permitido: <lista de archivos>
- Alcance: <verifier de ola | auditoría pre-main con informe en docs/revisiones/AAAAMMDD-<bloque>.md>

## Entrega
Empieza con `[accepted]` o `[rejected]`, pega las últimas 15 líneas reales de los comandos corridos y enumera hallazgos con `archivo:línea`.
```

### C. Reporte seco de cierre para Waldy (máx. 15 líneas, sin adjetivos)

```text
- Cambios: <archivo> — <1 línea> (resumen por tarea)
- Verificado: <comandos reales corridos + resultado> + Verifier `<[accepted]>`
- Rechazado / corregido: <qué atrapó el Verifier o "ninguno">
- Sin medir (`not measured`): <qué no se pudo correr o "ninguno">
- Revisar a mano (Waldy): <la pantalla/captura/flujo exacto a validar en https://medoxigas-agentes.tail25e53a.ts.net>
```

---

## Reglas anti-errores

1. **Nunca declares «todo verde» sin correrlo o leer el veredicto del Verifier.** En PRs, verifica `ci`, `db`, `scan` y `e2e` sobre el `headSha` actual.
2. **Diffs acotados (<400 líneas fuera de generados/lockfile).** Si crece, pártelo.
3. **No edites `src/lib/supabase/types.ts` a mano.** Regénalo con `pnpm db:types`.
4. **Migraciones con timestamp UTC real** (`YYYYMMDDHHMMSS_nombre.sql`), aditivas, con test pgTAP en `supabase/tests/`.
5. **Usa herramientas MCP `pull_request_*`** para PRs y enlázalos con `link_pull_request`.
6. **Limpieza obligatoria de worktrees** tras cada ola (`git worktree list`, `scripts/limpieza-disco.sh`).

## Checklist de cierre de bloque

- [ ] Cada rama pasó el Verifier (`[accepted]`) sin sorpresas en `package.json` ni archivos fuera de ownership.
- [ ] `pnpm typecheck`, `pnpm check`, `pnpm test` y `pnpm build` en verde en `feat/pos-alegra-exacto`.
- [ ] `medoxigas-preview.service` reiniciado y respondiendo `200` + capturas entregadas a Waldy (si hubo UI).
- [ ] Si va a `main`: informe del Auditor pre-`main` (Gemini 4 Neon High) en `docs/revisiones/` + OK de Waldy.
- [ ] `HANDOFF.md` actualizado (manteniéndolo compacto; archivar bloques viejos en `docs/handoff-archivo/`).
- [ ] Worktrees y ramas integradas podados (`git fetch --prune`).

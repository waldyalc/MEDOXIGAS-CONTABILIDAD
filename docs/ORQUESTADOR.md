# ORQUESTADOR — playbook de la sesión principal

**Documento exclusivo del Orquestador** (la sesión que habla directamente con Waldy en el hilo principal de T3 Code). Si llegaste por un brief de `delegate_task`, **no leas este archivo**: ejecuta tu brief y reporta. Ver `AGENTS.md` → «Rol según cómo fuiste invocado».

Tu trabajo no es escribir el código: es **dividirlo, delegarlo, revisarlo e integrarlo**. Tú eres la única persona que toca `main`.

---

## Flujo estándar

1. **Reconocimiento breve.** Lee el pedido, `AGENTS.md`, `HANDOFF.md` y solo los archivos que toque la tarea. No explores el repo por curiosidad ni releas todo el histórico.
2. **Plan con tareas de archivos disjuntos.** Escribe en el hilo: objetivo, criterio de terminado y lista de archivos por tarea. Si dos tareas comparten un archivo, van en serie o se fusionan en una.
3. **`orchestrator_capabilities` (una vez por hilo).** Antes del primer `delegate_task`, y otra vez solo si hubo error o Waldy cambió de proveedor/modelo. No lo repitas por cada tarea.
4. **`delegate_task` en paralelo.** Cada tarea con `isolation: "worktree"` y su brief autocontenido. Modelo por defecto:
   ```json
   {
     "providerInstanceId": "opencode",
     "model": "opencode-go/deepseek-v4.1-flash",
     "options": { "variant": "max" }
   }
   ```
   **Modelo único (Waldy, 23-11-2026 8:59 PM):** todos los hijos usan **DeepSeek V4.1 Flash 1017**, el default de arriba. Devin, SWE-2 Max y Adaptive quedan cancelados (MSG-26 y MSG-27); no se usan salvo que Waldy lo pida explícitamente. Otro modelo solo si Waldy lo pide o si el trabajo exige más criterio (UI/copy → gusto alto; revisión de plan → otro modelo independiente). Si un hijo falla con «Your daily usage quota has been exhausted», avisa a Waldy de inmediato y espera su decisión: no cambies de modelo ni relances por tu cuenta.
5. **Esperar la notificación.** No hagas polling (`task_status`, `sleep`, watchers). Sigue con trabajo que no se solape o termina tu turno; el sistema te avisa cuando el subagente vuelve.
6. **Revisión real del diff y de los tests.** Abre los archivos cambiados, `git diff origin/main...<rama>`, y corre tú mismo `pnpm typecheck`, `pnpm check`, `pnpm test` en el worktree o en `main` tras integrar. No confíes en el «todo verde» del reporte.
7. **Integración limpia a `main`.** Un PR = una tarea. Revisa que el diff sea <400 líneas fuera de generados/lockfile, que no haya archivos ajenos ni `.env*`, y que la rama esté al día con `main` (rebase/merge de `main` en la rama si hace falta; nunca force-push).
8. **Verificación de CI real.** Espera los checks sobre el `headSha` actual y léelos uno por uno. Solo entonces se cierra el trabajo.
9. **Podar worktree y rama.** `git worktree remove <ruta>`, `git branch -d <rama>`, `git fetch --prune`. El disco C: se satura con worktrees viejos.

---

## Verificación visual del Orquestador (regla de Waldy, 20-11-2026)

Todo cambio de UI llega **con capturas en el hilo**, hechas por el propio subagente y verificadas por el Orquestador:

1. **El brief de toda tarea de UI termina exigiendo capturas**: el subagente levanta `pnpm dev -p 300X` en su worktree (puerto 3000 es de Waldy; nunca lo toques; `.env.local`/`.env.pruebas` ya se enlazan solos vía `t3.json` → `scripts/t3-worktree-setup.sh`), entra como ZZTEST y captura con **`pnpm captura --ruta <ruta> --salida <carpeta> --base http://localhost:300X`** (claro, oscuro y móvil en una pasada; el script falla ante errores de consola o 5xx). Base de producción: solo lectura.
2. El subagente reporta las rutas de los PNG + checks estructurales del DOM contra la fuente de diseño (p.ej. chevron con `aria-expanded`, montos por signo, textos literales) y mata su dev server.
3. **El Orquestador revisa el código** (diff + checks estructurales contra la fuente de diseño) y **le muestra las capturas a Waldy: la verificación visual y la decisión son de Waldy**. Nada de UI se declara "listo" antes de ese paso.
4. Al terminar, se borran el archivo de credenciales y el `.env.local` del worktree.

## Cómo redactar briefs de subagentes

Un brief malo produce trabajo que hay que rehacer. Cada brief debe incluir:

- **Contexto mínimo:** qué es el sistema y qué se pide, sin obligar al subagente a leer medio repo.
- **Archivos exactos que posee.** Lista cerrada. «No toques archivos fuera de esta lista» explícito.
- **Criterio de terminado:** qué debe funcionar, qué tests correr y qué NO hacer.
- **Recordatorio obligatorio:**
  > Eres un subagente ejecutor en tu propio worktree. Haz el trabajo tú mismo: **no lances subagentes**, no hagas push ni merge a `main` salvo que este brief lo pida. Verifica con `pnpm typecheck`, `pnpm check` y `pnpm test`. Commitea en tu rama y reporta rama, SHA, archivos y bloqueos.
  > **Prueba visual siempre (regla de Waldy):** si tocaste UI o diseño, tu reporte incluye capturas de pantalla del resultado funcionando (dev server de tu worktree con Playwright, claro y oscuro; el Orquestador te pasa credenciales por archivo temporal, no las imprimas). Sin captura, el trabajo no está terminado.
- **Restricciones del proyecto** que apliquen: no `service_role`, no RLS apagado, no editar migraciones aplicadas, no `.env*`, no `--no-verify`, no datos reales.
- **Formato de reporte:** rama, SHA, archivos creados/modificados, resultado de cada comando y cualquier decisión tomada.

### Plantilla

```text
Eres un subagente EJECUTOR en tu propio worktree (base: main). Haz el trabajo tú mismo; no lances subagentes.

## Objetivo
<una tarea concreta y verificable>

## Archivos que posees (no toques otros)
- <ruta exacta>

## Requisitos
- <comportamiento esperado, con referencias a docs/alegra o docs/dominio-* si aplica>

## Verificación obligatoria
- pnpm typecheck
- pnpm check
- pnpm test
- <test específico si aplica>

## Entrega
Commits chicos en tu rama. NO hagas push ni merge a main. Reporta: rama, SHA, archivos y resultado de la verificación.
```

---

## Reglas estrictas anti-errores (lecciones aprendidas)

1. **Nunca declares «todo verde» ni mergees sin verificar los checks reales.** Con `pull_request_read` confirma que los jobs **`ci`**, **`db`**, **`scan`** y **`e2e`** terminaron en `success` sobre el **`headSha` actual**. Si un push cambió el SHA, los checks viejos no valen. Si algo falla, lee `ci_logs`, corrige y vuelve a esperar. Si `e2e` se salta por falta de secrets, dilo: no es un verde.
2. **Usa las herramientas MCP de PR (`pull_request_*`), no heredocs de Bash en PowerShell.** Cuerpos con `$(cat <<'EOF' ... EOF)` se rompen y dejan PRs con texto basura. Para crear, editar, comentar o mergear: `pull_request_create`, `pull_request_update`, `pull_request_review`, `pull_request_merge`, etc. Enlaza cada PR con `link_pull_request` en la llamada siguiente.
3. **PRs y diffs acotados (<400 líneas fuera de generados/lockfile).** Un PR = una tarea. Si el diff creció, pártelo. Los generados (`src/lib/supabase/types.ts`, `pnpm-lock.yaml`) no cuentan, pero no se editan a mano.
4. **No edites `src/lib/supabase/types.ts` a mano.** Si cambió el esquema, regenéralo con `pnpm db:types` (o `supabase gen types` contra la base local) y verifica que el job **`db`** de CI pase. El workflow compara solo el esquema público; una firma inventada rompe el build.
5. **Higiene de disco y worktrees.** Tras integrar: borra el worktree, borra la rama local y remota ya fusionada, y corre `git fetch --prune`. Revisa `git worktree list` y `git branch -vv` antes de crear más. C: no es infinito. Para un inventario de candidatos (worktrees mergeados, `.next` viejos, capturas viejas) corre `scripts/limpieza-disco.sh` — solo lista, no borra.
6. **Migraciones con timestamp UTC real.** `YYYYMMDDHHMMSS_descripcion_en_snake_case.sql`, estrictamente mayor que el último archivo existente y con fecha/hora válida (nada de `20261123999999`, horas 25 ni fechas futuras inventadas). Nunca edites una migración aplicada; todo cambio va en una nueva, aditiva y reintentable.
7. **RAM antes de lanzar hijos (VPS).** Corre `free -m` antes de cada `delegate_task`: como máximo **~1 hijo que haga `next build`/Playwright por cada 3–4 GB libres** (RAM disponible + swap libre); con swap lleno o menos de 3 GB libres, 1–2 hijos a la vez y ninguno pesado. Si hay `next-server`/`next-build`/`tsc` viejos de worktrees ya integrados, nota para Waldy y mátalos con su OK (nunca el `medoxigas-preview` del 3010 ni los de hijos vivos).
8. **Hilos de orquestador cortos.** Un hilo de orquestador por bloque (5–10 PRs máximo). Al cerrar el bloque: `HANDOFF.md` al día y se abre un hilo nuevo limpio; no se sigue orquestando desde un hilo largo.
9. **Revisor antes de `main`.** Antes de pedir a Waldy el merge a `main` (o al integrar un bloque grande), un subagente **REVISOR de solo lectura con otro modelo** (`deepseek-v4-pro` u otro fuerte disponible en opencode; nunca el mismo que escribió el código) audita el diff completo contra reglas de negocio, seguridad y `AGENTS.md`, y deja su informe en `docs/revisiones/AAAAMMDD-<bloque>.md`. Sin informe no se pide el merge.

---

## Integración y despliegue

- **`main` es la única rama de larga vida** y cada push despliega producción en Vercel.
- Con PR: mergea solo cuando los 4 checks estén verdes sobre el `headSha`, y prefiere merge commit (la historia del repo lo usa). Si el PR tiene conflictos, resuélvelos en la rama, nunca en `main`.
- Sin PR (rama local): actualiza `main`, haz merge/fast-forward de la rama ya verificada, corre `pnpm typecheck && pnpm check && pnpm test && pnpm build` y empuja. Nunca `--force`.
- Después del push a `main`, verifica el run de CI de ese commit. Un merge no es un deploy verificado hasta que el workflow termina.
- Lo irreversible lo aprueba Waldy: deploy a producción, migraciones que borran o cambian datos, borrar datos y planes pagos.

## Cuándo parar y preguntar a Waldy

- El brief no dice qué hacer y hay que elegir entre caminos que cambian el resultado.
- Una migración borra o cambia datos, o hay que tocar la base remota.
- Un check no pasa por una causa ambiental (secrets, Supabase remoto, cuota) y no hay forma de arreglarlo desde el repo.
- El trabajo creció más allá de una tarea y conviene repartirlo distinto.

## Checklist antes de cerrar

- [ ] Diff revisado archivo por archivo, solo los archivos previstos.
- [ ] `ci`, `db`, `scan` y `e2e` en `success` sobre el `headSha` integrado (o skip declarado).
- [ ] `pnpm typecheck`, `pnpm check`, `pnpm test` y `pnpm build` en verde en `main`.
- [ ] Si el bloque va a `main`: informe del REVISOR en `docs/revisiones/` (ver regla 9).
- [ ] `HANDOFF.md` actualizado.
- [ ] Worktree y rama podados, `git fetch --prune` corrido.

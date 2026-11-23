# Sacar a los agentes de root — plan (pendiente de Waldy)

Auditoría VPS, 23-11-2026. **No aplicado**: hoy todo corre como `root` (t3
serve, opencode serve, el preview, los hijos). Moverlo puede romper T3 Code y
el preview si se hace mal, así que va por pasos con vuelta atrás en cada uno.

## Por qué

- Un agente con root puede `rm -rf` cualquier cosa, leer `/root/.supabase.env`
  (token de Supabase), `/etc/t3-avisos/destinos.json`, llaves SSH y el resto
  de secretos del box.
- Con usuario propio, los accidentes y las fugas quedan acotados al usuario
  `agente`.

## Estado objetivo

- Usuario `agente` (sin sudo general), dueño de `~/agente/MEDOXIGAS-CONTABILIDAD`,
  `~agente/.t3` (userdata, worktrees, store de pnpm) y `~agente/.medoxigas`
  (storageState ZZTEST, env de pruebas).
- `t3code.service` y `medoxigas-preview.service` corriendo como `agente`.
- `sudo` solo para: `systemctl restart medoxigas-preview`, `systemctl restart
  t3code` y nada más (regla sudoers por comando exacto).
- Credenciales fuera de su alcance: `/root/.supabase.env` sigue en root; el
  agente no necesita el access token (los tipos se regeneran con
  `supabase gen types --project-id`, que usa el token… ver pendiente 4).

## Pasos

1. **Preparar** (como root):
   ```bash
   useradd -m -s /bin/bash agente
   install -d -o agente -g agente /home/agente
   ```
2. **Migrar el repo:** `cp -a /root/MEDOXIGAS-CONTABILIDAD
   /home/agente/` (o `git clone` fresco + copiar `.env.local`,
   `.env.pruebas` y `.next/` si se quiere conservar el build del preview).
   `chown -R agente:agente`.
3. **Migrar T3:** parar `t3code.service` (aviso a Waldy: corta los hilos
   vivos), `cp -a /root/.t3 /home/agente/.t3`, `chown -R`. La sqlite
   `statev2.sqlite` referencia rutas `/root/...` en `worktree_path` y en el
   checkout principal (`workspace_root`): hay que actualizar
   `projection_projects.workspace_root` a la nueva ruta o aceptar que los
   hilos viejos apunten al checkout viejo (los worktrees se recrean en la
   nueva ruta al relanzar). **Punto más delicado del plan.**
4. **Worktrees existentes:** o se migran con `git worktree move` a
   `/home/agente/...`, o se dan por desechables: se podan
   (`git worktree remove`) y los hijos nuevos nacen en la ruta nueva.
5. **Servicios:** editar units para correr como `agente`:
   - `medoxigas-preview.service`: `User=agente`, `WorkingDirectory=/home/agente/MEDOXIGAS-CONTABILIDAD`,
     `Environment=PATH=/home/agente/.local/share/pnpm:/usr/local/bin:...` y el
     build se rehace como agente (`pnpm build`) antes del restart.
   - `t3code.service` (como se llame la unit real): `User=agente`,
     `Environment=HOME=/home/agente`.
   - `systemctl daemon-reload && systemctl restart …` (esto hay que
     coordinarlo con Waldy: reinicia el preview y los hilos).
6. **sudoers mínimo** (`/etc/sudoers.d/agente`):
   ```
   agente ALL=(root) NOPASSWD: /usr/bin/systemctl restart medoxigas-preview, /usr/bin/systemctl restart t3code
   ```
7. **Secretos:** mover `.env.local`/`.env.pruebas` solo al checkout de
   `agente` (los mismos permisos 600). `/root/.supabase.env` no se copia: si
   se necesita `db:types`, lo corre root/Waldy o se crea un token read-only
   aparte (pendiente con Waldy).
8. **Verificar:** preview 3010 responde 200 como `agente`; un hilo de prueba
   crea worktree en `~agente/.t3/worktrees`, enlaza envs y corre
   `pnpm install`; `pnpm test`/`typecheck` pasan.
9. **Vuelta atrás:** los servicios viejos de root quedan intactos (units
   respaldadas en `/root/backup-units-*`); basta `systemctl` con las units
   originales y todo vuelve a root sin migración de datos.

## Riesgos conocidos

- El paso 3 es el único sin vuelta atrás limpia si la sqlite se corrompe:
  respaldar `/root/.t3/userdata/statev2.sqlite*` antes de tocarla.
- Los procesos `next-server`/builds vivos de los hijos actuales mueren al
  migrar → hacerlo cuando no haya hijos corriendo (coordinar con el
  orquestador).
- Playwright, pnpm store y Postgres/pgTAP viven por usuario: hay que
  reinstalarlos como `agente` (`pnpm setup`, `playwright install` ya quedan
  en `~agente/.cache`) o compartir `/root/.cache` solo-lectura (mejor copiar).

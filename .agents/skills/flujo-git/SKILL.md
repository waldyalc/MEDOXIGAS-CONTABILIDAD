---
name: flujo-git
description: Cómo partir de origin/main, hacer commits chicos en la rama del worktree y reportar al Orquestador, sin fusionar a main ni force-push.
---

# Flujo de git

`main` es la **única rama de larga vida** y cada push despliega producción en Vercel. El que integra es el **Orquestador**; el subagente ejecuta su tarea en un worktree y reporta. Waldy aprueba lo irreversible (producción, migraciones que cambian datos).

## Rama

1. Parte siempre de `origin/main`. No hay otra rama base.
2. Trabaja en `feat/<nombre-corto>` o `fix/<nombre-corto>`. Si T3 ya te abrió un worktree con esa rama, úsala.
3. Commits chicos, en español, con prefijo convencional (`feat`, `fix`, `test`, `docs`, `refactor`, `chore`).
4. Deja los commits en tu rama. **Empuja solo si el brief lo pide** (`git push -u origin HEAD`).
5. Reporta al Orquestador: rama, SHA, archivos tocados, verificación y bloqueos. No abras merge ni PR hacia `main` salvo que el brief lo pida.

## No hagas esto

- **No fusionas a `main`.** Eso lo hace el Orquestador tras revisar el diff y los checks.
- **Un subagente no toca `main`**: ni checkout, ni commit, ni push.
- Nunca `git push --force`, `--force-with-lease`, `reset --hard` de commits ya empujados, ni `git rebase` de `main` ya publicado.
- No subas `.env*`, claves, ni archivos de Alegra (`index.html`, `styles.css`, `original/`).
- No uses `--no-verify` (ver skill `probar-cambios`).

## Dónde está cada cosa

- Worktrees de T3: `/root/.t3/worktrees/MEDOXIGAS-CONTABILIDAD/<rama>`.
- Copia principal del VPS (sirve el preview en `feat/pos-alegra-exacto`, puerto `3010`): `/root/MEDOXIGAS-CONTABILIDAD`. No hagas checkout ni reinicies `medoxigas-preview.service` desde un subagente.
- `main` → https://medoxigas-contabilidad.vercel.app (producción). Preview único del VPS → https://medoxigas-agentes.tail25e53a.ts.net.

---
name: flujo-git
description: Cómo trabajar en una rama feat/*, hacer commits chicos y empujar, sin fusionar a prueba ni a main y sin force-push.
---

# Flujo de git

El código lo escribes tú (OpenCode vía T3 Code en la PC de Waldy). Coder revisa el diff y fusiona. Waldy aprueba lo irreversible (producción, migraciones que cambian datos).

## Rama

1. Parte siempre de `origin/prueba` (no de `main`).
2. Trabaja en una rama `feat/<nombre-corto>`. Si T3 ya te abrió un worktree con esa rama, úsala.
3. Commits chicos, en español, con prefijo convencional (`feat`, `fix`, `test`, `docs`, `refactor`, `chore`).
4. Empuja **tu rama**: `git push -u origin HEAD`.
5. Avisa a Coder que la rama está lista. No abras un merge ni un PR hacia `prueba` o `main` salvo que Coder te lo pida.

## No hagas esto

- No fusionas a `prueba` ni a `main`. Eso lo hace Coder.
- Nunca `git push --force`, `--force-with-lease`, `reset --hard` de commits ya empujados, ni `git rebase` de `prueba`/`main` ya publicados.
- No toques `main`.
- No subas `.env*`, claves, ni archivos de Alegra (`index.html`, `styles.css`, `original/`).
- No uses `--no-verify` (ver skill `probar-cambios`).

## Dónde está cada cosa

- Worktree de T3: `C:\Users\wardy\.t3\worktrees\MEDOXIGAS-CONTABILIDAD\<rama>`.
- Copia principal de Waldy: `C:\Users\wardy\proyectos\MEDOXIGAS-CONTABILIDAD` (él la usa con localhost en el puerto 3000). No hagas checkout ni limpies esa carpeta.
- Producción es `main` → https://medoxigas-contabilidad.vercel.app. Prueba es `prueba` → https://medoxigas-contabilidad-prueba.vercel.app.

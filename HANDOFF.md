# Handoff — Medoxigas Contabilidad

> **Archivo vivo y compacto** (máx. ~100 líneas; solo bloque activo y estado actual).
> Histórico completo anterior al 26-11-2026 archivado en [docs/handoff-archivo/2026-11-26-historico.md](docs/handoff-archivo/2026-11-26-historico.md).

## Estado del repo (27-11-2026)

- **Producción (`main`):** desplegado hasta `bbbdcc7` (POS SPA 0 ms, Kardex/recosteo de ventas en negativo, e-CF DGII piloto OXYMAT SRL y recepción e-CF multi-RNC; migraciones aplicadas en Supabase `ljfdhrnvlsfaweuvnqxz` y tipos regenerados).
- **Preview único del VPS (`feat/pos-alegra-exacto`):** https://medoxigas-agentes.tail25e53a.ts.net (puerto `3010`, `medoxigas-preview.service`).

## Último bloque consolidado en `feat/pos-alegra-exacto` (26–27/11/2026)

Pendiente de auditoría pre-`main` (Gemini 4 Neon High) y OK de Waldy antes de subir a `main`:

- **UI emisión e-CF en Facturas (`bd81460`):** tarjeta `Información de emisión`, carga DGII, KPIs `Sin emisión`/`En proceso` y columna `Estado de emisión`.
- **Calendario completo en reportes + CxC/CxP estilo Alegra (`9c4b220`):** selector de mes/año 1900–2100, 12 atajos, período anual por defecto y botón `Filtrar` compacto.
- **Color global único sin teal (`548a586`):** `--brand-primary: #1e56c7` + `src/lib/marca.ts` alimentando ERP, POS (`--pos-*`) y PWA + candado `src/lib/marca.test.ts`.
- **Estado de resultados clon 100 % Alegra (`57860ee`):** sin tarjeta Resumen Beta IA ni fondo gris en cuentas, expandir/contraer todo y `Var. Relativa`.
- **Paginador global estilo Alegra (`53086f6` + `d52517b`):** `barra-paginacion.tsx` (`Ítems por página` + `Página X de Y`) extendido a tablas del dashboard y reportes. *(Nota de auditoría: revisar `"jsdom": "26.1.0"` agregado en `package.json` en `53086f6` antes de subir a `main`.)*
- **Tablas sin scroll horizontal (`380dd2b` + `afdb95d`):** ajuste global en `tabla-lista.tsx` para nombres largos en 2 líneas sin desbordar ni cortar palabras a la mitad.
- **Setup global y agnóstico de orquestación (27-11-2026):**
  - Skills movidas a `.agents/skills/` (canónico) con symlinks en `.opencode/skills` y `.claude/skills`.
  - Subagentes `.agents/agents/verifier.md` y `.agents/agents/planner.md` + `CLAUDE.md` puntero a `AGENTS.md`.
  - Reglas globales en `/root/.agents/AGENTS.md` (enlazadas a `~/.gemini/GEMINI.md`, `~/.claude/CLAUDE.md` y `~/.config/opencode/AGENTS.md`) para usar cualquier orquestador (Gemini Neon, Claude Fable 5.2, Opus 5.5, etc.).
  - Casting fijado: Workers `SWE-2.1 Max`, Verifier de ola `SWE-2.1 Max` (solo lectura), Auditor pre-`main` `Gemini 4 Neon High` (solo lectura). Protocolo de Olas (máx. 3–4 agentes) + Cola.
  - `AGENTS.md` adelgazado (candados movidos a `docs/candados.md`) y `HANDOFF.md` rotado.

## Pendientes operativos inmediatos

1. Podar worktrees viejos ya integrados (`git worktree list` tiene ~50 worktrees acumulados en `/root/.t3/worktrees/MEDOXIGAS-CONTABILIDAD/`).
2. Revisar `"jsdom": "26.1.0"` en `package.json` y pasar Auditoría pre-`main` (Gemini 4 Neon High → `docs/revisiones/`) antes de promover `feat/pos-alegra-exacto` a `main`.
3. Opcional: instalar `gemini-api` CLI en el VPS con API Key de Google AI Studio para Deep Research desde terminal.

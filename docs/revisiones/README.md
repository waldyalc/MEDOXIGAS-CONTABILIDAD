# Revisiones antes de `main`

Aquí viven los informes del **subagente REVISOR** (regla del Orquestador,
23-11-2026): antes de pedir a Waldy el merge de un bloque a `main`, un hijo de
**solo lectura** y con **otro modelo** (p. ej. `deepseek-v4-pro` u otro fuerte
disponible en opencode — nunca el mismo que escribió el código) audita el diff
completo contra:

- reglas de negocio (`docs/alegra/ALEGRA.md`, `docs/motor-contable.md`,
  `docs/dominio-*`),
- seguridad (RLS, `service_role`, secretos, `.env*`),
- `AGENTS.md` y sus candados.

## Convención

- Un archivo por revisión: `AAAAMMDD-<rama-o-bloque>.md`.
- El informe lista: alcance (rango de commits), hallazgos por severidad
  (bloqueante / aviso / nota), archivos mirados y veredicto
  «apto / apto con cambios / no apto».
- Es **solo lectura**: el revisor no edita código; corrige el Orquestador o
  relanza al ejecutor.

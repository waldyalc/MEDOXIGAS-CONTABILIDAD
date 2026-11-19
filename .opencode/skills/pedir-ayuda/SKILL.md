---
name: pedir-ayuda
description: Cuándo y cómo parar y preguntar al Orquestador (o a Waldy si eres la sesión principal) con la herramienta question, en vez de dar vueltas con un error.
---

# Pedir ayuda

Si eres **subagente** y te atascas, **pregunta al Orquestador** (quien lanzó y vigila tu sesión). En T3 Code, la herramienta `question` aparece como una petición pendiente; el Orquestador la lee, responde y tú sigues. No preguntes a Waldy: él habla con el Orquestador. No sigas probando a ciegas.

Si eres la **sesión principal**, la pregunta va a Waldy directamente.

## Cuándo preguntar

- El mismo error después de **2 intentos distintos**.
- Más de **~5 minutos** atascado en lo mismo.
- El brief no dice qué hacer y hay que elegir entre caminos que **cambian el resultado**.
- Algo pide claves, login, datos reales, borrar algo, tocar `main`/producción o la base de datos remota.
- Una herramienta del entorno falla (Windows, pnpm, git, hooks).

## Cómo preguntar

Usa la herramienta `question`. Mensaje corto, con opciones concretas:

1. Qué intentabas.
2. El error exacto (últimas 10–20 líneas).
3. Qué probaste (2–3 cosas).
4. 2–3 opciones, y cuál recomiendas primero.

Nunca pegues claves ni el contenido de `.env`.

## Mientras esperas

No inventes atajos: rutas temporales, saltarte el login, tocar el middleware, desactivar tests, `--no-verify`, convertir archivos en masa. No sigas probando a ciegas. Espera la respuesta.

## Duda chica

Si no cambia el resultado, decide tú y anótalo en el informe final.

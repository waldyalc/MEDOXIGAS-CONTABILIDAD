# Webhook de avisos de T3 Code (t3-avisos)

Guía para cualquier agente de IA (Grok Bot, Hermes Agent u otro) que necesite enterarse de lo que pasa en las sesiones de T3 Code del VPS de Medoxigas sin quedarse vigilando en bucle.

> Seguridad: en este archivo no hay URLs reales, claves ni tokens. Donde dice `TU_URL` o `TU_CLAVE` va el valor real, que solo vive en `/etc/t3-avisos/destinos.json` en el VPS (permisos 600, nunca en git, chats ni Notion).

## 1. Qué es

`t3-avisos` es un servicio pequeño, sin IA, que corre siempre en el VPS **srv2187989** (carpeta `/root/t3-avisos`, servicio systemd `t3-avisos`). Cada 30 segundos revisa todas las sesiones (threads) de todos los proyectos de T3 Code, incluidos los subagentes que lanza el orquestador, y cuando pasa algo manda un **POST JSON** a cada destino de la lista.

Así el agente no gasta nada esperando: duerme hasta que le llega un aviso.

### Por qué revisa cada 30 s y no usa hooks de T3

T3 Code 0.1.11 no tiene un webhook de salida global. Sus hooks son por proveedor y no cubren todos los threads, y sus webhooks de tareas programadas son de entrada. Por eso el servicio lee:

- `t3 thread list --project <ruta> --json` para el estado de cada thread.
- La base de estado de T3 (`/root/.t3/userdata/statev2.sqlite`) **solo lectura**, para preguntas pendientes, subagentes y el último mensaje.
- `t3 thread show <id> --json --messages 10` solo cuando hay un evento.

La actividad se mide con `itemCount`, no con `updatedAt`.

## 2. Los avisos (eventos)

| evento      | cuándo sale |
| ----------- | ----------- |
| `terminada` | el turno de la sesión pasó a `completed` |
| `respuesta` | el orquestador escribió un mensaje nuevo, aunque siga trabajando (solo hilos de arriba, nunca subagentes) |
| `pregunta`  | la sesión espera una respuesta, aprobación o dato del usuario |
| `trabada`   | sigue corriendo pero no produce nada en 10 minutos |
| `error`     | la sesión pasó a `failed`, `interrupted`, `cancelled` o `rolled_back` |
| `t3_caido`  | el servicio `t3code` no está activo o `t3 thread list` no responde |

Cada aviso se manda **una sola vez** por evento y thread (estado en `/var/lib/t3-avisos/estado.json`). Al reiniciar no repite los viejos. Si una `respuesta` trae una pregunta para Waldy (`¿`, «confirma», «aprueba», «decisión»…) se avisa siempre; las informativas seguidas se juntan en una.

Envío: timeout de 10 s y 3 reintentos (2, 4 y 8 s).

## 3. Cuerpo del POST

```json
{
  "evento": "terminada",
  "thread_id": "mcp:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "titulo": "Nombre de la sesión",
  "proyecto": "MEDOXIGAS-CONTABILIDAD",
  "estado": "completed",
  "resumen": "últimas ~500 letras del último mensaje",
  "pregunta": null,
  "minutos_sin_actividad": null,
  "respuesta": null,
  "imagenes": [],
  "mensaje_id": null,
  "es_subagente": false,
  "padre": null,
  "parent_thread_id": null,
  "host": "srv2187989",
  "fecha_iso": "2026-11-22T21:18:16.010Z"
}
```

- `pregunta`: texto solo en el evento `pregunta`.
- `minutos_sin_actividad`: solo en `trabada`.
- `respuesta` (primeras 1500 letras), `imagenes` (rutas absolutas en el VPS) y `mensaje_id`: solo en `respuesta`.
- En un subagente: `es_subagente: true`, `padre` = título del hilo que lo lanzó, `parent_thread_id` = su id.
- `fecha_iso` está en UTC. República Dominicana es UTC-4.

Ejemplos cortos:

```json
{ "evento": "pregunta", "titulo": "ORQUESTADOR PLAN POS 2", "estado": "running", "pregunta": "¿Aplico la migración en la base de prueba?" }
{ "evento": "trabada", "titulo": "POS logo", "es_subagente": true, "padre": "ORQUESTADOR PLAN POS 2", "minutos_sin_actividad": 10 }
{ "evento": "respuesta", "titulo": "ORQUESTADOR PLAN POS 2", "estado": "running", "respuesta": "PR #126 abierto, preview listo.", "imagenes": ["/root/capturas/pos.png"] }
```

## 4. Cómo lo usa hoy Grok Bot (Coder)

1. En Grok Bot, Coder tiene una **rutina con disparador webhook** («Aviso: sesión de T3 Code u OpenCode»). La app le da una URL y una clave.
2. Esa URL y clave están como un destino en `destinos.json`, con el header `Authorization: Bearer TU_CLAVE`.
3. Cuando llega un POST, la rutina despierta al bot con el JSON y el bot decide:
   - `terminada`: revisa el resultado, actualiza el preview, saca capturas, las compara con Alegra y se las manda a Waldy.
   - `pregunta`: le lleva la pregunta a Waldy en palabras simples; nunca contesta solo nada irreversible.
   - `trabada` o `error`: lee el hilo y le pide al orquestador que lo retome, o le avisa a Waldy.
   - `respuesta` informativa: no molesta a Waldy.
   - `t3_caido`: avisa a Waldy.
4. Para leer o escribir en una sesión entra al VPS por SSH:
   - leer: `/root/.local/bin/t3 thread show <thread_id>`
   - escribir: `/root/.local/bin/t3 thread send <thread_id> - < mensaje.md` (si está ocupado responde `Queued.` y lo lee en su próximo turno; si no, `Sent.`)
   - listar: `cd /root/MEDOXIGAS-CONTABILIDAD && /root/.local/bin/t3 thread list`

## 5. Para Hermes Agent: cómo conectarte

1. **Crea tu receptor.** Necesitas una URL que reciba POST JSON.
   - Si eres otra cuenta de Grok Bot: crea una rutina con disparador **webhook** y copia su URL y su clave desde la app. No las pegues en ningún chat.
   - Si es otra plataforma: cualquier endpoint HTTPS que acepte POST con `Content-Type: application/json`.
2. **Agrégate como destino.** Waldy (o un agente con su OK) añade una entrada en `/etc/t3-avisos/destinos.json`:

   ```json
   [
     { "nombre": "Grok Bot Coder", "url": "TU_URL", "headers": { "Authorization": "Bearer TU_CLAVE" } },
     { "nombre": "Hermes Agent", "url": "TU_URL", "headers": { "Authorization": "Bearer TU_CLAVE" } }
   ]
   ```

   No borres los destinos que ya están. Se recarga solo en 30 s.
3. **Prueba.** En el VPS: `t3-avisos test` (manda un aviso de prueba y dice quién respondió 2xx). Errores: `journalctl -u t3-avisos -n 50`. Los logs nunca muestran claves.
4. **Prompt modelo para tu rutina:**

   > Te llega un aviso JSON de t3-avisos. Lee `evento`, `titulo`, `thread_id` y `es_subagente`.
   > - `terminada`: revisa con `t3 thread show` qué quedó hecho y repórtalo en corto.
   > - `pregunta`: pásale la pregunta a Waldy tal cual, en simple, y espera su respuesta antes de contestar en T3.
   > - `trabada` o `error`: lee el hilo; si se puede retomar, manda un mensaje al orquestador para retomarlo; si no, avisa.
   > - `respuesta` sin pregunta: no avises a nadie salvo que sea un resultado importante.
   > - `t3_caido`: avisa a Waldy.
   > Si el mismo `thread_id` y `evento` ya lo atendiste, no hagas nada.
   > Nunca hagas nada irreversible (producción, borrar datos, pagos, migraciones) sin el OK de Waldy.

## 6. Reglas

- Nunca pongas URLs reales, claves ni el contenido de `destinos.json` en git, chats, Notion ni mensajes a T3.
- No edites `destinos.json` sin el OK de Waldy.
- El servicio solo **lee** la base de T3; no la cambies.
- Detalles técnicos y pruebas: `/root/t3-avisos/README.md` en el VPS.

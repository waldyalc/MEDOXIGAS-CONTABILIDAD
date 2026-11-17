# Consulta de RNC/cédula en la DGII

Autocompletar el **Nombre o Razón social** de un contacto a partir del RNC (9 dígitos) o la cédula (11), como en Alegra. Solo se consulta el nombre; la dirección y el municipio se escriben a mano.

## Por qué no hay API oficial

- El WSDL histórico `https://www.dgii.gov.do/wsMovilDGII/WSMovilDGII.asmx?WSDL` ya no existe: responde 301 hacia la portada y el POST al `.asmx` da 403. La DGII bloqueó ese servicio en enero de 2025.
- `https://api.digital.gob.do/v1/contributors/{rnc}/info/basic` devuelve 500. En septiembre de 2026 la DGII confirmó en su centro de ayuda que **no hay API pública** para consultar RNC (solo la consulta web o el listado descargable).
- La consulta pública oficial es un formulario ASP.NET:
  `https://dgii.gov.do/app/WebApps/ConsultasWeb2/ConsultasWeb/consultas/rnc.aspx`

## Cómo se consulta

1. `GET` a la página para obtener `__VIEWSTATE`, `__VIEWSTATEGENERATOR`, `__EVENTVALIDATION` y la cookie de sesión.
2. `POST` con el número en `ctl00$cphMain$txtRNCCedula` y `ctl00$cphMain$btnBuscarPorRNC=BUSCAR`.
3. Se lee la tabla `cphMain_dvDatosContribuyentes` (filas etiqueta/valor).

Código: `src/lib/dgii/consulta.ts` (transporte y parser), `src/lib/dgii/acciones.ts` (server action), `src/lib/dgii/completar.ts` (qué campos llenar y mensaje), `src/components/contactos/consulta-dgii.tsx` (hook y botón).

## Qué devuelve y qué no

Devuelve: Cédula/RNC, **Nombre/Razón Social**, Nombre Comercial, Estado, actividad económica, administración local, régimen de pago y facturador electrónico.

**No devuelve municipio, provincia ni dirección.** Se comprobó el 17/11/2026 en la página y en el listado oficial `DGII_RNC.zip` (columnas: RNC, nombre, nombre comercial, actividad, fecha, estado, régimen). Por eso el formulario solo autocompleta el nombre; el parser deja `municipioProvincia` y `direccion` en `null` si no vienen.

Si el RNC no está inscrito, la página muestra «El RNC/Cédula consultado no se encuentra inscrito como Contribuyente» y se devuelve un error de "no encontrado".

**El portal también falla sin decirlo con claridad.** Comprobado el 17/11/2026 con el RNC `131488791` (OXYMAT SRL, ACTIVO): la misma consulta devolvió, en distintas corridas, (a) la tabla de resultados **vacía** junto al aviso «Ocurrió un error al intentar realizar la búsqueda. Capture esta pantalla y remítala a la Oficina Virtual» y (b) el aviso **«no se encuentra inscrito»** para un RNC que sí está inscrito. Aproximadamente 1 de cada 4 consultas salió mal. Por eso el flujo no confía en una sola respuesta: la tabla vacía y el error del portal **nunca** son "no encontrado", y un "no inscrito" solo se da por bueno cuando la DGII lo repite en otra sesión.

## Flujo defensivo

1. Cada intento abre **sesión nueva**: `GET` de la página (nuevo `__VIEWSTATE`, `__VIEWSTATEGENERATOR`, `__EVENTVALIDATION` y cookie) y `POST` del número.
2. Si llega el nombre → acierto y se cachea 10 minutos.
3. Si la DGII dice «no se encuentra inscrito» → se repite la consulta completa; solo con **dos avisos seguidos** se responde "no encontrado" (se cachea 2 minutos).
4. Tabla vacía, aviso de error del portal, timeout o error de red → se reintenta (hasta 3 intentos, todos dentro de un plazo de 8 s). Si todos fallan se responde «la DGII no devolvió los datos», **sin afirmar que el RNC no existe**, y no se cachea nada.
5. Un 403 bloquea las consultas 5 minutos y la UI pide escribir el nombre a mano.


## Cuidado con el portal

- User-Agent propio: `MedoxigasContabilidad/1.0 (…)`; nunca se hace pasar por un navegador.
- Caché en memoria: 10 minutos por acierto, 2 minutos por "no encontrado" **confirmado**. Los fallos del portal (tabla vacía, error, timeout, red) no se cachean.
- Reintentos acotados: hasta 3 intentos con sesión nueva y una pausa corta entre ellos, todos dentro de un plazo total de 8 s.
- Deduplicación: si dos usuarios piden el mismo número a la vez, se hace una sola consulta.
- Si la DGII responde 403, se pausan las consultas 5 minutos y la UI pide escribirlo a mano.
- La UI nunca guarda sola: el usuario revisa y pulsa Guardar.

## Riesgos

- Es una página ASP.NET: si la DGII cambia el HTML, los campos o la URL, hay que ajustar el parser.
- La DGII puede limitar o bloquear el acceso automatizado (sobre todo en volumen). Por eso el uso es de una consulta por contacto, con caché y sin ráfagas.
- No es una integración aprobada por la DGII; es la consulta pública de solo lectura. La alternativa oficial para ERPs es descargar el listado diario, que se descartó porque pesa ~23 MB comprimido / ~91 MB de texto y no trae dirección.

## Prueba real (17/11/2026)

RNC `130893489` → `MEDOXIGAS ALC SRL`, estado `ACTIVO`, actividad «VENTA AL POR MAYOR DE GASES INDUSTRIALES, METANOL». RNC `131488791` → `OXYMAT SRL`, nombre comercial `OXYMAT`, estado `ACTIVO`. RNC inexistente `131488792` → «no se encuentra inscrito». La consulta completa tarda ~0.3–0.9 s por intento.

Prueba repetible contra el portal real (opcional, no corre en el suite normal):

```bash
DGII_LIVE=1 pnpm exec vitest run src/lib/dgii/consulta.live.test.ts
```

Los unitarios de `src/lib/dgii/consulta.test.ts` simulan las tres respuestas reales (tabla con datos, tabla vacía con error del portal y aviso de no inscrito) y comprueban los reintentos y la caché.

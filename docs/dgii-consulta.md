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

## Cuidado con el portal

- User-Agent propio: `MedoxigasContabilidad/1.0 (…)`; nunca se hace pasar por un navegador.
- Caché en memoria: 10 minutos por acierto, 2 minutos por "no encontrado".
- Sin reintentos. Timeout total de 8 s.
- Deduplicación: si dos usuarios piden el mismo número a la vez, se hace una sola consulta.
- Si la DGII responde 403, se pausan las consultas 5 minutos y la UI pide escribirlo a mano.
- La UI nunca guarda sola: el usuario revisa y pulsa Guardar.

## Riesgos

- Es una página ASP.NET: si la DGII cambia el HTML, los campos o la URL, hay que ajustar el parser.
- La DGII puede limitar o bloquear el acceso automatizado (sobre todo en volumen). Por eso el uso es de una consulta por contacto, con caché y sin ráfagas.
- No es una integración aprobada por la DGII; es la consulta pública de solo lectura. La alternativa oficial para ERPs es descargar el listado diario, que se descartó porque pesa ~23 MB comprimido / ~91 MB de texto y no trae dirección.

## Prueba real (17/11/2026)

RNC `130893489` → `MEDOXIGAS ALC SRL`, estado `ACTIVO`, actividad «VENTA AL POR MAYOR DE GASES INDUSTRIALES, METANOL». RNC inexistente `000000000` → no encontrado. La consulta completa tarda ~0.3–0.9 s.

# Facturación Electrónica e-CF DGII (Ley 32-23)

**Estado:** diseño técnico de dominio. No implementa código ni aplica migraciones.
**Fecha de estudio:** 26-11-2026.
**Alcance:** emisión, envío, recepción, seguridad, representación impresa y pruebas de Comprobantes Fiscales Electrónicos (e-CF) para Medoxigas Contabilidad como **Desarrollo Propio**.
**Fuentes oficiales base:** Ley 32-23, Decreto 587-24, Norma General 01-2020, Informe Técnico e-CF v1.0, Formato e-CF v1.0, XSD oficiales v1.0, Descripción Técnica Servicios DGII, Descripción Técnica Servicios Emisores Electrónicos, Proceso de Certificación para ser Emisor Electrónico e instructivos DGII. Enlaces al final.

> Regla de implementación: la DGII es la autoridad funcional. Si una parte de este diseño difiere del formato XML, el XSD, el portal de certificación o una norma posterior, se corrige este documento antes de programar. No se improvisa en el código.

---

## 0. Decisiones de arquitectura

1. **La DGII y Supabase son autoridades distintas.** Supabase guarda el documento comercial, el XML, el estado de envío y la auditoría; la DGII decide si el e-CF tiene validez fiscal.
2. **El XML firmado es inmutable.** Una vez firmado no se corrige ni se regenera “para arreglar una coma”. Las correcciones posteriores a la remisión se hacen con nota de crédito/débito electrónica; antes del envío solo se puede descartar/anular la secuencia según corresponda.
3. **La firma nunca ocurre en el navegador.** El certificado `.p12`/`.pfx` y su contraseña solo se descifran en memoria del servidor durante la operación criptográfica. No se exponen al cliente, logs, React Server Components serializados, storage público ni git.
4. **La asignación de e-NCF es transaccional.** La serie se bloquea en la misma transacción que crea el documento, como hace hoy el motor contable con `numeraciones`. El e-NCF no se reserva desde la UI ni se reutiliza porque sí.
5. **El envío es idempotente y orientado a estado.** Un timeout no significa “no enviado”: puede haber llegado a la DGII. Antes de reenviar se consulta por `trackId` o por `(RNCEmisor, eNCF)`. Reenviar a ciegas puede crear varios TrackIds del mismo e-NCF.
6. **La representación impresa depende del estado.** Una RI de un e-CF no recibido o rechazado por la DGII no sustenta crédito fiscal. El PDF/ticket debe distinguir `borrador/no fiscal`, `en proceso`, `aceptado`, `aceptado condicional`, `rechazado` y `contingencia`.
7. **Todo texto va en UTF-8, sin etiquetas vacías.** La DGII rechaza o degrada XML con tags vacíos, caracteres no escapados o estructura fuera de orden.
8. **Compatibilidad con el motor actual.** Las series B (`B01`, `B02`, `B03`, `B04`, `B13`–`B16`) siguen existiendo para NCF no electrónicos y contingencia autorizada. Las series electrónicas son nuevas (`E31`, `E32`, etc.) y no se mezclan en la misma fila de `numeraciones`.

### 0.1 Restricción importante del POS offline

El POS actual puede vender sin internet desde el navegador. Bajo el modelo de seguridad de este documento, **no se puede firmar un e-CF en esa condición**, porque el certificado no vive en el navegador. Por tanto:

- En la primera implementación, una venta offline del POS **no es un e-CF fiscal emitido**; es una operación interna pendiente de regularización al sincronizar.
- Para operar en contingencia por falta de conectividad conforme a la Ley 32-23 hará falta una de estas vías, decidida antes de producción:
  1. un **firmador local** en la caja o LAN (servicio localhost/red interna, certificado cifrado y nunca en el navegador); o
  2. bloquear la emisión fiscal electrónica sin conexión y aplicar el procedimiento formal de contingencia cuando la imposibilidad técnica lo permita.
- No se acepta como solución copiar el `.p12` o su contraseña a IndexedDB/localStorage ni firmar en JavaScript del navegador.

---

## 1. Marco legal y tipos de comprobantes DGII

### 1.1 Base legal operativa

- **Ley 32-23:** toda factura electrónica debe ser emitida por un emisor reconocido y autorizado por la DGII; exige certificado digital para procedimiento tributario. El certificado digital de persona física se conserva bajo control exclusivo de su usuario/propietario y la DGII no almacena certificados de los contribuyentes. Las firmas digitales suplen la firma ológrafa y el sello comercial. Una vez firmada y enviada, la factura no se modifica.
- **Decreto 587-24 (Reglamento):** regula implementación, envío diferido, contingencia y obligaciones operativas.
- **Norma General 01-2020:** define emisor, receptor, estados, e-NCF, acuse, aprobación comercial, equivalencia probatoria y conservación de archivos electrónicos.
- **Código Tributario, art. 50:** obligación de conservación documental. El Informe Técnico exige conservar las facturas de consumo y sus XML por **10 años**.

### 1.2 Tipos de e-CF

| Código | Nombre DGII | Uso principal | Serie e-NCF | Equivalencia interna orientativa |
| --- | --- | --- | --- | --- |
| `31` | Factura de Crédito Fiscal Electrónica | Ventas que sustentan costos/gastos o crédito fiscal del comprador | `E31` | Hoy `01`/`B01` |
| `32` | Factura de Consumo Electrónica | Consumidores finales | `E32` | Hoy `02`/`B02` |
| `33` | Nota de Débito Electrónica | Cargos posteriores: intereses, fletes, otros | `E33` | Hoy `03`/`B03` |
| `34` | Nota de Crédito Electrónica | Devoluciones, descuentos, anulaciones y correcciones | `E34` | Hoy `04`/`B04` |
| `41` | Comprobante Electrónico de Compras | Compras a personas no registradas como contribuyentes | `E41` | Documento de compras; no es un NCF de proveedor |
| `43` | Comprobante Electrónico para Gastos Menores | Pagos menores del personal relacionados con el trabajo | `E43` | Hoy `13`/`B13` |
| `44` | Comprobante Electrónico para Regímenes Especiales | Ventas exentas a regímenes especiales | `E44` | Hoy `14`/`B14` |
| `45` | Comprobante Electrónico Gubernamental | Ventas al Gobierno e instituciones cubiertas | `E45` | Hoy `15`/`B15` |
| `46` | Comprobante Electrónico para Exportaciones | Exportaciones de bienes | `E46` | Hoy `16`/`B16` |
| `47` | Comprobante Electrónico para Pagos al Exterior | Rentas de fuente dominicana pagadas a no residentes | `E47` | Compras/pagos al exterior; módulo nuevo |

### 1.3 Regla del Resumen de Factura de Consumo Electrónica (`RFCE`)

Para una Factura de Consumo Electrónica `E32` con **monto total menor que RD$250,000.00**:

1. Se genera igualmente el **e-CF completo** conforme al Formato e-CF.
2. Se firma el e-CF completo.
3. Se toman los primeros 6 caracteres del `SignatureValue` de esa factura y se colocan en `CodigoSeguridadeCF` del resumen.
4. Se genera el XML `RFCE`, se firma también y se envía al servicio de recepción FC.
5. El emisor conserva el e-CF extendido completo en su base/archivo por 10 años y debe disponer de un mecanismo de consulta para el cliente.

La regla es **estrictamente menor**. Una factura `E32` de **RD$250,000.00 exactos o más** se envía completa por el servicio normal de recepción de e-CF, no por `RFCE`.

### 1.4 Documentos XML de intercambio

| Formato | Raíz obligatoria | Quién lo genera | Para qué sirve | Nombre de archivo |
| --- | --- | --- | --- | --- |
| e-CF | `ECF` | Emisor | Factura, nota o comprobante fiscal electrónico completo | `RNCEmisor + eNCF.xml` |
| Acuse de Recibo | `ARECF` | Receptor electrónico | Confirma recepción; **no** aprueba ni rechaza la operación comercial | `RNCComprador + eNCF.xml` |
| Aprobación Comercial | `ACECF` | Receptor electrónico | Acepta o rechaza comercialmente el e-CF recibido; copia a DGII | `RNCComprador + eNCF.xml` |
| Anulación de secuencias | `ANECF` | Emisor | Informa rangos/secuencias de e-NCF no utilizados | La tabla oficial de nombres no define uno para `ANECF`; usar nombre interno determinista y auditable salvo instrucción posterior DGII |
| Resumen FC | `RFCE` | Emisor | Resumen de `E32` menor a RD$250,000 | `RNCEmisor + eNCF.xml` |

Campos operativos clave:

- `ARECF.Estado`: `0` recibido, `1` no recibido. Motivos de no recibido: `1` error de especificación, `2` error de firma digital, `3` envío duplicado, `4` RNC comprador no corresponde.
- `ACECF.Estado`: `1` aceptado, `2` rechazado; el rechazo exige `DetalleMotivoRechazo`.
- `ANECF` permite hasta 10 líneas de anulación por XML, cada una con tipo de e-CF y rangos desde/hasta.

### 1.5 Formato del e-NCF

El e-NCF tiene **13 caracteres**:

```text
E 31 0000000001
| |  └─ secuencial de 10 dígitos
| └──── tipo de e-CF (31, 32, ..., 47)
└────── serie electrónica
```

Ejemplo: `E310000000001`.

La vigencia normal de una secuencia autorizada es desde su autorización hasta el **31 de diciembre del año siguiente**, salvo reglas especiales publicadas por la DGII. No se usa después de vencida. En pre-certificación la DGII habilita rangos de prueba por tipo (1–10,000,000; `E32` 1–50,000,000), con vencimiento publicado en la descripción técnica vigente; `E32` y `E34` de pre-certificación no llevan fecha de vencimiento según esa documentación.

---

## 2. Ambientes y Web Services oficiales DGII

### 2.1 Ambientes

| Ambiente | Propósito | Validez fiscal | Host principal |
| --- | --- | --- | --- |
| `testecf` / TesteCF | Pre-certificación: pruebas de adecuación e integración | No | `https://ecf.dgii.gov.do/testecf` y `https://fc.dgii.gov.do/testecf` |
| `certecf` / CerteCF | Certificación oficial del software antes de producción | No | `https://ecf.dgii.gov.do/certecf` y `https://fc.dgii.gov.do/certecf` |
| `ecf` / eCF | Producción | **Sí** | `https://ecf.dgii.gov.do/ecf` y `https://fc.dgii.gov.do/ecf` |

Las Facturas de Consumo (`RFCE` y timbre FC) usan el host `fc.dgii.gov.do`; el resto usa `ecf.dgii.gov.do`.

> Nota de implementación: la documentación mezcla mayúsculas y minúsculas en ejemplos (`Consultas/Estado`, `consultas/estado`). En el código se centraliza una sola tabla de URLs y se verifica contra el Swagger/portal antes de habilitar producción. No se duplican URLs literales por el código.

### 2.2 Endpoints DGII

| Servicio | Método y recurso | Entrada | Salida esencial |
| --- | --- | --- | --- |
| Obtener semilla | `GET https://ecf.dgii.gov.do/{ambiente}/autenticacion/api/autenticacion/semilla` | Ninguna | XML `SemillaModel` con `valor` y `fecha` |
| Validar semilla | `POST https://ecf.dgii.gov.do/{ambiente}/autenticacion/api/autenticacion/validarsemilla` | `multipart/form-data`, campo `xml` con semilla firmada | JSON/XML con `token`, `expira`, `expedido` |
| Recepción e-CF completo | `POST https://ecf.dgii.gov.do/{ambiente}/recepcion/api/facturaselectronicas` | Bearer token + `xml` firmado | `trackId`, `error`, `mensaje` |
| Recepción RFCE | `POST https://fc.dgii.gov.do/{ambiente}/recepcionfc/api/recepcion/ecf` | Bearer token + `xml` RFCE firmado | `codigo`, `estado`, `mensajes`, `encf`, `secuenciaUtilizada` |
| Consulta resultado por TrackId | `GET https://ecf.dgii.gov.do/{ambiente}/consultaresultado/api/consultas/estado?trackid={trackId}` | Bearer token | `trackId`, `codigo`, `estado`, `rnc`, `eNCF`, `secuenciaUtilizada`, `fechaRecepcion`, `mensajes` |
| Consulta RFCE | `GET https://fc.dgii.gov.do/{ambiente}/consultarfce/api/Consultas/Consulta?RNC_Emisor=...&ENCF=...&Cod_Seguridad_eCF=...` | Bearer token | `rnc`, `encf`, `secuenciaUtilizada`, `codigo`, `estado`, `mensajes` |
| Consulta estado e-CF | `GET https://ecf.dgii.gov.do/{ambiente}/consultaestado/api/consultas/estado?rncemisor=...&ncfelectronico=...&rnccomprador=...&codigoseguridad=...` | Bearer token; usuario delegado en emisor o receptor | estado y datos principales del comprobante |
| Consulta TrackIds por e-NCF | `GET https://ecf.dgii.gov.do/{ambiente}/consultatrackids/api/trackids/consulta?rncemisor=...&encf=...` | Bearer token; usuario delegado del emisor | lista de `trackId`, estado y fecha |
| Recepción aprobación comercial | `POST https://ecf.dgii.gov.do/{ambiente}/aprobacioncomercial/api/aprobacioncomercial` | Bearer token + XML `ACECF` firmado | `estado`, `codigo`, `mensaje` |
| Anulación de rangos | `POST https://ecf.dgii.gov.do/{ambiente}/anulacionrangos/api/operaciones/anularrango` | Bearer token + XML `ANECF` firmado | `rnc`, `codigo`, `nombre`, `mensajes` |
| Directorio: listado | `GET https://ecf.dgii.gov.do/{ambiente}/consultadirectorio/api/consultas/listado` | Bearer token | contribuyentes y URLs de recepción/aprobación/autenticación |
| Directorio por RNC | `GET https://ecf.dgii.gov.do/{ambiente}/consultadirectorio/api/consultas/obtenerdirectorioporrnc?RNC=...` | Bearer token | URLs del contribuyente |
| Consulta timbre e-CF | `GET https://ecf.dgii.gov.do/{ambiente}/consultatimbre?...` | Público por QR | validez y datos principales del e-CF |
| Consulta timbre FC | `GET https://fc.dgii.gov.do/{ambiente}/consultatimbrefc?...` | Público por QR | validez del `RFCE` |

Disponibilidad documentada por ambiente:

- Autenticación, recepción e-CF, recepción RFCE, consulta resultado, aprobación comercial y timbre existen en los tres ambientes según la descripción técnica vigente.
- Consulta estado, consulta TrackIds, anulación y directorio están documentados en pre-certificación/producción para varios servicios; antes de automatizarlos en CerteCF se confirma disponibilidad en el portal oficial del ambiente.
- En producción el directorio devuelve contribuyentes reales; en pre-certificación devuelve URLs de prueba del servicio emisor/receptor habilitado por DGII.

### 2.3 Flujo completo de emisión

```text
documento interno confirmado
  → asignación atómica e-NCF
  → construir XML unsigned en orden exacto del XSD
  → validar XSD + reglas de negocio + totales
  → obtener semilla DGII (si no hay token vigente)
  → firmar semilla (XMLDSig)
  → validar semilla y cachear Bearer token (1 hora)
  → firmar e-CF/RFCE (XMLDSig)
  → persistir XML firmado + hash + código seguridad + fecha/hora firma
  → POST Recepción o RecepciónFC
  → guardar TrackId o respuesta inmediata RFCE
  → polling ConsultaResultado para e-CF completos
  → estado final: Aceptado / Aceptado Condicional / Rechazado
  → recién entonces habilitar RI fiscal definitiva y envío al receptor
```

Para `RFCE` la respuesta de recepción ya trae estado; igual se puede verificar por Consulta RFCE o timbre FC. Para e-CF completo el `TrackId` solo es acuse de recepción técnica, **no** aceptación fiscal.

### 2.4 Estados DGII

| Estado | Código DGII en consulta | Significado operativo |
| --- | --- | --- |
| No encontrado | `0` | No existe TrackId/comprobante en registros; puede ser aún no reportado |
| Aceptado | `1` | Válido para fines fiscales |
| Rechazado | `2` | Nulo para fines tributarios; no se entrega como documento fiscal válido |
| En Proceso | `3` | Aún en validación; consultar después. La DGII indica promedio estimado de 200 ms y la Norma exige comunicación dentro de 24 h |
| Aceptado Condicional | `4` | Válido, pero con irregularidad que debe corregirse en futuros comprobantes. La Norma da 15 días para subsanar la irregularidad, salvo ampliación |

`secuenciaUtilizada` tiene lectura intencionalmente cuidadosa: la descripción técnica indica `true = no puede reutilizarse la secuencia` y `false = puede reutilizarse la secuencia` en los rechazos específicos listados (firma/certificado inválido, XML inválido, firmante no delegado, e-NCF no autorizado o vencido, RNC emisor inválido/inactivo/inexistente). Debe guardarse la respuesta textual y el flag; nunca se deduce solo del estado `Rechazado`.

### 2.5 Reintentos e idempotencia

1. Antes del primer POST se persiste `encf`, hash del XML y payload exacto.
2. Si hay respuesta con `trackId`, toda consulta posterior usa ese `trackId`.
3. Si hay timeout antes de leer respuesta:
   - consultar TrackIds por `(RNCEmisor, eNCF)` cuando el servicio esté disponible;
   - si aparece, adoptar el `trackId` y seguir polling;
   - si no aparece, reenviar **exactamente los mismos bytes firmados**; no regenerar firma porque cambiaría `SignatureValue` y el código de seguridad impreso.
4. Si la DGII rechaza:
   - leer `mensajes` y `secuenciaUtilizada`;
   - si la secuencia no puede reutilizarse, marcarla como quemada/no disponible y crear la vía de reemisión con otra secuencia autorizada según decisión contable;
   - si puede reutilizarse, corregir el XML, firmar de nuevo y reenviar bajo control de intentos.
5. Los reintentos usan backoff acotado (por ejemplo 2 s, 5 s, 15 s, 60 s) y nunca un loop sincrónico en una server action de usuario.

---

## 3. Seguridad criptográfica y certificado digital

### 3.1 Firma XMLDSig Enveloped

La firma debe insertarse como nodo `Signature` dentro del propio XML (`enveloped`) y cubrir todo el documento:

```xml
<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
  <SignedInfo>
    <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315" />
    <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256" />
    <Reference URI="">
      <Transforms>
        <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature" />
      </Transforms>
      <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256" />
      <DigestValue>...</DigestValue>
    </Reference>
  </SignedInfo>
  <SignatureValue>...</SignatureValue>
  <KeyInfo>
    <X509Data>
      <X509Certificate>...</X509Certificate>
    </X509Data>
  </KeyInfo>
</Signature>
```

Reglas obligatorias:

- XML en UTF-8.
- Canonicalización XML C14N.
- Digest SHA-256.
- Firma RSA-SHA256.
- Transformación enveloped y `Reference URI=""`.
- `KeyInfo` con el certificado X509.
- El campo `SN` del certificado debe corresponder al RNC, cédula o pasaporte del propietario.
- Firmar sin preservar espacios (`preserveWhitespace = false`, en la terminología del instructivo DGII).
- No incluir etiquetas vacías: se omiten, no se serializan como `<Tag/>`.
- Escapar correctamente el contenido XML conforme a la tabla de la sección 3.2.1.
- Una vez calculada la firma, cualquier cambio de whitespace, orden, codificación o contenido invalida la firma.

### 3.2 Código de Seguridad y QR

El **Código de Seguridad** son los primeros **6 caracteres** del valor Base64 de `SignatureValue`.

Fuente de la firma según el documento:

- En un e-CF completo se toma el `SignatureValue` del propio e-CF enviado.
- En una factura de consumo `E32 < RD$250,000` se toma el `SignatureValue` de la **factura completa firmada**, no el del XML `RFCE`; ese valor se copia en `CodigoSeguridadeCF` del resumen y también alimenta el QR FC.

Precisión documental importante: varios textos DGII dicen “seis dígitos del hash generado en el `SignatureValue`”, pero el propio ejemplo oficial de QR usa un código alfanumérico (`dcp79q`) y el Formato RFCE describe “6 primeros caracteres”. Por tanto la implementación toma **caracteres**, no solo dígitos numéricos, y los URL-encodea. Esta regla debe validarse nuevamente en TesteCF antes de certificar.

Para un e-CF completo el QR contiene la URL de Consulta Timbre con:

- `RncEmisor`
- `RncComprador`
- `ENCF`
- `FechaEmision` en `dd-MM-aaaa`
- `MontoTotal`
- `FechaFirma` en `dd-MM-aaaa HH:mm:ss`
- `CodigoSeguridad`

Forma de producción:

```text
https://ecf.dgii.gov.do/ecf/consultatimbre?rncemisor=...&rnccomprador=...&encf=...&fechaemision=dd-mm-aaaa&montototal=...&fechafirma=dd-mm-aaaa%20hh:mm:ss&codigoseguridad=......
```

Para `E32 < RD$250,000` el QR usa Consulta Timbre FC y contiene solo:

- `RncEmisor`
- `ENCF`
- `MontoTotal`
- `CodigoSeguridad`

Forma:

```text
https://fc.dgii.gov.do/ecf/consultatimbrefc?rncemisor=...&encf=...&montototal=...&codigoseguridad=...
```

Reglas de QR/RI:

- QR versión 8 según descripción técnica DGII.
- Tamaño mínimo 22 × 22 mm, margen de 3 mm, a 2 cm o más del borde; lado inferior izquierdo (o inferior central en handheld).
- Los parámetros se URL-encodean; en especial espacio, `&`, `#`, `%`, `/`, `?`, `=`, `+` y símbolos.
- Debajo del QR se imprime el Código de Seguridad en texto y la Fecha/Hora de Firma Digital en `dd-MM-aaaa HH:mm:ss`.

### 3.2.1 Caracteres especiales y encoding

En información alfanumérica del XML, la DGII exige reemplazar estos caracteres por su forma escapada estándar:

| Carácter | Escape XML preferido | Referencia decimal | Referencia hexadecimal |
| --- | --- | --- | --- |
| `"` | `&quot;` | `&#34;` | `&#x22;` |
| `'` | `&apos;` | `&#39;` | `&#x27;` |
| `<` | `&lt;` | `&#60;` | `&#x3C;` |
| `>` | `&gt;` | `&#62;` | `&#x3E;` |
| `&` | `&amp;` | `&#38;` | `&#x26;` |
| `©` | `&copy;` | `&#169;` | `&#xA9;` |
| `€` | `&euro;` | `&#8364;` | `&#x20AC;` |
| `®` | `&reg;` | `&#174;` | `&#xAE;` |

La serialización XML normal escapa automáticamente los cinco caracteres básicos. Los tres símbolos adicionales deben cubrirse en pruebas porque la documentación DGII los lista expresamente. No se reemplazan caracteres dentro del Base64 de firma como contenido de texto; se URL-encodean al construir el QR.

Para el Código de Seguridad dentro de la URL del QR, la descripción técnica exige percent-encoding hexadecimal de los caracteres reservados. La implementación debe usar encoding estándar de componentes URI y probar al menos:

```text
espacio %20   ! %21   # %23   $ %24   & %26   ' %27   ( %28   ) %29
* %2A         + %2B   , %2C   / %2F   : %3A   ; %3B   = %3D   ? %3F
@ %40         [ %5B   ] %5D   " %22   - %2D   . %2E   < %3C   > %3E
\ %5C        ^ %5E   _ %5F   ` %60
```

En JavaScript/TypeScript `encodeURIComponent` no encodea `'`, `(`, `)`, `*` ni algunos caracteres que DGII lista; por eso el builder de QR debe aplicar una capa adicional explícita y tener tests vectoriales. No se construye la URL concatenando strings crudos.

### 3.3 Custodia del certificado `.p12`/`.pfx`

Diseño obligatorio:

1. El archivo `.p12`/`.pfx` se sube una sola vez desde un navegador autenticado a una server action/RPC del servidor.
2. En memoria de servidor se valida:
   - que el archivo abre con la contraseña;
   - que contiene llave privada;
   - titular, serial, issuer, vigencia y huella SHA-256;
   - que el documento del titular coincide con el representante/firmante configurado.
3. Se cifra el blob completo con **AES-256-GCM** antes de persistirlo.
4. La contraseña del `.p12` se cifra también; nunca se guarda en claro.
5. La clave maestra vive en `ECF_ENCRYPTION_KEY` en variables de entorno del servidor. Formato recomendado: 32 bytes aleatorios codificados en base64/base64url.
6. El sobre cifrado guarda `key_id`, IV único por cifrado y tag GCM. Formato conceptual: `v1.<key_id>.<iv>.<tag>.<ciphertext>`.
7. La llave privada se materializa solo en memoria durante firmar/verificar y se descarta. No se escribe en archivos temporales.
8. Rotación: una versión futura puede re-cifrar con `key_id` nuevo sin cambiar el certificado. No se imprime el material en ningún paso.

Importante de PostgreSQL/RLS: RLS controla filas, **no oculta columnas**. Por eso la tabla que contiene el blob no debe tener `SELECT` directo para la app. La UI lee solo una vista/RPC de metadatos que excluye blob y contraseña.

Prohibiciones sin excepción:

- No exponer blob, contraseña, clave privada, PEM o DER al navegador.
- No escribir certificado ni contraseña en logs, auditoría de texto libre, errores de UI, Sentry, Vercel logs, tests ni fixtures.
- No commitear certificados reales ni `.env*`.
- No usar `service_role` en cliente ni en scripts.
- No almacenar el certificado en Supabase Storage público.
- No pasar el certificado por query params, URLs, adjuntos ni correo.

---

## 4. Estructura XML y motor de construcción

### 4.1 Estructura raíz del e-CF

El XSD oficial v1.0 ordena la raíz `ECF` así:

1. `Encabezado` obligatorio
2. `DetallesItems` obligatorio
3. `Subtotales` opcional
4. `DescuentosORecargos` condicional/opcional
5. `Paginacion` opcional
6. `InformacionReferencia` condicional
7. `FechaHoraFirma` obligatorio
8. `Signature` obligatorio al final (fuera del XSD base porque es XMLDSig)

`Encabezado` ordena:

- `Version` = `1.0`
- `IdDoc`
- `Emisor`
- `Comprador`
- `InformacionesAdicionales` opcional
- `Transporte` opcional
- `Totales`
- `OtraMoneda` opcional

`DetallesItems` contiene 1–1,000 `Item` según los XSD oficiales v1.0 descargados; cada `Item` incluye, en orden, número de línea, indicador de facturación, retención si aplica, nombre, indicador bien/servicio, cantidad, unidad, precio, descuentos/recargos, impuestos adicionales, otra moneda y `MontoItem`.

Discrepancia oficial a resolver en certificación: el Informe Técnico dice que las `E32 < 250 mil` tienen un tope de 10,000 líneas en la RI/operación, pero el XSD `e-CF_32_v.1.0.xsd` vigente en la descarga oficial limita `DetallesItems.Item` a 1,000 ocurrencias. Hasta que DGII publique un XSD o aclaración que habilite 10,000, la implementación no debe afirmar que puede enviar más de 1,000 líneas; el límite de 10,000 queda documentado como requerimiento de RI/paginación a aclarar en TesteCF/CerteCF.

### 4.2 Reglas de montos

- Montos en DOP salvo sección `OtraMoneda`.
- Decimales con punto, sin separador de miles.
- Máximo 2 decimales en campos de valores; redondeo half-up: tercer decimal `< 5` se mantiene, `>= 5` incrementa el segundo.
- Tolerancia DGII: ±1 unidad de precio por cantidad por línea y tolerancia global equivalente al número de líneas. La meta de Medoxigas no debe ser “pasar por tolerancia”, sino cuadrar exacto en centavos; la tolerancia queda como red de seguridad/auditoría.
- El cálculo fiscal se hace en servidor usando centavos/`numeric(14,2)`, nunca floats.

### 4.3 Paquetes TypeScript propuestos

Sin añadir dependencias todavía. La implementación debe evaluar y justificar en PR cualquier librería nueva; el instructivo DGII demuestra firmas con `node-forge`, `xmldom` y ejemplos en otros lenguajes, pero no obliga una librería.

```text
src/lib/ecf/
  tipos.ts              # tipos de documento, estados y DTOs fiscales
  ambiente.ts           # tabla única de URLs por ambiente
  xml.ts                # escape, serialización determinista, fechas DD-MM-AAAA
  validacion-xsd.ts     # validación estructural offline contra XSD oficiales versionados
  ecf-builder.ts        # construcción ECF por tipo 31–47
  rfce-builder.ts       # construcción resumen E32 < 250k
  acecf-builder.ts      # aprobación/rechazo comercial
  arecf-builder.ts      # acuse de recibo
  anecf-builder.ts      # anulación de rangos
  firma-xmldsig.ts      # PKCS#12 + canonicalización + XMLDSig + verify
  certificado.ts        # cifrado/descifrado AES-256-GCM y metadatos
  codigo-seguridad.ts   # primeros 6 chars de SignatureValue
  qr.ts                 # URLs timbre/timbreFC y percent-encoding
  cliente-dgii.ts       # fetch server-only, token cache, timeouts, backoff
  estado.ts             # máquina de estados interna/DGII
  secuencias.ts         # selección/validación de series E en numeraciones
  mapeo-documentos.ts   # facturas/notas/compras internas → DTO fiscal
```

Los XSD oficiales se versionan en el repo solo si su licencia/condiciones lo permiten y sin datos privados; si no, se descargan como artefacto controlado de implementación. Los tests deben fijar hash/fecha de versión para detectar cambios.

### 4.4 Máquina de estados interna

```text
pendiente_xml
  → xml_generado
  → validado_local
  → firmado
  → listo_envio
  → enviado_trackid
  → en_proceso
  → aceptado | aceptado_condicional | rechazado
```

Estados transversales:

- `error_local`: XML no construible o datos incompletos.
- `error_transporte`: timeout/red/5xx antes de confirmación; exige reconciliación, no reenvío ciego.
- `secuencia_quemada`: la DGII rechazó y `secuenciaUtilizada=true`.
- `anulado_dgii`: secuencia reportada como no usada mediante `ANECF` (solo cuando corresponde).
- `contingencia_pendiente_envio`: generado firmado en contingencia de conectividad y pendiente de remisión dentro del plazo legal.
- `reemplaza_contingencia`: e-CF que reemplaza un NCF no electrónico autorizado durante contingencia técnica.

---

## 5. Endpoints propios de Desarrollo Propio

Todo emisor electrónico también es receptor electrónico. La DGII exige servicios accesibles desde internet, HTTPS, puertos tradicionales, sin distinción sensible de mayúsculas/minúsculas y sin dominio en listas negras/proxy avoidance. En Next.js se implementan como Route Handlers server-side.

La forma final registrada en la DGII debe ser exactamente la base pública + el recurso estándar. Propuesta usando el dominio productivo de Medoxigas:

```text
https://medoxigas-contabilidad.vercel.app/api/ecf/fe/autenticacion/api/semilla
https://medoxigas-contabilidad.vercel.app/api/ecf/fe/autenticacion/api/validacioncertificado
https://medoxigas-contabilidad.vercel.app/api/ecf/fe/recepcion/api/ecf
https://medoxigas-contabilidad.vercel.app/api/ecf/fe/aprobacioncomercial/api/ecf
```

### 5.1 `GET /api/ecf/fe/autenticacion/api/semilla`

La autenticación emisor-receptor es **opcional** según DGII; recepción y aprobación comercial son obligatorias. Si se declara autenticación en el Directorio FE, ambos recursos (`semilla` y `validacioncertificado`) deben operar correctamente.

- Devuelve XML `SemillaModel` con `valor` único y `fecha` con offset RD.
- La semilla se guarda firmada/sellada en cache server-side por pocos minutos para evitar replay.
- Respuesta XML `text/xml; charset=utf-8`.
- No requiere bearer previo.

### 5.2 `POST /api/ecf/fe/autenticacion/api/validacioncertificado`

- Recibe `multipart/form-data` con campo `xml` (la semilla firmada por el emisor externo).
- Valida estructura `SemillaModel`, existencia/no expiración de la semilla, XMLDSig, certificado y que el RNC/identidad del firmante corresponda al emisor declarado en el XML o sea aceptable según directorio/delegación.
- Devuelve JSON o XML según `Accept`:

```json
{
  "token": "jwt-opaco-firmado",
  "expira": "yyyy-MM-ddTHH:mm:ssZ",
  "expedido": "yyyy-MM-ddTHH:mm:ssZ"
}
```

- Token máximo 1 hora, firmado server-side con secreto propio (`ECF_RECEPCION_JWT_SECRET`), audiencia `recepcion-ecf`, sin información sensible.

### 5.3 `POST /api/ecf/fe/recepcion/api/ecf`

Obligatorio.

1. Si se declaró autenticación, exige `Authorization: Bearer <token>` válido.
2. Recibe `multipart/form-data` campo `xml`.
3. Persiste bytes crudos antes de procesar, con hash SHA-256.
4. Valida que no sea duplicado exacto y que `(RNCEmisor, eNCF)` no exista ya como recibido.
5. Valida XML contra XSD del tipo `TipoeCF` y firma XMLDSig.
6. Valida que `RNCComprador` sea el RNC de Medoxigas/Oxymat según la configuración activa.
7. Devuelve **XML ARECF firmado digitalmente**:
   - `Estado=0` si recibido;
   - `Estado=1` con `CodigoMotivoNoRecibido` 1–4 si no recibido.
8. En éxito deja el documento en `ecf_recibidos` con estado `recibido_pendiente_revision` para aprobación comercial/registro contable.

Errores de transporte devuelven HTTP 400/401/409/500 según corresponda, pero el acuse negativo firmado es la respuesta funcional cuando el XML pudo procesarse.

### 5.4 `POST /api/ecf/fe/aprobacioncomercial/api/ecf`

Obligatorio.

1. Exige bearer si autenticación declarada.
2. Recibe XML `ACECF` firmado.
3. Valida XSD, firma, coincidencia de `RNCEmisor`, `eNCF`, `FechaEmision`, `MontoTotal` y `RNCComprador` con un e-CF previamente emitido por nosotros.
4. Persiste aprobación/rechazo comercial del cliente.
5. Responde HTTP 200 si la estructura y recepción fueron procesadas; HTTP 400 si no.
6. En paralelo/flujo posterior, la misma aprobación debe remitirse a DGII cuando seamos nosotros el receptor; aquí estamos recibiendo la del cliente como emisor.

### 5.5 Exposición pública controlada

- Los cuatro endpoints deben estar excluidos del middleware de login y de redirecciones HTML.
- Solo aceptan XML/multipart; no formularios HTML ni JSON de documento fiscal.
- Rate limit por IP/RNC, tamaño máximo de XML y timeouts cortos.
- Logs estructurados sin XML completo ni certificados: hash, RNC, eNCF, estado, IP y código de error.
- En Vercel hay que confirmar límites de body/tiempo antes de producción; si no bastan, se evalúa un subdominio/servicio receptor en VPS. La URL final no se cambia después de certificar sin actualizar Directorio FE.

---

## 6. Modelo de datos propuesto

No es una migración todavía. Los nombres y tipos se ajustan al implementar con pgTAP, pero las invariantes quedan fijadas.

### 6.1 `ecf_config`

Configuración por emisor. Hoy `empresa` es singleton (`id=1`); se propone `empresa_id` para no bloquear una futura multiempresa de MEDOXIGAS/OXYMAT, pero la fase 1 solo configura MEDOXIGAS.

```sql
ecf_config (
  id uuid pk default gen_random_uuid(),
  empresa_id int not null references empresa(id),
  ambiente text not null check (ambiente in ('testecf','certecf','ecf')),
  modalidad text not null default 'desarrollo_propio'
    check (modalidad in ('desarrollo_propio')),
  rnc_emisor text not null check (rnc_emisor ~ '^[0-9]{9,11}$'),

  -- secretos: nunca seleccionables directamente por authenticated
  certificado_cifrado bytea,
  certificado_password_cifrado bytea,
  cifrado_key_id text,
  certificado_sha256 text,

  -- metadatos visibles por RPC/vista
  certificado_titular text,
  certificado_documento_titular text,
  certificado_issuer text,
  certificado_serial text,
  certificado_valido_desde timestamptz,
  certificado_valido_hasta timestamptz,

  wizard_paso int not null default 0 check (wizard_paso between 0 and 14),
  url_autenticacion text,
  url_recepcion text,
  url_aprobacion text,
  produccion_habilitada boolean not null default false,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, ambiente)
);
```

Reglas:

- RLS activo.
- **Ninguna política `SELECT` directa sobre la tabla base** para roles de app si contiene secretos.
- Vista `ecf_config_metadatos` o RPC `ecf_obtener_configuracion()` devuelve solo columnas no sensibles a `admin`/`contador`.
- Escritura solo por RPC `security definer`; subir/rotar certificado y habilitar producción solo `admin`.
- `contador` puede leer metadatos y estado del wizard, nunca blob ni contraseña.
- Auditoría registra quién sube/rota certificado con huella y fecha, no el contenido.

### 6.2 `ecf_envios`

Tabla de intentos/envíos de documentos emitidos por nosotros. Se propone una fila por intento para preservar evidencia fiscal y evitar sobrescribir respuestas.

```sql
ecf_envios (
  id uuid pk default gen_random_uuid(),
  documento_tipo text not null check (documento_tipo in (
    'factura_venta',
    'nota_credito_venta',
    'nota_debito_venta',
    'comprobante_compras',
    'gasto_menor',
    'pago_exterior'
  )),
  documento_id uuid not null,
  tipo_ecf text not null check (tipo_ecf in ('31','32','33','34','41','43','44','45','46','47')),
  encf text not null check (encf ~ '^E(31|32|33|34|41|43|44|45|46|47)[0-9]{10}$'),
  ambiente text not null check (ambiente in ('testecf','certecf','ecf')),
  intentos int not null check (intentos >= 1),

  es_rfce boolean not null default false,
  xml_sha256 text not null,
  xml_firmado bytea not null,
  codigo_seguridad text not null check (length(codigo_seguridad) = 6),
  fecha_firma timestamptz not null,

  track_id text,
  estado_dgii text not null default 'pendiente'
    check (estado_dgii in (
      'pendiente','en_proceso','aceptado','aceptado_condicional',
      'rechazado','no_encontrado','error_transporte','error_local'
    )),
  codigo_dgii int,
  secuencia_utilizada boolean,
  fecha_recepcion_dgii timestamptz,
  respuesta_dgii jsonb,
  mensajes_dgii jsonb,

  enviado_en timestamptz,
  ultimo_intento_en timestamptz,
  proximo_reintento_en timestamptz,
  creado_por uuid references auth.users(id),
  creado_en timestamptz not null default now(),

  unique (documento_tipo, documento_id, intentos),
  unique (ambiente, encf, intentos)
);
```

Invariantes:

- Un mismo `(ambiente, encf)` no puede terminar con dos estados finales distintos; la reconciliación por DGII manda.
- `xml_firmado` no se actualiza después de un envío confirmado. Si se corrige y se permite reutilizar la secuencia, eso es un nuevo intento con XML/hash propio.
- `codigo_seguridad` se calcula del `SignatureValue` del propio XML enviado. Para `RFCE`, además el resumen guarda el código de la factura completa según el formato; el modelo debe poder guardar ambos si se implementa una columna adicional en la fase de XML.
- RLS: lectura de metadatos para `admin`/`contador`; `lector` no necesita XML crudo. Igual que `ecf_config`, el XML se expulsa de cualquier vista general. Descarga controlada por RPC/acción auditada.
- Conservación mínima 10 años. No hay borrado físico.

### 6.3 `ecf_recibidos`

```sql
ecf_recibidos (
  id uuid pk default gen_random_uuid(),
  empresa_id int not null references empresa(id),
  rnc_emisor text not null,
  razon_social_emisor text,
  rnc_comprador text not null,
  tipo_ecf text not null,
  encf text not null,
  fecha_emision date,
  monto_total numeric(14,2),
  total_itbis numeric(14,2),
  xml_sha256 text not null,
  xml_recibido bytea not null,
  xml_recibido_firmado boolean not null default false,

  estado_acuse text not null check (estado_acuse in ('recibido','no_recibido')),
  codigo_motivo_no_recibido int check (codigo_motivo_no_recibido between 1 and 4),
  xml_arecf bytea,
  fecha_acuse timestamptz,

  estado_aprobacion text check (estado_aprobacion in ('pendiente','aceptado','rechazado')),
  detalle_motivo_rechazo text,
  xml_acecf bytea,
  fecha_aprobacion timestamptz,
  acecf_track_dgii text,

  proveedor_contacto_id uuid references contactos(id),
  factura_proveedor_id uuid references facturas_proveedor(id),
  estado_registro text not null default 'pendiente_revision'
    check (estado_registro in ('pendiente_revision','registrado','descartado','error')),

  recibido_en timestamptz not null default now(),
  creado_en timestamptz not null default now(),
  unique (empresa_id, rnc_emisor, encf)
);
```

Reglas:

- Duplicado exacto o mismo `(rnc_emisor, encf)` se responde con motivo `3 Envío duplicado` cuando aplique, sin crear segunda copia.
- La aprobación comercial es posterior al acuse. El acuse no significa aceptación contable.
- Registrar como factura de proveedor es una acción humana o semiautomática que mantiene trazabilidad `ecf_recibidos.id ↔ facturas_proveedor.id`.

### 6.4 Cambios necesarios en `numeraciones`

Las series electrónicas requieren distinguir serie fiscal y tecnología de emisión. Propuesta aditiva:

```sql
alter table numeraciones
  add column canal text not null default 'papel'
    check (canal in ('papel','electronico')),
  add column tipo_ecf text check (tipo_ecf in ('31','32','33','34','41','43','44','45','46','47'));
```

Alternativamente se infiere del prefijo `E31`...`E47`; pero una columna `canal` evita depender de parsing y facilita candados. Para una serie `electronica`:

- `prefijo` debe ser exactamente `E31`, `E32`, etc.;
- el consecutivo se formatea con **10 dígitos**, no 8 como los NCF B;
- `siguiente` nunca baja por edición manual;
- una sola serie activa por `(tipo_ecf, ambiente/contexto)` en operación;
- al migrar desde Alegra se carga manualmente `último emitido + 1` en la ventana de corte.

---

## 7. Representación impresa: Carta y Ticket 80 mm

### 7.1 Requisitos DGII mínimos

En todos los e-CF con RI:

- Tipo de comprobante en palabras (por ejemplo “Factura de Crédito Fiscal Electrónica”).
- e-NCF.
- Fecha de vencimiento de la secuencia cuando aplique (no aplica a nota de crédito y factura de consumo según notas del Informe Técnico; se imprime solo si la serie la tiene).
- En notas: e-NCF/NCF modificado y descripción del código de modificación.
- Datos del emisor: nombre comercial si existe, razón social, sucursal si aplica, RNC, dirección, municipio, provincia y fecha de emisión.
- Datos del cliente/destinatario.
- Detalle con cantidad, descripción, unidad si aplica, precio, descuentos/recargos, ITBIS/ISC/impuestos y valor.
- Totales: subtotal gravado/exento, ITBIS, ISC/CDT/propina cuando aplique, total.
- QR verificable.
- Código de Seguridad debajo del QR.
- Fecha y hora de Firma Digital en `dd-MM-aaaa HH:mm:ss`.
- Si hay paginación, encabezado y datos de consulta se repiten según la guía; subtotales por página solo cuando corresponda.
- Calidad legible por al menos 10 años.

### 7.2 Carta

La Carta actual puede conservar el diseño Medoxigas/Alegra siempre que el bloque fiscal electrónico respete orden y mínimos. Reglas de estado:

- `pendiente/en_proceso`: si se muestra una vista previa, debe llevar marca de agua/leyenda “Vista previa — no válida como comprobante fiscal”.
- `aceptado` o `aceptado_condicional`: QR y timbre definitivos.
- `rechazado`: no se entrega como RI fiscal; solo vista interna.
- `contingencia de conectividad`: leyenda visible exacta orientativa de la DGII: **“e-CF emitido en modalidad de Contingencia, el cual podrá ser consultado para su validez fiscal, partir de las setenta y dos (72) horas”**.

### 7.3 Ticket 80 mm

El ticket térmico ya tiene medidas estrictas del contrato `ticket-80mm`; al agregar e-CF no se inventan medidas. Cambios permitidos:

- El QR debe conservar tamaño mínimo físico real 22 × 22 mm y margen.
- En 80 mm el ancho útil es reducido; el bloque fiscal va al final, centrado o inferior izquierdo según el modelo handheld, sin romper el contrato del PDF.
- Texto mínimo: tipo de e-CF en palabras, e-NCF, fecha de emisión, Código de Seguridad, Fecha/Hora de Firma Digital y vencimiento de secuencia si aplica.
- La validación de tamaños se hace en puntos/mm con `pnpm test:pdf`, no con capturas de DPI distintos ni `em`.

---

## 8. Flujo de correcciones, anulaciones y contingencia

### 8.1 Correcciones

- Después de remitido a DGII, las correcciones se hacen con `E34` o `E33`, referenciando el e-CF/NCF modificado y el código correcto.
- Código de modificación `1`: anula el comprobante modificado; `2`: corrige texto; `3`: corrige montos; `4`: reemplaza NCF emitido en contingencia.
- Si la NC se emite después de 30 días del nacimiento de la obligación, las devoluciones de bienes gravados pueden restituir precio sin ITBIS conforme Reglamento 293-11; esto debe validarlo Contable en cada flujo.

### 8.2 Anulación de secuencias no usadas (`ANECF`)

`ANECF` sirve para informar secuencias autorizadas que no serán utilizadas, por ejemplo una serie generada y nunca enviada. No es un botón para “borrar” facturas aceptadas. Una factura aceptada solo se afecta mediante nota de crédito/débito.

### 8.3 Contingencia

Hay tres escenarios distintos:

1. **Falta de conectividad del emisor:** el sistema sí puede generar y firmar e-CF, pero no enviarlos. Se conservan firmados, se entrega RI con leyenda de contingencia y se remiten en un plazo no mayor de 72 horas al restablecerse la conexión.
2. **Imposibilidad técnica para emitir e-CF:** no se puede generar el e-CF. Se notifica entrada en contingencia en OFV (`Facturación Electrónica > Contingencia FE`), se usan comprobantes fiscales no electrónicos autorizados vigentes, no más de 15 días calendario; al salir se notifica y se emiten e-CF de reemplazo referenciando el NCF no electrónico con `CodigoModificacion=4`. Los e-CF de reemplazo se envían solo a DGII, no al receptor.
3. **Indisponibilidad DGII:** se continúa generando e-CF, se almacenan pendientes y se remiten al restablecerse, siguiendo avisos/mantenimientos DGII.

---

## 9. Estrategia de pruebas en 3 niveles

### Nivel 1 — local automatizado

Obligatorio antes de tocar TesteCF. Corre en Vitest y pgTAP; no llama a DGII.

1. Validación de esquema: cada XML generado pasa el XSD oficial de su tipo antes de firmarse.
2. Firma real XMLDSig con certificado de prueba generado en test, nunca un certificado productivo.
3. Verificación criptográfica independiente: canonicalización, digest, RSA-SHA256, cadena de firma y detección de mutación de un solo carácter.
4. Cálculo de `CodigoSeguridad` y URLs QR/QR FC con encoding exacto.
5. Redondeo/cuadratura en centavos.
6. Persistencia cifrada AES-256-GCM y ausencia de secretos en salidas/logs.
7. Máquina de estados ante timeout, duplicado, rechazo y `secuenciaUtilizada`.

Set propio de **9 casos de simulación** (cobertura mínima local; no sustituye el set oficial de CerteCF):

| # | Caso | Qué prueba |
| --- | --- | --- |
| 1 | `E31` simple | Una línea gravada ITBIS 18%, contado, QR completo |
| 2 | `E31` complejo | Varias líneas, exenta + gravada, descuento/recargo, formas de pago mixtas y cuadratura exacta |
| 3 | `E32` menor a 250k | Genera e-CF completo firmado, copia código en `RFCE`, firma RFCE y QR FC |
| 4 | `E32` en el límite | RD$249,999.99 va por RFCE; RD$250,000.00 exactos va por Recepción e-CF completo |
| 5 | `E34` | Nota de crédito referenciando e-CF, códigos 1/2/3, regla de ITBIS según fecha |
| 6 | `E33` | Nota de débito referenciando una factura válida |
| 7 | `E41` + `E43` | Compras a no contribuyente y gasto menor, incluyendo datos de retención cuando aplique |
| 8 | `E44` + `E45` | Régimen especial y gubernamental/exenciones o campos condicionales de cada tipo |
| 9 | `E46` + `E47` | Exportación y pago al exterior, incluyendo moneda/identificación extranjera cuando aplique |

### Nivel 2 — TesteCF DGII (Pre-certificación)

- Envío real contra `TesteCF` con el `.p12` real del representante o certificado de pruebas autorizado por DGII, según el portal permita.
- No tiene impacto fiscal productivo.
- Se prueban autenticación, e-CF completo, RFCE, consulta resultado, directorio de prueba, aprobación comercial, comunicación emisor-receptor y anulación.
- Se registra evidencia: request id interno, TrackId, estado, fecha y hash. Nunca XML secreto ni llaves en reportes.
- TesteCF es de integración; pasar TesteCF **no** significa estar certificado.

### Nivel 3 — CerteCF DGII (Certificación oficial)

Seguir el portal oficial:

1. Postulación firmada.
2. Descarga del set de datos oficial.
3. Generación/envío de XML de datos.
4. Aprobaciones/rechazos comerciales.
5. Pruebas de simulación con operaciones representativas.
6. Envío de representaciones impresas PDF y validación.
7. Registro/actualización de URLs de prueba.
8. Pruebas de comunicación: recepción de e-CF y acuses, recepción de aprobaciones comerciales.
9. Registro de URLs de producción.
10. Declaración jurada firmada.
11. Verificación de estatus del contribuyente y autorización final.

Criterio de salida: la DGII habilita el menú productivo y Medoxigas consta como emisor electrónico autorizado para Desarrollo Propio. Solo entonces se prepara la ventana de corte.

---

## 10. Plan de implementación por fases

1. **Fase 0 — fundaciones:** tablas/RPC/RLS, cifrado de certificado, XSD/versionado, parser/builder XML, firma y verificación local. Sin UI fiscal productiva.
2. **Fase 1 — emisión ventas núcleo:** `E31`, `E32`/RFCE, estados, QR Carta y ticket, envío/polling, reintentos seguros.
3. **Fase 2 — notas y contingencia:** `E33`, `E34`, referencias, anulación de rangos, envío diferido y reemplazos.
4. **Fase 3 — receptor electrónico:** endpoints propios, ARECF/ACECF, buzón de proveedores y vínculo con compras.
5. **Fase 4 — compras/especiales:** `E41`, `E43`, `E47` y luego `E44`, `E45`, `E46` según necesidad real.
6. **Fase 5 — migración operativa:** seguir `docs/migracion-ecf-desde-alegra.md`.

No se implementa producción fiscal sin: certificación DGII aprobada, aprobación de Waldy/Contable, migración de secuencias verificada y respaldo completo.

---

## 11. Riesgos y candados

| Riesgo | Candado obligatorio |
| --- | --- |
| XML con orden incorrecto | Test XSD por tipo + snapshot de orden de tags raíz/encabezado |
| Tags vacíos | Test que recorre el XML y rechaza nodos de contenido vacío no permitidos |
| Firma incompatible | Verificación criptográfica independiente + envío real TesteCF |
| Secretos en logs/UI | Test estático de serialización + revisión de logs; RLS sin SELECT al blob |
| Reenvío duplicado | Test de timeout que exige consulta/reconciliación antes de rePOST |
| Secuencia incorrecta por formato de 8 dígitos | Test exacto `^E\d{2}\d{10}$` y separación de series B/E |
| Ticket con QR menor a 22 mm | Prueba PDF real en `pnpm test:pdf` midiendo pt/mm |
| Confundir acuse con aceptación comercial | Modelo separado `ARECF`/`ACECF` y pruebas de estado |
| Enviar `E32 < 250k` al endpoint equivocado | Test de router por monto límite 249,999.99/250,000.00 |
| Cambios DGII no detectados | XSD/versionado con hash + fecha de revisión documentada antes de cada certificación |

---

## 12. Fuentes oficiales consultadas

- Documentación sobre e-CF DGII: <https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/documentacionSobreE-CF.aspx>
- Informe Técnico e-CF v1.0: <https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Informe%20y%20Descripci%C3%B3n%20T%C3%A9cnica/Informe%20T%C3%A9cnico%20e-CF%20v1.0.pdf>
- Descripción Técnica Servicios DGII: <https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Informe%20y%20Descripci%C3%B3n%20T%C3%A9cnica/Descripcion%20Tecnica%20Servicios%20DGII.pdf>
- Descripción Técnica Servicios Emisores Electrónicos: <https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Informe%20y%20Descripci%C3%B3n%20T%C3%A9cnica/Descripcion%20Tecnica%20Emisores%20Electronicos.pdf>
- Formato Comprobante Fiscal Electrónico (e-CF) v1.0 y XSD v1.0 por tipo: sección “Formatos XML” y “Documentación Técnica (XSD)” del índice anterior.
- Representación Impresa (Modelos ilustrativos): <https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Informe%20y%20Descripci%C3%B3n%20T%C3%A9cnica/Representaci%C3%B3n%20Impresa%20(Modelos%20ilustrativos).pdf>
- Proceso de Certificación para ser Emisor Electrónico: <https://www.dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Documentaciones%20Proceso%20de%20Certificaci%C3%B3n%20FE/Proceso%20de%20Certificacion%20para%20ser%20Emisor%20Electronico.pdf>
- Ley 32-23: <https://dgii.gov.do/transparencia/baseLegal/Documents/Leyes/Ley%2032-23.pdf>
- Decreto 587-24: <https://dgii.gov.do/transparencia/baseLegal/Documents/Decretos/Decreto%20587-24.pdf>
- Norma General 01-2020: <https://dgii.gov.do/legislacion/normasGenerales/Documents/NG%20sobre%20Comprobantes%20Fiscales/Norma01-20.pdf>
- Preguntas frecuentes técnicas y generales e-CF: enlazadas desde “Documentación sobre e-CF”.

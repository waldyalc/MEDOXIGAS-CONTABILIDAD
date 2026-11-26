# Investigación técnica consolidada — Facturación Electrónica e-CF DGII (2025–2026)

Referencia permanente del proyecto **Medoxigas Contabilidad** (MEDOXIGAS ALC, SRL y OXYMAT / Ferretería, República Dominicana) basada en la **Ley 32-23**, el **Decreto núm. 587-24**, la consulta oficial **CA5032**, el **Informe Técnico e-CF v1.0 (actualización 2026)** y la **Descripción Técnica de Servicios DGII (2026)**.

> **Estado actual de las empresas (confirmado por Waldy, 26-11-2026):**
> Tanto **MEDOXIGAS ALC, SRL** como **OXYMAT (Ferretería)** ya son **facturadores electrónicos activos** ante la DGII (hoy emiten desde Alegra) y ya cuentan con su **certificado digital `.p12`/`.pfx`** vigente.
> **Regla operativa:** no se toca la producción actual de Alegra mientras construimos, probamos en `TesteCF` y certificamos en `CerteCF`.

---

## 1. Migración desde Alegra (Proveedor) a Desarrollo Propio sin apagar la operación

- **Trámite oficial (consulta DGII `CA5032`):** para migrar de un Proveedor de Servicios Autorizado (Alegra) a un sistema de **Desarrollo Propio**, se crea una **nueva postulación** en el Portal de Certificación de Facturación Electrónica (con las credenciales de Usuario Administrador e-CF), eligiendo **Emisor Electrónico → Tipo de Software: Desarrollo Interno** y agotando los **14 pasos** de certificación (pruebas de datos, simulación, representaciones impresas en PDF y pruebas de comunicación).
- **Operación paralela sin riesgo:** Alegra puede seguir emitiendo en producción (`ecf.dgii.gov.do/ecf`) durante todo el desarrollo y las pruebas en `TesteCF` y `CerteCF`. Los ambientes de prueba están aislados y no afectan secuencias ni el estatus productivo.
- **Certificado digital (`.p12`/`.pfx`):** se **reutiliza el mismo archivo actual** (pertenece al RNC / representante o delegado autorizado en la OFV, NO a Alegra), siempre que esté vigente y emitido por entidad acreditada por INDOTEL (Avansi, Cámara TIC, etc.).
- **Continuidad de secuencias `e-NCF` (`E31`–`E47`):** las secuencias pertenecen al contribuyente, **NO a Alegra**. No se anulan ni se solicitan nuevas mientras tengan disponibilidad. El día del corte:
  1. Pausar la emisión en Alegra.
  2. Consultar el **último e-NCF aceptado por la DGII** por cada tipo (`E31`, `E32`, `E33`, `E34`, `E41`, `E43`, `E44`, `E45`, etc.).
  3. Configurar cada numeración en Medoxigas Contabilidad en **`último_aceptado + 1`**.
- **Actualización del Directorio FE (URLs de Recepción):**
  1. Desplegar los endpoints productivos en Vercel **antes** de firmar la Declaración Jurada (Paso 14).
  2. Al aprobarse la Declaración Jurada, las URLs registradas en el Paso 12 se sincronizan automáticamente a `OFV → Facturación Electrónica → Mantenimiento Directorio FE`.
  3. Verificar en la OFV que las nuevas URLs quedaron activas en el momento del corte.
  4. Revisar en paralelo los e-CF recibidos en Alegra durante **24–48 horas** después del corte por si algún proveedor tenía en caché la URL anterior del directorio.

---

## 2. Dos empresas (Medoxigas + Oxymat) en el mismo dominio de Vercel

Confirmado bajo la **Ley 32-23** y el **Decreto núm. 587-24**:

- **Permitido por la DGII:** dos empresas vinculadas / del mismo grupo empresarial pueden compartir la misma plataforma de desarrollo propio alojada en Vercel sin acreditarse como Proveedor de Servicios Autorizado (esa acreditación solo aplica si comercializas o prestas el servicio a terceros fuera de tu grupo).
- **URL base diferenciada por RNC:** se registra en el Directorio FE una subruta por cada RNC:
  - Medoxigas: `https://<tu-dominio>/api/ecf/{rnc_medoxigas}`
  - Oxymat: `https://<tu-dominio>/api/ecf/{rnc_oxymat}`
  - La DGII y los emisores externos concatenan automáticamente `/fe/recepcion/api/ecf`, `/fe/aprobacioncomercial/api/ecf` y `/fe/autenticacion/api/semilla`.
- **Aislamiento de certificados:** cada `{rnc}` carga exclusivamente su propio `.p12` cifrado para firmar sus semillas y acuses de recibo (`ARECF`).
- **Certificación independiente:** cada RNC completa por separado su postulación, set de pruebas y Declaración Jurada en `CerteCF`.

---

## 3. Endpoints oficiales de la DGII (2025–2026)

Ambientes: `{ambiente}` = `testecf` (Pre-Certificación) | `certecf` (Certificación) | `ecf` (Producción).

| Servicio | Método | URL Completa | Disponibilidad |
| --- | --- | --- | --- |
| Obtener Semilla | `GET` | `https://ecf.dgii.gov.do/{ambiente}/autenticacion/api/autenticacion/semilla` | Todos |
| Validar Semilla (Token) | `POST` | `https://ecf.dgii.gov.do/{ambiente}/autenticacion/api/autenticacion/validarsemilla` | Todos |
| Recepción e-CF | `POST` | `https://ecf.dgii.gov.do/{ambiente}/recepcion/api/facturaselectronicas` | Todos |
| Recepción RFCE (`< RD$250k`) | `POST` | `https://fc.dgii.gov.do/{ambiente}/recepcionfc/api/recepcion/ecf` | Todos |
| Consulta RFCE | `GET` | `https://fc.dgii.gov.do/{ambiente}/consultarfce/api/Consultas/Consulta?RNC_Emisor={rnc}&ENCF={encf}&Cod_Seguridad_eCF={cod}` | Todos (en `certecf` desde ene 2026) |
| Consulta Resultado (`TrackId`) | `GET` | `https://ecf.dgii.gov.do/{ambiente}/consultaresultado/api/consultas/estado?trackid={trackid}` | Todos |
| Consulta Estado e-CF | `GET` | `https://ecf.dgii.gov.do/{ambiente}/consultaestado/api/consultas/estado?rncemisor={rnc}&ncfelectronico={encf}&rnccomprador={rncC}&codigoseguridad={cod}` | `testecf`, `ecf` |
| Consulta TrackIds | `GET` | `https://ecf.dgii.gov.do/{ambiente}/consultatrackids/api/trackids/consulta?rncemisor={rnc}&encf={encf}` | `testecf`, `ecf` |
| Recepción Aprobación Comercial | `POST` | `https://ecf.dgii.gov.do/{ambiente}/aprobacioncomercial/api/aprobacioncomercial` | Todos |
| Anulación de Rangos | `POST` | `https://ecf.dgii.gov.do/{ambiente}/anulacionrangos/api/operaciones/anularrango` | `testecf`, `ecf` |
| Directorio (Listado) | `GET` | `https://ecf.dgii.gov.do/{ambiente}/consultadirectorio/api/consultas/listado` | `testecf`, `ecf` |
| Directorio (Por RNC) | `GET` | `https://ecf.dgii.gov.do/{ambiente}/consultadirectorio/api/consultas/obtenerdirectorioporrnc?RNC={rnc}` | `testecf`, `ecf` |

### Contrato HTTP `multipart/form-data`
- **Campo obligatorio del archivo:** exactamente `xml` (MIME `text/xml` o `application/xml`).
- **Headers:** `Authorization: Bearer {token}` (vigencia 1 hora), `Accept: application/json`, `Content-Type: multipart/form-data`.
- **Nombres de archivo obligatorios:**
  - e-CF y RFCE: `<RNCEmisor><eNCF>.xml` (ej. `101672919E310000000001.xml`).
  - Aprobación Comercial (`ACECF`) y Acuse de Recibo (`ARECF`): `<RNCComprador><eNCF>.xml`.

---

## 4. Reglas estrictas de XML (XSD v1.0) y Firma Digital XMLDSig

Todos los XSD vigentes están en versión **`1.0`** (`E31`–`E47`, `RFCE 32`, `ARECF`, `ANECF`, `ACECF`, `Semilla`).

### Parámetros obligatorios de XMLDSig
- **Canonicalización (`CanonicalizationMethod`):** Canonical XML 1.0 **inclusivo sin comentarios** (`http://www.w3.org/TR/2001/REC-xml-c14n-20010315`). **Nunca** usar Exclusive C14N (`xml-exc-c14n#`).
- **Firma (`SignatureMethod`):** `http://www.w3.org/2001/04/xmldsig-more#rsa-sha256`.
- **Resumen (`DigestMethod`):** `http://www.w3.org/2001/04/xmlenc#sha256`.
- **Transformación (`Transform`):** `http://www.w3.org/2000/09/xmldsig#enveloped-signature` con `<Reference URI="">` (URI vacío).
- **Ubicación de `<Signature>`:** último hijo directo del nodo raíz (`</ECF>`, `</RFCE>`, `</ARECF>`, `</ACECF>`, `</ANECF>`, `</SemillaModel>`).
- **XML compacto (`preserveWhiteSpace = false`):** eliminar saltos de línea e indentación entre etiquetas antes de canonicalizar y firmar; nunca reformatear después de firmar.
- **Cero etiquetas vacías:** cualquier campo opcional o condicional sin valor se omite por completo (nunca `<TelefonoEmisor/>` ni `<TelefonoEmisor></TelefonoEmisor>`).
- **Escape estricto ALFANUM:** escapar `&`, `<`, `>`, `"`, `'`, `©`, `€`, `®`.
- **`<KeyInfo>`:** incluir únicamente `<X509Data><X509Certificate>...</X509Certificate></X509Data>` (sin `<KeyValue>` ni `<RSAKeyValue>`).

---

## 5. Endpoints obligatorios como Receptor Electrónico (Vercel HTTPS)

Todo emisor electrónico es obligatoriamente receptor electrónico sobre HTTPS puerto 443:

1. `GET {base_url}/fe/autenticacion/api/semilla` → devuelve XML `<SemillaModel>` con `<valor>` y `<fecha>`.
2. `POST {base_url}/fe/autenticacion/api/validacioncertificado` → recibe `multipart/form-data` (`xml`: semilla firmada) y retorna JSON `{"token", "expira", "expedido"}`.
3. `POST {base_url}/fe/recepcion/api/ecf` (**obligatorio**) → recibe `multipart/form-data` (`xml`: e-CF) y responde **síncronamente** con `Content-Type: application/xml` devolviendo un **`<ARECF>` firmado digitalmente** con el `.p12` del RNC (`Estado = 0` Recibido o `Estado = 1` No Recibido con `CodigoMotivoNoRecibido` 1..4).
4. `POST {base_url}/fe/aprobacioncomercial/api/ecf` (**obligatorio**) → recibe `multipart/form-data` (`xml`: `<ACECF>`) y responde `200 OK` o `400 Bad Request`.

> **Nota Vercel:** leer el archivo `xml` en bytes crudos sin recodificar ni reformatear para no alterar el hash de la firma del emisor al validarla. Considerar límite de 4.5 MB de payload en Vercel Functions.

---

## 6. Tolerancias de redondeo y contingencia (Decreto 587-24 / Informe Técnico 2026)

- **Redondeo:** montos monetarios globales y subtotales a **2 decimales** (precios unitarios admiten hasta **4 decimales** en XML).
- **Tolerancia por línea:** **±RD$1.00** entre `CantidadItem * PrecioUnitarioItem - DescuentoMonto + RecargoMonto` y `<MontoItem>`.
- **Tolerancia global:** suma de las tolerancias por línea (`±RD$1.00 × cantidad de líneas`).
- **Contingencia por falla de conectividad (sin internet):**
  - Se permite emitir e-CF offline y transmitirlos a la DGII en un plazo de hasta **72 horas** al restablecer el enlace.
  - Estrategia Medoxigas POS: el `.p12` nunca sale del servidor cifrado; en caja sin internet se reserva el `e-NCF` consecutivo en IndexedDB, se imprime el ticket de contingencia y, al volver la red (dentro de 72 h), el servidor firma y transmite automáticamente.
- **Contingencia por falla técnica del sistema:**
  - Se permite emitir NCF tradicionales **Serie B (`B01`/`B02`)** hasta por **15 días** y luego reemplazarlos enviando e-CF con `CodigoModificacion = 4` referenciando el NCF tradicional emitido.

---

## 7. Código de Seguridad, QR oficial y Representación Impresa (RI)

### Cómo se genera CON internet (flujo normal en < 1 segundo)
1. Se guarda la factura y el servidor genera el **XML compacto** con `<FechaHoraFirma>` (`DD-MM-YYYY HH:mm:ss`).
2. El servidor firma el XML con el `.p12` (XMLDSig RSA-SHA256) → genera `<SignatureValue>`.
3. **Código de Seguridad:** primeros **6 caracteres** literales de `<SignatureValue>` (ej. `kX9+a2`).
4. **URL del Código QR** (con codificación porcentual obligatoria en `CodigoSeguridad`: `+` → `%2B`, `/` → `%2F`, `=` → `%3D`, espacio → `%20`; debajo del QR se imprime el texto literal):
   - **e-CF estándar (incluye `E32 ≥ RD$250,000`):**
     ```text
     https://ecf.dgii.gov.do/{ambiente}/ConsultaTimbre?RncEmisor={rncE}&RncComprador={rncC}&ENCF={encf}&FechaEmision={dd-MM-yyyy}&MontoTotal={0.00}&FechaFirma={dd-MM-yyyy}%20{HH:mm:ss}&CodigoSeguridad={cod6_encoded}
     ```
   - **RFCE (`E32 < RD$250,000`):** el código de seguridad sale del `E32` completo firmado (que se archiva 10 años), y a la DGII se le envía el `<RFCE>` a `fc.dgii.gov.do`:
     ```text
     https://fc.dgii.gov.do/{ambiente}/ConsultaTimbreFC?RncEmisor={rncE}&ENCF={encf}&MontoTotal={0.00}&CodigoSeguridad={cod6_encoded}
     ```
5. **Especificaciones físicas del PDF (RI):** QR **Versión 8**, tamaño mínimo **22 × 22 mm**, margen silencioso **3 mm**, parte inferior izquierda a mínimo **2 cm** del borde de la hoja.
6. El servidor transmite el XML firmado a la DGII (`Recepcion` o `RecepcionFC`), guarda el `TrackId` y actualiza el estado (`ConsultaResultado`) a `Aceptado`.

---
title: "Bitácora Maestra e-CF DGII — Medoxigas Contabilidad & OXYMAT SRL"
alias:
  - Bitácora e-CF DGII
  - Runbook Facturación Electrónica RD
tags:
  - dgii
  - e-cf
  - facturacion-electronica
  - oxymat
  - medoxigas
  - runbook
  - errores-y-soluciones
created: 2026-11-27
updated: 2026-11-28
estado_actual: "Paso 1 Aprobado ✅ · Paso 2 Aprobado ✅ · Paso 3 (ACECF) Aprobado ✅ · Paso 4 (Simulación 25/25) Aprobado ✅ · Listo para Paso 5 (RI PDF)"
piloto: "OXYMAT, SRL (RNC 131488791)"
empresa_principal: "MEDOXIGAS ALC, SRL (RNC 130893489)"
---

# Bitácora Maestra — Facturación Electrónica e-CF (DGII RD)

> [!IMPORTANT] Propósito de este documento (Obsidian + respaldo Google Drive)
> Registro vivo, auditable y **100 % libre de secretos** de toda la arquitectura, configuración, hilos de trabajo, decisiones técnicas y **cada error real encontrado con la DGII** (causa raíz, solución aplicada, commit y candado automático para que nunca se repita).
>
> **Regla de seguridad:** este archivo **NUNCA** debe contener contraseñas de `.p12`, claves privadas, `ECF_ENCRYPTION_KEY`, tokens de Vercel/Supabase ni archivos `.env*`.

---

## 1. Mapa de empresas, entornos y arquitectura

### Empresas del grupo (Desarrollo Propio compartido)
- **Empresa piloto (certificando primero):** `OXYMAT, SRL` — RNC `131488791`
  - Sucursal: `PRINCIPAL` · Dirección fiscal oficial (Alegra / DGII): `APTO, No. 101, APTO. RES DORADO III, DORADO II, Santo Domingo Norte, Santo Domingo` (`Municipio: 320301`, `Provincia: 320000`)
  - Correo emisor oficial: `oxymatsrl@gmail.com` · Sin `<TablaTelefonoEmisor>` (opcional en XSD, idéntico al XML real de Alegra).
  - Certificado digital: `.p12` real (Viafirma, persona física representante autorizado en OFV, vigente hasta `23 abr 2027`), almacenado **cifrado con AES-256-GCM** en `public.ecf_config` de Supabase.
- **Empresa principal (certificará al terminar OXYMAT 100 % en verde):** `MEDOXIGAS ALC, SRL` — RNC `130893489`.
- **Operación actual (Alegra):** sigue facturando en producción **sin interrupción** mientras completamos la certificación en `CerteCF`. Ninguna prueba en `TesteCF` o `CerteCF` toca secuencias reales ni la producción en Alegra.

### Los 3 ambientes oficiales de la DGII
| Ambiente | Base URL DGII | Para qué sirve | Valor fiscal |
| :--- | :--- | :--- | :--- |
| **`TesteCF`** | `https://ecf.dgii.gov.do/testecf/...` | Laboratorio libre de ensayos. Valida formato básico pero **NO** cuenta para los contadores de certificación. | Ninguno |
| **`CerteCF`** | `https://ecf.dgii.gov.do/certecf/...` | **Examen oficial de certificación** (14 pasos). Más estricto que `TesteCF` (compara literales exactos del Excel oficial). | Ninguno |
| **`eCF` (Producción)** | `https://ecf.dgii.gov.do/ecf/...` | Facturación fiscal real. **Bloqueado por código** (`confirmarProduccion: true` obligatorio; los runners de pruebas nunca pueden apuntar aquí). | Real (DGII) |

### Infraestructura propia del sistema
- **Repositorio:** `waldyalc/MEDOXIGAS-CONTABILIDAD`
  - `main` → Producción en Vercel (`https://ferreteria.medoxigas.com` y `https://medoxigas-contabilidad.vercel.app`).
  - `feat/pos-alegra-exacto` → Rama activa de desarrollo y preview oficial único del VPS (`https://medoxigas-agentes.tail25e53a.ts.net`, puerto `3010`, servicio `medoxigas-preview.service`).
- **Base de datos (Supabase `ljfdhrnvlsfaweuvnqxz`):**
  - `public.ecf_config`: configuración por RNC, metadatos públicos del certificado y secretos cifrados (`cert_cifrado`, `cert_pass_cifrada` protegidos sin `SELECT` directo; solo lectura vía RPC `obtener_ecf_secreto_firma` para `admin`/`contador` y escritura vía `guardar_ecf_certificado` solo `admin`).
  - `public.ecf_envios`: trazabilidad de todos los XML enviados (`unique (rnc_emisor, ambiente, encf)`), `track_id`, `codigo_seguridad`, `url_qr`, `xml_firmado`, `xml_rfce`, `respuesta_dgii`, `secuencia_utilizada`.
  - `public.ecf_recibidos`: bandeja de e-CF recibidos como receptor electrónico (`ARECF` / `ACECF`).
  - Migraciones aplicadas:
    - `supabase/migrations/20261126160051_ecf_dgii.sql`
    - `supabase/migrations/20261127131500_ecf_config_rpc_certificado.sql` (`64/64` pruebas pgTAP en verde).
- **URLs propias como Receptor Electrónico (multi-RNC):**
  - Prefijo OXYMAT: `https://ferreteria.medoxigas.com/api/ecf/131488791`
  - Semilla: `GET /api/ecf/{rnc}/fe/autenticacion/api/semilla`
  - Validación certificado: `POST /api/ecf/{rnc}/fe/autenticacion/api/validacioncertificado`
  - Recepción e-CF (`ARECF`): `POST /api/ecf/{rnc}/fe/recepcion/api/ecf`
  - Aprobación comercial (`ACECF`): `POST /api/ecf/{rnc}/fe/aprobacioncomercial/api/ecf`
- **Archivos de referencia locales en el VPS (FUERA del repo — nunca se commitean):**
  - 15 XSD oficiales DGII v1.0: `/root/referencias/ecf-xsd/`
  - Excel oficial Paso 2 (25 `ECF` + 4 `RFCE`): `/root/referencias/ecf-oxymat/131488791-27112026113533.xlsx`
  - 4 XML íntegros `< RD$250,000` aprobados en Paso 2: `/root/referencias/ecf-oxymat/xml-menor-250mil/`
  - Excel oficial Paso 3 (11 `ACECF`): `/root/referencias/ecf-oxymat/131488791-27112026175301.xlsx`
  - 25 XML firmados + 4 RFCE + manifiesto QR aprobados en Paso 4 (`secuenciaBase=1201`): `/root/referencias/ecf-oxymat/paso4-simulacion-1201/`

---

## 2. Índice cronológico de hilos de trabajo (T3 Code)

| # | Fecha | Hilo (T3 Code) | Objetivo y resultado | Commits clave |
| :---: | :--- | :--- | :--- | :--- |
| 1 | 26–27 Nov 2026 | `o` (`6d30d5e1-7db8-4812-97bb-3931c8c38b65`) | Investigación DGII 2026, arquitectura multi-RNC, migraciones Supabase + RPC custodia `.p12`, motor XML/XMLDSig, portal `/dashboard/configuracion/facturacion-electronica`, firma de postulación y **Paso 1 DGII APROBADO EN VERDE**. | `ab5076e`, `66a2ba1`, `9cb3d62`, `1d4310f`, `1f449d4`, `40338cb`, `89d34b9`, `a33e9a0`, `4a80f94`, `5eb1c17` |
| 2 | 27 Nov 2026 | `Start OXYMAT CerteCF Step 2` (`b64e804c-7332-43b2-8ff1-c17831a3988f`) | Alineación 1:1 con los 15 XSD oficiales y 127 columnas del Excel DGII, orden topológico, polling `ConsultaResultado`, preservación literal de 2,360/2,360 celdas, idempotencia de casos ya aceptados y **Paso 2 DGII APROBADO EN VERDE (`21/21` + `4/4` + `4/4`)**. | `19f44ff`, `c8933cd`, `f625ead`, `6150e91`, `ce32c91`, `e6ab7db`, `4423cce`, `e138094`, `2f50643`, `19a8296`, `45fa8e1` |
| 3 | 27–28 Nov 2026 | `DGII Step 3 ACECF Approval Tests` (`b1be4e35-00a5-43d3-b81b-21fc541cc508`) | Alineación `ACECF` contra `ACECF_v.1.0.xsd`, parser OOXML sin deriva de 18 dígitos, runner API idempotente + UI Paso 3, persistencia de ambiente (`CerteCF` vs `TesteCF`), bitácora Obsidian y **Paso 3 DGII APROBADO EN VERDE A LA PRIMERA (11/11)**. | `5114166`, `4b06891`, `9eb0c69`, `cd29eaa`, `80e5c42` |
| 4 | 28 Nov 2026 | `Paso 4: Pruebas de Simulación e-CF` (`fee79d45-73b6-421c-9b04-c99238584166`) | Generador oficial 25 casos (orden 18/3/4), runner API idempotente con candado `detenidoPorRechazo`, calco `<Emisor>` 1:1 con XML Alegra (`ERR-012`), reintentos red RFCE + candado descarga `<250Mil` (`ERR-013`), respaldo 25 XML+QR en `/root/referencias/ecf-oxymat/paso4-simulacion-1201/` y **Paso 4 DGII APROBADO EN VERDE (`25/25` + `4/4` `< 250Mil`)**. | `10c0763`, `53cd47a`, `c666558`, `25de738`, `5c86962` |

---

## 3. Reglas técnicas innegociables de la DGII (lo que aprendimos)

> [!TIP] Lista de verificación obligatoria antes de cualquier cambio en `src/lib/ecf/`
> 1. **Firma XMLDSig compatible con `.NET SignedXml` de DGII:**
>    - `CanonicalizationMethod`: **Canonical XML 1.0 inclusivo sin comentarios** (`http://www.w3.org/TR/2001/REC-xml-c14n-20010315`). **Prohibido** Exclusive C14N (`xml-exc-c14n#`).
>    - `SignatureMethod`: `http://www.w3.org/2001/04/xmldsig-more#rsa-sha256`.
>    - `DigestMethod`: `http://www.w3.org/2001/04/xmlenc#sha256`.
>    - `Transform`: `http://www.w3.org/2000/09/xmldsig#enveloped-signature` con `<Reference URI="">`.
>    - `<KeyInfo>`: **solo** `<X509Data><X509Certificate>...</X509Certificate></X509Data>` (sin `<KeyValue>` ni `<RSAKeyValue>`).
>    - `<Signature>` siempre como **último hijo directo** del elemento raíz.
>    - Al calcular `DigestValue`: compactar espacios/indentación entre etiquetas (`PreserveWhitespace = false`), pero si se firma un XML generado por la DGII (como el de postulación), **dejar intactos los `\r\n  ` del archivo de salida**.
> 2. **Cero etiquetas vacías:** nunca emitir `<Tag/>` ni `<Tag></Tag>`; si un campo opcional no tiene valor (o viene `#e` en el Excel), omitirlo por completo.
> 3. **Nombres de archivo oficiales en `multipart/form-data` (campo `xml`):**
>    - `e-CF` y `RFCE`: `<RNCEmisor><eNCF>.xml` (ej. `131488791E310000000007.xml`).
>    - `ACECF` (Aprobación Comercial) y `ARECF` (Acuse de Recibo): `<RNCComprador><eNCF>.xml` (ej. `131488791E310000000007.xml` — sin guiones bajos, usando el RNC del comprador que firma).
> 4. **Zona horaria obligatoria:** `America/Santo_Domingo` (`UTC-4`, formato `DD-MM-YYYY HH:mm:ss`) en `FechaHoraFirma` y fechas generadas; nunca usar UTC del VPS.
> 5. **Orden de envío obligatorio (dependencias):**
>    - Toda factura base (`E31`, `E32`, `E44`, etc.) **debe** ser aceptada antes de enviar sus Notas de Débito (`E33`) o Notas de Crédito (`E34`) referenciadas por `NCFModificado`.
> 6. **Facturas de Consumo `< RD$250,000` (`E32` + `RFCE`):**
>    - Primero se firma el `<ECF>` completo (y se extrae `CodigoSeguridad` = primeros 6 caracteres de `<SignatureValue>`).
>    - Ese mismo `CodigoSeguridad` se coloca en `<CodigoSeguridadeCF>` del `<RFCE>`, se firma el `<RFCE>` y se envía a `fc.dgii.gov.do/{ambiente}/recepcionfc/api/recepcion/ecf`.
>    - **CRÍTICO:** nunca volver a firmar un `E32 < 250Mil` cuyo `RFCE` ya fue aceptado, o el `CodigoSeguridad` cambiará y el XML íntegro dejará de coincidir con el resumen aceptado por la DGII.
> 7. **Consistencia de decimales según XSD:**
>    - En **`e-CF` (`CerteCF`)**: preservar el texto decimal exacto del Excel oficial (`1500.0000`, `57.0000`, `1`, `24`, `5.00`, `1.00`, `10.00`).
>    - En **`ACECF` (`ACECF_v.1.0.xsd`)**: `Decimal18D2Validation` exige `<xs:pattern value='[0-9]+(\.[0-9]{2})'/>` (**exactamente 2 decimales obligatorios**; `228460.5` debe enviarse `228460.50`, `25000000` debe enviarse `25000000.00`).

---

## 4. Registro completo de errores, causas raíz y soluciones

### ERR-001 — Error en estructura de URL de Autenticación durante Postulación (Paso 1)
- **Fecha / Hilo:** 27-11-2026 · Hilo 1 (`o`)
- **Mensaje exacto DGII:**
  > `Se ha identificado un error en la estructura de la Url: https://ferreteria.medoxigas.com/fe/autenticacion/api/[semilla|validacioncertificado] del servicio de Autenticación, favor validar y volver a intentarlo`
- **Causa raíz:** Al presionar `GENERAR ARCHIVO` en el Paso 1, el portal de la DGII realiza una **llamada HTTP en vivo** a la URL de semilla y exige `HTTP 200` con XML `<SemillaModel>`. Aunque probamos primero sin sub-ruta, al inspeccionar una URL real de Alanube confirmamos que la DGII **sí acepta sub-rutas por RNC** (`/api/ecf/131488791`) siempre que el endpoint responda vivo en HTTPS 443.
- **Solución aplicada:** Se publicó en producción Vercel (`https://ferreteria.medoxigas.com`) el endpoint `GET /api/ecf/131488791/fe/autenticacion/api/semilla` respondiendo `HTTP 200` (`application/xml; charset=utf-8`) con `<SemillaModel><valor>...</valor><fecha>...</fecha></SemillaModel>`.
- **Verificación:** Prueba en vivo con `curl` → `HTTP 200`, y el portal DGII generó `202611275421801.xml` en verde.

---

### ERR-002 — Fallo al abrir certificado `.p12` en Vercel Serverless (Paso 1)
- **Fecha / Hilo:** 27-11-2026 · Hilo 1 (`o`)
- **Síntoma:** Al intentar firmar `202611275421801.xml` desde `https://ferreteria.medoxigas.com`, el servidor devolvía error al descifrar/leer el `.p12` aun estando guardado correctamente en `ecf_config`.
- **Causa raíz:** `src/lib/ecf/pkcs12.ts` ejecutaba el binario del sistema `openssl`, el cual **no viene instalado en el runtime Serverless de Vercel** (en el VPS sí existe OpenSSL 3.5.5).
- **Solución temporal:** Ejecutar la firma y los runners de certificación desde el preview único del VPS (`https://medoxigas-agentes.tail25e53a.ts.net`), que comparte la misma base de datos Supabase y sí cuenta con OpenSSL.
- **Solución definitiva pendiente (antes de pasar a `main`):** Pedir aprobación de Waldy para agregar `node-forge` (+ `@types/node-forge`) en `package.json` y reemplazar la dependencia del binario `openssl` por JavaScript puro en `src/lib/ecf/pkcs12.ts`.

---

### ERR-003 — `Error XML. Firma Inválida.` al subir el XML de postulación firmado (Paso 1)
- **Fecha / Hilo:** 27-11-2026 · Hilo 1 (`o`)
- **Mensaje exacto DGII:** `Error XML. Firma Inválida.`
- **Causa raíz:** El archivo `202611275421801.xml` descargado de la DGII venía indentado con `\r\n  `. El servidor `.NET SignedXml` de la DGII carga el XML con `PreserveWhitespace = false` (eliminando espacios/indentación entre etiquetas) antes de calcular el hash SHA-256 (`DigestValue`). Como nuestro firmador hasheaba incluyendo los espacios de indentación, el `DigestValue` no coincidía en `.NET`. Además, se había agregado el sufijo `-firmado` al nombre del archivo.
- **Solución aplicada (`a33e9a0`):**
  - Compactar espacios/indentación entre etiquetas al calcular el `DigestValue` (verificado criptográficamente contra un XML real firmado en `.NET` para la DGII).
  - Conservar el nombre original exacto del archivo (`202611275421801.xml`).
- **Candado:** Tests en `src/lib/ecf/ecf.test.ts` validando C14N inclusivo y compatibilidad `.NET`.

---

### ERR-004 — `Los datos correspondientes al representante fueron alterados en el XML de postulación` (Paso 1)
- **Fecha / Hilo:** 27-11-2026 · Hilo 1 (`o`)
- **Mensaje exacto DGII:**
  > `Los datos correspondientes al representante fueron alterados en el XML de postulación, favor corregir y volver a enviar.`
- **Causa raíz:** Al aplicar el fix de `ERR-003`, se compactó el XML **de salida** eliminando los `\r\n  ` originales del bloque `<Representante>`. Aunque la firma XMLDSig ya era válida, el validador de postulación de la DGII comparaba el contenido del archivo contra el XML emitido originalmente y detectó la pérdida de formato como «alteración».
- **Solución aplicada (`4a80f94`):** En `src/lib/ecf/firma.ts`, mantener el XML original **100 % intacto byte por byte** (con sus `\r\n  ` exactos) e insertar `<Signature>` justo antes de la etiqueta raíz de cierre, aplicando la compactación **solo en memoria** para calcular el `DigestValue` (igual que `.NET SignedXml`).
- **Resultado:** **Paso 1 DGII APROBADO EN VERDE** para OXYMAT SRL (`131488791`).

---

### ERR-005 — Brecha inicial entre el motor e-CF y los 15 XSD / 127 columnas del Excel oficial (Paso 2)
- **Fecha / Hilo:** 27-11-2026 · Hilo 2 (`Start OXYMAT CerteCF Step 2`)
- **Síntoma (prevenido antes de disparar):** El parser inicial `excel-pruebas.ts` cubría ~33 columnas, pero el Excel oficial de `CerteCF` (`131488791-27112026113533.xlsx`) contiene **127 columnas activas** (25 `ECF` + 4 `RFCE`) abarcando los 10 tipos `E31`–`E47`: formas de pago múltiples, impuestos adicionales/ISC de alcohol, subcantidades, otra moneda, transporte y aduanas (`E46`), pagos al exterior (`E47`), descuentos/recargos globales y por línea, y dependencias `E33`/`E34`.
- **Solución aplicada (`f625ead`, `6150e91`, `ce32c91`, `19f44ff`, `c8933cd`):**
  - Se descargaron los **15 XSD oficiales v1.0** en `/root/referencias/ecf-xsd/` y se alineó 1:1 `tipos.ts`, `xml.ts`, `validador-xsd.ts` y `excel-pruebas.ts`.
  - Se implementó orden topológico (`E32→E33`, `E31→E34`, `E44→E34`), polling acotado en `ConsultaResultado`, `FechaHoraFirma` en zona horaria `America/Santo_Domingo` y descarga de los 4 XML `< 250Mil` como `<RNCEmisor><eNCF>.xml`.
  - Hallazgos atrapados por el Verifier antes de integrar y corregidos en `6150e91`: `MontoPago` obligatorio en `FormaDePago` de `e-CF` (opcional en `RFCE`), variante `E44` en `ImpuestosAdicionales` (sin ISC, exige `OtrosImpuestosAdicionales`), y tope `1..10` en `ANECF`.
- **Candado:** Validación independiente con `xmlschema 3.4.5` (`29/29 válidos`) + test integral en `src/lib/ecf/pkcs12-xsd-excel.test.ts`.

---

### ERR-006 — 3 rechazos en ensayo `TesteCF`: `E41` (`IndicadorMontoGravado`) y `E34`/`E41` (`MontosubRecargo`) (Paso 2)
- **Fecha / Hilo:** 27-11-2026 · Hilo 2 (`Start OXYMAT CerteCF Step 2`)
- **Mensajes exactos DGII (ensayo `TesteCF`, 22/25 pasaron a la primera):**
  1. `E410000000007` y `E410000000008`: `"El campo IndicadorMontoGravado no es válido"`
  2. `E340000000002` (y `E410000000007`): `"El campo MontosubRecargo no es válido"`
- **Causa raíz:**
  1. En `src/lib/ecf/xml.ts` había una condición `tipo !== "41"` que omitía `<IndicadorMontoGravado>0</IndicadorMontoGravado>` en comprobantes `E41`.
  2. El Excel oficial de la DGII tiene un typo en el encabezado: `MontosubRecargo` (con `s` minúscula) en lugar de `MontoSubRecargo`; el fallback en `excel-pruebas.ts` solo se ejecutaba si el arreglo estaba vacío, omitiendo los sub-recargos en varias filas.
- **Solución aplicada (`e6ab7db`):** Emitir `IndicadorMontoGravado` también en `E41` y leer tanto `MontoSubRecargo` como `MontosubRecargo` por índice en cada ítem.
- **Candado:** Auditoría automatizada con `TOTAL MISSING TAGS ACROSS ALL 25 CASES: 0` + aserciones explícitas para `E410000000007` y `E340000000002` en `pkcs12-xsd-excel.test.ts`.

---

### ERR-007 — 20/25 rechazados en el primer envío a `CerteCF` por formato literal decimal (Paso 2)
- **Fecha / Hilo:** 27-11-2026 · Hilo 2 (`Start OXYMAT CerteCF Step 2`)
- **Síntoma:** En `TesteCF` pasaban, pero al disparar en **`CerteCF`**, 20 de los 25 casos fueron rechazados (sin quemar secuencia: `secuenciaUtilizada = false`).
- **Causa raíz:** **`CerteCF` compara el texto decimal exacto de cada celda contra el Excel oficial generado para el contribuyente**, no solo la equivalencia numérica:
  - `PrecioUnitarioItem`: enviamos `1500.00` vs Excel `1500.0000`
  - `TipoCambio`: enviamos `57.00` vs Excel `57.0000`
  - `CantidadItem`: enviamos `1.00` vs Excel `1`
  - `CantidadReferencia`: enviamos `24.00` vs Excel `24`
  - `GradosAlcohol`: enviamos `5` vs Excel `5.00`
  - `SubRecargoPorcentaje` / `SubDescuentoPorcentaje`: enviamos `1` vs Excel `1.00` / `10.00`
  - Los 3 `E33`/`E34` fallaron en cascada porque sus facturas base fallaron por esa misma diferencia literal.
- **Solución aplicada (`4423cce`, `2f50643`):** Preservar el texto literal de los 7 campos numéricos mediante propiedades `*Texto` en `tipos.ts` / `excel-pruebas.ts` / `xml.ts`.
- **Candado:** Test automatizado en `src/lib/ecf/pkcs12-xsd-excel.test.ts` que audita las **2,360/2,360 celdas útiles** de las 25 filas del Excel real con **0 discrepancias** y **29/29 XSD válidos**.

---

### ERR-008 — Riesgo de romper `CodigoSeguridad` de `RFCE` ya aceptados al reintentar el Excel (Paso 2)
- **Fecha / Hilo:** 27-11-2026 · Hilo 2 (`Start OXYMAT CerteCF Step 2`)
- **Riesgo detectado:** Tras un envío parcial donde los 4 `RFCE` (`E32 < 250Mil`) ya habían sido aceptados por `CerteCF`, volver a correr el Excel entero re-firmaba esos 4 `E32` con nueva `FechaHoraFirma`, produciendo un `CodigoSeguridad` distinto al ya registrado en el `RFCE` aceptado por la DGII.
- **Solución aplicada (`e138094`):** En `src/app/api/ecf/pruebas/ejecutar-excel/route.ts`, cargar los registros previos de `ecf_envios` por `(rnc_emisor, ambiente, encf)` y **reutilizar sin re-firmar ni re-enviar** cualquier caso ya en estado `aceptado` o `aceptado_condicional`.
- **Candado:** Tests de idempotencia en `src/app/api/ecf/pruebas/ejecutar-excel/ejecutar-excel.test.ts`.

---

### ERR-009 — Cola lenta en `CerteCF` (`En Proceso` ~4 min) y 5 casos viejos con `secuenciaUtilizada = false` (Paso 2)
- **Fecha / Hilo:** 27-11-2026 · Hilo 2 (`Start OXYMAT CerteCF Step 2`)
- **Síntoma:**
  1. Un envío de 20 casos tardó ~4 minutos y dejó varios en `En Proceso` (`20 × 12.5 s` de polling `8 × 1.5 s`).
  2. Luego de completar los 20 nuevos, el portal DGII marcaba `20/21` Comprobantes y `0/4` Resúmenes (`RFCE`) aunque en nuestra tabla local aparecían `25/25 aceptados`.
- **Causa raíz:**
  1. Saturación momentánea de la cola interna de `CerteCF` de la DGII (no error del sistema). **Regla:** nunca reenviar inmediatamente mientras los `TrackId` siguen `En Proceso`; consultar primero `ConsultaResultado`.
  2. Los 5 casos aceptados en la primera corrida (antes del fix `4423cce`: `E430000000010` + los 4 `RFCE`) llevaban `<CantidadItem>1.00</CantidadItem>` en lugar de `1` y habían quedado con `secuenciaUtilizada = false` en `CerteCF`. Como el sistema los reutilizó como "ya aceptados", no los reenvió con el formato literal corregido.
- **Solución aplicada:** Reenvío limpio de esos 5 casos con `<CantidadItem>1</CantidadItem>` (`E430000000010` + 4 `RFCE`), generando los 4 nuevos XML íntegros `< 250Mil` (`131488791E320000000011.xml`, `...13.xml`, `...14.xml`, `...15.xml`).
- **Resultado:** **Paso 2 DGII APROBADO EN VERDE (`21/21` Comprobantes + `4/4` RFCE + `4/4` `< 250Mil`)**.

---

### ERR-010 — Selector de ambiente volvía a `TesteCF` al recargar + bloqueo de descargas múltiples en Chrome (Paso 2)
- **Fecha / Hilo:** 27-11-2026 · Hilo 2 (`Start OXYMAT CerteCF Step 2`)
- **Síntoma:**
  1. Al recargar `/dashboard/configuracion/facturacion-electronica`, el selector superior regresaba a `TesteCF`, haciendo que el usuario ejecutara por accidente contra `TesteCF` (`22/25` viejo) en vez de `CerteCF`.
  2. El botón «Descargar los 4 XML» disparaba 4 descargas automáticas y Chrome bloqueaba las 3 últimas.
- **Solución:**
  1. En **Paso 3 (Hilo 3 — Ola 1B)**: persistir el ambiente seleccionado (`TesteCF` / `CerteCF`) en `ecf_config` (para `admin`) + `localStorage` (para `contador`/fallback), manteniendo bloqueada la persistencia automática de `Producción`.
  2. Operativo: descargar los XML `< 250Mil` uno por uno desde el botón individual de cada fila.

---

### ERR-011 — Diferencia crítica del XSD `ACECF_v.1.0.xsd`: `MontoTotal` exige 2 decimales obligatorios (Paso 3 — prevenido)
- **Fecha / Hilo:** 27-11-2026 · Hilo 3 (`DGII Step 3 ACECF Approval Tests`)
- **Hallazgo detectado ANTES de enviar a `CerteCF`:**
  - En los XSD de `e-CF`, `Decimal18D2Validation` permite decimales opcionales (`[0-9]+(\.[0-9]{1,2})?`).
  - En **`ACECF_v.1.0.xsd`**, `Decimal18D2Validation` tiene `<xs:pattern value='[0-9]+(\.[0-9]{2})'/>` (**SIN `?`**: exige obligatoriamente `.dd`).
  - El Excel oficial del Paso 3 (`131488791-27112026175301.xlsx`, hoja `ACEECF_Generadas`, 11 filas) guarda `MontoTotal` en formato General de Excel (`228460.5`, `25000000`, `400000`), lo cual **falla** el XSD si se emite crudo y **valida 11/11** al normalizar a 2 decimales (`228460.50`, `25000000.00`, `400000.00`).
  - Además, `ACECF_v.1.0.xsd` usa sintaxis regex `.NET` `(?:20|20)` en `DateValidation`, que requiere normalizar `(?:20|20)` → `(20)` al auditar en Python `xmlschema`.
  - Confirmado en el OpenAPI oficial en vivo de la DGII (`https://ecf.dgii.gov.do/CerteCF/AprobacionComercial/api-docs/v1/definition.json`):
    - Endpoint: `POST https://ecf.dgii.gov.do/{ambiente}/aprobacioncomercial/api/aprobacioncomercial`
    - Campo multipart: `xml`, nombre de archivo **`<RNCComprador><eNCF>.xml`** (ej. `131488791E310000000007.xml`).
    - Respuesta JSON síncrona: `{ "codigo": "1" | "2" | "02", "estado": "Aprobacion Comercial Aprobada" | "Rechazada", "mensaje": string[] }`.
- **Solución aplicada (Hilo 3):** Normalización exacta sin pérdida flotante a 2 decimales obligatorios en `generarXmlAcecf` + `parsearExcelAcecfDgii`, refuerzo de `validarAcecf` en `validador-xsd.ts`, y test candado 11/11 contra el Excel real y `ACECF_v.1.0.xsd`.

---

### ERR-012 — `El campo TelefonoEmisor del área Emisor de la sección Encabezado de la línea 1 no es válido` (Paso 4 `CerteCF`)
- **Fecha / Hilo:** 28-11-2026 · Hilo 4 (`Paso 4: Pruebas de Simulación e-CF`)
- **Mensaje exacto DGII:**
  > `El campo TelefonoEmisor del área Emisor de la sección Encabezado de la línea 1 no es válido` (`E310000001001`, `secuenciaUtilizada: true`, detenido automáticamente en el caso #1 por el candado `detenidoPorRechazo`)
- **Causa raíz:**
  1. El XSD oficial DGII (`e-CF_31_v.1.0.xsd:551-556`, `TelefonoValidationType`) exige estrictamente `\d{3}-\d{3}-\d{4}` (máx. 12 caracteres, sin `+1` ni espacios).
  2. La configuración de empresa en BD traía `"+1 809-604-6949"` (y el fallback local de OXYMAT en `portal-ecf-cliente.tsx:144` traía `"8297417125"` sin guiones). `xmlTablaTelefonosEmisor` en `src/lib/ecf/xml.ts` emitía el teléfono crudo sin normalizar y `validarFormatosEnNodo` en `src/lib/ecf/validador-xsd.ts` no verificaba `TelefonoValidationType`.
- **Solución aplicada:**
  - `normalizarTelefonoDgii` en `src/lib/ecf/xml.ts` convierte automáticamente `"+1 809-604-6949"` o `"8297417125"` a `"809-604-6949"` / `"829-741-7125"`, y omite cualquier valor no normalizable a 10 dígitos en lugar de emitir un `<TelefonoEmisor>` / `<TelefonoAdicional>` inválido.
  - Validación estricta `RE_TELEFONO = /^\d{3}-\d{3}-\d{4}$/` agregada en `validarFormatosEnNodo` (`src/lib/ecf/validador-xsd.ts`).
  - Fallback de OXYMAT en `portal-ecf-cliente.tsx` corregido a `"829-741-7125"`.
- **Candado:** Test automatizado `ERR-012` en `src/lib/ecf/simulacion-paso4.test.ts` que verifica normalización (`+1`, sin guiones, inválido omitido) y rechazo explícito de `<TelefonoEmisor>+1 809-604-6949</TelefonoEmisor>` por `validarXmlContraEsquemaDgii`.

---

### ERR-013 — `fetch failed` en 3/4 `RFCE` + descarga prematura de XML `< 250Mil` reinició Paso 4 (`CerteCF`)
- **Fecha / Hilo:** 28-11-2026 · Hilo 4 (`Paso 4: Pruebas de Simulación e-CF`)
- **Mensaje exacto DGII:**
  > `Las pruebas de simulación de eCF han sido reiniciadas debido a que se han rechazado comprobantes. - No se ha encontrado el Resumen de Factura de Consumo Electrónica asociada a la Factura de Consumo Electrónica recibida, o en su defecto, no se encuentra en un estado válido. Antes de enviar la factura, procurar enviar su Resumen Electrónico y que este haya sido aceptado.`
- **Causa raíz:**
  1. Tras aceptar `21/21` comprobantes base/notas y `1/4` `RFCE` (`E320000001104`), `fc.dgii.gov.do/certecf/recepcionfc` tuvo 3 cortes transitorios de red (`TypeError: fetch failed`) en `E320000001103`, `1105` y `1106`. El runner `ejecutar-simulacion/route.ts` no reintentaba errores de red transitorios antes de marcar `error_red`.
  2. `BloqueCuartoPasoDgii` en `set-simulacion-paso4.tsx` habilitaba los 4 botones «Descargar XML» incluso cuando solo `1/4` `RFCE` estaba `aceptado`, permitiendo subir al portal DGII un XML íntegro cuyo `RFCE` nunca había sido recibido.
- **Solución aplicada:**
  - `enviarEcfDgiiConReintentoRed` en `src/app/api/ecf/pruebas/ejecutar-simulacion/route.ts` reintenta automáticamente hasta 3 veces con backoff (`1.2s`, `2.4s`) ante errores transitorios de red (`fetch failed`, `ECONNRESET`, `ETIMEDOUT`, `socket`), enviando exactamente el mismo XML ya firmado sin cambiar el `CodigoSeguridad`.
  - `BloqueCuartoPasoDgii` en `set-simulacion-paso4.tsx` bloquea los botones de descarga y muestra alerta roja explícita mientras los `4/4` `RFCE` no estén en estado `aceptado`/`aceptado_condicional`, indicando re-ejecutar con la misma secuencia base para reintentar solo los pendientes.
- **Candado:** Test `ERR-013` en `src/app/api/ecf/pruebas/ejecutar-simulacion/ejecutar-simulacion.test.ts` que simula dos `fetch failed` seguidos y valida 3 intentos con el mismo XML firmado hasta lograr `aceptado`.

---

## 5. Progreso de los 14 pasos de certificación DGII — OXYMAT SRL (`131488791`)

- [x] **Paso 1 — Postulación Desarrollo Propio (`CerteCF`)** — Aprobado en verde (`27-11-2026`).
- [x] **Paso 2 — Pruebas de Datos e-CF (`CerteCF`)** — Aprobado en verde: `21/21` Comprobantes + `4/4` Resúmenes `RFCE` + `4/4` XML `< 250Mil` (`27-11-2026`).
- [x] **Paso 3 — Pruebas de Datos Aprobación Comercial (`ACECF`, 11 filas)** — Aprobado en verde a la primera (`28-11-2026`, `80e5c42`).
- [x] **Paso 4 — Pruebas de Simulación e-CF (`25/25` en orden 18/3/4 + `4/4` `< 250Mil`, `secuenciaBase=1201`)** — Aprobado en verde (`28-11-2026`, `5c86962`). Respaldo completo en `/root/referencias/ecf-oxymat/paso4-simulacion-1201/`.
- [ ] **Paso 5 — Pruebas de Simulación Representación Impresa (11 PDFs con QR oficial, <= 10 MB)** — 11 PDFs **generados y verificados automáticamente** (`28-11-2026`, merge `0168de5`): plantillas reales del sistema (DocumentoPapel/NC/ND Alegra) vía Chromium print, QR byte-exact vs manifiesto `1201` (zbarimg 300dpi), literales exactos vs XML, geometría QR >= 2cm del borde, `qpdf` limpio, total `585,640` bytes. En `/root/referencias/ecf-oxymat/paso5-ri-pdf/` + `manifiesto-paso5.json`. *Pendiente: subida manual de Waldy al portal y aprobación DGII.*
- [ ] **Pasos 6–13 — Validación RI, URL Servicios Prueba, Recepción e-CF (`ARECF`), Recepción Aprobación Comercial (`ACECF`), URL Servicios Producción** — *Pendiente.*
- [ ] **Paso 14 — Declaración Jurada y Corte desde Alegra (`último_eNCF + 1`)** — *Pendiente.*
- [ ] **Requisito técnico obligatorio antes de `main` / Vercel Producción:** agregar `node-forge` (+ `@types/node-forge`) en `src/lib/ecf/pkcs12.ts` (con aprobación explícita de Waldy) y correr **Auditoría pre-`main` (Gemini 4 Neon High)** en `docs/revisiones/`.
- [ ] **Repetición limpia para MEDOXIGAS ALC, SRL (`130893489`)** — *Solo después de cerrar OXYMAT 100 % en verde.*

---

## 6. Protocolo para agregar nuevos errores (mantener viva esta bitácora)

Cada vez que aparezca un error nuevo con la DGII (en Paso 3, Paso 4, Representaciones Impresas, Recepción o Producción), agregar una entrada `ERR-0XX` en la Sección 4 con estos 5 campos obligatorios:
1. **Fecha / Hilo**
2. **Mensaje exacto DGII** (copiado literal)
3. **Causa raíz** (`archivo:línea`)
4. **Solución aplicada** (commit SHA)
5. **Candado automático** (test unitario/XSD o regla Biome que impide que vuelva a ocurrir)

> [!TIP] Cómo llevarlo a Obsidian y Google Drive
> - Archivo versionado en el repo: `docs/bitacora-ecf-dgii.md`
> - Copia lista para respaldo fuera del repo: `/root/referencias/ecf-oxymat/BITACORA-ECF-DGII-OBSIDIAN.md`
> - Incluye frontmatter YAML, callouts nativos de Obsidian (`[!IMPORTANT]`, `[!TIP]`), tablas Markdown y cero secretos: puedes arrastrarlo directo a tu bóveda de Obsidian y sincronizarlo con Google Drive con total seguridad.

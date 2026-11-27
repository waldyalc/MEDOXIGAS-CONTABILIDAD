# Handoff — Medoxigas Contabilidad

> **Archivo vivo y compacto** (máx. ~100 líneas; solo bloque activo y estado actual).
> Histórico anterior al 26-11-2026 archivado en [docs/handoff-archivo/2026-11-26-historico.md](docs/handoff-archivo/2026-11-26-historico.md).

## Estado del repo y entornos (27-11-2026)

- **Producción Vercel (`main` @ `89d34b9`):** `https://ferreteria.medoxigas.com` (y `https://medoxigas-contabilidad.vercel.app`), `ECF_ENCRYPTION_KEY` configurada (idéntica a `.env.local`), endpoint DGII `GET /api/ecf/131488791/fe/autenticacion/api/semilla` en `HTTP 200`. Token de Vercel guardado en `/root/.vercel.env` (`chmod 600`, fuera del repo).
- **Preview único del VPS (`feat/pos-alegra-exacto` @ `4a80f94`, 2 commits por delante de `main`):** `https://medoxigas-agentes.tail25e53a.ts.net` (`medoxigas-preview.service`, puerto `3010`, `HTTP 200`).
- **Base de datos Supabase producción (`ljfdhrnvlsfaweuvnqxz`):**
  - Migración `supabase/migrations/20261127131500_ecf_config_rpc_certificado.sql` aplicada (`guardar_ecf_certificado`, `obtener_ecf_secreto_firma`, `64/64` pgTAP en `ecf_dgii_test.sql`).
  - Certificado `.p12` real de **OXYMAT SRL (`131488791`)** ya guardado y cifrado con AES-256-GCM en `ecf_config` (titular: `JARDI YOSELIN ALCANTARA ALCANTARA`, `IDCDO-01900133958`, Viafirma, vigente hasta `23 abr 2027`).

## Bloque cerrado (27-11-2026)

1. **Pack 8 mejoras UI/UX Alegra (promovido a `main` @ `89d34b9`):** emisión e-CF en Facturas (`bd81460`), calendario 1900–2100 + CxC/CxP Alegra (`9c4b220`), color global `--brand-primary: #1e56c7` sin teal (`548a586`), Estado de resultados clon Alegra (`57860ee`), paginador global Alegra (`53086f6` + `c5a468b`), esqueleto 0 ms en reportes (`c92b565`), tablas sin scroll horizontal con wrap 2 líneas (`380dd2b` + `afdb95d`).
2. **Ola 1 e-CF + Paso 1 DGII APROBADO EN VERDE (`ce0a2ff` → `4a80f94`):**
   - Alineación XML/C14N/XSD DGII (`40fdba5`), RPC seguro `.p12` (`fa804a1`), Portal Paso 1 + runner Excel Paso 2 (`53d93b4`), QR ISO-18004 puro en factura A4 y ticket POS 80 mm (`ced2f97`, `pnpm test:pdf` en verde).
   - **Firmador XMLDSig de postulación DGII** (`POST /api/ecf/config/firmar-xml`, `FirmarXmlPostulacion`, `89d34b9` → `4a80f94`): preserva los bytes `\r\n  ` originales del XML, calcula `DigestValue` compactando indentación en memoria (`PreserveWhitespace = false` de `.NET`) y propaga `xmlns:xsd`/`xmlns:xsi` en `SignedInfo` (Inclusive C14N 1.0).
   - **Hito real DGII:** **Paso 1 (Postulación Desarrollo Propio — OXYMAT SRL `131488791`) APROBADO EN VERDE** en el portal de certificación DGII con URLs `ferreteria.medoxigas.com/api/ecf/131488791`.

## Siguiente bloque activo: Paso 2 DGII (`CerteCF`) — OXYMAT SRL (`131488791`)

- **Excel oficial descargado del portal DGII (fuera del repo):** `/root/referencias/ecf-oxymat/131488791-27112026113533.xlsx` (`454 KB`).
  - Hoja `ECF`: **25 comprobantes** (los 10 tipos `31, 32, 33, 34, 41, 43, 44, 45, 46, 47`) con **127 columnas DGII** (formas de pago, impuestos adicionales/ISC alcohol, transporte/exportación E46, retenciones, descuentos/recargos, subcantidades, otra moneda).
  - Hoja `RFCE`: **4 resúmenes de consumo (< RD$250,000)** (`E320000000011`, `E320000000013`, `E320000000014`, `E320000000015`).
- **Endpoints DGII del Paso 2 (`CerteCF`):**
  - `https://eCF.dgii.gov.do/CerteCF/Autenticacion`
  - `https://eCF.dgii.gov.do/CerteCF/Recepcion`
  - `https://eCF.dgii.gov.do/CerteCF/ConsultaResultado`
  - `https://fc.dgii.gov.do/CerteCF/RecepcionFC`
- **Plan para la próxima sesión (hilo nuevo limpio):**
  1. Ampliar `src/lib/ecf/excel-pruebas.ts` + `src/lib/ecf/xml.ts` + `src/lib/ecf/validador-xsd.ts` para cubrir las **127 columnas reales** del Excel DGII (25 `<ECF>` + 4 `<RFCE>` con `CodigoSeguridadeCF` real y orden oficial de envío).
  2. Validar localmente 29/29 XML (XSD + firma `.NET`) antes de disparar contra `CerteCF`.
  3. Ejecutar el set real en `CerteCF` con el `.p12` guardado en `ecf_config` y exponer descarga de los **4 XML íntegros `< 250Mil`** (`E320000000011/13/14/15`) para subirlos en la caja inferior del Paso 2 en la DGII.
  4. **Vercel Serverless `.p12`:** `src/lib/ecf/pkcs12.ts` usa el binario `openssl` (ausente en Lambda de Vercel; funciona en el VPS). Pedir OK de Waldy para agregar `node-forge` (+ `@types/node-forge`) y luego pasar Auditoría pre-`main` (Gemini 4 Neon High) antes de subir `feat/pos-alegra-exacto` → `main`.

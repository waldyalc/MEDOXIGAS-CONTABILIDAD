# Handoff — Medoxigas Contabilidad

> **Archivo vivo y compacto** (máx. ~100 líneas; solo bloque activo y estado actual).
> Histórico anterior al 26-11-2026 archivado en [docs/handoff-archivo/2026-11-26-historico.md](docs/handoff-archivo/2026-11-26-historico.md).

## Estado del repo y entornos (27-11-2026)

- **Producción Vercel (`main` @ `89d34b9`):** `https://ferreteria.medoxigas.com` (y `https://medoxigas-contabilidad.vercel.app`), `ECF_ENCRYPTION_KEY` configurada (idéntica a `.env.local`), endpoint DGII `GET /api/ecf/131488791/fe/autenticacion/api/semilla` en `HTTP 200`. Token de Vercel en `/root/.vercel.env` (`chmod 600`, fuera del repo).
- **Preview único del VPS (`feat/pos-alegra-exacto`, base `19a8296` + este handoff):** `https://medoxigas-agentes.tail25e53a.ts.net` (`medoxigas-preview.service`, puerto `3010`, `active`, `HTTP 200`). Rama por delante de `origin/feat/pos-alegra-exacto` y `main` (pendiente push/PR/auditoría pre-`main` cuando Waldy lo autorice).
- **Base de datos Supabase producción (`ljfdhrnvlsfaweuvnqxz`):**
  - Migración `supabase/migrations/20261127131500_ecf_config_rpc_certificado.sql` aplicada (`64/64` pgTAP en `ecf_dgii_test.sql`).
  - Certificado `.p12` real de **OXYMAT SRL (`131488791`)** guardado y cifrado en `ecf_config` (Viafirma, vigente hasta `23 abr 2027`).
  - Los 25 envíos del Paso 2 (`ambiente = "certecf"`, `documento_tipo = "prueba"`) persistidos como `aceptado` en `ecf_envios`.

## Bloque cerrado (27-11-2026) — Paso 2 DGII APROBADO EN VERDE

1. **Paso 1 DGII (Postulación Desarrollo Propio — `89d34b9` → `4a80f94`):** APROBADO EN VERDE para OXYMAT SRL (`131488791`).
2. **Paso 2 DGII (`Pruebas de Datos e-CF` en `CerteCF` — `c8933cd` → `19a8296`, 2 olas verificadas `[accepted]`):**
   - **Ola 1 (`ce32c91`, `c8933cd`, `e6ab7db`):** motor e-CF/RFCE/ANECF alineado 1:1 con los **15 XSD oficiales DGII** (`/root/referencias/ecf-xsd/`) y las **127 columnas** del Excel DGII; orden topológico de envío (`E32→E33`, `E31→E34`, `E44→E34`), polling acotado de `ConsultaResultado`, zona horaria `America/Santo_Domingo`, descarga `<RNCEmisor><eNCF>.xml` de los 4 `< 250Mil` en UI (`set-excel-dgii.tsx`). Capturas en `/root/referencias/capturas-terminadas/2026-11-27-ecf-paso2-certecf/`.
   - **Ola 2 (`19a8296` = `2f50643` + `e138094`):** preservación exacta de literales decimales del Excel en 7 campos (`*Texto`, candado de **2,360/2,360 celdas** con 0 discrepancias y **29/29 XSD válidos** con `xmlschema`) + idempotencia en `/api/ecf/pruebas/ejecutar-excel` para reutilizar casos `aceptado`/`aceptado_condicional` sin invalidar `CodigoSeguridad` de RFCE.
   - **Hito real DGII:** **Paso 2 APROBADO EN VERDE** (`21/21` Comprobantes Aceptados, `4/4` Resúmenes de Consumo Aceptados, `4/4` Facturas de Consumo `< 250Mil` Aceptadas). Copias de los 4 XML en `/root/referencias/ecf-oxymat/xml-menor-250mil/`.
   - Worktrees de Ola 1 y Ola 2 ya podados. *(Quedan 3 worktrees ajenos previos: `t3/contacto-dedup-y-cierre`, `fix/sidebar-menu-limpieza`, `t3/fix-pos-devoluciones-schema-refresh`.)*

## Siguiente bloque activo: Paso 3 DGII (`Pruebas de Datos Aprobación Comercial — ACECF`)

- **Excel oficial descargado del portal DGII (fuera del repo):** `/root/referencias/ecf-oxymat/131488791-27112026175301.xlsx` (`7.6 KB`).
  - Hoja `ACEECF_Generadas`: **11 filas** (`RNCEmisor = 131880681` → `RNCComprador = 131488791`, todas `Estado = 1`, columnas `Version, RNCEmisor, eNCF, FechaEmision, MontoTotal, RNCComprador, Estado, DetalleMotivoRechazo, FechaHoraAprobacionComercial`).
- **XSD oficial ya descargado:** `/root/referencias/ecf-xsd/ACECF_v.1.0.xsd`.
- **Endpoints DGII del Paso 3 (`CerteCF`):**
  - `https://eCF.dgii.gov.do/CerteCF/Autenticacion`
  - `https://eCF.dgii.gov.do/CerteCF/AprobacionComercial`
- **Plan para la próxima sesión (hilo nuevo limpio):**
  1. Revisar generador/validador `ACECF` existente en `src/lib/ecf/` contra `/root/referencias/ecf-xsd/ACECF_v.1.0.xsd` (preservando literales exactos de `MontoTotal`, `FechaEmision` y `FechaHoraAprobacionComercial` del Excel, y formato de firma XMLDSig aceptado por DGII).
  2. Agregar parser + runner/UI de Excel `ACECF` (idempotente y validado con `xmlschema` local 11/11) para ejecutar el Paso 3 real en `CerteCF` desde Medoxigas Contabilidad.
  3. Mejora UX menor pendiente: recordar el ambiente seleccionado (`CerteCF` vs `TesteCF`) en `/dashboard/configuracion/facturacion-electronica` al recargar.
  4. **Antes de promover `feat/pos-alegra-exacto` → `main`:** pedir OK de Waldy para agregar `node-forge` (+ `@types/node-forge`) en `src/lib/ecf/pkcs12.ts` (Vercel Serverless no trae binario `openssl`) y correr **Auditoría pre-`main` (Gemini 4 Neon High)** en `docs/revisiones/`.

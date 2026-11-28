# Handoff — Medoxigas Contabilidad

> **Archivo vivo y compacto** (máx. ~100 líneas; solo bloque activo y estado actual).
> Histórico anterior al 26-11-2026 archivado en [docs/handoff-archivo/2026-11-26-historico.md](docs/handoff-archivo/2026-11-26-historico.md).
> Bitácora maestra de errores y aprendizajes DGII (Obsidian): [docs/bitacora-ecf-dgii.md](docs/bitacora-ecf-dgii.md) (copia en `/root/referencias/ecf-oxymat/BITACORA-ECF-DGII-OBSIDIAN.md`).

## Estado del repo y entornos (28-11-2026)

- **Producción Vercel (`main` @ `89d34b9`):** `https://ferreteria.medoxigas.com` (y `https://medoxigas-contabilidad.vercel.app`), `ECF_ENCRYPTION_KEY` configurada (idéntica a `.env.local`), endpoint DGII `GET /api/ecf/131488791/fe/autenticacion/api/semilla` en `HTTP 200`. Token de Vercel en `/root/.vercel.env` (`chmod 600`, fuera del repo).
- **Preview único del VPS (`feat/pos-alegra-exacto`, base `80e5c42` + este handoff):** `https://medoxigas-agentes.tail25e53a.ts.net` (`medoxigas-preview.service`, puerto `3010`, `active`, `HTTP 200`). Rama por delante de `origin/feat/pos-alegra-exacto` y `main` (pendiente push/PR/auditoría pre-`main` cuando Waldy lo autorice).
- **Base de datos Supabase producción (`ljfdhrnvlsfaweuvnqxz`):**
  - Migración `supabase/migrations/20261127131500_ecf_config_rpc_certificado.sql` aplicada (`64/64` pgTAP en `ecf_dgii_test.sql`).
  - Certificado `.p12` real de **OXYMAT SRL (`131488791`)** guardado y cifrado en `ecf_config` (Viafirma, vigente hasta `23 abr 2027`).
  - Paso 2 (`25` envíos) y Paso 3 (`11` aprobaciones `ACECF`) persistidos en `ecf_envios` (`ambiente = "certecf"`, `documento_tipo = "prueba"`).

## Bloques cerrados — OXYMAT SRL (`131488791`) en `CerteCF`

1. **Paso 1 DGII (Postulación Desarrollo Propio — `89d34b9` → `4a80f94`):** APROBADO EN VERDE.
2. **Paso 2 DGII (`Pruebas de Datos e-CF` — `c8933cd` → `19a8296`):** APROBADO EN VERDE (`21/21` Comprobantes, `4/4` Resúmenes `RFCE`, `4/4` `< 250Mil`). Copias XML en `/root/referencias/ecf-oxymat/xml-menor-250mil/`.
3. **Paso 3 DGII (`Pruebas de Datos Aprobación Comercial — ACECF` — `5114166` → `80e5c42`, 2 olas `[accepted]`):**
   - **Ola 1A (`9eb0c69`, `4b06891`):** motor/validador `ACECF` alineado con `/root/referencias/ecf-xsd/ACECF_v.1.0.xsd` (`Decimal18D2Validation` 2 decimales obligatorios, lexema crudo OOXML de 18 dígitos sin deriva float64, `Estado="1"` omite `DetalleMotivoRechazo`), cliente `enviarAprobacionComercialDgii`, parser `excel-acecf.ts` y 17 tests (11/11 reales válidos contra `ACECF_v.1.0.xsd`).
   - **Ola 1B (`5114166`):** tarjeta UI `SetExcelAcecf` en `/dashboard/configuracion/facturacion-electronica` y persistencia del selector `CerteCF`/`TesteCF` (`ecf_config` + `localStorage`).
   - **Ola 2A (`80e5c42`):** runner API idempotente `POST /api/ecf/pruebas/ejecutar-acecf` (`ecf_envios`, comprador fail-closed, rechazo de duplicados, credenciales diferidas, candado Producción) + 15 tests. Capturas en `/root/referencias/capturas-terminadas/2026-11-27-ecf-paso3-acecf/`.
   - **Bitácora Obsidian (`cd29eaa`):** `docs/bitacora-ecf-dgii.md` con `ERR-001`..`ERR-011` (cero secretos).
   - **Hito real DGII:** **Paso 3 APROBADO EN VERDE A LA PRIMERA** (`11/11` aprobaciones comerciales `ACECF` en `CerteCF`).
   - Worktrees de Ola 1 y Ola 2 podados. *(Quedan 3 worktrees ajenos previos: `t3/contacto-dedup-y-cierre`, `fix/sidebar-menu-limpieza`, `t3/fix-pos-devoluciones-schema-refresh`.)*

## Siguiente bloque activo: Paso 4 DGII (`CerteCF` — Simulación / Representaciones Impresas / Comunicación)

- **Confirmar con Waldy la pantalla exacta del Paso 4** en el Portal de Certificación DGII (simulación e-CF, representación impresa PDF con QR oficial o pruebas de comunicación/recepción).
- **Mantener viva la bitácora:** registrar en `docs/bitacora-ecf-dgii.md` (y copiar a `/root/referencias/ecf-oxymat/BITACORA-ECF-DGII-OBSIDIAN.md`) cualquier error nuevo y su candado automático.
- **Antes de promover `feat/pos-alegra-exacto` → `main` (Vercel producción):**
  1. Pedir OK explícito de Waldy para agregar `node-forge` (+ `@types/node-forge`) en `src/lib/ecf/pkcs12.ts` (Vercel Serverless no trae binario `openssl`; imprescindible para firmar en `https://ferreteria.medoxigas.com` durante las pruebas de comunicación de recepción `ARECF`/`ACECF` y producción).
  2. Correr **Auditoría pre-`main` (Gemini 4 Neon High)** con informe en `docs/revisiones/`.

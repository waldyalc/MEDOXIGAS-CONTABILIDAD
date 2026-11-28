# Handoff — Medoxigas Contabilidad

> **Archivo vivo y compacto** (máx. ~100 líneas; solo bloque activo y estado actual).
> Histórico anterior al 26-11-2026 archivado en [docs/handoff-archivo/2026-11-26-historico.md](docs/handoff-archivo/2026-11-26-historico.md).
> Bitácora maestra de errores y aprendizajes DGII (Obsidian): [docs/bitacora-ecf-dgii.md](docs/bitacora-ecf-dgii.md) (copia en `/root/referencias/ecf-oxymat/BITACORA-ECF-DGII-OBSIDIAN.md`).

## Estado del repo y entornos (28-11-2026)

- **Producción Vercel (`main` @ `89d34b9`):** `https://ferreteria.medoxigas.com` (y `https://medoxigas-contabilidad.vercel.app`), `ECF_ENCRYPTION_KEY` configurada (idéntica a `.env.local`), endpoint DGII `GET /api/ecf/131488791/fe/autenticacion/api/semilla` en `HTTP 200`. Token de Vercel en `/root/.vercel.env` (`chmod 600`, fuera del repo).
- **Preview único del VPS (`feat/pos-alegra-exacto`, base `5c86962` + este handoff):** `https://medoxigas-agentes.tail25e53a.ts.net` (`medoxigas-preview.service`, puerto `3010`, `active`, `HTTP 200`). Rama por delante de `origin/feat/pos-alegra-exacto` y `main` (pendiente push/PR/auditoría pre-`main` cuando Waldy lo autorice).
- **Base de datos Supabase producción (`ljfdhrnvlsfaweuvnqxz`):**
  - Migración `supabase/migrations/20261127131500_ecf_config_rpc_certificado.sql` aplicada (`64/64` pgTAP en `ecf_dgii_test.sql`).
  - Certificado `.p12` real de **OXYMAT, SRL (`131488791`)** guardado y cifrado en `ecf_config` (Viafirma, vigente hasta `23 abr 2027`).
  - Paso 2 (`25` envíos), Paso 3 (`11` aprobaciones `ACECF`) y Paso 4 (`25/25` simulación `secuenciaBase=1201` en `CerteCF`) persistidos en `ecf_envios` (`ambiente = "certecf"`, `documento_tipo = "prueba"`).

## Bloques cerrados — OXYMAT, SRL (`131488791`) en `CerteCF`

1. **Paso 1 DGII (Postulación Desarrollo Propio — `89d34b9` → `4a80f94`):** APROBADO EN VERDE.
2. **Paso 2 DGII (`Pruebas de Datos e-CF` — `c8933cd` → `19a8296`):** APROBADO EN VERDE (`21/21` Comprobantes, `4/4` Resúmenes `RFCE`, `4/4` `< 250Mil`). Copias XML en `/root/referencias/ecf-oxymat/xml-menor-250mil/`.
3. **Paso 3 DGII (`Pruebas de Datos Aprobación Comercial — ACECF` — `5114166` → `80e5c42`):** APROBADO EN VERDE A LA PRIMERA (`11/11` `ACECF` en `CerteCF`).
4. **Paso 4 DGII (`Pruebas de Simulación e-CF` — `99d2e08` → `5c86962`, 2 olas `[accepted]`):**
   - **Ola 1 (`10c0763`, `53cd47a`):** generador de los `25` casos comerciales de OXYMAT en orden oficial DGII (Fase 1 `18` base `31, 32≥250k, 41, 43, 44, 45, 46, 47` → Fase 2 `3` notas `33, 34` → Fase 3 `4` `RFCE` `<250k`; `29/29` válidos en `xmlschema`) + tipos/UI `SetSimulacionPaso4`.
   - **Ola 2 (`c666558`, `25de738`, `5c86962`):** runner API idempotente `POST /api/ecf/pruebas/ejecutar-simulacion` (candado `detenidoPorRechazo` en `CerteCF`, reintento automático 3x ante `fetch failed` sin re-firmar, bloqueo UI de descargas `<250Mil` sin `4/4` RFCE aceptados), calco `<Emisor>` 1:1 con XML real de Alegra (`OXYMAT, SRL`, `Sucursal: PRINCIPAL`, `APTO, No. 101, APTO. RES DORADO III, DORADO II, Santo Domingo Norte, Santo Domingo`, `Municipio: 320301`, `Provincia: 320000`, `oxymatsrl@gmail.com`, sin `<TablaTelefonoEmisor>`), y `normalizarTelefonoDgii` + `RE_TELEFONO` en `validador-xsd.ts`.
   - **Bitácora Obsidian:** `ERR-012` (`TelefonoEmisor` `\d{3}-\d{3}-\d{4}`) y `ERR-013` (`fetch failed` RFCE + candado descarga `<250Mil`) documentados en `docs/bitacora-ecf-dgii.md` y `/root/referencias/ecf-oxymat/BITACORA-ECF-DGII-OBSIDIAN.md`.
   - **Hito real DGII:** **Paso 4 APROBADO EN VERDE** (`25/25` con `secuenciaBase=1201` + `4/4` XML `< 250Mil`). Respaldo íntegro de los **25 XML firmados + 4 RFCE + `manifiesto-paso4-1201.json`** guardado en `/root/referencias/ecf-oxymat/paso4-simulacion-1201/`. Capturas UI en `/root/referencias/capturas-terminadas/2026-11-28-ecf-paso4-simulacion/`.
   - Worktrees de Ola 1 y Ola 2 podados. *(Quedan 3 worktrees ajenos previos: `t3/contacto-dedup-y-cierre`, `fix/sidebar-menu-limpieza`, `t3/fix-pos-devoluciones-schema-refresh`.)*

## Siguiente bloque activo: Paso 5 DGII (`CerteCF` — Pruebas de Simulación Representación Impresa)

- **Qué pide el portal DGII en el Paso 5:** subir **11 archivos PDF** (suma total `<= 10 MB`), uno por cada tipo de comprobante enviado en el Paso 4 (`31`, `32 >= 250mil`, `33`, `34`, `41`, `43`, `44`, `45`, `46`, `47`, `32 < 250mil`), con los **datos exactos del XML firmado de la corrida `1201`** (`/root/referencias/ecf-oxymat/paso4-simulacion-1201/`) y su **código QR oficial legible** (URL `ConsultaTimbre` / `ConsultaTimbreFC`, `CodigoSeguridad`, `FechaHoraFirma`, vigencia de secuencia).
- **Siguiente después de Paso 5–6:** Paso 7–11 (URL Servicios Prueba + Pruebas de Recepción `ARECF`/`ACECF`).
- **Mantener viva la bitácora:** registrar en `docs/bitacora-ecf-dgii.md` (y copiar a `/root/referencias/ecf-oxymat/BITACORA-ECF-DGII-OBSIDIAN.md`) cualquier error nuevo y su candado automático.
- **Antes de promover `feat/pos-alegra-exacto` → `main` (Vercel producción, imprescindible antes del Paso 7):**
  1. Pedir OK explícito de Waldy para agregar `node-forge` (+ `@types/node-forge`) en `src/lib/ecf/pkcs12.ts` (Vercel Serverless no trae binario `openssl`; imprescindible para firmar en `https://ferreteria.medoxigas.com` durante las pruebas de comunicación de recepción `ARECF`/`ACECF` y producción).
  2. Correr **Auditoría pre-`main` (Gemini 4 Neon High)** con informe en `docs/revisiones/`.

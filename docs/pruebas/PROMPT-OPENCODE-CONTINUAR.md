Continúas las pruebas de carga de Medoxigas Contabilidad que empezó otra IA (Devin) y no terminó. Sigue AL PIE DE LA LETRA `docs/pruebas/INSTRUCCIONES-PRUEBAS.md` (léelo completo). Todas sus reglas siguen vigentes: nada de borrar, nada de service_role, no mostrar claves ni el contenido de `.env.local` o `.env.pruebas`, no cambiar la app ni la base (solo escribir por las RPC con los usuarios ZZTEST), no push, no fusionar, nunca --no-verify, puerto 3001 (el 3000 es de Waldy), y parar todo si Supabase responde read-only, disk, quota o exceeded.

Dónde se quedó:
- Rama: `test/pruebas-carga` (ya creada desde origin/prueba). No la vuelvas a crear. Commit hecho: c497e5f (scripts de humo, carga y concurrencia).
- Prueba de humo: PASÓ (`docs/pruebas/resultados/humo.json`).
- Prueba 1 (volumen): `tests/carga/carga.ts` PUEDE SEGUIR CORRIENDO en segundo plano (procesos node con `tsx tests/carga/carga.ts`). Su avance está en `docs/pruebas/resultados/carga-log.txt`. Ya terminó contactos (1,000), productos (300), compras (5,000) y pagos a proveedores (3,000), e iba por facturas (4,000 de 15,000). Faltan: el resto de facturas, pagos recibidos (7,000), notas de crédito (500), anulaciones (300) y el `carga.json`.
  - Primero mira si el proceso sigue vivo (`tasklist | findstr node` o `Get-CimInstance Win32_Process -Filter "name='node.exe'"`) y si el log avanza. Si sigue, NO lo lances otra vez: espera a que termine. Si murió, vuelve a correr `npx tsx tests/carga/carga.ts`: es resumible (cuenta lo que ya existe con ZZTEST-L1 y crea solo lo que falta).
- Scripts escritos pero NO corridos y NO revisados: `tests/carga/concurrencia.ts` (C1–C7), `tests/carga/ui.ts` (medir pantallas con Playwright, sección 2.2) y `tests/carga/c8.ts` (5 navegadores a la vez; puede estar a medias). `ui.ts` y `c8.ts` no tienen commit.
- `concurrencia.ts` debe correr DESPUÉS de que termine `carga.ts` (C1 comparte la secuencia de NCF B01).
- Hallazgo de Devin a confirmar: el 607 (`src/lib/fiscales/consultas.ts`, `obtenerVentas`) consulta facturas sin paginar y podría cortar en 1,000 filas. Ventas generales sí pagina.

Qué hacer, en orden:
1. Revisa `ui.ts` y `c8.ts`, termínalos si están a medias y pasa `pnpm typecheck`. Haz commit solo de `tests/carga/` y `docs/pruebas/resultados/`.
2. Espera a que termine la carga (o reanúdala) y confirma que `docs/pruebas/resultados/carga.json` quedó con creados, fallos agrupados por mensaje y p50/p95/máx por RPC.
3. Sección 2.2: `pnpm build`, `pnpm start -p 3001`, `npx tsx tests/carga/ui.ts` → `tiempos-ui.json`, y el corte de 1,000 filas del 607 y ventas generales de marzo 2023.
4. Prueba 2: `npx tsx tests/carga/concurrencia.ts` (C1–C7) y luego C8 → `concurrencia.json`. C6 debe terminar con junio 2020 REABIERTO; compruébalo.
5. Prueba 3 y el informe `docs/pruebas/resultados/RESULTADOS.md` como dice la sección 5. Escribe que falta que Waldy corra otra vez `docs/pruebas/cuadre.sql` y lo compare con `linea-base-antes.md` (en la línea base D6 inventario ya daba -97,500.00 y la base pesaba 25.7 MB).
6. Commit final de `tests/carga/` y `docs/pruebas/resultados/` y termina. No toques ningún otro archivo.

Si algo falla 3 veces seguidas o no sabes cómo seguir, para y explícalo en español sencillo; no inventes atajos ni cambies la app para que una prueba pase.

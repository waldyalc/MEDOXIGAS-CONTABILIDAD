# Estado de las pruebas — dónde quedó Devin

> Actualización 14 nov 2026 (noche): ya están hechas la medición UI (:3005),
> C8, el cuadre por API (`linea-base-despues.md`), `RESULTADOS.md`, la sonda
> de fallos 2ª pasada (`sonda-fallos.md` F1–F9) y la **3ª pasada** (F10–F18:
> bancos, conduces, activos, notas de compra, estado de cuenta, numeraciones;
> script `sonda-fallos-2.ts`, crudo `sonda-fallos-2-raw.json`).
> **Pendiente:** Waldy corre `cuadre.sql` en el SQL Editor y pega la salida →
> se interpreta en `resultados/cuadre-interpretacion.md` (ya tiene el marco).
> Sin push. Lo de abajo es el estado histórico del 14 nov 7:23 pm.

---

## Estado anterior (parado 14 nov 2026, 7:23 pm)

Devin corría escondido por línea de comandos (`devin.exe --model swe-2-flash-max --permission-mode dangerous -p --prompt-file %TEMP%\medox-pruebas\prompt2.md`) desde las 6:38 pm. Waldy pidió pararlo; se paró a mitad de la medición de pantallas. Su registro completo: `%TEMP%\medox-pruebas\sesion2-final.log`.

Rama: `test/pruebas-carga` (local, sin push). Reglas: `docs/pruebas/INSTRUCCIONES-PRUEBAS.md` (siguen vigentes).

## Hecho (con commit)
- `c497e5f` scripts: `tests/carga/_comun.ts`, `humo.ts`, `carga.ts`, `concurrencia.ts`.
- `9e9a3f9` **Prueba 1, carga**: 32k documentos en 850 s, marcador `ZZTEST-L1`, sin cortes por cuota. Resultados en `docs/pruebas/resultados/carga.json` y `carga-log.txt`.
  - 1,000 contactos, 300 productos, 5,000 compras, 3,000 pagos a proveedor, 15,000 facturas (10,768 a crédito + 4,232 de contado), 6,994 pagos recibidos, 500 notas de crédito, 300 anulaciones.
  - Todas las RPC: p50 ≈ 100–130 ms, p95 ≈ 120–300 ms.
  - 6 fallos de pago "la retención ITBIS 30 % no genera monto" sobre facturas con ITBIS 0: es del generador de datos, no un error de la app.
- `68d7a4e` **Prueba 2, concurrencia C1–C7: todas PASAN** (`concurrencia.json`, `concurrencia-log.txt`).
  - C1: 500 facturas, NCF consecutivos sin huecos. C2: 3 cobros OK y 2 rechazados, sin sobrecobro. C3: nunca sobrecobra. C4: stock negativo permitido y cuadra (−2 = −2). C5: 20/20 un solo ganador. C6: el cierre bloqueó 35/40 y reabrir funcionó (**junio 2020 quedó reabierto**). C7: 3,932 facturas en 120 s con reportes pesados, p95 164 ms.

## Hallazgos (errores reales de la app)
1. **El 607 se corta en 1,000 filas.** `src/lib/fiscales/consultas.ts` (`obtenerVentas`, ~línea 229) lee `facturas` sin paginar. Marzo 2023: 1,700 facturas reales y solo se leen 1,000, así que se pierde ~41 % (RD$30.8M de RD$52.6M). Ventas generales (`reportes/ventas/v1`) sí pagina.
2. **Listas lentas con datos** (medido, pero ver el aviso de abajo): facturas 8.7–13.6 s, compras 26–38 s, pagos recibidos 8–10 s, primera apertura de una ficha ~11 s. Meta: p95 < 2 s. Inicio ~1.5–2.5 s.

## Aviso importante
La medición de pantallas (`docs/pruebas/resultados/ui-log.txt`) **no vale**: el puerto 3001 lo tenía ocupado otro localhost (el worktree de T3 `feat-inicio-diseno-alegra`, una rama vieja), así que `pnpm start` de Devin no levantó y `ui.ts` midió la app equivocada. Hay que repetirla con la app de esta rama en un puerto libre (**3005**).

## Sin commit
- `tests/carga/ui.ts` y `tests/carga/c8.ts`: arreglos válidos (capturan el id de la factura y el texto real del inicio, «Resumen del negocio»).
- `docs/pruebas/resultados/ui-log.txt`: medición inválida (ver el aviso).
- `docs/pruebas/INSTRUCCIONES-PRUEBAS.md`, `cuadre.sql`, `linea-base-antes.md`, `PROMPT-*.md`: documentos de las pruebas.
- `.serena/`: no tocar ni hacerle commit.

## Lo que falta
1. `pnpm build` y `pnpm start -p 3005`, y repetir `ui.ts` (5 repeticiones × ~30 pantallas) contra `http://localhost:3005`.
2. C8: 5 navegadores a la vez durante 3 minutos (`c8.ts`), después de la medición de pantallas.
3. Prueba 3, cuadre: correr `docs/pruebas/cuadre.sql` (solo lectura), guardarlo en `docs/pruebas/linea-base-despues.md` y compararlo con `linea-base-antes.md` (antes todo daba 0 salvo D6 inventario −97,500).
4. Investigar por qué las listas tardan (solo leer el código y proponer arreglos; no cambiar la app) y buscar otras consultas sin paginar como la del 607.
5. Informe final `docs/pruebas/resultados/RESULTADOS.md`, commit en `test/pruebas-carga`, sin push.
6. Recordar en el informe que junio 2020 quedó reabierto por C6 y que hay datos `ZZTEST-*` en la base: solo se borran con el OK de Waldy.
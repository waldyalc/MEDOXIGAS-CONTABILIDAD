# Supabase — reglas para agentes

Tablas: `tanques`, `isos`, `llenados`, `lecturas_reloj`, `alertas`. Vistas: `v_produccion_diaria`, `v_merma_iso`, `v_merma_iso_pct`, `v_llenados`. Bucket `relojes` (fotos del reloj). Detalle del dominio en `../docs/dominio-produccion.md`.

Caja Chica: `perfiles`, `cc_sesiones`, `cc_conceptos`, `cc_camiones`, `cc_empleados`, `cc_rapidos`, `cc_gastos`, `cc_bitacora`. Vistas: `v_cc_sesion`, `v_cc_libro`. Bucket `caja-recibos` (fotos de recibos). Detalle del dominio en `../docs/dominio-caja-chica.md`.

Punto de Venta: `pos_productos`, `pos_turnos`, `pos_ventas`, `pos_venta_lineas`, `pos_movimientos`. Escritura solo por RPC `pos_*` (mismo patrón que `cc_*`: security definer, rol en `perfiles`, sin DELETE). Detalle en `../docs/dominio-pos.md`.

## Comandos (solo local, NUNCA contra producción)

```bash
supabase start        # levanta la pila local (Docker)
supabase test db      # pgTAP: supabase/tests/*_test.sql (hace rollback solo)
pnpm db:types         # regenera src/lib/supabase/types.ts tras cada migración
```

## Migraciones

- Archivo nuevo en `supabase/migrations/`, nunca editar uno aplicado. Nada que borre o cambie datos sin OK de Waldy.
- `fecha` en `lecturas_reloj` y `llenados` es columna generada: no insertarla.
- Probar en local (`supabase start` + `supabase db reset`) antes del PR.

## RLS (núcleo de seguridad)

- `authenticated` solo **lee**. En producción escribe únicamente el pipeline con `service_role`. En caja chica se escribe SOLO vía RPC `cc_*` (security definer; el rol sale de `perfiles`, aprobado por Waldy): las tablas `cc_*` y `perfiles` no tienen políticas de escritura y el DELETE está prohibido con revoke + trigger. `anon` no ve nada. La app web no escribe producción.
- `service_role` jamás en el cliente ni en prompts: solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en la app.
- Nunca cambiar una política para que un test pase sin el OK de Waldy; nunca desactivar RLS.
- pgTAP cubre: RLS activo en toda tabla pública, lectura por `authenticated` (incluidas las 3 vistas que usa la app), insert negado con 42501 y update/delete que no cambian filas (verificadas con seed), para `authenticated` y `anon`. Al tocar políticas, corre la prueba de mutación descrita en `tests/produccion_rls_test.sql` (política `using (true)` temporal) y documenta el resultado en el PR.
- Caja Chica se prueba en `tests/caja_chica_test.sql`: flujo completo vía RPC con usuarios de prueba (admin/caja/lector), más triggers anti-DELETE (verificados como postgres) e índice de una sola sesión abierta.
- Punto de Venta se prueba en `tests/pos.sql`: RLS, anon sin lectura, RPC con rol admin/caja, total del servidor, numeración secuencial, cierre con movimientos, anti-DELETE y rechazo de escrituras directas/NaN.

# Supabase — reglas para agentes

Proyecto **MEDOXIGAS-CONTABILIDAD** (`ljfdhrnvlsfaweuvnqxz`, ca-central-1).
Flujo contable en corto: `docs/motor-contable.md`. Contrato completo:
`docs/contrato-db.md`.

## Tablas (public)

- `perfiles`: rol por usuario (`admin`, `contador`, `lector`).
- Motor contable (migración `20261113140000_motor_contable.sql`): `empresa`,
  `cuentas`, `config_contable`, `contactos`, `productos`, `numeraciones`,
  `asientos`, `asiento_lineas`, `facturas`, `factura_lineas`,
  `pagos_recibidos`, `facturas_proveedor`, `facturas_proveedor_lineas`,
  `pagos_proveedor`, `gastos_menores`.
- No hay tablas de borradores ni de bancos todavía.

## RPC

RPC de escritura (todas `security definer`, `set search_path = ''`,
transaccionales; exigen rol `admin` o `contador`):

- Catálogo: `crear_contacto`, `actualizar_contacto`, `crear_producto`,
  `actualizar_producto`.
- Documentos: `crear_factura`, `registrar_pago_recibido`,
  `crear_factura_proveedor`, `registrar_pago_proveedor`, `crear_gasto_menor`.
- Anulación: `anular_documento(p_tipo, p_id)`.
- Internas (sin permiso para la app): `rol_actual`, `_crear_asiento`,
  `_cuenta_config`, `_validar_cuenta_movimiento`, `_validar_asiento_cuadrado`.

Reportes (`stable`, `security invoker`, respetan RLS): `reporte_libro_diario`,
`reporte_balance_comprobacion`, `reporte_estado_resultados`, `reporte_cxc`.

## Comandos (solo local, NUNCA contra producción)

```bash
supabase start        # levanta la pila local (Docker)
supabase test db      # pgTAP: supabase/tests/*_test.sql (hace rollback solo)
pnpm db:types         # regenera src/lib/supabase/types.ts tras cada migración
```

## Migraciones

- La migración del motor ya está aplicada en el proyecto de prueba. No editarla:
  cualquier cambio va en una **migración nueva**.
- Archivo nuevo en `supabase/migrations/`, nunca editar uno aplicado. Nada que
  borre o cambie datos sin OK de Waldy.
- Probar en local (`supabase start` + `supabase db reset`) o en `BEGIN/ROLLBACK`
  antes de aplicar.

## RLS (núcleo de seguridad)

- RLS activo en toda tabla de `public`. `anon` no ve nada. `authenticated` lee
  según su rol; las escrituras de negocio van por RPC (security definer, rol
  leído de `perfiles`), sin DELETE físico en documentos contables (se anulan).
- `perfiles`: cada usuario lee solo su fila; nadie escribe desde la app (los crea
  el admin por SQL/service_role).
- `service_role` jamás en el cliente ni en prompts: la app solo usa
  `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clave publicable).
- Nunca cambiar una política para que un test pase sin el OK de Waldy; nunca
  desactivar RLS.

## pgTAP

- Corre en CI, job **Supabase** (`supabase test db`), y en local con el mismo
  comando.
- `tests/perfiles_test.sql`: 5 asserts.
- 103 asserts en 7 archivos `tests/motor_*_test.sql`: esquema/RLS (26),
  factura (20), pagos (11), compras (13), gasto menor (9), anulación (14) y
  reportes (10).

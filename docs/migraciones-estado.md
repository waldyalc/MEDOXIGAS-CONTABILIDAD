# Estado de las migraciones de Supabase

Proyecto: **MEDOXIGAS-CONTABILIDAD** (`ljfdhrnvlsfaweuvnqxz`, ca-central-1).
Fecha de esta auditoría: 19 nov 2026.

## Resumen

- El directorio `supabase/migrations/` tiene **58 archivos `.sql`**, todos aplicados en el proyecto remoto.
- La última versión del historial es **`20261123000000`** (`tipos_entrada_diario`).
- El bloque se reparte así:
  - **42 migraciones históricas aplicadas el 13–14 nov** (`20261113132637_perfiles.sql` … `20261116200000_pagos_multifactura.sql`).
  - **16 migraciones** del 17–23 nov: 10 con el mismo prefijo en remoto y local, y 6 con prefijo remoto distinto porque se aplicaron por MCP el 18 nov.
- Esta auditoría **no cambia SQL**: solo renombra archivos locales cuando el orden de dependencias lo permite y documenta los desfases que quedan.
- El candado `src/lib/supabase/migraciones.test.ts` corre con `pnpm test` y rechaza archivos mal nombrados, prefijos repetidos, archivos vacíos, archivos sueltos y timestamps de calendario inválidos en migraciones nuevas.

> **Conteo:** 42 + 10 + 6 = **58**. Cualquier referencia anterior a “56 migraciones” quedó corta: el directorio real tiene 58 archivos.

## Convención obligatoria para toda migración nueva

1. **Nombre:** `YYYYMMDDHHMMSS_descripcion_corta.sql`.
   - `descripcion_corta` en minúsculas, solo `[a-z0-9_]`.
   - El prefijo es de **14 dígitos exactos**.
2. **Prefijo mayor que la frontera histórica:** `> 20261123000000`.
   - Es la versión máxima actual. Supabase aplica los archivos en orden lexicográfico; un prefijo menor o igual se mezcla con historial ya aplicado y `supabase db push` puede considerarlo aplicado o saltarlo.
3. **Timestamp UTC de calendario real:** `MM` 01–12, `DD` válido para el mes (01–31; febrero solo 29 en año bisiesto), `HH` 00–23, `mm` 00–59, `ss` 00–59.
   - Ejemplo válido: `20261125143000_ajuste_reporte_cxc.sql`.
   - Ejemplo inválido: `20261123240000_...` (hora 24), `20261132000000_...` (día 32), `20261123006000_...` (minuto 60).
4. **Si la fecha real es anterior a 2026-11-23**, no uses esa fecha: el historial ya está en el futuro. Elige el siguiente prefijo válido después de la frontera, por ejemplo `20261123000001_mi_cambio.sql`, o cualquier timestamp UTC real posterior a `20261123000000`. Lo importante es que sea **estrictamente mayor** y de calendario válido.
5. **Nunca edites una migración ya aplicada.** Cualquier corrección va en un archivo nuevo.
6. Antes de terminar: `pnpm test` (candado) y, si hay Docker/CLI, `supabase start` + `supabase db reset` en local. Nunca contra el proyecto real.

## Bloque reciente (17–23 nov): archivo local, versión remota y dependencias

| Archivo local | Versión remota | ¿Coincide? | Dependencias clave |
| --- | --- | --- | --- |
| `20261117100000_perf_inicio_catalogo.sql` | `20261117100000` | Sí | `asientos`, `asiento_lineas`, `cuentas`; índice de cobertura y RPC `saldos_caja_banco` / `catalogo_saldos`. |
| `20261117200000_anular_ajuste_costo.sql` | `20261117200000` | Sí | Envuelve `anular_documento`; `ajustes_inventario`, `existencias`, motor de inventario (20261114500000 y 20261114900000). |
| `20261117210938_producto_campos_alegra.sql` | `20261117210938` | Sí | Altera `productos` (`unidad_medida`, `almacen_id`, `vende_negativo`, `imagen_path`) y `existencias`; wrappers de producto; bucket `productos`; `almacenes` / `_almacen_principal`. |
| `20261117300000_numeraciones_notas.sql` | `20261117300000` | Sí | Reemplaza `actualizar_numeracion`; `numeraciones`, `facturas`, `gastos_menores`, `notas_credito_venta`, `notas_debito_venta`, `notas_credito_compra`. |
| `20261118000000_saldos_iniciales.sql` | `20261118000000` | Sí | `asientos.origen_tipo` (incluye `saldo_inicial`), `config_contable.ajustes_iniciales`, `registrar_saldos_iniciales`; cuentas del patrimonio. |
| `20261118155048_busqueda_global.sql` (antes `20261118100000`) | `20261118155048` | Sí | `pg_trgm`, `unaccent`, `normalizar`, 12 índices GIN y `buscar_global`; lee contactos, productos, facturas, notas, pagos, compras, gastos, asientos y cuentas. |
| `20261118181348_busqueda_global_rapida.sql` (antes `20261119100000`) | `20261118181348` | Sí | Solo `create or replace buscar_global`; depende de `normalizar` y de los índices de `20261118155048`. |
| `20261118190224_vende_negativo_motor.sql` (antes `20261120110000`) | `20261118190224` | Sí | `productos.vende_negativo` (ya venía de `20261117210938`, aquí va con `if not exists`), `crear_factura` envuelta, `almacenes`, `existencias`, `_almacen_principal`. |
| `20261118190225_auditoria.sql` (antes `20261120100000`) | `20261118190225` | Sí | Tabla `auditoria`, `_auditar`, `obtener_auditoria` y triggers en facturas, compras, contactos, productos, pagos, notas de crédito y asientos; depende de `perfiles` / `rol_actual`. |
| `20261120120000_limite_credito.sql` | `20261120120000` | Sí | Única migración que crea `contactos.limite_credito` con `add column if not exists` (`numeric(14,2)`). No toca datos. |
| `20261120120100_limite_credito_rpc.sql` | `20261118190259` | **No** | **Depende de la columna de `20261120120000`.** Reemplaza `crear_contacto` y `actualizar_contacto`; **no** hace `add column` (no tiene `ADD COLUMN IF NOT EXISTS`): solo lee y escribe `limite_credito`. No se puede renombrar antes de la columna. |
| `20261121100000_auditoria_limite_credito.sql` | `20261118190729` | **No** | **Depende de `_auditar` del trigger de `20261118190225` y de la columna de `20261120120000`.** Recrea `auditoria_contactos` agregando `limite_credito` a los campos vigilados; no crea la columna ni la función. No se puede renombrar antes de ambas. |
| `20261121120000_adjuntos.sql` | `20261121120000` | Sí | Tabla `adjuntos`, RLS, RPCs de subir/borrar/descargar y bucket `documentos`; depende de `perfiles` / `rol_actual` y `storage`. |
| `20261122000000_busqueda_desplazamiento.sql` | `20261122000000` | Sí | Reemplaza `buscar_global` para arreglar el desplazamiento; depende de `normalizar` y de la versión de `20261118181348`. |
| `20261122100000_numeracion_crear.sql` | `20261122100000` | Sí | Crea `crear_numeracion`; depende de `numeraciones` y de `actualizar_numeracion`. |
| `20261123000000_tipos_entrada_diario.sql` | `20261123000000` | Sí | Tabla `tipos_entrada_diario`, `asientos.tipo_entrada_id` / `asientos.codigo`, RPCs de tipos y reemplazo de `crear_asiento_manual`; depende de `asientos` / `rol_actual`. |

## Renombres aplicados (solo nombre, nunca contenido SQL)

Se renombraron **4 archivos** para que su prefijo coincida con la versión real del remoto. `git` los detecta como renames puros: no se editó una sola línea de SQL.

| Antes | Después (versión remota) |
| --- | --- |
| `20261118100000_busqueda_global.sql` | `20261118155048_busqueda_global.sql` |
| `20261119100000_busqueda_global_rapida.sql` | `20261118181348_busqueda_global_rapida.sql` |
| `20261120100000_auditoria.sql` | `20261118190225_auditoria.sql` |
| `20261120110000_vende_negativo_motor.sql` | `20261118190224_vende_negativo_motor.sql` |

Justificación de dependencias, en el orden final:

- `20261118155048_busqueda_global` sigue después de `20261118000000_saldos_iniciales` y antes de `20261118181348_busqueda_global_rapida`.
- `20261118181348_busqueda_global_rapida` sigue después de `busqueda_global` (`normalizar` e índices) y antes de `20261122000000_busqueda_desplazamiento`.
- `20261118190224_vende_negativo_motor` solo necesita `productos.vende_negativo` (ya creada en `20261117210938`), `crear_factura`, `almacenes`, `existencias` y `_almacen_principal`; no depende de auditoría ni de límite de crédito.
- `20261118190225_auditoria` solo necesita tablas creadas antes de `20261118000000` y `perfiles` / `rol_actual`; no depende de `vende_negativo` ni de `limite_credito`.
- Los dos archivos cambiaron su orden relativo (`antes auditoría iba antes que vende_negativo`), pero son independientes; el remoto ya los tiene en el mismo orden (`18190224` y luego `18190225`).
- `20261121100000_auditoria_limite_credito` sigue después de `20261118190225_auditoria` y de `20261120120000_limite_credito`.
- `20261122000000_busqueda_desplazamiento` sigue después de `20261118181348_busqueda_global_rapida`.

## Por qué `limite_credito_rpc` y `auditoria_limite_credito` conservan su prefijo local

El remoto las registró como `20261118190259` y `20261118190729` (aplicadas por MCP el 18 nov), pero **no se renombran**:

1. `20261120120100_limite_credito_rpc.sql` reemplaza `crear_contacto` y `actualizar_contacto` con `insert` / `update` sobre `contactos.limite_credito`. Esa columna la crea `20261120120000_limite_credito.sql`. El archivo de la RPC **no** tiene `ADD COLUMN IF NOT EXISTS`: si se moviera a `20261118190259`, quedaría antes de la columna que necesita.
2. `20261121100000_auditoria_limite_credito.sql` hace `drop trigger` / `create trigger` sobre `contactos` usando `_auditar` (creada en `20261118190225_auditoria.sql`) y agrega `limite_credito` a los campos vigilados. Si se moviera a `20261118190729`, quedaría antes de `20261120120000_limite_credito.sql` y antes de que exista la columna que audita.

Aunque `create or replace function` puede crear una función PL/pgSQL sin resolver todavía las columnas, la dependencia es real y cualquier llamada entre ambas versiones fallaría. La regla de oro es no renombrar si el orden de dependencias deja de ser 100 % seguro, así que se quedan como están.

## Deuda histórica 13–14 nov (42 archivos)

Las 42 migraciones de `20261113132637_perfiles.sql` a `20261116200000_pagos_multifactura.sql` **no se renombran**:

- En remoto quedaron registradas con los timestamps reales de aplicación MCP (`20261113132637` … `20261114025508`), que no coinciden 1:1 con los nombres locales (los locales usan timestamps de planificación, algunos con horas “lógicas” como `240000` o `300100`).
- Son la base histórica que ya probó `supabase start && supabase test db` en CI. Sin un mapeo exacto verificado, renombrarlas sería un riesgo innecesario.
- Esto solo afecta a `supabase db push` / `supabase migration list`; `supabase db reset` local usa los nombres locales y aplica todo en orden.

### Reparación de historial (solo si algún día se usa `supabase db push`)

`supabase migration repair` **no ejecuta SQL**: solo agrega o quita versiones de `supabase_migrations.schema_migrations`. Requiere el proyecto vinculado (`supabase link --project-ref ljfdhrnvlsfaweuvnqxz`) o `--db-url`, y el OK de Waldy. Antes de correrlo, guarda la salida de `supabase migration list` y confirma que el SQL ya está aplicado en remoto.

Para los dos archivos que conservan su prefijo local:

```bash
# El SQL ya está aplicado en remoto; se alinea el historial, no se reejecuta.
supabase migration repair --status reverted 20261118190259
supabase migration repair --status applied 20261120120100
supabase migration repair --status reverted 20261118190729
supabase migration repair --status applied 20261121100000
```

Para el bloque histórico de 42 archivos, el mapeo exacto se obtiene del listado remoto (no está transcrito en el repo):

```bash
# 1) Ver el mapeo remoto vs local (solo lectura).
supabase migration list

# 2) Por cada versión remota del 13-14 nov que no tenga archivo local:
supabase migration repair --status reverted <version_remota>

# 3) Por cada archivo local del 13-14 nov que no esté registrado en remoto:
supabase migration repair --status applied <version_local>
```

Los 4 archivos renombrados en esta auditoría ya coinciden con el remoto y no necesitan reparación.

## Cómo se verifica

- **Candado local:** `pnpm test` ejecuta `src/lib/supabase/migraciones.test.ts`. Revisa formato, duplicados, orden, archivos vacíos, archivos sueltos y timestamps de calendario de las migraciones nuevas. También fija en **58** el número de archivos del bloque histórico (`<= 20261123000000`): si alguien agrega o borra uno, el test falla a propósito.
- **Base local:** si hay Docker y Supabase CLI, `supabase start` + `supabase db reset` aplica los 58 archivos desde cero en orden lexicográfico. Es la prueba real del orden de dependencias.
- **CI:** el workflow `Supabase` corre `supabase start` y `supabase test db`; se dispara con cambios en `supabase/**`.
- **Remoto:** no se tocó. Renombrar un archivo local no cambia el SQL aplicado ni el historial de `schema_migrations`.

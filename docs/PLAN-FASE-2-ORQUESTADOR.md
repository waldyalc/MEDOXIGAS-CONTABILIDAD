# Prompt y Plan Maestro — Fase 2 (Inventario Ferretería, POS y Nómina RD)

> **Cómo usar este archivo:** Abre una nueva sesión de Orquestador (p. ej. con **GLM 5.3 Max**) y dile:
> *"Lee `docs/PLAN-FASE-2-ORQUESTADOR.md` y ejecútalo paso a paso como Orquestador."*

---

## Rol y reglas de arranque

Eres el **Orquestador / Tech Lead** de **Medoxigas Contabilidad** (`waldyalc/MEDOXIGAS-CONTABILIDAD`).

1. Lee primero `AGENTS.md`, `docs/ORQUESTADOR.md`, `HANDOFF.md`, `supabase/AGENTS.md` y `docs/motor-contable.md`.
2. **Tu trabajo es diseñar/refinar contratos, dividir en tareas con archivos disjuntos, delegar, revisar diffs reales y checks de CI (`ci`, `db`, `scan`, `e2e`), e integrar a `main` en PRs acotados (<400 líneas fuera de generados/lockfile).**
3. Modelo por defecto para subagentes (`delegate_task` con `isolation: "worktree"`):
   `providerInstanceId: "opencode_2"`, `model: "opencode-go/deepseek-v4.1-flash"`, `options: { variant: "max" }`. Llama `orchestrator_capabilities` una sola vez al inicio.
4. **Sin multi-empresa:** este repositorio es single-tenant (`empresa` fila única `id = 1`). La ferretería correrá en otro repositorio, otro dominio y otro proyecto de Supabase aparte. **No** agregues `empresa_id` ni lógica multi-empresa. Simplemente evita hardcodear textos propios de Medoxigas en tablas/RPCs/tickets (usa siempre `empresa.nombre`, `empresa.rnc`, etc.).
5. **Anti-confusión de marca:** Alegra usa teal `#00b19d`; **nuestro sistema usa únicamente los tokens del tema (`--primary` azul `#1e56c7`, ver `docs/plantilla-diseno.md`) y shadcn/Base UI**. Ningún subagente debe copiar colores hex, HTML ni CSS crudos de Alegra.
6. **Prueba visual obligatoria (regla de Waldy):** toda tarea de UI entrega capturas en claro y oscuro hechas por el subagente (Playwright sobre el dev server de su worktree) y se le muestran a Waldy para su visto bueno antes de cerrar.

---

## Visión del sistema (todo integrado sobre un solo motor contable)

No estamos creando mini-sistemas aislados ni sincronizaciones lentas como Alegra. Todo comparte **el mismo Postgres, el mismo motor de doble partida (`asientos`/`asiento_lineas`), el mismo catálogo de productos/existencias y los mismos documentos reales**:

1. **Inventario nivel Ferretería (en Contabilidad → Inventario):** única fuente de la verdad del inventario, extendida para ferretería de alto volumen y optimizada para responder en milisegundos al POS.
2. **Punto de Venta — POS (pestaña nueva `/pos` vía `newTab: true`):** es **la misma contabilidad pero mucho más simple y rápida** para operar mostrador:
   - Crear una factura en el POS crea una fila real en `facturas` → **aparece automáticamente en Ingresos → Facturas de venta**, descarga inventario y asienta contabilidad al instante.
   - Crear una cotización rápida desde el carrito del POS crea una fila real en `cotizaciones` → **aparece en Ingresos → Cotizaciones**, y cualquier cotización abierta se puede cargar al carrito del POS para cobrarla/convertirla en factura en segundos.
   - Impresión dual desde el POS: **Ticket térmico (80 mm / 57 mm)** *y* **PDF formato Carta** (reutilizando `DocumentoPapel` y `plantillas_impresion` ya existentes en Contabilidad).
   - Solo tiene **Vender (facturas y cotizaciones rápidas), Turnos (abrir/cerrar + entradas y salidas de efectivo), Historial de ventas del POS y Devoluciones**. **NO** duplica Inventario ni Configuración (esos viven en Contabilidad).
3. **Nómina RD (menú desplegable/toggle dentro de Contabilidad — NO abre pestaña nueva):**
   - Replica el flujo completo de Alegra Nómina (Empleados → Periodos/Recibos → Novedades → Liquidar → Contabilizar → Enviar colillas → Pagar).
   - **Toda su configuración vive en una nueva sección "Nómina" dentro de `/dashboard/configuracion`** (sin módulo de Configuración duplicado, sin Suscripciones ni Bandeja).
   - Contabiliza de forma síncrona y atómica generando comprobantes `NO-*` por empleado (el tipo de entrada de diario `NO` ya está sembrado en `tipos_entrada_diario`) y valida cédulas con `_rnc_digito_valido` (ya existe en BD).

---

## Candados del repositorio que debes cumplir en cada migración

Antes de dar por bueno cualquier PR de backend, verifica todos estos candados reales del repo:

- **Orden y fecha de migraciones (`src/lib/supabase/migraciones.test.ts`):** nombre `YYYYMMDDHHMMSS_descripcion_en_snake_case.sql` con timestamp UTC válido y **estrictamente mayor** al último archivo existente en `supabase/migrations/` (actualmente `20261124120000_config_dgii_rnc.sql` → usar `20261125...` en adelante). Nunca editar migraciones aplicadas.
- **Clasificación en script de base virgen (`src/lib/supabase/reset-virgen.test.ts`):** **toda tabla nueva** creada en `supabase/migrations/` debe quedar clasificada en el mismo PR dentro de `docs/pruebas/reset-base-virgen.sql` (transaccional en `TRUNCATE` + array de verificación, o `-- @conservar public.<tabla>` si es catálogo/configuración). Si falta una sola tabla, `pnpm test` falla.
- **Origen de asientos (`asientos_origen_tipo_check`):** ampliar el `CHECK` de forma aditiva cuando se agreguen nuevos orígenes (`pos_movimiento`, `pos_diferencia`, `nomina`, `pago_nomina`) y mapear sus etiquetas en el frontend (`src/lib/`).
- **Seguridad y RLS (`supabase/AGENTS.md`):** RLS habilitado en toda tabla nueva (`anon` sin acceso, `authenticated` con perfil solo `SELECT`, escrituras únicamente vía RPC `security definer`, `set search_path = ''`, rol `admin`/`contador`, errores claros en español). Sin `DELETE` físico en documentos contables.
- **Dinero y RPCs:** `numeric(14,2)` en BD, cálculos e impuestos siempre en servidor, `supabase.rpc("nombre", args)` siempre directo (`src/lib/rpc-sin-extraer.test.ts`).
- **Documentación y tests obligatorios por módulo:** `docs/dominio-<modulo>.md` primero → migración SQL + `supabase/tests/<modulo>_test.sql` (pgTAP con RLS + invariantes) + `src/lib/supabase/types.ts` actualizado (job `db` de CI en verde) → capa `src/lib/<modulo>/` con Vitest → UI con capturas.
- **Producción:** nunca aplicar migraciones al remoto (`ljfdhrnvlsfaweuvnqxz`) sin aprobación explícita de Waldy.

---

## FASE 0 — Limpieza de los PRs de documentación de Devin (#59 y #62) [Ejecutar primero]

Antes de que ningún subagente consulte `docs/alegra/` para POS o Nómina, corrige los problemas detectados en los PRs abiertos de Devin:

1. **PR #59 (`feat/alegra-pos-docs`) — NO hacer merge commit:**
   - El commit `1ea896c` metió 6 archivos HTML/CSS crudos de Alegra en el historial Git (aunque `42ee70d` los borró, siguen en la historia y contaminarían `main`).
   - El comentario del bot en PR #59 publicó un enlace presigned público a `alegra-pos-completo.zip` (pedir a Waldy borrar ese comentario en GitHub).
   - La captura `22-ticket-imprimir.png` expone datos personales del titular en el encabezado del ticket (correo y teléfono). **Censurar/recortar esos datos o excluir esa imagen antes de subirla a `main`.**
   - `design-alegra-pos.md` y `css-pos/GUIA-POS.md` ordenan erróneamente usar `#00b19d` (teal de Alegra) en Medoxigas.
   - `css-pos/NOTA.md` referencia archivos HTML/CSS ya borrados y dejó `css-pos/.procesar.py` commiteado.
   - **Acción:** cerrar PR #59 y crear una rama limpia desde `main` con los archivos depurados ordenados en `docs/alegra/pos/` (sin `.procesar.py`, sin `NOTA.md` roto, sin HTML/CSS en la historia, y sin datos personales en capturas).
2. **PR #62 (`devin/1795185628-alegra-nomina-docs`):**
   - Su historial sí está limpio (1 commit sin HTML/CSS crudos y `design/.gitignore` correcto), pero commiteó `NOTAS-CRUDAS.md` (15 KB de notas crudas innecesarias). Eliminar `NOTAS-CRUDAS.md` y revisar que no haya datos personales reales.
3. **Encabezado anti-confusión obligatorio** al inicio de los docs de POS (`docs/alegra/pos/`) y Nómina (`docs/alegra/nomina/`):
   - Usar únicamente tokens de `docs/plantilla-diseno.md` (`--primary` azul, **nunca `#00b19d`**).
   - POS: solo Vender (facturas + cotizaciones rápidas), Turnos (entradas/salidas de efectivo), Historial POS y Devoluciones; Inventario y Configuración viven en Contabilidad.
   - Nómina: menú toggle dentro de Contabilidad (sin pestaña nueva); Configuración en `/dashboard/configuracion` → sección "Nómina"; sin Suscripciones ni Bandeja.

---

## FASE 1 — Backend: Inventario nivel Ferretería + Catálogo ultrarrápido para POS

**Referencia base:** tablas actuales `productos`, `existencias`, `almacenes`, `listas_precios`, `producto_precios`, `ajustes_inventario`, `transferencias_inventario` y migraciones `20261117210938`, `20261118190224`, `20261124100000`, `20261124100100`.

### Contrato de datos y RPCs (redactar `docs/dominio-inventario-ferreteria.md` primero)

1. **Identificación, ubicación y búsqueda <20 ms:**
   - Columnas aditivas en `productos`: `marca text`, `favorito_pos boolean not null default false`, `ubicacion text` (pasillo/estante por defecto).
   - Columna aditiva en `existencias`: `ubicacion text` (pasillo/estante por almacén).
   - Tabla `producto_codigos_barra` (`id`, `producto_id`, `unidad_id uuid null`, `codigo text not null`, `principal boolean default false`, `creado_en`), con índice `UNIQUE (lower(trim(codigo)))` para soportar EAN/UPC de fabricante, SKU interno y códigos por empaque.
   - Extensión `pg_trgm` + índices GIN trigrama en `productos` (`nombre`, `referencia`, `marca`) + índice compuesto `productos(activo, favorito_pos, categoria_id)`.
   - Índices de apoyo en líneas de movimiento (`factura_lineas(producto_id)`, `facturas_proveedor_lineas(producto_id)`, `ajuste_inventario_lineas(producto_id)`) para Kardex instantáneo.

2. **Unidades de medida con conversión (venta fraccionada de ferretería):**
   - Tabla `producto_unidades` (`id`, `producto_id`, `nombre text` ej. "Caja 50 lb" / "Rollo 100 m" / "Metro" / "Libra", `factor_base numeric(14,4) check (factor_base > 0)`, `precio numeric(14,2) null`, `es_compra boolean default false`, `es_venta boolean default true`, `activa boolean default true`).
   - **Invariante:** `existencias.cantidad` y `productos.costo` (promedio ponderado) **siempre** se mantienen en la **unidad base** del producto.
   - Al vender (`crear_factura`) o comprar (`crear_factura_proveedor`) una línea con `unidad_id`, la RPC convierte `cantidad_base = round(cantidad * factor_base, 2)` para validar stock (`vende_negativo`), mover existencias y calcular costo de venta / nuevo costo promedio.
   - Guardar `unidad_id`, `unidad_nombre` y `factor_base numeric(14,4) not null default 1` en `factura_lineas`, `cotizacion_lineas`, `nota_credito_venta_lineas` y `facturas_proveedor_lineas` (aditivo, nullable en `unidad_id`) para impresión exacta y devoluciones coherentes.

3. **Combos / Kits reales (`combo_componentes`):**
   - `productos.tipo = 'combo'` ya existe en BD pero no descuenta sus partes. Crear `combo_componentes` (`id`, `combo_id`, `componente_id`, `cantidad numeric(14,2) check > 0`, `UNIQUE (combo_id, componente_id)`, `CHECK (combo_id <> componente_id)`).
   - En RPCs de combo: prohibir combos anidados (un componente no puede ser otro combo) y validar que el componente sea `tipo = 'producto'`.
   - En `crear_factura` y `crear_nota_credito_venta`: cuando la línea es un `combo`, validar `vende_negativo` sobre cada componente inventariable (bloqueando `existencias` en orden fijo por `producto_id` con `FOR UPDATE`), descontar/reingresar cada componente en el almacén del documento y calcular el asiento de costo de ventas con la suma real de los costos promedio vigentes de sus componentes.

4. **Conteo físico / Toma de inventario:**
   - Tablas `conteos_inventario` (`id`, `numero int unique`, `almacen_id`, `fecha`, `estado ('borrador','aplicado','anulado')`, `ajuste_id uuid null`, `notas`, `creado_por`, `creado_en`) y `conteo_inventario_lineas` (`id`, `conteo_id`, `producto_id`, `cantidad_sistema`, `cantidad_contada`, `diferencia`, `notas`).
   - RPCs: `crear_conteo_inventario`, `guardar_lineas_conteo`, `aplicar_conteo_inventario` (congela diferencias y llama internamente a `crear_ajuste_inventario` en la misma transacción para ajustar stock y generar su asiento contable), `anular_conteo_inventario` (solo borradores).

5. **RPCs de lectura rápida (`stable`, `security invoker`):**
   - `pos_buscar_por_codigo_barra(p_codigo text, p_almacen_id uuid, p_lista_precio_id uuid)` → match exacto instantáneo (producto + unidad asociada al código + stock del almacén + precio resuelto por lista + tasa ITBIS).
   - `pos_catalogo_productos(p_almacen_id uuid, p_lista_precio_id uuid, p_busqueda text, p_categoria_id uuid, p_solo_favoritos boolean, p_limit int, p_offset int)` → una sola ida a BD sin N+1, con stock del almacén, precio efectivo, imagen, unidades activas y disponibilidad calculada de combos.
   - `reporte_stock_bajo(p_almacen_id uuid)` → productos inventariables activos con `cantidad <= minimo`, ordenados por criticidad, con cantidad sugerida hasta `maximo`.

### Reparto sugerido de subagentes (Fase 1)
- **1A (BD + pgTAP):** `docs/dominio-inventario-ferreteria.md` + migración SQL + `docs/pruebas/reset-base-virgen.sql` + `supabase/tests/inventario_ferreteria_test.sql` + `src/lib/supabase/types.ts`.
- **1B (Capa TS `src/lib/` — tras 1A):** schemas Zod, queries y server actions (`supabase.rpc` directo) + tests Vitest.
- **1C (UI Inventario — tras 1B):** códigos de barras, unidades con conversión, marca/ubicación, favorito POS y receta de combos en edición/ficha de producto + pantalla de Conteo físico + vista de Stock bajo (con capturas claro/oscuro).

---

## FASE 2 — Backend: Módulo Punto de Venta (POS)

**Referencia funcional y visual:** `docs/alegra/pos/` (ya depurado en Fase 0) + `src/components/documento-venta/documento-papel.tsx` para PDF Carta.

### Contrato de datos y RPCs (redactar `docs/dominio-pos.md` primero)

1. **Tablas nuevas:**
   - `pos_terminales` *(catálogo/configuración → `@conservar` en `reset-base-virgen.sql`; se administra en `/dashboard/configuracion/pos`)*:
     `id`, `nombre`, `almacen_id`, `cuenta_efectivo_id` (`es_caja_banco = true`), `cuenta_tarjeta_debito_id`, `cuenta_tarjeta_credito_id`, `cuenta_transferencia_id`, `numeracion_defecto_id`, `lista_precio_defecto_id`, `contacto_defecto_id` (Consumidor Final), `centro_costo_id`, `plantilla_ticket jsonb` (`estilo: 'clasico'|'minimalista'|'detallado'`, `ancho_mm: 80|57`, `fuente`, `tamano_letra`, `interlineado`, toggles: `mostrar_logo`, `mostrar_vendedor`, `mostrar_descripcion`, `mostrar_referencia`, `mostrar_precio_unitario`, `mostrar_unidad`, `precios_con_impuestos`, `pie_ticket`), `activa`.
   - `pos_turnos` *(transaccional → `TRUNCATE`)*:
     `id`, `numero int unique`, `terminal_id`, `abierto_por`, `cerrado_por`, `abierto_en timestamptz`, `cerrado_en timestamptz`, `estado ('abierto','cerrado')`, `base_inicial numeric(14,2)`, `efectivo_esperado numeric(14,2)`, `efectivo_real numeric(14,2)`, `diferencia numeric(14,2)`, `asiento_diferencia_id uuid null`, `observaciones`.
     **Candado de concurrencia:** `CREATE UNIQUE INDEX pos_turnos_terminal_abierto_uniq ON public.pos_turnos (terminal_id) WHERE estado = 'abierto';`.
   - `pos_turno_movimientos` *(transaccional → `TRUNCATE`)*:
     `id`, `numero int unique`, `turno_id`, `tipo ('ingreso','retiro')`, `motivo ('fondo_caja','cobro_factura','retiro_caja','gasto_menor','deposito_banco','otro')`, `monto numeric(14,2) check > 0`, `cuenta_contrapartida_id`, `contacto_id null`, `factura_id null`, `asiento_id`, `pago_recibido_id null`, `gasto_menor_id null`, `notas`, `creado_por`, `creado_en`.

2. **Extensiones aditivas a tablas existentes (cero ruptura a Contabilidad):**
   - `facturas`: `turno_id uuid references pos_turnos(id)`, `origen text not null default 'contabilidad' check (origen in ('contabilidad','pos'))`, `monto_recibido numeric(14,2)`, `cambio numeric(14,2)`.
   - `cotizaciones`: `origen text not null default 'contabilidad' check (origen in ('contabilidad','pos'))`, `turno_id uuid references pos_turnos(id)`.
   - `pagos_recibidos`: `turno_id uuid references pos_turnos(id)`.
   - `notas_credito_venta`: `turno_id uuid references pos_turnos(id)`, `tipo_reembolso text not null default 'credito_factura' check (tipo_reembolso in ('credito_factura','efectivo','combinado'))`, `monto_reembolso_efectivo numeric(14,2) not null default 0`, `cuenta_reembolso_id uuid references cuentas(id)`.
   - Ampliar `asientos_origen_tipo_check` con `'pos_movimiento'` y `'pos_diferencia'`.
   - Sembrar (idempotente) cuentas de sobrante/faltante de caja bajo Otros ingresos / Otros gastos si no existen, y sus claves en `config_contable` (`sobrante_caja`, `faltante_caja`).

3. **RPCs atómicas del POS (`security definer`, `search_path = ''`):**
   - `pos_crear_terminal` / `pos_actualizar_terminal` (valida que las cuentas de cobro sean `es_caja_banco = true` y activas).
   - `pos_abrir_turno(p jsonb)`: valida terminal activa sin turno abierto, guarda `base_inicial >= 0`.
   - `pos_registrar_movimiento_turno(p jsonb)`: exige turno abierto;
     - si `motivo = 'cobro_factura'` → invoca `registrar_pago_recibido` hacia `terminal.cuenta_efectivo_id` y liga `turno_id`;
     - si `motivo = 'gasto_menor'` → invoca `crear_gasto_menor` pagado desde `terminal.cuenta_efectivo_id`;
     - si `fondo_caja` / `retiro_caja` / `deposito_banco` / `otro` → crea asiento real `pos_movimiento` entre `terminal.cuenta_efectivo_id` y `cuenta_contrapartida_id`.
   - `pos_completar_venta(p jsonb)` **(1 solo round-trip)**:
     - Exige turno abierto y resuelve almacén/cuentas desde la terminal.
     - Soporta líneas de productos (con `unidad_id` y combos), **venta simple** (línea libre sin `producto_id`) y **conversión directa desde una `cotizacion_id` abierta** (marcándola facturada).
     - Llama internamente a `crear_factura` (creando la factura real en `facturas`, con NCF, ITBIS, descarga de inventario y asiento contable).
     - Soporta **pago simple**, **pago combinado** (`pagos: [{ metodo, monto, cuenta_id?, monto_recibido? }]`) y **venta a crédito / pago parcial** (si `sum(pagos) < total`, el saldo queda en CxC y la factura `abierta`, respetando límite de crédito del contacto y bloqueando crédito a Consumidor Final).
     - Calcula `cambio` en servidor solo sobre el efectivo recibido, liga `turno_id` y `origen = 'pos'` en factura y pagos, y retorna el payload completo listo para imprimir ticket o PDF Carta sin consultas extra.
   - `pos_crear_cotizacion(p jsonb)`: atajo del carrito del POS que llama a `crear_cotizacion` (marca `origen = 'pos'` y `turno_id`), quedando visible en **Ingresos → Cotizaciones** e imprimible en ticket o PDF Carta.
   - `pos_crear_devolucion(p jsonb)`: exige turno abierto; soporta `credito_factura`, `efectivo` o `combinado` (exigiendo ambos > 0 y suma = total devolución). Crea NC B04 real (`crear_nota_credito_venta`) devolviendo inventario al costo promedio vigente; por la parte en efectivo, asienta `Dr CxC / Cr cuenta_reembolso_id` (default `terminal.cuenta_efectivo_id`) en la misma transacción, rebajando el efectivo esperado del turno y el saldo de caja POS.
   - `pos_resumen_turno(p_turno_id uuid)` (`stable`, `security invoker`): agrega en SQL ventas totales por método, ingresos, retiros, devoluciones en efectivo y `efectivo_esperado = base_inicial + ventas_efectivo + ingresos_efectivo - retiros_efectivo - devoluciones_efectivo`.
   - `pos_cerrar_turno(p jsonb)`: bloquea el turno `FOR UPDATE`, congela `efectivo_esperado`, guarda `efectivo_real` y `diferencia`; si `registrar_diferencia = true` y `diferencia <> 0`, genera asiento `pos_diferencia` (Dr Caja / Cr Sobrante, o Dr Faltante / Cr Caja).

### Impresión en POS (doble formato)
- **Ticket térmico (80 mm / 57 mm):** componente de impresión `@media print` configurable desde `pos_terminales.plantilla_ticket` (estilos Clásico / Minimalista / Detallado + toggles de contenido) para: Factura POS, Cotización POS, Cierre de turno, Devolución B04 y Recibo de movimiento de caja.
- **PDF Carta / A4:** botón directo "Imprimir PDF (Carta)" en la confirmación de venta, historial POS y cotizaciones rápidas, reutilizando `DocumentoPapel` y `plantillas_impresion` ya existentes en Contabilidad.

### Reparto sugerido de subagentes (Fase 2)
- **2A (BD + pgTAP):** `docs/dominio-pos.md` + migración SQL + `reset-base-virgen.sql` + `supabase/tests/pos_test.sql` (venta simple, combinada, parcial/crédito, desde cotización, devolución combinada, ingresos/retiros, cierre con/sin diferencia, candado de 1 turno abierto por terminal y RLS) + `types.ts`.
- **2B (Capa TS `src/lib/pos/` — tras 2A):** Zod schemas, consultas, server actions (`supabase.rpc` directo) y tests Vitest.
- **2C (Configuración POS + Sidebar — tras 2B):** `/dashboard/configuracion/pos` (terminales, cuentas por método, editor de plantilla de ticket con vista previa en vivo) + tarjeta en `/dashboard/configuracion/page.tsx` + ítem `Punto de venta` (`newTab: true`, `/pos`) en `src/navigation/sidebar/sidebar-items.ts`.
- **2D (UI `/pos` en pestaña nueva — archivos disjuntos de 2C):** `src/app/(pos)/pos/` con layout propio sin sidebar de Contabilidad: pantalla Vender (catálogo ultrarrápido + escáner pistola + favoritos + pestañas paralelas + venta simple F4 + botón "Guardar cotización" / "Cargar cotización" + modal checkout simple/combinado/parcial + confirmación con Imprimir Ticket / Imprimir PDF Carta), Turnos (abrir/cerrar + entradas/salidas + ticket cierre), Historial POS y Devoluciones (wizard 3 pasos). Capturas claro/oscuro obligatorias.

---

## FASE 3 — Backend: Módulo Nómina RD (integrado en Contabilidad)

**Referencia funcional y visual:** `docs/alegra/nomina/ALEGRA-NOMINA.md` y `DESIGN-ALEGRA-NOMINA.md` (con los ajustes de Fase 0: tokens Medoxigas, menú toggle en Contabilidad y configuración dentro de `/dashboard/configuracion`).

**Piezas ya existentes que debes reutilizar:**
- Tipo de entrada de diario `NO` (`Nómina`) ya sembrado en `tipos_entrada_diario` (`20261123000000_tipos_entrada_diario.sql`).
- Validador de cédula/RNC `_rnc_digito_valido(text)` ya existente (`20261124120000_config_dgii_rnc.sql`).

### Contrato de datos y RPCs (redactar `docs/dominio-nomina.md` primero)

1. **Tablas de catálogo/configuración (`@conservar` en `reset-base-virgen.sql`):**
   - `nomina_parametros_rd` (por año fiscal, **sembrado 2026**): `anio int primary key`, `salario_minimo` (`23223.00`), `tasa_sfs_empleado` (`3.04`), `tasa_sfs_empleador` (`7.09`), `tope_sfs_mensual` (10 SM), `tasa_afp_empleado` (`2.87`), `tasa_afp_empleador` (`7.10`), `tope_afp_mensual` (20 SM), `tope_srl_mensual` (4 SM), `tasa_srl_tipo_1` (`1.10`), `tasa_srl_tipo_2` (`1.15`), `tasa_srl_tipo_3` (`1.25`), `tasa_srl_tipo_4` (`1.30`), `tasa_infotep` (`1.00`), `dias_mes_laboral` (`23.83`), `horas_dia_laboral` (`8`), `escala_isr_anual jsonb` (tramos DGII: 0% hasta 416,220; 15% hasta 624,329; 20% hasta 867,123; 25% excedente).
   - `nomina_config_empresa` (`id int primary key default 1 check (id = 1)`): `riesgo_laboral ('tipo_1'|'tipo_2'|'tipo_3'|'tipo_4')`, `categoria_empresa ('micro'|'pequena'|'mediana'|'grande')`, `aplica_infotep boolean default true`, `frecuencia_defecto ('quincenal'|'mensual')`, `cuenta_pago_defecto_id`, `cuenta_salarios_por_pagar_id`, `registrar_provisiones boolean default false`, `contacto_tss_id`, `contacto_infotep_id`, `contacto_dgii_id`.
   - `nomina_conceptos`: sembrado idempotente con los 18 ingresos (Salario, Comisión, Diferencial Vacaciones Ley, Prima Nocturna, Horas Extra 35%, Horas Extra 100%, Regalía Pascual, Bonificación, Cesantía, Preaviso, Viáticos, Otros Ingresos…) + 15 deducciones (SFS, AFP, ISR, Aporte Dependientes, Préstamos, Licencia no remunerada, Licencia médica, Pensión alimenticia, Otros descuentos…) + cargas patronales (SFS empleador, AFP empleador, SRL, INFOTEP) + provisiones (Navidad/Regalía, Vacaciones, Cesantía), con `codigo unique`, `clase ('ingreso'|'deduccion'|'aporte_empleador'|'provision')`, `grava_tss`, `grava_isr`, `grava_infotep`, `es_sistema`, `activo`.
   - `nomina_mapeo_contable`: `UNIQUE (segmento, concepto_id)` con `segmento ('administrativa'|'operativa'|'ventas')`, `cuenta_gasto_id`, `cuenta_pasivo_id`. Sembrar cuentas contables faltantes de nómina RD (sueldos y salarios, horas extras, comisiones, bonificaciones, aportes SFS/AFP/SRL/INFOTEP, retenciones por pagar SFS/AFP/ISR/otros, acumulaciones SRL/INFOTEP, salarios por pagar) de forma idempotente, junto con contactos por defecto para TSS, INFOTEP y DGII si no existen.

2. **Tablas operativas (`TRUNCATE` en `reset-base-virgen.sql`):**
   - `empleados`: `contacto_id` (enlazado o auto-creado en `contactos` para que Libro Mayor y auxiliar por tercero funcionen), `tipo_identificacion ('cedula'|'pasaporte'|'residencia')`, `identificacion` (valida `_rnc_digito_valido` si es cédula), `primer_nombre`, `segundo_nombre`, `primer_apellido`, `segundo_apellido`, `correo`, `telefono`, `municipio`, `direccion`, `cargo`, `area`, `segmento_contable`, `centro_costo_id`, `tipo_contrato ('indefinido'|'definido')`, `fecha_ingreso`, `fecha_fin`, `frecuencia_pago ('quincenal'|'mensual')`, `salario_mensual numeric(14,2)`, `metodo_pago ('efectivo'|'transferencia'|'cheque')`, `banco_nombre`, `tipo_cuenta_banco`, `numero_cuenta_banco`, `clave_tss`, `estado ('activo'|'suspendido'|'inactivo')`.
   - `empleado_novedades_recurrentes`: `empleado_id`, `concepto_id`, `monto`, `porcentaje`, `fecha_inicio`, `fecha_fin`, `activa`, `notas`.
   - `nomina_periodos`: `codigo unique` (ej. `2026-11-Q2`), `frecuencia`, `fecha_inicio`, `fecha_fin`, `fecha_pago`, `anio_fiscal`, `estado ('borrador'|'calculado'|'contabilizado'|'pagado'|'anulado')`, totales agregados (`total_salario`, `total_ingresos`, `total_deducciones`, `total_aportes_empleador`, `total_provisiones`, `total_neto`, `total_costo_empresa`), `observaciones`.
   - `nomina_recibos`: `UNIQUE (periodo_id, empleado_id)`, `dias_trabajados numeric(6,3)`, `salario_base`, `total_ingresos`, `total_deducciones`, `total_aportes_empleador`, `total_provisiones`, `neto_pagar`, `costo_total_empresa`, `estado ('borrador'|'calculado'|'contabilizado'|'pagado'|'anulado')`, `asiento_id` (comprobante `NO-*`), `pago_asiento_id`, `cuenta_pago_id`, `fecha_pagado`, `colilla_enviada_en`, `colilla_enviada_a`.
   - `nomina_recibo_lineas`: `recibo_id`, `concepto_id`, `clase`, `cantidad numeric(10,3)`, `porcentaje numeric(6,3)`, `monto numeric(14,2)`, `origen ('sistema'|'recurrente'|'manual')`, `notas`.
   - Ampliar `asientos_origen_tipo_check` con `'nomina'` y `'pago_nomina'`.

3. **RPCs atómicas de Nómina (`security definer`, `search_path = ''`):**
   - Configuración: `nomina_guardar_config_empresa`, `nomina_guardar_mapeo_contable`, `nomina_crear_concepto`, `nomina_actualizar_concepto`, `nomina_guardar_parametros_rd`.
   - Empleados: `nomina_crear_empleado`, `nomina_actualizar_empleado`, `nomina_cambiar_estado_empleado`, `nomina_guardar_novedad_recurrente`, `nomina_eliminar_novedad_recurrente`.
   - Ciclo secuencial (estricto como Alegra):
     1. `nomina_crear_periodo(p jsonb)`: crea el periodo y genera los recibos `borrador` para los empleados activos de esa frecuencia, aplicando sus novedades recurrentes vigentes.
     2. `nomina_guardar_novedad_recibo` / `nomina_eliminar_novedad_recibo`: solo permitido si el recibo no está `contabilizado`/`pagado`. Autocalcula horas extra 35% (`salario_mensual / 23.83 / 8 * 1.35 * horas`) y 100% (`* 2.00`).
     3. `nomina_calcular_recibo(p_recibo_id)` y `nomina_calcular_periodo(p_periodo_id)`: calcula en servidor días prorrateados por fecha de ingreso/fin, bases TSS con topes proporcionales a la frecuencia (quincenal = tope mensual / 2), SFS empleado (3.04%), AFP empleado (2.87%), ISR asalariados DGII (proyección anual sobre base gravable menos SFS/AFP), cargas patronales (SFS 7.09%, AFP 7.10%, SRL según `riesgo_laboral`, INFOTEP 1%) y provisiones si `registrar_provisiones = true`. Pasa a `calculado`.
     4. `nomina_contabilizar_recibo(p_recibo_id)` y `nomina_contabilizar_periodo(p_periodo_id)`: toma consecutivo `NO-N` de `tipos_entrada_diario` (`FOR UPDATE`), crea **un asiento cuadrado por empleado** (`origen_tipo = 'nomina'`, `codigo = 'NO-N'`) con gastos de ingresos + cargas patronales + provisiones al débito, y retenciones + aportes por pagar + provisiones por pagar + **Salarios por pagar (neto)** al crédito, asignando contactos (TSS, INFOTEP, DGII, empleado) y `centro_costo_id`. Pasa a `contabilizado`.
     5. `nomina_pagar_recibo(p jsonb)` y `nomina_pagar_periodo(p jsonb)`: **candado estricto** — rechaza con `23514` si el recibo no está `contabilizado`. Crea asiento `origen_tipo = 'pago_nomina'`: `Dr Salarios por pagar (contacto empleado)` / `Cr cuenta_pago_id (es_caja_banco = true)` por `neto_pagar`, actualiza `estado = 'pagado'` y recalcula el estado del periodo.
     6. `nomina_registrar_envio_colillas(p jsonb)`: registra envío de volantes de pago por periodo/recibo.
     7. `nomina_anular_pago_recibo` y `nomina_anular_recibo`: si está pagado obliga a anular el pago primero (reversando el asiento de pago); al anular contabilización reversa `NO-N` y permite recalcular o anular.
   - Lecturas/Reportes (`stable`, `security invoker`): `nomina_resumen_periodo`, `nomina_reporte_tss(p_anio int, p_mes int)` (resumen mensual por empleado listo para SUIRPlus / TSS e IR-3).

### Reparto sugerido de subagentes (Fase 3)
- **3A (BD Catálogos + Empleados + pgTAP):** `docs/dominio-nomina.md` + migración SQL parte 1 (config, parámetros RD 2026, conceptos, cuentas semilla, mapeo contable, empleados, novedades recurrentes) + `reset-base-virgen.sql` + pgTAP parte 1.
- **3B (BD Motor de cálculo RD + Contabilización `NO-*` + Pagos + pgTAP — tras 3A):** migración SQL parte 2 (periodos, recibos, líneas, cálculo TSS/INFOTEP/ISR/horas extra/prorrata, contabilización `NO-*`, pagos y anulaciones) + pgTAP parte 2 (validar cuadre exacto del caso NO-1 de `ALEGRA-NOMINA.md`, caso con ISR, topes TSS, candado de pago y RLS) + `types.ts`.
- **3C (Capa TS `src/lib/nomina/` — tras 3B):** Zod schemas, consultas paginadas, server actions (`supabase.rpc` directo), generador de exportación TSS y tests Vitest.
- **3D (Configuración Nómina en Contabilidad — tras 3C):** nueva sección **"Nómina"** en `/dashboard/configuracion/page.tsx` con sus subpáginas (Datos laborales y riesgo SRL, Mapeo contable por segmento, Conceptos de ingresos y deducciones, Parámetros legales RD).
- **3E (UI Módulo Nómina en sidebar — archivos disjuntos de 3D):** nuevo grupo desplegable (toggle) **Nómina** en `src/navigation/sidebar/sidebar-items.ts` (Inicio con indicadores RD, Empleados con wizard 3 pasos + ficha + importación, Periodos y Cálculo de recibos, Pagos de nómina, Gestión de envíos + Colilla imprimible PDF, y Reporte TSS). Capturas claro/oscuro obligatorias.

---

## Orden de ejecución recomendado

1. **Fase 0** (limpiar PRs #59 y #62 → 1 PR limpio de docs en `main`).
2. **Fase 1 (Inventario Ferretería):** 1A → 1B → 1C (backend en verde en CI antes de UI).
3. **Fase 2 (POS):** 2A → 2B → 2C y 2D en paralelo (archivos disjuntos).
4. **Fase 3 (Nómina RD):** 3A → 3B → 3C → 3D y 3E en paralelo (archivos disjuntos).

Al iniciar la sesión, haz tu reconocimiento breve, confirma con Waldy si quiere arrancar directo por Fase 0 + 1A, y ejecuta respetando `docs/ORQUESTADOR.md`.

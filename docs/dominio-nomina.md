# Nómina RD — contrato de dominio

**Estado:** propuesta de diseño. No implementa SQL ni TypeScript, no aplica migraciones.
**Rama:** `feat/docs-dominio-nomina`, desde `origin/main` `e15e557`.
**Objetivo:** fijar el contrato completo de tablas, semillas, cálculos, asientos y RPC del módulo **Nómina RD**, para que las tareas 3A/3B (migraciones, pgTAP, `types.ts`) y 3C/3D/3E (TS/UI) lo implementen sin inventar nada.
**Fuente funcional:** estudio de Alegra Nómina en `docs/alegra/nomina/ALEGRA-NOMINA.md` (en `main` desde el PR 67), caso real **NO-1** y tasas RD verificadas.
**Reglas Medoxigas (anti-confusión):** inspiración, no copia. Nómina vive como subgrupo desplegable **dentro de Contabilidad**, sin pestaña nueva. Su configuración vive en `/dashboard/configuracion`, sección **Nómina** (sin Suscripciones ni Bandeja). Colores: solo tokens de `docs/plantilla-diseno.md` (`--primary` azul, shadcn/Base UI); **nunca** el teal `#00b19d` de Alegra.

---

## 0. Lo que existe hoy (verificado en el repo)

| Pieza | Archivo real | Estado actual |
| --- | --- | --- |
| Tipo de entrada de diario `NO` (Nómina) | `supabase/migrations/20261123000000_tipos_entrada_diario.sql:23-50` | Tabla `tipos_entrada_diario` con `nombre`, `prefijo` único, `siguiente`, `activo`. Semilla idempotente de 13 tipos; `('Nómina','NO')` en la línea 45. |
| Código y tipo del asiento | `20261123000000_tipos_entrada_diario.sql:55-61` | `asientos.tipo_entrada_id` y `asientos.codigo`; índice único parcial `asientos_codigo_unico` donde `codigo is not null`. El asiento manual asigna `prefijo-siguiente`. |
| `asientos.origen_tipo` | `20261113140000_motor_contable.sql:176-189`; lista vigente en `20261124100000_inventario_inicial_asiento.sql:74-92` | Hoy admite `factura`, `pago_recibido`, `factura_proveedor`, `pago_proveedor`, `gasto_menor`, `manual`, `anulacion`, `nota_credito_venta`, `nota_credito_compra`, `nota_debito`, `transferencia`, `deposito`, `conciliacion`, `ajuste_inventario`, `saldo_inicial`, `inventario_inicial`. **No** existe `nomina` ni `pago_nomina`. |
| Helper de asientos | `20261115201000_centros_costo.sql` (recrea `_crear_asiento`) | Valida 2+ líneas, un solo lado por línea, cuentas de detalle y cuadre exacto. Copia `contacto_id` y `centro_costo_id` de cada línea. **No** acepta `tipo_entrada_id` ni `codigo`. |
| Centros de costo | `20261115201000_centros_costo.sql:17-37` | `centros_costo` y `asiento_lineas.centro_costo_id`. |
| Contactos | `20261113140000_motor_contable.sql:120-133`; `20261115600000_contacto_rapido_identificacion.sql` | `tipo` solo admite `cliente`, `proveedor`, `ambos`; `tipo_identificacion` admite `rnc`, `cedula`, `pasaporte`; `municipio_provincia`. **No hay unique por identificación** (lo resuelve nómina). |
| Validador DGII | `20261124120000_config_dgii_rnc.sql:183-220` | `public._rnc_digito_valido(text)` valida RNC de 9 y cédula de 11; está revocado de `public`, `anon` y `authenticated`, así que solo se puede llamar desde funciones `security definer`. |
| Periodos contables cerrados | `20261114300100_periodos_cierre.sql:45-78` | Trigger `asientos_periodo_abierto` en `asientos`: un mes cerrado rechaza asientos nuevos con un mensaje en español. Nómina no necesita validar el cierre por su cuenta. |
| Catálogo de cuentas | `20261113140000_motor_contable.sql:43-100` y migraciones posteriores | Ocupados: 1101–1108, 1210–1211, 2101–2106, 3101, 3201–3202, 4101–4103, 5101–5102, 6101–6109. **6109 ya es “Gasto de depreciación”**. Las cuentas de nómina deben empezar en 6110 y 2107. |
| Configuración contable | `20261113140000_motor_contable.sql:100-118`; `docs/motor-contable.md:70-86` | `config_contable` tiene 20 claves de ventas/compras/inventario/impuestos. **No** hay claves de nómina y no se le agregan: la nómina usa sus propias tablas de configuración y mapeo. |
| RLS | `20261121120000_adjuntos.sql:238-247`; `20261123000000_tipos_entrada_diario.sql:355-363` | Patrón: RLS habilitado; permisos revocados para `anon` y `authenticated`; solo `select` para `authenticated`; política de lectura que exige `(select public.rol_actual()) is not null`. |
| Auditoría | `20261118190225_auditoria.sql:70-150` | Helper `_auditar(campos, etiqueta, entidad)`; requiere que la tabla tenga `id uuid`. |
| Reset a base virgen | `docs/pruebas/reset-base-virgen.sql`; `src/lib/supabase/reset-virgen.test.ts:34-98` | Toda tabla nueva de `public` debe clasificarse exactamente una vez: `@conservar public.<tabla>` o dentro del `TRUNCATE` y del array del bloque `DO`. |
| Migraciones | `src/lib/supabase/migraciones.test.ts` | Formato `YYYYMMDDHHMMSS_nombre.sql`, timestamp UTC real, estrictamente mayor que el último archivo. La frontera del historial es `20261123000000`. |
| Tipos y UI | `src/lib/supabase/types.ts`, `src/navigation/sidebar/sidebar-items.ts:216-248` | No existen tablas ni tipos `nomina_*`. Contabilidad es un grupo con 5 subítems; no hay tercer nivel en el menú. |

**Lo que no existe hoy:** ninguna tabla `empleados`, `nomina_*`, ni RPC de nómina; `'nomina'`/`'pago_nomina'` en el check de `asientos`; cuentas 6110+ y 2107+; contactos TSS/INFOTEP/DGII; proveedor de correo (no hay Resend, Nodemailer ni SMTP en `package.json`). Tampoco hay dispersión bancaria ni e-CF de nómina: quedan fuera.

**Consecuencia de diseño:** nómina no reutiliza `config_contable` ni toca `crear_asiento_manual`. Agrega su propio catálogo, su propio mapeo contable y un helper de asientos que sí asigna `tipo_entrada_id` y `codigo`.

---

## 1. Decisiones de producto

### 1.1 Dónde vive

- **Menú:** subgrupo **Nómina** dentro de Contabilidad. Subítems: Empleados, Periodos, Pagos, Envíos y Reportes TSS. No hay módulo de primer nivel ni pestaña nueva.
- **Configuración:** `/dashboard/configuracion` → sección **Nómina**, con cuatro pestañas: Empresa, Contable, Conceptos y Parámetros. No se duplica Configuración, no hay Suscripciones ni Bandeja.
- **Rutas propuestas (3C/3D/3E):** `/dashboard/contabilidad/nomina` (periodos), `/dashboard/contabilidad/nomina/periodos/[id]`, `/dashboard/contabilidad/nomina/recibos/[id]`, `/dashboard/contabilidad/nomina/empleados`, `/dashboard/contabilidad/nomina/empleados/[id]`, `/dashboard/contabilidad/nomina/pagos`, `/dashboard/contabilidad/nomina/envios`, `/dashboard/contabilidad/nomina/reportes`.
- El componente de menú actual solo tiene dos niveles. Para el subgrupo dentro de Contabilidad, 3C puede extender `NavSubItem` con `subItems?` o renderizar un acordeón interno; es un cambio de UI, no de datos.

### 1.2 Un solo tenant y una sola moneda

Una empresa (MEDOXIGAS ALC, SRL), un país (RD), una moneda (DOP). No hay multiempresa, multimoneda ni tasas de cambio. Todos los montos son `numeric(14,2)` en pesos dominicanos.

### 1.3 Ciclo estrictamente secuencial

```
crear periodo → calcular recibos → contabilizar (NO-N por empleado) → pagar → enviar colillas
```

Cada paso exige el anterior. El pago **rechaza** un recibo que no esté contabilizado (`23514`). La contabilización exige un recibo calculado. Un recibo pagado no se anula sin anular antes el pago. No hay atajos.

### 1.4 Qué se copia de Alegra y qué no

| Se copia (comportamiento) | No se copia |
| --- | --- |
| Empleados con ficha, novedades recurrentes e historial. | Su diseño, textos, logos, el teal ni el código Vue. |
| Periodo que solo incluye empleados de su frecuencia. | La app separada `nomina.alegra.com`; aquí es un módulo del mismo sistema. |
| Recibo con días calculados, ingresos, deducciones y neto. | La importación Excel y la “transferencia internacional” (fuera de fase 1). |
| Un comprobante NO por empleado, no consolidado. | Su mapeo que mezcla retención del empleado y aporte patronal en la misma cuenta. |
| Candado: pagar solo si está contabilizado. | La contabilización asíncrona “en segundo plano”: aquí es transaccional. |
| Novedades recurrentes (ficha) y novedades del periodo (recibo) separadas. | Bandeja, Suscripciones y onboarding. |
| Prorrata por días trabajados visible en la colilla. | Su cálculo de ISR (en el caso NO-1 no retuvo ISR) y su base TSS que excluye horas extra. |

### 1.5 Frecuencia y prorrata

- Dos frecuencias: **mensual** (periodo 1 al último día del mes) y **quincenal** (1–15 y 16 al último día).
- El empleado tiene una sola frecuencia. Un periodo solo incluye empleados de esa frecuencia.
- Los días se prorratean por **días calendario** entre `fecha_ingreso`/`fecha_fin` y el periodo. No se descuentan feriados ni fines de semana: el mes laboral de 23.83 días ya los promedia.
- El salario del periodo se calcula con la proporción exacta, no con los días redondeados (ver §4.1). Así no se pierden centavos por redondear 11.915.

### 1.6 Redondeo y dinero

- Todo monto se guarda en `numeric(14,2)`. Nunca `float`.
- Cada línea se redondea **una sola vez** a 2 decimales, medio hacia arriba (`round` de Postgres sobre `numeric`). Los totales son la suma de líneas ya redondeadas; no se vuelven a redondear.
- El neto es `total_ingresos − total_deducciones`, ambos ya redondeados. Por construcción, el asiento siempre cuadra: débitos = ingresos + aportes patronales + provisiones; créditos = deducciones + aportes patronales + provisiones + neto = lo mismo.

### 1.7 Colillas

La RPC `nomina_registrar_envio_colillas` **no envía correo**: deja constancia de que el envío ocurrió (`colilla_enviada_en`, `colilla_enviada_a`). El envío real es de 3E y requiere decidir proveedor (Resend, SMTP de Supabase u otro); hasta entonces la UI muestra el botón deshabilitado o simula el envío con una nota. No se inventa un proveedor en el contrato.

### 1.8 Provisiones

`registrar_provisiones` viene en **false**. Si se enciende, cada recibo acumula tres provisiones (regalía, vacaciones, cesantía) con las fórmulas de §4.7. Consumir la provisión cuando se paga la regalía o la cesantía **no** está en fase 1: pagar esos conceptos por nómina vuelve a debitar gasto. Se documenta como limitación en §12 y se resuelve en una fase posterior con un saldo por empleado.

---

## 2. Catálogos y configuración

### 2.1 `nomina_parametros_rd`

Una fila por año fiscal. Es la fuente de tasas, topes y escala de ISR. Si falta el año del periodo, el cálculo falla con un mensaje claro; no hay tasas hardcodeadas.

| Columna | Tipo | Nulo | Default | Regla |
| --- | --- | --- | --- | --- |
| `anio` | `int` | no | — | PK; entre 2000 y 2100. |
| `salario_minimo` | `numeric(14,2)` | no | — | > 0. 2026: `23223.00`. |
| `tasa_sfs_empleado` | `numeric(6,3)` | no | — | Porcentaje 0–100. 2026: `3.040`. |
| `tasa_sfs_empleador` | `numeric(6,3)` | no | — | 2026: `7.090`. |
| `tope_sfs_mensual` | `numeric(14,2)` | no | — | > 0. 2026: `232230.00` = 10 SM. |
| `tasa_afp_empleado` | `numeric(6,3)` | no | — | 2026: `2.870`. |
| `tasa_afp_empleador` | `numeric(6,3)` | no | — | 2026: `7.100`. |
| `tope_afp_mensual` | `numeric(14,2)` | no | — | 2026: `464460.00` = 20 SM. |
| `tope_srl_mensual` | `numeric(14,2)` | no | — | 2026: `92892.00` = 4 SM. |
| `tasa_srl_tipo_1` | `numeric(6,3)` | no | — | 2026: `1.100`. |
| `tasa_srl_tipo_2` | `numeric(6,3)` | no | — | 2026: `1.150`. |
| `tasa_srl_tipo_3` | `numeric(6,3)` | no | — | 2026: `1.250`. |
| `tasa_srl_tipo_4` | `numeric(6,3)` | no | — | 2026: `1.300`. |
| `tasa_infotep` | `numeric(6,3)` | no | — | 2026: `1.000`. |
| `dias_mes_laboral` | `numeric(6,3)` | no | — | 2026: `23.830`. |
| `horas_dia_laboral` | `numeric(6,3)` | no | — | 2026: `8.000`. |
| `escala_isr_anual` | `jsonb` | no | — | Array de tramos, ver abajo. |
| `actualizado_en` | `timestamptz` | no | `now()` | — |

Se siembra **solo la fila `anio = 2026`** con estos valores; 2027 en adelante se agrega desde Configuración → Nómina (o por migración cuando Waldy confirme las tasas). Sin fila para el año del periodo, el cálculo no corre.

**Escala de ISR 2026** (la que se siembra; los montos fijos son acumulados y se validan al guardar):

| Desde | Hasta | Tasa | Monto fijo |
| ---: | ---: | ---: | ---: |
| 0.00 | 416,220.00 | 0% | 0.00 |
| 416,220.00 | 624,329.00 | 15% | 0.00 |
| 624,329.00 | 867,123.00 | 20% | 31,216.35 |
| 867,123.00 | — (null) | 25% | 79,775.15 |

Estructura JSON exacta:

```json
[
  { "desde": 0.00, "hasta": 416220.00, "tasa": 0.00, "monto_fijo": 0.00 },
  { "desde": 416220.00, "hasta": 624329.00, "tasa": 15.00, "monto_fijo": 0.00 },
  { "desde": 624329.00, "hasta": 867123.00, "tasa": 20.00, "monto_fijo": 31216.35 },
  { "desde": 867123.00, "hasta": null, "tasa": 25.00, "monto_fijo": 79775.15 }
]
```

Reglas de la escala: el primer tramo empieza en 0; cada `desde` es el `hasta` del anterior; el último `hasta` es `null`; `monto_fijo` del tramo n es el impuesto acumulado en su `desde` (`monto_fijo` anterior + tasa anterior × (hasta anterior − desde anterior) / 100). El motor elige el último tramo con `base > desde` y aplica `monto_fijo + tasa / 100 × (base − desde)`.

**Correcciones al estudio de Alegra:**

- El estudio muestra el tope SRL como `92,892.40`; 4 × 23,223.00 = **92,892.00**. La diferencia de RD$0.40 es una inconsistencia de la app, no una regla. Se siembra 92,892.00.
- El estudio rotula los topes AFP/SFS como “anuales”; son **mensuales** (20 SM y 10 SM del salario de un mes). El tope anual se obtiene multiplicando por 12 solo para la proyección de ISR.
- El estudio no retuvo ISR en el caso NO-1. Nuestro motor sí retiene por proyección anual; la comparación está en §10.7.

### 2.2 `nomina_config_empresa`

Fila única (`id = 1`). Es la configuración de la empresa para nómina; no se mezcla con `config_contable`.

| Columna | Tipo | Nulo | Default | Regla |
| --- | --- | --- | --- | --- |
| `id` | `int` | no | `1` | PK, `check (id = 1)`. |
| `riesgo_laboral` | `text` | no | `'tipo_1'` | `tipo_1`, `tipo_2`, `tipo_3`, `tipo_4`; elige la tasa SRL. |
| `categoria_empresa` | `text` | no | `'pequena'` | `micro`, `pequena`, `mediana`, `grande`. Informativa en fase 1 (no cambia la tasa de INFOTEP). |
| `aplica_infotep` | `boolean` | no | `true` | Si es false, no se genera línea de INFOTEP. |
| `frecuencia_defecto` | `text` | no | `'quincenal'` | `quincenal`, `mensual`; solo prellena el formulario. |
| `cuenta_pago_defecto_id` | `uuid` | sí | — | FK `cuentas`; debe ser `es_caja_banco = true` y `activa`. Se siembra 1102. |
| `cuenta_salarios_por_pagar_id` | `uuid` | sí | — | FK `cuentas`; pasivo de detalle. Se siembra 2107. Obligatoria para contabilizar. |
| `registrar_provisiones` | `boolean` | no | `false` | Genera las 3 provisiones de §4.7. |
| `contacto_tss_id` | `uuid` | sí | — | FK `contactos`; contacto de TSS para SFS/AFP/SRL. |
| `contacto_infotep_id` | `uuid` | sí | — | FK `contactos`; contacto de INFOTEP. |
| `contacto_dgii_id` | `uuid` | sí | — | FK `contactos`; contacto de DGII para ISR. |
| `actualizado_en` | `timestamptz` | no | `now()` | — |

Semilla: una fila `id = 1` con riesgo `tipo_1`, categoría `pequena`, `aplica_infotep = true`, frecuencia `quincenal`, 1102, 2107, `registrar_provisiones = false` y los tres contactos sembrados. Son **defaults**: Waldy los confirma en Configuración → Nómina.

### 2.3 `nomina_conceptos`

Catálogo de ingresos, deducciones, aportes patronales y provisiones. Los conceptos del sistema no se borran ni se desactivan; los personalizados los crea el admin.

| Columna | Tipo | Nulo | Default | Regla |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK. |
| `codigo` | `text` | no | — | Único por `lower(codigo)`; mayúsculas, `^[A-Z][A-Z0-9_]{2,39}$`. |
| `nombre` | `text` | no | — | Etiqueta visible y descripción de la línea del asiento. |
| `clase` | `text` | no | — | `ingreso`, `deduccion`, `aporte_empleador`, `provision`. |
| `grava_tss` | `boolean` | no | `false` | Solo puede ser true si `clase = 'ingreso'`; entra en la base SFS/AFP/SRL. |
| `grava_isr` | `boolean` | no | `false` | Solo puede ser true si `clase = 'ingreso'`; entra en la base de ISR. |
| `grava_infotep` | `boolean` | no | `false` | Solo puede ser true si `clase = 'ingreso'`; entra en la base de INFOTEP. |
| `es_sistema` | `boolean` | no | `false` | Los 40 sembrados son true. |
| `activo` | `boolean` | no | `true` | Los de sistema no se desactivan. |
| `orden` | `int` | no | `100` | Orden dentro de su clase. |
| `creado_en` | `timestamptz` | no | `now()` | — |

Restricción: `clase = 'ingreso'` o los tres `grava_*` en false.

Las columnas **Cuenta gasto** y **Cuenta pasivo** de las tablas siguientes no viven en `nomina_conceptos`: son el **mapeo contable sembrado** para los tres segmentos (§2.4). El catálogo solo guarda código, nombre, clase, flags, `es_sistema`, `activo` y orden.

**Semilla: 18 ingresos.** `TSS`, `ISR` e `INFOTEP` indican si el concepto entra en cada base.

| Código | Nombre | TSS | ISR | INFOTEP | Cuenta gasto | Cuenta pasivo | Orden |
| --- | --- | :-: | :-: | :-: | --- | --- | ---: |
| `SALARIO` | Salario | sí | sí | sí | 6110 | — | 10 |
| `COMISION` | Comisión | sí | sí | sí | 6112 | — | 20 |
| `DIFERENCIAL_VACACIONES` | Diferencial Vacaciones Ley | sí | sí | sí | 6110 | — | 30 |
| `PRIMA_NOCTURNA` | Prima Nocturna | sí | sí | sí | 6110 | — | 40 |
| `HORAS_EXTRA_35` | Horas Extra 35% | sí | sí | sí | 6111 | — | 50 |
| `HORAS_EXTRA_100` | Horas Extra 100% | sí | sí | sí | 6111 | — | 60 |
| `VACACIONES` | Vacaciones | sí | sí | sí | 6110 | — | 70 |
| `REGALIA_PASCUAL` | Regalía Pascual | no | no | no | 6113 | — | 80 |
| `BONIFICACION` | Bonificación | sí | sí | sí | 6113 | — | 90 |
| `INCENTIVO` | Incentivo | sí | sí | sí | 6113 | — | 100 |
| `GRATIFICACION` | Gratificación | sí | sí | sí | 6113 | — | 110 |
| `BONO_PRODUCTIVIDAD` | Bono de productividad | sí | sí | sí | 6113 | — | 120 |
| `CESANTIA` | Cesantía | no | no | no | 6122 | — | 130 |
| `PREAVISO` | Preaviso | no | no | no | 6122 | — | 140 |
| `VIATICOS` | Viáticos | no | no | no | 6123 | — | 150 |
| `DIETA` | Dietas | no | no | no | 6123 | — | 160 |
| `SUBSIDIO` | Subsidios | no | no | no | 6113 | — | 170 |
| `OTROS_INGRESOS` | Otros Ingresos | sí | sí | sí | 6113 | — | 180 |

**Semilla: 15 deducciones.** No llevan cuentas de gasto; la contrapartida es el pasivo.

| Código | Nombre | Cuenta pasivo | Orden |
| --- | --- | --- | ---: |
| `SFS` | SFS empleado 3.04% | 2108 | 10 |
| `AFP` | AFP empleado 2.87% | 2109 | 20 |
| `ISR` | ISR asalariados | 2110 | 30 |
| `DEPENDIENTES` | Aporte de Dependientes | 2115 | 40 |
| `PRESTAMO` | Préstamos | 2115 | 50 |
| `LICENCIA_NO_REMUNERADA` | Licencia no remunerada | 2115 | 60 |
| `LICENCIA_MEDICA` | Licencia médica | 2115 | 70 |
| `PENSION_ALIMENTICIA` | Pensión alimenticia | 2115 | 80 |
| `COOPERATIVA` | Cooperativa | 2115 | 90 |
| `SEGURO_VIDA` | Seguro de vida | 2115 | 100 |
| `PLAN_RETIRO` | Plan de retiro | 2115 | 110 |
| `EMBARGO` | Embargo judicial | 2115 | 120 |
| `CUOTA_SINDICAL` | Cuota sindical | 2115 | 130 |
| `AHORRO` | Ahorro programado | 2115 | 140 |
| `OTROS_DESCUENTOS` | Otros descuentos | 2115 | 150 |

**Semilla: 4 aportes patronales.**

| Código | Nombre | Cuenta gasto | Cuenta pasivo | Orden |
| --- | --- | --- | --- | ---: |
| `SFS_EMPLEADOR` | SFS empleador 7.09% | 6114 | 2111 | 10 |
| `AFP_EMPLEADOR` | AFP empleador 7.10% | 6115 | 2112 | 20 |
| `SRL` | Seguro de riesgos laborales | 6116 | 2113 | 30 |
| `INFOTEP` | INFOTEP 1.00% | 6117 | 2114 | 40 |

**Semilla: 3 provisiones.**

| Código | Nombre | Cuenta gasto | Cuenta pasivo | Orden |
| --- | --- | --- | --- | ---: |
| `PROVISION_NAVIDAD` | Provisión regalía pascual | 6119 | 2117 | 10 |
| `PROVISION_VACACIONES` | Provisión de vacaciones | 6118 | 2116 | 20 |
| `PROVISION_CESANTIA` | Provisión de cesantía | 6120 | 2118 | 30 |

**Códigos que el motor busca por código** (no se renombran): `SALARIO`, `HORAS_EXTRA_35`, `HORAS_EXTRA_100`, `SFS`, `AFP`, `ISR`, `SFS_EMPLEADOR`, `AFP_EMPLEADOR`, `SRL`, `INFOTEP`, `PROVISION_NAVIDAD`, `PROVISION_VACACIONES`, `PROVISION_CESANTIA`. Si falta uno, el cálculo falla con “Falta el concepto de nómina <código>”.

### 2.4 `nomina_mapeo_contable`

Una fila por `(segmento, concepto)`. Decide qué cuentas usa cada línea del asiento según el segmento del empleado.

| Columna | Tipo | Nulo | Default | Regla |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK. |
| `segmento` | `text` | no | — | `administrativa`, `operativa`, `ventas`. |
| `concepto_id` | `uuid` | no | — | FK `nomina_conceptos`. |
| `cuenta_gasto_id` | `uuid` | sí | — | FK `cuentas`; cuenta que se debita por el ingreso o el gasto patronal. |
| `cuenta_pasivo_id` | `uuid` | sí | — | FK `cuentas`; cuenta que se acredita por la retención, el aporte o la provisión. |
| `creado_en` | `timestamptz` | no | `now()` | — |

Restricciones: `unique (segmento, concepto_id)`; al menos una de las dos cuentas no nula.

**Obligación por clase** (la valida la RPC al guardar y el cálculo al usarlo):

- `ingreso`: `cuenta_gasto_id` obligatoria; `cuenta_pasivo_id` debe ser null.
- `deduccion`: `cuenta_pasivo_id` obligatoria; `cuenta_gasto_id` debe ser null.
- `aporte_empleador` y `provision`: ambas obligatorias.

La cuenta de gasto debe ser de detalle (`acepta_movimientos = true`) y de tipo `gasto` o `costo`; la de pasivo, de detalle y tipo `pasivo`. Se rechazan cuentas de agrupación.

**Semilla:** 40 conceptos × 3 segmentos = **120 filas**. Las tres filas de cada concepto apuntan a las mismas cuentas de las tablas de §2.3; el admin puede separarlas después. La semilla no pisa filas existentes.

### 2.5 Cuentas contables nuevas

Se siembran de forma idempotente (solo si el código no existe), con padre `6` (Gastos) o `21` (Pasivos corrientes), `acepta_movimientos = true` y `es_caja_banco = false`. **No se toca 6109**, que ya es “Gasto de depreciación”.

| Código | Nombre | Tipo | Naturaleza | Padre |
| --- | --- | --- | --- | --- |
| 6110 | Sueldos y salarios | gasto | débito | 6 |
| 6111 | Horas extras | gasto | débito | 6 |
| 6112 | Comisiones | gasto | débito | 6 |
| 6113 | Bonificaciones y otros ingresos | gasto | débito | 6 |
| 6114 | Aportes patronales SFS | gasto | débito | 6 |
| 6115 | Aportes patronales AFP | gasto | débito | 6 |
| 6116 | Seguro de riesgos laborales (SRL) | gasto | débito | 6 |
| 6117 | INFOTEP | gasto | débito | 6 |
| 6118 | Provisión de vacaciones | gasto | débito | 6 |
| 6119 | Provisión de regalía pascual | gasto | débito | 6 |
| 6120 | Provisión de cesantía | gasto | débito | 6 |
| 6121 | Otros gastos de nómina | gasto | débito | 6 |
| 6122 | Prestaciones laborales | gasto | débito | 6 |
| 6123 | Viáticos y dietas | gasto | débito | 6 |
| 2107 | Salarios por pagar | pasivo | crédito | 21 |
| 2108 | Retenciones SFS por pagar | pasivo | crédito | 21 |
| 2109 | Retenciones AFP por pagar | pasivo | crédito | 21 |
| 2110 | ISR asalariados por pagar | pasivo | crédito | 21 |
| 2111 | Aportes SFS por pagar | pasivo | crédito | 21 |
| 2112 | Aportes AFP por pagar | pasivo | crédito | 21 |
| 2113 | Acumulaciones SRL por pagar | pasivo | crédito | 21 |
| 2114 | Acumulaciones INFOTEP por pagar | pasivo | crédito | 21 |
| 2115 | Otras deducciones de nómina por pagar | pasivo | crédito | 21 |
| 2116 | Provisiones de vacaciones por pagar | pasivo | crédito | 21 |
| 2117 | Provisión de regalía pascual por pagar | pasivo | crédito | 21 |
| 2118 | Provisiones de cesantía por pagar | pasivo | crédito | 21 |

No se agregan claves a `config_contable`: la configuración de nómina vive en `nomina_config_empresa` y el mapeo por concepto en `nomina_mapeo_contable`.

### 2.6 Contactos por defecto

Se siembran tres contactos (`tipo = 'proveedor'`, `activo = true`, `rnc_cedula = null`) si no existe uno con el mismo nombre (comparación por `lower(nombre)`):

| Nombre | Uso |
| --- | --- |
| Tesorería de la Seguridad Social (TSS) | SFS/AFP del empleado y del empleador, SRL. |
| Instituto Nacional de Formación Técnico Profesional (INFOTEP) | INFOTEP. |
| Dirección General de Impuestos Internos (DGII) | ISR asalariados. |

`nomina_guardar_config_empresa` guarda sus ids en `contacto_tss_id`, `contacto_infotep_id` y `contacto_dgii_id`. No se inventan RNC: Waldy los completa si los quiere en la ficha.

### 2.7 Cómo se siembra (idempotente)

1. Cuentas: insertar solo códigos que no existan.
2. Contactos: insertar solo nombres que no existan (sin distinguir mayúsculas).
3. Conceptos: insertar solo códigos que no existan (`lower(codigo)`); nunca sobrescribir nombre, flags ni `activo` de un concepto ya editado.
4. Mapeo: insertar las 120 filas resolviendo `concepto_id` por código; si ya existe la fila `(segmento, concepto_id)`, no se pisa. Los 40 códigos reservados no pueden existir antes como personalizados; si existieran, la migración falla y se resuelve a mano.
5. Parámetros: se siembra 2026; no se pisan las tasas ya ajustadas de un año existente.
6. Config: insertar `id = 1` solo si no existe; no se pisa la configuración de Waldy.
7. Cuentas por defecto de la config: resolver por código (1102, 2107) después de sembrar las cuentas.

---

## 3. Tablas operativas

Todas en `public`, ids `uuid default gen_random_uuid()` salvo donde se indique, dinero `numeric(14,2)`, fechas `date`, `creado_por uuid default auth.uid()` cuando aplica.

### 3.1 `empleados`

La ficha del empleado. Siempre vinculada a un `contacto` para que el Libro Mayor y el auxiliar por tercero funcionen.

| Columna | Tipo | Nulo | Default | Regla |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK. |
| `contacto_id` | `uuid` | no | — | FK `contactos`; **unique** (un contacto, un empleado). |
| `tipo_identificacion` | `text` | no | — | `cedula`, `pasaporte`, `residencia`. |
| `identificacion` | `text` | no | — | Cédula: 11 dígitos y `_rnc_digito_valido`. Pasaporte/residencia: texto no vacío. |
| `primer_nombre` | `text` | no | — | — |
| `segundo_nombre` | `text` | sí | — | — |
| `primer_apellido` | `text` | no | — | — |
| `segundo_apellido` | `text` | sí | — | — |
| `correo` | `text` | sí | — | Si viene, formato `usuario@dominio.tld`. |
| `telefono` | `text` | sí | — | — |
| `municipio` | `text` | sí | — | — |
| `direccion` | `text` | sí | — | — |
| `cargo` | `text` | sí | — | Texto libre. |
| `area` | `text` | sí | — | Texto libre para la ficha; no decide contabilidad. |
| `segmento_contable` | `text` | no | `'administrativa'` | `administrativa`, `operativa`, `ventas`; decide el mapeo. |
| `centro_costo_id` | `uuid` | sí | — | FK `centros_costo`; se copia a todas las líneas del asiento. |
| `tipo_contrato` | `text` | no | `'indefinido'` | `indefinido`, `definido`. |
| `fecha_ingreso` | `date` | no | — | — |
| `fecha_fin` | `date` | sí | — | Obligatoria si `tipo_contrato = 'definido'`; ≥ `fecha_ingreso`. |
| `frecuencia_pago` | `text` | no | — | `quincenal`, `mensual`. |
| `salario_mensual` | `numeric(14,2)` | no | — | > 0. |
| `metodo_pago` | `text` | no | `'transferencia'` | `efectivo`, `transferencia`, `cheque`. |
| `banco_nombre` | `text` | sí | — | Obligatorio si `metodo_pago = 'transferencia'` (lo valida la RPC). |
| `tipo_cuenta_banco` | `text` | sí | — | `ahorros`, `corriente`; obligatorio si transferencia. |
| `numero_cuenta_banco` | `text` | sí | — | Obligatorio si transferencia. |
| `clave_tss` | `text` | sí | — | Si viene, 3 dígitos (`^[0-9]{3}$`). |
| `estado` | `text` | no | `'activo'` | `activo`, `suspendido`, `inactivo`. |
| `creado_por` | `uuid` | sí | `auth.uid()` | — |
| `creado_en` | `timestamptz` | no | `now()` | — |

Restricciones: `unique (tipo_identificacion, identificacion)`; `check (tipo_contrato = 'indefinido' or fecha_fin is not null)`; `check (fecha_fin is null or fecha_fin >= fecha_ingreso)`; `check (clave_tss is null or clave_tss ~ '^[0-9]{3}$')`.

**Contacto vinculado.** Si el payload trae `contacto_id`, se valida que exista y que no esté usado por otro empleado. Si no, se busca un contacto con el mismo `rnc_cedula` (solo dígitos, mismo `tipo_identificacion` mapeado) y, si existe, se vincula; si ese contacto ya está vinculado a otro empleado, la RPC falla en vez de duplicarlo. Si no hay contacto, se crea:

- `nombre`: primer nombre + segundo nombre + primer apellido + segundo apellido, con espacios normalizados.
- `tipo`: `'ambos'` (el check de `contactos` no admite `'empleado'`; extenderlo tocaría los filtros de Ventas y Compras).
- `tipo_identificacion`: `cedula` → `cedula`, `pasaporte` → `pasaporte`, `residencia` → `pasaporte`.
- `rnc_cedula`: la identificación; `correo`, `telefono`, `direccion`; `activo = true`.

Al actualizar el empleado se sincronizan nombre, identificación, correo, teléfono y dirección del contacto vinculado. Un empleado inactivo no desactiva el contacto: sigue visible en el auxiliar por tercero.

### 3.2 `empleado_novedades_recurrentes`

Ingresos o deducciones fijos que se aplican solos en cada periodo (préstamos, bonos fijos, pensión alimenticia…).

| Columna | Tipo | Nulo | Default | Regla |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK. |
| `empleado_id` | `uuid` | no | — | FK `empleados`. |
| `concepto_id` | `uuid` | no | — | FK `nomina_conceptos`; clase `ingreso` o `deduccion`. |
| `monto` | `numeric(14,2)` | sí | — | > 0. Exactamente uno de `monto` o `porcentaje`. |
| `porcentaje` | `numeric(6,3)` | sí | — | > 0 y ≤ 100. |
| `fecha_inicio` | `date` | no | — | — |
| `fecha_fin` | `date` | sí | — | ≥ `fecha_inicio`. |
| `activa` | `boolean` | no | `true` | Se apaga, no se borra. |
| `notas` | `text` | sí | — | — |
| `creado_en` | `timestamptz` | no | `now()` | — |

Restricciones: `check ((monto is null) <> (porcentaje is null))`; `check (monto is null or monto > 0)`; `check (porcentaje is null or (porcentaje > 0 and porcentaje <= 100))`; `check (fecha_fin is null or fecha_fin >= fecha_inicio)`.

**Vigencia:** una novedad aplica al periodo si `activa`, `fecha_inicio <= periodo.fecha_fin` y (`fecha_fin is null` o `fecha_fin >= periodo.fecha_inicio`). Se aplica **una vez** y **sin prorrata**: si empieza a mitad del periodo, se paga completa. Si se quiere prorratear, se edita el monto a mano en el recibo.

**Códigos prohibidos** en novedades recurrentes: `SALARIO`, `SFS`, `AFP`, `ISR` (los calcula el motor) y todas las clases `aporte_empleador`/`provision`.

### 3.3 `nomina_periodos`

Cabecera de un periodo de nómina.

| Columna | Tipo | Nulo | Default | Regla |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK. |
| `codigo` | `text` | no | — | Unique. `YYYY-MM-Q1`, `YYYY-MM-Q2` o `YYYY-MM-M`. |
| `frecuencia` | `text` | no | — | `quincenal`, `mensual`. |
| `fecha_inicio` | `date` | no | — | — |
| `fecha_fin` | `date` | no | — | ≥ `fecha_inicio`; mismo año que `fecha_inicio`. |
| `fecha_pago` | `date` | sí | — | Fecha prevista; el pago real puede usar otra. |
| `anio_fiscal` | `int` | no | — | Año de `fecha_fin`; debe coincidir. |
| `estado` | `text` | no | `'borrador'` | `borrador`, `calculado`, `contabilizado`, `pagado`, `anulado`. |
| `total_salario` | `numeric(14,2)` | no | `0` | Suma de `salario_base` de recibos no anulados. |
| `total_ingresos` | `numeric(14,2)` | no | `0` | — |
| `total_deducciones` | `numeric(14,2)` | no | `0` | — |
| `total_aportes_empleador` | `numeric(14,2)` | no | `0` | — |
| `total_provisiones` | `numeric(14,2)` | no | `0` | — |
| `total_neto` | `numeric(14,2)` | no | `0` | — |
| `total_costo_empresa` | `numeric(14,2)` | no | `0` | — |
| `observaciones` | `text` | sí | — | — |
| `creado_por` | `uuid` | sí | `auth.uid()` | — |
| `creado_en` | `timestamptz` | no | `now()` | — |

Restricciones: `unique (codigo)`; `unique (frecuencia, fecha_inicio, fecha_fin)`; `check (fecha_fin >= fecha_inicio)`; `check (anio_fiscal = extract(year from fecha_fin)::int)`; `check (codigo ~ '^[0-9]{4}-[0-9]{2}-(M|Q[12])$')`.

**Rangos estándar obligatorios** (los valida `nomina_crear_periodo`): mensual = primer día al último del mes; quincenal = 1–15 o 16 al último del mes. No hay periodos semanales ni rangos libres en fase 1. Eso hace determinista el código y evita solapamientos.

**Sin doble pago:** un empleado no puede tener dos recibos no anulados en periodos cuyos rangos se crucen, aunque sean de distinta frecuencia. `nomina_crear_periodo` y `nomina_agregar_empleados` rechazan o saltan al empleado que ya tiene un recibo así; primero se anula el recibo viejo. Sin esta regla, cambiar la frecuencia de pago a mitad de mes pagaría dos veces.

**Totales:** se recalculan desde los recibos **no anulados**. `total_salario = Σ salario_base`; `total_ingresos = Σ total_ingresos`; `total_deducciones = Σ total_deducciones`; `total_aportes_empleador = Σ total_aportes_empleador`; `total_provisiones = Σ total_provisiones`; `total_neto = Σ neto_pagar`; `total_costo_empresa = Σ costo_total_empresa`. Si todos los recibos están anulados, todos los totales quedan en 0 y el periodo pasa a `anulado`.

### 3.4 `nomina_recibos`

Un recibo por empleado y periodo. Es el documento que se contabiliza, se paga y se envía.

| Columna | Tipo | Nulo | Default | Regla |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK. |
| `periodo_id` | `uuid` | no | — | FK `nomina_periodos`. |
| `empleado_id` | `uuid` | no | — | FK `empleados`. |
| `dias_trabajados` | `numeric(6,3)` | no | `0` | Prorrata informativa; ver §4.1. |
| `salario_base` | `numeric(14,2)` | no | `0` | Salario del periodo por proporción exacta. |
| `base_tss` | `numeric(14,2)` | no | `0` | Suma de ingresos con `grava_tss`, sin tope. |
| `base_sfs` | `numeric(14,2)` | no | `0` | Base TSS topada a SFS. |
| `base_afp` | `numeric(14,2)` | no | `0` | Base TSS topada a AFP. |
| `base_srl` | `numeric(14,2)` | no | `0` | Base TSS topada a SRL. |
| `base_infotep` | `numeric(14,2)` | no | `0` | Suma de ingresos con `grava_infotep`, sin tope. |
| `base_isr` | `numeric(14,2)` | no | `0` | Suma de ingresos con `grava_isr`. |
| `total_ingresos` | `numeric(14,2)` | no | `0` | Σ líneas clase ingreso. |
| `total_deducciones` | `numeric(14,2)` | no | `0` | Σ líneas clase deducción. |
| `total_aportes_empleador` | `numeric(14,2)` | no | `0` | Σ líneas clase aporte_empleador. |
| `total_provisiones` | `numeric(14,2)` | no | `0` | Σ líneas clase provisión. |
| `neto_pagar` | `numeric(14,2)` | no | `0` | `total_ingresos − total_deducciones`; ≥ 0. |
| `costo_total_empresa` | `numeric(14,2)` | no | `0` | `total_ingresos + total_aportes_empleador + total_provisiones`. |
| `estado` | `text` | no | `'borrador'` | `borrador`, `calculado`, `contabilizado`, `pagado`, `anulado`. |
| `cuenta_salarios_por_pagar_id` | `uuid` | sí | — | FK `cuentas`; snapshot de la cuenta acreditada en el NO-N y debitada al pagar. |
| `asiento_id` | `uuid` | sí | — | FK `asientos`; comprobante NO-N. |
| `pago_asiento_id` | `uuid` | sí | — | FK `asientos`; asiento `pago_nomina`. |
| `cuenta_pago_id` | `uuid` | sí | — | FK `cuentas`; cuenta usada al pagar. |
| `fecha_pagado` | `date` | sí | — | — |
| `colilla_enviada_en` | `timestamptz` | sí | — | — |
| `colilla_enviada_a` | `text` | sí | — | Correo o destinatario registrado. |
| `creado_en` | `timestamptz` | no | `now()` | — |

Restricciones: `unique (periodo_id, empleado_id)`; `check (dias_trabajados >= 0)`; `check (neto_pagar >= 0)`; `check (estado <> 'pagado' or fecha_pagado is not null)`; `check (estado not in ('contabilizado', 'pagado') or asiento_id is not null)`; `check (estado not in ('contabilizado', 'pagado') or cuenta_salarios_por_pagar_id is not null)`.

**Columnas `base_*`**: no están en el enunciado original, pero son necesarias para que `nomina_reporte_tss` y la auditoría no dependan de parámetros que pueden cambiar después. Son snapshots del cálculo; la UI no las edita.

**`cuenta_salarios_por_pagar_id`**: se copia de la configuración al contabilizar. El pago y su reversa usan la cuenta del recibo, no la configuración vigente; si Waldy cambia la cuenta por defecto, los recibos ya contabilizados siguen liquidando contra la cuenta con la que se acreditaron. Es la contrapartida exacta del pasivo.

### 3.5 `nomina_recibo_lineas`

Detalle del cálculo. Se regenera al calcular; las líneas manuales se conservan.

| Columna | Tipo | Nulo | Default | Regla |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK. |
| `recibo_id` | `uuid` | no | — | FK `nomina_recibos`. |
| `concepto_id` | `uuid` | no | — | FK `nomina_conceptos`. |
| `clase` | `text` | no | — | Copia de `nomina_conceptos.clase` al momento del cálculo. |
| `cantidad` | `numeric(10,3)` | sí | — | Días u horas; informativa. |
| `porcentaje` | `numeric(6,3)` | sí | — | Porcentaje aplicado; 135.000/200.000 en horas extra. |
| `monto` | `numeric(14,2)` | no | — | **> 0**; no se guardan líneas en cero. |
| `origen` | `text` | no | — | `sistema`, `recurrente`, `manual`. |
| `notas` | `text` | sí | — | — |
| `orden` | `int` | no | `100` | Orden de presentación. |
| `creado_en` | `timestamptz` | no | `now()` | — |

Restricciones: `check (monto > 0)`; `check (cantidad is null or cantidad >= 0)`; `check (porcentaje is null or porcentaje >= 0)`.

**Regeneración:** `nomina_calcular_recibo` borra las líneas de origen `sistema` y `recurrente` y las vuelve a crear; las `manual` se conservan. Las líneas manuales de horas extra recalculan su monto desde `cantidad`. No hay DELETE expuesto al usuario: el borrado de líneas ocurre dentro de la RPC de cálculo y no toca documentos.

### 3.6 Cambio en `asientos`

Se amplía el check vigente (el de `20261124100000_inventario_inicial_asiento.sql:74-92`) con dos valores, **sin perder los 16 existentes**:

```
factura, pago_recibido, factura_proveedor, pago_proveedor, gasto_menor, manual,
anulacion, nota_credito_venta, nota_credito_compra, nota_debito, transferencia,
deposito, conciliacion, ajuste_inventario, saldo_inicial, inventario_inicial,
nomina, pago_nomina
```

No se agregan columnas a `asientos`: `tipo_entrada_id` y `codigo` ya existen. El asiento de nómina lleva `origen_tipo = 'nomina'`, `origen_id = recibo_id`, `tipo_entrada_id` del tipo NO y `codigo = 'NO-N'`. El de pago lleva `origen_tipo = 'pago_nomina'`, `origen_id = recibo_id` y `codigo = null`.

### 3.7 Índices

- `empleados (estado, frecuencia_pago)`, `empleados (segmento_contable)`, `empleados (centro_costo_id)`.
- `empleado_novedades_recurrentes (empleado_id, activa)`, `(concepto_id)`.
- `nomina_periodos (anio_fiscal, frecuencia, fecha_inicio desc)`.
- `nomina_recibos (periodo_id)`, `(empleado_id)`, `(estado)`.
- `nomina_recibo_lineas (recibo_id)`, `(concepto_id)`.
- `nomina_conceptos (clase, activo, orden)`.
- `nomina_mapeo_contable` ya queda cubierto por el unique `(segmento, concepto_id)`.

### 3.8 Integridad y “sin DELETE físico”

- No hay grants de `delete` para nadie: ni `anon` ni `authenticated`.
- Empleados: se cambian de estado (`activo`, `suspendido`, `inactivo`); no se borran.
- Novedades recurrentes: se apagan (`activa = false`); no se borran.
- Periodos y recibos: se anulan; no se borran.
- Líneas de recibo manuales: se pueden eliminar dentro de la RPC (no son un documento contable), pero la tabla no tiene grant de DELETE.
- Los asientos no se borran: se reversan con `origen_tipo = 'anulacion'`.

---

## 4. Motor de cálculo

Todo el cálculo ocurre en el servidor, dentro de `nomina_calcular_recibo`. La UI nunca calcula dinero.

### 4.1 Variables del periodo y del empleado

| Variable | Fórmula |
| --- | --- |
| `factor` | `1` si mensual; `0.5` si quincenal. |
| `periodos_por_mes` | `1` si mensual; `2` si quincenal. |
| `dias_calendario_periodo` | `fecha_fin − fecha_inicio + 1`. |
| `inicio_efectivo` | `greatest(periodo.fecha_inicio, empleado.fecha_ingreso)`. |
| `fin_efectivo` | `least(periodo.fecha_fin, coalesce(empleado.fecha_fin, periodo.fecha_fin))`. |
| `dias_efectivos` | `greatest(0, fin_efectivo − inicio_efectivo + 1)`. |
| `proporcion` | `dias_efectivos / dias_calendario_periodo` (0 a 1, sin redondear). |
| `dias_laborales_periodo` | `dias_mes_laboral × factor` (23.830 mensual; 11.915 quincenal). |
| `dias_trabajados` | `round(dias_laborales_periodo × proporcion, 3)`. |
| `salario_base` | `round(salario_mensual × factor × proporcion, 2)`. |

Si `proporcion = 0`, el recibo no se crea (el contrato no se cruza con el periodo).

**Decisión clave:** el salario se calcula con `proporcion` exacta, no con `dias_trabajados` redondeado. Ejemplo: un ingreso el 25 de noviembre en la quincena 16–30 (6 de 15 días) paga `60,000 × 0.5 × 6/15 = 12,000.00` exactos; los días mostrados son `11.915 × 0.4 = 4.766`. Si se recalculara desde 4.766, saldrían RD$0.84 de más. La colilla muestra los días; el dinero usa la proporción.

### 4.2 Orden del cálculo de un recibo

1. Cargar periodo, empleado, parámetros del año (`anio_fiscal`) y configuración de la empresa. Si falta algo: error en español.
2. Recalcular `proporcion`, `dias_trabajados` y `salario_base` (§4.1).
3. Borrar líneas `sistema` y `recurrente`; conservar las `manual`.
4. Insertar la línea **Salario** (`SALARIO`, origen `sistema`): `cantidad = dias_trabajados`, `monto = salario_base`.
5. Insertar las **novedades recurrentes** vigentes (`origen = recurrente`), con su monto o porcentaje sobre `salario_base`.
6. Recalcular las líneas **manuales** de horas extra desde `cantidad`; validar el resto.
7. Sumar las bases:
   - `base_tss` = Σ líneas ingreso con `grava_tss`.
   - `base_isr` = Σ líneas ingreso con `grava_isr`.
   - `base_infotep` = Σ líneas ingreso con `grava_infotep`.
   - `base_provisiones` = `base_tss`.
8. Calcular SFS, AFP, ISR, aportes patronales y provisiones; validar que las deducciones no superen los ingresos.
9. Insertar las líneas de sistema con los montos del paso 8 (solo las mayores que 0).
10. Calcular totales y actualizar el recibo; pasarlo a `calculado`; recalcular el periodo.

Si al recalcular un recibo existente la proporción da 0 (porque el contrato ya no se cruza con el periodo), la RPC falla con un mensaje claro; no borra el recibo ni lo deja a medias. Para sacarlo del periodo se anula con `nomina_anular_recibo`.

El orden importa: las líneas de ingreso (pasos 4–6) son la base de todo lo demás.

### 4.3 Bases y topes TSS

| Base | Fórmula |
| --- | --- |
| `base_sfs` | `least(base_tss, tope_sfs_mensual × factor)` |
| `base_afp` | `least(base_tss, tope_afp_mensual × factor)` |
| `base_srl` | `least(base_tss, tope_srl_mensual × factor)` |

Topes 2026:

| Tope | Mensual | Quincenal (`÷ 2`) |
| --- | ---: | ---: |
| SFS (10 SM) | 232,230.00 | 116,115.00 |
| AFP (20 SM) | 464,460.00 | 232,230.00 |
| SRL (4 SM) | 92,892.00 | 46,446.00 |

La base es la suma de ingresos con `grava_tss = true`. Las horas extra, comisiones y bonificaciones gravables **sí** entran; viáticos, dietas, regalía, cesantía y preaviso **no** (según la semilla de §2.3). Cambiar un flag cambia la base sin tocar el motor.

### 4.4 SFS y AFP

```
sfs_empleado   = round(base_sfs × tasa_sfs_empleado / 100, 2)
afp_empleado   = round(base_afp × tasa_afp_empleado / 100, 2)
sfs_empleador  = round(base_sfs × tasa_sfs_empleador / 100, 2)
afp_empleador  = round(base_afp × tasa_afp_empleador / 100, 2)
```

Con las tasas 2026: SFS empleado 3.04%, SFS empleador 7.09%, AFP empleado 2.87%, AFP empleador 7.10%.

### 4.5 ISR asalariados (DGII)

La proyección anual usa el **salario mensual equivalente** del periodo y los meses del año en que el empleado tiene contrato: desde su mes de ingreso (o enero, si viene de un año anterior) hasta diciembre o hasta el mes de `fecha_fin` si el contrato termina este año. No son 12 fijos: un ingreso en noviembre no retiene como si trabajara todo el año.

```
base_mensual_tss = base_tss / (factor × proporcion)
base_mensual_isr = base_isr / (factor × proporcion)

mes_inicio = 1 si year(empleado.fecha_ingreso) < anio_fiscal; si no, month(empleado.fecha_ingreso)
mes_fin    = month(empleado.fecha_fin) si empleado.fecha_fin no es null
             y year(empleado.fecha_fin) = anio_fiscal; si no, 12
meses_proyectados = greatest(1, mes_fin − mes_inicio + 1)

ingreso_anual = base_mensual_isr × meses_proyectados
sfs_mensual_proy = round(least(base_mensual_tss, tope_sfs_mensual) × tasa_sfs_empleado / 100, 2)
afp_mensual_proy = round(least(base_mensual_tss, tope_afp_mensual) × tasa_afp_empleado / 100, 2)
tss_anual = (sfs_mensual_proy + afp_mensual_proy) × meses_proyectados
base_gravable = greatest(0, ingreso_anual − tss_anual)
isr_anual = monto_fijo + tasa / 100 × (base_gravable − desde)   -- tramo elegido
isr_periodo = round(isr_anual / (meses_proyectados × periodos_por_mes), 2)
```

Reglas:

- El tramo se elige con `base_gravable > desde`; si no supera 416,220.00, el ISR es 0.
- Si `base_gravable` cae exactamente en un límite, se queda en el tramo inferior.
- Empleado con ingreso en un año anterior: `meses_proyectados = 12` (o los meses hasta `fecha_fin` si el contrato termina este año).
- Empleado con ingreso este año: se proyecta desde el mes de ingreso hasta diciembre.
- La proyección no acumula pagos previos del mismo año ni otros empleadores. Es una limitación de fase 1 (§12).
- Si el ISR del periodo es 0, no se crea línea (ni línea de asiento).

### 4.6 Cargas patronales

```
srl = round(base_srl × tasa_srl / 100, 2)
```

`tasa_srl` se elige por `nomina_config_empresa.riesgo_laboral`: tipo 1 → 1.10%, tipo 2 → 1.15%, tipo 3 → 1.25%, tipo 4 → 1.30%.

Si `aplica_infotep = true`:

```
infotep = round(base_infotep × tasa_infotep / 100, 2)
```

Si `aplica_infotep = false`, no se genera línea. INFOTEP no tiene tope. `categoria_empresa` no cambia la tasa en fase 1.

### 4.7 Provisiones (solo si `registrar_provisiones = true`)

Base: `base_provisiones = base_tss` (salario y demás ingresos gravables de TSS).

```
provision_navidad     = round(base_provisiones / 12, 2)
dias_vacaciones       = 18 si el empleado tiene 5 años o más al cierre del periodo; si no, 14
provision_vacaciones  = round(base_provisiones × dias_vacaciones / (dias_mes_laboral × 12), 2)
dias_cesantia         = 23 si el empleado tiene 5 años o más al cierre del periodo; si no, 21
provision_cesantia    = round(base_provisiones × dias_cesantia / (dias_mes_laboral × 12), 2)
```

- Navidad: un salario mensual por año (1/12 por mes).
- Vacaciones: 14 días laborables por año (18 después de 5 años), prorrateados por mes.
- Cesantía: 21 días por año (23 después de 5 años), prorrateados por mes.
- Si el monto es 0, no se crea línea.
- Las tres son gasto (débito) contra provisión por pagar (crédito).

### 4.8 Horas extra

El monto se calcula con el **salario mensual del contrato**, no con el salario prorrateado del periodo (igual que la fórmula oficial y que el estudio):

```
valor_hora = salario_mensual / dias_mes_laboral / horas_dia_laboral
monto = round(valor_hora × factor × horas, 2)
```

- `HORAS_EXTRA_35` → `factor = 1.35`.
- `HORAS_EXTRA_100` → `factor = 2.00`.
- `horas` es `nomina_recibo_lineas.cantidad`; debe ser > 0.
- Ejemplo verificado: 60,000 / 23.83 / 8 × 1.35 × 5 = **2,124.42** (coincide con el estudio).
- El porcentaje informativo de la línea es 135.000 o 200.000.

### 4.9 Novedades recurrentes y manuales

| Origen | Monto | Cuándo |
| --- | --- | --- |
| `recurrente` | `monto` fijo o `round(salario_base × porcentaje / 100, 2)` | Vigente según §3.2; una vez por periodo, sin prorrata. |
| `manual` | `monto` fijo, o porcentaje sobre `salario_base`, o cálculo de horas extra | Siempre que el recibo esté en `borrador` o `calculado`. |

- Una novedad manual de un concepto de sistema (`SALARIO`, `SFS`, `AFP`, `ISR`, aportes, provisiones) se rechaza.
- Se permite más de una línea del mismo concepto (dos préstamos, por ejemplo); no se deduplican.
- Si un concepto está inactivo, el cálculo falla; no se ignora en silencio.

### 4.10 Totales del recibo

```
total_ingresos          = Σ líneas clase ingreso
total_deducciones       = Σ líneas clase deduccion
total_aportes_empleador = Σ líneas clase aporte_empleador
total_provisiones       = Σ líneas clase provision
neto_pagar              = total_ingresos − total_deducciones
costo_total_empresa     = total_ingresos + total_aportes_empleador + total_provisiones
```

Si `neto_pagar < 0`: error `23514` “Las deducciones (RD$X) superan los ingresos (RD$Y) del recibo de <nombre>.” No se permite neto negativo.

**Qué significa `costo_total_empresa`:** es el **costo bruto** del empleado y el total del débito del asiento: ingresos + aportes patronales + provisiones. **No** es el desembolso de caja. El desembolso es `neto + aportes + provisiones`; la diferencia son las retenciones del empleado (SFS, AFP, ISR, préstamos) que la empresa descuenta y entera a TSS/DGII o al empleado. Alegra llama “Total del costo” a una cifra parecida al desembolso; aquí se usa el costo bruto porque es el que cuadra con el asiento y con el estado de resultados.

### 4.11 Redondeo (recordatorio)

- Una sola vez por línea, `round(..., 2)`, medio hacia arriba sobre `numeric`.
- Los totales son sumas de líneas redondeadas.
- `dias_trabajados` a 3 decimales; `cantidad` de horas a 3 decimales.
- El asiento usa exactamente los montos de las líneas del recibo; no recalcula.

---

## 5. Asientos

### 5.1 Comprobante NO-N por empleado

`nomina_contabilizar_recibo` crea **un asiento por recibo** (no uno consolidado), con:

- `fecha = periodo.fecha_fin` (devengo). El trigger de periodos cerrados puede rechazarlo si el mes está cerrado.
- `descripcion = 'Nómina ' || periodo.codigo || ' - ' || nombre_empleado`.
- `origen_tipo = 'nomina'`, `origen_id = recibo_id`.
- `tipo_entrada_id` = tipo activo con prefijo `NO`; `codigo = 'NO-' || siguiente`.
- `total` = suma de débitos = `costo_total_empresa`.

| Línea | Cuenta | Contacto | Centro de costo |
| --- | --- | --- | --- |
| Cada ingreso (salario, horas extra, comisión…) | `mapeo(segmento, concepto).cuenta_gasto_id` | Empleado | `empleado.centro_costo_id` |
| SFS empleado | `mapeo.cuenta_pasivo_id` (2108) | TSS | idem |
| AFP empleado | 2109 | TSS | idem |
| ISR | 2110 | DGII | idem |
| Otras deducciones | 2115 | Empleado | idem |
| SFS empleador | Débito 6114 / crédito 2111 | TSS | idem |
| AFP empleador | Débito 6115 / crédito 2112 | TSS | idem |
| SRL | Débito 6116 / crédito 2113 | TSS | idem |
| INFOTEP | Débito 6117 / crédito 2114 | INFOTEP | idem |
| Cada provisión | Débito 6118/6119/6120 / crédito 2116/2117/2118 | Empleado | idem |
| Neto | Crédito `recibo.cuenta_salarios_por_pagar_id` (sembrada 2107) | Empleado | idem |

Reglas:

- Una línea de asiento por cada línea de recibo con monto > 0, más la línea de neto si `neto_pagar > 0`.
- Si `neto_pagar = 0`, no se crea línea de neto; el asiento sigue cuadrado porque ingresos = deducciones.
- La descripción de cada línea de concepto es `nomina_conceptos.nombre`; la línea de neto se describe **“Salario por pagar”**.
- Todas las cuentas deben aceptar movimientos; el helper lo valida.
- Si falta el mapeo de un concepto para el segmento, o la cuenta no cumple el tipo, la RPC falla con un mensaje que nombra el concepto y el segmento. No hay cuenta “por defecto” silenciosa.
- El asiento usa los contactos de la configuración; si un contacto es null, la línea queda sin contacto (no es fatal), pero la semilla los deja configurados.
- Las cuentas 2108/2109/2110/2107 de la tabla son las **sembradas**; el motor usa el mapeo `(segmento, concepto)` y la configuración, no códigos hardcodeados. El mapeo y el segmento se resuelven **al contabilizar**, no al calcular: si cambian entre ambos pasos, manda el valor vigente al posting. Un recibo ya contabilizado no cambia.

**Helper interno:** `_nomina_crear_asiento(fecha, descripcion, origen_tipo, origen_id, tipo_entrada_id, codigo, lineas)` replica las validaciones de `_crear_asiento` (2+ líneas, un solo lado, cuentas de detalle, cuadrado) y además inserta `tipo_entrada_id` y `codigo`. **No se modifica `_crear_asiento`**, porque sus llamadas existentes viven en funciones ya creadas y cambiarle la aridad dejaría dos versiones.

### 5.2 Numeración NO-N

1. Bloquear con `FOR UPDATE` la fila activa de `tipos_entrada_diario` con prefijo `NO`.
2. Si no existe: error `22023` “No hay un tipo de entrada de diario activo con prefijo NO.”
3. Asignar `codigo = 'NO-' || siguiente` e incrementar `siguiente` en 1 en la misma transacción.
4. Insertar el asiento con ese código. El índice único `asientos_codigo_unico` es la última defensa.

La lectura y el incremento ocurren en la misma transacción que el asiento: si algo falla, el consecutivo se revierte y **no queda hueco**. Bajo concurrencia, el `for update` serializa; dos sesiones nunca reciben el mismo número. Si un admin edita `siguiente` a un valor ya usado, la RPC falla con `23505` y un mensaje en español.

### 5.3 Pago de nómina

`nomina_pagar_recibo` crea un asiento por recibo:

- `fecha = p_fecha` (default `current_date`).
- `descripcion = 'Pago de nómina ' || periodo.codigo || ' - ' || nombre_empleado`.
- `origen_tipo = 'pago_nomina'`, `origen_id = recibo_id`, `codigo = null`.
- Débito: `recibo.cuenta_salarios_por_pagar_id` (sembrada 2107) por `neto_pagar`, contacto empleado, centro del empleado.
- Crédito: `cuenta_pago_id` por `neto_pagar`, sin contacto; debe tener `es_caja_banco = true` y `activa`.
- Si `neto_pagar = 0`: no se crea asiento; el recibo se marca pagado con fecha y cuenta.
- Descripción de las líneas: la misma del asiento (`Pago de nómina <codigo> - <empleado>`); el débito lleva contacto empleado y centro, el crédito va sin contacto.

`nomina_pagar_periodo` repite el proceso por cada recibo contabilizado, con la misma cuenta y fecha, y devuelve el resumen `{recibos, asientos, total_pagado}`. No consolida asientos.

### 5.4 Anulaciones

**Anular pago (`nomina_anular_pago_recibo`):**

- Exige `estado = 'pagado'`; si no, `23514`.
- Crea un asiento `origen_tipo = 'anulacion'`, `origen_id = recibo_id`, `fecha = current_date`, `anula_asiento_id = pago_asiento_id`, con las líneas del pago invertidas (débito ↔ crédito) y la descripción `'Anulación: ' || left(descripcion_original, 70)`.
- Conserva contacto y centro de costo en las líneas.
- Deja el recibo en `contabilizado`, `fecha_pagado = null`, `pago_asiento_id = null`, `cuenta_pago_id = null`.
- Si el pago no tuvo asiento (neto 0), solo revierte el estado.
- Recalcula el periodo.

**Anular recibo (`nomina_anular_recibo`):**

- Si `estado = 'pagado'`: `23514` “El recibo está pagado; anula el pago antes de anular el recibo.”
- Estados permitidos: `borrador`, `calculado`, `contabilizado`.
- Si estaba `contabilizado`, crea un asiento `'anulacion'` que revierte el NO-N (`anula_asiento_id = asiento_id`), con fecha `current_date` y líneas invertidas.
- Deja el recibo en `anulado`; conserva `asiento_id` como traza (el reversal se encuentra por `anula_asiento_id`).
- Recalcula el periodo.

No hay una RPC de “anular periodo”: se anulan sus recibos. Cuando todos quedan anulados, el periodo pasa a `anulado` y sus totales a 0.

### 5.5 Fechas y periodos cerrados

- Contabilización: fecha de devengo = `periodo.fecha_fin`.
- Pago: fecha elegida por el usuario (default hoy).
- Anulación: `current_date` (igual que el resto del motor).
- El trigger `asientos_periodo_abierto` bloquea cualquier asiento en un mes cerrado. La RPC no lo duplica: el trigger da el mensaje y la transacción se revierte completa (incluido el consecutivo).

---

## 6. RPCs

### 6.1 Reglas comunes

- Todas las de escritura: `security definer`, `set search_path = ''`, `language plpgsql`, transaccionales.
- Rol: se lee `public.rol_actual()`; si no es `admin` o `contador`, se lanza el error `42501` con mensaje `sin permiso`.
- `p` null o que no sea objeto JSON: `22023`.
- Documento o fila inexistente: `22023` con mensaje en español.
- Estado que no permite la acción: `23514`.
- Unique duplicado: se captura y se reelanza en español (código `23505`).
- Permisos: ejecución revocada de `public`, `anon` y `authenticated`; concedida a `authenticated`.
- Las lecturas son `stable`, `security invoker`, `set search_path = ''`; respetan RLS y no exigen rol de escritura (un `lector` puede leer).

### 6.2 Configuración

| RPC | Firma | Payload / reglas |
| --- | --- | --- |
| `nomina_guardar_config_empresa` | `(p jsonb) returns void` | Actualización parcial de la fila 1; si no existe, la crea con los defaults. Claves: `riesgo_laboral`, `categoria_empresa`, `aplica_infotep`, `frecuencia_defecto`, `cuenta_pago_defecto_id`, `cuenta_salarios_por_pagar_id`, `registrar_provisiones`, `contacto_tss_id`, `contacto_infotep_id`, `contacto_dgii_id`. Valida enums, cuentas (caja/banco y pasivo de detalle) y contactos. Las claves omitidas no cambian. |
| `nomina_guardar_mapeo_contable` | `(p jsonb) returns integer` | `{ "mapeos": [ { "segmento", "concepto_id", "cuenta_gasto_id"?, "cuenta_pasivo_id"? } ] }`. Upsert por `(segmento, concepto_id)`; valida la obligación por clase de §2.4. Devuelve el número de filas guardadas. |
| `nomina_crear_concepto` | `(p jsonb) returns uuid` | `{codigo, nombre, clase, grava_tss?, grava_isr?, grava_infotep?, activo?, orden?}`. Solo crea personalizados (`es_sistema = false`). Normaliza `codigo` a mayúsculas; valida regex y clase. |
| `nomina_actualizar_concepto` | `(p_id uuid, p jsonb) returns uuid` | No cambia `codigo`, `clase` ni `es_sistema`. En conceptos de sistema solo permite `nombre` y `orden`; no permite desactivarlos ni cambiar flags. |
| `nomina_guardar_parametros_rd` | `(p jsonb) returns void` | Upsert completo por `anio`: `salario_minimo`, las 4 tasas SFS/AFP, los 3 topes, las 4 tasas SRL, `tasa_infotep`, `dias_mes_laboral`, `horas_dia_laboral`, `escala_isr_anual`. Todas las claves son obligatorias. Valida rangos, topes > 0 y la escala (tramos ordenados, `monto_fijo` acumulado). No pisa filas de otros años. |

### 6.3 Empleados y novedades

| RPC | Firma | Reglas |
| --- | --- | --- |
| `nomina_crear_empleado` | `(p jsonb) returns uuid` | Crea o vincula el contacto (§3.1). Obligatorios: `tipo_identificacion`, `identificacion`, `primer_nombre`, `primer_apellido`, `fecha_ingreso`, `frecuencia_pago`, `salario_mensual`, `segmento_contable`. Cédula: 11 dígitos + `_rnc_digito_valido`; si falla, mensaje “La comprobación del dígito verificador de la identificación: X fue errónea.” Transferencia: exige banco, tipo y número de cuenta. Contrato definido: exige `fecha_fin`. `clave_tss` de 3 dígitos si viene. |
| `nomina_actualizar_empleado` | `(p_id uuid, p jsonb) returns uuid` | Actualización parcial; revalida lo anterior. Sincroniza el contacto vinculado (nombre, identificación, correo, teléfono, dirección). No permite mover el empleado a un contacto de otro empleado. |
| `nomina_cambiar_estado_empleado` | `(p_id uuid, p_estado text, p_fecha_fin date default null) returns uuid` | `activo`, `suspendido`, `inactivo`. Si pasa a `inactivo` sin fecha, usa `current_date`. Si reactiva un contrato `definido`, exige `p_fecha_fin` futura; si es `indefinido`, limpia `fecha_fin`. |
| `nomina_guardar_novedad_recurrente` | `(p jsonb) returns uuid` | `{id?, empleado_id, concepto_id, monto?, porcentaje?, fecha_inicio, fecha_fin?, activa?, notas?}`. Exactamente uno de monto/porcentaje. Concepto activo, clase ingreso o deducción, código no prohibido (§3.2). Con `id` actualiza; sin `id` inserta. |
| `nomina_eliminar_novedad_recurrente` | `(p_id uuid) returns void` | Apaga (`activa = false`); no borra. Si no existe: `22023`. |

### 6.4 Periodos y recibos

| RPC | Firma | Reglas |
| --- | --- | --- |
| `nomina_crear_periodo` | `(p jsonb) returns uuid` | `{frecuencia, fecha_inicio, fecha_fin, fecha_pago?, observaciones?}`. Exige rango estándar (§3.3), mismo año, parámetros del año y que no exista un periodo no anulado de la misma frecuencia que se cruce. Deriva `codigo` y `anio_fiscal`. Crea el periodo en `borrador` y un recibo `borrador` por cada empleado `activo` de esa frecuencia cuyo contrato se cruce con el periodo, con `dias_trabajados` y `salario_base` calculados, totales en 0 y las novedades recurrentes vigentes copiadas como **preview** (`origen = recurrente`). Excluye a quien ya tenga un recibo no anulado en un periodo que se cruce, aunque sea de otra frecuencia. Si no hay empleados elegibles: `22023`. |
| `nomina_agregar_empleados` | `(p_periodo_id uuid, p_empleado_ids uuid[]) returns integer` | Solo en periodo `borrador` o `calculado`. Inserta recibos para empleados elegibles que no los tengan, con el mismo preview de recurrentes; **revive** un recibo `anulado` del mismo empleado (limpia `asiento_id`, `pago_asiento_id`, `cuenta_pago_id`, `cuenta_salarios_por_pagar_id`, `fecha_pagado`, líneas y totales, y lo deja `borrador`), porque el unique impide crear otro. Salta a quien ya tenga un recibo no anulado en un periodo que se cruce. Los asientos del ciclo anterior quedan en el libro (no se borran). Devuelve cuántos agregó/revivió. |
| `nomina_guardar_novedad_recibo` | `(p jsonb) returns jsonb` | `{id?, recibo_id, concepto_id, cantidad?, monto?, porcentaje?, notas?}`. Solo recibo `borrador` o `calculado`. Concepto activo, clase ingreso o deducción, no de sistema salvo horas extra. Horas extra: `cantidad` > 0 y monto autocalculado (§4.8); el resto: monto > 0 o porcentaje sobre `salario_base`. Inserta/actualiza una línea `manual` y devuelve `{linea_id, monto}`. Si el recibo estaba `calculado`, lo devuelve a `borrador` (hay que recalcular); los totales quedan como estaban hasta que se recalcule, y el estado `borrador` avisa que no son definitivos. |
| `nomina_eliminar_novedad_recibo` | `(p_id uuid) returns void` | Solo líneas `manual` de un recibo `borrador`/`calculado`. Borra la línea y, si el recibo estaba `calculado`, lo devuelve a `borrador` (misma regla de totales no definitivos). |
| `nomina_calcular_recibo` | `(p_recibo_id uuid) returns uuid` | Recibo `borrador` o `calculado`. Ejecuta §4 completo; deja el recibo en `calculado`, actualiza bases, totales y líneas; recalcula el periodo. Idempotente (se puede recalcular mientras no esté contabilizado). |
| `nomina_calcular_periodo` | `(p_periodo_id uuid) returns jsonb` | Periodo no `contabilizado`, `pagado` ni `anulado`. Recalcula todos los recibos no anulados en `borrador`/`calculado` en una sola transacción; si uno falla, no se calcula ninguno. Devuelve `{recibos, total_neto, total_costo_empresa}`. |

**Sobre las novedades recurrentes:** `nomina_crear_periodo` las copia al borrador como preview (`origen = recurrente`) para que la pantalla muestre lo que se va a pagar; `nomina_calcular_recibo` las **regenera** desde la ficha del empleado en ese momento. Si la ficha cambia entre la creación y el cálculo, manda la ficha al calcular; las líneas viejas se descartan. El borrador no tiene líneas de sistema ni totales: eso nace en el cálculo.

**Sobre `nomina_agregar_empleados`:** no estaba en la lista original del brief, pero se agrega porque sin ella un periodo creado antes de una contratación no se puede corregir (Alegra tiene “Añadir empleados”). No cambia el ciclo ni los estados: solo inserta o revive recibos en un periodo `borrador`/`calculado`.

**Regla transversal:** toda RPC que cambie el estado o los totales de un recibo llama a `_nomina_recalcular_periodo` antes de terminar. No hay RPC que deje el periodo con totales o estado viejos.

### 6.5 Contabilización

| RPC | Firma | Reglas |
| --- | --- | --- |
| `nomina_contabilizar_recibo` | `(p_recibo_id uuid) returns uuid` | Exige `estado = 'calculado'` (`23514` si no). Exige `cuenta_salarios_por_pagar_id` en la configuración y mapeo completo. Toma el consecutivo NO con `for update`, crea el asiento de §5.1, guarda `asiento_id` y copia `cuenta_salarios_por_pagar_id` al recibo, lo deja en `contabilizado` y recalcula el periodo. Devuelve el asiento. |
| `nomina_contabilizar_periodo` | `(p_periodo_id uuid) returns jsonb` | Exige que **todos** los recibos no anulados estén en `calculado`, `contabilizado` o `pagado`; si alguno está en `borrador`, `23514` “Calcula la nómina del periodo antes de contabilizar.” Contabiliza los que estén en `calculado` (salta los ya contabilizados/pagados), en orden de nombre del empleado, y devuelve `{asientos, total}`. Si un asiento falla, se revierte todo (sin consumir números). |

### 6.6 Pago

| RPC | Firma | Reglas |
| --- | --- | --- |
| `nomina_pagar_recibo` | `(p jsonb) returns uuid` | `{recibo_id, fecha?, cuenta_pago_id?}`. **Candado:** exige `estado = 'contabilizado'`; si no, `23514` “El recibo no está contabilizado; no se puede pagar.” Cuenta de pago: la del payload o `cuenta_pago_defecto_id`; debe ser `es_caja_banco` y activa. El débito usa `recibo.cuenta_salarios_por_pagar_id`, no la configuración vigente. Crea el asiento de §5.3 (o ninguno si neto = 0), deja el recibo en `pagado`, guarda `pago_asiento_id`, `cuenta_pago_id` y `fecha_pagado`, y recalcula el periodo. Devuelve el asiento de pago (null si neto = 0). |
| `nomina_pagar_periodo` | `(p jsonb) returns jsonb` | `{periodo_id, fecha?, cuenta_pago_id?}`. Exige que todos los recibos no anulados estén en `contabilizado` o `pagado`; si alguno está en `borrador`/`calculado`, `23514`. Paga los `contabilizado` y devuelve `{recibos, asientos, total_pagado}`. La transacción es atómica: o se paga todo o nada. |

### 6.7 Colillas

| RPC | Firma | Reglas |
| --- | --- | --- |
| `nomina_registrar_envio_colillas` | `(p jsonb) returns integer` | `{periodo_id, recibo_ids: uuid[], enviado_a?}`. Valida que cada recibo pertenezca al periodo, no esté anulado y esté en `calculado`, `contabilizado` o `pagado`. Sella `colilla_enviada_en = now()` y `colilla_enviada_a = coalesce(p.enviado_a, empleado.correo)`; un reenvío actualiza la fecha y el destinatario. **No envía correo**; solo registra la constancia. Devuelve cuántos selló. |

### 6.8 Anulaciones

| RPC | Firma | Reglas |
| --- | --- | --- |
| `nomina_anular_pago_recibo` | `(p_recibo_id uuid) returns uuid` | Exige `estado = 'pagado'`; si no, `23514`. Crea el reversal del pago (§5.4), deja el recibo en `contabilizado` y limpia los datos de pago. Devuelve el asiento de reversa (null si no había asiento). |
| `nomina_anular_recibo` | `(p_recibo_id uuid) returns uuid` | Si está `pagado`, `23514` (primero el pago). Desde `borrador`/`calculado`/`contabilizado`: si estaba contabilizado, reversa el NO-N; deja `anulado`; recalcula el periodo. Devuelve el reversal (null si no había asiento). |

### 6.9 Lecturas

| RPC | Firma | Devuelve |
| --- | --- | --- |
| `nomina_resumen_periodo` | `(p_periodo_id uuid) returns table (...)` — `stable`, `security invoker` | Una fila por recibo, **incluidos los anulados** (la UI los muestra con su badge): `recibo_id`, `empleado_id`, `empleado_nombre`, `identificacion`, `cargo`, `segmento_contable`, `dias_trabajados`, `salario_base`, `total_ingresos`, `total_deducciones`, `total_aportes_empleador`, `total_provisiones`, `neto_pagar`, `costo_total_empresa`, `estado`, `asiento_codigo`, `fecha_pagado`, `colilla_enviada_en`. Ordenado por nombre. |
| `nomina_reporte_tss` | `(p_anio int, p_mes int) returns table (...)` — `stable`, `security invoker` | Resumen mensual por empleado para SUIRPlus/TSS e IR-3: `anio`, `mes`, `empleado_id`, `empleado_nombre`, `identificacion`, `clave_tss`, `periodos`, `dias_trabajados`, `salario_base`, `base_sfs`, `base_afp`, `base_srl`, `base_infotep`, `base_isr`, `sfs_empleado`, `afp_empleado`, `isr`, `sfs_empleador`, `afp_empleador`, `srl`, `infotep`, `total_deducciones`, `neto_pagar`. Solo periodos `contabilizado`/`pagado` con `fecha_fin` en el mes; excluye recibos anulados. Agrupa por empleado y suma. |

`p_mes` se valida entre 1 y 12; si no, `22023`. Ambas funciones respetan RLS: un `lector` puede leer, pero no ejecutar las de escritura.

### 6.10 Resumen de firmas

```
-- escritura (admin/contador)
nomina_guardar_config_empresa(p jsonb) returns void
nomina_guardar_mapeo_contable(p jsonb) returns integer
nomina_crear_concepto(p jsonb) returns uuid
nomina_actualizar_concepto(p_id uuid, p jsonb) returns uuid
nomina_guardar_parametros_rd(p jsonb) returns void

nomina_crear_empleado(p jsonb) returns uuid
nomina_actualizar_empleado(p_id uuid, p jsonb) returns uuid
nomina_cambiar_estado_empleado(p_id uuid, p_estado text, p_fecha_fin date default null) returns uuid
nomina_guardar_novedad_recurrente(p jsonb) returns uuid
nomina_eliminar_novedad_recurrente(p_id uuid) returns void

nomina_crear_periodo(p jsonb) returns uuid
nomina_agregar_empleados(p_periodo_id uuid, p_empleado_ids uuid[]) returns integer
nomina_guardar_novedad_recibo(p jsonb) returns jsonb
nomina_eliminar_novedad_recibo(p_id uuid) returns void
nomina_calcular_recibo(p_recibo_id uuid) returns uuid
nomina_calcular_periodo(p_periodo_id uuid) returns jsonb

nomina_contabilizar_recibo(p_recibo_id uuid) returns uuid
nomina_contabilizar_periodo(p_periodo_id uuid) returns jsonb

nomina_pagar_recibo(p jsonb) returns uuid
nomina_pagar_periodo(p jsonb) returns jsonb

nomina_registrar_envio_colillas(p jsonb) returns integer

nomina_anular_pago_recibo(p_recibo_id uuid) returns uuid
nomina_anular_recibo(p_recibo_id uuid) returns uuid

-- lecturas (cualquier perfil, security invoker)
nomina_resumen_periodo(p_periodo_id uuid) returns table (...)
nomina_reporte_tss(p_anio int, p_mes int) returns table (...)
```

### 6.11 Códigos de error

| Código | Cuándo | Ejemplo de mensaje |
| --- | --- | --- |
| `42501` | Sin perfil o rol `lector` en una RPC de escritura. | `sin permiso` |
| `22023` | Datos faltantes o inválidos; documento inexistente; parámetros del año ausentes; cédula inválida; cuenta de pago inválida. | `La cédula debe tener 11 dígitos.` / `No hay parámetros de nómina para el año 2026.` |
| `23514` | Estado que no permite la acción; asiento descuadrado; neto negativo; pago sin contabilizar; anulación con pago activo. | `El recibo no está contabilizado; no se puede pagar.` |
| `23505` | Duplicado: periodo, identificación de empleado, recibo por empleado, código NO. | `Ya existe un periodo de nómina con ese código.` |

---

## 7. Estados y transiciones

### 7.1 Recibo

```
                    nomina_guardar_novedad_recibo
                    nomina_eliminar_novedad_recibo
          ┌──────────────────────────────────────────┐
          ▼                                          │
     ┌─────────┐   nomina_calcular_recibo   ┌───────────┐
     │ borrador│ ─────────────────────────► │ calculado │
     └─────────┘ ◄───────────────────────── └───────────┘
          │         (si se edita una novedad)      │
          │                                        │ nomina_contabilizar_recibo
          │                                        ▼
          │                                 ┌──────────────┐
          │                                 │ contabilizado│
          │                                 └──────────────┘
          │                                        │  ▲
          │                                        │  │ nomina_anular_pago_recibo
          │                     nomina_pagar_recibo│  │ (revierte el pago)
          │                                        ▼  │
          │                                   ┌─────────┐
          │                                   │ pagado  │
          │                                   └─────────┘
          │
          └──────────── nomina_anular_recibo ───────────► anulado
                        (desde borrador, calculado o contabilizado;
                         si está pagado, primero anular el pago)
```

- `borrador → calculado`: `nomina_calcular_recibo` / `nomina_calcular_periodo`.
- `calculado → borrador`: guardar o eliminar una novedad manual.
- `calculado → contabilizado`: `nomina_contabilizar_recibo` / `nomina_contabilizar_periodo`.
- `contabilizado → pagado`: `nomina_pagar_recibo` / `nomina_pagar_periodo`.
- `pagado → contabilizado`: `nomina_anular_pago_recibo`.
- Cualquiera de `borrador`, `calculado` o `contabilizado` → `anulado`: `nomina_anular_recibo`.
- Un recibo `anulado` no se revive salvo por `nomina_agregar_empleados` (lo limpia y lo deja `borrador`), que es la vía para corregir una inclusión equivocada.

### 7.2 Periodo

El estado del periodo se **deriva** de sus recibos no anulados. No hay RPC que lo fije a mano:

```
 borrador ──(todos calculados / nomina_calcular_periodo)──► calculado
    │                                                          │
    │                                                          │ (todos contabilizados /
    │                                                          ▼  nomina_contabilizar_periodo)
    │                                                   contabilizado
    │                                                          │
    │                                                          │ (todos pagados /
    │                                                          ▼  nomina_pagar_periodo)
    │                                                       pagado
    │
    └──────────(todos los recibos anulados / nomina_anular_recibo)──────────► anulado
```

Reglas de derivación, en orden:

1. Si no hay recibos no anulados → `anulado`.
2. Si todos los no anulados están `pagado` → `pagado`.
3. Si todos están en `contabilizado` o `pagado` → `contabilizado`.
4. Si todos están en `calculado`, `contabilizado` o `pagado` → `calculado`.
5. En cualquier otro caso → `borrador`.

La RPC interna `_nomina_recalcular_periodo` recalcula totales y estado después de cada cambio de recibo. La UI puede mostrar barras de progreso (calculados/total, contabilizados/total) leyendo los estados de los recibos.

---

## 8. RLS, permisos y auditoría

### 8.1 Patrón por tabla

Para las 9 tablas (`nomina_parametros_rd`, `nomina_config_empresa`, `nomina_conceptos`, `nomina_mapeo_contable`, `empleados`, `empleado_novedades_recurrentes`, `nomina_periodos`, `nomina_recibos`, `nomina_recibo_lineas`):

- RLS habilitado en todas.
- Permisos de tabla revocados para `anon` y `authenticated`.
- Solo `select` concedido a `authenticated`.
- Política de lectura `for select` para `authenticated` que exige `(select public.rol_actual()) is not null`, con el patrón de `20261123000000_tipos_entrada_diario.sql:355-363`.
- Sin políticas de insert/update/delete: la única escritura es por RPC `security definer`.

`anon` no ve nada. `authenticated` con perfil (`admin`, `contador` o `lector`) lee todo; solo `admin` y `contador` ejecutan escrituras. `lector` recibe `42501` si intenta una RPC de escritura.

### 8.2 Permisos de funciones

- Escritura: ejecución revocada de `public`, `anon` y `authenticated`; concedida a `authenticated`. El rol se valida dentro de la función.
- Lectura: mismo esquema, sin validación de rol; RLS filtra.
- Helper `_nomina_crear_asiento`: revocado de todos; solo lo llaman las RPC `security definer`.

### 8.3 Auditoría

Tres triggers con `_auditar` (las tablas tienen `id uuid`):

| Tabla | Campos vigilados | Etiqueta | Entidad |
| --- | --- | --- | --- |
| `empleados` | `estado, salario_mensual, cargo, segmento_contable, centro_costo_id` | `identificacion` | `empleado` |
| `nomina_periodos` | `estado, total_neto, total_costo_empresa` | `codigo` | `nomina_periodo` |
| `nomina_recibos` | `estado, neto_pagar, fecha_pagado` | `''` (cae al id) | `nomina_recibo` |

Los asientos ya se auditan por `auditoria_asientos` (`20261118190225_auditoria.sql`), así que la contabilización y las anulaciones quedan registradas sin trigger extra.

### 8.4 Reset a base virgen

`docs/pruebas/reset-base-virgen.sql` debe clasificar las 9 tablas nuevas (si no, `src/lib/supabase/reset-virgen.test.ts` falla):

- **Conservar** (`-- @conservar public.<tabla>`): `nomina_parametros_rd`, `nomina_config_empresa`, `nomina_conceptos`, `nomina_mapeo_contable`. Son catálogo/configuración, como `cuentas` y `tipos_entrada_diario`.
- **Vaciar** (en el `TRUNCATE` y en el array del `DO`): `empleados`, `empleado_novedades_recurrentes`, `nomina_periodos`, `nomina_recibos`, `nomina_recibo_lineas`. Son datos operativos.

Actualizar también los contadores/comentarios del encabezado del script (hoy dice 65 tablas). El test compara conjuntos, no el texto, pero el comentario debe quedar coherente.

---

## 9. Invariantes para pgTAP

Cada una debe ser un assert (o un bloque de asserts) en `supabase/tests/nomina_*_test.sql`. Los números son los de §10.

### 9.1 Esquema, semillas y RLS

1. Existen las 9 tablas, con RLS habilitado.
2. `anon` no tiene `select`; `authenticated` tiene `select` y **no** `insert`/`update`/`delete`.
3. `nomina_parametros_rd` tiene 2026 con salario 23,223.00, topes 232,230.00 / 464,460.00 / 92,892.00, días 23.83, horas 8.00 y escala de 4 tramos.
4. Hay 40 conceptos (18/15/4/3), todos `es_sistema = true`, códigos únicos, flags coherentes con la clase.
5. Existen las cuentas 6110–6123 y 2107–2118 con tipo, naturaleza y padre correctos; **6109 no se tocó**.
6. Hay 120 filas de mapeo (40 × 3 segmentos) y cada una cumple la obligación por clase.
7. Existen los 3 contactos y la fila `id = 1` de configuración apunta a 2107 y 1102.
8. `asientos.origen_tipo` acepta `nomina` y `pago_nomina` y **conserva** los 16 valores anteriores.
9. No hay grants de `delete` en ninguna tabla de nómina.

### 9.2 Empleados y periodos

10. Crear un empleado con cédula inválida → `22023`; con cédula válida → crea el contacto con la misma identificación y lo vincula.
11. Identificación duplicada → `23505` con mensaje en español.
12. Contrato `definido` sin `fecha_fin` → `22023`/`23514`; `fecha_fin < fecha_ingreso` → error.
13. Transferencia sin banco, tipo o número de cuenta → `22023`.
14. Periodo quincenal 2026-11-16..30 con 2 quincenales y 1 mensual → 2 recibos y código `2026-11-Q2`; el mensual no entra.
15. Periodo mensual 2026-11-01..30 → código `2026-11-M`.
16. Rango no estándar (p. ej. 5–20) → `22023`; periodo duplicado/cruzado → error; un empleado con recibo no anulado en un periodo que se cruza (aunque sea de otra frecuencia) no se agrega.
17. Novedad recurrente vigente se aplica una vez; fuera de vigencia, no se aplica.
18. Días: quincena completa = 11.915; mes completo = 23.830.

### 9.3 Cálculo (los 5 casos de §10)

19. Caso A (30,000 mensual): salario 30,000.00; SFS empleado 912.00; AFP empleado 861.00; ISR 0.00; neto 28,227.00; SFS empleador 2,127.00; AFP empleador 2,130.00; SRL 330.00; INFOTEP 300.00; costo 34,887.00.
20. Caso B (100,000 mensual): ISR 12,105.37; neto 81,984.63; SRL 1,021.81; costo 116,211.81.
21. Caso C (500,000 quincenal): `base_sfs` 116,115.00; `base_afp` 232,230.00; `base_srl` 46,446.00; SFS 3,529.90; AFP 6,665.00; ISR 54,242.71; neto 185,562.39; costo 277,731.79.
22. Caso D (60,000 quincenal + 5 h extra 35%): hora extra 2,124.42; SFS 976.58; AFP 921.97; ISR 2,143.11; neto 28,082.76; costo 37,357.48.
23. Caso E (60,000 quincenal, ingreso 2026-11-25): días 4.766; salario 12,000.00; SFS 364.80; AFP 344.40; ISR 0.00; neto 11,290.80; costo 13,954.80.
24. Provisiones (30,000 mensual, `registrar_provisiones = true`): navidad 2,500.00; vacaciones 1,468.74; cesantía 2,203.11; costo 41,058.85.
25. Neto negativo (deducciones > ingresos) → `23514` sin guardar líneas ni totales.
26. Un concepto inactivo en una novedad → error; no se ignora.

### 9.4 Asientos y numeración

27. Caso A genera el asiento de §10.1 exacto: 12 líneas, débitos = créditos = 34,887.00, contactos y centro correctos.
28. Cada línea de asiento corresponde a una línea de recibo con monto > 0; no hay líneas en cero.
29. Contabilizar un recibo en `borrador` → `23514` y no crea asiento.
30. Contabilizar dos recibos seguidos → `NO-1`, `NO-2`; `tipos_entrada_diario.siguiente` queda en 3; no hay códigos duplicados.
31. Un fallo a mitad de la contabilización del periodo revierte todo y no consume consecutivos.
32. Contabilizar en un mes cerrado → error del trigger de periodos y no crea asiento.

### 9.5 Pago y anulación

33. Pagar un recibo `calculado` → `23514` y no crea asiento.
34. Pagar el caso A → asiento Dr 2107 (la cuenta guardada en el recibo) / Cr 1102 por 28,227.00, contacto empleado en el débito; recibo `pagado`; periodo `pagado`.
35. Pagar un periodo con un recibo `calculado` → `23514`; no paga ninguno (atomicidad).
36. Recibo pagado + `nomina_anular_recibo` → `23514`; no crea reversal.
37. `nomina_anular_pago_recibo` → reversal del pago, recibo `contabilizado`; luego `nomina_anular_recibo` → reversal del NO-N, recibo `anulado`.
38. Suma de todos los asientos (original + pagos + reversas) por cuenta = 0 después de anular pago y recibo.
39. Anular un recibo en `borrador`/`calculado` no crea asiento y lo deja `anulado`.
40. `nomina_agregar_empleados` revive un recibo anulado y lo deja `borrador` con totales en 0.

### 9.6 Reportes y permisos

41. `nomina_resumen_periodo` devuelve una fila por recibo, con los totales del recibo y el código NO.
42. `nomina_reporte_tss` solo incluye periodos `contabilizado`/`pagado` del mes, agrupa por empleado y excluye anulados.
43. Un `lector` puede leer las tablas y ejecutar `nomina_resumen_periodo`/`nomina_reporte_tss`, pero recibe `42501` en `nomina_calcular_periodo`.
44. `authenticated` no puede hacer `insert`, `update` ni `delete` directo sobre las tablas (permiso denegado).

---

## 10. Casos numéricos de referencia

Todos con los parámetros 2026, SRL tipo 1 (1.10%), INFOTEP activo y provisión apagada salvo donde se indique. Los importes están en RD$.

### 10.1 Caso A — 30,000 mensual, sin novedades (referencia principal)

Empleado con salario mensual 30,000.00, contratado antes de 2026, periodo mensual completo (23.83 días), sin horas extra ni préstamos.

| Concepto | Base | Cálculo | Monto |
| --- | ---: | --- | ---: |
| Salario | — | 30,000 × 1 × 1 | 30,000.00 |
| SFS empleado | 30,000.00 | 30,000 × 3.04% | 912.00 |
| AFP empleado | 30,000.00 | 30,000 × 2.87% | 861.00 |
| ISR | 30,000.00 | anual 360,000 − TSS 21,276 = 338,724 < 416,220 | 0.00 |
| SFS empleador | 30,000.00 | 30,000 × 7.09% | 2,127.00 |
| AFP empleador | 30,000.00 | 30,000 × 7.10% | 2,130.00 |
| SRL | 30,000.00 | 30,000 × 1.10% | 330.00 |
| INFOTEP | 30,000.00 | 30,000 × 1.00% | 300.00 |

- `total_ingresos` = 30,000.00
- `total_deducciones` = 1,773.00
- `total_aportes_empleador` = 4,887.00
- `total_provisiones` = 0.00
- `neto_pagar` = **28,227.00**
- `costo_total_empresa` = **34,887.00**

Asiento NO-1:

| Cuenta | Contacto | Descripción | Débito | Crédito |
| --- | --- | --- | ---: | ---: |
| 6110 Sueldos y salarios | Empleado | Salario | 30,000.00 | |
| 6114 Aportes patronales SFS | TSS | SFS empleador 7.09% | 2,127.00 | |
| 6115 Aportes patronales AFP | TSS | AFP empleador 7.10% | 2,130.00 | |
| 6116 Seguro de riesgos laborales | TSS | SRL | 330.00 | |
| 6117 INFOTEP | INFOTEP | INFOTEP 1.00% | 300.00 | |
| 2108 Retenciones SFS por pagar | TSS | SFS empleado 3.04% | | 912.00 |
| 2109 Retenciones AFP por pagar | TSS | AFP empleado 2.87% | | 861.00 |
| 2111 Aportes SFS por pagar | TSS | SFS empleador 7.09% | | 2,127.00 |
| 2112 Aportes AFP por pagar | TSS | AFP empleador 7.10% | | 2,130.00 |
| 2113 Acumulaciones SRL por pagar | TSS | SRL | | 330.00 |
| 2114 Acumulaciones INFOTEP por pagar | INFOTEP | INFOTEP 1.00% | | 300.00 |
| 2107 Salarios por pagar | Empleado | Salario por pagar | | 28,227.00 |
| **Totales** | | | **34,887.00** | **34,887.00** |

Pago:

| Cuenta | Contacto | Débito | Crédito |
| --- | --- | ---: | ---: |
| 2107 Salarios por pagar | Empleado | 28,227.00 | |
| 1102 Banco principal | — | | 28,227.00 |

Este caso reproduce exactamente las cifras de SFS/AFP/cargas del estudio NO-1 sobre la base de 30,000 (912 / 861 / 2,127 / 2,130 / 330 / 300). La diferencia con NO-1 es que allí había 2,124.42 de horas extra, 1,500 de préstamo y ningún ISR.

### 10.2 Caso B — 100,000 mensual (ISR con tramo)

| Concepto | Base | Cálculo | Monto |
| --- | ---: | --- | ---: |
| Salario | — | — | 100,000.00 |
| SFS empleado | 100,000.00 | × 3.04% | 3,040.00 |
| AFP empleado | 100,000.00 | × 2.87% | 2,870.00 |
| ISR | — | ver abajo | 12,105.37 |
| SFS empleador | 100,000.00 | × 7.09% | 7,090.00 |
| AFP empleador | 100,000.00 | × 7.10% | 7,100.00 |
| SRL | 92,892.00 | × 1.10% | 1,021.81 |
| INFOTEP | 100,000.00 | × 1.00% | 1,000.00 |

ISR:

```
base_mensual_isr = 100,000
meses_proyectados = 12
ingreso_anual = 1,200,000
sfs_mensual_proy = 3,040.00; afp_mensual_proy = 2,870.00
tss_anual = 5,910.00 × 12 = 70,920.00
base_gravable = 1,129,080.00
tramo: 25% → 79,775.15 + 25% × (1,129,080 − 867,123) = 145,264.40
isr_periodo = 145,264.40 / 12 = 12,105.37
```

- Neto = 100,000 − 3,040 − 2,870 − 12,105.37 = **81,984.63**
- Costo = 100,000 + 16,211.81 = **116,211.81**
- Asiento: débitos 100,000 + 7,090 + 7,100 + 1,021.81 + 1,000 = 116,211.81; créditos 3,040 + 2,870 + 12,105.37 + 7,090 + 7,100 + 1,021.81 + 1,000 + 81,984.63 = 116,211.81.

### 10.3 Caso C — 500,000 quincenal (topes proporcionales)

| Concepto | Base | Cálculo | Monto |
| --- | ---: | --- | ---: |
| Salario del periodo | — | 500,000 × 0.5 | 250,000.00 |
| SFS empleado | 116,115.00 | 232,230 / 2 × 3.04% | 3,529.90 |
| AFP empleado | 232,230.00 | 464,460 / 2 × 2.87% | 6,665.00 |
| ISR | — | ver abajo | 54,242.71 |
| SFS empleador | 116,115.00 | × 7.09% | 8,232.55 |
| AFP empleador | 232,230.00 | × 7.10% | 16,488.33 |
| SRL | 46,446.00 | 92,892 / 2 × 1.10% | 510.91 |
| INFOTEP | 250,000.00 | × 1.00% | 2,500.00 |

ISR:

```
base_mensual_isr = 250,000 / 0.5 = 500,000
ingreso_anual = 6,000,000
sfs_mensual_proy = 232,230 × 3.04% = 7,059.79
afp_mensual_proy = 464,460 × 2.87% = 13,330.00
tss_anual = 20,389.79 × 12 = 244,677.48
base_gravable = 5,755,322.52
isr_anual = 79,775.15 + 25% × (5,755,322.52 − 867,123) = 1,301,825.03
isr_periodo = 1,301,825.03 / 24 = 54,242.71
```

- Neto = 250,000 − 3,529.90 − 6,665.00 − 54,242.71 = **185,562.39**
- Costo = 250,000 + 27,731.79 = **277,731.79**
- Asiento cuadra: 250,000 + 8,232.55 + 16,488.33 + 510.91 + 2,500 = 277,731.79.

### 10.4 Caso D — 60,000 quincenal + 5 horas extra al 35%

Empleado contratado antes de 2026; quincena completa (11.915 días); sin préstamo.

| Concepto | Base | Cálculo | Monto |
| --- | ---: | --- | ---: |
| Salario | — | 60,000 × 0.5 | 30,000.00 |
| Horas Extra 35% | — | 60,000 / 23.83 / 8 × 1.35 × 5 | 2,124.42 |
| SFS empleado | 32,124.42 | × 3.04% | 976.58 |
| AFP empleado | 32,124.42 | × 2.87% | 921.97 |
| ISR | — | ver abajo | 2,143.11 |
| SFS empleador | 32,124.42 | × 7.09% | 2,277.62 |
| AFP empleador | 32,124.42 | × 7.10% | 2,280.83 |
| SRL | 32,124.42 | × 1.10% | 353.37 |
| INFOTEP | 32,124.42 | × 1.00% | 321.24 |

ISR:

```
base_mensual_isr = 32,124.42 / 0.5 = 64,248.84
ingreso_anual = 770,986.08
sfs_mensual_proy = 1,953.16; afp_mensual_proy = 1,843.94
tss_anual = 3,797.10 × 12 = 45,565.20
base_gravable = 725,420.88
tramo 20% → 31,216.35 + 20% × (725,420.88 − 624,329) = 51,434.73
isr_periodo = 51,434.73 / 24 = 2,143.11
```

- Neto = 32,124.42 − 976.58 − 921.97 − 2,143.11 = **28,082.76**
- Costo = 32,124.42 + 5,233.06 = **37,357.48**

### 10.5 Caso E — 60,000 quincenal, ingreso el 25 de noviembre de 2026

Periodo 2026-11-16..30 (15 días calendario); días efectivos 25–30 = 6; `proporcion = 0.4`.

| Concepto | Base | Cálculo | Monto |
| --- | ---: | --- | ---: |
| Días trabajados | — | 11.915 × 0.4 | 4.766 |
| Salario | — | 60,000 × 0.5 × 0.4 | 12,000.00 |
| SFS empleado | 12,000.00 | × 3.04% | 364.80 |
| AFP empleado | 12,000.00 | × 2.87% | 344.40 |
| ISR | — | 2 meses (nov–dic) → 120,000 anual < 416,220 | 0.00 |
| SFS empleador | 12,000.00 | × 7.09% | 850.80 |
| AFP empleador | 12,000.00 | × 7.10% | 852.00 |
| SRL | 12,000.00 | × 1.10% | 132.00 |
| INFOTEP | 12,000.00 | × 1.00% | 120.00 |

- Neto = 12,000 − 364.80 − 344.40 = **11,290.80**
- Costo = 12,000 + 1,954.80 = **13,954.80**
- El asiento cuadra: 12,000 + 850.80 + 852.00 + 132.00 + 120.00 = 13,954.80.

### 10.6 Caso con provisiones — 30,000 mensual

Con `registrar_provisiones = true` y base de provisiones 30,000.00:

| Provisión | Cálculo | Monto |
| --- | --- | ---: |
| Regalía pascual | 30,000 / 12 | 2,500.00 |
| Vacaciones (menos de 5 años) | 30,000 × 14 / (23.83 × 12) | 1,468.74 |
| Cesantía (menos de 5 años) | 30,000 × 21 / (23.83 × 12) | 2,203.11 |
| **Total** | | **6,171.85** |

- `total_provisiones` = 6,171.85
- `costo_total_empresa` = 30,000 + 4,887 + 6,171.85 = **41,058.85**
- El asiento agrega tres débitos (6118/6119/6120) y tres créditos (2116/2117/2118); sigue cuadrado.

### 10.7 Comparación con el comprobante NO-1 del estudio

El estudio registra un empleado con salario mensual 60,000, quincena completa (11.915 días), 5 horas extra al 35% y un préstamo de 1,500. Su NO-1:

| Concepto | Alegra | Nuestro motor (mismas reglas de §4) | Diferencia |
| --- | ---: | ---: | --- |
| Salario | 30,000.00 | 30,000.00 | — |
| Horas extra 35% | 2,124.42 | 2,124.42 | — |
| SFS empleado | 912.00 | 976.58 | +64.58 (Alegra excluye horas extra de la base TSS) |
| AFP empleado | 861.00 | 921.97 | +60.97 (idem) |
| ISR | 0.00 | 2,143.11 | +2,143.11 (Alegra no retuvo ISR) |
| Préstamo | 1,500.00 | 1,500.00 | — |
| Neto | 28,851.42 | 26,582.76 | −2,268.66 (125.55 de TSS + 2,143.11 de ISR) |
| SFS empleador | 2,127.00 | 2,277.62 | +150.62 |
| AFP empleador | 2,130.00 | 2,280.83 | +150.83 |
| SRL | 330.00 | 353.37 | +23.37 |
| INFOTEP | 300.00 | 321.24 | +21.24 |
| Total asiento | 37,011.42 | 37,357.48 | +346.06 (solo cargas patronales) |

**Por qué difiere:** dos decisiones deliberadas. (1) Las horas extra son remuneración y entran en la base TSS (`grava_tss = true`); Alegra las excluyó. (2) Nuestro motor sí retiene ISR por proyección anual; Alegra no lo hizo en el caso. El neto baja porque se retiene más; el costo de la empresa sube solo por las cargas patronales sobre las horas extra. El caso A (§10.1) coincide con el estudio en SFS/AFP y cargas porque usa la misma base de 30,000 sin horas extra.

---

## 11. Plan de implementación (3A–3E)

### 11.1 3A/3B — migraciones, pgTAP y tipos

Propuesta de **tres migraciones** (timestamp UTC real, estrictamente creciente, después de `20261124120000`; no copiar timestamps de este documento):

1. `<ts>_nomina_catalogos.sql`: `nomina_parametros_rd`, `nomina_config_empresa`, `nomina_conceptos`, `nomina_mapeo_contable`, semillas de cuentas/contactos/conceptos/mapeo/config, RLS.
2. `<ts>_nomina_operacion.sql`: `empleados`, `empleado_novedades_recurrentes`, `nomina_periodos`, `nomina_recibos`, `nomina_recibo_lineas`, ampliación del check de `asientos`, índices, triggers de auditoría, RLS.
3. `<ts>_nomina_rpcs.sql`: helper `_nomina_crear_asiento`, RPCs de configuración, empleados, periodos, cálculo, contabilización, pago, colillas, anulaciones y lecturas.

Orden recomendado dentro de 3A/3B:

- Catálogos primero (los RPCs y las tablas operativas dependen de ellos).
- Operación después (FKs a contactos, cuentas, centros y asientos).
- RPCs al final (dependen de todo).
- `src/lib/supabase/types.ts` se regenera con `pnpm db:types` **después** de la última migración y se commitea; el job `db` de CI falla si no está al día.
- `docs/pruebas/reset-base-virgen.sql` se actualiza en la misma tarea de las tablas operativas (§8.4).

pgTAP sugerido:

- `supabase/tests/nomina_catalogos_test.sql` (esquema, semillas, RLS, cuentas, mapeo).
- `supabase/tests/nomina_calculo_test.sql` (casos A–E, provisiones, prorrata, horas extra, neto negativo).
- `supabase/tests/nomina_contabilidad_test.sql` (asiento NO-N, numeración, candado de pago, pago, cierre de periodo).
- `supabase/tests/nomina_anulacion_test.sql` (anular pago, anular recibo, reversas, sumas en cero).
- `supabase/tests/nomina_reportes_test.sql` (resumen y TSS/IR-3, permisos de lector).

### 11.2 3C/3D/3E — TS y UI

- **3C:** configuración (Empresa, Contable, Conceptos, Parámetros) y empleados (lista, ficha, novedades recurrentes). Server actions en `src/lib/nomina/`, consultas paginadas.
- **3D:** periodos (lista, crear, detalle, agregar empleados), recibos (detalle, novedades manuales, calcular), colilla imprimible.
- **3E:** contabilizar, pagar, enviar colillas, reportes TSS/IR-3 y los enlaces en el menú de Contabilidad.

Locks que aplican a 3C/3D/3E (no son opcionales):

- `src/lib/tablas-listas.test.ts`: listas con `TablaLista` y `EsqueletoTabla`; `<TableHead>` de 48 px.
- `src/lib/paginacion.test.ts`: paginación por lotes (`paginarConsulta`/`consultarEnLotes`), sin topes de 300/500/1,000.
- `src/lib/diseno-paginas.test.ts`: `EncabezadoPagina` + migas; sin `text-3xl` suelto.
- `src/lib/fechas-nativas.test.ts`: `DatePicker`/`DatePickerCampo`; nada de `<input type="date">`.
- `src/lib/selects-nativos.test.ts`: `Select`/`SelectCampo`/`Combobox`; nada de `<select>`.
- `src/lib/rpc-sin-extraer.test.ts`: llamar `supabase.rpc("nombre", args)` directo, sin variables ni `as`.
- Diseño: tokens de `docs/plantilla-diseno.md`, `--primary` azul; nunca teal de Alegra. Capturas claro/oscuro y móvil antes de reportar.

### 11.3 Verificación

- Docs-only (esta tarea): `pnpm typecheck`, `pnpm check`, `pnpm test` en verde.
- 3A/3B: `supabase start` + `supabase db reset` + `supabase test db` (nunca contra producción) y `pnpm db:types`.
- 3C/3D/3E: `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build` y capturas.

### 11.4 Preflight antes de aplicar (solo lectura)

Antes de escribir la primera migración, 3A confirma en la base local (nunca en producción):

1. No existen tablas `nomina_*` ni `empleados`; si existen, se para y se revisa.
2. Las cuentas 6110–6123 y 2107–2118 no existen; 6109 ya es “Gasto de depreciación”.
3. `tipos_entrada_diario` tiene exactamente una fila activa con prefijo `NO`.
4. El check de `asientos.origen_tipo` tiene los 16 valores de §3.6 y no tiene `nomina`/`pago_nomina`.
5. `_rnc_digito_valido(text)` existe y está revocada de `authenticated`.
6. `docs/pruebas/reset-base-virgen.sql` está al día con las 65 tablas actuales.
7. El último archivo de `supabase/migrations` tiene timestamp menor que el que se va a crear.
8. No hay migraciones aplicadas al remoto sin commitear (el repo es la fuente).

---

## 12. Riesgos y decisiones pendientes

### 12.1 Riesgos y limitaciones de fase 1

1. **ISR sin acumulado anual.** La proyección usa el salario mensual equivalente y los meses desde el ingreso hasta diciembre, pero no acumula pagos previos del mismo año ni otros empleadores. Un cambio de salario a mitad de año o un ingreso tardío puede retener de menos o de más; el ajuste de diciembre queda para una fase posterior.
2. **Provisiones que no se consumen.** Si `registrar_provisiones = true`, pagar regalía, vacaciones o cesantía por nómina vuelve a debitar gasto. La provisión acumulada no se reduce. Se resuelve con un saldo por empleado/concepto en una fase posterior.
3. **Ausencias sin RPC de días.** `dias_trabajados` se calcula por ingreso/egreso, no por ausencias. Una licencia no remunerada se registra como deducción manual por el valor de los días (concepto `LICENCIA_NO_REMUNERADA`). Editar días directamente queda fuera.
4. **Correo de colillas.** No hay proveedor de correo. La RPC solo sella la constancia; el envío real es 3E.
5. **Dispersión bancaria.** No se genera TXT ni archivo de banco. El pago es el registro contable contra caja/banco.
6. **Consecutivo NO.** Es gapless dentro de la transacción; si un admin edita `siguiente` a mano, puede chocar con un código existente y la RPC falla (no lo salta en silencio).
7. **Cambio de frecuencia o salario.** Afecta solo a periodos futuros o a recibos aún no contabilizados; los contabilizados no se recalculan.
8. **Un solo empleador y una sola moneda.** Sin multiempresa, multimoneda ni pagos en divisa.
9. **Regalía/cesantía exentas de ISR/TSS por semilla.** Si se paga un monto superior al legal, se ajusta con una novedad manual o se cambia el flag del concepto (decisión de Contable).
10. **`categoria_empresa` informativa.** No cambia la tasa de INFOTEP en fase 1.
11. **ISR sobre pagos únicos.** La proyección anual trata cualquier ingreso gravable del periodo (un bono, una comisión extraordinaria) como si se repitiera todos los meses del año. Puede retener de más; el ajuste queda para diciembre o para una fase con acumulados.
12. **Provisiones sobre pagos únicos y vacaciones.** La base de provisiones es toda la base TSS, así que un bono extraordinario también provisiona. Además, pagar `VACACIONES` por nómina con `registrar_provisiones = true` vuelve a gastar y a provisionar. Hasta que exista consumo de provisiones, se recomienda mantener `registrar_provisiones = false` o provisionar solo por asiento manual al cierre.

### 12.2 Decisiones que aprueba Waldy / Contable

- `categoria_empresa = 'pequena'`, `riesgo_laboral = 'tipo_1'`, `aplica_infotep = true`, `registrar_provisiones = false` y `frecuencia_defecto = 'quincenal'` como defaults.
- Cuenta de pago por defecto 1102 y salarios por pagar 2107.
- Códigos de cuentas 6110–6123 y 2107–2118 (no chocan con 6109 ni con las existentes).
- Que las horas extra y comisiones gravables entren en la base TSS (decisión fiscal correcta; difiere de Alegra).
- Que el ISR se retenga por proyección anual (Alegra no lo hizo en el caso).
- Proveedor de correo para las colillas (3E).
- Si se quiere un `nomina_anular_periodo` explícito; en fase 1 se anulan los recibos uno por uno.

### 12.3 Definición de “listo” para 3A–3E

- Migraciones aplicadas en local (`supabase db reset`), nunca contra producción.
- `supabase test db` verde con los 5 archivos pgTAP de nómina y sin romper los existentes.
- `src/lib/supabase/types.ts` regenerado y commiteado; job `db` de CI verde.
- `docs/pruebas/reset-base-virgen.sql` clasifica las 9 tablas nuevas y su test pasa.
- `nomina_reporte_tss` devuelve los números de §10 para los casos sembrados.
- La UI pasa `pnpm typecheck`, `pnpm check`, `pnpm test` y `pnpm build`; capturas claro/oscuro y móvil aprobadas por Waldy.
- `HANDOFF.md` actualizado por el Orquestador (no por el subagente de esta tarea).

### 12.4 Fuera de alcance

- e-CF/DGII de nómina, 606/607, IR-3 en formato XML oficial.
- Importación Excel de empleados y editor en línea.
- Portal del empleado, solicitudes de vacaciones y aprobaciones.
- Contabilidad de provisiones consumidas, liquidaciones y finiquitos como documento separado.
- Multimoneda, multiempresa, sucursales y nómina por proyecto.
- Firma electrónica de colillas.

---

## Apéndice A. Payloads de ejemplo

**Crear un periodo quincenal**

```json
{
  "frecuencia": "quincenal",
  "fecha_inicio": "2026-11-16",
  "fecha_fin": "2026-11-30",
  "fecha_pago": "2026-11-30",
  "observaciones": "Quincena 2 de noviembre"
}
```

**Crear un empleado**

```json
{
  "tipo_identificacion": "cedula",
  "identificacion": "001-1234567-8",
  "primer_nombre": "María",
  "segundo_nombre": "José",
  "primer_apellido": "Fernández",
  "segundo_apellido": "López",
  "correo": "maria@medoxigas.com",
  "telefono": "809-555-0101",
  "municipio": "Santo Domingo de Guzmán",
  "direccion": "Av. Independencia 123",
  "cargo": "Contadora",
  "area": "Administrativa",
  "segmento_contable": "administrativa",
  "tipo_contrato": "indefinido",
  "fecha_ingreso": "2024-03-01",
  "frecuencia_pago": "quincenal",
  "salario_mensual": 60000.00,
  "metodo_pago": "transferencia",
  "banco_nombre": "Banco Popular",
  "tipo_cuenta_banco": "corriente",
  "numero_cuenta_banco": "123456789",
  "clave_tss": "001"
}
```

**Novedad recurrente (préstamo)**

```json
{
  "empleado_id": "00000000-0000-0000-0000-000000000000",
  "concepto_id": "00000000-0000-0000-0000-000000000000",
  "monto": 1500.00,
  "fecha_inicio": "2026-11-01",
  "notas": "Préstamo a 6 quincenas"
}
```

**Novedad manual de horas extra**

```json
{
  "recibo_id": "00000000-0000-0000-0000-000000000000",
  "concepto_id": "00000000-0000-0000-0000-000000000000",
  "cantidad": 5,
  "notas": "5 horas al 35%"
}
```

**Pagar un recibo**

```json
{
  "recibo_id": "00000000-0000-0000-0000-000000000000",
  "fecha": "2026-11-30",
  "cuenta_pago_id": "00000000-0000-0000-0000-000000000000"
}
```

**Pagar un periodo**

```json
{
  "periodo_id": "00000000-0000-0000-0000-000000000000",
  "fecha": "2026-11-30",
  "cuenta_pago_id": "00000000-0000-0000-0000-000000000000"
}
```

**Registrar envío de colillas**

```json
{
  "periodo_id": "00000000-0000-0000-0000-000000000000",
  "recibo_ids": [
    "00000000-0000-0000-0000-000000000000",
    "00000000-0000-0000-0000-000000000000"
  ],
  "enviado_a": "maria@medoxigas.com"
}
```

---

## Apéndice B. Referencias revisadas

| Referencia | Qué se tomó |
| --- | --- |
| `docs/alegra/nomina/ALEGRA-NOMINA.md` (en `main` desde el PR 67) | Flujo Empleados → Periodo → Calcular → Contabilizar → Pagar → Colillas; caso NO-1; tasas RD; regla “un comprobante por empleado”. |
| `docs/alegra/nomina/DESIGN-ALEGRA-NOMINA.md` (mismo PR) | Estados por fila, barras de progreso, candado de pago, colilla documental, tokens (solo como referencia; no se copia el teal). |
| `docs/alegra/ALEGRA.md:524-556` | Tipos de entrada de diario, incluido Nómina (NO). |
| `docs/contrato-db.md` | Convenciones de tablas, dinero, roles, RLS y RPC. |
| `docs/motor-contable.md` | Patrón documento → asiento, cuentas, anulación y garantías. |
| `supabase/migrations/20261113140000_motor_contable.sql:43-220,510-600` | Catálogo, contactos, asientos, `_crear_asiento`. |
| `supabase/migrations/20261123000000_tipos_entrada_diario.sql:23-70,355-363` | Tipo NO, `asientos.codigo`, RLS. |
| `supabase/migrations/20261124100000_inventario_inicial_asiento.sql:74-92` | Lista vigente de `origen_tipo`. |
| `supabase/migrations/20261124120000_config_dgii_rnc.sql:183-220` | `_rnc_digito_valido`. |
| `supabase/migrations/20261115201000_centros_costo.sql:17-37` | Centros de costo y `_crear_asiento` con centro. |
| `supabase/migrations/20261114300100_periodos_cierre.sql:45-78` | Trigger de periodo cerrado. |
| `supabase/migrations/20261121120000_adjuntos.sql:238-247` y `20261123000000_tipos_entrada_diario.sql:355-363` | Patrón de RLS. |
| `supabase/AGENTS.md` | Reglas de migraciones, RLS, pgTAP y `types.ts`. |
| `src/lib/supabase/migraciones.test.ts`, `reset-virgen.test.ts` | Candados de nombre de migración y clasificación de tablas. |
| `src/navigation/sidebar/sidebar-items.ts:216-248` | Contabilidad como grupo; Nómina entra como subgrupo. |
| `src/lib/{tablas-listas,paginacion,diseno-paginas,fechas-nativas,selects-nativos,rpc-sin-extraer}.test.ts` | Candados de UI y RPC que aplican a 3C/3D/3E. |

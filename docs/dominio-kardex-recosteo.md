# Dominio: Kardex valorado y recosteo de inventario

Contrato de diseño para el inventario perpetuo de Medoxigas Contabilidad. Aún
no es una migración: es la referencia que deben seguir las migraciones, los RPC
del motor, los reportes y los pgTAP que implementen el Kardex valorado.

Documentos relacionados: `docs/motor-contable.md` (asientos) y
`docs/dominio-inventario-ferreteria.md` (unidades base, combos y almacenes).

## 1. Problema de negocio

La ferretería puede vender en negativo un producto inventariable cuando
`productos.vende_negativo = true`: la mercancía salió por el mostrador antes de
registrar la compra o la entrada que la respalda. Eso es operativamente
necesario, pero contablemente deja una deuda de inventario.

Ejemplo con cemento:

1. El cemento tiene costo promedio RD$500 y existencia 0.
2. Se venden 10 unidades permitidas en negativo. La venta reconoce costo por
   RD$5,000 y el inventario queda en -10 / RD$-5,000.
3. Entra la compra real de 10 unidades a RD$520. El costo correcto de esas 10
   unidades vendidas no era RD$5,000 sino RD$5,200.
4. Si no hay recosteo, los RD$200 quedan para siempre dentro de Inventario
   (1104) aunque no existe ni una unidad física: el mayor ya no representa el
   valor del almacén.

Alegra sí corrige este caso porque, de lo contrario, su reporte de valor de
inventario y su estado de resultados nunca cuadran cuando se vende antes de
comprar. Medoxigas copia la necesidad de negocio, pero evita tres errores de
Alegra:

1. **Nada de asientos fantasma.** El recosteo no es una corrección invisible ni
   un ajuste que solo aparece dentro del cálculo. Cada recosteo crea un asiento
   visible, cuadrado, fechado y consultable en el libro diario con
   `origen_tipo = 'recosteo_inventario'`.
2. **Nada de ocultar la cuenta de costo en los movimientos.** El Kardex muestra
   el asiento del documento y, si aplica, el asiento de recosteo. La cuenta de
   costo usada es la del producto (o `costo_ventas` de `config_contable`), no
   una cuenta opaca del sistema.
3. **Nada de deriva por redondear el promedio a 2 decimales.** El promedio se
   guarda con 6 decimales (`numeric(16,6)`) y el valor en libros con centavos
   exactos (`numeric(14,2)`). Cuando la cantidad llega a cero, el residuo de
   centavos sale completo en ese movimiento: no se arrastra a la siguiente
   compra.

## 2. Decisiones aprobadas por Waldy

Estas tres decisiones no se reinterpretan:

1. **Fecha del recosteo (Opción A).** El recosteo se calcula contra el stock
   negativo vigente al momento de la entrada, pero el asiento visible se fecha
   con la fecha del documento que dispara esa entrada. No se reabren períodos
   cerrados ni se recalculan asientos de ventas ya cerrados.
2. **Cuenta del recosteo (Opción A).** El asiento usa
   `coalesce(productos.cuenta_costo_id, _cuenta_config('costo_ventas'))`
   contra `coalesce(productos.cuenta_inventario_id, _cuenta_config('inventario'))`.
   Por defecto: `5101 Costo de ventas` contra `1104 Inventario de mercancía`.
   Si el recosteo aumenta el costo: Dr costo / Cr inventario. Si lo reduce:
   Dr inventario / Cr costo.
3. **Productos con costo 0.** Se permite vender en negativo un producto
   inventariable con costo 0. La venta sale con costo 0 y queda la cantidad
   negativa; al entrar la compra se recostea completo contra el costo real. El
   panel de salud de inventario advierte productos en negativo o con costo 0.

### Decisiones de diseño derivadas (no cambian las tres anteriores)

Para que esas decisiones y la invariante puedan cumplirse, este contrato hace
explícitas dos consecuencias que el implementador no debe reinterpretar:

1. **La anulación de venta se valora como reingreso al costo vigente.** La
   reversa contable original queda congelada; la diferencia se muestra como
   puente visible. Así la mercancía no queda subvaluada cuando el costo cambió
   después de la venta.
2. **El inventario inicial deja de mutar asientos históricos.** Alegra muta el
   asiento vivo, pero eso rompe el corte histórico de un Kardex append-only.
   Medoxigas conserva la misma cuenta y experiencia de corrección, pero crea
   movimientos/asientos correctores visibles en la fecha de edición.

## 3. Estado valorado y alcance por almacén

El costo y el valor del inventario siguen siendo **globales por producto**, como
en el motor actual. El almacén controla la existencia física; no hay todavía un
costo promedio independiente por almacén.

Variables usadas en todas las fórmulas:

| símbolo | columna | precisión | significado |
| --- | --- | --- | --- |
| `q` | `productos.cantidad` | `numeric(14,2)` | cantidad global del producto, en unidad base |
| `c` | `productos.costo_promedio` | `numeric(16,6)` | costo promedio móvil unitario global |
| `v` | `productos.valor_inventario` | `numeric(14,2)` | valor en libros global del producto |
| — | `productos.costo` | `numeric(14,2)` | copia de compatibilidad: `round(costo_promedio, 2)` |

Reglas:

- Toda cantidad valorada está en **unidad base** (ver
  `docs/dominio-inventario-ferreteria.md`). La conversión se hace antes de
  costear: `cantidad_base = round(cantidad × factor_base, 2)`.
- Cuando una compra viene en otra presentación, el valor de entrada es el
  subtotal exacto de la línea (`M`) y el costo unitario valorado es `M /
  cantidad_base` con 6 decimales. Esta regla sustituye el redondeo intermedio a
  2 decimales del costo base descrito en la fase 1A; el costo de presentación
  impreso en la línea no cambia.
- El signo de `q` determina el caso. Un negativo por almacén con `q` global
  positivo no genera recosteo: es un problema operativo de ubicación que debe
  aparecer en salud de inventario, pero no una deuda valorada de inventario.
- `productos.costo` nunca se escribe por separado. Todo camino que cambie
  `costo_promedio` escribe también `costo = round(costo_promedio, 2)`.
- `c` no se reinicia cuando `q = 0`: conserva el último costo conocido. Es el
  costo provisional de una nueva venta en negativo. Una entrada posterior a
  costo distinto lo corrige por recosteo.
- **Orden de costeo:** el costo se calcula en el orden real en que la base
  confirma las transacciones (`secuencia`), no por la hora del cliente. Esto es
  especialmente importante en ventas POS offline que se sincronizan después:
  `fecha` conserva la fecha contable del documento, `creado_en`/`secuencia` la
  llegada real al servidor. Si esa fecha contable cae en un período cerrado, el
  documento se rechaza completo; no se reabre ni se corrige en silencio.
- Los montos se calculan con `numeric` de Postgres, nunca con flotantes.
  `round(x, 2)` de Postgres redondea medios alejándose de cero.

Helper de reparto exacto:

```text
parte(total, cantidad_total, cantidad_parte) =
    total                              si cantidad_parte = cantidad_total
    round(total × cantidad_parte / cantidad_total, 2) en otro caso
```

Se usa para asignar el valor de una línea de compra a las unidades que cubren
negativo y para prorratear el valor provisional de un stock negativo. Si la
parte consume el total, se toma el total exacto para no perder RD$0.01.

Concurrencia obligatoria:

1. La RPC expande combos y normaliza unidades antes de costear.
2. Toma `SELECT ... FOR UPDATE` de las filas de `productos` afectadas en orden
   fijo por `producto_id` antes del primer cálculo. Las filas de `existencias`
   se bloquean en ese mismo orden, como ya hace la venta.
3. Procesa las líneas en orden de documento determinista. Si el mismo producto
   aparece dos veces, la segunda línea ve el estado dejado por la primera dentro
   de la misma transacción.
4. Cualquier validación que falle revierte todo: documento, existencias,
   productos, movimientos, asiento principal y recosteo.

## 4. Invariante fundamental

En cada commit de una RPC de inventario:

```text
saldo mayor de las cuentas de inventario
    = Σ productos.valor_inventario de productos inventariables
```

al centavo exacto. El saldo mayor es `Σ(debito - credito)` en la cuenta
`inventario` de `config_contable` (1104 por defecto) más las cuentas
`cuenta_inventario_id` personalizadas de productos. Las líneas de documentos y
sus reversiones quedan incluidas por fecha real del asiento.

Además, por producto:

```text
cantidad = 0  ⇒  valor_inventario = 0.00
```

La invariante se cumple al final de la transacción, no necesariamente en cada
sentencia intermedia. La implementación debe mantener en una sola transacción:
documento, asiento del documento, movimiento de Kardex, asiento de recosteo y
actualización de `productos`.

Se sostiene por construcción: `valor_documento` es exactamente el efecto de la
cuenta de inventario del asiento principal y `valor_recosteo` el efecto de la
cuenta de inventario del asiento de recosteo/puente. Como `productos` se
actualiza con `valor_movimiento = valor_documento + valor_recosteo`, cada
cambio del mayor tiene el mismo cambio en el estado valorado. Ninguna RPC puede
mover cantidad/costo por SQL separado sin pasar por esa escritura atómica.

**Dato heredado.** La migración no debe inventar diferencias históricas. Al
abrir el Kardex se crea una fila de apertura por producto/almacén y se compara
`Σ round(cantidad × costo, 2)` con el mayor histórico. Si hay descuadre previo,
queda como `LEGACY_DESCUADRE` en salud de inventario y requiere una
conciliación de apertura aprobada por Waldy/Contable. Desde la activación del
motor nuevo, ninguna operación nueva puede crear esa diferencia.

## 5. Modelo de datos

### 5.1 `productos`

Columnas nuevas:

| columna | tipo | regla |
| --- | --- | --- |
| `valor_inventario` | `numeric(14,2) not null default 0` | valor en libros global; lo normal es que tenga el mismo signo que `cantidad` (un signo cruzado es hallazgo crítico) |
| `costo_promedio` | `numeric(16,6) not null default 0 check (costo_promedio >= 0)` | promedio móvil unitario en unidad base |

`productos.costo numeric(14,2)` se conserva por compatibilidad y debe quedar
sincronizado con `round(costo_promedio, 2)` en el mismo update.

### 5.2 `public.movimientos_inventario`

Tabla **append-only**. Una fila representa la transición completa de un
producto causada por una línea de documento (o por un componente de combo). No
se edita ni se borra: las correcciones son movimientos nuevos de signo contrario.

Columnas mínimas:

| columna | tipo | significado |
| --- | --- | --- |
| `id` | `uuid pk default gen_random_uuid()` | identificador |
| `secuencia` | `bigint generated always as identity unique` | orden total de escritura; desempata filas de la misma fecha/transacción |
| `producto_id` | `uuid not null → productos` | producto/componente cuyo costo se mueve |
| `almacen_id` | `uuid not null → almacenes` | almacén físico del movimiento |
| `fecha` | `date not null` | fecha del documento que origina el movimiento |
| `cantidad_antes` | `numeric(14,2)` | `q` global antes |
| `cantidad_movimiento` | `numeric(14,2)` | impacto en `q` global en unidad base; entrada positiva, salida negativa |
| `cantidad_almacen_movimiento` | `numeric(14,2)` | delta físico del almacén de la fila; en documentos normales coincide con el global, en transferencias no |
| `cantidad_despues` | `numeric(14,2)` | `q` global después |
| `existencia_antes` | `numeric(14,2)` | cantidad del almacén antes |
| `existencia_despues` | `numeric(14,2)` | cantidad del almacén después |
| `costo_antes` | `numeric(16,6)` | `c` antes |
| `costo_unitario` | `numeric(16,6) null` | costo unitario efectivo del evento; null en correcciones mixtas o sin cantidad |
| `costo_despues` | `numeric(16,6)` | `c` después |
| `valor_antes` | `numeric(14,2)` | `v` antes |
| `valor_documento` | `numeric(14,2)` | efecto en inventario del asiento principal: débito positivo, crédito negativo |
| `valor_recosteo` | `numeric(14,2) default 0` | efecto en inventario del asiento de recosteo/puente: débito positivo, crédito negativo |
| `valor_movimiento` | `numeric(14,2)` | efecto neto en `v`; debe ser `valor_documento + valor_recosteo` |
| `valor_despues` | `numeric(14,2)` | `v` después; debe ser `valor_antes + valor_movimiento` |
| `cuenta_inventario_id` | `uuid not null → cuentas` | cuenta de inventario usada en este movimiento (snapshot; no se reconsulta si el producto cambia después) |
| `cuenta_costo_id` | `uuid null → cuentas` | cuenta de costo usada para costo de ventas/recosteo cuando aplica |
| `es_recosteo` | `boolean not null default false` | true si el movimiento tuvo recosteo distinto de cero |
| `cantidad_recostada` | `numeric(14,2) null` | unidades negativas cubiertas por la entrada |
| `costo_provisional` | `numeric(16,6) null` | costo al que habían salido esas unidades |
| `costo_real` | `numeric(16,6) null` | costo real de la entrada que las cubrió |
| `monto_recosteo` | `numeric(14,2) null` | positivo = más costo de ventas; negativo = menos costo de ventas. Es `-valor_recosteo` |
| `origen_tipo` | `text not null` | tipo del documento físico/contable de origen |
| `origen_id` | `uuid null` | id del documento de origen; null solo en `apertura` |
| `origen_linea_id` | `uuid null` | línea del documento que causó el movimiento |
| `revierte_movimiento_id` | `uuid null → movimientos_inventario` | movimiento original cuando la fila es una reversa/corrección |
| `asiento_id` | `uuid null → asientos` | asiento principal del documento |
| `recosteo_asiento_id` | `uuid null → asientos` | asiento visible de recosteo, si hubo |
| `creado_por` | `uuid null` | usuario de la RPC |
| `creado_en` | `timestamptz not null default now()` | hora real de escritura |

`costo_unitario` se guarda siempre en positivo y en unidad base, aunque la
cantidad del movimiento sea negativa: en una entrada explícita es `M/x`; en una
salida al promedio es `c0` (o el costo efectivo `v0/q0` cuando el movimiento
agota exactamente el stock positivo y arrastra el residuo); en una salida
histórica es `H/x`. Puede diferir de `valor_movimiento / cantidad_movimiento`
cuando la fila incluye un recosteo, porque es el costo del evento físico, no el
efecto neto total.

`cuenta_inventario_id` y `cuenta_costo_id` son snapshots deliberados: la
pista de auditoría no cambia si luego se edita la ficha del producto o la
configuración. `cuenta_costo_id` queda null en movimientos cuya contrapartida
no es costo de ventas (por ejemplo ajuste o inventario inicial); su contrapartida
siempre se puede ver en el asiento enlazado.

`origen_tipo` usa los tipos de documento: `factura`, `factura_proveedor`,
`nota_credito_venta`, `nota_credito_compra`, `ajuste_inventario`,
`inventario_inicial`, `transferencia`, `anulacion` y `apertura`.
`recosteo_inventario` **no** es un origen físico del Kardex: es el
`origen_tipo` del asiento contable enlazado por `recosteo_asiento_id`.

Índices mínimos:

- `(producto_id, almacen_id, fecha, secuencia)` para el Kardex.
- `(producto_id, secuencia)` para el estado valorado global.
- `(origen_tipo, origen_id)` para reconstruir documentos y anulaciones.
- `(asiento_id)` y `(recosteo_asiento_id)`.
- parcial `(producto_id, fecha, secuencia) where es_recosteo` para reportes.

Checks de la fila (además de llaves foráneas):

```text
cantidad_despues   = cantidad_antes   + cantidad_movimiento
existencia_despues = existencia_antes + cantidad_almacen_movimiento
valor_movimiento   = valor_documento  + valor_recosteo
valor_despues      = valor_antes      + valor_movimiento
cantidad_despues = 0 ⇒ valor_despues = 0
```

El último check sí puede ser `CHECK` de fila porque la fila guarda la
transición completa después de aplicar el recosteo/puente. La igualdad global
del mayor no es un check de fila: la verifican pgTAP y el reporte de salud al
final de cada escenario/transacción.

Permisos e inmutabilidad:

- RLS activo. `anon` no ve nada. `authenticated` con perfil tiene solo `SELECT`.
- Sin `INSERT`, `UPDATE` ni `DELETE` para la aplicación. Insertan solo las RPC
  `security definer` del motor.
- Trigger anti-update/delete incluso para el owner de la función, salvo en una
  migración controlada. Una reversión nunca modifica la fila original.

### 5.3 Apertura de datos existentes

La migración crea filas `origen_tipo='apertura'` sin asiento nuevo:

- `costo_promedio` arranca del `productos.costo` vigente (convertido a 6
  decimales) y `valor_inventario` objetivo de `round(cantidad × costo, 2)`.
- Si el producto existe en varios almacenes, hay una fila por almacén en orden
  fijo. Las cantidades físicas abren cada almacén; las cantidades/valores
  globales se acumulan en esas filas y cualquier residuo de centavos se asigna
  a la última fila para que la suma sea exacta.
- Si no hay stock ni valor, la apertura puede ser una sola fila cero en el
  almacén principal para iniciar la cadena del Kardex.
- Estas filas no reescriben la historia anterior ni pretenden distribuir valor
  por almacén; son el punto cero desde el cual empieza el contrato nuevo.

### 5.4 `asientos.origen_tipo`

El check de `asientos.origen_tipo` agrega:

```text
recosteo_inventario
```

El asiento de recosteo se crea uno por documento disparador (puede agrupar
varios productos), con la fecha de ese documento. `asientos.origen_id` apunta
al documento disparador. Si el disparador es una anulación, apunta al documento
anulado (no existe una tabla separada de anulaciones); el Kardex distingue ese
caso con `origen_tipo='anulacion'` y `revierte_movimiento_id`. Si el asiento es
de un solo producto también se llena `asientos.producto_id`; si agrupa varios,
la atribución exacta queda en `movimientos_inventario.recosteo_asiento_id`.

No se crea asiento cuando el recosteo calculado es RD$0.00. Un asiento de 0 no
es válido y ensucia el diario.

## 6. Fórmulas base del costeo

### 6.1 Entrada a costo explícito

Aplica a compras, entradas por ajuste, inventario inicial y reingresos cuya
línea tiene costo histórico conocido. Entrada de `x > 0` unidades por valor
total `M` (en unidad base; si la presentación tiene factor, `M` sigue siendo
el subtotal de la línea y `x = cantidad_base`).

```text
q1 = q0 + x

si q0 < 0:
    k = min(x, -q0)                                      unidades negativas cubiertas
    P = -v0                              si k = -q0
        parte(-v0, -q0, k)               si k < -q0
    A = M                                si k = x
        parte(M, x, k)                   si k < x
    R = round(A - P, 2)                                  monto del recosteo
si q0 >= 0:
    R = 0

valor_documento  = +M
valor_recosteo   = -R
valor_movimiento = M - R
v1 = v0 + M - R
```

Interpretación de `R`:

- `R > 0`: la entrada costó más que el costo provisional de la venta negativa.
  Dr costo `R` / Cr inventario `R`.
- `R < 0`: la entrada costó menos. Dr inventario `-R` / Cr costo `-R`.
- `R = 0`: no hay asiento de recosteo.

Costo posterior:

```text
si q1 <> 0 y v1/q1 >= 0:  c1 = round(v1 / q1, 6)
si q1 = 0:                c1 = round(M / x, 6)
si el cociente es inválido por datos heredados: conservar c0 y marcar salud crítica
```

Lo importante es lo que **no** se hace: cuando `q0 < 0` no se usa
`(q0 × c0 + x × costo_entrada) / (q0 + x)`. Esa fórmula mezcla una deuda de
unidades con inventario físico y contamina el promedio. Primero se cubre la
deuda negativa por valor; solo el excedente que queda positivo forma el nuevo
promedio.

### 6.2 Salida al costo promedio vigente

Aplica a ventas, salidas por ajuste y componentes de combos. Salida de `x > 0`
unidades base:

```text
pos = min(x, max(q0, 0))       unidades que salen de stock positivo
neg = x - pos                  unidades nuevas vendidas en negativo

costo_pos = 0                  si pos = 0
            v0                 si pos = q0 (agotamiento exacto)
            round(pos × c0, 2) si pos < q0

costo_neg = round(neg × c0, 2)
S = costo_pos + costo_neg

valor_movimiento = -S
q1 = q0 - x
v1 = v0 - S
c1 = c0
```

La venta no cambia el promedio. Si consume exactamente el stock positivo, toma
`v0` completo, no `round(q0 × c0, 2)`: esa es la pieza que elimina el residuo
de centavos.

### 6.3 Reingreso al costo promedio vigente

Aplica a notas de crédito de venta y a la parte inventarial de la anulación de
una venta. Entrada de `x` unidades sin costo nuevo: entran al `c0` vigente.

```text
si q0 >= 0:
    M_objetivo = round(x × c0, 2)

si q0 < 0:
    k = min(x, -q0)
    P = -v0                              si k = -q0
        parte(-v0, -q0, k)               si k < -q0
    E = round((x - k) × c0, 2)
    M_objetivo = P + E

valor_movimiento = +M_objetivo
q1 = q0 + x
v1 = v0 + M_objetivo
c1 = c0
```

Así, una devolución primero cancela exactamente la deuda negativa y solo el
excedente queda como inventario positivo. Si `q1 = 0`, `v1` queda en 0.00.

En una NC de venta nueva, el asiento principal se construye con ese mismo
`M_objetivo`, por lo que normalmente no hay puente. En la anulación de una
venta el asiento principal está congelado al costo histórico de la factura; la
diferencia con `M_objetivo` se registra como recosteo visible (ver §8.5).

### 6.4 Salida inversa a costo histórico

Aplica a notas de crédito de compra y a anulaciones que retiran una entrada
histórica (compra, entrada de ajuste, NC de compra anulada en sentido inverso,
etc.). `x` es la cantidad base retirada y `H` el valor histórico de esa línea.

```text
q1 = q0 - x

si q1 <> 0:
    valor_objetivo = -H
    v1 = v0 - H
    si q1 > 0 y v1 >= 0: c1 = round(v1 / q1, 6)
    en otro caso:        c1 = c0

si q1 = 0:
    valor_objetivo = -v0     (sale todo el residuo)
    v1 = 0
    c1 = c0
```

El asiento de reversa del documento permanece congelado a `H`. Si
`valor_objetivo` difiere de `-H`, la diferencia es el recosteo/puente visible.
Esta regla evita el huérfano clásico de 1104 cuando la reversa retira todo el
stock pero el costo histórico no coincide con el valor vigente.

Si la reversa deja `q1 < 0`, el negativo queda valorado provisionalmente con el
resultado de la reversa y la siguiente entrada a costo explícito lo recostea
por las reglas de §6.1. El promedio no se inventa retroactivamente.

## 7. Asiento visible de recosteo

Para cada documento de entrada que recostea una o más líneas se crea un asiento
con esta forma:

| caso | débito | crédito |
| --- | --- | --- |
| `R > 0` (costo real mayor) | cuenta de costo del producto, `R` | cuenta de inventario del producto, `R` |
| `R < 0` (costo real menor) | cuenta de inventario del producto, `-R` | cuenta de costo del producto, `-R` |

- Fecha: la del documento que dispara la entrada o corrección (compra/ajuste; en una anulación, la fecha de la anulación).
- Descripción: `Recosteo de inventario <documento>`.
- `origen_tipo = 'recosteo_inventario'` y `origen_id = <documento disparador>`.
- Respeto de períodos: un documento fechado en un período cerrado no se puede
  crear ni anular por el candado existente. Una venta vieja cerrada no cambia;
  su diferencia de costo cae en la fecha abierta de la entrada.

## 8. Eventos exactos y ejemplos

En los ejemplos, Cemento usa unidad base "unidad". RD$500 es el costo
provisional/promedio inicial y RD$520 el costo real de la entrada.

### 8.1 Compra (`crear_factura_proveedor`)

#### a) Stock `q >= 0`: promedio ponderado normal

Estado inicial: `q0 = 10`, `c0 = 500.000000`, `v0 = 5,000.00`.
Compra: 5 cementos a RD$520, `x = 5`, `M = 2,600.00`.

```text
q1 = 10 + 5 = 15
v1 = 5,000 + 2,600 = 7,600
c1 = round(7,600 / 15, 6) = 506.666667
costo mostrado = 506.67
R = 0
```

Asiento principal: Dr 1104 Inventario 2,600 / Cr CxP e ITBIS según la compra.
No hay asiento de recosteo.

#### b) Stock negativo parcial (`q_despues <= 0`)

Estado inicial: `q0 = -10`, `c0 = 500.000000`, `v0 = -5,000.00`.
Compra: 4 cementos a RD$520, `x = 4`, `M = 2,080.00`.

```text
k = 4
P = parte(5,000, 10, 4) = 2,000   costo provisional cubierto
A = 2,080                         costo real de esas 4
R = 2,080 - 2,000 = 80

q1 = -10 + 4 = -6
v1 = -5,000 + 2,080 - 80 = -3,000
c1 = round(-3,000 / -6, 6) = 500.000000
```

Asiento principal: Dr 1104 por 2,080. Recosteo visible: Dr 5101 Costo de
ventas 80 / Cr 1104 Inventario 80. Las 6 unidades que siguen negativas quedan
provisionalmente a RD$500 hasta la próxima entrada.

#### c) Stock negativo que cruza a positivo (`q_despues > 0`)

Estado inicial: `q0 = -10`, `c0 = 500.000000`, `v0 = -5,000.00`.
Compra: 15 cementos a RD$520, `x = 15`, `M = 7,800.00`.

```text
k = 10
P = 5,000                           todo el negativo queda cubierto
A = parte(7,800, 15, 10) = 5,200
R = 5,200 - 5,000 = 200

q1 = 5
v1 = -5,000 + 7,800 - 200 = 2,600
c1 = round(2,600 / 5, 6) = 520.000000
```

El recosteo es Dr 5101 200 / Cr 1104 200. El excedente físico de 5 cementos
queda valorado a su costo real RD$520.

### 8.2 Ajuste de inventario (`crear_ajuste_inventario`)

#### Entrada

Usa exactamente §6.1; solo cambia la contrapartida del asiento principal
(`ajuste_inventario` en lugar de CxP). El recosteo, si existe, **no** usa la
cuenta de ajuste: usa costo de ventas contra inventario conforme a la decisión
aprobada. Ejemplo con `q0 = -10`, `v0 = -5,000`, entrada de 5 cementos a RD$520:

```text
P = parte(5,000, 10, 5) = 2,500
A = 2,600
R = 100
q1 = -5
v1 = -5,000 + 2,600 - 100 = -2,500
c1 = 500.000000
```

El bug viejo habría calculado
`(-10 × 500 + 5 × 520) / -5 = 480`, contaminando el promedio con una cantidad
negativa. La regla nueva deja el negativo restante a 500 y reconoce los RD$100
como costo visible.

#### Salida

La salida se costea siempre al promedio vigente con §6.2; el usuario no edita
ese costo. Si `q0 = 3`, `v0 = 1,520.00`, `c0 = 506.666667` y sale 1:

```text
S = round(1 × 506.666667, 2) = 506.67
q1 = 2
v1 = 1,013.33
c1 = 506.666667
```

Asiento: Dr ajuste de inventario 506.67 / Cr inventario 506.67.

### 8.3 Venta (`crear_factura`)

#### Agotamiento exacto a cero con residuo

Construcción del estado:

1. Compra 2 cementos a RD$500: `q=2`, `v=1,000`, `c=500`.
2. Compra 1 cemento a RD$520: `q=3`, `v=1,520`, `c=506.666667`.

Ventas sucesivas de 1 unidad:

| venta | cálculo | costo reconocido | q después | v después |
| --- | --- | ---: | ---: | ---: |
| 1 | `round(1 × 506.666667, 2)` | 506.67 | 2 | 1,013.33 |
| 2 | `round(1 × 506.666667, 2)` | 506.67 | 1 | 506.66 |
| 3 | agotamiento: toma `v0` | 506.66 | 0 | 0.00 |

Total costo de ventas: 506.67 + 506.67 + 506.66 = **1,520.00**, exactamente el
valor comprado. Sin la regla del residuo quedaría RD$0.01 colgado en 1104.

#### Venta en negativo y venta con costo 0

Si después del agotamiento anterior (`q=0`, `v=0`, `c=506.666667`) se venden 2
unidades en negativo:

```text
S = round(2 × 506.666667, 2) = 1,013.33
q = -2
v = -1,013.33
c = 506.666667
```

Si el producto tenía `c=0` antes de vender 10 en negativo:

```text
venta:     S = 0, q = -10, v = 0
compra:    10 × 520, M = 5,200
P = 0      (no había costo provisional reconocido)
A = 5,200
R = 5,200
q = 0, v = 0, c = 520
```

Asientos de la compra: Dr 1104 5,200 / Cr CxP por la compra y, aparte,
recosteo Dr 5101 5,200 / Cr 1104 5,200. Neto de inventario 0 porque no queda
mercancía; todo el costo real cayó en costo de ventas.

#### Combos

El combo no tiene movimiento propio. Se expande a componentes antes de costear.
Si `KIT` contiene 2 cementos y 1 block y se vende 1 kit:

- cemento: salida de 2 unidades con §6.2;
- block: salida de 1 unidad con §6.2;
- el costo de la línea del combo es la suma neta de los dos movimientos;
- el asiento usa las cuentas de costo/inventario del combo, como hoy;
- hay una fila de Kardex por componente, con `origen_linea_id` de la línea del
  combo.

Si cemento estaba en negativo, su recosteo posterior se calcula sobre cemento,
no sobre el combo, y usa las cuentas de costo/inventario del componente según la
decisión aprobada. Esto puede distribuir el costo en una cuenta distinta de la
cuenta usada por la línea original del combo; el total de costo de ventas sí
cuadra y la rentabilidad se concilia por `origen_linea_id`/producto como se
explica en §10. La validación `vende_negativo` sigue siendo por componente.

### 8.4 Nota de crédito de venta (`crear_nota_credito_venta`)

La mercancía reingresa al costo promedio vigente, no al costo histórico de la
venta. Con `q0 = 5`, `c0 = 520`, `v0 = 2,600`, una NC de 2 cementos:

```text
M_objetivo = 2 × 520 = 1,040
q1 = 7
v1 = 3,640
c1 = 520
```

Asiento: Dr 1104 Inventario 1,040 / Cr 5101 Costo de ventas 1,040, además de
la reversión comercial de ventas/ITBIS/CxC propia de la NC.

Si `q0 = -5`, `v0 = -2,500`, `c0 = 500` y entran 2 por NC:

```text
P = parte(2,500, 5, 2) = 1,000
q1 = -3
v1 = -1,500
c1 = 500
```

No hay recosteo porque no entra costo nuevo: la devolución solo cancela deuda
negativa al mismo costo provisional.

### 8.5 NC de compra y anulaciones (`crear_nota_credito_compra`, `anular_documento`)

#### NC de compra

La devolución al proveedor sale con el costo histórico de la línea comprada
(regla §6.4). Ejemplo:

1. Compra 5 cementos a RD$500: `q=5`, `v=2,500`, `c=500`.
2. Compra 15 cementos a RD$520: `q=20`, `v=10,300`, `c=515`.
3. NC de compra de 2 unidades de la primera compra: `x=2`, `H=1,000`.

```text
q1 = 18
v1 = 10,300 - 1,000 = 9,300
c1 = round(9,300 / 18, 6) = 516.666667
```

El asiento principal de la NC acredita inventario por RD$1,000. No hay puente
porque la salida inversa sí retira exactamente ese valor y queda stock positivo
capaz de absorber el nuevo promedio.

#### Anulación de compra que agota el stock sin dejar huérfano

Siguiendo el estado anterior antes de la NC (`q=20`, `v=10,300`, `c=515`):

1. Se venden 15 cementos al promedio: costo `15 × 515 = 7,725`; quedan
   `q=5`, `v=2,575`.
2. Se anula la primera compra de 5 unidades a RD$500. La reversa contable
   original acredita inventario por `H = 2,500`.
3. Como `q1 = 0`, el valor objetivo es sacar todo `v0 = 2,575`, no solo 2,500.

```text
valor_documento = -2,500
valor_objetivo  = -2,575
valor_recosteo  = -75
monto_recosteo  = +75
q = 0, v = 0
```

Recosteo visible: Dr 5101 Costo de ventas 75 / Cr 1104 Inventario 75. Así no
quedan RD$75 huérfanos en 1104.

#### Anulación de venta

La anulación de una venta es funcionalmente un reingreso y se valora al costo
promedio vigente (§6.3), aunque la reversa del asiento original esté congelada
al costo de la factura. Ejemplo completo:

1. `q=0`, `c=500`, `v=0`; venta negativa de 10: costo 5,000.
2. Compra 10 a RD$520: recosteo `R=200`; quedan `q=0`, `v=0`, `c=520`.
3. Se anula la venta. La reversa original debita inventario por 5,000 y
   acredita costo por 5,000.
4. El reingreso correcto al costo vigente es `10 × 520 = 5,200`.

```text
valor_documento = +5,000
valor_objetivo  = +5,200
valor_recosteo  = +200
monto_recosteo  = -200
q = 10, v = 5,200, c = 520
```

El asiento de recosteo/puente es Dr 1104 Inventario 200 / Cr 5101 Costo de
ventas 200. Resultado neto en costo de ventas: venta original +5,000,
recosteo de la compra +200, reversa de anulación -5,000 y puente -200 = 0, que
es lo correcto porque la venta quedó anulada y la mercancía volvió al costo
real de 520.

#### Matriz de anulaciones

| documento anulado | movimiento físico de la reversa | valoración objetivo |
| --- | --- | --- |
| venta (`factura`) | entrada de productos/componentes | costo promedio vigente (§6.3), puente contra costo histórico de la reversa |
| compra (`factura_proveedor`) | salida | salida inversa al costo histórico de la línea (§6.4), residuo visible si llega a cero |
| NC de venta | salida (se retira lo que había reingresado) | salida inversa al costo guardado en la línea de la NC |
| NC de compra | entrada (se revierte la devolución al proveedor) | entrada a costo histórico explícito (§6.1); recostea si cubre negativo |
| ajuste de entrada | salida | salida inversa al costo de la línea del ajuste |
| ajuste de salida | entrada | entrada a costo explícito de la línea original; recostea si cubre negativo |

En todos los casos el asiento principal de anulación sigue siendo la reversa
del asiento original. El Kardex registra el movimiento físico/valorado y, si el
valor objetivo difiere del monto congelado, el puente visible correspondiente.
No se borran ni editan movimientos originales: la reversa usa
`origen_tipo='anulacion'` y `revierte_movimiento_id` cuando puede identificar
la fila original.

Una anulación de compra **no revierte automáticamente** el recosteo que esa
compra había disparado. Ese recosteo pertenece a unidades ya vendidas en
negativo, no al simple hecho físico de que la compra existiera. Al retirar la
entrada, la deuda negativa reaparece valorada según §6.4 y la próxima entrada
la recostea contra su costo real. En cambio, al anular la venta, el puente de
§6.3/§8.5 sí compensa el costo porque la mercancía vuelve a inventario.

### 8.6 Inventario inicial (`crear_producto` / `actualizar_producto`)

Alta de cemento con cantidad inicial 10 y costo RD$500:

```text
q = 10
v = round(10 × 500, 2) = 5,000
c = 500.000000
```

Asiento: Dr 1104 Inventario 5,000 / Cr Ajustes iniciales en inventario 5,000,
`origen_tipo='inventario_inicial'`. Si el costo es 0, hay fila de Kardex y
cantidad pero no asiento por 0; salud de inventario lo advierte.

Con Kardex append-only, la edición de cantidad/costo inicial **no muta** el
asiento original como hace Alegra: mutar rompería el corte histórico del
Kardex. La edición crea una corrección visible fechada el día de la edición:

```text
delta_q = q_editada - q_actual
valor_objetivo = round(q_editada × costo_editado, 2)
delta_v = valor_objetivo - v_actual
```

Ejemplo: 10 × 500 se corrige a 12 × 520.

```text
delta_q = +2
valor objetivo = 12 × 520 = 6,240
delta_v = 6,240 - 5,000 = 1,240
```

Movimiento `inventario_inicial` de +2 unidades y +RD$1,240; asiento visible
Dr inventario 1,240 / Cr Ajustes iniciales en inventario 1,240. Después de la
corrección `costo_promedio = costo_editado` (520.000000 en el ejemplo). Si solo
cambia el costo, `delta_q = 0` pero sí hay movimiento de valor. Si el resultado
es 0, la corrección deja `q=0` y `v=0` y sigue la regla de reversa visible.

La cantidad operativa después de iniciada la vida del producto debe corregirse
preferiblemente con `crear_ajuste_inventario`; la edición de ficha queda para
corregir la carga inicial, no para reemplazar conteos o ajustes.

### 8.7 Transferencias y conteos

Una transferencia no cambia `q`, `c` ni `v` globales y no crea asiento contable.
El Kardex la registra como dos filas físicas con `valor_movimiento = 0`: una
salida del almacén origen y una entrada del almacén destino. Ambas apuntan al
mismo `origen_id`; las cantidades globales antes/después son iguales porque la
mercancía solo cambió de ubicación. Si se mueven varias líneas, se procesan en
orden estable por producto.

Un conteo físico aplicado crea un ajuste de inventario (o uno por almacén,
según el motor operativo) y hereda exactamente las reglas de §8.2. El Kardex no
inventa un costo distinto para conteos: entrada a costo explícito si el ajuste
la trae; salida al promedio vigente.

## 9. Contratos de lectura y reportes

Todas son `stable`, `security invoker`, respetan RLS y devuelven montos
`numeric(14,2)` salvo costos unitarios/promedios, que usan `numeric(16,6)`.

### 9.1 `reporte_kardex_producto`

Firma conceptual:

```sql
reporte_kardex_producto(
  p_producto_id uuid,
  p_almacen_id uuid default null,
  p_desde date default null,
  p_hasta date default null,
  p_limit int default 200,
  p_offset int default 0
)
```

Columnas:

| columna | contenido |
| --- | --- |
| `fecha`, `secuencia` | orden cronológico real del Kardex |
| `origen_tipo`, `origen_id`, `origen_linea_id` | documento y línea |
| `documento`, `numero`, `ncf` | etiqueta legible del documento |
| `almacen_id`, `almacen` | ubicación física |
| `entrada`, `salida` | cantidades positivas derivadas de `cantidad_almacen_movimiento` |
| `existencia_despues` | saldo físico del almacén después de la fila |
| `cantidad_despues` | saldo global del producto después de la fila |
| `costo_unitario`, `costo_despues` | costo del evento y promedio posterior |
| `valor_documento`, `valor_recosteo`, `valor_movimiento`, `valor_despues` | trazabilidad valorada exacta |
| `es_recosteo`, `cantidad_recostada`, `costo_provisional`, `costo_real`, `monto_recosteo` | detalle del recosteo |
| `asiento_id`, `recosteo_asiento_id` | enlaces al libro diario |

Si hay `p_desde`, la primera fila es una apertura sintética con los saldos de
la última fila anterior al rango. El detalle nunca se recalcula desde documentos:
se lee de `movimientos_inventario`.

### 9.2 `reporte_valor_inventario_corte`

Firma conceptual:

```sql
reporte_valor_inventario_corte(
  p_fecha date,
  p_producto_id uuid default null
)
```

Devuelve una fila por producto inventariable con: producto, referencia, unidad,
`cantidad`, `costo_promedio`, `costo` mostrado, `valor_inventario`,
`fuera_de_orden` y estado de salud. Además expone el saldo mayor global de cuentas de inventario y la
`diferencia` global como columnas de resumen (o fila de totales, según la UI).
El mayor no se pretende repartir por producto: las líneas contables históricas
no llevan esa dimensión. El corte usa la última fila de Kardex de cada producto
con `fecha <= p_fecha` (desempate por `secuencia`).

El total del reporte debe reconciliar con el mayor a la misma fecha. La versión
inicial es global por producto; no reparte valor por almacén porque el costo es
global. La cantidad por almacén sí puede consultarse en el Kardex.

**Corte con documentos atrasados.** La contabilidad permite fechar un documento
atrás mientras el período siga abierto, pero la decisión A prohíbe recalcular
retroactivamente el promedio. Por eso el corte por `fecha` es un corte legal del
mayor, no una simulación FIFO temporal perfecta: si una fila fuera de orden hace
que los saldos antes/después no encadenen cronológicamente, el reporte la marca
(`fuera_de_orden = true`) en vez de reescribirla. Cuando no hay backdating, la
fecha y `secuencia` coinciden y el corte es exactamente la cadena del Kardex.

### 9.3 `reporte_recosteos`

Firma conceptual:

```sql
reporte_recosteos(
  p_desde date,
  p_hasta date,
  p_producto_id uuid default null
)
```

Filas de `movimientos_inventario` con `es_recosteo = true` y fecha de asiento de
recosteo dentro del rango. Columnas mínimas: fecha, producto/referencia, almacén,
documento que disparó la entrada, `cantidad_recostada`, `costo_provisional`,
`costo_real`, `monto_recosteo`, `valor_recosteo`, cuenta de costo, cuenta de
inventario, `asiento_id`, `origen_tipo`, `origen_id` y enlace al documento.

Totales: unidades recostadas, mayor costo (`monto_recosteo > 0`), menor costo
(`monto_recosteo < 0`) y neto. El neto debe cuadrar con los asientos
`recosteo_inventario` del período.

### 9.4 `reporte_salud_inventario`

Firma conceptual:

```sql
reporte_salud_inventario()
```

Devuelve hallazgos, no solo productos. Contrato mínimo:

| columna | uso |
| --- | --- |
| `severidad` | `critica`, `advertencia`, `info` |
| `codigo` | código estable para la UI/tests |
| `producto_id`, `producto`, `referencia` | producto afectado |
| `almacen_id`, `almacen` | presente si el hallazgo es por almacén |
| `cantidad`, `costo_promedio`, `valor_inventario` | estado actual |
| `saldo_mayor`, `diferencia` | cuando aplica al cuadre contable |
| `mensaje` | texto accionable en español |

Códigos mínimos:

| código | severidad | condición |
| --- | --- | --- |
| `STOCK_NEGATIVO` | advertencia | `productos.cantidad < 0` |
| `ALMACEN_NEGATIVO` | advertencia | alguna `existencias.cantidad < 0` aunque el global no lo sea |
| `COSTO_CERO` | advertencia | inventariable activo con `costo_promedio = 0` (aunque tenga ventas permitidas) |
| `VALOR_CERO_CON_STOCK` | advertencia | `cantidad > 0` y `valor_inventario = 0` |
| `SIGNO_INCONSISTENTE` | crítica | `cantidad > 0` con valor negativo, o `cantidad < 0` con valor positivo |
| `CERO_CON_VALOR` | crítica | `cantidad = 0` y `valor_inventario <> 0` (rompe la invariante) |
| `DESCUADRE_MAYOR` | crítica | diferencia entre mayor de inventario y `Σ valor_inventario` |
| `LEGACY_DESCUADRE` | advertencia | diferencia existente al abrir el Kardex, antes de la primera operación nueva |

Este reporte alimenta el panel de salud exigido por la decisión de productos
con costo 0. No bloquea la venta; informa.

## 10. Conciliación: Rentabilidad por producto vs Estado de resultados

Hay dos vistas que no deben mezclarse:

1. **Vista comercial operativa.** Es la rentabilidad que entiende el usuario:
   documentos vigentes, ventas menos devoluciones. Una factura anulada no suma
   venta ni costo porque comercialmente quedó anulada.
2. **Vista conciliada contable.** Reconoce los eventos en la fecha real de sus
   asientos: documento original en su fecha, reversa en la fecha de anulación y
   recosteo en la fecha de la entrada. Solo esta vista cuadra con
   `reporte_estado_resultados` cuando una anulación cruza un período.

### 10.1 Vista comercial operativa

```text
ventas netas comerciales
    = subtotal de facturas vigentes
      - subtotal de devoluciones de NC de venta vigentes

costo neto comercial
    = costo valorado de las salidas de factura vigentes
      - costo valorado reingresado por NC de venta vigentes
      + recosteos atribuidos al producto en el período consultado

rentabilidad = ventas netas comerciales - costo neto comercial
```

`factura_lineas.costo_unitario` queda como snapshot comercial de 2 decimales
para compatibilidad e impresión, pero **no** es la fuente de conciliación. La
fuente del costo es `movimientos_inventario`: para una factura, `-valor_movimiento`;
para una NC de venta, el crédito de costo ligado a `+valor_movimiento`; para
recosteos, `monto_recosteo`. Así se capturan el residuo exacto de agotamiento,
la precisión de 6 decimales y los componentes de un combo sin depender del
redondeo de la línea.

### 10.2 Atribución de combos

- El costo provisional de la venta se enrolla de vuelta a la línea comercial:
  todos los movimientos de componentes comparten `origen_linea_id`; por eso el
  costo inicial de un combo aparece bajo el producto combo, igual que en la
  vista comercial actual.
- Un recosteo posterior pertenece contablemente al **componente** cuyo costo se
  corrigió. En la fase 1 no se reparte retroactivamente entre combos o ventas
  específicas: la decisión A prohíbe reescribir períodos/ventas ya cerradas y
  el promedio móvil no conserva capas por cliente/línea. El reporte lo muestra
  en la fila del componente (o en una agrupación visible "Recosteos de
  componentes") en la fecha del recosteo.
- La suma total sigue cuadrando con el Estado de resultados porque ambas
  atribuciones — costo provisional enrollado al combo y recosteo por
  componente — salen de movimientos ligados a asientos. Lo que no se promete es
  margen unitario retroactivo perfecto de cada combo vendido antes de conocer
  el costo real; esa es una limitación inherente al promedio móvil aprobado.

### 10.3 Puente exacto al Estado de resultados

La conciliación parte de la vista comercial operativa y muestra estas líneas de
puente, sin esconderlas dentro de ningún producto:

```text
costo de ventas del Estado de resultados (período)
    = costo neto comercial operativo del período
      + impacto de costo de documentos anulados cuya fecha original cae en el período
      + impacto de costo de reversiones cuya fecha de anulación cae en el período
      + costo no inventariable/manual del período
```

`impacto de costo` es firmado como el mayor: débito positivo, crédito negativo.
Por eso una reversa de venta entra negativa y la reversa de una NC entra
positiva. Los recosteos ya están dentro del costo neto operativo en la misma
fecha en que caen en el Estado de resultados; no se suman dos veces.

La misma idea aplica a ingresos para conciliar rentabilidad completa: la venta
original de un documento anulado pertenece al período del asiento original y su
reversa al período de anulación. Si ambos caen en el mismo período se cancelan;
si cruzan períodos, la conciliación muestra explícitamente la diferencia de
tiempo en lugar de reescribir el período cerrado.

Reglas de fecha y clasificación:

1. El costo de una factura se atribuye inicialmente a la fecha de esa factura.
2. El costo devuelto por una NC se atribuye a la fecha de la NC.
3. Un recosteo se atribuye al producto/componente en la fecha del asiento
   visible de recosteo (la fecha de la entrada), no se reparte hacia atrás ni
   se esconde en la venta cerrada.
4. Una anulación impacta el período de su asiento de reversa.
5. Los asientos manuales o ajustes que usen cuentas de costo pero no tengan
   movimiento de inventario se muestran como línea aparte
   (`costo_no_inventariable`), nunca se reparten artificialmente a productos.

Aquí “Estado de resultados” usa exactamente la base del RPC actual: líneas en
cuentas de tipo `costo`, `Σ(debito - credito)`, agrupadas por fecha de asiento
y excluyendo los asientos ligados en `cierres_resultados`.

`reporte_recosteos` es la fuente de la parte recostada; `movimientos_inventario`
enlaza cada monto con producto y asiento, por lo que la diferencia no queda en
una explicación manual.

## 11. Pruebas obligatorias del motor que lo implemente

pgTAP mínimo antes de considerar terminada la migración:

1. Compra sobre stock positivo: promedio 506.666667 del ejemplo.
2. Compra parcial sobre negativo: recosteo RD$80 del ejemplo.
3. Compra que cruza a positivo: recosteo RD$200 y valor final RD$2,600.
4. Venta con residuo de RD$0.01: agotamiento exacto a cero.
5. Venta con costo 0 → compra a RD$520: recosteo completo RD$5,200.
6. Ajuste de entrada sobre negativo: no usar la fórmula contaminada.
7. Ajuste de salida al costo vigente.
8. NC de venta a costo vigente y NC de compra inversa.
9. Anulación de venta, compra, NC y ajuste, con cero huérfano en 1104.
10. Inventario inicial con costo y con costo 0.
11. Invariante `mayor inventario = Σ valor_inventario` después de cada escenario.
12. `cantidad = 0 ⇒ valor_inventario = 0` después de cada escenario.
13. RLS append-only: `authenticated` lee, no inserta/actualiza/borra.
14. Período cerrado: la entrada fechada en período cerrado falla completa; el
    recosteo nunca reabre ni fecha retroactivamente la venta cerrada.

## 12. Límites explícitos

- El costo es promedio móvil global, no capas FIFO/LIFO ni costo por almacén.
  La reversa histórica después de movimientos intermedios sigue siendo una
  aproximación del promedio móvil, pero ahora cualquier residuo queda visible y
  conciliado en lugar de huérfano.
- Un negativo de almacén sin negativo global no recostea; es una alerta
  operativa. Valorar por almacén requeriría separar costo/valor en
  `existencias` y rediseñar transferencias.
- Las transferencias no cambian `q`, `c` ni `v` globales; solo registran la
  salida y entrada física por almacén en el Kardex.
- Los combos dependen de la definición vigente de componentes, como ya ocurre
  en el motor actual. El Kardex guarda el componente real movido.
- No se reescribe la historia anterior a la migración. La apertura y cualquier
  descuadre heredado se concilian explícitamente con aprobación de Waldy.

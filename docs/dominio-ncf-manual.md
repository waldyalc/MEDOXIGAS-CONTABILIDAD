# NCF manual por tipo de comprobante

**Estado:** propuesta de diseño. No implementa código ni aplica migraciones.
**Rama:** `feat/ncf-manual-spec-orq`, desde `prueba` `f90b110`.
**Alcance de la fase 1:** facturas de venta (tipos `01`, `02`, `14`, `15`, `16`). Notas, gastos menores y facturas de proveedor quedan fuera.
**Objetivo:** que una numeración pueda ser **automática** (como hoy) o **manual** (el usuario escribe el NCF), sin consumir la serie y sin romper la asignación atómica, la vista previa, los impuestos ni los documentos que llaman a `crear_factura`.

---

## 0. Lo que existe hoy (verificado en el repo)

| Pieza | Archivo real | Comportamiento actual |
| --- | --- | --- |
| Tabla `numeraciones` | `supabase/migrations/20261113140000_motor_contable.sql:156-170` | `id`, `tipo_comprobante`, `nombre`, `prefijo`, `siguiente`, `hasta`, `vence`, `activa`. No tiene `automatica`, `preferida` ni `numero_inicial`. Semilla inicial 01/B01 y 02/B02; después se agregan 03/B03, 04/B04, 13/B13, 14/B14, 15/B15 y 16/B16 en migraciones posteriores. |
| Selección de la serie | `20261115500000_funciones_fusionadas_s15.sql:128-146` | `crear_factura` toma la numeración activa del tipo con el `id` más bajo, la bloquea con `for update`, valida `hasta` y `vence`, arma `prefijo || lpad(siguiente,8,'0')` y hace `siguiente = siguiente + 1`. |
| `crear_factura` público | `20261115701000_motor_impuestos.sql:325-374` | Es un wrapper de impuestos y pago. Prepara las líneas con `_impuestos_preparar`, llama a `_crear_factura_sin_impuestos`, sincroniza impuestos y registra el pago después. Pasa `p` casi completo: hoy cualquier clave nueva llega al interno. |
| `_crear_factura_sin_impuestos` | Cuerpo vigente en `20261115500000_funciones_fusionadas_s15.sql:18-329`; renombrado en `20261115701000_motor_impuestos.sql:15-33` | Ahí vive el bloque de NCF citado arriba. Es la función que hay que tocar, no el wrapper. |
| `actualizar_numeracion` | `20261117300000_numeraciones_notas.sql:28-151` | Edita nombre, siguiente, hasta, vence y activa. No acepta prefijo, automática ni preferida. Calcula el último NCF emitido incluyendo facturas, gastos menores y notas B03/B04 (F16). **No se debe copiar la versión vieja de `20261113210000`.** |
| Server action de factura | `src/lib/facturacion/acciones.ts:20-80` | Valida con Zod, calcula totales, arma el payload y llama `supabase.rpc("crear_factura", { p })`. No envía NCF. |
| Validación de factura | `src/lib/facturacion/validacion.ts:41-59` | No tiene campo de NCF. |
| Formulario | `src/components/documento-venta/documento-venta-form.tsx` | `NumeroComprobante` (líneas 192-245) muestra la vista previa y el engranaje que lleva a Numeraciones; hoy ocupa el ancho de la columna y el engranaje va dentro. El rediseño lo pasa a caja compacta (~215 x 56 px) con el engranaje fuera. `construirEntrada` (en `calculo.ts:211-251`) no arma NCF. |
| Vista previa | `src/lib/numeraciones/preview.ts:21-66` | `previsualizarNcf` replica la selección de la RPC y muestra el próximo NCF sin reservarlo ni consumirlo. Hoy solo devuelve `estado: "lista"` o `"no-disponible"`. |
| Pantalla de numeraciones | `src/app/(main)/dashboard/contabilidad/numeraciones/_components/numeraciones-cliente.tsx:68-281` | Edita nombre, siguiente, hasta, vence y activa. El prefijo se muestra, no se edita. No hay «Nueva numeración». |
| Tipos generados | `src/lib/supabase/types.ts:2244-2275` | Reflejan solo las columnas actuales. |

**Lo que no existe hoy:** `numeraciones.automatica`, `numeraciones.preferida`, `facturas.ncf_manual`, el parámetro `ncf_manual` en `crear_factura`, una RPC para crear numeraciones y un `unique` de NCF entre tablas. Tampoco hay emisión de e-CF.

**Consecuencia de diseño:** el cambio no puede ser solo de pantalla. Hay que agregar columnas aditivas, centralizar la decisión de NCF en una función interna y hacer que la vista previa distinga automática de manual. El wrapper de impuestos y el de pago no deben cambiar de forma; solo deben seguir pasando `ncf_manual`.

> Nota de estado: `HANDOFF.md:55-60` dice que `20261117300000_numeraciones_notas.sql` **no estaba aplicada al remoto** al cerrar F16. Antes de aplicar esta propuesta hay que confirmar que esa migración ya está en `prueba`; la nueva migración depende de su definición de `actualizar_numeracion`.

---

## 1. Decisión de producto

### 1.1 Qué significa automática y qué significa manual

| Modo | Quién decide el número | La serie avanza | Vista previa | Uso típico |
| --- | --- | --- | --- | --- |
| **Automática** (`automatica = true`) | El sistema, con `prefijo + siguiente`. | Sí, consume exactamente un número por factura. | Muestra el próximo NCF y dice «Se asigna al guardar». | Operación normal. Es el modo de todas las filas actuales. |
| **Manual** (`automatica = false`) | El usuario, dentro de la serie activa. | **No**. `siguiente` no se toca. | Muestra el prefijo fijo y un campo numérico editable; no promete un NCF. | Facturas preimpresas, talonarios o números autorizados que el sistema no debe consumir. |

Manual **no** significa «sin NCF», «texto libre» ni «cualquier número». Significa:

- Hay una numeración activa para el tipo; su `prefijo` es obligatorio y fijo.
- El NCF debe ser `prefijo + 8 dígitos` (el mismo formato que genera hoy `lpad(...,8,'0')`).
- El número debe estar entre 1 y `hasta` (si `hasta` no es null).
- La serie no debe estar vencida para la fecha de la factura.
- El NCF no puede repetirse en `facturas.ncf`.
- El NCF no se reserva: se valida y se guarda en la misma transacción de la factura.
- El contador `siguiente` no se incrementa. Si el número queda por encima del contador, la serie queda «atrasada» a propósito.

### 1.2 Por qué el modo va en la numeración y no en cada factura

Alegra configura «Numeración automática» en la numeración. Eso evita que cualquier usuario decida en cada factura si consume o no la serie y hace que la regla sea auditable por tipo de comprobante. La fase 1 copia esa idea: **el modo es una propiedad de la serie**, no un checkbox suelto en la factura.

No se propone un override por factura con la serie automática. Si se permitiera, dos usuarios podrían emitir el mismo próximo número y la serie perdería sentido. Si Waldy quiere un caso excepcional, se hace con una serie manual dedicada.

### 1.3 Campos: qué se reutiliza y qué se agrega

| Campo | Dónde | Estado | Para qué |
| --- | --- | --- | --- |
| `automatica` | `numeraciones` | **Nuevo**, `boolean not null default true` | `true`: la RPC asigna y avanza. `false`: el usuario escribe el NCF y la RPC no avanza. |
| `preferida` | `numeraciones` | **Nuevo**, `boolean not null default false` | Marca la serie que debe salir primero al crear una factura. Como máximo una preferida global en fase 1. |
| `prefijo` | `numeraciones` | **Existente**, sin cambios | Parte fija del NCF. En fase 1 no se edita en una serie con historia. |
| `siguiente` | `numeraciones` | **Existente**, sin cambios de tipo | En automática es el próximo número; en manual es una referencia que no se consume. En una pantalla de creación se rotularía «Número inicial», pero **no se agrega una columna `numero_inicial`**: sería un dato muerto y ambiguo para series que ya emitieron. |
| `hasta` | `numeraciones` | **Existente** | Límite superior de la serie, también para el número manual. |
| `vence` | `numeraciones` | **Existente** | Vencimiento de la autorización; se compara con la fecha de la factura. |
| `activa` | `numeraciones` | **Existente** | Solo una serie activa por tipo debe usarse. |
| `nombre` | `numeraciones` | **Existente** | Etiqueta visible. |
| `tipo_comprobante` | `numeraciones` | **Existente** | `01`, `02`, `14`, `15`, `16` para facturas de venta. |

No se agrega `facturas.ncf_manual` en fase 1. El NCF ya queda guardado y el modo se puede reconstruir por la serie; si Contable pide auditoría explícita de «esta factura fue manual», se evalúa en una fase posterior (ver §6).

### 1.4 Reglas funcionales de la fase 1

1. **Una serie, un modo.** Una numeración no puede ser automática y manual a la vez. El modo se cambia en el diálogo de Numeraciones.
2. **El prefijo manda.** El formulario muestra el prefijo como texto fijo; el usuario solo edita el número. El servidor vuelve a validar el prefijo completo.
3. **No se consume en manual.** `siguiente` no cambia al guardar una factura manual. Esto es explícito y se prueba con pgTAP.
4. **El número manual vive dentro de la serie.** Se valida `1 <= número <= hasta` y `vence >= fecha`. Un número fuera de rango o una serie vencida se rechazan.
5. **Un NCF, una factura.** `facturas.ncf` ya es `unique`; la RPC da un mensaje claro antes de insertar y la restricción es la última defensa.
6. **No se reutiliza un NCF anulado.** La factura anulada conserva su fila y su NCF. Emitir otra con el mismo NCF falla; es lo correcto.
7. **Volver a automática exige un contador sano.** Si la serie fue manual y `siguiente` quedó por debajo del último NCF emitido, `actualizar_numeracion` rechaza activar `automatica` hasta que el admin suba `siguiente` por encima del último. Así se evita que la automática repita un número manual.
8. **No se mezclan modos en la misma serie sin decisión de Contable.** Lo anterior evita duplicados, pero no evita saltos. La recomendación fiscal es que una serie manual sea una serie dedicada y no se vuelva a automática (ver §6).
9. **Solo facturas de venta.** `automatica` no cambia el comportamiento de notas, gastos menores ni facturas de proveedor. La UI no muestra el interruptor en esos tipos.
10. **Roles.** `admin` y `contador` pueden emitir facturas y editar numeraciones, como hoy. `lector` no crea facturas ni edita numeraciones. Si Contable quiere restringir B01 a `admin`, es una decisión pendiente (§6).
11. **Una sola serie activa por tipo.** El código actual elige la de `id` más bajo; con dos activas del mismo tipo, el prefijo y el modo se vuelven impredecibles. El preflight (§4.1) lo verifica y se decide cuál queda antes de habilitar manual.

### 1.5 Qué pasa con los demás documentos

| Documento | Numeración / NCF | Fase 1 |
| --- | --- | --- |
| **Factura de venta** | `crear_factura` usa 01/02/14/15/16. | **Sí.** Es el único documento que cambia. |
| **Factura de proveedor** | `crear_factura_proveedor` recibe `ncf` opcional del proveedor; no usa `numeraciones`. | **No se toca.** Ya es manual por naturaleza: el NCF es del proveedor. |
| **Nota de crédito de venta** | `crear_nota_credito_venta` usa 04/B04 vía `_crear_documento_no_contable`. | **No.** Su serie sigue automática. El interruptor se oculta para 04. |
| **Nota de débito de venta** | `crear_nota_debito_venta` usa 03/B03. | **No.** Igual que la nota de crédito. |
| **Gasto menor** | `crear_gasto_menor` usa 13/B13. | **No.** El interruptor se oculta para 13. |
| **Nota de crédito de compra** | Guarda el NCF del proveedor (B04/E34). | **No.** Es de otro emisor; no entra en nuestras series. |
| **Cotización / conduce** | No emiten NCF. | **No.** Se convierten a factura con `convertir_a_factura`, que llama `crear_factura`. |
| **Factura recurrente** | `generar_factura_recurrente` llama `crear_factura`. | **No se toca, pero se ve afectada:** si la serie del tipo es manual, la generación no tiene quién escriba el NCF. Debe fallar con un mensaje claro o bloquearse la plantilla. Ver §5 y §6. |

La fase 2 puede reutilizar `automatica` para notas y gastos, pero requiere tocar sus RPC, su vista previa y la unicidad entre tablas. No se mezcla en este cambio.

### 1.6 «Preferida» y el tipo por defecto

Hoy `tipoComprobanteInicial` en `documento-venta-form.tsx:125-127` devuelve siempre `"02"` si no hay valor prellenado. Con `preferida`:

- Si hay una fila activa, de tipo factura de venta y `preferida = true`, el formulario de factura arranca con ese tipo.
- Si no hay preferida, se conserva `"02"` para no cambiar el comportamiento actual.
- Si se está clonando una factura, manda el `tipoComprobante` del documento de origen.
- La preferida solo aplica a `01/02/14/15/16`; una fila 03/04/13 con `preferida` no se considera.

Esto es paridad con Alegra y es barato, pero cambia el tipo por defecto si Waldy marca B01. Es una decisión que debe aprobar (§6). Si prefiere un diff más pequeño, `preferida` puede quedar para una fase 1.5; el NCF manual no depende de ella.

### 1.7 Flujo de usuario

**Configurar una serie manual**

1. Contabilidad → Numeraciones → editar la serie (por ejemplo B16).
2. Apagar «Numeración automática».
3. Ajustar «Siguiente» si se quiere dejar una referencia (por ejemplo, el primer número del talonario); en manual no se consume.
4. Guardar. La tabla muestra «Manual».
5. Si se marca «Preferida», esa serie será el tipo por defecto al crear una factura.

**Emitir una factura manual**

1. Facturación → Nueva factura.
2. Elegir el tipo de comprobante. Debajo del selector aparece la caja compacta del NCF (~215 x 56 px) con el prefijo fijo, el número editable y el engranaje fuera, a la derecha.
3. Escribir el número (solo dígitos, hasta 8). El sistema arma `prefijo + número` con ceros a la izquierda.
4. Guardar. La RPC valida serie, rango, vencimiento y duplicado; guarda la factura y **no avanza** `siguiente`.
5. Si hay error, se muestra en español y la factura no se crea; la serie queda igual.

---

## 2. Migración aditiva y cambios en `crear_factura`

### 2.1 Principios

- Archivo nuevo, después de `20261117300000`. Nombre propuesto: `20261117400000_ncf_manual_facturas.sql`.
- Solo `alter table ... add column if not exists`, un índice y `create or replace function`. No borra ni reescribe datos.
- `automatica` entra con `default true`: todas las filas existentes siguen automáticas. `preferida` entra con `default false`: ninguna cambia el tipo por defecto.
- La lógica de NCF se concentra en una función interna nueva, `_ncf_factura`, para no duplicar 300 líneas y para que el cambio en `_crear_factura_sin_impuestos` sea de una línea.
- No se toca el wrapper público `crear_factura` de `20261115701000`: ya pasa `p` completo, incluyendo `ncf_manual`, tanto en la ruta normal como en el fallback.
- No se toca RLS: las columnas nuevas heredan el `select` de `numeraciones`. Las escrituras siguen por RPC `security definer`.

### 2.2 Columnas e índice

```sql
-- 20261117400000_ncf_manual_facturas.sql
-- Fase 1: numeración manual solo para facturas de venta (01, 02, 14, 15, 16).
-- Aditiva y reintentable: no borra ni reescribe datos.

alter table public.numeraciones
  add column if not exists automatica boolean not null default true,
  add column if not exists preferida  boolean not null default false;

comment on column public.numeraciones.automatica is
  'true = crear_factura asigna prefijo+siguiente y avanza; false = el NCF se escribe a mano y siguiente no se consume.';
comment on column public.numeraciones.preferida is
  'Serie que sale primero al crear una factura de venta. Máximo una preferida en la fase 1.';

-- Como máximo una fila preferida. Si en el futuro las notas también usan
-- "preferida", este índice se reemplaza por (documento, preferida) cuando
-- exista la columna documento.
create unique index if not exists numeraciones_preferida_uidx
  on public.numeraciones (preferida)
  where preferida;
```

No se agrega `numero_inicial`: `siguiente` cumple ese papel y ya existe. No se agrega `unique (tipo_comprobante) where activa` en la migración porque podría fallar si hoy hay series activas duplicadas; se valida en el preflight (§4.1) y se recomienda dejar una sola activa por tipo. Si el preflight da cero duplicados y Waldy quiere el candado, se puede agregar después con una migración aparte.

### 2.3 Función interna `_ncf_factura`

Esta función es la única que decide el NCF. Es interna: no se concede a `authenticated`.

```sql
create or replace function public._ncf_factura(
  p_tipo text,
  p_fecha date,
  p_ncf_manual text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_num public.numeraciones%rowtype;
  v_ncf text;
  v_numero int;
begin
  -- Misma selección que hoy: activa del tipo, id más bajo, bloqueada.
  select * into v_num
  from public.numeraciones n
  where n.tipo_comprobante = p_tipo
    and n.activa
  order by n.id
  limit 1
  for update;

  if not found then
    raise exception 'no hay numeración activa para el comprobante %', p_tipo
      using errcode = '22023';
  end if;

  -- -----------------------------------------------------------------------
  -- Automática: mismo orden y mensajes que hoy (agotada antes que vencida).
  -- -----------------------------------------------------------------------
  if coalesce(v_num.automatica, true) then
    if nullif(btrim(p_ncf_manual), '') is not null then
      raise exception 'la numeración % es automática; el NCF no se escribe a mano', v_num.prefijo
        using errcode = '22023';
    end if;

    if v_num.hasta is not null and v_num.siguiente > v_num.hasta then
      raise exception 'la numeración % está agotada', v_num.prefijo
        using errcode = '22023';
    end if;

    if v_num.vence is not null and v_num.vence < p_fecha then
      raise exception 'la numeración % está vencida', v_num.prefijo
        using errcode = '22023';
    end if;

    v_ncf := v_num.prefijo || lpad(v_num.siguiente::text, 8, '0');
    update public.numeraciones
       set siguiente = siguiente + 1
     where id = v_num.id;

    return v_ncf;
  end if;

  -- -----------------------------------------------------------------------
  -- Manual: valida, pero NO toca siguiente.
  -- -----------------------------------------------------------------------
  if v_num.vence is not null and v_num.vence < p_fecha then
    raise exception 'la numeración % está vencida', v_num.prefijo
      using errcode = '22023';
  end if;

  if nullif(btrim(p_ncf_manual), '') is null then
    raise exception 'la numeración % es manual; esta factura necesita un NCF escrito a mano', v_num.prefijo
      using errcode = '22023';
  end if;

  v_ncf := upper(btrim(p_ncf_manual));

  if length(v_ncf) <> length(v_num.prefijo) + 8
     or left(v_ncf, length(v_num.prefijo)) <> v_num.prefijo
     or substring(v_ncf from length(v_num.prefijo) + 1) !~ '^[0-9]{8}$' then
    raise exception 'el NCF % no corresponde a la numeración %', v_ncf, v_num.prefijo
      using errcode = '22023';
  end if;

  v_numero := substring(v_ncf from length(v_num.prefijo) + 1)::int;

  if v_numero < 1 then
    raise exception 'el NCF % no es válido: el número debe ser mayor que cero', v_ncf
      using errcode = '22023';
  end if;

  if v_num.hasta is not null and v_numero > v_num.hasta then
    raise exception 'el NCF % está fuera de la serie % (hasta %)', v_ncf, v_num.prefijo, v_num.hasta
      using errcode = '22023';
  end if;

  if exists (select 1 from public.facturas f where f.ncf = v_ncf) then
    raise exception 'el NCF % ya fue usado en otra factura', v_ncf
      using errcode = '22023';
  end if;

  return v_ncf;
end;
$$;

revoke all on function public._ncf_factura(text, date, text) from public, anon, authenticated;
```

Detalles deliberados:

- **`for update` también en manual.** No se necesita para un contador, pero serializa las facturas manuales de la misma serie y hace que el chequeo de duplicado vea lo que acaba de commitear otra sesión. También serializa contra `actualizar_numeracion`, que bloquea la misma fila. El costo es que dos facturas manuales del mismo tipo no se guardan en paralelo; es aceptable para el volumen de Medoxigas.
- **No se actualiza `siguiente` en manual.** Es el requisito explícito. La consecuencia es que el contador puede quedar atrás; se resuelve al volver a automática (§2.5).
- **El prefijo se compara completo, no solo el tipo.** Un `B02...` en una serie B01 se rechaza. La UI además impide escribir letras.
- **Formato de 8 dígitos.** Es el mismo que produce hoy `lpad(siguiente,8,'0')`. El número 0 se rechaza; los ceros a la izquierda se aceptan y se normalizan.
- **El duplicado se chequea antes del insert.** Como la fila de numeración está bloqueada, dos facturas manuales de la misma serie se serializan; la segunda ve el NCF de la primera. `facturas.ncf unique` sigue siendo la defensa final.
- **No se valida `siguiente` en manual.** El número manual puede estar por debajo o por encima del contador; lo que manda es `hasta`.
- **No se toca el asiento ni los impuestos.** `v_ncf` solo se usa para las descripciones y para guardar la cabecera; el resto sigue igual.

### 2.4 Cambio exacto en `_crear_factura_sin_impuestos`

En el cuerpo vigente (el de `20261115500000`, renombrado por `20261115701000`):

1. Quitar de las declaraciones:

```sql
  v_num public.numeraciones%rowtype;
```

2. Reemplazar **todo** este bloque (hoy en `20261115500000:128-146`):

```sql
  select * into v_num
  from public.numeraciones n
  where n.tipo_comprobante = v_tipo and n.activa
  order by n.id
  limit 1
  for update;

  if not found then
    raise exception 'no hay numeración activa para el comprobante %', v_tipo using errcode = '22023';
  end if;
  if v_num.hasta is not null and v_num.siguiente > v_num.hasta then
    raise exception 'la numeración % está agotada', v_num.prefijo using errcode = '22023';
  end if;
  if v_num.vence is not null and v_num.vence < v_fecha then
    raise exception 'la numeración % está vencida', v_num.prefijo using errcode = '22023';
  end if;

  v_ncf := v_num.prefijo || lpad(v_num.siguiente::text, 8, '0');
  update public.numeraciones set siguiente = siguiente + 1 where id = v_num.id;
```

por:

```sql
  v_ncf := public._ncf_factura(v_tipo, v_fecha, p->>'ncf_manual');
```

No hay otros cambios en esa función. El resto del cuerpo (contacto, vendedor, centro de costo, almacén, líneas, inventario, asiento, pago) se copia textual de `20261115500000`.

**Por qué ahí y no en el wrapper público:** el wrapper de `20261115701000` ya hace `(p - 'pago') || jsonb_build_object('lineas', ...)`, y eso conserva `ncf_manual`. Si se interceptara en el wrapper, habría que duplicar la validación y el interno seguiría consumiendo la serie. La fuente de verdad del NCF es el interno.

**Por qué una función auxiliar:** evita reescribir 300 líneas cada vez que cambie una regla de NCF y permite probar la decisión de forma aislada. Es interna, sin `grant`, igual que `_crear_asiento` o `_cuenta_config`.

### 2.5 Cambios exactos en `actualizar_numeracion`

Se parte de la versión de `20261117300000` (la que incluye F16). **No** se copia la de `20261113210000`, porque perdería la vigilancia de notas B03/B04.

Cambios:

1. Declarar:

```sql
  v_automatica boolean;
  v_preferida boolean;
  v_activa boolean;
  v_tipo text;
```

2. Después de `select * into v_num ... for update`, inicializar:

```sql
  v_automatica := coalesce(v_num.automatica, true);
  v_preferida := coalesce(v_num.preferida, false);
  v_activa := v_num.activa;
  v_tipo := v_num.tipo_comprobante;
```

3. Después de leer `siguiente` y `hasta`, aceptar los dos campos nuevos y acotarlos a facturas de venta:

```sql
  if p ? 'activa' then
    v_activa := (p->>'activa')::boolean;
  end if;

  if p ? 'automatica' then
    if v_tipo not in ('01', '02', '14', '15', '16') then
      raise exception 'la numeración automática o manual solo aplica a facturas de venta'
        using errcode = '22023';
    end if;
    v_automatica := (p->>'automatica')::boolean;
  end if;

  if p ? 'preferida' then
    if (p->>'preferida')::boolean and v_tipo not in ('01', '02', '14', '15', '16') then
      raise exception 'la numeración preferida solo aplica a facturas de venta'
        using errcode = '22023';
    end if;
    v_preferida := (p->>'preferida')::boolean;
  end if;

  if v_preferida and not v_activa then
    raise exception 'una numeración preferida debe estar activa'
      using errcode = '22023';
  end if;
```

4. La validación `siguiente <= hasta` solo aplica a automática (en manual `siguiente` es referencia):

```sql
  if v_automatica
     and (p ? 'siguiente' or p ? 'hasta' or p ? 'automatica')
     and v_hasta is not null
     and v_siguiente > v_hasta then
    raise exception 'el siguiente no puede ser mayor que el hasta'
      using errcode = '22023';
  end if;
```

5. La validación del último NCF emitido solo aplica a automática. Si se está **activando** automática, el mensaje debe explicar qué hacer:

```sql
  if v_automatica and v_siguiente <= v_ultimo then
    if p ? 'automatica' then
      raise exception 'no puedes activar la numeración automática: el siguiente (%) debe ser mayor que el último NCF emitido (%)',
        v_siguiente, v_ultimo
        using errcode = '22023';
    else
      raise exception 'el siguiente no puede ser menor o igual al último NCF emitido (%)', v_ultimo
        using errcode = '22023';
    end if;
  end if;
```

6. Antes del `update` principal, si la fila queda preferida, limpiar las demás:

```sql
  if v_preferida then
    update public.numeraciones n
       set preferida = false
     where n.preferida
       and n.id <> v_id;
  end if;
```

7. El `update` principal agrega las dos columnas:

```sql
  update public.numeraciones n
  set
    siguiente = v_siguiente,
    hasta = v_hasta,
    vence = v_vence,
    activa = v_activa,
    automatica = v_automatica,
    preferida = v_preferida,
    nombre = case when p ? 'nombre' then p->>'nombre' else n.nombre end
  where n.id = v_id;
```

El resto de la función (cálculo de `v_ultimo` con facturas, gastos menores, notas 03/04 y B03 viejo de compras) se copia textual de `20261117300000`. Los `revoke/grant` existentes se mantienen; `create or replace` conserva los permisos, pero se verifica en el preflight.

**Efecto de estas reglas:**

- Una serie manual puede tener `siguiente` por debajo del último NCF emitido y editar nombre/activa sin errores.
- Al activar automática, si `siguiente` no supera el último NCF (incluidos los manuales), falla con un mensaje accionable.
- Al activar automática, `siguiente` debe caber en `hasta`.
- `preferida` se puede quitar; al ponerla, se limpia la anterior.
- Una numeración preferida debe quedar activa; si se desactiva, hay que enviar `preferida=false`.
- Una serie 03/04/13 no acepta `automatica` ni `preferida=true`; la UI ni siquiera muestra esos controles.

### 2.6 Permisos y RLS

- `_ncf_factura`: `security definer`, `search_path=''`, `revoke all` de `public, anon, authenticated`. No se concede.
- `_crear_factura_sin_impuestos`: ya está revocada; `create or replace` conserva el `revoke`. Verificar con `\df+` o con una consulta a `pg_proc` después de aplicar.
- `actualizar_numeracion`: ya tiene `grant execute ... to authenticated`; se conserva. El control real de rol está dentro (`admin`/`contador`).
- `numeraciones`: las columnas nuevas no cambian RLS. `authenticated` sigue leyendo con `rol_actual() is not null`; no hay `insert/update/delete` directo.
- No se usa `service_role` en ningún punto.

### 2.7 Compatibilidad con la vista previa y la asignación atómica

| Aspecto | Automática | Manual |
| --- | --- | --- |
| Selección de serie | Activa del tipo, `id` más bajo, `for update`. | Igual. |
| Bloqueo | `for update` sobre la fila de numeración. | Igual. |
| Contador | Se incrementa en la misma transacción. | No se toca. |
| Vista previa | `previsualizarNcf` muestra `prefijo + lpad(siguiente,8)`. | `previsualizarNcf` devuelve `estado: "manual"` con `prefijo` y `hasta`; no promete número. |
| Reserva | No reserva; el preview es solo lectura. | No reserva; el número se valida al guardar. |
| Duplicado | Lo impide la secuencia y `ncf unique`. | Lo impide el chequeo bajo lock y `ncf unique`. |
| Fallo posterior | La transacción revierte el incremento. | La transacción no tiene incremento que revertir; no deja factura. |
| Concurrencia | Dos facturas se serializan en la fila de numeración. | Igual; además el chequeo de duplicado es consistente. |

La vista previa debe cambiar su tipo:

```ts
export type PrevisualizacionNcf =
  | { estado: "lista"; ncf: string }
  | { estado: "manual"; prefijo: string; hasta: number | null }
  | { estado: "no-disponible"; mensaje: string };
```

Orden de decisión en `previsualizarNcf`:

1. Buscar la activa del tipo (misma que la RPC).
2. Si no hay, `no-disponible` con el mensaje actual.
3. Si es automática: chequear `siguiente > hasta` y luego `vence < fecha`, en el mismo orden que hoy; si todo pasa, `lista`.
4. Si es manual: chequear `vence < fecha`; si pasa, `manual` (aunque `siguiente > hasta`: el contador no importa en manual).

`automatica === undefined` (base sin migración) se trata como `true`.

### 2.8 Por qué no otros atajos

- **Trigger `before insert` sobre `facturas`:** no tiene acceso al payload original (`ncf_manual`) y el interno ya usa `v_ncf` en las descripciones del asiento. Un trigger obligaría a insertar un NCF provisional y luego corregirlo; es más frágil.
- **Insertar automático y luego decrementar `siguiente`:** crea una ventana de carrera y puede chocar con otra factura. No es atómico.
- **Permitir `ncf_manual` en el wrapper y dejar que el interno consuma:** la serie se incrementaría igual. No cumple el requisito.
- **Un `unique` global de NCF:** no sirve: los NCF de proveedor son de otro emisor y pueden coincidir legítimamente. La unicidad correcta para nuestras facturas ya está en `facturas.ncf`.

### 2.9 Dependencias de migración

La nueva migración debe correr **después** de:

- `20261115500000_funciones_fusionadas_s15.sql` (cuerpo de `_crear_factura_sin_impuestos` con almacén, vendedor y centro de costo).
- `20261115701000_motor_impuestos.sql` (renombre a `_crear_factura_sin_impuestos` y wrapper de impuestos).
- `20261117300000_numeraciones_notas.sql` (F16 en `actualizar_numeracion`).

Si `20261117300000` no está aplicada en `prueba`, se aplica primero. La nueva migración no debe intentar reemplazar esa lógica por una versión vieja.

---

## 3. UI

### 3.1 Pantalla de Numeraciones

Archivo: `src/app/(main)/dashboard/contabilidad/numeraciones/_components/numeraciones-cliente.tsx`.
No se toca `src/components/ui`.

**Tabla**

- Agregar una columna «Modo»: `PillEstado` con «Automática» (tono `neutro`) o «Manual» (tono `info`).
- Si `preferida`, mostrar una estrella (`Star` de lucide, `aria-label="Preferida"`) junto al nombre; no hace falta una columna extra. Una sola fila puede tenerla.
- En filas 03/04/13, el modo se muestra como «Automática» y el diálogo no ofrece el interruptor: en fase 1 esos documentos no lo usan.
- Si la base no tiene la columna (`automatica === undefined`), mostrar «Automática» y no ofrecer el interruptor.

**Diálogo «Editar numeración»**

- Mantener Tipo, Nombre, Siguiente, Hasta, Vence, Activa.
- Agregar `Switch` «Numeración automática»:
  - Encendido: «La serie asigna el NCF y avanza sola.»
  - Apagado: «Escribe el NCF a mano. La serie no avanza.»
- Agregar `Switch` «Preferida»:
  - «Será el tipo de comprobante que sale primero al crear una factura.»
  - Deshabilitado si `activa` está apagado; al desactivar la serie, `preferida` se envía en `false`.
- `Prefijo` sigue siendo solo lectura. Mostrar una nota: «El prefijo no se cambia en una serie con NCF emitidos.»
- `Siguiente` en manual: helper «En manual no se consume; sirve de referencia y para volver a automática.»
- Si el usuario enciende automática y la RPC responde que `siguiente` no supera el último NCF, mostrar el mensaje tal cual y no cerrar el diálogo.
- Si la base no tiene las columnas nuevas, mostrar una nota discreta: «La numeración manual se habilita cuando se aplique la migración.» y no enviar `automatica`/`preferida`.

**Server action**

`src/lib/numeraciones/validacion.ts` agrega:

```ts
automatica: z.boolean().optional(),
preferida: z.boolean().optional(),
```

`src/lib/numeraciones/acciones.ts` arma el payload explícito para no mandar `undefined`:

```ts
const p = {
  id: datos.id,
  nombre: datos.nombre,
  siguiente: datos.siguiente,
  hasta: datos.hasta,
  vence: datos.vence,
  activa: datos.activa,
  ...(datos.automatica !== undefined ? { automatica: datos.automatica } : {}),
  ...(datos.preferida !== undefined ? { preferida: datos.preferida } : {}),
};
```

Agregar `revalidatePath("/dashboard/facturacion/nueva")` además de las rutas actuales, para que el tipo preferido se refleje.

**Roles**

- `lector`: tabla y diálogo en lectura; no ve switches editables (hoy `puedeEditar` ya lo controla).
- `contador` y `admin`: pueden editar, como hoy.
- La RPC vuelve a validar el rol; la UI no es la frontera de seguridad.

### 3.2 Formulario de factura

Archivo: `src/components/documento-venta/documento-venta-form.tsx`.
No se toca `src/components/ui`. Usar `InputGroup`, `InputGroupAddon`, `InputGroupInput`, `Button`, `Label` y `Switch` de shadcn tal cual.

**Caja compacta del NCF (como Alegra, no full-width)**

La caja va **debajo del selector de comprobante**, alineada a la derecha, con medidas fijas y el engranaje **fuera** de la caja:

- Caja: ~215 x 56 px (`w-[215px] h-14`), borde de 1 px y radio de 10 px.
- Engranaje: fuera, a la derecha de la caja, botón `size="icon-sm"` (28 x 28 px), separado 8 px (`gap-2`), con `aria-label="Configurar numeración"` y `title="Configurar numeración"`.
- Selector de comprobante arriba, preferiblemente del mismo ancho (`w-[215px]`) para que la caja quede alineada; la caja **no** se estira al ancho de la columna.
- Helper y error debajo de la caja, también dentro de los 215 px; no ocupan todo el encabezado.
- El grupo caja + engranaje se alinea a la derecha en escritorio; en móvil se mantiene compacto y no desborda.

```
Automática:
[ 16 Exportaciones ▾ ]        ← selector, ~215 px

┌─────────────────────┐  ⚙   ← caja ~215x56; engranaje fuera
│ NCF   B16 00000042  │      ← número calculado por el sistema
└─────────────────────┘
  Se asigna al guardar        ← helper, ancho de la caja

Manual:
[ 16 Exportaciones ▾ ]

┌─────────────────────┐  ⚙
│ NCF   B16 00000042  │      ← 00000042 se teclea; B16 es fijo
└─────────────────────┘
  Escribe solo el número…     ← no consume la serie
```

**Automática**

- La caja muestra «NCF» y el próximo número en una sola línea, sin input. El prefijo y el número pueden verse separados por un espacio corto (`B16 00000042`) solo para leerlos; el NCF guardado sigue siendo `B1600000042` sin espacio.
- El engranaje va como hermano de la caja, no dentro de ella; lleva a `/dashboard/contabilidad/numeraciones`.
- `vistaNcf.estado === "lista"` mantiene el `aria-live="polite"` en el número.
- Debajo: «Se asigna al guardar».
- No cambiar el tamaño de la caja al pasar de automática a manual: las dos versiones miden lo mismo.

**Manual**

- La misma caja de 215 x 56 px, con «NCF», el prefijo fijo (`B16`, `font-mono`) y el número editable en la misma línea.
- Usar `InputGroup` como caja: `className="h-14 w-[215px] rounded-[10px] border bg-background px-3"`.
  - `InputGroupAddon align="inline-start"`: «NCF» y el prefijo, en `text-muted-foreground` / `font-mono`.
  - `InputGroupInput`: sin borde propio (`border-0 bg-transparent shadow-none focus-visible:ring-0`), `inputMode="numeric"`, `maxLength={8}`, ancho de 8 caracteres (`w-[8ch]`), alineado a la derecha y `tabular-nums`.
- El prefijo es texto, no un `<input>` editable. Si Waldy quiere poder teclearlo, se acepta como un input de 3-4 caracteres dentro de la misma caja, pero el servidor lo valida contra la serie y rechaza un prefijo ajeno; la opción recomendada, y la que muestra Alegra, es prefijo fijo + número editable.
- El engranaje sigue **fuera** de la caja, como hermano; no dentro de `InputGroupAddon`.
- Helper: «Escribe solo el número; se guarda como B16 00000042. No consume la serie.»
- Si el usuario pega un NCF completo (`B1600000042`), parsearlo: si el prefijo coincide, quedarse con los 8 dígitos; si no coincide, mostrar error inline y no aceptar el valor. No recortar silenciosamente a 8 dígitos.
- Error inline con `role="alert"`, `aria-invalid` y `aria-describedby`; el foco va al campo `ncf-manual`.
- Si `vistaNcf.estado === "no-disponible"`, la caja muestra «—», el mensaje actual debajo (sin numeración, inactiva, agotada o vencida) y el engranaje; no mostrar input.
- Si el tipo cambia, limpiar el número manual y el error.

**Móvil y oscuro**

- Usar `w-[215px] max-w-full`; el grupo caja + engranaje mide ~251 px y cabe en 375 px. No volver a `w-full`.
- No copiar `bg-white` del recuadro actual: usar `bg-background`, `border-border`, `text-foreground` y `text-muted-foreground` para que funcione en oscuro.
- No usar `<select>` ni `NativeSelect`; el tipo de comprobante sigue con `Select`.

**Estado y payload**

- `const [ncfManual, setNcfManual] = useState("")`.
- `const modoManual = vistaNcf?.estado === "manual"`.
- `const prefijo = vistaNcf?.estado === "manual" ? vistaNcf.prefijo : ""`.
- Al guardar, si `modoManual`, validar `^\d{1,8}$` y número `>= 1`; luego armar:
  ```ts
  const ncfManualCompleto = `${prefijo}${numeroConsecutivo(Number(ncfManual))}`;
  ```
  y pasarlo a `construirEntrada({ ..., ncfManual: ncfManualCompleto })`.
- `construirEntrada` agrega `...(datos.ncfManual ? { ncf_manual: datos.ncfManual } : {})`. No lo agrega en cotizaciones/conduces.
- `crearFacturaSchema` agrega `ncf_manual: z.string().trim().max(32).optional()`.
- `crearFactura` agrega al payload `...(datos.ncf_manual ? { ncf_manual: datos.ncf_manual } : {})`.
- La RPC es la que valida prefijo, rango, vencimiento y duplicado; el cliente solo evita el viaje obvio.

**Validación de campos**

En `src/components/documento-venta/calculo.ts`:

- Agregar `"ncf"` a `CampoDocumento` y `idCampoDocumento("ncf") => "ncf-manual"`.
- Agregar `ncfManual?: string` y `requiereNcfManual?: boolean` a `ValidacionDocumento`.
- Si `requiereNcfManual`:
  - Si el valor está vacío: `{ campo: "ncf", mensaje: "Escribe el número del NCF." }`.
  - Si no cumple `^\d{1,8}$` o es 0: `{ campo: "ncf", mensaje: "Escribe un número de NCF entre 1 y 99999999." }`.
- El orden de errores: después de cliente/fechas/líneas y antes del total, para que el foco sea coherente.

### 3.3 Mensajes (español de RD)

| Situación | Mensaje |
| --- | --- |
| Falta el número en manual | «Escribe el número del NCF.» |
| Número con formato inválido | «Escribe un número de NCF entre 1 y 99999999.» |
| Prefijo incorrecto | «El NCF B0200000042 no corresponde a la numeración B01.» |
| Fuera de rango | «El NCF B0100010001 está fuera de la serie B01 (hasta 100000).» |
| Vencida | «La numeración B01 está vencida.» (la vista previa agrega la fecha: «venció el 31/12/2026»). |
| Sin numeración activa | «No hay numeración activa para el comprobante 01.» |
| Automática con NCF manual | «La numeración B01 es automática; el NCF no se escribe a mano.» |
| Manual sin NCF | «La numeración B01 es manual; esta factura necesita un NCF escrito a mano.» |
| Duplicado | «El NCF B0100000042 ya fue usado en otra factura.» |
| Reactivar automática con contador atrasado | «No puedes activar la numeración automática: el siguiente (5) debe ser mayor que el último NCF emitido (42).» |
| Sin permiso | «No tienes permiso para crear facturas.» / «No tienes permiso para editar numeraciones.» |

La RPC devuelve los mensajes en minúscula; `mensajeErrorRpc` capitaliza la primera letra. Los textos de la tabla son los que ve el usuario.

### 3.4 Archivos que se tocarían en la implementación

- `src/lib/numeraciones/tipos.ts` — `automatica?: boolean`, `preferida?: boolean`.
- `src/lib/numeraciones/consultas.ts` — `select("*")` y mapeo tolerante; ver §4.3.
- `src/lib/numeraciones/preview.ts` — estado `manual`, `tipoComprobantePreferido`, comentario de fuente.
- `src/lib/numeraciones/validacion.ts` — booleanos opcionales.
- `src/lib/numeraciones/acciones.ts` — payload explícito y revalidate de `/dashboard/facturacion/nueva`.
- `src/app/(main)/dashboard/contabilidad/numeraciones/_components/numeraciones-cliente.tsx` — columna Modo, estrella, switches.
- `src/components/documento-venta/documento-venta-form.tsx` — `CajaNcf` compacta (~215 x 56 px) con engranaje fuera, estado, payload y validación.
- `src/components/documento-venta/calculo.ts` — `ncf`, `ncfManual`, `construirEntrada`.
- `src/lib/facturacion/validacion.ts` — `ncf_manual`.
- `src/lib/facturacion/acciones.ts` — `ncf_manual` al payload.
- `docs/contrato-db.md` — contrato de `numeraciones` y `crear_factura`.
- `HANDOFF.md` — entrada al terminar.

No se toca `src/components/ui`, `package.json`, migraciones aplicadas ni datos.

---

## 4. Rollout seguro

### 4.1 Preflight (solo lectura, antes de aplicar)

Correr en `prueba`, nunca contra producción desde el agente:

```sql
-- 1) ¿Hay más de una serie activa por tipo?
select tipo_comprobante, count(*) as activas
from public.numeraciones
where activa
group by tipo_comprobante
having count(*) > 1;

-- 2) ¿El prefijo de una factura de venta no es B + tipo?
select id, tipo_comprobante, prefijo
from public.numeraciones
where tipo_comprobante in ('01', '02', '14', '15', '16')
  and prefijo <> 'B' || tipo_comprobante;

-- 3) ¿Hay prefijos en minúscula o con espacios?
select id, tipo_comprobante, prefijo
from public.numeraciones
where prefijo <> upper(btrim(prefijo));

-- 4) ¿Hay NCF de factura con formato raro? (el cast a int de
--    actualizar_numeracion fallaría con un sufijo no numérico)
select id, tipo_comprobante, ncf
from public.facturas
where ncf !~ '^B(01|02|14|15|16)[0-9]{8}$';

-- 5) ¿El contador está atrasado respecto al último NCF?
--    Usar la misma idea de 20261117300000: máximo de facturas,
--    gastos menores y notas 03/04. Para una revisión rápida de facturas:
with ultimos as (
  select n.id, n.tipo_comprobante, n.prefijo, n.siguiente,
         coalesce((
           select max(substring(f.ncf from length(n.prefijo) + 1)::int)
           from public.facturas f
           where f.tipo_comprobante = n.tipo_comprobante
             and f.ncf like n.prefijo || '%'
         ), 0) as ultimo
  from public.numeraciones n
  where n.activa
)
select * from ultimos where siguiente <= ultimo;

-- 6) Unicidad entre tablas: correr docs/pruebas/ncf-unicidad.sql.
```

Si (1) devuelve filas, **no** agregar el `unique` de activa y decidir con Waldy cuál serie queda. Si (3) o (4) devuelven filas, corregirlas antes de habilitar manual; el cast de `actualizar_numeracion` y la comparación de prefijo no están preparados para esos datos. Repetir la consulta (4) sobre `gastos_menores` (B13) y las notas 03/04: `actualizar_numeracion` también las recorre para calcular el último NCF.

### 4.2 Orden de despliegue

La app y la base son tolerantes en ambos sentidos. Orden recomendado:

1. **PR A — código tolerante, sin manual visible.** `getNumeraciones` usa `select("*")`; `automatica`/`preferida` son opcionales y se tratan como `true`/`false`. La UI solo muestra el modo manual si la columna existe. Se puede mergear y desplegar en `prueba` **sin** la migración: el comportamiento es idéntico al de hoy.
2. **PR B — migración + pgTAP + tipos regenerados.** Coder aplica `20261117400000` en `prueba` con OK de Waldy/Contable. Todas las filas quedan `automatica=true`; no cambia nada funcional. `pnpm db:types` y commit de `src/lib/supabase/types.ts`.
3. **Prueba funcional en `prueba`.** Activar manual en una serie de bajo uso (B16 o una serie dedicada creada por SQL con aprobación), emitir una factura, verificar que `siguiente` no cambió, probar duplicado/prefijo/rango/vencido y volver a automática con `siguiente` por encima del último.
4. **Producción.** Desplegar primero el código tolerante, después aplicar la migración en una ventana de baja actividad. No hay downtime: son columnas con default y `create or replace`.
5. **Habilitar por serie.** Empezar por B16 o una serie dedicada; dejar B01/B02 para cuando Contable apruebe el uso y la política de saltos.

Si se invierte el orden (migración primero), la app vieja ignora las columnas nuevas y sigue automática; también es seguro. Lo que **no** se debe hacer es desplegar una UI que muestre manual sin que la migración esté aplicada: el RPC viejo ignoraría `ncf_manual` y asignaría automático en silencio.

### 4.3 Matriz de compatibilidad

| App | Base | Resultado |
| --- | --- | --- |
| Vieja | Vieja | Comportamiento actual. |
| Nueva | Vieja | `select("*")` no trae `automatica`; se trata como `true`; los switches se ocultan; no se envía `ncf_manual`; `actualizar_numeracion` no recibe campos nuevos. Sin cambio funcional. |
| Vieja | Nueva | La app vieja no selecciona las columnas nuevas y nunca manda `ncf_manual`; la RPC nueva usa `automatica=true` por default. Sin cambio funcional. |
| Nueva | Nueva | Manual disponible por serie. |

**Detección de capacidad, no feature flag de entorno.** El “flag” es la columna por fila y la presencia de la columna:

- `getNumeraciones` debe usar `.select("*")`, no una lista explícita con `automatica`, para que la app nueva funcione contra una base sin la migración.
- `Numeracion.automatica` y `preferida` son opcionales en TypeScript. `previsualizarNcf` usa `automatica ?? true`; `tipoComprobantePreferido` usa `preferida === true`.
- `soportaManual = numeraciones.some((n) => n.automatica !== undefined)`. Si es `false`, no se muestran switches ni campo manual y no se envían las claves nuevas.
- No hace falta una variable de entorno. Si Waldy quiere un apagado global de emergencia, se hace con `update public.numeraciones set automatica = true` con aprobación, o se revierte el deploy; no se agrega un flag más.

### 4.4 Rollback

- **Código:** volver al deploy anterior. Las columnas nuevas quedan; la app vieja las ignora. Antes de revertir, si hay facturas manuales, poner todas las series en `automatica=true` y subir `siguiente` por encima del último NCF de cada una; si no, la app vieja podría intentar repetir un número manual y chocar con `unique`.
- **Migración:** no borrar columnas. Son aditivas y no afectan. Si hay que revertir una función, se hace con una migración nueva que restaure las definiciones de `20261117300000` y `20261115500000`; nunca editando una migración aplicada.
- **NCF manual erróneo:** no se borra la factura. Se anula con `anular_documento` y se emite otra con un NCF distinto, con Contable. El NCF anulado sigue ocupado, que es lo correcto.

### 4.5 Qué debe aprobar Waldy / Contable antes de aplicar

- [ ] **Waldy:** el modo es por serie y no por factura; la fase 1 es solo facturas de venta.
- [ ] **Waldy:** qué series pueden ser manuales (B16 primero; B01/B02 después) y si B01 queda restringida a `admin`.
- [ ] **Waldy:** si se incluye `preferida` en la fase 1 y si el tipo por defecto puede pasar de B02 a B01.
- [ ] **Contable:** formato `B + tipo + 8 dígitos`, rango `hasta` y vencimiento `vence` son los correctos para la DGII.
- [ ] **Contable:** si se permiten saltos en una serie manual y si una serie manual puede volver a automática. Recomendación: serie manual dedicada, no mezclar.
- [ ] **Contable:** qué hacer con facturas recurrentes y conversiones de cotización cuando la serie del tipo es manual.
- [ ] **Coder:** revisar el diff, el orden de migraciones (F16 primero), los pgTAP y los tipos generados.
- [ ] **Waldy:** aprobar la aplicación en `prueba` y, después de la prueba, en producción.

---

## 5. Pruebas

### 5.1 pgTAP: `supabase/tests/ncf_manual_test.sql`

Casos mínimos (cada archivo con su `begin; select plan(N); ... rollback;` y usuarios propios, como los tests actuales):

| # | Caso | Resultado esperado |
| --- | --- | --- |
| 1 | B02 en manual, factura con `ncf_manual = 'B0200000042'` | Crea la factura; `ncf` correcto; `numeraciones.siguiente` **no cambia**. |
| 2 | La misma factura con ITBIS 18 % y `pago` | Crea la factura, el pago y el asiento; el ITBIS se acredita en 2102; el wrapper no perdió `ncf_manual`. |
| 3 | Manual sin `ncf_manual` | Error `22023`; no hay factura; `siguiente` igual. |
| 4 | Manual con prefijo de otra serie (`B01...` en B02) | Error `22023`; no hay factura. |
| 5 | Manual con el mismo NCF dos veces | La primera pasa; la segunda error `22023`; queda una sola factura. |
| 6 | Manual con número `> hasta` | Error `22023`; no hay factura. |
| 7 | Manual con número `0` | Error `22023`. |
| 8 | Manual con 7 dígitos (`B020000042`) | Error `22023`; la API exige 8. |
| 9 | Manual con ceros a la izquierda (`B0200000007`) | Pasa; se guarda normalizado. |
| 10 | Manual con `vence` anterior a la fecha | Error `22023`. |
| 11 | Serie manual sin fila activa | Error `22023`. |
| 12 | Serie automática con `ncf_manual` | Error `22023`; `siguiente` no se consume. |
| 13 | Serie automática normal | Pasa y `siguiente` avanza 1 (regresión). |
| 14 | Manual → automática con `siguiente` bajo | Error `22023` con el mensaje de «último NCF emitido». |
| 15 | Manual → automática con `siguiente = último + 1` | Pasa y actualiza. |
| 16 | `preferida = true` en B01 y luego en B02; y preferida con `activa = false` | Solo B02 queda preferida; el índice único lo garantiza; una preferida inactiva se rechaza. |
| 17 | Lector intenta factura manual | Error `42501`. |
| 18 | `crear_factura_proveedor` con NCF del proveedor | Sin cambios; no usa `numeraciones`. |
| 19 | `crear_gasto_menor` y nota de crédito | Siguen con B13/B04 automáticos; no les afecta `automatica`. |
| 20 | `generar_factura_recurrente` con serie manual | Falla con mensaje claro y no deja factura a medias. |

Esqueleto de los casos centrales (el `plan(N)` final se ajusta al número de asserts; aquí se muestran 4):

```sql
begin;
select plan(4);

-- usuarios admin/contador/lector, contacto y producto, como en
-- supabase/tests/ncf_b14_b15_b16_test.sql

set local role authenticated;
set local request.jwt.claims = '{"sub":"...admin...","role":"authenticated"}';

-- Poner B02 en manual (la RPC valida el rol)
select lives_ok(
  $$select public.actualizar_numeracion(jsonb_build_object(
    'id', (select id from public.numeraciones where tipo_comprobante = '02' order by id limit 1),
    'automatica', false
  ))$$,
  'B02 pasa a manual'
);

insert into _ids (clave, id)
select 'factura_manual', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-17',
  'vencimiento', '2026-12-17',
  'ncf_manual', 'B0200000042',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'servicio'),
    'cantidad', 1,
    'precio', 100.00
  ))
));

select is(
  (select ncf from public.facturas where id = (select id from _ids where clave = 'factura_manual')),
  'B0200000042',
  'guarda el NCF manual'
);

select is(
  (select siguiente from public.numeraciones where tipo_comprobante = '02' order by id limit 1),
  1,
  'el NCF manual no consume la serie'
);

select throws_ok(
  $$select public.crear_factura(jsonb_build_object(
    'tipo_comprobante', '02',
    'contacto_id', '...',
    'fecha', '2026-11-17',
    'vencimiento', '2026-12-17',
    'ncf_manual', 'B0200000042',
    'lineas', '[...]'::jsonb
  ))$$,
  '22023',
  null,
  'el NCF duplicado se rechaza'
);
```

Los asserts exactos se ajustan al número final de casos. No se usa `service_role`; el test corre con `authenticated` y RPC.

### 5.2 Vitest

| Archivo | Casos |
| --- | --- |
| `src/lib/numeraciones/preview.test.ts` | Serie manual devuelve `{ estado: "manual", prefijo, hasta }`; no promete NCF; `siguiente > hasta` sigue disponible en manual; vencida/no activa sigue `no-disponible`; automática conserva todos los tests actuales; `tipoComprobantePreferido` elige la preferida activa, ignora inactiva y cae en `"02"`. |
| `src/lib/numeraciones/validacion.test.ts` | Acepta `automatica`/`preferida` booleanos y los omite si no vienen; rechaza tipos no booleanos. |
| `src/lib/numeraciones/acciones.test.ts` | Payload sin campos nuevos cuando no se envían; payload con `automatica`/`preferida` cuando sí; error de RPC en español; lector rechazado. |
| `src/lib/facturacion/validacion.test.ts` | `ncf_manual` opcional, con `trim`, máximo 32; factura válida sigue pasando. |
| `src/lib/facturacion/acciones.test.ts` (nuevo) | La RPC recibe `ncf_manual` solo cuando viene; no lo recibe en automática; error de duplicado se muestra; lector rechazado; total <= 0 no llama la RPC. |
| `src/components/documento-venta/calculo.test.ts` | `construirEntrada` incluye `ncf_manual` cuando se pasa y lo omite cuando no; validación exige NCF manual; error de NCF se enfoca en `ncf-manual`; no afecta cotizaciones/conduces. |

### 5.3 E2E

Archivo nuevo `tests/e2e/ncf-manual.spec.ts`, con el mismo patrón de `numeraciones.spec.ts` (se salta sin `E2E_EMAIL`/`E2E_PASSWORD`).

- **Prueba de UI sin emitir:** abrir Numeraciones, apagar «Numeración automática» de B16, ir a Nueva factura, elegir B16, verificar que aparece el prefijo `B16`, el campo numérico y el engranaje; cancelar; volver a encender B16. No crea datos.
- **Prueba de emisión (solo base desechable):** con `E2E_NCF_MANUAL=1`, emitir una factura B16 con un número de prueba, verificar que la ficha muestra el NCF y que la tabla de Numeraciones conserva `Siguiente`. Anular la factura al final no libera el NCF; por eso esta prueba no corre contra una base compartida.
- **Regresión:** `tests/e2e/numeraciones.spec.ts` debe seguir pasando; el diálogo ahora tiene dos switches más, pero Guardar con los mismos valores debe cerrar y no cambiar la fila.

No se agregan capturas al repo por esta tarea.

### 5.4 Casos límite (resumen)

| Caso | Comportamiento |
| --- | --- |
| NCF duplicado | Error `22023` «ya fue usado»; no se inserta. |
| Fuera de serie (`> hasta`) | Error `22023` con el `hasta`. |
| Vencido (`vence < fecha`) | Error `22023` «está vencida»; la vista previa muestra la fecha. |
| Sin numeración activa | Error `22023`; la UI muestra el mensaje y el engranaje. |
| Prefijo incorrecto | Error `22023`; la UI no deja escribir letras. |
| Número 0 | Error `22023`. |
| 7 dígitos | Error; la API exige 8. |
| 8 dígitos con ceros | Pasa y se normaliza. |
| NCF en minúscula/espacios | Se normaliza a mayúscula y se recorta. |
| Serie manual con `siguiente` atrasado | Pasa; no se toca. |
| Volver a automática atrasado | Error hasta subir `siguiente`. |
| Factura anulada con el mismo NCF | Sigue bloqueado por `unique`; correcto. |
| Reintento de red | La segunda emisión falla por duplicado; la primera existe. La UI debe mostrar el error y no crear otra. |
| Recurrente/cotización con serie manual | Falla con mensaje claro; no deja documento a medias. |
| Nota/gasto/proveedor | Sin cambios; no consultan `automatica`. |

### 5.5 Comandos

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm build
supabase start
supabase test db          # incluye ncf_manual_test.sql
pnpm test:e2e             # con E2E_EMAIL/E2E_PASSWORD; el guardado manual, con E2E_NCF_MANUAL=1
```

`pnpm db:types` se corre después de aplicar la migración en `prueba`; CI verifica que `src/lib/supabase/types.ts` esté al día.

---

## 6. Riesgos y decisiones pendientes

### 6.1 Riesgos

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| **Saltos en la serie** al mezclar manual y automática | La DGII puede observar NCF no consecutivos. | Recomendación: serie manual dedicada; no volver a automática. Si se vuelve, `siguiente` debe superar el último NCF y Contable debe aprobar. |
| **Duplicado por reintento** | Dos facturas con el mismo NCF. | `facturas.ncf unique`, chequeo bajo `for update` y mensaje claro. La UI deshabilita Guardar mientras está pendiente. |
| **Contador atrasado al reactivar automática** | La automática repite un número manual. | `actualizar_numeracion` exige `siguiente > último`; la UI muestra el error. |
| **Recurrentes y conversiones** | `generar_factura_recurrente` y `convertir_a_factura` no tienen quién escriba el NCF. | Mensaje claro o bloqueo de la plantilla; decisión de Contable. No habilitar B02 manual sin resolverlo. |
| **Wrapper de impuestos** | Si `ncf_manual` se pierde en `(p - 'pago')`, la factura sale automática. | El wrapper ya pasa `p`; test pgTAP con ITBIS y pago. |
| **Migración no aplicada** | La UI podría mostrar manual y el RPC viejo ignorarlo. | `select("*")`, campos opcionales, `soportaManual`; no enviar `ncf_manual` sin columna. |
| **Notas/gastos** | `automatica` no les hace nada y el usuario cree que sí. | La UI oculta los switches para 03/04/13; la RPC los rechaza. |
| **`preferida` global** | En fase 2, notas y facturas podrían necesitar preferidas distintas. | Fase 1 solo facturas; fase 2 agrega `documento` y cambia el índice. |
| **Unicidad entre tablas** | Un NCF de proveedor puede coincidir con uno propio; un unique global sería incorrecto. | No agregar unique global; en fase 1 el prefijo B01/B02/B14/B15/B16 solo se usa en `facturas`. Correr `docs/pruebas/ncf-unicidad.sql` antes de cualquier cambio. |
| **Auditoría del modo** | No se sabrá, mirando solo la factura, si fue manual. | Fase 1 no agrega columna; si Contable lo pide, agregar `facturas.ncf_manual` o `numeracion_id` en una migración posterior. |
| **Rollback con manuales emitidos** | La app vieja puede chocar con un NCF manual. | Antes de revertir, pasar todo a automática y subir `siguiente`; no borrar columnas. |
| **UI en oscuro/móvil** | El recuadro actual usa `bg-white`; el manual podría verse mal. | Usar tokens y probar 375 px; no editar `components/ui`. |
| **Datos de prueba E2E** | Emitir una factura manual en una base compartida deja un NCF ocupado. | E2E de emisión solo con `E2E_NCF_MANUAL=1` y base desechable; la prueba de UI no guarda. |

### 6.2 Decisiones pendientes

| # | Decisión | Recomendación | Quién |
| --- | --- | --- | --- |
| D1 | ¿La serie manual puede convivir con la automática del mismo tipo? | No. Una serie, un modo; para manual, serie dedicada. | Waldy / Contable |
| D2 | ¿Se permite volver de manual a automática? | Sí, solo con `siguiente > último` y OK de Contable; si hay saltos, no. | Contable |
| D3 | ¿B02 puede ser manual? | No en fase 1: afecta recurrentes y conversiones. Si se necesita, agregar guardas claras primero. | Waldy |
| D4 | ¿B01 puede ser manual? | Sí, pero con aprobación de Contable; evaluar restringirlo a `admin`. | Waldy / Contable |
| D5 | ¿`preferida` en fase 1? | Sí, es barata; si se quiere diff mínimo, dejarla para 1.5. | Waldy |
| D6 | ¿El tipo por defecto puede pasar de B02 a B01? | Solo si Waldy marca B01 como preferida; si no, se conserva B02. | Waldy |
| D7 | ¿Se agrega `facturas.ncf_manual` para auditoría? | No en fase 1; evaluar si Contable lo pide. | Waldy / Contable |
| D8 | ¿Se agrega «Nueva numeración» y edición de prefijo? | No en fase 1; es otra tarea con su RPC y su UI. | Waldy |
| D9 | ¿Se agrega `unique` de una activa por tipo? | Solo si el preflight da cero duplicados; no en la migración inicial. | Coder / Waldy |
| D10 | ¿Qué mensaje/UX para saltos? | Aviso, no bloqueo, salvo que Contable exija consecutividad estricta. | Contable |
| D11 | ¿Notas y gastos también manuales? | Fase 2, con su propia migración y pruebas. | Waldy |

### 6.3 Fuera de alcance

- e-CF / comprobantes electrónicos (E31, E32, etc.) y su formato.
- «Sin NCF» y tipos distintos de 01/02/14/15/16 en facturas de venta.
- Creación de numeraciones desde la UI, edición de prefijo, sucursales.
- NCF manual en notas, gastos menores, facturas de proveedor o notas de crédito de compra.
- Unicidad global de NCF entre tablas.
- Reportes 606/607 y su conciliación; si existen, siguen leyendo `facturas.ncf` como hoy.
- Borrado o reescritura de facturas; la anulación es el camino.

### 6.4 Definición de “listo” para la implementación

- [ ] Migración aditiva aplicada en `prueba`, con `automatica`/`preferida` y `_ncf_factura`.
- [ ] `crear_factura` manual guarda el NCF y **no** incrementa `siguiente`.
- [ ] `crear_factura` automática sigue igual y los wrappers de impuestos/pago pasan sus pruebas.
- [ ] Vista previa distingue manual y automática; no reserva.
- [ ] UI de Numeraciones y factura con roles, mensajes y accesibilidad.
- [ ] pgTAP, Vitest y E2E en verde (E2E de emisión solo en base desechable).
- [ ] `docs/contrato-db.md` y `HANDOFF.md` actualizados.
- [ ] Waldy/Contable aprobaron las decisiones D1-D4 antes de producción.

---

## Apéndice A. Payloads de ejemplo

**Automática (hoy, sin cambios):**

```json
{
  "tipo_comprobante": "02",
  "contacto_id": "…",
  "fecha": "2026-11-17",
  "vencimiento": "2026-12-17",
  "lineas": [{ "producto_id": "…", "cantidad": 1, "precio": 100.0 }]
}
```

**Manual:**

```json
{
  "tipo_comprobante": "02",
  "contacto_id": "…",
  "fecha": "2026-11-17",
  "vencimiento": "2026-12-17",
  "ncf_manual": "B0200000042",
  "lineas": [{ "producto_id": "…", "cantidad": 1, "precio": 100.0 }]
}
```

**Automática con `ncf_manual`:** se rechaza con `22023` y no consume la serie.

## Apéndice B. Referencias revisadas

- `supabase/migrations/20261113140000_motor_contable.sql` — tabla `numeraciones`, `facturas`, RLS.
- `supabase/migrations/20261113210000_ncf_b14_b15_b16.sql` — semillas 14/15/16 y versión vieja de `crear_factura`.
- `supabase/migrations/20261115500000_funciones_fusionadas_s15.sql` — cuerpo vigente de `_crear_factura_sin_impuestos`.
- `supabase/migrations/20261115701000_motor_impuestos.sql` — wrapper de impuestos, renombre y `crear_factura`.
- `supabase/migrations/20261117300000_numeraciones_notas.sql` — `actualizar_numeracion` F16.
- `supabase/migrations/20261114101000_facturas_recurrentes.sql` — `generar_factura_recurrente`.
- `supabase/migrations/20261113230000_cotizaciones_remisiones.sql` y `20261115701000` — `convertir_a_factura`.
- `src/lib/facturacion/acciones.ts`, `src/lib/facturacion/validacion.ts`.
- `src/components/documento-venta/documento-venta-form.tsx`, `src/components/documento-venta/calculo.ts`.
- `src/lib/numeraciones/{preview,consultas,acciones,validacion,tipos}.ts`.
- `src/app/(main)/dashboard/contabilidad/numeraciones/_components/numeraciones-cliente.tsx`.
- `src/lib/supabase/types.ts`.
- `docs/alegra/ALEGRA.md:718-749` — numeraciones de Alegra («Numeración automática», «Preferida», «Número inicial», «Prefijo»).
- `docs/pruebas/ncf-unicidad.sql` — unicidad entre tablas.
- `HANDOFF.md:55-60` — estado de la migración F16.

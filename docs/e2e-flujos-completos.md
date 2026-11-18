# Tests E2E — Flujos completos de Medoxigas Contabilidad

> **Qué es esto:** Pruebas End-to-End (E2E) que simulan un usuario real usando el sistema de principio a fin. Un robot (Playwright) abre el navegador, hace clic, llena formularios y verifica que TODO funciona junto — no solo piezas aisladas.

> **Por qué importa:** Los 880 tests unitarios que ya existen prueban cada función por separado. Pero las piezas pueden funcionar bien individualmente y romperse al conectarse. Sin E2E, el primero en descubrir un bug eres TÚ cuando intentas facturarle a un cliente real.

> **Dónde viven:** `tests/e2e/` en el repo. Se corren con `pnpm test:e2e`. Sin `E2E_EMAIL` y `E2E_PASSWORD` configurados, se saltan automáticamente.

> **Stack:** Playwright + Chromium headless. Mismo patrón que `tests/e2e/smoke.spec.ts` y `tests/e2e/numeraciones.spec.ts` (ya existen como referencia).

---

## Reglas del repo que DEBES seguir

1. **No tocar `src/lib/**`**, `supabase/`, `.env*`, `package.json`, ni `src/components/ui/**`. Solo creas archivos en `tests/e2e/`.
2. **Sin `any`, sin `!`, sin `console.log`** (solo `console.error`/`console.warn`).
3. **Español** en todos los nombres de tests, selectores y mensajes.
4. **No inventes datos**: si un campo no existe, el test debe fallar con un mensaje claro.
5. **Los tests se saltan** sin `E2E_EMAIL`/`E2E_PASSWORD`: `test.skip(!email || !password, ...)`.
6. **Cada test es independiente**: no asumas que otro test corrió antes. Crea sus propios datos con nombres únicos (timestamp o contador).
7. **No uses `--no-verify`** ni desactives hooks.
8. **Verifica antes de terminar**: `pnpm exec tsc --noEmit` y `pnpm exec biome check` sobre tus archivos.

---

## Convenciones del repo

### Login (copiar de smoke.spec.ts)

```typescript
import { expect, type Page, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

async function entrar(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email ?? "");
  await page.getByLabel("Contraseña").fill(password ?? "");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}
```

### Base URL

Playwright ya está configurado con `E2E_BASE_URL` (default `http://localhost:3000`). En CI usa el build de producción.

### Nombres únicos para datos de prueba

```typescript
const SUFIJO = Date.now().toString(36); // único por corrida
const NOMBRE_CLIENTE = `E2E-Cliente-${SUFIJO}`;
const NOMBRE_PRODUCTO = `E2E-Producto-${SUFIJO}`;
```

### Detección de errores de consola

```typescript
function escucharErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on("pageerror", (error) => errores.push(String(error)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errores.push(msg.text());
  });
  return errores;
}
```

---

## TEST 1: Flujo de venta completo

**Archivo:** `tests/e2e/flujo-venta.spec.ts`

**Qué simula:** Waldy le vende a un cliente, cobra la factura y verifica que la contabilidad cuadra.

### Pasos del test

```
1. PREPARACIÓN
   a. Entrar al sistema
   b. Ir a /dashboard/contactos
   c. Crear un cliente nuevo: "E2E-Cliente-{sufijo}" con RNC "123456789", tipo "Cliente"
   d. Verificar que aparece en la lista

2. PRODUCTO
   a. Ir a /dashboard/productos
   b. Crear un producto nuevo: "E2E-Producto-{sufijo}", precio 1000, inventariable, cantidad 50
   c. Verificar que aparece en la lista

3. FACTURA
   a. Ir a /dashboard/facturacion
   b. Pulsar "Nueva factura"
   c. Seleccionar el cliente creado
   d. Agregar una línea: producto creado, cantidad 5, precio 1000
   e. Verificar que el subtotal es RD$ 5,000.00
   f. Verificar que el ITBIS (18%) es RD$ 900.00
   g. Verificar que el total es RD$ 5,900.00
   h. Verificar que aparece el NCF previsualizado (empieza con "B01")
   i. Pulsar "Guardar"
   j. Verificar que redirige a la vista de la factura
   k. Verificar que el estado es "Abierta" o similar
   l. Anotar el ID de la factura (de la URL)

4. PAGO
   a. Ir a /dashboard/pagos-recibidos
   b. Pulsar "Nuevo pago"
   c. Buscar la factura creada (por número o NCF)
   d. Verificar que el monto sugerido es RD$ 5,900.00
   e. Completar el pago por el total
   f. Pulsar "Guardar"
   g. Verificar que el pago se registró

5. VERIFICACIÓN DE SALDO
   a. Ir a /dashboard/facturacion
   b. Buscar la factura por su número o NCF
   c. Verificar que el estado cambió a "Pagada" o que "Por cobrar" es RD$ 0.00

6. VERIFICACIÓN DE INVENTARIO
   a. Ir a /dashboard/productos
   b. Buscar el producto creado
   c. Verificar que la existencia bajó de 50 a 45

7. VERIFICACIÓN CONTABLE
   a. Ir a /dashboard/contabilidad/asientos
   b. Buscar un asiento que mencione la factura (por NCF o descripción)
   c. Abrir el asiento
   d. Verificar que el total de débito = total de crédito = RD$ 5,900.00

8. VERIFICACIÓN FISCAL
   a. Ir a /dashboard/reportes/607
   b. Verificar que la factura aparece en la lista (por NCF)
   c. Verificar que el monto reportado es RD$ 5,900.00

9. LIMPIEZA (opcional, en un afterAll)
   a. NO borres los datos: la base de pruebas comparte datos con producción
   b. Los datos E2E-{sufijo} son identificables y se pueden limpiar después
```

### Selectores clave (verificar contra el código real)

- Cliente: `page.getByLabel("Nombre o Razón social")`, `page.getByLabel("RNC / Cédula")`
- Producto: `page.getByLabel("Nombre")`, `page.getByLabel("Precio")`
- Factura: `page.getByLabel("Cliente")` o selector de cliente, `page.getByRole("button", { name: "Guardar" })`
- Pago: buscar el diálogo/formulario de "Nuevo pago recibido"
- Asiento: la tabla de asientos con búsqueda
- 607: la tabla del reporte 607

### Assertion crítica

```typescript
// El asiento SIEMPRE debe cuadrar
const debito = await page.locator("[data-campo='debito-total']").textContent();
const credito = await page.locator("[data-campo='credito-total']").textContent();
expect(debito).toBe(credito); // débito = crédito, sin excepción
```

---

## TEST 2: Flujo de compra completo

**Archivo:** `tests/e2e/flujo-compra.spec.ts`

**Qué simula:** Waldy compra a un proveedor, le paga y verifica la contabilidad.

### Pasos del test

```
1. PREPARACIÓN
   a. Entrar al sistema
   b. Crear un proveedor: "E2E-Proveedor-{sufijo}" con RNC "987654321", tipo "Proveedor"

2. PRODUCTO (reutilizar el patrón del test de venta)
   a. Crear o usar un producto inventariable

3. FACTURA DE PROVEEDOR
   a. Ir a /dashboard/compras
   b. Pulsar "Nueva factura de proveedor"
   c. Seleccionar el proveedor creado
   d. Llenar el NCF del proveedor: "B0200000001" (formato válido de compra)
   e. Agregar una línea: producto, cantidad 10, costo 500
   f. Verificar que el total es RD$ 5,900.00 (10 × 500 + ITBIS 18%)
   g. Pulsar "Guardar"
   h. Verificar que la compra se registró con estado "Abierta"
   i. Anotar el ID de la compra

4. INVENTARIO
   a. Verificar que la existencia del producto SUBIÓ (compramos 10)

5. PAGO AL PROVEEDOR
   a. Ir a /dashboard/compras/pagos
   b. Pulsar "Nuevo pago"
   c. Buscar la compra creada (por número o NCF del proveedor)
   d. Pagar el total
   e. Verificar que el pago se registró

6. VERIFICACIÓN DE SALDO
   a. Verificar que la compra aparece como "Pagada" o con "Por pagar" = RD$ 0.00

7. VERIFICACIÓN CONTABLE
   a. Buscar el asiento de la compra
   b. Verificar que cuadra (débito = crédito)

8. VERIFICACIÓN FISCAL
   a. Ir a /dashboard/reportes/606
   b. Verificar que la compra aparece (por NCF del proveedor)
   c. Verificar que el monto es RD$ 5,900.00

9. NOTA DE CRÉDITO DE COMPRA (devolución)
   a. Ir a /dashboard/compras/notas-credito
   b. Crear una nota de crédito por 2 unidades del producto (devolver 2)
   c. Verificar que el inventario BAJÓ de 10 a 8
   d. Verificar que la nota aparece en el 606
```

### Assertion crítica

```typescript
// La compra DEBE subir el inventario
expect(existenciaAntes + 10).toBe(existenciaDespues);
// La nota de crédito DEBE bajar el inventario
expect(existenciaDespuesCompra - 2).toBe(existenciaDespuesNota);
```

---

## TEST 3: Flujo contable completo

**Archivo:** `tests/e2e/flujo-contable.spec.ts`

**Qué simula:** Waldy hace un asiento manual, genera un reporte y cierra un periodo.

### Pasos del test

```
1. ASIENTO MANUAL
   a. Ir a /dashboard/contabilidad/asientos
   b. Pulsar "Nuevo asiento" (o "Nueva entrada de diario")
   c. Llenar la fecha: hoy
   d. Llenar la descripción: "E2E-Asiento-{sufijo}"
   e. Agregar línea 1: cuenta "1101 Efectivo" (o la cuenta de caja), débito 1000
   f. Agregar línea 2: cuenta "4101 Ingresos" (o cualquier cuenta de ingreso), crédito 1000
   g. Verificar que el asiento cuadra (débito = crédito = 1000)
   h. Pulsar "Guardar"
   i. Verificar que aparece en la lista de asientos

2. ASIENTO DESCUADRADO (debe BLOQUEAR el guardado)
   a. Pulsar "Nuevo asiento"
   b. Agregar línea 1: débito 1000
   c. Agregar línea 2: crédito 500 (descuadrado)
   d. Verificar que el botón "Guardar" está deshabilitado o muestra error
   e. NO debe guardarse

3. REPORTE
   a. Ir a /dashboard/reportes/libro-diario
   b. Seleccionar el rango de fechas que incluye hoy
   c. Verificar que el asiento "E2E-Asiento-{sufijo}" aparece
   d. Verificar que el total del reporte incluye el asiento

4. CATÁLOGO DE CUENTAS
   a. Ir a /dashboard/contabilidad
   b. Verificar que el árbol de cuentas carga
   c. Buscar una cuenta por código
   d. Verificar que el panel lateral muestra información de la cuenta

5. CIERRE DE PERIODO (solo si el mes actual no está cerrado)
   a. Ir a /dashboard/contabilidad/periodos
   b. Verificar que el mes actual aparece
   c. Si está abierto, pulsar "Cerrar"
   d. Verificar que cambia a "Cerrado"
   e. Intentar crear un asiento en el mes cerrado → debe BLOQUEAR
   f. Reabrir el periodo (pulsar "Reabrir")
   g. Verificar que vuelve a "Abierto"
```

### Assertion crítica

```typescript
// El asiento descuadrado NUNCA debe guardarse
const botonGuardar = page.getByRole("button", { name: "Guardar" });
await expect(botonGuardar).toBeDisabled(); // o verificar el mensaje de error
```

---

## TEST 4: Flujo bancario completo

**Archivo:** `tests/e2e/flujo-banco.spec.ts`

**Qué simula:** Waldy transfiere entre cuentas y concilia.

### Pasos del test

```
1. CUENTAS
   a. Ir a /dashboard/bancos
   b. Verificar que hay al menos una cuenta listada
   c. Anotar el saldo de la cuenta principal

2. TRANSFERENCIA
   a. Pulsar "Transferir"
   b. Seleccionar origen: cuenta principal
   c. Seleccionar destino: otra cuenta (o crear una nueva "E2E-Banco-{sufijo}")
   d. Monto: 500
   e. Pulsar "Guardar"
   f. Verificar que el saldo de origen BAJÓ 500
   g. Verificar que el saldo de destino SUBIÓ 500

3. ASIENTO DE TRANSFERENCIA
   a. Ir a /dashboard/contabilidad/asientos
   b. Verificar que existe un asiento por la transferencia
   c. Verificar que cuadra

4. CONCILIACIÓN
   a. Ir a /dashboard/bancos/conciliaciones
   b. Pulsar "Nueva conciliación"
   c. Seleccionar la cuenta
   d. Llenar el saldo del extracto bancario
   e. Marcar algunos movimientos como conciliados
   f. Pulsar "Guardar"
   g. Verificar que la conciliación se creó

5. MOVIMIENTOS
   a. Ir al detalle de la cuenta (clic en ella)
   b. Verificar que la transferencia aparece como movimiento
   c. Verificar que el saldo es correcto
```

### Assertion crítica

```typescript
// El saldo de origen + destino debe ser el mismo que antes de la transferencia
const saldoTotalAntes = saldoOrigen + saldoDestino;
const saldoTotalDespues = saldoOrigenNuevo + saldoDestinoNuevo;
expect(saldoTotalDespues).toBe(saldoTotalAntes); // la transferencia no crea dinero
```

---

## TEST 5: Búsqueda global

**Archivo:** `tests/e2e/busqueda-global.spec.ts`

**Qué simula:** Waldy usa Ctrl+K para buscar y navegar a un resultado.

### Pasos del test

```
1. ABRIR
   a. Entrar al sistema
   b. Pulsar Ctrl+K (o Cmd+K en Mac)
   c. Verificar que la ventana flotante se abre
   d. Verificar que el input tiene foco

2. BUSCAR NAVEGACIÓN
   a. Escribir "facturas"
   b. Verificar que aparecen resultados de navegación (Facturas de venta)
   c. Pulsar Enter o clic en el resultado
   d. Verificar que navega a /dashboard/facturacion

3. BUSCAR CONTACTO
   a. Abrir Ctrl+K de nuevo
   b. Escribir el nombre de un contacto que existe (ej: "ZZTEST")
   c. Verificar que aparecen resultados de contactos
   d. Clic en un resultado
   e. Verificar que navega a /dashboard/contactos/{id}

4. BUSCAR NCF
   a. Abrir Ctrl+K
   b. Escribir un NCF que exista (ej: "B01")
   c. Verificar que aparecen resultados de facturas
   d. Clic en un resultado
   e. Verificar que navega a /dashboard/facturacion/{id}

5. CERRAR
   a. Abrir Ctrl+K
   b. Pulsar Escape
   c. Verificar que la ventana se cierra
   d. Pulsar Ctrl+K de nuevo
   e. Verificar que se abre de nuevo (toggle)

6. TECLADO
   a. Abrir Ctrl+K
   b. Escribir algo
   c. Pulsar ArrowDown → verificar que la primera tarjeta se resalta
   d. Pulsar Enter → verificar que navega
```

---

## TEST 6: Impresión de documentos

**Archivo:** `tests/e2e/impresion.spec.ts`

**Qué simula:** Waldy imprime una factura y verifica que el PDF es correcto.

### Pasos del test

```
1. FACTURA
   a. Ir a una factura existente (creada en el test de venta o buscar la más reciente)
   b. Pulsar "Imprimir" o el icono de impresión
   c. Verificar que se abre el diálogo de impresión del navegador (o una vista previa)
   d. Verificar que el contenido incluye: logo, nombre de la empresa, RNC, NCF, cliente, líneas, totales

2. COTIZACIÓN (si existe una)
   a. Buscar una cotización
   b. Imprimir
   c. Verificar el contenido

3. PAGO RECIBIDO (si existe el papel)
   a. Buscar un pago recibido
   b. Imprimir
   c. Verificar que incluye "Recibo de caja"
```

---

## Estructura de archivos

```
tests/e2e/
├── flujo-venta.spec.ts       ← Test 1: venta completa
├── flujo-compra.spec.ts      ← Test 2: compra completa
├── flujo-contable.spec.ts    ← Test 3: asientos, reportes, periodos
├── flujo-banco.spec.ts       ← Test 4: transferencias, conciliaciones
├── busqueda-global.spec.ts   ← Test 5: Ctrl+K, buscar, navegar
├── impresion.spec.ts         ← Test 6: PDF de documentos
├── smoke.spec.ts             ← ya existe (login, redirect)
├── numeraciones.spec.ts      ← ya existe (guardar B16)
├── listas.spec.ts            ← ya existe (búsqueda sin resultados)
└── tablas.spec.ts            ← ya existe (tabla unificada)
```

---

## Cómo correrlos

```bash
# Todos los E2E (requiere E2E_EMAIL y E2E_PASSWORD en .env.pruebas)
pnpm test:e2e

# Un solo archivo
pnpm exec playwright test tests/e2e/flujo-venta.spec.ts

# Con el servidor de desarrollo local
E2E_BASE_URL=http://localhost:3003 pnpm exec playwright test tests/e2e/flujo-venta.spec.ts

# Contra producción (Vercel)
E2E_BASE_URL=https://medoxigas-contabilidad.vercel.app pnpm exec playwright test tests/e2e/flujo-venta.spec.ts

# Con reporte visual (HTML)
pnpm exec playwright test --reporter=html
```

---

## Credenciales

Los tests usan las variables `E2E_EMAIL` y `E2E_PASSWORD` que apuntan a un usuario ZZTEST de la base de pruebas. **Nunca** uses credenciales reales de Waldy ni de producción en los tests.

```bash
# .env.pruebas (ya existe, NO commitear)
E2E_EMAIL=zztest1@medoxigas.test
E2E_PASSWORD=...
```

---

## Qué hacer si un test falla

1. **No lo silencies** con `.skip()` o `test.fixme()` sin explicar por qué
2. **Toma un screenshot** del estado de la pantalla en el momento del fallo
3. **Revisa la consola** del navegador en busca de errores de JavaScript
4. **Reporta el archivo, línea y mensaje de error** exacto
5. **Verifica si es un bug real** o un selector que cambió (ej: el botón cambió de "Guardar" a "Guardar factura")
6. **Si es un selector desactualizado**, actualízalo — no cambies el test para que pase si el sistema está roto

---

## Métrica de éxito

| Test | Criterio de aprobación |
|---|---|
| flujo-venta | Factura creada + pagada + asiento cuadra + inventario bajó + aparece en 607 |
| flujo-compra | Compra creada + pagada + inventario subió + asiento cuadra + aparece en 606 |
| flujo-contable | Asiento cuadrado se guarda, descuadrado se bloquea, reporte lo muestra, periodo se cierra/reabre |
| flujo-banco | Transferencia no crea dinero, saldos correctos, asiento cuadra |
| busqueda-global | Ctrl+K abre/cierra, busca navegación/contactos/facturas, navega a resultado |
| impresion | PDF incluye logo, empresa, NCF, líneas, totales |

Si los 6 tests pasan, el sistema está listo para operar el negocio real con confianza.

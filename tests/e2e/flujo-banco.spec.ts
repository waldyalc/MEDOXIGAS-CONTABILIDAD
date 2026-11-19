import { expect, type Locator, type Page, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

/** Las pantallas traen datos del servidor de pruebas: darles tiempo. */
const LENTO = 45_000;

async function entrar(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email ?? "");
  await page.getByLabel("Contraseña").fill(password ?? "");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/(dashboard|unauthorized)/, { timeout: LENTO });
  if (page.url().includes("/unauthorized")) {
    throw new Error("El usuario de E2E no tiene perfil en la base de pruebas; no puede transferir.");
  }
}

function escucharErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on("pageerror", (error) => errores.push(String(error)));
  page.on("console", (mensaje) => {
    // Base UI registra advertencias de desarrollo con console.error solo en el
    // dev server (no en el build de producción); no son errores del flujo.
    if (mensaje.type() === "error" && !mensaje.text().startsWith("Base UI:")) errores.push(mensaje.text());
  });
  return errores;
}

/** "RD$ 5,900.00" o "RD$5,900.00" → 5900. */
function pesos(texto: string): number {
  return Number(texto.replace(/[^0-9.,-]/g, "").replace(/,/g, ""));
}

/** Texto de una celda de la fila, localizada por el encabezado de su columna. */
async function textoCelda(page: Page, fila: Locator, encabezado: string): Promise<string> {
  const indice = await page
    .getByRole("columnheader")
    .evaluateAll(
      (cabeceras, titulo) => cabeceras.findIndex((cabecera) => (cabecera.textContent ?? "").trim() === titulo),
      encabezado,
    );
  if (indice < 0) {
    throw new Error(`No se encontró la columna "${encabezado}" en la tabla.`);
  }
  return ((await fila.getByRole("cell").nth(indice).textContent()) ?? "").trim();
}

/** Crea una cuenta de banco con saldo 2,000 y vuelve a la lista de bancos. */
async function crearCuenta(page: Page, nombre: string): Promise<void> {
  await page.getByRole("button", { name: "Agregar banco" }).click();
  const dialogo = page.getByRole("dialog", { name: "Agregar cuenta de banco o caja" });
  await expect(dialogo).toBeVisible();
  await dialogo.getByLabel(/^Nombre de la cuenta/).fill(nombre);
  await dialogo.getByLabel(/^Saldo inicial/).fill("2000");
  await dialogo.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(dialogo, "el diálogo de la cuenta no cerró tras crear").toBeHidden({ timeout: LENTO });
  await page.goto("/dashboard/bancos", { timeout: LENTO });
}

/** Elige una cuenta del select de la transferencia buscando por código. */
async function elegirCuenta(page: Page, idSelect: string, codigo: string): Promise<void> {
  await page.locator(`#${idSelect}`).click();
  await page.getByRole("option", { name: codigo }).first().click({ timeout: LENTO });
}

test.describe("flujo bancario", () => {
  test.skip(!email || !password, "falta E2E_EMAIL o E2E_PASSWORD");

  test("transferencia entre cuentas no crea ni destruye dinero", async ({ page }) => {
    test.setTimeout(180_000);
    const errores = escucharErrores(page);

    const sufijo = Date.now().toString(36);

    await entrar(page);

    // 1. Garantizar dos cuentas de caja o banco para poder transferir.
    await page.goto("/dashboard/bancos", { timeout: LENTO });
    const filasBancos = page.locator('[data-lista="bancos"] tbody tr');
    const sinCuentas = (await page.getByText("¡Aún no tienes cuentas de caja o banco!").count()) > 0;
    let cantidad = sinCuentas ? 0 : await filasBancos.count();
    if (cantidad < 2) {
      await crearCuenta(page, `E2E-Banco-A-${sufijo}`);
      cantidad += 1;
    }
    if (cantidad < 2) {
      await crearCuenta(page, `E2E-Banco-B-${sufijo}`);
    }

    // 2. Saldos antes de transferir.
    const filaOrigen = filasBancos.nth(0);
    const filaDestino = filasBancos.nth(1);
    const nombreOrigen = ((await filaOrigen.getByRole("link").first().textContent()) ?? "").trim();
    const codigoOrigen = ((await filaOrigen.getByRole("link").nth(1).textContent()) ?? "").trim();
    const nombreDestino = ((await filaDestino.getByRole("link").first().textContent()) ?? "").trim();
    const codigoDestino = ((await filaDestino.getByRole("link").nth(1).textContent()) ?? "").trim();
    const saldoOrigen = pesos(await textoCelda(page, filaOrigen, "Saldo"));
    const saldoDestino = pesos(await textoCelda(page, filaDestino, "Saldo"));

    // 3. Transferir 100 de la primera cuenta a la segunda.
    await page.getByRole("button", { name: "Transferir" }).first().click();
    const dialogoTransferencia = page.getByRole("dialog", { name: "Transferir entre cuentas" });
    await expect(dialogoTransferencia).toBeVisible();
    await elegirCuenta(page, "transferencia-origen", codigoOrigen);
    await elegirCuenta(page, "transferencia-destino", codigoDestino);
    await dialogoTransferencia.getByLabel(/^Monto/).fill("100");
    await dialogoTransferencia.getByRole("button", { name: "Transferir", exact: true }).click();
    await page.waitForURL(/\/dashboard\/bancos\/transferencias\/[0-9a-f-]{36}/, { timeout: LENTO });
    const urlTransferencia = page.url();

    // 4. El detalle muestra la transferencia de 100 y su asiento cuadrado.
    await expect(page.getByRole("heading", { name: /Transferencia #/ })).toBeVisible();
    const celdasTotales = page.getByRole("row").filter({ hasText: "Totales" }).getByRole("cell");
    expect(pesos((await celdasTotales.nth(1).textContent()) ?? ""), "débitos de la transferencia").toBe(100);
    expect(pesos((await celdasTotales.nth(2).textContent()) ?? ""), "créditos de la transferencia").toBe(100);

    // 5. El origen bajó 100, el destino subió 100 y la suma no cambió.
    await page.goto("/dashboard/bancos", { timeout: LENTO });
    const filaOrigenDespues = filasBancos.filter({ hasText: nombreOrigen }).first();
    const filaDestinoDespues = filasBancos.filter({ hasText: nombreDestino }).first();
    await expect(filaOrigenDespues).toBeVisible({ timeout: LENTO });
    await expect(filaDestinoDespues).toBeVisible({ timeout: LENTO });

    const saldoOrigenDespues = pesos(await textoCelda(page, filaOrigenDespues, "Saldo"));
    const saldoDestinoDespues = pesos(await textoCelda(page, filaDestinoDespues, "Saldo"));
    expect(saldoOrigenDespues, "el origen debe bajar 100").toBe(saldoOrigen - 100);
    expect(saldoDestinoDespues, "el destino debe subir 100").toBe(saldoDestino + 100);
    expect(saldoOrigenDespues + saldoDestinoDespues, "la transferencia no debe crear ni destruir dinero").toBe(
      saldoOrigen + saldoDestino,
    );

    // 6. La transferencia dejó asiento contable y cuadra.
    await page.goto(urlTransferencia, { timeout: LENTO });
    // El botón navega al asiento: la app lo renderiza como enlace.
    await page.getByRole("link", { name: "Ver asiento" }).click();
    await page.waitForURL(/\/dashboard\/contabilidad\/asientos\/[0-9a-f-]{36}/, { timeout: LENTO });
    await expect(page.getByRole("heading", { name: /Asiento contable #/ })).toBeVisible();
    await expect(page.getByText("Cuadrado ✓")).toBeVisible();

    expect(errores, "la consola del navegador registró errores durante el flujo").toEqual([]);
  });
});

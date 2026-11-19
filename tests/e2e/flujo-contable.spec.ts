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
    throw new Error("El usuario de E2E no tiene perfil en la base de pruebas; no puede crear asientos.");
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

/** Elige una cuenta del combobox de líneas del asiento buscando por código. */
async function elegirCuenta(page: Page, idLinea: string, codigo: string): Promise<void> {
  const entrada = page.locator(`#${idLinea}`);
  await entrada.click();
  await entrada.fill(codigo);
  await page.getByRole("option", { name: codigo }).first().click({ timeout: LENTO });
}

test.describe("flujo contable", () => {
  test.skip(!email || !password, "falta E2E_EMAIL o E2E_PASSWORD");

  test("asiento manual cuadrado se guarda y descuadrado se bloquea", async ({ page }) => {
    test.setTimeout(180_000);
    const errores = escucharErrores(page);

    const sufijo = Date.now().toString(36);
    const descripcion = `E2E-Asiento-${sufijo}`;
    const descripcionDescuadrado = `E2E-Asiento-D-${sufijo}`;

    await entrar(page);

    // 1. Asiento cuadrado: débito 1,000 en Caja general y crédito 1,000 en Ventas.
    await page.goto("/dashboard/contabilidad/asientos", { timeout: LENTO });
    // El botón "Nuevo asiento" navega: la app lo renderiza como enlace.
    await page.getByRole("link", { name: "Nuevo asiento" }).click();
    await page.waitForURL(/\/dashboard\/contabilidad\/asientos\/nuevo/, { timeout: LENTO });

    await page.getByLabel(/^Descripción/).fill(descripcion);
    await elegirCuenta(page, "cuenta-l1", "1101");
    await page.locator("#debito-l1").fill("1000");
    await elegirCuenta(page, "cuenta-l2", "4101");
    await page.locator("#credito-l2").fill("1000");

    await expect(page.getByText("RD$ 1,000.00", { exact: true }).first(), "total débitos").toBeVisible();
    await expect(page.getByText("RD$ 0.00", { exact: true }).first(), "diferencia en cero").toBeVisible();

    await page.getByRole("button", { name: "Guardar asiento", exact: true }).click();
    await page.waitForURL(/\/dashboard\/contabilidad\/asientos\/[0-9a-f-]{36}/, { timeout: LENTO });

    await expect(page.getByRole("heading", { name: /Asiento contable #/ })).toBeVisible();
    await expect(page.getByText("Cuadrado ✓")).toBeVisible();

    const celdasTotales = page.getByRole("row").filter({ hasText: "Totales" }).getByRole("cell");
    expect(pesos((await celdasTotales.nth(1).textContent()) ?? ""), "débitos del asiento").toBe(1000);
    expect(pesos((await celdasTotales.nth(2).textContent()) ?? ""), "créditos del asiento").toBe(1000);

    // 2. El asiento guardado aparece en la lista.
    await page.goto(`/dashboard/contabilidad/asientos?q=${encodeURIComponent(descripcion)}`, { timeout: LENTO });
    const filaAsiento = page.getByRole("row").filter({ hasText: descripcion });
    await expect(filaAsiento, "el asiento guardado no aparece en la lista").toBeVisible({ timeout: LENTO });
    expect(pesos(await textoCelda(page, filaAsiento, "Total")), "total del asiento en la lista").toBe(1000);

    // 3. Asiento descuadrado: débito 1,000 y crédito 500 no se puede guardar.
    await page.goto("/dashboard/contabilidad/asientos/nuevo", { timeout: LENTO });
    await page.getByLabel(/^Descripción/).fill(descripcionDescuadrado);
    await elegirCuenta(page, "cuenta-l1", "1101");
    await page.locator("#debito-l1").fill("1000");
    await elegirCuenta(page, "cuenta-l2", "4101");
    await page.locator("#credito-l2").fill("500");

    await expect(
      page.getByText("El asiento está descuadrado: los débitos y los créditos deben ser iguales para poder guardar."),
      "el aviso de descuadre debe verse",
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Guardar asiento", exact: true }),
      "guardar debe bloquearse",
    ).toBeDisabled();

    // 4. El asiento descuadrado no quedó guardado.
    await page.goto(`/dashboard/contabilidad/asientos?q=${encodeURIComponent(descripcionDescuadrado)}`, {
      timeout: LENTO,
    });
    await expect(page.getByText("Sin resultados"), "el asiento descuadrado no debió guardarse").toBeVisible({
      timeout: LENTO,
    });

    expect(errores, "la consola del navegador registró errores durante el flujo").toEqual([]);
  });
});

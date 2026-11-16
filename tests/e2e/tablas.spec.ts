import { expect, type Page, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

async function entrar(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email ?? "");
  await page.getByLabel("Contraseña").fill(password ?? "");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/dashboard/);
}

test.describe("tablas unificadas", () => {
  test.skip(!email || !password, "falta E2E_EMAIL o E2E_PASSWORD");

  test.beforeEach(async ({ page }) => {
    await entrar(page);
  });

  test("Facturas: toolbar, tabla y paginación viven en la misma tarjeta", async ({ page }) => {
    await page.goto("/dashboard/facturacion");
    const tarjeta = page.locator('[data-lista="facturas"]');

    await expect(tarjeta).toBeVisible();
    await expect(tarjeta.getByLabel("Buscar facturas")).toBeVisible();
    await expect(tarjeta.locator("table")).toBeVisible();
    await expect(tarjeta.getByText(/Página \d+ de \d+/)).toBeVisible();

    // Candado de «no inventar»: Facturas no tiene filtro real, así que no hay botón «Filtrar».
    await expect(tarjeta.getByRole("button", { name: "Filtrar" })).toHaveCount(0);
  });

  test("Facturas: cabecera de 40 px y filas de 48 px", async ({ page }) => {
    await page.goto("/dashboard/facturacion");
    const tarjeta = page.locator('[data-lista="facturas"]');
    const cabecera = tarjeta.locator("thead tr");

    await expect(cabecera).toBeVisible();
    const cajaCabecera = await cabecera.boundingBox();
    const altoCabecera = cajaCabecera?.height ?? 0;
    expect(altoCabecera).toBeGreaterThanOrEqual(39);
    expect(altoCabecera).toBeLessThanOrEqual(41);

    const filas = tarjeta.locator("tbody tr").filter({ has: page.locator("td a") });
    test.skip((await filas.count()) === 0, "la cuenta de prueba no tiene facturas para medir la fila");

    await expect(filas.first()).toBeVisible();
    const cajaFila = await filas.first().boundingBox();
    const altoFila = cajaFila?.height ?? 0;
    expect(altoFila).toBeGreaterThanOrEqual(47);
    expect(altoFila).toBeLessThanOrEqual(49);
  });

  test("Facturas: la búsqueda sin resultados muestra el vacío y conserva el pie", async ({ page }) => {
    await page.goto("/dashboard/facturacion?q=zzzznoexiste");
    const tarjeta = page.locator('[data-lista="facturas"]');

    await expect(tarjeta.getByText("Sin resultados", { exact: true })).toBeVisible();
    await expect(tarjeta.getByText(/Página \d+ de \d+/)).toBeVisible();
  });
});

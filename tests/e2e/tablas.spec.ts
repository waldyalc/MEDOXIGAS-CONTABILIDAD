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

  test("Facturas: cabecera de 48 px y filas de 56 px", async ({ page }) => {
    await page.goto("/dashboard/facturacion");
    const tarjeta = page.locator('[data-lista="facturas"]');
    // La tabla real vive dentro de <Suspense>: durante el streaming conviven el
    // esqueleto y TablaFacturas. Filtra por el encabezado real para medir siempre
    // la TablaLista (nunca la cabecera del esqueleto) y para no resolver 2 filas.
    const cabecera = tarjeta.locator("thead tr").filter({ hasText: "Número de factura" });

    await expect(cabecera).toBeVisible();
    const cajaCabecera = await cabecera.boundingBox();
    const altoCabecera = cajaCabecera?.height ?? 0;
    expect(altoCabecera).toBeGreaterThanOrEqual(47);
    expect(altoCabecera).toBeLessThanOrEqual(49);

    const filas = tarjeta.locator("tbody tr").filter({ has: page.locator("td a") });
    test.skip((await filas.count()) === 0, "la cuenta de prueba no tiene facturas para medir la fila");

    await expect(filas.first()).toBeVisible();
    const cajaFila = await filas.first().boundingBox();
    const altoFila = cajaFila?.height ?? 0;
    expect(altoFila).toBeGreaterThanOrEqual(55);
    expect(altoFila).toBeLessThanOrEqual(57);
  });

  test("Facturas: la tarjeta se centra y no pasa de 1289 px a 1920", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/dashboard/facturacion");
    const tarjeta = page.locator('[data-lista="facturas"]');
    await expect(tarjeta).toBeVisible();

    const medidas = await tarjeta.evaluate((nodo) => {
      const contenedor = nodo.parentElement;
      const area = contenedor?.parentElement;
      if (!contenedor || !area) return null;

      const tarjetaRect = nodo.getBoundingClientRect();
      const contenedorRect = contenedor.getBoundingClientRect();
      const areaRect = area.getBoundingClientRect();
      const estilo = getComputedStyle(area);
      return {
        ancho: tarjetaRect.width,
        izquierda: contenedorRect.left - areaRect.left - Number.parseFloat(estilo.paddingLeft),
        derecha: areaRect.right - contenedorRect.right - Number.parseFloat(estilo.paddingRight),
      };
    });

    expect(medidas).not.toBeNull();
    expect(medidas?.ancho ?? 0).toBeGreaterThan(0);
    expect(medidas?.ancho ?? 0).toBeLessThanOrEqual(1290);
    expect(Math.abs((medidas?.izquierda ?? 0) - (medidas?.derecha ?? 0))).toBeLessThanOrEqual(2);
  });

  test("Facturas: click en una celda sin link de la fila navega a la ficha", async ({ page }) => {
    // Regresión: la fila lleva role="link" y closest() la encontraba como
    // «interactivo», así que el click nunca navegaba fuera de los links.
    await page.goto("/dashboard/facturacion");
    const tarjeta = page.locator('[data-lista="facturas"]');
    const fila = tarjeta.locator('tbody tr[role="link"]');
    test.skip((await fila.count()) === 0, "la cuenta de prueba no tiene facturas");

    const destino = await fila.first().getAttribute("data-href");
    expect(destino).toBeTruthy();

    // Una celda plana (Tipo, Fecha…): el click lo toma la fila, no un control.
    await fila.first().locator("td:not(:has(a)):not(:has(button))").first().click();
    await expect(page).toHaveURL(destino ?? "");
  });

  test("Facturas: la búsqueda sin resultados muestra el vacío y conserva el pie", async ({ page }) => {
    await page.goto("/dashboard/facturacion?q=zzzznoexiste");
    const tarjeta = page.locator('[data-lista="facturas"]');

    await expect(tarjeta.getByText("Sin resultados", { exact: true })).toBeVisible();
    await expect(tarjeta.getByText(/Página \d+ de \d+/)).toBeVisible();
  });
});

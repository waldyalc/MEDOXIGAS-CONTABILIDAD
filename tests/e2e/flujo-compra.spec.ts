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
    throw new Error("El usuario de E2E no tiene perfil en la base de pruebas; no puede crear documentos.");
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

/** Valor en RD$ que acompaña a una etiqueta única del bloque de totales. */
async function valorJuntoA(page: Page, etiqueta: string): Promise<number> {
  const bloque = page.getByText(etiqueta, { exact: true }).first().locator("..").locator("span");
  return pesos((await bloque.nth(1).textContent()) ?? "");
}

test.describe("flujo de compra", () => {
  test.skip(!email || !password, "falta E2E_EMAIL o E2E_PASSWORD");

  test("crear proveedor, compra, pagar y verificar inventario", async ({ page }) => {
    test.setTimeout(300_000);
    const errores = escucharErrores(page);

    const sufijo = Date.now().toString(36);
    const proveedor = `E2E-Pr-${sufijo}`;
    const producto = `E2E-PC-${sufijo}`;
    // NCF de proveedor único por corrida: la tabla exige ncf unique.
    const ncf = `B02${(Date.now() % 100_000_000).toString().padStart(8, "0")}`;

    await entrar(page);

    // 1. Proveedor nuevo con RNC.
    await page.goto("/dashboard/contactos", { timeout: LENTO });
    await page.getByRole("button", { name: "Nuevo contacto" }).first().click();
    const dialogoContacto = page.getByRole("dialog", { name: "Nuevo contacto" });
    await expect(dialogoContacto).toBeVisible();
    await dialogoContacto.getByLabel(/^Nombre/).fill(proveedor);
    await dialogoContacto.getByLabel("Tipo").click();
    await page.getByRole("option", { name: "Proveedor", exact: true }).click();
    await dialogoContacto.getByLabel("RNC / Cédula").fill("987654321");
    await dialogoContacto.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(dialogoContacto, "el diálogo del proveedor no cerró tras guardar").toBeHidden({ timeout: LENTO });

    await page.goto(`/dashboard/contactos?q=${encodeURIComponent(proveedor)}`, { timeout: LENTO });
    await expect(
      page.getByRole("row").filter({ hasText: proveedor }),
      "el proveedor no aparece en la lista",
    ).toBeVisible({ timeout: LENTO });

    // 2. Producto inventariable: precio 500, costo 500, existencia inicial 0.
    await page.goto("/dashboard/productos", { timeout: LENTO });
    await page.getByRole("button", { name: "Nuevo producto" }).first().click();
    const dialogoProducto = page.getByRole("dialog", { name: "Nuevo producto" });
    await expect(dialogoProducto).toBeVisible();
    await dialogoProducto.getByLabel(/^Nombre/).fill(producto);
    await dialogoProducto.getByLabel(/^Precio/).fill("500");
    await dialogoProducto.getByRole("switch", { name: "Controlar inventario" }).click();
    await dialogoProducto.getByLabel("Cantidad inicial").fill("0");
    await dialogoProducto.getByLabel("Costo", { exact: true }).fill("500");
    await dialogoProducto.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(dialogoProducto, "el diálogo del producto no cerró tras guardar").toBeHidden({ timeout: LENTO });

    await page.goto(`/dashboard/productos?q=${encodeURIComponent(producto)}`, { timeout: LENTO });
    const filaProductoAntes = page.getByRole("row").filter({ hasText: producto });
    await expect(filaProductoAntes, "el producto no aparece en la lista").toBeVisible({ timeout: LENTO });
    expect(await textoCelda(page, filaProductoAntes, "ITBIS"), "el producto debe traer ITBIS 18 %").toBe("18 %");

    // 3. Factura de proveedor: 10 × 500 con ITBIS 18 %.
    await page.goto("/dashboard/compras", { timeout: LENTO });
    // El botón navega: la app lo renderiza como enlace.
    await page.getByRole("link", { name: "Nueva factura de proveedor" }).first().click();
    await page.waitForURL(/\/dashboard\/compras\/nueva/, { timeout: LENTO });

    await page.getByLabel("No. / NCF del proveedor (opcional)").fill(ncf);

    const comboProveedor = page.getByPlaceholder("Buscar proveedor…");
    await comboProveedor.click();
    await comboProveedor.fill(proveedor);
    await page.getByRole("option", { name: proveedor }).first().click({ timeout: LENTO });

    const comboProducto = page.getByLabel("Producto de la línea 1");
    await comboProducto.click();
    await comboProducto.fill(producto);
    await page.getByRole("option", { name: producto }).first().click({ timeout: LENTO });

    await page.getByLabel("Cantidad de la línea 1").fill("10");
    await page.getByLabel("Costo de la línea 1").fill("500");

    await expect(page.getByText("RD$ 5,000.00", { exact: true }).first(), "subtotal 10 × 500").toBeVisible();
    await expect(page.getByText("RD$ 900.00", { exact: true }).first(), "ITBIS 18 % de 5,000").toBeVisible();
    await expect(page.getByText("RD$ 5,900.00", { exact: true }).first(), "total con ITBIS").toBeVisible();

    await page.getByRole("button", { name: "Guardar factura", exact: true }).click();
    await page.waitForURL(/\/dashboard\/compras\/[0-9a-f-]{36}/, { timeout: LENTO });

    // 4. La compra sube la existencia de 0 a 10.
    await page.goto(`/dashboard/productos?q=${encodeURIComponent(producto)}`, { timeout: LENTO });
    const filaProductoDespues = page.getByRole("row").filter({ hasText: producto });
    await expect(filaProductoDespues).toBeVisible({ timeout: LENTO });
    expect(pesos(await textoCelda(page, filaProductoDespues, "Existencia")), "existencia tras comprar 10").toBe(10);

    // 5. Pago a proveedor por el total.
    await page.goto("/dashboard/compras/pagos", { timeout: LENTO });
    // El botón navega: la app lo renderiza como enlace.
    await page.getByRole("link", { name: "Nuevo pago" }).first().click();
    await page.waitForURL(/\/dashboard\/compras\/pagos\/nuevo/, { timeout: LENTO });

    const comboProveedorPago = page.getByPlaceholder("Buscar proveedor…");
    await comboProveedorPago.click();
    await comboProveedorPago.fill(proveedor);
    await page.getByRole("option", { name: proveedor }).first().click({ timeout: LENTO });

    const filaCompraPago = page.getByRole("row").filter({ hasText: ncf });
    await expect(filaCompraPago, "la compra creada no aparece por pagar").toBeVisible({ timeout: LENTO });
    expect(pesos(await textoCelda(page, filaCompraPago, "Por pagar")), "saldo pendiente de la compra").toBe(5900);

    await filaCompraPago.getByLabel(/Monto de la factura/).fill("5900");
    await expect.poll(async () => valorJuntoA(page, "Total pagado"), { timeout: 10_000 }).toBe(5900);

    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page.waitForURL(/\/dashboard\/compras\/pagos\/[0-9a-f-]{36}/, { timeout: LENTO });

    // 6. La compra queda pagada, con Por pagar en cero.
    await page.goto(`/dashboard/compras?q=${encodeURIComponent(ncf)}`, { timeout: LENTO });
    const filaCompra = page.getByRole("row").filter({ hasText: ncf });
    await expect(filaCompra).toBeVisible({ timeout: LENTO });
    expect(pesos(await textoCelda(page, filaCompra, "Por pagar")), "por pagar tras el pago").toBe(0);
    expect(await textoCelda(page, filaCompra, "Estado"), "la compra pagada debe quedar Pagada").toContain("Pagada");

    // 7. La compra con NCF aparece en el reporte 606 del mes.
    await page.goto("/dashboard/reportes/606", { timeout: LENTO });
    await expect(page.getByText(ncf).first(), "la compra no aparece en el 606").toBeVisible({ timeout: LENTO });

    expect(errores, "la consola del navegador registró errores durante el flujo").toEqual([]);
  });
});

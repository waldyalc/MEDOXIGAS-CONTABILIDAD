import { expect, test } from "@playwright/test";

import {
  elegirEnCombo,
  elegirEnSelect,
  email,
  entrar,
  escucharErrores,
  filaDeLista,
  LENTO,
  password,
  pesos,
  textoCelda,
  valorJuntoA,
} from "./ayudantes";

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

    await entrar(page, "El usuario de E2E no tiene perfil en la base de pruebas; no puede crear documentos.");

    // 1. Proveedor nuevo con RNC.
    await page.goto("/dashboard/contactos", { timeout: LENTO });
    await page.getByRole("button", { name: "Nuevo contacto" }).first().click();
    const dialogoContacto = page.getByRole("dialog", { name: "Nuevo contacto" });
    await expect(dialogoContacto).toBeVisible();
    await dialogoContacto.getByLabel(/^Nombre/).fill(proveedor);
    await elegirEnSelect(page, dialogoContacto.getByLabel("Tipo"), "Proveedor");
    await dialogoContacto.getByLabel("RNC / Cédula").fill("987654321");
    await dialogoContacto.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(dialogoContacto, "el diálogo del proveedor no cerró tras guardar").toBeHidden({ timeout: LENTO });

    await page.goto(`/dashboard/contactos?q=${encodeURIComponent(proveedor)}`, { timeout: LENTO });
    await expect(filaDeLista(page, proveedor), "el proveedor no aparece en la lista").toBeVisible({
      timeout: LENTO,
    });

    // 2. Producto inventariable: precio 500, costo 500, existencia inicial 0.
    //    El alta es una página completa (el diálogo "Nuevo producto" ya no existe).
    await page.goto("/dashboard/productos", { timeout: LENTO });
    await page.getByRole("button", { name: "Nuevo producto" }).first().click();
    await page.waitForURL(/\/dashboard\/productos\/nuevo/, { timeout: LENTO });

    await page.getByLabel("Nombre").fill(producto);
    await page.getByLabel("Precio base").fill("500");
    // El impuesto por defecto es "Ninguno": hay que elegir ITBIS 18 %.
    await elegirEnSelect(page, page.locator("#impuesto_id"), /\(18\.00%\)/);
    // El alta nace inventariable: el switch solo se prende si llegara apagado.
    const switchInventariable = page.getByRole("switch", { name: "Producto inventariable" });
    if ((await switchInventariable.getAttribute("aria-checked")) !== "true") {
      await switchInventariable.click();
    }
    await page.getByLabel("Cantidad inicial").fill("0");
    await page.getByLabel("Costo por unidad").fill("500");
    await page.getByRole("button", { name: "Guardar", exact: true }).first().click();
    await page.waitForURL(/\/dashboard\/productos\/[0-9a-f-]{36}/, { timeout: LENTO });

    await page.goto(`/dashboard/productos?q=${encodeURIComponent(producto)}`, { timeout: LENTO });
    const filaProductoAntes = filaDeLista(page, producto);
    await expect(filaProductoAntes, "el producto no aparece en la lista").toBeVisible({ timeout: LENTO });
    expect(await textoCelda(page, filaProductoAntes, "ITBIS"), "el producto debe traer ITBIS 18 %").toBe("18 %");

    // 3. Factura de proveedor: 10 × 500 con ITBIS 18 %.
    await page.goto("/dashboard/compras", { timeout: LENTO });
    // El botón navega: la app lo renderiza como enlace.
    await page.getByRole("link", { name: "Nueva factura de proveedor" }).first().click();
    await page.waitForURL(/\/dashboard\/compras\/nueva/, { timeout: LENTO });

    await page.getByLabel("No. / NCF del proveedor (opcional)").fill(ncf);

    await elegirEnCombo(page, page.getByPlaceholder("Buscar proveedor…"), proveedor);
    await elegirEnCombo(page, page.getByLabel("Producto de la línea 1"), producto);

    await page.getByLabel("Cantidad de la línea 1").fill("10");
    await page.getByLabel("Costo de la línea 1").fill("500");

    await expect(page.getByText("RD$ 5,000.00", { exact: true }).first(), "subtotal 10 × 500").toBeVisible();
    await expect(page.getByText("RD$ 900.00", { exact: true }).first(), "ITBIS 18 % de 5,000").toBeVisible();
    await expect(page.getByText("RD$ 5,900.00", { exact: true }).first(), "total con ITBIS").toBeVisible();

    await page.getByRole("button", { name: "Guardar factura", exact: true }).click();
    await page.waitForURL(/\/dashboard\/compras\/[0-9a-f-]{36}/, { timeout: LENTO });

    // 4. La compra sube la existencia de 0 a 10.
    await page.goto(`/dashboard/productos?q=${encodeURIComponent(producto)}`, { timeout: LENTO });
    const filaProductoDespues = filaDeLista(page, producto);
    await expect(filaProductoDespues).toBeVisible({ timeout: LENTO });
    expect(pesos(await textoCelda(page, filaProductoDespues, "Existencia")), "existencia tras comprar 10").toBe(10);

    // 5. Pago a proveedor por el total.
    await page.goto("/dashboard/compras/pagos", { timeout: LENTO });
    // El botón navega: la app lo renderiza como enlace.
    await page.getByRole("link", { name: "Nuevo pago" }).first().click();
    await page.waitForURL(/\/dashboard\/compras\/pagos\/nuevo/, { timeout: LENTO });

    await elegirEnCombo(page, page.getByPlaceholder("Buscar proveedor…"), proveedor);

    const filaCompraPago = filaDeLista(page, ncf);
    await expect(filaCompraPago, "la compra creada no aparece por pagar").toBeVisible({ timeout: LENTO });
    // La tabla de facturas pendientes del pago usa "Por cobrar" (componente
    // compartido con pagos recibidos); la lista de compras sí dice "Por pagar".
    expect(pesos(await textoCelda(page, filaCompraPago, "Por cobrar")), "saldo pendiente de la compra").toBe(5900);

    await filaCompraPago.getByLabel(/Monto de la factura/).fill("5900");
    await expect.poll(async () => valorJuntoA(page, "Total pagado"), { timeout: 10_000 }).toBe(5900);

    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page.waitForURL(/\/dashboard\/compras\/pagos\/[0-9a-f-]{36}/, { timeout: LENTO });

    // 6. La compra queda pagada, con Por pagar en cero.
    await page.goto(`/dashboard/compras?q=${encodeURIComponent(ncf)}`, { timeout: LENTO });
    const filaCompra = filaDeLista(page, ncf);
    await expect(filaCompra).toBeVisible({ timeout: LENTO });
    expect(pesos(await textoCelda(page, filaCompra, "Por pagar")), "por pagar tras el pago").toBe(0);
    expect(await textoCelda(page, filaCompra, "Estado"), "la compra pagada debe quedar Pagada").toContain("Pagada");

    // 7. La compra con NCF aparece en el reporte 606 del mes.
    await page.goto("/dashboard/reportes/606", { timeout: LENTO });
    await expect(page.getByText(ncf).first(), "la compra no aparece en el 606").toBeVisible({ timeout: LENTO });

    expect(errores, "la consola del navegador registró errores durante el flujo").toEqual([]);
  });
});

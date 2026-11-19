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

test.describe("flujo de venta", () => {
  test.skip(!email || !password, "falta E2E_EMAIL o E2E_PASSWORD");

  test("crear cliente, producto, factura, pagar y verificar que cuadra", async ({ page }) => {
    test.setTimeout(300_000);
    const errores = escucharErrores(page);

    const sufijo = Date.now().toString(36);
    const cliente = `E2E-V-${sufijo}`;
    const producto = `E2E-P-${sufijo}`;

    await entrar(page, "El usuario de E2E no tiene perfil en la base de pruebas; no puede crear documentos.");

    // 1. Cliente nuevo con RNC, tipo Cliente (el tipo por defecto del diálogo).
    await page.goto("/dashboard/contactos", { timeout: LENTO });
    await page.getByRole("button", { name: "Nuevo contacto" }).first().click();
    const dialogoContacto = page.getByRole("dialog", { name: "Nuevo contacto" });
    await expect(dialogoContacto).toBeVisible();
    await dialogoContacto.getByLabel(/^Nombre/).fill(cliente);
    await dialogoContacto.getByLabel("RNC / Cédula").fill("123456789");
    await dialogoContacto.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(dialogoContacto, "el diálogo del cliente no cerró tras guardar").toBeHidden({ timeout: LENTO });

    await page.goto(`/dashboard/contactos?q=${encodeURIComponent(cliente)}`, { timeout: LENTO });
    await expect(filaDeLista(page, cliente), "el cliente no aparece en la lista").toBeVisible({
      timeout: LENTO,
    });

    // 2. Producto inventariable: precio 1000, costo 500, existencia inicial 50.
    //    El alta es una página completa (el diálogo "Nuevo producto" ya no existe).
    await page.goto("/dashboard/productos", { timeout: LENTO });
    await page.getByRole("button", { name: "Nuevo producto" }).first().click();
    await page.waitForURL(/\/dashboard\/productos\/nuevo/, { timeout: LENTO });

    await page.getByLabel("Nombre").fill(producto);
    await page.getByLabel("Precio base").fill("1000");
    // El impuesto por defecto es "Ninguno": hay que elegir ITBIS 18 %.
    await elegirEnSelect(page, page.locator("#impuesto_id"), /\(18\.00%\)/);
    // El alta nace inventariable: el switch solo se prende si llegara apagado.
    const switchInventariable = page.getByRole("switch", { name: "Producto inventariable" });
    if ((await switchInventariable.getAttribute("aria-checked")) !== "true") {
      await switchInventariable.click();
    }
    await page.getByLabel("Cantidad inicial").fill("50");
    await page.getByLabel("Costo por unidad").fill("500");
    await page.getByRole("button", { name: "Guardar", exact: true }).first().click();
    await page.waitForURL(/\/dashboard\/productos\/[0-9a-f-]{36}/, { timeout: LENTO });

    await page.goto(`/dashboard/productos?q=${encodeURIComponent(producto)}`, { timeout: LENTO });
    const filaProducto = filaDeLista(page, producto);
    await expect(filaProducto, "el producto no aparece en la lista").toBeVisible({ timeout: LENTO });
    expect(await textoCelda(page, filaProducto, "ITBIS"), "el producto debe traer ITBIS 18 %").toBe("18 %");

    // 3. Factura del cliente por 5 × 1000 con ITBIS 18 %.
    await page.goto("/dashboard/facturacion/nueva", { timeout: LENTO });
    await elegirEnCombo(page, page.getByPlaceholder("Buscar cliente…"), cliente);
    await elegirEnCombo(page, page.getByLabel("Producto de la línea 1"), producto);

    await page.getByLabel("Cantidad de la línea 1").fill("5");

    await expect(page.getByText("RD$ 5,000.00", { exact: true }).first(), "subtotal 5 × 1000").toBeVisible();
    await expect(page.getByText("RD$ 900.00", { exact: true }).first(), "ITBIS 18 % de 5,000").toBeVisible();
    await expect(page.getByText("RD$ 5,900.00", { exact: true }).first(), "total con ITBIS").toBeVisible();

    await page.getByRole("button", { name: "Guardar factura", exact: true }).click();
    await page.waitForURL(/\/dashboard\/facturacion\/[0-9a-f-]{36}/, { timeout: LENTO });

    // El NCF de la factura sirve para buscarla en pagos, asientos y la lista.
    const textoNcf = await page
      .getByText(/^No\. NCF B\d+/)
      .first()
      .textContent();
    const ncf = /B\d{10}/.exec(textoNcf ?? "")?.[0];
    if (ncf === undefined) {
      throw new Error("No se pudo leer el NCF de la factura guardada.");
    }

    // 4. Pago recibido por el total.
    await page.goto("/dashboard/pagos-recibidos/nuevo", { timeout: LENTO });
    await elegirEnCombo(page, page.getByPlaceholder("Buscar cliente…"), cliente);

    const filaFacturaPago = filaDeLista(page, ncf);
    await expect(filaFacturaPago, "la factura creada no aparece por cobrar").toBeVisible({ timeout: LENTO });
    expect(pesos(await textoCelda(page, filaFacturaPago, "Por cobrar")), "saldo pendiente de la factura").toBe(5900);

    await filaFacturaPago.getByLabel(/Monto de la factura/).fill("5900");
    await expect.poll(async () => valorJuntoA(page, "Total recibido"), { timeout: 10_000 }).toBe(5900);

    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page.waitForURL(/\/dashboard\/pagos-recibidos\/[0-9a-f-]{36}/, { timeout: LENTO });
    await expect(page.getByRole("heading", { name: /Pago recibido #/ })).toBeVisible();

    // 5. La factura queda cobrada, con Por cobrar en cero.
    await page.goto(`/dashboard/facturacion?q=${encodeURIComponent(ncf)}`, { timeout: LENTO });
    const filaFactura = filaDeLista(page, ncf);
    await expect(filaFactura).toBeVisible({ timeout: LENTO });
    expect(pesos(await textoCelda(page, filaFactura, "Por cobrar")), "por cobrar tras el pago").toBe(0);
    expect(await textoCelda(page, filaFactura, "Estado"), "la factura pagada debe quedar Cobrada").toContain("Cobrada");

    // 6. La venta baja la existencia de 50 a 45.
    await page.goto(`/dashboard/productos?q=${encodeURIComponent(producto)}`, { timeout: LENTO });
    const filaProductoDespues = filaDeLista(page, producto);
    await expect(filaProductoDespues).toBeVisible({ timeout: LENTO });
    expect(pesos(await textoCelda(page, filaProductoDespues, "Existencia")), "existencia tras vender 5").toBe(45);

    // 7. El asiento de la factura cuadra: 5,900 de la venta más 2,500 del costo
    //    de los 5 productos (Dr 5101 / Cr 1104), con débito = crédito = 8,400.
    await page.goto(`/dashboard/contabilidad/asientos?q=${encodeURIComponent(ncf)}`, { timeout: LENTO });
    const filaAsiento = filaDeLista(page, ncf);
    await expect(filaAsiento, "no apareció el asiento de la factura").toBeVisible({ timeout: LENTO });
    expect(pesos(await textoCelda(page, filaAsiento, "Total")), "total del asiento").toBe(8400);

    await filaAsiento.getByRole("link").first().click();
    await page.waitForURL(/\/dashboard\/contabilidad\/asientos\/[0-9a-f-]{36}/, { timeout: LENTO });
    await expect(page.getByText("Cuadrado ✓")).toBeVisible();

    const celdasTotales = page.getByRole("row").filter({ hasText: "Totales" }).getByRole("cell");
    expect(pesos((await celdasTotales.nth(1).textContent()) ?? ""), "débitos del asiento").toBe(8400);
    expect(pesos((await celdasTotales.nth(2).textContent()) ?? ""), "créditos del asiento").toBe(8400);

    expect(errores, "la consola del navegador registró errores durante el flujo").toEqual([]);
  });
});

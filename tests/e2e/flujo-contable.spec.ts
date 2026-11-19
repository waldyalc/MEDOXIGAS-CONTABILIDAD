import { expect, test } from "@playwright/test";

import {
  elegirEnCombo,
  email,
  entrar,
  escucharErrores,
  filaDeLista,
  LENTO,
  password,
  pesos,
  textoCelda,
} from "./ayudantes";

test.describe("flujo contable", () => {
  test.skip(!email || !password, "falta E2E_EMAIL o E2E_PASSWORD");

  test("asiento manual cuadrado se guarda y descuadrado se bloquea", async ({ page }) => {
    test.setTimeout(180_000);
    const errores = escucharErrores(page);

    const sufijo = Date.now().toString(36);
    const descripcion = `E2E-Asiento-${sufijo}`;
    const descripcionDescuadrado = `E2E-Asiento-D-${sufijo}`;

    await entrar(page, "El usuario de E2E no tiene perfil en la base de pruebas; no puede crear asientos.");

    // 1. Asiento cuadrado: débito 1,000 en Caja general y crédito 1,000 en Ventas.
    await page.goto("/dashboard/contabilidad/asientos", { timeout: LENTO });
    // El botón "Nuevo asiento" navega: la app lo renderiza como enlace.
    await page.getByRole("link", { name: "Nuevo asiento" }).click();
    await page.waitForURL(/\/dashboard\/contabilidad\/asientos\/nuevo/, { timeout: LENTO });

    await page.getByLabel(/^Descripción/).fill(descripcion);
    await elegirEnCombo(page, page.locator("#cuenta-l1"), "1101");
    await page.locator("#debito-l1").fill("1000");
    await elegirEnCombo(page, page.locator("#cuenta-l2"), "4101");
    await page.locator("#credito-l2").fill("1000");

    await expect(page.getByText("RD$ 1,000.00", { exact: true }).first(), "total débitos").toBeVisible();
    await expect(page.getByText("RD$ 0.00", { exact: true }).first(), "diferencia en cero").toBeVisible();

    await page.getByRole("button", { name: "Guardar asiento", exact: true }).click();
    await page.waitForURL(/\/dashboard\/contabilidad\/asientos\/[0-9a-f-]{36}/, { timeout: LENTO });

    // El detalle titula "Asiento contable <código>" (AC-1) o "#<número>" sin código.
    await expect(page.getByRole("heading", { name: /Asiento contable/ })).toBeVisible();
    await expect(page.getByText("Cuadrado ✓")).toBeVisible();

    const celdasTotales = page.getByRole("row").filter({ hasText: "Totales" }).getByRole("cell");
    expect(pesos((await celdasTotales.nth(1).textContent()) ?? ""), "débitos del asiento").toBe(1000);
    expect(pesos((await celdasTotales.nth(2).textContent()) ?? ""), "créditos del asiento").toBe(1000);

    // 2. El asiento guardado aparece en la lista.
    await page.goto(`/dashboard/contabilidad/asientos?q=${encodeURIComponent(descripcion)}`, { timeout: LENTO });
    const filaAsiento = filaDeLista(page, descripcion);
    await expect(filaAsiento, "el asiento guardado no aparece en la lista").toBeVisible({ timeout: LENTO });
    expect(pesos(await textoCelda(page, filaAsiento, "Total")), "total del asiento en la lista").toBe(1000);

    // 3. Asiento descuadrado: débito 1,000 y crédito 500 no se puede guardar.
    await page.goto("/dashboard/contabilidad/asientos/nuevo", { timeout: LENTO });
    await page.getByLabel(/^Descripción/).fill(descripcionDescuadrado);
    await elegirEnCombo(page, page.locator("#cuenta-l1"), "1101");
    await page.locator("#debito-l1").fill("1000");
    await elegirEnCombo(page, page.locator("#cuenta-l2"), "4101");
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

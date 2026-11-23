import { expect, test } from "@playwright/test";

import { LENTO } from "./ayudantes";
import { existsSync } from "node:fs";

/**
 * Candado de comportamiento de MSG-34: el ⋯ abre el panel «Más opciones»
 * encima de todo el carrito, con los tres cuadros; la X y Esc vuelven al
 * carrito sin tocar la venta.
 *
 * La sesión ZZTEST vive fuera del repo. Sin ella, la prueba se salta (el
 * candado de fuente corre siempre en `src/lib/pos/mas-opciones.test.ts`).
 */
const RUTA_SESION = process.env.E2E_POS_STORAGE_STATE ?? "/tmp/opencode/pos11-storage-state.json";
const HAY_SESION = existsSync(RUTA_SESION);
const PANEL = "#panel-factura-pos";
const OPCIONES = ["Guardar cotización", "Cargar cotización", "Historial de ventas"];

test.use({ storageState: HAY_SESION ? RUTA_SESION : undefined, viewport: { width: 1440, height: 900 } });

test("abrir «Más opciones» muestra los tres cuadros y cerrar deja el carrito igual", async ({ page }) => {
  test.skip(!HAY_SESION, `falta la sesión ZZTEST en ${RUTA_SESION}`);

  await page.goto("/pos", { timeout: LENTO });
  const panel = page.locator(PANEL);
  await expect(panel).toBeVisible({ timeout: LENTO });

  // Una línea en el carrito para poder comparar que nada se pierde.
  if (await panel.getByText("Aquí verás los productos que elijas en tu próxima venta").isVisible()) {
    await page.locator('button[aria-label^="Agregar "]:enabled').first().click();
    await expect(panel.getByText("Aquí verás los productos que elijas en tu próxima venta")).toBeHidden();
  }
  const antes = await panel.textContent();

  const abrir = panel.getByRole("button", { name: "Más opciones" });
  await abrir.click();

  const opciones = panel.getByRole("region", { name: "Más opciones" });
  await expect(opciones, "El ⋯ debe abrir el panel grande, no una listita").toBeVisible();
  for (const nombre of OPCIONES) {
    await expect(opciones.getByText(nombre, { exact: true }), `Falta el cuadro «${nombre}»`).toBeVisible();
  }

  await opciones.getByRole("button", { name: "Volver al carrito" }).click();
  await expect(opciones).toBeHidden();
  expect(await panel.textContent(), "Cerrar con la X no debe cambiar el carrito").toBe(antes);

  await abrir.click();
  await expect(opciones).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(opciones).toBeHidden();
  expect(await panel.textContent(), "Esc no debe cambiar el carrito").toBe(antes);
});

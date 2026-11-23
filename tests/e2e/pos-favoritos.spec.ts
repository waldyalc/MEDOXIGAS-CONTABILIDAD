import { expect, test } from "@playwright/test";

import { email, entrar, LENTO, password } from "./ayudantes";

/**
 * Candado de Favoritos del POS (MSG-31, Waldy):
 * la estrella teal de la tarjeta marca/desmarca sin agregar al carrito, el
 * filtro «Favoritos» muestra solo lo marcado y la marca sobrevive al recargar
 * (localStorage `pos:favoritos:v1`).
 *
 * Usa la sesión ZZTEST de staging; sin credenciales se salta, como el humo.
 */
test.skip(!email || !password, "falta E2E_EMAIL o E2E_PASSWORD");
test.use({ viewport: { width: 1440, height: 900 } });

test("la estrella marca el favorito, el filtro lo muestra y no lo agrega al carrito", async ({ page }) => {
  await entrar(page, "ZZTEST no tiene perfil para probar el POS");

  await page.goto("/pos", { timeout: LENTO });
  await page.locator("#catalogo-pos").waitFor({ timeout: LENTO });

  const filtro = page.getByRole("button", { name: "Favoritos", exact: true });
  await expect(filtro).toBeVisible({ timeout: LENTO });
  if ((await filtro.getAttribute("aria-pressed")) === "true") await filtro.click();
  await expect(filtro).toHaveAttribute("aria-pressed", "false");

  const panel = page.locator("#panel-factura-pos");
  await expect(panel.getByText("0 Productos", { exact: true })).toBeVisible({ timeout: LENTO });

  const estrellaVacia = page.getByRole("button", { name: /^Marcar .+ como favorito$/ }).first();
  await expect(estrellaVacia).toBeVisible({ timeout: LENTO });
  const etiqueta = (await estrellaVacia.getAttribute("aria-label")) ?? "";
  const nombre = etiqueta.replace(/^Marcar (.*) como favorito$/, "$1");
  expect(nombre, "no se pudo leer el nombre del producto de la estrella").not.toBe("");

  await estrellaVacia.click();

  const marcada = page.getByRole("button", { name: `Quitar ${nombre} de favoritos`, exact: true });
  await expect(marcada).toBeVisible();
  await expect(marcada).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByText("0 Productos", { exact: true }), "la estrella no debe agregar al carrito").toBeVisible();

  await filtro.click();
  await expect(filtro).toHaveAttribute("aria-pressed", "true");
  await expect(marcada, "el filtro «Favoritos» debe mostrar el producto marcado").toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Marcar .+ como favorito$/ }),
    "con el filtro activo no puede quedar ninguna tarjeta sin marcar",
  ).toHaveCount(0);

  await page.reload({ timeout: LENTO });
  await page.locator("#catalogo-pos").waitFor({ timeout: LENTO });
  await expect(
    page.getByRole("button", { name: `Quitar ${nombre} de favoritos`, exact: true }),
    "el favorito debe sobrevivir a la recarga (localStorage pos:favoritos:v1)",
  ).toBeVisible({ timeout: LENTO });
});

import { expect, type Page, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.skip(!email || !password, "falta E2E_EMAIL o E2E_PASSWORD");

async function entrar(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email ?? "");
  await page.getByLabel("Contraseña").fill(password ?? "");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
}

async function abrirB16(page: Page) {
  await page.goto("/dashboard/contabilidad/numeraciones");
  const fila = page.getByRole("row", { name: /Exportaciones/ });
  await expect(fila, "no se encontró la fila de la serie B16 (Exportaciones)").toBeVisible();
  const antes = (await fila.textContent()) ?? "";
  await fila.getByRole("button", { name: "Editar numeración B16" }).click();
  const dialogo = page.getByRole("dialog", { name: "Editar numeración" });
  await expect(dialogo).toBeVisible();
  return { fila, dialogo, antes };
}

test("guardar B16 con los mismos valores cierra el diálogo y no cambia la fila", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", (error) => errores.push(String(error)));
  page.on("console", (mensaje) => {
    if (mensaje.type() === "error") errores.push(mensaje.text());
  });

  await entrar(page);
  const { fila, dialogo, antes } = await abrirB16(page);

  await dialogo.getByRole("button", { name: "Guardar" }).click();

  await expect(
    dialogo,
    "Guardar no cerró el diálogo en 15 s: la server action no respondió ok (revisa que actualizarNumeracion llame supabase.rpc directo)",
  ).toBeHidden({ timeout: 15000 });
  await expect(fila).toHaveText(antes);
  await expect(dialogo.getByRole("alert")).toHaveCount(0);
  expect(errores, "la consola del navegador registró errores al guardar").toEqual([]);
});

test("un nombre en blanco muestra el mensaje de validación en español y no guarda", async ({ page }) => {
  await entrar(page);
  const { fila, dialogo, antes } = await abrirB16(page);

  await dialogo.getByLabel(/^Nombre/).fill("   ");
  await dialogo.getByRole("button", { name: "Guardar" }).click();

  await expect(dialogo.getByRole("alert")).toHaveText("El nombre es obligatorio", { timeout: 15000 });
  await expect(dialogo).toBeVisible();

  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialogo).toBeHidden();
  await expect(fila).toHaveText(antes);
});

import { expect, type Page, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

const RUTAS = [
  { nombre: "cotizaciones", ruta: "/dashboard/cotizaciones" },
  { nombre: "conduces", ruta: "/dashboard/conduces" },
  { nombre: "gastos", ruta: "/dashboard/gastos" },
  { nombre: "órdenes de compra", ruta: "/dashboard/ordenes-compra" },
  { nombre: "facturas recurrentes", ruta: "/dashboard/facturas-recurrentes" },
  { nombre: "activos fijos", ruta: "/dashboard/contabilidad/activos" },
  { nombre: "notas de crédito de compras", ruta: "/dashboard/compras/notas-credito" },
];

async function entrar(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email ?? "");
  await page.getByLabel("Contraseña").fill(password ?? "");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/dashboard/);
}

function escucharErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on("pageerror", (error) => {
    errores.push(String(error));
  });
  page.on("console", (mensaje) => {
    if (mensaje.type() === "error") errores.push(mensaje.text());
  });
  return errores;
}

test.describe("listas con paginación en servidor", () => {
  test.skip(!email || !password, "falta E2E_EMAIL o E2E_PASSWORD");

  for (const lista of RUTAS) {
    test(`${lista.nombre}: la búsqueda sin coincidencias no muestra todo`, async ({ page }) => {
      const errores = escucharErrores(page);
      await entrar(page);

      await page.goto(`${lista.ruta}?q=zzzznoexiste`);
      await expect(page.getByText(/No se encontr|Sin resultados/).first()).toBeVisible();
      await expect(page.locator("table [data-slot=skeleton]")).toHaveCount(0);

      expect(errores).toEqual([]);
    });
  }
});

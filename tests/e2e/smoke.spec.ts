import { expect, type Page, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

async function entrar(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email ?? "");
  await page.getByLabel("Contraseña").fill(password ?? "");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
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

test("sin sesión, /dashboard redirige al login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Bienvenido" })).toBeVisible();
  await expect(page.getByText("Entra a Medoxigas Contabilidad")).toBeVisible();
});

test("login con clave mala muestra error en español", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo").fill("nadie@example.com");
  await page.getByLabel("Contraseña").fill("clave-incorrecta");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("Correo o contraseña incorrectos")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

// El login bueno necesita un usuario real (Supabase del proyecto).
// Credenciales por entorno, nunca en el repo. Sin perfil, /dashboard
// manda a /unauthorized; con perfil, muestra la página Inicio.
test("login bueno abre el dashboard, sin errores", async ({ page }) => {
  test.skip(!email || !password, "falta E2E_EMAIL o E2E_PASSWORD");
  const errores = escucharErrores(page);

  await entrar(page);
  await expect(page).toHaveURL(/\/(dashboard|unauthorized)/);

  if (page.url().includes("/unauthorized")) {
    await expect(page.getByRole("heading", { name: "Acceso no autorizado" })).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "Resumen del negocio" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cambiar periodo" })).toBeVisible();
  }

  expect(errores).toEqual([]);
});

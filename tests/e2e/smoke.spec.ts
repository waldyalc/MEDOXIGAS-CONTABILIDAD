import { expect, type Page, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

async function entrar(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email ?? "");
  await page.getByLabel("Contraseña").fill(password ?? "");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/(dashboard\/(produccion|caja-chica)|unauthorized)/);
}

function sinPerfil(page: Page): boolean {
  return new URL(page.url()).pathname === "/unauthorized";
}

async function salir(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Abrir menú de perfil" }).click();
  await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login/);
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

test("sin sesión, /dashboard/produccion redirige al login", async ({ page }) => {
  await page.goto("/dashboard/produccion");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Bienvenido" })).toBeVisible();
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
// Credenciales por entorno, nunca en el repo. La landing depende del rol:
// admin → Producción, caja → Caja Chica y sin perfil → /unauthorized.
test("login bueno entra según el rol, sin errores", async ({ page }) => {
  test.skip(!email || !password, "falta E2E_EMAIL o E2E_PASSWORD");
  const errores = escucharErrores(page);

  await entrar(page);

  if (page.url().includes("/dashboard/produccion")) {
    await expect(page.getByRole("heading", { name: "Producción" })).toBeVisible();
    for (const kpi of ["Cilindros llenados", "Termos llenados", "LOX usado", "Merma real del ISO"]) {
      await expect(page.getByText(kpi, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText("Llenados", { exact: true }).first()).toBeVisible();
  } else if (page.url().includes("/dashboard/caja-chica")) {
    await expect(page.getByRole("heading", { name: "Caja Chica" })).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "Acceso no autorizado" })).toBeVisible();
  }

  if (!sinPerfil(page)) await salir(page);

  expect(errores).toEqual([]);
});

// El usuario de solo lectura no tiene perfil: no ve módulos y Producción y
// Caja Chica lo mandan a /unauthorized. Si el usuario e2e fuera admin/caja,
// se comprueba lo contrario para no atar la prueba a un rol concreto.
test("los módulos respetan el rol del usuario, sin errores", async ({ page }) => {
  test.skip(!email || !password, "falta E2E_EMAIL o E2E_PASSWORD");
  const errores = escucharErrores(page);

  await entrar(page);

  if (sinPerfil(page)) {
    await page.goto("/dashboard/produccion");
    await expect(page).toHaveURL(/\/unauthorized/);
    await page.goto("/dashboard/caja-chica");
    await expect(page).toHaveURL(/\/unauthorized/);
    await expect(page.getByRole("heading", { name: "Acceso no autorizado" })).toBeVisible();
  } else {
    await page.goto("/dashboard/caja-chica");
    await expect(page.getByRole("heading", { name: "Caja Chica" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar gasto", exact: true })).toBeEnabled();

    await page.goto("/dashboard/produccion");
    if (page.url().includes("/dashboard/produccion")) {
      await expect(page.getByRole("heading", { name: "Producción" })).toBeVisible();
    } else {
      await expect(page).toHaveURL(/\/unauthorized/);
    }

    await page.goto("/dashboard/caja-chica");
    await salir(page);
  }

  expect(errores).toEqual([]);
});

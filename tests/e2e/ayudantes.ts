import { expect, type Locator, type Page } from "@playwright/test";

export const email = process.env.E2E_EMAIL;
export const password = process.env.E2E_PASSWORD;

/** Las pantallas traen datos del servidor de pruebas: darles tiempo. */
export const LENTO = 45_000;

/** Inicia sesión y exige perfil; sin perfil /dashboard redirige a /unauthorized. */
export async function entrar(page: Page, mensajeSinPerfil: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email ?? "");
  await page.getByLabel("Contraseña").fill(password ?? "");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/(dashboard|unauthorized)/, { timeout: LENTO });
  if (page.url().includes("/unauthorized")) {
    throw new Error(mensajeSinPerfil);
  }
}

export function escucharErrores(page: Page): string[] {
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
export function pesos(texto: string): number {
  return Number(texto.replace(/[^0-9.,-]/g, "").replace(/,/g, ""));
}

/** Texto de una celda de la fila, localizada por el encabezado de su columna. */
export async function textoCelda(page: Page, fila: Locator, encabezado: string): Promise<string> {
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
export async function valorJuntoA(page: Page, etiqueta: string): Promise<number> {
  const bloque = page.getByText(etiqueta, { exact: true }).first().locator("..").locator("span");
  return pesos((await bloque.nth(1).textContent()) ?? "");
}

/**
 * Fila de una lista por su texto. Las filas clicables (FilaNavegable) exponen
 * role="link" en vez de role="row": hay que buscar el tr, no el rol.
 */
export function filaDeLista(page: Page, texto: string | RegExp): Locator {
  return page.locator("tbody tr").filter({ hasText: texto });
}

/**
 * La lista desplegable del control recién abierto. Los popups cerrados de
 * Select/Combobox de Base UI quedan montados en el portal (ocultos pero con
 * opciones presentes): por eso no basta buscar la opción por nombre — hay
 * que apuntar al listbox exacto que el control abrió (su aria-controls).
 */
async function listboxDe(page: Page, control: Locator): Promise<Locator> {
  await expect(control).toHaveAttribute("aria-expanded", "true", { timeout: LENTO });
  const id = await control.getAttribute("aria-controls");
  return id ? page.locator(`[id="${id}"]`) : page.locator('[role="listbox"]:visible').last();
}

/** Abre un Select de Base UI (trigger tipo botón) y elige la opción por nombre. */
export async function elegirEnSelect(page: Page, trigger: Locator, nombre: string | RegExp): Promise<void> {
  await trigger.click();
  const lista = await listboxDe(page, trigger);
  await lista.getByRole("option", { name: nombre }).first().click({ timeout: LENTO });
}

/** Escribe en un Combobox de Base UI (búsqueda con espera) y elige la opción por nombre. */
export async function elegirEnCombo(page: Page, entrada: Locator, texto: string): Promise<void> {
  await entrada.click();
  await entrada.fill(texto);
  const lista = await listboxDe(page, entrada);
  await lista.getByRole("option", { name: texto }).first().click({ timeout: LENTO });
}

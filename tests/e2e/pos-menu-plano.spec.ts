import { expect, type Page, test } from "@playwright/test";

import { LENTO } from "./ayudantes";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Candado del menú plano del POS (decisión de Waldy, 23-11-2026):
 * Facturar, Ventas, Pagos, Turnos y Devoluciones al mismo nivel, sin grupos
 * «Ingresos»/«Historial de turnos» ni submenús.
 *
 * La sesión ZZTEST vive fuera del repo; sin ella, la prueba de navegador se
 * salta y el candado de fuente sigue corriendo.
 */
const RUTA_SESION = process.env.E2E_POS_STORAGE_STATE ?? "/tmp/opencode/pos11-storage-state.json";
const HAY_SESION = existsSync(RUTA_SESION);
const ETIQUETAS = ["Facturar", "Ventas", "Pagos", "Turnos", "Devoluciones"];
const RUTAS = ["/pos", "/pos/historial", "/pos/pagos", "/pos/turnos", "/pos/devoluciones"];

test.use({ storageState: HAY_SESION ? RUTA_SESION : undefined, viewport: { width: 1440, height: 900 } });

function menuFuente(): string {
  return readFileSync(join(process.cwd(), "src", "app", "(pos)", "pos", "_components", "menu-pos.tsx"), "utf8");
}

function aviso(quePaso: string): string {
  return `El menú del POS es plano (decisión de Waldy, 23-11-2026): ${quePaso}. Deja Facturar, Ventas, Pagos, Turnos y Devoluciones como enlaces al mismo nivel, sin «Ingresos», «Historial de turnos», ItemSeccion, sub:, Collapsible ni ChevronDown.`;
}

test("candado de fuente: cinco enlaces planos, sin grupos ni submenús", () => {
  const menu = menuFuente();
  const inicio = menu.indexOf("const ITEMS_PRINCIPALES");
  const fin = menu.indexOf("const ITEMS_CONTABILIDAD");

  expect(inicio, aviso("no existe ITEMS_PRINCIPALES en menu-pos.tsx")).toBeGreaterThan(-1);
  expect(fin, aviso("ITEMS_CONTABILIDAD debe venir después de ITEMS_PRINCIPALES")).toBeGreaterThan(inicio);

  const bloque = menu.slice(inicio, fin);
  const etiquetas = [...bloque.matchAll(/etiqueta: "([^"]+)"/g)].map((coincidencia) => coincidencia[1]);
  const rutas = [...bloque.matchAll(/href: "([^"]+)"/g)].map((coincidencia) => coincidencia[1]);

  expect(etiquetas, aviso("las etiquetas cambiaron o cambiaron de orden")).toEqual(ETIQUETAS);
  expect(rutas, aviso("las rutas cambiaron o cambiaron de orden")).toEqual(RUTAS);

  for (const prohibido of ["Ingresos", "Historial de turnos", "ItemSeccion", "sub:", "Collapsible", "ChevronDown"]) {
    expect(menu, aviso(`volvió a aparecer «${prohibido}»`)).not.toContain(prohibido);
  }
});

async function menuExpandido(page: Page) {
  const menu = page.getByRole("complementary", { name: "Menú del punto de venta" });
  await menu.hover();
  await expect(menu.getByRole("button", { name: "Dejar el menú abierto" })).toBeVisible({ timeout: LENTO });
  return menu;
}

async function enlacesPrincipales(page: Page) {
  const menu = await menuExpandido(page);
  const nav = menu.getByRole("navigation", { name: "Secciones del punto de venta" });
  return nav.locator("ul").first().getByRole("link");
}

async function enlacePrincipal(page: Page, nombre: string) {
  const menu = await menuExpandido(page);
  const nav = menu.getByRole("navigation", { name: "Secciones del punto de venta" });
  return nav.locator("ul").first().getByRole("link", { name: nombre, exact: true });
}

test("a 1440 px el menú navega a Ventas, Pagos, Turnos y Devoluciones", async ({ page }) => {
  test.skip(!HAY_SESION, `falta la sesión ZZTEST en ${RUTA_SESION}`);

  await page.goto("/pos", { timeout: LENTO });

  const enlaces = await enlacesPrincipales(page);
  await expect(enlaces, aviso("el menú no muestra los cinco enlaces en orden")).toHaveText(ETIQUETAS);

  const menu = page.getByRole("complementary", { name: "Menú del punto de venta" });
  await expect(menu.getByText("Ingresos", { exact: true }), aviso("«Ingresos» no debe existir")).toHaveCount(0);
  await expect(
    menu.getByText("Historial de turnos", { exact: true }),
    aviso("«Historial de turnos» no debe existir"),
  ).toHaveCount(0);

  await (await enlacePrincipal(page, "Ventas")).click();
  await expect(page).toHaveURL(/\/pos\/historial\/?$/, { timeout: LENTO });
  await expect(page.getByRole("heading", { name: "Ventas", exact: true })).toBeVisible({ timeout: LENTO });

  await (await enlacePrincipal(page, "Pagos")).click();
  await expect(page).toHaveURL(/\/pos\/pagos\/?$/, { timeout: LENTO });
  await expect(page.getByRole("heading", { name: "Pagos", exact: true })).toBeVisible({ timeout: LENTO });

  await (await enlacePrincipal(page, "Turnos")).click();
  await expect(page).toHaveURL(/\/pos\/turnos\/?$/, { timeout: LENTO });
  await expect(page.getByRole("heading", { name: "Turnos", exact: true })).toBeVisible({ timeout: LENTO });

  await (await enlacePrincipal(page, "Devoluciones")).click();
  await expect(page).toHaveURL(/\/pos\/devoluciones\/?$/, { timeout: LENTO });
});

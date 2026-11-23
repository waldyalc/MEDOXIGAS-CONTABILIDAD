import { expect, test } from "@playwright/test";

const estadoSesion = process.env.E2E_POS_STORAGE_STATE;
const producto = process.env.E2E_POS_PRODUCTO ?? "";
const carpeta = "docs/diseno/capturas/pos-11";

test.use({ storageState: estadoSesion, viewport: { width: 1440, height: 900 } });

test("ZZTEST: tres ventas locales, recarga offline, ticket sin NCF y error de sync visible", async ({
  page,
  context,
}) => {
  test.skip(
    !estadoSesion || !producto.startsWith("ZZTEST"),
    "Requiere storageState externo y producto ZZTEST autorizado. No escribe en el remoto.",
  );
  await page.goto("/pos");
  await expect(page.getByRole("button", { name: `Agregar ${producto}`, exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(async () => Boolean(await caches.match(new URL("/pos-offline-identidad", location.origin)))),
    )
    .toBe(true);
  page.on("dialog", (dialogo) => dialogo.accept());
  await context.setOffline(true);
  for (let numero = 1; numero <= 3; numero++) {
    await page.getByRole("button", { name: `Agregar ${producto}`, exact: true }).click();
    await page.getByRole("button", { name: /^Vender/ }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByRole("button", { name: "Efectivo", exact: true }).click();
    await dialogo.getByRole("button", { name: /^Cobrar/ }).click();
    await expect(dialogo.getByRole("heading", { name: "Venta guardada en este dispositivo" })).toBeVisible();
    await expect(dialogo.getByText(/Folio: POS-LOCAL-/)).toBeVisible();
    await expect(dialogo.getByText(/NCF|Comprobante provisional/)).toHaveCount(0);
    if (numero === 1) await page.screenshot({ path: `${carpeta}/ticket-folio.png`, fullPage: true });
    await dialogo.getByRole("button", { name: "Nueva venta", exact: true }).click();
  }
  await expect(page.getByRole("button", { name: "Sin conexión — 3 ventas pendientes de subir" })).toBeVisible();
  await page.screenshot({ path: `${carpeta}/offline-pendientes.png`, fullPage: true });
  await page.reload();
  await expect(page.getByRole("button", { name: "Sin conexión — 3 ventas pendientes de subir" })).toBeVisible();
  await page.getByRole("button", { name: "Sin conexión — 3 ventas pendientes de subir" }).click();
  await expect(page.getByRole("dialog").getByText(/Folio: POS-LOCAL-/)).toHaveCount(3);
  await page.screenshot({ path: `${carpeta}/panel-sync.png`, fullPage: true });
  await context.route("**/*", (ruta) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(ruta.request().method())) return ruta.abort();
    return ruta.continue();
  });
  await context.setOffline(false);
  await expect(page.getByRole("dialog").getByText(/Sincronización no habilitada/)).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: `${carpeta}/error-reintento.png`, fullPage: true });
});

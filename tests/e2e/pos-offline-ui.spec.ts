import { expect, type Page, test } from "@playwright/test";

const estadoSesion = process.env.E2E_POS_STORAGE_STATE;
const producto = process.env.E2E_POS_PRODUCTO ?? "";
const carpeta = "docs/diseno/capturas/pos-11";

test.use({ storageState: estadoSesion, viewport: { width: 1440, height: 900 } });

async function leerCuadre(page: Page) {
  await page.goto("/pos/turnos");
  const bloque = page.getByText("Total de ventas", { exact: true }).locator("xpath=..");
  const texto = await bloque.innerText();
  const total = Number(texto.replace(/[^\d,.]/g, "").replaceAll(",", ""));
  const cantidad = Number(/(\d+)\s+ventas?/.exec(texto)?.[1] ?? "0");
  return { total, cantidad };
}

async function abrirPanel(page: Page) {
  await page
    .getByRole("button", { name: /ventas pendientes de subir|operaciones pendientes|Error al subir/ })
    .first()
    .click();
}

test("ZZTEST: tres ventas offline, recarga, sincronización real, NCF y cuadre", async ({ page, context }) => {
  test.skip(
    !estadoSesion || !producto.startsWith("ZZTEST"),
    "Requiere storageState externo y producto ZZTEST autorizado. Escribe 3 ventas reales de prueba.",
  );
  test.setTimeout(180_000);
  const antes = await leerCuadre(page);
  await page.goto("/pos");
  await expect(page.getByRole("button", { name: `Agregar ${producto}`, exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(async () => Boolean(await caches.match(new URL("/pos-offline-identidad", location.origin)))),
    )
    .toBe(true);

  page.on("dialog", (dialogo) => dialogo.accept());
  await context.setOffline(true);

  let cobrado = 0;
  for (let numero = 1; numero <= 3; numero++) {
    await page.getByRole("button", { name: `Agregar ${producto}`, exact: true }).click();
    await page.getByRole("button", { name: /^Vender/ }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByRole("button", { name: "Efectivo", exact: true }).click();
    const cobrar = dialogo.getByRole("button", { name: /^Cobrar/ });
    const etiqueta = await cobrar.innerText();
    cobrado += Number(/([\d,.]+)/.exec(etiqueta)?.[1]?.replaceAll(",", "") ?? "0");
    await cobrar.click();
    await expect(dialogo.getByRole("heading", { name: "Venta guardada en este dispositivo" })).toBeVisible();
    await expect(dialogo.getByText(/Folio: POS-LOCAL-/)).toBeVisible();
    await expect(dialogo.getByText(/NCF|Comprobante provisional/)).toHaveCount(0);
    if (numero === 1) await page.screenshot({ path: `${carpeta}/ticket-folio.png`, fullPage: true });
    await dialogo.getByRole("button", { name: "Nueva venta", exact: true }).click();
  }

  const barraOffline = page.getByRole("button", { name: "Sin conexión — 3 ventas pendientes de subir" });
  await expect(barraOffline).toBeVisible();
  await page.screenshot({ path: `${carpeta}/offline-pendientes.png`, fullPage: true });

  await page.getByRole("button", { name: "Cerrar turno" }).click();
  await expect(page.getByText("Conéctate para subir 3 ventas antes de cerrar", { exact: true })).toBeVisible();
  await page.screenshot({ path: `${carpeta}/cierre-bloqueado.png`, fullPage: true });
  await page.keyboard.press("Escape");

  await page.reload();
  await expect(barraOffline).toBeVisible({ timeout: 20_000 });
  await barraOffline.click();
  await expect(page.getByRole("dialog").getByText(/Folio: POS-LOCAL-/)).toHaveCount(3);
  await page.screenshot({ path: `${carpeta}/panel-sync.png`, fullPage: true });

  await context.route("**/rest/v1/rpc/pos_sincronizar_operacion", (ruta) => ruta.abort("failed"));
  await context.setOffline(false);
  await expect(
    page
      .getByRole("dialog")
      .getByText(/No se recibió confirmación del servidor/)
      .first(),
  ).toBeVisible({
    timeout: 30_000,
  });
  await page.screenshot({ path: `${carpeta}/error-reintento.png`, fullPage: true });
  await context.unroute("**/rest/v1/rpc/pos_sincronizar_operacion");

  await context.route("**/rest/v1/rpc/pos_sincronizar_operacion", async (ruta) => {
    await new Promise((listo) => setTimeout(listo, 1200));
    await ruta.continue();
  });
  await page.getByRole("button", { name: "Reintentar pendientes" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^Subiendo ventas…/ })).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `${carpeta}/sincronizando.png`, fullPage: true });

  const barraEnLinea = page.getByRole("button", { name: "0 operaciones pendientes · En línea" });
  await expect(barraEnLinea).toBeVisible({ timeout: 60_000 });
  await context.unroute("**/rest/v1/rpc/pos_sincronizar_operacion");

  const estados = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((listo, falla) => {
      const solicitud = indexedDB.open("medoxigas-pos-offline", 1);
      solicitud.onsuccess = () => listo(solicitud.result);
      solicitud.onerror = () => falla(solicitud.error);
    });
    const filas = await new Promise<{ estado: string }[]>((listo, falla) => {
      const solicitud = db.transaction("operaciones", "readonly").objectStore("operaciones").getAll();
      solicitud.onsuccess = () => listo(solicitud.result);
      solicitud.onerror = () => falla(solicitud.error);
    });
    db.close();
    return filas.map((fila) => fila.estado);
  });
  expect(estados).toEqual(["sincronizada", "sincronizada", "sincronizada"]);

  await abrirPanel(page);
  const ncfs = (
    await page
      .getByRole("dialog")
      .getByText(/NCF B\d+/)
      .allInnerTexts()
  )
    .map((texto) => (/(B\d{11})/.exec(texto) ?? [])[1])
    .filter((ncf): ncf is string => ncf !== undefined);
  expect(ncfs).toHaveLength(3);
  expect(new Set(ncfs).size).toBe(3);
  await page.screenshot({ path: `${carpeta}/sincronizado-ncf.png`, fullPage: true });
  await page.keyboard.press("Escape");

  await page.goto("/pos/historial");
  for (const ncf of ncfs) await expect(page.getByText(ncf, { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: `${carpeta}/historial-tres-ncf.png`, fullPage: true });

  const despues = await leerCuadre(page);
  expect(despues.cantidad - antes.cantidad).toBe(3);
  expect(Math.round((despues.total - antes.total) * 100) / 100).toBe(Math.round(cobrado * 100) / 100);
  await page.screenshot({ path: `${carpeta}/cuadre-turno.png`, fullPage: true });
});

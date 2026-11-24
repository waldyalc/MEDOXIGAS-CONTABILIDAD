import { expect, type Page, test } from "@playwright/test";

const estadoSesion = process.env.E2E_POS_STORAGE_STATE;
const producto = process.env.E2E_POS_PRODUCTO ?? "";
const carpeta = "docs/diseno/capturas/pos-11";

async function captura(page: Page, nombre: string) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${carpeta}/${nombre}.png`, fullPage: true, animations: "disabled" });
}

test.use({ storageState: estadoSesion, viewport: { width: 1440, height: 900 } });

async function leerCuadre(page: Page) {
  await page.goto("/pos/turnos");
  const bloque = page.getByText("Total de ventas", { exact: true }).locator("xpath=..");
  const totalTexto = (await bloque.getByText(/^RD\$/).textContent()) ?? "";
  const total = Number(totalTexto.replace(/[^\d,.]/g, "").replaceAll(",", ""));
  const cantidadTexto = (await bloque.getByText(/^\d+ ventas?$/).textContent()) ?? "";
  const cantidad = Number(/(\d+)/.exec(cantidadTexto)?.[1] ?? "0");
  return { total, cantidad };
}

async function abrirPanel(page: Page) {
  await page
    .getByRole("button", { name: /ventas pendientes de subir|operaciones pendientes|Error al subir/ })
    .first()
    .click();
}

const CLASES_ACENTO: Record<string, string> = {
  a: "[aáàäâ]",
  e: "[eéèëê]",
  i: "[iíìïî]",
  o: "[oóòöô]",
  u: "[uúùüû]",
  n: "[nñ]",
};

/** El catálogo escribe «ZZTEST Cánula…»; el brief puede venir en mayúsculas o sin acentos. */
function patronProducto(): RegExp {
  const escapado = producto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tolerante = escapado.replace(/[aeioun]/gi, (letra) => CLASES_ACENTO[letra.toLocaleLowerCase("es")] ?? letra);
  return new RegExp(`^Agregar ${tolerante}$`, "i");
}

async function botonProducto(page: Page) {
  const boton = page.getByRole("button", { name: patronProducto() });
  await expect(boton, `No se encontró «${producto}» en el catálogo`).toBeVisible();
  return boton;
}

async function esperarCatalogoOffline(page: Page, nombre: string) {
  await expect
    .poll(
      () =>
        page.evaluate(async (buscado) => {
          const db = await new Promise<IDBDatabase>((listo, falla) => {
            const solicitud = indexedDB.open("medoxigas-pos-offline", 1);
            solicitud.onsuccess = () => listo(solicitud.result);
            solicitud.onerror = () => falla(solicitud.error);
          });
          try {
            const filas = await new Promise<{ productos?: { nombre: string }[] }[]>((listo, falla) => {
              const solicitud = db.transaction("catalogo", "readonly").objectStore("catalogo").getAll();
              solicitud.onsuccess = () => listo(solicitud.result);
              solicitud.onerror = () => falla(solicitud.error);
            });
            return filas.some((fila) => (fila.productos ?? []).some((producto) => producto.nombre === buscado));
          } finally {
            db.close();
          }
        }, nombre),
      { timeout: 30_000 },
    )
    .toBe(true);
}

test("ZZTEST: tres ventas offline, recarga, sincronización real, NCF y cuadre", async ({ page, context }) => {
  test.skip(
    !estadoSesion || !producto.startsWith("ZZTEST"),
    "Requiere storageState externo y producto ZZTEST autorizado. Escribe 3 ventas reales de prueba.",
  );
  test.setTimeout(180_000);
  const antes = await leerCuadre(page);
  await page.goto("/pos");
  const productoVisible = await botonProducto(page);
  const nombreProducto = (await productoVisible.getAttribute("aria-label"))?.replace(/^Agregar /, "") ?? "";
  await expect
    .poll(() =>
      page.evaluate(async () => Boolean(await caches.match(new URL("/pos-offline-identidad", location.origin)))),
    )
    .toBe(true);
  await esperarCatalogoOffline(page, nombreProducto);
  await abrirPanel(page);
  await expect(
    page.getByRole("dialog").getByText("Recarga offline preparada para esta sesión (máximo 8 horas)."),
  ).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Escape");

  page.on("dialog", (dialogo) => dialogo.accept());
  await context.setOffline(true);
  await expect(page.getByRole("button", { name: "Sin conexión — 0 ventas pendientes de subir" })).toBeVisible();

  let cobrado = 0;
  for (let numero = 1; numero <= 3; numero++) {
    await (await botonProducto(page)).click();
    await page.getByRole("button", { name: /^Vender/ }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByRole("button", { name: "Efectivo", exact: true }).click();
    const cobrar = dialogo.getByRole("button", { name: /^Cobrar/ });
    const etiqueta = (await cobrar.textContent()) ?? "";
    cobrado += Number(/([\d,.]+)/.exec(etiqueta)?.[1]?.replaceAll(",", "") ?? "0");
    await cobrar.click();
    await expect(dialogo.getByRole("heading", { name: "Venta guardada en este dispositivo" })).toBeVisible();
    await expect(dialogo.getByText(/Folio: POS-LOCAL-/)).toBeVisible();
    await expect(dialogo.getByText(/NCF|Comprobante provisional/)).toHaveCount(0);
    if (numero === 1) await captura(page, "ticket-folio");
    await dialogo.getByRole("button", { name: "Nueva venta", exact: true }).click();
  }

  const barraOffline = page.getByRole("button", { name: "Sin conexión — 3 ventas pendientes de subir" });
  await expect(barraOffline).toBeVisible();
  await captura(page, "offline-pendientes");

  await page.getByRole("button", { name: "Cerrar turno" }).click();
  await expect(
    page.getByText("Debes sincronizar tu información antes de poder cerrar turno", { exact: true }),
  ).toBeVisible();
  await captura(page, "cierre-bloqueado");
  await page.keyboard.press("Escape");

  await page.reload();
  await expect(barraOffline).toBeVisible({ timeout: 20_000 });
  await barraOffline.click();
  await expect(page.getByRole("dialog").getByText(/Folio: POS-LOCAL-/)).toHaveCount(3);
  await captura(page, "panel-sync");

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
  await captura(page, "error-reintento");
  await context.unroute("**/rest/v1/rpc/pos_sincronizar_operacion");

  await context.route("**/rest/v1/rpc/pos_sincronizar_operacion", async (ruta) => {
    await new Promise((listo) => setTimeout(listo, 1200));
    await ruta.continue();
  });
  await page.getByRole("button", { name: "Reintentar pendientes" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^Subiendo ventas…/ })).toBeVisible({ timeout: 20_000 });
  await captura(page, "sincronizando");

  const barraEnLinea = page.getByRole("button", { name: "0 operaciones pendientes · En línea" });
  await expect(barraEnLinea).toBeVisible({ timeout: 60_000 });
  await context.unroute("**/rest/v1/rpc/pos_sincronizar_operacion");

  const operaciones = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((listo, falla) => {
      const solicitud = indexedDB.open("medoxigas-pos-offline", 1);
      solicitud.onsuccess = () => listo(solicitud.result);
      solicitud.onerror = () => falla(solicitud.error);
    });
    const filas = await new Promise<{ estado: string; resultado: { factura?: { ncf?: string } } | null }[]>(
      (listo, falla) => {
        const solicitud = db.transaction("operaciones", "readonly").objectStore("operaciones").getAll();
        solicitud.onsuccess = () => listo(solicitud.result);
        solicitud.onerror = () => falla(solicitud.error);
      },
    );
    db.close();
    return filas.map((fila) => ({ estado: fila.estado, ncf: fila.resultado?.factura?.ncf ?? null }));
  });
  expect(operaciones.map((fila) => fila.estado)).toEqual(["sincronizada", "sincronizada", "sincronizada"]);
  const ncfs = operaciones.map((fila) => fila.ncf).filter((ncf): ncf is string => ncf !== null);
  expect(ncfs).toHaveLength(3);
  expect(new Set(ncfs).size).toBe(3);

  await abrirPanel(page);
  await expect(page.getByRole("dialog")).toContainText(/NCF B\d+/);
  await captura(page, "sincronizado-ncf");
  await page.keyboard.press("Escape");

  await page.goto("/pos/historial");
  for (const ncf of ncfs) await expect(page.getByText(ncf, { exact: true }).first()).toBeVisible();
  await captura(page, "historial-tres-ncf");

  const despues = await leerCuadre(page);
  expect(despues.cantidad - antes.cantidad).toBe(3);
  expect(Math.round((despues.total - antes.total) * 100) / 100).toBe(Math.round(cobrado * 100) / 100);
  await captura(page, "cuadre-turno");
});

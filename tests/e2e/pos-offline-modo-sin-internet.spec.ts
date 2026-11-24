import { expect, type Page, test } from "@playwright/test";

import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ESTADO_SESION = process.env.E2E_POS_STORAGE_STATE ?? join(homedir(), ".medoxigas", "storage-zztest.json");
const CARPETA_CAPTURAS = process.env.E2E_CAPTURAS_DIR ?? "/root/referencias/capturas-terminadas/2026-11-24-pos-offline";

test.use({
  storageState: existsSync(ESTADO_SESION) ? ESTADO_SESION : undefined,
  viewport: { width: 1440, height: 900 },
});

async function captura(page: Page, nombre: string) {
  mkdirSync(CARPETA_CAPTURAS, { recursive: true });
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(CARPETA_CAPTURAS, `${nombre}.png`), fullPage: false, animations: "disabled" });
}

async function limpiarOperacionesLocales(page: Page) {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("medoxigas-pos-offline", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("operaciones", "readwrite");
        tx.objectStore("operaciones").clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  });
}

async function detectarAmbito(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("medoxigas-pos-offline", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      const claves = await new Promise<IDBValidKey[]>((resolve, reject) => {
        const req = db.transaction("contactos", "readonly").objectStore("contactos").getAllKeys();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const primera = claves.find((k): k is string => typeof k === "string" && k.includes("/"));
      return primera ?? "";
    } finally {
      db.close();
    }
  });
}

async function leerOperacionesLocales(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("medoxigas-pos-offline", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      return await new Promise<
        { uuid: string; ambito: string; estado: string; folio: string; turnoId: string; resultado: unknown }[]
      >((resolve, reject) => {
        const tx = db.transaction("operaciones", "readonly");
        const req = tx.objectStore("operaciones").getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  });
}

async function sembrarOperacionLocal(
  page: Page,
  entrada: {
    uuid: string;
    ambito: string;
    secuencia: number;
    estado: "pendiente" | "fallida";
    folio: string;
    error: string | null;
  },
) {
  await page.evaluate(async (op) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("medoxigas-pos-offline", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("operaciones", "readwrite");
        tx.objectStore("operaciones").put(
          {
            uuid: op.uuid,
            ambito: op.ambito,
            secuencia: op.secuencia,
            tipo: "venta",
            turnoId: "00000000-0000-4000-8000-000000000001",
            folio: op.folio,
            payload: {
              terminal_id: op.ambito.split("/")[1] ?? "terminal",
              fecha: "2026-11-24",
              lineas: [
                {
                  producto_id: null,
                  descripcion: "Producto prueba offline",
                  cantidad: "1",
                  unidad_id: null,
                  precio: "100.00",
                  descuento_pct: "0",
                  itbis_tasa: "18",
                  impuesto_id: null,
                },
              ],
              pagos: [{ metodo: "efectivo", monto: "118.00", monto_recibido: "118.00" }],
            },
            snapshot: {
              pestana: {
                id: "pestana-offline-e2e",
                nombre: "Venta offline",
                lineas: [
                  {
                    id: "linea-offline-1",
                    productoId: null,
                    descripcion: "Producto prueba offline",
                    referencia: null,
                    cantidad: "1",
                    unidadId: null,
                    unidadNombre: "Unidad",
                    unidadBase: "Unidad",
                    factorBase: null,
                    precio: "100.00",
                    precioBase: "100.00",
                    precioManual: true,
                    descuentoPct: "0",
                    itbisTasa: "18",
                    impuestoId: null,
                    unidades: [],
                    tipo: "servicio",
                  },
                ],
                contactoId: "",
                listaPrecioId: "",
                numeracionId: "",
                vendedorId: "",
                cotizacion: null,
              },
              ticket: {
                cliente: { nombre: "Consumidor final", rnc_cedula: "22222222222" },
                fecha: new Date().toISOString(),
                subtotal: "100.00",
                descuento: "0.00",
                itbis: "18.00",
                total: "118.00",
                recibido: "118.00",
                cambio: "0.00",
                lineas: [
                  {
                    id: "linea-offline-1",
                    descripcion: "Producto prueba offline",
                    referencia: null,
                    cantidad: "1",
                    unidad_nombre: "Unidad",
                    precio: "100.00",
                    descuento_pct: "0",
                    itbis_tasa: "18",
                    total: "118.00",
                  },
                ],
              },
            },
            estado: op.estado,
            intentos: op.estado === "fallida" ? 1 : 0,
            proximoIntento: 0,
            error: op.error,
            resultado: null,
          },
          `${op.ambito}/${op.uuid}`,
        );
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }, entrada);
}

async function esperarSwYCatalogo(page: Page) {
  await expect
    .poll(
      () => page.evaluate(async () => Boolean(await caches.match(new URL("/pos-offline-identidad", location.origin)))),
      { timeout: 30_000 },
    )
    .toBe(true);

  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const req = indexedDB.open("medoxigas-pos-offline", 1);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          try {
            const filas = await new Promise<{ productos?: unknown[]; completo?: boolean }[]>((resolve, reject) => {
              const req = db.transaction("catalogo", "readonly").objectStore("catalogo").getAll();
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error);
            });
            return filas.some((fila) => fila.completo === true && (fila.productos?.length ?? 0) > 0);
          } finally {
            db.close();
          }
        }),
      { timeout: 30_000 },
    )
    .toBe(true);
}

test.describe("POS modo sin internet estilo Alegra (E2E real en navegador, cero escrituras en producción)", () => {
  test("offline inmediato, recarga SW, persistencia IndexedDB, popover 3 estados, sync con NCF en historial, error/editar y cierre estricto", async ({
    page,
    context,
  }) => {
    test.skip(!existsSync(ESTADO_SESION), "Requiere storageState ZZTEST en ~/.medoxigas/storage-zztest.json");
    test.setTimeout(180_000);

    // 1. Abrir /pos y esperar Service Worker + catálogo completo en IndexedDB
    await page.goto("/pos", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /Disponible/ })).toBeVisible({ timeout: 30_000 });
    await esperarSwYCatalogo(page);
    await limpiarOperacionesLocales(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /Disponible/ })).toBeVisible({ timeout: 30_000 });

    const ambito = await detectarAmbito(page);
    expect(ambito, "Debe existir el ámbito usuario/terminal en IndexedDB").toContain("/");
    const turnoAbierto = (await page.getByText(/Turno No \d+ abierto/).count()) > 0;

    // Verificar popover "Sincronización al día" con las 3 filas (Ventas, Productos, Clientes)
    const botonSync = page.getByRole("button", { name: "Estado de sincronización" });
    await botonSync.click();
    const popoverSync = page.locator("[data-slot='popover-content']").last();
    await expect(popoverSync.getByText("Sincronización al día")).toBeVisible();
    await expect(popoverSync.getByText("Ventas", { exact: true })).toBeVisible();
    await expect(popoverSync.getByText("Productos", { exact: true })).toBeVisible();
    await expect(popoverSync.getByText("Clientes", { exact: true })).toBeVisible();
    await expect(popoverSync.getByRole("button", { name: "Sincronizar ahora" })).toBeVisible();
    await captura(page, "01-popover-al-dia");
    await page.keyboard.press("Escape");

    // 2. Simular pérdida de internet y verificar cambio INMEDIATO (<3s) a "Sin conexión"
    page.on("dialog", (dialogo) => dialogo.accept());
    const inicioOffline = Date.now();
    await context.setOffline(true);
    await expect(page.getByRole("button", { name: "Sin conexión", exact: true })).toBeVisible({ timeout: 2_500 });
    expect(Date.now() - inicioOffline, "Debe pasar a Sin conexión de inmediato sin esperar 30s").toBeLessThan(3_000);

    // 3. Registrar venta offline (si hay turno abierto, por caja real; si no, persistiendo en IndexedDB para no abrir turno real en producción)
    if (turnoAbierto) {
      await page.getByRole("button", { name: "Cerrar turno" }).click();
      await expect(page.getByText("Sin conexión a internet. No puedes cerrar el turno sin conexión.")).toBeVisible();
      await page.keyboard.press("Escape");

      const primerProducto = page.locator("article button[aria-label^='Agregar ']").first();
      await expect(primerProducto).toBeVisible({ timeout: 15_000 });
      await primerProducto.click();
      await page.getByRole("button", { name: /^Vender/ }).click();
      const dialogoCobro = page.getByRole("dialog");
      await dialogoCobro.getByRole("button", { name: "Efectivo", exact: true }).click();
      await dialogoCobro.getByRole("button", { name: /^Cobrar/ }).click();
      await expect(dialogoCobro.getByRole("heading", { name: "¡Venta completada!" })).toBeVisible();
      await expect(dialogoCobro.getByText(/^[BE]\d{10}$/)).toBeVisible();
      await expect(dialogoCobro.getByText(/POS-LOCAL-/)).toHaveCount(0);
      await captura(page, "01b-venta-completada-local-ncf");
      await dialogoCobro.getByRole("button", { name: "Nueva venta", exact: true }).click();
    } else {
      await sembrarOperacionLocal(page, {
        uuid: "00000000-0000-4000-8000-000000009991",
        ambito,
        secuencia: 1,
        estado: "pendiente",
        folio: "POS-LOCAL-00000000-0000-4000-8000-000000009991",
        error: null,
      });
    }

    // 4. Recargar /pos aún SIN INTERNET y comprobar que el SW carga /pos y la venta sigue guardada
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Sin conexión", exact: true })).toBeVisible({ timeout: 15_000 });
    const opsTrasRecarga = await leerOperacionesLocales(page);
    expect(opsTrasRecarga).toHaveLength(1);
    expect(opsTrasRecarga[0]?.estado).toBe("pendiente");

    // Abrir popover de sincronización offline: debe mostrar "Sincronización pendiente" + "Revisar pendientes"
    await botonSync.click();
    const popoverPendiente = page.locator("[data-slot='popover-content']").last();
    await expect(popoverPendiente.getByText("Sincronización pendiente")).toBeVisible();
    await expect(popoverPendiente.getByRole("button", { name: "Revisar pendientes" })).toBeVisible();
    await captura(page, "02-offline-pendiente-popover");
    await page.keyboard.press("Escape");

    // 5. Restaurar internet interceptando pos_sincronizar_operacion (devuelve NCF definitivo sin escribir en producción)
    const ncfMock = "B0299990001";
    await context.route("**/rest/v1/rpc/pos_sincronizar_operacion", async (ruta) => {
      await new Promise((listo) => setTimeout(listo, 1_500));
      await ruta.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          factura: { id: "00000000-0000-4000-8000-000000009991", numero: 9991, ncf: ncfMock },
        }),
      });
    });

    await context.setOffline(false);
    await expect(page.getByRole("button", { name: /Disponible/ })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-slot='popover-content']").getByText("Sincronizando", { exact: true })).toBeVisible(
      { timeout: 10_000 },
    );
    await captura(page, "03-reconectado-sincronizando");

    await expect
      .poll(async () => (await leerOperacionesLocales(page))[0]?.estado, { timeout: 20_000 })
      .toBe("sincronizada");

    // 6. Ir a /pos/historial y verificar la venta sincronizada con su NCF definitivo
    await page.goto("/pos/historial", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(ncfMock).first()).toBeVisible({ timeout: 20_000 });
    await captura(page, "04-historial-sincronizada-ncf");

    // 7. Sembrar una venta con error en IndexedDB -> verificar estado Error, banner y botón "Editar venta"
    await sembrarOperacionLocal(page, {
      uuid: "00000000-0000-4000-8000-000000009992",
      ambito,
      secuencia: 2,
      estado: "fallida",
      folio: "POS-LOCAL-ERROR-PRUEBA",
      error: "Existencia insuficiente en inventario para completar la venta.",
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /POS-LOCAL-ERROR-PRUEBA/ }).click();
    await expect(page.getByText("No se pudo sincronizar la venta")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Reintentar sincronización" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Editar venta" })).toBeVisible();
    await captura(page, "05-historial-venta-error");

    // Si hay turno abierto, verificar también el modal estricto de cierre en /pos/turnos
    if (turnoAbierto) {
      await page.goto("/pos/turnos", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Cerrar turno", exact: true }).click();
      const dialogoCierre = page.getByRole("dialog");
      await expect(
        dialogoCierre.getByText("Debes sincronizar tu información antes de poder cerrar turno"),
      ).toBeVisible();
      await expect(dialogoCierre.getByRole("button", { name: "Guardar", exact: true })).toBeDisabled();
      await captura(page, "06-cierre-bloqueado-pendientes");
      await page.keyboard.press("Escape");
      await page.goto("/pos/historial", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /POS-LOCAL-ERROR-PRUEBA/ }).click();
    }

    // Probar "Editar venta" -> carga la venta fallida en el carrito de /pos y descarta la fallida
    await page.getByRole("button", { name: "Editar venta" }).click();
    await page.waitForURL(/\/pos$/, { timeout: 15_000 });
    await expect(page.getByText("Producto prueba offline")).toBeVisible({ timeout: 15_000 });
    await captura(page, "06-editar-venta-en-carrito");

    // Limpiar IndexedDB para dejar el navegador limpio
    await limpiarOperacionesLocales(page);
    await context.unroute("**/rest/v1/rpc/pos_sincronizar_operacion");
  });
});

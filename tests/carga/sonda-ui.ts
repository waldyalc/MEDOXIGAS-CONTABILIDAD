// Sonda UI (solo lectura de pantalla; sin escribir datos): identifica qué
// páginas tiran errores de consola/React, cuenta filas/opciones visibles y
// mide el archivo exportado del 607.
import { chromium } from "@playwright/test";

import { cargarEntorno, escribir } from "./_comun";

const BASE = "http://localhost:3001";

async function principal() {
  const entorno = cargarEntorno();
  const u = entorno.usuarios[0];
  if (!u) throw new Error("sin usuario de prueba");
  const navegador = await chromium.launch();
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
  const pagina = await ctx.newPage();
  const salida: Record<string, unknown> = {};
  const erroresPorPagina: Record<string, string[]> = {};
  let paginaActual = "";

  const registrar = (texto: string) => {
    const lista = erroresPorPagina[paginaActual] ?? [];
    lista.push(texto);
    erroresPorPagina[paginaActual] = lista;
  };
  pagina.on("pageerror", (e) => registrar(`pageerror: ${String(e).slice(0, 160)}`));
  pagina.on("console", (m) => {
    if (m.type() === "error") registrar(`console: ${m.text().slice(0, 160)}`);
  });

  await pagina.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await pagina.getByLabel("Correo").fill(u.email);
  await pagina.getByLabel("Contraseña").fill(u.password);
  await pagina
    .getByRole("button", { name: /entrar/i })
    .first()
    .click();
  await pagina.waitForURL("**/dashboard**", { timeout: 20000 });

  const rutas: [string, string][] = [
    ["inicio", "/dashboard"],
    ["facturas", "/dashboard/facturacion"],
    ["compras", "/dashboard/compras"],
    ["pagos", "/dashboard/pagos"],
    ["contactos", "/dashboard/contactos"],
    ["productos", "/dashboard/productos"],
    ["gastos", "/dashboard/gastos-menores"],
    ["cotizaciones", "/dashboard/cotizaciones"],
    ["asientos", "/dashboard/contabilidad/asientos"],
    ["catalogo", "/dashboard/contabilidad/catalogo"],
    ["numeraciones", "/dashboard/configuracion/numeraciones"],
    ["empresa", "/dashboard/configuracion/empresa"],
    ["rep-607", "/dashboard/reportes/607?desde=2023-03-01&hasta=2023-03-31"],
    ["rep-cxc", "/dashboard/reportes/cxc?hasta=2023-12-31"],
    ["rep-cxp", "/dashboard/reportes/cxp?hasta=2023-12-31"],
    ["rep-libro-diario", "/dashboard/reportes/libro-diario?desde=2023-03-01&hasta=2023-03-31"],
    ["rep-balance", "/dashboard/reportes/balance-comprobacion?desde=2023-03-01&hasta=2023-03-31"],
    ["rep-estado", "/dashboard/reportes/estado-resultados?desde=2023-03-01&hasta=2023-03-31"],
    ["rep-ventas", "/dashboard/reportes/ventas-generales?desde=2023-03-01&hasta=2023-03-31"],
    ["rep-608", "/dashboard/reportes/608?desde=2023-03-01&hasta=2023-03-31"],
    ["rep-it1", "/dashboard/reportes/it1?desde=2023-03-01&hasta=2023-03-31"],
    ["rep-contador", "/dashboard/reportes/contador?desde=2023-03-01&hasta=2023-03-31"],
    ["nueva-factura", "/dashboard/facturacion/nueva"],
    ["nuevo-pago", "/dashboard/pagos/nuevo"],
    ["nueva-compra", "/dashboard/compras/nueva"],
  ];

  for (const [nombre, ruta] of rutas) {
    paginaActual = nombre;
    try {
      const t0 = Date.now();
      await pagina.goto(`${BASE}${ruta}`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await pagina.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
      const ms = Date.now() - t0;
      const filas = await pagina
        .locator("tbody tr")
        .count()
        .catch(() => -1);
      const texto = (
        await pagina
          .locator("main")
          .innerText()
          .catch(() => "")
      ).length;
      const tieneBusqueda = await pagina.locator("input[placeholder*=usc], input[type=search]").count();
      const tienePaginacion = await pagina
        .locator("[aria-label*=page], nav button:has-text('Siguiente'), button:has-text('Anterior')")
        .count();
      const hayError = await pagina.locator("text=/error|Error|algo salió/i").count();
      salida[nombre] = {
        ms,
        filasTabla: filas,
        textoChars: texto,
        inputBusqueda: tieneBusqueda,
        controlesPaginacion: tienePaginacion,
        posiblePaginaError: hayError > 0,
      };
      escribir(
        `${nombre}: ${ms}ms filas=${filas} texto=${texto} busc=${tieneBusqueda} pag=${tienePaginacion} err=${hayError > 0}`,
      );
    } catch (e) {
      salida[nombre] = { error: String(e).slice(0, 150) };
      escribir(`${nombre}: ERROR ${String(e).slice(0, 100)}`);
    }
  }

  // Exportación del 607: descargar el .txt y contar líneas
  paginaActual = "export-607";
  try {
    await pagina.goto(`${BASE}/dashboard/reportes/607?desde=2023-03-01&hasta=2023-03-31`, {
      waitUntil: "networkidle",
      timeout: 20000,
    });
    const boton = pagina.getByRole("button", { name: /descargar|exportar|\.txt|copiar/i }).first();
    if (await boton.count()) {
      const [descarga] = await Promise.all([
        pagina.waitForEvent("download", { timeout: 10000 }).catch(() => null),
        boton.click(),
      ]);
      if (descarga) {
        const ruta = await descarga.path();
        const { readFileSync } = await import("node:fs");
        const contenido = ruta ? readFileSync(ruta, "utf-8") : "";
        salida["export-607"] = {
          nombreArchivo: descarga.suggestedFilename(),
          lineas: contenido.split(/\r?\n/).filter((l) => l.trim().length > 0).length,
          bytes: contenido.length,
        };
        escribir(
          `export-607: ${descarga.suggestedFilename()} ${salida["export-607"] ? JSON.stringify(salida["export-607"]) : ""}`,
        );
      } else {
        // Quizá copia al portapapeles en vez de descargar
        const texto = await pagina.evaluate(() => navigator.clipboard.readText().catch(() => ""));
        salida["export-607"] = {
          descarga: false,
          portapapelesChars: texto.length,
          portapapelesLineas: texto.split("\n").length,
        };
        escribir(`export-607: sin descarga, portapapeles=${texto.length} chars`);
      }
    } else {
      salida["export-607"] = { boton: false };
      escribir("export-607: no encontré botón de exportar");
    }
  } catch (e) {
    salida["export-607"] = { error: String(e).slice(0, 150) };
    escribir(`export-607: ERROR ${String(e).slice(0, 120)}`);
  }

  salida["erroresConsolaPorPagina"] = erroresPorPagina;
  escribir("\n===ERRORES-CONSOLA===");
  for (const [p, errs] of Object.entries(erroresPorPagina))
    escribir(`${p}: ${errs.length} → ${errs[0]?.slice(0, 140) ?? ""}`);

  await navegador.close();
}

principal().catch((e) => {
  escribir(`ERROR: ${String(e).slice(0, 300)}`);
  process.exit(1);
});

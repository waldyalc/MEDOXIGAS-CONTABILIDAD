import { chromium, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { cargarEntorno, clientesAutenticados, escribir } from "./_comun";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.UI_BASE ?? "http://localhost:3001";
const REPETICIONES = 5;
const TIMEOUT_PANTALLA_MS = 60_000;

interface Pantalla {
  nombre: string;
  url: string;
  selector?: string;
}

interface Muestra {
  nombre: string;
  url: string;
  ms: number;
  error: string | null;
}

function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const indice = Math.min(ordenados.length - 1, Math.max(0, Math.ceil((p / 100) * ordenados.length) - 1));
  return Math.round(ordenados[indice] ?? 0);
}

function numeroDeTexto(texto: string | null): number | null {
  if (texto == null) return null;
  const limpio = texto.replace(/[^\d.,-]/g, "");
  if (limpio === "") return null;
  const valor = Number(limpio.replace(/,/g, ""));
  return Number.isFinite(valor) ? valor : null;
}

interface FacturaMarzo {
  total: number;
  subtotal: number;
  itbis: number;
  estado: string;
  notas: string | null;
}

async function facturasDeMarzo(cli: SupabaseClient): Promise<FacturaMarzo[]> {
  interface Fila {
    total: number;
    subtotal: number;
    itbis: number;
    estado: string;
    notas: string | null;
  }
  const filas: Fila[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await cli
      .from("facturas")
      .select("total, subtotal, itbis, estado, notas")
      .gte("fecha", "2023-03-01")
      .lte("fecha", "2023-03-31")
      .order("id")
      .range(desde, desde + 999)
      .returns<Fila[]>();
    if (error) throw new Error(`facturas marzo: ${error.message}`);
    const lote = data ?? [];
    filas.push(...lote);
    if (lote.length < 1000) break;
  }
  return filas.map((f) => ({
    total: Number(f.total),
    subtotal: Number(f.subtotal),
    itbis: Number(f.itbis),
    estado: f.estado,
    notas: f.notas,
  }));
}

async function leerTarjetas(page: Page, titulos: readonly string[]): Promise<Record<string, string>> {
  return page.evaluate((buscar) => {
    const salida: Record<string, string> = {};
    for (const span of Array.from(document.querySelectorAll("span"))) {
      const clave = (span.textContent ?? "").trim();
      if (buscar.includes(clave)) {
        const valor = span.nextElementSibling?.textContent?.trim();
        if (valor) salida[clave] = valor;
      }
    }
    return salida;
  }, titulos);
}

interface CorteMil {
  facturasMarzo2023Totales: number;
  facturasMarzo2023SinAnuladas: number;
  notasCreditoMarzo2023: number;
  filasEsperadas607: number;
  nuestrasFacturasMarzo: { facturas: number; total: number; subtotal: number; itbis: number };
  totalesTodasFacturasMarzo: { facturas: number; total: number; subtotal: number; itbis: number };
  reporte607: { registros: number | null; montoFacturado: number | null; itbisFacturado: number | null };
  ventasGenerales: { totalFilas: number | null; ventasBrutas: number | null; impuestos: number | null };
  aviso607: string | null;
}

async function corteMil(page: Page, cli: SupabaseClient): Promise<CorteMil> {
  const facturas = await facturasDeMarzo(cli);
  const sinAnuladas = facturas.filter((f) => f.estado !== "anulada");
  const nuestras = sinAnuladas.filter((f) => (f.notas ?? "").includes("ZZTEST-L1"));

  const { count: totales } = await cli
    .from("facturas")
    .select("id", { count: "exact", head: true })
    .gte("fecha", "2023-03-01")
    .lte("fecha", "2023-03-31");
  const { count: nc } = await cli
    .from("notas_credito_venta")
    .select("id", { count: "exact", head: true })
    .eq("estado", "activa")
    .gte("fecha", "2023-03-01")
    .lte("fecha", "2023-03-31");

  const redondear = (n: number) => Math.round(n * 100) / 100;
  const sumar = (lista: FacturaMarzo[]) => ({
    facturas: lista.length,
    total: redondear(lista.reduce((s, f) => s + f.total, 0)),
    subtotal: redondear(lista.reduce((s, f) => s + f.subtotal, 0)),
    itbis: redondear(lista.reduce((s, f) => s + f.itbis, 0)),
  });

  await page.goto(`${BASE}/dashboard/reportes/607?desde=2023-03-01&hasta=2023-03-31`, {
    waitUntil: "domcontentloaded",
    timeout: TIMEOUT_PANTALLA_MS,
  });
  await page.waitForLoadState("networkidle", { timeout: TIMEOUT_PANTALLA_MS });
  const tarjetas607 = await leerTarjetas(page, ["Registros", "Monto facturado", "ITBIS facturado"]);
  const aviso607 = await page
    .locator("body")
    .innerText()
    .then((texto) => {
      const linea = texto.split("\n").find((l) => /No se pudo|error/i.test(l) && l.length < 300);
      return linea ?? null;
    })
    .catch(() => null);

  await page.goto(`${BASE}/dashboard/reportes/ventas-generales?desde=2023-03-01&hasta=2023-03-31`, {
    waitUntil: "domcontentloaded",
    timeout: TIMEOUT_PANTALLA_MS,
  });
  await page.waitForLoadState("networkidle", { timeout: TIMEOUT_PANTALLA_MS });
  const tarjetasVentas = await leerTarjetas(page, ["Ventas brutas", "Impuestos"]);
  const textoPagina = await page.locator("body").innerText();
  const coincidencia = /Mostrando\s+\d+\s*[–-]\s*\d+\s+de\s+([\d.,]+)/.exec(textoPagina);

  const salida: CorteMil = {
    facturasMarzo2023Totales: totales ?? 0,
    facturasMarzo2023SinAnuladas: sinAnuladas.length,
    notasCreditoMarzo2023: nc ?? 0,
    filasEsperadas607: sinAnuladas.length + (nc ?? 0),
    nuestrasFacturasMarzo: sumar(nuestras),
    totalesTodasFacturasMarzo: sumar(sinAnuladas),
    reporte607: {
      registros: numeroDeTexto(tarjetas607.Registros ?? null),
      montoFacturado: numeroDeTexto(tarjetas607["Monto facturado"] ?? null),
      itbisFacturado: numeroDeTexto(tarjetas607["ITBIS facturado"] ?? null),
    },
    ventasGenerales: {
      totalFilas: coincidencia ? numeroDeTexto(coincidencia[1] ?? null) : null,
      ventasBrutas: numeroDeTexto(tarjetasVentas["Ventas brutas"] ?? null),
      impuestos: numeroDeTexto(tarjetasVentas.Impuestos ?? null),
    },
    aviso607,
  };

  escribir(
    `corte 1,000 — reales marzo: ${salida.facturasMarzo2023SinAnuladas} facturas + ${salida.notasCreditoMarzo2023} NC; ` +
      `607 registros: ${salida.reporte607.registros ?? "?"}; ventas generales: ${salida.ventasGenerales.totalFilas ?? "?"}`,
  );
  return salida;
}

async function entrar(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

async function medirPagina(page: Page, pantalla: Pantalla): Promise<Muestra> {
  const inicio = performance.now();
  try {
    await page.goto(`${BASE}${pantalla.url}`, { waitUntil: "domcontentloaded", timeout: TIMEOUT_PANTALLA_MS });
    await page.waitForLoadState("networkidle", { timeout: TIMEOUT_PANTALLA_MS });
    if (pantalla.selector) {
      await page.waitForSelector(pantalla.selector, { state: "visible", timeout: 15_000 });
    } else {
      await page.waitForFunction(() => (document.querySelector("main")?.innerText.trim().length ?? 0) > 80, undefined, {
        timeout: 15_000,
      });
    }
    return { nombre: pantalla.nombre, url: pantalla.url, ms: Math.round(performance.now() - inicio), error: null };
  } catch (error) {
    return {
      nombre: pantalla.nombre,
      url: pantalla.url,
      ms: Math.round(performance.now() - inicio),
      error: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
    };
  }
}

async function main() {
  const raiz = resolve(__dirname, "..", "..");
  const entorno = cargarEntorno(raiz);
  const usuario = entorno.usuarios[0];
  if (!usuario) throw new Error("sin usuario de prueba");

  // ids reales para las fichas (solo lectura)
  const clientes = await clientesAutenticados(entorno);
  const cli = clientes[0];
  if (!cli) throw new Error("sin cliente");
  const [factura, cliente, producto, compra] = await Promise.all([
    cli
      .from("facturas")
      .select("id")
      .neq("estado", "anulada")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
    cli.from("contactos").select("id").like("nombre", "ZZTEST-Cliente-%").limit(1).maybeSingle(),
    cli.from("productos").select("id").like("nombre", "ZZTEST-Producto-%").limit(1).maybeSingle(),
    cli.from("facturas_proveedor").select("id").like("notas", "ZZTEST-L1%").limit(1).maybeSingle(),
  ]);
  const idFactura = factura.data?.id ?? "";
  const idCliente = cliente.data?.id ?? "";
  const idProducto = producto.data?.id ?? "";
  const idCompra = compra.data?.id ?? "";
  escribir(
    `fichas: factura=${idFactura.slice(0, 8)} cliente=${idCliente.slice(0, 8)} producto=${idProducto.slice(0, 8)} compra=${idCompra.slice(0, 8)}`,
  );

  const MARZO = "desde=2023-03-01&hasta=2023-03-31";
  const ANIO = "desde=2023-01-01&hasta=2023-12-31";
  const reportes = [
    ["607", "607"],
    ["606", "606"],
    ["libro-diario", "libro-diario"],
    ["balance-comprobacion", "balance-comprobacion"],
    ["estado-resultados", "estado-resultados"],
    ["ventas-generales", "ventas-generales"],
    ["ventas-cliente", "ventas-cliente"],
    ["valor-inventario", "valor-inventario"],
  ] as const;

  const pantallas: Pantalla[] = [
    { nombre: "inicio", url: "/dashboard", selector: "text=Resumen del negocio" },
    { nombre: "facturas", url: "/dashboard/facturacion", selector: "table tbody tr" },
    ...(idFactura
      ? [{ nombre: "factura-ficha", url: `/dashboard/facturacion/${idFactura}`, selector: "main h1, main h2" }]
      : []),
    { nombre: "compras", url: "/dashboard/compras", selector: "table tbody tr" },
    ...(idCompra
      ? [{ nombre: "compra-ficha", url: `/dashboard/compras/${idCompra}`, selector: "main h1, main h2" }]
      : []),
    { nombre: "pagos-recibidos", url: "/dashboard/pagos-recibidos", selector: "table tbody tr" },
    { nombre: "contactos", url: "/dashboard/contactos", selector: "table tbody tr" },
    ...(idCliente
      ? [
          {
            nombre: "cliente-estado-cuenta",
            url: `/dashboard/contactos/${idCliente}/estado-cuenta`,
            selector: "table tbody tr",
          },
        ]
      : []),
    { nombre: "productos", url: "/dashboard/productos", selector: "table tbody tr" },
    ...(idProducto
      ? [{ nombre: "producto-ficha", url: `/dashboard/productos/${idProducto}`, selector: "main h1, main h2" }]
      : []),
    { nombre: "catalogo-cuentas", url: "/dashboard/contabilidad" },
    { nombre: "cxc-corte-2023", url: `/dashboard/reportes/cxc?desde=2020-01-01&hasta=2023-12-31` },
    ...reportes.flatMap(([nombre, ruta]) => [
      { nombre: `${nombre}-marzo2023`, url: `/dashboard/reportes/${ruta}?${MARZO}` },
      { nombre: `${nombre}-anio2023`, url: `/dashboard/reportes/${ruta}?${ANIO}` },
    ]),
  ];

  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await contexto.newPage();
  const erroresConsola: string[] = [];
  page.on("pageerror", (e) => erroresConsola.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on("console", (m) => {
    if (m.type() === "error") erroresConsola.push(`console: ${m.text().slice(0, 200)}`);
  });

  escribir(`login como ${usuario.email}`);
  await entrar(page, usuario.email, usuario.password);
  escribir("sesión lista — midiendo pantallas");

  const muestras: Muestra[] = [];
  for (const pantalla of pantallas) {
    for (let i = 0; i < REPETICIONES; i++) {
      const m = await medirPagina(page, pantalla);
      muestras.push(m);
      escribir(`${pantalla.nombre} #${i + 1}: ${m.ms}ms${m.error ? ` ERROR ${m.error}` : ""}`);
    }
  }

  const porPantalla: Record<string, { p50: number; p95: number; maximo: number; intentos: number; errores: number }> =
    {};
  for (const p of pantallas) {
    const ms = muestras.filter((m) => m.nombre === p.nombre).map((m) => m.ms);
    const errs = muestras.filter((m) => m.nombre === p.nombre && m.error).length;
    porPantalla[p.nombre] = {
      p50: percentil(ms, 50),
      p95: percentil(ms, 95),
      maximo: Math.max(0, ...ms),
      intentos: ms.length,
      errores: errs,
    };
  }

  escribir("midiendo corte de 1,000 filas y totales de marzo 2023");
  const corte = await corteMil(page, cli);

  const salida = {
    generado: new Date().toISOString(),
    base: BASE,
    repeticiones: REPETICIONES,
    tiempos: porPantalla,
    muestras,
    erroresConsola: [...new Set(erroresConsola)].slice(0, 50),
    corte1000: corte,
  };
  writeFileSync(resolve(raiz, "docs", "pruebas", "resultados", "tiempos-ui.json"), JSON.stringify(salida, null, 2));
  escribir("fin — docs/pruebas/resultados/tiempos-ui.json");

  await navegador.close();
}

main().catch((error) => {
  console.error("UI ERROR:", error instanceof Error ? error.message : error);
  process.exit(1);
});

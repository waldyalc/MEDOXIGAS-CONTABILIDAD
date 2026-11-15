import { type BrowserContext, chromium, type Page } from "@playwright/test";

import { cargarEntorno, clientesAutenticados, escribir } from "./_comun";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.UI_BASE ?? "http://localhost:3001";
const DURACION_MS = 180_000;

interface MuestraUi {
  usuario: number;
  pantalla: string;
  ms: number;
  blanco: boolean;
  error: string | null;
}

interface ResultadoUsuario {
  usuario: number;
  facturasCreadas: number;
  facturaId: string | null;
  errorFactura: string | null;
  maxMs: number;
  pantallasSobre5s: number;
  blancos: number;
  erroresConsola: string[];
}

async function entrar(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

async function medirVisita(page: Page, usuario: number, pantalla: string, url: string): Promise<MuestraUi> {
  const inicio = performance.now();
  try {
    await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 30_000 });
    const texto = await page.evaluate(() => document.body?.innerText.trim().length ?? 0);
    return {
      usuario,
      pantalla,
      ms: Math.round(performance.now() - inicio),
      blanco: texto < 50,
      error: null,
    };
  } catch (error) {
    return {
      usuario,
      pantalla,
      ms: Math.round(performance.now() - inicio),
      blanco: false,
      error: error instanceof Error ? error.message.slice(0, 160) : String(error).slice(0, 160),
    };
  }
}

async function crearFacturaUi(page: Page, cliente: string, producto: string, notas: string) {
  await page.goto(`${BASE}/dashboard/facturacion/nueva`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 30_000 });

  // cliente (combobox)
  const comboCliente = page.getByPlaceholder("Buscar cliente…").first();
  await comboCliente.click();
  await comboCliente.fill(cliente);
  await page
    .getByRole("option", { name: new RegExp(cliente.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })
    .first()
    .click({ timeout: 10_000 });

  // producto de la línea 1
  const comboProducto = page.getByLabel("Producto de la línea 1");
  await comboProducto.click();
  await comboProducto.fill(producto);
  await page
    .getByRole("option", { name: new RegExp(producto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })
    .first()
    .click({ timeout: 10_000 });

  // cantidad y precio
  await page.getByLabel("Cantidad de la línea 1").fill("1");
  const precio = page.getByLabel("Precio de la línea 1");
  if ((await precio.inputValue()) === "") await precio.fill("100");

  // notas con marcador
  const notasCampo = page.getByPlaceholder("Notas internas o para el cliente");
  if (await notasCampo.count()) await notasCampo.first().fill(notas);

  await page.getByRole("button", { name: "Guardar factura" }).click();
  await page.waitForURL(/\/dashboard\/facturacion(\/|$|\?)/, { timeout: 45_000 });
  const coincidencia = /\/dashboard\/facturacion\/([0-9a-f-]{36})/.exec(page.url());
  return coincidencia?.[1] ?? null;
}

async function trabajarUsuario(
  contexto: BrowserContext,
  usuario: number,
  datos: { cliente: string; producto: string; notas: string },
  pantallas: { nombre: string; url: string }[],
  limite: number,
): Promise<{ resultado: ResultadoUsuario; muestras: MuestraUi[] }> {
  const page = await contexto.newPage();
  const erroresConsola: string[] = [];
  page.on("pageerror", (e) => erroresConsola.push(`pageerror: ${String(e).slice(0, 160)}`));
  page.on("console", (m) => {
    if (m.type() === "error") erroresConsola.push(`console: ${m.text().slice(0, 160)}`);
  });

  const env = cargarEntorno(resolve(__dirname, "..", ".."));
  const cred = env.usuarios[usuario - 1];
  if (!cred) throw new Error(`sin credenciales usuario ${usuario}`);
  await entrar(page, cred.email, cred.password);

  const muestras: MuestraUi[] = [];
  let facturasCreadas = 0;
  let facturaId: string | null = null;
  let errorFactura: string | null = null;

  // una factura por usuario vía UI
  try {
    facturaId = await crearFacturaUi(page, datos.cliente, datos.producto, datos.notas);
    facturasCreadas = 1;
    escribir(`C8 U${usuario}: factura UI creada ${facturaId ?? ""}`);
  } catch (error) {
    errorFactura = error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200);
    escribir(`C8 U${usuario}: ERROR creando factura UI — ${errorFactura}`);
  }

  let i = 0;
  while (Date.now() < limite) {
    const p = pantallas[i % pantallas.length];
    i += 1;
    if (!p) break;
    const m = await medirVisita(page, usuario, p.nombre, p.url);
    muestras.push(m);
    await page.waitForTimeout(1500 + Math.floor(Math.random() * 2500));
  }

  const tiempos = muestras.map((m) => m.ms);
  return {
    resultado: {
      usuario,
      facturasCreadas,
      facturaId,
      errorFactura,
      maxMs: Math.max(0, ...tiempos),
      pantallasSobre5s: muestras.filter((m) => m.ms > 5000).length,
      blancos: muestras.filter((m) => m.blanco).length,
      erroresConsola: [...new Set(erroresConsola)].slice(0, 20),
    },
    muestras,
  };
}

async function main() {
  const raiz = resolve(__dirname, "..", "..");
  const entorno = cargarEntorno(raiz);
  const clientes = await clientesAutenticados(entorno);
  const cli0 = clientes[0];
  if (!cli0) throw new Error("sin cliente");

  // datos ZZTEST-C8 por usuario (contacto + servicio exento)
  const datosUsuarios: { cliente: string; producto: string; notas: string }[] = [];
  for (let u = 1; u <= 5; u++) {
    const nombreCliente = `ZZTEST-C8-U${u}-Cliente`;
    const nombreProducto = `ZZTEST-C8-U${u}-Servicio`;
    const { data: impuestos } = await cli0
      .from("impuestos")
      .select("id")
      .eq("codigo", "exento")
      .eq("activo", true)
      .limit(1);
    const impuestoId = impuestos?.[0]?.id;
    if (!impuestoId) throw new Error("sin impuesto exento");
    const { data: cid, error: e1 } = await cli0.rpc("crear_contacto", {
      p: {
        tipo: "cliente",
        nombre: nombreCliente,
        tipo_identificacion: "rnc",
        rnc_cedula: `88${String(u).padStart(7, "0")}`,
      },
    });
    const { data: pid, error: e2 } = await cli0.rpc("crear_producto", {
      p: {
        tipo: "servicio",
        nombre: nombreProducto,
        precio: 100,
        itbis_tasa: 0,
        impuesto_id: impuestoId,
        inventariable: false,
        cantidad: 0,
        costo: 0,
      },
    });
    if (e1 || e2 || typeof cid !== "string" || typeof pid !== "string") {
      throw new Error(`C8: datos base U${u} fallaron: ${e1?.message ?? ""} ${e2?.message ?? ""}`);
    }
    datosUsuarios.push({ cliente: nombreCliente, producto: nombreProducto, notas: `ZZTEST-C8 U${u}` });
    void cid;
    void pid;
  }

  // ficha de factura para navegar (solo lectura)
  const { data: factura } = await cli0
    .from("facturas")
    .select("id")
    .neq("estado", "anulada")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();
  const idFactura = factura?.id ?? "";

  const pantallas = [
    { nombre: "facturas", url: "/dashboard/facturacion" },
    { nombre: "compras", url: "/dashboard/compras" },
    { nombre: "pagos", url: "/dashboard/pagos-recibidos" },
    { nombre: "contactos", url: "/dashboard/contactos" },
    { nombre: "productos", url: "/dashboard/productos" },
    ...(idFactura ? [{ nombre: "factura-ficha", url: `/dashboard/facturacion/${idFactura}` }] : []),
  ];

  const navegador = await chromium.launch();
  const limite = Date.now() + DURACION_MS;
  const trabajos = datosUsuarios.map(async (datos, idx) => {
    const contexto = await navegador.newContext({ viewport: { width: 1366, height: 768 } });
    try {
      return await trabajarUsuario(contexto, idx + 1, datos, pantallas, limite);
    } finally {
      await contexto.close();
    }
  });
  const resultados = await Promise.all(trabajos);
  await navegador.close();

  const muestras = resultados.flatMap((r) => r.muestras);
  const porUsuario = resultados.map((r) => r.resultado);
  const pasa =
    porUsuario.every((u) => u.facturasCreadas === 1) && muestras.every((m) => m.ms <= 5000 && !m.blanco && !m.error);

  // fusionar con concurrencia.json si existe
  const rutaConc = resolve(raiz, "docs", "pruebas", "resultados", "concurrencia.json");
  let salida: Record<string, unknown> = {};
  try {
    salida = JSON.parse(readFileSync(rutaConc, "utf8")) as Record<string, unknown>;
  } catch {
    salida = {};
  }
  const escenarios = (salida.escenarios ?? {}) as Record<string, unknown>;
  escenarios.C8 = {
    esperado: "5 navegadores 3 min: ninguna pantalla >5 s ni en blanco; 1 factura UI por usuario",
    real: {
      usuarios: porUsuario,
      totalMuestras: muestras.length,
      maxMsGlobal: Math.max(0, ...muestras.map((m) => m.ms)),
      muestrasSobre5s: muestras.filter((m) => m.ms > 5000).length,
      blancos: muestras.filter((m) => m.blanco).length,
      errores: muestras.filter((m) => m.error).length,
    },
    pasa,
    ids: porUsuario.map((u) => u.facturaId).filter((x): x is string => x != null),
    errores: Object.fromEntries(
      porUsuario.filter((u) => u.errorFactura).map((u) => [`U${u.usuario}`, u.errorFactura ?? ""]),
    ),
  };
  salida.escenarios = escenarios;
  salida.generado = new Date().toISOString();
  writeFileSync(rutaConc, JSON.stringify(salida, null, 2));

  // detalle aparte para análisis
  writeFileSync(
    resolve(raiz, "docs", "pruebas", "resultados", "c8-muestras.json"),
    JSON.stringify({ generado: new Date().toISOString(), usuarios: porUsuario, muestras }, null, 2),
  );

  escribir(
    `C8: ${pasa ? "PASA" : "NO PASA"} — ${muestras.length} visitas, max ${Math.max(0, ...muestras.map((m) => m.ms))}ms`,
  );
}

main().catch((error) => {
  console.error("C8 ERROR:", error instanceof Error ? error.message : error);
  process.exit(1);
});

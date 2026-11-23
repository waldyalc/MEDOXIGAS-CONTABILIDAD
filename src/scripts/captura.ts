/**
 * pnpm captura — capturas estándar de una ruta (regla de Waldy, 22-11-2026).
 *
 * Uso:
 *   pnpm captura --ruta /pos --salida /root/referencias/capturas-terminadas
 *   pnpm captura --ruta /pos/pagos --base http://localhost:3011 --salida /tmp/caps
 *
 * - Tres tomas por ruta: claro 1440×900, oscuro 1440×900 y móvil 390×844.
 * - Sesión ZZTEST en storageState FUERA del repo
 *   ($MEDOXIGAS_STORAGE_STATE o ~/.medoxigas/storage-zztest.json, chmod 600);
 *   se renueva sola si caducó o si el origen cambia (cae en /login y re-entra).
 * - Credenciales: env ZZTEST_USER/ZZTEST_PASS o .env.pruebas (del worktree o
 *   del checkout principal). Nunca se imprimen.
 * - FALLA (exit 1) ante console.error, pageerror o respuestas HTTP >= 500.
 */

import { type Browser, chromium, type Page } from "@playwright/test";

import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const DESKTOP = { width: 1440, height: 900 };
const MOVIL = { width: 390, height: 844 };
const SALIDA_DEFECTO = "/root/referencias/capturas-terminadas";
const ESPERA_RED_MS = 15_000;
const ESPERA_FIJA_MS = 800;

interface Args {
  ruta: string;
  salida: string;
  base: string;
}

function parsearArgs(argv: string[]): Args {
  const args: Partial<Args> = {};
  for (let i = 0; i < argv.length; i++) {
    const clave = argv[i];
    const valor = argv[i + 1];
    if ((clave === "--ruta" || clave === "--salida" || clave === "--base") && valor) {
      args[clave.slice(2) as keyof Args] = valor;
      i++;
    }
  }
  if (!args.ruta) {
    console.error("Falta --ruta. Uso: pnpm captura --ruta /pos --salida <carpeta> [--base http://localhost:3010]");
    process.exit(2);
  }
  return {
    ruta: args.ruta.startsWith("/") ? args.ruta : `/${args.ruta}`,
    salida: args.salida ?? join(SALIDA_DEFECTO, new Date().toISOString().slice(0, 10)),
    base: (args.base ?? process.env.E2E_BASE_URL ?? "http://localhost:3010").replace(/\/$/, ""),
  };
}

function checkoutPrincipal(): string {
  try {
    const comun = execFileSync("git", ["rev-parse", "--git-common-dir"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return dirname(resolve(comun));
  } catch {
    return process.cwd();
  }
}

/** Lee ZZTEST_USER/ZZTEST_PASS del entorno o de .env.pruebas (sin imprimirlos). */
function credenciales(): { user: string; pass: string } {
  const user = process.env.ZZTEST_USER;
  const pass = process.env.ZZTEST_PASS;
  if (user && pass) return { user, pass };

  const candidatos = [join(process.cwd(), ".env.pruebas"), join(checkoutPrincipal(), ".env.pruebas")];
  for (const archivo of candidatos) {
    if (!existsSync(archivo)) continue;
    const env: Record<string, string> = {};
    for (const linea of readFileSync(archivo, "utf8").split("\n")) {
      const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(linea);
      if (m?.[1]) env[m[1]] = (m[2] ?? "").replace(/^["']|["']$/g, "");
    }
    if (env.ZZTEST_USER && env.ZZTEST_PASS) return { user: env.ZZTEST_USER, pass: env.ZZTEST_PASS };
  }
  console.error("Sin credenciales ZZTEST: define ZZTEST_USER/ZZTEST_PASS o ten .env.pruebas en el checkout.");
  process.exit(2);
}

function rutaStorageState(): string {
  const ruta = process.env.MEDOXIGAS_STORAGE_STATE ?? join(homedir(), ".medoxigas", "storage-zztest.json");
  mkdirSync(dirname(ruta), { recursive: true, mode: 0o700 });
  return ruta;
}

async function renovarSesion(page: Page, base: string): Promise<void> {
  const { user, pass } = credenciales();
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByLabel("Correo").fill(user);
  await page.getByLabel("Contraseña").fill(pass);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/(dashboard|pos|unauthorized)/, { timeout: 60_000 });
  if (page.url().includes("/unauthorized")) {
    throw new Error("ZZTEST entró pero no tiene perfil (cae en /unauthorized).");
  }
}

function vigilar(page: Page, errores: string[]): void {
  page.on("pageerror", (error) => errores.push(`pageerror: ${error}`));
  page.on("console", (mensaje) => {
    // Base UI avisa por console.error solo en dev; no es un error del flujo.
    if (mensaje.type() === "error" && !mensaje.text().startsWith("Base UI:")) {
      errores.push(`console.error: ${mensaje.text()}`);
    }
  });
  page.on("response", (respuesta) => {
    if (respuesta.status() >= 500) errores.push(`HTTP ${respuesta.status()}: ${respuesta.url()}`);
  });
}

async function cargar(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  // Dev server a veces no llega a networkidle (HMR); se sigue con la espera fija.
  await page.waitForLoadState("networkidle", { timeout: ESPERA_RED_MS }).catch(() => undefined);
  await page.waitForTimeout(ESPERA_FIJA_MS);
}

async function ponerTema(page: Page, oscuro: boolean): Promise<void> {
  // Replica applyThemeMode de src/lib/preferences/theme-utils.ts.
  await page.evaluate((dark) => {
    const el = document.documentElement;
    el.setAttribute("data-theme-mode", dark ? "dark" : "light");
    el.classList.toggle("dark", dark);
    el.style.colorScheme = dark ? "dark" : "light";
  }, oscuro);
  await page.waitForTimeout(300);
}

async function tomar(
  browser: Browser,
  args: Args,
  statePath: string,
  variante: "claro" | "oscuro" | "movil",
  errores: string[],
): Promise<string> {
  const movil = variante === "movil";
  const contexto = await browser.newContext({
    storageState: statePath,
    viewport: movil ? MOVIL : DESKTOP,
    isMobile: movil,
    hasTouch: movil,
    colorScheme: "light",
  });
  const page = await contexto.newPage();
  vigilar(page, errores);
  await cargar(page, `${args.base}${args.ruta}`);
  if (variante === "oscuro") await ponerTema(page, true);
  const archivo = join(
    args.salida,
    `${args.ruta === "/" ? "inicio" : args.ruta.replaceAll("/", "-").slice(1)}-${variante}.png`,
  );
  await page.screenshot({ path: archivo, fullPage: true });
  await contexto.close();
  return archivo;
}

async function main(): Promise<void> {
  const args = parsearArgs(process.argv.slice(2));
  const statePath = rutaStorageState();
  mkdirSync(args.salida, { recursive: true });
  const errores: string[] = [];
  const browser = await chromium.launch({ headless: true });

  try {
    // 1) Verifica/renueva la sesión ZZTEST una sola vez.
    const hayEstado = (() => {
      if (!existsSync(statePath)) return false;
      try {
        JSON.parse(readFileSync(statePath, "utf8"));
        return true;
      } catch {
        return false;
      }
    })();
    const ctx = await browser.newContext({ storageState: hayEstado ? statePath : undefined });
    const page = await ctx.newPage();
    await cargar(page, `${args.base}${args.ruta}`);
    if (page.url().includes("/login")) {
      await renovarSesion(page, args.base);
      await ctx.storageState({ path: statePath });
      chmodSync(statePath, 0o600);
      console.log("Sesión ZZTEST renovada y guardada (fuera del repo).");
    } else if (!hayEstado) {
      await ctx.storageState({ path: statePath });
      chmodSync(statePath, 0o600);
    }
    await ctx.close();

    // 2) Las tres tomas.
    for (const variante of ["claro", "oscuro", "movil"] as const) {
      const archivo = await tomar(browser, args, statePath, variante, errores);
      console.log(`✓ ${variante}: ${archivo}`);
    }
  } finally {
    await browser.close();
  }

  if (errores.length > 0) {
    console.error(`\nFALLÓ: ${errores.length} error(es) de consola/red:`);
    for (const e of [...new Set(errores)].slice(0, 30)) console.error(`  ${e}`);
    process.exit(1);
  }
  console.log(`\nListo: 3 capturas en ${args.salida}`);
}

main().catch((error) => {
  console.error(`captura: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});

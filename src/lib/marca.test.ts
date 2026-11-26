import { describe, expect, it } from "vitest";

import { COLOR_MARCA_PRIMARIO, COLOR_MARCA_PRIMARIO_OSCURO } from "./marca";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = join(process.cwd(), "src");
const TEAL_ALEGRA = /#00b19d|#008e79|#ccfbf1|#00c9b3|#5eead4|#30aba9|#0a9e9a|#cff2f1|#1a7e7f/i;

/**
 * `dashboard/reportes` pertenece a otra tarea delegada y no se puede tocar aquí.
 * Su categoría Administrativos todavía tiene #30ABA9; esta lista SOLO PUEDE
 * ENCOGERSE. Cuando esa tarea lo migre, borra la ruta de la lista.
 */
const PENDIENTES_REPORTES = ["app/(main)/dashboard/reportes/_components/datos-reportes.ts"];

function listar(directorio: string): string[] {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) return listar(ruta);
    return /\.(css|ts|tsx|js|jsx|mjs|mts|json|svg)$/.test(entrada.name) && !/\.test\.[cm]?[tj]sx?$/.test(entrada.name)
      ? [ruta]
      : [];
  });
}

function rutaRelativa(ruta: string) {
  return relative(SRC, ruta).split(sep).join("/");
}

function leer(ruta: string) {
  return readFileSync(join(process.cwd(), ruta), "utf8");
}

describe("color global de marca", () => {
  it("expone la fuente única en TypeScript", () => {
    expect(COLOR_MARCA_PRIMARIO).toBe("#1e56c7");
    expect(COLOR_MARCA_PRIMARIO_OSCURO).toBe("#4d7fd6");
  });

  it("la PWA, los iconos y las preferencias consumen la fuente única", () => {
    const manifiesto = leer("src/app/manifest.ts");
    expect(manifiesto).toContain('import { COLOR_MARCA_PRIMARIO } from "@/lib/marca";');
    expect(manifiesto).toContain("theme_color: COLOR_MARCA_PRIMARIO");

    const icono = leer("src/lib/app-icon.tsx");
    expect(icono).toContain('import { COLOR_MARCA_PRIMARIO } from "@/lib/marca";');
    expect(icono).toContain("background: COLOR_MARCA_PRIMARIO");

    const tema = leer("src/lib/preferences/theme.ts");
    expect(tema).toContain('from "@/lib/marca"');
    expect(tema).toContain("light: COLOR_MARCA_PRIMARIO");
    expect(tema).toContain("dark: COLOR_MARCA_PRIMARIO_OSCURO");
  });

  it("globals.css define la marca y hace derivar el sistema y el POS", () => {
    const css = leer("src/app/globals.css");

    expect(css).toContain("--brand-primary: #1e56c7;");
    expect(css).toContain("--brand-primary-dark: #4d7fd6;");
    expect(css).toContain("--color-brand-primary: var(--brand-primary);");
    expect(css).toContain("--primary: var(--brand-primary);");
    expect(css).toContain("--primary: var(--brand-primary-dark);");
    expect(css).toContain("--ring: var(--brand-primary);");
    expect(css).toContain("--ring: var(--brand-primary-dark);");
    expect(css).toContain("--sidebar-primary: var(--brand-primary);");
    expect(css).toContain("--sidebar-primary: var(--brand-primary-dark);");
    expect(css).toContain("--chart-1: var(--brand-primary);");
    expect(css).toContain("--chart-1: var(--brand-primary-dark);");
    expect(css).toContain("--pos-primario: var(--primary);");
    expect(css).toContain("--pos-primario-hover: color-mix(in srgb, var(--primary) 84%, black);");
    expect(css).toContain("--pos-acento: color-mix(in srgb, var(--primary) 12%, white);");
    expect(css).toContain("--pos-acento-texto: color-mix(in srgb, var(--primary) 88%, black);");
    expect(css).not.toMatch(TEAL_ALEGRA);
    expect(css).not.toContain("181.912");
  });

  it("el preset Medoxigas deriva sus acentos principales de la marca", () => {
    const preset = leer("src/styles/presets/medoxigas.css");

    for (const token of ["--primary", "--ring", "--chart-1", "--sidebar-primary", "--sidebar-ring"]) {
      expect(preset, `Falta ${token} claro derivado de la marca`).toContain(`${token}: var(--brand-primary);`);
      expect(preset, `Falta ${token} oscuro derivado de la marca`).toContain(`${token}: var(--brand-primary-dark);`);
    }
    expect(preset).toContain("--secondary: color-mix(in srgb, var(--primary) 10%, white);");
    expect(preset).toContain("--accent: color-mix(in srgb, var(--primary) 10%, white);");
  });

  it("ningún archivo de src conserva el teal de Alegra", () => {
    const infractores = listar(SRC)
      .filter((ruta) => TEAL_ALEGRA.test(readFileSync(ruta, "utf8")))
      .map(rutaRelativa);
    const nuevos = infractores.filter((ruta) => !PENDIENTES_REPORTES.includes(ruta));

    expect(
      nuevos,
      `Usa --brand-primary, --primary o los tokens que derivan de ellos; no hex teal de Alegra: ${nuevos.join(", ")}`,
    ).toEqual([]);
    expect(
      infractores,
      "La excepción temporal de reportes solo puede encoger; cuando se migre datos-reportes.ts, bórrala de PENDIENTES_REPORTES",
    ).toEqual([...PENDIENTES_REPORTES].sort());
  });
});

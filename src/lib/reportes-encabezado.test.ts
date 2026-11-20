import { describe, expect, it } from "vitest";

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const REPORTES = join(process.cwd(), "src", "app", "(main)", "dashboard", "reportes");
const COMPONENTE = join(REPORTES, "_components", "encabezado-reporte.tsx");

/**
 * 606/607/608 no pintan su propio encabezado: el marco vive en el componente
 * compartido ReporteDgii, que a su vez debe usar EncabezadoReporte.
 */
const ENCABEZADO_COMPARTIDO: Record<string, string> = {
  "606/page.tsx": "fiscales/_components/reporte-dgii.tsx",
  "607/page.tsx": "fiscales/_components/reporte-dgii.tsx",
  "608/page.tsx": "fiscales/_components/reporte-dgii.tsx",
};

const AYUDA =
  "Usa <EncabezadoReporte titulo=... descripcion=... desde=... hasta=... /> de reportes/_components/encabezado-reporte.tsx " +
  "(o <EncabezadoPagina> si es el hub): el título, las migas de pan y el botón Imprimir salen de un solo marco. " +
  "No escribas un h1 suelto ni migas a mano.";

function listarPaginas(archivo: string): string[] {
  return readdirSync(archivo, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(archivo, entrada.name);
    if (entrada.isDirectory()) return listarPaginas(ruta);
    return entrada.name === "page.tsx" ? [ruta] : [];
  });
}

function rutaRelativa(ruta: string) {
  return relative(REPORTES, ruta).split(sep).join("/");
}

function leer(ruta: string): string {
  return readFileSync(join(REPORTES, ruta), "utf8");
}

function usaMarco(texto: string): boolean {
  const importa =
    /from "[^"]*\/_components\/encabezado-reporte"/.test(texto) ||
    /from "@\/components\/pagina\/encabezado-pagina"/.test(texto);
  const usa = /<EncabezadoReporte\b/.test(texto) || /<EncabezadoPagina\b/.test(texto);
  return importa && usa;
}

/** Todos los reportes, menos el hub `/dashboard/reportes`. */
const PAGINAS = listarPaginas(REPORTES)
  .map(rutaRelativa)
  .filter((ruta) => ruta !== "page.tsx");

describe("encabezado de los reportes", () => {
  it("cada reporte usa EncabezadoReporte o EncabezadoPagina", () => {
    const infractores = PAGINAS.filter((ruta) => {
      const compartido = ENCABEZADO_COMPARTIDO[ruta];
      if (compartido) {
        return !/<ReporteDgii\b/.test(leer(ruta)) || !usaMarco(leer(compartido));
      }
      return !usaMarco(leer(ruta));
    });

    expect(infractores, AYUDA).toEqual([]);
  });

  it("ningún reporte deja un h1 suelto en su page.tsx", () => {
    const infractores = PAGINAS.filter((ruta) => /<h1[\s>]/.test(leer(ruta)));

    expect(infractores, AYUDA).toEqual([]);
  });

  it("el encabezado compartido de la DGII tampoco vuelve a su h1 propio", () => {
    const compartido = leer("fiscales/_components/reporte-dgii.tsx");

    expect(/<h1[\s>]/.test(compartido), AYUDA).toBe(false);
  });

  it("EncabezadoReporte arma Inicio / Reportes / título y permite apagar Imprimir", () => {
    const componente = readFileSync(COMPONENTE, "utf8");

    expect(componente).toContain('etiqueta: "Inicio", href: "/dashboard"');
    expect(componente).toContain('etiqueta: "Reportes", href: "/dashboard/reportes"');
    expect(componente).toContain("etiqueta: titulo");
    expect(componente).toContain("mostrarImprimir = true");
  });
});

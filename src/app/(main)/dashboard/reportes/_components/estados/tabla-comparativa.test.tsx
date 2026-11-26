import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { FilaReporte } from "@/lib/reportes/estados/tipos";

import { alternarTodasLasCuentas, formatoVariacion, TablaComparativa } from "./tabla-comparativa";

function fila(cambios: Partial<FilaReporte> & Pick<FilaReporte, "clave" | "clase" | "nombre">): FilaReporte {
  return {
    codigo: "",
    cuentaId: null,
    actual: 0,
    anterior: 0,
    porcentajeActual: 0,
    porcentajeAnterior: 0,
    variacionAbsoluta: 0,
    variacionRelativa: 0,
    ...cambios,
  };
}

const FILAS: FilaReporte[] = [
  fila({
    clave: "ingresos",
    clase: "grupo",
    nombre: "Ingresos de actividades ordinarias",
    nivel: 0,
    actual: 1_165_577_73,
    anterior: 1_769_880_49,
    porcentajeActual: 100,
    porcentajeAnterior: 100,
    variacionAbsoluta: -604_302_76,
    variacionRelativa: -41.64,
  }),
  fila({
    clave: "4101",
    clase: "detalle",
    codigo: "4101",
    nombre: "Ventas",
    nivel: 1,
    actual: 1_165_577_73,
    anterior: 1_769_880_49,
    porcentajeActual: 100,
    porcentajeAnterior: 100,
    variacionAbsoluta: -604_302_76,
    variacionRelativa: -41.76,
  }),
  fila({
    clave: "4102",
    clase: "detalle",
    codigo: "4102",
    nombre: "Devoluciones en ventas",
    nivel: 1,
    contra: true,
    actual: 0,
    anterior: -50_778_50,
    porcentajeActual: 0,
    porcentajeAnterior: 0.2,
    variacionAbsoluta: 50_778_50,
    variacionRelativa: -100,
  }),
  fila({
    clave: "utilidad-bruta",
    clase: "total",
    nombre: "Utilidad bruta",
    nivel: 0,
    actual: 263_925_26,
    anterior: 426_030_90,
    porcentajeActual: 22.64,
    porcentajeAnterior: 24.07,
    variacionAbsoluta: -162_105_64,
    variacionRelativa: -54.24,
  }),
];

function tabla(expandible?: boolean, rotuloCuenta = "Cuenta contable", conEncabezado = false) {
  return renderToStaticMarkup(
    <TablaComparativa
      filas={FILAS}
      rotuloCuenta={rotuloCuenta}
      rotuloActual="Ene - Dic, 2026"
      rotuloAnterior="Ene - Dic, 2025"
      rotuloPorcentaje="% de Ingresos"
      expandible={expandible}
      encabezado={
        conEncabezado
          ? {
              accion: "/dashboard/reportes/estado-resultados",
              etiquetaRango: "Del 1 de enero al 31 de diciembre: Comparativo 2026 - 2025",
              busqueda: "",
              parametros: [],
            }
          : undefined
      }
    />,
  );
}

function htmlDeFila(html: string, nombre: string): string {
  return html.split("<tr").find((parte) => parte.includes(nombre)) ?? "";
}

describe("TablaComparativa", () => {
  it("muestra las 7 columnas del comparativo", () => {
    const html = tabla();

    for (const rotulo of [
      "Cuenta contable",
      "Ene - Dic, 2026",
      "% de Ingresos",
      "Ene - Dic, 2025",
      "Var. Absoluta",
      "Var. Relativa (%)",
    ]) {
      expect(html).toContain(rotulo);
    }
  });

  it("permite la primera cabecera vacía del estado de resultados y conserva divisores verticales", () => {
    const html = tabla(true, "", true);

    expect(html).not.toContain("Cuenta contable");
    expect(html).toContain("Buscar cuenta contable");
    expect(html).toContain("Del 1 de enero al 31 de diciembre: Comparativo 2026 - 2025");
    expect(html.match(/absolute top-2 right-0 bottom-2 w-px/g)?.length).toBe(6);
  });

  it("formatea Var. Relativa con hasta 2 decimales, como Alegra", () => {
    expect(formatoVariacion(-41.64)).toBe("-41.64%");
    expect(formatoVariacion(-54.24)).toBe("-54.24%");
    expect(formatoVariacion(-100)).toBe("-100%");
    expect(formatoVariacion(0)).toBe("0%");
    expect(formatoVariacion(7.5)).toBe("7.5%");
  });

  it("colorea Var. Absoluta y Var. Relativa según el signo", () => {
    const html = tabla(true);

    expect(html).toMatch(/text-rose-600 dark:text-rose-400[^>]*>-RD\$604,302\.76/);
    expect(html).toMatch(/text-rose-600 dark:text-rose-400[^>]*>-41\.64%/);
    expect(html).toMatch(/text-emerald-600 dark:text-emerald-400[^>]*>RD\$50,778\.50/);
    expect(html).toMatch(/text-rose-600 dark:text-rose-400[^>]*>-100%/);
  });

  it("pinta en rojo los periodos de las cuentas contra, sin colorear montos normales por signo", () => {
    const html = tabla(true);
    const devoluciones = htmlDeFila(html, "Devoluciones en ventas");
    const ventas = htmlDeFila(html, "Ventas");

    expect(devoluciones).toMatch(/text-rose-600 dark:text-rose-400[^>]*>RD\$0\.00/);
    expect(devoluciones).toMatch(/text-rose-600 dark:text-rose-400[^>]*>-RD\$50,778\.50/);
    expect(ventas).not.toMatch(/<td[^>]*text-(rose|emerald)-600[^>]*>RD\$1,165,577\.73/);
  });

  it("con expandible, los grupos llevan chevron abierto por defecto sin caja ni fondo gris", () => {
    const html = tabla(true);
    const grupo = htmlDeFila(html, "Ingresos de actividades ordinarias");

    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("Contraer Ingresos de actividades ordinarias");
    expect(html).toContain("Devoluciones en ventas");
    expect(grupo).toContain("bg-card");
    expect(grupo).toContain("hover:bg-transparent");
    expect(grupo).toContain("aria-expanded:bg-transparent");
    expect(grupo).not.toMatch(/bg-slate-50|bg-muted(?:\/|\s|")/);
  });

  it("sin expandible no hay chevrones (los otros reportes no cambian)", () => {
    const html = tabla();

    expect(html).not.toContain('aria-expanded="true"');
    expect(html).not.toContain("Contraer");
  });

  it("los totales son las únicas filas con fondo muted suave y texto semibold", () => {
    const html = tabla(true);
    const filaTotal = htmlDeFila(html, "Utilidad bruta");

    expect(filaTotal).toContain("bg-muted/35");
    expect(filaTotal).toContain("dark:bg-muted/25");
    expect(filaTotal).toContain("font-semibold");
    expect(filaTotal).toContain("text-sm");
  });

  it("el encabezado expandible muestra el botón de contraer todas las cuentas", () => {
    const html = tabla(true, "", true);

    expect(html).toContain('aria-label="Contraer todas las cuentas"');
    expect(html).toContain('title="Contraer todas las cuentas"');
  });

  it("el estado del botón contrae todo si queda una abierta y expande cuando todas están contraídas", () => {
    const claves = ["ingresos", "ventas"];

    const contraidasDesdeAbierto = alternarTodasLasCuentas(new Set(), claves);
    expect([...contraidasDesdeAbierto]).toEqual(claves);

    const contraidasDesdeParcial = alternarTodasLasCuentas(new Set(["ingresos"]), claves);
    expect([...contraidasDesdeParcial]).toEqual(claves);

    const expandidas = alternarTodasLasCuentas(new Set(claves), claves);
    expect(expandidas.size).toBe(0);
  });
});

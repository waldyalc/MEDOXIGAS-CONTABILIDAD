import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { FilaReporte } from "@/lib/reportes/estados/tipos";

import { readFileSync } from "node:fs";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const { TablaComparativa } = await import("./tabla-comparativa");

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
    actual: 1_760_000,
    porcentajeActual: 100,
    variacionAbsoluta: 1_760_000,
  }),
  fila({
    clave: "4101",
    clase: "detalle",
    codigo: "4101",
    nombre: "Ventas",
    actual: 1_980_000,
    porcentajeActual: 112.5,
    variacionAbsoluta: 1_980_000,
  }),
  fila({
    clave: "4102",
    clase: "detalle",
    codigo: "4102",
    nombre: "Devoluciones en ventas",
    actual: -220_000,
    porcentajeActual: 12.5,
    variacionAbsoluta: -220_000,
  }),
  fila({
    clave: "utilidad-bruta",
    clase: "total",
    nombre: "Utilidad bruta",
    actual: 623_615,
    porcentajeActual: 35.43,
    variacionAbsoluta: 623_615,
  }),
];

function tabla(expandible?: boolean) {
  return renderToStaticMarkup(
    <TablaComparativa
      filas={FILAS}
      rotuloCuenta="Cuenta contable"
      rotuloActual="Nov, 2026"
      rotuloAnterior="Nov, 2025"
      rotuloPorcentaje="% de Ingresos"
      expandible={expandible}
    />,
  );
}

describe("TablaComparativa", () => {
  it("muestra las 7 columnas del comparativo", () => {
    const html = tabla();

    for (const rotulo of [
      "Cuenta contable",
      "Nov, 2026",
      "% de Ingresos",
      "Nov, 2025",
      "Var. Absoluta",
      "Var. Relativa (%)",
    ]) {
      expect(html).toContain(rotulo);
    }
  });

  it("muestra los montos con texto plano y el prefijo -RD$, sin color por signo", () => {
    const html = tabla();

    expect(html).toContain("RD$17,600.00");
    expect(html).toContain("-RD$2,200.00");

    for (const celda of [...html.matchAll(/<td[^>]*class="([^"]*)"[^>]*>-?RD\$[\d,.]+<\/td>/g)]) {
      expect(celda[1]).not.toContain("text-destructive");
      expect(celda[1]).not.toContain("text-emerald");
    }
  });

  it("candado: la tabla comparativa no vuelve a colorear montos por signo", () => {
    // Decisión de Waldy (20-11-2026): Alegra no usa rojo/verde en los montos de
    // ningún reporte; el comparativo va con texto plano y el prefijo -RD$.
    const fuente = readFileSync(new URL("./tabla-comparativa.tsx", import.meta.url), "utf8");
    expect(fuente).not.toMatch(/text-emerald|text-destructive|colorPorSigno/);
  });

  it("con expandible, los grupos llevan chevron abierto por defecto", () => {
    const html = tabla(true);

    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("Contraer Ingresos de actividades ordinarias");
    // Las cuentas hijas siguen visibles mientras el grupo está abierto.
    expect(html).toContain("Devoluciones en ventas");
    // Sin zebra: el grupo no pinta fondo propio.
    expect(html).not.toContain("bg-muted/30");
  });

  it("sin expandible no hay chevrones (los otros reportes no cambian)", () => {
    const html = tabla();

    expect(html).not.toContain('aria-expanded="true"');
    expect(html).not.toContain("Contraer");
  });

  it("los totales van en semibold sobre fondo slate-50", () => {
    const html = tabla(true);
    const filaTotal = html.split("<tr").find((fila) => fila.includes("Utilidad bruta"));

    expect(filaTotal).toContain("bg-slate-50");
    expect(filaTotal).toContain("font-semibold");
  });
});

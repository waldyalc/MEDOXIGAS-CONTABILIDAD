import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { FilaReporte } from "@/lib/reportes/estados/tipos";

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

  it("pinta positivos en verde y negativos en rojo con prefijo -RD$", () => {
    const html = tabla();

    expect(html).toContain("RD$17,600.00");
    expect(html).toContain("-RD$2,200.00");

    const negativos = [...html.matchAll(/<td[^>]*class="([^"]*)"[^>]*>-RD\$2,200\.00<\/td>/g)];
    expect(negativos.length).toBeGreaterThan(0);
    for (const [, clases] of negativos) expect(clases).toContain("text-destructive");

    const positivo = [...html.matchAll(/<td[^>]*class="([^"]*)"[^>]*>RD\$6,236\.15<\/td>/g)];
    expect(positivo.length).toBeGreaterThan(0);
    for (const [, clases] of positivo) expect(clases).toContain("text-emerald-600");
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

  it("los totales van en semibold", () => {
    const html = tabla(true);
    const filaTotal = html.split("<tr").find((fila) => fila.includes("Utilidad bruta"));
    const clases = /class="([^"]*)"/.exec(filaTotal ?? "");

    expect(clases?.[1]).toContain("font-semibold");
  });
});

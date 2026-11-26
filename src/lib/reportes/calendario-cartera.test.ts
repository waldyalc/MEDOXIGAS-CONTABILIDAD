import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPORTES = join(process.cwd(), "src", "app", "(main)", "dashboard", "reportes");
const selector = readFileSync(join(REPORTES, "_components", "selector-fechas.tsx"), "utf8");
const cxc = readFileSync(join(REPORTES, "cxc", "page.tsx"), "utf8");
const cxp = readFileSync(join(REPORTES, "cxp", "page.tsx"), "utf8");
const filtros = readFileSync(join(REPORTES, "cxc", "_components", "filtros-cartera.tsx"), "utf8");
const tabla = readFileSync(join(REPORTES, "cxc", "_components", "tabla-cartera.tsx"), "utf8");

describe("calendario compartido de reportes", () => {
  it("tiene navegación rápida de mes y año sin selects nativos del calendario", () => {
    expect(selector).toContain("function SelectorMesAnio");
    expect(selector).toContain("OPCIONES_MES");
    expect(selector).toContain("OPCIONES_ANIO");
    expect(selector).toContain("onMonthChange={onMesChange}");
    expect(selector).not.toContain('captionLayout="dropdown"');
  });

  it("muestra dos meses en rangos de escritorio y sincroniza el mes al elegir atajos", () => {
    expect(selector).toContain("numberOfMonths={pantallaChica ? 1 : 2}");
    expect(selector).toContain("setMes(inicio)");
    expect(selector.match(/setMes\(fecha\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe("carteras CxC y CxP estilo Alegra", () => {
  it("ambas resuelven un período completo y CxC filtra emisión dentro de ese período", () => {
    expect(cxc).toContain("resolverPeriodoCartera");
    expect(cxc).toContain("filtrarPorPeriodoEmision");
    expect(cxp).toContain("resolverPeriodoCartera");
    expect(cxc).toContain("TarjetaPeriodoCartera");
    expect(cxp).toContain("TarjetaPeriodoCartera");
  });

  it("los filtros secundarios viven detrás del botón Filtrar", () => {
    expect(filtros).toContain("Filtrar");
    expect(filtros).toContain("Limpiar filtros");
    expect(filtros).toContain("NCF/Número");
    expect(filtros).toContain("Fecha de creación");
    expect(filtros).toContain("Fecha de vencimiento");
    expect(filtros).toContain("SelectorFechaFormulario");
  });

  it("marca en rojo los vencimientos vencidos", () => {
    expect(tabla).toContain("fila.diasVencida > 0");
    expect(tabla).toContain("text-rose-600");
  });
});

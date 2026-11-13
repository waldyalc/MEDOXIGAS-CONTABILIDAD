import { describe, expect, test } from "vitest";

import { CATEGORIAS_REPORTES, filtrarReportes, REPORTES, reportesPorCategoria } from "./catalogo-reportes";

describe("catálogo de reportes", () => {
  test("tiene 34 reportes en 6 categorías con el orden de Alegra", () => {
    expect(REPORTES).toHaveLength(34);
    expect(CATEGORIAS_REPORTES).toEqual([
      "Ventas",
      "Administrativos",
      "Financieros",
      "Contables",
      "Fiscales",
      "Para trabajar",
    ]);
  });

  test("reparte los reportes por categoría", () => {
    const grupos = reportesPorCategoria();

    expect(grupos.map((grupo) => grupo.categoria)).toEqual([...CATEGORIAS_REPORTES]);
    expect(grupos.map((grupo) => grupo.reportes.length)).toEqual([7, 7, 1, 9, 8, 2]);
  });

  test("los enlaces son únicos: los 7 administrativos y los 9 contables", () => {
    const rutas = REPORTES.flatMap((reporte) => (reporte.href ? [reporte.href] : []));

    expect(rutas).toHaveLength(16);
    expect(new Set(rutas).size).toBe(rutas.length);
    expect(rutas).toContain("/dashboard/reportes/cxc");
    expect(rutas).toContain("/dashboard/reportes/reporte-anual");
    expect(rutas).toContain("/dashboard/reportes/estado-resultados");
    expect(rutas).toContain("/dashboard/reportes/balanza-tercero");
  });

  test("los 7 administrativos y los 9 contables tienen enlace", () => {
    const conEnlace = REPORTES.filter((reporte) => reporte.href != null);

    expect(conEnlace.map((reporte) => reporte.nombre)).toEqual([
      "Cuentas por cobrar",
      "Cuentas por pagar",
      "Ingresos y compras",
      "Valor de inventario",
      "Transacciones",
      "Compras",
      "Reporte anual",
      "Estado de resultados",
      "Estado de situación financiera",
      "Estado de flujo de efectivo",
      "Libro diario",
      "Auxiliar por tercero",
      "Balanza de comprobación",
      "Movimientos por cuenta contable",
      "Movimientos por cuenta contable agrupado",
      "Balanza de comprobación por tercero",
    ]);
  });

  test("el buscador filtra por nombre sin importar mayúsculas ni tildes", () => {
    expect(filtrarReportes("")).toHaveLength(34);
    expect(filtrarReportes("situacion").map((reporte) => reporte.nombre)).toEqual(["Estado de situación financiera"]);
    expect(filtrarReportes("COBRAR").map((reporte) => reporte.nombre)).toEqual(["Cuentas por cobrar"]);
    expect(filtrarReportes("606").map((reporte) => reporte.nombre)).toEqual(["Reporte 606"]);
    expect(filtrarReportes("no existe")).toEqual([]);
  });
});

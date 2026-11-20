import { describe, expect, it } from "vitest";

import type { FilaReporte } from "@/lib/reportes/estados/tipos";

import { tablaEstadoResultados } from "./exportar";

const FILAS: FilaReporte[] = [
  {
    clave: "ingresos",
    clase: "grupo",
    codigo: "",
    nombre: "Ingresos de actividades ordinarias",
    cuentaId: null,
    actual: 1_760_000,
    anterior: 0,
    porcentajeActual: 100,
    porcentajeAnterior: 0,
    variacionAbsoluta: 1_760_000,
    variacionRelativa: 0,
  },
  {
    clave: "4101",
    clase: "detalle",
    codigo: "4101",
    nombre: "Ventas",
    cuentaId: null,
    actual: 1_760_000,
    anterior: 0,
    porcentajeActual: 100,
    porcentajeAnterior: 0,
    variacionAbsoluta: 1_760_000,
    variacionRelativa: 0,
  },
  {
    clave: "utilidad-bruta",
    clase: "total",
    codigo: "",
    nombre: "Utilidad bruta",
    cuentaId: null,
    actual: 623_615,
    anterior: 0,
    porcentajeActual: 35.43,
    porcentajeAnterior: 0,
    variacionAbsoluta: 623_615,
    variacionRelativa: 0,
  },
];

const ROTULOS = {
  cuenta: "Cuenta contable",
  actual: "Nov, 2026",
  anterior: "Nov, 2025",
  porcentaje: "% de Ingresos",
};

describe("tablaEstadoResultados", () => {
  it("arma las 7 columnas del reporte comparativo", () => {
    const tabla = tablaEstadoResultados(FILAS, ROTULOS, "Del 1 al 30 de noviembre: Comparativo 2026 - 2025");

    expect(tabla.titulo).toBe("Estado de resultados");
    expect(tabla.subtitulo).toBe("Del 1 al 30 de noviembre: Comparativo 2026 - 2025");
    expect(tabla.columnas.map((columna) => columna.clave)).toEqual([
      "cuenta",
      "actual",
      "porcentajeActual",
      "anterior",
      "porcentajeAnterior",
      "variacionAbsoluta",
      "variacionRelativa",
    ]);
    expect(tabla.columnas[0]?.titulo).toBe("Cuenta contable");
    expect(tabla.columnas[1]?.tipo).toBe("dinero");
    expect(tabla.columnas[2]?.tipo).toBe("porcentaje");
  });

  it("conserva códigos, estilos de fila y la indentación de las cuentas hijas", () => {
    const tabla = tablaEstadoResultados(FILAS, ROTULOS, "");

    expect(tabla.filas[0]?.estilo).toBe("grupo");
    expect(tabla.filas[0]?.celdas.cuenta).toBe("Ingresos de actividades ordinarias");
    expect(tabla.filas[1]?.estilo).toBe("normal");
    expect(tabla.filas[1]?.nivel).toBe(1);
    expect(tabla.filas[1]?.celdas.cuenta).toBe("4101 Ventas");
    expect(tabla.filas[2]?.estilo).toBe("total");
    expect(tabla.filas[2]?.nivel).toBeUndefined();
    expect(tabla.filas[2]?.celdas.actual).toBe(623_615);
  });
});

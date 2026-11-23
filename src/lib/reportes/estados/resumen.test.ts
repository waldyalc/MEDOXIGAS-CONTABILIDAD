import { describe, expect, test } from "vitest";

import { generarResumenResultados } from "./resumen";
import type { FilaReporte } from "./tipos";

function fila(cambios: Partial<FilaReporte> & Pick<FilaReporte, "clave" | "actual">): FilaReporte {
  return {
    clase: "grupo",
    codigo: "",
    nombre: cambios.clave,
    cuentaId: null,
    anterior: 0,
    porcentajeActual: 0,
    porcentajeAnterior: 0,
    variacionAbsoluta: 0,
    variacionRelativa: 0,
    ...cambios,
  };
}

const BASE: FilaReporte[] = [
  fila({ clave: "seccion-ingresos", actual: 1_794_000, anterior: 1_000_000, variacionAbsoluta: 794_000 }),
  fila({ clave: "seccion-costos", actual: -800_000 }),
  fila({ clave: "total-utilidad-bruta", actual: 994_000 }),
  fila({ clave: "total-utilidad-neta", actual: 300_000 }),
];

describe("generarResumenResultados", () => {
  test("redacta el párrafo con los montos del reporte, como el resumen de Alegra", () => {
    const texto = generarResumenResultados(BASE);

    expect(texto).toContain("ingresos de 17,940.00");
    expect(texto).toContain("incremento absoluto de 7,940.00");
    expect(texto).toContain("costos de ventas y operación alcanzaron 8,000.00");
    expect(texto).toContain("utilidad bruta de 9,940.00");
    expect(texto).toContain("La utilidad neta fue de 3,000.00.");
  });

  test("marca decremento y pérdida cuando corresponde", () => {
    const texto = generarResumenResultados([
      fila({ clave: "seccion-ingresos", actual: 500_000, anterior: 1_000_000, variacionAbsoluta: -500_000 }),
      fila({ clave: "seccion-costos", actual: -800_000 }),
      fila({ clave: "total-utilidad-bruta", actual: -300_000 }),
      fila({ clave: "total-utilidad-neta", actual: -400_000 }),
    ]);

    expect(texto).toContain("decremento absoluto de 5,000.00");
    expect(texto).toContain("pérdida neta de 4,000.00");
  });

  test("avisa cuando el periodo anterior no tuvo ingresos", () => {
    const texto = generarResumenResultados(
      BASE.map((f) => (f.clave === "seccion-ingresos" ? { ...f, anterior: 0 } : f)),
    );

    expect(texto).toContain("donde no se registraron ingresos");
  });

  test("devuelve vacío si faltan los totales del esqueleto", () => {
    expect(generarResumenResultados([])).toBe("");
  });
});

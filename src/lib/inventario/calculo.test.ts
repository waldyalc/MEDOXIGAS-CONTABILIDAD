import { describe, expect, test } from "vitest";

import { calcularTotalAjusteCentavos, totalLineaAjusteCentavos } from "./calculo";

describe("totalLineaAjusteCentavos", () => {
  test("multiplica cantidad por costo en centavos", () => {
    expect(totalLineaAjusteCentavos({ cantidad: 5, costoCentavos: 10667 })).toBe(53335);
  });

  test("redondea el total de la línea a centavos", () => {
    expect(totalLineaAjusteCentavos({ cantidad: 3, costoCentavos: 10667 })).toBe(32001);
    expect(totalLineaAjusteCentavos({ cantidad: 0.5, costoCentavos: 999 })).toBe(500);
  });

  test("ignora cantidades o costos inválidos", () => {
    expect(totalLineaAjusteCentavos({ cantidad: 0, costoCentavos: 100 })).toBe(0);
    expect(totalLineaAjusteCentavos({ cantidad: -2, costoCentavos: 100 })).toBe(0);
    expect(totalLineaAjusteCentavos({ cantidad: 2, costoCentavos: Number.NaN })).toBe(0);
  });
});

describe("calcularTotalAjusteCentavos", () => {
  test("suma las líneas del ajuste sin importar el tipo", () => {
    expect(
      calcularTotalAjusteCentavos([
        { cantidad: 5, costoCentavos: 12000 },
        { cantidad: 3, costoCentavos: 10667 },
      ]),
    ).toBe(92001);
  });

  test("un ajuste sin líneas suma cero", () => {
    expect(calcularTotalAjusteCentavos([])).toBe(0);
  });
});

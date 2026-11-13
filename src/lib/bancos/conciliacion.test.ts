import { describe, expect, test } from "vitest";

import { desdeSugerido, diaAnterior, resumenConciliacion, siguienteDia } from "./conciliacion";

const movimientos = [
  { id: "entrada", entradaCentavos: 500000, salidaCentavos: 0 },
  { id: "salida", entradaCentavos: 0, salidaCentavos: 125000 },
];

describe("resumenConciliacion", () => {
  test("suma solo los movimientos marcados", () => {
    const resumen = resumenConciliacion({
      saldoAnteriorCentavos: 5000000,
      saldoExtractoCentavos: 5375000,
      movimientos,
      seleccionados: new Set(["entrada", "salida"]),
    });

    expect(resumen.entradasCentavos).toBe(500000);
    expect(resumen.salidasCentavos).toBe(125000);
    expect(resumen.saldoTotalCentavos).toBe(5375000);
    expect(resumen.diferenciaCentavos).toBe(0);
    expect(resumen.cuadra).toBe(true);
  });

  test("marca la diferencia cuando el extracto no coincide", () => {
    const resumen = resumenConciliacion({
      saldoAnteriorCentavos: 5000000,
      saldoExtractoCentavos: 5400000,
      movimientos,
      seleccionados: new Set(["entrada"]),
    });

    expect(resumen.saldoTotalCentavos).toBe(5500000);
    expect(resumen.diferenciaCentavos).toBe(-100000);
    expect(resumen.cuadra).toBe(false);
  });

  test("incluye ajustes bancarios en el saldo total", () => {
    const resumen = resumenConciliacion({
      saldoAnteriorCentavos: 100000,
      saldoExtractoCentavos: 95000,
      movimientos: [],
      seleccionados: new Set(),
      gastosAjusteCentavos: 5000,
    });

    expect(resumen.saldoTotalCentavos).toBe(95000);
    expect(resumen.diferenciaCentavos).toBe(0);
    expect(resumen.cuadra).toBe(true);
  });

  test("con el extracto en cero la diferencia es el saldo total en negativo", () => {
    const resumen = resumenConciliacion({
      saldoAnteriorCentavos: 100000,
      saldoExtractoCentavos: 0,
      movimientos: [],
      seleccionados: new Set(),
    });

    expect(resumen.diferenciaCentavos).toBe(-100000);
    expect(resumen.cuadra).toBe(false);
  });
});

describe("fechas de conciliación", () => {
  test("calcula el día anterior y el siguiente", () => {
    expect(diaAnterior("2026-11-01")).toBe("2026-10-31");
    expect(siguienteDia("2026-12-31")).toBe("2027-01-01");
    expect(diaAnterior("2026-03-01")).toBe("2026-02-28");
  });

  test("desde sugerido arranca después del último corte", () => {
    expect(desdeSugerido("2026-10-31", "2026-09-01", "2026-11-30")).toBe("2026-11-01");
  });

  test("sin cortes arranca en el primer movimiento", () => {
    expect(desdeSugerido(null, "2026-09-15", "2026-11-30")).toBe("2026-09-15");
  });

  test("sin movimientos usa la fecha de corte", () => {
    expect(desdeSugerido(null, null, "2026-11-30")).toBe("2026-11-30");
    expect(desdeSugerido(null, "2026-12-15", "2026-11-30")).toBe("2026-11-30");
  });
});

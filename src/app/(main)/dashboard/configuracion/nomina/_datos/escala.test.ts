import { describe, expect, it } from "vitest";

import { calcularTramos, type TramoForm, tramosDesde } from "./escala";

const ESCALA_2026: TramoForm[] = [
  { hasta: "416220.00", tasa: "0.000" },
  { hasta: "624329.00", tasa: "15.000" },
  { hasta: "867123.00", tasa: "20.000" },
  { hasta: "", tasa: "25.000" },
];

describe("escala de ISR de la configuración", () => {
  it("reproduce los cuatro tramos sembrados de 2026", () => {
    expect(calcularTramos(ESCALA_2026)).toEqual([
      { desde: "0.00", hasta: "416220.00", tasa: "0", monto_fijo: "0.00" },
      { desde: "416220.00", hasta: "624329.00", tasa: "15", monto_fijo: "0.00" },
      { desde: "624329.00", hasta: "867123.00", tasa: "20", monto_fijo: "31216.35" },
      { desde: "867123.00", hasta: null, tasa: "25", monto_fijo: "79775.15" },
    ]);
  });

  it("recalcula desde y monto fijo cuando cambia un hasta", () => {
    const movida = ESCALA_2026.map((tramo, indice) => (indice === 1 ? { ...tramo, hasta: "500000.00" } : tramo));

    expect(calcularTramos(movida)).toEqual([
      { desde: "0.00", hasta: "416220.00", tasa: "0", monto_fijo: "0.00" },
      { desde: "416220.00", hasta: "500000.00", tasa: "15", monto_fijo: "0.00" },
      { desde: "500000.00", hasta: "867123.00", tasa: "20", monto_fijo: "12567.00" },
      { desde: "867123.00", hasta: null, tasa: "25", monto_fijo: "85991.60" },
    ]);
  });

  it("prellena cuatro filas aunque el año anterior no tenga escala", () => {
    expect(tramosDesde(null)).toEqual([
      { hasta: "", tasa: "" },
      { hasta: "", tasa: "" },
      { hasta: "", tasa: "" },
      { hasta: "", tasa: "" },
    ]);
  });
});

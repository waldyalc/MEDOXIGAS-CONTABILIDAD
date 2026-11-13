import { describe, expect, it } from "vitest";

import { esquemaOrdenCompra } from "./esquema";

const base = {
  contacto_id: "11111111-1111-4111-8111-111111111111",
  fecha: "2026-11-14",
  fecha_entrega: "2026-11-20",
  lineas: [
    {
      producto_id: "22222222-2222-4222-8222-222222222222",
      cantidad: 2,
      costo: 400,
      itbis_tasa: 18,
    },
  ],
};

describe("esquemaOrdenCompra", () => {
  it("acepta una orden válida", () => {
    expect(esquemaOrdenCompra.safeParse(base).success).toBe(true);
  });

  it("rechaza una entrega anterior a la fecha", () => {
    expect(esquemaOrdenCompra.safeParse({ ...base, fecha_entrega: "2026-11-01" }).success).toBe(false);
  });

  it("exige producto o cuenta en cada línea", () => {
    const resultado = esquemaOrdenCompra.safeParse({
      ...base,
      lineas: [{ cantidad: 1, costo: 100, itbis_tasa: 0 }],
    });
    expect(resultado.success).toBe(false);
  });

  it("exige al menos una línea", () => {
    expect(esquemaOrdenCompra.safeParse({ ...base, lineas: [] }).success).toBe(false);
  });
});

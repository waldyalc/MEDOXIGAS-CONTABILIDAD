import { describe, expect, test } from "vitest";

import { crearRemisionSchema, mensajeValidacion } from "./validacion";

const remisionBase = {
  contacto_id: "11111111-1111-4111-8111-111111111111",
  fecha: "2026-11-13",
  vencimiento: "2026-11-13",
  lineas: [
    {
      producto_id: "22222222-2222-4222-8222-222222222222",
      descripcion: "Tubo PVC 1/2",
      cantidad: 5,
      precio: 150,
      descuento_pct: 10,
      itbis_tasa: 18,
    },
  ],
};

describe("validación de conduces", () => {
  test("acepta un conduce válido", () => {
    expect(crearRemisionSchema.safeParse(remisionBase).success).toBe(true);
  });

  test("exige cliente", () => {
    expect(crearRemisionSchema.safeParse({ ...remisionBase, contacto_id: null }).success).toBe(false);
  });

  test("exige al menos una línea", () => {
    const resultado = crearRemisionSchema.safeParse({ ...remisionBase, lineas: [] });
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(mensajeValidacion(resultado.error)).toContain("al menos una línea");
  });

  test("rechaza ITBIS fuera de 0, 16 y 18", () => {
    const resultado = crearRemisionSchema.safeParse({
      ...remisionBase,
      lineas: [{ ...remisionBase.lineas[0], itbis_tasa: 12 }],
    });
    expect(resultado.success).toBe(false);
  });
});

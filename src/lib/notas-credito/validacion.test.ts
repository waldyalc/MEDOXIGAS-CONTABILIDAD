import { describe, expect, test } from "vitest";

import { crearNotaCreditoVentaSchema, mensajeValidacionNota } from "./validacion";

const notaBase = {
  factura_id: "11111111-1111-4111-8111-111111111111",
  fecha: "2026-11-13",
  devuelve_inventario: true,
  lineas: [
    {
      factura_linea_id: "22222222-2222-4222-8222-222222222222",
      cantidad: 1,
      pendiente: 2,
    },
  ],
};

describe("validación de nota de crédito de venta", () => {
  test("acepta una nota válida", () => {
    expect(crearNotaCreditoVentaSchema.safeParse(notaBase).success).toBe(true);
  });

  test("exige la factura", () => {
    const resultado = crearNotaCreditoVentaSchema.safeParse({ ...notaBase, factura_id: "" });
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(mensajeValidacionNota(resultado.error)).toContain("factura");
  });

  test("rechaza cantidad cero o negativa", () => {
    for (const cantidad of [0, -1]) {
      const resultado = crearNotaCreditoVentaSchema.safeParse({
        ...notaBase,
        lineas: [{ ...notaBase.lineas[0], cantidad }],
      });
      expect(resultado.success).toBe(false);
      if (!resultado.success) expect(mensajeValidacionNota(resultado.error)).toContain("mayor que cero");
    }
  });

  test("rechaza cantidad mayor a lo pendiente", () => {
    const resultado = crearNotaCreditoVentaSchema.safeParse({
      ...notaBase,
      lineas: [{ ...notaBase.lineas[0], cantidad: 3, pendiente: 2 }],
    });
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(mensajeValidacionNota(resultado.error)).toContain("no puede superar lo pendiente");
  });

  test("permite acreditar justo lo pendiente", () => {
    const resultado = crearNotaCreditoVentaSchema.safeParse({
      ...notaBase,
      lineas: [{ ...notaBase.lineas[0], cantidad: 2, pendiente: 2 }],
    });
    expect(resultado.success).toBe(true);
  });

  test("exige al menos una línea", () => {
    const resultado = crearNotaCreditoVentaSchema.safeParse({ ...notaBase, lineas: [] });
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(mensajeValidacionNota(resultado.error)).toContain("al menos una línea");
  });

  test("devuelve inventario es verdadero por defecto", () => {
    const resultado = crearNotaCreditoVentaSchema.safeParse({
      factura_id: notaBase.factura_id,
      fecha: notaBase.fecha,
      lineas: notaBase.lineas,
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.devuelve_inventario).toBe(true);
  });
});

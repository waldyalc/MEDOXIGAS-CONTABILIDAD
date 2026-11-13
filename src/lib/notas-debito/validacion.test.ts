import { describe, expect, test } from "vitest";

import { crearNotaDebitoVentaSchema, mensajeValidacionNotaDebito } from "./validacion";

const facturaId = "123e4567-e89b-42d3-a456-426614174000";
const productoId = "223e4567-e89b-42d3-a456-426614174000";

function entrada(overrides: Record<string, unknown> = {}) {
  return {
    factura_id: facturaId,
    tipo: "montos",
    fecha: "2026-11-13",
    lineas: [
      {
        producto_id: productoId,
        descripcion: "Cargo por flete",
        cantidad: 1,
        precio: 500,
        descuento_pct: 0,
        itbis_tasa: 18,
      },
    ],
    ...overrides,
  };
}

describe("validación de la nota de débito", () => {
  test("acepta una nota con factura, tipo y una línea", () => {
    const resultado = crearNotaDebitoVentaSchema.safeParse(entrada());
    expect(resultado.success).toBe(true);
  });

  test("exige la factura asociada", () => {
    const resultado = crearNotaDebitoVentaSchema.safeParse(entrada({ factura_id: undefined }));
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(mensajeValidacionNotaDebito(resultado.error)).toContain("factura");
  });

  test("rechaza un tipo de nota desconocido", () => {
    const resultado = crearNotaDebitoVentaSchema.safeParse(entrada({ tipo: "otro" }));
    expect(resultado.success).toBe(false);
  });

  test("exige al menos una línea", () => {
    const resultado = crearNotaDebitoVentaSchema.safeParse(entrada({ lineas: [] }));
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(mensajeValidacionNotaDebito(resultado.error)).toContain("línea");
  });

  test("rechaza una cantidad en cero", () => {
    const resultado = crearNotaDebitoVentaSchema.safeParse(
      entrada({
        lineas: [{ producto_id: productoId, cantidad: 0, precio: 500, itbis_tasa: 18 }],
      }),
    );
    expect(resultado.success).toBe(false);
  });

  test("rechaza un ITBIS fuera de 0, 16 o 18", () => {
    const resultado = crearNotaDebitoVentaSchema.safeParse(
      entrada({
        lineas: [{ producto_id: productoId, cantidad: 1, precio: 500, itbis_tasa: 10 }],
      }),
    );
    expect(resultado.success).toBe(false);
  });

  test("acepta una línea libre con descripción", () => {
    const resultado = crearNotaDebitoVentaSchema.safeParse(
      entrada({
        lineas: [{ descripcion: "Cargo por flete", cantidad: 1, precio: 500, itbis_tasa: 18 }],
      }),
    );
    expect(resultado.success).toBe(true);
  });
});

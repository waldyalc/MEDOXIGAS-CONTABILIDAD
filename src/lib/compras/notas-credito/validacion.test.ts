import { describe, expect, it } from "vitest";

import { crearNotaCreditoCompraSchema } from "./validacion";

const facturaId = "11111111-1111-4111-8111-111111111111";
const lineaId = "22222222-2222-4222-8222-222222222222";

const base = {
  factura_proveedor_id: facturaId,
  fecha: "2026-11-14",
  devuelve_inventario: true,
  lineas: [{ factura_proveedor_linea_id: lineaId, cantidad: 1, pendiente: 2 }],
};

describe("crearNotaCreditoCompraSchema", () => {
  it("acepta una nota con cantidad dentro de lo pendiente", () => {
    expect(crearNotaCreditoCompraSchema.safeParse(base).success).toBe(true);
  });

  it("rechaza cantidad mayor a lo pendiente", () => {
    const resultado = crearNotaCreditoCompraSchema.safeParse({
      ...base,
      lineas: [{ factura_proveedor_linea_id: lineaId, cantidad: 3, pendiente: 2 }],
    });
    expect(resultado.success).toBe(false);
  });

  it("exige al menos una línea", () => {
    expect(crearNotaCreditoCompraSchema.safeParse({ ...base, lineas: [] }).success).toBe(false);
  });

  it("exige la factura de proveedor", () => {
    expect(crearNotaCreditoCompraSchema.safeParse({ ...base, factura_proveedor_id: "no-es-uuid" }).success).toBe(false);
  });
});

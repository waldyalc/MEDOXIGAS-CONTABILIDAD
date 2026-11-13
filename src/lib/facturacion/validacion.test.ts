import { describe, expect, test } from "vitest";

import { crearFacturaSchema, mensajeValidacion } from "./validacion";

const facturaBase = {
  tipo_comprobante: "02" as const,
  contacto_id: "11111111-1111-4111-8111-111111111111",
  fecha: "2026-11-13",
  vencimiento: "2026-11-13",
  lineas: [
    {
      producto_id: "22222222-2222-4222-8222-222222222222",
      descripcion: "Oxígeno medicinal",
      cantidad: 2,
      precio: 1250.5,
      descuento_pct: 10,
      itbis_tasa: 18,
    },
  ],
};

describe("validación de factura", () => {
  test("acepta una factura válida", () => {
    expect(crearFacturaSchema.safeParse(facturaBase).success).toBe(true);
  });

  test.each(["01", "02", "14", "15", "16"])("acepta el tipo de comprobante %s", (tipo) => {
    expect(crearFacturaSchema.safeParse({ ...facturaBase, tipo_comprobante: tipo }).success).toBe(true);
  });

  test("rechaza tipo de comprobante desconocido", () => {
    const resultado = crearFacturaSchema.safeParse({ ...facturaBase, tipo_comprobante: "03" });
    expect(resultado.success).toBe(false);
  });

  test("exige al menos una línea", () => {
    const resultado = crearFacturaSchema.safeParse({ ...facturaBase, lineas: [] });
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(mensajeValidacion(resultado.error)).toContain("al menos una línea");
  });

  test("rechaza vencimiento anterior a la fecha", () => {
    const resultado = crearFacturaSchema.safeParse({ ...facturaBase, vencimiento: "2026-11-12" });
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(mensajeValidacion(resultado.error)).toContain("vencimiento");
  });

  test("rechaza ITBIS fuera de 0, 16 y 18", () => {
    const resultado = crearFacturaSchema.safeParse({
      ...facturaBase,
      lineas: [{ ...facturaBase.lineas[0], itbis_tasa: 12 }],
    });
    expect(resultado.success).toBe(false);
  });

  test("rechaza descuentos mayores al 100 %", () => {
    const resultado = crearFacturaSchema.safeParse({
      ...facturaBase,
      lineas: [{ ...facturaBase.lineas[0], descuento_pct: 101 }],
    });
    expect(resultado.success).toBe(false);
  });

  test("rechaza una línea sin producto ni descripción", () => {
    const resultado = crearFacturaSchema.safeParse({
      ...facturaBase,
      lineas: [{ cantidad: 1, precio: 100, itbis_tasa: 0 }],
    });
    expect(resultado.success).toBe(false);
  });

  test("acepta pago con método válido", () => {
    const resultado = crearFacturaSchema.safeParse({
      ...facturaBase,
      pago: { cuenta_id: "33333333-3333-4333-8333-333333333333", metodo: "efectivo", monto: 2701.08 },
    });
    expect(resultado.success).toBe(true);
  });

  test("rechaza pago con método desconocido", () => {
    const resultado = crearFacturaSchema.safeParse({
      ...facturaBase,
      pago: { cuenta_id: "33333333-3333-4333-8333-333333333333", metodo: "bitcoin", monto: 10 },
    });
    expect(resultado.success).toBe(false);
  });
});

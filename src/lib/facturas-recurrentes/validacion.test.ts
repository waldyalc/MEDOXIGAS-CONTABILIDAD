import { describe, expect, test } from "vitest";

import { crearFacturaRecurrenteSchema, mensajeValidacionRecurrente } from "./validacion";

const contactoId = "123e4567-e89b-42d3-a456-426614174000";
const productoId = "223e4567-e89b-42d3-a456-426614174000";

function entrada(overrides: Record<string, unknown> = {}) {
  return {
    contacto_id: contactoId,
    tipo_comprobante: "02",
    fecha_inicio: "2026-11-14",
    frecuencia_meses: 1,
    plazo_dias: 30,
    lineas: [
      {
        producto_id: productoId,
        descripcion: "Alquiler de cilindros",
        cantidad: 1,
        precio: 650,
        descuento_pct: 0,
        itbis_tasa: 18,
      },
    ],
    ...overrides,
  };
}

describe("validación de la factura recurrente", () => {
  test("acepta una plantilla válida", () => {
    const resultado = crearFacturaRecurrenteSchema.safeParse(entrada());
    expect(resultado.success).toBe(true);
  });

  test("exige el cliente", () => {
    const resultado = crearFacturaRecurrenteSchema.safeParse(entrada({ contacto_id: undefined }));
    expect(resultado.success).toBe(false);
  });

  test("rechaza frecuencia en cero", () => {
    const resultado = crearFacturaRecurrenteSchema.safeParse(entrada({ frecuencia_meses: 0 }));
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(mensajeValidacionRecurrente(resultado.error)).toContain("frecuencia");
  });

  test("rechaza una vigencia anterior al inicio", () => {
    const resultado = crearFacturaRecurrenteSchema.safeParse(entrada({ vigencia_hasta: "2026-11-01" }));
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(mensajeValidacionRecurrente(resultado.error)).toContain("vigencia");
  });

  test("acepta la vigencia vacía como sin límite", () => {
    const resultado = crearFacturaRecurrenteSchema.safeParse(entrada({ vigencia_hasta: undefined }));
    expect(resultado.success).toBe(true);
  });

  test("exige al menos una línea", () => {
    const resultado = crearFacturaRecurrenteSchema.safeParse(entrada({ lineas: [] }));
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(mensajeValidacionRecurrente(resultado.error)).toContain("línea");
  });

  test("rechaza plazos fuera de rango", () => {
    const resultado = crearFacturaRecurrenteSchema.safeParse(entrada({ plazo_dias: 400 }));
    expect(resultado.success).toBe(false);
  });
});

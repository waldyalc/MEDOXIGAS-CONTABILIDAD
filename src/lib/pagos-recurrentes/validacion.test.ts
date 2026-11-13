import { describe, expect, it } from "vitest";

import { esquemaPagoRecurrente } from "./validacion";

const base = {
  nombre: "Alquiler",
  cuenta_gasto_id: "11111111-1111-4111-8111-111111111111",
  cuenta_pago_id: "22222222-2222-4222-8222-222222222222",
  subtotal: 1000,
  itbis_tasa: 18,
  frecuencia_meses: 1,
  fecha_inicio: "2026-11-14",
  contacto_id: "",
  vigencia_hasta: "",
};

describe("esquemaPagoRecurrente", () => {
  it("acepta una plantilla válida y limpia los opcionales", () => {
    const resultado = esquemaPagoRecurrente.safeParse(base);
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.contacto_id).toBeNull();
      expect(resultado.data.vigencia_hasta).toBeNull();
      expect(resultado.data.activo).toBe(true);
    }
  });

  it("rechaza una vigencia anterior al inicio", () => {
    const resultado = esquemaPagoRecurrente.safeParse({ ...base, vigencia_hasta: "2026-11-01" });
    expect(resultado.success).toBe(false);
  });

  it("rechaza frecuencia cero", () => {
    const resultado = esquemaPagoRecurrente.safeParse({ ...base, frecuencia_meses: 0 });
    expect(resultado.success).toBe(false);
  });
});

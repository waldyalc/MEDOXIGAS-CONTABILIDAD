import { describe, expect, test } from "vitest";

import { crearDocumentoSchema, mensajeValidacion } from "./validacion";

const documentoBase = {
  contacto_id: "11111111-1111-4111-8111-111111111111",
  fecha: "2026-11-13",
  vencimiento: "2026-11-13",
  lineas: [
    {
      producto_id: "22222222-2222-4222-8222-222222222222",
      descripcion: "Varilla 3/8",
      cantidad: 20,
      precio: 380,
      descuento_pct: 0,
      itbis_tasa: 18,
    },
  ],
};

describe("validación de cotizaciones y conduces", () => {
  test("acepta un documento válido", () => {
    expect(crearDocumentoSchema.safeParse(documentoBase).success).toBe(true);
  });

  test("exige cliente", () => {
    const resultado = crearDocumentoSchema.safeParse({ ...documentoBase, contacto_id: "" });
    expect(resultado.success).toBe(false);
  });

  test("exige al menos una línea", () => {
    const resultado = crearDocumentoSchema.safeParse({ ...documentoBase, lineas: [] });
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(mensajeValidacion(resultado.error)).toContain("al menos una línea");
  });

  test("rechaza vencimiento anterior a la fecha", () => {
    const resultado = crearDocumentoSchema.safeParse({ ...documentoBase, vencimiento: "2026-11-12" });
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(mensajeValidacion(resultado.error)).toContain("vencimiento");
  });

  test("rechaza una línea sin producto ni descripción", () => {
    const resultado = crearDocumentoSchema.safeParse({
      ...documentoBase,
      lineas: [{ cantidad: 1, precio: 100, itbis_tasa: 0 }],
    });
    expect(resultado.success).toBe(false);
  });

  test("rechaza cantidad cero y total sin líneas válidas", () => {
    const resultado = crearDocumentoSchema.safeParse({
      ...documentoBase,
      lineas: [{ ...documentoBase.lineas[0], cantidad: 0 }],
    });
    expect(resultado.success).toBe(false);
  });
});

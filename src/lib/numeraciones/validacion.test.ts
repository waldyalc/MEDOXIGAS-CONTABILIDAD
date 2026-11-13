import { describe, expect, test } from "vitest";

import { actualizarNumeracionSchema, mensajeValidacion } from "./validacion";

const base = {
  id: "11111111-1111-4111-8111-111111111111",
  nombre: "Régimen especial",
  siguiente: "2",
  hasta: "100000",
  vence: "2027-12-31",
  activa: true,
};

describe("validación de numeraciones", () => {
  test("acepta una numeración válida", () => {
    expect(actualizarNumeracionSchema.safeParse(base).success).toBe(true);
  });

  test("convierte un vence vacío en null", () => {
    const resultado = actualizarNumeracionSchema.safeParse({ ...base, vence: "" });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.vence).toBeNull();
  });

  test("convierte hasta vacío en null", () => {
    const resultado = actualizarNumeracionSchema.safeParse({ ...base, hasta: "" });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.hasta).toBeNull();
  });

  test("exige un nombre", () => {
    const resultado = actualizarNumeracionSchema.safeParse({ ...base, nombre: "  " });
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(mensajeValidacion(resultado.error)).toContain("nombre");
  });

  test("rechaza siguiente mayor que hasta", () => {
    const resultado = actualizarNumeracionSchema.safeParse({ ...base, siguiente: "101", hasta: "100" });
    expect(resultado.success).toBe(false);
  });

  test("rechaza una fecha de vencimiento inválida", () => {
    expect(actualizarNumeracionSchema.safeParse({ ...base, vence: "31/12/2027" }).success).toBe(false);
  });

  test("rechaza siguiente menor que 1", () => {
    expect(actualizarNumeracionSchema.safeParse({ ...base, siguiente: "0" }).success).toBe(false);
  });

  test("rechaza un identificador que no es UUID", () => {
    expect(actualizarNumeracionSchema.safeParse({ ...base, id: "abc" }).success).toBe(false);
  });
});

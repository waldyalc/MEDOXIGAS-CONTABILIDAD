import { describe, expect, test } from "vitest";

import { mensajeValidacion } from "@/lib/facturacion/validacion";

import { crearAsientoManualSchema } from "./validacion";

const CUENTA_DEBITO = "11111111-1111-4111-8111-111111111111";
const CUENTA_CREDITO = "22222222-2222-4222-8222-222222222222";
const CONTACTO = "33333333-3333-4333-8333-333333333333";

const asientoBase = {
  fecha: "2026-11-13",
  descripcion: "Ajuste de prueba",
  lineas: [
    { cuenta_id: CUENTA_DEBITO, debito: 100, credito: 0 },
    { cuenta_id: CUENTA_CREDITO, debito: 0, credito: 100 },
  ],
};

describe("validación de asiento manual", () => {
  test("acepta un asiento cuadrado con dos líneas", () => {
    expect(crearAsientoManualSchema.safeParse(asientoBase).success).toBe(true);
  });

  test("acepta un tipo de entrada opcional y rechaza uno inválido", () => {
    expect(crearAsientoManualSchema.safeParse({ ...asientoBase, tipo_entrada_id: CONTACTO }).success).toBe(true);
    expect(crearAsientoManualSchema.safeParse({ ...asientoBase, tipo_entrada_id: "no-uuid" }).success).toBe(false);
  });

  test("acepta tercero y descripción opcionales en la línea", () => {
    const resultado = crearAsientoManualSchema.safeParse({
      ...asientoBase,
      lineas: [
        { ...asientoBase.lineas[0], contacto_id: CONTACTO, descripcion: "Cargo al tercero" },
        asientoBase.lineas[1],
      ],
    });
    expect(resultado.success).toBe(true);
  });

  test("rechaza un asiento descuadrado", () => {
    const resultado = crearAsientoManualSchema.safeParse({
      ...asientoBase,
      lineas: [
        { cuenta_id: CUENTA_DEBITO, debito: 100, credito: 0 },
        { cuenta_id: CUENTA_CREDITO, debito: 0, credito: 80 },
      ],
    });
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(mensajeValidacion(resultado.error)).toContain("descuadrado");
  });

  test("rechaza una línea con débito y crédito a la vez", () => {
    const resultado = crearAsientoManualSchema.safeParse({
      ...asientoBase,
      lineas: [
        { cuenta_id: CUENTA_DEBITO, debito: 100, credito: 100 },
        { cuenta_id: CUENTA_CREDITO, debito: 0, credito: 100 },
      ],
    });
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(mensajeValidacion(resultado.error)).toContain("nunca ambos");
  });

  test("rechaza una línea en cero por ambos lados", () => {
    const resultado = crearAsientoManualSchema.safeParse({
      ...asientoBase,
      lineas: [
        { cuenta_id: CUENTA_DEBITO, debito: 0, credito: 0 },
        { cuenta_id: CUENTA_CREDITO, debito: 0, credito: 100 },
      ],
    });
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(mensajeValidacion(resultado.error)).toContain("nunca ambos");
  });

  test("rechaza menos de dos líneas", () => {
    const resultado = crearAsientoManualSchema.safeParse({
      ...asientoBase,
      lineas: [{ cuenta_id: CUENTA_DEBITO, debito: 100, credito: 0 }],
    });
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(mensajeValidacion(resultado.error)).toContain("al menos dos líneas");
  });

  test("rechaza una descripción vacía", () => {
    const resultado = crearAsientoManualSchema.safeParse({ ...asientoBase, descripcion: "   " });
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(mensajeValidacion(resultado.error)).toContain("descripción");
  });
});

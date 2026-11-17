import { describe, expect, test } from "vitest";

import { buscarContribuyenteDgii } from "./acciones";

describe("acción de búsqueda en la DGII", () => {
  test("rechaza un tipo que la DGII no consulta", async () => {
    await expect(buscarContribuyenteDgii("AB123456", "pasaporte")).resolves.toEqual({
      ok: false,
      error: "La DGII solo consulta RNC y cédula. Escribe el número a mano.",
    });
  });

  test("pide el número cuando está vacío", async () => {
    await expect(buscarContribuyenteDgii("   ", "rnc")).resolves.toEqual({
      ok: false,
      error: "Escribe el RNC de 9 dígitos.",
    });
    await expect(buscarContribuyenteDgii("", "cedula")).resolves.toEqual({
      ok: false,
      error: "Escribe la cédula de 11 dígitos.",
    });
  });

  test("valida la longitud sin salir a la red", async () => {
    await expect(buscarContribuyenteDgii("123", "rnc")).resolves.toEqual({
      ok: false,
      error: "El RNC debe tener 9 dígitos.",
    });
    await expect(buscarContribuyenteDgii("130893489", "cedula")).resolves.toEqual({
      ok: false,
      error: "La cédula debe tener 11 dígitos.",
    });
  });
});

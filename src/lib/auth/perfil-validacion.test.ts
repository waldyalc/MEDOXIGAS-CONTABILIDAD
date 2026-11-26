import { describe, expect, it } from "vitest";

import { validarCambioContrasena } from "./perfil-validacion";

const valida = {
  actual: "ClaveActual1",
  nueva: "NuevaClave2",
  confirmar: "NuevaClave2",
};

describe("validarCambioContrasena", () => {
  it("acepta una contraseña nueva segura, confirmada y diferente de la actual", () => {
    expect(validarCambioContrasena(valida)).toEqual({ ok: true });
  });

  it("exige la contraseña actual", () => {
    expect(validarCambioContrasena({ ...valida, actual: "" })).toEqual({
      ok: false,
      error: "Ingresa tu contraseña actual.",
    });
  });

  it("exige al menos 8 caracteres en la contraseña nueva", () => {
    expect(validarCambioContrasena({ ...valida, nueva: "Abc123", confirmar: "Abc123" })).toEqual({
      ok: false,
      error: "La nueva contraseña debe tener al menos 8 caracteres.",
    });
  });

  it("exige al menos una letra", () => {
    expect(validarCambioContrasena({ ...valida, nueva: "12345678", confirmar: "12345678" })).toEqual({
      ok: false,
      error: "La nueva contraseña debe incluir al menos una letra y un número.",
    });
  });

  it("exige al menos un número", () => {
    expect(validarCambioContrasena({ ...valida, nueva: "abcdefgh", confirmar: "abcdefgh" })).toEqual({
      ok: false,
      error: "La nueva contraseña debe incluir al menos una letra y un número.",
    });
  });

  it("exige que la confirmación coincida", () => {
    expect(validarCambioContrasena({ ...valida, confirmar: "OtraClave3" })).toEqual({
      ok: false,
      error: "La confirmación no coincide con la nueva contraseña.",
    });
  });

  it("rechaza reutilizar la contraseña actual", () => {
    expect(validarCambioContrasena({ ...valida, nueva: valida.actual, confirmar: valida.actual })).toEqual({
      ok: false,
      error: "La nueva contraseña debe ser diferente de la contraseña actual.",
    });
  });
});

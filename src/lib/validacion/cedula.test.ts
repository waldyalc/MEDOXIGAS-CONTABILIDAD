import { describe, expect, it } from "vitest";

import { cedulaValida, digitoVerificadorValido } from "./cedula";

describe("dígito verificador DGII", () => {
  it("acepta cédulas válidas con o sin guiones", () => {
    expect(digitoVerificadorValido("402-3772118-4")).toBe(true);
    expect(digitoVerificadorValido("40237721184")).toBe(true);
    expect(digitoVerificadorValido("00800235491")).toBe(true);
    expect(digitoVerificadorValido("01100294907")).toBe(true);
    expect(digitoVerificadorValido("02800449619")).toBe(true);
  });

  it("rechaza una cédula con el dígito verificador cambiado", () => {
    expect(digitoVerificadorValido("402-3772118-5")).toBe(false);
    expect(digitoVerificadorValido("00112345678")).toBe(false);
    expect(digitoVerificadorValido("40237721180")).toBe(false);
  });

  it("valida el RNC con el mismo algoritmo de la base", () => {
    // Casos documentados en la migración 20261124120000: Alegra aceptó
    // 132000013 y 402123455, y rechazó 132000015.
    expect(digitoVerificadorValido("132000013")).toBe(true);
    expect(digitoVerificadorValido("402123455")).toBe(true);
    expect(digitoVerificadorValido("132000015")).toBe(false);
  });

  it("rechaza longitudes que no son ni RNC ni cédula", () => {
    expect(digitoVerificadorValido("")).toBe(false);
    expect(digitoVerificadorValido("123")).toBe(false);
    expect(digitoVerificadorValido("1234567890")).toBe(false);
    expect(digitoVerificadorValido("123456789012")).toBe(false);
  });
});

describe("cedulaValida", () => {
  it("exige 11 dígitos con dígito verificador válido", () => {
    expect(cedulaValida("402-3772118-4")).toBe(true);
    expect(cedulaValida("402 3772118 4")).toBe(true);
    expect(cedulaValida("402-3772118-5")).toBe(false);
    expect(cedulaValida("402-3772118")).toBe(false);
    expect(cedulaValida("")).toBe(false);
  });
});

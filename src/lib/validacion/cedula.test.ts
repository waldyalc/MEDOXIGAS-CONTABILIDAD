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

  it("valida el RNC con el algoritmo de la DGII", () => {
    // Reales del catálogo oficial de la DGII (23-11-2026): 131712789 =
    // FRINET SRL —el caso del QA de producción—, 130893489 = MEDOXIGAS ALC
    // SRL, 131488791 = OXYMAT SRL y 132000013 = DIMARDI M&M SRL.
    expect(digitoVerificadorValido("131712789")).toBe(true);
    expect(digitoVerificadorValido("1-31-71278-9")).toBe(true);
    expect(digitoVerificadorValido("130893489")).toBe(true);
    expect(digitoVerificadorValido("131488791")).toBe(true);
    expect(digitoVerificadorValido("132000013")).toBe(true);
    // 402123455 es el RNC de la prueba de Alegra; 132000015 lo rechazó.
    expect(digitoVerificadorValido("402123455")).toBe(true);
    expect(digitoVerificadorValido("132000015")).toBe(false);
  });

  it("usa 1 cuando el resto es 10 y 2 cuando el resto es 11", () => {
    // Complemento módulo 11 de la DGII: 11 - 10 = 1 y 11 - 0 = 11 → 2.
    // 101007151 (ROSEDAL CXA) y 531068592 (JUSTINA SUERO AMADOR) son RNC
    // reales del catálogo oficial.
    expect(digitoVerificadorValido("101007151")).toBe(true);
    expect(digitoVerificadorValido("531068592")).toBe(true);
    expect(digitoVerificadorValido("101007150")).toBe(false);
    expect(digitoVerificadorValido("531068590")).toBe(false);
  });

  it("rechaza el RNC que aceptaba el algoritmo viejo", () => {
    // El algoritmo viejo ponderaba desde el segundo dígito, así que
    // 902123455 pasaba; con la DGII el dígito verificador es 3.
    expect(digitoVerificadorValido("902123455")).toBe(false);
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

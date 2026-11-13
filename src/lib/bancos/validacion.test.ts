import { describe, expect, test } from "vitest";

import { validarDeposito, validarTransferencia } from "./validacion";

const transferencia = {
  cuenta_origen_id: "1101",
  cuenta_destino_id: "1102",
  montoCentavos: 10000,
};

const deposito = {
  cuenta_destino_id: "1102",
  cuenta_contrapartida_id: "3101",
  montoCentavos: 50000,
};

describe("validarTransferencia", () => {
  test("acepta una transferencia válida", () => {
    expect(validarTransferencia(transferencia)).toBeNull();
  });

  test("rechaza monto cero o negativo", () => {
    expect(validarTransferencia({ ...transferencia, montoCentavos: 0 })).toBe("El monto debe ser mayor que cero.");
    expect(validarTransferencia({ ...transferencia, montoCentavos: -100 })).toBe("El monto debe ser mayor que cero.");
  });

  test("rechaza la misma cuenta de origen y destino", () => {
    expect(validarTransferencia({ ...transferencia, cuenta_destino_id: "1101" })).toBe(
      "La cuenta de origen y la de destino deben ser distintas.",
    );
  });

  test("rechaza cuentas sin seleccionar", () => {
    expect(validarTransferencia({ ...transferencia, cuenta_origen_id: "" })).toBe("Selecciona la cuenta de origen.");
    expect(validarTransferencia({ ...transferencia, cuenta_destino_id: "" })).toBe("Selecciona la cuenta de destino.");
  });
});

describe("validarDeposito", () => {
  test("acepta un depósito válido", () => {
    expect(validarDeposito(deposito)).toBeNull();
  });

  test("rechaza monto cero o negativo", () => {
    expect(validarDeposito({ ...deposito, montoCentavos: 0 })).toBe("El monto debe ser mayor que cero.");
    expect(validarDeposito({ ...deposito, montoCentavos: -1 })).toBe("El monto debe ser mayor que cero.");
  });

  test("rechaza la misma cuenta de destino y contrapartida", () => {
    expect(validarDeposito({ ...deposito, cuenta_contrapartida_id: "1102" })).toBe(
      "La cuenta de destino y la contrapartida deben ser distintas.",
    );
  });

  test("rechaza cuentas sin seleccionar", () => {
    expect(validarDeposito({ ...deposito, cuenta_destino_id: "" })).toBe("Selecciona la cuenta de destino.");
    expect(validarDeposito({ ...deposito, cuenta_contrapartida_id: "" })).toBe(
      "Selecciona la cuenta de contrapartida.",
    );
  });
});

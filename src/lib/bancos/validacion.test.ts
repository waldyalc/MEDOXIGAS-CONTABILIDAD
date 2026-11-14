import { describe, expect, test } from "vitest";

import { validarConciliacion, validarCuentaBanco, validarDeposito, validarTransferencia } from "./validacion";

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

const cuentaBanco = {
  nombre: "Banco Popular Prueba",
  tipo_banco: "banco",
  saldoCentavos: 5000000,
  fecha_saldo_inicial: "2026-11-13",
};

describe("validarCuentaBanco", () => {
  test("acepta una cuenta válida con saldo cero", () => {
    expect(validarCuentaBanco(cuentaBanco)).toBeNull();
    expect(validarCuentaBanco({ ...cuentaBanco, saldoCentavos: 0 })).toBeNull();
  });

  test("exige el nombre de la cuenta", () => {
    expect(validarCuentaBanco({ ...cuentaBanco, nombre: "   " })).toBe("Escribe el nombre de la cuenta.");
    expect(validarCuentaBanco({ ...cuentaBanco, nombre: "" })).toBe("Escribe el nombre de la cuenta.");
  });

  test("exige un tipo de cuenta válido", () => {
    expect(validarCuentaBanco({ ...cuentaBanco, tipo_banco: "otro" })).toBe("Selecciona un tipo de cuenta válido.");
    expect(validarCuentaBanco({ ...cuentaBanco, tipo_banco: "" })).toBe("Selecciona un tipo de cuenta válido.");
  });

  test("rechaza saldo inicial negativo", () => {
    expect(validarCuentaBanco({ ...cuentaBanco, saldoCentavos: -1 })).toBe("El saldo inicial no puede ser negativo.");
  });

  test("exige la fecha del saldo inicial", () => {
    expect(validarCuentaBanco({ ...cuentaBanco, fecha_saldo_inicial: "" })).toBe(
      "Selecciona la fecha del saldo inicial.",
    );
  });
});

const conciliacion = {
  fecha_desde: "2026-11-01",
  fecha_hasta: "2026-11-30",
  saldoCentavos: 5500000,
  lineas: ["linea-1"],
  requiereMovimientos: true,
};

describe("validarConciliacion", () => {
  test("acepta una conciliación válida", () => {
    expect(validarConciliacion(conciliacion)).toBeNull();
  });

  test("rechaza el rango invertido", () => {
    expect(validarConciliacion({ ...conciliacion, fecha_desde: "2026-12-01" })).toBe("El rango de fechas es inválido.");
  });

  test("exige el saldo del extracto", () => {
    expect(validarConciliacion({ ...conciliacion, saldoCentavos: null })).toBe("Escribe el saldo del extracto.");
    expect(validarConciliacion({ ...conciliacion, saldoCentavos: -1 })).toBe("Escribe el saldo del extracto.");
  });

  test("exige un movimiento al conciliar", () => {
    expect(validarConciliacion({ ...conciliacion, lineas: [] })).toBe("Selecciona al menos un movimiento.");
    expect(validarConciliacion({ ...conciliacion, lineas: [], requiereMovimientos: false })).toBeNull();
  });

  test("rechaza movimientos repetidos", () => {
    expect(validarConciliacion({ ...conciliacion, lineas: ["linea-1", "linea-1"] })).toBe(
      "Hay un movimiento repetido en la conciliación.",
    );
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

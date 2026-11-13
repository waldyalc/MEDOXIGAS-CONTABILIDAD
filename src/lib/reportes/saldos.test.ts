import { describe, expect, test } from "vitest";

import { mensajeSaldoNegativo } from "./saldos";

describe("mensaje de saldo negativo", () => {
  test("formatea el saldo negativo exacto con dos decimales", () => {
    expect(mensajeSaldoNegativo("Banco principal", -3907000)).toBe(
      "Banco principal está en -RD$39,070.00. Revisa si falta registrar un depósito o el saldo inicial.",
    );
  });

  test("formatea otros saldos negativos", () => {
    expect(mensajeSaldoNegativo("Caja general", -500)).toBe(
      "Caja general está en -RD$5.00. Revisa si falta registrar un depósito o el saldo inicial.",
    );
  });

  test("también formatea saldos en cero o positivos", () => {
    expect(mensajeSaldoNegativo("Caja chica", 0)).toBe(
      "Caja chica está en RD$0.00. Revisa si falta registrar un depósito o el saldo inicial.",
    );
    expect(mensajeSaldoNegativo("Caja chica", 123456)).toContain("RD$1,234.56");
  });
});

import { describe, expect, test } from "vitest";

import { saldoDeFactura } from "./formato";

describe("saldo de factura", () => {
  test("resta pagos y notas de crédito", () => {
    expect(saldoDeFactura(1000, 200, 100)).toBe(700);
    expect(saldoDeFactura("1000.50", "200.25", "100.25")).toBe(700);
  });

  test("sin crédito se comporta como antes", () => {
    expect(saldoDeFactura(500, 125)).toBe(375);
    expect(saldoDeFactura(500, 125, null)).toBe(375);
  });

  test("nunca devuelve saldo negativo", () => {
    expect(saldoDeFactura(100, 80, 50)).toBe(0);
    expect(saldoDeFactura(null, null, null)).toBe(0);
  });

  test("resta también lo retenido", () => {
    expect(saldoDeFactura(1180, 500, 0, 54)).toBe(626);
    expect(saldoDeFactura(1180, 1126, 0, 54)).toBe(0);
  });
});

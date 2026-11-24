import { describe, expect, test } from "vitest";

import {
  calcularFactura,
  calcularLinea,
  calcularTotales,
  centavosAValor,
  parsearCantidad,
  parsearCentavos,
  subtotalBruto,
  valorACentavos,
} from "./calculo";

describe("parsearCentavos", () => {
  test("convierte texto decimal a centavos enteros", () => {
    expect(parsearCentavos("1234.56")).toBe(123456);
    expect(parsearCentavos("0.05")).toBe(5);
    expect(parsearCentavos("10")).toBe(1000);
  });

  test("acepta coma de miles y número", () => {
    expect(parsearCentavos("1,234.50")).toBe(123450);
    expect(parsearCentavos(12.3)).toBe(1230);
  });

  test("rechaza vacío, negativo y más de dos decimales", () => {
    expect(parsearCentavos("")).toBeNull();
    expect(parsearCentavos("-1.00")).toBeNull();
    expect(parsearCentavos("1.234")).toBeNull();
    expect(parsearCentavos("abc")).toBeNull();
  });
});

describe("calcularLinea", () => {
  test("ITBIS 18 % con descuento del 10 %", () => {
    const linea = calcularLinea({ cantidad: 1, precioCentavos: 10000, descuentoPct: 10, itbisTasa: 18 });
    expect(linea).toEqual({
      brutoCentavos: 10000,
      descuentoCentavos: 1000,
      subtotalCentavos: 9000,
      itbisCentavos: 1620,
      totalCentavos: 10620,
    });
  });

  test("ITBIS 0 % deja el total igual al subtotal", () => {
    const linea = calcularLinea({ cantidad: 2, precioCentavos: 2500, descuentoPct: 0, itbisTasa: 0 });
    expect(linea.itbisCentavos).toBe(0);
    expect(linea.totalCentavos).toBe(5000);
  });

  test("ITBIS 16 % redondea al centavo", () => {
    const linea = calcularLinea({ cantidad: 1, precioCentavos: 999, itbisTasa: 16 });
    expect(linea.itbisCentavos).toBe(160);
    expect(linea.totalCentavos).toBe(1159);
  });

  test("redondea el subtotal cuando la cantidad es fraccionaria", () => {
    const linea = calcularLinea({ cantidad: 1.333, precioCentavos: 100, itbisTasa: 18 });
    expect(linea.brutoCentavos).toBe(133);
    expect(linea.itbisCentavos).toBe(24);
    expect(linea.totalCentavos).toBe(157);
  });

  test("redondea el descuento por línea", () => {
    const linea = calcularLinea({ cantidad: 1, precioCentavos: 333, descuentoPct: 10, itbisTasa: 0 });
    expect(linea.descuentoCentavos).toBe(33);
    expect(linea.subtotalCentavos).toBe(300);
  });

  test("ignora cantidades, precios y porcentajes inválidos", () => {
    expect(calcularLinea({ cantidad: -2, precioCentavos: 100, itbisTasa: 18 }).subtotalCentavos).toBe(0);
    expect(calcularLinea({ cantidad: 1, precioCentavos: 100, descuentoPct: 150 }).subtotalCentavos).toBe(0);
    expect(calcularLinea({ cantidad: 1, precioCentavos: 100, itbisTasa: -5 }).itbisCentavos).toBe(0);
  });
});

describe("totales de la factura", () => {
  test("suma líneas con ITBIS mixto y descuentos", () => {
    const { totales } = calcularFactura([
      { cantidad: 1, precioCentavos: 10000, descuentoPct: 10, itbisTasa: 18 },
      { cantidad: 2, precioCentavos: 2500, descuentoPct: 0, itbisTasa: 0 },
      { cantidad: 1, precioCentavos: 1000, descuentoPct: 50, itbisTasa: 16 },
    ]);

    expect(totales).toEqual({
      subtotalCentavos: 16000,
      descuentoCentavos: 1500,
      itbisCentavos: 1700,
      totalCentavos: 16200,
    });
  });

  test("el redondeo es por línea, no sobre el total", () => {
    const { totales } = calcularFactura([
      { cantidad: 1, precioCentavos: 3, itbisTasa: 18 },
      { cantidad: 1, precioCentavos: 3, itbisTasa: 18 },
    ]);

    expect(totales.itbisCentavos).toBe(2);
    expect(totales.totalCentavos).toBe(8);
  });

  test("sin líneas los totales quedan en cero", () => {
    expect(calcularTotales([])).toEqual({
      subtotalCentavos: 0,
      descuentoCentavos: 0,
      itbisCentavos: 0,
      totalCentavos: 0,
    });
  });

  test("convierte entre centavos y valor decimal", () => {
    expect(centavosAValor(123456)).toBe(1234.56);
    expect(centavosAValor(5)).toBe(0.05);
    expect(valorACentavos(1234.56)).toBe(123456);
  });

  test("parsearCantidad acepta punto o coma decimal", () => {
    expect(parsearCantidad("1.5")).toBe(1.5);
    expect(parsearCantidad("2,25")).toBe(2.25);
    expect(parsearCantidad("0")).toBe(0);
    expect(parsearCantidad(undefined)).toBe(0);
  });
});

describe("subtotalBruto", () => {
  test("devuelve el bruto que se muestra junto a la fila Descuento", () => {
    // La base guarda 323.10 neto y 35.90 de descuento: la vista muestra RD$359.00.
    expect(subtotalBruto(323.1, 35.9)).toBe(359);
  });

  test("sin descuento deja el subtotal igual", () => {
    expect(subtotalBruto(1000, 0)).toBe(1000);
  });

  test("suma en centavos enteros, sin arrastrar flotantes", () => {
    expect(subtotalBruto(0.1, 0.2)).toBe(0.3);
  });
});

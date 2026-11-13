import { describe, expect, test } from "vitest";

import {
  descuentoDeLinea,
  descuentoDeLineas,
  estadoDeDocumento,
  estadoDeFactura,
  etiquetaDescuento,
  etiquetaItbisTotal,
  etiquetaTasaItbis,
  montoGravadoDeLineas,
  permisosDeDocumento,
  permisosDeFactura,
  resumenFactura,
  totalNotasActivas,
} from "./vista";

describe("resumenFactura", () => {
  test("calcula cobrado y por cobrar", () => {
    expect(resumenFactura({ total: 767, pagado: 200, credito: 67 })).toEqual({
      valorTotal: 767,
      valorRetenido: 0,
      totalCobrado: 200,
      porCobrar: 500,
    });
  });

  test("nunca deja por cobrar negativo", () => {
    expect(resumenFactura({ total: 100, pagado: 80, credito: 30 }).porCobrar).toBe(0);
  });
});

describe("estadoDeFactura", () => {
  test("por cobrar cuando queda saldo", () => {
    expect(estadoDeFactura("abierta", 767)).toEqual({ etiqueta: "Por cobrar", tono: "amber" });
  });

  test("cobrada cuando no queda saldo", () => {
    expect(estadoDeFactura("abierta", 0)).toEqual({ etiqueta: "Cobrada", tono: "green" });
    expect(estadoDeFactura("pagada", 100)).toEqual({ etiqueta: "Cobrada", tono: "green" });
  });

  test("anulada manda sobre el saldo", () => {
    expect(estadoDeFactura("anulada", 100)).toEqual({ etiqueta: "Anulada", tono: "red" });
  });
});

describe("estadoDeDocumento", () => {
  test("sin facturar, facturada y anulada", () => {
    expect(estadoDeDocumento("abierta")).toEqual({ etiqueta: "Sin facturar", tono: "amber" });
    expect(estadoDeDocumento("convertida")).toEqual({ etiqueta: "Facturada", tono: "green" });
    expect(estadoDeDocumento("anulada")).toEqual({ etiqueta: "Anulada", tono: "red" });
  });
});

describe("cálculos de líneas", () => {
  test("descuento por línea y total", () => {
    expect(descuentoDeLinea({ cantidad: 2, precio: 100, descuento_pct: 10 })).toBe(20);
    expect(
      descuentoDeLineas([
        { cantidad: 2, precio: 100, descuento_pct: 10, itbis_tasa: 18, subtotal: 180 },
        { cantidad: 1, precio: 50.5, descuento_pct: 5, itbis_tasa: 0, subtotal: 47.98 },
      ]),
    ).toBe(22.53);
  });

  test("monto gravado solo suma líneas con ITBIS", () => {
    expect(
      montoGravadoDeLineas([
        { cantidad: 1, precio: 100, descuento_pct: 0, itbis_tasa: 18, subtotal: 100 },
        { cantidad: 1, precio: 50, descuento_pct: 0, itbis_tasa: 0, subtotal: 50 },
      ]),
    ).toBe(100);
  });

  test("etiquetas de impuesto, descuento y total de ITBIS", () => {
    expect(etiquetaTasaItbis(18)).toBe("ITBIS 18%");
    expect(etiquetaTasaItbis(0)).toBe("—");
    expect(etiquetaDescuento(0)).toBe("0%");
    expect(etiquetaDescuento(12.5)).toBe("12.5%");
    expect(etiquetaItbisTotal([{ cantidad: 1, precio: 1, descuento_pct: 0, itbis_tasa: 18, subtotal: 1 }])).toBe(
      "ITBIS (18%)",
    );
    expect(
      etiquetaItbisTotal([
        { cantidad: 1, precio: 1, descuento_pct: 0, itbis_tasa: 18, subtotal: 1 },
        { cantidad: 1, precio: 1, descuento_pct: 0, itbis_tasa: 16, subtotal: 1 },
      ]),
    ).toBe("ITBIS");
  });
});

describe("permisos de la vista", () => {
  test("factura abierta con saldo permite pagar, notas y anular", () => {
    expect(permisosDeFactura("abierta", 500, true)).toEqual({
      pagar: true,
      notaCredito: true,
      notaDebito: true,
      anular: true,
      convertir: false,
    });
  });

  test("factura cobrada no permite agregar pago ni nota de crédito", () => {
    expect(permisosDeFactura("abierta", 0, true)).toEqual({
      pagar: false,
      notaCredito: false,
      notaDebito: true,
      anular: true,
      convertir: false,
    });
  });

  test("factura anulada o lector no puede nada", () => {
    expect(permisosDeFactura("anulada", 500, true)).toEqual({
      pagar: false,
      notaCredito: false,
      notaDebito: false,
      anular: false,
      convertir: false,
    });
    expect(permisosDeFactura("abierta", 500, false).pagar).toBe(false);
  });

  test("cotización abierta solo convierte", () => {
    expect(permisosDeDocumento("abierta", true).convertir).toBe(true);
    expect(permisosDeDocumento("abierta", true).anular).toBe(false);
    expect(permisosDeDocumento("convertida", true).convertir).toBe(false);
    expect(permisosDeDocumento("abierta", false).convertir).toBe(false);
  });
});

describe("totalNotasActivas", () => {
  test("ignora las anuladas", () => {
    expect(
      totalNotasActivas([
        { total: 100, estado: "activa" },
        { total: 50, estado: "anulada" },
      ]),
    ).toBe(100);
  });
});

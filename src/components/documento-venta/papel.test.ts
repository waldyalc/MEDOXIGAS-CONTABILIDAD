import { describe, expect, it } from "vitest";

import {
  etiquetaItbisPapel,
  formatearMontoPapel,
  formatearPrecioPapel,
  nombreArchivoPapel,
  totalItemsPapel,
} from "./papel";

describe("formato del papel", () => {
  it("formatea montos con dos decimales", () => {
    expect(formatearMontoPapel(14100)).toBe("RD$14,100.00");
    expect(formatearMontoPapel(0)).toBe("RD$0.00");
    expect(formatearMontoPapel(2538.5)).toBe("RD$2,538.50");
    expect(formatearMontoPapel("16638.25")).toBe("RD$16,638.25");
  });

  it("formatea precios sin decimales cuando son enteros", () => {
    expect(formatearPrecioPapel(650)).toBe("RD$650");
    expect(formatearPrecioPapel(1450)).toBe("RD$1,450");
    expect(formatearPrecioPapel(650.5)).toBe("RD$650.5");
  });

  it("suma el total de items con las cantidades", () => {
    expect(
      totalItemsPapel([
        { cantidad: 10, itbis_tasa: 18 },
        { cantidad: 20, itbis_tasa: 18 },
      ]),
    ).toBe(30);
    expect(totalItemsPapel([])).toBe(0);
  });

  it("etiqueta el ITBIS cuando hay una sola tasa", () => {
    expect(etiquetaItbisPapel([{ cantidad: 1, itbis_tasa: 18 }])).toBe("ITBIS (18.00%)");
  });

  it("usa el ITBIS genérico con tasas mezcladas o sin impuesto", () => {
    expect(
      etiquetaItbisPapel([
        { cantidad: 1, itbis_tasa: 18 },
        { cantidad: 1, itbis_tasa: 16 },
      ]),
    ).toBe("ITBIS");
    expect(etiquetaItbisPapel([{ cantidad: 1, itbis_tasa: 0 }])).toBe("ITBIS");
    expect(etiquetaItbisPapel([])).toBe("ITBIS");
  });

  it("arma el nombre del archivo con el NCF de la factura", () => {
    expect(nombreArchivoPapel("factura", 1, "B0100000001")).toBe("factura-B0100000001");
    expect(nombreArchivoPapel("factura", 1)).toBe("factura-1");
    expect(nombreArchivoPapel("cotizacion", 1)).toBe("cotizacion-1");
    expect(nombreArchivoPapel("conduce", 12)).toBe("conduce-12");
  });
});

import { describe, expect, test } from "vitest";

import { esTipoComprobante, etiquetaTipoComprobante, tituloTipoComprobante } from "./comprobantes";

describe("tipos de comprobante", () => {
  test.each([
    ["01", "01 Crédito fiscal"],
    ["02", "02 Consumo"],
    ["14", "14 Régimen especial"],
    ["15", "15 Gubernamental"],
    ["16", "16 Exportaciones"],
  ])("etiqueta el tipo %s", (tipo, etiqueta) => {
    expect(etiquetaTipoComprobante(tipo)).toBe(etiqueta);
  });

  test("usa títulos claros para B14, B15 y B16", () => {
    expect(tituloTipoComprobante("14")).toBe("Comprobante de Régimen Especial");
    expect(tituloTipoComprobante("15")).toBe("Comprobante Gubernamental");
    expect(tituloTipoComprobante("16")).toBe("Comprobante de Exportación");
  });

  test("conserva los títulos de crédito fiscal y consumo", () => {
    expect(tituloTipoComprobante("01")).toBe("Factura de Crédito Fiscal");
    expect(tituloTipoComprobante("02")).toBe("Factura de Consumo");
  });

  test("reconoce solo los tipos soportados", () => {
    expect(esTipoComprobante("14")).toBe(true);
    expect(esTipoComprobante("16")).toBe(true);
    expect(esTipoComprobante("03")).toBe(false);
  });
});

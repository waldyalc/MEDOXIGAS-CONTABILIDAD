import { describe, expect, test } from "vitest";

import { libroTexto } from "../comun";
import type { DocumentoFiscal } from "../tipos";
import { formasPagoVacias } from "../tipos";
import { encabezado608, FORMATO_608, fila608, tipoAnulacion608 } from "./608";

function documento(overrides: Partial<DocumentoFiscal> = {}): DocumentoFiscal {
  return {
    id: "f1",
    numero: 1,
    ncf: "B0100000001",
    ncfModificado: null,
    fecha: "2026-11-13",
    tipoComprobante: "01",
    contactoId: "c1",
    contactoNombre: "Constructora Prueba SRL",
    rnc: "101010101",
    base: 1410000,
    baseBienes: 0,
    baseServicios: 0,
    itbis: 253800,
    otrosImpuestos: 0,
    propina: 0,
    total: 1663800,
    pagado: 0,
    credito: 0,
    estado: "anulada",
    clase: "venta",
    ruta: "/dashboard/facturacion/f1",
    pagos: formasPagoVacias(),
    ...overrides,
  };
}

describe("formato 608", () => {
  test("exporta el tipo de anulación del motivo sin cero inicial (Alegra: 06 → 6)", () => {
    const anulado = { ...documento({ ncf: "B0200000003", fecha: "2026-11-05" }), codigoAnulacion: "06" };

    expect(fila608(anulado)).toEqual({
      ncf: "B0200000003",
      fechaComprobante: "20261105",
      tipoAnulacion: "6",
    });
  });

  test("cambia el tipo según el motivo y respeta los códigos de dos dígitos", () => {
    expect(tipoAnulacion608("01")).toBe("1");
    expect(tipoAnulacion608("04")).toBe("4");
    expect(tipoAnulacion608("06")).toBe("6");
    expect(tipoAnulacion608("10")).toBe("10");
  });

  test("exporta la fecha del comprobante, no la fecha de anulación", () => {
    const anulado = {
      ...documento({ ncf: "B0200000003", fecha: "2026-11-05" }),
      fechaAnulacion: "2026-12-01",
      codigoAnulacion: "06",
    };

    expect(fila608(anulado).fechaComprobante).toBe("20261105");
  });

  test("una anulación vieja sin motivo conserva el tipo 4", () => {
    expect(tipoAnulacion608(null)).toBe("4");
    expect(tipoAnulacion608(undefined)).toBe("4");
    expect(fila608(documento({ ncf: "B0200000003", fecha: "2026-11-05" })).tipoAnulacion).toBe("4");
  });

  test("arma el encabezado e informa cero registros", () => {
    expect(encabezado608([], "101010101", "202611")).toEqual({
      rnc: "101010101",
      periodo: "202611",
      cantidad: 0,
    });
  });

  test("exporta el TXT con el detalle de tres columnas", () => {
    const anulado = {
      ...documento({ ncf: "B0200000003", fecha: "2026-11-05" }),
      codigoAnulacion: "06",
    };
    const texto = libroTexto(
      FORMATO_608.encabezado,
      FORMATO_608.detalle,
      encabezado608([anulado], "101010101", "202611"),
      [fila608(anulado)],
    );

    expect(texto.split("\r\n")).toEqual(["101010101|202611|1", "B0200000003|20261105|6"]);
  });
});

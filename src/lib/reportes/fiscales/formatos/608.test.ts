import { describe, expect, test } from "vitest";

import { libroTexto } from "../comun";
import type { DocumentoFiscal } from "../tipos";
import { formasPagoVacias } from "../tipos";
import { encabezado608, FORMATO_608, fila608 } from "./608";

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
    estado: "abierta",
    clase: "venta",
    ruta: "/dashboard/facturacion/f1",
    pagos: formasPagoVacias(),
    ...overrides,
  };
}

describe("formato 608", () => {
  test("arma la fila de comprobante anulado", () => {
    expect(fila608(documento({ ncf: "B0200000003", fecha: "2026-11-05", estado: "anulada" }))).toEqual({
      ncf: "B0200000003",
      fechaComprobante: "20261105",
      tipoAnulacion: "4",
    });
  });

  test("arma el encabezado e informa cero registros", () => {
    expect(encabezado608([], "101010101", "202611")).toEqual({
      rnc: "101010101",
      periodo: "202611",
      cantidad: 0,
    });
  });

  test("exporta el TXT con el detalle de tres columnas", () => {
    const anulado = documento({ ncf: "B0200000003", fecha: "2026-11-05", estado: "anulada" });
    const texto = libroTexto(
      FORMATO_608.encabezado,
      FORMATO_608.detalle,
      encabezado608([anulado], "101010101", "202611"),
      [fila608(anulado)],
    );

    expect(texto.split("\r\n")).toEqual(["101010101|202611|1", "B0200000003|20261105|4"]);
  });
});

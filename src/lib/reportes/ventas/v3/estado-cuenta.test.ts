import { describe, expect, test } from "vitest";

import { calcularEstadoCuenta, diferenciaDias, filtrarDocumentos, resumirEstadoCuenta } from "./estado-cuenta";
import type { FilaEstadoCuenta } from "./tipos";

const CORTE = "2026-11-13";

const FILA_CONSTRUCTORA: FilaEstadoCuenta = {
  facturaId: "f1",
  numero: 1,
  ncf: "B0100000001",
  fecha: "2026-11-13",
  vencimiento: "2026-12-13",
  total: "16638.00",
  cobrado: "8000.00",
};

describe("calcularEstadoCuenta", () => {
  test("reproduce el estado de cuenta de Constructora Prueba SRL", () => {
    const documentos = calcularEstadoCuenta([FILA_CONSTRUCTORA], CORTE);
    const documento = documentos[0];

    expect(documento?.documento).toBe("B0100000001");
    expect(documento?.creacion).toBe("2026-11-13");
    expect(documento?.vencimiento).toBe("2026-12-13");
    expect(documento?.antiguedad).toBe(0);
    expect(documento?.diasVencidos).toBe(0);
    expect(documento?.estado).toBe("Pendiente");
    expect(documento?.moneda).toBe("DOP");
    expect(documento?.total).toBe(1663800);
    expect(documento?.retenido).toBe(0);
    expect(documento?.cobrado).toBe(800000);
    expect(documento?.saldo).toBe(863800);
  });

  test("totaliza ventas, cobros y saldo", () => {
    const documentos = calcularEstadoCuenta(
      [
        FILA_CONSTRUCTORA,
        {
          facturaId: "f2",
          numero: 2,
          ncf: "B0200000001",
          fecha: "2026-11-01",
          vencimiento: "2026-11-10",
          total: "5192.00",
          cobrado: "5192.00",
        },
      ],
      CORTE,
    );

    expect(resumirEstadoCuenta(documentos)).toEqual({
      totalVentas: 2183000,
      retenciones: 0,
      totalCobrado: 1319200,
      saldoPorCobrar: 863800,
    });
  });

  test("marca Cobrada cuando no queda saldo", () => {
    const documentos = calcularEstadoCuenta([{ ...FILA_CONSTRUCTORA, cobrado: "16638.00" }], CORTE);
    expect(documentos[0]?.estado).toBe("Cobrada");
    expect(documentos[0]?.saldo).toBe(0);
  });

  test("calcula antigüedad y días vencidos contra el corte", () => {
    expect(diferenciaDias("2026-11-13", CORTE)).toBe(0);
    expect(diferenciaDias("2026-10-04", CORTE)).toBe(40);

    const documentos = calcularEstadoCuenta(
      [{ ...FILA_CONSTRUCTORA, fecha: "2026-10-04", vencimiento: "2026-10-20" }],
      CORTE,
    );
    expect(documentos[0]?.antiguedad).toBe(40);
    expect(documentos[0]?.diasVencidos).toBe(24);
  });
});

describe("filtrarDocumentos", () => {
  const FILAS: FilaEstadoCuenta[] = [
    FILA_CONSTRUCTORA,
    { ...FILA_CONSTRUCTORA, facturaId: "f2", numero: 2, ncf: "B0200000001", vencimiento: "2026-11-05" },
    { ...FILA_CONSTRUCTORA, facturaId: "f3", numero: 3, ncf: null, vencimiento: "2026-10-05" },
    { ...FILA_CONSTRUCTORA, facturaId: "f4", numero: 4, ncf: "B0100000004", vencimiento: "2026-09-01" },
    { ...FILA_CONSTRUCTORA, facturaId: "f5", numero: 5, ncf: "B0100000005", vencimiento: "2026-07-01" },
  ];
  const documentos = calcularEstadoCuenta(FILAS, CORTE);

  test("filtra por estado de vencimiento", () => {
    expect(filtrarDocumentos(documentos, "todas", "")).toHaveLength(5);
    expect(filtrarDocumentos(documentos, "sin-vencer", "")).toHaveLength(1);
    expect(filtrarDocumentos(documentos, "1-30", "")).toHaveLength(1);
    expect(filtrarDocumentos(documentos, "31-60", "")).toHaveLength(1);
    expect(filtrarDocumentos(documentos, "61-90", "")).toHaveLength(1);
    expect(filtrarDocumentos(documentos, "91-mas", "")).toHaveLength(1);
  });

  test("busca por documento", () => {
    expect(filtrarDocumentos(documentos, "todas", "b0200")).toHaveLength(1);
    expect(filtrarDocumentos(documentos, "todas", "#3")).toHaveLength(1);
  });
});

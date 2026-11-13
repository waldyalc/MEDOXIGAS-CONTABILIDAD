import { describe, expect, test } from "vitest";

import {
  calcularEstadoCuenta,
  diasVencidos,
  type FilaEstadoCuenta,
  type PagoEstadoCuenta,
  parsearFiltrosEstadoCuenta,
  tablaEstadoCuenta,
  tramoAntiguedad,
} from "./estado-cuenta";
import type { DocumentoFicha } from "./ficha";

function factura(sobrescribe: Partial<DocumentoFicha> = {}): DocumentoFicha {
  return {
    id: "factura-1",
    numero: 1,
    ncf: "B0100000001",
    fecha: "2026-11-01",
    vencimiento: "2026-11-30",
    total: 16638,
    pagado: 8000,
    estado: "abierta",
    ...sobrescribe,
  };
}

function pago(sobrescribe: Partial<PagoEstadoCuenta> = {}): PagoEstadoCuenta {
  return {
    factura_id: "factura-1",
    fecha: "2026-11-13",
    monto: 8000,
    estado: "activo",
    ...sobrescribe,
  };
}

describe("días vencidos y antigüedad", () => {
  test("calcula días vencidos contra la fecha de corte", () => {
    expect(diasVencidos("2026-11-30", "2026-12-05")).toBe(5);
    expect(diasVencidos("2026-11-30", "2026-11-30")).toBe(0);
    expect(diasVencidos("2026-11-30", "2026-11-01")).toBe(0);
  });

  test("clasifica los tramos en los límites", () => {
    expect(tramoAntiguedad(0)).toBe("al-dia");
    expect(tramoAntiguedad(1)).toBe("1-30");
    expect(tramoAntiguedad(30)).toBe("1-30");
    expect(tramoAntiguedad(31)).toBe("31-60");
    expect(tramoAntiguedad(60)).toBe("31-60");
    expect(tramoAntiguedad(61)).toBe("61-90");
    expect(tramoAntiguedad(90)).toBe("61-90");
    expect(tramoAntiguedad(91)).toBe("+90");
  });
});

describe("estado de cuenta al corte", () => {
  const facturas = [
    factura(),
    factura({ id: "factura-2", numero: 2, fecha: "2026-11-10", vencimiento: "2026-11-05", total: 1000, pagado: 0 }),
    factura({ id: "factura-3", numero: 3, estado: "anulada", total: 5000, pagado: 0 }),
    factura({ id: "factura-4", numero: 4, fecha: "2026-12-10", total: 700, pagado: 0 }),
  ];

  const pagos = [
    pago(),
    pago({ fecha: "2026-12-10", monto: 1000 }),
    pago({ fecha: "2026-11-20", monto: 500, estado: "anulado" }),
    pago({ factura_id: null, monto: 300 }),
  ];

  test("toma cobros activos hasta el corte y excluye anuladas y facturas futuras", () => {
    const resumen = calcularEstadoCuenta(facturas, pagos, "2026-12-05");

    expect(resumen.filas.map((fila) => fila.id)).toEqual(["factura-1", "factura-2"]);
    expect(resumen.filas[0]).toMatchObject({
      totalCentavos: 1663800,
      cobradoCentavos: 800000,
      saldoCentavos: 863800,
      diasVencidos: 5,
      tramo: "1-30",
      pagada: false,
    });
    expect(resumen.filas[1]).toMatchObject({
      totalCentavos: 100000,
      cobradoCentavos: 0,
      saldoCentavos: 100000,
      diasVencidos: 30,
      tramo: "1-30",
      pagada: false,
    });
    expect(resumen.totales).toEqual({
      ventas: 1763800,
      cobrado: 800000,
      porCobrar: 963800,
    });
  });

  test("marca como pagada cuando el cobro cubre el total al corte", () => {
    const resumen = calcularEstadoCuenta([factura({ total: 8000 })], [pago({ monto: 8000 })], "2026-12-05");
    expect(resumen.filas[0]?.pagada).toBe(true);
    expect(resumen.filas[0]?.saldoCentavos).toBe(0);
  });

  test("filtra por tramo de antigüedad", () => {
    const sesentaYUnNoventa = calcularEstadoCuenta(facturas, pagos, "2027-01-29", "61-90");
    expect(sesentaYUnNoventa.filas.map((fila) => fila.id)).toEqual(["factura-2"]);
    expect(sesentaYUnNoventa.totales).toEqual({ ventas: 100000, cobrado: 0, porCobrar: 100000 });

    const vacio = calcularEstadoCuenta(facturas, pagos, "2027-01-29", "1-30");
    expect(vacio.filas).toHaveLength(0);
    expect(vacio.totales).toEqual({ ventas: 0, cobrado: 0, porCobrar: 0 });
  });

  test("ordena por fecha y número ascendente", () => {
    const filas = calcularEstadoCuenta(
      [factura({ id: "b", numero: 2, fecha: "2026-11-02" }), factura({ id: "a", numero: 1, fecha: "2026-11-02" })],
      [],
      "2026-12-05",
    ).filas;
    expect(filas.map((fila: FilaEstadoCuenta) => fila.id)).toEqual(["a", "b"]);
  });
});

describe("tabla exportable del estado de cuenta", () => {
  test("refleja las filas visibles, los totales y los filtros aplicados", () => {
    const resumen = calcularEstadoCuenta([factura()], [pago()], "2026-11-30", "al-dia");
    const tabla = tablaEstadoCuenta("Cliente Uno", { corte: "2026-11-30", antiguedad: "al-dia" }, resumen);

    expect(tabla.subtitulo).toContain("Cliente Uno");
    expect(tabla.subtitulo).toContain("30/11/2026");
    expect(tabla.subtitulo).toContain("Al día");
    expect(tabla.filas).toHaveLength(2);
    expect(tabla.filas[0]?.celdas).toMatchObject({
      documento: "#1 · B0100000001",
      creacion: "2026-11-01",
      vencimiento: "2026-11-30",
      antiguedad: "Al día",
      diasVencidos: 0,
      estado: "Pendiente",
      total: 1663800,
      cobrado: 800000,
      saldo: 863800,
    });
    expect(tabla.filas[1]).toMatchObject({
      celdas: { documento: "Totales", total: 1663800, cobrado: 800000, saldo: 863800 },
      estilo: "total",
    });
  });
});

describe("filtros del estado de cuenta", () => {
  test("usa hoy y todas cuando faltan o son inválidos", () => {
    expect(parsearFiltrosEstadoCuenta({}, "2026-11-13")).toEqual({ corte: "2026-11-13", antiguedad: "todas" });
    expect(parsearFiltrosEstadoCuenta({ corte: "2026-02-30" }, "2026-11-13")).toEqual({
      corte: "2026-11-13",
      antiguedad: "todas",
    });
    expect(parsearFiltrosEstadoCuenta({ antiguedad: "todo" }, "2026-11-13")).toEqual({
      corte: "2026-11-13",
      antiguedad: "todas",
    });
  });

  test("acepta corte y tramo válidos, incluso como arreglo", () => {
    expect(parsearFiltrosEstadoCuenta({ corte: ["2026-10-31"], antiguedad: "61-90" }, "2026-11-13")).toEqual({
      corte: "2026-10-31",
      antiguedad: "61-90",
    });
    expect(parsearFiltrosEstadoCuenta({ antiguedad: "+90" }, "2026-11-13").antiguedad).toBe("+90");
  });
});

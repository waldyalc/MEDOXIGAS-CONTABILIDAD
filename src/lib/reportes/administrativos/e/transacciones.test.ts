import { describe, expect, test } from "vitest";

import {
  filtrarTransacciones,
  type MovimientoTransaccion,
  paginarTransacciones,
  totalesTransacciones,
} from "./transacciones";

function movimiento(
  id: string,
  comprobante: string,
  entradas: number,
  salidas: number,
  extras: Partial<MovimientoTransaccion> = {},
): MovimientoTransaccion {
  return {
    id,
    origen: entradas > 0 ? "pago_recibido" : "gasto_menor",
    comprobante,
    fecha: "2026-11-13",
    cuentaId: "cuenta-1",
    cuenta: "Caja chica",
    contactoId: null,
    contactoNombre: null,
    detalle: "Detalle",
    entradas,
    salidas,
    estado: "activo",
    ...extras,
  };
}

const MOVIMIENTOS: MovimientoTransaccion[] = [
  movimiento("g3", "B1300000003", 0, 30_000),
  movimiento("g2", "B1300000002", 0, 25_000),
  movimiento("g1", "B1300000001", 0, 50_000),
  movimiento("pr2", "2", 800_000, 0, { origen: "pago_recibido", cuenta: "Caja general" }),
  movimiento("pr1", "1", 519_200, 0, { origen: "pago_recibido", cuenta: "Tarjeta de crédito empresarial" }),
  movimiento("pp1", "1", 0, 4_602_000, { origen: "pago_proveedor", cuenta: "Banco 1" }),
];

describe("reporte de transacciones", () => {
  test("totaliza entradas y salidas como las notas", () => {
    expect(totalesTransacciones(MOVIMIENTOS)).toEqual({ entradas: 1_319_200, salidas: 4_707_000 });
  });

  test("filtra por comprobante, fecha, estado, tipo y valor", () => {
    expect(filtrarTransacciones(MOVIMIENTOS, { comprobante: "b1300000002" })).toHaveLength(1);
    expect(filtrarTransacciones(MOVIMIENTOS, { comprobante: "B13" })).toHaveLength(3);
    expect(filtrarTransacciones(MOVIMIENTOS, { fecha: "2026-11-13" })).toHaveLength(6);
    expect(filtrarTransacciones(MOVIMIENTOS, { fecha: "2026-11-12" })).toHaveLength(0);
    expect(filtrarTransacciones(MOVIMIENTOS, { estado: "anulado" })).toHaveLength(0);
    expect(filtrarTransacciones(MOVIMIENTOS, { tipo: "entrada" })).toHaveLength(2);
    expect(filtrarTransacciones(MOVIMIENTOS, { tipo: "salida" })).toHaveLength(4);
    expect(filtrarTransacciones(MOVIMIENTOS, { valorCentavos: 30_000 })).toHaveLength(1);
    expect(filtrarTransacciones(MOVIMIENTOS, { valorCentavos: 999 })).toHaveLength(0);
  });

  test("pagina de 20 en 20 y ajusta la página al rango", () => {
    const muchos = Array.from({ length: 25 }, (_, indice) => movimiento(`m-${indice}`, String(indice), 0, 100));

    const primera = paginarTransacciones(muchos, 1);
    expect(primera.filas).toHaveLength(20);
    expect(primera.totalPaginas).toBe(2);
    expect(primera.total).toBe(25);

    const segunda = paginarTransacciones(muchos, 2);
    expect(segunda.filas).toHaveLength(5);
    expect(segunda.filas[0]?.id).toBe("m-20");

    const fuera = paginarTransacciones(muchos, 99);
    expect(fuera.pagina).toBe(2);
    expect(fuera.filas).toHaveLength(5);
  });
});

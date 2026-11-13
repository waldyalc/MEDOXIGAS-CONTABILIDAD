import { describe, expect, test } from "vitest";

import { construirKardex, type MovimientoKardex } from "./kardex";

function movimiento(
  parcial: Partial<MovimientoKardex> & Pick<MovimientoKardex, "tipo" | "documentoId" | "cantidad">,
): MovimientoKardex {
  return {
    numero: 1,
    ncf: null,
    fecha: "2026-01-01",
    creadoEn: "2026-01-01T10:00:00Z",
    terceroId: "contacto-1",
    terceroNombre: "Cliente",
    costoUnitario: 0,
    ...parcial,
  };
}

describe("construirKardex", () => {
  test("calcula la existencia inicial desde la existencia actual", () => {
    const resultado = construirKardex(10, [
      movimiento({
        tipo: "compra",
        documentoId: "compra-1",
        cantidad: 4,
        fecha: "2026-01-02",
        creadoEn: "2026-01-02T09:00:00Z",
      }),
      movimiento({
        tipo: "venta",
        documentoId: "venta-1",
        cantidad: 6,
        fecha: "2026-01-03",
        creadoEn: "2026-01-03T09:00:00Z",
      }),
    ]);

    expect(resultado.existenciaInicial).toBe(12);
  });

  test("ordena por fecha, luego creado_en y desempata por id", () => {
    const resultado = construirKardex(0, [
      movimiento({
        tipo: "venta",
        documentoId: "b",
        cantidad: 1,
        fecha: "2026-01-02",
        creadoEn: "2026-01-02T09:00:00Z",
      }),
      movimiento({
        tipo: "compra",
        documentoId: "a",
        cantidad: 1,
        fecha: "2026-01-02",
        creadoEn: "2026-01-02T08:00:00Z",
      }),
      movimiento({
        tipo: "compra",
        documentoId: "c",
        cantidad: 1,
        fecha: "2026-01-01",
        creadoEn: "2026-01-01T12:00:00Z",
      }),
    ]);

    expect(resultado.filas.map((fila) => fila.documentoId)).toEqual(["c", "a", "b"]);
  });

  test("desempata por id cuando fecha y creado_en coinciden", () => {
    const resultado = construirKardex(0, [
      movimiento({ tipo: "venta", documentoId: "z", cantidad: 1 }),
      movimiento({ tipo: "venta", documentoId: "a", cantidad: 1 }),
    ]);

    expect(resultado.filas.map((fila) => fila.documentoId)).toEqual(["a", "z"]);
  });

  test("registra entradas de compras y salidas de ventas", () => {
    const resultado = construirKardex(5, [
      movimiento({
        tipo: "compra",
        documentoId: "compra-1",
        cantidad: 4,
        costoUnitario: 25,
        fecha: "2026-01-01",
      }),
      movimiento({
        tipo: "venta",
        documentoId: "venta-1",
        cantidad: 6,
        costoUnitario: 25,
        fecha: "2026-01-02",
      }),
    ]);

    expect(resultado.filas[0]?.entrada).toBe(4);
    expect(resultado.filas[0]?.salida).toBe(0);
    expect(resultado.filas[1]?.entrada).toBe(0);
    expect(resultado.filas[1]?.salida).toBe(6);
  });

  test("acumula la existencia después de cada movimiento", () => {
    const resultado = construirKardex(5, [
      movimiento({
        tipo: "compra",
        documentoId: "compra-1",
        cantidad: 4,
        fecha: "2026-01-01",
        creadoEn: "2026-01-01T09:00:00Z",
      }),
      movimiento({
        tipo: "venta",
        documentoId: "venta-1",
        cantidad: 6,
        fecha: "2026-01-02",
        creadoEn: "2026-01-02T09:00:00Z",
      }),
    ]);

    expect(resultado.existenciaInicial).toBe(7);
    expect(resultado.filas.map((fila) => fila.existencia)).toEqual([11, 5]);
  });

  test("devuelve la existencia actual sin movimientos", () => {
    const resultado = construirKardex(3.5, []);

    expect(resultado.existenciaInicial).toBe(3.5);
    expect(resultado.filas).toEqual([]);
  });

  test("agrupa varias líneas del mismo documento y pondera el costo", () => {
    const resultado = construirKardex(0, [
      movimiento({
        tipo: "venta",
        documentoId: "venta-1",
        numero: 7,
        cantidad: 2,
        costoUnitario: 10,
      }),
      movimiento({
        tipo: "venta",
        documentoId: "venta-1",
        numero: 7,
        cantidad: 3,
        costoUnitario: 20,
      }),
    ]);

    expect(resultado.filas).toHaveLength(1);
    expect(resultado.filas[0]?.salida).toBe(5);
    expect(resultado.filas[0]?.costoUnitario).toBe(16);
    expect(resultado.filas[0]?.existencia).toBe(0);
  });

  test("redondea a centavos el costo unitario ponderado", () => {
    const resultado = construirKardex(0, [
      movimiento({ tipo: "compra", documentoId: "compra-1", cantidad: 1, costoUnitario: 10 }),
      movimiento({ tipo: "compra", documentoId: "compra-1", cantidad: 1, costoUnitario: 20 }),
      movimiento({ tipo: "compra", documentoId: "compra-1", cantidad: 1, costoUnitario: 20 }),
    ]);

    expect(resultado.filas[0]?.costoUnitario).toBe(16.67);
  });
});

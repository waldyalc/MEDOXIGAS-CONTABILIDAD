import { describe, expect, test } from "vitest";

import { numeroConsecutivo, previsualizarNcf } from "./preview";
import type { Numeracion } from "./tipos";

const ID_UNO = "00000000-0000-4000-8000-000000000001";
const ID_DOS = "00000000-0000-4000-8000-000000000002";

function numeracion(cambios: Partial<Numeracion> = {}): Numeracion {
  return {
    id: ID_UNO,
    tipo_comprobante: "02",
    nombre: "Consumo",
    prefijo: "B02",
    siguiente: 18171,
    hasta: 100000,
    vence: null,
    activa: true,
    ...cambios,
  };
}

describe("previsualización del NCF", () => {
  test("muestra el siguiente número con ocho dígitos, como Alegra", () => {
    expect(previsualizarNcf({ numeraciones: [numeracion()], tipo: "02", fecha: "2026-11-17" })).toEqual({
      estado: "lista",
      ncf: "B0200018171",
    });
  });

  test("rellena con ceros el consecutivo", () => {
    expect(numeroConsecutivo(1)).toBe("00000001");
    expect(numeroConsecutivo(18171)).toBe("00018171");
  });

  test("recorta el consecutivo a ocho dígitos igual que lpad", () => {
    expect(numeroConsecutivo(123456789)).toBe("12345678");
  });

  test("elige la numeración activa con el id más bajo, como la RPC", () => {
    const segunda = numeracion({ id: ID_DOS, siguiente: 90 });
    const primera = numeracion({ id: ID_UNO, siguiente: 5 });

    expect(previsualizarNcf({ numeraciones: [segunda, primera], tipo: "02", fecha: "2026-11-17" })).toEqual({
      estado: "lista",
      ncf: "B0200000005",
    });
  });

  test("no usa numeraciones de otro tipo ni inactivas", () => {
    const inactiva = numeracion({ id: ID_UNO, activa: false, siguiente: 7 });
    const otroTipo = numeracion({ id: ID_DOS, tipo_comprobante: "01", prefijo: "B01", siguiente: 9 });
    const consumo = numeracion({ id: "00000000-0000-4000-8000-000000000003", siguiente: 11 });

    expect(previsualizarNcf({ numeraciones: [inactiva, otroTipo, consumo], tipo: "02", fecha: "2026-11-17" })).toEqual({
      estado: "lista",
      ncf: "B0200000011",
    });
  });

  test("avisa cuando el tipo no tiene numeración configurada", () => {
    expect(previsualizarNcf({ numeraciones: [], tipo: "01", fecha: "2026-11-17" })).toEqual({
      estado: "no-disponible",
      mensaje: "No hay numeración configurada para 01 Crédito fiscal.",
    });
  });

  test("distingue una numeración inactiva de una inexistente", () => {
    expect(
      previsualizarNcf({
        numeraciones: [numeracion({ activa: false })],
        tipo: "02",
        fecha: "2026-11-17",
      }),
    ).toEqual({
      estado: "no-disponible",
      mensaje: "La numeración de 02 Consumo está inactiva.",
    });
  });

  test("avisa cuando la numeración está agotada", () => {
    expect(
      previsualizarNcf({
        numeraciones: [numeracion({ siguiente: 100001, hasta: 100000 })],
        tipo: "02",
        fecha: "2026-11-17",
      }),
    ).toEqual({
      estado: "no-disponible",
      mensaje: "La numeración B02 está agotada: llegó a su último número (100000).",
    });
  });

  test("permite usar el último número antes de agotarse", () => {
    expect(
      previsualizarNcf({
        numeraciones: [numeracion({ siguiente: 100000, hasta: 100000 })],
        tipo: "02",
        fecha: "2026-11-17",
      }),
    ).toEqual({ estado: "lista", ncf: "B0200100000" });
  });

  test("avisa cuando la numeración venció antes de la fecha de la factura", () => {
    expect(
      previsualizarNcf({
        numeraciones: [numeracion({ vence: "2026-12-31" })],
        tipo: "02",
        fecha: "2027-01-01",
      }),
    ).toEqual({
      estado: "no-disponible",
      mensaje: "La numeración B02 venció el 31/12/2026.",
    });
  });

  test("permite facturar el mismo día del vencimiento", () => {
    expect(
      previsualizarNcf({
        numeraciones: [numeracion({ vence: "2026-12-31" })],
        tipo: "02",
        fecha: "2026-12-31",
      }),
    ).toEqual({ estado: "lista", ncf: "B0200018171" });
  });

  test("una numeración sin vencimiento nunca está vencida", () => {
    expect(
      previsualizarNcf({
        numeraciones: [numeracion({ vence: null })],
        tipo: "02",
        fecha: "2099-01-01",
      }),
    ).toEqual({ estado: "lista", ncf: "B0200018171" });
  });

  test("no salta a otra numeración si la primera está agotada, igual que la RPC", () => {
    const agotada = numeracion({ id: ID_UNO, siguiente: 100001, hasta: 100000 });
    const disponible = numeracion({ id: ID_DOS, siguiente: 1 });

    expect(previsualizarNcf({ numeraciones: [agotada, disponible], tipo: "02", fecha: "2026-11-17" })).toMatchObject({
      estado: "no-disponible",
    });
  });

  test("no modifica ni consume la numeración", () => {
    const segunda = Object.freeze(numeracion({ id: ID_DOS, siguiente: 90 }));
    const primera = Object.freeze(numeracion({ id: ID_UNO, siguiente: 5 }));
    const numeraciones = Object.freeze([segunda, primera]);

    expect(previsualizarNcf({ numeraciones, tipo: "02", fecha: "2026-11-17" })).toEqual({
      estado: "lista",
      ncf: "B0200000005",
    });
    expect(previsualizarNcf({ numeraciones, tipo: "02", fecha: "2026-11-17" })).toEqual({
      estado: "lista",
      ncf: "B0200000005",
    });
    expect(numeraciones).toEqual([segunda, primera]);
    expect(primera.siguiente).toBe(5);
    expect(segunda.siguiente).toBe(90);
  });
});

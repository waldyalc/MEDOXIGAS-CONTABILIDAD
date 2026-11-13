import { describe, expect, it } from "vitest";

import {
  baseDeRetencion,
  calcularRetenciones,
  montoDeRetencion,
  type RetencionCalculo,
  totalRetenido,
} from "./calculo";

const ITBIS_30: RetencionCalculo = { id: "itbis-30", nombre: "ITBIS 30 %", tipo: "itbis", porcentaje: 30 };
const ITBIS_100: RetencionCalculo = { id: "itbis-100", nombre: "ITBIS 100 %", tipo: "itbis", porcentaje: 100 };
const ISR_10: RetencionCalculo = { id: "isr-10", nombre: "ISR 10 % honorarios", tipo: "isr", porcentaje: 10 };
const ISR_2: RetencionCalculo = { id: "isr-2", nombre: "ISR 2 % servicios", tipo: "isr", porcentaje: 2 };

const BASE = { subtotal: 1000, itbis: 180 };

describe("base de retención", () => {
  it("usa el ITBIS de la factura para las retenciones de ITBIS", () => {
    expect(baseDeRetencion(ITBIS_30, BASE)).toBe(18000);
  });

  it("usa el subtotal neto para las retenciones de ISR", () => {
    expect(baseDeRetencion(ISR_10, BASE)).toBe(100000);
  });

  it("acepta montos como texto de la base", () => {
    expect(baseDeRetencion(ISR_2, { subtotal: "1000.50", itbis: "180.09" })).toBe(100050);
  });
});

describe("monto de retención", () => {
  it("calcula 30 % del ITBIS", () => {
    expect(montoDeRetencion(ITBIS_30, BASE)).toBe(5400);
  });

  it("calcula 100 % del ITBIS", () => {
    expect(montoDeRetencion(ITBIS_100, BASE)).toBe(18000);
  });

  it("calcula 10 % del subtotal", () => {
    expect(montoDeRetencion(ISR_10, BASE)).toBe(10000);
  });

  it("redondea a centavos", () => {
    expect(montoDeRetencion(ITBIS_30, { subtotal: 100, itbis: 18.55 })).toBe(557);
  });
});

describe("retenciones seleccionadas", () => {
  const catalogo = [ITBIS_30, ITBIS_100, ISR_10, ISR_2];

  it("devuelve el detalle en el orden elegido", () => {
    const filas = calcularRetenciones([ITBIS_30.id, ISR_10.id], catalogo, BASE);

    expect(filas).toEqual([
      { retencion: ITBIS_30, base: 180, monto: 54 },
      { retencion: ISR_10, base: 1000, monto: 100 },
    ]);
  });

  it("ignora repetidas y desconocidas", () => {
    const filas = calcularRetenciones([ITBIS_30.id, ITBIS_30.id, "otra"], catalogo, BASE);

    expect(filas).toHaveLength(1);
    expect(filas[0]?.monto).toBe(54);
  });

  it("suma el total retenido", () => {
    const filas = calcularRetenciones([ITBIS_30.id, ISR_10.id], catalogo, BASE);

    expect(totalRetenido(filas)).toBe(154);
  });
});

import { describe, expect, test } from "vitest";

import {
  aCentavos,
  construirTransacciones,
  type DocumentoFicha,
  etiquetaEstadoDocumento,
  etiquetaEstadoPago,
  filtrarPorNumero,
  type PagoFicha,
  saldoDocumento,
  totalAnticipos,
  totalPorCobrar,
  totalPorPagar,
} from "./ficha";

function documento(sobrescribe: Partial<DocumentoFicha> = {}): DocumentoFicha {
  return {
    id: "doc-1",
    numero: 1,
    ncf: "B0100000001",
    fecha: "2026-11-13",
    vencimiento: "2026-12-13",
    total: 16638,
    pagado: 8000,
    estado: "abierta",
    ...sobrescribe,
  };
}

function pago(sobrescribe: Partial<PagoFicha> = {}): PagoFicha {
  return {
    id: "pago-1",
    numero: 1,
    fecha: "2026-11-13",
    monto: 8000,
    estado: "activo",
    factura_id: "doc-1",
    factura_numero: 1,
    ...sobrescribe,
  };
}

describe("dinero de la ficha en centavos enteros", () => {
  test("convierte montos sin errores de flotante", () => {
    expect(aCentavos(0.1) + aCentavos(0.2)).toBe(30);
    expect(aCentavos(19.99)).toBe(1999);
    expect(aCentavos("1234.56")).toBe(123456);
    expect(aCentavos(null)).toBe(0);
    expect(aCentavos("no-es-monto")).toBe(0);
  });

  test("calcula el saldo de un documento sin bajar de cero", () => {
    expect(saldoDocumento("16638.00", "8000.00")).toBe(863800);
    expect(saldoDocumento(1000, 1200)).toBe(0);
  });
});

describe("resúmenes de la ficha", () => {
  test("por cobrar suma solo facturas no anuladas", () => {
    expect(
      totalPorCobrar([
        documento(),
        documento({ id: "doc-2", total: 1000, pagado: 250 }),
        documento({ id: "doc-3", estado: "anulada" }),
      ]),
    ).toBe(863800 + 75000);
  });

  test("por pagar suma solo facturas de proveedor no anuladas", () => {
    expect(
      totalPorPagar([
        documento({ id: "compra-1", total: 46020, pagado: 46020 }),
        documento({ id: "compra-2", total: 1000, pagado: 0 }),
        documento({ id: "compra-3", estado: "anulada", total: 5000, pagado: 0 }),
      ]),
    ).toBe(100000);
  });

  test("anticipos recibidos toma pagos activos sin factura", () => {
    expect(
      totalAnticipos([
        pago({ id: "anticipo-1", factura_id: null, factura_numero: null, monto: 500 }),
        pago({ id: "aplicado", monto: 8000 }),
        pago({ id: "anulado", factura_id: null, factura_numero: null, monto: 300, estado: "anulado" }),
      ]),
    ).toBe(50000);
  });
});

describe("filtro por número", () => {
  const filas = [
    { numero: 1, ncf: "B0100000001" },
    { numero: 2, ncf: "B0100000002" },
    { numero: 12, ncf: null },
  ];

  test("coincide con el número y con el NCF", () => {
    expect(filtrarPorNumero(filas, "2").map((fila) => fila.numero)).toEqual([2, 12]);
    expect(filtrarPorNumero(filas, "b0100000001").map((fila) => fila.numero)).toEqual([1]);
  });

  test("sin filtro devuelve todas las filas", () => {
    expect(filtrarPorNumero(filas, "  ")).toHaveLength(3);
  });
});

describe("transacciones unificadas", () => {
  test("junta pagos recibidos y a proveedores, ordena por fecha y separa egresos de ingresos", () => {
    const transacciones = construirTransacciones(
      [
        pago({ id: "r-1", numero: 2, fecha: "2026-11-13", monto: 8000, factura_numero: 1 }),
        pago({
          id: "r-2",
          numero: 3,
          fecha: "2026-11-12",
          monto: 500,
          factura_id: null,
          factura_numero: null,
        }),
      ],
      [pago({ id: "p-1", numero: 1, fecha: "2026-11-13", monto: 46020, factura_numero: 50 })],
    );

    expect(transacciones.map((transaccion) => transaccion.clave)).toEqual([
      "recibido-r-1",
      "proveedor-p-1",
      "recibido-r-2",
    ]);
    expect(transacciones[0]).toMatchObject({
      egresosCentavos: 0,
      ingresosCentavos: 800000,
      href: "/dashboard/pagos-recibidos/r-1",
      detalle: "Pago recibido #2 · Factura #1",
    });
    expect(transacciones[1]).toMatchObject({
      egresosCentavos: 4602000,
      ingresosCentavos: 0,
      href: "/dashboard/compras/pagos/p-1",
      detalle: "Pago a proveedor #1 · Factura de proveedor #50",
    });
    expect(transacciones[2]?.detalle).toBe("Pago recibido #3 · Anticipo");
  });
});

describe("etiquetas de estado", () => {
  test("distingue ventas, compras y pagos", () => {
    expect(etiquetaEstadoDocumento("abierta", "venta")).toBe("Por cobrar");
    expect(etiquetaEstadoDocumento("abierta", "compra")).toBe("Por pagar");
    expect(etiquetaEstadoDocumento("pagada", "venta")).toBe("Pagada");
    expect(etiquetaEstadoDocumento("anulada", "compra")).toBe("Anulada");
    expect(etiquetaEstadoPago("activo")).toBe("Activo");
    expect(etiquetaEstadoPago("anulado")).toBe("Anulado");
  });
});

import { describe, expect, test } from "vitest";

import type { RetencionCalculo } from "@/lib/retenciones/calculo";

import {
  type FacturaPago,
  filtroFacturas,
  paginaDe,
  retenidoDeFactura,
  saldoPendiente,
  totalLineaOtroCentavos,
  totalOtrosCentavos,
  totalPaginas,
  validarPago,
} from "./multifactura";

const RETENCIONES: RetencionCalculo[] = [
  { id: "itbis-30", nombre: "ITBIS 30 %", tipo: "itbis", porcentaje: 30 },
  { id: "isr-10", nombre: "ISR 10 %", tipo: "isr", porcentaje: 10 },
];

function factura(sobrescribe: Partial<FacturaPago> = {}): FacturaPago {
  return {
    id: "f1",
    numero: 1,
    ncf: "B0100000001",
    contacto_id: "cliente-1",
    vencimiento: "2026-11-20",
    subtotal: 1000,
    itbis: 180,
    total: 1180,
    pagado: 0,
    credito: 0,
    retenido: 0,
    ...sobrescribe,
  };
}

function pago(sobrescribe: Partial<Parameters<typeof validarPago>[0]> = {}) {
  return {
    tipo: "recibido" as const,
    contactoId: "cliente-1",
    cuentaId: "cuenta-1",
    fecha: "2026-11-16",
    metodo: "efectivo" as const,
    pestana: "facturas" as const,
    filas: [{ factura: factura(), monto: "", retenciones: [] as string[] }],
    otros: [],
    retenciones: RETENCIONES,
    ...sobrescribe,
  };
}

describe("saldos de facturas", () => {
  test("resta pagado, crédito y retenido", () => {
    expect(saldoPendiente(factura({ pagado: 200, credito: 80, retenido: 100 }))).toBe(800);
  });

  test("nunca baja de cero", () => {
    expect(saldoPendiente(factura({ pagado: 2000 }))).toBe(0);
  });
});

describe("retenciones por factura", () => {
  test("ITBIS sobre el ITBIS e ISR sobre el subtotal", () => {
    expect(retenidoDeFactura(["itbis-30", "isr-10"], RETENCIONES, factura())).toBe(154);
  });

  test("sin retenciones no descuenta", () => {
    expect(retenidoDeFactura([], RETENCIONES, factura())).toBe(0);
  });
});

describe("validarPago", () => {
  test("válido con dos facturas y una retención", () => {
    const entrada = pago({
      filas: [
        { factura: factura(), monto: "500", retenciones: ["itbis-30"] },
        { factura: factura({ id: "f2", numero: 2 }), monto: "300", retenciones: [] },
      ],
    });

    expect(validarPago(entrada)).toBeNull();
  });

  test("no permite pagar más que el saldo de la fila", () => {
    const entrada = pago({ filas: [{ factura: factura(), monto: "1180.01", retenciones: [] }] });
    expect(validarPago(entrada)).toBe("El monto más las retenciones supera lo pendiente de la factura #1.");
  });

  test("no permite que monto + retenciones pase el saldo", () => {
    const entrada = pago({
      filas: [{ factura: factura(), monto: "1127", retenciones: ["itbis-30"] }],
    });
    expect(validarPago(entrada)).toBe("El monto más las retenciones supera lo pendiente de la factura #1.");
  });

  test("exige al menos una fila con monto", () => {
    expect(validarPago(pago())).toBe("Agrega el monto recibido a al menos una factura.");
  });

  test("exige cliente, cuenta y fecha", () => {
    expect(validarPago(pago({ contactoId: "", filas: [] }))).toBe("Selecciona un cliente.");
    expect(validarPago(pago({ cuentaId: "", filas: [] }))).toBe("Selecciona la cuenta de caja o banco.");
    expect(validarPago(pago({ fecha: "", filas: [] }))).toBe("Selecciona la fecha del pago.");
  });

  test("otros ingresos exige cuenta y monto", () => {
    expect(
      validarPago(
        pago({
          pestana: "otros",
          filas: [],
          otros: [
            {
              clave: "o1",
              cuentaId: "cuenta-ingreso",
              descripcion: "Servicio",
              monto: "500",
              itbisTasa: "18",
              observacion: "",
            },
          ],
        }),
      ),
    ).toBeNull();

    expect(
      validarPago(
        pago({
          pestana: "otros",
          filas: [],
          otros: [
            {
              clave: "o1",
              cuentaId: "",
              descripcion: "Servicio",
              monto: "500",
              itbisTasa: "18",
              observacion: "",
            },
          ],
        }),
      ),
    ).toBe("Selecciona la cuenta del ingreso.");
  });

  test("pago a proveedor usa sus propios mensajes", () => {
    expect(validarPago(pago({ tipo: "proveedor", contactoId: "" }))).toBe("Selecciona un proveedor.");
    expect(validarPago(pago({ tipo: "proveedor" }))).toBe("Agrega el monto pagado a al menos una factura.");
  });
});

describe("otros ingresos y egresos", () => {
  test("suma ITBIS opcional por línea", () => {
    const linea = {
      clave: "o1",
      cuentaId: "c1",
      descripcion: "Servicio",
      monto: "1000",
      itbisTasa: "18",
      observacion: "",
    };
    expect(totalLineaOtroCentavos(linea)).toBe(118000);
    expect(totalOtrosCentavos([linea, { ...linea, clave: "o2", monto: "500", itbisTasa: "0" }])).toBe(168000);
  });
});

describe("búsqueda y paginación", () => {
  const facturas = Array.from({ length: 18 }, (_, indice) =>
    factura({ id: `f${indice + 1}`, numero: indice + 1, ncf: `B01000000${String(indice + 1).padStart(2, "0")}` }),
  );

  test("filtra por número y NCF", () => {
    expect(filtroFacturas(facturas, "12").map((item) => item.numero)).toEqual([12]);
    expect(filtroFacturas(facturas, "b0100000003").map((item) => item.numero)).toEqual([3]);
  });

  test("pagina de 8 en 8", () => {
    expect(paginaDe(facturas, 1)).toHaveLength(8);
    expect(paginaDe(facturas, 3).map((item) => item.numero)).toEqual([17, 18]);
    expect(totalPaginas(facturas.length)).toBe(3);
    expect(totalPaginas(0)).toBe(1);
  });
});

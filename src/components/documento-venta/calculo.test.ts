import { describe, expect, test } from "vitest";

import {
  calcularDocumento,
  construirEntrada,
  type LineaFormulario,
  lineaVacia,
  mensajeValidacionDocumento,
} from "./calculo";

const PRODUCTOS = [
  { id: "p1", nombre: "Cemento gris 42.5kg" },
  { id: "p2", nombre: "Varilla 3/8" },
];

function linea(cambios: Partial<LineaFormulario> = {}): LineaFormulario {
  return { ...lineaVacia("l1"), productoId: "p1", ...cambios };
}

describe("calcularDocumento", () => {
  test("suma líneas con ITBIS mixto y descuentos por línea", () => {
    const { calculadas, totales } = calcularDocumento([
      linea({ clave: "l1", cantidad: "1", precio: "100.00", descuentoPct: "10", itbisTasa: "18" }),
      linea({ clave: "l2", productoId: "p2", cantidad: "2", precio: "25.00", itbisTasa: "0" }),
      linea({ clave: "l3", productoId: "p2", cantidad: "1", precio: "10.00", descuentoPct: "50", itbisTasa: "16" }),
    ]);

    expect(calculadas.map((item) => item.clave)).toEqual(["l1", "l2", "l3"]);
    expect(totales).toEqual({
      subtotalCentavos: 16000,
      descuentoCentavos: 1500,
      itbisCentavos: 1700,
      totalCentavos: 16200,
    });
  });

  test("ignora cantidad, precio y porcentajes inválidos", () => {
    const { totales } = calcularDocumento([linea({ cantidad: "", precio: "abc", descuentoPct: "x", itbisTasa: "y" })]);

    expect(totales).toEqual({
      subtotalCentavos: 0,
      descuentoCentavos: 0,
      itbisCentavos: 0,
      totalCentavos: 0,
    });
  });

  test("acepta coma decimal en la cantidad y coma de miles en el precio", () => {
    const { totales } = calcularDocumento([linea({ cantidad: "1,5", precio: "1,234.50", itbisTasa: "0" })]);

    expect(totales.subtotalCentavos).toBe(185175);
    expect(totales.totalCentavos).toBe(185175);
  });
});

describe("construirEntrada", () => {
  test("arma la factura con comprobante, opciones y pago por el total", () => {
    const entrada = construirEntrada({
      clienteId: "c1",
      fecha: "2026-11-13",
      vencimiento: "2026-12-13",
      notas: "  Entregar en la tarde  ",
      terminos: "  Crédito a 30 días  ",
      pie: "  Gracias  ",
      tipoComprobante: "01",
      pago: { cuentaId: "cuenta-1", metodo: "efectivo" },
      lineas: [
        linea({ cantidad: "2", precio: "650.00", descuentoPct: "0", itbisTasa: "18" }),
        linea({ clave: "l2", productoId: "p2", cantidad: "1", precio: "100.00", itbisTasa: "0" }),
      ],
      productos: PRODUCTOS,
    });

    expect(entrada).toEqual({
      tipo_comprobante: "01",
      contacto_id: "c1",
      fecha: "2026-11-13",
      vencimiento: "2026-12-13",
      notas: "Entregar en la tarde",
      terminos: "Crédito a 30 días",
      pie: "Gracias",
      lineas: [
        {
          producto_id: "p1",
          descripcion: "Cemento gris 42.5kg",
          cantidad: 2,
          precio: 650,
          descuento_pct: 0,
          itbis_tasa: 18,
          impuesto_id: null,
        },
        {
          producto_id: "p2",
          descripcion: "Varilla 3/8",
          cantidad: 1,
          precio: 100,
          descuento_pct: 0,
          itbis_tasa: 0,
          impuesto_id: null,
        },
      ],
      pago: { cuenta_id: "cuenta-1", metodo: "efectivo", monto: 1634 },
    });
  });

  test("arma la cotización sin comprobante, términos, pie ni pago", () => {
    const entrada = construirEntrada({
      clienteId: "c1",
      fecha: "2026-11-13",
      vencimiento: "2026-11-13",
      notas: "",
      terminos: undefined,
      pie: undefined,
      lineas: [linea()],
      productos: PRODUCTOS,
    });

    expect(entrada).toEqual({
      contacto_id: "c1",
      fecha: "2026-11-13",
      vencimiento: "2026-11-13",
      lineas: [
        {
          producto_id: "p1",
          descripcion: "Cemento gris 42.5kg",
          cantidad: 1,
          precio: 0,
          descuento_pct: 0,
          itbis_tasa: 0,
          impuesto_id: null,
        },
      ],
    });
    expect("tipo_comprobante" in entrada).toBe(false);
    expect("notas" in entrada).toBe(false);
    expect("terminos" in entrada).toBe(false);
    expect("pie" in entrada).toBe(false);
    expect("pago" in entrada).toBe(false);
  });

  test("omite textos vacíos y descripción si el producto no está en la lista", () => {
    const entrada = construirEntrada({
      clienteId: "c1",
      fecha: "2026-11-13",
      vencimiento: "2026-11-13",
      notas: "   ",
      terminos: "  ",
      pie: "",
      lineas: [linea({ productoId: "desconocido" })],
      productos: PRODUCTOS,
    });

    expect(entrada.lineas[0]?.descripcion).toBe("");
    expect("notas" in entrada).toBe(false);
    expect("terminos" in entrada).toBe(false);
    expect("pie" in entrada).toBe(false);
  });

  test("el monto del pago usa el total con ITBIS y descuento", () => {
    const entrada = construirEntrada({
      clienteId: "c1",
      fecha: "2026-11-13",
      vencimiento: "2026-11-13",
      notas: "",
      pago: { cuentaId: "cuenta-1", metodo: "transferencia" },
      lineas: [linea({ cantidad: "1", precio: "100.00", descuentoPct: "10", itbisTasa: "18" })],
      productos: PRODUCTOS,
    });

    expect(entrada.pago).toEqual({ cuenta_id: "cuenta-1", metodo: "transferencia", monto: 106.2 });
  });

  test("incluye la cotización de origen al crear un conduce", () => {
    const entrada = construirEntrada({
      clienteId: "c1",
      fecha: "2026-11-15",
      vencimiento: "2026-11-15",
      notas: "",
      cotizacionId: "cotizacion-1",
      lineas: [linea()],
      productos: PRODUCTOS,
    });

    expect(entrada.cotizacion_id).toBe("cotizacion-1");
  });

  test("no incluye cotización de origen en un documento normal", () => {
    const entrada = construirEntrada({
      clienteId: "c1",
      fecha: "2026-11-15",
      vencimiento: "2026-11-15",
      notas: "",
      lineas: [linea()],
      productos: PRODUCTOS,
    });

    expect("cotizacion_id" in entrada).toBe(false);
  });
});

describe("mensajeValidacionDocumento", () => {
  test("exige cliente", () => {
    expect(mensajeValidacionDocumento({ clienteId: "", lineas: [linea()], totalCentavos: 100 })).toBe(
      "Selecciona un cliente.",
    );
  });

  test("exige producto en todas las líneas", () => {
    expect(
      mensajeValidacionDocumento({ clienteId: "c1", lineas: [linea({ productoId: "" })], totalCentavos: 100 }),
    ).toBe("Selecciona el producto en todas las líneas.");
  });

  test("exige un total mayor que cero", () => {
    expect(mensajeValidacionDocumento({ clienteId: "c1", lineas: [linea()], totalCentavos: 0 })).toBe(
      "El total del documento debe ser mayor que cero.",
    );
  });

  test("exige cuenta de pago solo cuando se registra pago", () => {
    expect(
      mensajeValidacionDocumento({
        clienteId: "c1",
        lineas: [linea()],
        totalCentavos: 100,
        requiereCuentaPago: true,
        cuentaPago: "",
      }),
    ).toBe("Selecciona la cuenta de caja o banco para el pago.");

    expect(
      mensajeValidacionDocumento({
        clienteId: "c1",
        lineas: [linea()],
        totalCentavos: 100,
        requiereCuentaPago: true,
        cuentaPago: "cuenta-1",
      }),
    ).toBeNull();
  });
});

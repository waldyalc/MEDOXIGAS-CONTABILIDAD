import { describe, expect, test } from "vitest";

import {
  type CampoDocumento,
  calcularDocumento,
  claveErrorDocumento,
  construirEntrada,
  erroresValidacionDocumento,
  idCampoDocumento,
  type LineaFormulario,
  lineaVacia,
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

describe("erroresValidacionDocumento", () => {
  const valida = {
    clienteId: "c1",
    fecha: "2026-11-13",
    vencimiento: "2026-11-20",
    lineas: [linea({ precio: "100.00" })],
    totalCentavos: 10000,
  };

  test("no devuelve errores con los campos obligatorios completos", () => {
    expect(erroresValidacionDocumento(valida)).toEqual([]);
  });

  test("exige el cliente primero", () => {
    const errores = erroresValidacionDocumento({
      ...valida,
      clienteId: "",
      fecha: "",
      vencimiento: "",
      lineas: [linea({ productoId: "" })],
      totalCentavos: 0,
    });

    expect(errores[0]).toEqual({ campo: "cliente", mensaje: "El cliente es requerido." });
  });

  test("exige la fecha y la fecha de vencimiento", () => {
    expect(erroresValidacionDocumento({ ...valida, fecha: "", vencimiento: "" }).map((error) => error.campo)).toEqual([
      "fecha",
      "vencimiento",
    ]);
  });

  test("rechaza un vencimiento anterior a la fecha de creación", () => {
    expect(erroresValidacionDocumento({ ...valida, fecha: "2026-11-20", vencimiento: "2026-11-13" })).toEqual([
      {
        campo: "vencimiento",
        mensaje: "La fecha de vencimiento no puede ser anterior a la fecha de creación.",
      },
    ]);
  });

  test("omite el vencimiento cuando el documento no lo pide", () => {
    expect(erroresValidacionDocumento({ ...valida, conVencimiento: false, vencimiento: "" })).toEqual([]);
  });

  test("valida cada dato obligatorio de la línea", () => {
    const errores = erroresValidacionDocumento({
      ...valida,
      lineas: [linea({ productoId: "", cantidad: "0", precio: "abc", descuentoPct: "150" })],
    });

    expect(errores).toEqual([
      { campo: { linea: "l1", campo: "producto" }, mensaje: "El producto es requerido." },
      { campo: { linea: "l1", campo: "cantidad" }, mensaje: "La cantidad debe ser mayor que cero." },
      { campo: { linea: "l1", campo: "precio" }, mensaje: "El precio no es válido." },
      { campo: { linea: "l1", campo: "descuento" }, mensaje: "El descuento debe estar entre 0 y 100." },
    ]);
  });

  test("ordena los errores de las líneas antes de los totales", () => {
    const errores = erroresValidacionDocumento({
      ...valida,
      lineas: [linea({ productoId: "" }), linea({ clave: "l2", precio: "abc" })],
      totalCentavos: 0,
    });

    expect(errores.map((error) => error.campo)).toEqual([
      { linea: "l1", campo: "producto" },
      { linea: "l2", campo: "precio" },
      "total",
    ]);
  });

  test("exige un total mayor que cero", () => {
    expect(erroresValidacionDocumento({ ...valida, totalCentavos: 0 })).toEqual([
      { campo: "total", mensaje: "El total del documento debe ser mayor que cero." },
    ]);
  });

  test("exige cuenta de pago solo cuando se registra pago", () => {
    expect(erroresValidacionDocumento({ ...valida, requiereCuentaPago: true, cuentaPago: "" })).toEqual([
      { campo: "cuentaPago", mensaje: "La cuenta de caja o banco es requerida." },
    ]);

    expect(erroresValidacionDocumento({ ...valida, requiereCuentaPago: true, cuentaPago: "cuenta-1" })).toEqual([]);
  });

  test("exige al menos una línea", () => {
    expect(erroresValidacionDocumento({ ...valida, lineas: [], totalCentavos: 0 })).toEqual([
      { campo: "lineas", mensaje: "Agrega al menos una línea." },
      { campo: "total", mensaje: "El total del documento debe ser mayor que cero." },
    ]);
  });

  test("identifica el control al que se lleva el foco", () => {
    expect(idCampoDocumento("cliente")).toBe("cliente");
    expect(idCampoDocumento("fecha")).toBe("fecha");
    expect(idCampoDocumento("vencimiento")).toBe("vencimiento");
    expect(idCampoDocumento("lineas")).toBe("lineas-error");
    expect(idCampoDocumento("cuentaPago")).toBe("cuenta-pago");
    expect(idCampoDocumento("total")).toBe("total-error");
    expect(idCampoDocumento({ linea: "l1", campo: "producto" })).toBe("producto-l1");
  });

  test("genera una clave distinta por campo y línea", () => {
    const campos: CampoDocumento[] = [
      "cliente",
      { linea: "l1", campo: "producto" },
      { linea: "l1", campo: "cantidad" },
      { linea: "l2", campo: "producto" },
    ];

    expect(new Set(campos.map(claveErrorDocumento)).size).toBe(4);
  });
});

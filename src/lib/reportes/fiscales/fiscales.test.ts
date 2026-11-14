import { describe, expect, test } from "vitest";

import {
  fechaAAAAMM,
  fechaAAAAMMDD,
  formasPagoVenta,
  libroTexto,
  mismoMes,
  nombreArchivoDgii,
  rangoMes,
  textoPeriodo,
  tipoIdentificacionCompra,
  tipoIdentificacionVenta,
} from "./comun";
import { tablaComprasContador, tablaFacturasContador, tablaLibroContador } from "./contador";
import { encabezado606, FORMATO_606, fila606 } from "./formatos/606";
import { encabezado607, FORMATO_607, fila607 } from "./formatos/607";
import { encabezado608, FORMATO_608, fila608 } from "./formatos/608";
import { diferenciaImpuestos, resumirPorTasa } from "./impuestos";
import { calcularIt1, fechaLimiteIt1 } from "./it1";
import { filasRetenciones } from "./retenciones";
import type { DetalleImpuesto, DocumentoFiscal, FormasPago } from "./tipos";
import { formasPagoVacias } from "./tipos";

function documento(overrides: Partial<DocumentoFiscal> = {}): DocumentoFiscal {
  return {
    id: "f1",
    numero: 1,
    ncf: "B0100000001",
    ncfModificado: null,
    fecha: "2026-11-13",
    tipoComprobante: "01",
    contactoId: "c1",
    contactoNombre: "Constructora Prueba SRL",
    rnc: "101010101",
    base: 1410000,
    baseBienes: 0,
    baseServicios: 0,
    itbis: 253800,
    otrosImpuestos: 0,
    propina: 0,
    total: 1663800,
    pagado: 0,
    credito: 0,
    estado: "abierta",
    clase: "venta",
    ruta: "/dashboard/facturacion/f1",
    pagos: formasPagoVacias(),
    ...overrides,
  };
}

function detalle(overrides: Partial<DetalleImpuesto> = {}): DetalleImpuesto {
  return {
    documentoId: "f1",
    numero: 1,
    ncf: "B0100000001",
    tipoDocumento: "Venta",
    contactoId: "c1",
    contactoNombre: "Constructora Prueba SRL",
    fecha: "2026-11-13",
    tasa: 18,
    tipo: "itbis",
    impuestoNombre: "ITBIS (18.00%)",
    base: 1410000,
    impuesto: 253800,
    ruta: "/dashboard/facturacion/f1",
    tieneNcf: true,
    baseBienes: 0,
    baseServicios: 0,
    ...overrides,
  };
}

describe("formato 606", () => {
  test("arma la fila completa de una compra de bienes", () => {
    const fila = fila606(
      documento({
        id: "c1",
        numero: 50,
        ncf: "B0100000050",
        base: 3900000,
        baseBienes: 3900000,
        baseServicios: 0,
        itbis: 702000,
        total: 4602000,
        clase: "compra",
      }),
    );

    expect(fila).toEqual({
      rnc: "101010101",
      tipoId: "1",
      tipoBienes: "09",
      ncf: "B0100000050",
      ncfModificado: "",
      fechaComprobante: "202611",
      fechaComprobanteDia: "13",
      fechaPago: "",
      fechaPagoDia: "",
      montoServicios: 0,
      montoBienes: 3900000,
      totalMontoFacturado: 3900000,
      itbisFacturado: 702000,
      itbisRetenido: 0,
      itbisProporcionalidad: 0,
      itbisCosto: 0,
      itbisPorAdelantar: 702000,
      itbisPercibido: 0,
      tipoRetencionIsr: "",
      montoRetencionRenta: 0,
      isrPercibido: 0,
      impuestoSelectivo: 0,
      otrosImpuestos: 0,
      propina: 0,
      formaPago: "4",
    });
  });

  test("clasifica un gasto menor como servicio y efectivo", () => {
    const fila = fila606(
      documento({
        ncf: "B1300000001",
        base: 25000,
        baseBienes: 0,
        baseServicios: 25000,
        itbis: 4500,
        total: 29500,
        clase: "gasto",
      }),
    );

    expect(fila.tipoBienes).toBe("02");
    expect(fila.montoServicios).toBe(25000);
    expect(fila.montoBienes).toBe(0);
    expect(fila.formaPago).toBe("1");
  });

  test("arma el encabezado con cantidad y total", () => {
    const compras = [documento({ base: 3900000, clase: "compra" }), documento({ base: 100000, clase: "gasto" })];

    expect(encabezado606(compras, "101-010101-1", "202611")).toEqual({
      rnc: "1010101011",
      periodo: "202611",
      cantidad: 2,
      totalMontoFacturado: 4000000,
      retencionRenta: 0,
    });
  });

  test("exporta el TXT con encabezado y detalle separados por pipes", () => {
    const compra = documento({
      ncf: "B0100000050",
      base: 3900000,
      baseBienes: 3900000,
      itbis: 702000,
      clase: "compra",
    });
    const texto = libroTexto(
      FORMATO_606.encabezado,
      FORMATO_606.detalle,
      encabezado606([compra], "101010101", "202611"),
      [fila606(compra)],
    );
    const lineas = texto.split("\r\n");

    expect(lineas).toHaveLength(2);
    expect(lineas[0]).toBe("101010101|202611|1|39000.00|0.00");
    expect(lineas[1]).toContain("B0100000050|");
    expect(lineas[1]).toContain("|39000.00|39000.00|7020.00|");
  });
});

describe("formato 607", () => {
  const pagos: FormasPago = {
    efectivo: 0,
    transferencia: 800000,
    tarjeta: 0,
    credito: 863800,
    otras: 0,
  };

  test("arma la fila completa de una venta", () => {
    expect(fila607(documento({ pagos }))).toEqual({
      rnc: "101010101",
      tipoId: "1",
      ncf: "B0100000001",
      ncfModificado: "",
      tipoIngreso: "01",
      fechaComprobante: "20261113",
      fechaRetencion: "",
      montoFacturado: 1410000,
      itbisFacturado: 253800,
      itbisRetenido: 0,
      itbisPercibido: 0,
      retencionRenta: 0,
      isrPercibido: 0,
      impuestoSelectivo: 0,
      otrosImpuestos: 0,
      propina: 0,
      efectivo: 0,
      transferencia: 800000,
      tarjeta: 0,
      credito: 863800,
      bonos: 0,
      permuta: 0,
      otras: 0,
    });
  });

  test("reporta una nota de crédito en negativo con su NCF modificado", () => {
    const fila = fila607(
      documento({
        ncf: "B0400000001",
        ncfModificado: "B0100000001",
        base: 65000,
        itbis: 11700,
        total: 76700,
        clase: "devolucion-venta",
      }),
    );

    expect(fila.ncfModificado).toBe("B0100000001");
    expect(fila.montoFacturado).toBe(-65000);
    expect(fila.itbisFacturado).toBe(-11700);
  });

  test("calcula el encabezado neto de notas", () => {
    const ventas = [documento({ pagos }), documento({ base: 65000, clase: "devolucion-venta" })];

    expect(encabezado607(ventas, null, "202611")).toMatchObject({
      rnc: "",
      periodo: "202611",
      cantidad: 2,
      totalMontoFacturado: 1345000,
    });
  });

  test("exporta el TXT con montos y fecha AAAAMMDD", () => {
    const texto = libroTexto(
      FORMATO_607.encabezado,
      FORMATO_607.detalle,
      encabezado607([documento({ pagos })], "101010101", "202611"),
      [fila607(documento({ pagos }))],
    );
    const lineas = texto.split("\r\n");

    expect(lineas[0]).toBe("101010101|202611|1|14100.00");
    expect(lineas[1]).toContain("|20261113|");
    expect(lineas[1]).toContain("|14100.00|2538.00|");
  });
});

describe("formato 608", () => {
  test("arma la fila de comprobante anulado", () => {
    expect(fila608(documento({ ncf: "B0200000003", fecha: "2026-11-05", estado: "anulada" }))).toEqual({
      ncf: "B0200000003",
      fechaComprobante: "20261105",
      tipoAnulacion: "4",
    });
  });

  test("arma el encabezado e informa cero registros", () => {
    expect(encabezado608([], "101010101", "202611")).toEqual({
      rnc: "101010101",
      periodo: "202611",
      cantidad: 0,
    });
  });

  test("exporta el TXT con el detalle de tres columnas", () => {
    const anulado = documento({ ncf: "B0200000003", fecha: "2026-11-05", estado: "anulada" });
    const texto = libroTexto(
      FORMATO_608.encabezado,
      FORMATO_608.detalle,
      encabezado608([anulado], "101010101", "202611"),
      [fila608(anulado)],
    );

    expect(texto.split("\r\n")).toEqual(["101010101|202611|1", "B0200000003|20261105|4"]);
  });
});

describe("utilidades fiscales", () => {
  test("detecta el tipo de identificación y el mes", () => {
    expect(tipoIdentificacionCompra("101-01010-1")).toBe("1");
    expect(tipoIdentificacionCompra("001-0101010-1")).toBe("2");
    expect(tipoIdentificacionCompra(null)).toBe("");
    expect(tipoIdentificacionVenta(null)).toBe("3");
    expect(mismoMes("2026-11-01", "2026-11-30")).toBe(true);
    expect(mismoMes("2026-11-01", "2026-12-01")).toBe(false);
    expect(rangoMes("2026-11-15")).toEqual({ desde: "2026-11-01", hasta: "2026-11-30" });
    expect(rangoMes("2026-02-10")).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
  });

  test("formatea fechas, periodos y nombre de archivo", () => {
    expect(fechaAAAAMM("2026-11-13")).toBe("202611");
    expect(fechaAAAAMMDD("2026-11-13")).toBe("20261113");
    expect(textoPeriodo("202611")).toBe("noviembre de 2026");
    expect(nombreArchivoDgii("606", "101-010101-1", "202611")).toBe("DGII_F_606_1010101011_202611.TXT");
    expect(nombreArchivoDgii("607", null, "202611")).toBe("DGII_F_607_sin-rnc_202611.TXT");
  });

  test("reparte pagos, notas de crédito y saldo pendiente", () => {
    expect(formasPagoVenta(1663800, 800000, 0, [{ metodo: "transferencia", monto: 800000 }])).toEqual({
      efectivo: 0,
      transferencia: 800000,
      tarjeta: 0,
      credito: 863800,
      otras: 0,
    });

    expect(formasPagoVenta(76700, 0, 76700, [])).toEqual({
      efectivo: 0,
      transferencia: 0,
      tarjeta: 0,
      credito: 0,
      otras: 76700,
    });

    expect(formasPagoVenta(100000, 40000, 0, [])).toEqual({
      efectivo: 0,
      transferencia: 0,
      tarjeta: 0,
      credito: 60000,
      otras: 40000,
    });
  });
});

describe("impuestos", () => {
  test("resume por tasa y suma totales", () => {
    const resumen = resumirPorTasa([
      detalle(),
      detalle({ base: 440000, impuesto: 79200 }),
      detalle({ tasa: 0, base: 100000, impuesto: 0 }),
      detalle({ tasa: null, tipo: "exento", base: 50000, impuesto: 0 }),
      detalle({ tasa: 10, tipo: "propina", base: 50000, impuesto: 5000 }),
      detalle({ tasa: 2, tipo: "otro", base: 50000, impuesto: 1000 }),
    ]);

    expect(resumen.filas.map((fila) => [fila.etiqueta, fila.base, fila.impuesto])).toEqual([
      ["ITBIS (18%)", 1850000, 333000],
      ["ITBIS (16%)", 0, 0],
      ["ITBIS (0%)", 100000, 0],
      ["Exento (0%)", 50000, 0],
      ["Propina (10%)", 50000, 5000],
      ["CDT (2%)", 50000, 1000],
    ]);
    expect(resumen.totalBase).toBe(2100000);
    expect(resumen.totalImpuesto).toBe(339000);
  });

  test("calcula la diferencia a favor o a pagar", () => {
    const ventas = resumirPorTasa([detalle()]);
    const compras = resumirPorTasa([detalle({ base: 3900000, impuesto: 702000 })]);
    const cero = resumirPorTasa([]);

    expect(diferenciaImpuestos(ventas, compras, cero, cero)).toBe(-448200);
    expect(diferenciaImpuestos(compras, ventas, cero, cero)).toBe(448200);
  });
});

describe("IT-1", () => {
  const ventas = [detalle(), detalle({ base: 440000, impuesto: 79200 })];
  const compra = documento({
    ncf: "B0100000050",
    base: 3900000,
    baseBienes: 3900000,
    baseServicios: 0,
    itbis: 702000,
    clase: "compra",
  });

  test("calcula el IT-1 con compras deducibles", () => {
    expect(calcularIt1(ventas, [compra], 2183000)).toEqual({
      totalOperaciones: 1850000,
      noGravadas: 0,
      gravadas18: 1850000,
      gravadas16: 0,
      totalGravadas: 1850000,
      itbisCobrado18: 333000,
      itbisCobrado16: 0,
      totalItbisCobrado: 333000,
      itbisComprasLocales: 702000,
      itbisServicios: 0,
      itbisImportaciones: 0,
      totalItbisDeducible: 702000,
      impuestosAPagar: 0,
      saldoAFavor: 369000,
      pagosComputables: 0,
      totalAPagar: 0,
      diferenciaAPagar: 0,
      nuevoSaldoAFavor: 369000,
      totalGeneral: 0,
      totalFacturadoConImpuestos: 2183000,
    });
  });

  test("calcula el IT-1 sin compras y con un gasto menor", () => {
    expect(calcularIt1(ventas, [])).toMatchObject({
      itbisComprasLocales: 0,
      totalItbisDeducible: 0,
      impuestosAPagar: 333000,
      saldoAFavor: 0,
      diferenciaAPagar: 333000,
      totalGeneral: 333000,
    });

    expect(
      calcularIt1(ventas, [
        documento({
          ncf: "B1300000001",
          base: 25000,
          baseBienes: 0,
          baseServicios: 25000,
          itbis: 4500,
          clase: "gasto",
        }),
      ]),
    ).toMatchObject({
      itbisComprasLocales: 0,
      itbisServicios: 4500,
      totalItbisDeducible: 4500,
      impuestosAPagar: 328500,
    });
  });

  test("calcula la fecha límite del mes siguiente", () => {
    expect(fechaLimiteIt1("202611")).toBe("2026-12-20");
    expect(fechaLimiteIt1("202612")).toBe("2027-01-20");
  });
});

describe("impuestos y retenciones", () => {
  test("arma las filas de ventas y compras con devoluciones", () => {
    const filas = filasRetenciones(
      [detalle(), detalle({ base: 440000, impuesto: 79200 })],
      [detalle({ base: 65000, impuesto: 11700 })],
      "ventas",
    );

    expect(filas[0]).toEqual({
      nombre: "ITBIS",
      tipo: "ITBIS",
      tarifa: 18,
      baseGravable: 1850000,
      impuestos: 333000,
      baseDevoluciones: 65000,
      impuestosDevoluciones: 11700,
      saldo: 321300,
    });

    expect(filasRetenciones([detalle()], [], "compras")[0]?.tipo).toBe("ITBIS Acreditable");
  });
});

describe("exportar para el contador", () => {
  test("arma la tabla de facturas con su total", () => {
    const tabla = tablaFacturasContador([documento()], "noviembre 2026");
    const ultima = tabla.filas.at(-1);
    const primera = tabla.filas[0];

    expect(tabla.columnas.map((columna) => columna.titulo)).toContain("NCF");
    expect(primera?.celdas.ncf).toBe("B0100000001");
    expect(primera?.celdas.subtotal).toBe(1410000);
    expect(ultima?.estilo).toBe("total");
    expect(ultima?.celdas.total).toBe(1663800);
  });

  test("arma la tabla de compras y usa #numero si falta el NCF", () => {
    const tabla = tablaComprasContador([documento({ ncf: "", clase: "compra" })], "noviembre 2026");

    expect(tabla.filas[0]?.celdas.ncf).toBe("#1");
    expect(tabla.filas.at(-1)?.celdas.total).toBe(1663800);
  });

  test("arma el libro diario y cuadra débitos y créditos", () => {
    const tabla = tablaLibroContador(
      [
        {
          asiento_numero: 1,
          fecha: "2026-11-13",
          asiento_descripcion: "Factura B0100000001",
          origen_tipo: "factura",
          cuenta_codigo: "1103",
          cuenta_nombre: "Cuentas por cobrar clientes",
          debito: 16638,
          credito: 0,
        },
        {
          asiento_numero: 1,
          fecha: "2026-11-13",
          asiento_descripcion: "Factura B0100000001",
          origen_tipo: "factura",
          cuenta_codigo: "4101",
          cuenta_nombre: "Ventas de productos",
          debito: 0,
          credito: 14100,
        },
        {
          asiento_numero: 1,
          fecha: "2026-11-13",
          asiento_descripcion: "Factura B0100000001",
          origen_tipo: "factura",
          cuenta_codigo: "2102",
          cuenta_nombre: "ITBIS por pagar",
          debito: 0,
          credito: 2538,
        },
      ],
      "noviembre 2026",
    );

    expect(tabla.filas).toHaveLength(4);
    expect(tabla.filas.at(-1)?.celdas.debito).toBe(1663800);
    expect(tabla.filas.at(-1)?.celdas.credito).toBe(1663800);
  });
});

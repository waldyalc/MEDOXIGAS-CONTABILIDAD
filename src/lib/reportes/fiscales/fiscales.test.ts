import { describe, expect, test } from "vitest";

import { type CatalogoCuentasDgii, resolverClasificacionCuenta, valorPrincipal } from "./clasificacion";
import {
  diasEntreFechas,
  fechaAAAAMM,
  fechaAAAAMMDD,
  formasPagoVenta,
  itbisNotaCredito,
  libroTexto,
  mismoMes,
  nombreArchivoDgii,
  nombreArchivoDgiiExcel,
  rangoMes,
  textoPeriodo,
  tipoIdentificacionCompra,
  tipoIdentificacionVenta,
} from "./comun";
import { tablaComprasContador, tablaFacturasContador, tablaLibroContador } from "./contador";
import {
  digitoVerificadorValido,
  identificacionValida,
  MOTIVO_IDENTIFICACION_LONGITUD,
  MOTIVO_SIN_TIPO_INGRESO,
  motivoCuentaSinClasificar,
  motivoDigitoVerificador,
  motivoIdentificacionInvalida,
  separarDocumentos,
} from "./excluidos";
import { encabezado606, FORMATO_606, fila606 } from "./formatos/606";
import { encabezado607, FORMATO_607, fila607 } from "./formatos/607";
import { columnasTextoDgii } from "./formatos/tipos";
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
  test("arma la fila completa de una compra de bienes clasificada por su cuenta", () => {
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
        tipoBienes: "09",
      }),
    );

    expect(fila).toEqual({
      rnc: "101010101",
      tipoId: "1",
      tipoBienes: "09",
      ncf: "B0100000050",
      ncfModificado: "",
      fechaComprobante: "20261113",
      fechaComprobanteDia: "",
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
      itbisPercibido: "",
      tipoRetencionIsr: "",
      montoRetencionRenta: 0,
      isrPercibido: "",
      impuestoSelectivo: 0,
      otrosImpuestos: 0,
      propina: 0,
      formaPago: "04",
    });
  });

  test("una compra pagada va al contado (01) con la fecha del primer pago", () => {
    const fila = fila606(
      documento({
        ncf: "B0100000051",
        base: 60000,
        baseBienes: 60000,
        itbis: 10800,
        total: 70800,
        clase: "compra",
        tipoBienes: "09",
        fechaPago: "2026-11-20",
      }),
    );

    expect(fila.formaPago).toBe("01");
    expect(fila.fechaPago).toBe("20261120");
    expect(fila.fechaPagoDia).toBe("");
  });

  test("clasifica un gasto menor como servicio y contado", () => {
    const fila = fila606(
      documento({
        ncf: "B1300000001",
        base: 25000,
        baseBienes: 0,
        baseServicios: 25000,
        itbis: 4500,
        total: 29500,
        clase: "gasto",
        tipoBienes: "02",
        fechaPago: "2026-11-13",
      }),
    );

    expect(fila.tipoBienes).toBe("02");
    expect(fila.montoServicios).toBe(25000);
    expect(fila.montoBienes).toBe(0);
    expect(fila.formaPago).toBe("01");
  });

  test("arma el encabezado de 4 campos sin total ni retención", () => {
    const compras = [documento({ base: 3900000, clase: "compra" }), documento({ base: 100000, clase: "gasto" })];

    expect(encabezado606(compras, "101-010101-1", "202611")).toEqual({
      codigo: "606",
      rnc: "1010101011",
      periodo: "202611",
      cantidad: 2,
    });
  });

  test("exporta el TXT con el encabezado y el detalle reales de Alegra", () => {
    const compra = documento({
      rnc: "132000013",
      ncf: "B0100000051",
      base: 60000,
      baseBienes: 60000,
      itbis: 10800,
      total: 70800,
      clase: "compra",
      tipoBienes: "09",
      fecha: "2026-11-20",
    });
    const texto = libroTexto(
      FORMATO_606.encabezado,
      columnasTextoDgii(FORMATO_606),
      encabezado606([compra], "131999999", "202611"),
      [fila606(compra)],
    );
    const lineas = texto.split("\r\n");

    expect(lineas).toHaveLength(2);
    expect(lineas[0]).toBe("606|131999999|202611|1");
    expect(lineas[1]).toBe(
      "132000013|1|09|B0100000051||20261120||0.00|600.00|600.00|108.00|0.00|0.00|0.00|108.00|||0.00||0.00|0.00|0.00|04",
    );
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

  test("arma la fila completa de una venta con tipo de ingreso a 1 dígito", () => {
    expect(fila607(documento({ pagos, tipoIngreso: "1" }))).toEqual({
      rnc: "101010101",
      tipoId: "1",
      ncf: "B0100000001",
      ncfModificado: "",
      tipoIngreso: "1",
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
      montoExportaciones: 0,
    });
  });

  test("reporta una nota de crédito en positivo con su NCF modificado", () => {
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
    expect(fila.montoFacturado).toBe(65000);
    expect(fila.itbisFacturado).toBe(11700);
  });

  test("reporta la retención de ITBIS y su fecha", () => {
    const fila = fila607(
      documento({
        pagos,
        itbisRetenido: 4320,
        fechaRetencion: "2026-11-20",
        tipoIngreso: "1",
      }),
    );

    expect(fila.itbisRetenido).toBe(4320);
    expect(fila.fechaRetencion).toBe("20261120");
  });

  test("calcula el encabezado de 4 campos neto en pantalla", () => {
    const ventas = [documento({ pagos }), documento({ base: 65000, clase: "devolucion-venta" })];

    expect(encabezado607(ventas, null, "202611")).toMatchObject({
      codigo: "607",
      rnc: "",
      periodo: "202611",
      cantidad: 2,
    });
  });

  test("exporta el TXT de 23 campos sin la columna de exportaciones", () => {
    const texto = libroTexto(
      FORMATO_607.encabezado,
      columnasTextoDgii(FORMATO_607),
      encabezado607([documento({ pagos })], "101010101", "202611"),
      [fila607(documento({ pagos }))],
    );
    const lineas = texto.split("\r\n");

    expect(lineas[0]).toBe("607|101010101|202611|1");
    expect(lineas[1]).toContain("|20261113|");
    expect(lineas[1]).toContain("|14100.00|2538.00|");
    expect(lineas[1]?.split("|")).toHaveLength(23);
  });
});

describe("exclusiones de los reportes DGII", () => {
  test("el dígito verificador acepta los RNC reales de Alegra y rechaza el malo", () => {
    expect(digitoVerificadorValido("132000013")).toBe(true);
    expect(digitoVerificadorValido("402123455")).toBe(true);
    expect(digitoVerificadorValido("132000015")).toBe(false);
    expect(identificacionValida("132000013")).toBe(true);
    expect(identificacionValida("132000015")).toBe(false);
  });

  test("usa los motivos literales de Alegra", () => {
    expect(motivoIdentificacionInvalida("123")).toBe(MOTIVO_IDENTIFICACION_LONGITUD);
    expect(motivoIdentificacionInvalida("132000015")).toBe(
      "La comprobación del dígito verificador de la identificación: 132000015 fue erronea",
    );
    expect(motivoDigitoVerificador("132-000-015")).toContain("132000015");
    expect(motivoCuentaSinClasificar("Gastos varios")).toBe(
      "La cuenta contable Gastos varios o su cuenta contable madre aún no tienen configurada la clasificación de costos y gastos.",
    );
  });

  test("separa los incluidos de los excluidos sin tocar el TXT", () => {
    const { incluidos, excluidos } = separarDocumentos([
      documento({ id: "ok", ncf: "B0100000051", rnc: "132000013", clase: "compra" }),
      documento({ id: "malo", ncf: "B0100000050", rnc: "132000015", clase: "compra" }),
      documento({
        id: "cuenta",
        ncf: "B1300000001",
        rnc: "132000013",
        clase: "gasto",
        exclusion: motivoCuentaSinClasificar("Gastos varios"),
      }),
    ]);

    expect(incluidos.map((documento) => documento.id)).toEqual(["ok"]);
    expect(excluidos).toHaveLength(2);
    expect(excluidos[0]?.numero).toBe("B0100000050");
    expect(excluidos[0]?.tipo).toBe("Factura de proveedor");
    expect(excluidos[1]?.motivo).toBe(motivoCuentaSinClasificar("Gastos varios"));
  });

  test("una nota de crédito emitida después de 30 días no acredita ITBIS", () => {
    expect(diasEntreFechas("2026-10-15", "2026-11-20")).toBe(36);
    expect(itbisNotaCredito(14400, "2026-10-15", "2026-11-20")).toBe(0);
    expect(itbisNotaCredito(14400, "2026-11-20", "2026-11-20")).toBe(14400);
    expect(itbisNotaCredito(14400, "2026-10-21", "2026-11-20")).toBe(14400);
    expect(itbisNotaCredito(14400, null, "2026-11-20")).toBe(14400);
  });

  test("resuelve la clasificación por la cuenta madre", () => {
    const catalogo: CatalogoCuentasDgii = new Map([
      [
        "hija",
        {
          id: "hija",
          codigo: "6101",
          nombre: "Gastos varios",
          padre_id: "padre",
          categoria_dgii: null,
          tipo_compra: null,
          tipo_ingreso: null,
        },
      ],
      [
        "padre",
        {
          id: "padre",
          codigo: "61",
          nombre: "Gastos",
          padre_id: null,
          categoria_dgii: "02",
          tipo_compra: "servicio",
          tipo_ingreso: null,
        },
      ],
    ]);

    expect(resolverClasificacionCuenta(catalogo, "hija")).toMatchObject({
      nombre: "Gastos varios",
      categoriaDgii: "02",
      tipoCompra: "servicio",
    });
    expect(resolverClasificacionCuenta(catalogo, null)).toBeNull();
    expect(
      valorPrincipal(
        new Map([
          ["02", 100],
          ["09", 500],
        ]),
      ),
    ).toBe("09");
    expect(MOTIVO_SIN_TIPO_INGRESO).toContain("tipo de ingreso");
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
    expect(nombreArchivoDgiiExcel("607", "101010101", "202611")).toBe("DGII_F_607_101010101_202611.xlsx");
  });

  test("reparte pagos, retenciones y saldo pendiente (la NC queda en venta a crédito)", () => {
    expect(formasPagoVenta(1663800, 0, 800000, [{ metodo: "transferencia", monto: 800000 }])).toEqual({
      efectivo: 0,
      transferencia: 800000,
      tarjeta: 0,
      credito: 863800,
      otras: 0,
    });

    // Saldo cubierto con nota de crédito: Alegra lo deja en "Venta a crédito".
    expect(formasPagoVenta(76700, 0, 0, [])).toEqual({
      efectivo: 0,
      transferencia: 0,
      tarjeta: 0,
      credito: 76700,
      otras: 0,
    });

    // Factura B0100000002 de la prueba real: 944.00 − retención 43.20 = 900.80;
    // efectivo 15.80 y venta a crédito 885.00.
    expect(formasPagoVenta(94400, 4320, 1580, [{ metodo: "efectivo", monto: 1580 }])).toEqual({
      efectivo: 1580,
      transferencia: 0,
      tarjeta: 0,
      credito: 88500,
      otras: 0,
    });

    expect(formasPagoVenta(100000, 0, 40000, [])).toEqual({
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

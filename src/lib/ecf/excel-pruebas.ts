import ExcelJS from "exceljs";

import type {
  CasoExcelDgii,
  DocumentoEcfInput,
  IndicadorFacturacionEcf,
  IndicadorMontoGravadoEcf,
  ItbisTasaEcf,
  LineaEcfInput,
  TipoEcf,
  TipoIngresosEcf,
  TipoPagoEcf,
} from "./tipos";

const COLUMNAS_BASE = [
  "CasoPrueba",
  "TipoeCF",
  "ENCF",
  "RNCEmisor",
  "RazonSocialEmisor",
  "NombreComercialEmisor",
  "DireccionEmisor",
  "RNCComprador",
  "RazonSocialComprador",
  "FechaEmision",
  "FechaVencimientoSecuencia",
  "IndicadorMontoGravado",
  "IndicadorNotaCredito",
  "TipoIngresos",
  "TipoPago",
  "MontoGravadoI1",
  "MontoGravadoI2",
  "MontoGravadoI3",
  "MontoExento",
  "TotalITBIS1",
  "TotalITBIS2",
  "TotalITBIS3",
  "TotalITBIS",
  "MontoImpuestoAdicional",
  "MontoTotal",
  "TotalITBISRetenido",
  "TotalISRRetencion",
  "NCFModificado",
  "FechaNCFModificado",
  "CodigoModificacion",
  "TipoMoneda",
  "TipoCambio",
  "MontoTotalOtraMoneda",
] as const;

const CAMPOS_ITEM = [
  "NombreItem",
  "CantidadItem",
  "PrecioUnitarioItem",
  "IndicadorFacturacion",
  "UnidadMedida",
  "DescuentoMonto",
  "RecargoMonto",
  "MontoITBISRetenido",
  "MontoISRRetenido",
  "MontoItem",
] as const;

function numeroMaximoItems(encabezados: Map<string, number>): number {
  let maximo = 0;
  for (const nombre of encabezados.keys()) {
    const coincidencia = nombre.match(/^NombreItem\[(\d+)\]$/);
    const valor = coincidencia?.[1] ? Number(coincidencia[1]) : 0;
    if (valor > maximo) maximo = valor;
  }
  return maximo;
}

function columnasConItems(cantidadItems: number): string[] {
  const columnas: string[] = [...COLUMNAS_BASE];
  for (let numero = 1; numero <= cantidadItems; numero += 1) {
    for (const campo of CAMPOS_ITEM) columnas.push(`${campo}[${numero}]`);
  }
  return columnas;
}

function texto(row: ExcelJS.Row, encabezados: Map<string, number>, nombre: string): string {
  const columna = encabezados.get(nombre);
  if (!columna) return "";
  return row.getCell(columna).text.trim();
}

function numeroTexto(valor: string): number | undefined {
  if (valor.trim() === "") return undefined;
  const numero = Number(valor.replace(/\s/g, ""));
  return Number.isFinite(numero) ? numero : undefined;
}

function numero(row: ExcelJS.Row, encabezados: Map<string, number>, nombre: string): number | undefined {
  return numeroTexto(texto(row, encabezados, nombre));
}

function valorODefecto(valor: number | undefined, defecto: number): number {
  return valor ?? defecto;
}

function indicadorFacturacion(valor: string): IndicadorFacturacionEcf {
  return valor === "2" || valor === "3" || valor === "4" ? valor : "1";
}

function tasaPorIndicador(indicador: IndicadorFacturacionEcf): ItbisTasaEcf {
  if (indicador === "1") return 18;
  if (indicador === "2") return 16;
  return 0;
}

function tipoEcf(valor: string): TipoEcf {
  if (["31", "32", "33", "34", "41", "43", "44", "45", "46", "47"].includes(valor)) return valor as TipoEcf;
  throw new Error(`El TipoeCF ${valor || "(vacío)"} del Excel no es válido`);
}

function tipoIngresos(valor: string): TipoIngresosEcf {
  return ["01", "02", "03", "04", "05", "06"].includes(valor) ? (valor as TipoIngresosEcf) : "01";
}

function tipoPago(valor: string): TipoPagoEcf {
  return ["1", "2", "3", "4", "5", "6", "7"].includes(valor) ? (valor as TipoPagoEcf) : "1";
}

function indicadorMontoGravado(valor: string): IndicadorMontoGravadoEcf | undefined {
  return valor === "0" || valor === "1" ? valor : undefined;
}

function leerLineas(row: ExcelJS.Row, encabezados: Map<string, number>, cantidadItems: number): LineaEcfInput[] {
  const lineas: LineaEcfInput[] = [];
  for (let indice = 1; indice <= cantidadItems; indice += 1) {
    const nombre = texto(row, encabezados, `NombreItem[${indice}]`);
    if (!nombre) continue;
    const cantidad = valorODefecto(numero(row, encabezados, `CantidadItem[${indice}]`), 1);
    const precio = valorODefecto(numero(row, encabezados, `PrecioUnitarioItem[${indice}]`), 0);
    const descuento = numero(row, encabezados, `DescuentoMonto[${indice}]`);
    const recargo = numero(row, encabezados, `RecargoMonto[${indice}]`);
    const indicador = indicadorFacturacion(texto(row, encabezados, `IndicadorFacturacion[${indice}]`));
    const itbisRetenido = numero(row, encabezados, `MontoITBISRetenido[${indice}]`);
    const isrRetenido = numero(row, encabezados, `MontoISRRetenido[${indice}]`);
    const montoCalculado = Math.round((cantidad * precio - (descuento ?? 0) + (recargo ?? 0)) * 100) / 100;
    lineas.push({
      numeroLinea: indice,
      indicadorFacturacion: indicador,
      nombreItem: nombre,
      cantidad,
      unidadMedida: texto(row, encabezados, `UnidadMedida[${indice}]`) || undefined,
      precioUnitario: precio,
      descuento,
      recargo,
      retencion:
        itbisRetenido !== undefined || isrRetenido !== undefined
          ? { indicadorAgenteRetencion: "1", montoItbisRetenido: itbisRetenido, montoIsrRetenido: isrRetenido }
          : undefined,
      itbisTasa: tasaPorIndicador(indicador),
      montoItem: valorODefecto(numero(row, encabezados, `MontoItem[${indice}]`), montoCalculado),
    });
  }
  return lineas;
}

function calcularTotales(
  lineas: LineaEcfInput[],
): Pick<
  DocumentoEcfInput["totales"],
  | "montoGravadoI1"
  | "montoGravadoI2"
  | "montoGravadoI3"
  | "montoExento"
  | "totalItbis1"
  | "totalItbis2"
  | "totalItbis3"
  | "totalItbis"
  | "montoTotal"
> {
  const suma = (indicador: IndicadorFacturacionEcf) =>
    lineas
      .filter((linea) => linea.indicadorFacturacion === indicador)
      .reduce((total, linea) => total + linea.montoItem, 0);
  const i1 = Math.round(suma("1") * 100) / 100;
  const i2 = Math.round(suma("2") * 100) / 100;
  const i3 = Math.round(suma("3") * 100) / 100;
  const exento = Math.round(suma("4") * 100) / 100;
  const itbis1 = Math.round(i1 * 18) / 100;
  const itbis2 = Math.round(i2 * 16) / 100;
  return {
    montoGravadoI1: i1,
    montoGravadoI2: i2,
    montoGravadoI3: i3,
    montoExento: exento,
    totalItbis1: itbis1,
    totalItbis2: itbis2,
    totalItbis3: 0,
    totalItbis: Math.round((itbis1 + itbis2) * 100) / 100,
    montoTotal: Math.round((i1 + i2 + i3 + exento + itbis1 + itbis2) * 100) / 100,
  };
}

function documentoDesdeFila(
  row: ExcelJS.Row,
  encabezados: Map<string, number>,
  cantidadItems: number,
): DocumentoEcfInput {
  const lineas = leerLineas(row, encabezados, cantidadItems);
  const calculados = calcularTotales(lineas);
  const tipo = tipoEcf(texto(row, encabezados, "TipoeCF"));
  const tipoCambio = numero(row, encabezados, "TipoCambio");
  const montoTotalOtraMoneda = numero(row, encabezados, "MontoTotalOtraMoneda");
  return {
    emisor: {
      rnc: texto(row, encabezados, "RNCEmisor"),
      razonSocial: texto(row, encabezados, "RazonSocialEmisor"),
      nombreComercial: texto(row, encabezados, "NombreComercialEmisor") || undefined,
      direccion: texto(row, encabezados, "DireccionEmisor") || "Dirección pendiente",
    },
    comprador: {
      rnc: texto(row, encabezados, "RNCComprador") || undefined,
      razonSocial: texto(row, encabezados, "RazonSocialComprador") || "CLIENTE CONTADO",
    },
    comprobante: {
      tipo,
      encf: texto(row, encabezados, "ENCF"),
      fechaEmision: texto(row, encabezados, "FechaEmision"),
      fechaVencimientoSecuencia: texto(row, encabezados, "FechaVencimientoSecuencia") || "31-12-2026",
      tipoIngresos: tipoIngresos(texto(row, encabezados, "TipoIngresos")),
      tipoPago: tipoPago(texto(row, encabezados, "TipoPago")),
      indicadorMontoGravado: indicadorMontoGravado(texto(row, encabezados, "IndicadorMontoGravado")),
      indicadorNotaCredito: texto(row, encabezados, "IndicadorNotaCredito") === "1" ? "1" : "0",
      ncfModificado: texto(row, encabezados, "NCFModificado") || undefined,
      fechaNcfModificado: texto(row, encabezados, "FechaNCFModificado") || undefined,
      codigoModificacion: texto(row, encabezados, "CodigoModificacion") || undefined,
      fechaHoraFirma: `${texto(row, encabezados, "FechaEmision")} 10:00:00`,
    },
    lineas,
    totales: {
      montoGravadoI1: valorODefecto(numero(row, encabezados, "MontoGravadoI1"), calculados.montoGravadoI1),
      montoGravadoI2: valorODefecto(numero(row, encabezados, "MontoGravadoI2"), calculados.montoGravadoI2),
      montoGravadoI3: numero(row, encabezados, "MontoGravadoI3") ?? calculados.montoGravadoI3,
      montoExento: valorODefecto(numero(row, encabezados, "MontoExento"), calculados.montoExento),
      totalItbis1: valorODefecto(numero(row, encabezados, "TotalITBIS1"), calculados.totalItbis1),
      totalItbis2: valorODefecto(numero(row, encabezados, "TotalITBIS2"), calculados.totalItbis2),
      totalItbis3: numero(row, encabezados, "TotalITBIS3") ?? calculados.totalItbis3,
      totalItbis: valorODefecto(numero(row, encabezados, "TotalITBIS"), calculados.totalItbis),
      montoImpuestoAdicional: numero(row, encabezados, "MontoImpuestoAdicional"),
      montoTotal: valorODefecto(numero(row, encabezados, "MontoTotal"), calculados.montoTotal),
      totalItbisRetenido: numero(row, encabezados, "TotalITBISRetenido"),
      totalIsrRetencion: numero(row, encabezados, "TotalISRRetencion"),
    },
    otraMoneda:
      tipoCambio !== undefined && montoTotalOtraMoneda !== undefined
        ? {
            tipoMoneda: texto(row, encabezados, "TipoMoneda") || "USD",
            tipoCambio,
            montoTotalOtraMoneda,
          }
        : undefined,
  };
}

function encabezadosDesdeHoja(hoja: ExcelJS.Worksheet): Map<string, number> {
  const encabezados = new Map<string, number>();
  hoja.getRow(1).eachCell({ includeEmpty: false }, (celda, numeroColumna) => {
    const nombre = celda.text.trim();
    if (nombre) encabezados.set(nombre, numeroColumna);
  });
  return encabezados;
}

export async function parsearExcelPruebasDgii(buffer: Buffer | Uint8Array): Promise<CasoExcelDgii[]> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(Buffer.from(buffer) as never);
  const hoja = libro.worksheets[0];
  if (!hoja) throw new Error("El Excel de pruebas DGII no contiene hojas");
  const encabezados = encabezadosDesdeHoja(hoja);
  if (!encabezados.has("CasoPrueba") || !encabezados.has("TipoeCF") || !encabezados.has("ENCF")) {
    throw new Error("El Excel no tiene las columnas mínimas del Set de Pruebas DGII");
  }
  const conocidas = new Set(columnasConItems(numeroMaximoItems(encabezados)));
  const desconocidas = [...encabezados.keys()].filter((nombre) => !conocidas.has(nombre));
  const casos: CasoExcelDgii[] = [];
  for (let numeroFila = 2; numeroFila <= hoja.rowCount; numeroFila += 1) {
    const row = hoja.getRow(numeroFila);
    const casoPrueba = texto(row, encabezados, "CasoPrueba");
    if (!casoPrueba) continue;
    casos.push({
      casoPrueba,
      numeroFila,
      documento: documentoDesdeFila(row, encabezados, numeroMaximoItems(encabezados)),
      columnasNoReconocidas: desconocidas,
    });
  }
  return casos;
}

interface LineaPlantilla {
  nombre: string;
  cantidad: number;
  precio: number;
  indicador: IndicadorFacturacionEcf;
  descuento?: number;
  recargo?: number;
  itbisRetenido?: number;
  isrRetenido?: number;
}

interface CasoPlantilla {
  nombre: string;
  tipo: TipoEcf;
  secuencia: number;
  lineas: LineaPlantilla[];
  indicadorNotaCredito?: "0" | "1";
  ncfModificado?: string;
  codigoModificacion?: string;
  otraMoneda?: boolean;
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function lineaDesdePlantilla(linea: LineaPlantilla, numeroLinea: number): LineaEcfInput {
  const descuento = linea.descuento ?? 0;
  const recargo = linea.recargo ?? 0;
  return {
    numeroLinea,
    indicadorFacturacion: linea.indicador,
    nombreItem: linea.nombre,
    cantidad: linea.cantidad,
    unidadMedida: "UND",
    precioUnitario: linea.precio,
    descuento: linea.descuento,
    recargo: linea.recargo,
    retencion:
      linea.itbisRetenido !== undefined || linea.isrRetenido !== undefined
        ? {
            indicadorAgenteRetencion: "1",
            montoItbisRetenido: linea.itbisRetenido,
            montoIsrRetenido: linea.isrRetenido,
          }
        : undefined,
    itbisTasa: tasaPorIndicador(linea.indicador),
    montoItem: redondear(linea.cantidad * linea.precio - descuento + recargo),
  };
}

function documentoPiloto(caso: CasoPlantilla, rncEmisor: string, razonSocial: string): DocumentoEcfInput {
  const lineas = caso.lineas.map(lineaDesdePlantilla);
  const totales = calcularTotales(lineas);
  const encf = `E${caso.tipo}${String(caso.secuencia).padStart(10, "0")}`;
  return {
    emisor: {
      rnc: rncEmisor,
      razonSocial,
      nombreComercial: razonSocial,
      direccion: "Av. Industrial 10, Santo Domingo",
    },
    comprador: { rnc: "131880725", razonSocial: "CLIENTE PILOTO DGII SRL" },
    comprobante: {
      tipo: caso.tipo,
      encf,
      fechaEmision: "15-01-2026",
      fechaVencimientoSecuencia: "31-12-2026",
      tipoIngresos: "01",
      tipoPago: "1",
      indicadorNotaCredito: caso.indicadorNotaCredito,
      ncfModificado: caso.ncfModificado,
      fechaNcfModificado: caso.ncfModificado ? "10-01-2026" : undefined,
      codigoModificacion: caso.codigoModificacion,
      fechaHoraFirma: "15-01-2026 10:00:00",
    },
    lineas,
    totales: {
      ...totales,
      totalItbisRetenido:
        lineas.reduce((suma, linea) => suma + (linea.retencion?.montoItbisRetenido ?? 0), 0) || undefined,
      totalIsrRetencion:
        lineas.reduce((suma, linea) => suma + (linea.retencion?.montoIsrRetenido ?? 0), 0) || undefined,
    },
    otraMoneda: caso.otraMoneda
      ? {
          tipoMoneda: "USD",
          tipoCambio: 63.25,
          montoGravadoTotalOtraMoneda: redondear(
            (totales.montoGravadoI1 + totales.montoGravadoI2 + (totales.montoGravadoI3 ?? 0)) / 63.25,
          ),
          montoExentoOtraMoneda: redondear(totales.montoExento / 63.25),
          totalItbisOtraMoneda: redondear(totales.totalItbis / 63.25),
          montoTotalOtraMoneda: redondear(totales.montoTotal / 63.25),
        }
      : undefined,
  };
}

function casosPlantilla(): CasoPlantilla[] {
  return [
    {
      nombre: "E31 con descuento por línea",
      tipo: "31",
      secuencia: 1,
      lineas: [{ nombre: "Oxígeno medicinal", cantidad: 1, precio: 1000, indicador: "1", descuento: 100 }],
    },
    {
      nombre: "E32 menor de 250000 con RFCE",
      tipo: "32",
      secuencia: 1,
      lineas: [{ nombre: "Venta mostrador menor", cantidad: 1, precio: 100, indicador: "1" }],
    },
    {
      nombre: "E32 mayor o igual a 250000",
      tipo: "32",
      secuencia: 2,
      lineas: [{ nombre: "Venta mostrador mayor", cantidad: 1, precio: 220000, indicador: "1" }],
    },
    {
      nombre: "E34 nota de crédito menor de 30 días",
      tipo: "34",
      secuencia: 1,
      indicadorNotaCredito: "0",
      ncfModificado: "E310000000001",
      codigoModificacion: "1",
      lineas: [{ nombre: "Devolución parcial", cantidad: 1, precio: 100, indicador: "1" }],
    },
    {
      nombre: "E34 nota de crédito mayor de 30 días",
      tipo: "34",
      secuencia: 2,
      indicadorNotaCredito: "1",
      ncfModificado: "E310000000001",
      codigoModificacion: "1",
      lineas: [{ nombre: "Devolución tardía", cantidad: 1, precio: 100, indicador: "1" }],
    },
    {
      nombre: "E41 compras con retención",
      tipo: "41",
      secuencia: 1,
      lineas: [
        {
          nombre: "Servicio profesional",
          cantidad: 1,
          precio: 1000,
          indicador: "1",
          itbisRetenido: 54,
          isrRetenido: 100,
        },
      ],
    },
    {
      nombre: "E43 gastos menores exento",
      tipo: "43",
      secuencia: 1,
      lineas: [{ nombre: "Gasto menor exento", cantidad: 1, precio: 100, indicador: "4" }],
    },
    {
      nombre: "E44 régimen especial",
      tipo: "44",
      secuencia: 1,
      lineas: [{ nombre: "Operación régimen especial", cantidad: 1, precio: 100, indicador: "4" }],
    },
    {
      nombre: "E45 gubernamental otra moneda",
      tipo: "45",
      secuencia: 1,
      otraMoneda: true,
      lineas: [{ nombre: "Suministro gubernamental", cantidad: 1, precio: 100, indicador: "1" }],
    },
  ];
}

function filaDesdeDocumento(caso: CasoPlantilla, documento: DocumentoEcfInput): Record<string, string | number> {
  const fila: Record<string, string | number> = {
    CasoPrueba: caso.nombre,
    TipoeCF: documento.comprobante.tipo,
    ENCF: documento.comprobante.encf,
    RNCEmisor: documento.emisor.rnc,
    RazonSocialEmisor: documento.emisor.razonSocial,
    NombreComercialEmisor: documento.emisor.nombreComercial ?? "",
    DireccionEmisor: documento.emisor.direccion,
    RNCComprador: documento.comprador.rnc ?? "",
    RazonSocialComprador: documento.comprador.razonSocial,
    FechaEmision: documento.comprobante.fechaEmision,
    FechaVencimientoSecuencia: documento.comprobante.fechaVencimientoSecuencia,
    IndicadorMontoGravado: documento.comprobante.indicadorMontoGravado ?? "",
    IndicadorNotaCredito: documento.comprobante.indicadorNotaCredito ?? "",
    TipoIngresos: documento.comprobante.tipoIngresos,
    TipoPago: documento.comprobante.tipoPago,
    MontoGravadoI1: documento.totales.montoGravadoI1,
    MontoGravadoI2: documento.totales.montoGravadoI2,
    MontoGravadoI3: documento.totales.montoGravadoI3 ?? "",
    MontoExento: documento.totales.montoExento,
    TotalITBIS1: documento.totales.totalItbis1,
    TotalITBIS2: documento.totales.totalItbis2,
    TotalITBIS3: documento.totales.totalItbis3 ?? "",
    TotalITBIS: documento.totales.totalItbis,
    MontoTotal: documento.totales.montoTotal,
    TotalITBISRetenido: documento.totales.totalItbisRetenido ?? "",
    TotalISRRetencion: documento.totales.totalIsrRetencion ?? "",
    NCFModificado: documento.comprobante.ncfModificado ?? "",
    FechaNCFModificado: documento.comprobante.fechaNcfModificado ?? "",
    CodigoModificacion: documento.comprobante.codigoModificacion ?? "",
    TipoMoneda: documento.otraMoneda?.tipoMoneda ?? "",
    TipoCambio: documento.otraMoneda?.tipoCambio ?? "",
    MontoTotalOtraMoneda: documento.otraMoneda?.montoTotalOtraMoneda ?? "",
  };
  documento.lineas.forEach((linea, indice) => {
    const numero = indice + 1;
    fila[`NombreItem[${numero}]`] = linea.nombreItem;
    fila[`CantidadItem[${numero}]`] = linea.cantidad;
    fila[`PrecioUnitarioItem[${numero}]`] = linea.precioUnitario;
    fila[`IndicadorFacturacion[${numero}]`] = linea.indicadorFacturacion;
    fila[`UnidadMedida[${numero}]`] = linea.unidadMedida ?? "";
    fila[`DescuentoMonto[${numero}]`] = linea.descuento ?? "";
    fila[`RecargoMonto[${numero}]`] = linea.recargo ?? "";
    fila[`MontoITBISRetenido[${numero}]`] = linea.retencion?.montoItbisRetenido ?? "";
    fila[`MontoISRRetenido[${numero}]`] = linea.retencion?.montoIsrRetenido ?? "";
    fila[`MontoItem[${numero}]`] = linea.montoItem;
  });
  return fila;
}

export async function generarPlantillaExcelPruebasPiloto(
  rncEmisor = "131488791",
  razonSocial = "OXYMAT SRL",
): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("SetPruebasDGII");
  const columnas = columnasConItems(1);
  hoja.columns = columnas.map((columna) => ({
    header: columna,
    key: columna,
    width: Math.max(14, columna.length + 2),
  }));
  for (const caso of casosPlantilla()) {
    const documento = documentoPiloto(caso, rncEmisor, razonSocial);
    hoja.addRow(filaDesdeDocumento(caso, documento));
  }
  hoja.getRow(1).font = { bold: true };
  const contenido = await libro.xlsx.writeBuffer();
  return Buffer.from(contenido as ArrayBuffer);
}

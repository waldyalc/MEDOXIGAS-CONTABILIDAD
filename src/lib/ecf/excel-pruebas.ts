import ExcelJS from "exceljs";

import type {
  CasoExcelDgii,
  DocumentoEcfInput,
  ImpuestoAdicionalEcfInput,
  IndicadorFacturacionEcf,
  IndicadorMontoGravadoEcf,
  ItbisTasaEcf,
  LineaEcfInput,
  ResumenRfceDgii,
  TipoEcf,
  TipoIngresosEcf,
  TipoPagoEcf,
} from "./tipos";

const SENTINEL_VACIO = "#e";

const BASES_CONOCIDAS = new Set([
  "ActividadEconomica",
  "BancoPago",
  "CantidadBulto",
  "CantidadItem",
  "CantidadReferencia",
  "CasoPrueba",
  "CodigoInternoComprador",
  "CodigoItem",
  "CodigoModificacion",
  "CodigoSeguridadeCF",
  "CodigoSubcantidad",
  "CodigoVendedor",
  "CondicionesEntrega",
  "Conductor",
  "ContactoComprador",
  "ContactoEntrega",
  "CorreoComprador",
  "CorreoEmisor",
  "DescripcionDescuentooRecargo",
  "DescripcionItem",
  "DescripcionSubtotal",
  "DescuentoMonto",
  "DescuentoOtraMoneda",
  "DireccionComprador",
  "DireccionDestino",
  "DireccionEmisor",
  "DireccionEntrega",
  "DocumentoTransporte",
  "ENCF",
  "FechaDesde",
  "FechaElaboracion",
  "FechaEmbarque",
  "FechaEmision",
  "FechaEntrega",
  "FechaHasta",
  "FechaLimitePago",
  "FechaNCFModificado",
  "FechaOrdenCompra",
  "FechaVencimientoItem",
  "FechaVencimientoSecuencia",
  "Ficha",
  "Flete",
  "FormaPago",
  "GradosAlcohol",
  "ITBIS1",
  "ITBIS2",
  "ITBIS3",
  "IdentificadorExtranjero",
  "IndicadorAgenteRetencionoPercepcion",
  "IndicadorBienoServicio",
  "IndicadorEnvioDiferido",
  "IndicadorFacturacion",
  "IndicadorFacturacionDescuentooRecargo",
  "IndicadorMontoGravado",
  "IndicadorNorma1007",
  "IndicadorNotaCredito",
  "IndicadorServicioTodoIncluido",
  "InformacionAdicionalComprador",
  "InformacionAdicionalEmisor",
  "Lineas",
  "Liquidacion",
  "MontoAvancePago",
  "MontoDescuentooRecargo",
  "MontoDescuentooRecargoOtraMoneda",
  "MontoExento",
  "MontoExentoOtraMoneda",
  "MontoGravado1OtraMoneda",
  "MontoGravado2OtraMoneda",
  "MontoGravado3OtraMoneda",
  "MontoGravadoI1",
  "MontoGravadoI2",
  "MontoGravadoI3",
  "MontoGravadoTotal",
  "MontoGravadoTotalOtraMoneda",
  "MontoISRRetenido",
  "MontoITBISRetenido",
  "MontoImpuestoAdicional",
  "MontoImpuestoAdicionalOtraMoneda",
  "MontoImpuestoSelectivoConsumoAdvalorem",
  "MontoImpuestoSelectivoConsumoAdvaloremOtraMoneda",
  "MontoImpuestoSelectivoConsumoEspecifico",
  "MontoImpuestoSelectivoConsumoEspecificoOtraMoneda",
  "MontoItem",
  "MontoItemOtraMoneda",
  "MontoNoFacturable",
  "MontoPago",
  "MontoPeriodo",
  "MontoSubDescuento",
  "MontoSubRecargo",
  "MontosubRecargo",
  "MontoSubTotal",
  "MontoSubtotalPagina",
  "MontoTotal",
  "MontoTotalOtraMoneda",
  "Municipio",
  "MunicipioComprador",
  "NCFModificado",
  "NoLineaDesde",
  "NoLineaHasta",
  "NombreComercial",
  "NombreComercialEmisor",
  "NombreCompaniaTransportista",
  "NombreItem",
  "NombrePuertoDesembarque",
  "NombrePuertoEmbarque",
  "NombrePuertoSalida",
  "NumeroAlbaran",
  "NumeroContenedor",
  "NumeroCuentaPago",
  "NumeroEmbarque",
  "NumeroFacturaInterna",
  "NumeroLinea",
  "NumeroLineaDoR",
  "NumeroOrdenCompra",
  "NumeroPedidoInterno",
  "NumeroReferencia",
  "NumeroSubTotal",
  "NumeroViaje",
  "Orden",
  "OtrosGastos",
  "OtrosImpuestosAdicionales",
  "OtrosImpuestosAdicionalesOtraMoneda",
  "PaginaNo",
  "PaisComprador",
  "PaisDestino",
  "PaisOrigen",
  "PesoBruto",
  "PesoNeto",
  "PesoNetoKilogramo",
  "PesoNetoMineria",
  "Placa",
  "PrecioOtraMoneda",
  "PrecioUnitarioItem",
  "PrecioUnitarioReferencia",
  "Provincia",
  "ProvinciaComprador",
  "RNCComprador",
  "RNCEmisor",
  "RNCIdentificacionCompaniaTransportista",
  "RNCOtroContribuyente",
  "RazonModificacion",
  "RazonSocialComprador",
  "RazonSocialEmisor",
  "RecargoMonto",
  "RecargoOtraMoneda",
  "RegimenAduanero",
  "ResponsablePago",
  "RutaTransporte",
  "RutaVenta",
  "SaldoAnterior",
  "Seguro",
  "SubDescuentoPorcentaje",
  "SubRecargoPorcentaje",
  "SubTotaITBIS",
  "SubTotaITBIS1",
  "SubTotaITBIS2",
  "SubTotaITBIS3",
  "SubTotalExento",
  "SubTotalImpuestoAdicional",
  "SubTotalMontoGravadoI1",
  "SubTotalMontoGravadoI2",
  "SubTotalMontoGravadoI3",
  "SubTotalMontoGravadoTotal",
  "Subcantidad",
  "SubtotalExentoPagina",
  "SubtotalImpuestoAdicionalPagina",
  "SubtotalImpuestoAdicionalPaginaTabla",
  "SubtotalImpuestoSelectivoConsumoEspecificoPagina",
  "SubtotalItbis1Pagina",
  "SubtotalItbis2Pagina",
  "SubtotalItbis3Pagina",
  "SubtotalItbisPagina",
  "SubtotalMontoGravado1Pagina",
  "SubtotalMontoGravado2Pagina",
  "SubtotalMontoGravado3Pagina",
  "SubtotalMontoGravadoPagina",
  "SubtotalMontoNoFacturablePagina",
  "SubtotalOtrosImpuesto",
  "Sucursal",
  "TasaImpuestoAdicional",
  "TasaImpuestoAdicionalOtraMoneda",
  "TelefonoAdicional",
  "TelefonoEmisor",
  "TerminoPago",
  "TipoAfiliacion",
  "TipoAjuste",
  "TipoCambio",
  "TipoCodigo",
  "TipoCuentaPago",
  "TipoImpuesto",
  "TipoImpuestoOtraMoneda",
  "TipoIngresos",
  "TipoMoneda",
  "TipoPago",
  "TipoSubDescuento",
  "TipoSubRecargo",
  "TipoValor",
  "TipoeCF",
  "TotalCif",
  "TotalFob",
  "TotalISRPercepcion",
  "TotalISRRetencion",
  "TotalITBIS",
  "TotalITBIS1",
  "TotalITBIS1OtraMoneda",
  "TotalITBIS2",
  "TotalITBIS2OtraMoneda",
  "TotalITBIS3",
  "TotalITBIS3OtraMoneda",
  "TotalITBISOtraMoneda",
  "TotalITBISPercepcion",
  "TotalITBISRetenido",
  "TotalPaginas",
  "UnidadBulto",
  "UnidadMedida",
  "UnidadPesoBruto",
  "UnidadPesoNeto",
  "UnidadReferencia",
  "UnidadVolumen",
  "ValorDescuentooRecargo",
  "ValorPagar",
  "Version",
  "ViaTransporte",
  "VolumenBulto",
  "WebSite",
  "ZonaTransporte",
  "ZonaVenta",
]);

const COLUMNAS_BASE_PLANTILLA = [
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

const CAMPOS_ITEM_PLANTILLA = [
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

interface CeldaLectura {
  texto: (nombre: string) => string;
  numero: (nombre: string) => number | undefined;
  indizado: (base: string, i: number) => string;
  indizadoDoble: (base: string, i: number, j: number) => string;
  numeroIndizado: (base: string, i: number) => number | undefined;
  numeroIndizadoDoble: (base: string, i: number, j: number) => number | undefined;
}

function limpiar(valor: string): string {
  const recortado = valor.trim();
  return recortado === SENTINEL_VACIO ? "" : recortado;
}

function numeroTexto(valor: string): number | undefined {
  if (valor.trim() === "") return undefined;
  const numero = Number(valor.replace(/\s/g, ""));
  return Number.isFinite(numero) ? numero : undefined;
}

function crearLectura(row: ExcelJS.Row, encabezados: Map<string, number>): CeldaLectura {
  const texto = (nombre: string): string => {
    const columna = encabezados.get(nombre);
    if (!columna) return "";
    return limpiar(row.getCell(columna).text);
  };
  const numero = (nombre: string): number | undefined => numeroTexto(texto(nombre));
  return {
    texto,
    numero,
    indizado: (base, i) => texto(`${base}[${i}]`),
    indizadoDoble: (base, i, j) => texto(`${base}[${i}][${j}]`),
    numeroIndizado: (base, i) => numeroTexto(texto(`${base}[${i}]`)),
    numeroIndizadoDoble: (base, i, j) => numeroTexto(texto(`${base}[${i}][${j}]`)),
  };
}

function indicadorFacturacion(valor: string): IndicadorFacturacionEcf {
  if (valor === "0" || valor === "2" || valor === "3" || valor === "4") return valor;
  return "1";
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

function tipoPago(valor: string): TipoPagoEcf | undefined {
  return valor === "1" || valor === "2" || valor === "3" ? valor : undefined;
}

function indicadorMontoGravado(valor: string): IndicadorMontoGravadoEcf | undefined {
  return valor === "0" || valor === "1" ? valor : undefined;
}

function opcional(valor: string): string | undefined {
  return valor === "" ? undefined : valor;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: el parser reproduce las 360 columnas activas del Excel oficial DGII con índices simples y dobles
function leerLineas(lectura: CeldaLectura): LineaEcfInput[] {
  const lineas: LineaEcfInput[] = [];
  for (let i = 1; i <= 1000; i += 1) {
    const nombre = lectura.indizado("NombreItem", i);
    if (!nombre) {
      if (i > 62) break;
      continue;
    }
    const cantidad = lectura.numeroIndizado("CantidadItem", i) ?? 1;
    const precio = lectura.numeroIndizado("PrecioUnitarioItem", i) ?? 0;
    const descuento = lectura.numeroIndizado("DescuentoMonto", i);
    const recargo = lectura.numeroIndizado("RecargoMonto", i);
    const indicador = indicadorFacturacion(lectura.indizado("IndicadorFacturacion", i));
    const itbisRetenido = lectura.numeroIndizado("MontoITBISRetenido", i);
    const isrRetenido = lectura.numeroIndizado("MontoISRRetenido", i);
    const indicadorRetencion = lectura.indizado("IndicadorAgenteRetencionoPercepcion", i);
    const montoCalculado = Math.round((cantidad * precio - (descuento ?? 0) + (recargo ?? 0)) * 100) / 100;

    const codigosItem: LineaEcfInput["codigosItem"] = [];
    for (let j = 1; j <= 5; j += 1) {
      const tipoCodigo = lectura.indizadoDoble("TipoCodigo", i, j);
      const codigoItem = lectura.indizadoDoble("CodigoItem", i, j);
      if (tipoCodigo || codigoItem) codigosItem.push({ tipoCodigo: tipoCodigo || "Interno", codigoItem });
    }

    const subcantidades: LineaEcfInput["subcantidades"] = [];
    for (let j = 1; j <= 5; j += 1) {
      const subcantidad = lectura.numeroIndizadoDoble("Subcantidad", i, j);
      const codigoSubcantidad = lectura.indizadoDoble("CodigoSubcantidad", i, j);
      if (subcantidad !== undefined || codigoSubcantidad) {
        subcantidades.push({ subcantidad, codigoSubcantidad: opcional(codigoSubcantidad) });
      }
    }

    const leerSubAjustes = (
      baseTipo: string,
      basePorcentaje: string,
      baseMonto: string,
    ): NonNullable<LineaEcfInput["subDescuentos"]> => {
      const ajustes: NonNullable<LineaEcfInput["subDescuentos"]> = [];
      for (let j = 1; j <= 12; j += 1) {
        const tipo = lectura.indizadoDoble(baseTipo, i, j);
        const porcentaje = lectura.numeroIndizadoDoble(basePorcentaje, i, j);
        const monto = lectura.numeroIndizadoDoble(baseMonto, i, j);
        if (!tipo && porcentaje === undefined && monto === undefined) continue;
        ajustes.push({ tipo: tipo === "%" ? "%" : "$", porcentaje, monto });
      }
      return ajustes;
    };
    const subDescuentos = leerSubAjustes("TipoSubDescuento", "SubDescuentoPorcentaje", "MontoSubDescuento");
    const subRecargos = leerSubAjustes("TipoSubRecargo", "SubRecargoPorcentaje", "MontoSubRecargo");
    if (subRecargos.length === 0) {
      const alterno = leerSubAjustes("TipoSubRecargo", "SubRecargoPorcentaje", "MontosubRecargo");
      subRecargos.push(...alterno);
    }

    const impuestosAdicionales: LineaEcfInput["impuestosAdicionales"] = [];
    for (let j = 1; j <= 2; j += 1) {
      const tipoImpuestoItem = lectura.indizadoDoble("TipoImpuesto", i, j);
      if (tipoImpuestoItem) impuestosAdicionales.push({ tipoImpuesto: tipoImpuestoItem });
    }

    const precioOtraMoneda = lectura.numeroIndizado("PrecioOtraMoneda", i);
    const descuentoOtraMoneda = lectura.numeroIndizado("DescuentoOtraMoneda", i);
    const recargoOtraMoneda = lectura.numeroIndizado("RecargoOtraMoneda", i);
    const montoItemOtraMoneda = lectura.numeroIndizado("MontoItemOtraMoneda", i);
    const otraMoneda =
      precioOtraMoneda !== undefined ||
      descuentoOtraMoneda !== undefined ||
      recargoOtraMoneda !== undefined ||
      montoItemOtraMoneda !== undefined
        ? { precioOtraMoneda, descuentoOtraMoneda, recargoOtraMoneda, montoItemOtraMoneda }
        : undefined;

    lineas.push({
      numeroLinea: lectura.numeroIndizado("NumeroLinea", i) ?? i,
      codigosItem: codigosItem.length ? codigosItem : undefined,
      indicadorFacturacion: indicador,
      retencion:
        indicadorRetencion || itbisRetenido !== undefined || isrRetenido !== undefined
          ? {
              indicadorAgenteRetencion: indicadorRetencion === "2" ? "2" : "1",
              montoItbisRetenido: itbisRetenido,
              montoIsrRetenido: isrRetenido,
            }
          : undefined,
      nombreItem: nombre,
      indicadorBienoServicio: lectura.indizado("IndicadorBienoServicio", i) === "2" ? "2" : "1",
      descripcionItem: opcional(lectura.indizado("DescripcionItem", i)),
      cantidad,
      unidadMedida: opcional(lectura.indizado("UnidadMedida", i)),
      cantidadReferencia: lectura.numeroIndizado("CantidadReferencia", i),
      unidadReferencia: opcional(lectura.indizado("UnidadReferencia", i)),
      subcantidades: subcantidades.length ? subcantidades : undefined,
      gradosAlcohol: lectura.numeroIndizado("GradosAlcohol", i),
      precioUnitarioReferencia: lectura.numeroIndizado("PrecioUnitarioReferencia", i),
      fechaElaboracion: opcional(lectura.indizado("FechaElaboracion", i)),
      fechaVencimientoItem: opcional(lectura.indizado("FechaVencimientoItem", i)),
      precioUnitario: precio,
      descuento,
      subDescuentos: subDescuentos.length ? subDescuentos : undefined,
      recargo,
      subRecargos: subRecargos.length ? subRecargos : undefined,
      impuestosAdicionales: impuestosAdicionales.length ? impuestosAdicionales : undefined,
      otraMoneda,
      itbisTasa: tasaPorIndicador(indicador),
      montoItem: lectura.numeroIndizado("MontoItem", i) ?? montoCalculado,
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

function leerImpuestosAdicionalesTotales(lectura: CeldaLectura): DocumentoEcfInput["totales"]["impuestosAdicionales"] {
  const impuestos: NonNullable<DocumentoEcfInput["totales"]["impuestosAdicionales"]> = [];
  for (let k = 1; k <= 4; k += 1) {
    const tipoImpuesto = lectura.indizado("TipoImpuesto", k);
    if (!tipoImpuesto) continue;
    impuestos.push({
      tipoImpuesto,
      tasaImpuestoAdicional: lectura.numeroIndizado("TasaImpuestoAdicional", k),
      montoImpuestoSelectivoConsumoEspecifico: lectura.numeroIndizado("MontoImpuestoSelectivoConsumoEspecifico", k),
      montoImpuestoSelectivoConsumoAdvalorem: lectura.numeroIndizado("MontoImpuestoSelectivoConsumoAdvalorem", k),
      otrosImpuestosAdicionales: lectura.numeroIndizado("OtrosImpuestosAdicionales", k),
    });
  }
  return impuestos.length ? impuestos : undefined;
}

function leerImpuestosAdicionalesOtraMoneda(lectura: CeldaLectura): ImpuestoAdicionalEcfInput[] | undefined {
  const impuestos: {
    tipoImpuesto: string;
    tasaImpuestoAdicional?: number;
    montoImpuestoSelectivoConsumoEspecifico?: number;
    montoImpuestoSelectivoConsumoAdvalorem?: number;
    otrosImpuestosAdicionales?: number;
  }[] = [];
  for (let k = 1; k <= 4; k += 1) {
    const tipoImpuesto = lectura.indizado("TipoImpuestoOtraMoneda", k);
    if (!tipoImpuesto) continue;
    impuestos.push({
      tipoImpuesto,
      tasaImpuestoAdicional: lectura.numeroIndizado("TasaImpuestoAdicionalOtraMoneda", k),
      montoImpuestoSelectivoConsumoEspecifico: lectura.numeroIndizado(
        "MontoImpuestoSelectivoConsumoEspecificoOtraMoneda",
        k,
      ),
      montoImpuestoSelectivoConsumoAdvalorem: lectura.numeroIndizado(
        "MontoImpuestoSelectivoConsumoAdvaloremOtraMoneda",
        k,
      ),
      otrosImpuestosAdicionales: lectura.numeroIndizado("OtrosImpuestosAdicionalesOtraMoneda", k),
    });
  }
  return impuestos.length ? impuestos : undefined;
}

function leerFormasPago(lectura: CeldaLectura): DocumentoEcfInput["comprobante"]["formasPago"] {
  const formas: NonNullable<DocumentoEcfInput["comprobante"]["formasPago"]> = [];
  for (let k = 1; k <= 7; k += 1) {
    const formaPago = lectura.indizado("FormaPago", k);
    if (!formaPago) continue;
    formas.push({ formaPago, montoPago: lectura.numeroIndizado("MontoPago", k) });
  }
  return formas.length ? formas : undefined;
}

function leerTelefonos(lectura: CeldaLectura): string[] | undefined {
  const telefonos: string[] = [];
  for (let k = 1; k <= 3; k += 1) {
    const telefono = lectura.indizado("TelefonoEmisor", k);
    if (telefono) telefonos.push(telefono);
  }
  return telefonos.length ? telefonos : undefined;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: mapea una fila plana de 5215 columnas a la jerarquía completa del XSD DGII
function documentoDesdeFila(lectura: CeldaLectura): DocumentoEcfInput {
  const lineas = leerLineas(lectura);
  const calculados = calcularTotales(lineas);
  const tipo = tipoEcf(lectura.texto("TipoeCF"));
  const tipoCambio = lectura.numero("TipoCambio");
  const montoTotalOtraMoneda = lectura.numero("MontoTotalOtraMoneda");
  const tipoMoneda = lectura.texto("TipoMoneda");

  const informacionesAdicionales = {
    fechaEmbarque: opcional(lectura.texto("FechaEmbarque")),
    numeroEmbarque: opcional(lectura.texto("NumeroEmbarque")),
    numeroContenedor: opcional(lectura.texto("NumeroContenedor")),
    numeroReferencia: opcional(lectura.texto("NumeroReferencia")),
    nombrePuertoEmbarque: opcional(lectura.texto("NombrePuertoEmbarque")),
    condicionesEntrega: opcional(lectura.texto("CondicionesEntrega")),
    totalFob: lectura.numero("TotalFob"),
    seguro: lectura.numero("Seguro"),
    flete: lectura.numero("Flete"),
    otrosGastos: lectura.numero("OtrosGastos"),
    totalCif: lectura.numero("TotalCif"),
    regimenAduanero: opcional(lectura.texto("RegimenAduanero")),
    nombrePuertoSalida: opcional(lectura.texto("NombrePuertoSalida")),
    nombrePuertoDesembarque: opcional(lectura.texto("NombrePuertoDesembarque")),
    pesoBruto: lectura.numero("PesoBruto"),
    pesoNeto: lectura.numero("PesoNeto"),
    unidadPesoBruto: opcional(lectura.texto("UnidadPesoBruto")),
    unidadPesoNeto: opcional(lectura.texto("UnidadPesoNeto")),
    cantidadBulto: lectura.numero("CantidadBulto"),
    unidadBulto: opcional(lectura.texto("UnidadBulto")),
    volumenBulto: lectura.numero("VolumenBulto"),
    unidadVolumen: opcional(lectura.texto("UnidadVolumen")),
  };
  const hayInfoAdicional = Object.values(informacionesAdicionales).some((v) => v !== undefined);

  const transporte = {
    viaTransporte: opcional(lectura.texto("ViaTransporte")),
    paisOrigen: opcional(lectura.texto("PaisOrigen")),
    direccionDestino: opcional(lectura.texto("DireccionDestino")),
    paisDestino: opcional(lectura.texto("PaisDestino")),
    rncIdentificacionCompaniaTransportista: opcional(lectura.texto("RNCIdentificacionCompaniaTransportista")),
    nombreCompaniaTransportista: opcional(lectura.texto("NombreCompaniaTransportista")),
    numeroViaje: opcional(lectura.texto("NumeroViaje")),
    conductor: opcional(lectura.texto("Conductor")),
    documentoTransporte: opcional(lectura.texto("DocumentoTransporte")),
    ficha: opcional(lectura.texto("Ficha")),
    placa: opcional(lectura.texto("Placa")),
    rutaTransporte: opcional(lectura.texto("RutaTransporte")),
    zonaTransporte: opcional(lectura.texto("ZonaTransporte")),
    numeroAlbaran: opcional(lectura.texto("NumeroAlbaran")),
  };
  const hayTransporte = Object.values(transporte).some((v) => v !== undefined);

  const descuentosORecargos: NonNullable<DocumentoEcfInput["descuentosORecargos"]> = [];
  for (let k = 1; k <= 20; k += 1) {
    const tipoAjuste = lectura.indizado("TipoAjuste", k);
    const numeroLineaDoR = lectura.numeroIndizado("NumeroLineaDoR", k);
    if (!tipoAjuste && numeroLineaDoR === undefined) continue;
    const tipoValorTexto = lectura.indizado("TipoValor", k);
    const tipoValor = tipoValorTexto === "%" || tipoValorTexto === "$" ? tipoValorTexto : undefined;
    descuentosORecargos.push({
      numeroLinea: numeroLineaDoR ?? k,
      tipoAjuste: tipoAjuste === "R" ? "R" : "D",
      indicadorNorma1007: lectura.indizado("IndicadorNorma1007", k) === "1" ? "1" : undefined,
      descripcion: opcional(lectura.indizado("DescripcionDescuentooRecargo", k)),
      tipoValor,
      valor: lectura.numeroIndizado("ValorDescuentooRecargo", k),
      monto: lectura.numeroIndizado("MontoDescuentooRecargo", k) ?? 0,
      montoOtraMoneda: lectura.numeroIndizado("MontoDescuentooRecargoOtraMoneda", k),
      indicadorFacturacion: opcional(lectura.indizado("IndicadorFacturacionDescuentooRecargo", k)) as
        | IndicadorFacturacionEcf
        | undefined,
    });
  }

  let indicadorNotaCredito: "0" | "1" | undefined;
  if (tipo === "34") indicadorNotaCredito = lectura.texto("IndicadorNotaCredito") === "1" ? "1" : "0";

  return {
    emisor: {
      rnc: lectura.texto("RNCEmisor"),
      razonSocial: lectura.texto("RazonSocialEmisor"),
      nombreComercial: opcional(lectura.texto("NombreComercial") || lectura.texto("NombreComercialEmisor")),
      sucursal: opcional(lectura.texto("Sucursal")),
      direccion: lectura.texto("DireccionEmisor") || "Dirección pendiente",
      municipio: opcional(lectura.texto("Municipio")),
      provincia: opcional(lectura.texto("Provincia")),
      telefonos: leerTelefonos(lectura),
      correo: opcional(lectura.texto("CorreoEmisor")),
      webSite: opcional(lectura.texto("WebSite")),
      actividadEconomica: opcional(lectura.texto("ActividadEconomica")),
      codigoVendedor: opcional(lectura.texto("CodigoVendedor")),
      numeroFacturaInterna: opcional(lectura.texto("NumeroFacturaInterna")),
      numeroPedidoInterno: opcional(lectura.texto("NumeroPedidoInterno")),
      zonaVenta: opcional(lectura.texto("ZonaVenta")),
      rutaVenta: opcional(lectura.texto("RutaVenta")),
      informacionAdicionalEmisor: opcional(lectura.texto("InformacionAdicionalEmisor")),
    },
    comprador: {
      rnc: opcional(lectura.texto("RNCComprador")),
      identificadorExtranjero: opcional(lectura.texto("IdentificadorExtranjero")),
      razonSocial: lectura.texto("RazonSocialComprador") || "CLIENTE CONTADO",
      contactoComprador: opcional(lectura.texto("ContactoComprador")),
      correo: opcional(lectura.texto("CorreoComprador")),
      direccionComprador: opcional(lectura.texto("DireccionComprador")),
      municipioComprador: opcional(lectura.texto("MunicipioComprador")),
      provinciaComprador: opcional(lectura.texto("ProvinciaComprador")),
      paisComprador: opcional(lectura.texto("PaisComprador")),
      fechaEntrega: opcional(lectura.texto("FechaEntrega")),
      contactoEntrega: opcional(lectura.texto("ContactoEntrega")),
      direccionEntrega: opcional(lectura.texto("DireccionEntrega")),
      telefonoAdicional: opcional(lectura.texto("TelefonoAdicional")),
      fechaOrdenCompra: opcional(lectura.texto("FechaOrdenCompra")),
      numeroOrdenCompra: opcional(lectura.texto("NumeroOrdenCompra")),
      codigoInternoComprador: opcional(lectura.texto("CodigoInternoComprador")),
      responsablePago: opcional(lectura.texto("ResponsablePago")),
      informacionAdicionalComprador: opcional(lectura.texto("InformacionAdicionalComprador")),
    },
    comprobante: {
      tipo,
      encf: lectura.texto("ENCF"),
      fechaEmision: lectura.texto("FechaEmision"),
      fechaVencimientoSecuencia: opcional(lectura.texto("FechaVencimientoSecuencia")),
      indicadorNotaCredito,
      indicadorEnvioDiferido: lectura.texto("IndicadorEnvioDiferido") === "1" ? "1" : undefined,
      indicadorMontoGravado: indicadorMontoGravado(lectura.texto("IndicadorMontoGravado")),
      indicadorServicioTodoIncluido: lectura.texto("IndicadorServicioTodoIncluido") === "1" ? "1" : undefined,
      tipoIngresos: tipoIngresos(lectura.texto("TipoIngresos")),
      tipoPago: tipoPago(lectura.texto("TipoPago")),
      fechaLimitePago: opcional(lectura.texto("FechaLimitePago")),
      terminoPago: opcional(lectura.texto("TerminoPago")),
      formasPago: leerFormasPago(lectura),
      tipoCuentaPago: opcional(lectura.texto("TipoCuentaPago")),
      numeroCuentaPago: opcional(lectura.texto("NumeroCuentaPago")),
      bancoPago: opcional(lectura.texto("BancoPago")),
      fechaDesde: opcional(lectura.texto("FechaDesde")),
      fechaHasta: opcional(lectura.texto("FechaHasta")),
      totalPaginas: lectura.numero("TotalPaginas"),
      ncfModificado: opcional(lectura.texto("NCFModificado")),
      rncOtroContribuyente: opcional(lectura.texto("RNCOtroContribuyente")),
      fechaNcfModificado: opcional(lectura.texto("FechaNCFModificado")),
      codigoModificacion: opcional(lectura.texto("CodigoModificacion")),
      razonModificacion: opcional(lectura.texto("RazonModificacion")),
    },
    informacionesAdicionales: hayInfoAdicional ? informacionesAdicionales : undefined,
    transporte: hayTransporte ? transporte : undefined,
    lineas,
    totales: {
      montoGravadoTotal: lectura.numero("MontoGravadoTotal"),
      montoGravadoI1: lectura.numero("MontoGravadoI1") ?? calculados.montoGravadoI1,
      montoGravadoI2: lectura.numero("MontoGravadoI2") ?? calculados.montoGravadoI2,
      montoGravadoI3: lectura.numero("MontoGravadoI3") ?? calculados.montoGravadoI3,
      montoExento: lectura.numero("MontoExento") ?? calculados.montoExento,
      totalItbis1: lectura.numero("TotalITBIS1") ?? calculados.totalItbis1,
      totalItbis2: lectura.numero("TotalITBIS2") ?? calculados.totalItbis2,
      totalItbis3: lectura.numero("TotalITBIS3") ?? calculados.totalItbis3,
      totalItbis: lectura.numero("TotalITBIS") ?? calculados.totalItbis,
      montoImpuestoAdicional: lectura.numero("MontoImpuestoAdicional"),
      impuestosAdicionales: leerImpuestosAdicionalesTotales(lectura),
      montoTotal: lectura.numero("MontoTotal") ?? calculados.montoTotal,
      montoNoFacturable: lectura.numero("MontoNoFacturable"),
      montoPeriodo: lectura.numero("MontoPeriodo"),
      saldoAnterior: lectura.numero("SaldoAnterior"),
      montoAvancePago: lectura.numero("MontoAvancePago"),
      valorPagar: lectura.numero("ValorPagar"),
      totalItbisRetenido: lectura.numero("TotalITBISRetenido"),
      totalIsrRetencion: lectura.numero("TotalISRRetencion"),
      totalItbisPercepcion: lectura.numero("TotalITBISPercepcion"),
      totalIsrPercepcion: lectura.numero("TotalISRPercepcion"),
    },
    descuentosORecargos: descuentosORecargos.length ? descuentosORecargos : undefined,
    otraMoneda:
      tipoMoneda || tipoCambio !== undefined || montoTotalOtraMoneda !== undefined
        ? {
            tipoMoneda: tipoMoneda || "USD",
            tipoCambio: tipoCambio ?? 0,
            montoGravadoTotalOtraMoneda: lectura.numero("MontoGravadoTotalOtraMoneda"),
            montoGravado1OtraMoneda: lectura.numero("MontoGravado1OtraMoneda"),
            montoGravado2OtraMoneda: lectura.numero("MontoGravado2OtraMoneda"),
            montoGravado3OtraMoneda: lectura.numero("MontoGravado3OtraMoneda"),
            montoExentoOtraMoneda: lectura.numero("MontoExentoOtraMoneda"),
            totalItbisOtraMoneda: lectura.numero("TotalITBISOtraMoneda"),
            totalItbis1OtraMoneda: lectura.numero("TotalITBIS1OtraMoneda"),
            totalItbis2OtraMoneda: lectura.numero("TotalITBIS2OtraMoneda"),
            totalItbis3OtraMoneda: lectura.numero("TotalITBIS3OtraMoneda"),
            montoImpuestoAdicionalOtraMoneda: lectura.numero("MontoImpuestoAdicionalOtraMoneda"),
            impuestosAdicionalesOtraMoneda: leerImpuestosAdicionalesOtraMoneda(lectura),
            montoTotalOtraMoneda: montoTotalOtraMoneda ?? 0,
          }
        : undefined,
  };
}

function encabezadosDesdeHoja(hoja: ExcelJS.Worksheet): Map<string, number> {
  const encabezados = new Map<string, number>();
  hoja.getRow(1).eachCell({ includeEmpty: false }, (celda, numeroColumna) => {
    const nombre = celda.text.trim();
    if (nombre && !encabezados.has(nombre)) encabezados.set(nombre, numeroColumna);
  });
  return encabezados;
}

function baseDeColumna(nombre: string): string {
  return nombre.replace(/\[\d+\]/g, "").trim();
}

function columnasNoReconocidas(encabezados: Map<string, number>): string[] {
  return [...encabezados.keys()].filter((nombre) => !BASES_CONOCIDAS.has(baseDeColumna(nombre))).sort();
}

function rfceDesdeFila(lectura: CeldaLectura): ResumenRfceDgii {
  return {
    tipo: "32",
    encf: lectura.texto("ENCF"),
    tipoIngresos: tipoIngresos(lectura.texto("TipoIngresos")),
    tipoPago: tipoPago(lectura.texto("TipoPago")),
    formasPago: leerFormasPago(lectura),
    rncEmisor: lectura.texto("RNCEmisor"),
    razonSocialEmisor: lectura.texto("RazonSocialEmisor"),
    fechaEmision: lectura.texto("FechaEmision"),
    rncComprador: opcional(lectura.texto("RNCComprador")),
    identificadorExtranjero: opcional(lectura.texto("IdentificadorExtranjero")),
    razonSocialComprador: opcional(lectura.texto("RazonSocialComprador")),
    totales: {
      montoGravadoTotal: lectura.numero("MontoGravadoTotal"),
      montoGravadoI1: lectura.numero("MontoGravadoI1") ?? 0,
      montoGravadoI2: lectura.numero("MontoGravadoI2") ?? 0,
      montoGravadoI3: lectura.numero("MontoGravadoI3"),
      montoExento: lectura.numero("MontoExento") ?? 0,
      totalItbis: lectura.numero("TotalITBIS") ?? 0,
      totalItbis1: lectura.numero("TotalITBIS1") ?? 0,
      totalItbis2: lectura.numero("TotalITBIS2") ?? 0,
      totalItbis3: lectura.numero("TotalITBIS3"),
      montoImpuestoAdicional: lectura.numero("MontoImpuestoAdicional"),
      impuestosAdicionales: leerImpuestosAdicionalesTotales(lectura),
      montoTotal: lectura.numero("MontoTotal") ?? 0,
      montoNoFacturable: lectura.numero("MontoNoFacturable"),
      montoPeriodo: lectura.numero("MontoPeriodo"),
    },
    codigoSeguridadeCF: opcional(lectura.texto("CodigoSeguridadeCF")),
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: el parser reproduce las 360 columnas activas del Excel oficial DGII con índices simples y dobles
export async function parsearExcelPruebasDgii(buffer: Buffer | Uint8Array): Promise<CasoExcelDgii[]> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(Buffer.from(buffer) as never);
  const hojaEcf = libro.getWorksheet("ECF") ?? libro.worksheets[0];
  if (!hojaEcf) throw new Error("El Excel de pruebas DGII no contiene hojas");
  const encabezados = encabezadosDesdeHoja(hojaEcf);
  if (!encabezados.has("CasoPrueba") || !encabezados.has("TipoeCF") || !encabezados.has("ENCF")) {
    throw new Error("El Excel no tiene las columnas mínimas del Set de Pruebas DGII");
  }
  const desconocidas = columnasNoReconocidas(encabezados);
  const casos: CasoExcelDgii[] = [];
  for (let numeroFila = 2; numeroFila <= hojaEcf.rowCount; numeroFila += 1) {
    const row = hojaEcf.getRow(numeroFila);
    const lectura = crearLectura(row, encabezados);
    const casoPrueba = lectura.texto("CasoPrueba") || lectura.texto("ENCF");
    if (!casoPrueba) continue;
    casos.push({
      casoPrueba,
      numeroFila,
      documento: documentoDesdeFila(lectura),
      columnasNoReconocidas: desconocidas,
    });
  }

  const hojaRfce = libro.getWorksheet("RFCE");
  if (hojaRfce) {
    const encabezadosRfce = encabezadosDesdeHoja(hojaRfce);
    const desconocidasRfce = columnasNoReconocidas(encabezadosRfce);
    for (let numeroFila = 2; numeroFila <= hojaRfce.rowCount; numeroFila += 1) {
      const row = hojaRfce.getRow(numeroFila);
      const lectura = crearLectura(row, encabezadosRfce);
      if (!lectura.texto("ENCF")) continue;
      const rfce = rfceDesdeFila(lectura);
      const caso = casos.find((c) => c.documento.comprobante.encf === rfce.encf);
      if (caso) {
        caso.rfce = rfce;
        if (desconocidasRfce.length && caso.columnasNoReconocidas.length === 0) {
          caso.columnasNoReconocidas = desconocidasRfce;
        }
      } else {
        casos.push({
          casoPrueba: lectura.texto("CasoPrueba") || rfce.encf,
          numeroFila,
          documento: documentoDesdeFila(crearLectura(row, encabezadosRfce)),
          rfce,
          columnasNoReconocidas: desconocidasRfce,
        });
      }
    }
  }
  return casos;
}

export function ordenarCasosEnvioDgii(casos: CasoExcelDgii[]): CasoExcelDgii[] {
  const porEncf = new Map<string, CasoExcelDgii>();
  for (const caso of casos) {
    const encf = caso.documento.comprobante.encf;
    if (encf) porEncf.set(encf, caso);
  }
  const enviados = new Set<CasoExcelDgii>();
  const resultado: CasoExcelDgii[] = [];
  let pendientes = [...casos];
  while (pendientes.length > 0) {
    const listos = pendientes.filter((caso) => {
      const modificado = caso.documento.comprobante.ncfModificado;
      if (!modificado) return true;
      const referenciado = porEncf.get(modificado);
      return !referenciado || referenciado === caso || enviados.has(referenciado);
    });
    if (listos.length === 0) {
      resultado.push(...pendientes);
      break;
    }
    for (const caso of listos) {
      enviados.add(caso);
      resultado.push(caso);
    }
    pendientes = pendientes.filter((caso) => !enviados.has(caso));
  }
  return resultado;
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
    unidadMedida: "47",
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
  const columnas: string[] = [...COLUMNAS_BASE_PLANTILLA];
  for (let numero = 1; numero <= cantidadItems; numero += 1) {
    for (const campo of CAMPOS_ITEM_PLANTILLA) columnas.push(`${campo}[${numero}]`);
  }
  return columnas;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: el parser reproduce las 360 columnas activas del Excel oficial DGII con índices simples y dobles
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
    FechaVencimientoSecuencia: documento.comprobante.fechaVencimientoSecuencia ?? "",
    IndicadorMontoGravado: documento.comprobante.indicadorMontoGravado ?? "",
    IndicadorNotaCredito: documento.comprobante.indicadorNotaCredito ?? "",
    TipoIngresos: documento.comprobante.tipoIngresos,
    TipoPago: documento.comprobante.tipoPago ?? "",
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

// numeroMaximoItems se conserva para compatibilidad con tooling externo que inspecciona plantillas
export { numeroMaximoItems };

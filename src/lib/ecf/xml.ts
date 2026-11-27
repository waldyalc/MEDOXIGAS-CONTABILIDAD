import type {
  AcuseReciboInput,
  AnulacionEncfInput,
  AprobacionComercialInput,
  DocumentoEcfInput,
  ImpuestoAdicionalEcfInput,
  IndicadorFacturacionEcf,
  LineaEcfInput,
  SubAjusteEcfInput,
  TipoEcf,
} from "./tipos";
import { TIPOS_ECF } from "./tipos";

const RE_ENCF = /^E(31|32|33|34|41|43|44|45|46|47)\d{10}$/;
const RE_RNC = /^\d{9}(\d{2})?$/;
const RE_FECHA_DGII = /^(\d{2})-(\d{2})-(\d{4})$/;
const RE_FECHA_HORA_DGII = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/;
const LIMITE_RFCE = 250000;

export const TOLERANCIA_LINEA_DGII = 1.0;

export function calcularToleranciaGlobalDgii(numLineas: number): number {
  if (!Number.isInteger(numLineas) || numLineas < 0)
    throw new Error("La cantidad de líneas debe ser un entero positivo");
  return numLineas * TOLERANCIA_LINEA_DGII;
}

export type ValidacionDocumentoEcf = { ok: true } | { ok: false; errores: string[] };

export function escapeXml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/©/g, "&#169;")
    .replace(/€/g, "&#8364;")
    .replace(/®/g, "&#174;");
}

function pad2(valor: number): string {
  return String(valor).padStart(2, "0");
}

function fechaDesdePartes(dia: string, mes: string, anio: string): string {
  return `${dia}-${mes}-${anio}`;
}

export function formatearFechaDgii(fecha: string | Date): string {
  if (fecha instanceof Date) {
    return fechaDesdePartes(pad2(fecha.getDate()), pad2(fecha.getMonth() + 1), String(fecha.getFullYear()));
  }
  const valor = fecha.trim();
  if (RE_FECHA_DGII.test(valor)) return valor;
  const iso = valor.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (iso?.[1] && iso[2] && iso[3]) return fechaDesdePartes(iso[3], iso[2], iso[1]);
  throw new Error(`Fecha inválida para DGII: ${fecha}`);
}

export function formatearFechaHoraDgii(fecha?: string | Date): string {
  const valor = fecha ?? new Date();
  if (valor instanceof Date) {
    return `${formatearFechaDgii(valor)} ${pad2(valor.getHours())}:${pad2(valor.getMinutes())}:${pad2(valor.getSeconds())}`;
  }
  const texto = valor.trim();
  if (RE_FECHA_HORA_DGII.test(texto)) return texto;
  if (RE_FECHA_DGII.test(texto)) return `${texto} 00:00:00`;
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (iso?.[1] && iso[2] && iso[3] && iso[4] && iso[5]) {
    return `${fechaDesdePartes(iso[3], iso[2], iso[1])} ${iso[4]}:${iso[5]}:${iso[6] ?? "00"}`;
  }
  throw new Error(`Fecha y hora inválida para DGII: ${valor}`);
}

export function formatearMontoDgii(valor: number): string {
  if (!Number.isFinite(valor)) throw new Error("Los montos DGII deben ser números finitos");
  return valor.toFixed(2);
}

export function formatearPrecioDgii(valor: number): string {
  if (!Number.isFinite(valor)) throw new Error("Los precios DGII deben ser números finitos");
  const redondeado4 = Math.round((valor + Number.EPSILON) * 10000) / 10000;
  const redondeado2 = Math.round((valor + Number.EPSILON) * 100) / 100;
  if (Math.abs(redondeado4 - redondeado2) < 0.0000001) return redondeado2.toFixed(2);
  let texto = redondeado4.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  if (!texto.includes(".")) return `${texto}.00`;
  const decimales = texto.split(".")[1]?.length ?? 0;
  if (decimales === 1) texto = `${texto}0`;
  return texto;
}

function centavos(valor: number): number {
  return Math.round(valor * 100);
}

function montoEsValido(valor: number): boolean {
  return Number.isFinite(valor) && valor >= 0;
}

function fechaEsValida(valor: string): boolean {
  const partes = valor.match(RE_FECHA_DGII);
  if (!partes?.[1] || !partes[2] || !partes[3]) return false;
  const dia = Number(partes[1]);
  const mes = Number(partes[2]);
  const anio = Number(partes[3]);
  const fecha = new Date(anio, mes - 1, dia);
  return fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia;
}

function normalizarFechaValidable(valor: string): string | null {
  try {
    return formatearFechaDgii(valor);
  } catch {
    return null;
  }
}

function tasaPorIndicador(indicador: IndicadorFacturacionEcf): 18 | 16 | 0 {
  if (indicador === "1") return 18;
  if (indicador === "2") return 16;
  return 0;
}

function sumaSubAjustes(ajustes: SubAjusteEcfInput[] | undefined): number {
  return (ajustes ?? []).reduce((suma, ajuste) => suma + (ajuste.monto ?? 0), 0);
}

function descuentoLinea(linea: LineaEcfInput): number {
  return linea.descuento ?? sumaSubAjustes(linea.subDescuentos);
}

function recargoLinea(linea: LineaEcfInput): number {
  return linea.recargo ?? sumaSubAjustes(linea.subRecargos);
}

function validarSubAjustes(
  ajustes: SubAjusteEcfInput[] | undefined,
  numeroLinea: number,
  nombre: string,
  errores: string[],
): void {
  for (const ajuste of ajustes ?? []) {
    if (ajuste.porcentaje !== undefined && (!Number.isFinite(ajuste.porcentaje) || ajuste.porcentaje < 0)) {
      errores.push(`La línea ${numeroLinea} tiene un porcentaje de ${nombre} inválido`);
    }
    if (ajuste.monto !== undefined && !montoEsValido(ajuste.monto)) {
      errores.push(`La línea ${numeroLinea} tiene un monto de ${nombre} inválido`);
    }
  }
}

function validarDatosBasicosLinea(linea: LineaEcfInput, indice: number, errores: string[]): void {
  const numero = linea.numeroLinea;
  if (!Number.isInteger(numero) || numero <= 0)
    errores.push(`La línea ${indice + 1} tiene un número de línea inválido`);
  if (!Number.isFinite(linea.cantidad) || linea.cantidad <= 0)
    errores.push(`La línea ${numero} debe tener cantidad mayor que cero`);
  if (!montoEsValido(linea.precioUnitario)) errores.push(`La línea ${numero} tiene precio unitario inválido`);
  if (!montoEsValido(descuentoLinea(linea))) errores.push(`La línea ${numero} tiene descuento inválido`);
  if (!montoEsValido(recargoLinea(linea))) errores.push(`La línea ${numero} tiene recargo inválido`);
  if (!montoEsValido(linea.montoItem)) errores.push(`La línea ${numero} tiene monto inválido`);
  if (linea.nombreItem.trim() === "") errores.push(`La línea ${numero} debe tener nombre del ítem`);
  if (linea.itbisTasa !== tasaPorIndicador(linea.indicadorFacturacion))
    errores.push(`La línea ${numero} tiene una tasa ITBIS que no corresponde con su indicador de facturación`);
}

function validarRetencionLinea(linea: LineaEcfInput, errores: string[]): void {
  if (
    !montoEsValido(linea.retencion?.montoItbisRetenido ?? 0) ||
    !montoEsValido(linea.retencion?.montoIsrRetenido ?? 0)
  ) {
    errores.push(`La línea ${linea.numeroLinea} tiene una retención inválida`);
  }
}

function validarCuadreLinea(linea: LineaEcfInput, errores: string[]): void {
  if (!montoEsValido(linea.cantidad) || !montoEsValido(linea.precioUnitario) || !montoEsValido(linea.montoItem)) return;
  const bruto = centavos(linea.cantidad * linea.precioUnitario);
  const esperado = bruto - centavos(descuentoLinea(linea)) + centavos(recargoLinea(linea));
  const toleranciaCentavos = Math.round(TOLERANCIA_LINEA_DGII * 100);
  if (Math.abs(centavos(linea.montoItem) - esperado) > toleranciaCentavos) {
    errores.push(
      `La línea ${linea.numeroLinea} no cuadra: cantidad por precio menos descuento más recargo no coincide con MontoItem`,
    );
  }
}

function validarLineaAritmetica(linea: LineaEcfInput, indice: number, errores: string[]): void {
  validarDatosBasicosLinea(linea, indice, errores);
  validarSubAjustes(linea.subDescuentos, linea.numeroLinea, "subdescuento", errores);
  validarSubAjustes(linea.subRecargos, linea.numeroLinea, "subrecargo", errores);
  validarRetencionLinea(linea, errores);
  validarCuadreLinea(linea, errores);
}

function validarEncfYEmisor(doc: DocumentoEcfInput, errores: string[]): void {
  const tipo = doc.comprobante.tipo;
  const encf = doc.comprobante.encf.trim();
  if (!RE_ENCF.test(encf)) {
    errores.push("El e-NCF debe tener 13 caracteres con el formato E seguido del tipo y 10 dígitos");
  } else if (encf.slice(1, 3) !== tipo) {
    errores.push(`El e-NCF ${encf} no corresponde con el tipo de comprobante ${tipo}`);
  }
  if (!RE_RNC.test(doc.emisor.rnc)) errores.push("El RNC del emisor debe tener 9 u 11 dígitos");
  if (doc.emisor.razonSocial.trim() === "") errores.push("La razón social del emisor es obligatoria");
  if (doc.emisor.direccion.trim() === "") errores.push("La dirección del emisor es obligatoria");
}

function validarCompradorEcf(doc: DocumentoEcfInput, errores: string[]): void {
  const tipo = doc.comprobante.tipo;
  const rncComprador = doc.comprador.rnc?.trim() ?? "";
  const compradorObligatorio =
    TIPOS_ECF[tipo].requiereRncComprador || (tipo === "32" && doc.totales.montoTotal >= LIMITE_RFCE);
  if (compradorObligatorio && rncComprador === "") {
    errores.push(`El RNC del comprador es obligatorio para el comprobante ${tipo}`);
  }
  if (rncComprador !== "" && !RE_RNC.test(rncComprador)) errores.push("El RNC del comprador debe tener 9 u 11 dígitos");
  if (tipo !== "43" && doc.comprador.razonSocial.trim() === "")
    errores.push("La razón social del comprador es obligatoria");
}

function validarReferenciasYFechas(doc: DocumentoEcfInput, errores: string[]): void {
  const tipo = doc.comprobante.tipo;
  const esNota = tipo === "33" || tipo === "34";
  if (esNota && !doc.comprobante.ncfModificado?.trim()) {
    errores.push("Las notas de débito y crédito electrónicas deben referenciar el e-NCF modificado");
  }
  if (esNota && !doc.comprobante.fechaNcfModificado?.trim()) {
    errores.push("Las notas de débito y crédito electrónicas deben indicar la fecha del e-NCF modificado");
  }
  if (esNota && !doc.comprobante.codigoModificacion?.trim()) {
    errores.push("Las notas de débito y crédito electrónicas deben indicar el código de modificación");
  }
  const fechaEmision = normalizarFechaValidable(doc.comprobante.fechaEmision);
  const fechaVencimiento = normalizarFechaValidable(doc.comprobante.fechaVencimientoSecuencia);
  const fechaLimitePago = doc.comprobante.fechaLimitePago
    ? normalizarFechaValidable(doc.comprobante.fechaLimitePago)
    : null;
  if (!fechaEmision || !fechaEsValida(fechaEmision)) errores.push("La fecha de emisión no es válida");
  if (!fechaVencimiento || !fechaEsValida(fechaVencimiento))
    errores.push("La fecha de vencimiento de la secuencia no es válida");
  if (doc.comprobante.fechaLimitePago && (!fechaLimitePago || !fechaEsValida(fechaLimitePago)))
    errores.push("La fecha límite de pago no es válida");
}

function validarLineasDocumento(doc: DocumentoEcfInput, errores: string[]): void {
  if (doc.lineas.length === 0) errores.push("El documento debe tener al menos una línea");
  const numeros = new Set<number>();
  doc.lineas.forEach((linea, indice) => {
    if (numeros.has(linea.numeroLinea)) errores.push(`El número de línea ${linea.numeroLinea} está duplicado`);
    numeros.add(linea.numeroLinea);
    validarLineaAritmetica(linea, indice, errores);
  });
}

interface TotalesCalculadosEcf {
  gravadoI1: number;
  gravadoI2: number;
  gravadoI3: number;
  exento: number;
  itbis1: number;
  itbis2: number;
  itbis3: number;
  impuestoAdicional: number;
  ajustesSinAsignar: number;
}

function ajustesPorIndicador(doc: DocumentoEcfInput): Map<IndicadorFacturacionEcf, number> {
  const ajustes = new Map<IndicadorFacturacionEcf, number>();
  for (const ajuste of doc.descuentosORecargos ?? []) {
    if (!ajuste.indicadorFacturacion) continue;
    const actual = ajustes.get(ajuste.indicadorFacturacion) ?? 0;
    const firmado = ajuste.tipoAjuste === "D" ? -centavos(ajuste.monto) : centavos(ajuste.monto);
    ajustes.set(ajuste.indicadorFacturacion, actual + firmado);
  }
  return ajustes;
}

function ajustesSinIndicador(doc: DocumentoEcfInput): number {
  return (doc.descuentosORecargos ?? [])
    .filter((ajuste) => ajuste.indicadorFacturacion === undefined)
    .reduce((suma, ajuste) => suma + (ajuste.tipoAjuste === "D" ? -centavos(ajuste.monto) : centavos(ajuste.monto)), 0);
}

function calcularTotalesDocumento(doc: DocumentoEcfInput): TotalesCalculadosEcf {
  const sumaPorIndicador = (indicador: IndicadorFacturacionEcf) =>
    doc.lineas
      .filter((linea) => linea.indicadorFacturacion === indicador)
      .reduce((suma, linea) => suma + centavos(linea.montoItem), 0);
  const ajustes = ajustesPorIndicador(doc);
  const montosI1 = sumaPorIndicador("1") + (ajustes.get("1") ?? 0);
  const montosI2 = sumaPorIndicador("2") + (ajustes.get("2") ?? 0);
  const montosI3 = sumaPorIndicador("3") + (ajustes.get("3") ?? 0);
  const exento = sumaPorIndicador("4") + (ajustes.get("4") ?? 0);
  const montosIncluyenItbis = doc.comprobante.indicadorMontoGravado === "1";
  const baseDesdeMontos = (monto: number, tasa: 18 | 16) =>
    montosIncluyenItbis ? Math.round((monto * 100) / (100 + tasa)) : monto;
  const gravadoI1 = baseDesdeMontos(montosI1, 18);
  const gravadoI2 = baseDesdeMontos(montosI2, 16);
  const impuestosDetalle = (doc.totales.impuestosAdicionales ?? []).reduce(
    (suma, impuesto) =>
      suma +
      centavos(impuesto.montoImpuestoSelectivoConsumoEspecifico ?? 0) +
      centavos(impuesto.montoImpuestoSelectivoConsumoAdvalorem ?? 0) +
      centavos(impuesto.otrosImpuestosAdicionales ?? 0),
    0,
  );
  return {
    gravadoI1,
    gravadoI2,
    gravadoI3: montosI3,
    exento,
    itbis1: montosIncluyenItbis ? montosI1 - gravadoI1 : Math.round(gravadoI1 * 0.18),
    itbis2: montosIncluyenItbis ? montosI2 - gravadoI2 : Math.round(gravadoI2 * 0.16),
    itbis3: 0,
    impuestoAdicional:
      doc.totales.montoImpuestoAdicional === undefined
        ? impuestosDetalle
        : centavos(doc.totales.montoImpuestoAdicional),
    ajustesSinAsignar: ajustesSinIndicador(doc),
  };
}

function agregarErrorDescuadre(valorRecibido: number, valorEsperado: number, mensaje: string, errores: string[]): void {
  if (Math.abs(centavos(valorRecibido) - valorEsperado) > 1) errores.push(mensaje);
}

function validarTotalesDocumento(doc: DocumentoEcfInput, errores: string[]): void {
  const calculados = calcularTotalesDocumento(doc);
  agregarErrorDescuadre(
    doc.totales.montoGravadoI1,
    calculados.gravadoI1,
    "El MontoGravadoI1 no cuadra con las líneas",
    errores,
  );
  agregarErrorDescuadre(
    doc.totales.montoGravadoI2,
    calculados.gravadoI2,
    "El MontoGravadoI2 no cuadra con las líneas",
    errores,
  );
  agregarErrorDescuadre(
    doc.totales.montoGravadoI3 ?? 0,
    calculados.gravadoI3,
    "El MontoGravadoI3 no cuadra con las líneas",
    errores,
  );
  agregarErrorDescuadre(doc.totales.montoExento, calculados.exento, "El MontoExento no cuadra con las líneas", errores);
  agregarErrorDescuadre(
    doc.totales.totalItbis1,
    calculados.itbis1,
    "El TotalITBIS1 no cuadra con la base gravada al 18 %",
    errores,
  );
  agregarErrorDescuadre(
    doc.totales.totalItbis2,
    calculados.itbis2,
    "El TotalITBIS2 no cuadra con la base gravada al 16 %",
    errores,
  );
  agregarErrorDescuadre(doc.totales.totalItbis3 ?? 0, calculados.itbis3, "El TotalITBIS3 no cuadra", errores);
  agregarErrorDescuadre(
    doc.totales.totalItbis,
    calculados.itbis1 + calculados.itbis2 + calculados.itbis3,
    "El TotalITBIS no cuadra con la suma de ITBIS por tasa",
    errores,
  );
  const totalEsperado =
    calculados.gravadoI1 +
    calculados.gravadoI2 +
    calculados.gravadoI3 +
    calculados.exento +
    calculados.itbis1 +
    calculados.itbis2 +
    calculados.itbis3 +
    calculados.impuestoAdicional +
    calculados.ajustesSinAsignar;
  agregarErrorDescuadre(
    doc.totales.montoTotal,
    totalEsperado,
    "El MontoTotal no cuadra con la suma de líneas, ajustes e impuestos",
    errores,
  );

  const itbisRetenidoLineas = doc.lineas.reduce(
    (suma, linea) => suma + centavos(linea.retencion?.montoItbisRetenido ?? 0),
    0,
  );
  const isrRetenidoLineas = doc.lineas.reduce(
    (suma, linea) => suma + centavos(linea.retencion?.montoIsrRetenido ?? 0),
    0,
  );
  if (doc.totales.totalItbisRetenido !== undefined) {
    agregarErrorDescuadre(
      doc.totales.totalItbisRetenido,
      itbisRetenidoLineas,
      "El TotalITBISRetenido no cuadra con las retenciones de las líneas",
      errores,
    );
  }
  if (doc.totales.totalIsrRetencion !== undefined) {
    agregarErrorDescuadre(
      doc.totales.totalIsrRetencion,
      isrRetenidoLineas,
      "El TotalISRRetencion no cuadra con las retenciones de las líneas",
      errores,
    );
  }
}

export function validarDocumentoEcf(doc: DocumentoEcfInput): ValidacionDocumentoEcf {
  const errores: string[] = [];
  validarEncfYEmisor(doc, errores);
  validarCompradorEcf(doc, errores);
  validarReferenciasYFechas(doc, errores);
  validarLineasDocumento(doc, errores);
  validarTotalesDocumento(doc, errores);
  return errores.length === 0 ? { ok: true } : { ok: false, errores };
}

function tag(nombre: string, valor: string | number): string {
  return `<${nombre}>${escapeXml(String(valor))}</${nombre}>`;
}

function tagOpcional(nombre: string, valor: string | number | undefined): string {
  if (valor === undefined || valor === "") return "";
  return tag(nombre, valor);
}

function asegurarDocumentoValido(doc: DocumentoEcfInput): void {
  const validacion = validarDocumentoEcf(doc);
  if (!validacion.ok) throw new Error(`Documento e-CF inválido: ${validacion.errores.join("; ")}`);
}

function declaracionXml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>`;
}

function tipoUsaGravadosCompletos(tipo: TipoEcf): boolean {
  return tipo === "31" || tipo === "32" || tipo === "33" || tipo === "34" || tipo === "41" || tipo === "45";
}

function tipoPermiteImpuestosAdicionales(tipo: TipoEcf): boolean {
  return tipo === "31" || tipo === "32" || tipo === "33" || tipo === "34" || tipo === "44" || tipo === "45";
}

function tipoPermiteRetencionEnLinea(tipo: TipoEcf): boolean {
  return tipo === "31" || tipo === "33" || tipo === "34" || tipo === "41" || tipo === "47";
}

function tipoPermiteDescuentos(tipo: TipoEcf): boolean {
  return tipo !== "43" && tipo !== "47";
}

function xmlImpuestosAdicionales(impuestos: ImpuestoAdicionalEcfInput[] | undefined): string {
  if (!impuestos || impuestos.length === 0) return "";
  const detalle = impuestos
    .map(
      (impuesto) =>
        `<ImpuestoAdicional>${[
          tag("TipoImpuesto", impuesto.tipoImpuesto),
          tagOpcional(
            "TasaImpuestoAdicional",
            impuesto.tasaImpuestoAdicional === undefined
              ? undefined
              : formatearMontoDgii(impuesto.tasaImpuestoAdicional),
          ),
          tagOpcional(
            "MontoImpuestoSelectivoConsumoEspecifico",
            impuesto.montoImpuestoSelectivoConsumoEspecifico === undefined
              ? undefined
              : formatearMontoDgii(impuesto.montoImpuestoSelectivoConsumoEspecifico),
          ),
          tagOpcional(
            "MontoImpuestoSelectivoConsumoAdvalorem",
            impuesto.montoImpuestoSelectivoConsumoAdvalorem === undefined
              ? undefined
              : formatearMontoDgii(impuesto.montoImpuestoSelectivoConsumoAdvalorem),
          ),
          tagOpcional(
            "OtrosImpuestosAdicionales",
            impuesto.otrosImpuestosAdicionales === undefined
              ? undefined
              : formatearMontoDgii(impuesto.otrosImpuestosAdicionales),
          ),
        ].join("")}</ImpuestoAdicional>`,
    )
    .join("");
  return `<ImpuestosAdicionales>${detalle}</ImpuestosAdicionales>`;
}

interface CondicionesTotalesXml {
  gravadoI3: number;
  gravadoTotal: number;
  correspondeItbis1: boolean;
  correspondeItbis2: boolean;
  correspondeTasaItbis3: boolean;
  correspondeTotalItbis3: boolean;
  correspondeTotalItbis: boolean;
}

function condicionesTotalesXml(totales: DocumentoEcfInput["totales"]): CondicionesTotalesXml {
  const gravadoI3 = totales.montoGravadoI3 ?? 0;
  const gravadoTotal = totales.montoGravadoI1 + totales.montoGravadoI2 + gravadoI3;
  const totalItbis3 = totales.totalItbis3 ?? 0;
  return {
    gravadoI3,
    gravadoTotal,
    correspondeItbis1: totales.montoGravadoI1 > 0 || totales.totalItbis1 > 0,
    correspondeItbis2: totales.montoGravadoI2 > 0 || totales.totalItbis2 > 0,
    correspondeTasaItbis3: gravadoI3 > 0,
    correspondeTotalItbis3: gravadoI3 > 0 || totalItbis3 > 0,
    correspondeTotalItbis: totales.totalItbis > 0 || gravadoTotal > 0,
  };
}

function tagMontoCondicional(nombre: string, valor: number, emitir: boolean): string {
  return emitir ? tag(nombre, formatearMontoDgii(valor)) : "";
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: la matriz XSD de totales varía por cada tipo e-CF y dividirla ocultaría el orden oficial de las etiquetas
function xmlTotalesEcf(doc: DocumentoEcfInput): string {
  const totales = doc.totales;
  const tipo = doc.comprobante.tipo;
  const condiciones = condicionesTotalesXml(totales);
  const completo = tipoUsaGravadosCompletos(tipo);
  const esExportacion = tipo === "46";
  const tipoExentoTotal = tipo === "43" || tipo === "44" || tipo === "47";
  const debeEmitirExento = totales.montoExento > 0 || (tipoExentoTotal && totales.montoTotal > 0);
  const partes: string[] = [];

  if ((completo || esExportacion) && condiciones.gravadoTotal > 0) {
    partes.push(tag("MontoGravadoTotal", formatearMontoDgii(condiciones.gravadoTotal)));
  }
  if (completo) {
    partes.push(
      tagMontoCondicional("MontoGravadoI1", totales.montoGravadoI1, totales.montoGravadoI1 > 0),
      tagMontoCondicional("MontoGravadoI2", totales.montoGravadoI2, totales.montoGravadoI2 > 0),
    );
  }
  if ((completo || esExportacion) && condiciones.gravadoI3 > 0) {
    partes.push(tag("MontoGravadoI3", formatearMontoDgii(condiciones.gravadoI3)));
  }
  if (!esExportacion) {
    partes.push(tagMontoCondicional("MontoExento", totales.montoExento, debeEmitirExento));
  }
  if (completo) {
    partes.push(
      condiciones.correspondeItbis1 ? tag("ITBIS1", "18") : "",
      condiciones.correspondeItbis2 ? tag("ITBIS2", "16") : "",
      condiciones.correspondeTasaItbis3 ? tag("ITBIS3", "0") : "",
      tagMontoCondicional("TotalITBIS", totales.totalItbis, condiciones.correspondeTotalItbis),
      tagMontoCondicional("TotalITBIS1", totales.totalItbis1, condiciones.correspondeItbis1),
      tagMontoCondicional("TotalITBIS2", totales.totalItbis2, condiciones.correspondeItbis2),
      tagMontoCondicional("TotalITBIS3", totales.totalItbis3 ?? 0, condiciones.correspondeTotalItbis3),
    );
  }
  if (esExportacion) {
    partes.push(
      condiciones.correspondeTasaItbis3 ? tag("ITBIS3", "0") : "",
      tagMontoCondicional("TotalITBIS", totales.totalItbis, condiciones.correspondeTotalItbis),
      tagMontoCondicional("TotalITBIS3", totales.totalItbis3 ?? 0, condiciones.correspondeTotalItbis3),
    );
  }
  if (tipoPermiteImpuestosAdicionales(tipo)) {
    partes.push(
      tagOpcional(
        "MontoImpuestoAdicional",
        totales.montoImpuestoAdicional === undefined ? undefined : formatearMontoDgii(totales.montoImpuestoAdicional),
      ),
      xmlImpuestosAdicionales(totales.impuestosAdicionales),
    );
  }
  partes.push(tag("MontoTotal", formatearMontoDgii(totales.montoTotal)));
  const admiteRetenciones = tipo === "31" || tipo === "33" || tipo === "34" || tipo === "41";
  if (admiteRetenciones) {
    partes.push(
      tagOpcional(
        "TotalITBISRetenido",
        totales.totalItbisRetenido === undefined ? undefined : formatearMontoDgii(totales.totalItbisRetenido),
      ),
    );
  }
  if (admiteRetenciones || tipo === "47") {
    partes.push(
      tagOpcional(
        "TotalISRRetencion",
        totales.totalIsrRetencion === undefined ? undefined : formatearMontoDgii(totales.totalIsrRetencion),
      ),
    );
  }
  return partes.join("");
}

function xmlSubAjustes(nombreTabla: string, nombreItem: string, ajustes: SubAjusteEcfInput[] | undefined): string {
  if (!ajustes || ajustes.length === 0) return "";
  const prefijo = nombreItem === "SubDescuento" ? "SubDescuento" : "SubRecargo";
  const detalle = ajustes
    .map(
      (ajuste) =>
        `<${nombreItem}>${[
          tag(nombreItem === "SubDescuento" ? "TipoSubDescuento" : "TipoSubRecargo", ajuste.tipo),
          tagOpcional(
            `${prefijo}Porcentaje`,
            ajuste.porcentaje === undefined ? undefined : formatearMontoDgii(ajuste.porcentaje),
          ),
          tagOpcional(`Monto${prefijo}`, ajuste.monto === undefined ? undefined : formatearMontoDgii(ajuste.monto)),
        ].join("")}</${nombreItem}>`,
    )
    .join("");
  return `<${nombreTabla}>${detalle}</${nombreTabla}>`;
}

function xmlRetencionLinea(linea: LineaEcfInput, tipo: TipoEcf): string {
  if (!tipoPermiteRetencionEnLinea(tipo)) return "";
  const retencion =
    linea.retencion ??
    (tipo === "41" || tipo === "47"
      ? {
          indicadorAgenteRetencion: "1" as const,
          montoIsrRetenido: tipo === "47" ? 0 : undefined,
        }
      : undefined);
  if (!retencion) return "";
  return `<Retencion>${[
    tag("IndicadorAgenteRetencionoPercepcion", retencion.indicadorAgenteRetencion),
    tipo === "47"
      ? tag("MontoISRRetenido", formatearMontoDgii(retencion.montoIsrRetenido ?? 0))
      : tagOpcional(
          "MontoITBISRetenido",
          retencion.montoItbisRetenido === undefined ? undefined : formatearMontoDgii(retencion.montoItbisRetenido),
        ) +
        tagOpcional(
          "MontoISRRetenido",
          retencion.montoIsrRetenido === undefined ? undefined : formatearMontoDgii(retencion.montoIsrRetenido),
        ),
  ].join("")}</Retencion>`;
}

function xmlItem(linea: LineaEcfInput, tipo: TipoEcf): string {
  const descuento = descuentoLinea(linea);
  const recargo = recargoLinea(linea);
  const permiteDescuentos = tipoPermiteDescuentos(tipo);
  return `<Item>${[
    tag("NumeroLinea", linea.numeroLinea),
    tag("IndicadorFacturacion", linea.indicadorFacturacion),
    xmlRetencionLinea(linea, tipo),
    tag("NombreItem", linea.nombreItem),
    tag("IndicadorBienoServicio", linea.indicadorBienoServicio ?? "1"),
    tag("CantidadItem", formatearMontoDgii(linea.cantidad)),
    tagOpcional("UnidadMedida", linea.unidadMedida),
    tag("PrecioUnitarioItem", formatearPrecioDgii(linea.precioUnitario)),
    permiteDescuentos && descuento > 0 ? tag("DescuentoMonto", formatearMontoDgii(descuento)) : "",
    permiteDescuentos ? xmlSubAjustes("TablaSubDescuento", "SubDescuento", linea.subDescuentos) : "",
    permiteDescuentos && recargo > 0 ? tag("RecargoMonto", formatearMontoDgii(recargo)) : "",
    permiteDescuentos ? xmlSubAjustes("TablaSubRecargo", "SubRecargo", linea.subRecargos) : "",
    tag("MontoItem", formatearMontoDgii(linea.montoItem)),
  ].join("")}</Item>`;
}

function xmlOtraMoneda(doc: DocumentoEcfInput): string {
  const otra = doc.otraMoneda;
  if (!otra) return "";
  const tipo = doc.comprobante.tipo;
  const admiteGravados = tipoUsaGravadosCompletos(tipo) || tipo === "46";
  const admiteItbis = tipoUsaGravadosCompletos(tipo);
  return `<OtraMoneda>${[
    tag("TipoMoneda", otra.tipoMoneda),
    tag("TipoCambio", formatearPrecioDgii(otra.tipoCambio)),
    admiteGravados && otra.montoGravadoTotalOtraMoneda !== undefined
      ? tag("MontoGravadoTotalOtraMoneda", formatearMontoDgii(otra.montoGravadoTotalOtraMoneda))
      : "",
    otra.montoExentoOtraMoneda !== undefined && tipo !== "46"
      ? tag("MontoExentoOtraMoneda", formatearMontoDgii(otra.montoExentoOtraMoneda))
      : "",
    admiteItbis && otra.totalItbisOtraMoneda !== undefined
      ? tag("TotalITBISOtraMoneda", formatearMontoDgii(otra.totalItbisOtraMoneda))
      : "",
    tag("MontoTotalOtraMoneda", formatearMontoDgii(otra.montoTotalOtraMoneda)),
  ].join("")}</OtraMoneda>`;
}

function xmlDescuentosORecargos(doc: DocumentoEcfInput): string {
  if (!tipoPermiteDescuentos(doc.comprobante.tipo) || !doc.descuentosORecargos?.length) return "";
  const detalle = doc.descuentosORecargos
    .map(
      (ajuste) =>
        `<DescuentoORecargo>${[
          tag("NumeroLinea", ajuste.numeroLinea),
          tag("TipoAjuste", ajuste.tipoAjuste),
          tagOpcional("DescripcionDescuentooRecargo", ajuste.descripcion),
          tag("TipoValor", ajuste.tipoValor),
          tagOpcional(
            "ValorDescuentooRecargo",
            ajuste.valor === undefined ? undefined : formatearMontoDgii(ajuste.valor),
          ),
          tag("MontoDescuentooRecargo", formatearMontoDgii(ajuste.monto)),
          tagOpcional("IndicadorFacturacionDescuentooRecargo", ajuste.indicadorFacturacion),
        ].join("")}</DescuentoORecargo>`,
    )
    .join("");
  return `<DescuentosORecargos>${detalle}</DescuentosORecargos>`;
}

function xmlIdDoc(doc: DocumentoEcfInput): string {
  const comp = doc.comprobante;
  const tipo = comp.tipo;
  const partes = [tag("TipoeCF", tipo), tag("eNCF", comp.encf)];
  if (tipo !== "32" && tipo !== "34") {
    partes.push(tag("FechaVencimientoSecuencia", formatearFechaDgii(comp.fechaVencimientoSecuencia)));
  }
  if (tipo === "34") partes.push(tag("IndicadorNotaCredito", comp.indicadorNotaCredito ?? "0"));
  if (tipo !== "43" && tipo !== "44" && tipo !== "46" && tipo !== "47") {
    partes.push(tagOpcional("IndicadorMontoGravado", comp.indicadorMontoGravado));
  }
  if (tipo !== "41" && tipo !== "43" && tipo !== "47") partes.push(tag("TipoIngresos", comp.tipoIngresos));
  partes.push(tag("TipoPago", comp.tipoPago));
  partes.push(
    tagOpcional("FechaLimitePago", comp.fechaLimitePago ? formatearFechaDgii(comp.fechaLimitePago) : undefined),
  );
  return `<IdDoc>${partes.join("")}</IdDoc>`;
}

function xmlTablaTelefonosEmisor(telefonos: string[] | undefined): string {
  const validos = (telefonos ?? []).map((telefono) => telefono.trim()).filter((telefono) => telefono !== "");
  if (validos.length === 0) return "";
  return `<TablaTelefonoEmisor>${validos.map((telefono) => tag("TelefonoEmisor", telefono)).join("")}</TablaTelefonoEmisor>`;
}

export function generarXmlEcf(doc: DocumentoEcfInput): string {
  asegurarDocumentoValido(doc);
  const comp = doc.comprobante;
  const referencia =
    comp.ncfModificado || comp.fechaNcfModificado || comp.codigoModificacion
      ? `<InformacionReferencia>${[
          tagOpcional("NCFModificado", comp.ncfModificado),
          tagOpcional(
            "FechaNCFModificado",
            comp.fechaNcfModificado ? formatearFechaDgii(comp.fechaNcfModificado) : undefined,
          ),
          tagOpcional("CodigoModificacion", comp.codigoModificacion),
        ].join("")}</InformacionReferencia>`
      : "";
  const comprador =
    comp.tipo === "43"
      ? ""
      : `<Comprador>${[
          tagOpcional("RNCComprador", doc.comprador.rnc),
          tag("RazonSocialComprador", doc.comprador.razonSocial),
          tagOpcional("CorreoComprador", doc.comprador.correo),
        ].join("")}</Comprador>`;

  const xml = `<ECF><Encabezado>${tag("Version", "1.0")}${xmlIdDoc(doc)}<Emisor>${[
    tag("RNCEmisor", doc.emisor.rnc),
    tag("RazonSocialEmisor", doc.emisor.razonSocial),
    tagOpcional("NombreComercial", doc.emisor.nombreComercial),
    tagOpcional("Sucursal", doc.emisor.sucursal),
    tag("DireccionEmisor", doc.emisor.direccion),
    tagOpcional("Municipio", doc.emisor.municipio),
    tagOpcional("Provincia", doc.emisor.provincia),
    xmlTablaTelefonosEmisor(doc.emisor.telefonos),
    tagOpcional("CorreoEmisor", doc.emisor.correo),
    tag("FechaEmision", formatearFechaDgii(comp.fechaEmision)),
  ].join(
    "",
  )}</Emisor>${comprador}<Totales>${xmlTotalesEcf(doc)}</Totales>${xmlOtraMoneda(doc)}</Encabezado><DetallesItems>${doc.lineas
    .map((linea) => xmlItem(linea, comp.tipo))
    .join("")}</DetallesItems>${xmlDescuentosORecargos(doc)}${referencia}${tag(
    "FechaHoraFirma",
    formatearFechaHoraDgii(comp.fechaHoraFirma),
  )}</ECF>`;

  return `${declaracionXml()}${xml}`;
}

export function esElegibleRfce(doc: DocumentoEcfInput): boolean {
  return doc.comprobante.tipo === "32" && doc.totales.montoTotal < LIMITE_RFCE;
}

function xmlTotalesRfce(doc: DocumentoEcfInput): string {
  const totales = doc.totales;
  const condiciones = condicionesTotalesXml(totales);
  return [
    tagMontoCondicional("MontoGravadoTotal", condiciones.gravadoTotal, condiciones.gravadoTotal > 0),
    tagMontoCondicional("MontoGravadoI1", totales.montoGravadoI1, totales.montoGravadoI1 > 0),
    tagMontoCondicional("MontoGravadoI2", totales.montoGravadoI2, totales.montoGravadoI2 > 0),
    tagMontoCondicional("MontoGravadoI3", condiciones.gravadoI3, condiciones.gravadoI3 > 0),
    tagMontoCondicional("MontoExento", totales.montoExento, totales.montoExento > 0),
    tagMontoCondicional("TotalITBIS", totales.totalItbis, condiciones.correspondeTotalItbis),
    tagMontoCondicional("TotalITBIS1", totales.totalItbis1, condiciones.correspondeItbis1),
    tagMontoCondicional("TotalITBIS2", totales.totalItbis2, condiciones.correspondeItbis2),
    tagMontoCondicional("TotalITBIS3", totales.totalItbis3 ?? 0, condiciones.correspondeTotalItbis3),
    tagOpcional(
      "MontoImpuestoAdicional",
      totales.montoImpuestoAdicional === undefined ? undefined : formatearMontoDgii(totales.montoImpuestoAdicional),
    ),
    xmlImpuestosAdicionales(totales.impuestosAdicionales),
    tag("MontoTotal", formatearMontoDgii(totales.montoTotal)),
  ].join("");
}

export function generarXmlRfce(doc: DocumentoEcfInput, codigoSeguridadEcf: string): string {
  asegurarDocumentoValido(doc);
  if (!esElegibleRfce(doc))
    throw new Error("Solo las facturas de consumo E32 menores de RD$250,000 pueden generar RFCE");
  if (!/^.{6}$/.test(codigoSeguridadEcf)) throw new Error("El código de seguridad del e-CF debe tener 6 caracteres");
  const comp = doc.comprobante;
  const xml = `<RFCE><Encabezado>${tag("Version", "1.0")}<IdDoc>${[
    tag("TipoeCF", comp.tipo),
    tag("eNCF", comp.encf),
    tag("TipoIngresos", comp.tipoIngresos),
    tag("TipoPago", comp.tipoPago),
  ].join("")}</IdDoc><Emisor>${[
    tag("RNCEmisor", doc.emisor.rnc),
    tag("RazonSocialEmisor", doc.emisor.razonSocial),
    tag("FechaEmision", formatearFechaDgii(comp.fechaEmision)),
  ].join("")}</Emisor><Comprador>${[
    tagOpcional("RNCComprador", doc.comprador.rnc),
    tag("RazonSocialComprador", doc.comprador.razonSocial),
  ].join("")}</Comprador><Totales>${xmlTotalesRfce(doc)}</Totales>${tag(
    "CodigoSeguridadeCF",
    codigoSeguridadEcf,
  )}</Encabezado></RFCE>`;
  return `${declaracionXml()}${xml}`;
}

function validarRncOError(rnc: string, quien: string): void {
  if (!RE_RNC.test(rnc)) throw new Error(`El RNC de ${quien} debe tener 9 u 11 dígitos`);
}

function validarEncfOError(encf: string): void {
  if (!RE_ENCF.test(encf))
    throw new Error("El e-NCF debe tener 13 caracteres con el formato E seguido del tipo y 10 dígitos");
}

export function generarXmlArecf(input: AcuseReciboInput): string {
  validarRncOError(input.rncEmisor, "emisor");
  validarRncOError(input.rncComprador, "comprador");
  validarEncfOError(input.encf);
  if (input.estado === "1" && !input.codigoMotivoNoRecibido) {
    throw new Error("El acuse de no recibido debe indicar el código del motivo");
  }
  const xml = `<ARECF><DetalleAcusedeRecibo>${[
    tag("Version", "1.0"),
    tag("RNCEmisor", input.rncEmisor),
    tag("RNCComprador", input.rncComprador),
    tag("eNCF", input.encf),
    tag("Estado", input.estado),
    tagOpcional("CodigoMotivoNoRecibido", input.codigoMotivoNoRecibido),
    tag("FechaHoraAcuseRecibo", formatearFechaHoraDgii(input.fechaHoraAcuseRecibo)),
  ].join("")}</DetalleAcusedeRecibo></ARECF>`;
  return `${declaracionXml()}${xml}`;
}

export function generarXmlAcecf(input: AprobacionComercialInput): string {
  validarRncOError(input.rncEmisor, "emisor");
  validarRncOError(input.rncComprador, "comprador");
  validarEncfOError(input.encf);
  if (!montoEsValido(input.montoTotal)) throw new Error("El monto total de la aprobación comercial es inválido");
  if (input.estado === "2" && !input.detalleMotivoRechazo?.trim()) {
    throw new Error("El rechazo comercial debe indicar el detalle del motivo");
  }
  const xml = `<ACECF><DetalleAprobacionComercial>${[
    tag("Version", "1.0"),
    tag("RNCEmisor", input.rncEmisor),
    tag("eNCF", input.encf),
    tag("FechaEmision", formatearFechaDgii(input.fechaEmision)),
    tag("MontoTotal", formatearMontoDgii(input.montoTotal)),
    tag("RNCComprador", input.rncComprador),
    tag("Estado", input.estado),
    tagOpcional("DetalleMotivoRechazo", input.detalleMotivoRechazo),
    tag("FechaHoraAprobacionComercial", formatearFechaHoraDgii(input.fechaHoraAprobacionComercial)),
  ].join("")}</DetalleAprobacionComercial></ACECF>`;
  return `${declaracionXml()}${xml}`;
}

function partesEncf(encf: string): { tipo: TipoEcf; secuencia: number } {
  validarEncfOError(encf);
  const tipo = encf.slice(1, 3) as TipoEcf;
  return { tipo, secuencia: Number(encf.slice(3)) };
}

export function generarXmlAnecf(input: AnulacionEncfInput): string {
  validarRncOError(input.rncEmisor, "emisor");
  if (input.anulaciones.length === 0) throw new Error("La anulación debe tener al menos una línea");
  let total = 0;
  const detalle = input.anulaciones
    .map((anulacion, indice) => {
      if (anulacion.rangos.length === 0) throw new Error(`La anulación ${indice + 1} no tiene rangos`);
      let cantidadLinea = 0;
      const rangos = anulacion.rangos
        .map((rango) => {
          const desde = partesEncf(rango.desde);
          const hasta = partesEncf(rango.hasta);
          if (desde.tipo !== anulacion.tipo || hasta.tipo !== anulacion.tipo) {
            throw new Error(`Los rangos de la línea ${indice + 1} no corresponden con el tipo ${anulacion.tipo}`);
          }
          if (hasta.secuencia < desde.secuencia)
            throw new Error("La secuencia final no puede ser menor que la inicial");
          cantidadLinea += hasta.secuencia - desde.secuencia + 1;
          return `<Secuencias>${tag("SecuenciaeNCFDesde", rango.desde)}${tag("SecuenciaeNCFHasta", rango.hasta)}</Secuencias>`;
        })
        .join("");
      total += cantidadLinea;
      return `<Anulacion>${[
        tag("NoLinea", indice + 1),
        tag("TipoeCF", anulacion.tipo),
        `<TablaRangoSecuenciasAnuladaseNCF>${rangos}</TablaRangoSecuenciasAnuladaseNCF>`,
        tag("CantidadeNCFAnulados", cantidadLinea),
      ].join("")}</Anulacion>`;
    })
    .join("");
  const xml = `<ANECF><Encabezado>${[
    tag("Version", "1.0"),
    tag("RncEmisor", input.rncEmisor),
    tag("CantidadeNCFAnulados", total),
    tag("FechaHoraAnulacioneNCF", formatearFechaHoraDgii(input.fechaHoraAnulacion)),
  ].join("")}</Encabezado><DetalleAnulacion>${detalle}</DetalleAnulacion></ANECF>`;
  return `${declaracionXml()}${xml}`;
}

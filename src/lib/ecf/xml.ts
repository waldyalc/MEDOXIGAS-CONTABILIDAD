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

function fechaDesdePartes(dia: string, mes: string, anio: string): string {
  return `${dia}-${mes}-${anio}`;
}

function partesFechaHoraRd(fecha: Date): Record<string, string> {
  const partes: Record<string, string> = {};
  const formato = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  for (const parte of formato.formatToParts(fecha)) {
    if (parte.type !== "literal") partes[parte.type] = parte.value;
  }
  return partes;
}

export function formatearFechaDgii(fecha: string | Date): string {
  if (fecha instanceof Date) {
    const partes = partesFechaHoraRd(fecha);
    return fechaDesdePartes(partes.day ?? "01", partes.month ?? "01", partes.year ?? "1970");
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
    const partes = partesFechaHoraRd(valor);
    return `${formatearFechaDgii(valor)} ${partes.hour ?? "00"}:${partes.minute ?? "00"}:${partes.second ?? "00"}`;
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
  if (tipo === "47" && rncComprador === "" && !doc.comprador.identificadorExtranjero?.trim()) {
    errores.push("El comprobante E47 debe indicar el identificador extranjero del comprador");
  }
  if (rncComprador !== "" && !RE_RNC.test(rncComprador)) errores.push("El RNC del comprador debe tener 9 u 11 dígitos");
  if (tipo !== "43" && doc.comprador.razonSocial.trim() === "")
    errores.push("La razón social del comprador es obligatoria");
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: la matriz fiscal XSD E31-E47 exige ramificar obligatoriedad y orden por tipo de comprobante
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
  const fechaVencimiento = doc.comprobante.fechaVencimientoSecuencia
    ? normalizarFechaValidable(doc.comprobante.fechaVencimientoSecuencia)
    : null;
  const fechaLimitePago = doc.comprobante.fechaLimitePago
    ? normalizarFechaValidable(doc.comprobante.fechaLimitePago)
    : null;
  if (!fechaEmision || !fechaEsValida(fechaEmision)) errores.push("La fecha de emisión no es válida");
  const vencimientoObligatorio = tipo !== "32" && tipo !== "34";
  if (vencimientoObligatorio && (!fechaVencimiento || !fechaEsValida(fechaVencimiento)))
    errores.push("La fecha de vencimiento de la secuencia no es válida");
  if (!vencimientoObligatorio && fechaVencimiento && !fechaEsValida(fechaVencimiento))
    errores.push("La fecha de vencimiento de la secuencia no es válida");
  if (doc.comprobante.fechaLimitePago && (!fechaLimitePago || !fechaEsValida(fechaLimitePago)))
    errores.push("La fecha límite de pago no es válida");
  const tipoPagoObligatorio = tipo !== "41" && tipo !== "43" && tipo !== "47";
  if (tipoPagoObligatorio && !doc.comprobante.tipoPago) errores.push("El tipo de pago es obligatorio");
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
  const itbis1AlternativoIsc =
    calculados.impuestoAdicional > 0
      ? Math.round((calculados.gravadoI1 + calculados.impuestoAdicional) * 0.18)
      : calculados.itbis1;
  const diferenciaItbis1Estandar = Math.abs(centavos(doc.totales.totalItbis1) - calculados.itbis1);
  const diferenciaItbis1Isc = Math.abs(centavos(doc.totales.totalItbis1) - itbis1AlternativoIsc);
  const itbis1Efectivo = diferenciaItbis1Estandar <= 1 ? calculados.itbis1 : itbis1AlternativoIsc;
  if (diferenciaItbis1Estandar > 1 && diferenciaItbis1Isc > 1) {
    errores.push("El TotalITBIS1 no cuadra con la base gravada al 18 %");
  }
  agregarErrorDescuadre(
    doc.totales.totalItbis2,
    calculados.itbis2,
    "El TotalITBIS2 no cuadra con la base gravada al 16 %",
    errores,
  );
  agregarErrorDescuadre(doc.totales.totalItbis3 ?? 0, calculados.itbis3, "El TotalITBIS3 no cuadra", errores);
  agregarErrorDescuadre(
    doc.totales.totalItbis,
    itbis1Efectivo + calculados.itbis2 + calculados.itbis3,
    "El TotalITBIS no cuadra con la suma de ITBIS por tasa",
    errores,
  );
  const totalEsperado =
    calculados.gravadoI1 +
    calculados.gravadoI2 +
    calculados.gravadoI3 +
    calculados.exento +
    itbis1Efectivo +
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

function validarFormasPagoYImpuestosEcf(doc: DocumentoEcfInput, errores: string[]): void {
  const tipo = doc.comprobante.tipo;
  if (tipo !== "34" && tipo !== "43") {
    for (const forma of doc.comprobante.formasPago ?? []) {
      if (forma.formaPago.trim() === "") continue;
      if (forma.montoPago === undefined || !montoEsValido(forma.montoPago)) {
        errores.push("Cada forma de pago de un e-CF debe incluir un MontoPago válido");
      }
    }
  }
  if (tipo === "44") {
    const listas = [
      ...(doc.totales.impuestosAdicionales ?? []),
      ...(doc.otraMoneda?.impuestosAdicionalesOtraMoneda ?? []),
    ];
    for (const impuesto of listas) {
      if (
        impuesto.montoImpuestoSelectivoConsumoEspecifico !== undefined ||
        impuesto.montoImpuestoSelectivoConsumoAdvalorem !== undefined
      ) {
        errores.push("El comprobante E44 no admite impuestos selectivos al consumo en ImpuestosAdicionales");
      }
      if (
        impuesto.otrosImpuestosAdicionales === undefined ||
        !montoEsValido(impuesto.otrosImpuestosAdicionales) ||
        impuesto.otrosImpuestosAdicionales <= 0
      ) {
        errores.push("El comprobante E44 requiere OtrosImpuestosAdicionales mayor que cero en ImpuestosAdicionales");
      }
    }
  }
}

export function validarDocumentoEcf(doc: DocumentoEcfInput): ValidacionDocumentoEcf {
  const errores: string[] = [];
  validarEncfYEmisor(doc, errores);
  validarCompradorEcf(doc, errores);
  validarReferenciasYFechas(doc, errores);
  validarFormasPagoYImpuestosEcf(doc, errores);
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

function tipoPermiteImpuestosAdicionales(tipo: TipoEcf): boolean {
  return tipo === "31" || tipo === "32" || tipo === "33" || tipo === "34" || tipo === "44" || tipo === "45";
}

function tipoPermiteRetencionEnLinea(tipo: TipoEcf): boolean {
  return tipo === "31" || tipo === "33" || tipo === "34" || tipo === "41" || tipo === "47";
}

function tipoPermiteDescuentos(tipo: TipoEcf): boolean {
  return tipo !== "43" && tipo !== "47";
}

function tipoPermiteReferenciaDeCantidad(tipo: TipoEcf): boolean {
  return tipo === "31" || tipo === "32" || tipo === "33" || tipo === "34" || tipo === "45";
}

export function formatearDecimalHasta2Dgii(valor: number): string {
  if (!Number.isFinite(valor)) throw new Error("Los decimales DGII deben ser números finitos");
  const redondeado = Math.round((valor + Number.EPSILON) * 100) / 100;
  return String(redondeado)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

export function formatearDecimalHasta3Dgii(valor: number): string {
  if (!Number.isFinite(valor)) throw new Error("Los decimales DGII deben ser números finitos");
  const redondeado = Math.round((valor + Number.EPSILON) * 1000) / 1000;
  return String(redondeado)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

function xmlImpuestosAdicionales(
  impuestos: ImpuestoAdicionalEcfInput[] | undefined,
  opciones: { rfce?: boolean; otraMoneda?: boolean; tipo?: TipoEcf } = {},
): string {
  if (!impuestos || impuestos.length === 0) return "";
  const otra = opciones.otraMoneda === true;
  const soloOtros = opciones.tipo === "44";
  const nombreTabla = otra ? "ImpuestosAdicionalesOtraMoneda" : "ImpuestosAdicionales";
  const nombreItem = otra ? "ImpuestoAdicionalOtraMoneda" : "ImpuestoAdicional";
  const sufijo = otra ? "OtraMoneda" : "";
  const detalle = impuestos
    .map((impuesto) => {
      const partes = [tag(`TipoImpuesto${sufijo}`, impuesto.tipoImpuesto)];
      if (!opciones.rfce) {
        partes.push(
          tagOpcional(
            `TasaImpuestoAdicional${sufijo}`,
            impuesto.tasaImpuestoAdicional === undefined
              ? undefined
              : formatearDecimalHasta2Dgii(impuesto.tasaImpuestoAdicional),
          ),
        );
      }
      if (!soloOtros) {
        partes.push(
          tagOpcional(
            `MontoImpuestoSelectivoConsumoEspecifico${sufijo}`,
            impuesto.montoImpuestoSelectivoConsumoEspecifico === undefined
              ? undefined
              : formatearMontoDgii(impuesto.montoImpuestoSelectivoConsumoEspecifico),
          ),
          tagOpcional(
            `MontoImpuestoSelectivoConsumoAdvalorem${sufijo}`,
            impuesto.montoImpuestoSelectivoConsumoAdvalorem === undefined
              ? undefined
              : formatearMontoDgii(impuesto.montoImpuestoSelectivoConsumoAdvalorem),
          ),
        );
      }
      partes.push(
        tagOpcional(
          `OtrosImpuestosAdicionales${sufijo}`,
          impuesto.otrosImpuestosAdicionales === undefined
            ? undefined
            : formatearMontoDgii(impuesto.otrosImpuestosAdicionales),
        ),
      );
      return `<${nombreItem}>${partes.join("")}</${nombreItem}>`;
    })
    .join("");
  return `<${nombreTabla}>${detalle}</${nombreTabla}>`;
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
  const gravadoTotal = totales.montoGravadoTotal ?? totales.montoGravadoI1 + totales.montoGravadoI2 + gravadoI3;
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

const ORDEN_TOTALES_BASE_XML = [
  "MontoGravadoTotal",
  "MontoGravadoI1",
  "MontoGravadoI2",
  "MontoGravadoI3",
  "MontoExento",
  "ITBIS1",
  "ITBIS2",
  "ITBIS3",
  "TotalITBIS",
  "TotalITBIS1",
  "TotalITBIS2",
  "TotalITBIS3",
  "MontoImpuestoAdicional",
  "ImpuestosAdicionales",
  "MontoTotal",
  "MontoNoFacturable",
  "MontoPeriodo",
  "SaldoAnterior",
  "MontoAvancePago",
  "ValorPagar",
  "TotalITBISRetenido",
  "TotalISRRetencion",
  "TotalITBISPercepcion",
  "TotalISRPercepcion",
] as const;

const ORDEN_TOTALES_XML: Record<TipoEcf, readonly string[]> = {
  "31": ORDEN_TOTALES_BASE_XML,
  "32": ORDEN_TOTALES_BASE_XML.slice(0, 20),
  "33": ORDEN_TOTALES_BASE_XML,
  "34": ORDEN_TOTALES_BASE_XML,
  "41": [
    "MontoGravadoTotal",
    "MontoGravadoI1",
    "MontoGravadoI2",
    "MontoGravadoI3",
    "MontoExento",
    "ITBIS1",
    "ITBIS2",
    "ITBIS3",
    "TotalITBIS",
    "TotalITBIS1",
    "TotalITBIS2",
    "TotalITBIS3",
    "MontoTotal",
    "MontoPeriodo",
    "SaldoAnterior",
    "MontoAvancePago",
    "ValorPagar",
    "TotalITBISRetenido",
    "TotalISRRetencion",
    "TotalITBISPercepcion",
    "TotalISRPercepcion",
  ],
  "43": ["MontoExento", "MontoTotal", "MontoPeriodo", "SaldoAnterior", "MontoAvancePago", "ValorPagar"],
  "44": [
    "MontoExento",
    "MontoImpuestoAdicional",
    "ImpuestosAdicionales",
    "MontoTotal",
    "MontoNoFacturable",
    "MontoPeriodo",
    "SaldoAnterior",
    "MontoAvancePago",
    "ValorPagar",
  ],
  "45": ORDEN_TOTALES_BASE_XML.slice(0, 20),
  "46": [
    "MontoGravadoTotal",
    "MontoGravadoI3",
    "ITBIS3",
    "TotalITBIS",
    "TotalITBIS3",
    "MontoTotal",
    "MontoNoFacturable",
    "MontoPeriodo",
    "SaldoAnterior",
    "MontoAvancePago",
    "ValorPagar",
  ],
  "47": [
    "MontoExento",
    "MontoTotal",
    "MontoPeriodo",
    "SaldoAnterior",
    "MontoAvancePago",
    "ValorPagar",
    "TotalISRRetencion",
  ],
};

function valorNumericoOpcional(valor: number | undefined, emitir = true): string | undefined {
  return emitir && valor !== undefined ? formatearMontoDgii(valor) : undefined;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: la matriz fiscal XSD E31-E47 exige ramificar obligatoriedad y orden por tipo de comprobante
function xmlTotalesEcf(doc: DocumentoEcfInput): string {
  const totales = doc.totales;
  const tipo = doc.comprobante.tipo;
  const condiciones = condicionesTotalesXml(totales);
  const tipoExentoTotal = tipo === "43" || tipo === "44" || tipo === "47";
  const debeEmitirExento = totales.montoExento > 0 || (tipoExentoTotal && totales.montoTotal > 0);
  const valores: Record<string, string | undefined> = {
    MontoGravadoTotal: valorNumericoOpcional(condiciones.gravadoTotal, condiciones.gravadoTotal > 0),
    MontoGravadoI1: valorNumericoOpcional(totales.montoGravadoI1, totales.montoGravadoI1 > 0),
    MontoGravadoI2: valorNumericoOpcional(totales.montoGravadoI2, totales.montoGravadoI2 > 0),
    MontoGravadoI3: valorNumericoOpcional(condiciones.gravadoI3, condiciones.gravadoI3 > 0),
    MontoExento: valorNumericoOpcional(totales.montoExento, debeEmitirExento),
    ITBIS1: condiciones.correspondeItbis1 ? "18" : undefined,
    ITBIS2: condiciones.correspondeItbis2 ? "16" : undefined,
    ITBIS3: condiciones.correspondeTasaItbis3 ? "0" : undefined,
    TotalITBIS: valorNumericoOpcional(totales.totalItbis, condiciones.correspondeTotalItbis),
    TotalITBIS1: valorNumericoOpcional(totales.totalItbis1, condiciones.correspondeItbis1),
    TotalITBIS2: valorNumericoOpcional(totales.totalItbis2, condiciones.correspondeItbis2),
    TotalITBIS3: valorNumericoOpcional(totales.totalItbis3 ?? 0, condiciones.correspondeTotalItbis3),
    MontoImpuestoAdicional: valorNumericoOpcional(totales.montoImpuestoAdicional),
    MontoTotal: formatearMontoDgii(totales.montoTotal),
    MontoNoFacturable: valorNumericoOpcional(totales.montoNoFacturable),
    MontoPeriodo: valorNumericoOpcional(totales.montoPeriodo),
    SaldoAnterior: valorNumericoOpcional(totales.saldoAnterior),
    MontoAvancePago: valorNumericoOpcional(totales.montoAvancePago),
    ValorPagar: valorNumericoOpcional(totales.valorPagar),
    TotalITBISRetenido: valorNumericoOpcional(totales.totalItbisRetenido),
    TotalISRRetencion: valorNumericoOpcional(totales.totalIsrRetencion),
    TotalITBISPercepcion: valorNumericoOpcional(totales.totalItbisPercepcion),
    TotalISRPercepcion: valorNumericoOpcional(totales.totalIsrPercepcion),
  };
  const partes: string[] = [];
  for (const nombre of ORDEN_TOTALES_XML[tipo]) {
    if (nombre === "ImpuestosAdicionales") {
      if (tipoPermiteImpuestosAdicionales(tipo))
        partes.push(xmlImpuestosAdicionales(totales.impuestosAdicionales, { tipo }));
      continue;
    }
    const valor = valores[nombre];
    if (valor !== undefined && valor !== "") partes.push(tag(nombre, valor));
  }
  return partes.join("");
}

function xmlSubAjustes(nombreTabla: string, nombreItem: string, ajustes: SubAjusteEcfInput[] | undefined): string {
  if (!ajustes || ajustes.length === 0) return "";
  const esDescuento = nombreItem === "SubDescuento";
  const detalle = ajustes
    .map(
      (ajuste) =>
        `<${nombreItem}>${[
          tag(esDescuento ? "TipoSubDescuento" : "TipoSubRecargo", ajuste.tipo),
          tagOpcional(
            esDescuento ? "SubDescuentoPorcentaje" : "SubRecargoPorcentaje",
            ajuste.porcentaje === undefined ? undefined : formatearDecimalHasta2Dgii(ajuste.porcentaje),
          ),
          tagOpcional(
            esDescuento ? "MontoSubDescuento" : "MontoSubRecargo",
            ajuste.monto === undefined ? undefined : formatearMontoDgii(ajuste.monto),
          ),
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
    tipo !== "47"
      ? tagOpcional(
          "MontoITBISRetenido",
          retencion.montoItbisRetenido === undefined ? undefined : formatearMontoDgii(retencion.montoItbisRetenido),
        )
      : "",
    tagOpcional(
      "MontoISRRetenido",
      retencion.montoIsrRetenido === undefined && tipo !== "47"
        ? undefined
        : formatearMontoDgii(retencion.montoIsrRetenido ?? 0),
    ),
  ].join("")}</Retencion>`;
}

function xmlCodigosItem(linea: LineaEcfInput): string {
  if (!linea.codigosItem?.length) return "";
  const detalle = linea.codigosItem
    .slice(0, 5)
    .map(
      (codigo) =>
        `<CodigosItem>${tag("TipoCodigo", codigo.tipoCodigo)}${tag("CodigoItem", codigo.codigoItem)}</CodigosItem>`,
    )
    .join("");
  return `<TablaCodigosItem>${detalle}</TablaCodigosItem>`;
}

function xmlSubcantidades(linea: LineaEcfInput, tipo: TipoEcf): string {
  if (!tipoPermiteReferenciaDeCantidad(tipo) || !linea.subcantidades?.length) return "";
  const detalle = linea.subcantidades
    .slice(0, 5)
    .map(
      (subcantidad) =>
        `<SubcantidadItem>${[
          tagOpcional(
            "Subcantidad",
            subcantidad.subcantidad === undefined ? undefined : formatearDecimalHasta3Dgii(subcantidad.subcantidad),
          ),
          tagOpcional("CodigoSubcantidad", subcantidad.codigoSubcantidad),
        ].join("")}</SubcantidadItem>`,
    )
    .join("");
  return `<TablaSubcantidad>${detalle}</TablaSubcantidad>`;
}

function xmlImpuestosAdicionalesLinea(linea: LineaEcfInput, tipo: TipoEcf): string {
  if (!tipoPermiteImpuestosAdicionales(tipo) || !linea.impuestosAdicionales?.length) return "";
  const detalle = linea.impuestosAdicionales
    .slice(0, 2)
    .map((impuesto) => `<ImpuestoAdicional>${tag("TipoImpuesto", impuesto.tipoImpuesto)}</ImpuestoAdicional>`)
    .join("");
  return `<TablaImpuestoAdicional>${detalle}</TablaImpuestoAdicional>`;
}

function xmlOtraMonedaDetalle(linea: LineaEcfInput): string {
  const otra = linea.otraMoneda;
  if (!otra) return "";
  const partes = [
    tagOpcional(
      "PrecioOtraMoneda",
      otra.precioOtraMoneda === undefined ? undefined : formatearPrecioDgii(otra.precioOtraMoneda),
    ),
    tagOpcional(
      "DescuentoOtraMoneda",
      otra.descuentoOtraMoneda === undefined ? undefined : formatearMontoDgii(otra.descuentoOtraMoneda),
    ),
    tagOpcional(
      "RecargoOtraMoneda",
      otra.recargoOtraMoneda === undefined ? undefined : formatearMontoDgii(otra.recargoOtraMoneda),
    ),
    tagOpcional(
      "MontoItemOtraMoneda",
      otra.montoItemOtraMoneda === undefined ? undefined : formatearMontoDgii(otra.montoItemOtraMoneda),
    ),
  ].join("");
  return partes ? `<OtraMonedaDetalle>${partes}</OtraMonedaDetalle>` : "";
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: la matriz fiscal XSD E31-E47 exige ramificar obligatoriedad y orden por tipo de comprobante
function xmlItem(linea: LineaEcfInput, tipo: TipoEcf): string {
  const descuento = descuentoLinea(linea);
  const recargo = recargoLinea(linea);
  const permiteDescuentos = tipoPermiteDescuentos(tipo);
  const permiteReferencia = tipoPermiteReferenciaDeCantidad(tipo);
  return `<Item>${[
    tag("NumeroLinea", linea.numeroLinea),
    xmlCodigosItem(linea),
    tag("IndicadorFacturacion", linea.indicadorFacturacion),
    xmlRetencionLinea(linea, tipo),
    tag("NombreItem", linea.nombreItem),
    tag("IndicadorBienoServicio", linea.indicadorBienoServicio ?? "1"),
    tagOpcional("DescripcionItem", linea.descripcionItem),
    tag("CantidadItem", formatearMontoDgii(linea.cantidad)),
    tagOpcional("UnidadMedida", linea.unidadMedida),
    permiteReferencia && linea.cantidadReferencia !== undefined
      ? tag("CantidadReferencia", formatearMontoDgii(linea.cantidadReferencia))
      : "",
    permiteReferencia ? tagOpcional("UnidadReferencia", linea.unidadReferencia) : "",
    xmlSubcantidades(linea, tipo),
    permiteReferencia && linea.gradosAlcohol !== undefined
      ? tag("GradosAlcohol", formatearDecimalHasta2Dgii(linea.gradosAlcohol))
      : "",
    permiteReferencia && linea.precioUnitarioReferencia !== undefined
      ? tag("PrecioUnitarioReferencia", formatearMontoDgii(linea.precioUnitarioReferencia))
      : "",
    tagOpcional("FechaElaboracion", linea.fechaElaboracion ? formatearFechaDgii(linea.fechaElaboracion) : undefined),
    tagOpcional(
      "FechaVencimientoItem",
      linea.fechaVencimientoItem ? formatearFechaDgii(linea.fechaVencimientoItem) : undefined,
    ),
    tag("PrecioUnitarioItem", formatearPrecioDgii(linea.precioUnitario)),
    permiteDescuentos && descuento > 0 ? tag("DescuentoMonto", formatearMontoDgii(descuento)) : "",
    permiteDescuentos ? xmlSubAjustes("TablaSubDescuento", "SubDescuento", linea.subDescuentos) : "",
    permiteDescuentos && recargo > 0 ? tag("RecargoMonto", formatearMontoDgii(recargo)) : "",
    permiteDescuentos ? xmlSubAjustes("TablaSubRecargo", "SubRecargo", linea.subRecargos) : "",
    xmlImpuestosAdicionalesLinea(linea, tipo),
    xmlOtraMonedaDetalle(linea),
    tag("MontoItem", formatearMontoDgii(linea.montoItem)),
  ].join("")}</Item>`;
}

const ORDEN_OTRA_MONEDA_XML: Record<TipoEcf, readonly string[]> = {
  "31": [
    "TipoMoneda",
    "TipoCambio",
    "MontoGravadoTotalOtraMoneda",
    "MontoGravado1OtraMoneda",
    "MontoGravado2OtraMoneda",
    "MontoGravado3OtraMoneda",
    "MontoExentoOtraMoneda",
    "TotalITBISOtraMoneda",
    "TotalITBIS1OtraMoneda",
    "TotalITBIS2OtraMoneda",
    "TotalITBIS3OtraMoneda",
    "MontoImpuestoAdicionalOtraMoneda",
    "ImpuestosAdicionalesOtraMoneda",
    "MontoTotalOtraMoneda",
  ],
  "32": [],
  "33": [],
  "34": [],
  "41": [
    "TipoMoneda",
    "TipoCambio",
    "MontoGravadoTotalOtraMoneda",
    "MontoGravado1OtraMoneda",
    "MontoGravado2OtraMoneda",
    "MontoGravado3OtraMoneda",
    "MontoExentoOtraMoneda",
    "TotalITBISOtraMoneda",
    "TotalITBIS1OtraMoneda",
    "TotalITBIS2OtraMoneda",
    "TotalITBIS3OtraMoneda",
    "MontoTotalOtraMoneda",
  ],
  "43": ["TipoMoneda", "TipoCambio", "MontoExentoOtraMoneda", "MontoTotalOtraMoneda"],
  "44": [
    "TipoMoneda",
    "TipoCambio",
    "MontoExentoOtraMoneda",
    "MontoImpuestoAdicionalOtraMoneda",
    "ImpuestosAdicionalesOtraMoneda",
    "MontoTotalOtraMoneda",
  ],
  "45": [],
  "46": [
    "TipoMoneda",
    "TipoCambio",
    "MontoGravadoTotalOtraMoneda",
    "MontoGravado3OtraMoneda",
    "TotalITBISOtraMoneda",
    "TotalITBIS3OtraMoneda",
    "MontoTotalOtraMoneda",
  ],
  "47": ["TipoMoneda", "TipoCambio", "MontoExentoOtraMoneda", "MontoTotalOtraMoneda"],
};
ORDEN_OTRA_MONEDA_XML["32"] = ORDEN_OTRA_MONEDA_XML["31"];
ORDEN_OTRA_MONEDA_XML["33"] = ORDEN_OTRA_MONEDA_XML["31"];
ORDEN_OTRA_MONEDA_XML["34"] = ORDEN_OTRA_MONEDA_XML["31"];
ORDEN_OTRA_MONEDA_XML["45"] = ORDEN_OTRA_MONEDA_XML["31"];

function xmlOtraMoneda(doc: DocumentoEcfInput): string {
  const otra = doc.otraMoneda;
  if (!otra) return "";
  const tipo = doc.comprobante.tipo;
  const valores: Record<string, string | undefined> = {
    TipoMoneda: otra.tipoMoneda,
    TipoCambio: formatearPrecioDgii(otra.tipoCambio),
    MontoGravadoTotalOtraMoneda: valorNumericoOpcional(otra.montoGravadoTotalOtraMoneda),
    MontoGravado1OtraMoneda: valorNumericoOpcional(otra.montoGravado1OtraMoneda),
    MontoGravado2OtraMoneda: valorNumericoOpcional(otra.montoGravado2OtraMoneda),
    MontoGravado3OtraMoneda: valorNumericoOpcional(otra.montoGravado3OtraMoneda),
    MontoExentoOtraMoneda: valorNumericoOpcional(otra.montoExentoOtraMoneda),
    TotalITBISOtraMoneda: valorNumericoOpcional(otra.totalItbisOtraMoneda),
    TotalITBIS1OtraMoneda: valorNumericoOpcional(otra.totalItbis1OtraMoneda),
    TotalITBIS2OtraMoneda: valorNumericoOpcional(otra.totalItbis2OtraMoneda),
    TotalITBIS3OtraMoneda: valorNumericoOpcional(otra.totalItbis3OtraMoneda),
    MontoImpuestoAdicionalOtraMoneda: valorNumericoOpcional(otra.montoImpuestoAdicionalOtraMoneda),
    MontoTotalOtraMoneda: formatearMontoDgii(otra.montoTotalOtraMoneda),
  };
  const partes: string[] = [];
  for (const nombre of ORDEN_OTRA_MONEDA_XML[tipo]) {
    if (nombre === "ImpuestosAdicionalesOtraMoneda") {
      partes.push(xmlImpuestosAdicionales(otra.impuestosAdicionalesOtraMoneda, { otraMoneda: true, tipo }));
      continue;
    }
    const valor = valores[nombre];
    if (valor !== undefined && valor !== "") partes.push(tag(nombre, valor));
  }
  return `<OtraMoneda>${partes.join("")}</OtraMoneda>`;
}

function xmlDescuentosORecargos(doc: DocumentoEcfInput): string {
  if (!tipoPermiteDescuentos(doc.comprobante.tipo) || !doc.descuentosORecargos?.length) return "";
  const detalle = doc.descuentosORecargos
    .map(
      (ajuste) =>
        `<DescuentoORecargo>${[
          tag("NumeroLinea", ajuste.numeroLinea),
          tag("TipoAjuste", ajuste.tipoAjuste),
          tagOpcional("IndicadorNorma1007", ajuste.indicadorNorma1007),
          tagOpcional("DescripcionDescuentooRecargo", ajuste.descripcion),
          tagOpcional("TipoValor", ajuste.tipoValor),
          tagOpcional(
            "ValorDescuentooRecargo",
            ajuste.valor === undefined ? undefined : formatearDecimalHasta2Dgii(ajuste.valor),
          ),
          tag("MontoDescuentooRecargo", formatearMontoDgii(ajuste.monto)),
          tagOpcional(
            "MontoDescuentooRecargoOtraMoneda",
            ajuste.montoOtraMoneda === undefined ? undefined : formatearMontoDgii(ajuste.montoOtraMoneda),
          ),
          tagOpcional("IndicadorFacturacionDescuentooRecargo", ajuste.indicadorFacturacion),
        ].join("")}</DescuentoORecargo>`,
    )
    .join("");
  return `<DescuentosORecargos>${detalle}</DescuentosORecargos>`;
}

function xmlFormasPago(
  formasPago: DocumentoEcfInput["comprobante"]["formasPago"],
  opciones: { exigirMontoPago?: boolean } = {},
): string {
  const formas = (formasPago ?? []).filter((forma) => forma.formaPago.trim() !== "").slice(0, 7);
  if (formas.length === 0) return "";
  const detalle = formas
    .map((forma) => {
      if (opciones.exigirMontoPago && forma.montoPago === undefined) {
        throw new Error("Cada forma de pago de un e-CF debe incluir MontoPago");
      }
      return `<FormaDePago>${tag("FormaPago", forma.formaPago)}${tagOpcional(
        "MontoPago",
        forma.montoPago === undefined ? undefined : formatearMontoDgii(forma.montoPago),
      )}</FormaDePago>`;
    })
    .join("");
  return `<TablaFormasPago>${detalle}</TablaFormasPago>`;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: la matriz fiscal XSD E31-E47 exige ramificar obligatoriedad y orden por tipo de comprobante
function xmlIdDoc(doc: DocumentoEcfInput): string {
  const comp = doc.comprobante;
  const tipo = comp.tipo;
  const partes = [tag("TipoeCF", tipo), tag("eNCF", comp.encf)];
  if (tipo !== "32" && tipo !== "34" && comp.fechaVencimientoSecuencia) {
    partes.push(tag("FechaVencimientoSecuencia", formatearFechaDgii(comp.fechaVencimientoSecuencia)));
  }
  if (tipo === "34") partes.push(tag("IndicadorNotaCredito", comp.indicadorNotaCredito ?? "0"));
  if (tipo !== "41" && tipo !== "43" && tipo !== "47") {
    partes.push(tagOpcional("IndicadorEnvioDiferido", comp.indicadorEnvioDiferido));
  }
  if (tipo !== "44" && tipo !== "41" && tipo !== "43" && tipo !== "46" && tipo !== "47") {
    partes.push(tagOpcional("IndicadorMontoGravado", comp.indicadorMontoGravado));
  }
  if (tipo !== "41" && tipo !== "43" && tipo !== "46" && tipo !== "47") {
    partes.push(tagOpcional("IndicadorServicioTodoIncluido", comp.indicadorServicioTodoIncluido));
  }
  if (tipo !== "41" && tipo !== "43" && tipo !== "47") {
    partes.push(tagOpcional("TipoIngresos", comp.tipoIngresos));
  }
  partes.push(tagOpcional("TipoPago", comp.tipoPago));
  partes.push(
    tagOpcional("FechaLimitePago", comp.fechaLimitePago ? formatearFechaDgii(comp.fechaLimitePago) : undefined),
  );
  if (tipo !== "34" && tipo !== "43") {
    partes.push(
      tagOpcional("TerminoPago", comp.terminoPago),
      xmlFormasPago(comp.formasPago, { exigirMontoPago: true }),
    );
  }
  if (tipo !== "34" && tipo !== "43") {
    partes.push(
      tagOpcional("TipoCuentaPago", comp.tipoCuentaPago),
      tagOpcional("NumeroCuentaPago", comp.numeroCuentaPago),
      tagOpcional("BancoPago", comp.bancoPago),
    );
  }
  if (tipo !== "41" && tipo !== "43") {
    partes.push(
      tagOpcional("FechaDesde", comp.fechaDesde ? formatearFechaDgii(comp.fechaDesde) : undefined),
      tagOpcional("FechaHasta", comp.fechaHasta ? formatearFechaDgii(comp.fechaHasta) : undefined),
    );
  }
  partes.push(tagOpcional("TotalPaginas", comp.totalPaginas));
  return `<IdDoc>${partes.join("")}</IdDoc>`;
}

function xmlTablaTelefonosEmisor(telefonos: string[] | undefined): string {
  const validos = (telefonos ?? []).map((telefono) => telefono.trim()).filter((telefono) => telefono !== "");
  if (validos.length === 0) return "";
  return `<TablaTelefonoEmisor>${validos
    .slice(0, 3)
    .map((telefono) => tag("TelefonoEmisor", telefono))
    .join("")}</TablaTelefonoEmisor>`;
}

function xmlEmisor(doc: DocumentoEcfInput): string {
  const tipo = doc.comprobante.tipo;
  const permiteVenta = tipo !== "41" && tipo !== "43" && tipo !== "47";
  return `<Emisor>${[
    tag("RNCEmisor", doc.emisor.rnc),
    tag("RazonSocialEmisor", doc.emisor.razonSocial),
    tagOpcional("NombreComercial", doc.emisor.nombreComercial),
    tagOpcional("Sucursal", doc.emisor.sucursal),
    tag("DireccionEmisor", doc.emisor.direccion),
    tagOpcional("Municipio", doc.emisor.municipio),
    tagOpcional("Provincia", doc.emisor.provincia),
    xmlTablaTelefonosEmisor(doc.emisor.telefonos),
    tagOpcional("CorreoEmisor", doc.emisor.correo),
    tagOpcional("WebSite", doc.emisor.webSite),
    tagOpcional("ActividadEconomica", doc.emisor.actividadEconomica),
    permiteVenta ? tagOpcional("CodigoVendedor", doc.emisor.codigoVendedor) : "",
    tagOpcional("NumeroFacturaInterna", doc.emisor.numeroFacturaInterna),
    tagOpcional("NumeroPedidoInterno", doc.emisor.numeroPedidoInterno),
    permiteVenta ? tagOpcional("ZonaVenta", doc.emisor.zonaVenta) : "",
    permiteVenta ? tagOpcional("RutaVenta", doc.emisor.rutaVenta) : "",
    tagOpcional("InformacionAdicionalEmisor", doc.emisor.informacionAdicionalEmisor),
    tag("FechaEmision", formatearFechaDgii(doc.comprobante.fechaEmision)),
  ].join("")}</Emisor>`;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: la matriz fiscal XSD E31-E47 exige ramificar obligatoriedad y orden por tipo de comprobante
function xmlComprador(doc: DocumentoEcfInput): string {
  const tipo = doc.comprobante.tipo;
  if (tipo === "43") return "";
  const comprador = doc.comprador;
  if (tipo === "47") {
    return `<Comprador>${[
      tagOpcional("IdentificadorExtranjero", comprador.identificadorExtranjero),
      tagOpcional("RazonSocialComprador", comprador.razonSocial),
    ].join("")}</Comprador>`;
  }
  const admiteExtranjero = tipo === "32" || tipo === "33" || tipo === "34" || tipo === "44" || tipo === "46";
  const admiteEntrega = tipo !== "41";
  return `<Comprador>${[
    tagOpcional("RNCComprador", comprador.rnc),
    admiteExtranjero ? tagOpcional("IdentificadorExtranjero", comprador.identificadorExtranjero) : "",
    tagOpcional("RazonSocialComprador", comprador.razonSocial),
    tagOpcional("ContactoComprador", comprador.contactoComprador),
    tagOpcional("CorreoComprador", comprador.correo),
    tagOpcional("DireccionComprador", comprador.direccionComprador),
    tagOpcional("MunicipioComprador", comprador.municipioComprador),
    tagOpcional("ProvinciaComprador", comprador.provinciaComprador),
    tipo === "46" ? tagOpcional("PaisComprador", comprador.paisComprador) : "",
    admiteEntrega
      ? tagOpcional("FechaEntrega", comprador.fechaEntrega ? formatearFechaDgii(comprador.fechaEntrega) : undefined)
      : "",
    admiteEntrega ? tagOpcional("ContactoEntrega", comprador.contactoEntrega) : "",
    admiteEntrega ? tagOpcional("DireccionEntrega", comprador.direccionEntrega) : "",
    admiteEntrega ? tagOpcional("TelefonoAdicional", comprador.telefonoAdicional) : "",
    admiteEntrega
      ? tagOpcional(
          "FechaOrdenCompra",
          comprador.fechaOrdenCompra ? formatearFechaDgii(comprador.fechaOrdenCompra) : undefined,
        )
      : "",
    admiteEntrega ? tagOpcional("NumeroOrdenCompra", comprador.numeroOrdenCompra) : "",
    tagOpcional("CodigoInternoComprador", comprador.codigoInternoComprador),
    tagOpcional("ResponsablePago", comprador.responsablePago),
    tagOpcional("InformacionAdicionalComprador", comprador.informacionAdicionalComprador),
  ].join("")}</Comprador>`;
}

function tieneValores(objeto: object | undefined): boolean {
  return Object.values(objeto ?? {}).some((valor) => {
    if (Array.isArray(valor)) return valor.length > 0;
    return valor !== undefined && valor !== "";
  });
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: la matriz fiscal XSD E31-E47 exige ramificar obligatoriedad y orden por tipo de comprobante
function xmlInformacionesAdicionales(doc: DocumentoEcfInput): string {
  const tipo = doc.comprobante.tipo;
  const info = doc.informacionesAdicionales;
  const permitido = tipo !== "41" && tipo !== "43" && tipo !== "47";
  if (!permitido || !info || !tieneValores(info)) return "";
  const partes = [
    tagOpcional("FechaEmbarque", info.fechaEmbarque ? formatearFechaDgii(info.fechaEmbarque) : undefined),
    tagOpcional("NumeroEmbarque", info.numeroEmbarque),
    tagOpcional("NumeroContenedor", info.numeroContenedor),
    tagOpcional("NumeroReferencia", info.numeroReferencia),
  ];
  if (tipo === "46") {
    partes.push(
      tagOpcional("NombrePuertoEmbarque", info.nombrePuertoEmbarque),
      tagOpcional("CondicionesEntrega", info.condicionesEntrega),
      tagOpcional("TotalFob", info.totalFob === undefined ? undefined : formatearMontoDgii(info.totalFob)),
      tagOpcional("Seguro", info.seguro === undefined ? undefined : formatearMontoDgii(info.seguro)),
      tagOpcional("Flete", info.flete === undefined ? undefined : formatearMontoDgii(info.flete)),
      tagOpcional("OtrosGastos", info.otrosGastos === undefined ? undefined : formatearMontoDgii(info.otrosGastos)),
      tagOpcional("TotalCif", info.totalCif === undefined ? undefined : formatearMontoDgii(info.totalCif)),
      tagOpcional("RegimenAduanero", info.regimenAduanero),
      tagOpcional("NombrePuertoSalida", info.nombrePuertoSalida),
      tagOpcional("NombrePuertoDesembarque", info.nombrePuertoDesembarque),
    );
  }
  partes.push(
    tagOpcional("PesoBruto", info.pesoBruto === undefined ? undefined : formatearMontoDgii(info.pesoBruto)),
    tagOpcional("PesoNeto", info.pesoNeto === undefined ? undefined : formatearMontoDgii(info.pesoNeto)),
    tagOpcional("UnidadPesoBruto", info.unidadPesoBruto),
    tagOpcional("UnidadPesoNeto", info.unidadPesoNeto),
    tagOpcional("CantidadBulto", info.cantidadBulto === undefined ? undefined : formatearMontoDgii(info.cantidadBulto)),
    tagOpcional("UnidadBulto", info.unidadBulto),
    tagOpcional("VolumenBulto", info.volumenBulto === undefined ? undefined : formatearMontoDgii(info.volumenBulto)),
    tagOpcional("UnidadVolumen", info.unidadVolumen),
  );
  return `<InformacionesAdicionales>${partes.join("")}</InformacionesAdicionales>`;
}

function xmlTransporte(doc: DocumentoEcfInput): string {
  const tipo = doc.comprobante.tipo;
  const transporte = doc.transporte;
  const permitido = tipo !== "41" && tipo !== "43";
  if (!permitido || !transporte || !tieneValores(transporte)) return "";
  if (tipo === "47") {
    const pais = tagOpcional("PaisDestino", transporte.paisDestino);
    return pais ? `<Transporte>${pais}</Transporte>` : "";
  }
  const partes: string[] = [];
  if (tipo === "46") {
    partes.push(
      tagOpcional("ViaTransporte", transporte.viaTransporte),
      tagOpcional("PaisOrigen", transporte.paisOrigen),
      tagOpcional("DireccionDestino", transporte.direccionDestino),
      tagOpcional("PaisDestino", transporte.paisDestino),
      tagOpcional("RNCIdentificacionCompaniaTransportista", transporte.rncIdentificacionCompaniaTransportista),
      tagOpcional("NombreCompaniaTransportista", transporte.nombreCompaniaTransportista),
      tagOpcional("NumeroViaje", transporte.numeroViaje),
    );
  }
  partes.push(
    tagOpcional("Conductor", transporte.conductor),
    tagOpcional("DocumentoTransporte", transporte.documentoTransporte),
    tagOpcional("Ficha", transporte.ficha),
    tagOpcional("Placa", transporte.placa),
    tagOpcional("RutaTransporte", transporte.rutaTransporte),
    tagOpcional("ZonaTransporte", transporte.zonaTransporte),
    tagOpcional("NumeroAlbaran", transporte.numeroAlbaran),
  );
  const contenido = partes.join("");
  return contenido ? `<Transporte>${contenido}</Transporte>` : "";
}

function xmlInformacionReferencia(doc: DocumentoEcfInput): string {
  const comp = doc.comprobante;
  if (!comp.ncfModificado && !comp.rncOtroContribuyente && !comp.fechaNcfModificado && !comp.codigoModificacion)
    return "";
  return `<InformacionReferencia>${[
    tagOpcional("NCFModificado", comp.ncfModificado),
    tagOpcional("RNCOtroContribuyente", comp.rncOtroContribuyente),
    tagOpcional(
      "FechaNCFModificado",
      comp.fechaNcfModificado ? formatearFechaDgii(comp.fechaNcfModificado) : undefined,
    ),
    tagOpcional("CodigoModificacion", comp.codigoModificacion),
    comp.tipo === "33" || comp.tipo === "34" ? tagOpcional("RazonModificacion", comp.razonModificacion) : "",
  ].join("")}</InformacionReferencia>`;
}

export function generarXmlEcf(doc: DocumentoEcfInput): string {
  asegurarDocumentoValido(doc);
  const comp = doc.comprobante;
  const xml = `<ECF><Encabezado>${[
    tag("Version", "1.0"),
    xmlIdDoc(doc),
    xmlEmisor(doc),
    xmlComprador(doc),
    xmlInformacionesAdicionales(doc),
    xmlTransporte(doc),
    `<Totales>${xmlTotalesEcf(doc)}</Totales>`,
    xmlOtraMoneda(doc),
  ].join("")}</Encabezado><DetallesItems>${doc.lineas
    .map((linea) => xmlItem(linea, comp.tipo))
    .join("")}</DetallesItems>${xmlDescuentosORecargos(doc)}${xmlInformacionReferencia(doc)}${tag(
    "FechaHoraFirma",
    formatearFechaHoraDgii(comp.fechaHoraFirma),
  )}</ECF>`;

  return `${declaracionXml()}${xml}`;
}

export function esElegibleRfce(doc: DocumentoEcfInput): boolean {
  return doc.comprobante.tipo === "32" && doc.totales.montoTotal < LIMITE_RFCE;
}

const ORDEN_TOTALES_RFCE_XML = [
  "MontoGravadoTotal",
  "MontoGravadoI1",
  "MontoGravadoI2",
  "MontoGravadoI3",
  "MontoExento",
  "TotalITBIS",
  "TotalITBIS1",
  "TotalITBIS2",
  "TotalITBIS3",
  "MontoImpuestoAdicional",
  "ImpuestosAdicionales",
  "MontoTotal",
  "MontoNoFacturable",
  "MontoPeriodo",
] as const;

function xmlTotalesRfce(doc: DocumentoEcfInput): string {
  const totales = doc.totales;
  const condiciones = condicionesTotalesXml(totales);
  const valores: Record<string, string | undefined> = {
    MontoGravadoTotal: valorNumericoOpcional(condiciones.gravadoTotal, condiciones.gravadoTotal > 0),
    MontoGravadoI1: valorNumericoOpcional(totales.montoGravadoI1, totales.montoGravadoI1 > 0),
    MontoGravadoI2: valorNumericoOpcional(totales.montoGravadoI2, totales.montoGravadoI2 > 0),
    MontoGravadoI3: valorNumericoOpcional(condiciones.gravadoI3, condiciones.gravadoI3 > 0),
    MontoExento: valorNumericoOpcional(totales.montoExento, totales.montoExento > 0),
    TotalITBIS: valorNumericoOpcional(totales.totalItbis, condiciones.correspondeTotalItbis),
    TotalITBIS1: valorNumericoOpcional(totales.totalItbis1, condiciones.correspondeItbis1),
    TotalITBIS2: valorNumericoOpcional(totales.totalItbis2, condiciones.correspondeItbis2),
    TotalITBIS3: valorNumericoOpcional(totales.totalItbis3 ?? 0, condiciones.correspondeTotalItbis3),
    MontoImpuestoAdicional: valorNumericoOpcional(totales.montoImpuestoAdicional),
    MontoTotal: formatearMontoDgii(totales.montoTotal),
    MontoNoFacturable: valorNumericoOpcional(totales.montoNoFacturable),
    MontoPeriodo: valorNumericoOpcional(totales.montoPeriodo),
  };
  return ORDEN_TOTALES_RFCE_XML.map((nombre) => {
    if (nombre === "ImpuestosAdicionales") return xmlImpuestosAdicionales(totales.impuestosAdicionales, { rfce: true });
    const valor = valores[nombre];
    return valor === undefined || valor === "" ? "" : tag(nombre, valor);
  }).join("");
}

export function generarXmlRfce(doc: DocumentoEcfInput, codigoSeguridadEcf: string): string {
  asegurarDocumentoValido(doc);
  if (!esElegibleRfce(doc))
    throw new Error("Solo las facturas de consumo E32 menores de RD$250,000 pueden generar RFCE");
  if (!/^.{6}$/.test(codigoSeguridadEcf)) throw new Error("El código de seguridad del e-CF debe tener 6 caracteres");
  const comp = doc.comprobante;
  if (!comp.tipoPago) throw new Error("El RFCE requiere el tipo de pago de la factura de consumo");
  const tipoPagoRfce: string = comp.tipoPago;
  const xml = `<RFCE><Encabezado>${tag("Version", "1.0")}<IdDoc>${[
    tag("TipoeCF", comp.tipo),
    tag("eNCF", comp.encf),
    tag("TipoIngresos", comp.tipoIngresos),
    tag("TipoPago", tipoPagoRfce),
    xmlFormasPago(comp.formasPago),
  ].join("")}</IdDoc><Emisor>${[
    tag("RNCEmisor", doc.emisor.rnc),
    tag("RazonSocialEmisor", doc.emisor.razonSocial),
    tag("FechaEmision", formatearFechaDgii(comp.fechaEmision)),
  ].join("")}</Emisor><Comprador>${[
    tagOpcional("RNCComprador", doc.comprador.rnc),
    tagOpcional("IdentificadorExtranjero", doc.comprador.identificadorExtranjero),
    tagOpcional("RazonSocialComprador", doc.comprador.razonSocial),
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
  if (input.anulaciones.length > 10) throw new Error("La anulación admite máximo 10 líneas según el XSD ANECF");
  let total = 0;
  const detalle = input.anulaciones
    .map((anulacion, indice) => {
      if (anulacion.rangos.length === 0) throw new Error(`La anulación ${indice + 1} no tiene rangos`);
      if (anulacion.rangos.length > 10000) {
        throw new Error(`La anulación ${indice + 1} admite máximo 10,000 rangos según el XSD ANECF`);
      }
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

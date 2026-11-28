import type {
  CompradorEcfInput,
  DocumentoEcfInput,
  EmisorEcfInput,
  IndicadorFacturacionEcf,
  ItbisTasaEcf,
  LineaEcfInput,
  SubAjusteEcfInput,
  TipoEcf,
  TotalesEcfInput,
} from "./tipos";
import { validarXmlContraEsquemaDgii } from "./validador-xsd";
import { esElegibleRfce, generarXmlEcf, generarXmlRfce, validarDocumentoEcf } from "./xml";

export const SECUENCIA_BASE_SIMULACION_DEFECTO = 1001;
export const SECUENCIA_BASE_SIMULACION_MIN = 100;
export const SECUENCIA_BASE_SIMULACION_MAX = 9_999_900;

export type FaseOrdenPaso4 = 1 | 2 | 3;
export type CategoriaSimulacionPaso4 =
  | "31"
  | "32_mayor_250k"
  | "32_rfce"
  | "33"
  | "34"
  | "41"
  | "43"
  | "44"
  | "45"
  | "46"
  | "47";

export const CONTEO_OFICIAL_PASO4 = {
  "31": 4,
  "32_mayor_250k": 2,
  "33": 1,
  "34": 2,
  "41": 2,
  "43": 2,
  "44": 2,
  "45": 2,
  "46": 2,
  "47": 2,
  "32_rfce": 4,
} as const satisfies Record<CategoriaSimulacionPaso4, number>;

export interface OpcionesSimulacionPaso4 {
  rncEmisor: string;
  razonSocial: string;
  direccionEmisor?: string;
  telefonoEmisor?: string;
  correoEmisor?: string;
  secuenciaBase?: number;
  fechaEmision?: string;
  fechaVencimientoSecuencia?: string;
  fechaHoraFirma?: string;
  rncCompradorGeneral?: string;
  razonSocialCompradorGeneral?: string;
  rncProveedorE41?: string;
  razonSocialProveedorE41?: string;
}

export interface CasoSimulacionPaso4 {
  numeroCaso: number;
  faseOrden: FaseOrdenPaso4;
  categoria: CategoriaSimulacionPaso4;
  descripcion: string;
  esRfce: boolean;
  documento: DocumentoEcfInput;
}

export interface ResultadoValidacionPaso4Local {
  numeroCaso: number;
  faseOrden: FaseOrdenPaso4;
  categoria: CategoriaSimulacionPaso4;
  descripcion: string;
  encf: string;
  tipo: TipoEcf;
  montoTotal: number;
  esRfce: boolean;
  valido: boolean;
  errores: string[];
}

export interface ResultadoSetValidacionPaso4Local {
  valido: boolean;
  totalCasos: number;
  validos: number;
  invalidos: number;
  erroresGlobales: string[];
  casos: ResultadoValidacionPaso4Local[];
}

const LIMITE_RFCE_CENTAVOS = 25_000_000;
const DIRECCION_OXYMAT_DEFECTO = "AVENIDA JACOBO MAJLUTA, No. 101, APTO. 7, DORADO III";
const MUNICIPIO_OXYMAT_DEFECTO = "010100";
const PROVINCIA_OXYMAT_DEFECTO = "010000";
const TELEFONO_OXYMAT_DEFECTO = "829-741-7125";
const CORREO_OXYMAT_DEFECTO = "jardialcantaraspc@gmail.com";
const FECHA_VENCIMIENTO_DEFECTO = "31-12-2028";
const RNC_COMPRADOR_DEFECTO = "131880681";
const RAZON_COMPRADOR_DEFECTO = "DOCUMENTOS ELECTRONICOS DE 03";
const RNC_PROVEEDOR_E41_DEFECTO = "533445861";
const RAZON_PROVEEDOR_E41_DEFECTO = "DOCUMENTOS ELECTRONICOS DE 11";
const CODIGO_SEGURIDAD_RFCE_LOCAL = "000000";
const RE_RNC = /^\d{9}(?:\d{2})?$/;
const RE_ENCF = /^E(31|32|33|34|41|43|44|45|46|47)(\d{10})$/;
const RE_FECHA_DGII = /^(\d{2})-(\d{2})-(\d{4})$/;

const ORDEN_OFICIAL_CATEGORIAS: readonly CategoriaSimulacionPaso4[] = [
  "31",
  "31",
  "31",
  "31",
  "32_mayor_250k",
  "32_mayor_250k",
  "41",
  "41",
  "43",
  "43",
  "44",
  "44",
  "45",
  "45",
  "46",
  "46",
  "47",
  "47",
  "33",
  "34",
  "34",
  "32_rfce",
  "32_rfce",
  "32_rfce",
  "32_rfce",
];

interface PartesFechaHoraRd {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

function partesFechaHoraRd(fecha: Date): PartesFechaHoraRd {
  const mapa = new Map<string, string>();
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
    if (parte.type !== "literal") mapa.set(parte.type, parte.value);
  }
  return {
    year: mapa.get("year") ?? "1970",
    month: mapa.get("month") ?? "01",
    day: mapa.get("day") ?? "01",
    hour: mapa.get("hour") ?? "00",
    minute: mapa.get("minute") ?? "00",
    second: mapa.get("second") ?? "00",
  };
}

export function formatearFechaRdActual(fecha = new Date()): string {
  const partes = partesFechaHoraRd(fecha);
  return `${partes.day}-${partes.month}-${partes.year}`;
}

export function formatearFechaHoraRdActual(fecha = new Date()): string {
  const partes = partesFechaHoraRd(fecha);
  return `${formatearFechaRdActual(fecha)} ${partes.hour}:${partes.minute}:${partes.second}`;
}

export function construirEncfSecuencia(tipo: TipoEcf, secuencia: number): string {
  if (!Number.isInteger(secuencia) || secuencia < 0 || secuencia > 9_999_999_999) {
    throw new Error("La secuencia del e-NCF debe ser un entero entre 0 y 9999999999");
  }
  return `E${tipo}${String(secuencia).padStart(10, "0")}`;
}

function centavosDesdePesos(valor: number): number {
  return Math.round(valor * 100);
}

function pesosDesdeCentavos(valor: number): number {
  return valor / 100;
}

function centavosDesdeMonto(valor: number): number {
  return Math.round(valor * 100);
}

function porcentajeExactoCentavos(baseCentavos: number, porcentaje: number, concepto: string): number {
  const numerador = baseCentavos * porcentaje;
  if (numerador % 100 !== 0) {
    throw new Error(`${concepto} no produce centavos exactos para una base de ${baseCentavos} centavos`);
  }
  return numerador / 100;
}

function textoNoVacio(valor: string | undefined): string | undefined {
  const limpio = valor?.trim();
  return limpio ? limpio : undefined;
}

function tasaDesdeIndicador(indicador: IndicadorFacturacionEcf): ItbisTasaEcf {
  if (indicador === "1") return 18;
  if (indicador === "2") return 16;
  return 0;
}

interface SubAjusteCentavos {
  tipo: "$" | "%";
  porcentaje?: number;
  montoCentavos: number;
}

function convertirSubAjuste(ajuste: SubAjusteCentavos): SubAjusteEcfInput {
  return {
    tipo: ajuste.tipo,
    porcentaje: ajuste.porcentaje,
    monto: pesosDesdeCentavos(ajuste.montoCentavos),
  };
}

interface LineaCentavosInput {
  numeroLinea: number;
  nombreItem: string;
  cantidad: number;
  precioUnitarioCentavos: number;
  indicadorFacturacion: IndicadorFacturacionEcf;
  indicadorBienoServicio?: "1" | "2";
  descripcionItem?: string;
  unidadMedida?: string;
  descuentoCentavos?: number;
  subDescuentosCentavos?: SubAjusteCentavos[];
  recargoCentavos?: number;
  subRecargosCentavos?: SubAjusteCentavos[];
}

function sumarSubAjustesCentavos(ajustes: SubAjusteCentavos[] | undefined): number {
  return (ajustes ?? []).reduce((suma, ajuste) => suma + ajuste.montoCentavos, 0);
}

function construirLineaCentavos(input: LineaCentavosInput): LineaEcfInput {
  const subDescuentosCentavos = sumarSubAjustesCentavos(input.subDescuentosCentavos);
  const subRecargosCentavos = sumarSubAjustesCentavos(input.subRecargosCentavos);
  const descuentoCentavos = input.descuentoCentavos ?? subDescuentosCentavos;
  const recargoCentavos = input.recargoCentavos ?? subRecargosCentavos;
  if (
    input.descuentoCentavos !== undefined &&
    subDescuentosCentavos > 0 &&
    input.descuentoCentavos !== subDescuentosCentavos
  ) {
    throw new Error(`La línea ${input.numeroLinea} tiene un descuento total distinto de sus subdescuentos`);
  }
  if (input.recargoCentavos !== undefined && subRecargosCentavos > 0 && input.recargoCentavos !== subRecargosCentavos) {
    throw new Error(`La línea ${input.numeroLinea} tiene un recargo total distinto de sus subrecargos`);
  }
  const brutoCentavos = Math.round(input.cantidad * input.precioUnitarioCentavos);
  const montoCentavos = brutoCentavos - descuentoCentavos + recargoCentavos;
  if (montoCentavos < 0) throw new Error(`La línea ${input.numeroLinea} no puede quedar con monto negativo`);
  return {
    numeroLinea: input.numeroLinea,
    indicadorFacturacion: input.indicadorFacturacion,
    nombreItem: input.nombreItem,
    indicadorBienoServicio: input.indicadorBienoServicio ?? "1",
    descripcionItem: input.descripcionItem,
    cantidad: input.cantidad,
    unidadMedida: input.unidadMedida ?? "43",
    precioUnitario: pesosDesdeCentavos(input.precioUnitarioCentavos),
    descuento: descuentoCentavos > 0 ? pesosDesdeCentavos(descuentoCentavos) : undefined,
    subDescuentos: input.subDescuentosCentavos?.map(convertirSubAjuste),
    recargo: recargoCentavos > 0 ? pesosDesdeCentavos(recargoCentavos) : undefined,
    subRecargos: input.subRecargosCentavos?.map(convertirSubAjuste),
    itbisTasa: tasaDesdeIndicador(input.indicadorFacturacion),
    montoItem: pesosDesdeCentavos(montoCentavos),
  };
}

function conRetencionE41(linea: LineaEcfInput): LineaEcfInput {
  const baseCentavos = centavosDesdeMonto(linea.montoItem);
  return {
    ...linea,
    retencion: {
      indicadorAgenteRetencion: "1",
      montoItbisRetenido: pesosDesdeCentavos(porcentajeExactoCentavos(baseCentavos, 18, "El ITBIS retenido E41")),
      montoIsrRetenido: pesosDesdeCentavos(porcentajeExactoCentavos(baseCentavos, 10, "El ISR retenido E41")),
    },
  };
}

function conRetencionE47(linea: LineaEcfInput): LineaEcfInput {
  const baseCentavos = centavosDesdeMonto(linea.montoItem);
  return {
    ...linea,
    retencion: {
      indicadorAgenteRetencion: "1",
      montoIsrRetenido: pesosDesdeCentavos(porcentajeExactoCentavos(baseCentavos, 27, "El ISR retenido E47")),
    },
  };
}

function sumarLineasPorIndicador(lineas: readonly LineaEcfInput[], indicador: IndicadorFacturacionEcf): number {
  return lineas
    .filter((linea) => linea.indicadorFacturacion === indicador)
    .reduce((suma, linea) => suma + centavosDesdeMonto(linea.montoItem), 0);
}

function calcularTotalesDesdeLineas(lineas: readonly LineaEcfInput[]): TotalesEcfInput {
  const gravadoI1 = sumarLineasPorIndicador(lineas, "1");
  const gravadoI2 = sumarLineasPorIndicador(lineas, "2");
  const gravadoI3 = sumarLineasPorIndicador(lineas, "3");
  const exento = sumarLineasPorIndicador(lineas, "4");
  const itbis1 = Math.round((gravadoI1 * 18) / 100);
  const itbis2 = Math.round((gravadoI2 * 16) / 100);
  const itbis3 = 0;
  const itbisRetenido = lineas.reduce(
    (suma, linea) => suma + centavosDesdeMonto(linea.retencion?.montoItbisRetenido ?? 0),
    0,
  );
  const isrRetenido = lineas.reduce(
    (suma, linea) => suma + centavosDesdeMonto(linea.retencion?.montoIsrRetenido ?? 0),
    0,
  );
  const total = gravadoI1 + gravadoI2 + gravadoI3 + exento + itbis1 + itbis2 + itbis3;
  return {
    montoGravadoTotal: pesosDesdeCentavos(gravadoI1 + gravadoI2 + gravadoI3),
    montoGravadoI1: pesosDesdeCentavos(gravadoI1),
    montoGravadoI2: pesosDesdeCentavos(gravadoI2),
    montoGravadoI3: pesosDesdeCentavos(gravadoI3),
    montoExento: pesosDesdeCentavos(exento),
    totalItbis1: pesosDesdeCentavos(itbis1),
    totalItbis2: pesosDesdeCentavos(itbis2),
    totalItbis3: pesosDesdeCentavos(itbis3),
    totalItbis: pesosDesdeCentavos(itbis1 + itbis2 + itbis3),
    montoTotal: pesosDesdeCentavos(total),
    totalItbisRetenido: itbisRetenido > 0 ? pesosDesdeCentavos(itbisRetenido) : undefined,
    totalIsrRetencion: isrRetenido > 0 ? pesosDesdeCentavos(isrRetenido) : undefined,
  };
}

interface ContextoPaso4 {
  rncEmisor: string;
  razonSocial: string;
  direccionEmisor: string;
  telefonoEmisor?: string;
  correoEmisor?: string;
  fechaEmision: string;
  fechaVencimientoSecuencia: string;
  fechaHoraFirma: string;
  rncCompradorGeneral: string;
  razonSocialCompradorGeneral: string;
  rncProveedorE41: string;
  razonSocialProveedorE41: string;
}

function crearEmisor(contexto: ContextoPaso4): EmisorEcfInput {
  return {
    rnc: contexto.rncEmisor,
    razonSocial: contexto.razonSocial,
    nombreComercial: contexto.razonSocial,
    direccion: contexto.direccionEmisor,
    municipio: MUNICIPIO_OXYMAT_DEFECTO,
    provincia: PROVINCIA_OXYMAT_DEFECTO,
    telefonos: contexto.telefonoEmisor ? [contexto.telefonoEmisor] : undefined,
    correo: contexto.correoEmisor,
    actividadEconomica: "SUMINISTRO DE GASES MEDICINALES E INDUSTRIALES",
  };
}

function compradorGeneral(contexto: ContextoPaso4): CompradorEcfInput {
  return {
    rnc: contexto.rncCompradorGeneral,
    razonSocial: contexto.razonSocialCompradorGeneral,
  };
}

function compradorProveedorE41(contexto: ContextoPaso4): CompradorEcfInput {
  return {
    rnc: contexto.rncProveedorE41,
    razonSocial: contexto.razonSocialProveedorE41,
  };
}

function compradorConsumidorFinal(): CompradorEcfInput {
  return { razonSocial: "CONSUMIDOR FINAL" };
}

function compradorExterior(): CompradorEcfInput {
  return {
    identificadorExtranjero: "350555123",
    razonSocial: "PROVEEDOR INTERNACIONAL DE GASES INC",
  };
}

function sumarDiasFechaDgii(fecha: string, dias: number): string {
  const partes = fecha.match(RE_FECHA_DGII);
  if (!partes?.[1] || !partes[2] || !partes[3]) throw new Error(`Fecha DGII inválida: ${fecha}`);
  const tiempo = Date.UTC(Number(partes[3]), Number(partes[2]) - 1, Number(partes[1]) + dias);
  const resultado = new Date(tiempo);
  const dia = String(resultado.getUTCDate()).padStart(2, "0");
  const mes = String(resultado.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}-${mes}-${resultado.getUTCFullYear()}`;
}

interface DocumentoBaseInput {
  tipo: TipoEcf;
  encf: string;
  contexto: ContextoPaso4;
  comprador: CompradorEcfInput;
  lineas: LineaEcfInput[];
  tipoPago?: "1" | "2" | "3";
  formaPago?: string;
  incluirFormasPago?: boolean;
  incluirIndicadorMontoGravado?: boolean;
  incluirFechaVencimiento?: boolean;
  fechaLimitePago?: string;
  indicadorNotaCredito?: "0" | "1";
  ncfModificado?: string;
  fechaNcfModificado?: string;
  codigoModificacion?: string;
  razonModificacion?: string;
  transporte?: DocumentoEcfInput["transporte"];
}

function crearDocumentoBase(input: DocumentoBaseInput): DocumentoEcfInput {
  const totales = calcularTotalesDesdeLineas(input.lineas);
  const tipoPago = input.tipoPago ?? "1";
  const incluirFormasPago = input.incluirFormasPago ?? true;
  return {
    emisor: crearEmisor(input.contexto),
    comprador: input.comprador,
    comprobante: {
      tipo: input.tipo,
      encf: input.encf,
      fechaEmision: input.contexto.fechaEmision,
      fechaVencimientoSecuencia:
        (input.incluirFechaVencimiento ?? true) === true ? input.contexto.fechaVencimientoSecuencia : undefined,
      indicadorNotaCredito: input.indicadorNotaCredito,
      indicadorMontoGravado: (input.incluirIndicadorMontoGravado ?? true) === true ? "0" : undefined,
      tipoIngresos: "01",
      tipoPago,
      fechaLimitePago: input.fechaLimitePago,
      formasPago: incluirFormasPago
        ? [{ formaPago: input.formaPago ?? "1", montoPago: totales.montoTotal }]
        : undefined,
      ncfModificado: input.ncfModificado,
      fechaNcfModificado: input.fechaNcfModificado,
      codigoModificacion: input.codigoModificacion,
      razonModificacion: input.razonModificacion,
      fechaHoraFirma: input.contexto.fechaHoraFirma,
    },
    transporte: input.transporte,
    lineas: input.lineas,
    totales,
  };
}

interface ConstructorCasoInput {
  numeroCaso: number;
  faseOrden: FaseOrdenPaso4;
  categoria: CategoriaSimulacionPaso4;
  descripcion: string;
  documento: DocumentoEcfInput;
  esRfce?: boolean;
}

function crearCaso(input: ConstructorCasoInput): CasoSimulacionPaso4 {
  return {
    numeroCaso: input.numeroCaso,
    faseOrden: input.faseOrden,
    categoria: input.categoria,
    descripcion: input.descripcion,
    esRfce: input.esRfce ?? false,
    documento: input.documento,
  };
}

function validarEntradaSimulacion(opciones: OpcionesSimulacionPaso4): {
  rncEmisor: string;
  razonSocial: string;
  secuenciaBase: number;
} {
  const rncEmisor = opciones.rncEmisor.trim();
  if (!RE_RNC.test(rncEmisor)) throw new Error("El RNC del emisor debe tener 9 u 11 dígitos");
  const razonSocial = opciones.razonSocial.trim();
  if (razonSocial === "") throw new Error("La razón social del emisor no puede estar vacía");
  const secuenciaBase = opciones.secuenciaBase ?? SECUENCIA_BASE_SIMULACION_DEFECTO;
  if (
    !Number.isInteger(secuenciaBase) ||
    secuenciaBase < SECUENCIA_BASE_SIMULACION_MIN ||
    secuenciaBase > SECUENCIA_BASE_SIMULACION_MAX
  ) {
    throw new Error(
      `La secuencia base debe ser un entero entre ${SECUENCIA_BASE_SIMULACION_MIN} y ${SECUENCIA_BASE_SIMULACION_MAX}`,
    );
  }
  return { rncEmisor, razonSocial, secuenciaBase };
}

function construirContexto(opciones: OpcionesSimulacionPaso4): ContextoPaso4 {
  const entrada = validarEntradaSimulacion(opciones);
  return {
    rncEmisor: entrada.rncEmisor,
    razonSocial: entrada.razonSocial,
    direccionEmisor: textoNoVacio(opciones.direccionEmisor) ?? DIRECCION_OXYMAT_DEFECTO,
    telefonoEmisor: textoNoVacio(opciones.telefonoEmisor) ?? TELEFONO_OXYMAT_DEFECTO,
    correoEmisor: textoNoVacio(opciones.correoEmisor) ?? CORREO_OXYMAT_DEFECTO,
    fechaEmision: opciones.fechaEmision ?? formatearFechaRdActual(),
    fechaVencimientoSecuencia: opciones.fechaVencimientoSecuencia ?? FECHA_VENCIMIENTO_DEFECTO,
    fechaHoraFirma: opciones.fechaHoraFirma ?? formatearFechaHoraRdActual(),
    rncCompradorGeneral: opciones.rncCompradorGeneral?.trim() ?? RNC_COMPRADOR_DEFECTO,
    razonSocialCompradorGeneral: textoNoVacio(opciones.razonSocialCompradorGeneral) ?? RAZON_COMPRADOR_DEFECTO,
    rncProveedorE41: opciones.rncProveedorE41?.trim() ?? RNC_PROVEEDOR_E41_DEFECTO,
    razonSocialProveedorE41: textoNoVacio(opciones.razonSocialProveedorE41) ?? RAZON_PROVEEDOR_E41_DEFECTO,
  };
}

interface DocumentosAncaPaso4 {
  encfE31Primero: string;
  encfE31Segundo: string;
  encfE44Primero: string;
}

function lineasCreditoE31ConDescuento(): LineaEcfInput[] {
  return [
    construirLineaCentavos({
      numeroLinea: 1,
      nombreItem: "Recarga oxígeno medicinal USP cilindro 1360L",
      cantidad: 40,
      precioUnitarioCentavos: centavosDesdePesos(2800),
      indicadorFacturacion: "1",
      unidadMedida: "9",
      descuentoCentavos: centavosDesdePesos(5000),
      subDescuentosCentavos: [
        { tipo: "$", montoCentavos: centavosDesdePesos(3500) },
        { tipo: "$", montoCentavos: centavosDesdePesos(1500) },
      ],
    }),
    construirLineaCentavos({
      numeroLinea: 2,
      nombreItem: "Mascarilla adulto con tubo para oxigenoterapia",
      cantidad: 20,
      precioUnitarioCentavos: centavosDesdePesos(385),
      indicadorFacturacion: "1",
    }),
  ];
}

function lineasE44Primero(): LineaEcfInput[] {
  return [
    construirLineaCentavos({
      numeroLinea: 1,
      nombreItem: "Suministro exento de nitrógeno industrial a zona franca",
      cantidad: 20,
      precioUnitarioCentavos: centavosDesdePesos(3200),
      indicadorFacturacion: "4",
      unidadMedida: "9",
    }),
  ];
}

function construirDocumentosFase1(
  contexto: ContextoPaso4,
  secuenciaBase: number,
): { casos: CasoSimulacionPaso4[]; anclas: DocumentosAncaPaso4 } {
  const casos: CasoSimulacionPaso4[] = [];
  const encfE31 = Array.from({ length: 4 }, (_, indice) => construirEncfSecuencia("31", secuenciaBase + indice));
  const encfE31Primero = encfE31[0] ?? construirEncfSecuencia("31", secuenciaBase);
  const encfE31Segundo = encfE31[1] ?? construirEncfSecuencia("31", secuenciaBase + 1);
  const comprador = compradorGeneral(contexto);

  casos.push(
    crearCaso({
      numeroCaso: 1,
      faseOrden: 1,
      categoria: "31",
      descripcion: "E31 contado: oxígeno medicinal USP y regulador",
      documento: crearDocumentoBase({
        tipo: "31",
        encf: encfE31Primero,
        contexto,
        comprador,
        lineas: [
          construirLineaCentavos({
            numeroLinea: 1,
            nombreItem: "Recarga oxígeno medicinal USP cilindro 680L",
            cantidad: 10,
            precioUnitarioCentavos: centavosDesdePesos(1850),
            indicadorFacturacion: "1",
            unidadMedida: "9",
          }),
          construirLineaCentavos({
            numeroLinea: 2,
            nombreItem: "Regulador de oxígeno medicinal 0-15 LPM",
            cantidad: 2,
            precioUnitarioCentavos: centavosDesdePesos(4250),
            indicadorFacturacion: "1",
            unidadMedida: "34",
          }),
        ],
      }),
    }),
    crearCaso({
      numeroCaso: 2,
      faseOrden: 1,
      categoria: "31",
      descripcion: "E31 crédito 30 días: cilindros con descuento por volumen",
      documento: crearDocumentoBase({
        tipo: "31",
        encf: encfE31Segundo,
        contexto,
        comprador,
        tipoPago: "2",
        formaPago: "4",
        fechaLimitePago: sumarDiasFechaDgii(contexto.fechaEmision, 30),
        lineas: lineasCreditoE31ConDescuento(),
      }),
    }),
    crearCaso({
      numeroCaso: 3,
      faseOrden: 1,
      categoria: "31",
      descripcion: "E31 contado: operación mixta gravada 18% y exenta",
      documento: crearDocumentoBase({
        tipo: "31",
        encf: encfE31[2] ?? construirEncfSecuencia("31", secuenciaBase + 2),
        contexto,
        comprador,
        lineas: [
          construirLineaCentavos({
            numeroLinea: 1,
            nombreItem: "Recarga oxígeno medicinal USP cilindro 680L",
            cantidad: 12,
            precioUnitarioCentavos: centavosDesdePesos(1850),
            indicadorFacturacion: "1",
            unidadMedida: "9",
          }),
          construirLineaCentavos({
            numeroLinea: 2,
            nombreItem: "Servicio exento de soporte respiratorio domiciliario",
            cantidad: 1,
            precioUnitarioCentavos: centavosDesdePesos(6500),
            indicadorFacturacion: "4",
            indicadorBienoServicio: "2",
            unidadMedida: "19",
          }),
        ],
      }),
    }),
    crearCaso({
      numeroCaso: 4,
      faseOrden: 1,
      categoria: "31",
      descripcion: "E31 contado: equipos de oxigenoterapia e instalación",
      documento: crearDocumentoBase({
        tipo: "31",
        encf: encfE31[3] ?? construirEncfSecuencia("31", secuenciaBase + 3),
        contexto,
        comprador,
        lineas: [
          construirLineaCentavos({
            numeroLinea: 1,
            nombreItem: "Concentrador de oxígeno estacionario 10 LPM",
            cantidad: 2,
            precioUnitarioCentavos: centavosDesdePesos(68_000),
            indicadorFacturacion: "1",
            unidadMedida: "34",
          }),
          construirLineaCentavos({
            numeroLinea: 2,
            nombreItem: "Instalación y calibración de equipo de oxigenoterapia",
            cantidad: 2,
            precioUnitarioCentavos: centavosDesdePesos(3500),
            indicadorFacturacion: "1",
            indicadorBienoServicio: "2",
            unidadMedida: "19",
          }),
        ],
      }),
    }),
  );

  const documentosE32Mayor = [
    {
      secuencia: secuenciaBase,
      descripcion: "E32 >= RD$250,000: sistema de oxigenoterapia hospitalaria",
      lineas: [
        construirLineaCentavos({
          numeroLinea: 1,
          nombreItem: "Sistema central de oxigenoterapia hospitalaria",
          cantidad: 1,
          precioUnitarioCentavos: centavosDesdePesos(180_000),
          indicadorFacturacion: "1",
          unidadMedida: "10",
        }),
        construirLineaCentavos({
          numeroLinea: 2,
          nombreItem: "Instalación y puesta en marcha de sistema hospitalario",
          cantidad: 1,
          precioUnitarioCentavos: centavosDesdePesos(70_000),
          indicadorFacturacion: "1",
          indicadorBienoServicio: "2",
          unidadMedida: "19",
        }),
      ],
    },
    {
      secuencia: secuenciaBase + 1,
      descripcion: "E32 >= RD$250,000: planta PSA compacta y mantenimiento",
      lineas: [
        construirLineaCentavos({
          numeroLinea: 1,
          nombreItem: "Planta PSA compacta para oxígeno medicinal",
          cantidad: 1,
          precioUnitarioCentavos: centavosDesdePesos(245_000),
          indicadorFacturacion: "1",
          unidadMedida: "10",
        }),
        construirLineaCentavos({
          numeroLinea: 2,
          nombreItem: "Mantenimiento preventivo anual de planta PSA",
          cantidad: 1,
          precioUnitarioCentavos: centavosDesdePesos(35_000),
          indicadorFacturacion: "1",
          indicadorBienoServicio: "2",
          unidadMedida: "19",
        }),
      ],
    },
  ];
  documentosE32Mayor.forEach((configuracion, indice) => {
    casos.push(
      crearCaso({
        numeroCaso: 5 + indice,
        faseOrden: 1,
        categoria: "32_mayor_250k",
        descripcion: configuracion.descripcion,
        documento: crearDocumentoBase({
          tipo: "32",
          encf: construirEncfSecuencia("32", configuracion.secuencia),
          contexto,
          comprador,
          tipoPago: "2",
          formaPago: "4",
          fechaLimitePago: sumarDiasFechaDgii(contexto.fechaEmision, 30),
          incluirFechaVencimiento: false,
          lineas: configuracion.lineas,
        }),
      }),
    );
  });

  const documentosE41 = [
    {
      descripcion: "E41 compras: reparación de compresor por proveedor informal",
      lineas: [
        conRetencionE41(
          construirLineaCentavos({
            numeroLinea: 1,
            nombreItem: "Servicio de reparación de compresor industrial",
            cantidad: 1,
            precioUnitarioCentavos: centavosDesdePesos(85_000),
            indicadorFacturacion: "1",
            indicadorBienoServicio: "2",
            unidadMedida: "19",
          }),
        ),
      ],
    },
    {
      descripcion: "E41 compras: renta de equipos y transporte informal",
      lineas: [
        conRetencionE41(
          construirLineaCentavos({
            numeroLinea: 1,
            nombreItem: "Renta de equipo de soldadura y gases auxiliares",
            cantidad: 1,
            precioUnitarioCentavos: centavosDesdePesos(42_000),
            indicadorFacturacion: "1",
          }),
        ),
        conRetencionE41(
          construirLineaCentavos({
            numeroLinea: 2,
            nombreItem: "Transporte interno de materiales y cilindros",
            cantidad: 1,
            precioUnitarioCentavos: centavosDesdePesos(8000),
            indicadorFacturacion: "1",
            indicadorBienoServicio: "2",
            unidadMedida: "19",
          }),
        ),
      ],
    },
  ];
  documentosE41.forEach((configuracion, indice) => {
    casos.push(
      crearCaso({
        numeroCaso: 7 + indice,
        faseOrden: 1,
        categoria: "41",
        descripcion: configuracion.descripcion,
        documento: crearDocumentoBase({
          tipo: "41",
          encf: construirEncfSecuencia("41", secuenciaBase + indice),
          contexto,
          comprador: compradorProveedorE41(contexto),
          lineas: configuracion.lineas,
        }),
      }),
    );
  });

  const documentosE43 = [
    {
      descripcion: "E43 gastos menores: combustible menor de reparto",
      lineas: [
        construirLineaCentavos({
          numeroLinea: 1,
          nombreItem: "Combustible menor para vehículo de reparto",
          cantidad: 1,
          precioUnitarioCentavos: centavosDesdePesos(3500),
          indicadorFacturacion: "4",
        }),
      ],
    },
    {
      descripcion: "E43 gastos menores: refrigerio y agua para cuadrilla",
      lineas: [
        construirLineaCentavos({
          numeroLinea: 1,
          nombreItem: "Refrigerio para brigada de mantenimiento",
          cantidad: 1,
          precioUnitarioCentavos: centavosDesdePesos(1850),
          indicadorFacturacion: "4",
        }),
        construirLineaCentavos({
          numeroLinea: 2,
          nombreItem: "Agua embotellada para cuadrilla técnica",
          cantidad: 2,
          precioUnitarioCentavos: centavosDesdePesos(450),
          indicadorFacturacion: "4",
        }),
      ],
    },
  ];
  documentosE43.forEach((configuracion, indice) => {
    casos.push(
      crearCaso({
        numeroCaso: 9 + indice,
        faseOrden: 1,
        categoria: "43",
        descripcion: configuracion.descripcion,
        documento: crearDocumentoBase({
          tipo: "43",
          encf: construirEncfSecuencia("43", secuenciaBase + indice),
          contexto,
          comprador: { razonSocial: "" },
          incluirFormasPago: false,
          incluirIndicadorMontoGravado: false,
          lineas: configuracion.lineas,
        }),
      }),
    );
  });

  const lineasPrimerE44 = lineasE44Primero();
  const encfE44Primero = construirEncfSecuencia("44", secuenciaBase);
  const documentosE44 = [
    {
      descripcion: "E44 regímenes especiales: nitrógeno industrial a zona franca",
      lineas: lineasPrimerE44,
    },
    {
      descripcion: "E44 regímenes especiales: argón y alquiler de cilindros",
      lineas: [
        construirLineaCentavos({
          numeroLinea: 1,
          nombreItem: "Recarga exenta de argón industrial para exportadora",
          cantidad: 15,
          precioUnitarioCentavos: centavosDesdePesos(4100),
          indicadorFacturacion: "4",
          unidadMedida: "9",
        }),
        construirLineaCentavos({
          numeroLinea: 2,
          nombreItem: "Alquiler de cilindros de alta presión",
          cantidad: 15,
          precioUnitarioCentavos: centavosDesdePesos(350),
          indicadorFacturacion: "4",
          unidadMedida: "9",
        }),
      ],
    },
  ];
  documentosE44.forEach((configuracion, indice) => {
    casos.push(
      crearCaso({
        numeroCaso: 11 + indice,
        faseOrden: 1,
        categoria: "44",
        descripcion: configuracion.descripcion,
        documento: crearDocumentoBase({
          tipo: "44",
          encf: construirEncfSecuencia("44", secuenciaBase + indice),
          contexto,
          comprador,
          incluirIndicadorMontoGravado: false,
          lineas: configuracion.lineas,
        }),
      }),
    );
  });

  const documentosE45 = [
    {
      descripcion: "E45 gubernamental: oxígeno medicinal para hospital público",
      lineas: [
        construirLineaCentavos({
          numeroLinea: 1,
          nombreItem: "Suministro de oxígeno medicinal USP para hospital público",
          cantidad: 100,
          precioUnitarioCentavos: centavosDesdePesos(2100),
          indicadorFacturacion: "1",
          unidadMedida: "9",
        }),
      ],
    },
    {
      descripcion: "E45 gubernamental: mantenimiento de red de gases medicinales",
      lineas: [
        construirLineaCentavos({
          numeroLinea: 1,
          nombreItem: "Mantenimiento preventivo de red de gases medicinales",
          cantidad: 1,
          precioUnitarioCentavos: centavosDesdePesos(85_000),
          indicadorFacturacion: "1",
          indicadorBienoServicio: "2",
          unidadMedida: "19",
        }),
        construirLineaCentavos({
          numeroLinea: 2,
          nombreItem: "Válvula reguladora para red de oxígeno medicinal",
          cantidad: 6,
          precioUnitarioCentavos: centavosDesdePesos(4200),
          indicadorFacturacion: "1",
          unidadMedida: "34",
        }),
      ],
    },
  ];
  documentosE45.forEach((configuracion, indice) => {
    casos.push(
      crearCaso({
        numeroCaso: 13 + indice,
        faseOrden: 1,
        categoria: "45",
        descripcion: configuracion.descripcion,
        documento: crearDocumentoBase({
          tipo: "45",
          encf: construirEncfSecuencia("45", secuenciaBase + indice),
          contexto,
          comprador,
          lineas: configuracion.lineas,
        }),
      }),
    );
  });

  const documentosE46 = [
    {
      descripcion: "E46 exportación: concentradores de oxígeno",
      lineas: [
        construirLineaCentavos({
          numeroLinea: 1,
          nombreItem: "Concentrador de oxígeno estacionario exportado",
          cantidad: 4,
          precioUnitarioCentavos: centavosDesdePesos(42_000),
          indicadorFacturacion: "3",
          unidadMedida: "34",
        }),
      ],
    },
    {
      descripcion: "E46 exportación: cilindros y reguladores de oxígeno",
      lineas: [
        construirLineaCentavos({
          numeroLinea: 1,
          nombreItem: "Cilindro de oxígeno medicinal exportado",
          cantidad: 10,
          precioUnitarioCentavos: centavosDesdePesos(6800),
          indicadorFacturacion: "3",
          unidadMedida: "9",
        }),
        construirLineaCentavos({
          numeroLinea: 2,
          nombreItem: "Regulador de alta presión exportado",
          cantidad: 20,
          precioUnitarioCentavos: centavosDesdePesos(1450),
          indicadorFacturacion: "3",
          unidadMedida: "34",
        }),
      ],
    },
  ];
  documentosE46.forEach((configuracion, indice) => {
    casos.push(
      crearCaso({
        numeroCaso: 15 + indice,
        faseOrden: 1,
        categoria: "46",
        descripcion: configuracion.descripcion,
        documento: crearDocumentoBase({
          tipo: "46",
          encf: construirEncfSecuencia("46", secuenciaBase + indice),
          contexto,
          comprador,
          incluirIndicadorMontoGravado: false,
          lineas: configuracion.lineas,
        }),
      }),
    );
  });

  const documentosE47 = [
    {
      descripcion: "E47 pagos al exterior: asesoría internacional en plantas PSA",
      lineas: [
        conRetencionE47(
          construirLineaCentavos({
            numeroLinea: 1,
            nombreItem: "Asesoría técnica internacional en plantas PSA",
            cantidad: 1,
            precioUnitarioCentavos: centavosDesdePesos(60_000),
            indicadorFacturacion: "4",
            indicadorBienoServicio: "2",
            unidadMedida: "19",
          }),
        ),
      ],
    },
    {
      descripcion: "E47 pagos al exterior: licencia y soporte remoto especializado",
      lineas: [
        conRetencionE47(
          construirLineaCentavos({
            numeroLinea: 1,
            nombreItem: "Licencia anual de monitoreo remoto de gases",
            cantidad: 1,
            precioUnitarioCentavos: centavosDesdePesos(48_000),
            indicadorFacturacion: "4",
            indicadorBienoServicio: "2",
          }),
        ),
        conRetencionE47(
          construirLineaCentavos({
            numeroLinea: 2,
            nombreItem: "Soporte técnico especializado desde el exterior",
            cantidad: 1,
            precioUnitarioCentavos: centavosDesdePesos(12_000),
            indicadorFacturacion: "4",
            indicadorBienoServicio: "2",
            unidadMedida: "19",
          }),
        ),
      ],
    },
  ];
  documentosE47.forEach((configuracion, indice) => {
    casos.push(
      crearCaso({
        numeroCaso: 17 + indice,
        faseOrden: 1,
        categoria: "47",
        descripcion: configuracion.descripcion,
        documento: crearDocumentoBase({
          tipo: "47",
          encf: construirEncfSecuencia("47", secuenciaBase + indice),
          contexto,
          comprador: compradorExterior(),
          incluirIndicadorMontoGravado: false,
          transporte: { paisDestino: "ESTADOS UNIDOS" },
          lineas: configuracion.lineas,
        }),
      }),
    );
  });

  return { casos, anclas: { encfE31Primero, encfE31Segundo, encfE44Primero } };
}

function copiarLineasComoCreditoExento(lineas: readonly LineaEcfInput[]): LineaEcfInput[] {
  return lineas.map((linea) => ({
    ...linea,
    retencion: undefined,
    descripcionItem: linea.descripcionItem,
  }));
}

function construirDocumentosFase2(
  contexto: ContextoPaso4,
  secuenciaBase: number,
  anclas: DocumentosAncaPaso4,
): CasoSimulacionPaso4[] {
  const comprador = compradorGeneral(contexto);
  const lineasAnulacionE44 = copiarLineasComoCreditoExento(lineasE44Primero());
  return [
    crearCaso({
      numeroCaso: 19,
      faseOrden: 2,
      categoria: "33",
      descripcion: "E33 nota de débito: cargo adicional sobre E31 #1",
      documento: crearDocumentoBase({
        tipo: "33",
        encf: construirEncfSecuencia("33", secuenciaBase),
        contexto,
        comprador,
        ncfModificado: anclas.encfE31Primero,
        fechaNcfModificado: contexto.fechaEmision,
        codigoModificacion: "3",
        razonModificacion: "Cargo adicional por flete y manejo",
        lineas: [
          construirLineaCentavos({
            numeroLinea: 1,
            nombreItem: "Cargo adicional por flete y manejo especializado",
            cantidad: 1,
            precioUnitarioCentavos: centavosDesdePesos(1500),
            indicadorFacturacion: "1",
            indicadorBienoServicio: "2",
            unidadMedida: "19",
          }),
        ],
      }),
    }),
    crearCaso({
      numeroCaso: 20,
      faseOrden: 2,
      categoria: "34",
      descripcion: "E34 nota de crédito parcial sobre E31 #2",
      documento: crearDocumentoBase({
        tipo: "34",
        encf: construirEncfSecuencia("34", secuenciaBase),
        contexto,
        comprador,
        incluirFormasPago: false,
        incluirFechaVencimiento: false,
        indicadorNotaCredito: "0",
        ncfModificado: anclas.encfE31Segundo,
        fechaNcfModificado: contexto.fechaEmision,
        codigoModificacion: "3",
        razonModificacion: "Descuento por devolución parcial de cilindros",
        lineas: [
          construirLineaCentavos({
            numeroLinea: 1,
            nombreItem: "Devolución parcial de recarga de cilindros de oxígeno",
            cantidad: 5,
            precioUnitarioCentavos: centavosDesdePesos(2800),
            indicadorFacturacion: "1",
            unidadMedida: "9",
          }),
        ],
      }),
    }),
    crearCaso({
      numeroCaso: 21,
      faseOrden: 2,
      categoria: "34",
      descripcion: "E34 nota de crédito: anulación total de E44 #1",
      documento: crearDocumentoBase({
        tipo: "34",
        encf: construirEncfSecuencia("34", secuenciaBase + 1),
        contexto,
        comprador,
        incluirFormasPago: false,
        incluirFechaVencimiento: false,
        indicadorNotaCredito: "0",
        ncfModificado: anclas.encfE44Primero,
        fechaNcfModificado: contexto.fechaEmision,
        codigoModificacion: "1",
        razonModificacion: "Anulación total de operación en régimen especial",
        lineas: lineasAnulacionE44,
      }),
    }),
  ];
}

function construirDocumentosFase3(contexto: ContextoPaso4, secuenciaBase: number): CasoSimulacionPaso4[] {
  const comprador = compradorGeneral(contexto);
  const configuraciones = [
    {
      descripcion: "RFCE E32 < RD$250,000: recarga de oxígeno y cánulas",
      comprador,
      lineas: [
        construirLineaCentavos({
          numeroLinea: 1,
          nombreItem: "Recarga oxígeno medicinal USP cilindro 680L",
          cantidad: 2,
          precioUnitarioCentavos: centavosDesdePesos(1850),
          indicadorFacturacion: "1",
          unidadMedida: "9",
        }),
        construirLineaCentavos({
          numeroLinea: 2,
          nombreItem: "Cánula nasal adulto para oxigenoterapia",
          cantidad: 3,
          precioUnitarioCentavos: centavosDesdePesos(650),
          indicadorFacturacion: "1",
        }),
      ],
    },
    {
      descripcion: "RFCE E32 < RD$250,000: regulador y mascarillas a consumidor final",
      comprador: compradorConsumidorFinal(),
      lineas: [
        construirLineaCentavos({
          numeroLinea: 1,
          nombreItem: "Regulador de oxígeno medicinal 0-15 LPM",
          cantidad: 1,
          precioUnitarioCentavos: centavosDesdePesos(4200),
          indicadorFacturacion: "1",
          unidadMedida: "34",
        }),
        construirLineaCentavos({
          numeroLinea: 2,
          nombreItem: "Mascarilla adulto con tubo para oxigenoterapia",
          cantidad: 2,
          precioUnitarioCentavos: centavosDesdePesos(750),
          indicadorFacturacion: "1",
        }),
      ],
    },
    {
      descripcion: "RFCE E32 < RD$250,000: mantenimiento de concentrador",
      comprador,
      lineas: [
        construirLineaCentavos({
          numeroLinea: 1,
          nombreItem: "Mantenimiento correctivo de concentrador de oxígeno",
          cantidad: 1,
          precioUnitarioCentavos: centavosDesdePesos(7800),
          indicadorFacturacion: "1",
          indicadorBienoServicio: "2",
          unidadMedida: "19",
        }),
      ],
    },
    {
      descripcion: "RFCE E32 < RD$250,000: servicio exento domiciliario",
      comprador: compradorConsumidorFinal(),
      lineas: [
        construirLineaCentavos({
          numeroLinea: 1,
          nombreItem: "Servicio exento de acompañamiento respiratorio domiciliario",
          cantidad: 1,
          precioUnitarioCentavos: centavosDesdePesos(5200),
          indicadorFacturacion: "4",
          indicadorBienoServicio: "2",
          unidadMedida: "19",
        }),
      ],
    },
  ];
  return configuraciones.map((configuracion, indice) =>
    crearCaso({
      numeroCaso: 22 + indice,
      faseOrden: 3,
      categoria: "32_rfce",
      descripcion: configuracion.descripcion,
      esRfce: true,
      documento: crearDocumentoBase({
        tipo: "32",
        encf: construirEncfSecuencia("32", secuenciaBase + 2 + indice),
        contexto,
        comprador: configuracion.comprador,
        incluirFechaVencimiento: false,
        lineas: configuracion.lineas,
      }),
    }),
  );
}

export function construirSetSimulacionPaso4(opciones: OpcionesSimulacionPaso4): CasoSimulacionPaso4[] {
  const entrada = validarEntradaSimulacion(opciones);
  const contexto = construirContexto(opciones);
  const fase1 = construirDocumentosFase1(contexto, entrada.secuenciaBase);
  const fase2 = construirDocumentosFase2(contexto, entrada.secuenciaBase, fase1.anclas);
  const fase3 = construirDocumentosFase3(contexto, entrada.secuenciaBase);
  return [...fase1.casos, ...fase2, ...fase3];
}

function categoriaCorrespondeTipo(categoria: CategoriaSimulacionPaso4, tipo: TipoEcf): boolean {
  if (categoria === "32_mayor_250k" || categoria === "32_rfce") return tipo === "32";
  return categoria === tipo;
}

function validarEsquemaLocal(xml: string, tipoEsperado: "ECF" | "RFCE", errores: string[], etiqueta: string): void {
  const validacionXsd = validarXmlContraEsquemaDgii(xml, tipoEsperado);
  if (!validacionXsd.valido) {
    errores.push(...validacionXsd.errores.map((error) => `${etiqueta}: ${error}`));
  }
}

export function validarCasoSimulacionPaso4Local(caso: CasoSimulacionPaso4): ResultadoValidacionPaso4Local {
  const errores: string[] = [];
  const documento = caso.documento;
  const tipo = documento.comprobante.tipo;
  const montoTotalCentavos = centavosDesdeMonto(documento.totales.montoTotal);
  if (!categoriaCorrespondeTipo(caso.categoria, tipo)) {
    errores.push(`La categoría ${caso.categoria} no corresponde con el tipo e-CF ${tipo}`);
  }
  if (caso.categoria === "32_mayor_250k" && montoTotalCentavos < LIMITE_RFCE_CENTAVOS) {
    errores.push("La categoría 32_mayor_250k exige MontoTotal mayor o igual a RD$250,000.00");
  }
  if (caso.categoria === "32_rfce" && montoTotalCentavos >= LIMITE_RFCE_CENTAVOS) {
    errores.push("La categoría 32_rfce exige MontoTotal menor que RD$250,000.00");
  }
  if (caso.esRfce !== (caso.categoria === "32_rfce")) {
    errores.push("La marca esRfce no corresponde con la categoría del caso");
  }
  const validacionDocumento = validarDocumentoEcf(documento);
  if (!validacionDocumento.ok) errores.push(...validacionDocumento.errores);
  try {
    validarEsquemaLocal(generarXmlEcf(documento), "ECF", errores, "XSD local e-CF");
    if (caso.esRfce) {
      if (!esElegibleRfce(documento)) errores.push("El caso marcado como RFCE no es elegible por tipo o monto");
      else {
        validarEsquemaLocal(generarXmlRfce(documento, CODIGO_SEGURIDAD_RFCE_LOCAL), "RFCE", errores, "XSD local RFCE");
      }
    }
  } catch (error) {
    errores.push(error instanceof Error ? error.message : "Error desconocido al generar el XML local");
  }
  return {
    numeroCaso: caso.numeroCaso,
    faseOrden: caso.faseOrden,
    categoria: caso.categoria,
    descripcion: caso.descripcion,
    encf: documento.comprobante.encf,
    tipo,
    montoTotal: documento.totales.montoTotal,
    esRfce: caso.esRfce,
    valido: errores.length === 0,
    errores,
  };
}

function extraerSecuenciaEncf(encf: string): number | null {
  const partes = encf.match(RE_ENCF);
  return partes?.[2] ? Number(partes[2]) : null;
}

function validarConteosGlobales(casos: readonly CasoSimulacionPaso4[], erroresGlobales: string[]): void {
  if (casos.length !== 25)
    erroresGlobales.push(`El set oficial del Paso 4 debe tener 25 casos; recibidos ${casos.length}`);
  const conteos = new Map<CategoriaSimulacionPaso4, number>();
  for (const caso of casos) conteos.set(caso.categoria, (conteos.get(caso.categoria) ?? 0) + 1);
  for (const [categoria, esperado] of Object.entries(CONTEO_OFICIAL_PASO4) as [CategoriaSimulacionPaso4, number][]) {
    const recibido = conteos.get(categoria) ?? 0;
    if (recibido !== esperado) {
      erroresGlobales.push(`La categoría ${categoria} debe tener ${esperado} casos; recibidos ${recibido}`);
    }
  }
}

function validarOrdenGlobal(casos: readonly CasoSimulacionPaso4[], erroresGlobales: string[]): void {
  casos.forEach((caso, indice) => {
    const categoriaEsperada = ORDEN_OFICIAL_CATEGORIAS[indice];
    if (caso.numeroCaso !== indice + 1) {
      erroresGlobales.push(`El caso en la posición ${indice + 1} tiene numeroCaso ${caso.numeroCaso}`);
    }
    let faseEsperada: FaseOrdenPaso4 = 3;
    if (indice < 18) faseEsperada = 1;
    else if (indice < 21) faseEsperada = 2;
    if (caso.faseOrden !== faseEsperada) {
      erroresGlobales.push(`El caso ${caso.numeroCaso} está en fase ${caso.faseOrden}; esperada ${faseEsperada}`);
    }
    if (categoriaEsperada && caso.categoria !== categoriaEsperada) {
      erroresGlobales.push(
        `El caso ${caso.numeroCaso} tiene categoría ${caso.categoria}; esperada ${categoriaEsperada} en el orden DGII`,
      );
    }
  });
}

function validarSecuenciasGlobales(casos: readonly CasoSimulacionPaso4[], erroresGlobales: string[]): void {
  const encfs = new Set<string>();
  const secuenciasPorTipo = new Map<TipoEcf, number[]>();
  for (const caso of casos) {
    const encf = caso.documento.comprobante.encf;
    if (encfs.has(encf)) erroresGlobales.push(`El e-NCF ${encf} está duplicado`);
    encfs.add(encf);
    const secuencia = extraerSecuenciaEncf(encf);
    if (secuencia === null) {
      erroresGlobales.push(`El e-NCF ${encf} no tiene el formato E + tipo + 10 dígitos`);
      continue;
    }
    const tipo = caso.documento.comprobante.tipo;
    secuenciasPorTipo.set(tipo, [...(secuenciasPorTipo.get(tipo) ?? []), secuencia]);
  }
  for (const [tipo, secuencias] of secuenciasPorTipo.entries()) {
    const ordenadas = [...secuencias].sort((izquierda, derecha) => izquierda - derecha);
    ordenadas.forEach((secuencia, indice) => {
      const anterior = ordenadas[indice - 1];
      if (indice > 0 && anterior !== undefined && secuencia !== anterior + 1) {
        erroresGlobales.push(`La serie E${tipo} tiene un salto o duplicado entre ${anterior} y ${secuencia}`);
      }
    });
  }
}

function casoPorCategoriaOrden(
  casos: readonly CasoSimulacionPaso4[],
  categoria: CategoriaSimulacionPaso4,
  ordinal: number,
): CasoSimulacionPaso4 | undefined {
  return casos.filter((caso) => caso.categoria === categoria)[ordinal - 1];
}

function validarReferenciasGlobales(casos: readonly CasoSimulacionPaso4[], erroresGlobales: string[]): void {
  const e31Primero = casoPorCategoriaOrden(casos, "31", 1);
  const e31Segundo = casoPorCategoriaOrden(casos, "31", 2);
  const e44Primero = casoPorCategoriaOrden(casos, "44", 1);
  const e33 = casoPorCategoriaOrden(casos, "33", 1);
  const e34Primero = casoPorCategoriaOrden(casos, "34", 1);
  const e34Segundo = casoPorCategoriaOrden(casos, "34", 2);
  if (e31Primero && e33 && e33.documento.comprobante.ncfModificado !== e31Primero.documento.comprobante.encf) {
    erroresGlobales.push("La nota de débito E33 debe modificar el primer E31");
  }
  if (e31Segundo && e34Primero) {
    if (e34Primero.documento.comprobante.ncfModificado !== e31Segundo.documento.comprobante.encf) {
      erroresGlobales.push("La primera nota de crédito E34 debe modificar el segundo E31");
    }
    if (e34Primero.documento.totales.montoTotal >= e31Segundo.documento.totales.montoTotal) {
      erroresGlobales.push("La primera nota de crédito E34 debe ser parcial y menor que el segundo E31");
    }
  }
  if (e44Primero && e34Segundo) {
    if (e34Segundo.documento.comprobante.ncfModificado !== e44Primero.documento.comprobante.encf) {
      erroresGlobales.push("La segunda nota de crédito E34 debe modificar el primer E44");
    }
    if (e34Segundo.documento.totales.montoTotal !== e44Primero.documento.totales.montoTotal) {
      erroresGlobales.push("La segunda nota de crédito E34 debe anular el monto total exacto del primer E44");
    }
  }
}

export function validarSetSimulacionPaso4Local(
  casos: readonly CasoSimulacionPaso4[],
): ResultadoSetValidacionPaso4Local {
  const erroresGlobales: string[] = [];
  validarConteosGlobales(casos, erroresGlobales);
  validarOrdenGlobal(casos, erroresGlobales);
  validarSecuenciasGlobales(casos, erroresGlobales);
  validarReferenciasGlobales(casos, erroresGlobales);
  const resultados = casos.map((caso) => validarCasoSimulacionPaso4Local(caso));
  const validos = resultados.filter((resultado) => resultado.valido).length;
  const invalidos = resultados.length - validos;
  return {
    valido: erroresGlobales.length === 0 && invalidos === 0,
    totalCasos: resultados.length,
    validos,
    invalidos,
    erroresGlobales,
    casos: resultados,
  };
}

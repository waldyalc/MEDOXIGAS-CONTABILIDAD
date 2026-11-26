export type AmbienteEcf = "testecf" | "certecf" | "ecf";

export type TipoEcf = "31" | "32" | "33" | "34" | "41" | "43" | "44" | "45" | "46" | "47";

export interface CatalogoTipoEcf {
  codigo: TipoEcf;
  prefijo: `E${TipoEcf}`;
  nombre: string;
  requiereRncComprador: boolean;
}

export const TIPOS_ECF = {
  "31": {
    codigo: "31",
    prefijo: "E31",
    nombre: "Factura de Crédito Fiscal Electrónica",
    requiereRncComprador: true,
  },
  "32": {
    codigo: "32",
    prefijo: "E32",
    nombre: "Factura de Consumo Electrónica",
    requiereRncComprador: false,
  },
  "33": {
    codigo: "33",
    prefijo: "E33",
    nombre: "Nota de Débito Electrónica",
    requiereRncComprador: false,
  },
  "34": {
    codigo: "34",
    prefijo: "E34",
    nombre: "Nota de Crédito Electrónica",
    requiereRncComprador: false,
  },
  "41": {
    codigo: "41",
    prefijo: "E41",
    nombre: "Comprobante de Compras Electrónico",
    requiereRncComprador: true,
  },
  "43": {
    codigo: "43",
    prefijo: "E43",
    nombre: "Comprobante de Gastos Menores Electrónico",
    requiereRncComprador: false,
  },
  "44": {
    codigo: "44",
    prefijo: "E44",
    nombre: "Comprobante de Regímenes Especiales Electrónico",
    requiereRncComprador: true,
  },
  "45": {
    codigo: "45",
    prefijo: "E45",
    nombre: "Comprobante Gubernamental Electrónico",
    requiereRncComprador: true,
  },
  "46": {
    codigo: "46",
    prefijo: "E46",
    nombre: "Comprobante de Exportaciones Electrónico",
    requiereRncComprador: true,
  },
  "47": {
    codigo: "47",
    prefijo: "E47",
    nombre: "Comprobante para Pagos al Exterior Electrónico",
    requiereRncComprador: false,
  },
} satisfies Record<TipoEcf, CatalogoTipoEcf>;

export type EstadoDgii = "pendiente" | "en_proceso" | "aceptado" | "aceptado_condicional" | "rechazado" | "error_red";

export type ModalidadHabilitacion = "nueva_habilitacion" | "migracion_proveedor";

export type PasoHabilitacionId = "certificado" | "postulacion" | "simulacion" | "impresion" | "urls" | "roles_ncf";

export type TipoIngresosEcf = "01" | "02" | "03" | "04" | "05" | "06";
export type TipoPagoEcf = "1" | "2" | "3";
export type IndicadorMontoGravadoEcf = "0" | "1";
export type IndicadorFacturacionEcf = "0" | "1" | "2" | "3" | "4";
export type IndicadorBienoServicioEcf = "1" | "2";
export type ItbisTasaEcf = 18 | 16 | 0;

export interface EmisorEcfInput {
  rnc: string;
  razonSocial: string;
  nombreComercial?: string;
  direccion: string;
  municipio?: string;
  provincia?: string;
  correo?: string;
}

export interface CompradorEcfInput {
  rnc?: string;
  razonSocial: string;
}

export interface ComprobanteEcfInput {
  tipo: TipoEcf;
  encf: string;
  fechaEmision: string;
  fechaVencimientoSecuencia: string;
  tipoIngresos: TipoIngresosEcf;
  tipoPago: TipoPagoEcf;
  indicadorMontoGravado?: IndicadorMontoGravadoEcf;
  ncfModificado?: string;
  fechaNcfModificado?: string;
  codigoModificacion?: string;
  fechaHoraFirma?: string;
}

export interface LineaEcfInput {
  numeroLinea: number;
  indicadorFacturacion: IndicadorFacturacionEcf;
  nombreItem: string;
  cantidad: number;
  unidadMedida?: string;
  precioUnitario: number;
  descuento?: number;
  itbisTasa: ItbisTasaEcf;
  montoItem: number;
  indicadorBienoServicio?: IndicadorBienoServicioEcf;
}

export interface TotalesEcfInput {
  montoGravadoI1: number;
  montoGravadoI2: number;
  montoGravadoI3?: number;
  montoExento: number;
  totalItbis1: number;
  totalItbis2: number;
  totalItbis3?: number;
  totalItbis: number;
  montoTotal: number;
}

export interface DocumentoEcfInput {
  emisor: EmisorEcfInput;
  comprador: CompradorEcfInput;
  comprobante: ComprobanteEcfInput;
  lineas: LineaEcfInput[];
  totales: TotalesEcfInput;
}

export interface MetadatosCertificado {
  titular: string;
  emisor: string;
  numeroSerie: string;
  validoDesde: Date;
  validoHasta: Date;
  vigente: boolean;
  diasRestantes: number;
  huellaSha256: string;
}

export interface ParCertificadoEcf {
  clavePrivadaPem: string;
  certificadoPem: string;
}

export type EstadoCasoSimulacion = "aprobado" | "fallido";

export interface ResultadoSimulacionCaso {
  numeroCaso: number;
  nombre: string;
  tipo: TipoEcf;
  estado: EstadoCasoSimulacion;
  encf: string;
  codigoSeguridad?: string;
  urlQr?: string;
  digestValue?: string;
  xmlFirmado?: string;
  xmlRfce?: string;
  duracionMs: number;
  error?: string;
}

export interface ResumenSetPruebas {
  ambiente: AmbienteEcf;
  rncEmisor: string;
  totalCasos: number;
  aprobados: number;
  fallidos: number;
  duracionMs: number;
  certificado: MetadatosCertificado;
  casos: ResultadoSimulacionCaso[];
}

export interface AcuseReciboInput {
  rncEmisor: string;
  rncComprador: string;
  encf: string;
  estado: "0" | "1";
  codigoMotivoNoRecibido?: "1" | "2" | "3" | "4";
  fechaHoraAcuseRecibo?: string;
}

export interface AprobacionComercialInput {
  rncEmisor: string;
  rncComprador: string;
  encf: string;
  fechaEmision: string;
  montoTotal: number;
  estado: "1" | "2";
  detalleMotivoRechazo?: string;
  fechaHoraAprobacionComercial?: string;
}

export interface RangoAnulacionEcf {
  desde: string;
  hasta: string;
}

export interface LineaAnulacionEcf {
  tipo: TipoEcf;
  rangos: RangoAnulacionEcf[];
}

export interface AnulacionEncfInput {
  rncEmisor: string;
  fechaHoraAnulacion?: string;
  anulaciones: LineaAnulacionEcf[];
}

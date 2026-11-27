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
export type IndicadorBinarioEcf = "1";
export type TipoCuentaPagoEcf = "CT" | "AH" | "OT";

export interface FormaPagoEcfInput {
  formaPago: string;
  montoPago?: number;
}

export interface EmisorEcfInput {
  rnc: string;
  razonSocial: string;
  nombreComercial?: string;
  sucursal?: string;
  direccion: string;
  municipio?: string;
  provincia?: string;
  telefonos?: string[];
  correo?: string;
  webSite?: string;
  actividadEconomica?: string;
  codigoVendedor?: string;
  numeroFacturaInterna?: string;
  numeroPedidoInterno?: string;
  zonaVenta?: string;
  rutaVenta?: string;
  informacionAdicionalEmisor?: string;
}

export interface CompradorEcfInput {
  rnc?: string;
  identificadorExtranjero?: string;
  razonSocial: string;
  contactoComprador?: string;
  correo?: string;
  direccionComprador?: string;
  municipioComprador?: string;
  provinciaComprador?: string;
  paisComprador?: string;
  fechaEntrega?: string;
  contactoEntrega?: string;
  direccionEntrega?: string;
  telefonoAdicional?: string;
  fechaOrdenCompra?: string;
  numeroOrdenCompra?: string;
  codigoInternoComprador?: string;
  responsablePago?: string;
  informacionAdicionalComprador?: string;
}

export interface ComprobanteEcfInput {
  tipo: TipoEcf;
  encf: string;
  fechaEmision: string;
  fechaVencimientoSecuencia?: string;
  indicadorNotaCredito?: "0" | "1";
  indicadorEnvioDiferido?: IndicadorBinarioEcf;
  indicadorMontoGravado?: IndicadorMontoGravadoEcf;
  indicadorServicioTodoIncluido?: IndicadorBinarioEcf;
  tipoIngresos: TipoIngresosEcf;
  tipoPago?: TipoPagoEcf;
  fechaLimitePago?: string;
  terminoPago?: string;
  formasPago?: FormaPagoEcfInput[];
  tipoCuentaPago?: TipoCuentaPagoEcf | string;
  numeroCuentaPago?: string;
  bancoPago?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  totalPaginas?: number;
  ncfModificado?: string;
  rncOtroContribuyente?: string;
  fechaNcfModificado?: string;
  codigoModificacion?: string;
  razonModificacion?: string;
  fechaHoraFirma?: string;
}

export type TipoValorAjusteEcf = "$" | "%";

export interface SubAjusteEcfInput {
  tipo: TipoValorAjusteEcf;
  porcentaje?: number;
  porcentajeTexto?: string;
  monto?: number;
}

export interface RetencionLineaEcfInput {
  indicadorAgenteRetencion: "1" | "2";
  montoItbisRetenido?: number;
  montoIsrRetenido?: number;
}

export interface CodigoItemEcfInput {
  tipoCodigo: string;
  codigoItem: string;
}

export interface SubcantidadEcfInput {
  subcantidad?: number;
  codigoSubcantidad?: string;
}

export interface ImpuestoAdicionalLineaEcfInput {
  tipoImpuesto: string;
}

export interface OtraMonedaDetalleEcfInput {
  precioOtraMoneda?: number;
  descuentoOtraMoneda?: number;
  recargoOtraMoneda?: number;
  montoItemOtraMoneda?: number;
}

export interface LineaEcfInput {
  numeroLinea: number;
  codigosItem?: CodigoItemEcfInput[];
  indicadorFacturacion: IndicadorFacturacionEcf;
  retencion?: RetencionLineaEcfInput;
  nombreItem: string;
  indicadorBienoServicio?: IndicadorBienoServicioEcf;
  descripcionItem?: string;
  cantidad: number;
  cantidadTexto?: string;
  unidadMedida?: string;
  cantidadReferencia?: number;
  cantidadReferenciaTexto?: string;
  unidadReferencia?: string;
  subcantidades?: SubcantidadEcfInput[];
  gradosAlcohol?: number;
  gradosAlcoholTexto?: string;
  precioUnitarioReferencia?: number;
  fechaElaboracion?: string;
  fechaVencimientoItem?: string;
  precioUnitario: number;
  precioUnitarioTexto?: string;
  descuento?: number;
  subDescuentos?: SubAjusteEcfInput[];
  recargo?: number;
  subRecargos?: SubAjusteEcfInput[];
  impuestosAdicionales?: ImpuestoAdicionalLineaEcfInput[];
  otraMoneda?: OtraMonedaDetalleEcfInput;
  itbisTasa: ItbisTasaEcf;
  montoItem: number;
}

export interface ImpuestoAdicionalEcfInput {
  tipoImpuesto: string;
  tasaImpuestoAdicional?: number;
  montoImpuestoSelectivoConsumoEspecifico?: number;
  montoImpuestoSelectivoConsumoAdvalorem?: number;
  otrosImpuestosAdicionales?: number;
}

export interface TotalesEcfInput {
  montoGravadoTotal?: number;
  montoGravadoI1: number;
  montoGravadoI2: number;
  montoGravadoI3?: number;
  montoExento: number;
  totalItbis1: number;
  totalItbis2: number;
  totalItbis3?: number;
  totalItbis: number;
  montoImpuestoAdicional?: number;
  impuestosAdicionales?: ImpuestoAdicionalEcfInput[];
  montoTotal: number;
  montoNoFacturable?: number;
  montoPeriodo?: number;
  saldoAnterior?: number;
  montoAvancePago?: number;
  valorPagar?: number;
  totalItbisRetenido?: number;
  totalIsrRetencion?: number;
  totalItbisPercepcion?: number;
  totalIsrPercepcion?: number;
}

export interface DescuentoORecargoGlobalEcfInput {
  numeroLinea: number;
  tipoAjuste: "D" | "R";
  indicadorNorma1007?: "0" | "1";
  descripcion?: string;
  tipoValor?: TipoValorAjusteEcf;
  valor?: number;
  monto: number;
  montoOtraMoneda?: number;
  indicadorFacturacion?: IndicadorFacturacionEcf;
}

export interface OtraMonedaEcfInput {
  tipoMoneda: string;
  tipoCambio: number;
  tipoCambioTexto?: string;
  montoGravadoTotalOtraMoneda?: number;
  montoGravado1OtraMoneda?: number;
  montoGravado2OtraMoneda?: number;
  montoGravado3OtraMoneda?: number;
  montoExentoOtraMoneda?: number;
  totalItbisOtraMoneda?: number;
  totalItbis1OtraMoneda?: number;
  totalItbis2OtraMoneda?: number;
  totalItbis3OtraMoneda?: number;
  montoImpuestoAdicionalOtraMoneda?: number;
  impuestosAdicionalesOtraMoneda?: ImpuestoAdicionalEcfInput[];
  montoTotalOtraMoneda: number;
}

export interface InformacionesAdicionalesEcfInput {
  fechaEmbarque?: string;
  numeroEmbarque?: string;
  numeroContenedor?: string;
  numeroReferencia?: string;
  nombrePuertoEmbarque?: string;
  condicionesEntrega?: string;
  totalFob?: number;
  seguro?: number;
  flete?: number;
  otrosGastos?: number;
  totalCif?: number;
  regimenAduanero?: string;
  nombrePuertoSalida?: string;
  nombrePuertoDesembarque?: string;
  pesoBruto?: number;
  pesoNeto?: number;
  unidadPesoBruto?: string;
  unidadPesoNeto?: string;
  cantidadBulto?: number;
  unidadBulto?: string;
  volumenBulto?: number;
  unidadVolumen?: string;
}

export interface TransporteEcfInput {
  viaTransporte?: string;
  paisOrigen?: string;
  direccionDestino?: string;
  paisDestino?: string;
  rncIdentificacionCompaniaTransportista?: string;
  nombreCompaniaTransportista?: string;
  numeroViaje?: string;
  conductor?: string;
  documentoTransporte?: string;
  ficha?: string;
  placa?: string;
  rutaTransporte?: string;
  zonaTransporte?: string;
  numeroAlbaran?: string;
}

export interface DocumentoEcfInput {
  emisor: EmisorEcfInput;
  comprador: CompradorEcfInput;
  comprobante: ComprobanteEcfInput;
  informacionesAdicionales?: InformacionesAdicionalesEcfInput;
  transporte?: TransporteEcfInput;
  lineas: LineaEcfInput[];
  totales: TotalesEcfInput;
  descuentosORecargos?: DescuentoORecargoGlobalEcfInput[];
  otraMoneda?: OtraMonedaEcfInput;
}

export interface ResumenRfceDgii {
  tipo: "32";
  encf: string;
  tipoIngresos: TipoIngresosEcf;
  tipoPago?: TipoPagoEcf;
  formasPago?: FormaPagoEcfInput[];
  rncEmisor: string;
  razonSocialEmisor: string;
  fechaEmision: string;
  rncComprador?: string;
  identificadorExtranjero?: string;
  razonSocialComprador?: string;
  totales: TotalesEcfInput;
  codigoSeguridadeCF?: string;
}

export interface CasoExcelDgii {
  casoPrueba: string;
  numeroFila: number;
  documento: DocumentoEcfInput;
  rfce?: ResumenRfceDgii;
  columnasNoReconocidas: string[];
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
  montoTotalTexto?: string;
  estado: "1" | "2";
  detalleMotivoRechazo?: string;
  fechaHoraAprobacionComercial?: string;
}

export interface CasoExcelAcecfDgii {
  numeroFila: number;
  version: string;
  aprobacion: AprobacionComercialInput;
  montoTotalTexto: string;
  fechaEmisionLiteral: string;
  fechaHoraAprobacionLiteral: string;
  nombreArchivoAcecf: string;
  columnasNoReconocidas: string[];
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

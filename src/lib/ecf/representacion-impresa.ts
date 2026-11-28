import { construirUrlQrDgii } from "./endpoints";
import type { AmbienteEcf, TipoEcf } from "./tipos";
import { TIPOS_ECF } from "./tipos";
import { formatearMontoDgii } from "./xml";

export interface FormaPagoRi {
  formaPago: string;
  formaPagoEtiqueta: string;
  montoPago: number | null;
}

export interface EmisorRi {
  rnc: string;
  razonSocial: string;
  sucursal: string | null;
  direccion: string | null;
  municipio: string | null;
  provincia: string | null;
  correo: string | null;
  fechaEmision: string;
}

export interface CompradorRi {
  rnc: string | null;
  identificadorExtranjero: string | null;
  razonSocial: string;
}

export interface TransporteRi {
  paisDestino: string | null;
}

export interface TotalesRi {
  montoGravadoTotal: number | null;
  montoGravadoI1: number | null;
  montoGravadoI2: number | null;
  montoGravadoI3: number | null;
  montoExento: number | null;
  itbis1: number | null;
  itbis2: number | null;
  itbis3: number | null;
  totalItbis: number | null;
  totalItbis1: number | null;
  totalItbis2: number | null;
  totalItbis3: number | null;
  montoTotal: number;
  totalItbisRetenido: number | null;
  totalIsrRetencion: number | null;
}

export interface RetencionRi {
  indicadorAgenteRetencionoPercepcion: string;
  montoItbisRetenido: number | null;
  montoIsrRetenido: number | null;
}

export interface SubDescuentoRi {
  tipoSubDescuento: string | null;
  porcentajeSubDescuento: number | null;
  montoSubDescuento: number | null;
}

export interface ItemRi {
  numeroLinea: number;
  indicadorFacturacion: string;
  indicadorFacturacionEtiqueta: string;
  retencion: RetencionRi | null;
  nombreItem: string;
  indicadorBienoServicio: string;
  indicadorBienoServicioEtiqueta: string;
  cantidadItem: number;
  unidadMedida: string | null;
  unidadMedidaEtiqueta: string | null;
  precioUnitarioItem: number;
  descuentoMonto: number | null;
  subDescuentos: SubDescuentoRi[];
  montoItem: number;
  tasaItbis: number | null;
}

export interface InformacionReferenciaRi {
  ncfModificado: string;
  fechaNcfModificado: string | null;
  codigoModificacion: string | null;
  codigoModificacionEtiqueta: string | null;
  razonModificacion: string | null;
}

export interface DatosRi {
  tipoEcf: TipoEcf;
  tipoEcfNombre: string;
  encf: string;
  fechaVencimientoSecuencia: string | null;
  indicadorMontoGravado: string | null;
  tipoIngresos: string | null;
  tipoPago: string | null;
  tipoPagoEtiqueta: string | null;
  formasPago: FormaPagoRi[];
  fechaLimitePago: string | null;
  indicadorNotaCredito: string | null;
  indicadorNotaCreditoEtiqueta: string | null;
  emisor: EmisorRi;
  comprador: CompradorRi | null;
  transporte: TransporteRi | null;
  totales: TotalesRi;
  items: ItemRi[];
  informacionReferencia: InformacionReferenciaRi | null;
  fechaHoraFirma: string;
  codigoSeguridad: string;
  urlQr: string | null;
}

export interface OpcionesUrlQrRi {
  ambiente: AmbienteEcf;
  esRfce: boolean;
}

export const ETIQUETAS_TIPO_PAGO: Record<string, string> = {
  "1": "Contado",
  "2": "Crédito",
  "3": "Gratuito",
};

export const ETIQUETAS_FORMA_PAGO: Record<string, string> = {
  "1": "Efectivo",
  "2": "Cheque/Transferencia/Depósito",
  "3": "Tarjeta Débito/Crédito",
  "4": "Venta a Crédito",
  "5": "Bonos/Certificados de regalo",
  "6": "Permuta",
  "7": "Nota de crédito",
};

export const ETIQUETAS_CODIGO_MODIFICACION: Record<string, string> = {
  "1": "Anulación del comprobante",
  "2": "Corrección de texto",
  "3": "Corrección de montos",
  "4": "Reemplazo NCF emitido en contingencia",
  "5": "Referencia Factura Consumo Electrónica",
};

export const ETIQUETAS_INDICADOR_FACTURACION: Record<string, string> = {
  "1": "Gravada ITBIS1 (18%)",
  "2": "Gravada ITBIS2 (16%)",
  "3": "Gravada ITBIS3 (0%)",
  "4": "Exenta",
};

export const ETIQUETAS_INDICADOR_BIENO_SERVICIO: Record<string, string> = {
  "1": "Bien",
  "2": "Servicio",
};

export const ETIQUETAS_INDICADOR_NOTA_CREDITO: Record<string, string> = {
  "0": "Valor Fiscal",
  "1": "Valor No Fiscal",
};

interface UnidadMedidaCatalogo {
  abreviatura: string;
  nombre: string;
}

export const UNIDADES_MEDIDA_ECF: Record<string, UnidadMedidaCatalogo> = {
  "1": { abreviatura: "BARR", nombre: "Barril" },
  "2": { abreviatura: "BOL", nombre: "Bolsa" },
  "3": { abreviatura: "BOT", nombre: "Bote" },
  "4": { abreviatura: "BULTO", nombre: "Bultos" },
  "5": { abreviatura: "BOTELLA", nombre: "Botella" },
  "6": { abreviatura: "CAJ", nombre: "Caja/Cajón" },
  "7": { abreviatura: "CAJETILLA", nombre: "Cajetilla" },
  "8": { abreviatura: "CM", nombre: "Centímetro" },
  "9": { abreviatura: "CIL", nombre: "Cilindro" },
  "10": { abreviatura: "CONJ", nombre: "Conjunto" },
  "11": { abreviatura: "CONT", nombre: "Contenedor" },
  "12": { abreviatura: "DÍA", nombre: "Día" },
  "13": { abreviatura: "DOC", nombre: "Docena" },
  "14": { abreviatura: "FARD", nombre: "Fardo" },
  "15": { abreviatura: "GL", nombre: "Galones" },
  "16": { abreviatura: "GRAD", nombre: "Grado" },
  "17": { abreviatura: "GR", nombre: "Gramo" },
  "18": { abreviatura: "GRAN", nombre: "Granel" },
  "19": { abreviatura: "HOR", nombre: "Hora" },
  "20": { abreviatura: "HUAC", nombre: "Huacal" },
  "21": { abreviatura: "KG", nombre: "Kilogramo" },
  "22": { abreviatura: "kWh", nombre: "Kilovatio Hora" },
  "23": { abreviatura: "LB", nombre: "Libra" },
  "24": { abreviatura: "LITRO", nombre: "Litro" },
  "25": { abreviatura: "LOT", nombre: "Lote" },
  "26": { abreviatura: "M", nombre: "Metro" },
  "27": { abreviatura: "M2", nombre: "Metro Cuadrado" },
  "28": { abreviatura: "M3", nombre: "Metro Cúbico" },
  "29": { abreviatura: "MMBTU", nombre: "Millones de Unidades Térmicas" },
  "30": { abreviatura: "MIN", nombre: "Minuto" },
  "31": { abreviatura: "PAQ", nombre: "Paquete" },
  "32": { abreviatura: "PAR", nombre: "Par" },
  "33": { abreviatura: "PIE", nombre: "Pie" },
  "34": { abreviatura: "PZA", nombre: "Pieza" },
  "35": { abreviatura: "ROL", nombre: "Rollo" },
  "36": { abreviatura: "SOBR", nombre: "Sobre" },
  "37": { abreviatura: "SEG", nombre: "Segundo" },
  "38": { abreviatura: "TANQUE", nombre: "Tanque" },
  "39": { abreviatura: "TONE", nombre: "Tonelada" },
  "40": { abreviatura: "TUB", nombre: "Tubo" },
  "41": { abreviatura: "YD", nombre: "Yarda" },
  "42": { abreviatura: "YD2", nombre: "Yarda cuadrada" },
  "43": { abreviatura: "UND", nombre: "Unidad" },
  "44": { abreviatura: "EA", nombre: "Elemento" },
  "45": { abreviatura: "MILLAR", nombre: "Millar" },
  "46": { abreviatura: "SAC", nombre: "Saco" },
  "47": { abreviatura: "LAT", nombre: "Lata" },
  "48": { abreviatura: "DIS", nombre: "Display" },
  "49": { abreviatura: "BID", nombre: "Bidón" },
  "50": { abreviatura: "RAC", nombre: "Ración" },
  "51": { abreviatura: "Q", nombre: "Quintal" },
  "52": { abreviatura: "GRT", nombre: "Toneladas de registro bruto" },
  "53": { abreviatura: "P2", nombre: "Pie Cuadrado" },
  "54": { abreviatura: "PAX", nombre: "Pasajero" },
  "55": { abreviatura: "PULG", nombre: "Pulgadas" },
  "56": { abreviatura: "STAY", nombre: "Parqueo Barcos En Muelle" },
  "57": { abreviatura: "BDJ", nombre: "Bandeja" },
  "58": { abreviatura: "HA", nombre: "Hectárea" },
  "59": { abreviatura: "ML", nombre: "Mililitro" },
  "60": { abreviatura: "MG", nombre: "Miligramo" },
  "61": { abreviatura: "OZ", nombre: "Onzas" },
  "62": { abreviatura: "OZT", nombre: "Onzas Troy" },
};

const ENTIDADES_XML: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function regexBloque(tag: string, global = false): RegExp {
  return new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, global ? "g" : "");
}

function extraerBloque(xml: string, tag: string): string | null {
  return xml.match(regexBloque(tag))?.[1] ?? null;
}

function extraerBloques(xml: string, tag: string): string[] {
  return Array.from(xml.matchAll(regexBloque(tag, true)), (coincidencia) => coincidencia[1] ?? "");
}

function bloqueRequerido(xml: string, tag: string, contexto: string): string {
  const bloque = extraerBloque(xml, tag);
  if (bloque == null) throw new Error(`El XML de representación impresa no contiene ${tag} en ${contexto}`);
  return bloque;
}

function decodificarEntidadesXml(texto: string): string {
  return texto.replace(/&(amp|lt|gt|quot|apos|#x[0-9a-fA-F]+|#\d+);/g, (entidad, cuerpo: string) => {
    if (cuerpo.startsWith("#x")) {
      const codigo = Number.parseInt(cuerpo.slice(2), 16);
      return Number.isFinite(codigo) ? String.fromCodePoint(codigo) : entidad;
    }
    if (cuerpo.startsWith("#")) {
      const codigo = Number.parseInt(cuerpo.slice(1), 10);
      return Number.isFinite(codigo) ? String.fromCodePoint(codigo) : entidad;
    }
    return ENTIDADES_XML[cuerpo] ?? entidad;
  });
}

function textoOpcional(bloque: string, tag: string): string | null {
  const interno = extraerBloque(bloque, tag);
  if (interno == null) return null;
  const texto = decodificarEntidadesXml(interno).trim();
  return texto === "" ? null : texto;
}

function textoRequerido(bloque: string, tag: string, contexto: string): string {
  const texto = textoOpcional(bloque, tag);
  if (texto == null) throw new Error(`Falta ${tag} en ${contexto} del XML firmado`);
  return texto;
}

function numeroDesdeTexto(texto: string, tag: string, contexto: string): number {
  const numero = Number(texto);
  if (!Number.isFinite(numero)) throw new Error(`${tag} no es numérico en ${contexto}: ${texto}`);
  return numero;
}

function numeroOpcional(bloque: string, tag: string, contexto: string): number | null {
  const texto = textoOpcional(bloque, tag);
  return texto == null ? null : numeroDesdeTexto(texto, tag, contexto);
}

function numeroRequerido(bloque: string, tag: string, contexto: string): number {
  return numeroDesdeTexto(textoRequerido(bloque, tag, contexto), tag, contexto);
}

function enteroRequerido(bloque: string, tag: string, contexto: string): number {
  const numero = numeroRequerido(bloque, tag, contexto);
  if (!Number.isInteger(numero)) throw new Error(`${tag} debe ser entero en ${contexto}`);
  return numero;
}

function etiqueta(catalogo: Record<string, string>, codigo: string): string {
  return catalogo[codigo] ?? `Código ${codigo}`;
}

export function etiquetaUnidadMedida(codigo: string): string {
  const unidad = UNIDADES_MEDIDA_ECF[codigo];
  return unidad ? unidad.nombre : `UM ${codigo}`;
}

function esTipoEcf(codigo: string): codigo is TipoEcf {
  return codigo in TIPOS_ECF;
}

function tasaItbisPorIndicador(codigo: string): number | null {
  if (codigo === "1") return 18;
  if (codigo === "2") return 16;
  if (codigo === "3" || codigo === "4") return 0;
  return null;
}

export function extraerCodigoSeguridadXml(xml: string): string {
  const valor = textoRequerido(xml, "SignatureValue", "la firma digital");
  const compacto = valor.replace(/\s+/g, "");
  if (compacto.length < 6) throw new Error("SignatureValue es demasiado corto para derivar el código de seguridad");
  return compacto.slice(0, 6);
}

function parsearFormasPago(idDoc: string): FormaPagoRi[] {
  const tabla = extraerBloque(idDoc, "TablaFormasPago");
  if (tabla == null) return [];
  return extraerBloques(tabla, "FormaDePago").map((formaXml, indice) => {
    const formaPago = textoRequerido(formaXml, "FormaPago", `la forma de pago ${indice + 1}`);
    return {
      formaPago,
      formaPagoEtiqueta: etiqueta(ETIQUETAS_FORMA_PAGO, formaPago),
      montoPago: numeroOpcional(formaXml, "MontoPago", `la forma de pago ${indice + 1}`),
    };
  });
}

function parsearRetencion(itemXml: string, numeroLinea: number): RetencionRi | null {
  const retencionXml = extraerBloque(itemXml, "Retencion");
  if (retencionXml == null) return null;
  const contexto = `la retención de la línea ${numeroLinea}`;
  return {
    indicadorAgenteRetencionoPercepcion: textoRequerido(retencionXml, "IndicadorAgenteRetencionoPercepcion", contexto),
    montoItbisRetenido: numeroOpcional(retencionXml, "MontoITBISRetenido", contexto),
    montoIsrRetenido: numeroOpcional(retencionXml, "MontoISRRetenido", contexto),
  };
}

function parsearSubDescuentos(itemXml: string, numeroLinea: number): SubDescuentoRi[] {
  const tabla = extraerBloque(itemXml, "TablaSubDescuento");
  if (tabla == null) return [];
  return extraerBloques(tabla, "SubDescuento").map((subDescuentoXml, indice) => {
    const contexto = `el subdescuento ${indice + 1} de la línea ${numeroLinea}`;
    return {
      tipoSubDescuento: textoOpcional(subDescuentoXml, "TipoSubDescuento"),
      porcentajeSubDescuento: numeroOpcional(subDescuentoXml, "PorcentajeSubDescuento", contexto),
      montoSubDescuento: numeroOpcional(subDescuentoXml, "MontoSubDescuento", contexto),
    };
  });
}

function parsearItem(itemXml: string, indice: number): ItemRi {
  const contexto = `el ítem ${indice + 1}`;
  const numeroLinea = enteroRequerido(itemXml, "NumeroLinea", contexto);
  const indicadorFacturacion = textoRequerido(itemXml, "IndicadorFacturacion", contexto);
  const indicadorBienoServicio = textoRequerido(itemXml, "IndicadorBienoServicio", contexto);
  const unidadMedida = textoOpcional(itemXml, "UnidadMedida");

  return {
    numeroLinea,
    indicadorFacturacion,
    indicadorFacturacionEtiqueta: etiqueta(ETIQUETAS_INDICADOR_FACTURACION, indicadorFacturacion),
    retencion: parsearRetencion(itemXml, numeroLinea),
    nombreItem: textoRequerido(itemXml, "NombreItem", contexto),
    indicadorBienoServicio,
    indicadorBienoServicioEtiqueta: etiqueta(ETIQUETAS_INDICADOR_BIENO_SERVICIO, indicadorBienoServicio),
    cantidadItem: numeroRequerido(itemXml, "CantidadItem", contexto),
    unidadMedida,
    unidadMedidaEtiqueta: unidadMedida == null ? null : etiquetaUnidadMedida(unidadMedida),
    precioUnitarioItem: numeroRequerido(itemXml, "PrecioUnitarioItem", contexto),
    descuentoMonto: numeroOpcional(itemXml, "DescuentoMonto", contexto),
    subDescuentos: parsearSubDescuentos(itemXml, numeroLinea),
    montoItem: numeroRequerido(itemXml, "MontoItem", contexto),
    tasaItbis: tasaItbisPorIndicador(indicadorFacturacion),
  };
}

function parsearInformacionReferencia(xml: string): InformacionReferenciaRi | null {
  const referenciaXml = extraerBloque(xml, "InformacionReferencia");
  if (referenciaXml == null) return null;
  const codigoModificacion = textoOpcional(referenciaXml, "CodigoModificacion");
  return {
    ncfModificado: textoRequerido(referenciaXml, "NCFModificado", "InformacionReferencia"),
    fechaNcfModificado: textoOpcional(referenciaXml, "FechaNCFModificado"),
    codigoModificacion,
    codigoModificacionEtiqueta:
      codigoModificacion == null ? null : etiqueta(ETIQUETAS_CODIGO_MODIFICACION, codigoModificacion),
    razonModificacion: textoOpcional(referenciaXml, "RazonModificacion"),
  };
}

export function parsearRepresentacionImpresaXml(xml: string): DatosRi {
  if (!/<ECF(?:\s|>)/.test(xml)) throw new Error("El documento no es un XML e-CF");
  const encabezado = bloqueRequerido(xml, "Encabezado", "ECF");
  const idDoc = bloqueRequerido(encabezado, "IdDoc", "Encabezado");
  const emisorXml = bloqueRequerido(encabezado, "Emisor", "Encabezado");
  const totalesXml = bloqueRequerido(encabezado, "Totales", "Encabezado");
  const detallesXml = bloqueRequerido(xml, "DetallesItems", "ECF");

  const tipoTexto = textoRequerido(idDoc, "TipoeCF", "IdDoc");
  if (!esTipoEcf(tipoTexto)) throw new Error(`TipoeCF no soportado en representación impresa: ${tipoTexto}`);
  const tipoPago = textoOpcional(idDoc, "TipoPago");
  const indicadorNotaCredito = textoOpcional(idDoc, "IndicadorNotaCredito");

  const compradorXml = extraerBloque(encabezado, "Comprador");
  const comprador =
    compradorXml == null
      ? null
      : {
          rnc: textoOpcional(compradorXml, "RNCComprador"),
          identificadorExtranjero: textoOpcional(compradorXml, "IdentificadorExtranjero"),
          razonSocial: textoRequerido(compradorXml, "RazonSocialComprador", "Comprador"),
        };

  const transporteXml = extraerBloque(encabezado, "Transporte");
  const items = extraerBloques(detallesXml, "Item").map((itemXml, indice) => parsearItem(itemXml, indice));
  if (items.length === 0) throw new Error("El XML firmado no contiene ítems en DetallesItems");

  return {
    tipoEcf: tipoTexto,
    tipoEcfNombre: TIPOS_ECF[tipoTexto].nombre,
    encf: textoRequerido(idDoc, "eNCF", "IdDoc"),
    fechaVencimientoSecuencia: textoOpcional(idDoc, "FechaVencimientoSecuencia"),
    indicadorMontoGravado: textoOpcional(idDoc, "IndicadorMontoGravado"),
    tipoIngresos: textoOpcional(idDoc, "TipoIngresos"),
    tipoPago,
    tipoPagoEtiqueta: tipoPago == null ? null : etiqueta(ETIQUETAS_TIPO_PAGO, tipoPago),
    formasPago: parsearFormasPago(idDoc),
    fechaLimitePago: textoOpcional(idDoc, "FechaLimitePago"),
    indicadorNotaCredito,
    indicadorNotaCreditoEtiqueta:
      indicadorNotaCredito == null ? null : etiqueta(ETIQUETAS_INDICADOR_NOTA_CREDITO, indicadorNotaCredito),
    emisor: {
      rnc: textoRequerido(emisorXml, "RNCEmisor", "Emisor"),
      razonSocial: textoRequerido(emisorXml, "RazonSocialEmisor", "Emisor"),
      sucursal: textoOpcional(emisorXml, "Sucursal"),
      direccion: textoOpcional(emisorXml, "DireccionEmisor"),
      municipio: textoOpcional(emisorXml, "Municipio"),
      provincia: textoOpcional(emisorXml, "Provincia"),
      correo: textoOpcional(emisorXml, "CorreoEmisor"),
      fechaEmision: textoRequerido(emisorXml, "FechaEmision", "Emisor"),
    },
    comprador,
    transporte: transporteXml == null ? null : { paisDestino: textoOpcional(transporteXml, "PaisDestino") },
    totales: {
      montoGravadoTotal: numeroOpcional(totalesXml, "MontoGravadoTotal", "Totales"),
      montoGravadoI1: numeroOpcional(totalesXml, "MontoGravadoI1", "Totales"),
      montoGravadoI2: numeroOpcional(totalesXml, "MontoGravadoI2", "Totales"),
      montoGravadoI3: numeroOpcional(totalesXml, "MontoGravadoI3", "Totales"),
      montoExento: numeroOpcional(totalesXml, "MontoExento", "Totales"),
      itbis1: numeroOpcional(totalesXml, "ITBIS1", "Totales"),
      itbis2: numeroOpcional(totalesXml, "ITBIS2", "Totales"),
      itbis3: numeroOpcional(totalesXml, "ITBIS3", "Totales"),
      totalItbis: numeroOpcional(totalesXml, "TotalITBIS", "Totales"),
      totalItbis1: numeroOpcional(totalesXml, "TotalITBIS1", "Totales"),
      totalItbis2: numeroOpcional(totalesXml, "TotalITBIS2", "Totales"),
      totalItbis3: numeroOpcional(totalesXml, "TotalITBIS3", "Totales"),
      montoTotal: numeroRequerido(totalesXml, "MontoTotal", "Totales"),
      totalItbisRetenido: numeroOpcional(totalesXml, "TotalITBISRetenido", "Totales"),
      totalIsrRetencion: numeroOpcional(totalesXml, "TotalISRRetencion", "Totales"),
    },
    items,
    informacionReferencia: parsearInformacionReferencia(xml),
    fechaHoraFirma: textoRequerido(xml, "FechaHoraFirma", "ECF"),
    codigoSeguridad: extraerCodigoSeguridadXml(xml),
    urlQr: null,
  };
}

export function construirUrlQrDesdeRi(datos: DatosRi, opciones: OpcionesUrlQrRi): string {
  return construirUrlQrDgii({
    ambiente: opciones.ambiente,
    rncEmisor: datos.emisor.rnc,
    rncComprador: datos.comprador?.rnc ?? "",
    encf: datos.encf,
    fechaEmision: datos.emisor.fechaEmision,
    montoTotal: formatearMontoDgii(datos.totales.montoTotal),
    fechaFirma: datos.fechaHoraFirma,
    codigoSeguridad: datos.codigoSeguridad,
    esRfce: opciones.esRfce,
  });
}

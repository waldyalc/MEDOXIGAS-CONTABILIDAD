import { construirUrlQrDgii } from "./endpoints";
import {
  firmarXmlDsig,
  generarCertificadoPruebaAutocontenido,
  leerMetadatosCertificado,
  verificarFirmaXmlDsig,
} from "./firma";
import type {
  AmbienteEcf,
  DocumentoEcfInput,
  IndicadorFacturacionEcf,
  ItbisTasaEcf,
  LineaEcfInput,
  ResultadoSimulacionCaso,
  ResumenSetPruebas,
  TipoEcf,
  TotalesEcfInput,
} from "./tipos";
import { validarXmlContraEsquemaDgii } from "./validador-xsd";
import {
  esElegibleRfce,
  formatearFechaDgii,
  formatearMontoDgii,
  generarXmlEcf,
  generarXmlRfce,
  validarDocumentoEcf,
} from "./xml";

export interface EjecutarSetPruebasSimulacionArgs {
  rncEmisor: string;
  razonSocial: string;
  ambiente?: AmbienteEcf;
  clavePrivadaPem?: string;
  certificadoPem?: string;
}

interface CasoSetPruebas {
  numeroCaso: number;
  nombre: string;
  documento: DocumentoEcfInput;
  incluirRfce: boolean;
}

function centavos(valor: number): number {
  return Math.round(valor * 100);
}

function desdeCentavos(valor: number): number {
  return valor / 100;
}

function redondear2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function linea(
  numeroLinea: number,
  nombreItem: string,
  cantidad: number,
  precioUnitario: number,
  indicadorFacturacion: IndicadorFacturacionEcf,
  itbisTasa: ItbisTasaEcf,
): LineaEcfInput {
  return {
    numeroLinea,
    indicadorFacturacion,
    nombreItem,
    cantidad,
    unidadMedida: "43",
    precioUnitario,
    descuento: 0,
    itbisTasa,
    montoItem: redondear2(cantidad * precioUnitario),
    indicadorBienoServicio: "1",
  };
}

function calcularTotales(lineas: LineaEcfInput[]): TotalesEcfInput {
  const sumaPorIndicador = (indicador: IndicadorFacturacionEcf) =>
    lineas
      .filter((lineaActual) => lineaActual.indicadorFacturacion === indicador)
      .reduce((suma, lineaActual) => suma + centavos(lineaActual.montoItem), 0);
  const gravadoI1 = sumaPorIndicador("1");
  const gravadoI2 = sumaPorIndicador("2");
  const gravadoI3 = sumaPorIndicador("3");
  const exento = sumaPorIndicador("4");
  const itbis1 = Math.round(gravadoI1 * 0.18);
  const itbis2 = Math.round(gravadoI2 * 0.16);
  const itbis3 = 0;
  return {
    montoGravadoI1: desdeCentavos(gravadoI1),
    montoGravadoI2: desdeCentavos(gravadoI2),
    montoGravadoI3: desdeCentavos(gravadoI3),
    montoExento: desdeCentavos(exento),
    totalItbis1: desdeCentavos(itbis1),
    totalItbis2: desdeCentavos(itbis2),
    totalItbis3: 0,
    totalItbis: desdeCentavos(itbis1 + itbis2 + itbis3),
    montoTotal: desdeCentavos(gravadoI1 + gravadoI2 + gravadoI3 + exento + itbis1 + itbis2 + itbis3),
  };
}

interface OpcionesDocumentoCaso {
  rncComprador?: string;
  razonSocialComprador?: string;
  encfModificado?: string;
  codigoModificacion?: string;
}

function documentoCaso(
  tipo: TipoEcf,
  encf: string,
  rncEmisor: string,
  razonSocial: string,
  lineas: LineaEcfInput[],
  opciones: OpcionesDocumentoCaso = {},
): DocumentoEcfInput {
  return {
    emisor: {
      rnc: rncEmisor,
      razonSocial,
      nombreComercial: razonSocial,
      direccion: "Av. Independencia No. 100, Santo Domingo",
      municipio: "010100",
      provincia: "010000",
      correo: "facturacion@example.com",
    },
    comprador: {
      rnc: opciones.rncComprador,
      razonSocial: opciones.razonSocialComprador ?? "CLIENTE DE PRUEBA ECF SRL",
    },
    comprobante: {
      tipo,
      encf,
      fechaEmision: "26-11-2026",
      fechaVencimientoSecuencia: "31-12-2026",
      tipoIngresos: "01",
      tipoPago: tipo === "31" ? "2" : "1",
      indicadorMontoGravado: "0",
      ncfModificado: opciones.encfModificado,
      fechaNcfModificado: opciones.encfModificado ? "20-11-2026" : undefined,
      codigoModificacion: opciones.codigoModificacion,
      fechaHoraFirma: "26-11-2026 10:00:00",
    },
    lineas,
    totales: calcularTotales(lineas),
  };
}

function construirCasos(rncEmisor: string, razonSocial: string): CasoSetPruebas[] {
  const rncComprador = "130999999";
  const referenciaE31 = { encfModificado: "E310000000001", codigoModificacion: "3" };
  return [
    {
      numeroCaso: 1,
      nombre: "E31 — Factura de Crédito Fiscal con ITBIS 18 %",
      documento: documentoCaso(
        "31",
        "E310000000001",
        rncEmisor,
        razonSocial,
        [linea(1, "Oxígeno medicinal", 2, 500, "1", 18)],
        {
          rncComprador,
        },
      ),
      incluirRfce: false,
    },
    {
      numeroCaso: 2,
      nombre: "E32 — Factura de Consumo mayor o igual a RD$250,000",
      documento: documentoCaso(
        "32",
        "E320000000001",
        rncEmisor,
        razonSocial,
        [linea(1, "Equipo de oxigenoterapia", 1, 220000, "1", 18)],
        {
          rncComprador,
        },
      ),
      incluirRfce: false,
    },
    {
      numeroCaso: 3,
      nombre: "E32 + RFCE — Factura de Consumo menor de RD$250,000",
      documento: documentoCaso(
        "32",
        "E320000000002",
        rncEmisor,
        razonSocial,
        [linea(1, "Mascarilla de oxígeno", 1, 1000, "1", 18)],
        {
          razonSocialComprador: "CONSUMIDOR FINAL",
        },
      ),
      incluirRfce: true,
    },
    {
      numeroCaso: 4,
      nombre: "E33 — Nota de Débito Electrónica referenciando E31",
      documento: documentoCaso(
        "33",
        "E330000000001",
        rncEmisor,
        razonSocial,
        [linea(1, "Ajuste por servicio adicional", 1, 100, "1", 18)],
        {
          rncComprador,
          ...referenciaE31,
        },
      ),
      incluirRfce: false,
    },
    {
      numeroCaso: 5,
      nombre: "E34 — Nota de Crédito Electrónica referenciando E31",
      documento: documentoCaso(
        "34",
        "E340000000001",
        rncEmisor,
        razonSocial,
        [linea(1, "Rebaja aplicada a factura", 1, 100, "1", 18)],
        {
          rncComprador,
          ...referenciaE31,
        },
      ),
      incluirRfce: false,
    },
    {
      numeroCaso: 6,
      nombre: "E41 — Comprobante de Compras Electrónico",
      documento: documentoCaso(
        "41",
        "E410000000001",
        rncEmisor,
        razonSocial,
        [linea(1, "Compra de insumos médicos", 1, 500, "1", 18)],
        {
          rncComprador,
        },
      ),
      incluirRfce: false,
    },
    {
      numeroCaso: 7,
      nombre: "E43 — Comprobante de Gastos Menores Electrónico",
      documento: documentoCaso("43", "E430000000001", rncEmisor, razonSocial, [
        linea(1, "Gasto menor de oficina", 1, 350, "4", 0),
      ]),
      incluirRfce: false,
    },
    {
      numeroCaso: 8,
      nombre: "E44 — Comprobante de Regímenes Especiales Electrónico exento",
      documento: documentoCaso(
        "44",
        "E440000000001",
        rncEmisor,
        razonSocial,
        [linea(1, "Operación exenta de régimen especial", 1, 1200, "4", 0)],
        {
          rncComprador,
        },
      ),
      incluirRfce: false,
    },
    {
      numeroCaso: 9,
      nombre: "E45 — Comprobante Gubernamental Electrónico",
      documento: documentoCaso(
        "45",
        "E450000000001",
        rncEmisor,
        razonSocial,
        [linea(1, "Servicio a institución gubernamental", 1, 2000, "1", 18)],
        {
          rncComprador,
        },
      ),
      incluirRfce: false,
    },
  ];
}

function extraerFechaFirma(xml: string): string {
  return xml.match(/<FechaHoraFirma>([^<]+)<\/FechaHoraFirma>/)?.[1] ?? "26-11-2026 10:00:00";
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cada caso debe validar documento, XML, firma, XSD y RFCE en una secuencia auditada
function ejecutarCaso(
  caso: CasoSetPruebas,
  clavePrivadaPem: string,
  certificadoPem: string,
  ambiente: AmbienteEcf,
): ResultadoSimulacionCaso {
  const inicio = Date.now();
  const tipo = caso.documento.comprobante.tipo;
  const base: ResultadoSimulacionCaso = {
    numeroCaso: caso.numeroCaso,
    nombre: caso.nombre,
    tipo,
    estado: "fallido",
    encf: caso.documento.comprobante.encf,
    duracionMs: 0,
  };
  try {
    const validacion = validarDocumentoEcf(caso.documento);
    if (!validacion.ok) throw new Error(validacion.errores.join("; "));
    const xml = generarXmlEcf(caso.documento);
    const firma = firmarXmlDsig(xml, clavePrivadaPem, certificadoPem);
    const verificacion = verificarFirmaXmlDsig(firma.xmlFirmado);
    if (!verificacion.valida) throw new Error(verificacion.motivo ?? "La firma del e-CF no verificó");
    const validacionXsd = validarXmlContraEsquemaDgii(firma.xmlFirmado, "ECF");
    if (!validacionXsd.valido) throw new Error(`XSD e-CF: ${validacionXsd.errores.join("; ")}`);

    let xmlRfce: string | undefined;
    if (caso.incluirRfce) {
      if (!esElegibleRfce(caso.documento)) throw new Error("El caso RFCE no es elegible por tipo o monto");
      const resumen = generarXmlRfce(caso.documento, firma.codigoSeguridad);
      const firmaRfce = firmarXmlDsig(resumen, clavePrivadaPem, certificadoPem);
      const verificacionRfce = verificarFirmaXmlDsig(firmaRfce.xmlFirmado);
      if (!verificacionRfce.valida) throw new Error(verificacionRfce.motivo ?? "La firma del RFCE no verificó");
      const validacionXsdRfce = validarXmlContraEsquemaDgii(firmaRfce.xmlFirmado, "RFCE");
      if (!validacionXsdRfce.valido) throw new Error(`XSD RFCE: ${validacionXsdRfce.errores.join("; ")}`);
      xmlRfce = firmaRfce.xmlFirmado;
    }

    return {
      ...base,
      estado: "aprobado",
      codigoSeguridad: firma.codigoSeguridad,
      urlQr: construirUrlQrDgii({
        ambiente,
        rncEmisor: caso.documento.emisor.rnc,
        rncComprador: caso.documento.comprador.rnc ?? "",
        encf: caso.documento.comprobante.encf,
        fechaEmision: formatearFechaDgii(caso.documento.comprobante.fechaEmision),
        montoTotal: formatearMontoDgii(caso.documento.totales.montoTotal),
        fechaFirma: extraerFechaFirma(xml),
        codigoSeguridad: firma.codigoSeguridad,
        esRfce: caso.incluirRfce,
      }),
      digestValue: firma.digestValue,
      xmlFirmado: firma.xmlFirmado,
      xmlRfce,
      duracionMs: Date.now() - inicio,
    };
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : "Error desconocido al ejecutar el caso",
      duracionMs: Date.now() - inicio,
    };
  }
}

export function ejecutarSetPruebasSimulacion(args: EjecutarSetPruebasSimulacionArgs): ResumenSetPruebas {
  const ambiente = args.ambiente ?? "testecf";
  if ((args.clavePrivadaPem && !args.certificadoPem) || (!args.clavePrivadaPem && args.certificadoPem)) {
    throw new Error("Debe pasar la clave privada y el certificado juntos, o ninguno para generar uno de prueba");
  }
  const par =
    args.clavePrivadaPem && args.certificadoPem
      ? { clavePrivadaPem: args.clavePrivadaPem, certificadoPem: args.certificadoPem }
      : generarCertificadoPruebaAutocontenido(args.rncEmisor, args.razonSocial);
  const inicio = Date.now();
  const casos = construirCasos(args.rncEmisor, args.razonSocial).map((caso) =>
    ejecutarCaso(caso, par.clavePrivadaPem, par.certificadoPem, ambiente),
  );
  const aprobados = casos.filter((caso) => caso.estado === "aprobado").length;
  return {
    ambiente,
    rncEmisor: args.rncEmisor,
    totalCasos: casos.length,
    aprobados,
    fallidos: casos.length - aprobados,
    duracionMs: Date.now() - inicio,
    certificado: leerMetadatosCertificado(par.certificadoPem),
    casos,
  };
}

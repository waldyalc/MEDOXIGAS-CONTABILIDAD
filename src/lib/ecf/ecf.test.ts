import { describe, expect, it } from "vitest";

import { consultarResultadoDgii, enviarEcfDgii, type FetchEcf, obtenerTokenDgii } from "./cliente-dgii";
import { construirUrlQrDgii, construirUrlsServiciosPropios, endpointsDgii } from "./endpoints";
import {
  cifrarSecretoEcf,
  descifrarSecretoEcf,
  firmarXmlDsig,
  generarCertificadoPruebaAutocontenido,
  leerMetadatosCertificado,
  verificarFirmaXmlDsig,
} from "./firma";
import { ejecutarSetPruebasSimulacion } from "./pruebas-simulacion";
import type { DocumentoEcfInput, LineaEcfInput, TipoEcf } from "./tipos";
import { TIPOS_ECF } from "./tipos";
import { validarXmlContraEsquemaDgii } from "./validador-xsd";
import {
  calcularToleranciaGlobalDgii,
  escapeXml,
  esElegibleRfce,
  formatearFechaDgii,
  formatearFechaHoraDgii,
  formatearMontoDgii,
  formatearPrecioDgii,
  generarXmlAcecf,
  generarXmlAnecf,
  generarXmlArecf,
  generarXmlEcf,
  generarXmlRfce,
  TOLERANCIA_LINEA_DGII,
  validarDocumentoEcf,
} from "./xml";
import { X509Certificate } from "node:crypto";

function lineaBase(cambios: Partial<LineaEcfInput> = {}): LineaEcfInput {
  return {
    numeroLinea: 1,
    indicadorFacturacion: "1",
    nombreItem: "Oxígeno medicinal",
    cantidad: 1,
    unidadMedida: "43",
    precioUnitario: 100,
    descuento: 0,
    itbisTasa: 18,
    montoItem: 100,
    indicadorBienoServicio: "1",
    ...cambios,
  };
}

function documentoBase(): DocumentoEcfInput {
  return {
    emisor: {
      rnc: "131999999",
      razonSocial: "EMPRESA DE PRUEBA SRL",
      direccion: "Calle Principal No. 10",
      municipio: "010100",
      provincia: "010000",
      correo: "pruebas@example.com",
    },
    comprador: { rnc: "130999999", razonSocial: "CLIENTE DE PRUEBA SRL" },
    comprobante: {
      tipo: "31",
      encf: "E310000000001",
      fechaEmision: "26-11-2026",
      fechaVencimientoSecuencia: "31-12-2026",
      tipoIngresos: "01",
      tipoPago: "2",
      indicadorMontoGravado: "0",
      fechaHoraFirma: "26-11-2026 10:00:00",
    },
    lineas: [lineaBase()],
    totales: {
      montoGravadoI1: 100,
      montoGravadoI2: 0,
      montoGravadoI3: 0,
      montoExento: 0,
      totalItbis1: 18,
      totalItbis2: 0,
      totalItbis3: 0,
      totalItbis: 18,
      montoTotal: 118,
    },
  };
}

function documentoConsumo(montoBase: number): DocumentoEcfInput {
  const doc = documentoBase();
  const itbis = Math.round(montoBase * 0.18 * 100) / 100;
  doc.comprobante.tipo = "32";
  doc.comprobante.encf = "E320000000001";
  doc.comprobante.tipoPago = "1";
  doc.comprador = { razonSocial: "CONSUMIDOR FINAL" };
  doc.lineas = [lineaBase({ precioUnitario: montoBase, montoItem: montoBase })];
  doc.totales = {
    montoGravadoI1: montoBase,
    montoGravadoI2: 0,
    montoGravadoI3: 0,
    montoExento: 0,
    totalItbis1: itbis,
    totalItbis2: 0,
    totalItbis3: 0,
    totalItbis: itbis,
    montoTotal: montoBase + itbis,
  };
  return doc;
}

function erroresDe(doc: DocumentoEcfInput): string[] {
  const validacion = validarDocumentoEcf(doc);
  return validacion.ok ? [] : validacion.errores;
}

describe("tipos y endpoints DGII", () => {
  it("cataloga los diez tipos e-CF con prefijo y exigencia de RNC", () => {
    expect(Object.keys(TIPOS_ECF)).toHaveLength(10);
    expect(TIPOS_ECF["31"].prefijo).toBe("E31");
    expect(TIPOS_ECF["47"].prefijo).toBe("E47");
    expect(TIPOS_ECF["31"].requiereRncComprador).toBe(true);
    expect(TIPOS_ECF["41"].requiereRncComprador).toBe(true);
    expect(TIPOS_ECF["44"].requiereRncComprador).toBe(true);
    expect(TIPOS_ECF["45"].requiereRncComprador).toBe(true);
    expect(TIPOS_ECF["46"].requiereRncComprador).toBe(true);
    expect(TIPOS_ECF["32"].requiereRncComprador).toBe(false);
  });

  it("construye los endpoints oficiales por ambiente", () => {
    const endpoints = endpointsDgii("testecf");
    expect(endpoints.semilla).toBe("https://ecf.dgii.gov.do/testecf/autenticacion/api/autenticacion/semilla");
    expect(endpoints.validarSemilla).toBe(
      "https://ecf.dgii.gov.do/testecf/autenticacion/api/autenticacion/validarsemilla",
    );
    expect(endpoints.recepcionEcf).toBe("https://ecf.dgii.gov.do/testecf/recepcion/api/facturaselectronicas");
    expect(endpoints.recepcionRfce).toBe("https://fc.dgii.gov.do/testecf/recepcionfc/api/recepcion/ecf");
    expect(endpoints.consultaRfce).toBe("https://fc.dgii.gov.do/testecf/consultarfce/api/Consultas/Consulta");
    expect(endpoints.consultaResultado).toBe("https://ecf.dgii.gov.do/testecf/consultaresultado/api/consultas/estado");
    expect(endpoints.consultaEstado).toBe("https://ecf.dgii.gov.do/testecf/consultaestado/api/consultas/estado");
    expect(endpoints.anulacion).toBe("https://ecf.dgii.gov.do/testecf/anulacionrangos/api/operaciones/anularrango");
    expect(endpointsDgii("ecf").semilla).toContain("/ecf/autenticacion/");
  });

  it("construye la URL QR oficial codificando todos los parámetros", () => {
    const url = construirUrlQrDgii({
      ambiente: "testecf",
      rncEmisor: "131999999",
      rncComprador: "130999999",
      encf: "E310000000001",
      fechaEmision: "26-11-2026",
      montoTotal: "1180.00",
      fechaFirma: "26-11-2026 10:00:00",
      codigoSeguridad: "ab+/=x",
      esRfce: false,
    });
    expect(url).toBe(
      "https://ecf.dgii.gov.do/testecf/ConsultaTimbre?RncEmisor=131999999&RncComprador=130999999&ENCF=E310000000001&FechaEmision=26-11-2026&MontoTotal=1180.00&FechaFirma=26-11-2026%2010%3A00%3A00&CodigoSeguridad=ab%2B%2F%3Dx",
    );
    const urlRfce = construirUrlQrDgii({
      ambiente: "certecf",
      rncEmisor: "131999999",
      rncComprador: "",
      encf: "E320000000001",
      fechaEmision: "26-11-2026",
      montoTotal: "1180.00",
      fechaFirma: "26-11-2026 10:00:00",
      codigoSeguridad: "ab+/12",
      esRfce: true,
    });
    expect(urlRfce).toBe(
      "https://fc.dgii.gov.do/certecf/ConsultaTimbreFC?RncEmisor=131999999&ENCF=E320000000001&MontoTotal=1180.00&CodigoSeguridad=ab%2B%2F12",
    );
  });

  it("construye las cuatro URLs de servicios propios para la OFV con y sin RNC", () => {
    expect(construirUrlsServiciosPropios("https://facturacion.example.com/")).toEqual({
      semilla: "https://facturacion.example.com/fe/autenticacion/api/semilla",
      validacionCertificado: "https://facturacion.example.com/fe/autenticacion/api/validacioncertificado",
      recepcionEcf: "https://facturacion.example.com/fe/recepcion/api/ecf",
      aprobacionComercial: "https://facturacion.example.com/fe/aprobacioncomercial/api/ecf",
    });
    expect(construirUrlsServiciosPropios("https://app.medoxigas.com/", "131-99999-9")).toEqual({
      semilla: "https://app.medoxigas.com/api/ecf/131999999/fe/autenticacion/api/semilla",
      validacionCertificado: "https://app.medoxigas.com/api/ecf/131999999/fe/autenticacion/api/validacioncertificado",
      recepcionEcf: "https://app.medoxigas.com/api/ecf/131999999/fe/recepcion/api/ecf",
      aprobacionComercial: "https://app.medoxigas.com/api/ecf/131999999/fe/aprobacioncomercial/api/ecf",
    });
  });
});

describe("validación de documentos e-CF", () => {
  it("acepta un documento base consistente", () => {
    expect(validarDocumentoEcf(documentoBase())).toEqual({ ok: true });
  });

  it("calcula la base neta cuando IndicadorMontoGravado es 1 y las líneas incluyen ITBIS", () => {
    const doc = documentoBase();
    doc.comprobante.indicadorMontoGravado = "1";
    doc.lineas = [lineaBase({ precioUnitario: 118, montoItem: 118 })];
    doc.totales = {
      montoGravadoI1: 100,
      montoGravadoI2: 0,
      montoGravadoI3: 0,
      montoExento: 0,
      totalItbis1: 18,
      totalItbis2: 0,
      totalItbis3: 0,
      totalItbis: 18,
      montoTotal: 118,
    };
    expect(validarDocumentoEcf(doc)).toEqual({ ok: true });
  });

  it("rechaza e-NCF con largo incorrecto o tipo distinto del documento", () => {
    const corto = documentoBase();
    corto.comprobante.encf = "E3101";
    expect(erroresDe(corto).join("; ")).toContain("13 caracteres");

    const tipoDistinto = documentoBase();
    tipoDistinto.comprobante.encf = "E320000000001";
    expect(erroresDe(tipoDistinto).join("; ")).toContain("no corresponde con el tipo");
  });

  it("rechaza RNC inválidos y exige RNC comprador en los tipos fiscales obligatorios", () => {
    const emisorInvalido = documentoBase();
    emisorInvalido.emisor.rnc = "123";
    expect(erroresDe(emisorInvalido).join("; ")).toContain("RNC del emisor");

    const sinComprador = documentoBase();
    sinComprador.comprador.rnc = undefined;
    expect(erroresDe(sinComprador).join("; ")).toContain("RNC del comprador es obligatorio");

    const compradorInvalido = documentoBase();
    compradorInvalido.comprador.rnc = "ABC";
    expect(erroresDe(compradorInvalido).join("; ")).toContain("RNC del comprador");
  });

  it("exige referencia completa en notas de débito y crédito", () => {
    for (const tipo of ["33", "34"] as const) {
      const doc = documentoBase();
      doc.comprobante.tipo = tipo;
      doc.comprobante.encf = `E${tipo}0000000001`;
      const errores = erroresDe(doc).join("; ");
      expect(errores).toContain("referenciar el e-NCF modificado");
      expect(errores).toContain("fecha del e-NCF modificado");
      expect(errores).toContain("código de modificación");
    }
  });

  it("rechaza documentos sin líneas, cantidades inválidas y líneas descuadradas", () => {
    const sinLineas = documentoBase();
    sinLineas.lineas = [];
    expect(erroresDe(sinLineas).join("; ")).toContain("al menos una línea");

    const cantidadCero = documentoBase();
    cantidadCero.lineas = [lineaBase({ cantidad: 0, montoItem: 0 })];
    expect(erroresDe(cantidadCero).join("; ")).toContain("cantidad mayor que cero");

    const lineaDescuadrada = documentoBase();
    lineaDescuadrada.lineas = [lineaBase({ montoItem: 101 })];
    expect(erroresDe(lineaDescuadrada).join("; ")).toContain("no cuadra");
  });

  it("detecta descuadres entre líneas, ITBIS y monto total", () => {
    const totalAlterado = documentoBase();
    totalAlterado.totales.montoTotal = 119;
    expect(erroresDe(totalAlterado).join("; ")).toContain("MontoTotal no cuadra");

    const itbisAlterado = documentoBase();
    itbisAlterado.totales.totalItbis = 19;
    expect(erroresDe(itbisAlterado).join("; ")).toContain("TotalITBIS no cuadra");

    const baseAlterada = documentoBase();
    baseAlterada.totales.montoGravadoI1 = 101;
    expect(erroresDe(baseAlterada).join("; ")).toContain("MontoGravadoI1 no cuadra");
  });

  it("exige RNC comprador en factura de consumo de RD$250,000 o más, pero no debajo del umbral", () => {
    const grande = documentoConsumo(220000);
    grande.comprador = { razonSocial: "CONSUMIDOR FINAL" };
    expect(erroresDe(grande).join("; ")).toContain("RNC del comprador es obligatorio");

    const pequena = documentoConsumo(1000);
    expect(validarDocumentoEcf(pequena)).toEqual({ ok: true });
  });
});

describe("generación XML DGII", () => {
  it("genera e-CF con el orden estricto de secciones y campos principales", () => {
    const xml = generarXmlEcf(documentoBase());
    expect(xml).toContain("<ECF><Encabezado><Version>1.0</Version><IdDoc><TipoeCF>31</TipoeCF>");
    expect(xml.indexOf("<IdDoc>")).toBeLessThan(xml.indexOf("<Emisor>"));
    expect(xml.indexOf("<Emisor>")).toBeLessThan(xml.indexOf("<Comprador>"));
    expect(xml.indexOf("<Comprador>")).toBeLessThan(xml.indexOf("<Totales>"));
    expect(xml.indexOf("</Encabezado>")).toBeLessThan(xml.indexOf("<DetallesItems>"));
    expect(xml.indexOf("<DetallesItems>")).toBeLessThan(xml.indexOf("<FechaHoraFirma>"));
    expect(xml).toContain("<FechaVencimientoSecuencia>31-12-2026</FechaVencimientoSecuencia>");
    expect(xml).toContain("<FechaEmision>26-11-2026</FechaEmision>");
    expect(xml).toContain("<MontoTotal>118.00</MontoTotal>");
    expect(xml).not.toContain("<NombreComercial></NombreComercial>");
  });

  it("escapa los cinco caracteres especiales XML en textos", () => {
    expect(escapeXml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&apos;");
    const doc = documentoBase();
    doc.emisor.razonSocial = `Gas & Oxígeno`;
    doc.lineas = [lineaBase({ nombreItem: `Oxígeno "medicinal" <grado> & 'uso'` })];
    const xml = generarXmlEcf(doc);
    expect(xml).toContain("Gas &amp; Oxígeno");
    expect(xml).toContain("Oxígeno &quot;medicinal&quot; &lt;grado&gt; &amp; &apos;uso&apos;");
  });

  it("genera XML válido para los diez tipos de e-CF", () => {
    const tipos: TipoEcf[] = ["31", "32", "33", "34", "41", "43", "44", "45", "46", "47"];
    for (const tipo of tipos) {
      const doc = documentoBase();
      doc.comprobante.tipo = tipo;
      doc.comprobante.encf = `E${tipo}0000000001`;
      if (tipo === "33" || tipo === "34") {
        doc.comprobante.ncfModificado = "E310000000001";
        doc.comprobante.fechaNcfModificado = "20-11-2026";
        doc.comprobante.codigoModificacion = "3";
      }
      if (tipo === "43") doc.comprador.rnc = undefined;
      const validacion = validarDocumentoEcf(doc);
      expect(validacion, `tipo ${tipo}`).toEqual({ ok: true });
      const xml = generarXmlEcf(doc);
      expect(xml).toContain(`<TipoeCF>${tipo}</TipoeCF>`);
      expect(xml).toContain(`<eNCF>E${tipo}0000000001</eNCF>`);
    }
  });

  it("incluye InformacionReferencia en notas de crédito y débito", () => {
    const doc = documentoBase();
    doc.comprobante.tipo = "34";
    doc.comprobante.encf = "E340000000001";
    doc.comprobante.ncfModificado = "E310000000001";
    doc.comprobante.fechaNcfModificado = "20-11-2026";
    doc.comprobante.codigoModificacion = "1";
    const xml = generarXmlEcf(doc);
    expect(xml).toContain("<InformacionReferencia><NCFModificado>E310000000001</NCFModificado>");
    expect(xml).toContain(
      "<FechaNCFModificado>20-11-2026</FechaNCFModificado><CodigoModificacion>1</CodigoModificacion>",
    );
  });

  it("genera RFCE solo para E32 menor de RD$250,000", () => {
    const doc = documentoConsumo(1000);
    expect(esElegibleRfce(doc)).toBe(true);
    const xml = generarXmlRfce(doc, "ab+/12");
    expect(xml).toContain("<RFCE><Encabezado>");
    expect(xml).toContain("<CodigoSeguridadeCF>ab+/12</CodigoSeguridadeCF>");
    expect(xml).toContain("<MontoTotal>1180.00</MontoTotal>");
    expect(xml).not.toContain("<DetallesItems>");

    const grande = documentoConsumo(220000);
    grande.comprador.rnc = "130999999";
    expect(esElegibleRfce(grande)).toBe(false);
    expect(() => generarXmlRfce(grande, "abc123")).toThrow("menores de RD$250,000");
  });

  it("genera ARECF, ACECF y ANECF con sus etiquetas oficiales", () => {
    const arecf = generarXmlArecf({
      rncEmisor: "131999999",
      rncComprador: "130999999",
      encf: "E310000000001",
      estado: "0",
      fechaHoraAcuseRecibo: "26-11-2026 11:00:00",
    });
    expect(arecf).toContain("<ARECF><DetalleAcusedeRecibo>");
    expect(arecf).toContain("<Estado>0</Estado><FechaHoraAcuseRecibo>26-11-2026 11:00:00</FechaHoraAcuseRecibo>");

    const acecf = generarXmlAcecf({
      rncEmisor: "131999999",
      rncComprador: "130999999",
      encf: "E310000000001",
      fechaEmision: "26-11-2026",
      montoTotal: 118,
      estado: "1",
      fechaHoraAprobacionComercial: "26-11-2026 11:05:00",
    });
    expect(acecf).toContain("<ACECF><DetalleAprobacionComercial>");
    expect(acecf).toContain("<Estado>1</Estado><FechaHoraAprobacionComercial>");

    const anecf = generarXmlAnecf({
      rncEmisor: "131999999",
      fechaHoraAnulacion: "26-11-2026 12:00:00",
      anulaciones: [
        { tipo: "31", rangos: [{ desde: "E310000000010", hasta: "E310000000014" }] },
        { tipo: "32", rangos: [{ desde: "E320000000020", hasta: "E320000000020" }] },
      ],
    });
    expect(anecf).toContain("<ANECF><Encabezado><Version>1.0</Version><RncEmisor>131999999</RncEmisor>");
    expect(anecf).toContain("<CantidadeNCFAnulados>6</CantidadeNCFAnulados><FechaHoraAnulacioneNCF>");
    expect(anecf).toContain("<SecuenciaeNCFDesde>E310000000010</SecuenciaeNCFDesde>");
  });

  it("formatea fechas y montos al formato DGII", () => {
    expect(formatearFechaDgii("2026-11-26")).toBe("26-11-2026");
    expect(formatearFechaDgii("26-11-2026")).toBe("26-11-2026");
    expect(formatearFechaHoraDgii("2026-11-26T10:20:30")).toBe("26-11-2026 10:20:30");
    expect(formatearMontoDgii(1234.5)).toBe("1234.50");
  });
});

describe("certificados, firma XMLDSig y cifrado", () => {
  it("genera un certificado X.509 v3 autofirmado aceptado por node:crypto", () => {
    const par = generarCertificadoPruebaAutocontenido("131999999", "EMPRESA DE PRUEBA SRL");
    expect(par.clavePrivadaPem).toContain("BEGIN PRIVATE KEY");
    const certificado = new X509Certificate(par.certificadoPem);
    expect(certificado.subject).toContain("EMPRESA DE PRUEBA SRL");
    expect(certificado.subject).toContain("131999999");
    expect(certificado.verify(certificado.publicKey)).toBe(true);

    const metadatos = leerMetadatosCertificado(par.certificadoPem);
    expect(metadatos.titular).toBe("EMPRESA DE PRUEBA SRL");
    expect(metadatos.emisor).toBe("EMPRESA DE PRUEBA SRL");
    expect(metadatos.numeroSerie).toMatch(/^[0-9A-F]+$/i);
    expect(metadatos.vigente).toBe(true);
    expect(metadatos.diasRestantes).toBeGreaterThan(300);
    expect(metadatos.huellaSha256).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  });

  it("firma XMLDSig y verifica criptográficamente el documento", () => {
    const par = generarCertificadoPruebaAutocontenido("131999999", "EMPRESA DE PRUEBA SRL");
    const xml = generarXmlEcf(documentoBase());
    const firma = firmarXmlDsig(xml, par.clavePrivadaPem, par.certificadoPem);
    expect(firma.xmlFirmado).toContain(`<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">`);
    expect(firma.xmlFirmado).toContain(
      '<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315">',
    );
    expect(firma.xmlFirmado).toContain('<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature">');
    expect(firma.codigoSeguridad).toHaveLength(6);
    expect(firma.digestValue).toMatch(/^[A-Za-z0-9+/]+=$/);
    expect(verificarFirmaXmlDsig(firma.xmlFirmado)).toEqual({ valida: true, codigoSeguridad: firma.codigoSeguridad });
  });

  it("detecta cualquier alteración del contenido después de firmar", () => {
    const par = generarCertificadoPruebaAutocontenido("131999999", "EMPRESA DE PRUEBA SRL");
    const firma = firmarXmlDsig(generarXmlEcf(documentoBase()), par.clavePrivadaPem, par.certificadoPem);
    const alterado = firma.xmlFirmado.replace("<MontoTotal>118.00</MontoTotal>", "<MontoTotal>119.00</MontoTotal>");
    const verificacion = verificarFirmaXmlDsig(alterado);
    expect(verificacion.valida).toBe(false);
    expect(verificacion.motivo).toContain("alterado");

    const sinFirma = verificarFirmaXmlDsig("<ECF></ECF>");
    expect(sinFirma.valida).toBe(false);
    expect(sinFirma.motivo).toContain("no contiene");
  });

  it("cifra y descifra secretos con AES-256-GCM y rechaza claves o paquetes alterados", () => {
    const paquete = cifrarSecretoEcf("clave-privada-super-secreta", "clave-maestra");
    expect(paquete).toMatch(/^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
    expect(descifrarSecretoEcf(paquete, "clave-maestra")).toBe("clave-privada-super-secreta");
    expect(cifrarSecretoEcf("clave-privada-super-secreta", "clave-maestra")).not.toBe(paquete);
    expect(() => descifrarSecretoEcf(paquete, "otra-clave")).toThrow("clave incorrecta o paquete alterado");

    const partes = paquete.split(":");
    const cifrado = partes[3] ?? "";
    partes[3] = `${cifrado.slice(0, -1)}${cifrado.endsWith("A") ? "B" : "A"}`;
    expect(() => descifrarSecretoEcf(partes.join(":"), "clave-maestra")).toThrow("clave incorrecta o paquete alterado");
  });
});

describe("cliente DGII", () => {
  function parPrueba() {
    return generarCertificadoPruebaAutocontenido("131999999", "EMPRESA DE PRUEBA SRL");
  }

  it("ejecuta semilla → firma → token → envío → consulta con fetch inyectado", async () => {
    const par = parPrueba();
    const endpoints = endpointsDgii("testecf");
    const llamadas: Array<{ url: string; init?: RequestInit }> = [];
    const semillaXml =
      "<SemillaModel><Valor>semilla-de-prueba</Valor><Fecha>2026-11-26T10:00:00Z</Fecha></SemillaModel>";
    const xmlFirmado = firmarXmlDsig(
      generarXmlEcf(documentoBase()),
      par.clavePrivadaPem,
      par.certificadoPem,
    ).xmlFirmado;
    const fetchMock: FetchEcf = async (url, init) => {
      llamadas.push({ url, init });
      if (url === endpoints.semilla) return new Response(semillaXml, { status: 200 });
      if (url === endpoints.validarSemilla) {
        return new Response(
          JSON.stringify({ token: "token-dgii", expira: "2026-11-26T15:00:00Z", expedido: "2026-11-26T14:00:00Z" }),
          {
            status: 200,
          },
        );
      }
      if (url === endpoints.recepcionEcf) {
        return new Response(JSON.stringify({ trackId: "track-123", codigo: "0", estado: "Recibido", mensajes: [] }), {
          status: 200,
        });
      }
      if (url.startsWith(endpoints.consultaResultado)) {
        return new Response(
          JSON.stringify({
            trackId: "track-123",
            codigo: "1",
            estado: "Aceptado",
            rnc: "131999999",
            encf: "E310000000001",
            secuenciaUtilizada: true,
            fechaRecepcion: "26-11-2026 10:05:00",
            mensajes: [],
          }),
          { status: 200 },
        );
      }
      throw new Error(`URL inesperada: ${url}`);
    };

    const token = await obtenerTokenDgii({
      ambiente: "testecf",
      clavePrivadaPem: par.clavePrivadaPem,
      certificadoPem: par.certificadoPem,
      fetchFn: fetchMock,
    });
    expect(token).toEqual({ token: "token-dgii", expira: "2026-11-26T15:00:00Z" });
    const bodySemilla = llamadas[1]?.init?.body;
    if (!(bodySemilla instanceof FormData)) throw new Error("La validación de semilla no envió multipart/form-data");
    const archivoSemilla = bodySemilla.get("xml");
    if (!(archivoSemilla instanceof Blob)) throw new Error("La semilla firmada no viajó como archivo XML");
    const semillaFirmada = await archivoSemilla.text();
    expect(verificarFirmaXmlDsig(semillaFirmada).valida).toBe(true);

    const envio = await enviarEcfDgii({
      ambiente: "testecf",
      token: token.token,
      nombreArchivo: "131999999E310000000001.xml",
      xmlFirmado,
      esRfce: false,
      fetchFn: fetchMock,
    });
    expect(envio).toEqual({ trackId: "track-123", codigo: "0", estado: "Recibido", mensajes: [] });
    expect(llamadas[2]?.init?.headers).toMatchObject({ Authorization: "Bearer token-dgii" });

    const consulta = await consultarResultadoDgii({
      ambiente: "testecf",
      token: token.token,
      trackId: "track-123",
      fetchFn: fetchMock,
    });
    expect(consulta.estado).toBe("aceptado");
    expect(consulta.trackId).toBe("track-123");
    expect(consulta.encf).toBe("E310000000001");
    expect(consulta.secuenciaUtilizada).toBe(true);
    expect(llamadas[3]?.url).toBe(`${endpoints.consultaResultado}?trackid=track-123`);
  });

  it("usa el endpoint RFCE cuando el documento es resumen de consumo", async () => {
    const endpoints = endpointsDgii("testecf");
    const urls: string[] = [];
    const fetchMock: FetchEcf = async (url) => {
      urls.push(url);
      return new Response(JSON.stringify({ trackId: "rfce-1", codigo: "0", estado: "Recibido" }), { status: 200 });
    };
    const envio = await enviarEcfDgii({
      ambiente: "testecf",
      token: "token",
      nombreArchivo: "131999999E320000000001.xml",
      xmlFirmado: "<RFCE></RFCE>",
      esRfce: true,
      fetchFn: fetchMock,
    });
    expect(urls).toEqual([endpoints.recepcionRfce]);
    expect(envio.trackId).toBe("rfce-1");
  });

  it("normaliza estados DGII y convierte fallas de transporte en error_red", async () => {
    const estados: string[] = [];
    const fetchMock: FetchEcf = async () => {
      const estado = estados.length === 0 ? "Aceptado Condicional" : "En Proceso";
      estados.push(estado);
      return new Response(
        JSON.stringify({ trackId: "t", codigo: "1", estado, mensajes: [{ valor: "observación", codigo: 1 }] }),
        {
          status: 200,
        },
      );
    };
    const condicional = await consultarResultadoDgii({
      ambiente: "testecf",
      token: "token",
      trackId: "t",
      fetchFn: fetchMock,
    });
    expect(condicional.estado).toBe("aceptado_condicional");
    expect(condicional.mensajes).toEqual(["observación"]);
    const enProceso = await consultarResultadoDgii({
      ambiente: "testecf",
      token: "token",
      trackId: "t",
      fetchFn: fetchMock,
    });
    expect(enProceso.estado).toBe("en_proceso");

    const fetchFallido: FetchEcf = async () => {
      throw new Error("sin internet");
    };
    const error = await consultarResultadoDgii({
      ambiente: "testecf",
      token: "token",
      trackId: "t",
      fetchFn: fetchFallido,
    });
    expect(error.estado).toBe("error_red");
    expect(error.mensajes.join(";")).toContain("sin internet");
  });

  it("bloquea producción salvo confirmación explícita", async () => {
    const par = parPrueba();
    const fetchMock: FetchEcf = async () => new Response("{}", { status: 200 });
    await expect(
      obtenerTokenDgii({
        ambiente: "ecf",
        clavePrivadaPem: par.clavePrivadaPem,
        certificadoPem: par.certificadoPem,
        fetchFn: fetchMock,
      }),
    ).rejects.toThrow("confirmarProduccion: true");
    await expect(
      enviarEcfDgii({
        ambiente: "ecf",
        token: "t",
        nombreArchivo: "a.xml",
        xmlFirmado: "<ECF />",
        esRfce: false,
        fetchFn: fetchMock,
      }),
    ).rejects.toThrow("confirmarProduccion: true");
    await expect(
      consultarResultadoDgii({ ambiente: "ecf", token: "t", trackId: "x", fetchFn: fetchMock }),
    ).rejects.toThrow("confirmarProduccion: true");
  });
});

describe("set de pruebas DGII simulado", () => {
  it("ejecuta los 9 casos oficiales con firmas válidas y códigos de seguridad", () => {
    const resumen = ejecutarSetPruebasSimulacion({ rncEmisor: "131999999", razonSocial: "EMPRESA DE PRUEBA SRL" });
    expect(resumen.totalCasos).toBe(9);
    expect(resumen.aprobados).toBe(9);
    expect(resumen.fallidos).toBe(0);
    expect(resumen.certificado.vigente).toBe(true);
    expect(resumen.casos.map((caso) => caso.tipo)).toEqual(["31", "32", "32", "33", "34", "41", "43", "44", "45"]);

    for (const caso of resumen.casos) {
      expect(caso.estado, `caso ${caso.numeroCaso}: ${caso.error ?? "sin error"}`).toBe("aprobado");
      expect(caso.codigoSeguridad).toMatch(/^.{6}$/);
      expect(caso.digestValue).toMatch(/^[A-Za-z0-9+/]+=$/);
      expect(caso.urlQr).toContain(`ENCF=${caso.encf}`);
      expect(caso.xmlFirmado).toContain("<Signature");
      if (!caso.xmlFirmado) throw new Error("El caso no devolvió XML firmado");
      expect(verificarFirmaXmlDsig(caso.xmlFirmado).valida).toBe(true);
    }

    const casoRfce = resumen.casos[2];
    expect(casoRfce?.xmlRfce).toBeTruthy();
    if (!casoRfce?.xmlRfce) throw new Error("El caso 3 no devolvió RFCE");
    expect(casoRfce.xmlRfce).toContain("<RFCE><Encabezado>");
    expect(casoRfce.xmlRfce).toContain("<CodigoSeguridadeCF>");
    expect(verificarFirmaXmlDsig(casoRfce.xmlRfce).valida).toBe(true);
  });

  it("acepta certificados externos y exige pasar clave y certificado juntos", () => {
    const par = generarCertificadoPruebaAutocontenido("131999999", "EMPRESA DE PRUEBA SRL");
    const resumen = ejecutarSetPruebasSimulacion({
      rncEmisor: "131999999",
      razonSocial: "EMPRESA DE PRUEBA SRL",
      clavePrivadaPem: par.clavePrivadaPem,
      certificadoPem: par.certificadoPem,
    });
    expect(resumen.aprobados).toBe(9);
    expect(() =>
      ejecutarSetPruebasSimulacion({
        rncEmisor: "131999999",
        razonSocial: "EMPRESA DE PRUEBA SRL",
        certificadoPem: par.certificadoPem,
      }),
    ).toThrow("clave privada y el certificado juntos");
  });
});

describe("campos avanzados XSD nivel 2", () => {
  it("emite descuentos, recargos, retenciones, propina legal, ajuste global y otra moneda en orden válido", () => {
    const doc = documentoBase();
    doc.lineas = [
      lineaBase({
        cantidad: 1,
        precioUnitario: 123.4567,
        descuento: 10,
        subDescuentos: [{ tipo: "$", monto: 10 }],
        recargo: 5,
        subRecargos: [{ tipo: "$", monto: 5 }],
        retencion: { indicadorAgenteRetencion: "1", montoItbisRetenido: 5, montoIsrRetenido: 10 },
        montoItem: 118.4567,
      }),
    ];
    doc.descuentosORecargos = [
      {
        numeroLinea: 1,
        tipoAjuste: "D",
        descripcion: "Descuento comercial global",
        tipoValor: "$",
        valor: 5,
        monto: 5,
        indicadorFacturacion: "1",
      },
    ];
    doc.totales = {
      ...doc.totales,
      montoGravadoI1: 113.46,
      totalItbis1: 20.42,
      totalItbis: 20.42,
      montoImpuestoAdicional: 11.35,
      impuestosAdicionales: [{ tipoImpuesto: "001", otrosImpuestosAdicionales: 11.35 }],
      montoTotal: 145.23,
      totalItbisRetenido: 5,
      totalIsrRetencion: 10,
    };
    doc.otraMoneda = {
      tipoMoneda: "USD",
      tipoCambio: 58.5,
      montoGravadoTotalOtraMoneda: 1.94,
      montoExentoOtraMoneda: 0,
      totalItbisOtraMoneda: 0.35,
      montoTotalOtraMoneda: 2.48,
    };

    const xml = generarXmlEcf(doc);
    expect(xml).toContain("<PrecioUnitarioItem>123.4567</PrecioUnitarioItem>");
    expect(xml.indexOf("<DescuentoMonto>10.00</DescuentoMonto>")).toBeLessThan(xml.indexOf("<TablaSubDescuento>"));
    expect(xml.indexOf("<RecargoMonto>5.00</RecargoMonto>")).toBeLessThan(xml.indexOf("<TablaSubRecargo>"));
    expect(xml).toContain("<TipoImpuesto>001</TipoImpuesto>");
    expect(xml).toContain("<DescuentosORecargos>");
    expect(xml).toContain("<TotalITBISRetenido>5.00</TotalITBISRetenido>");
    expect(xml).toContain("<TotalISRRetencion>10.00</TotalISRRetencion>");
    expect(xml).toContain("<TipoMoneda>USD</TipoMoneda>");
    const xsd = validarXmlContraEsquemaDgii(xml, "ECF");
    expect(xsd.errores).toEqual([]);
    expect(xsd.valido).toBe(true);
  });

  it("formatea precios hasta cuatro decimales y expone tolerancias del Decreto 587-24", () => {
    expect(formatearPrecioDgii(10)).toBe("10.00");
    expect(formatearPrecioDgii(10.2)).toBe("10.20");
    expect(formatearPrecioDgii(10.2345)).toBe("10.2345");
    expect(formatearPrecioDgii(10.23)).toBe("10.23");
    expect(TOLERANCIA_LINEA_DGII).toBe(1);
    expect(calcularToleranciaGlobalDgii(5)).toBe(5);
  });
});

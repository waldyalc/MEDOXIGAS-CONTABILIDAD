import { describe, expect, it } from "vitest";

import { generarPlantillaExcelPruebasPiloto, ordenarCasosEnvioDgii, parsearExcelPruebasDgii } from "./excel-pruebas";
import { firmarXmlDsig, generarCertificadoPruebaAutocontenido, verificarFirmaXmlDsig } from "./firma";
import { leerCertificadoPkcs12 } from "./pkcs12";
import type { DocumentoEcfInput, TipoEcf } from "./tipos";
import { validarXmlContraEsquemaDgii } from "./validador-xsd";
import {
  generarXmlAcecf,
  generarXmlAnecf,
  generarXmlArecf,
  generarXmlEcf,
  generarXmlRfce,
  validarDocumentoEcf,
} from "./xml";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RNC_OXYMAT = "131488791";
const CLAVE_P12 = "ClavePrueba-Oxymat-123";

function documentoTipo(tipo: TipoEcf): DocumentoEcfInput {
  const exento = tipo === "43" || tipo === "44" || tipo === "47";
  const tasaCero = tipo === "46";
  let indicador: "1" | "3" | "4" = "1";
  if (exento) indicador = "4";
  else if (tasaCero) indicador = "3";
  const itbis = exento || tasaCero ? 0 : 18;
  const referencia = tipo === "33" || tipo === "34";
  const notaCredito = tipo === "34";
  return {
    emisor: {
      rnc: RNC_OXYMAT,
      razonSocial: "OXYMAT SRL",
      direccion: "Av. Industrial 10, Santo Domingo",
    },
    comprador: { rnc: "131880725", razonSocial: "CLIENTE PILOTO DGII SRL" },
    comprobante: {
      tipo,
      encf: `E${tipo}0000000001`,
      fechaEmision: "15-01-2026",
      fechaVencimientoSecuencia: "31-12-2026",
      tipoIngresos: "01",
      tipoPago: "1",
      indicadorMontoGravado: "0",
      indicadorNotaCredito: notaCredito ? "1" : undefined,
      ncfModificado: referencia ? "E310000000001" : undefined,
      fechaNcfModificado: referencia ? "10-01-2026" : undefined,
      codigoModificacion: referencia ? "1" : undefined,
      fechaHoraFirma: "15-01-2026 10:00:00",
    },
    lineas: [
      {
        numeroLinea: 1,
        indicadorFacturacion: indicador,
        nombreItem: `Item de prueba E${tipo}`,
        cantidad: 1,
        precioUnitario: 100,
        itbisTasa: itbis,
        montoItem: 100,
      },
    ],
    totales: {
      montoGravadoI1: indicador === "1" ? 100 : 0,
      montoGravadoI2: 0,
      montoGravadoI3: tasaCero ? 100 : 0,
      montoExento: exento ? 100 : 0,
      totalItbis1: itbis,
      totalItbis2: 0,
      totalItbis3: 0,
      totalItbis: itbis,
      montoTotal: 100 + itbis,
    },
  };
}

function crearP12Oxymat(carpeta: string): Buffer {
  const clave = join(carpeta, "oxymat-key.pem");
  const certificado = join(carpeta, "oxymat-cert.pem");
  const p12 = join(carpeta, "oxymat.p12");
  const env = { ...process.env, P12_TEST_PASS: CLAVE_P12 };
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-keyout",
      clave,
      "-out",
      certificado,
      "-days",
      "2",
      "-nodes",
      "-subj",
      `/C=DO/O=OXYMAT SRL/CN=OXYMAT SRL/serialNumber=${RNC_OXYMAT}`,
    ],
    { env, stdio: "pipe" },
  );
  execFileSync(
    "openssl",
    ["pkcs12", "-export", "-out", p12, "-inkey", clave, "-in", certificado, "-passout", "env:P12_TEST_PASS"],
    { env, stdio: "pipe" },
  );
  return readFileSync(p12);
}

describe("lector PKCS#12 real", () => {
  it("lee un .p12 de OXYMAT, valida la llave y firma un E31 verificable y conforme al esquema", async () => {
    const carpeta = mkdtempSync(join(tmpdir(), "ecf-p12-test-"));
    try {
      const p12 = crearP12Oxymat(carpeta);
      const leido = await leerCertificadoPkcs12(p12, CLAVE_P12);
      expect(leido.metadatos.vigente).toBe(true);
      expect(leido.certificadoPem).toContain("BEGIN CERTIFICATE");
      expect(leido.clavePrivadaPem).toContain("PRIVATE KEY");

      const documento = documentoTipo("31");
      const firma = firmarXmlDsig(generarXmlEcf(documento), leido.clavePrivadaPem, leido.certificadoPem);
      expect(verificarFirmaXmlDsig(firma.xmlFirmado).valida).toBe(true);
      const xsd = validarXmlContraEsquemaDgii(firma.xmlFirmado, "ECF");
      expect(xsd.errores).toEqual([]);
      expect(xsd.valido).toBe(true);
    } finally {
      rmSync(carpeta, { recursive: true, force: true });
    }
  }, 30000);

  it("rechaza contraseña incorrecta y archivos corruptos con errores claros", async () => {
    const carpeta = mkdtempSync(join(tmpdir(), "ecf-p12-test-"));
    try {
      const p12 = crearP12Oxymat(carpeta);
      await expect(leerCertificadoPkcs12(p12, "contraseña-incorrecta")).rejects.toThrow(/contraseña/i);
      await expect(leerCertificadoPkcs12(Buffer.from("archivo corrupto"), CLAVE_P12)).rejects.toThrow(
        /corrupto|formato/i,
      );
    } finally {
      rmSync(carpeta, { recursive: true, force: true });
    }
  }, 30000);
});

describe("validador estricto XSD DGII", () => {
  it("acepta XML estructuralmente válidos para los diez tipos E31 a E47", () => {
    for (const tipo of ["31", "32", "33", "34", "41", "43", "44", "45", "46", "47"] as const) {
      const documento = documentoTipo(tipo);
      expect(validarDocumentoEcf(documento).ok, tipo).toBe(true);
      const resultado = validarXmlContraEsquemaDgii(generarXmlEcf(documento), "ECF");
      expect(resultado.errores, `${tipo}: ${resultado.errores.join("; ")}`).toEqual([]);
      expect(resultado.valido).toBe(true);
      expect(resultado.tipoDetectado).toBe(tipo);
    }
  });

  it("acepta y verifica un E45 firmado con estructura real DGII/Alegra y campos opcionales omitidos", () => {
    const documento = documentoTipo("45");
    documento.comprobante.tipoPago = "2";
    documento.comprobante.fechaLimitePago = "15-02-2026";
    documento.emisor = {
      ...documento.emisor,
      nombreComercial: "COMERCIAL PILOTO",
      sucursal: "001",
      telefonos: ["8095550100", "8295550101"],
    };
    documento.comprador = { ...documento.comprador, correo: "compras@example.com" };

    const xmlSinFirma = generarXmlEcf(documento);
    expect(xmlSinFirma).toContain("<TipoPago>2</TipoPago><FechaLimitePago>15-02-2026</FechaLimitePago>");
    expect(xmlSinFirma).toContain("<Sucursal>001</Sucursal>");
    expect(xmlSinFirma).toContain("<TablaTelefonoEmisor>");
    expect(xmlSinFirma).toContain("<CorreoComprador>compras@example.com</CorreoComprador>");
    expect(xmlSinFirma).not.toContain("<MontoGravadoI2>");
    expect(xmlSinFirma).not.toContain("<MontoExento>");
    expect(xmlSinFirma).not.toContain("<TotalITBIS2>");

    const par = generarCertificadoPruebaAutocontenido(RNC_OXYMAT, "OXYMAT SRL");
    const xmlRealista = xmlSinFirma.replace(
      '<?xml version="1.0" encoding="utf-8"?>',
      '<?xml version="1.0" encoding="UTF-8"?>\n',
    );
    const firma = firmarXmlDsig(xmlRealista, par.clavePrivadaPem, par.certificadoPem);
    const xsd = validarXmlContraEsquemaDgii(firma.xmlFirmado, "ECF");
    expect(xsd.errores).toEqual([]);
    expect(xsd.valido).toBe(true);
    expect(xsd.tipoDetectado).toBe("45");
    expect(verificarFirmaXmlDsig(firma.xmlFirmado)).toEqual({ valida: true, codigoSeguridad: firma.codigoSeguridad });
  });

  it("acepta RFCE, ARECF, ACECF y ANECF con sus estructuras oficiales", () => {
    const documento = documentoTipo("32");
    documento.totales.montoTotal = 118;
    const rfce = validarXmlContraEsquemaDgii(generarXmlRfce(documento, "ABC123"), "RFCE");
    expect(rfce.errores).toEqual([]);
    expect(rfce.valido).toBe(true);

    const arecf = validarXmlContraEsquemaDgii(
      generarXmlArecf({
        rncEmisor: RNC_OXYMAT,
        rncComprador: "131880725",
        encf: "E310000000001",
        estado: "0",
        fechaHoraAcuseRecibo: "15-01-2026 10:00:00",
      }),
      "ARECF",
    );
    const acecf = validarXmlContraEsquemaDgii(
      generarXmlAcecf({
        rncEmisor: RNC_OXYMAT,
        rncComprador: "131880725",
        encf: "E310000000001",
        fechaEmision: "15-01-2026",
        montoTotal: 118,
        estado: "1",
        fechaHoraAprobacionComercial: "15-01-2026 10:00:00",
      }),
      "ACECF",
    );
    const anecf = validarXmlContraEsquemaDgii(
      generarXmlAnecf({
        rncEmisor: RNC_OXYMAT,
        fechaHoraAnulacion: "15-01-2026 10:00:00",
        anulaciones: [{ tipo: "31", rangos: [{ desde: "E310000000010", hasta: "E310000000011" }] }],
      }),
      "ANECF",
    );
    expect(arecf.errores).toEqual([]);
    expect(acecf.errores).toEqual([]);
    expect(anecf.errores).toEqual([]);
  });

  it("detecta etiquetas vacías, indentación entre tags y orden incorrecto", () => {
    const xml = generarXmlEcf(documentoTipo("31"));
    const conVacia = xml.replace("<RNCEmisor>", "<NombreComercial/><RNCEmisor>");
    expect(validarXmlContraEsquemaDgii(conVacia).errores.join("\n")).toMatch(/vacía/);

    const indentado = xml.replace("><DetallesItems>", ">\n  <DetallesItems>");
    expect(validarXmlContraEsquemaDgii(indentado).errores.join("\n")).toMatch(/compacto/);

    const ordenIncorrecto = xml.replace("<Encabezado><Version>1.0</Version>", "<Encabezado>");
    expect(validarXmlContraEsquemaDgii(ordenIncorrecto).errores.join("\n")).toMatch(/Version/);
  });

  it("detecta exc-c14n prohibido y Signature fuera de la última posición", () => {
    const par = generarCertificadoPruebaAutocontenido(RNC_OXYMAT, "OXYMAT SRL");
    const firmado = firmarXmlDsig(
      generarXmlEcf(documentoTipo("31")),
      par.clavePrivadaPem,
      par.certificadoPem,
    ).xmlFirmado;
    const conExc = firmado.replace(
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    );
    expect(validarXmlContraEsquemaDgii(conExc).errores.join("\n")).toMatch(/exc-c14n/);

    const inicio = firmado.indexOf("<Signature xmlns");
    const fin = firmado.indexOf("</Signature>", inicio) + "</Signature>".length;
    const firma = firmado.slice(inicio, fin);
    const sinFirma = firmado.slice(0, inicio) + firmado.slice(fin);
    const firmaMovida = sinFirma.replace("<FechaHoraFirma>", `${firma}<FechaHoraFirma>`);
    expect(validarXmlContraEsquemaDgii(firmaMovida).errores.join("\n")).toMatch(/último hijo|fuera de orden/);
  });
});

describe("Excel oficial de pruebas piloto OXYMAT", () => {
  it("genera la plantilla, la parsea y cada caso produce XML válido contra el esquema", async () => {
    const plantilla = await generarPlantillaExcelPruebasPiloto();
    expect(plantilla.length).toBeGreaterThan(1000);
    const casos = await parsearExcelPruebasDgii(plantilla);
    expect(casos).toHaveLength(9);
    expect(casos.map((caso) => caso.documento.emisor.rnc)).toEqual(Array(9).fill(RNC_OXYMAT));
    expect(casos.map((caso) => caso.documento.comprobante.tipo)).toEqual([
      "31",
      "32",
      "32",
      "34",
      "34",
      "41",
      "43",
      "44",
      "45",
    ]);
    for (const caso of casos) {
      const validacionDocumento = validarDocumentoEcf(caso.documento);
      expect(
        validacionDocumento.ok,
        `${caso.casoPrueba}: ${validacionDocumento.ok ? "" : validacionDocumento.errores.join("; ")}`,
      ).toBe(true);
      const xsd = validarXmlContraEsquemaDgii(generarXmlEcf(caso.documento), "ECF");
      expect(xsd.errores, `${caso.casoPrueba}: ${xsd.errores.join("; ")}`).toEqual([]);
    }
    const ncTardia = casos.find((caso) => caso.casoPrueba.includes("mayor de 30"));
    expect(ncTardia?.documento.comprobante.indicadorNotaCredito).toBe("1");
    const compras = casos.find((caso) => caso.documento.comprobante.tipo === "41");
    expect(compras?.documento.totales.totalItbisRetenido).toBe(54);
    expect(compras?.documento.totales.totalIsrRetencion).toBe(100);
  }, 30000);
});

describe("bloques XSD nivel oficial DGII", () => {
  function base31(): DocumentoEcfInput {
    return documentoTipo("31");
  }

  it("emite TablaFormasPago con FormaPago y MontoPago en la posición exacta del IdDoc", () => {
    const doc = base31();
    doc.comprobante.terminoPago = "30 dias";
    doc.comprobante.formasPago = [
      { formaPago: "1", montoPago: 100 },
      { formaPago: "2", montoPago: 18 },
    ];
    const xml = generarXmlEcf(doc);
    expect(xml).toContain(
      "<TablaFormasPago><FormaDePago><FormaPago>1</FormaPago><MontoPago>100.00</MontoPago></FormaDePago><FormaDePago><FormaPago>2</FormaPago><MontoPago>18.00</MontoPago></FormaDePago></TablaFormasPago>",
    );
    const posTermino = xml.indexOf("<TerminoPago>30 dias</TerminoPago>");
    const posFormas = xml.indexOf("<TablaFormasPago>");
    expect(posTermino).toBeGreaterThan(0);
    expect(posFormas).toBeGreaterThan(posTermino);
    const xsd = validarXmlContraEsquemaDgii(xml, "ECF");
    expect(xsd.errores).toEqual([]);
  });

  it("emite InformacionesAdicionales y Transporte antes de Totales en E31", () => {
    const doc = base31();
    doc.informacionesAdicionales = {
      numeroEmbarque: "EMB-1",
      numeroContenedor: "8019289",
      numeroReferencia: "1447",
      pesoBruto: 10.5,
      pesoNeto: 9.5,
      unidadPesoBruto: "24",
      cantidadBulto: 3,
    };
    doc.transporte = { conductor: "Rafael P¿rez", ficha: "J-1234", placa: "A639689", numeroAlbaran: "3634258" };
    const xml = generarXmlEcf(doc);
    expect(xml).toContain("<NumeroContenedor>8019289</NumeroContenedor>");
    expect(xml).toContain("<Conductor>Rafael P¿rez</Conductor>");
    expect(xml.indexOf("<InformacionesAdicionales>")).toBeLessThan(xml.indexOf("<Transporte>"));
    expect(xml.indexOf("<Transporte>")).toBeLessThan(xml.indexOf("<Totales>"));
    expect(xml.indexOf("<Totales>")).toBeLessThan(xml.indexOf("</Encabezado>"));
    const xsd = validarXmlContraEsquemaDgii(xml, "ECF");
    expect(xsd.errores).toEqual([]);
  });

  it("emite ISC de alcohol con subcantidades, grados y TablaImpuestoAdicional, y acepta ITBIS sobre base + ISC", () => {
    const doc = documentoTipo("45");
    doc.lineas = [
      {
        numeroLinea: 1,
        indicadorFacturacion: "1",
        nombreItem: "CAF¿",
        indicadorBienoServicio: "1",
        cantidad: 200,
        unidadMedida: "24",
        cantidadReferencia: 71,
        unidadReferencia: "24",
        subcantidades: [{ subcantidad: 0.355, codigoSubcantidad: "24" }],
        gradosAlcohol: 5,
        precioUnitarioReferencia: 900,
        precioUnitario: 900,
        impuestosAdicionales: [{ tipoImpuesto: "006" }, { tipoImpuesto: "023" }],
        itbisTasa: 18,
        montoItem: 180000,
      },
    ];
    doc.totales = {
      montoGravadoI1: 180000,
      montoGravadoI2: 0,
      montoGravadoI3: 0,
      montoExento: 0,
      totalItbis1: 49457.67,
      totalItbis2: 0,
      totalItbis3: 0,
      totalItbis: 49457.67,
      montoImpuestoAdicional: 94764.83,
      impuestosAdicionales: [
        {
          tipoImpuesto: "006",
          tasaImpuestoAdicional: 633.85,
          montoImpuestoSelectivoConsumoEspecifico: 54004.02,
          montoImpuestoSelectivoConsumoAdvalorem: 40760.81,
        },
      ],
      montoTotal: 324222.5,
    };
    const validacion = validarDocumentoEcf(doc);
    expect(validacion).toEqual({ ok: true });
    const xml = generarXmlEcf(doc);
    expect(xml).toContain("<TablaSubcantidad><SubcantidadItem><Subcantidad>0.355</Subcantidad>");
    expect(xml).toContain("<CodigoSubcantidad>24</CodigoSubcantidad>");
    expect(xml).toContain("<GradosAlcohol>5</GradosAlcohol>");
    expect(xml).toContain(
      "<TablaImpuestoAdicional><ImpuestoAdicional><TipoImpuesto>006</TipoImpuesto></ImpuestoAdicional><ImpuestoAdicional><TipoImpuesto>023</TipoImpuesto></ImpuestoAdicional></TablaImpuestoAdicional>",
    );
    expect(xml).toContain("<TasaImpuestoAdicional>633.85</TasaImpuestoAdicional>");
    expect(xml.indexOf("<TablaImpuestoAdicional>")).toBeLessThan(xml.indexOf("<MontoItem>180000.00</MontoItem>"));
    const xsd = validarXmlContraEsquemaDgii(xml, "ECF");
    expect(xsd.errores).toEqual([]);
    expect(xsd.valido).toBe(true);
  });

  it("emite DescuentosORecargos globales con TipoValor opcional y orden XSD", () => {
    const doc = base31();
    doc.descuentosORecargos = [
      {
        numeroLinea: 1,
        tipoAjuste: "D",
        descripcion: "Pronto pago",
        tipoValor: "$",
        valor: 10,
        monto: 10,
        indicadorFacturacion: "1",
      },
    ];
    doc.totales = { ...doc.totales, montoGravadoI1: 90, totalItbis1: 16.2, totalItbis: 16.2, montoTotal: 106.2 };
    const xml = generarXmlEcf(doc);
    expect(xml).toContain(
      "<DescuentosORecargos><DescuentoORecargo><NumeroLinea>1</NumeroLinea><TipoAjuste>D</TipoAjuste><DescripcionDescuentooRecargo>Pronto pago</DescripcionDescuentooRecargo><TipoValor>$</TipoValor><ValorDescuentooRecargo>10</ValorDescuentooRecargo><MontoDescuentooRecargo>10.00</MontoDescuentooRecargo><IndicadorFacturacionDescuentooRecargo>1</IndicadorFacturacionDescuentooRecargo></DescuentoORecargo></DescuentosORecargos>",
    );
    expect(xml.indexOf("</DetallesItems>")).toBeLessThan(xml.indexOf("<DescuentosORecargos>"));
    expect(xml.indexOf("<DescuentosORecargos>")).toBeLessThan(xml.indexOf("<FechaHoraFirma>"));
    const xsd = validarXmlContraEsquemaDgii(xml, "ECF");
    expect(xsd.errores).toEqual([]);
  });

  it("emite OtraMonedaDetalle en ítems aunque el encabezado no tenga OtraMoneda", () => {
    const doc = base31();
    doc.lineas = [
      {
        numeroLinea: 1,
        indicadorFacturacion: "1",
        nombreItem: "Item moneda extranjera",
        cantidad: 1,
        precioUnitario: 100,
        otraMoneda: { precioOtraMoneda: 3.55, montoItemOtraMoneda: 81.65 },
        itbisTasa: 18,
        montoItem: 100,
      },
    ];
    const xml = generarXmlEcf(doc);
    expect(xml).toContain(
      "<OtraMonedaDetalle><PrecioOtraMoneda>3.55</PrecioOtraMoneda><MontoItemOtraMoneda>81.65</MontoItemOtraMoneda></OtraMonedaDetalle>",
    );
    expect(xml).not.toContain("<OtraMoneda><TipoMoneda>");
    const xsd = validarXmlContraEsquemaDgii(xml, "ECF");
    expect(xsd.errores).toEqual([]);
  });

  it("emite E47 con IdentificadorExtranjero, sin RNCComprador y Transporte solo con PaisDestino", () => {
    const doc = documentoTipo("47");
    doc.comprador = { razonSocial: "PROVEEDOR EXTERIOR", identificadorExtranjero: "350555123" };
    doc.transporte = { paisDestino: "ESTADOS UNIDOS", conductor: "No debe emitirse" };
    const xml = generarXmlEcf(doc);
    expect(xml).toContain(
      "<Comprador><IdentificadorExtranjero>350555123</IdentificadorExtranjero><RazonSocialComprador>PROVEEDOR EXTERIOR</RazonSocialComprador></Comprador>",
    );
    expect(xml).toContain("<Transporte><PaisDestino>ESTADOS UNIDOS</PaisDestino></Transporte>");
    expect(xml).not.toContain("No debe emitirse");
    expect(xml).not.toContain("<RNCComprador>");
    const xsd = validarXmlContraEsquemaDgii(xml, "ECF");
    expect(xsd.errores).toEqual([]);
    expect(xsd.valido).toBe(true);
  });

  it("emite E34 con RazonModificacion en InformacionReferencia", () => {
    const doc = documentoTipo("34");
    doc.comprobante.razonModificacion = "Error en monto";
    const xml = generarXmlEcf(doc);
    expect(xml).toContain("<RazonModificacion>Error en monto</RazonModificacion>");
    expect(xml.indexOf("<CodigoModificacion>1</CodigoModificacion>")).toBeLessThan(xml.indexOf("<RazonModificacion>"));
    const xsd = validarXmlContraEsquemaDgii(xml, "ECF");
    expect(xsd.errores).toEqual([]);
  });

  it("acepta E43 sin TipoPago y sin Comprador", () => {
    const doc = documentoTipo("43");
    doc.comprobante.tipoPago = undefined;
    const validacion = validarDocumentoEcf(doc);
    expect(validacion).toEqual({ ok: true });
    const xml = generarXmlEcf(doc);
    expect(xml).not.toContain("<TipoPago>");
    expect(xml).not.toContain("<Comprador>");
    const xsd = validarXmlContraEsquemaDgii(xml, "ECF");
    expect(xsd.errores).toEqual([]);
    expect(xsd.valido).toBe(true);
  });

  it("exige TipoPago en los tipos donde el XSD lo vuelve obligatorio", () => {
    const doc = documentoTipo("31");
    doc.comprobante.tipoPago = undefined;
    const validacion = validarDocumentoEcf(doc);
    expect(validacion.ok).toBe(false);
  });
});

describe("ordenarCasosEnvioDgii", () => {
  function casoFalso(encf: string, ncfModificado?: string) {
    const doc = documentoTipo("31");
    doc.comprobante.encf = encf;
    doc.comprobante.ncfModificado = ncfModificado;
    return { casoPrueba: encf, numeroFila: 1, documento: doc, columnasNoReconocidas: [] };
  }

  it("envía primero los comprobantes referenciados como NCF modificado", () => {
    const casos = [
      casoFalso("E340000000002", "E310000000034"),
      casoFalso("E310000000007"),
      casoFalso("E310000000034"),
      casoFalso("E330000000001", "E320000000006"),
      casoFalso("E320000000006"),
    ];
    const orden = ordenarCasosEnvioDgii(casos).map((caso) => caso.documento.comprobante.encf);
    expect(orden.indexOf("E310000000034")).toBeLessThan(orden.indexOf("E340000000002"));
    expect(orden.indexOf("E320000000006")).toBeLessThan(orden.indexOf("E330000000001"));
    expect(orden).toHaveLength(5);
  });

  it("preserva el orden relativo de los comprobantes sin dependencias", () => {
    const casos = [casoFalso("E310000000001"), casoFalso("E310000000002"), casoFalso("E340000000001", "E310000000002")];
    const orden = ordenarCasosEnvioDgii(casos).map((caso) => caso.documento.comprobante.encf);
    expect(orden.indexOf("E310000000001")).toBeLessThan(orden.indexOf("E310000000002"));
    expect(orden).toHaveLength(3);
  });

  it("no rompe cuando el NCF modificado no está en el lote", () => {
    const casos = [casoFalso("E340000000009", "E310000099999"), casoFalso("E310000000001")];
    const orden = ordenarCasosEnvioDgii(casos).map((caso) => caso.documento.comprobante.encf);
    expect(orden).toEqual(["E340000000009", "E310000000001"]);
  });
});

describe("Excel oficial DGII OXYMAT real (29/29)", () => {
  const RUTA_EXCEL = "/root/referencias/ecf-oxymat/131488791-27112026113533.xlsx";

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: el test integral recorre los 29 XML oficiales verificando firma y esquema por tipo
  it("parsea 25 ECF + 4 RFCE, genera 29 XML firmados, verificados y válidos contra el esquema", async () => {
    if (!existsSync(RUTA_EXCEL)) {
      console.warn("Excel oficial DGII no disponible en este entorno (CI); se omite la validación 29/29");
      return;
    }
    const casos = await parsearExcelPruebasDgii(readFileSync(RUTA_EXCEL));
    expect(casos).toHaveLength(25);
    for (const caso of casos) {
      expect(caso.columnasNoReconocidas, `${caso.casoPrueba}: columnas no reconocidas`).toEqual([]);
    }
    expect(casos.filter((caso) => caso.rfce)).toHaveLength(4);

    const ordenados = ordenarCasosEnvioDgii(casos);
    const encfs = ordenados.map((caso) => caso.documento.comprobante.encf);
    expect(encfs.indexOf("E320000000006")).toBeLessThan(encfs.indexOf("E330000000001"));
    expect(encfs.indexOf("E310000000034")).toBeLessThan(encfs.indexOf("E340000000002"));
    expect(encfs.indexOf("E440000000013")).toBeLessThan(encfs.indexOf("E340000000013"));

    const par = generarCertificadoPruebaAutocontenido(RNC_OXYMAT, "OXYMAT SRL");
    let total = 0;
    let firmasValidas = 0;
    let esquemaValidos = 0;
    const fallas: string[] = [];
    for (const caso of ordenados) {
      const encf = caso.documento.comprobante.encf;
      const validacionDocumento = validarDocumentoEcf(caso.documento);
      if (!validacionDocumento.ok) {
        fallas.push(`${encf} documento: ${validacionDocumento.errores.join("; ")}`);
        continue;
      }
      const xml = generarXmlEcf(caso.documento);
      const firma = firmarXmlDsig(xml, par.clavePrivadaPem, par.certificadoPem);
      total += 1;
      if (verificarFirmaXmlDsig(firma.xmlFirmado).valida) firmasValidas += 1;
      else fallas.push(`${encf} firma inválida`);
      const xsd = validarXmlContraEsquemaDgii(firma.xmlFirmado, "ECF");
      if (xsd.valido) esquemaValidos += 1;
      else fallas.push(`${encf} xsd: ${xsd.errores.join("; ")}`);

      if (caso.rfce) {
        const xmlRfce = generarXmlRfce(caso.documento, firma.codigoSeguridad);
        const firmaRfce = firmarXmlDsig(xmlRfce, par.clavePrivadaPem, par.certificadoPem);
        total += 1;
        if (verificarFirmaXmlDsig(firmaRfce.xmlFirmado).valida) firmasValidas += 1;
        else fallas.push(`RFCE-${encf} firma inválida`);
        const xsdRfce = validarXmlContraEsquemaDgii(firmaRfce.xmlFirmado, "RFCE");
        if (xsdRfce.valido) esquemaValidos += 1;
        else fallas.push(`RFCE-${encf} xsd: ${xsdRfce.errores.join("; ")}`);
      }
    }
    expect(fallas).toEqual([]);
    expect(total).toBe(29);
    expect(firmasValidas).toBe(29);
    expect(esquemaValidos).toBe(29);
  }, 60000);

  it("respeta los datos literales del Excel: fechas 2020, montos ISC, extranjeros y sentinel #e", async () => {
    if (!existsSync(RUTA_EXCEL)) return;
    const casos = await parsearExcelPruebasDgii(readFileSync(RUTA_EXCEL));
    const porEncf = new Map(casos.map((caso) => [caso.documento.comprobante.encf, caso]));

    const nc = porEncf.get("E330000000001");
    expect(nc?.documento.comprobante.ncfModificado).toBe("E320000000006");
    expect(nc?.documento.comprobante.codigoModificacion).toBe("3");
    expect(nc?.documento.comprobante.fechaEmision).toBe("02-04-2020");
    expect(nc?.documento.informacionesAdicionales?.numeroContenedor).toBe("8019289");
    expect(nc?.documento.comprobante.fechaHoraFirma).toBeUndefined();

    const isc = porEncf.get("E450000000007");
    expect(isc?.documento.lineas[0]?.gradosAlcohol).toBe(5);
    expect(isc?.documento.lineas[0]?.subcantidades?.[0]?.subcantidad).toBe(0.355);
    expect(isc?.documento.lineas[0]?.impuestosAdicionales?.map((impuesto) => impuesto.tipoImpuesto)).toEqual([
      "006",
      "023",
    ]);
    expect(isc?.documento.totales.impuestosAdicionales?.[0]?.tasaImpuestoAdicional).toBe(633.85);
    expect(isc?.documento.totales.totalItbis1).toBe(49457.67);

    const exterior = porEncf.get("E470000000007");
    expect(exterior?.documento.comprador.rnc).toBeUndefined();
    expect(exterior?.documento.comprador.identificadorExtranjero).toBe("350555123");
    expect(exterior?.documento.transporte?.paisDestino).toBe("ESTADOS UNIDOS");

    const gastosMenores = porEncf.get("E430000000010");
    expect(gastosMenores?.documento.comprobante.tipoPago).toBeUndefined();

    const notaCredito = porEncf.get("E340000000002");
    expect(notaCredito?.documento.comprobante.razonModificacion).toBe("Error en monto");

    const descuentoGlobal = porEncf.get("E310000000011");
    expect(descuentoGlobal?.documento.descuentosORecargos?.[0]?.tipoAjuste).toBe("D");
    expect(descuentoGlobal?.documento.descuentosORecargos?.[0]?.monto).toBe(1500);

    const monedaLinea = porEncf.get("E310000000010");
    expect(monedaLinea?.documento.otraMoneda).toBeUndefined();
    expect(monedaLinea?.documento.lineas[0]?.otraMoneda?.precioOtraMoneda).toBe(3.55);
    expect(monedaLinea?.documento.lineas[0]?.otraMoneda?.montoItemOtraMoneda).toBe(81.65);
  }, 60000);

  it("exige MontoPago en FormaDePago de e-CF, aplica variante E44 en ImpuestosAdicionales y tope ANECF", () => {
    const e31SinMonto = documentoTipo("31");
    e31SinMonto.comprobante.formasPago = [{ formaPago: "1" }];
    const valSinMonto = validarDocumentoEcf(e31SinMonto);
    expect(valSinMonto.ok).toBe(false);
    expect(() => generarXmlEcf(e31SinMonto)).toThrow(/MontoPago/i);

    const e44Selectivo = documentoTipo("44");
    e44Selectivo.totales.montoImpuestoAdicional = 10;
    e44Selectivo.totales.montoTotal = 110;
    e44Selectivo.totales.impuestosAdicionales = [
      { tipoImpuesto: "006", tasaImpuestoAdicional: 10, montoImpuestoSelectivoConsumoEspecifico: 10 },
    ];
    expect(validarDocumentoEcf(e44Selectivo).ok).toBe(false);
    expect(() => generarXmlEcf(e44Selectivo)).toThrow(/E44/i);

    const e44Otros = documentoTipo("44");
    e44Otros.totales.montoImpuestoAdicional = 10;
    e44Otros.totales.montoTotal = 110;
    e44Otros.totales.impuestosAdicionales = [
      { tipoImpuesto: "001", tasaImpuestoAdicional: 10, otrosImpuestosAdicionales: 10 },
    ];
    expect(validarDocumentoEcf(e44Otros).ok).toBe(true);
    const xsdE44 = validarXmlContraEsquemaDgii(generarXmlEcf(e44Otros), "ECF");
    expect(xsdE44.errores).toEqual([]);
    expect(xsdE44.valido).toBe(true);

    const onceAnulaciones = Array.from({ length: 11 }, (_, idx) => ({
      tipo: "31" as const,
      rangos: [
        {
          desde: `E31${String(idx + 1).padStart(10, "0")}`,
          hasta: `E31${String(idx + 1).padStart(10, "0")}`,
        },
      ],
    }));
    expect(() =>
      generarXmlAnecf({
        rncEmisor: RNC_OXYMAT,
        fechaHoraAnulacion: "15-01-2026 10:00:00",
        anulaciones: onceAnulaciones,
      }),
    ).toThrow(/10/);
  });
});

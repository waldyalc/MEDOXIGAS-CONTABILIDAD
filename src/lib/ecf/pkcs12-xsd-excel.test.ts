import { describe, expect, it } from "vitest";

import { generarPlantillaExcelPruebasPiloto, parsearExcelPruebasDgii } from "./excel-pruebas";
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
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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

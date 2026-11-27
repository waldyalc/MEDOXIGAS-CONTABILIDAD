import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { enviarAprobacionComercialDgii, type FetchEcf } from "./cliente-dgii";
import { endpointsDgii } from "./endpoints";
import { nombreArchivoAcecfDgii, parsearExcelAcecfDgii } from "./excel-acecf";
import { firmarXmlDsig, generarCertificadoPruebaAutocontenido, verificarFirmaXmlDsig } from "./firma";
import type { AprobacionComercialInput } from "./tipos";
import { validarXmlContraEsquemaDgii } from "./validador-xsd";
import { generarXmlAcecf, normalizarMontoAcecfDgii } from "./xml";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const RUTA_EXCEL_ACECF = "/root/referencias/ecf-oxymat/131488791-27112026175301.xlsx";
const RUTA_XSD_ACECF = "/root/referencias/ecf-xsd/ACECF_v.1.0.xsd";
const RUTA_XMLSCHEMA = "/tmp/xsddeps-xmlschema";

function aprobacionBase(cambios: Partial<AprobacionComercialInput> = {}): AprobacionComercialInput {
  return {
    rncEmisor: "131880681",
    rncComprador: "131488791",
    encf: "E310000000001",
    fechaEmision: "15-01-2026",
    montoTotal: 118,
    estado: "1",
    fechaHoraAprobacionComercial: "15-01-2026 10:30:00",
    ...cambios,
  };
}

async function crearExcelAcecfSintetico(): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("ACEECF_Generadas");
  hoja.addRow([
    "Version",
    "RNCEmisor",
    "eNCF",
    "FechaEmision",
    "MontoTotal",
    "RNCComprador",
    "Estado",
    "DetalleMotivoRechazo",
    "FechaHoraAprobacionComercial",
    "ObservacionExterna",
  ]);
  hoja.addRow([
    "1.0",
    "131880681",
    "E310000000001",
    "15-01-2026",
    25000000,
    "131488791",
    1,
    "#e",
    "27-11-2026 17:53:01",
    "columna externa",
  ]);
  hoja.addRow([
    "1.0",
    "131880681",
    "E310000000002",
    "16-01-2026",
    228460.5,
    "131488791",
    2,
    "  Rechazado por inconsistencia comercial  ",
    "27-11-2026 17:53:02",
    "",
  ]);
  hoja.addRow([
    "1.0",
    "131880681",
    "E310000000003",
    "17-01-2026",
    null,
    "131488791",
    1,
    null,
    "27-11-2026 17:53:03",
    "",
  ]);
  hoja.addRow([
    1,
    "131880681",
    "E310000000004",
    new Date(Date.UTC(2026, 0, 18)),
    400000,
    "131488791",
    1,
    "   ",
    new Date(Date.UTC(2026, 10, 27, 17, 53, 4)),
    "",
  ]);
  hoja.getCell("E4").value = { formula: '"324222.49"', result: "324222.49" };
  hoja.getCell("B4").value = { richText: [{ text: "131" }, { text: "880681" }] };
  hoja.getCell("H4").value = { richText: [{ text: "Observación " }, { text: "comercial" }] };
  const contenido = await libro.xlsx.writeBuffer();
  return Buffer.from(contenido as ArrayBuffer);
}

function validarXmlsFirmadosConPython(xmls: string[]): void {
  const script = [
    "import io, json, sys, xmlschema",
    "xsd = open('/root/referencias/ecf-xsd/ACECF_v.1.0.xsd', encoding='utf-8-sig').read().replace('(?:20|20)', '(20)')",
    "schema = xmlschema.XMLSchema(io.StringIO(xsd))",
    "xmls = json.load(sys.stdin)",
    "errores = []",
    "for indice, xml in enumerate(xmls, 1):",
    "    if not schema.is_valid(io.StringIO(xml)):",
    "        errores.append(str(indice))",
    "print(json.dumps({'validos': len(xmls) - len(errores), 'errores': errores}))",
  ].join("\n");
  const pythonPath = process.env.PYTHONPATH ? `${RUTA_XMLSCHEMA}:${process.env.PYTHONPATH}` : RUTA_XMLSCHEMA;
  const salida = execFileSync("python3", ["-c", script], {
    input: JSON.stringify(xmls),
    encoding: "utf8",
    env: { ...process.env, PYTHONPATH: pythonPath },
    maxBuffer: 1024 * 1024,
  });
  const resultado = JSON.parse(salida) as { validos: number; errores: string[] };
  expect(resultado).toEqual({ validos: xmls.length, errores: [] });
}

describe("generarXmlAcecf y normalizarMontoAcecfDgii", () => {
  it("normaliza montos del Excel a exactamente dos decimales sin perder dígitos", () => {
    expect(normalizarMontoAcecfDgii("228460.5")).toBe("228460.50");
    expect(normalizarMontoAcecfDgii("25000000")).toBe("25000000.00");
    expect(normalizarMontoAcecfDgii("324222.49")).toBe("324222.49");
    expect(normalizarMontoAcecfDgii(400000)).toBe("400000.00");

    const xml = generarXmlAcecf(aprobacionBase({ montoTotal: 228460.5, montoTotalTexto: "228460.5" }));
    expect(xml).toContain("<MontoTotal>228460.50</MontoTotal>");
    expect(xml).toContain("<FechaEmision>15-01-2026</FechaEmision>");
    expect(xml).toContain("<FechaHoraAprobacionComercial>15-01-2026 10:30:00</FechaHoraAprobacionComercial>");
  });

  it("rechaza montos negativos, científicos, con más de dos decimales o de más de 18 dígitos", () => {
    for (const invalido of ["-1", "1e3", "1,000.00", "1.234", "12345678901234567.00"]) {
      expect(() => normalizarMontoAcecfDgii(invalido)).toThrow(/monto total ACECF/i);
    }
  });

  it("omite DetalleMotivoRechazo vacío, whitespace o centinela #e", () => {
    for (const detalleMotivoRechazo of [undefined, "", "   ", "#e"]) {
      const xml = generarXmlAcecf(aprobacionBase({ detalleMotivoRechazo }));
      expect(xml).not.toContain("<DetalleMotivoRechazo>");
    }
  });

  it("exige motivo no vacío y de máximo 250 caracteres cuando Estado es 2", () => {
    expect(() => generarXmlAcecf(aprobacionBase({ estado: "2" }))).toThrow(/detalle del motivo/i);
    expect(() => generarXmlAcecf(aprobacionBase({ estado: "2", detalleMotivoRechazo: "#e" }))).toThrow(
      /detalle del motivo/i,
    );
    expect(() => generarXmlAcecf(aprobacionBase({ estado: "2", detalleMotivoRechazo: "x".repeat(251) }))).toThrow(
      /250 caracteres/i,
    );

    const xml = generarXmlAcecf(
      aprobacionBase({ estado: "2", detalleMotivoRechazo: "El comprador rechazó el documento" }),
    );
    expect(xml).toContain("<Estado>2</Estado>");
    expect(xml).toContain("<DetalleMotivoRechazo>El comprador rechazó el documento</DetalleMotivoRechazo>");
    const xsd = validarXmlContraEsquemaDgii(xml, "ACECF");
    expect(xsd.errores).toEqual([]);
    expect(xsd.valido).toBe(true);
  });

  it("valida ACECF firmado y verifica la firma XMLDSig", () => {
    const par = generarCertificadoPruebaAutocontenido("131488791", "OXYMAT SRL");
    const firma = firmarXmlDsig(generarXmlAcecf(aprobacionBase()), par.clavePrivadaPem, par.certificadoPem);
    expect(verificarFirmaXmlDsig(firma.xmlFirmado).valida).toBe(true);
    const xsd = validarXmlContraEsquemaDgii(firma.xmlFirmado, "ACECF");
    expect(xsd.errores).toEqual([]);
    expect(xsd.valido).toBe(true);
  });
});

describe("validador XSD ACECF", () => {
  it("detecta las restricciones específicas de ACECF_v.1.0.xsd", () => {
    const base = generarXmlAcecf(aprobacionBase());
    const versionMala = base.replace("<Version>1.0</Version>", "<Version>2.0</Version>");
    expect(validarXmlContraEsquemaDgii(versionMala, "ACECF").errores.join("\n")).toMatch(/Version/);

    const montoEntero = base.replace("<MontoTotal>118.00</MontoTotal>", "<MontoTotal>118</MontoTotal>");
    expect(validarXmlContraEsquemaDgii(montoEntero, "ACECF").errores.join("\n")).toMatch(/dos decimales/);

    const montoLargo = base.replace("<MontoTotal>118.00</MontoTotal>", "<MontoTotal>12345678901234567.00</MontoTotal>");
    expect(validarXmlContraEsquemaDgii(montoLargo, "ACECF").errores.join("\n")).toMatch(/18 dígitos/);

    const estadoMalo = base.replace("<Estado>1</Estado>", "<Estado>3</Estado>");
    expect(validarXmlContraEsquemaDgii(estadoMalo, "ACECF").errores.join("\n")).toMatch(/Estado/);

    const rechazoSinMotivo = base.replace("<Estado>1</Estado>", "<Estado>2</Estado>");
    expect(validarXmlContraEsquemaDgii(rechazoSinMotivo, "ACECF").errores.join("\n")).toMatch(/obligatorio/);

    const fechaImposible = base.replace(
      "<FechaEmision>15-01-2026</FechaEmision>",
      "<FechaEmision>31-02-2026</FechaEmision>",
    );
    expect(validarXmlContraEsquemaDgii(fechaImposible, "ACECF").errores.join("\n")).toMatch(/fecha calendario/);

    const anioFuera = base.replace(
      "<FechaEmision>15-01-2026</FechaEmision>",
      "<FechaEmision>15-01-1999</FechaEmision>",
    );
    expect(validarXmlContraEsquemaDgii(anioFuera, "ACECF").errores.join("\n")).toMatch(/20xx/);

    const horaMala = base.replace(
      "<FechaHoraAprobacionComercial>15-01-2026 10:30:00</FechaHoraAprobacionComercial>",
      "<FechaHoraAprobacionComercial>15-01-2026 24:00:00</FechaHoraAprobacionComercial>",
    );
    expect(validarXmlContraEsquemaDgii(horaMala, "ACECF").errores.join("\n")).toMatch(/fecha y hora/);

    const motivoLargo = base.replace(
      "<Estado>1</Estado>",
      `<Estado>2</Estado><DetalleMotivoRechazo>${"x".repeat(251)}</DetalleMotivoRechazo>`,
    );
    expect(validarXmlContraEsquemaDgii(motivoLargo, "ACECF").errores.join("\n")).toMatch(/250 caracteres/);
  });
});

describe("endpoint y cliente HTTP de Aprobación Comercial DGII", () => {
  it("expone el endpoint oficial por ambiente", () => {
    expect(endpointsDgii("certecf").aprobacionComercial).toBe(
      "https://ecf.dgii.gov.do/certecf/aprobacioncomercial/api/aprobacioncomercial",
    );
    expect(endpointsDgii("ecf").aprobacionComercial).toBe(
      "https://ecf.dgii.gov.do/ecf/aprobacioncomercial/api/aprobacioncomercial",
    );
  });

  it("envía multipart el ACECF firmado y normaliza una aprobación codigo 1", async () => {
    const llamadas: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock: FetchEcf = async (url, init) => {
      llamadas.push({ url, init });
      return new Response(JSON.stringify({ codigo: "1", estado: "Aprobada", mensaje: null }), { status: 200 });
    };
    const resultado = await enviarAprobacionComercialDgii({
      ambiente: "certecf",
      token: "token-aprobacion",
      nombreArchivo: "131488791E310000000001.xml",
      xmlFirmado: "<ACECF />",
      fetchFn: fetchMock,
    });

    expect(resultado).toEqual({ codigo: "1", estado: "aceptado", estadoOriginal: "Aprobada", mensajes: [] });
    expect(llamadas[0]?.url).toBe(endpointsDgii("certecf").aprobacionComercial);
    expect(llamadas[0]?.init?.method).toBe("POST");
    expect(llamadas[0]?.init?.headers).toMatchObject({
      accept: "application/json",
      Authorization: "Bearer token-aprobacion",
    });
    const body = llamadas[0]?.init?.body;
    if (!(body instanceof FormData)) throw new Error("La aprobación comercial no envió multipart/form-data");
    const archivo = body.get("xml");
    if (!(archivo instanceof Blob)) throw new Error("El ACECF no viajó como archivo XML");
    expect(await archivo.text()).toBe("<ACECF />");
  });

  it("normaliza un rechazo HTTP 400 con codigo 02 y mensaje oficial", async () => {
    const fetchMock: FetchEcf = async () =>
      new Response(JSON.stringify({ codigo: "02", estado: "Rechazada", mensaje: ["Motivo comercial inválido"] }), {
        status: 400,
      });
    const resultado = await enviarAprobacionComercialDgii({
      ambiente: "certecf",
      token: "token",
      nombreArchivo: "acecf.xml",
      xmlFirmado: "<ACECF />",
      fetchFn: fetchMock,
    });
    expect(resultado).toEqual({
      codigo: "02",
      estado: "rechazado",
      estadoOriginal: "Rechazada",
      mensajes: ["Motivo comercial inválido"],
    });
  });

  it("bloquea el ambiente productivo ecf sin confirmación explícita", async () => {
    let llamado = false;
    const fetchMock: FetchEcf = async () => {
      llamado = true;
      return new Response("{}", { status: 200 });
    };
    await expect(
      enviarAprobacionComercialDgii({
        ambiente: "ecf",
        token: "token",
        nombreArchivo: "acecf.xml",
        xmlFirmado: "<ACECF />",
        fetchFn: fetchMock,
      }),
    ).rejects.toThrow(/confirmarProduccion/);
    expect(llamado).toBe(false);
  });

  it("lanza error claro cuando HTTP 500 no trae la estructura JSON oficial", async () => {
    const fetchMock: FetchEcf = async () => new Response("error interno DGII", { status: 500 });
    await expect(
      enviarAprobacionComercialDgii({
        ambiente: "certecf",
        token: "token",
        nombreArchivo: "acecf.xml",
        xmlFirmado: "<ACECF />",
        fetchFn: fetchMock,
      }),
    ).rejects.toThrow(/HTTP 500/);
  });
});

describe("parser Excel ACECF DGII", () => {
  it("construye el nombre oficial de archivo RNCComprador + eNCF", () => {
    expect(nombreArchivoAcecfDgii("131-488-791", " e310000000007 ")).toBe("131488791E310000000007.xml");
  });

  it("parsea montos, estados, fechas, richText, fórmulas y centinela #e de un libro sintético", async () => {
    const casos = await parsearExcelAcecfDgii(await crearExcelAcecfSintetico());
    expect(casos).toHaveLength(4);
    expect(casos[0]?.columnasNoReconocidas).toEqual(["ObservacionExterna"]);

    expect(casos[0]?.montoTotalTexto).toBe("25000000.00");
    expect(casos[0]?.aprobacion.detalleMotivoRechazo).toBeUndefined();
    expect(casos[0]?.nombreArchivoAcecf).toBe("131488791E310000000001.xml");

    expect(casos[1]?.montoTotalTexto).toBe("228460.50");
    expect(casos[1]?.aprobacion.estado).toBe("2");
    expect(casos[1]?.aprobacion.detalleMotivoRechazo).toBe("Rechazado por inconsistencia comercial");

    expect(casos[2]?.montoTotalTexto).toBe("324222.49");
    expect(casos[2]?.aprobacion.rncEmisor).toBe("131880681");
    expect(casos[2]?.aprobacion.detalleMotivoRechazo).toBe("Observación comercial");

    expect(casos[3]?.version).toBe("1.0");
    expect(casos[3]?.montoTotalTexto).toBe("400000.00");
    expect(casos[3]?.fechaEmisionLiteral).toBe("18-01-2026");
    expect(casos[3]?.fechaHoraAprobacionLiteral).toBe("27-11-2026 17:53:04");
    expect(casos[3]?.aprobacion.detalleMotivoRechazo).toBeUndefined();
  });

  it("rechaza libros sin encabezados obligatorios o sin filas válidas", async () => {
    const incompleto = new ExcelJS.Workbook();
    const hojaIncompleta = incompleto.addWorksheet("ACEECF_Generadas");
    hojaIncompleta.addRow(["RNCEmisor", "eNCF"]);
    hojaIncompleta.addRow(["131880681", "E310000000001"]);
    const contenidoIncompleto = await incompleto.xlsx.writeBuffer();
    await expect(parsearExcelAcecfDgii(Buffer.from(contenidoIncompleto as ArrayBuffer))).rejects.toThrow(
      /encabezados obligatorios/i,
    );

    const vacio = new ExcelJS.Workbook();
    const hojaVacia = vacio.addWorksheet("ACEECF_Generadas");
    hojaVacia.addRow(["Version", "RNCEmisor", "eNCF", "MontoTotal", "RNCComprador", "Estado"]);
    const contenidoVacio = await vacio.xlsx.writeBuffer();
    await expect(parsearExcelAcecfDgii(Buffer.from(contenidoVacio as ArrayBuffer))).rejects.toThrow(/filas válidas/i);
  });
});

describe("integración real ACECF OXYMAT paso 3", () => {
  it("parsea, firma y valida 11/11 aprobaciones contra el validador interno y ACECF_v.1.0.xsd", async () => {
    if (!existsSync(RUTA_EXCEL_ACECF)) return;
    const casos = await parsearExcelAcecfDgii(readFileSync(RUTA_EXCEL_ACECF));
    expect(casos).toHaveLength(11);
    expect(casos.every((caso) => caso.columnasNoReconocidas.length === 0)).toBe(true);
    expect(casos.every((caso) => caso.version === "1.0")).toBe(true);
    expect(casos.every((caso) => caso.aprobacion.rncEmisor === "131880681")).toBe(true);
    expect(casos.every((caso) => caso.aprobacion.rncComprador === "131488791")).toBe(true);
    expect(casos.every((caso) => caso.aprobacion.estado === "1")).toBe(true);
    expect(casos.every((caso) => caso.fechaHoraAprobacionLiteral === "27-11-2026 17:53:01")).toBe(true);
    expect(casos.map((caso) => caso.montoTotalTexto)).toEqual([
      "228460.50",
      "96365.30",
      "95597.70",
      "25000000.00",
      "400000.00",
      "566695.00",
      "917095.00",
      "432000.00",
      "917095.00",
      "324222.49",
      "560925.00",
    ]);
    expect(casos.map((caso) => caso.nombreArchivoAcecf)).toEqual([
      "131488791E310000000007.xml",
      "131488791E310000000010.xml",
      "131488791E310000000011.xml",
      "131488791E310000000034.xml",
      "131488791E330000000001.xml",
      "131488791E340000000002.xml",
      "131488791E340000000013.xml",
      "131488791E440000000008.xml",
      "131488791E440000000013.xml",
      "131488791E450000000007.xml",
      "131488791E450000000009.xml",
    ]);

    const par = generarCertificadoPruebaAutocontenido("131488791", "OXYMAT SRL");
    const xmlsFirmados: string[] = [];
    for (const caso of casos) {
      const xml = generarXmlAcecf(caso.aprobacion);
      expect(xml).toContain(`<MontoTotal>${caso.montoTotalTexto}</MontoTotal>`);
      expect(xml).toContain(`<FechaEmision>${caso.fechaEmisionLiteral}</FechaEmision>`);
      expect(xml).toContain(
        `<FechaHoraAprobacionComercial>${caso.fechaHoraAprobacionLiteral}</FechaHoraAprobacionComercial>`,
      );
      expect(xml).not.toContain("<DetalleMotivoRechazo>");
      const firma = firmarXmlDsig(xml, par.clavePrivadaPem, par.certificadoPem);
      expect(verificarFirmaXmlDsig(firma.xmlFirmado).valida).toBe(true);
      const validacion = validarXmlContraEsquemaDgii(firma.xmlFirmado, "ACECF");
      expect(validacion.errores).toEqual([]);
      expect(validacion.valido).toBe(true);
      xmlsFirmados.push(firma.xmlFirmado);
    }
    expect(xmlsFirmados).toHaveLength(11);

    if (existsSync(RUTA_XSD_ACECF) && existsSync(RUTA_XMLSCHEMA)) {
      validarXmlsFirmadosConPython(xmlsFirmados);
    }
  }, 30000);
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { POST as postAprobacionComercial } from "@/app/api/ecf/[rnc]/fe/aprobacioncomercial/api/ecf/route";
import { GET as getSemilla } from "@/app/api/ecf/[rnc]/fe/autenticacion/api/semilla/route";
import { POST as postValidacionCertificado } from "@/app/api/ecf/[rnc]/fe/autenticacion/api/validacioncertificado/route";
import { POST as postRecepcionEcf } from "@/app/api/ecf/[rnc]/fe/recepcion/api/ecf/route";

import { firmarXmlDsig, generarCertificadoPruebaAutocontenido, verificarFirmaXmlDsig } from "./firma";
import {
  emitirSemillaReceptor,
  resolverCredencialesFirmaRnc,
  validarRncRuta,
  validarSemillaFirmadaYCrearToken,
  verificarTokenReceptor,
} from "./receptor";
import type { DocumentoEcfInput, ParCertificadoEcf } from "./tipos";
import { generarXmlAcecf, generarXmlEcf } from "./xml";

const RNC_OXYMAT = "131488791";
const RNC_MEDOXIGAS = "130893489";
const RNC_EMISOR = "131999999";
const CLAVES_ENV = [
  "ECF_TOKEN_SECRET",
  "ECF_ENCRYPTION_KEY",
  "ECF_ALLOW_TEST_SELF_SIGNED",
  `ECF_CERT_PEM_${RNC_OXYMAT}`,
  `ECF_KEY_PEM_${RNC_OXYMAT}`,
  `ECF_CERT_PEM_${RNC_MEDOXIGAS}`,
  `ECF_KEY_PEM_${RNC_MEDOXIGAS}`,
];

const valoresEnv = new Map<string, string | undefined>();
const tokens = new Map<string, string>();
let certificadoOxymat: ParCertificadoEcf;
let certificadoMedoxigas: ParCertificadoEcf;
let certificadoEmisor: ParCertificadoEcf;

function contexto(rnc: string): { params: Promise<{ rnc: string }> } {
  return { params: Promise.resolve({ rnc }) };
}

function documentoE31(rncComprador: string, encf = "E310000000001"): DocumentoEcfInput {
  return {
    emisor: {
      rnc: RNC_EMISOR,
      razonSocial: "PROVEEDOR ELECTRONICO DE PRUEBA SRL",
      direccion: "Av. Prueba No. 10",
      municipio: "010100",
      provincia: "010000",
      correo: "proveedor@example.com",
    },
    comprador: { rnc: rncComprador, razonSocial: rncComprador === RNC_OXYMAT ? "OXYMAT SRL" : "MEDOXIGAS ALC, SRL" },
    comprobante: {
      tipo: "31",
      encf,
      fechaEmision: "26-11-2026",
      fechaVencimientoSecuencia: "31-12-2027",
      tipoIngresos: "01",
      tipoPago: "2",
      indicadorMontoGravado: "0",
      fechaHoraFirma: "26-11-2026 10:00:00",
    },
    lineas: [
      {
        numeroLinea: 1,
        indicadorFacturacion: "1",
        nombreItem: "Oxigeno medicinal",
        cantidad: 1,
        unidadMedida: "43",
        precioUnitario: 100,
        descuento: 0,
        itbisTasa: 18,
        montoItem: 100,
        indicadorBienoServicio: "1",
      },
    ],
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

function firmarDocumento(xml: string, certificado = certificadoEmisor): string {
  return firmarXmlDsig(xml, certificado.clavePrivadaPem, certificado.certificadoPem).xmlFirmado;
}

function solicitudXml(xml: string, rnc: string, token?: string): Request {
  const form = new FormData();
  form.append("xml", new Blob([xml], { type: "application/xml" }), `${RNC_EMISOR}E310000000001.xml`);
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request(`https://receptor.local/api/ecf/${rnc}/fe/prueba`, { method: "POST", body: form, headers });
}

async function jsonObjeto(response: Response): Promise<Record<string, unknown>> {
  const valor: unknown = await response.json();
  if (typeof valor !== "object" || valor === null || Array.isArray(valor))
    throw new Error("La respuesta no es JSON objeto");
  return valor as Record<string, unknown>;
}

async function tokenPara(rnc: string): Promise<string> {
  const existente = tokens.get(rnc);
  if (existente) return existente;
  const semillaResponse = await getSemilla(
    new Request(`https://receptor.local/api/ecf/${rnc}/fe/autenticacion/api/semilla`),
    contexto(rnc),
  );
  expect(semillaResponse.status).toBe(200);
  expect(semillaResponse.headers.get("content-type")).toContain("application/xml");
  const semillaXml = await semillaResponse.text();
  expect(semillaXml).toContain("<SemillaModel>");
  const semillaFirmada = firmarDocumento(semillaXml);
  const validacionResponse = await postValidacionCertificado(solicitudXml(semillaFirmada, rnc), contexto(rnc));
  expect(validacionResponse.status).toBe(200);
  const cuerpo = await jsonObjeto(validacionResponse);
  expect(typeof cuerpo.token).toBe("string");
  expect(typeof cuerpo.expira).toBe("string");
  expect(typeof cuerpo.expedido).toBe("string");
  const token = cuerpo.token;
  if (typeof token !== "string") throw new Error("La validación no devolvió token");
  tokens.set(rnc, token);
  return token;
}

function certificadoBase64(pem: string): string {
  return pem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s/g, "");
}

beforeAll(() => {
  for (const clave of CLAVES_ENV) valoresEnv.set(clave, process.env[clave]);
  certificadoOxymat = generarCertificadoPruebaAutocontenido(RNC_OXYMAT, "OXYMAT SRL");
  certificadoMedoxigas = generarCertificadoPruebaAutocontenido(RNC_MEDOXIGAS, "MEDOXIGAS ALC, SRL");
  certificadoEmisor = generarCertificadoPruebaAutocontenido(RNC_EMISOR, "PROVEEDOR ELECTRONICO DE PRUEBA SRL");
  process.env.ECF_TOKEN_SECRET = "secreto-receptor-ecf-solo-vitest";
  process.env.ECF_ALLOW_TEST_SELF_SIGNED = "false";
  process.env[`ECF_CERT_PEM_${RNC_OXYMAT}`] = certificadoOxymat.certificadoPem;
  process.env[`ECF_KEY_PEM_${RNC_OXYMAT}`] = certificadoOxymat.clavePrivadaPem;
  process.env[`ECF_CERT_PEM_${RNC_MEDOXIGAS}`] = certificadoMedoxigas.certificadoPem;
  process.env[`ECF_KEY_PEM_${RNC_MEDOXIGAS}`] = certificadoMedoxigas.clavePrivadaPem;
});

afterAll(() => {
  for (const clave of CLAVES_ENV) {
    const valor = valoresEnv.get(clave);
    if (valor === undefined) delete process.env[clave];
    else process.env[clave] = valor;
  }
});

describe("receptor e-CF: semilla, token y credenciales multi-RNC", () => {
  it("valida el RNC de ruta de 9 u 11 dígitos", () => {
    expect(validarRncRuta(RNC_OXYMAT)).toBeNull();
    expect(validarRncRuta("12345678901")).toBeNull();
    expect(validarRncRuta("123")).toContain("9 u 11");
    expect(validarRncRuta("13148879A")).toContain("9 u 11");
  });

  it("emite semillas independientes para OXYMAT y MEDOXIGAS", () => {
    const oxymat = emitirSemillaReceptor(RNC_OXYMAT);
    const medoxigas = emitirSemillaReceptor(RNC_MEDOXIGAS);
    expect(oxymat.xml).toContain("<SemillaModel>");
    expect(oxymat.xml).toContain("<valor>");
    expect(oxymat.fecha).toMatch(/T\d{2}:\d{2}:\d{2}-04:00$/);
    expect(oxymat.valor).not.toBe(medoxigas.valor);
  });

  it("resuelve certificados distintos por RNC sin mezclarlos", () => {
    const oxymat = resolverCredencialesFirmaRnc(RNC_OXYMAT);
    const medoxigas = resolverCredencialesFirmaRnc(RNC_MEDOXIGAS);
    expect(oxymat?.certificadoPem).toBe(certificadoOxymat.certificadoPem);
    expect(medoxigas?.certificadoPem).toBe(certificadoMedoxigas.certificadoPem);
    expect(oxymat?.certificadoPem).not.toBe(medoxigas?.certificadoPem);
  });

  it("completa semilla + validación certificado y aísla el token por RNC", async () => {
    for (const rnc of [RNC_OXYMAT, RNC_MEDOXIGAS]) {
      const token = await tokenPara(rnc);
      expect(verificarTokenReceptor(`Bearer ${token}`, rnc)).toBe(true);
      const otro = rnc === RNC_OXYMAT ? RNC_MEDOXIGAS : RNC_OXYMAT;
      expect(verificarTokenReceptor(`Bearer ${token}`, otro)).toBe(false);
    }
  });

  it("rechaza una semilla alterada después de firmarla", async () => {
    const responseSemilla = await getSemilla(
      new Request(`https://receptor.local/api/ecf/${RNC_OXYMAT}/fe/autenticacion/api/semilla`),
      contexto(RNC_OXYMAT),
    );
    const semillaFirmada = firmarDocumento(await responseSemilla.text());
    const alterada = semillaFirmada.replace("</valor>", "A</valor>");
    expect(alterada).not.toBe(semillaFirmada);
    const response = await postValidacionCertificado(solicitudXml(alterada, RNC_OXYMAT), contexto(RNC_OXYMAT));
    expect(response.status).toBe(400);
    const cuerpo = await jsonObjeto(response);
    expect(String(cuerpo.error)).toContain("firma");
  });

  it("la función pura emite token ISO de una hora y rechaza semilla de otro RNC", async () => {
    const semilla = emitirSemillaReceptor(RNC_OXYMAT);
    const firmada = firmarDocumento(semilla.xml);
    const resultado = validarSemillaFirmadaYCrearToken(firmada, RNC_OXYMAT);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(Date.parse(resultado.expira) - Date.parse(resultado.expedido)).toBe(60 * 60 * 1000);
      expect(verificarTokenReceptor(`Bearer ${resultado.token}`, RNC_OXYMAT)).toBe(true);
    }
    const incorrecto = validarSemillaFirmadaYCrearToken(firmada, RNC_MEDOXIGAS);
    expect(incorrecto.ok).toBe(false);
  });
});

describe("POST recepcion/api/ecf", () => {
  it("recibe un E31 firmado para cada RNC y responde ARECF firmado con Estado 0", async () => {
    for (const rnc of [RNC_OXYMAT, RNC_MEDOXIGAS]) {
      const token = await tokenPara(rnc);
      const encf = rnc === RNC_OXYMAT ? "E310000000001" : "E310000000002";
      const xmlFirmado = firmarDocumento(generarXmlEcf(documentoE31(rnc, encf)));
      const response = await postRecepcionEcf(solicitudXml(xmlFirmado, rnc, token), contexto(rnc));
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/xml");
      const arecf = await response.text();
      expect(arecf).toContain("<ARECF>");
      expect(arecf).toContain("<Estado>0</Estado>");
      expect(verificarFirmaXmlDsig(arecf).valida).toBe(true);
      const esperado = rnc === RNC_OXYMAT ? certificadoOxymat : certificadoMedoxigas;
      expect(arecf).toContain(certificadoBase64(esperado.certificadoPem));
    }
  });

  it("responde ARECF firmado Estado 1 motivo 4 cuando RNCComprador no corresponde a la ruta", async () => {
    const token = await tokenPara(RNC_OXYMAT);
    const xmlFirmado = firmarDocumento(generarXmlEcf(documentoE31(RNC_MEDOXIGAS, "E310000000003")));
    const response = await postRecepcionEcf(solicitudXml(xmlFirmado, RNC_OXYMAT, token), contexto(RNC_OXYMAT));
    expect(response.status).toBe(200);
    const arecf = await response.text();
    expect(arecf).toContain("<Estado>1</Estado>");
    expect(arecf).toContain("<CodigoMotivoNoRecibido>4</CodigoMotivoNoRecibido>");
    expect(verificarFirmaXmlDsig(arecf).valida).toBe(true);
  });

  it("responde ARECF firmado Estado 1 motivo 2 cuando el XML fue alterado tras la firma", async () => {
    const token = await tokenPara(RNC_OXYMAT);
    const xmlFirmado = firmarDocumento(generarXmlEcf(documentoE31(RNC_OXYMAT, "E310000000004")));
    const alterado = xmlFirmado.replace("<MontoTotal>118.00</MontoTotal>", "<MontoTotal>119.00</MontoTotal>");
    expect(alterado).not.toBe(xmlFirmado);
    const response = await postRecepcionEcf(solicitudXml(alterado, RNC_OXYMAT, token), contexto(RNC_OXYMAT));
    expect(response.status).toBe(200);
    const arecf = await response.text();
    expect(arecf).toContain("<Estado>1</Estado>");
    expect(arecf).toContain("<CodigoMotivoNoRecibido>2</CodigoMotivoNoRecibido>");
    expect(verificarFirmaXmlDsig(arecf).valida).toBe(true);
  });

  it("rechaza la recepción sin Bearer token válido", async () => {
    const xmlFirmado = firmarDocumento(generarXmlEcf(documentoE31(RNC_OXYMAT, "E310000000005")));
    const response = await postRecepcionEcf(solicitudXml(xmlFirmado, RNC_OXYMAT), contexto(RNC_OXYMAT));
    expect(response.status).toBe(401);
  });
});

describe("POST aprobacioncomercial/api/ecf", () => {
  it("acepta un ACECF firmado válido con 200 OK", async () => {
    const token = await tokenPara(RNC_OXYMAT);
    const acecf = generarXmlAcecf({
      rncEmisor: RNC_EMISOR,
      rncComprador: RNC_OXYMAT,
      encf: "E310000000001",
      fechaEmision: "26-11-2026",
      montoTotal: 118,
      estado: "1",
      fechaHoraAprobacionComercial: "26-11-2026 11:00:00",
    });
    const firmado = firmarDocumento(acecf);
    const response = await postAprobacionComercial(solicitudXml(firmado, RNC_OXYMAT, token), contexto(RNC_OXYMAT));
    expect(response.status).toBe(200);
    const cuerpo = await jsonObjeto(response);
    expect(cuerpo.ok).toBe(true);
    expect(JSON.stringify(cuerpo.datos)).toContain(RNC_OXYMAT);
  });

  it("rechaza con 400 un ACECF alterado después de firmarse", async () => {
    const token = await tokenPara(RNC_OXYMAT);
    const acecf = generarXmlAcecf({
      rncEmisor: RNC_EMISOR,
      rncComprador: RNC_OXYMAT,
      encf: "E310000000001",
      fechaEmision: "26-11-2026",
      montoTotal: 118,
      estado: "1",
      fechaHoraAprobacionComercial: "26-11-2026 11:00:00",
    });
    const alterado = firmarDocumento(acecf).replace(
      "<MontoTotal>118.00</MontoTotal>",
      "<MontoTotal>119.00</MontoTotal>",
    );
    const response = await postAprobacionComercial(solicitudXml(alterado, RNC_OXYMAT, token), contexto(RNC_OXYMAT));
    expect(response.status).toBe(400);
    const cuerpo = await jsonObjeto(response);
    expect(cuerpo.ok).toBe(false);
    expect(String(cuerpo.error)).toContain("firma");
  });
});

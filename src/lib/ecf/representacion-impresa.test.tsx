import { describe, expect, it } from "vitest";

import { generarVectorQr } from "./qr-svg";
import {
  construirUrlQrDesdeRi,
  type DatosRi,
  extraerCodigoSeguridadXml,
  parsearRepresentacionImpresaXml,
} from "./representacion-impresa";
import { generarPdfRepresentacionImpresa } from "./representacion-impresa-pdf";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIRECTORIO_PASO4 = "/root/referencias/ecf-oxymat/paso4-simulacion-1201";
const RNC_OXYMAT = "131488791";
const URL_QR_REAL_E31 =
  "https://ecf.dgii.gov.do/certecf/ConsultaTimbre?RncEmisor=131488791&RncComprador=131880681&ENCF=E310000001201&FechaEmision=28-11-2026&MontoTotal=31860.00&FechaFirma=28-11-2026%2009%3A22%3A56&CodigoSeguridad=KBD6uh";

function xmlRealesPaso4(): string[] {
  if (!existsSync(DIRECTORIO_PASO4)) return [];
  return readdirSync(DIRECTORIO_PASO4)
    .filter((archivo) => archivo.endsWith(".xml") && !archivo.endsWith("-rfce.xml"))
    .sort();
}

function leerXmlReal(archivo: string): string {
  return readFileSync(join(DIRECTORIO_PASO4, archivo), "utf8");
}

function codigoSeguridadIndependiente(xml: string): string {
  const valor = xml.match(/<SignatureValue[^>]*>([\s\S]*?)<\/SignatureValue>/)?.[1];
  if (valor == null) throw new Error("El XML de prueba no contiene SignatureValue");
  return valor.replace(/\s+/g, "").slice(0, 6);
}

function omitirSiNoHayXml(): boolean {
  if (existsSync(DIRECTORIO_PASO4)) return false;
  console.warn("XML reales del Paso 4 no disponibles en este entorno; se omite la prueba de representación impresa");
  return true;
}

describe("representación impresa e-CF", () => {
  it("parsea los 25 XML firmados reales del Paso 4 con datos fiscales y de firma correctos", () => {
    if (omitirSiNoHayXml()) return;
    const archivos = xmlRealesPaso4();
    expect(archivos).toHaveLength(25);

    const porEncf = new Map<string, DatosRi>();
    for (const archivo of archivos) {
      const xml = leerXmlReal(archivo);
      const datos = parsearRepresentacionImpresaXml(xml);
      porEncf.set(datos.encf, datos);

      expect(datos.encf).toBe(archivo.slice(RNC_OXYMAT.length, -".xml".length));
      expect(datos.tipoEcf).toBe(datos.encf.slice(1, 3));
      expect(datos.emisor.rnc).toBe(RNC_OXYMAT);
      expect(datos.totales.montoTotal).toBeGreaterThan(0);
      expect(datos.items.length).toBeGreaterThan(0);
      expect(datos.codigoSeguridad).toBe(codigoSeguridadIndependiente(xml));
      expect(extraerCodigoSeguridadXml(xml)).toBe(datos.codigoSeguridad);
      expect(datos.fechaHoraFirma).toMatch(/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/);
    }

    const exterior = porEncf.get("E470000001201");
    expect(exterior?.comprador?.rnc).toBeNull();
    expect(exterior?.comprador?.identificadorExtranjero).toBe("350555123");
    expect(exterior?.transporte?.paisDestino).toBe("ESTADOS UNIDOS");

    const notaDebito = porEncf.get("E330000001201");
    expect(notaDebito?.informacionReferencia?.ncfModificado).toBe("E310000001201");
    expect(notaDebito?.informacionReferencia?.codigoModificacion).toBe("3");
    expect(notaDebito?.informacionReferencia?.codigoModificacionEtiqueta).toBe("Corrección de montos");

    const notaCredito = porEncf.get("E340000001201");
    expect(notaCredito?.informacionReferencia?.ncfModificado).toBe("E310000001202");
    expect(notaCredito?.informacionReferencia?.razonModificacion).toContain("devolución parcial");

    const conDescuento = porEncf.get("E310000001202")?.items[0];
    expect(conDescuento?.descuentoMonto).toBe(5000);
    expect(conDescuento?.subDescuentos).toHaveLength(2);
    expect(conDescuento?.subDescuentos[0]?.montoSubDescuento).toBe(3500);
  });

  it("genera PDF Carta en buffer mayor a 2KB para los tipos 31, 33 y 47", async () => {
    if (omitirSiNoHayXml()) return;
    for (const encf of ["E310000001201", "E330000001201", "E470000001201"]) {
      const datos = parsearRepresentacionImpresaXml(leerXmlReal(`${RNC_OXYMAT}${encf}.xml`));
      datos.urlQr = construirUrlQrDesdeRi(datos, { ambiente: "certecf", esRfce: false });
      const buffer = await generarPdfRepresentacionImpresa(datos);
      expect(buffer.length).toBeGreaterThan(2000);
      expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    }
  }, 30000);

  it("genera la matriz vectorial QR de una URL DGII real sin errores", () => {
    const vector = generarVectorQr(URL_QR_REAL_E31);
    expect(vector.dimension).toBeGreaterThan(21);
    expect(vector.trazado.length).toBeGreaterThan(100);
    expect(vector.trazado.startsWith("M")).toBe(true);
  });
});

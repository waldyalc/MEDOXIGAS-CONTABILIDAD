import { describe, expect, it } from "vitest";

import { firmarXmlDsig, generarCertificadoPruebaAutocontenido, verificarFirmaXmlDsig } from "./firma";
import type { CasoSimulacionPaso4, CategoriaSimulacionPaso4, OpcionesSimulacionPaso4 } from "./simulacion-paso4";
import {
  CONTEO_OFICIAL_PASO4,
  construirEncfSecuencia,
  construirSetSimulacionPaso4,
  formatearFechaHoraRdActual,
  formatearFechaRdActual,
  SECUENCIA_BASE_SIMULACION_DEFECTO,
  SECUENCIA_BASE_SIMULACION_MAX,
  SECUENCIA_BASE_SIMULACION_MIN,
  validarSetSimulacionPaso4Local,
} from "./simulacion-paso4";
import type { DocumentoEcfInput, TipoEcf } from "./tipos";
import { validarXmlContraEsquemaDgii } from "./validador-xsd";
import { generarXmlEcf, generarXmlRfce, validarDocumentoEcf } from "./xml";

const OPCIONES_BASE: OpcionesSimulacionPaso4 = {
  rncEmisor: "131488791",
  razonSocial: "OXYMAT SRL",
  fechaEmision: "28-11-2026",
  fechaHoraFirma: "28-11-2026 10:30:00",
};

const ORDEN_CATEGORIAS_ESPERADO: readonly CategoriaSimulacionPaso4[] = [
  "31",
  "31",
  "31",
  "31",
  "32_mayor_250k",
  "32_mayor_250k",
  "41",
  "41",
  "43",
  "43",
  "44",
  "44",
  "45",
  "45",
  "46",
  "46",
  "47",
  "47",
  "33",
  "34",
  "34",
  "32_rfce",
  "32_rfce",
  "32_rfce",
  "32_rfce",
];

function construirSetPrueba(secuenciaBase?: number): CasoSimulacionPaso4[] {
  return construirSetSimulacionPaso4({ ...OPCIONES_BASE, secuenciaBase });
}

function casoNumero(casos: readonly CasoSimulacionPaso4[], numeroCaso: number): CasoSimulacionPaso4 {
  const encontrado = casos.find((caso) => caso.numeroCaso === numeroCaso);
  if (!encontrado) throw new Error(`No existe el caso ${numeroCaso}`);
  return encontrado;
}

function centavos(valor: number): number {
  return Math.round(valor * 100);
}

function sumaCentavosLineas(documento: DocumentoEcfInput, indicador: "1" | "2" | "3" | "4"): number {
  return documento.lineas
    .filter((linea) => linea.indicadorFacturacion === indicador)
    .reduce((suma, linea) => suma + centavos(linea.montoItem), 0);
}

function secuenciasPorTipo(casos: readonly CasoSimulacionPaso4[], tipo: TipoEcf): number[] {
  return casos
    .filter((caso) => caso.documento.comprobante.tipo === tipo)
    .map((caso) => Number(caso.documento.comprobante.encf.slice(3)))
    .sort((izquierda, derecha) => izquierda - derecha);
}

function expectTotalesAritmeticos(documento: DocumentoEcfInput): void {
  const gravadoI1 = sumaCentavosLineas(documento, "1");
  const gravadoI2 = sumaCentavosLineas(documento, "2");
  const gravadoI3 = sumaCentavosLineas(documento, "3");
  const exento = sumaCentavosLineas(documento, "4");
  const itbis1 = Math.round((gravadoI1 * 18) / 100);
  const itbis2 = Math.round((gravadoI2 * 16) / 100);
  expect(centavos(documento.totales.montoGravadoI1)).toBe(gravadoI1);
  expect(centavos(documento.totales.montoGravadoI2)).toBe(gravadoI2);
  expect(centavos(documento.totales.montoGravadoI3 ?? 0)).toBe(gravadoI3);
  expect(centavos(documento.totales.montoExento)).toBe(exento);
  expect(centavos(documento.totales.totalItbis1)).toBe(itbis1);
  expect(centavos(documento.totales.totalItbis2)).toBe(itbis2);
  expect(centavos(documento.totales.totalItbis3 ?? 0)).toBe(0);
  expect(centavos(documento.totales.totalItbis)).toBe(itbis1 + itbis2);
  expect(centavos(documento.totales.montoTotal)).toBe(gravadoI1 + gravadoI2 + gravadoI3 + exento + itbis1 + itbis2);
}

describe("construirSetSimulacionPaso4", () => {
  it("construye exactamente 25 casos con la distribución oficial DGII por categoría", () => {
    const casos = construirSetPrueba();
    expect(casos).toHaveLength(25);
    expect(Object.values(CONTEO_OFICIAL_PASO4).reduce((suma, cantidad) => suma + cantidad, 0)).toBe(25);
    for (const [categoria, cantidadEsperada] of Object.entries(CONTEO_OFICIAL_PASO4) as [
      CategoriaSimulacionPaso4,
      number,
    ][]) {
      expect(casos.filter((caso) => caso.categoria === categoria)).toHaveLength(cantidadEsperada);
    }
    expect(casos.filter((caso) => caso.esRfce)).toHaveLength(4);
  });

  it("respeta el orden oficial estricto de emisión por fases DGII", () => {
    const casos = construirSetPrueba();
    expect(casos.map((caso) => caso.numeroCaso)).toEqual(Array.from({ length: 25 }, (_, indice) => indice + 1));
    expect(casos.map((caso) => caso.categoria)).toEqual(ORDEN_CATEGORIAS_ESPERADO);
    expect(casos.slice(0, 18).every((caso) => caso.faseOrden === 1)).toBe(true);
    expect(casos.slice(18, 21).every((caso) => caso.faseOrden === 2)).toBe(true);
    expect(casos.slice(21).every((caso) => caso.faseOrden === 3)).toBe(true);
  });

  it("emite secuencias correlativas sin huecos ni duplicados y mantiene continuidad de la serie E32", () => {
    const casos = construirSetPrueba();
    const encfs = casos.map((caso) => caso.documento.comprobante.encf);
    expect(new Set(encfs).size).toBe(25);
    expect(secuenciasPorTipo(casos, "31")).toEqual([1001, 1002, 1003, 1004]);
    expect(secuenciasPorTipo(casos, "32")).toEqual([1001, 1002, 1003, 1004, 1005, 1006]);
    expect(secuenciasPorTipo(casos, "41")).toEqual([1001, 1002]);
    expect(secuenciasPorTipo(casos, "43")).toEqual([1001, 1002]);
    expect(secuenciasPorTipo(casos, "44")).toEqual([1001, 1002]);
    expect(secuenciasPorTipo(casos, "45")).toEqual([1001, 1002]);
    expect(secuenciasPorTipo(casos, "46")).toEqual([1001, 1002]);
    expect(secuenciasPorTipo(casos, "47")).toEqual([1001, 1002]);
    expect(secuenciasPorTipo(casos, "33")).toEqual([1001]);
    expect(secuenciasPorTipo(casos, "34")).toEqual([1001, 1002]);
    expect(casos.slice(21).map((caso) => caso.documento.comprobante.encf)).toEqual([
      "E320000001003",
      "E320000001004",
      "E320000001005",
      "E320000001006",
    ]);
  });

  it("soporta una secuencia base distinta conservando la continuidad de E32", () => {
    const casos = construirSetPrueba(2500);
    expect(casoNumero(casos, 1).documento.comprobante.encf).toBe("E310000002500");
    expect(secuenciasPorTipo(casos, "32")).toEqual([2500, 2501, 2502, 2503, 2504, 2505]);
    expect(casos.slice(21).map((caso) => caso.documento.comprobante.encf)).toEqual([
      "E320000002502",
      "E320000002503",
      "E320000002504",
      "E320000002505",
    ]);
    expect(construirEncfSecuencia("31", SECUENCIA_BASE_SIMULACION_DEFECTO)).toBe("E310000001001");
  });

  it("valida el set completo localmente con 25 de 25 casos válidos", () => {
    const resultado = validarSetSimulacionPaso4Local(construirSetPrueba());
    expect(resultado.erroresGlobales).toEqual([]);
    expect(resultado.totalCasos).toBe(25);
    expect(resultado.validos).toBe(25);
    expect(resultado.invalidos).toBe(0);
    expect(resultado.valido).toBe(true);
    expect(resultado.casos.every((caso) => caso.errores.length === 0)).toBe(true);
  });

  it("construye los importes umbrales exigidos para E32 individuales y RFCE", () => {
    const casos = construirSetPrueba();
    expect(casoNumero(casos, 5).documento.totales.montoTotal).toBe(295_000);
    expect(casoNumero(casos, 6).documento.totales.montoTotal).toBe(330_400);
    for (const numeroCaso of [5, 6]) {
      const caso = casoNumero(casos, numeroCaso);
      expect(caso.documento.totales.montoTotal).toBeGreaterThanOrEqual(250_000);
      expect(caso.documento.comprador.rnc).toBe("131880681");
      expect(caso.documento.comprador.razonSocial).toBe("DOCUMENTOS ELECTRONICOS DE 03");
      expect(caso.documento.comprobante.fechaVencimientoSecuencia).toBeUndefined();
    }
    for (const numeroCaso of [22, 23, 24, 25]) {
      const caso = casoNumero(casos, numeroCaso);
      expect(caso.documento.totales.montoTotal).toBeLessThan(250_000);
      expect(caso.esRfce).toBe(true);
      expect(caso.documento.comprobante.fechaVencimientoSecuencia).toBeUndefined();
    }
  });

  it("cumple las variantes E31 exigidas, incluido crédito a 30 días y descuento desglosado", () => {
    const casos = construirSetPrueba();
    const primero = casoNumero(casos, 1);
    const credito = casoNumero(casos, 2);
    const mixto = casoNumero(casos, 3);
    const equipos = casoNumero(casos, 4);
    for (const caso of [primero, credito, mixto, equipos]) {
      expect(caso.documento.comprobante.indicadorMontoGravado).toBe("0");
      expect(caso.documento.comprobante.tipoIngresos).toBe("01");
      expect(caso.documento.comprobante.fechaVencimientoSecuencia).toBe("31-12-2028");
      expect(centavos(caso.documento.comprobante.formasPago?.[0]?.montoPago ?? 0)).toBe(
        centavos(caso.documento.totales.montoTotal),
      );
    }
    expect(primero.documento.comprobante.formasPago?.[0]?.formaPago).toBe("1");
    expect(credito.documento.comprobante.tipoPago).toBe("2");
    expect(credito.documento.comprobante.formasPago?.[0]?.formaPago).toBe("4");
    expect(credito.documento.comprobante.fechaLimitePago).toBe("28-12-2026");
    const lineaDescuento = credito.documento.lineas[0];
    expect(lineaDescuento).toBeDefined();
    if (!lineaDescuento) throw new Error("La segunda E31 debe tener línea de descuento");
    const sumaSubdescuentos = (lineaDescuento.subDescuentos ?? []).reduce(
      (suma, ajuste) => suma + centavos(ajuste.monto ?? 0),
      0,
    );
    expect(sumaSubdescuentos).toBe(centavos(lineaDescuento.descuento ?? 0));
    expect(mixto.documento.lineas.map((linea) => linea.indicadorFacturacion)).toEqual(["1", "4"]);
    expect(centavos(mixto.documento.totales.montoExento)).toBeGreaterThan(0);
    expect(equipos.documento.lineas.some((linea) => linea.nombreItem.includes("Concentrador"))).toBe(true);
  });

  it("cumple la aritmética exacta de líneas, ITBIS y totales en los 25 documentos", () => {
    const casos = construirSetPrueba();
    for (const caso of casos) {
      const validacion = validarDocumentoEcf(caso.documento);
      expect(validacion.ok, validacion.ok ? "" : validacion.errores.join("; ")).toBe(true);
      expectTotalesAritmeticos(caso.documento);
    }
  });

  it("calcula retenciones E41 exactas: 100% del ITBIS y 10% del ISR por línea", () => {
    const casos = construirSetPrueba();
    for (const numeroCaso of [7, 8]) {
      const documento = casoNumero(casos, numeroCaso).documento;
      let itbisRetenido = 0;
      let isrRetenido = 0;
      for (const linea of documento.lineas) {
        const base = centavos(linea.montoItem);
        expect(centavos(linea.retencion?.montoItbisRetenido ?? 0)).toBe((base * 18) / 100);
        expect(centavos(linea.retencion?.montoIsrRetenido ?? 0)).toBe((base * 10) / 100);
        itbisRetenido += (base * 18) / 100;
        isrRetenido += (base * 10) / 100;
      }
      expect(centavos(documento.totales.totalItbisRetenido ?? 0)).toBe(itbisRetenido);
      expect(centavos(documento.totales.totalIsrRetencion ?? 0)).toBe(isrRetenido);
      expect(documento.comprador.rnc).toBe("533445861");
      expect(documento.comprador.razonSocial).toBe("DOCUMENTOS ELECTRONICOS DE 11");
    }
  });

  it("cumple exenciones de E43/E44, gravamen de E45 y tasa cero de exportaciones E46", () => {
    const casos = construirSetPrueba();
    for (const numeroCaso of [9, 10, 11, 12]) {
      const documento = casoNumero(casos, numeroCaso).documento;
      expect(centavos(documento.totales.montoExento)).toBe(centavos(documento.totales.montoTotal));
      expect(documento.lineas.every((linea) => linea.indicadorFacturacion === "4" && linea.itbisTasa === 0)).toBe(true);
    }

    for (const numeroCaso of [13, 14]) {
      const documento = casoNumero(casos, numeroCaso).documento;
      expect(documento.lineas.every((linea) => linea.indicadorFacturacion === "1" && linea.itbisTasa === 18)).toBe(
        true,
      );
      expect(centavos(documento.totales.totalItbis)).toBeGreaterThan(0);
    }

    for (const numeroCaso of [15, 16]) {
      const documento = casoNumero(casos, numeroCaso).documento;
      expect(documento.lineas.every((linea) => linea.indicadorFacturacion === "3" && linea.itbisTasa === 0)).toBe(true);
      expect(centavos(documento.totales.montoGravadoI3 ?? 0)).toBe(centavos(documento.totales.montoTotal));
      expect(centavos(documento.totales.montoGravadoTotal ?? 0)).toBe(centavos(documento.totales.montoTotal));
      expect(centavos(documento.totales.totalItbis)).toBe(0);
      expect(centavos(documento.totales.totalItbis3 ?? 0)).toBe(0);
    }
  });

  it("cumple identificación extranjera, servicio exento e ISR exacto del 27% en E47", () => {
    const casos = construirSetPrueba();
    for (const numeroCaso of [17, 18]) {
      const documento = casoNumero(casos, numeroCaso).documento;
      let isrRetenido = 0;
      expect(documento.comprador.rnc).toBeUndefined();
      expect(documento.comprador.identificadorExtranjero).toBe("350555123");
      expect(documento.comprador.razonSocial).toBe("PROVEEDOR INTERNACIONAL DE GASES INC");
      expect(documento.transporte?.paisDestino).toBe("ESTADOS UNIDOS");
      for (const linea of documento.lineas) {
        const base = centavos(linea.montoItem);
        expect(linea.indicadorBienoServicio).toBe("2");
        expect(linea.indicadorFacturacion).toBe("4");
        expect(centavos(linea.retencion?.montoIsrRetenido ?? 0)).toBe((base * 27) / 100);
        isrRetenido += (base * 27) / 100;
      }
      expect(centavos(documento.totales.totalIsrRetencion ?? 0)).toBe(isrRetenido);
    }
  });

  it("cumple las referencias cruzadas exactas de E33 y E34", () => {
    const casos = construirSetPrueba();
    const e31Primero = casoNumero(casos, 1);
    const e31Segundo = casoNumero(casos, 2);
    const e44Primero = casoNumero(casos, 11);
    const e33 = casoNumero(casos, 19);
    const e34Parcial = casoNumero(casos, 20);
    const e34Anulacion = casoNumero(casos, 21);

    expect(e33.documento.comprobante.ncfModificado).toBe(e31Primero.documento.comprobante.encf);
    expect(e33.documento.comprobante.codigoModificacion).toBe("3");
    expect(e33.documento.comprobante.razonModificacion).toBe("Cargo adicional por flete y manejo");
    expect(e33.documento.comprobante.fechaNcfModificado).toBe("28-11-2026");
    expect(e33.documento.comprobante.fechaVencimientoSecuencia).toBe("31-12-2028");
    expect(centavos(e33.documento.totales.montoTotal)).toBeGreaterThan(0);

    expect(e34Parcial.documento.comprobante.ncfModificado).toBe(e31Segundo.documento.comprobante.encf);
    expect(e34Parcial.documento.comprobante.codigoModificacion).toBe("3");
    expect(e34Parcial.documento.comprobante.indicadorNotaCredito).toBe("0");
    expect(e34Parcial.documento.comprobante.razonModificacion).toBe("Descuento por devolución parcial de cilindros");
    expect(e34Parcial.documento.comprobante.fechaVencimientoSecuencia).toBeUndefined();
    expect(e34Parcial.documento.totales.montoTotal).toBeLessThan(e31Segundo.documento.totales.montoTotal);

    expect(e34Anulacion.documento.comprobante.ncfModificado).toBe(e44Primero.documento.comprobante.encf);
    expect(e34Anulacion.documento.comprobante.codigoModificacion).toBe("1");
    expect(e34Anulacion.documento.comprobante.indicadorNotaCredito).toBe("0");
    expect(e34Anulacion.documento.comprobante.razonModificacion).toBe(
      "Anulación total de operación en régimen especial",
    );
    expect(e34Anulacion.documento.comprobante.fechaVencimientoSecuencia).toBeUndefined();
    expect(centavos(e34Anulacion.documento.totales.montoTotal)).toBe(centavos(e44Primero.documento.totales.montoTotal));
    expect(centavos(e34Anulacion.documento.totales.montoExento)).toBe(
      centavos(e44Primero.documento.totales.montoTotal),
    );
  });

  it("genera XML compacto sin etiquetas vacías y con omisiones específicas de cada XSD", () => {
    const casos = construirSetPrueba();
    for (const caso of casos) {
      const xml = generarXmlEcf(caso.documento);
      expect(xml).not.toMatch(/<([A-Za-z][A-Za-z0-9]*)><\/\1>/);
      const xsd = validarXmlContraEsquemaDgii(xml, "ECF");
      expect(xsd.errores).toEqual([]);
      expect(xsd.valido).toBe(true);
    }
    expect(generarXmlEcf(casoNumero(casos, 5).documento)).not.toContain("FechaVencimientoSecuencia");
    expect(generarXmlEcf(casoNumero(casos, 20).documento)).not.toContain("FechaVencimientoSecuencia");
    expect(generarXmlEcf(casoNumero(casos, 7).documento)).not.toContain("<TipoIngresos>");
    expect(generarXmlEcf(casoNumero(casos, 9).documento)).not.toContain("<Comprador>");
    expect(generarXmlEcf(casoNumero(casos, 17).documento)).toContain("<PaisDestino>ESTADOS UNIDOS</PaisDestino>");
  });

  it("firma y verifica criptográficamente los 25 e-CF y los 4 RFCE, con CodigoSeguridad enlazado", () => {
    const par = generarCertificadoPruebaAutocontenido("131488791", "OXYMAT SRL");
    const casos = construirSetPrueba();
    let rfceFirmados = 0;
    for (const caso of casos) {
      const firma = firmarXmlDsig(generarXmlEcf(caso.documento), par.clavePrivadaPem, par.certificadoPem);
      expect(verificarFirmaXmlDsig(firma.xmlFirmado).valida, `${caso.documento.comprobante.encf} e-CF`).toBe(true);
      const xsdFirmado = validarXmlContraEsquemaDgii(firma.xmlFirmado, "ECF");
      expect(xsdFirmado.errores).toEqual([]);
      expect(xsdFirmado.valido).toBe(true);
      if (!caso.esRfce) continue;
      const rfce = generarXmlRfce(caso.documento, firma.codigoSeguridad);
      expect(rfce).toContain(`<CodigoSeguridadeCF>${firma.codigoSeguridad}</CodigoSeguridadeCF>`);
      const firmaRfce = firmarXmlDsig(rfce, par.clavePrivadaPem, par.certificadoPem);
      expect(verificarFirmaXmlDsig(firmaRfce.xmlFirmado).valida, `${caso.documento.comprobante.encf} RFCE`).toBe(true);
      const xsdRfce = validarXmlContraEsquemaDgii(firmaRfce.xmlFirmado, "RFCE");
      expect(xsdRfce.errores).toEqual([]);
      expect(xsdRfce.valido).toBe(true);
      rfceFirmados += 1;
    }
    expect(rfceFirmados).toBe(4);
  }, 60_000);

  it("formatea fecha y fecha-hora en America/Santo_Domingo", () => {
    const instante = new Date("2026-01-15T04:30:05.000Z");
    expect(formatearFechaRdActual(instante)).toBe("15-01-2026");
    expect(formatearFechaHoraRdActual(instante)).toBe("15-01-2026 00:30:05");
    expect(formatearFechaRdActual()).toMatch(/^\d{2}-\d{2}-\d{4}$/);
    expect(formatearFechaHoraRdActual()).toMatch(/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/);
  });

  it("rechaza entradas inválidas antes de construir el set", () => {
    expect(() => construirSetSimulacionPaso4({ ...OPCIONES_BASE, rncEmisor: "123" })).toThrow(/9 u 11 dígitos/);
    expect(() => construirSetSimulacionPaso4({ ...OPCIONES_BASE, rncEmisor: "13148879A" })).toThrow(/9 u 11 dígitos/);
    expect(() => construirSetSimulacionPaso4({ ...OPCIONES_BASE, razonSocial: "   " })).toThrow(/razón social/);
    expect(() =>
      construirSetSimulacionPaso4({ ...OPCIONES_BASE, secuenciaBase: SECUENCIA_BASE_SIMULACION_MIN - 1 }),
    ).toThrow(/secuencia base/);
    expect(() =>
      construirSetSimulacionPaso4({ ...OPCIONES_BASE, secuenciaBase: SECUENCIA_BASE_SIMULACION_MAX + 1 }),
    ).toThrow(/secuencia base/);
    expect(() => construirSetSimulacionPaso4({ ...OPCIONES_BASE, secuenciaBase: 1000.5 })).toThrow(/secuencia base/);
  });

  it("normaliza TelefonoEmisor al patrón DGII DDD-DDD-DDDD y el validador XSD rechaza teléfonos con +1 o sin guiones (ERR-012)", () => {
    const casoConPrefijo = construirSetSimulacionPaso4({
      ...OPCIONES_BASE,
      telefonoEmisor: "+1 809-604-6949",
    })[0];
    const casoSinGuion = construirSetSimulacionPaso4({
      ...OPCIONES_BASE,
      telefonoEmisor: "8297417125",
    })[0];
    const casoTelefonoInvalido = construirSetSimulacionPaso4({
      ...OPCIONES_BASE,
      telefonoEmisor: "123",
    })[0];
    if (!casoConPrefijo || !casoSinGuion || !casoTelefonoInvalido) {
      throw new Error("El generador no devolvió el primer caso esperado");
    }

    const xmlConPrefijo = generarXmlEcf(casoConPrefijo.documento);
    expect(xmlConPrefijo).toContain("<TelefonoEmisor>809-604-6949</TelefonoEmisor>");
    expect(validarXmlContraEsquemaDgii(xmlConPrefijo, "ECF").errores).toEqual([]);

    const xmlSinGuion = generarXmlEcf(casoSinGuion.documento);
    expect(xmlSinGuion).toContain("<TelefonoEmisor>829-741-7125</TelefonoEmisor>");
    expect(validarXmlContraEsquemaDgii(xmlSinGuion, "ECF").errores).toEqual([]);

    const xmlTelefonoOmitido = generarXmlEcf(casoTelefonoInvalido.documento);
    expect(xmlTelefonoOmitido).not.toContain("<TablaTelefonoEmisor>");
    expect(validarXmlContraEsquemaDgii(xmlTelefonoOmitido, "ECF").errores).toEqual([]);

    const xmlMalFormado = xmlConPrefijo.replace(
      "<TelefonoEmisor>809-604-6949</TelefonoEmisor>",
      "<TelefonoEmisor>+1 809-604-6949</TelefonoEmisor>",
    );
    const validacionInvalida = validarXmlContraEsquemaDgii(xmlMalFormado, "ECF");
    expect(validacionInvalida.valido).toBe(false);
    expect(validacionInvalida.errores.some((error) => error.includes("TelefonoEmisor"))).toBe(true);

    const casoDefault = construirSetSimulacionPaso4({
      rncEmisor: "131488791",
      razonSocial: "OXYMAT, SRL",
      fechaEmision: "28-11-2026",
      fechaHoraFirma: "28-11-2026 08:30:00",
    })[0];
    if (!casoDefault) throw new Error("El generador no devolvió el caso por defecto");
    const xmlDefault = generarXmlEcf(casoDefault.documento);
    expect(xmlDefault).toContain("<Sucursal>PRINCIPAL</Sucursal>");
    expect(xmlDefault).toContain(
      "<DireccionEmisor>APTO, No. 101, APTO. RES DORADO III, DORADO II, Santo Domingo Norte, Santo Domingo</DireccionEmisor>",
    );
    expect(xmlDefault).toContain("<Municipio>320301</Municipio><Provincia>320000</Provincia>");
    expect(xmlDefault).toContain("<CorreoEmisor>oxymatsrl@gmail.com</CorreoEmisor>");
    expect(xmlDefault).not.toContain("<TablaTelefonoEmisor>");
    expect(validarXmlContraEsquemaDgii(xmlDefault, "ECF").errores).toEqual([]);
  });
});

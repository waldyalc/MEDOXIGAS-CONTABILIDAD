import { describe, expect, it } from "vitest";

import type { ConsultarResultadoDgiiArgs, ResultadoConsultaDgii } from "@/lib/ecf/cliente-dgii";
import type { CasoExcelDgii, DocumentoEcfInput, EstadoDgii, TipoEcf } from "@/lib/ecf/tipos";

import {
  consultarResultadoFinalDgii,
  formatearFechaHoraRdActual,
  ordenarCasosPorDependencia,
  resultadoDesdeEnvioAceptado,
} from "./route";

function documentoCaso(tipo: TipoEcf, encf: string, ncfModificado?: string): DocumentoEcfInput {
  return {
    emisor: {
      rnc: "131488791",
      razonSocial: "OXYMAT, SRL",
      direccion: "Calle Principal No. 10",
    },
    comprador: { razonSocial: "CLIENTE DE PRUEBA" },
    comprobante: {
      tipo,
      encf,
      fechaEmision: "26-11-2026",
      fechaVencimientoSecuencia: "31-12-2026",
      tipoIngresos: "01",
      tipoPago: "1",
      ncfModificado,
    },
    lineas: [
      {
        numeroLinea: 1,
        indicadorFacturacion: "1",
        nombreItem: "Oxígeno medicinal",
        cantidad: 1,
        precioUnitario: 100,
        itbisTasa: 18,
        montoItem: 100,
      },
    ],
    totales: {
      montoGravadoI1: 100,
      montoGravadoI2: 0,
      montoExento: 0,
      totalItbis1: 18,
      totalItbis2: 0,
      totalItbis: 18,
      montoTotal: 118,
    },
  };
}

function caso(tipo: TipoEcf, encf: string, numeroFila: number, ncfModificado?: string): CasoExcelDgii {
  return {
    casoPrueba: `Caso fila ${numeroFila}`,
    numeroFila,
    documento: documentoCaso(tipo, encf, ncfModificado),
    columnasNoReconocidas: [],
  };
}

function encfs(casos: CasoExcelDgii[]): string[] {
  return casos.map((item) => item.documento.comprobante.encf);
}

function resultadoConsulta(estado: EstadoDgii): ResultadoConsultaDgii {
  return {
    trackId: "track-prueba",
    estado,
    estadoOriginal: estado,
    mensajes: [estado],
  };
}

function consultarSecuencia(estados: readonly EstadoDgii[], conteo: { llamadas: number }) {
  let indice = 0;
  return async (_args: ConsultarResultadoDgiiArgs): Promise<ResultadoConsultaDgii> => {
    conteo.llamadas += 1;
    const estado = estados[Math.min(indice, estados.length - 1)];
    indice += 1;
    if (!estado) throw new Error("La secuencia de estados de prueba está vacía");
    return resultadoConsulta(estado);
  };
}

function crearEsperarMs(): { esperarMs: (ms: number) => Promise<void>; esperas: number[] } {
  const esperas: number[] = [];
  return {
    esperas,
    esperarMs: (ms: number) => {
      esperas.push(ms);
      return Promise.resolve();
    },
  };
}

function envioExistente(estado: EstadoDgii, mensajes: string[] | null = ["Aceptado por DGII"]) {
  return {
    id: "envio-existente-1",
    encf: "E320000000011",
    intentos: 1,
    estado,
    track_id: "track-guardado",
    codigo_seguridad: "SEGURIDAD123",
    url_qr: "https://dgii.example.test/qr",
    xml_firmado: "<ECF>firmado</ECF>",
    xml_rfce: "<RFCE>firmado</RFCE>",
    mensajes,
  };
}

describe("ordenarCasosPorDependencia", () => {
  it("adelanta las facturas base del patrón oficial E33->E32, E34->E31 y E34->E44", () => {
    const casos = [
      caso("33", "E330000000021", 2, "E320000000011"),
      caso("34", "E340000000022", 3, "E310000000001"),
      caso("34", "E340000000023", 4, "E440000000009"),
      caso("32", "E320000000011", 5),
      caso("31", "E310000000001", 6),
      caso("44", "E440000000009", 7),
      caso("45", "E450000000010", 8),
    ];

    const ordenados = ordenarCasosPorDependencia(casos);
    const posicion = new Map(ordenados.map((item, indice) => [item.documento.comprobante.encf, indice]));

    expect(posicion.get("E320000000011")).toBeLessThan(posicion.get("E330000000021") ?? Number.MAX_SAFE_INTEGER);
    expect(posicion.get("E310000000001")).toBeLessThan(posicion.get("E340000000022") ?? Number.MAX_SAFE_INTEGER);
    expect(posicion.get("E440000000009")).toBeLessThan(posicion.get("E340000000023") ?? Number.MAX_SAFE_INTEGER);
    expect(ordenados).toHaveLength(casos.length);
    expect(encfs(ordenados).sort()).toEqual(encfs(casos).sort());
    expect(encfs(casos)).toEqual([
      "E330000000021",
      "E340000000022",
      "E340000000023",
      "E320000000011",
      "E310000000001",
      "E440000000009",
      "E450000000010",
    ]);
  });

  it("usa el orden original como fallback cuando el lote tiene un ciclo", () => {
    const casos = [caso("33", "E330000000021", 2, "E320000000011"), caso("32", "E320000000011", 3, "E330000000021")];

    expect(encfs(ordenarCasosPorDependencia(casos))).toEqual(encfs(casos));
  });
});

describe("resultadoDesdeEnvioAceptado", () => {
  it("devuelve null para estados no aceptados", () => {
    const casoBase = caso("32", "E320000000011", 5);

    for (const estado of ["rechazado", "pendiente", "en_proceso", "error_red"] as const) {
      expect(resultadoDesdeEnvioAceptado(casoBase, "131488791", envioExistente(estado))).toBeNull();
    }
  });

  it("preserva XML, código de seguridad, trackId y URL QR de envíos aceptados", () => {
    const casoBase = caso("32", "E320000000011", 5);

    for (const estado of ["aceptado", "aceptado_condicional"] as const) {
      const resultado = resultadoDesdeEnvioAceptado(casoBase, "131488791", envioExistente(estado));

      expect(resultado).toMatchObject({
        encf: "E320000000011",
        estado,
        trackId: "track-guardado",
        codigoSeguridad: "SEGURIDAD123",
        urlQr: "https://dgii.example.test/qr",
        xmlFirmado: "<ECF>firmado</ECF>",
        xmlRfce: "<RFCE>firmado</RFCE>",
        nombreArchivoEcf: "131488791E320000000011.xml",
        mensajes: ["Aceptado por DGII"],
        duracionMs: 0,
        persistido: true,
        errorPersistencia: null,
      });
    }
  });

  it("agrega un mensaje explícito cuando el envío aceptado no tenía mensajes guardados", () => {
    const resultado = resultadoDesdeEnvioAceptado(
      caso("32", "E320000000011", 5),
      "131488791",
      envioExistente("aceptado", null),
    );

    expect(resultado?.mensajes).toEqual(["Ya aceptado previamente en DGII (conservado sin reenviar)"]);
  });
});

describe("consultarResultadoFinalDgii", () => {
  it("consulta en_proceso -> en_proceso -> aceptado y espera solo entre intentos", async () => {
    const conteo = { llamadas: 0 };
    const { esperarMs, esperas } = crearEsperarMs();

    const resultado = await consultarResultadoFinalDgii({
      ambiente: "testecf",
      token: "token-prueba",
      trackId: "track-prueba",
      consultarResultado: consultarSecuencia(["en_proceso", "en_proceso", "aceptado"], conteo),
      esperarMs,
    });

    expect(resultado.consulta.estado).toBe("aceptado");
    expect(resultado.intentosConsulta).toBe(3);
    expect(resultado.agotado).toBe(false);
    expect(conteo.llamadas).toBe(3);
    expect(esperas).toEqual([1500, 1500]);
  });

  it("se detiene inmediatamente cuando DGII responde rechazado", async () => {
    const conteo = { llamadas: 0 };
    const { esperarMs, esperas } = crearEsperarMs();

    const resultado = await consultarResultadoFinalDgii({
      ambiente: "testecf",
      token: "token-prueba",
      trackId: "track-prueba",
      consultarResultado: consultarSecuencia(["rechazado", "aceptado"], conteo),
      esperarMs,
    });

    expect(resultado.consulta.estado).toBe("rechazado");
    expect(resultado.intentosConsulta).toBe(1);
    expect(resultado.agotado).toBe(false);
    expect(conteo.llamadas).toBe(1);
    expect(esperas).toEqual([]);
  });

  it("respeta maxIntentos cuando DGII sigue en_proceso", async () => {
    const conteo = { llamadas: 0 };
    const { esperarMs, esperas } = crearEsperarMs();

    const resultado = await consultarResultadoFinalDgii({
      ambiente: "testecf",
      token: "token-prueba",
      trackId: "track-prueba",
      maxIntentos: 3,
      consultarResultado: consultarSecuencia(["en_proceso"], conteo),
      esperarMs,
    });

    expect(resultado.consulta.estado).toBe("en_proceso");
    expect(resultado.intentosConsulta).toBe(3);
    expect(resultado.agotado).toBe(true);
    expect(conteo.llamadas).toBe(3);
    expect(esperas).toEqual([1500, 1500]);
  });
});

describe("formatearFechaHoraRdActual", () => {
  it("formatea DD-MM-YYYY HH:mm:ss en America/Santo_Domingo (UTC-4)", () => {
    expect(formatearFechaHoraRdActual(new Date("2026-11-27T20:04:05.000Z"))).toBe("27-11-2026 16:04:05");
    expect(formatearFechaHoraRdActual(new Date("2026-01-01T02:04:05.000Z"))).toBe("31-12-2025 22:04:05");
  });
});

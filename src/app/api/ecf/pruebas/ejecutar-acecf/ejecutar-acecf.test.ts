import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ResumenEnvioAcecf,
  ResumenValidacionAcecf,
} from "@/app/(main)/dashboard/configuracion/facturacion-electronica/_components/ecf-portal-tipos";
import { generarCertificadoPruebaAutocontenido, leerMetadatosCertificado } from "@/lib/ecf/firma";
import type { CasoExcelAcecfDgii } from "@/lib/ecf/tipos";

import type { EnvioAcecfExistente } from "./route";
import { existsSync, readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({
  getRol: vi.fn(),
  createClient: vi.fn(),
  cargarCredenciales: vi.fn(),
  obtenerToken: vi.fn(),
  enviarAprobacion: vi.fn(),
}));

vi.mock("@/lib/auth/rol", () => ({ getRol: mocks.getRol }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/ecf/config-servidor", () => ({ cargarCredencialesEcfServidor: mocks.cargarCredenciales }));
vi.mock("@/lib/ecf/cliente-dgii", () => ({
  obtenerTokenDgii: mocks.obtenerToken,
  enviarAprobacionComercialDgii: mocks.enviarAprobacion,
}));

const { POST, esRegistroAcecfParaComprador, resultadoDesdeAcecfAceptado, tipoEcfDesdeEncf } = await import("./route");

const RNC_COMPRADOR = "131488791";
const RNC_EMISOR = "131880681";
const RUTA_EXCEL_REAL = "/root/referencias/ecf-oxymat/131488791-27112026175301.xlsx";
const NOMBRES_REALES_ESPERADOS = [
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
];

type RespuestaValidacionApi = ({ ok: true } & ResumenValidacionAcecf) | { ok: false; error?: string };
type RespuestaEnvioApi = ({ ok: true } & ResumenEnvioAcecf) | { ok: false; error?: string };

interface FilaAcecfFixture {
  encf: string;
  rncEmisor: string;
  rncComprador: string;
  fechaEmision: string;
  montoTotal: number;
  estado: 1 | 2;
  detalleMotivoRechazo: string;
  fechaHoraAprobacion: string;
}

interface SelectCallMock {
  columnas: string;
  eq: Record<string, unknown>;
  in: Record<string, unknown>;
}

interface SupabaseMock {
  cliente: unknown;
  insertos: Array<Record<string, unknown>>;
  actualizaciones: Array<{ fila: Record<string, unknown>; campo: string; valor: unknown }>;
  selectCalls: SelectCallMock[];
}

const parCertificado = generarCertificadoPruebaAutocontenido(RNC_COMPRADOR, "OXYMAT SRL");

function encfPrueba(indice: number): string {
  return `E31${String(indice).padStart(10, "0")}`;
}

function filaAcecf(indice: number, cambios: Partial<FilaAcecfFixture> = {}): FilaAcecfFixture {
  return {
    encf: encfPrueba(indice),
    rncEmisor: RNC_EMISOR,
    rncComprador: RNC_COMPRADOR,
    fechaEmision: "15-01-2026",
    montoTotal: 118,
    estado: 1,
    detalleMotivoRechazo: "",
    fechaHoraAprobacion: "27-11-2026 17:53:01",
    ...cambios,
  };
}

function filasAcecf(cantidad: number): FilaAcecfFixture[] {
  return Array.from({ length: cantidad }, (_, indice) => filaAcecf(indice + 1));
}

async function crearExcelAcecf(filas: FilaAcecfFixture[]): Promise<Buffer> {
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
  ]);
  for (const fila of filas) {
    hoja.addRow([
      "1.0",
      fila.rncEmisor,
      fila.encf,
      fila.fechaEmision,
      fila.montoTotal,
      fila.rncComprador,
      fila.estado,
      fila.detalleMotivoRechazo,
      fila.fechaHoraAprobacion,
    ]);
  }
  const contenido = await libro.xlsx.writeBuffer();
  return Buffer.from(contenido as ArrayBuffer);
}

function archivoExcel(buffer: Buffer, nombre = "acecf.xlsx"): File {
  return new File([new Uint8Array(buffer)], nombre, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function formularioAcecf(args: { archivo?: File; modo?: string; ambiente?: string; rncComprador?: string }): FormData {
  const form = new FormData();
  if (args.archivo) form.append("archivoExcel", args.archivo);
  form.append("modo", args.modo ?? "validar_local");
  form.append("ambiente", args.ambiente ?? "testecf");
  form.append("rncComprador", args.rncComprador ?? RNC_COMPRADOR);
  return form;
}

async function ejecutarPost(form: FormData): Promise<Response> {
  return POST(
    new Request("https://medoxigas.test/api/ecf/pruebas/ejecutar-acecf", {
      method: "POST",
      body: form,
    }),
  );
}

async function jsonComo<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function crearSupabaseMock(rows: EnvioAcecfExistente[]): SupabaseMock {
  const insertos: Array<Record<string, unknown>> = [];
  const actualizaciones: Array<{ fila: Record<string, unknown>; campo: string; valor: unknown }> = [];
  const selectCalls: SelectCallMock[] = [];
  const cliente = {
    from(tabla: string) {
      if (tabla !== "ecf_envios") throw new Error(`Tabla inesperada en la prueba: ${tabla}`);
      return {
        select(columnas: string) {
          const llamada: SelectCallMock = { columnas, eq: {}, in: {} };
          selectCalls.push(llamada);
          const builder = {
            eq(campo: string, valor: unknown) {
              llamada.eq[campo] = valor;
              return builder;
            },
            in(campo: string, valores: unknown[]) {
              llamada.in[campo] = valores;
              return builder;
            },
            returns() {
              return Promise.resolve({ data: rows, error: null });
            },
          };
          return builder;
        },
        insert(fila: Record<string, unknown>) {
          insertos.push(fila);
          return Promise.resolve({ error: null });
        },
        update(fila: Record<string, unknown>) {
          return {
            eq(campo: string, valor: unknown) {
              actualizaciones.push({ fila, campo, valor });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
  return { cliente, insertos, actualizaciones, selectCalls };
}

function usarSupabase(rows: EnvioAcecfExistente[]): SupabaseMock {
  const supabase = crearSupabaseMock(rows);
  mocks.createClient.mockResolvedValue(supabase.cliente);
  return supabase;
}

function xmlAcecfFalso(rncComprador = RNC_COMPRADOR): string {
  return `<ACECF><DetalleAprobacionComercial><RNCComprador>${rncComprador}</RNCComprador></DetalleAprobacionComercial></ACECF>`;
}

function envioAcecfExistente(args: {
  encf: string;
  estado?: string;
  intentos?: number;
  rncComprador?: string;
  respuestaDgii?: EnvioAcecfExistente["respuesta_dgii"];
  xmlFirmado?: string;
}): EnvioAcecfExistente {
  const rncComprador = args.rncComprador ?? RNC_COMPRADOR;
  return {
    id: `envio-${args.encf}`,
    rnc_emisor: RNC_EMISOR,
    encf: args.encf,
    intentos: args.intentos ?? 1,
    estado: args.estado ?? "aceptado",
    xml_firmado: args.xmlFirmado ?? xmlAcecfFalso(rncComprador),
    mensajes: ["Aprobación comercial aceptada"],
    respuesta_dgii:
      args.respuestaDgii === undefined
        ? {
            tipo: "acecf",
            rncComprador,
            nombreArchivoAcecf: `${rncComprador}${args.encf}.xml`,
            respuesta: { codigo: "1", estadoOriginal: "Aprobada" },
          }
        : args.respuestaDgii,
  };
}

function envioEcfPaso2Existente(encf: string): EnvioAcecfExistente {
  return {
    id: `envio-ecf-${encf}`,
    rnc_emisor: RNC_EMISOR,
    encf,
    intentos: 1,
    estado: "aceptado",
    xml_firmado: "<ECF><Encabezado>evidencia paso 2</Encabezado></ECF>",
    mensajes: ["E-CF aceptado"],
    respuesta_dgii: null,
  };
}

function casoAcecf(encf = encfPrueba(1), numeroFila = 2): CasoExcelAcecfDgii {
  return {
    numeroFila,
    version: "1.0",
    aprobacion: {
      rncEmisor: RNC_EMISOR,
      rncComprador: RNC_COMPRADOR,
      encf,
      fechaEmision: "15-01-2026",
      montoTotal: 118,
      montoTotalTexto: "118.00",
      estado: "1",
      fechaHoraAprobacionComercial: "27-11-2026 17:53:01",
    },
    montoTotalTexto: "118.00",
    fechaEmisionLiteral: "15-01-2026",
    fechaHoraAprobacionLiteral: "27-11-2026 17:53:01",
    nombreArchivoAcecf: `${RNC_COMPRADOR}${encf}.xml`,
    columnasNoReconocidas: [],
  };
}

async function postExcelSintetico(args: {
  cantidad?: number;
  modo?: string;
  ambiente?: string;
  rncComprador?: string;
  filas?: FilaAcecfFixture[];
}): Promise<Response> {
  const filas = args.filas ?? filasAcecf(args.cantidad ?? 1);
  const buffer = await crearExcelAcecf(filas);
  return ejecutarPost(
    formularioAcecf({
      archivo: archivoExcel(buffer),
      modo: args.modo,
      ambiente: args.ambiente,
      rncComprador: args.rncComprador,
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getRol.mockResolvedValue("admin");
  mocks.cargarCredenciales.mockResolvedValue({
    ok: true,
    credenciales: {
      clavePrivadaPem: parCertificado.clavePrivadaPem,
      certificadoPem: parCertificado.certificadoPem,
    },
    metadatos: leerMetadatosCertificado(parCertificado.certificadoPem),
    ambiente: "testecf",
    activo: true,
    origen: "base_datos",
  });
  mocks.obtenerToken.mockResolvedValue({ token: "token-acecf-prueba", expira: "2026-11-27T23:59:59Z" });
  mocks.enviarAprobacion.mockResolvedValue({
    codigo: "1",
    estado: "aceptado",
    estadoOriginal: "Aprobada",
    mensajes: ["Aprobación comercial recibida"],
  });
  usarSupabase([]);
});

describe("seguridad y contrato multipart del endpoint ACECF", () => {
  it("devuelve 401 sin sesión", async () => {
    mocks.getRol.mockResolvedValue(null);

    const response = await ejecutarPost(new FormData());
    const data = await jsonComo<{ ok: boolean; error?: string }>(response);

    expect(response.status).toBe(401);
    expect(data.ok).toBe(false);
    expect(data.error).toMatch(/iniciar sesión/i);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("devuelve 403 para un lector", async () => {
    mocks.getRol.mockResolvedValue("lector");

    const response = await ejecutarPost(new FormData());
    const data = await jsonComo<{ ok: boolean; error?: string }>(response);

    expect(response.status).toBe(403);
    expect(data.ok).toBe(false);
    expect(data.error).toMatch(/administradores y contadores/i);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("bloquea ecf y produccion con un candado explícito de producción", async () => {
    for (const ambiente of ["ecf", "produccion"]) {
      const response = await postExcelSintetico({ ambiente });
      const data = await jsonComo<{ ok: boolean; error?: string }>(response);

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toMatch(/nunca puede apuntar a Producción \(ecf\)/i);
    }
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("devuelve 400 cuando falta el Excel o no es .xlsx", async () => {
    const sinArchivo = await ejecutarPost(formularioAcecf({}));
    expect(sinArchivo.status).toBe(400);
    await expect(jsonComo<{ error?: string }>(sinArchivo)).resolves.toMatchObject({
      error: expect.stringMatching(/adjuntar/i),
    });

    const formularioInvalido = formularioAcecf({
      archivo: new File(["contenido"], "acecf.txt", { type: "text/plain" }),
    });
    const invalido = await ejecutarPost(formularioInvalido);
    expect(invalido.status).toBe(400);
    await expect(jsonComo<{ error?: string }>(invalido)).resolves.toMatchObject({
      error: expect.stringMatching(/\.xlsx/i),
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("devuelve 400 en enviar_dgii cuando una fila tiene otro RNCComprador", async () => {
    const filas = [filaAcecf(1), filaAcecf(2, { rncComprador: "999999999" })];

    const response = await postExcelSintetico({ filas, modo: "enviar_dgii" });
    const data = await jsonComo<{ ok: boolean; error?: string }>(response);

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("RNCComprador no coincide");
    expect(data.error).toContain("filas 3");
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.enviarAprobacion).not.toHaveBeenCalled();
  });
});

describe("modo validar_local", () => {
  it("valida un Excel ACECF sintético con datos exactos del contrato", async () => {
    const response = await postExcelSintetico({ cantidad: 2, modo: "validar_local" });
    const data = await jsonComo<RespuestaValidacionApi>(response);

    expect(response.status).toBe(200);
    if (!data.ok || data.modo !== "validar_local") throw new Error("La validación local ACECF no respondió ok");
    expect(data).toMatchObject({
      modo: "validar_local",
      ambiente: "testecf",
      rncComprador: RNC_COMPRADOR,
      totalCasos: 2,
      validos: 2,
      invalidos: 0,
    });
    expect(data.casos.map((caso) => caso.nombreArchivoAcecf)).toEqual([
      `${RNC_COMPRADOR}${encfPrueba(1)}.xml`,
      `${RNC_COMPRADOR}${encfPrueba(2)}.xml`,
    ]);
    expect(data.casos[0]).toMatchObject({
      numeroFila: 2,
      rncEmisor: RNC_EMISOR,
      rncComprador: RNC_COMPRADOR,
      encf: encfPrueba(1),
      fechaEmision: "15-01-2026",
      montoTotal: 118,
      montoTotalTexto: "118.00",
      estadoComercial: "1",
      detalleMotivoRechazo: null,
      fechaHoraAprobacionComercial: "27-11-2026 17:53:01",
      valido: true,
      errores: [],
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("valida 11/11 casos del Excel real OXYMAT con nombres oficiales exactos", async () => {
    if (!existsSync(RUTA_EXCEL_REAL)) return;
    const buffer = readFileSync(RUTA_EXCEL_REAL);

    const response = await ejecutarPost(
      formularioAcecf({ archivo: archivoExcel(buffer, "131488791-27112026175301.xlsx"), modo: "validar_local" }),
    );
    const data = await jsonComo<RespuestaValidacionApi>(response);

    expect(response.status).toBe(200);
    if (!data.ok || data.modo !== "validar_local")
      throw new Error("La validación del Excel real ACECF no respondió ok");
    expect(data.totalCasos).toBe(11);
    expect(data.validos).toBe(11);
    expect(data.invalidos).toBe(0);
    expect(data.casos.every((caso) => caso.valido)).toBe(true);
    expect(data.casos.map((caso) => caso.nombreArchivoAcecf)).toEqual(NOMBRES_REALES_ESPERADOS);
  });
});

describe("helpers de idempotencia ACECF", () => {
  it("reconoce ACECF por XML o por respuesta persistida y rechaza evidencia ECF", () => {
    expect(esRegistroAcecfParaComprador(envioAcecfExistente({ encf: encfPrueba(1) }), RNC_COMPRADOR)).toBe(true);
    expect(esRegistroAcecfParaComprador(envioEcfPaso2Existente(encfPrueba(1)), RNC_COMPRADOR)).toBe(false);
    expect(
      esRegistroAcecfParaComprador(
        envioAcecfExistente({
          encf: encfPrueba(1),
          respuestaDgii: { tipo: "acecf", rncComprador: "999999999" },
        }),
        RNC_COMPRADOR,
      ),
    ).toBe(false);
    expect(
      esRegistroAcecfParaComprador(
        {
          xml_firmado: "<ACECF><DetalleAprobacionComercial /></ACECF>",
          respuesta_dgii: { tipo: "acecf" },
        },
        RNC_COMPRADOR,
      ),
    ).toBe(false);
  });

  it("reutiliza solo envíos aceptados que sí son ACECF del comprador", () => {
    const caso = casoAcecf();
    const aceptado = resultadoDesdeAcecfAceptado(
      caso,
      envioAcecfExistente({ encf: caso.aprobacion.encf }),
      RNC_COMPRADOR,
    );

    expect(aceptado).toMatchObject({
      encf: caso.aprobacion.encf,
      codigo: "1",
      estado: "aceptado",
      estadoOriginal: "Aprobada",
      mensajes: ["Aprobación comercial aceptada"],
      duracionMs: 0,
      reutilizado: true,
      persistido: true,
      errorPersistencia: null,
    });
    expect(
      resultadoDesdeAcecfAceptado(
        caso,
        envioAcecfExistente({ encf: caso.aprobacion.encf, estado: "rechazado" }),
        RNC_COMPRADOR,
      ),
    ).toBeNull();
    expect(resultadoDesdeAcecfAceptado(caso, envioEcfPaso2Existente(caso.aprobacion.encf), RNC_COMPRADOR)).toBeNull();
  });

  it("deriva el tipo e-CF desde el e-NCF", () => {
    expect(tipoEcfDesdeEncf("E340000000013")).toBe("34");
  });
});

describe("modo enviar_dgii", () => {
  it("firma y envía solo pendientes, persiste trazabilidad y devuelve conteos exactos", async () => {
    const supabase = usarSupabase([envioAcecfExistente({ encf: encfPrueba(1) })]);
    mocks.enviarAprobacion
      .mockResolvedValueOnce({ codigo: "1", estado: "aceptado", estadoOriginal: "Aprobada", mensajes: ["Aceptada"] })
      .mockResolvedValueOnce({
        codigo: "02",
        estado: "rechazado",
        estadoOriginal: "Rechazada",
        mensajes: ["Rechazada"],
      })
      .mockRejectedValueOnce(new Error("fallo temporal de red"));

    const response = await postExcelSintetico({ cantidad: 4, modo: "enviar_dgii" });
    const data = await jsonComo<RespuestaEnvioApi>(response);

    expect(response.status).toBe(200);
    if (!data.ok || data.modo !== "enviar_dgii") throw new Error("El envío ACECF no respondió ok");
    expect(data).toMatchObject({
      modo: "enviar_dgii",
      ambiente: "testecf",
      rncComprador: RNC_COMPRADOR,
      totalCasos: 4,
      aceptados: 2,
      rechazados: 1,
      errores: 1,
      reutilizados: 1,
      fuenteCredenciales: "base_datos",
    });
    expect(mocks.obtenerToken).toHaveBeenCalledTimes(1);
    expect(mocks.enviarAprobacion).toHaveBeenCalledTimes(3);

    const llamadas = mocks.enviarAprobacion.mock.calls as Array<[{ nombreArchivo: string; xmlFirmado: string }]>;
    expect(llamadas.map(([args]) => args.nombreArchivo)).toEqual([
      `${RNC_COMPRADOR}${encfPrueba(2)}.xml`,
      `${RNC_COMPRADOR}${encfPrueba(3)}.xml`,
      `${RNC_COMPRADOR}${encfPrueba(4)}.xml`,
    ]);
    expect(llamadas[0]?.[0].xmlFirmado).toContain("<ACECF>");
    expect(llamadas[0]?.[0].xmlFirmado).toContain("<Signature");
    expect(llamadas[0]?.[0].xmlFirmado).toContain("<MontoTotal>118.00</MontoTotal>");
    expect(llamadas[0]?.[0].xmlFirmado).toContain(
      "<FechaHoraAprobacionComercial>27-11-2026 17:53:01</FechaHoraAprobacionComercial>",
    );

    expect(data.casos[0]).toMatchObject({ encf: encfPrueba(1), reutilizado: true, duracionMs: 0, persistido: true });
    expect(data.casos[1]).toMatchObject({ encf: encfPrueba(2), estado: "aceptado", codigo: "1", persistido: true });
    expect(data.casos[2]).toMatchObject({ encf: encfPrueba(3), estado: "rechazado", codigo: "02", persistido: true });
    expect(data.casos[3]).toMatchObject({ encf: encfPrueba(4), estado: "error_red", persistido: true });

    expect(supabase.insertos).toHaveLength(3);
    expect(supabase.actualizaciones).toHaveLength(0);
    expect(supabase.insertos[0]).toMatchObject({
      rnc_emisor: RNC_EMISOR,
      documento_tipo: "prueba",
      tipo_ecf: "31",
      encf: encfPrueba(2),
      es_rfce: false,
      ambiente: "testecf",
      estado: "aceptado",
      fecha_hora_firma: "27-11-2026 17:53:01",
      xml_rfce: null,
      intentos: 1,
    });
    const respuestaPersistida = supabase.insertos[0]?.respuesta_dgii as Record<string, unknown> | undefined;
    expect(respuestaPersistida).toMatchObject({
      tipo: "acecf",
      rncComprador: RNC_COMPRADOR,
      nombreArchivoAcecf: `${RNC_COMPRADOR}${encfPrueba(2)}.xml`,
    });
    expect(typeof supabase.insertos[0]?.codigo_seguridad).toBe("string");
    expect(String(supabase.insertos[0]?.xml_firmado)).toContain("<ACECF>");
  });

  it("no pide token ni credenciales ni reenvía cuando todos los casos ya están aceptados como ACECF", async () => {
    mocks.cargarCredenciales.mockResolvedValueOnce({
      ok: false,
      motivo: "sin_certificado",
      error: "No hay certificado guardado",
    });
    usarSupabase([
      envioAcecfExistente({ encf: encfPrueba(1) }),
      envioAcecfExistente({ encf: encfPrueba(2), estado: "aceptado_condicional" }),
    ]);

    const response = await postExcelSintetico({ cantidad: 2, modo: "enviar_dgii" });
    const data = await jsonComo<RespuestaEnvioApi>(response);

    expect(response.status).toBe(200);
    if (!data.ok || data.modo !== "enviar_dgii") throw new Error("La idempotencia ACECF no respondió ok");
    expect(data.totalCasos).toBe(2);
    expect(data.aceptados).toBe(2);
    expect(data.reutilizados).toBe(2);
    expect(data.casos.every((caso) => caso.reutilizado && caso.duracionMs === 0)).toBe(true);
    expect(data.casos[0]).toMatchObject({ codigo: "1", estadoOriginal: "Aprobada" });
    expect(mocks.cargarCredenciales).not.toHaveBeenCalled();
    expect(mocks.obtenerToken).not.toHaveBeenCalled();
    expect(mocks.enviarAprobacion).not.toHaveBeenCalled();
  });

  it("rechaza con 400 un Excel ACECF con llaves emisor+eNCF duplicadas antes de consultar DGII", async () => {
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
    ]);
    hoja.addRow(["1.0", RNC_EMISOR, encfPrueba(1), "01-04-2020", 118, RNC_COMPRADOR, 1, "", "27-11-2026 17:53:01"]);
    hoja.addRow(["1.0", RNC_EMISOR, encfPrueba(1), "01-04-2020", 118, RNC_COMPRADOR, 1, "", "27-11-2026 17:53:01"]);
    const buffer = Buffer.from((await libro.xlsx.writeBuffer()) as ArrayBuffer);

    const response = await ejecutarPost(formularioAcecf({ archivo: archivoExcel(buffer), modo: "enviar_dgii" }));
    const data = await jsonComo<{ ok: false; error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toMatch(/duplicadas/i);
    expect(mocks.obtenerToken).not.toHaveBeenCalled();
    expect(mocks.enviarAprobacion).not.toHaveBeenCalled();
  });

  it("no reutiliza ni sobrescribe una fila ECF del Paso 2 aunque tenga la misma llave", async () => {
    const supabase = usarSupabase([envioEcfPaso2Existente(encfPrueba(1))]);

    const response = await postExcelSintetico({ cantidad: 1, modo: "enviar_dgii" });
    const data = await jsonComo<RespuestaEnvioApi>(response);

    expect(response.status).toBe(200);
    if (!data.ok || data.modo !== "enviar_dgii") throw new Error("La protección de colisión ACECF no respondió ok");
    expect(data.aceptados).toBe(1);
    expect(data.reutilizados).toBe(0);
    expect(mocks.obtenerToken).toHaveBeenCalledTimes(1);
    expect(mocks.enviarAprobacion).toHaveBeenCalledTimes(1);
    expect(data.casos[0]).toMatchObject({ estado: "aceptado", reutilizado: false, persistido: false });
    expect(data.casos[0]?.errorPersistencia).toMatch(/no ACECF/i);
    expect(data.casos[0]?.errorPersistencia).toMatch(/Paso 2/);
    expect(supabase.insertos).toHaveLength(0);
    expect(supabase.actualizaciones).toHaveLength(0);
  });

  it("actualiza una fila ACECF rechazada incrementando intentos sin duplicar la llave", async () => {
    const existente = envioAcecfExistente({ encf: encfPrueba(1), estado: "rechazado", intentos: 2 });
    const supabase = usarSupabase([existente]);

    const response = await postExcelSintetico({ cantidad: 1, modo: "enviar_dgii" });
    const data = await jsonComo<RespuestaEnvioApi>(response);

    expect(response.status).toBe(200);
    if (!data.ok || data.modo !== "enviar_dgii") throw new Error("La actualización ACECF no respondió ok");
    expect(data.aceptados).toBe(1);
    expect(supabase.insertos).toHaveLength(0);
    expect(supabase.actualizaciones).toHaveLength(1);
    expect(supabase.actualizaciones[0]).toMatchObject({ campo: "id", valor: existente.id });
    expect(supabase.actualizaciones[0]?.fila).toMatchObject({
      rnc_emisor: RNC_EMISOR,
      encf: encfPrueba(1),
      estado: "aceptado",
      intentos: 3,
    });
  });
});

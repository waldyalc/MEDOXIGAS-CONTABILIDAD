import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ResumenEnvioSimulacionPaso4,
  ResumenValidacionSimulacionPaso4,
} from "@/app/(main)/dashboard/configuracion/facturacion-electronica/_components/ecf-portal-tipos";
import { generarCertificadoPruebaAutocontenido, leerMetadatosCertificado } from "@/lib/ecf/firma";
import { type CasoSimulacionPaso4, construirSetSimulacionPaso4 } from "@/lib/ecf/simulacion-paso4";

import type { EnvioSimulacionExistente } from "./route";

const mocks = vi.hoisted(() => ({
  getRol: vi.fn(),
  createClient: vi.fn(),
  cargarCredenciales: vi.fn(),
  obtenerToken: vi.fn(),
  enviarEcf: vi.fn(),
  consultarResultado: vi.fn(),
}));

vi.mock("@/lib/auth/rol", () => ({ getRol: mocks.getRol }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/ecf/config-servidor", () => ({ cargarCredencialesEcfServidor: mocks.cargarCredenciales }));
vi.mock("@/lib/ecf/cliente-dgii", () => ({
  obtenerTokenDgii: mocks.obtenerToken,
  enviarEcfDgii: mocks.enviarEcf,
  consultarResultadoDgii: mocks.consultarResultado,
}));

const { POST } = await import("./route");

const RNC_EMISOR = "131880681";
const RAZON_SOCIAL = "OXYMAT SRL";

interface LlamadaEnvioMock {
  ambiente: string;
  token: string;
  nombreArchivo: string;
  xmlFirmado: string;
  esRfce: boolean;
  confirmarProduccion: boolean;
}

interface LlamadaConsultaMock {
  ambiente: string;
  token: string;
  trackId: string;
  confirmarProduccion: boolean;
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

type RespuestaValidacionApi = ({ ok: true } & ResumenValidacionSimulacionPaso4) | { ok: false; error?: string };
type RespuestaEnvioApi = ({ ok: true } & ResumenEnvioSimulacionPaso4) | { ok: false; error?: string };

const parCertificado = generarCertificadoPruebaAutocontenido(RNC_EMISOR, RAZON_SOCIAL);

function casosEsperados(secuenciaBase = 1001): CasoSimulacionPaso4[] {
  return construirSetSimulacionPaso4({ rncEmisor: RNC_EMISOR, razonSocial: RAZON_SOCIAL, secuenciaBase });
}

function formularioSimulacion(
  args: {
    modo?: string;
    ambiente?: string;
    rncEmisor?: string;
    razonSocial?: string;
    secuenciaBase?: string;
    omitirSecuenciaBase?: boolean;
  } = {},
): FormData {
  const form = new FormData();
  form.append("modo", args.modo ?? "validar_local");
  form.append("ambiente", args.ambiente ?? "testecf");
  form.append("rncEmisor", args.rncEmisor ?? RNC_EMISOR);
  form.append("razonSocial", args.razonSocial ?? RAZON_SOCIAL);
  if (!args.omitirSecuenciaBase) form.append("secuenciaBase", args.secuenciaBase ?? "1001");
  return form;
}

async function ejecutarPost(form: FormData): Promise<Response> {
  return POST(
    new Request("https://medoxigas.test/api/ecf/pruebas/ejecutar-simulacion", {
      method: "POST",
      body: form,
    }),
  );
}

async function jsonComo<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function crearSupabaseMock(rows: EnvioSimulacionExistente[]): SupabaseMock {
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

function usarSupabase(rows: EnvioSimulacionExistente[]): SupabaseMock {
  const supabase = crearSupabaseMock(rows);
  mocks.createClient.mockResolvedValue(supabase.cliente);
  return supabase;
}

function encfDesdeNombreArchivo(nombreArchivo: string): string {
  return nombreArchivo.replace(/^\d{9,11}/, "").replace(/\.xml$/, "");
}

function respuestaConsultaAceptada(trackId: string) {
  return {
    trackId,
    codigo: "1",
    estado: "aceptado",
    estadoOriginal: "Aceptado",
    mensajes: ["Documento aceptado por DGII"],
    secuenciaUtilizada: true,
  };
}

function configurarEnvioDgiiAceptado() {
  mocks.enviarEcf.mockImplementation((args: LlamadaEnvioMock) => {
    if (args.esRfce) {
      return Promise.resolve({ codigo: "1", estado: "Aceptado", mensajes: ["RFCE aceptado por DGII"] });
    }
    return Promise.resolve({
      trackId: `track-${encfDesdeNombreArchivo(args.nombreArchivo)}`,
      codigo: "",
      estado: "Recibido",
      mensajes: ["Documento recibido para procesamiento"],
    });
  });
  mocks.consultarResultado.mockImplementation((args: LlamadaConsultaMock) =>
    Promise.resolve(respuestaConsultaAceptada(args.trackId)),
  );
}

function configurarConsultaConRechazoEnSegundoCaso() {
  const segundo = casosEsperados()[1];
  if (!segundo) throw new Error("El set del Paso 4 no generó el segundo caso esperado");
  const trackRechazado = `track-${segundo.documento.comprobante.encf}`;
  mocks.consultarResultado.mockImplementation((args: LlamadaConsultaMock) => {
    if (args.trackId === trackRechazado) {
      return Promise.resolve({
        trackId: args.trackId,
        codigo: "2",
        estado: "rechazado",
        estadoOriginal: "Rechazado",
        mensajes: ["Rechazado por validación DGII"],
        secuenciaUtilizada: true,
      });
    }
    return Promise.resolve(respuestaConsultaAceptada(args.trackId));
  });
}

function envioExistenteParaCaso(
  caso: CasoSimulacionPaso4,
  cambios: Partial<EnvioSimulacionExistente> = {},
): EnvioSimulacionExistente {
  const encf = caso.documento.comprobante.encf;
  return {
    id: `envio-${encf}`,
    encf,
    intentos: 1,
    estado: "aceptado",
    track_id: `track-previo-${encf}`,
    codigo_seguridad: "AB12CD",
    fecha_hora_firma: "27-11-2026 10:00:00",
    url_qr: `https://qr.example.test/${encf}`,
    xml_firmado: `<ECF><eNCF>${encf}</eNCF><Signature>firma-previa</Signature></ECF>`,
    xml_rfce: caso.esRfce ? `<RFCE><eNCF>${encf}</eNCF><Signature>firma-rfce-previa</Signature></RFCE>` : null,
    mensajes: ["Aceptado previamente por DGII"],
    secuencia_utilizada: true,
    ...cambios,
  };
}

function llamadasEnvio(): LlamadaEnvioMock[] {
  return (mocks.enviarEcf.mock.calls as Array<[LlamadaEnvioMock]>).map(([args]) => args);
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
  mocks.obtenerToken.mockResolvedValue({ token: "token-simulacion-prueba", expira: "2026-11-28T23:59:59Z" });
  configurarEnvioDgiiAceptado();
  usarSupabase([]);
});

describe("seguridad y contrato multipart del endpoint de simulación Paso 4", () => {
  it("devuelve 401 sin sesión", async () => {
    mocks.getRol.mockResolvedValue(null);

    const response = await ejecutarPost(new FormData());
    const data = await jsonComo<{ ok: boolean; error?: string }>(response);

    expect(response.status).toBe(401);
    expect(data.ok).toBe(false);
    expect(data.error).toMatch(/iniciar sesión/i);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("devuelve 403 para rol lector", async () => {
    mocks.getRol.mockResolvedValue("lector");

    const response = await ejecutarPost(new FormData());
    const data = await jsonComo<{ ok: boolean; error?: string }>(response);

    expect(response.status).toBe(403);
    expect(data.ok).toBe(false);
    expect(data.error).toMatch(/administradores y contadores/i);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("bloquea ecf y produccion con un candado explícito de Producción", async () => {
    for (const ambiente of ["ecf", "produccion"]) {
      const response = await ejecutarPost(formularioSimulacion({ ambiente }));
      const data = await jsonComo<{ ok: boolean; error?: string }>(response);

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toMatch(/nunca puede apuntar a Producción \(ecf\)/i);
    }
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("devuelve 400 para secuenciaBase fuera de rango o no entera", async () => {
    for (const secuenciaBase of ["50", "abc", "10000000", "1001.5"]) {
      const response = await ejecutarPost(formularioSimulacion({ secuenciaBase }));
      const data = await jsonComo<{ ok: boolean; error?: string }>(response);

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toMatch(/secuencia base/i);
    }
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.cargarCredenciales).not.toHaveBeenCalled();
  });

  it("devuelve 400 para modo, RNC o razón social inválidos", async () => {
    const formularios = [
      formularioSimulacion({ modo: "enviar_testecf" }),
      formularioSimulacion({ rncEmisor: "131-880681" }),
      formularioSimulacion({ rncEmisor: "12345" }),
      formularioSimulacion({ razonSocial: "   " }),
    ];

    for (const form of formularios) {
      const response = await ejecutarPost(form);
      const data = await jsonComo<{ ok: boolean; error?: string }>(response);
      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toBeTruthy();
    }
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("valida extensión, tamaño y contraseña del certificado adjunto antes de firmar", async () => {
    const formExtension = formularioSimulacion({ modo: "enviar_dgii" });
    formExtension.append("certificadoP12", new File(["contenido"], "certificado.txt", { type: "text/plain" }));
    formExtension.append("contrasenaP12", "secreto");

    const formGrande = formularioSimulacion({ modo: "enviar_dgii" });
    formGrande.append(
      "certificadoP12",
      new File([new Uint8Array(2 * 1024 * 1024 + 1)], "certificado.p12", { type: "application/x-pkcs12" }),
    );
    formGrande.append("contrasenaP12", "secreto");

    const formSinContrasena = formularioSimulacion({ modo: "enviar_dgii" });
    formSinContrasena.append(
      "certificadoP12",
      new File(["contenido"], "certificado.p12", { type: "application/x-pkcs12" }),
    );

    const respuestas = await Promise.all([
      ejecutarPost(formExtension),
      ejecutarPost(formGrande),
      ejecutarPost(formSinContrasena),
    ]);
    const textos = await Promise.all(
      respuestas.map(async (response) => {
        const data = await jsonComo<{ ok: boolean; error?: string }>(response);
        expect(response.status).toBe(400);
        expect(data.ok).toBe(false);
        return data.error ?? "";
      }),
    );

    expect(textos[0]).toMatch(/\.p12 o \.pfx/i);
    expect(textos[1]).toMatch(/2 MB/i);
    expect(textos[2]).toMatch(/contraseña/i);
    expect(mocks.cargarCredenciales).not.toHaveBeenCalled();
    expect(mocks.obtenerToken).not.toHaveBeenCalled();
    expect(mocks.enviarEcf).not.toHaveBeenCalled();
  });
});

describe("modo validar_local", () => {
  it("valida 25/25 casos sin Supabase, credenciales ni DGII y respeta secuenciaBase 2001", async () => {
    const response = await ejecutarPost(
      formularioSimulacion({ modo: "validar_local", ambiente: "certecf", secuenciaBase: "2001" }),
    );
    const data = await jsonComo<RespuestaValidacionApi>(response);

    expect(response.status).toBe(200);
    if (!data.ok || data.modo !== "validar_local") throw new Error("La validación local del Paso 4 no respondió ok");
    expect(data).toMatchObject({
      modo: "validar_local",
      ambiente: "certecf",
      rncEmisor: RNC_EMISOR,
      secuenciaBase: 2001,
      totalCasos: 25,
      validos: 25,
      invalidos: 0,
      erroresGlobales: [],
    });
    expect(data.casos).toHaveLength(25);
    expect(data.casos.every((caso) => caso.valido && caso.errores.length === 0)).toBe(true);
    expect(data.casos.map((caso) => caso.faseOrden)).toEqual([
      ...Array.from({ length: 18 }, () => 1),
      ...Array.from({ length: 3 }, () => 2),
      ...Array.from({ length: 4 }, () => 3),
    ]);
    expect(data.casos[0]).toMatchObject({
      numeroCaso: 1,
      encf: "E310000002001",
      tipo: "31",
      ncfModificado: null,
      nombreArchivoEcf: `${RNC_EMISOR}E310000002001.xml`,
    });
    expect(data.casos[18]).toMatchObject({ tipo: "33", ncfModificado: "E310000002001" });
    expect(data.casos[21]).toMatchObject({ tipo: "32", esRfce: true });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.cargarCredenciales).not.toHaveBeenCalled();
    expect(mocks.obtenerToken).not.toHaveBeenCalled();
    expect(mocks.enviarEcf).not.toHaveBeenCalled();
    expect(mocks.consultarResultado).not.toHaveBeenCalled();
  });

  it("usa la secuencia base por defecto 1001 cuando el campo multipart se omite", async () => {
    const response = await ejecutarPost(formularioSimulacion({ omitirSecuenciaBase: true }));
    const data = await jsonComo<RespuestaValidacionApi>(response);

    expect(response.status).toBe(200);
    if (!data.ok || data.modo !== "validar_local") throw new Error("La validación por defecto no respondió ok");
    expect(data.secuenciaBase).toBe(1001);
    expect(data.casos[0]?.encf).toBe("E310000001001");
  });
});

describe("modo enviar_dgii", () => {
  it("envía los 25 casos en orden exacto, firma XML real, consulta 21 trackId y persiste trazabilidad", async () => {
    const supabase = usarSupabase([]);

    const response = await ejecutarPost(formularioSimulacion({ modo: "enviar_dgii", ambiente: "testecf" }));
    const data = await jsonComo<RespuestaEnvioApi>(response);

    expect(response.status).toBe(200);
    if (!data.ok || data.modo !== "enviar_dgii") throw new Error("El envío del Paso 4 no respondió ok");
    expect(data).toMatchObject({
      modo: "enviar_dgii",
      ambiente: "testecf",
      rncEmisor: RNC_EMISOR,
      secuenciaBase: 1001,
      totalCasos: 25,
      aceptados: 25,
      rechazados: 0,
      errores: 0,
      enProceso: 0,
      reutilizados: 0,
      detenidoPorRechazo: false,
      fuenteCredenciales: "base_datos",
    });
    expect(data.casos).toHaveLength(25);
    expect(mocks.cargarCredenciales).toHaveBeenCalledTimes(1);
    expect(mocks.obtenerToken).toHaveBeenCalledTimes(1);
    expect(mocks.enviarEcf).toHaveBeenCalledTimes(25);
    expect(mocks.consultarResultado).toHaveBeenCalledTimes(21);

    const casos = casosEsperados();
    const llamadas = llamadasEnvio();
    expect(llamadas.map((args) => args.nombreArchivo)).toEqual(
      casos.map((caso) => `${RNC_EMISOR}${caso.documento.comprobante.encf}.xml`),
    );
    expect(llamadas.map((args) => args.esRfce)).toEqual([
      ...Array.from({ length: 21 }, () => false),
      ...Array.from({ length: 4 }, () => true),
    ]);
    expect(llamadas.every((args) => args.confirmarProduccion === false)).toBe(true);
    expect(llamadas[0]?.xmlFirmado).toContain("<ECF>");
    expect(llamadas[0]?.xmlFirmado).toContain("<Signature");
    expect(llamadas[21]?.xmlFirmado).toContain("<RFCE>");
    expect(llamadas[21]?.xmlFirmado).toContain("<Signature");
    expect(data.casos.map((caso) => caso.faseOrden)).toEqual([
      ...Array.from({ length: 18 }, () => 1),
      ...Array.from({ length: 3 }, () => 2),
      ...Array.from({ length: 4 }, () => 3),
    ]);
    expect(data.casos.every((caso) => caso.persistido && caso.errorPersistencia === null)).toBe(true);
    expect(data.casos.filter((caso) => caso.secuenciaUtilizada === true)).toHaveLength(21);
    expect(data.casos.filter((caso) => caso.xmlRfce !== null)).toHaveLength(4);

    expect(supabase.insertos).toHaveLength(25);
    expect(supabase.actualizaciones).toHaveLength(0);
    expect(supabase.insertos[0]).toMatchObject({
      rnc_emisor: RNC_EMISOR,
      documento_tipo: "prueba",
      documento_id: null,
      tipo_ecf: "31",
      encf: casos[0]?.documento.comprobante.encf,
      es_rfce: false,
      ambiente: "testecf",
      estado: "aceptado",
      secuencia_utilizada: true,
      intentos: 1,
    });
    expect(String(supabase.insertos[0]?.xml_firmado)).toContain("<Signature");
    expect(supabase.insertos.filter((fila) => fila.secuencia_utilizada === true)).toHaveLength(21);
    expect(supabase.insertos.filter((fila) => fila.xml_rfce !== null)).toHaveLength(4);
    expect(supabase.insertos.every((fila) => typeof fila.codigo_seguridad === "string")).toBe(true);
    expect(supabase.insertos.every((fila) => typeof fila.fecha_hora_firma === "string")).toBe(true);
    expect(supabase.insertos.every((fila) => typeof fila.url_qr === "string")).toBe(true);
  });

  it("reutiliza los 25 aceptados sin tocar credenciales, token ni DGII cuando la evidencia persistida es completa", async () => {
    const rows = casosEsperados().map((caso) => envioExistenteParaCaso(caso));
    const supabase = usarSupabase(rows);

    const response = await ejecutarPost(formularioSimulacion({ modo: "enviar_dgii", ambiente: "testecf" }));
    const data = await jsonComo<RespuestaEnvioApi>(response);

    expect(response.status).toBe(200);
    if (!data.ok || data.modo !== "enviar_dgii") throw new Error("La idempotencia total no respondió ok");
    expect(data).toMatchObject({
      totalCasos: 25,
      aceptados: 25,
      rechazados: 0,
      errores: 0,
      enProceso: 0,
      reutilizados: 25,
      detenidoPorRechazo: false,
    });
    expect(data.fuenteCredenciales).toBeUndefined();
    expect(data.casos).toHaveLength(25);
    expect(data.casos.every((caso) => caso.reutilizado && caso.persistido)).toBe(true);
    expect(data.casos[0]?.xmlFirmado).toBe(rows[0]?.xml_firmado);
    expect(data.casos[21]?.xmlRfce).toBe(rows[21]?.xml_rfce);
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
    expect(mocks.cargarCredenciales).not.toHaveBeenCalled();
    expect(mocks.obtenerToken).not.toHaveBeenCalled();
    expect(mocks.enviarEcf).not.toHaveBeenCalled();
    expect(mocks.consultarResultado).not.toHaveBeenCalled();
    expect(supabase.insertos).toHaveLength(0);
    expect(supabase.actualizaciones).toHaveLength(0);
    expect(supabase.selectCalls[0]?.columnas).toContain("secuencia_utilizada");
    expect(supabase.selectCalls[0]?.eq).toMatchObject({
      rnc_emisor: RNC_EMISOR,
      ambiente: "testecf",
      documento_tipo: "prueba",
    });
  });

  it("reenvía selectivamente un caso aceptado cuya secuencia_utilizada persistida es false", async () => {
    const casos = casosEsperados();
    const rows = casos.map((caso) => envioExistenteParaCaso(caso));
    const primeraFila = rows[0];
    const primerCaso = casos[0];
    if (!primeraFila || !primerCaso) throw new Error("El fixture no generó el primer caso");
    primeraFila.secuencia_utilizada = false;
    const supabase = usarSupabase(rows);

    const response = await ejecutarPost(formularioSimulacion({ modo: "enviar_dgii", ambiente: "testecf" }));
    const data = await jsonComo<RespuestaEnvioApi>(response);

    expect(response.status).toBe(200);
    if (!data.ok || data.modo !== "enviar_dgii") throw new Error("El reenvío selectivo no respondió ok");
    expect(data).toMatchObject({ totalCasos: 25, aceptados: 25, reutilizados: 24, detenidoPorRechazo: false });
    expect(mocks.cargarCredenciales).toHaveBeenCalledTimes(1);
    expect(mocks.obtenerToken).toHaveBeenCalledTimes(1);
    expect(mocks.enviarEcf).toHaveBeenCalledTimes(1);
    expect(llamadasEnvio()[0]?.nombreArchivo).toBe(`${RNC_EMISOR}${primerCaso.documento.comprobante.encf}.xml`);
    expect(data.casos[0]?.reutilizado).toBe(false);
    expect(data.casos.slice(1).every((caso) => caso.reutilizado)).toBe(true);
    expect(supabase.insertos).toHaveLength(0);
    expect(supabase.actualizaciones).toHaveLength(1);
    expect(supabase.actualizaciones[0]).toMatchObject({ campo: "id", valor: primeraFila.id });
    expect(supabase.actualizaciones[0]?.fila).toMatchObject({
      encf: primerCaso.documento.comprobante.encf,
      estado: "aceptado",
      secuencia_utilizada: true,
      intentos: 2,
    });
  });

  it("reenvía selectivamente si un caso aceptado tiene xml_firmado o xml_rfce vacío/solo espacios", async () => {
    const casos = casosEsperados();
    const rows = casos.map((caso) => envioExistenteParaCaso(caso));
    const filaEcfVacio = rows[0];
    const filaRfceVacio = rows[21];
    const casoEcf = casos[0];
    const casoRfce = casos[21];
    if (!filaEcfVacio || !filaRfceVacio || !casoEcf || !casoRfce) {
      throw new Error("El fixture no generó los casos esperados");
    }
    filaEcfVacio.xml_firmado = "   ";
    filaRfceVacio.xml_rfce = "";
    const supabase = usarSupabase(rows);

    const response = await ejecutarPost(formularioSimulacion({ modo: "enviar_dgii", ambiente: "testecf" }));
    const data = await jsonComo<RespuestaEnvioApi>(response);

    expect(response.status).toBe(200);
    if (!data.ok || data.modo !== "enviar_dgii") throw new Error("El reenvío por XML vacío no respondió ok");
    expect(data).toMatchObject({ totalCasos: 25, aceptados: 25, reutilizados: 23, detenidoPorRechazo: false });
    expect(mocks.enviarEcf).toHaveBeenCalledTimes(2);
    expect(llamadasEnvio().map((args) => args.nombreArchivo)).toEqual([
      `${RNC_EMISOR}${casoEcf.documento.comprobante.encf}.xml`,
      `${RNC_EMISOR}${casoRfce.documento.comprobante.encf}.xml`,
    ]);
    expect(data.casos[0]?.reutilizado).toBe(false);
    expect(data.casos[21]?.reutilizado).toBe(false);
    expect(supabase.actualizaciones).toHaveLength(2);
  });

  it("detiene CerteCF inmediatamente después del primer rechazo para no quemar secuencias", async () => {
    configurarConsultaConRechazoEnSegundoCaso();
    const supabase = usarSupabase([]);

    const response = await ejecutarPost(formularioSimulacion({ modo: "enviar_dgii", ambiente: "certecf" }));
    const data = await jsonComo<RespuestaEnvioApi>(response);

    expect(response.status).toBe(200);
    if (!data.ok || data.modo !== "enviar_dgii") throw new Error("El candado CerteCF no respondió ok");
    expect(data).toMatchObject({
      ambiente: "certecf",
      totalCasos: 25,
      aceptados: 1,
      rechazados: 1,
      errores: 0,
      detenidoPorRechazo: true,
    });
    expect(data.casos).toHaveLength(2);
    expect(data.casos[1]?.estado).toBe("rechazado");
    expect(mocks.enviarEcf).toHaveBeenCalledTimes(2);
    expect(mocks.consultarResultado).toHaveBeenCalledTimes(2);
    expect(supabase.insertos).toHaveLength(2);
    expect(supabase.insertos[1]).toMatchObject({ estado: "rechazado", secuencia_utilizada: true });
  });

  it("no detiene el lote en TesteCF cuando un caso es rechazado y reporta los 25 hallazgos", async () => {
    configurarConsultaConRechazoEnSegundoCaso();
    usarSupabase([]);

    const response = await ejecutarPost(formularioSimulacion({ modo: "enviar_dgii", ambiente: "testecf" }));
    const data = await jsonComo<RespuestaEnvioApi>(response);

    expect(response.status).toBe(200);
    if (!data.ok || data.modo !== "enviar_dgii") throw new Error("La corrida de ensayo TesteCF no respondió ok");
    expect(data).toMatchObject({
      ambiente: "testecf",
      totalCasos: 25,
      aceptados: 24,
      rechazados: 1,
      errores: 0,
      detenidoPorRechazo: false,
    });
    expect(data.casos).toHaveLength(25);
    expect(data.casos[1]?.estado).toBe("rechazado");
    expect(mocks.enviarEcf).toHaveBeenCalledTimes(25);
    expect(mocks.consultarResultado).toHaveBeenCalledTimes(21);
  });
});

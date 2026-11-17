import { afterEach, describe, expect, test, vi } from "vitest";

import { buscarContribuyenteDgii } from "./acciones";

const FORMULARIO_DGII = `
  <input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="vs123==" />
  <input type="hidden" name="__VIEWSTATEGENERATOR" id="__VIEWSTATEGENERATOR" value="4F4BAA71" />
  <input type="hidden" name="__EVENTVALIDATION" id="__EVENTVALIDATION" value="ev456==" />
  <input name="ctl00$cphMain$txtRNCCedula" type="text" id="cphMain_txtRNCCedula" />`;

/** Tabla vacía con el aviso real de fallo del portal (no dice nada del RNC). */
const FALLO_DEL_PORTAL = `
  <span id="cphMain_lblInformacion" class="label label-warning">17/11/2026 11:47 : Ocurrió un error al intentar realizar la búsqueda. Capture esta pantalla y remítala a la Oficina Virtual.</span>
  <table class="table detailview" id="cphMain_dvDatosContribuyentes">

  </table>`;

const NO_INSCRITO = `
  <span id="cphMain_lblInformacion" class="label label-warning">El RNC/C&#233;dula consultado no se encuentra inscrito como Contribuyente.</span>
  <table class="table detailview" id="cphMain_dvDatosContribuyentes">

  </table>`;

const OXYMAT = `
  <table class="table detailview" id="cphMain_dvDatosContribuyentes">
    <tr><td><b>Nombre/Raz&#243;n Social</b></td><td>OXYMAT SRL</td></tr>
    <tr><td><b>Estado</b></td><td>ACTIVO</td></tr>
  </table>`;

/** Simula la DGII: cada POST devuelve la siguiente respuesta (la última se repite). */
function simularPortal(respuestas: string[], estadoFormulario = 200) {
  let posts = 0;
  const falso = async (_entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if ((init?.method ?? "GET").toUpperCase() !== "POST") {
      return new Response(FORMULARIO_DGII, { status: estadoFormulario });
    }
    const html = respuestas[Math.min(posts, respuestas.length - 1)] ?? "";
    posts += 1;
    return new Response(html, { status: 200 });
  };
  vi.stubGlobal("fetch", falso);
}

/** Importa la acción con la caché de la DGII en blanco. */
async function accionFresca() {
  vi.resetModules();
  return await import("./acciones");
}

describe("acción de búsqueda en la DGII", () => {
  test("rechaza un tipo que la DGII no consulta", async () => {
    await expect(buscarContribuyenteDgii("AB123456", "pasaporte")).resolves.toEqual({
      ok: false,
      error: "La DGII solo consulta RNC y cédula. Escribe el número a mano.",
    });
  });

  test("pide el número cuando está vacío", async () => {
    await expect(buscarContribuyenteDgii("   ", "rnc")).resolves.toEqual({
      ok: false,
      error: "Escribe el RNC de 9 dígitos.",
    });
    await expect(buscarContribuyenteDgii("", "cedula")).resolves.toEqual({
      ok: false,
      error: "Escribe la cédula de 11 dígitos.",
    });
  });

  test("valida la longitud sin salir a la red", async () => {
    await expect(buscarContribuyenteDgii("123", "rnc")).resolves.toEqual({
      ok: false,
      error: "El RNC debe tener 9 dígitos.",
    });
    await expect(buscarContribuyenteDgii("130893489", "cedula")).resolves.toEqual({
      ok: false,
      error: "La cédula debe tener 11 dígitos.",
    });
  });
});

describe("mensajes de la acción cuando la DGII falla", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("un fallo del portal no se presenta como 'No se encontró'", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    simularPortal([FALLO_DEL_PORTAL]);
    const { buscarContribuyenteDgii: buscar } = await accionFresca();

    const resultado = await buscar("131488791", "rnc");
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error).toContain("no devolvió");
    expect(resultado.error).not.toContain("No se encontró");
  });

  test("dos avisos de no inscrito sí se presentan como 'No se encontró'", async () => {
    simularPortal([NO_INSCRITO]);
    const { buscarContribuyenteDgii: buscar } = await accionFresca();

    await expect(buscar("131488792", "rnc")).resolves.toEqual({
      ok: false,
      error: "No se encontró ese RNC en la DGII.",
    });
  });

  test("si la DGII bloquea, pide escribir el nombre a mano", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    simularPortal([OXYMAT], 403);
    const { buscarContribuyenteDgii: buscar } = await accionFresca();

    const resultado = await buscar("131488791", "rnc");
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error).toContain("bloqueando");
    expect(resultado.error).toContain("Escribe el nombre a mano");
  });

  test("un RNC inscrito devuelve el nombre y el estado", async () => {
    simularPortal([OXYMAT]);
    const { buscarContribuyenteDgii: buscar } = await accionFresca();

    await expect(buscar("131-48879-1", "rnc")).resolves.toEqual({
      ok: true,
      datos: {
        nombre: "OXYMAT SRL",
        nombreComercial: null,
        municipioProvincia: null,
        direccion: null,
        estado: "ACTIVO",
      },
    });
  });
});

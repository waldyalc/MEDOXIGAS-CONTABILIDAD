import { type NextRequest, NextResponse } from "next/server";

import { hoyRD, primerDiaMesRD } from "@/app/(pos)/pos/_components/formato-pos";
import {
  getCierresPOS,
  getContextoPOS,
  getCuentasPOS,
  getDevolucionesPOS,
  getTerminalesSeguro,
  getUltimoTurno,
} from "@/app/(pos)/pos/_components/servidor";
import { getEmpresa } from "@/lib/facturacion/consultas";
import {
  leerPagina,
  leerTamano,
  leerTexto,
  type ParametrosLista,
  type ResultadoPagina,
  resumirPagina,
} from "@/lib/listas/parametros";
import { getPlantillaImpresion } from "@/lib/plantillas-impresion/consultas";
import type {
  MapaSnapshotsPos,
  SnapshotDevolucionesPos,
  SnapshotHistorialPos,
  SnapshotPagosPos,
  SnapshotTurnosPos,
  VistaSecundariaPos,
} from "@/lib/pos/cache-pantallas-pos";
import { getHistorialPOS, getPagosPOS, getResumenTurno, type PagoPOSFila } from "@/lib/pos/consultas";
import type { HistorialPOSFila, ResumenTurnoVista, TerminalPOS, TipoMovimientoPOS, TurnoPOS } from "@/lib/pos/tipos";

export const dynamic = "force-dynamic";

const ESTADOS_HISTORIAL = new Set(["pagada", "abierta", "anulada"]);
const ESTADOS_DEVOLUCIONES = new Set(["activa", "anulada"]);
const VISTAS_SOLICITADAS = new Set<VistaSolicitada>(["historial", "pagos", "turnos", "devoluciones", "todas"]);
const HEADERS_NO_STORE = { "Cache-Control": "no-store" } as const;

const ERROR_HISTORIAL = "No se pudo cargar el historial. Revisa tu conexión e inténtalo de nuevo.";
const ERROR_PAGOS = "No se pudieron cargar los recibos. Revisa tu conexión e inténtalo de nuevo.";
const ERROR_TURNO = "No se pudo cargar el turno. Revisa tu conexión e inténtalo de nuevo.";
const ERROR_CIERRES = "No se pudieron cargar los cierres. Revisa tu conexión e inténtalo de nuevo.";
const ERROR_DEVOLUCIONES = "No se pudieron cargar las devoluciones. Revisa tu conexión e inténtalo de nuevo.";

type VistaSolicitada = VistaSecundariaPos | "todas";

interface DatosContexto {
  terminal: TerminalPOS;
  turno: TurnoPOS | null;
  puedeEscribir: boolean;
  params: ParametrosLista;
}

function esVistaSolicitada(valor: string): valor is VistaSolicitada {
  return VISTAS_SOLICITADAS.has(valor as VistaSolicitada);
}

function responderError(status: number, error: string): NextResponse {
  return NextResponse.json({ ok: false, error }, { status, headers: HEADERS_NO_STORE });
}

function responderJson(datos: unknown): NextResponse {
  return NextResponse.json(datos, { headers: HEADERS_NO_STORE });
}

function parametrosDeSearchParams(searchParams: URLSearchParams): ParametrosLista {
  const params: ParametrosLista = {};

  for (const [clave, valor] of searchParams.entries()) {
    if (clave === "vista") continue;
    const actual = params[clave];
    if (Array.isArray(actual)) {
      actual.push(valor);
    } else if (typeof actual === "string") {
      params[clave] = [actual, valor];
    } else {
      params[clave] = valor;
    }
  }

  return params;
}

async function intentar<T>(accion: () => Promise<T>, defecto: T): Promise<T> {
  try {
    return await accion();
  } catch {
    return defecto;
  }
}

function terminalConTicket(terminal: TerminalPOS): SnapshotPagosPos["terminal"] {
  return {
    id: terminal.id,
    nombre: terminal.nombre,
    cuenta_efectivo_id: terminal.cuenta_efectivo_id,
    plantilla_ticket: terminal.plantilla_ticket,
  };
}

async function construirHistorialPos(datos: DatosContexto): Promise<SnapshotHistorialPos> {
  const { terminal, params } = datos;
  const limpio = leerTexto(params, "limpio") === "1";
  const desdeParam = leerTexto(params, "desde");
  const hastaParam = leerTexto(params, "hasta");
  const desde = desdeParam || (limpio ? "" : primerDiaMesRD());
  const hasta = hastaParam || (limpio ? "" : hoyRD());
  const q = leerTexto(params, "q");
  const estadoTexto = leerTexto(params, "estado");
  const terminalParam = leerTexto(params, "terminal");
  const estado = ESTADOS_HISTORIAL.has(estadoTexto) ? (estadoTexto as "pagada" | "abierta" | "anulada") : undefined;
  const pagina = leerPagina(params);
  const tamano = leerTamano(params);

  const [terminales, empresa, plantillaFactura] = await Promise.all([
    getTerminalesSeguro(),
    intentar(() => getEmpresa(), null),
    intentar(() => getPlantillaImpresion("factura"), { mostrarLogo: true, notas: "", terminos: "" }),
  ]);

  let historial: ResultadoPagina<HistorialPOSFila> = {
    filas: [],
    resumen: resumirPagina(pagina, tamano, 0),
  };
  let error: string | null = null;

  try {
    historial = await getHistorialPOS({
      q,
      desde: desde || undefined,
      hasta: hasta || undefined,
      estado,
      terminal_id: terminalParam || undefined,
      pagina,
      tamano,
    });
  } catch {
    error = ERROR_HISTORIAL;
  }

  return {
    filas: historial.filas,
    resumen: historial.resumen,
    params,
    terminales: terminales.map((candidata) => ({ id: candidata.id, nombre: candidata.nombre })),
    desde,
    hasta,
    empresa,
    plantillaTicket: terminal.plantilla_ticket,
    plantillaFactura,
    puedeEscribir: datos.puedeEscribir,
    hayFiltros: Boolean(q || estadoTexto || terminalParam || desdeParam || hastaParam || limpio),
    error,
    actualizadoEn: Date.now(),
  };
}

async function construirPagosPos(datos: DatosContexto): Promise<SnapshotPagosPos> {
  const { terminal, turno, params } = datos;
  const pagina = leerPagina(params);
  const tamano = leerTamano(params);
  const q = leerTexto(params, "q");
  const tipo: TipoMovimientoPOS = leerTexto(params, "tipo") === "retiro" ? "retiro" : "ingreso";

  const cuentas = await intentar(() => getCuentasPOS(), []);

  let vista: ResumenTurnoVista | null = null;
  let error: string | null = null;

  if (turno) {
    try {
      vista = await getResumenTurno(turno.id);
    } catch {
      error = "No se pudo cargar el turno abierto. Revisa tu conexión e inténtalo de nuevo.";
    }
  }

  let pagos: ResultadoPagina<PagoPOSFila> = { filas: [], resumen: resumirPagina(pagina, tamano, 0) };
  try {
    pagos = await getPagosPOS({ terminalId: terminal.id, tipo, q, pagina, tamano });
  } catch {
    error = error ?? ERROR_PAGOS;
  }

  return {
    terminal: terminalConTicket(terminal),
    turnoAbierto: turno !== null,
    vista,
    cuentas,
    filas: pagos.filas,
    resumenPagina: pagos.resumen,
    params,
    tipo,
    puedeEscribir: datos.puedeEscribir,
    error,
    actualizadoEn: Date.now(),
  };
}

async function construirTurnosPos(datos: DatosContexto): Promise<SnapshotTurnosPos> {
  const { terminal, turno, params } = datos;
  const pagina = leerPagina(params);
  const tamano = leerTamano(params);
  const todas = leerTexto(params, "todas") === "1";

  const cuentas = await intentar(() => getCuentasPOS(), []);
  const terminales = await getTerminalesSeguro();

  let cierres: ResultadoPagina<TurnoPOS> = { filas: [], resumen: resumirPagina(pagina, tamano, 0) };
  let vista: ResumenTurnoVista | null = null;
  let error: string | null = null;

  try {
    cierres = await getCierresPOS({ terminalId: terminal.id, todas, pagina, tamano });
  } catch {
    error = ERROR_CIERRES;
  }

  try {
    const vistaActual = turno ? await getResumenTurno(turno.id) : null;
    const ultimo = vistaActual ? null : await getUltimoTurno(terminal.id);
    vista = vistaActual ?? (ultimo ? await getResumenTurno(ultimo.id) : null);
  } catch {
    error = error ?? ERROR_TURNO;
  }

  return {
    terminal: terminalConTicket(terminal),
    vistaInicial: vista,
    turnoAbierto: turno !== null,
    cuentas,
    cierres: cierres.filas,
    resumenPagina: cierres.resumen,
    terminales: terminales.map((candidata) => ({
      id: candidata.id,
      nombre: candidata.nombre,
      cuenta_tarjeta_debito_id: candidata.cuenta_tarjeta_debito_id,
      cuenta_tarjeta_credito_id: candidata.cuenta_tarjeta_credito_id,
    })),
    todas,
    params,
    puedeEscribir: datos.puedeEscribir,
    error,
    actualizadoEn: Date.now(),
  };
}

async function construirDevolucionesPos(datos: DatosContexto): Promise<SnapshotDevolucionesPos> {
  const { terminal, turno, params } = datos;
  const limpio = leerTexto(params, "limpio") === "1";
  const desdeParam = leerTexto(params, "desde");
  const hastaParam = leerTexto(params, "hasta");
  const desde = desdeParam || (limpio ? "" : primerDiaMesRD());
  const hasta = hastaParam || (limpio ? "" : hoyRD());
  const estadoTexto = leerTexto(params, "estado");
  const estado = ESTADOS_DEVOLUCIONES.has(estadoTexto) ? (estadoTexto as "activa" | "anulada") : undefined;
  const q = leerTexto(params, "q");
  const facturaInicial = leerTexto(params, "factura");
  const pagina = leerPagina(params);
  const tamano = leerTamano(params);

  const cuentas = await intentar(() => getCuentasPOS(), []);
  let devoluciones: Awaited<ReturnType<typeof getDevolucionesPOS>> = {
    filas: [],
    resumen: resumirPagina(pagina, tamano, 0),
  };
  let error: string | null = null;

  try {
    devoluciones = await getDevolucionesPOS({
      q,
      desde: desde || undefined,
      hasta: hasta || undefined,
      estado,
      pagina,
      tamano,
    });
  } catch {
    error = ERROR_DEVOLUCIONES;
  }

  const resumenTurno = turno ? await intentar(() => getResumenTurno(turno.id), null) : null;
  const cuentaEfectivoNombre =
    cuentas.find((cuenta) => cuenta.id === terminal.cuenta_efectivo_id)?.nombre ?? terminal.nombre;
  const sinCaja = !cuentas.some((cuenta) => cuenta.id === terminal.cuenta_efectivo_id);

  return {
    filas: devoluciones.filas,
    resumen: devoluciones.resumen,
    params,
    desde,
    hasta,
    terminal: {
      id: terminal.id,
      nombre: terminal.nombre,
      cuenta_efectivo_id: terminal.cuenta_efectivo_id,
    },
    cuentaEfectivoNombre,
    sinCaja,
    turno: turno ? { id: turno.id, numero: turno.numero } : null,
    efectivoEsperado: resumenTurno?.resumen.efectivo.efectivo_esperado ?? "0.00",
    facturaInicial: facturaInicial || null,
    plantilla: terminal.plantilla_ticket,
    puedeEscribir: datos.puedeEscribir,
    hayFiltros: Boolean(q || estadoTexto || desdeParam || hastaParam || limpio),
    error,
    actualizadoEn: Date.now(),
  };
}

function construirPorVista(vista: VistaSecundariaPos, datos: DatosContexto) {
  if (vista === "historial") return construirHistorialPos(datos);
  if (vista === "pagos") return construirPagosPos(datos);
  if (vista === "turnos") return construirTurnosPos(datos);
  return construirDevolucionesPos(datos);
}

export async function GET(request: NextRequest) {
  const contexto = await intentar(() => getContextoPOS(), null);
  if (!contexto) return responderError(500, "No se pudo cargar el contexto del POS.");

  const perfil = contexto.perfil;
  const terminal = contexto.terminal;
  if (!perfil) return responderError(401, "No autenticado.");
  if (!terminal) return responderError(400, "No hay una terminal POS activa.");

  const vistaTexto = request.nextUrl.searchParams.get("vista") ?? "";
  if (!esVistaSolicitada(vistaTexto)) return responderError(400, "La vista solicitada no es válida.");

  const datos: DatosContexto = {
    terminal,
    turno: contexto.turno,
    puedeEscribir: perfil.rol !== "lector",
    params: parametrosDeSearchParams(request.nextUrl.searchParams),
  };

  if (vistaTexto !== "todas") {
    const snapshot = await construirPorVista(vistaTexto, datos);
    return responderJson({ ok: true, vista: vistaTexto, datos: snapshot });
  }

  const [historial, pagos, turnos, devoluciones] = await Promise.all([
    construirHistorialPos(datos),
    construirPagosPos(datos),
    construirTurnosPos(datos),
    construirDevolucionesPos(datos),
  ]);

  const pantallas: MapaSnapshotsPos = { historial, pagos, turnos, devoluciones };
  return responderJson({ ok: true, vista: "todas", pantallas });
}

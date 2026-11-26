import type { DevolucionPOSFila } from "@/app/(pos)/pos/_components/tipos";
import type { Empresa } from "@/lib/facturacion/tipos";
import type { ParametrosLista, ResumenPagina } from "@/lib/listas/parametros";

import { guardarOffline, leerOffline } from "./almacen-offline";
import type { PagoPOSFila } from "./consultas";
import type { CuentasTarjetaCierre } from "./impresion-cierre";
import type { HistorialPOSFila, PlantillaTicket, ResumenTurnoVista, TipoMovimientoPOS, TurnoPOS } from "./tipos";

/**
 * Snapshots completos de las pantallas secundarias del POS. La RAM responde de
 * forma síncrona en el primer render; IndexedDB conserva esos mismos props para
 * sobrevivir recargas y caídas de red. La clave siempre incluye el `ambito`
 * (usuario + terminal), así dos cajas o dos usuarios nunca se pisan.
 */

export type VistaSecundariaPos = "historial" | "pagos" | "turnos" | "devoluciones";

export const RUTA_A_VISTA_SECUNDARIA = {
  "/pos/historial": "historial",
  "/pos/pagos": "pagos",
  "/pos/turnos": "turnos",
  "/pos/devoluciones": "devoluciones",
} as const satisfies Record<string, VistaSecundariaPos>;

export interface CuentaSnapshotPos {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  es_caja_banco: boolean;
  tipo_banco: string | null;
}

export interface TerminalConTicketSnapshotPos {
  id: string;
  nombre: string;
  cuenta_efectivo_id: string;
  plantilla_ticket: PlantillaTicket;
}

export interface SnapshotHistorialPos {
  filas: HistorialPOSFila[];
  resumen: ResumenPagina;
  params: ParametrosLista;
  terminales: { id: string; nombre: string }[];
  desde: string;
  hasta: string;
  empresa: Empresa | null;
  plantillaTicket: PlantillaTicket;
  plantillaFactura: { mostrarLogo: boolean; notas: string; terminos: string };
  puedeEscribir: boolean;
  hayFiltros: boolean;
  error?: string | null;
  actualizadoEn: number;
}

export interface SnapshotPagosPos {
  terminal: TerminalConTicketSnapshotPos;
  turnoAbierto: boolean;
  vista: ResumenTurnoVista | null;
  cuentas: CuentaSnapshotPos[];
  filas: PagoPOSFila[];
  resumenPagina: ResumenPagina;
  params: ParametrosLista;
  tipo: TipoMovimientoPOS;
  puedeEscribir: boolean;
  error?: string | null;
  actualizadoEn: number;
}

export interface SnapshotTurnosPos {
  terminal: TerminalConTicketSnapshotPos;
  vistaInicial: ResumenTurnoVista | null;
  turnoAbierto: boolean;
  cuentas: CuentaSnapshotPos[];
  cierres: TurnoPOS[];
  resumenPagina: ResumenPagina;
  terminales: (CuentasTarjetaCierre & { nombre: string })[];
  todas: boolean;
  params: ParametrosLista;
  puedeEscribir: boolean;
  error?: string | null;
  actualizadoEn: number;
}

export interface SnapshotDevolucionesPos {
  filas: DevolucionPOSFila[];
  resumen: ResumenPagina;
  params: ParametrosLista;
  desde: string;
  hasta: string;
  terminal: { id: string; nombre: string; cuenta_efectivo_id: string };
  cuentaEfectivoNombre: string;
  sinCaja: boolean;
  turno: { id: string; numero: number } | null;
  efectivoEsperado: string;
  facturaInicial: string | null;
  plantilla: PlantillaTicket;
  puedeEscribir: boolean;
  hayFiltros: boolean;
  error?: string | null;
  actualizadoEn: number;
}

export interface MapaSnapshotsPos {
  historial: SnapshotHistorialPos;
  pagos: SnapshotPagosPos;
  turnos: SnapshotTurnosPos;
  devoluciones: SnapshotDevolucionesPos;
}

const VISTAS_SECUNDARIAS_POS: VistaSecundariaPos[] = ["historial", "pagos", "turnos", "devoluciones"];

const memoriaPantallas = new Map<string, unknown>();
const precargasEnCurso: Partial<Record<string, Promise<Partial<MapaSnapshotsPos>>>> = {};

function clavePantalla(ambito: string, vista: VistaSecundariaPos): string {
  return `${ambito}/pantalla/${vista}`;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function snapshotValido<T>(valor: unknown): T | null {
  if (!esObjeto(valor) || typeof valor.actualizadoEn !== "number") return null;
  return valor as T;
}

/** Lectura síncrona en RAM: es la que permite pintar la pestaña sin esperar ni un tick. */
export function leerSnapshotPantallaMemoria<V extends VistaSecundariaPos>(
  ambito: string,
  vista: V,
): MapaSnapshotsPos[V] | null {
  return snapshotValido<MapaSnapshotsPos[V]>(memoriaPantallas.get(clavePantalla(ambito, vista)));
}

/** Actualiza RAM al instante y persiste en IndexedDB; la persistencia nunca rompe la UI. */
export async function guardarSnapshotPantalla<V extends VistaSecundariaPos>(
  ambito: string,
  vista: V,
  datos: MapaSnapshotsPos[V],
): Promise<void> {
  const clave = clavePantalla(ambito, vista);
  memoriaPantallas.set(clave, datos);
  await guardarOffline("config", clave, datos).catch(() => undefined);
}

/** Devuelve RAM si está caliente; si no, hidrata una vez desde IndexedDB. */
export async function hidratarSnapshotPantalla<V extends VistaSecundariaPos>(
  ambito: string,
  vista: V,
): Promise<MapaSnapshotsPos[V] | null> {
  const enMemoria = leerSnapshotPantallaMemoria(ambito, vista);
  if (enMemoria) return enMemoria;

  const clave = clavePantalla(ambito, vista);
  const leido = await leerOffline<unknown>("config", clave).catch(() => undefined);
  const snapshot = snapshotValido<MapaSnapshotsPos[V]>(leido);
  if (snapshot) memoriaPantallas.set(clave, snapshot);
  return snapshot;
}

/** Calienta las cuatro pantallas en paralelo al abrir el POS. */
export async function hidratarTodasPantallasPos(ambito: string): Promise<Partial<MapaSnapshotsPos>> {
  const [historial, pagos, turnos, devoluciones] = await Promise.all([
    hidratarSnapshotPantalla(ambito, "historial"),
    hidratarSnapshotPantalla(ambito, "pagos"),
    hidratarSnapshotPantalla(ambito, "turnos"),
    hidratarSnapshotPantalla(ambito, "devoluciones"),
  ]);

  const resultado: Partial<MapaSnapshotsPos> = {};
  if (historial) resultado.historial = historial;
  if (pagos) resultado.pagos = pagos;
  if (turnos) resultado.turnos = turnos;
  if (devoluciones) resultado.devoluciones = devoluciones;
  return resultado;
}

/** Limpia solo la RAM; IndexedDB sigue disponible para la próxima hidratación. */
export function limpiarMemoriaPantallasPos(): void {
  memoriaPantallas.clear();
}

function extraerSnapshotRespuesta<T>(cuerpo: unknown): T | null {
  if (!esObjeto(cuerpo) || cuerpo.ok !== true) return null;
  return snapshotValido<T>(cuerpo.datos);
}

/**
 * Refresca una pantalla contra la API sin bloquear la UI. Si llega un filtro
 * temporal (`query`) devuelve ese snapshot, pero no pisa la vista por defecto
 * guardada en RAM/IndexedDB. Toda falla de red, timeout, 5xx o JSON inválido
 * se convierte en `null`, nunca en una excepción.
 */
export async function refrescarPantallaPos<V extends VistaSecundariaPos>(
  ambito: string,
  vista: V,
  opciones: { query?: string; timeoutMs?: number; fetchFn?: typeof fetch } = {},
): Promise<MapaSnapshotsPos[V] | null> {
  const query = opciones.query ?? "";
  const sufijo = query === "" ? "" : `&${query}`;

  try {
    const respuesta = await (opciones.fetchFn ?? fetch)(`/api/pos/estado-pantallas?vista=${vista}${sufijo}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(opciones.timeoutMs ?? 8_000),
    });
    if (!respuesta.ok) return null;

    const cuerpo: unknown = await respuesta.json();
    const datos = extraerSnapshotRespuesta<MapaSnapshotsPos[V]>(cuerpo);
    if (!datos) return null;

    if (query === "") await guardarSnapshotPantalla(ambito, vista, datos);
    return datos;
  } catch {
    return null;
  }
}

async function descargarPantallasPos(
  ambito: string,
  opciones: { timeoutMs?: number; fetchFn?: typeof fetch },
): Promise<Partial<MapaSnapshotsPos>> {
  const vacio: Partial<MapaSnapshotsPos> = {};

  try {
    const respuesta = await (opciones.fetchFn ?? fetch)("/api/pos/estado-pantallas?vista=todas", {
      cache: "no-store",
      signal: AbortSignal.timeout(opciones.timeoutMs ?? 8_000),
    });
    if (!respuesta.ok) return vacio;

    const cuerpo: unknown = await respuesta.json();
    if (!esObjeto(cuerpo) || cuerpo.ok !== true || !esObjeto(cuerpo.pantallas)) return vacio;

    const pantallas = cuerpo.pantallas;
    const historial = snapshotValido<MapaSnapshotsPos["historial"]>(pantallas.historial);
    const pagos = snapshotValido<MapaSnapshotsPos["pagos"]>(pantallas.pagos);
    const turnos = snapshotValido<MapaSnapshotsPos["turnos"]>(pantallas.turnos);
    const devoluciones = snapshotValido<MapaSnapshotsPos["devoluciones"]>(pantallas.devoluciones);

    const resultado: Partial<MapaSnapshotsPos> = {};
    const escrituras: Promise<void>[] = [];
    if (historial) {
      resultado.historial = historial;
      escrituras.push(guardarSnapshotPantalla(ambito, "historial", historial));
    }
    if (pagos) {
      resultado.pagos = pagos;
      escrituras.push(guardarSnapshotPantalla(ambito, "pagos", pagos));
    }
    if (turnos) {
      resultado.turnos = turnos;
      escrituras.push(guardarSnapshotPantalla(ambito, "turnos", turnos));
    }
    if (devoluciones) {
      resultado.devoluciones = devoluciones;
      escrituras.push(guardarSnapshotPantalla(ambito, "devoluciones", devoluciones));
    }

    await Promise.all(escrituras);
    return resultado;
  } catch {
    return vacio;
  }
}

/**
 * Precarga silenciosa de las cuatro pantallas. Las llamadas simultáneas del
 * mismo `ambito` comparten una sola petición de red.
 */
export function precargarPantallasPos(
  ambito: string,
  opciones: { timeoutMs?: number; fetchFn?: typeof fetch } = {},
): Promise<Partial<MapaSnapshotsPos>> {
  const enCurso = precargasEnCurso[ambito];
  if (enCurso) return enCurso;

  const tarea = descargarPantallasPos(ambito, opciones).finally(() => {
    delete precargasEnCurso[ambito];
  });
  precargasEnCurso[ambito] = tarea;
  return tarea;
}

export { VISTAS_SECUNDARIAS_POS };

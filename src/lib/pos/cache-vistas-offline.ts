import type { DetalleVentaPOS, DevolucionPOSFila } from "@/app/(pos)/pos/_components/tipos";

import { guardarOffline, leerOffline } from "./almacen-offline";
import { sumarMontos } from "./calculo";
import type { OperacionOffline } from "./cola-offline";
import type { PagoPOSFila } from "./consultas";
import type {
  Decimal,
  HistorialPOSFila,
  ResumenTurno,
  ResumenTurnoVista,
  TipoMovimientoPOS,
  TurnoPOS,
  VentaPOSResultado,
} from "./tipos";

/**
 * Caché de las vistas recientes del POS (Ventas, Turnos, Pagos y Devoluciones)
 * para que el cajero siga viendo lo último guardado en este dispositivo cuando
 * la red falla. La verdad sigue siendo el servidor: aquí solo se lee mientras
 * no hay conexión, y en cuanto llegan las filas reales se vuelve a guardar.
 *
 * Los detalles de venta se guardan junto al ticket ya armado para poder
 * reimprimir cualquier venta de las últimas `MAX_DETALLES_VENTA_CACHE` sin
 * internet; el recorte por `guardadoEn` evita que IndexedDB crezca sin límite.
 */

export const MAX_DETALLES_VENTA_CACHE = 30;
export const MAX_PREDESCARGAS_HISTORIAL = 30;
export const TAMANO_LOTE_PREDESCARGA = 3;

export interface VistaHistorialOffline {
  filas: HistorialPOSFila[];
  actualizadoEn: string;
}

export interface DetalleVentaCacheado {
  detalle: DetalleVentaPOS;
  ticket: VentaPOSResultado;
  guardadoEn: number;
}

export type MapaDetallesVentaCache = Record<string, DetalleVentaCacheado>;

export interface VistaTurnosOffline {
  vistaInicial: ResumenTurnoVista | null;
  cierres: TurnoPOS[];
  actualizadoEn: string;
}

export interface VistaPagosOffline {
  filas: PagoPOSFila[];
  actualizadoEn: string;
}

export interface VistaDevolucionesOffline {
  filas: DevolucionPOSFila[];
  actualizadoEn: string;
}

export const claveVistaHistorial = (ambito: string) => `${ambito}/vista-historial`;
export const claveDetallesVenta = (ambito: string) => `${ambito}/detalles-venta`;
export const claveVistaTurnos = (ambito: string) => `${ambito}/vista-turnos`;
export const claveVistaPagos = (ambito: string, tipo: TipoMovimientoPOS) => `${ambito}/vista-pagos/${tipo}`;
export const claveVistaDevoluciones = (ambito: string) => `${ambito}/vista-devoluciones`;

/** Deja los `max` detalles más recientes por `guardadoEn`; no muta el mapa recibido. */
export function recortarDetallesVentaCache(
  mapa: Readonly<MapaDetallesVentaCache>,
  max = MAX_DETALLES_VENTA_CACHE,
): MapaDetallesVentaCache {
  if (max <= 0) return {};

  return Object.fromEntries(
    Object.entries(mapa)
      .sort((a, b) => b[1].guardadoEn - a[1].guardadoEn || a[0].localeCompare(b[0]))
      .slice(0, max),
  );
}

export interface FiltrosHistorialCache {
  q?: string;
  estado?: string;
}

/** Filtra las ventas cacheadas por NCF, número, cliente y estado, sin red. */
export function filtrarFilasHistorialLocal(
  filas: readonly HistorialPOSFila[],
  filtros: FiltrosHistorialCache = {},
): HistorialPOSFila[] {
  const buscado = (filtros.q ?? "").trim().toLocaleLowerCase("es");
  const estado = (filtros.estado ?? "").trim();

  return filas.filter((fila) => {
    if (estado !== "" && fila.estado !== estado) return false;
    if (buscado === "") return true;

    const texto = `${fila.ncf ?? ""} ${fila.numero} ${fila.cliente_nombre}`.toLocaleLowerCase("es");
    return texto.includes(buscado);
  });
}

interface PagoLeido {
  metodo: string;
  monto: Decimal;
}

function campos(valor: unknown): Record<string, unknown> | null {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return null;
  return valor as Record<string, unknown>;
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() !== "" ? valor : null;
}

function leerPagos(valor: unknown): PagoLeido[] {
  if (!Array.isArray(valor)) return [];

  return valor.flatMap((item) => {
    const pago = campos(item);
    const metodo = texto(pago?.metodo);
    const monto = texto(pago?.monto);
    if (!metodo || !monto) return [];
    return [{ metodo, monto }];
  });
}

type GrupoMetodo = "efectivo" | "tarjeta" | "transferencia";

/** Los métodos del POS y los de la base caen en los mismos grupos del resumen. */
function grupoMetodo(metodo: string): GrupoMetodo | null {
  if (metodo === "efectivo") return "efectivo";
  if (metodo === "tarjeta" || metodo === "tarjeta_debito" || metodo === "tarjeta_credito") return "tarjeta";
  if (metodo === "transferencia") return "transferencia";
  return null;
}

interface VentaPendiente {
  total: Decimal;
  cobrado: Decimal;
  efectivo: Decimal[];
  tarjeta: Decimal[];
  transferencia: Decimal[];
}

/**
 * Lee una venta pendiente del snapshot local (`venta` + ticket) y cae al
 * payload validado cuando el snapshot no alcanza. Nunca lanza: lo que venga de
 * IndexedDB es `unknown`.
 */
function leerVentaPendiente(operacion: OperacionOffline): VentaPendiente | null {
  const snapshot = campos(operacion.snapshot);
  const venta = campos(snapshot?.venta);
  const ticket = campos(snapshot?.ticket);
  const payload = campos(operacion.payload);

  const total = texto(campos(venta?.factura)?.total) ?? texto(ticket?.total);
  const pagosVenta = leerPagos(venta?.pagos);
  const pagos = pagosVenta.length > 0 ? pagosVenta : leerPagos(payload?.pagos);
  const cobrado = pagos.length > 0 ? sumarMontos(pagos.map((pago) => pago.monto)) : total;

  if (total === null && pagos.length === 0) return null;

  const pendiente: VentaPendiente = {
    total: total ?? cobrado ?? "0",
    cobrado: cobrado ?? total ?? "0",
    efectivo: [],
    tarjeta: [],
    transferencia: [],
  };

  for (const pago of pagos) {
    const grupo = grupoMetodo(pago.metodo);
    if (grupo === "efectivo") pendiente.efectivo.push(pago.monto);
    if (grupo === "tarjeta") pendiente.tarjeta.push(pago.monto);
    if (grupo === "transferencia") pendiente.transferencia.push(pago.monto);
  }

  return pendiente;
}

export interface ResumenTurnoConPendientes {
  resumen: ResumenTurno;
  pendientesSumadas: number;
}

/**
 * Suma en vivo las ventas que siguen en la cola local (`pendiente`) del turno
 * abierto, para que el cajero vea el esperado real antes de que suban.
 * Réplica de `_pos_resumen`: ventas por total y cobrado, métodos de pago y el
 * efectivo que entró a la caja. Todo en centavos exactos y sin mutar el resumen
 * del servidor.
 */
export function sumarVentasLocalesAResumenTurno(
  resumen: ResumenTurno,
  operaciones: readonly OperacionOffline[],
  turnoId: string,
): ResumenTurnoConPendientes {
  const pendientes = operaciones.filter(
    (operacion) => operacion.tipo === "venta" && operacion.estado === "pendiente" && operacion.turnoId === turnoId,
  );

  const totales: Decimal[] = [resumen.ventas.total];
  const cobrados: Decimal[] = [resumen.ventas.cobrado];
  const efectivo: Decimal[] = [resumen.ventas.por_metodo.efectivo];
  const efectivoLocal: Decimal[] = [];
  const tarjeta: Decimal[] = [resumen.ventas.por_metodo.tarjeta];
  const transferencia: Decimal[] = [resumen.ventas.por_metodo.transferencia];
  let pendientesSumadas = 0;

  for (const operacion of pendientes) {
    const venta = leerVentaPendiente(operacion);
    if (!venta) continue;

    pendientesSumadas += 1;
    totales.push(venta.total);
    cobrados.push(venta.cobrado);
    efectivo.push(...venta.efectivo);
    efectivoLocal.push(...venta.efectivo);
    tarjeta.push(...venta.tarjeta);
    transferencia.push(...venta.transferencia);
  }

  const ventasEfectivo = sumarMontos(efectivo);

  return {
    resumen: {
      ...resumen,
      ventas: {
        ...resumen.ventas,
        total: sumarMontos(totales),
        cantidad: resumen.ventas.cantidad + pendientesSumadas,
        cobrado: sumarMontos(cobrados),
        por_metodo: {
          ...resumen.ventas.por_metodo,
          efectivo: ventasEfectivo,
          tarjeta: sumarMontos(tarjeta),
          transferencia: sumarMontos(transferencia),
        },
      },
      efectivo: {
        ...resumen.efectivo,
        ventas_efectivo: ventasEfectivo,
        efectivo_esperado: sumarMontos([resumen.efectivo.efectivo_esperado, ...efectivoLocal]),
      },
    },
    pendientesSumadas,
  };
}

export async function guardarVistaHistorialOffline(ambito: string, filas: readonly HistorialPOSFila[]): Promise<void> {
  await guardarOffline<VistaHistorialOffline>("config", claveVistaHistorial(ambito), {
    filas: [...filas],
    actualizadoEn: new Date().toISOString(),
  });
}

export async function leerVistaHistorialOffline(ambito: string): Promise<VistaHistorialOffline | undefined> {
  return leerOffline<VistaHistorialOffline>("config", claveVistaHistorial(ambito));
}

export async function leerMapaDetallesVentaOffline(ambito: string): Promise<MapaDetallesVentaCache> {
  return (await leerOffline<MapaDetallesVentaCache>("config", claveDetallesVenta(ambito))) ?? {};
}

export async function leerDetalleVentaOffline(
  ambito: string,
  facturaId: string,
): Promise<DetalleVentaCacheado | undefined> {
  const mapa = await leerMapaDetallesVentaOffline(ambito);
  return mapa[facturaId];
}

/**
 * Guarda el detalle junto a su ticket; si esta vez no hay ticket (por ejemplo,
 * la red cayó al imprimir) conserva el que ya estuviera guardado y no pierde
 * el detalle anterior. Mantiene solo los más recientes.
 *
 * Las escrituras se encadenan: la pre-descarga guarda varios tickets en
 * paralelo y cada una lee-modifica-escribe el mismo mapa; sin la cola, la
 * última en escribir borraría a las demás.
 */
let colaDetallesVenta: Promise<unknown> = Promise.resolve();

async function escribirDetalleVentaOffline(
  ambito: string,
  facturaId: string,
  datos: { detalle: DetalleVentaPOS; ticket: VentaPOSResultado | null; guardadoEn?: number },
): Promise<void> {
  const mapa = await leerMapaDetallesVentaOffline(ambito);
  const ticket = datos.ticket ?? mapa[facturaId]?.ticket ?? null;
  if (!ticket) return;

  const actualizado: MapaDetallesVentaCache = {
    ...mapa,
    [facturaId]: {
      detalle: datos.detalle,
      ticket,
      guardadoEn: datos.guardadoEn ?? Date.now(),
    },
  };
  await guardarOffline("config", claveDetallesVenta(ambito), recortarDetallesVentaCache(actualizado));
}

export async function guardarDetalleVentaOffline(
  ambito: string,
  facturaId: string,
  datos: { detalle: DetalleVentaPOS; ticket: VentaPOSResultado | null; guardadoEn?: number },
): Promise<void> {
  const tarea = colaDetallesVenta.then(() => escribirDetalleVentaOffline(ambito, facturaId, datos));
  colaDetallesVenta = tarea.catch(() => undefined);
  await tarea;
}

export async function guardarVistaTurnosOffline(
  ambito: string,
  vista: { vistaInicial: ResumenTurnoVista | null; cierres: readonly TurnoPOS[] },
): Promise<void> {
  await guardarOffline<VistaTurnosOffline>("config", claveVistaTurnos(ambito), {
    vistaInicial: vista.vistaInicial,
    cierres: [...vista.cierres],
    actualizadoEn: new Date().toISOString(),
  });
}

export async function leerVistaTurnosOffline(ambito: string): Promise<VistaTurnosOffline | undefined> {
  return leerOffline<VistaTurnosOffline>("config", claveVistaTurnos(ambito));
}

export async function guardarVistaPagosOffline(
  ambito: string,
  tipo: TipoMovimientoPOS,
  filas: readonly PagoPOSFila[],
): Promise<void> {
  await guardarOffline<VistaPagosOffline>("config", claveVistaPagos(ambito, tipo), {
    filas: [...filas],
    actualizadoEn: new Date().toISOString(),
  });
}

export async function leerVistaPagosOffline(
  ambito: string,
  tipo: TipoMovimientoPOS,
): Promise<VistaPagosOffline | undefined> {
  return leerOffline<VistaPagosOffline>("config", claveVistaPagos(ambito, tipo));
}

export async function guardarVistaDevolucionesOffline(
  ambito: string,
  filas: readonly DevolucionPOSFila[],
): Promise<void> {
  await guardarOffline<VistaDevolucionesOffline>("config", claveVistaDevoluciones(ambito), {
    filas: [...filas],
    actualizadoEn: new Date().toISOString(),
  });
}

export async function leerVistaDevolucionesOffline(ambito: string): Promise<VistaDevolucionesOffline | undefined> {
  return leerOffline<VistaDevolucionesOffline>("config", claveVistaDevoluciones(ambito));
}

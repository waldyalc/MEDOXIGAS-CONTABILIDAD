import type { Numeracion } from "@/lib/numeraciones/tipos";

import { guardarOffline, leerOffline } from "./almacen-offline";

/**
 * Numeración NCF consecutiva local para el POS local-first.
 *
 * El servidor (`_crear_factura_sin_impuestos`) genera cada NCF como
 * `prefijo || lpad(siguiente, 8, '0')`. Este módulo replica el mismo formato
 * en IndexedDB (`config` -> `${ambito}/ncf`) para que toda venta cobrada en
 * el dispositivo salga de inmediato con el siguiente comprobante real (p. ej.
 * `B0200000123`), sin folios `POS-LOCAL-*`.
 *
 * Regla de reconciliación (decisión de Waldy, 24-11-2026 — Opción A):
 * - En el mismo dispositivo nunca se repite un NCF ya asignado: el contador
 *   siempre toma `Math.max(numeracion.siguiente, guardado ?? 0)`.
 * - Si el servidor confirma un NCF más alto (porque otra caja o Contabilidad
 *   facturó en paralelo), el piso local salta automáticamente al siguiente libre
 *   y el historial muestra el NCF definitivo que devolvió el servidor.
 */

export type ContadoresNcfLocal = Record<string, number>;

export interface ReservaNcfLocal {
  ncf: string;
  secuenciaUsada: number;
  siguienteNuevo: number;
}

const LONGITUD_SECUENCIA_NCF = 8;

export function claveNcfLocal(ambito: string): string {
  return `${ambito}/ncf`;
}

/** Formato oficial RD: prefijo + 8 dígitos con ceros a la izquierda (igual que Postgres). */
export function formatearNcfLocal(prefijo: string, secuencia: number): string {
  const limpio = prefijo.trim();
  const digitos = Math.max(0, Math.trunc(secuencia));
  return `${limpio}${String(digitos).padStart(LONGITUD_SECUENCIA_NCF, "0")}`;
}

/** Extrae el número consecutivo de un NCF si coincide con el prefijo dado. */
export function parsearSecuenciaNcf(ncf: string | null | undefined, prefijo: string): number | null {
  if (!ncf || !prefijo) return null;
  const limpio = prefijo.trim();
  if (!ncf.startsWith(limpio)) return null;
  const cola = ncf.slice(limpio.length);
  if (!/^\d+$/.test(cola)) return null;
  const valor = Number.parseInt(cola, 10);
  return Number.isSafeInteger(valor) && valor > 0 ? valor : null;
}

/**
 * Calcula y valida el siguiente NCF local para una numeración.
 * Lanza un mensaje claro en español si la serie está inactiva, agotada o vencida.
 */
export function calcularReservaNcfLocal(
  numeracion: Pick<Numeracion, "prefijo" | "siguiente" | "hasta" | "vence" | "activa">,
  siguienteGuardado: number | undefined,
  fecha: string,
): ReservaNcfLocal {
  if (!numeracion.activa) {
    throw new Error(`La numeración ${numeracion.prefijo} está inactiva.`);
  }
  const secuenciaUsada = Math.max(numeracion.siguiente, siguienteGuardado ?? 0);
  if (numeracion.hasta !== null && secuenciaUsada > numeracion.hasta) {
    throw new Error(`La numeración ${numeracion.prefijo} está agotada.`);
  }
  if (numeracion.vence !== null && numeracion.vence < fecha) {
    throw new Error(`La numeración ${numeracion.prefijo} está vencida.`);
  }
  return {
    ncf: formatearNcfLocal(numeracion.prefijo, secuenciaUsada),
    secuenciaUsada,
    siguienteNuevo: secuenciaUsada + 1,
  };
}

/**
 * Combina contadores guardados con los valores actuales del servidor: nunca
 * retrocede por debajo de un NCF ya impreso en este dispositivo, pero sí
 * salta hacia adelante si el servidor avanzó más rápido.
 */
export function sincronizarContadoresNcfLocal(
  guardados: ContadoresNcfLocal | undefined,
  numeracionesServidor: readonly Pick<Numeracion, "id" | "siguiente">[],
): ContadoresNcfLocal {
  const resultado: ContadoresNcfLocal = { ...(guardados ?? {}) };
  for (const numeracion of numeracionesServidor) {
    const actual = resultado[numeracion.id] ?? 0;
    resultado[numeracion.id] = Math.max(actual, numeracion.siguiente);
  }
  return resultado;
}

/**
 * Reserva y persiste el siguiente NCF consecutivo en IndexedDB.
 * Debe llamarse dentro de `conBloqueoOffline(ambito, ...)` para serializar
 * escrituras entre pestañas del mismo navegador.
 */
export async function reservarNcfLocal(
  ambito: string,
  numeracion: Pick<Numeracion, "id" | "prefijo" | "siguiente" | "hasta" | "vence" | "activa">,
  fecha: string,
): Promise<ReservaNcfLocal> {
  const clave = claveNcfLocal(ambito);
  const contadores = (await leerOffline<ContadoresNcfLocal>("config", clave)) ?? {};
  const reserva = calcularReservaNcfLocal(numeracion, contadores[numeracion.id], fecha);
  await guardarOffline("config", clave, {
    ...contadores,
    [numeracion.id]: reserva.siguienteNuevo,
  });
  return reserva;
}

/** Actualiza el piso local tras recibir las numeraciones del servidor o un NCF confirmado. */
export async function actualizarPisoNcfLocal(
  ambito: string,
  numeracionesServidor: readonly Pick<Numeracion, "id" | "siguiente">[],
): Promise<void> {
  if (numeracionesServidor.length === 0) return;
  const clave = claveNcfLocal(ambito);
  const guardados = await leerOffline<ContadoresNcfLocal>("config", clave);
  const actualizados = sincronizarContadoresNcfLocal(guardados, numeracionesServidor);
  await guardarOffline("config", clave, actualizados);
}

/** Avanza el piso de una numeración si el servidor confirmó un NCF mayor al local. */
export async function registrarNcfConfirmadoLocal(
  ambito: string,
  numeracionId: string,
  prefijo: string,
  ncfConfirmado: string | null | undefined,
): Promise<void> {
  const secuencia = parsearSecuenciaNcf(ncfConfirmado, prefijo);
  if (secuencia === null) return;
  const clave = claveNcfLocal(ambito);
  const guardados = (await leerOffline<ContadoresNcfLocal>("config", clave)) ?? {};
  const siguienteConfirmado = secuencia + 1;
  if ((guardados[numeracionId] ?? 0) >= siguienteConfirmado) return;
  await guardarOffline("config", clave, {
    ...guardados,
    [numeracionId]: siguienteConfirmado,
  });
}

import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";

import type { OperacionOffline, ResultadoEnvioOffline } from "./cola-offline";
import { esquemaMovimientoTurno, esquemaVenta } from "./esquemas";
import { esquemasRpcPOS } from "./mapeo";
import { payloadVentaCompleta } from "./payload-venta";

/**
 * Clasificación de los errores de `pos_sincronizar_operacion`. Antes cualquier
 * `PGRST*` era transitorio (así `PGRST202`/`PGRST204` se reintentaban en bucle)
 * y `42501` era definitivo (una sesión vencida marcaba la venta como fallida).
 *
 * - `sesion` (`42501`, `PGRST301`, `PGRST302`): se refresca la sesión y se
 *   reintenta UNA vez; si no basta, la operación queda transitoria y avisada
 *   pidiendo login. `42501` es lo que levanta la RPC cuando `auth.uid()` es
 *   nulo (JWT vencido) o el perfil no es admin/contador.
 * - `transitorio` (se reintenta solo, con el backoff de la cola): sin código
 *   (red, timeout, respuesta perdida), `08*` (conexión), `53*` (recursos: sin
 *   conexiones, disco, memoria), `57P01`/`57P02`/`57P03` (apagado, reinicio, sin
 *   conexión), `57014` (consulta cancelada o `statement_timeout`), `40001`
 *   (serialization_failure), `40P01` (deadlock_detected), `55P03`
 *   (lock_not_available), `55006` (object_in_use) y `PGRST000`–`PGRST003`
 *   (PostgREST sin conexión o sin schema cache).
 * - `permanente` (rechazo real: se marca `fallida`, se conserva y se reintenta
 *   a mano desde el panel): `PGRST202` (RPC inexistente en el schema cache),
 *   `PGRST204` (columna inexistente), `22*` (datos inválidos, p. ej. `22023` de
 *   la propia RPC), `23*` (restricciones), `P0001` (`raise exception` de
 *   negocio), `42*` (SQL inválido o columna inexistente) y cualquier código
 *   desconocido: mejor mostrarlo que reintentar en bucle algo imposible.
 */
export type ClaseErrorOffline = "transitorio" | "permanente" | "sesion";

export function clasificarErrorOffline(codigo: string | null | undefined): ClaseErrorOffline {
  if (!codigo) return "transitorio";
  if (codigo === "42501" || codigo === "PGRST301" || codigo === "PGRST302") return "sesion";
  if (
    codigo.startsWith("08") ||
    codigo.startsWith("53") ||
    codigo.startsWith("PGRST00") ||
    codigo === "57P01" ||
    codigo === "57P02" ||
    codigo === "57P03" ||
    codigo === "57014" ||
    codigo === "40001" ||
    codigo === "40P01" ||
    codigo === "55P03" ||
    codigo === "55006"
  ) {
    return "transitorio";
  }
  return "permanente";
}

/**
 * ¿La operación se reintenta sola, sin pedir login? Un fallo de red o del
 * servidor se reintenta con el mismo UUID; un rechazo de negocio (validación
 * SQL, existencia, crédito) se marca fallido y se conserva para que el cajero
 * lo vea en el panel. Nunca se descarta la venta. La sesión se trata aparte
 * (`sesion`), porque primero se intenta refrescar y reintentar.
 */
export function errorTransitorio(codigo: string | null | undefined): boolean {
  return clasificarErrorOffline(codigo) === "transitorio";
}

/**
 * El transporte añade `sesionRequerida` cuando la sesión venció y el refresco
 * no bastó. La cola lo puede usar para pedir login sin perder la operación
 * (sigue `pendiente` y se reintenta sola); si lo ignora, el error igual se
 * muestra en el panel con el aviso.
 */
export type ResultadoTransporteOffline = ResultadoEnvioOffline & { sesionRequerida?: true };

export type TransporteOffline = (
  operacion: OperacionOffline,
  terminalId: string,
) => Promise<ResultadoTransporteOffline>;

type ClienteSupabase = ReturnType<typeof createClient>;

const SIN_CONFIRMACION = "No se recibió confirmación del servidor. Se reintentará con el mismo folio; no se duplica.";
const SESION_VENCIDA =
  "Tu sesión expiró o no tienes permiso en esta terminal. Vuelve a iniciar sesión; la operación quedó guardada y se reintentará sola.";

async function refrescarSesion(cliente: ClienteSupabase): Promise<boolean> {
  try {
    const { data, error } = await cliente.auth.refreshSession();
    return !error && data.session !== null;
  } catch {
    return false;
  }
}

/** Valida el payload guardado offline contra su esquema y lo adapta a la RPC. */
function prepararPayload(
  operacion: OperacionOffline,
  terminalId: string,
): { valido: true; payload: Json } | { valido: false; error: string } {
  if (operacion.tipo === "venta") {
    const validada = esquemaVenta.safeParse(operacion.payload);
    if (!validada.success) {
      return {
        valido: false,
        error: "La venta guardada no tiene el formato esperado. No se envió; revisa el folio en el panel.",
      };
    }
    if (validada.data.terminal_id !== terminalId) {
      return { valido: false, error: "La venta pertenece a otra terminal. No se envió." };
    }
    return { valido: true, payload: payloadVentaCompleta(validada.data) };
  }
  const validada = esquemaMovimientoTurno.safeParse(operacion.payload);
  if (!validada.success) {
    return {
      valido: false,
      error: "El movimiento guardado no tiene el formato esperado. No se envió; revisa el folio en el panel.",
    };
  }
  if (validada.data.turno_id !== operacion.turnoId) {
    return { valido: false, error: "El movimiento pertenece a otro turno. No se envió." };
  }
  return { valido: true, payload: validada.data };
}

export const transportarOperacionOffline: TransporteOffline = async (operacion, terminalId) => {
  const preparado = prepararPayload(operacion, terminalId);
  if (!preparado.valido) return { ok: false, transitorio: false, error: preparado.error };
  const payload = preparado.payload;

  try {
    const cliente = createClient();
    const argumentos = {
      p: {
        client_uuid: operacion.uuid,
        terminal_id: terminalId,
        turno_id: operacion.turnoId,
        tipo: operacion.tipo,
        payload,
      },
    };
    let respuesta = await cliente.rpc("pos_sincronizar_operacion", argumentos);
    if (respuesta.error && clasificarErrorOffline(respuesta.error.code) === "sesion") {
      if (await refrescarSesion(cliente)) {
        respuesta = await cliente.rpc("pos_sincronizar_operacion", argumentos);
      }
      if (respuesta.error && clasificarErrorOffline(respuesta.error.code) === "sesion") {
        return { ok: false, transitorio: true, sesionRequerida: true, error: SESION_VENCIDA };
      }
    }
    if (respuesta.error) {
      return {
        ok: false,
        transitorio: errorTransitorio(respuesta.error.code),
        error: respuesta.error.code ? mensajeErrorRpc(respuesta.error) : SIN_CONFIRMACION,
      };
    }
    const parseo =
      operacion.tipo === "venta"
        ? esquemasRpcPOS.venta.safeParse(respuesta.data)
        : esquemasRpcPOS.movimiento.safeParse(respuesta.data);
    return { ok: true, resultado: parseo.success ? parseo.data : respuesta.data };
  } catch {
    return { ok: false, transitorio: true, error: SIN_CONFIRMACION };
  }
};

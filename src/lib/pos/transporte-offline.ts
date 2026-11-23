import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";

import type { OperacionOffline, ResultadoEnvioOffline } from "./cola-offline";
import { esquemaMovimientoTurno, esquemaVenta } from "./esquemas";
import { esquemasRpcPOS } from "./mapeo";
import { payloadVentaCompleta } from "./payload-venta";

export type TransporteOffline = (operacion: OperacionOffline, terminalId: string) => Promise<ResultadoEnvioOffline>;

/**
 * Un fallo de red o del servidor se reintenta con el mismo UUID; un rechazo de
 * negocio (validación SQL, existencia, crédito) se marca fallido y se conserva
 * para que el cajero lo vea en el panel. Nunca se descarta la venta.
 */
export function errorTransitorio(codigo: string | null | undefined): boolean {
  if (!codigo) return true;
  return codigo.startsWith("PGRST") || codigo.startsWith("08") || codigo.startsWith("53") || codigo === "57014";
}

export const transportarOperacionOffline: TransporteOffline = async (operacion, terminalId) => {
  let payload: Json;
  if (operacion.tipo === "venta") {
    const validada = esquemaVenta.safeParse(operacion.payload);
    if (!validada.success) {
      return {
        ok: false,
        transitorio: false,
        error: "La venta guardada no tiene el formato esperado. No se envió; revisa el folio en el panel.",
      };
    }
    if (validada.data.terminal_id !== terminalId) {
      return { ok: false, transitorio: false, error: "La venta pertenece a otra terminal. No se envió." };
    }
    payload = payloadVentaCompleta(validada.data);
  } else {
    const validada = esquemaMovimientoTurno.safeParse(operacion.payload);
    if (!validada.success) {
      return {
        ok: false,
        transitorio: false,
        error: "El movimiento guardado no tiene el formato esperado. No se envió; revisa el folio en el panel.",
      };
    }
    if (validada.data.turno_id !== operacion.turnoId) {
      return { ok: false, transitorio: false, error: "El movimiento pertenece a otro turno. No se envió." };
    }
    payload = validada.data;
  }

  try {
    const { data, error } = await createClient().rpc("pos_sincronizar_operacion", {
      p: {
        client_uuid: operacion.uuid,
        terminal_id: terminalId,
        turno_id: operacion.turnoId,
        tipo: operacion.tipo,
        payload,
      },
    });
    if (error) {
      return {
        ok: false,
        transitorio: errorTransitorio(error.code),
        error: mensajeErrorRpc(error),
      };
    }
    const parseo =
      operacion.tipo === "venta" ? esquemasRpcPOS.venta.safeParse(data) : esquemasRpcPOS.movimiento.safeParse(data);
    return { ok: true, resultado: parseo.success ? parseo.data : data };
  } catch {
    return {
      ok: false,
      transitorio: true,
      error: "No se recibió confirmación del servidor. Se reintentará con el mismo folio; no se duplica.",
    };
  }
};

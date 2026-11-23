import type { OperacionOffline, ResultadoEnvioOffline } from "./cola-offline";

export type TransporteOffline = (operacion: OperacionOffline) => Promise<ResultadoEnvioOffline>;

export const transportarOperacionOffline: TransporteOffline = async () => ({
  ok: false,
  transitorio: false,
  error:
    "Sincronización no habilitada: falta validar la migración y generar los tipos de pos_sincronizar_operacion. La operación sigue guardada en este dispositivo.",
});

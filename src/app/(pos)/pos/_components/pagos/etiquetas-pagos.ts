import type { MotivoMovimientoPOS } from "@/lib/pos/tipos";

export const MOTIVOS_MOVIMIENTO: Record<MotivoMovimientoPOS, string> = {
  fondo_caja: "Fondo de caja",
  cobro_factura: "Cobro de factura",
  retiro_caja: "Retiro de caja",
  gasto_menor: "Gasto menor",
  deposito_banco: "Depósito al banco",
  otro: "Otro",
};

/** Motivos que admiten un recibo inverso de corrección (regla de Turnos). */
export const MOTIVOS_CON_INVERSO = new Set<MotivoMovimientoPOS>([
  "fondo_caja",
  "retiro_caja",
  "deposito_banco",
  "otro",
]);

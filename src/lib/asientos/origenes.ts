/**
 * Etiquetas legibles de `asientos.origen_tipo`. Es la lista completa del CHECK
 * de la base (migración `20261125130000_nomina_catalogos.sql`), compartida por
 * el listado y el detalle de asientos para que no se desincronicen.
 */
export const ETIQUETAS_DOCUMENTO: Record<string, string> = {
  factura: "Factura",
  pago_recibido: "Pago recibido",
  factura_proveedor: "Compra",
  pago_proveedor: "Pago a proveedor",
  gasto_menor: "Gasto",
  nota_credito_venta: "Nota de crédito",
  nota_credito_compra: "Nota de crédito de compra",
  nota_debito: "Nota de débito",
  transferencia: "Transferencia",
  deposito: "Depósito",
  conciliacion: "Conciliación",
  ajuste_inventario: "Ajuste de inventario",
  inventario_inicial: "Inventario inicial",
  manual: "Manual",
  anulacion: "Anulación",
  saldo_inicial: "Saldos iniciales",
  pos_movimiento: "Movimiento de caja POS",
  pos_diferencia: "Diferencia de cierre POS",
  nomina: "Nómina",
  pago_nomina: "Pago de nómina",
};

/** Etiqueta legible del origen; si la base trae uno desconocido, la clave cruda. */
export function etiquetaOrigen(tipo: string): string {
  return ETIQUETAS_DOCUMENTO[tipo] ?? tipo;
}

/**
 * Reglas del cliente con el que arranca toda venta nueva del POS.
 *
 * Alegra abre la factura con «Consumidor Final» ya elegido. Aquí el contacto
 * no se fija por id ni por migración: se busca por su RNC normalizado, así que
 * funciona igual en cualquier base donde exista ese contacto.
 */

export const RNC_CONSUMIDOR_FINAL = "22222222222";

/** Deja solo los dígitos: «222-2222222-2» y «22222222222» son el mismo RNC. */
export function normalizarRnc(rnc: string | null | undefined): string {
  return (rnc ?? "").replace(/\D/g, "");
}

/**
 * Cliente inicial de una venta: el Consumidor final si existe en la base; si
 * no, se conserva el contacto por defecto configurado en la terminal.
 */
export function contactoInicialPOS(consumidorFinalId: string | null, contactoTerminal: string): string {
  return consumidorFinalId ?? contactoTerminal;
}

/** El comprobante 01 (Crédito fiscal) exige un cliente con RNC. */
export function esComprobanteCreditoFiscal(tipoComprobante: string | null | undefined): boolean {
  return tipoComprobante === "01";
}

/** ¿La venta está a nombre del Consumidor final? */
export function esConsumidorFinalPOS(contactoId: string, consumidorFinalId: string | null): boolean {
  return consumidorFinalId !== null && contactoId === consumidorFinalId;
}

/**
 * Una pestaña restaurada sin líneas ni cotización es una venta nueva: vuelve
 * al cliente inicial. Una venta con líneas conserva el cliente que eligió el
 * cajero.
 */
export function contactoDePestanaRestaurada(
  pestana: { contactoId: string; lineas: readonly unknown[]; cotizacion: unknown | null },
  contactoInicial: string,
): string {
  return pestana.lineas.length === 0 && pestana.cotizacion === null ? contactoInicial : pestana.contactoId;
}

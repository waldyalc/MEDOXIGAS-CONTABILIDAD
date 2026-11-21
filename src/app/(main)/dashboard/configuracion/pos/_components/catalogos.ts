import type { EmpresaPOS, TerminalPOS } from "@/lib/pos/tipos";

/** Catálogos que la pantalla de terminales necesita para sus selectores. */
export interface CatalogosPos {
  almacenes: { id: string; nombre: string; es_principal: boolean }[];
  cuentas: { id: string; codigo: string; nombre: string }[];
  numeraciones: { id: string; nombre: string; tipo_comprobante: string; prefijo: string }[];
  listas: { id: string; nombre: string; es_principal: boolean }[];
  contactos: { id: string; nombre: string }[];
  centrosCosto: { id: string; codigo: string; nombre: string }[];
  empresa: EmpresaPOS | null;
}

/**
 * Cajones de efectivo que ya usa otra terminal activa. Una terminal activa no
 * puede compartir cajón: el arqueo de una contaminaría el de la otra.
 */
export function cajonesOcupados(terminales: readonly TerminalPOS[], terminalId: string | null): string[] {
  return terminales
    .filter((terminal) => terminal.activa && terminal.id !== terminalId)
    .map((terminal) => terminal.cuenta_efectivo_id);
}

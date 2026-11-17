import type { Numeracion } from "@/lib/numeraciones/tipos";

export interface OpcionTipoDocumento {
  readonly value: string;
  readonly label: string;
}

/**
 * Etiquetas de los tipos de comprobante que el sistema registra en
 * `numeraciones`. Es solo presentación: el valor que se filtra y se guarda es
 * el código (`01`, `02`, `03`, `04`, `13`, `14`, `15`, `16`).
 */
const ETIQUETAS: Record<string, string> = {
  "01": "01 Crédito fiscal",
  "02": "02 Consumo",
  "03": "03 Nota de débito",
  "04": "04 Nota de crédito",
  "13": "13 Gastos menores",
  "14": "14 Régimen especial",
  "15": "15 Gubernamental",
  "16": "16 Exportaciones",
};

export function etiquetaTipoDocumento(tipo: string): string {
  return ETIQUETAS[tipo] ?? tipo;
}

/** Opciones del filtro: solo los tipos que ya tienen numeración, sin repetir. */
export function opcionesTipoDocumento(numeraciones: readonly Numeracion[]): OpcionTipoDocumento[] {
  const vistos = new Set<string>();
  const opciones: OpcionTipoDocumento[] = [];

  for (const numeracion of numeraciones) {
    if (vistos.has(numeracion.tipo_comprobante)) continue;

    vistos.add(numeracion.tipo_comprobante);
    opciones.push({
      value: numeracion.tipo_comprobante,
      label: etiquetaTipoDocumento(numeracion.tipo_comprobante),
    });
  }

  return opciones;
}

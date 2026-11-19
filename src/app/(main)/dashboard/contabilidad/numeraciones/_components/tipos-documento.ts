import { type Numeracion, TIPO_SIN_NCF } from "@/lib/numeraciones/tipos";

export interface OpcionTipoDocumento {
  readonly value: string;
  readonly label: string;
}

/**
 * Etiquetas de los tipos de comprobante que el sistema registra en
 * `numeraciones`. Es solo presentación: el valor que se filtra y se guarda es
 * el código (`01`, `02`, `03`, `04`, `13`, `14`, `15`, `16`); `00` es una serie
 * sin NCF creada desde la pantalla.
 */
const ETIQUETAS: Record<string, string> = {
  "00": "Sin NCF",
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

/**
 * Tipos que se pueden dar de alta en «Nueva numeración»: los comprobantes
 * fiscales del sistema y «Sin NCF» (consecutivo libre con prefijo propio).
 */
export const OPCIONES_TIPO_NUEVA_NUMERACION: readonly OpcionTipoDocumento[] = [
  { value: "01", label: "B01 Crédito fiscal" },
  { value: "02", label: "B02 Consumo" },
  { value: "03", label: "B03 Nota de débito" },
  { value: "04", label: "B04 Nota de crédito" },
  { value: "13", label: "B13 Gastos menores" },
  { value: "14", label: "B14 Régimen especial" },
  { value: "15", label: "B15 Gubernamental" },
  { value: "16", label: "B16 Exportaciones" },
  { value: TIPO_SIN_NCF, label: "Sin NCF" },
];

/**
 * Prefijo fijo de un tipo fiscal (`B` + código). En «Sin NCF» no hay prefijo
 * fijo: el usuario lo escribe en el formulario.
 */
export function prefijoTipoDocumento(tipo: string): string {
  return tipo === TIPO_SIN_NCF ? "" : `B${tipo}`;
}

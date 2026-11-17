import { etiquetaTipoComprobante } from "@/lib/facturacion/comprobantes";
import type { TipoComprobante } from "@/lib/facturacion/tipos";
import { formatoDia } from "@/lib/formato";

import type { Numeracion } from "./tipos";

export type PrevisualizacionNcf = { estado: "lista"; ncf: string } | { estado: "no-disponible"; mensaje: string };

export interface EntradaPrevisualizacionNcf {
  numeraciones: readonly Numeracion[];
  tipo: TipoComprobante;
  /** Fecha ISO (aaaa-mm-dd) con la que se va a guardar la factura. */
  fecha: string;
}

function porId(a: Numeracion, b: Numeracion): number {
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/**
 * Formatea el consecutivo igual que `lpad(siguiente::text, 8, '0')` de la RPC
 * `crear_factura`: rellena con ceros a la izquierda y recorta a 8 si sobra.
 */
export function numeroConsecutivo(siguiente: number): string {
  const numero = String(siguiente);
  return numero.length > 8 ? numero.slice(0, 8) : numero.padStart(8, "0");
}

/**
 * Calcula el NCF que la RPC `crear_factura` asignaría hoy, sin reservarlo ni
 * aumentar la numeración. Replica la selección de la RPC: la numeración activa
 * del tipo con el `id` más bajo (la misma que bloquea con `for update`).
 *
 * Fuente: `supabase/migrations/20261115500000_funciones_fusionadas_s15.sql`.
 */
export function previsualizarNcf({ numeraciones, tipo, fecha }: EntradaPrevisualizacionNcf): PrevisualizacionNcf {
  const delTipo = numeraciones.filter((numeracion) => numeracion.tipo_comprobante === tipo);
  const activa = delTipo.filter((numeracion) => numeracion.activa).sort(porId)[0];
  const etiqueta = etiquetaTipoComprobante(tipo);

  if (!activa) {
    return {
      estado: "no-disponible",
      mensaje:
        delTipo.length === 0
          ? `No hay numeración configurada para ${etiqueta}.`
          : `La numeración de ${etiqueta} está inactiva.`,
    };
  }

  if (activa.hasta !== null && activa.siguiente > activa.hasta) {
    return {
      estado: "no-disponible",
      mensaje: `La numeración ${activa.prefijo} está agotada: llegó a su último número (${activa.hasta}).`,
    };
  }

  if (activa.vence !== null && activa.vence < fecha) {
    return {
      estado: "no-disponible",
      mensaje: `La numeración ${activa.prefijo} venció el ${formatoDia(activa.vence)}.`,
    };
  }

  return { estado: "lista", ncf: `${activa.prefijo}${numeroConsecutivo(activa.siguiente)}` };
}

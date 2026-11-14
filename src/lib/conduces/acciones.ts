"use server";

import type { ResultadoAccion } from "@/lib/cotizaciones/documentos";
import {
  convertirDocumentoNoContable,
  crearDocumentoNoContable,
  editarDocumentoNoContable,
} from "@/lib/cotizaciones/documentos";

export async function crearRemision(entrada: unknown): Promise<ResultadoAccion> {
  return crearDocumentoNoContable("remision", entrada);
}

export async function editarRemision(id: string, entrada: unknown): Promise<ResultadoAccion> {
  return editarDocumentoNoContable("remision", id, entrada);
}

export async function convertirRemisionAFactura(id: string, tipoComprobante: string): Promise<ResultadoAccion> {
  return convertirDocumentoNoContable("remision", id, tipoComprobante);
}

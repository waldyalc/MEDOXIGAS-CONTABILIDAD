"use server";

import type { ResultadoAccion } from "./documentos";
import { convertirDocumentoNoContable, crearDocumentoNoContable, editarDocumentoNoContable } from "./documentos";

export async function crearCotizacion(entrada: unknown): Promise<ResultadoAccion> {
  return crearDocumentoNoContable("cotizacion", entrada);
}

export async function editarCotizacion(id: string, entrada: unknown): Promise<ResultadoAccion> {
  return editarDocumentoNoContable("cotizacion", id, entrada);
}

export async function convertirCotizacionAFactura(id: string, tipoComprobante: string): Promise<ResultadoAccion> {
  return convertirDocumentoNoContable("cotizacion", id, tipoComprobante);
}

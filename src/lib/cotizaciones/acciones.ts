"use server";

import type { ResultadoAccion } from "./documentos";
import { convertirDocumentoNoContable, crearDocumentoNoContable } from "./documentos";

export async function crearCotizacion(entrada: unknown): Promise<ResultadoAccion> {
  return crearDocumentoNoContable("cotizacion", entrada);
}

export async function convertirCotizacionAFactura(id: string, tipoComprobante: string): Promise<ResultadoAccion> {
  return convertirDocumentoNoContable("cotizacion", id, tipoComprobante);
}

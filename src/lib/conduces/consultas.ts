import { getDocumentosLista, getDocumentoVista } from "@/lib/cotizaciones/consultas";
import type { DocumentoFila } from "@/lib/cotizaciones/tipos";
import type { OpcionesLista, ResultadoPagina } from "@/lib/listas/parametros";

export function getRemisionesLista(opciones?: OpcionesLista): Promise<ResultadoPagina<DocumentoFila>> {
  return getDocumentosLista("remision", opciones);
}

export function getRemisionVista(id: string) {
  return getDocumentoVista("remision", id);
}

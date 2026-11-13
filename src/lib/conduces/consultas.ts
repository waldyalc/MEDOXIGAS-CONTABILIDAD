import { getDocumentosLista, getDocumentoVista } from "@/lib/cotizaciones/consultas";

export function getRemisionesLista() {
  return getDocumentosLista("remision");
}

export function getRemisionVista(id: string) {
  return getDocumentoVista("remision", id);
}

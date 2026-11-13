import type { ContactoResumen, Empresa } from "@/lib/facturacion/tipos";

export type TipoDocumento = "cotizacion" | "remision";
export type EstadoDocumento = "abierta" | "convertida" | "anulada";

export interface DocumentoResumen {
  id: string;
  numero: number;
  contacto_id: string;
  fecha: string;
  vencimiento: string;
  total: number;
  estado: EstadoDocumento;
  factura_id: string | null;
}

export interface DocumentoFila extends DocumentoResumen {
  cliente_nombre: string;
}

export interface DocumentoDetalle extends DocumentoResumen {
  subtotal: number;
  descuento: number;
  itbis: number;
  notas: string | null;
}

export interface DocumentoLinea {
  id: string;
  producto_id: string | null;
  descripcion: string;
  cantidad: number;
  precio: number;
  descuento_pct: number;
  itbis_tasa: number;
  subtotal: number;
  itbis: number;
  total: number;
}

export interface DocumentoVista {
  documento: DocumentoDetalle;
  lineas: DocumentoLinea[];
  contacto: ContactoResumen;
  empresa: Empresa | null;
  facturaNumero: number | null;
}

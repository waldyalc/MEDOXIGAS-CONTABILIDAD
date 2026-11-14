import type { ContactoResumen, Empresa } from "@/lib/facturacion/tipos";
import type { Impuesto } from "@/lib/impuestos/tipos";

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
  otros_impuestos: number;
  propina: number;
  notas: string | null;
  terminos: string | null;
  vendedor_id: string | null;
  centro_costo_id: string | null;
  remision_id?: string | null;
  cotizacion_id?: string | null;
}

export interface DocumentoLinea {
  id: string;
  producto_id: string | null;
  descripcion: string;
  cantidad: number;
  precio: number;
  descuento_pct: number;
  itbis_tasa: number;
  impuesto_id: string | null;
  subtotal: number;
  itbis: number;
  total: number;
}

export interface FacturaRelacionada {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  total: number;
  estado: string;
}

export interface DocumentoRelacionado {
  id: string;
  numero: number;
  fecha: string;
  total: number;
  estado: string;
}

export interface DocumentoVista {
  documento: DocumentoDetalle;
  lineas: DocumentoLinea[];
  impuestos: Impuesto[];
  contacto: ContactoResumen;
  empresa: Empresa | null;
  facturaRelacionada: FacturaRelacionada | null;
  cotizacionOrigen: DocumentoRelacionado | null;
  remisionRelacionada: DocumentoRelacionado | null;
}

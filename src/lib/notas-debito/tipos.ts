import type { ContactoResumen, Empresa, ProductoResumen } from "@/lib/facturacion/tipos";

export type TipoNotaDebito = "texto" | "montos";
export type EstadoNotaDebito = "activa" | "anulada";

export const TIPOS_NOTA_DEBITO: readonly { valor: TipoNotaDebito; etiqueta: string }[] = [
  { valor: "texto", etiqueta: "Corrige texto del comprobante fiscal modificado" },
  { valor: "montos", etiqueta: "Corrige montos del NCF modificado" },
];

export function etiquetaTipoNotaDebito(tipo: string): string {
  return TIPOS_NOTA_DEBITO.find((opcion) => opcion.valor === tipo)?.etiqueta ?? "—";
}

export interface NotaDebitoLista {
  id: string;
  numero: number;
  ncf: string;
  fecha: string;
  tipo: TipoNotaDebito;
  total: number;
  estado: EstadoNotaDebito;
  factura_id: string;
  contacto_id: string;
  cliente_nombre: string;
  factura_numero: number;
  factura_ncf: string | null;
}

export interface NotaDebitoLinea {
  id: string;
  producto_id: string | null;
  productos: { nombre: string } | null;
  descripcion: string;
  cantidad: number;
  precio: number;
  descuento_pct: number;
  itbis_tasa: number;
  subtotal: number;
  itbis: number;
  total: number;
}

export interface NotaDebitoVista {
  id: string;
  numero: number;
  ncf: string;
  tipo: TipoNotaDebito;
  fecha: string;
  subtotal: number;
  descuento: number;
  itbis: number;
  total: number;
  estado: EstadoNotaDebito;
  notas: string | null;
  asiento_id: string | null;
  factura_id: string;
  contacto_id: string;
  cliente_nombre: string;
  factura_numero: number;
  factura_ncf: string | null;
  lineas: NotaDebitoLinea[];
}

export interface FacturaParaNotaDebito {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  total: number;
  estado: string;
  contacto_id: string;
}

export interface DatosFormularioNotaDebito {
  empresa: Empresa | null;
  contactos: ContactoResumen[];
  productos: ProductoResumen[];
  facturas: FacturaParaNotaDebito[];
}

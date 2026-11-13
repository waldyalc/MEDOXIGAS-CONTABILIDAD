export type EstadoFactura = "abierta" | "pagada" | "anulada";
export type EstadoDocumento = "activo" | "anulado";

export const TIPOS_COMPROBANTE = ["01", "02", "14", "15", "16"] as const;
export type TipoComprobante = (typeof TIPOS_COMPROBANTE)[number];

export interface Empresa {
  id: number;
  nombre: string;
  rnc: string | null;
  direccion: string | null;
  telefono: string | null;
  correo: string | null;
  logo_url: string | null;
}

export interface ContactoResumen {
  id: string;
  nombre: string;
  rnc_cedula: string | null;
  direccion: string | null;
  telefono?: string | null;
  lista_precio_id?: string | null;
}

export interface ProductoResumen {
  id: string;
  nombre: string;
  referencia: string | null;
  precio: number;
  itbis_tasa: number;
  precios: { lista_id: string; precio: number }[];
}

export interface ListaPrecioResumen {
  id: string;
  nombre: string;
  es_principal: boolean;
  tipo: "fijo" | "porcentaje";
}

export interface CuentaCajaBanco {
  id: string;
  codigo: string;
  nombre: string;
}

export interface FacturaLista {
  id: string;
  numero: number;
  ncf: string | null;
  tipo_comprobante: string;
  contacto_id: string;
  fecha: string;
  vencimiento: string;
  total: number;
  pagado: number;
  credito: number;
  estado: EstadoFactura;
}

export interface FacturaDetalle extends FacturaLista {
  subtotal: number;
  descuento: number;
  itbis: number;
  notas: string | null;
  terminos: string | null;
  pie: string | null;
  asiento_id: string | null;
}

export interface FacturaLinea {
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

export interface AsientoResumen {
  id: string;
  numero: number;
  fecha: string;
  descripcion: string;
}

export interface AsientoLineaVista {
  id: string;
  cuenta_id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  debito: number;
  credito: number;
}

export interface AsientoVista {
  asiento: AsientoResumen | null;
  lineas: AsientoLineaVista[];
}

export type MetodoPagoVista = "efectivo" | "transferencia" | "tarjeta" | "cheque";

export interface PagoFacturaVista {
  id: string;
  numero: number;
  fecha: string;
  metodo: MetodoPagoVista;
  monto: number;
  estado: EstadoDocumento;
}

export interface FacturaVista {
  factura: FacturaDetalle;
  lineas: FacturaLinea[];
  contacto: ContactoResumen;
  empresa: Empresa | null;
  asiento: AsientoVista;
  ncfVence: string | null;
  pagos: PagoFacturaVista[];
}

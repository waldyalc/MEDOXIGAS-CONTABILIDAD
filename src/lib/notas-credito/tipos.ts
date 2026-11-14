export type EstadoNotaCredito = "activa" | "anulada";

export interface NotaCreditoLista {
  id: string;
  numero: number;
  ncf: string;
  fecha: string;
  total: number;
  estado: EstadoNotaCredito;
  factura_id: string;
  contacto_id: string;
  cliente_nombre: string;
  factura_numero: number;
  factura_ncf: string | null;
}

export interface NotaCreditoLinea {
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

export interface NotaCreditoVista {
  id: string;
  numero: number;
  ncf: string;
  fecha: string;
  subtotal: number;
  itbis: number;
  total: number;
  devuelve_inventario: boolean;
  estado: EstadoNotaCredito;
  notas: string | null;
  asiento_id: string | null;
  factura_id: string;
  contacto_id: string;
  cliente_nombre: string;
  factura_numero: number;
  factura_ncf: string | null;
  lineas: NotaCreditoLinea[];
}

export interface FacturaParaNota {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  total: number;
  pagado: number;
  credito: number;
  retenido: number;
  estado: string;
  contacto_id: string;
  cliente_nombre: string;
}

export interface LineaAcreditable {
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
  acreditado: number;
  pendiente: number;
}

export interface DatosFormularioNota {
  factura: FacturaParaNota;
  lineas: LineaAcreditable[];
}

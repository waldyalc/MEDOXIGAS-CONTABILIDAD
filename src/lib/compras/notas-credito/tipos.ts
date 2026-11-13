export type EstadoNotaCreditoCompra = "activa" | "anulada";

export interface NotaCreditoCompraLista {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  total: number;
  estado: EstadoNotaCreditoCompra;
  factura_proveedor_id: string;
  contacto_id: string;
  proveedor_nombre: string;
  factura_numero: number;
  factura_ncf: string | null;
}

export interface NotaCreditoCompraLinea {
  id: string;
  descripcion: string;
  cantidad: number;
  costo: number;
  itbis_tasa: number;
  subtotal: number;
  itbis: number;
  total: number;
}

export interface NotaCreditoCompraVista {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  subtotal: number;
  itbis: number;
  total: number;
  devuelve_inventario: boolean;
  estado: EstadoNotaCreditoCompra;
  notas: string | null;
  asiento_id: string | null;
  factura_proveedor_id: string;
  contacto_id: string;
  proveedor_nombre: string;
  factura_numero: number;
  factura_ncf: string | null;
  lineas: NotaCreditoCompraLinea[];
  asiento: AsientoNota | null;
  lineasAsiento: LineaAsientoNota[];
}

export interface AsientoNota {
  id: string;
  numero: number;
  fecha: string;
  descripcion: string;
  total: number;
}

export interface LineaAsientoNota {
  id: string;
  cuenta_id: string;
  descripcion: string;
  debito: number;
  credito: number;
  cuentas: { codigo: string; nombre: string } | null;
}

export interface FacturaParaNotaCompra {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  total: number;
  pagado: number;
  credito: number;
  estado: string;
  contacto_id: string;
  proveedor_nombre: string;
}

export interface LineaAcreditableCompra {
  id: string;
  producto_id: string | null;
  cuenta_id: string | null;
  descripcion: string;
  cantidad: number;
  costo: number;
  itbis_tasa: number;
  subtotal: number;
  itbis: number;
  total: number;
  acreditado: number;
  pendiente: number;
}

export interface DatosFormularioNotaCompra {
  factura: FacturaParaNotaCompra;
  lineas: LineaAcreditableCompra[];
}

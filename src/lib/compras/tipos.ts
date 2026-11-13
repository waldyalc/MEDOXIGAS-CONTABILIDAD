export type EstadoDocumento = "abierta" | "pagada" | "anulada";

export type MetodoPago = "efectivo" | "transferencia" | "tarjeta" | "cheque";

export interface ContactoResumen {
  nombre: string;
}

export interface ContactoOpcion {
  id: string;
  nombre: string;
  rnc_cedula: string | null;
}

export interface ProductoOpcion {
  id: string;
  nombre: string;
  referencia: string | null;
  costo: number;
  precio: number;
  itbis_tasa: number;
  inventariable: boolean;
  tipo: "producto" | "servicio";
}

export interface CuentaOpcion {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  es_caja_banco: boolean;
}

export interface CuentaAsiento {
  codigo: string;
  nombre: string;
}

export interface FacturaLista {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  vencimiento: string;
  total: number;
  pagado: number;
  estado: EstadoDocumento;
  contactos: ContactoResumen | null;
}

export interface FacturaDetalle {
  id: string;
  numero: number;
  ncf: string | null;
  contacto_id: string;
  fecha: string;
  vencimiento: string;
  subtotal: number;
  itbis: number;
  total: number;
  pagado: number;
  estado: EstadoDocumento;
  notas: string | null;
  asiento_id: string | null;
  contactos: { nombre: string; rnc_cedula: string | null } | null;
}

export interface LineaDetalle {
  id: string;
  descripcion: string;
  cantidad: number;
  costo: number;
  itbis_tasa: number;
  subtotal: number;
  itbis: number;
  total: number;
  producto_id: string | null;
  cuenta_id: string | null;
  productos: { nombre: string } | null;
  cuentas: { codigo: string; nombre: string } | null;
}

export interface AsientoDetalle {
  id: string;
  numero: number;
  fecha: string;
  descripcion: string;
  total: number;
}

export interface AsientoLinea {
  id: string;
  descripcion: string;
  debito: number;
  credito: number;
  cuentas: CuentaAsiento | null;
}

export interface FacturaAbierta {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  vencimiento: string;
  total: number;
  pagado: number;
  contacto_id: string;
  contactos: ContactoResumen | null;
}

export interface PagoLista {
  id: string;
  numero: number;
  fecha: string;
  metodo: MetodoPago;
  monto: number;
  estado: "activo" | "anulado";
  contactos: ContactoResumen | null;
  cuentas: { nombre: string } | null;
  facturas_proveedor: { id: string; numero: number; ncf: string | null } | null;
}

export interface OpcionesFactura {
  contactos: ContactoOpcion[];
  productos: ProductoOpcion[];
  cuentasGasto: CuentaOpcion[];
}

export interface OpcionesPago {
  contactos: ContactoOpcion[];
  cuentasCajaBanco: CuentaOpcion[];
  facturasAbiertas: FacturaAbierta[];
}

export interface DetalleFacturaCompleto {
  factura: FacturaDetalle;
  lineas: LineaDetalle[];
  asiento: AsientoDetalle | null;
  lineasAsiento: AsientoLinea[];
}

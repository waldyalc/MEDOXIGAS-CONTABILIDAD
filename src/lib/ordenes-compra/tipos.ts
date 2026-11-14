import type { ContactoOpcion, CuentaOpcion, ProductoOpcion } from "@/lib/compras/tipos";

export type EstadoOrdenCompra = "abierta" | "convertida" | "anulada";

export interface OrdenCompraLista {
  id: string;
  numero: number;
  contacto_id: string;
  fecha: string;
  fecha_entrega: string;
  total: number;
  estado: EstadoOrdenCompra;
  factura_proveedor_id: string | null;
  contacto_nombre: string;
}

export interface OrdenCompraLinea {
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
  productos: { nombre: string } | null;
  cuentas: { codigo: string; nombre: string } | null;
}

export interface OrdenCompraVista {
  id: string;
  numero: number;
  contacto_id: string;
  fecha: string;
  fecha_entrega: string;
  subtotal: number;
  itbis: number;
  total: number;
  notas: string | null;
  terminos: string | null;
  estado: EstadoOrdenCompra;
  factura_proveedor_id: string | null;
  contacto_nombre: string;
  lineas: OrdenCompraLinea[];
}

import type { Impuesto } from "@/lib/impuestos/tipos";

export interface OpcionesOrden {
  contactos: ContactoOpcion[];
  productos: ProductoOpcion[];
  cuentasGasto: CuentaOpcion[];
  impuestos: Impuesto[];
}

export interface LineaInicialFactura {
  producto_id: string;
  cuenta_id: string;
  descripcion: string;
  cantidad: number;
  costo: number;
  impuesto_id: string | null;
  itbis_tasa: number;
}

export interface InicialFacturaDesdeOrden {
  contacto_id: string;
  fecha: string;
  vencimiento: string;
  ncf: string;
  notas: string;
  lineas: LineaInicialFactura[];
}

export interface OrdenParaFactura {
  ordenId: string;
  numero: number;
  inicial: InicialFacturaDesdeOrden;
}

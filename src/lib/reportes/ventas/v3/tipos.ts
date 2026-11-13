export type FiltroVencimiento = "todas" | "sin-vencer" | "1-30" | "31-60" | "61-90" | "91-mas";

export interface FilaVentaCliente {
  facturaId: string;
  contactoId: string;
  contactoNombre: string;
  subtotal: number | string | null;
  descuento: number | string | null;
  itbis: number | string | null;
  total: number | string | null;
}

export interface ClienteVentas {
  contactoId: string;
  contactoNombre: string;
  numeroVentas: number;
  subtotal: number;
  descuentos: number;
  devoluciones: number;
  antesImpuestos: number;
  impuestos: number;
  despuesImpuestos: number;
}

export interface TotalesVentas {
  numeroVentas: number;
  subtotal: number;
  descuentos: number;
  devoluciones: number;
  antesImpuestos: number;
  impuestos: number;
  despuesImpuestos: number;
}

export interface ResumenVentasCliente {
  clientes: ClienteVentas[];
  totales: TotalesVentas;
}

export interface FilaEstadoCuenta {
  facturaId: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  vencimiento: string;
  total: number | string | null;
  cobrado: number | string | null;
}

export interface DocumentoEstadoCuenta {
  facturaId: string;
  documento: string;
  creacion: string;
  vencimiento: string;
  antiguedad: number;
  diasVencidos: number;
  estado: "Pendiente" | "Cobrada";
  moneda: "DOP";
  total: number;
  retenido: number;
  cobrado: number;
  saldo: number;
}

export interface TotalesEstadoCuenta {
  totalVentas: number;
  retenciones: number;
  totalCobrado: number;
  saldoPorCobrar: number;
}

export interface FilaVentaVendedor {
  vendedor: string | null;
  subtotal: number | string | null;
  itbis: number | string | null;
  total: number | string | null;
}

export interface VendedorVentas {
  vendedor: string;
  numeroVentas: number;
  antesImpuestos: number;
  impuestos: number;
  despuesImpuestos: number;
}

export interface ClienteOpcion {
  id: string;
  nombre: string;
}

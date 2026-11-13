export type Periodicidad = "diario" | "mensual";

export type EstadoVenta = "abierta" | "pagada" | "anulada";

export interface FacturaVenta {
  id: string;
  numero: number;
  ncf: string | null;
  tipo_comprobante: string;
  contacto_id: string;
  fecha: string;
  subtotal: number | string;
  descuento: number | string;
  itbis: number | string;
  total: number | string;
  pagado: number | string;
  estado: string;
}

export interface NumeracionOpcion {
  tipo_comprobante: string;
  nombre: string;
  prefijo: string;
}

export interface VentaCalculada {
  id: string;
  numero: number;
  ncf: string;
  tipoComprobante: string;
  contactoId: string;
  clienteNombre: string;
  estado: EstadoVenta;
  estadoEtiqueta: string;
  fecha: string;
  subtotal: number;
  descuento: number;
  antesImpuestos: number;
  impuestos: number;
  despuesImpuestos: number;
}

export interface TotalesVentas {
  ventasBrutas: number;
  notasCredito: number;
  antesImpuestos: number;
  impuestos: number;
  despuesImpuestos: number;
}

export interface PuntoSerieVentas {
  clave: string;
  etiqueta: string;
  total: number;
}

export interface FiltrosVentas {
  tipoComprobante: string;
  busqueda: string;
}

export interface FiltrosVentasUrl extends FiltrosVentas {
  almacen: string;
  pagina: number;
  grafico: Periodicidad;
}

export interface PaginaVentas {
  filas: VentaCalculada[];
  pagina: number;
  totalPaginas: number;
  totalFilas: number;
}

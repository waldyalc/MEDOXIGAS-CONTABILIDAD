export interface LineaVenta {
  productoId: string | null;
  nombre: string;
  referencia: string | null;
  cantidad: number | string | null;
  subtotal: number | string | null;
  total: number | string | null;
  costoUnitario: number | string | null;
}

export interface FilaVentaProducto {
  clave: string;
  productoId: string | null;
  nombre: string;
  referencia: string | null;
  cantidad: number;
  antes: number;
  despues: number;
}

export interface TotalesVentas {
  cantidad: number;
  antes: number;
  despues: number;
}

export interface FilaRentabilidadProducto {
  clave: string;
  productoId: string | null;
  nombre: string;
  referencia: string | null;
  totalVendido: number;
  costoTotal: number;
  rentabilidad: number;
  porcentaje: number;
}

export interface TotalesRentabilidad {
  totalVendido: number;
  costoTotal: number;
  rentabilidad: number;
}

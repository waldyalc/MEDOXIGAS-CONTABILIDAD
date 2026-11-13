export function urlContacto(id: string): string {
  return `/dashboard/contactos/${id}`;
}

export function urlProducto(id: string): string {
  return `/dashboard/productos/${id}`;
}

export function urlFacturaVenta(id: string): string {
  return `/dashboard/facturacion/${id}`;
}

export function urlFacturaProveedor(id: string): string {
  return `/dashboard/compras/${id}`;
}

export function urlPagoProveedor(id: string): string {
  return `/dashboard/compras/pagos/${id}`;
}

export function urlPagoRecibido(id: string): string {
  return `/dashboard/pagos-recibidos/${id}`;
}

export function urlGastoMenor(id: string): string {
  return `/dashboard/gastos/${id}`;
}

export function urlMovimientosCuenta(codigo: string, desde: string, hasta: string): string {
  const parametros = new URLSearchParams({ cuenta: codigo, desde, hasta });
  return `/dashboard/reportes/movimientos-cuenta?${parametros.toString()}`;
}

export interface ParametrosUrlVentas {
  desde: string;
  hasta: string;
  busqueda?: string;
  pagina?: number;
}

export function urlVentasProducto(parametros: ParametrosUrlVentas): string {
  const busqueda = parametros.busqueda?.trim();
  const consulta = new URLSearchParams({ desde: parametros.desde, hasta: parametros.hasta });

  if (busqueda !== undefined && busqueda !== "") {
    consulta.set("q", busqueda);
  }

  if (parametros.pagina !== undefined && parametros.pagina > 1) {
    consulta.set("pagina", String(parametros.pagina));
  }

  return `/dashboard/reportes/ventas-producto?${consulta.toString()}`;
}

export function urlRentabilidadProducto(parametros: { desde: string; hasta: string; pagina?: number }): string {
  const consulta = new URLSearchParams({ desde: parametros.desde, hasta: parametros.hasta });

  if (parametros.pagina !== undefined && parametros.pagina > 1) {
    consulta.set("pagina", String(parametros.pagina));
  }

  return `/dashboard/reportes/rentabilidad-producto?${consulta.toString()}`;
}

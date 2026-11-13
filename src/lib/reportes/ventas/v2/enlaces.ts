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

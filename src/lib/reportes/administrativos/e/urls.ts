export const URL_REGISTRAR_VENTA = "/dashboard/facturacion/nueva";

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

export function urlMovimientosCuenta(cuenta: string, desde: string, hasta: string): string {
  const parametros = new URLSearchParams({ cuenta, desde, hasta });
  return `/dashboard/reportes/movimientos-cuenta?${parametros.toString()}`;
}

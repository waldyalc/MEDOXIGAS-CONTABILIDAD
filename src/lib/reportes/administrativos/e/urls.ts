export const URL_REGISTRAR_VENTA = "/dashboard/facturacion/nueva";

export function urlMovimientosCuenta(cuenta: string, desde: string, hasta: string): string {
  const parametros = new URLSearchParams({ cuenta, desde, hasta });
  return `/dashboard/reportes/movimientos-cuenta?${parametros.toString()}`;
}

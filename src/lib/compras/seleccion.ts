import { aNumero } from "./calculo";
import type { CuentaOpcion, FacturaAbierta } from "./tipos";

const CODIGO_BANCO_PRINCIPAL = "1102";

export function saldoFactura(factura: Pick<FacturaAbierta, "total" | "pagado" | "credito">): number {
  return Math.round((aNumero(factura.total) - aNumero(factura.pagado) - aNumero(factura.credito)) * 100) / 100;
}

export function facturasAbiertasDeProveedor(
  facturas: readonly FacturaAbierta[],
  proveedorId: string,
): FacturaAbierta[] {
  if (!proveedorId) return [];
  return facturas.filter((factura) => factura.contacto_id === proveedorId && saldoFactura(factura) > 0);
}

export function elegirCuentaPagoPorDefecto(cuentas: readonly CuentaOpcion[]): string {
  const bancoPrincipal = cuentas.find((cuenta) => cuenta.codigo === CODIGO_BANCO_PRINCIPAL);
  return (bancoPrincipal ?? cuentas[0])?.id ?? "";
}

import { centavos } from "../../dinero";
import type { FilaVentaVendedor, VendedorVentas } from "./tipos";

/** Agrupa por vendedor. Las filas sin vendedor se ignoran hasta que exista el campo. */
export function agruparPorVendedor(filas: readonly FilaVentaVendedor[]): VendedorVentas[] {
  const porVendedor = new Map<string, VendedorVentas>();

  for (const fila of filas) {
    const vendedor = fila.vendedor?.trim();
    if (vendedor == null || vendedor === "") continue;

    let grupo = porVendedor.get(vendedor);

    if (grupo == null) {
      grupo = {
        vendedor,
        numeroVentas: 0,
        antesImpuestos: 0,
        impuestos: 0,
        despuesImpuestos: 0,
      };
      porVendedor.set(vendedor, grupo);
    }

    const neto = centavos(fila.subtotal);
    grupo.numeroVentas += 1;
    grupo.antesImpuestos += neto;
    grupo.impuestos += centavos(fila.itbis);
    grupo.despuesImpuestos += centavos(fila.total);
  }

  return [...porVendedor.values()].sort(
    (a, b) => b.despuesImpuestos - a.despuesImpuestos || a.vendedor.localeCompare(b.vendedor, "es"),
  );
}

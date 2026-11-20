import { parsearCentavos } from "@/lib/facturacion/calculo";

import type { ProductoInventario } from "./tipos";
import type { TipoAjuste } from "./validacion";

/** En la salida Alegra bloquea el costo: se usa siempre el promedio vigente. */
export function bloqueaCosto(tipo: TipoAjuste): boolean {
  return tipo === "salida";
}

/**
 * Costo con el que queda la línea al elegir producto o cambiar el tipo. La
 * entrada conserva lo que el usuario escribió; la salida toma el costo
 * promedio del producto y se bloquea.
 */
export function costoDeLinea(tipo: TipoAjuste, producto: ProductoInventario | null, actual = ""): string {
  if (!bloqueaCosto(tipo)) return actual;
  return producto ? String(producto.costo) : "";
}

/** Costo en centavos que se valida y se envía: la salida ignora el costo tecleado. */
export function costoCentavosDeLinea(
  tipo: TipoAjuste,
  producto: ProductoInventario | null,
  costo: string,
): number | null {
  if (bloqueaCosto(tipo)) return producto ? parsearCentavos(producto.costo) : null;
  return parsearCentavos(costo);
}

import { formatoCantidad } from "@/lib/facturacion/formato";

/**
 * Modelo de las líneas del conteo físico en pantalla. Las cantidades se
 * comparan en centésimas enteras (nunca con floats guardados) y el texto que
 * escribe la persona se conserva para enviarlo como decimal a la RPC; el
 * servidor vuelve a validar con `conteoLineaSchema`.
 */

export interface ProductoConteo {
  id: string;
  nombre: string;
  referencia: string | null;
  /** Existencia del almacén en el momento de buscar, como texto decimal. */
  stock: string;
}

export type RespuestaProductosConteo = { ok: true; productos: ProductoConteo[] } | { ok: false; error: string };

export interface LineaConteoFormulario {
  producto_id: string;
  nombre: string;
  referencia: string | null;
  /** Cantidad del sistema (solo lectura), texto decimal tal como llega. */
  sistema: string;
  /** Lo que escribe la persona; se envía como texto decimal. */
  contada: string;
  nota: string;
}

export interface TotalesConteo {
  lineas: number;
  conDiferencia: number;
  entradasCentavos: number;
  /** Negativo: las salidas se restan. */
  salidasCentavos: number;
  diferenciaCentavos: number;
}

/**
 * ``12``, ``12.5`` o ``12,5`` → 1250. Vacío o inválido → ``null``.
 * La cantidad 0 sí es válida en un conteo; por eso no se reutiliza
 * ``parsearCantidad`` (devuelve 0 para todo lo inválido).
 */
export function cantidadACentavos(valor: string): number | null {
  const limpio = valor.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;

  const [entero = "0", fraccion = ""] = limpio.split(".");
  const centavos = Number(entero) * 100 + Number(fraccion.padEnd(2, "0"));
  return Number.isFinite(centavos) ? centavos : null;
}

/** Centésimas → texto decimal con dos posiciones, como lo espera la RPC. */
export function centavosADecimal(centavos: number): string {
  const seguro = Math.max(0, Math.round(centavos));
  return `${Math.trunc(seguro / 100)}.${String(seguro % 100).padStart(2, "0")}`;
}

/** `numeric` de Postgres → centésimas enteras (acepta negativos). */
export function decimalACentavos(valor: string): number {
  const limpio = valor.trim();
  const negativo = limpio.startsWith("-");
  const [entero = "0", fraccion = ""] = limpio.replace("-", "").split(".");
  const centavos = Number(entero) * 100 + Number(fraccion.padEnd(2, "0").slice(0, 2));

  if (!Number.isFinite(centavos)) return 0;
  return negativo ? -centavos : centavos;
}

/** Diferencia (contada − sistema) en centésimas; `null` si la contada no es válida. */
export function diferenciaCentavos(linea: LineaConteoFormulario): number | null {
  const contada = cantidadACentavos(linea.contada);
  if (contada === null) return null;

  return contada - decimalACentavos(linea.sistema);
}

export function totalesConteo(lineas: readonly LineaConteoFormulario[]): TotalesConteo {
  let conDiferencia = 0;
  let entradasCentavos = 0;
  let salidasCentavos = 0;

  for (const linea of lineas) {
    const diferencia = diferenciaCentavos(linea);
    if (diferencia === null || diferencia === 0) continue;

    conDiferencia += 1;
    if (diferencia > 0) entradasCentavos += diferencia;
    else salidasCentavos += diferencia;
  }

  return {
    lineas: lineas.length,
    conDiferencia,
    entradasCentavos,
    salidasCentavos,
    diferenciaCentavos: entradasCentavos + salidasCentavos,
  };
}

/** ``+12.5`` / ``-3`` / ``0`` con el formato es-DO de las cantidades. */
export function textoDiferencia(centavos: number): string {
  if (centavos === 0) return "0";
  const signo = centavos > 0 ? "+" : "-";
  return `${signo}${formatoCantidad(Math.abs(centavos) / 100)}`;
}

/** Color de la diferencia: verde entra, rojo sale, gris sin cambio o sin dato. */
export function claseDiferencia(centavos: number | null): string {
  if (centavos === null || centavos === 0) return "text-muted-foreground";
  return centavos > 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400";
}

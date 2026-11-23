import type { FilaReporte } from "./tipos";

const MONTO = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Monto sin símbolo de moneda, como en el resumen de Alegra ("17,940.00"). */
function monto(valorEnCentavos: number): string {
  return MONTO.format(Math.abs(valorEnCentavos) / 100);
}

/**
 * Párrafo de la tarjeta «Resumen» del estado de resultados, con el mismo
 * patrón de redacción que genera Alegra a partir de los totales del reporte.
 */
export function generarResumenResultados(filas: readonly FilaReporte[]): string {
  const buscar = (clave: string): FilaReporte | undefined => filas.find((fila) => fila.clave === clave);
  const ingresos = buscar("seccion-ingresos");
  const costos = buscar("seccion-costos");
  const bruta = buscar("total-utilidad-bruta");
  const neta = buscar("total-utilidad-neta");

  if (ingresos == null || bruta == null || neta == null) return "";

  const direccion = ingresos.variacionAbsoluta >= 0 ? "incremento" : "decremento";
  const sinAnterior = ingresos.anterior === 0 ? ", donde no se registraron ingresos" : "";
  const fraseNeta =
    neta.actual >= 0
      ? `La utilidad neta fue de ${monto(neta.actual)}.`
      : `Sin embargo, los gastos totales superaron los ingresos, resultando en una pérdida neta de ${monto(neta.actual)}, indicando un deterioro significativo en la rentabilidad respecto al periodo anterior.`;

  return (
    `En el periodo analizado, la empresa reportó ingresos de ${monto(ingresos.actual)}, ` +
    `lo que representa un ${direccion} absoluto de ${monto(ingresos.variacionAbsoluta)} ` +
    `en comparación con el año anterior${sinAnterior}. ` +
    `Los costos de ventas y operación alcanzaron ${monto(costos?.actual ?? 0)}, ` +
    `lo que genera una utilidad bruta de ${monto(bruta.actual)}. ${fraseNeta}`
  );
}

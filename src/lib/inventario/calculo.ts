export interface LineaAjusteCalculo {
  cantidad: number;
  costoCentavos: number;
}

export function totalLineaAjusteCentavos(linea: LineaAjusteCalculo): number {
  const cantidad = Number.isFinite(linea.cantidad) && linea.cantidad > 0 ? linea.cantidad : 0;
  const costoCentavos =
    Number.isFinite(linea.costoCentavos) && linea.costoCentavos > 0 ? Math.round(linea.costoCentavos) : 0;

  return Math.round(cantidad * costoCentavos);
}

export function calcularTotalAjusteCentavos(lineas: LineaAjusteCalculo[]): number {
  return lineas.reduce((total, linea) => total + totalLineaAjusteCentavos(linea), 0);
}

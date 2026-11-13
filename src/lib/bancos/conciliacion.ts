export interface MovimientoConciliacion {
  id: string;
  entradaCentavos: number;
  salidaCentavos: number;
}

export interface ResumenConciliacion {
  entradasCentavos: number;
  salidasCentavos: number;
  entradasAjusteCentavos: number;
  gastosAjusteCentavos: number;
  saldoTotalCentavos: number;
  diferenciaCentavos: number;
  cuadra: boolean;
}

interface DatosResumen {
  saldoAnteriorCentavos: number;
  saldoExtractoCentavos: number;
  movimientos: readonly MovimientoConciliacion[];
  seleccionados: ReadonlySet<string>;
  entradasAjusteCentavos?: number;
  gastosAjusteCentavos?: number;
}

/** Resume la conciliación igual que Alegra: saldo anterior + entradas − salidas. */
export function resumenConciliacion(datos: DatosResumen): ResumenConciliacion {
  let entradasCentavos = 0;
  let salidasCentavos = 0;

  for (const movimiento of datos.movimientos) {
    if (!datos.seleccionados.has(movimiento.id)) continue;
    entradasCentavos += movimiento.entradaCentavos;
    salidasCentavos += movimiento.salidaCentavos;
  }

  const entradasAjusteCentavos = datos.entradasAjusteCentavos ?? 0;
  const gastosAjusteCentavos = datos.gastosAjusteCentavos ?? 0;
  const saldoTotalCentavos =
    datos.saldoAnteriorCentavos + entradasCentavos + entradasAjusteCentavos - salidasCentavos - gastosAjusteCentavos;
  const diferenciaCentavos = datos.saldoExtractoCentavos - saldoTotalCentavos;

  return {
    entradasCentavos,
    salidasCentavos,
    entradasAjusteCentavos,
    gastosAjusteCentavos,
    saldoTotalCentavos,
    diferenciaCentavos,
    cuadra: diferenciaCentavos === 0,
  };
}

function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  if (!anio || !mes || !dia) return fecha;

  const valor = new Date(Date.UTC(anio, mes - 1, dia));
  valor.setUTCDate(valor.getUTCDate() + dias);
  return valor.toISOString().slice(0, 10);
}

export function diaAnterior(fecha: string): string {
  return sumarDias(fecha, -1);
}

export function siguienteDia(fecha: string): string {
  return sumarDias(fecha, 1);
}

/**
 * Desde dónde empieza una conciliación nueva: el día después del último corte
 * conciliado; si no hay cortes, el primer movimiento de la cuenta; si tampoco
 * hay movimientos, la misma fecha de corte.
 */
export function desdeSugerido(ultimoCorte: string | null, primerMovimiento: string | null, fechaCorte: string): string {
  if (ultimoCorte != null) return siguienteDia(ultimoCorte);
  if (primerMovimiento != null && primerMovimiento <= fechaCorte) return primerMovimiento;
  return fechaCorte;
}

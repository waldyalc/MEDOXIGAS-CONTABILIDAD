const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

const FORMATO_MES = /^(\d{4})-(\d{2})$/;

export interface DepreciacionEntrada {
  montoTotalCentavos: number;
  valorResidualCentavos: number;
  vidaUtilMeses: number;
  fechaInicio: string;
}

export interface PeriodoDepreciacion {
  indice: number;
  /** Primer día del mes, YYYY-MM-01. */
  periodo: string;
  /** Último día del mes, YYYY-MM-DD. */
  fecha: string;
  montoCentavos: number;
}

function aCentavos(valor: number): number {
  return Number.isFinite(valor) ? Math.max(0, Math.round(valor)) : 0;
}

/** Toma cualquier fecha YYYY-MM-DD y devuelve el primer día de su mes. */
export function normalizarMes(fecha: string): string {
  const coincidencia = FORMATO_MES.exec(fecha.slice(0, 7));
  if (!coincidencia) return `${fecha.slice(0, 7)}-01`;
  return `${coincidencia[1]}-${coincidencia[2]}-01`;
}

export function desplazarMes(periodo: string, meses: number): string {
  const [anio, mes] = periodo.split("-").map(Number);
  if (!anio || !mes) return periodo;

  const total = anio * 12 + (mes - 1) + meses;
  const nuevoAnio = Math.floor(total / 12);
  const nuevoMes = (total % 12) + 1;

  return `${String(nuevoAnio).padStart(4, "0")}-${String(nuevoMes).padStart(2, "0")}-01`;
}

export function ultimoDiaDelMes(periodo: string): string {
  const [anio, mes] = periodo.split("-").map(Number);
  if (!anio || !mes) return periodo;

  const dia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function etiquetaMes(periodo: string): string {
  const [anio, mes] = periodo.split("-").map(Number);
  if (!anio || !mes || mes < 1 || mes > 12) return periodo;
  return `${MESES[mes - 1]} de ${anio}`;
}

export function baseDepreciable(
  entrada: Pick<DepreciacionEntrada, "montoTotalCentavos" | "valorResidualCentavos">,
): number {
  return Math.max(0, aCentavos(entrada.montoTotalCentavos) - aCentavos(entrada.valorResidualCentavos));
}

/**
 * Proyección mensual en línea recta. El último mes absorbe el redondeo para
 * que la suma sea exactamente el monto depreciable.
 */
export function construirDepreciacion(entrada: DepreciacionEntrada): PeriodoDepreciacion[] {
  const meses = Number.isFinite(entrada.vidaUtilMeses) ? Math.trunc(entrada.vidaUtilMeses) : 0;
  if (meses <= 0) return [];

  const base = baseDepreciable(entrada);
  if (base < meses) return [];

  let mensual = Math.round(base / meses);
  if (mensual * (meses - 1) >= base) {
    mensual = Math.floor(base / meses);
  }
  if (mensual <= 0) return [];

  const inicio = normalizarMes(entrada.fechaInicio);
  const periodos: PeriodoDepreciacion[] = [];
  let acumulado = 0;

  for (let indice = 1; indice <= meses; indice += 1) {
    const monto = indice === meses ? base - acumulado : mensual;
    if (monto <= 0) break;

    const periodo = desplazarMes(inicio, indice - 1);
    acumulado += monto;

    periodos.push({
      indice,
      periodo,
      fecha: ultimoDiaDelMes(periodo),
      montoCentavos: monto,
    });
  }

  return periodos;
}

/** Primera fila de la proyección que todavía no tiene asiento. */
export function siguientePendiente(
  periodos: readonly PeriodoDepreciacion[],
  periodosDepreciados: readonly string[],
): PeriodoDepreciacion | null {
  const hechos = new Set(periodosDepreciados.map(normalizarMes));

  for (const periodo of periodos) {
    if (!hechos.has(periodo.periodo)) return periodo;
  }

  return null;
}

export function sumarDepreciado(periodos: readonly { montoCentavos: number }[]): number {
  return periodos.reduce((total, periodo) => total + periodo.montoCentavos, 0);
}

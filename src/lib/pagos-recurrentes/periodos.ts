import type { PeriodosPlantilla } from "./tipos";

function partes(fecha: string): [number, number, number] | null {
  const [anio, mes, dia] = fecha.slice(0, 10).split("-").map(Number);
  if (!anio || !mes || !dia) return null;
  return [anio, mes, dia];
}

function texto(anio: number, mes: number, dia: number): string {
  return `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Suma meses como Postgres: si el día no existe en el mes destino, usa el último día. */
export function sumarMeses(fecha: string, meses: number): string {
  const valor = partes(fecha);
  if (!valor) return fecha;

  const [anio, mes, dia] = valor;
  const total = anio * 12 + (mes - 1) + meses;
  const anioNuevo = Math.floor(total / 12);
  const mesNuevo = (total % 12) + 1;
  const ultimoDia = new Date(Date.UTC(anioNuevo, mesNuevo, 0)).getUTCDate();

  return texto(anioNuevo, mesNuevo, Math.min(dia, ultimoDia));
}

/** Último periodo vencido a la fecha, o null si aún no toca o está fuera de vigencia. */
export function periodoDelPlan(plan: PeriodosPlantilla, hoy: string): string | null {
  const frecuencia = Math.max(1, Math.trunc(plan.frecuenciaMeses));
  let periodos = 0;

  while (sumarMeses(plan.fechaInicio, (periodos + 1) * frecuencia) <= hoy) {
    periodos += 1;
  }

  const periodo = sumarMeses(plan.fechaInicio, periodos * frecuencia);
  if (periodo > hoy) return null;
  if (plan.vigenciaHasta && periodo > plan.vigenciaHasta) return null;

  return periodo;
}

/** Próximo periodo a partir de hoy (incluye hoy si es fecha de pago), o null si ya venció. */
export function siguientePeriodo(plan: PeriodosPlantilla, hoy: string): string | null {
  const frecuencia = Math.max(1, Math.trunc(plan.frecuenciaMeses));
  let periodos = 0;

  while (sumarMeses(plan.fechaInicio, periodos * frecuencia) < hoy) {
    periodos += 1;
  }

  const siguiente = sumarMeses(plan.fechaInicio, periodos * frecuencia);
  if (plan.vigenciaHasta && siguiente > plan.vigenciaHasta) return null;

  return siguiente;
}

import { format, parse, startOfMonth, subMonths } from "date-fns";

import type { RangoFechas } from "@/lib/fechas/rangos";
import { formatoDia } from "@/lib/formato";

export type PeriodoId = "mes" | "3m" | "6m";

export const PERIODO_POR_DEFECTO: PeriodoId = "mes";

interface DefinicionPeriodo {
  etiqueta: string;
  meses: number;
}

const DEFINICIONES: Record<PeriodoId, DefinicionPeriodo> = {
  mes: { etiqueta: "Mes actual", meses: 1 },
  "3m": { etiqueta: "Últimos 3 meses", meses: 3 },
  "6m": { etiqueta: "Últimos 6 meses", meses: 6 },
};

export const PERIODOS: readonly PeriodoId[] = ["mes", "3m", "6m"];

const FORMATO_ISO = "yyyy-MM-dd";

/** Lee ?periodo= de la URL; si falta o no es válido usa «Mes actual». */
export function parsearPeriodo(valor: string | string[] | undefined): PeriodoId {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return texto === "mes" || texto === "3m" || texto === "6m" ? texto : PERIODO_POR_DEFECTO;
}

/**
 * Rango del periodo: del primer día del mes inicial hasta hoy.
 * «Mes actual» empieza el día 1; 3 m y 6 m cuentan meses calendario completos
 * hacia atrás (incluido el actual).
 */
export function rangoPeriodo(periodo: PeriodoId, hoy: string): RangoFechas {
  const meses = DEFINICIONES[periodo].meses;
  const inicioMes = startOfMonth(parse(hoy, FORMATO_ISO, new Date()));
  const desde = format(subMonths(inicioMes, meses - 1), FORMATO_ISO);

  return { desde, hasta: hoy };
}

export interface OpcionPeriodo extends RangoFechas {
  id: PeriodoId;
  etiqueta: string;
  /** Rango visible debajo del nombre, en dd/mm/aaaa. */
  rango: string;
}

export function etiquetaRango(desde: string, hasta: string): string {
  return `${formatoDia(desde)} al ${formatoDia(hasta)}`;
}

export function opcionesPeriodo(hoy: string): OpcionPeriodo[] {
  return PERIODOS.map((id) => {
    const { desde, hasta } = rangoPeriodo(id, hoy);

    return {
      id,
      etiqueta: DEFINICIONES[id].etiqueta,
      desde,
      hasta,
      rango: etiquetaRango(desde, hasta),
    };
  });
}

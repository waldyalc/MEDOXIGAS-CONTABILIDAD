import {
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  parse,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import { es } from "date-fns/locale";

export interface RangoFechas {
  desde: string;
  hasta: string;
}

const FORMATO_ISO = "yyyy-MM-dd";
const FORMATO_ETIQUETA = "d MMM yyyy";

function aFecha(iso: string): Date {
  return parse(iso, FORMATO_ISO, new Date());
}

function aIso(fecha: Date): string {
  return format(fecha, FORMATO_ISO);
}

function crearRango(desde: Date, hasta: Date): RangoFechas {
  return { desde: aIso(desde), hasta: aIso(hasta) };
}

/** Fecha de hoy en formato ISO (YYYY-MM-DD) según la zona de República Dominicana. */
export function hoyEnRd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Santo_Domingo",
  }).format(new Date());
}

export function rangoHoy(hoy: string): RangoFechas {
  const fecha = aFecha(hoy);
  return crearRango(fecha, fecha);
}

export function rangoAyer(hoy: string): RangoFechas {
  const ayer = subDays(aFecha(hoy), 1);
  return crearRango(ayer, ayer);
}

/** Semana de lunes a domingo. */
export function rangoEstaSemana(hoy: string): RangoFechas {
  const fecha = aFecha(hoy);
  const opciones = { weekStartsOn: 1 } as const;
  return crearRango(startOfWeek(fecha, opciones), endOfWeek(fecha, opciones));
}

export function rangoEsteMes(hoy: string): RangoFechas {
  const fecha = aFecha(hoy);
  return crearRango(startOfMonth(fecha), endOfMonth(fecha));
}

export function rangoMesAnterior(hoy: string): RangoFechas {
  const anterior = subMonths(aFecha(hoy), 1);
  return crearRango(startOfMonth(anterior), endOfMonth(anterior));
}

export function rangoEsteTrimestre(hoy: string): RangoFechas {
  const fecha = aFecha(hoy);
  return crearRango(startOfQuarter(fecha), endOfQuarter(fecha));
}

export function rangoEsteAnio(hoy: string): RangoFechas {
  const fecha = aFecha(hoy);
  return crearRango(startOfYear(fecha), endOfYear(fecha));
}

export function rangoAnioAnterior(hoy: string): RangoFechas {
  const anterior = subYears(aFecha(hoy), 1);
  return crearRango(startOfYear(anterior), endOfYear(anterior));
}

export function fechaHoy(hoy: string): string {
  return hoy;
}

export function fechaFinMesAnterior(hoy: string): string {
  return aIso(endOfMonth(subMonths(aFecha(hoy), 1)));
}

export function fechaFinAnioAnterior(hoy: string): string {
  return aIso(endOfYear(subYears(aFecha(hoy), 1)));
}

export interface AtajoRango {
  id: string;
  etiqueta: string;
  /** `null` para «Personalizado», que deja elegir el rango en el calendario. */
  obtener: ((hoy: string) => RangoFechas) | null;
}

export const ATAJOS_RANGO: readonly AtajoRango[] = [
  { id: "hoy", etiqueta: "Hoy", obtener: rangoHoy },
  { id: "ayer", etiqueta: "Ayer", obtener: rangoAyer },
  { id: "esta-semana", etiqueta: "Esta semana", obtener: rangoEstaSemana },
  { id: "este-mes", etiqueta: "Este mes", obtener: rangoEsteMes },
  { id: "mes-anterior", etiqueta: "Mes anterior", obtener: rangoMesAnterior },
  { id: "este-trimestre", etiqueta: "Este trimestre", obtener: rangoEsteTrimestre },
  { id: "este-anio", etiqueta: "Este año", obtener: rangoEsteAnio },
  { id: "anio-anterior", etiqueta: "Año anterior", obtener: rangoAnioAnterior },
  { id: "personalizado", etiqueta: "Personalizado", obtener: null },
];

export interface AtajoFecha {
  id: string;
  etiqueta: string;
  obtener: (hoy: string) => string;
}

export const ATAJOS_FECHA: readonly AtajoFecha[] = [
  { id: "hoy", etiqueta: "Hoy", obtener: fechaHoy },
  { id: "fin-mes-anterior", etiqueta: "Fin de mes anterior", obtener: fechaFinMesAnterior },
  { id: "fin-anio-anterior", etiqueta: "Fin de año anterior", obtener: fechaFinAnioAnterior },
];

export function etiquetaFecha(iso: string): string {
  return format(aFecha(iso), FORMATO_ETIQUETA, { locale: es });
}

export function etiquetaRango(rango: RangoFechas): string {
  return `${etiquetaFecha(rango.desde)} – ${etiquetaFecha(rango.hasta)}`;
}

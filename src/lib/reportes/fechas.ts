import { z } from "zod";

export interface RangoFechas {
  desde: string;
  hasta: string;
}

export type ParametrosFecha = Record<string, string | string[] | undefined>;

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function esFechaValida(texto: string): boolean {
  if (!FORMATO_FECHA.test(texto)) return false;

  const anio = Number(texto.slice(0, 4));
  const mes = Number(texto.slice(5, 7));
  const dia = Number(texto.slice(8, 10));
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

const esquemaFecha = z.string().refine(esFechaValida);

/** Fecha de hoy en formato ISO (YYYY-MM-DD) según la zona de República Dominicana. */
export function hoyRd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Santo_Domingo",
  }).format(new Date());
}

export function rangoMesActual(hoy: string): RangoFechas {
  const anio = Number(hoy.slice(0, 4));
  const mes = Number(hoy.slice(5, 7));
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();

  return {
    desde: `${hoy.slice(0, 7)}-01`,
    hasta: `${hoy.slice(0, 7)}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

function leerFecha(valor: string | string[] | undefined): string | null {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  if (texto == null) return null;

  const resultado = esquemaFecha.safeParse(texto);
  return resultado.success ? resultado.data : null;
}

/** Toma desde/hasta de los searchParams; si faltan o son inválidos usa el mes actual. */
export function parsearRango(params: ParametrosFecha, hoy: string = hoyRd()): RangoFechas {
  const defecto = rangoMesActual(hoy);
  const desde = leerFecha(params.desde) ?? defecto.desde;
  const hasta = leerFecha(params.hasta) ?? defecto.hasta;

  return desde <= hasta ? { desde, hasta } : defecto;
}

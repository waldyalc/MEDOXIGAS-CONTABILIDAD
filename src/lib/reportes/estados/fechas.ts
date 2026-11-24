import { hoyRd, type ParametrosFecha, type RangoFechas } from "../fechas";
import type { Vista } from "./tipos";

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function esFechaValida(texto: string): boolean {
  if (!FORMATO_FECHA.test(texto)) return false;

  const anio = Number(texto.slice(0, 4));
  const mes = Number(texto.slice(5, 7));
  const dia = Number(texto.slice(8, 10));
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

function aFecha(iso: string): Date {
  const anio = Number(iso.slice(0, 4));
  const mes = Number(iso.slice(5, 7));
  const dia = Number(iso.slice(8, 10));
  return new Date(Date.UTC(anio, mes - 1, dia));
}

function aIso(fecha: Date): string {
  const anio = fecha.getUTCFullYear();
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getUTCDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

export function sumarDias(iso: string, dias: number): string {
  const fecha = aFecha(iso);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return aIso(fecha);
}

export function restarAnio(iso: string): string {
  const anio = Number(iso.slice(0, 4)) - 1;
  const mes = Number(iso.slice(5, 7));
  const dia = Number(iso.slice(8, 10));
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return aIso(new Date(Date.UTC(anio, mes - 1, Math.min(dia, ultimoDia))));
}

export function compararPeriodoAnioAnterior(desde: string, hasta: string): RangoFechas {
  return { desde: restarAnio(desde), hasta: restarAnio(hasta) };
}

/** Período inmediatamente anterior, de la misma cantidad de días. */
export function periodoAnterior(desde: string, hasta: string): RangoFechas {
  const dias = Math.round((aFecha(hasta).getTime() - aFecha(desde).getTime()) / 86400000) + 1;
  const hastaAnterior = sumarDias(desde, -1);
  return { desde: sumarDias(hastaAnterior, -(dias - 1)), hasta: hastaAnterior };
}

export function inicioAnio(iso: string): string {
  return `${iso.slice(0, 4)}-01-01`;
}

export function finAnioAnterior(iso: string): string {
  return `${Number(iso.slice(0, 4)) - 1}-12-31`;
}

export function parsearHasta(params: ParametrosFecha, hoy: string = hoyRd()): string {
  const valor = Array.isArray(params.hasta) ? params.hasta[0] : params.hasta;
  return valor != null && esFechaValida(valor) ? valor : hoy;
}

export function parsearVista(params: ParametrosFecha): Vista {
  const valor = Array.isArray(params.vista) ? params.vista[0] : params.vista;
  return valor === "resumido" ? "resumido" : "detallado";
}

export function parsearBusqueda(params: ParametrosFecha): string {
  const valor = Array.isArray(params.q) ? params.q[0] : params.q;
  return valor?.trim() ?? "";
}

export function etiquetaDia(iso: string): string {
  const anio = iso.slice(0, 4);
  const mes = Number(iso.slice(5, 7));
  const dia = iso.slice(8, 10);
  return `${dia} ${MESES[mes - 1] ?? ""}, ${anio}`;
}

/** Rótulo compacto de una columna con rango: «1 Ago - 30 Sep, 2026». */
export function etiquetaRangoCorto(desde: string, hasta: string): string {
  if (desde === hasta) return etiquetaDia(desde);

  const anioInicio = desde.slice(0, 4);
  const anioFin = hasta.slice(0, 4);
  const mesInicio = MESES[Number(desde.slice(5, 7)) - 1] ?? "";
  const mesFin = MESES[Number(hasta.slice(5, 7)) - 1] ?? "";
  const diaInicio = Number(desde.slice(8, 10));
  const diaFin = Number(hasta.slice(8, 10));

  if (anioInicio !== anioFin) {
    return `${diaInicio} ${mesInicio}, ${anioInicio} - ${diaFin} ${mesFin}, ${anioFin}`;
  }

  return `${diaInicio} ${mesInicio} - ${diaFin} ${mesFin}, ${anioFin}`;
}

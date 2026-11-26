import { rangoEsteAnio } from "@/lib/fechas/rangos";
import type { ParametrosFecha, RangoFechas } from "@/lib/reportes/fechas";

import { VISTAS_ANTIGUEDAD, type VistaAntiguedad } from "./tipos";

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function leerParametro(params: ParametrosFecha, clave: string): string {
  const valor = params[clave];
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return texto?.trim() ?? "";
}

export function leerFechaParametro(params: ParametrosFecha, clave: string): string | null {
  const texto = leerParametro(params, clave);
  if (!FORMATO_FECHA.test(texto)) return null;

  const fecha = new Date(`${texto}T00:00:00Z`);
  return Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== texto ? null : texto;
}

/**
 * Resuelve el período de CxC/CxP. Sin parámetros usa el año actual; los enlaces
 * antiguos de CxC que solo traían `hasta` y `creacion_desde` conservan ese inicio.
 */
export function resolverPeriodoCartera(params: ParametrosFecha, hoy: string): RangoFechas {
  const defecto = rangoEsteAnio(hoy);
  const hastaUrl = leerFechaParametro(params, "hasta");
  const hasta = hastaUrl ?? defecto.hasta;
  const inicioDelAnioHasta = `${hasta.slice(0, 4)}-01-01`;
  const desde =
    leerFechaParametro(params, "desde") ??
    leerFechaParametro(params, "creacion_desde") ??
    (hastaUrl ? inicioDelAnioHasta : defecto.desde);

  return desde <= hasta ? { desde, hasta } : defecto;
}

export function leerVista(params: ParametrosFecha): VistaAntiguedad {
  const texto = leerParametro(params, "vista");
  return VISTAS_ANTIGUEDAD.find((vista) => vista === texto) ?? "todas";
}

export function leerPagina(params: ParametrosFecha, totalPaginas: number): number {
  const numero = Number(leerParametro(params, "pagina"));
  if (!Number.isInteger(numero) || numero < 1) return 1;

  return Math.min(numero, Math.max(totalPaginas, 1));
}

export interface Pagina<T> {
  pagina: number;
  totalPaginas: number;
  filas: T[];
  inicio: number;
  fin: number;
  total: number;
}

export function paginar<T>(filas: readonly T[], pagina: number, porPagina: number): Pagina<T> {
  const total = filas.length;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const actual = Math.min(Math.max(pagina, 1), totalPaginas);
  const indice = (actual - 1) * porPagina;

  return {
    pagina: actual,
    totalPaginas,
    filas: filas.slice(indice, indice + porPagina),
    inicio: total === 0 ? 0 : indice + 1,
    fin: Math.min(indice + porPagina, total),
    total,
  };
}

/**
 * Arma una URL conservando los filtros actuales. Los cambios con valor `null`
 * o vacío eliminan el parámetro (por ejemplo, para volver a la página 1).
 */
export function urlConParametros(
  base: string,
  params: ParametrosFecha,
  cambios: Record<string, string | null> = {},
): string {
  const busqueda = new URLSearchParams();

  for (const [clave, valor] of Object.entries(params)) {
    if (Object.hasOwn(cambios, clave)) continue;
    const texto = Array.isArray(valor) ? valor[0] : valor;
    if (texto != null && texto !== "") busqueda.set(clave, texto);
  }

  for (const [clave, valor] of Object.entries(cambios)) {
    if (valor != null && valor !== "") busqueda.set(clave, valor);
  }

  const consulta = busqueda.toString();
  return consulta === "" ? base : `${base}?${consulta}`;
}

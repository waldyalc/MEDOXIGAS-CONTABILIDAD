import { hoyRd, type ParametrosFecha } from "../../fechas";
import type { FiltroVencimiento } from "./tipos";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export const ETIQUETAS_VENCIMIENTO: Record<FiltroVencimiento, string> = {
  todas: "Todos",
  "sin-vencer": "Sin vencer",
  "1-30": "Vencidas: 1 a 30 días",
  "31-60": "Vencidas: 31 a 60 días",
  "61-90": "Vencidas: 61 a 90 días",
  "91-mas": "Vencidas: Más de 91 días",
};

const VENCIMIENTOS = Object.keys(ETIQUETAS_VENCIMIENTO) as FiltroVencimiento[];

export function leerParametro(params: ParametrosFecha, clave: string): string {
  const valor = params[clave];
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return texto?.trim() ?? "";
}

export function parsearBusqueda(params: ParametrosFecha, clave = "q"): string {
  return leerParametro(params, clave);
}

export function parsearPagina(params: ParametrosFecha, totalFilas: number, porPagina = 10): number {
  const paginas = Math.max(1, Math.ceil(totalFilas / porPagina));
  const valor = Number(leerParametro(params, "pagina"));

  if (!Number.isInteger(valor) || valor < 1) return 1;
  return Math.min(valor, paginas);
}

export function parsearCliente(params: ParametrosFecha): string | null {
  const valor = leerParametro(params, "cliente");
  return UUID.test(valor) ? valor : null;
}

function esFechaValida(texto: string): boolean {
  if (!FECHA.test(texto)) return false;

  const fecha = new Date(
    Date.UTC(Number(texto.slice(0, 4)), Number(texto.slice(5, 7)) - 1, Number(texto.slice(8, 10))),
  );
  return (
    fecha.getUTCFullYear() === Number(texto.slice(0, 4)) &&
    fecha.getUTCMonth() === Number(texto.slice(5, 7)) - 1 &&
    fecha.getUTCDate() === Number(texto.slice(8, 10))
  );
}

export function parsearCorte(params: ParametrosFecha, hoy: string = hoyRd()): string {
  const valor = leerParametro(params, "corte");
  return esFechaValida(valor) ? valor : hoy;
}

export function parsearVencimiento(params: ParametrosFecha): FiltroVencimiento {
  const valor = leerParametro(params, "vencimiento");
  return VENCIMIENTOS.find((opcion) => opcion === valor) ?? "todas";
}

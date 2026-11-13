import type { ParametrosFecha } from "../../fechas";
import type { FiltrosVentasUrl } from "./tipos";

const NUMERACION = /^\d{1,3}$/;
const ENTERO = /^\d+$/;
const MAXIMO_BUSQUEDA = 100;

function primerValor(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

function leerPagina(valor: string | undefined): number {
  const texto = valor?.trim() ?? "";
  if (!ENTERO.test(texto)) return 1;

  const pagina = Number(texto);
  return Number.isSafeInteger(pagina) && pagina >= 1 ? pagina : 1;
}

export function parsearFiltrosVentas(params: ParametrosFecha): FiltrosVentasUrl {
  const numeracion = (primerValor(params.numeracion) ?? "").trim();
  const almacen = (primerValor(params.almacen) ?? "").trim().toLowerCase();
  const busqueda = (primerValor(params.q) ?? "").trim().slice(0, MAXIMO_BUSQUEDA);

  return {
    tipoComprobante: NUMERACION.test(numeracion) ? numeracion : "",
    almacen: almacen === "principal" ? "principal" : "",
    busqueda,
    pagina: leerPagina(primerValor(params.pagina)),
    grafico: primerValor(params.grafico) === "mensual" ? "mensual" : "diario",
  };
}

export interface ParametrosUrlVentas extends FiltrosVentasUrl {
  desde: string;
  hasta: string;
}

export function urlVentas(base: string, params: ParametrosUrlVentas): string {
  const query = new URLSearchParams();
  query.set("desde", params.desde);
  query.set("hasta", params.hasta);
  if (params.tipoComprobante) query.set("numeracion", params.tipoComprobante);
  if (params.almacen) query.set("almacen", params.almacen);
  if (params.busqueda) query.set("q", params.busqueda);
  if (params.grafico === "mensual") query.set("grafico", "mensual");
  if (params.pagina > 1) query.set("pagina", String(params.pagina));

  return `${base}?${query.toString()}`;
}

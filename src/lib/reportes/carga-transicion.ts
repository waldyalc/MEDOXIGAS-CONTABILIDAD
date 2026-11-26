export const EVENTO_CARGA_REPORTE = "medoxigas:reporte-cargando";

export type ModoCargaReporte = "tabla" | "pagina";

export interface DecisionNavegacionReporte {
  navegar: boolean;
  modo: ModoCargaReporte;
}

export interface DatosClickEnlaceReporte {
  href: string | null;
  pathnameActual: string;
  searchActual: string;
  boton: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  download: boolean;
  target: string | null;
  defaultPrevented: boolean;
}

const RUTA_REPORTES = "/dashboard/reportes";
const ORIGEN_LOCAL = "https://medoxigas.local";

function sinCarga(): DecisionNavegacionReporte {
  return { navegar: false, modo: "tabla" };
}

function normalizarPathname(pathname: string): string {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

function normalizarSearch(search: string): string {
  return search.startsWith("?") ? search.slice(1) : search;
}

function esRutaReportes(pathname: string): boolean {
  return pathname === RUTA_REPORTES || pathname.startsWith(`${RUTA_REPORTES}/`);
}

export function notificarCargaReporte(modo: ModoCargaReporte = "tabla"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO_CARGA_REPORTE, { detail: { modo } }));
}

export function esNavegacionInternaReporte(
  href: string | null,
  pathnameActual: string,
  searchActual: string,
): DecisionNavegacionReporte {
  if (!href) return sinCarga();

  const destinoTexto = href.trim();
  if (destinoTexto === "" || destinoTexto.startsWith("#")) return sinCarga();

  const origen = typeof window === "undefined" ? ORIGEN_LOCAL : window.location.origin;
  let destino: URL;
  try {
    destino = new URL(destinoTexto, origen);
  } catch {
    return sinCarga();
  }

  if (destino.origin !== origen) return sinCarga();
  if (destino.protocol !== "http:" && destino.protocol !== "https:") return sinCarga();

  const pathnameDestino = normalizarPathname(destino.pathname);
  const searchDestino = normalizarSearch(destino.search);
  const pathnameBase = normalizarPathname(pathnameActual);
  const searchBase = normalizarSearch(searchActual);

  if (pathnameDestino === pathnameBase && searchDestino === searchBase) return sinCarga();
  if (!esRutaReportes(pathnameDestino)) return sinCarga();

  return pathnameDestino === pathnameBase ? { navegar: true, modo: "tabla" } : { navegar: true, modo: "pagina" };
}

export function modoDesdeEventoCarga(evento: Event): ModoCargaReporte {
  const detalle = (evento as CustomEvent<{ modo?: unknown }>).detail;
  return detalle?.modo === "pagina" ? "pagina" : "tabla";
}

export function decidirCargaFormularioGet(metodo: string | null, defaultPrevented: boolean): ModoCargaReporte | null {
  if (defaultPrevented) return null;
  if ((metodo ?? "get").toLowerCase() !== "get") return null;
  return "tabla";
}

export function decidirCargaClickReporte(datos: DatosClickEnlaceReporte): ModoCargaReporte | null {
  if (datos.defaultPrevented) return null;
  if (datos.boton !== 0 || datos.ctrlKey || datos.metaKey || datos.shiftKey || datos.altKey) return null;
  if (datos.download) return null;
  if (datos.target !== null && datos.target !== "" && datos.target.toLowerCase() !== "_self") return null;

  const decision = esNavegacionInternaReporte(datos.href, datos.pathnameActual, datos.searchActual);
  return decision.navegar ? decision.modo : null;
}

export function cambioRutaCierraCarga(claveAnterior: string | null, claveNueva: string): boolean {
  return claveAnterior !== null && claveAnterior !== claveNueva;
}

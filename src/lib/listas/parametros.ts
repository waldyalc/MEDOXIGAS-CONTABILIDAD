export const TAMANO_PAGINA_DEFECTO = 25;
export const TAMANOS_PAGINA = [10, 20, 25, 30, 50, 100] as const;

export type ParametrosLista = Record<string, string | string[] | undefined>;

export interface OpcionesLista {
  pagina: number;
  tamano: number;
  q: string;
}

export interface ResumenPagina {
  pagina: number;
  totalPaginas: number;
  inicio: number;
  fin: number;
  total: number;
}

export interface ResultadoPagina<T> {
  filas: T[];
  resumen: ResumenPagina;
}

const LIMITE_BUSQUEDA = 100;

export function leerTexto(params: ParametrosLista, clave: string): string {
  const valor = params[clave];
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return texto?.trim() ?? "";
}

export function leerPagina(params: ParametrosLista): number {
  const numero = Number(leerTexto(params, "pagina"));
  return Number.isInteger(numero) && numero > 0 ? numero : 1;
}

export function leerTamanoConDefecto(
  params: ParametrosLista,
  defecto: number,
  opciones: readonly number[] = TAMANOS_PAGINA,
): number {
  const numero = Number(leerTexto(params, "tamano"));
  const permitidos = opciones.includes(defecto) ? opciones : [...opciones, defecto];
  return permitidos.find((tamano) => tamano === numero) ?? defecto;
}

export function leerTamano(params: ParametrosLista): number {
  return leerTamanoConDefecto(params, TAMANO_PAGINA_DEFECTO, TAMANOS_PAGINA);
}

export function leerOpcionesLista(params: ParametrosLista): OpcionesLista {
  return {
    pagina: leerPagina(params),
    tamano: leerTamano(params),
    q: leerTexto(params, "q").slice(0, LIMITE_BUSQUEDA),
  };
}

export function rangoPagina(pagina: number, tamano: number): { desde: number; hasta: number } {
  const desde = Math.max(0, pagina - 1) * tamano;
  return { desde, hasta: desde + tamano - 1 };
}

export function resumirPagina(pagina: number, tamano: number, total: number): ResumenPagina {
  const totalPaginas = Math.max(1, Math.ceil(total / tamano));
  const actual = Math.min(Math.max(pagina, 1), totalPaginas);
  const indice = (actual - 1) * tamano;

  return {
    pagina: actual,
    totalPaginas,
    inicio: total === 0 ? 0 : indice + 1,
    fin: Math.min(indice + tamano, total),
    total,
  };
}

/**
 * Arma la URL de la lista conservando página, tamaño y búsqueda. Un cambio con
 * valor `null` o vacío elimina el parámetro.
 */
export function urlLista(base: string, params: ParametrosLista, cambios: Record<string, string | null> = {}): string {
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

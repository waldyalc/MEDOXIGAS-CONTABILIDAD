/**
 * Lógica pura de agrupación de los resultados de la búsqueda global.
 * Spec: docs/busqueda-global.md §1.5 (grupos), §2.7 (duplicados) y §3.2 (contrato).
 *
 * TODO: cuando exista `src/lib/busqueda/tipos.ts` (PR 1 del plan), importar de
 * allí EntidadBusqueda/GrupoBusqueda/ResultadoBusqueda y borrar las copias de
 * este archivo; la función `agrupar` no cambia.
 */

export type EntidadBusqueda =
  | "contacto"
  | "producto"
  | "factura"
  | "nota_credito_venta"
  | "nota_debito_venta"
  | "cotizacion"
  | "remision"
  | "factura_recurrente"
  | "pago_recibido"
  | "factura_proveedor"
  | "nota_credito_compra"
  | "orden_compra"
  | "pago_proveedor"
  | "gasto_menor"
  | "asiento"
  | "cuenta"
  | "reporte"
  | "navegacion"
  | "documento";

export type GrupoBusqueda = "clientes" | "productos" | "facturacion" | "compras" | "documentos" | "otros";

/** Tonos de la pastilla de estado (los mismos que PillEstado en tabla-lista.tsx). */
export type TonoResultado = "exito" | "pendiente" | "peligro" | "neutro" | "info";

export interface ResultadoBusqueda {
  entidad: EntidadBusqueda;
  id: string;
  titulo: string;
  subtitulo: string;
  /** Datos ya formateados para la fila inferior: "01 · Crédito fiscal". */
  etiquetas: string[];
  estado: { texto: string; tono: TonoResultado } | null;
  /** Fecha ISO (YYYY-MM-DD) o null. */
  fecha: string | null;
  /** Texto ya formateado por el SQL (numeric → text). Nunca float. */
  monto: string | null;
  rango: number;
}

export interface GrupoResultados {
  grupo: GrupoBusqueda;
  /** Total real tras el dedupe: alimenta el conteo del rail y «Ver todos →». */
  total: number;
  /** Como máximo `limitePorGrupo` (4 en modo «todos»). */
  resultados: ResultadoBusqueda[];
}

/** Máximo de tarjetas por grupo en modo «todos» (§1.5). */
export const LIMITE_TODOS = 4;

/** Orden fijo del rail (§1.4): nunca se reordena por cantidad. */
export const ORDEN_GRUPOS = [
  "clientes",
  "productos",
  "facturacion",
  "compras",
  "documentos",
  "otros",
] as const satisfies readonly GrupoBusqueda[];

const GRUPO_DE_ENTIDAD: Record<EntidadBusqueda, GrupoBusqueda> = {
  contacto: "clientes",
  producto: "productos",
  factura: "facturacion",
  nota_credito_venta: "facturacion",
  nota_debito_venta: "facturacion",
  cotizacion: "facturacion",
  remision: "facturacion",
  factura_recurrente: "facturacion",
  pago_recibido: "facturacion",
  factura_proveedor: "compras",
  nota_credito_compra: "compras",
  orden_compra: "compras",
  pago_proveedor: "compras",
  gasto_menor: "compras",
  asiento: "otros",
  cuenta: "otros",
  reporte: "otros",
  navegacion: "otros",
  documento: "documentos",
};

export function grupoDeEntidad(entidad: EntidadBusqueda): GrupoBusqueda {
  return GRUPO_DE_ENTIDAD[entidad];
}

/** Clave de dedupe: una misma entidad no puede aparecer dos veces (§2.7). */
export function claveResultado(resultado: Pick<ResultadoBusqueda, "entidad" | "id">): string {
  return `${resultado.entidad}:${resultado.id}`;
}

export interface OpcionesAgrupar {
  /** Default 4 (modo «todos»); 20 con categoría fijada; 3 en móvil (§1.5 y §1.11). */
  limitePorGrupo?: number;
}

/**
 * Agrupa resultados por entidad en el orden fijo del rail, deduplicando por
 * (entidad, id) y recortando cada grupo a `limitePorGrupo` tarjetas. Los grupos
 * vacíos no se devuelven (§1.5); el `total` de cada grupo siempre es el real
 * para que el rail y «Ver todos →» no mientan.
 */
export function agrupar(resultados: ResultadoBusqueda[], opciones: OpcionesAgrupar = {}): GrupoResultados[] {
  const limite = Math.max(1, opciones.limitePorGrupo ?? LIMITE_TODOS);
  const vistos = new Set<string>();
  const porGrupo = new Map<GrupoBusqueda, ResultadoBusqueda[]>();

  for (const resultado of resultados) {
    const clave = claveResultado(resultado);
    if (vistos.has(clave)) continue;
    vistos.add(clave);

    const grupo = GRUPO_DE_ENTIDAD[resultado.entidad];
    const anteriores = porGrupo.get(grupo);
    if (anteriores == null) porGrupo.set(grupo, [resultado]);
    else anteriores.push(resultado);
  }

  const grupos: GrupoResultados[] = [];
  for (const grupo of ORDEN_GRUPOS) {
    const lista = porGrupo.get(grupo);
    if (lista == null || lista.length === 0) continue;

    const ordenada = [...lista].sort(compararResultados);
    grupos.push({ grupo, total: ordenada.length, resultados: ordenada.slice(0, limite) });
  }
  return grupos;
}

/** Desempates del §2.4 que aplican en el cliente: rango asc → fecha desc (null al final). */
function compararResultados(a: ResultadoBusqueda, b: ResultadoBusqueda): number {
  if (a.rango !== b.rango) return a.rango - b.rango;
  if (a.fecha === b.fecha) return 0;
  if (a.fecha == null) return 1;
  if (b.fecha == null) return -1;
  // Las fechas son ISO (YYYY-MM-DD): el orden lexicográfico es el cronológico.
  return b.fecha.localeCompare(a.fecha);
}

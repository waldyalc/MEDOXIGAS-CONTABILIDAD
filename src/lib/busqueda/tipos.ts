/**
 * Contrato de la búsqueda global (docs/busqueda-global.md §3.2).
 *
 * La RPC `buscar_global` devuelve `RespuestaBusqueda` como `jsonb`; este
 * archivo es la única definición de esa forma para el cliente. El SQL nunca
 * devuelve URLs: la traducción de `entidad` + `id` a ruta vive en
 * `src/lib/busqueda/rutas.ts`.
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

export interface ResultadoBusqueda {
  entidad: EntidadBusqueda;
  id: string;
  titulo: string;
  subtitulo: string;
  /** Datos ya formateados para la fila inferior: "Cobrada", "01 · Crédito fiscal". */
  etiquetas: string[];
  estado: { texto: string; tono: "exito" | "pendiente" | "peligro" | "neutro" | "info" } | null;
  /** Fecha ISO (YYYY-MM-DD) o null. Se formatea en el cliente. */
  fecha: string | null;
  /** Texto ya formateado por el SQL (numeric → text). Nunca float. */
  monto: string | null;
  rango: number;
}

export interface RespuestaBusqueda {
  grupos: { grupo: GrupoBusqueda; entidad: EntidadBusqueda; total: number; resultados: ResultadoBusqueda[] }[];
  total: number;
  /** Solo en modo categoría. */
  hayMas: boolean;
  ms: number;
}

/**
 * Intención extraída del término antes de consultar (§4.3). La llena el parser
 * determinista (`interpretar`) y, en la fase 2, el LLM con el mismo contrato:
 * nadie más que el parser escribe estos campos.
 */
export interface IntencionBusqueda {
  /** Lo que queda del término tras quitar señales, entidades y stopwords. */
  texto?: string;
  entidad?: EntidadBusqueda;
  /** Número exacto de documento (`#1258`). */
  numero?: number;
  /** NCF exacto normalizado a mayúsculas (`B0100000123`). */
  ncf?: string;
  /** RNC o cédula, solo dígitos (`101123456`). */
  identificacion?: string;
  /** Inicio del rango de fechas en ISO (YYYY-MM-DD). */
  desde?: string;
  /** Fin del rango de fechas en ISO (YYYY-MM-DD). */
  hasta?: string;
  /** Monto buscado; solo ordena por cercanía, nunca filtra (§3.4). */
  monto?: number;
  /**
   * 0..1 (§4.3): 1 para NCF/número/RNC exactos, 0.9 fecha+texto, 0.6 solo
   * texto y menor a 0.4 cuando no entendió nada.
   */
  confianza: number;
}

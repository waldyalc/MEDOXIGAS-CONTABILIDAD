"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { etiquetaTipoComprobante } from "@/lib/facturacion/comprobantes";
import { createClient } from "@/lib/supabase/server";

import { interpretar } from "./interpretar";
import type { EntidadBusqueda, GrupoBusqueda, IntencionBusqueda, RespuestaBusqueda, ResultadoBusqueda } from "./tipos";

/**
 * Server action de la búsqueda global (docs/busqueda-global.md §3.2 y §3.6):
 * interpreta el término con el parser determinista, arma el payload `p` de la
 * RPC y llama `buscar_global` una sola vez por consulta.
 *
 * La RPC devuelve `estado` y `etiquetas` crudos ('abierta', '01', 'efectivo'…)
 * y deja el mapeo al lado de la app (encabezado de la migración): aquí, en el
 * borde, se valida la forma con zod y se formatea cada fila al contrato
 * `RespuestaBusqueda` antes de que llegue a la ventana.
 *
 * `null` significa «no se pudo buscar» (término corto, error o RPC ausente):
 * la ventana responde con el fallback (recientes, navegación y datos de
 * ejemplo mientras la migración no esté aplicada).
 */

/** Con menos de 2 caracteres el término no aporta resultados (§3.5). */
const MINIMO_CARACTERES = 2;

/** Tope de tarjetas por grupo en modo «todos» (§3.5). */
const LIMITE_TODOS = 4;

/** Tope de tarjetas en modo categoría (§3.5). */
const LIMITE_CATEGORIA = 20;

// ---------------------------------------------------------------------------
// Forma cruda de la RPC (antes de formatear).
// ---------------------------------------------------------------------------

const filaCruda = z.object({
  entidad: z.string(),
  id: z.string(),
  titulo: z.string(),
  subtitulo: z.string(),
  etiquetas: z.array(z.string()),
  estado: z.string().nullable(),
  fecha: z.string().nullable(),
  /** El SQL lo entrega como texto (`monto::text`); nunca número flotante. */
  monto: z.string().nullable(),
  rango: z.number(),
});

const respuestaCruda = z.object({
  grupos: z.array(
    z.object({
      grupo: z.string(),
      entidad: z.string(),
      total: z.number(),
      resultados: z.array(filaCruda),
    }),
  ),
  total: z.number(),
  hayMas: z.boolean(),
  ms: z.number(),
});

/** Fila cruda cuya entidad ya se validó contra el catálogo. */
type FilaValida = z.infer<typeof filaCruda> & { entidad: EntidadBusqueda };

const GRUPOS_POSIBLES = new Set<string>(["clientes", "productos", "facturacion", "compras", "documentos", "otros"]);

const ENTIDADES_POSIBLES = new Set<string>([
  "contacto",
  "producto",
  "factura",
  "nota_credito_venta",
  "nota_debito_venta",
  "cotizacion",
  "remision",
  "factura_recurrente",
  "pago_recibido",
  "factura_proveedor",
  "nota_credito_compra",
  "orden_compra",
  "pago_proveedor",
  "gasto_menor",
  "asiento",
  "cuenta",
  "reporte",
  "navegacion",
  "documento",
]);

function esGrupo(valor: string): valor is GrupoBusqueda {
  return GRUPOS_POSIBLES.has(valor);
}

function esEntidad(valor: string): valor is EntidadBusqueda {
  return ENTIDADES_POSIBLES.has(valor);
}

// ---------------------------------------------------------------------------
// Formateo de crudo → contrato (§2.3).
// ---------------------------------------------------------------------------

type EstadoFormateado = NonNullable<ResultadoBusqueda["estado"]>;

/**
 * Estados crudos de las tablas (sus checks: abierta/pagada/anulada en
 * documentos, activa/anulada en notas, activo/anulado en pagos y gastos,
 * convertida en cotizaciones y órdenes) → pastilla. Los textos y tonos son los
 * de las listas de cada módulo.
 */
const ESTADOS: Record<string, EstadoFormateado> = {
  abierta: { texto: "Abierta", tono: "pendiente" },
  convertida: { texto: "Convertida", tono: "exito" },
  pagada: { texto: "Pagada", tono: "exito" },
  activa: { texto: "Activa", tono: "exito" },
  activo: { texto: "Activo", tono: "exito" },
  anulada: { texto: "Anulada", tono: "peligro" },
  anulado: { texto: "Anulado", tono: "peligro" },
};

/** Etiquetas de asiento que no salen de una simple capitalización. */
const ETIQUETAS_ASIENTO: Record<string, string> = {
  pago_recibido: "Pago recibido",
  factura_proveedor: "Factura de proveedor",
  pago_proveedor: "Pago a proveedor",
  gasto_menor: "Gasto menor",
  anulacion: "Anulación",
  deposito: "Depósito",
};

/** Entidades cuyo título de la RPC es un número pelado (§2.3: «N.º 1258»). */
const ENTIDADES_NUMERO = new Set<EntidadBusqueda>([
  "cotizacion",
  "remision",
  "factura_recurrente",
  "pago_recibido",
  "factura_proveedor",
  "orden_compra",
  "pago_proveedor",
  "asiento",
]);

/** 'cliente' → 'Cliente', 'efectivo' → 'Efectivo' (valor crudo de la base). */
function capitalizar(valor: string): string {
  return valor.length === 0 ? valor : valor.charAt(0).toLocaleUpperCase("es") + valor.slice(1);
}

function formatearEstado(entidad: EntidadBusqueda, crudo: string | null): EstadoFormateado | null {
  if (crudo == null) return null;

  // La factura de venta usa el vocabulario de la lista de facturación.
  if (entidad === "factura") {
    if (crudo === "abierta") return { texto: "Por cobrar", tono: "pendiente" };
    if (crudo === "pagada") return { texto: "Cobrada", tono: "exito" };
  }

  // Un estado desconocido se muestra tal cual, sin tono: nunca se inventa.
  return ESTADOS[crudo] ?? { texto: crudo, tono: "neutro" };
}

function formatearEtiquetas(entidad: EntidadBusqueda, crudas: string[]): string[] {
  if (entidad === "factura") return crudas.map(etiquetaTipoComprobante);
  if (entidad === "asiento") return crudas.map((valor) => ETIQUETAS_ASIENTO[valor] ?? capitalizar(valor));
  return crudas.map(capitalizar);
}

function formatearTitulo(entidad: EntidadBusqueda, titulo: string): string {
  if (ENTIDADES_NUMERO.has(entidad)) return `N.º ${titulo}`;
  // El gasto menor titula con el NCF cuando lo hay y con el número si no.
  if (entidad === "gasto_menor" && /^\d+$/.test(titulo)) return `N.º ${titulo}`;
  return titulo;
}

function formatearFila(fila: FilaValida): ResultadoBusqueda {
  return {
    entidad: fila.entidad,
    id: fila.id,
    titulo: formatearTitulo(fila.entidad, fila.titulo),
    subtitulo: fila.subtitulo,
    etiquetas: formatearEtiquetas(fila.entidad, fila.etiquetas),
    estado: formatearEstado(fila.entidad, fila.estado),
    fecha: fila.fecha,
    monto: fila.monto,
    rango: fila.rango,
  };
}

/**
 * Valida la respuesta cruda con zod y la formatea al contrato. Si la RPC
 * cambia de forma (o trae grupos o entidades que la ventana no conoce), se
 * descarta lo desconocido; si la forma no pasa la validación, devuelve `null`
 * para que la ventana use el fallback.
 */
function formatearRespuesta(crudo: unknown): RespuestaBusqueda | null {
  const parseo = respuestaCruda.safeParse(crudo);
  if (!parseo.success) {
    console.error("buscar_global devolvió una respuesta inesperada", parseo.error);
    return null;
  }

  const grupos: RespuestaBusqueda["grupos"] = [];
  for (const grupo of parseo.data.grupos) {
    if (!esGrupo(grupo.grupo) || !esEntidad(grupo.entidad)) continue;

    grupos.push({
      grupo: grupo.grupo,
      entidad: grupo.entidad,
      total: grupo.total,
      resultados: grupo.resultados.flatMap((fila): ResultadoBusqueda[] =>
        esEntidad(fila.entidad) ? [formatearFila({ ...fila, entidad: fila.entidad })] : [],
      ),
    });
  }

  return { grupos, total: parseo.data.total, hayMas: parseo.data.hayMas, ms: parseo.data.ms };
}

// ---------------------------------------------------------------------------
// Payload y acciones.
// ---------------------------------------------------------------------------

/** Claves de `p` que la RPC sabe leer (§3.2). */
interface PayloadBusqueda {
  texto?: string;
  entidad?: string;
  ncf?: string;
  numero?: number;
  identificacion?: string;
  desde?: string;
  hasta?: string;
  monto?: number;
  limite: number;
}

/**
 * Arma el payload desde la intención del parser. `entidad` solo la fija la
 * categoría del rail (modo categoría, §3.5): la entidad que el parser dedujo
 * de la frase es una pista de ranking y no filtra.
 */
function construirPayload(intencion: IntencionBusqueda, limite: number, entidad?: string): PayloadBusqueda {
  const p: PayloadBusqueda = { limite };

  if (intencion.texto != null) p.texto = intencion.texto;
  if (intencion.ncf != null) p.ncf = intencion.ncf;
  if (intencion.numero != null) p.numero = intencion.numero;
  if (intencion.identificacion != null) p.identificacion = intencion.identificacion;
  if (intencion.desde != null) p.desde = intencion.desde;
  if (intencion.hasta != null) p.hasta = intencion.hasta;
  if (intencion.monto != null) p.monto = intencion.monto;
  if (entidad != null) p.entidad = entidad;

  return p;
}

async function consultar(termino: string, limite: number, categoria?: string): Promise<RespuestaBusqueda | null> {
  if (termino.trim().length < MINIMO_CARACTERES) return null;

  const entidad = categoria?.trim() ?? "";
  const p = construirPayload(interpretar(termino), limite, entidad.length > 0 ? entidad : undefined);

  // La migración de buscar_global aún no está aplicada, así que la RPC no
  // figura en los tipos generados y el cliente se tipa sin esquema (el patrón
  // de bancos y cotizaciones). Cuando se aplique y `pnpm db:types` la
  // registre, vuelve el cliente tipado y sobra el cast.
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await supabase.rpc("buscar_global", { p });

  // RPC ausente o error: la ventana se queda con el fallback.
  if (error != null || data == null) return null;

  return formatearRespuesta(data);
}

/**
 * Busca en todas las entidades (modo «todos», 4 resultados por grupo). El
 * término pasa por el parser determinista para extraer NCF, número, RNC,
 * fechas y monto antes de tocar la base.
 */
export async function buscarGlobal(termino: string): Promise<RespuestaBusqueda | null> {
  return consultar(termino, LIMITE_TODOS);
}

/**
 * Busca con una categoría del rail fijada ('clientes', 'compras', …) o una
 * entidad concreta ('factura'): la RPC entra en modo categoría (20 resultados
 * y las fechas filtran en vez de solo ordenar).
 */
export async function buscarGlobalPorCategoria(termino: string, categoria: string): Promise<RespuestaBusqueda | null> {
  return consultar(termino, LIMITE_CATEGORIA, categoria);
}

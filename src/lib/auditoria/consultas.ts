"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export interface CambioAuditoria {
  campo: string;
  anterior: string | null;
  nuevo: string | null;
}

export interface EntradaAuditoria {
  id: string;
  usuario_id: string | null;
  usuario_nombre: string;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  entidad_etiqueta: string;
  cambios: CambioAuditoria[];
  creado_en: string;
}

export interface UsuarioAuditoria {
  id: string;
  nombre: string;
}

export interface RespuestaAuditoria {
  total: number;
  entradas: EntradaAuditoria[];
  /** Solo se llena cuando el filtro pide `usuarios: true` (opciones del select). */
  usuarios: UsuarioAuditoria[];
}

export interface FiltrosAuditoria {
  entidad?: string;
  entidadId?: string;
  usuarioId?: string;
  accion?: string;
  /** `yyyy-MM-dd`. */
  desde?: string;
  /** `yyyy-MM-dd`. */
  hasta?: string;
  limite?: number;
  desplazamiento?: number;
  usuarios?: boolean;
}

// ---------------------------------------------------------------------------
// Forma cruda de la RPC (antes de entregarla a la pantalla).
// ---------------------------------------------------------------------------

const cambioCrudo = z.object({
  campo: z.string(),
  anterior: z.string().nullable(),
  nuevo: z.string().nullable(),
});

const entradaCruda = z.object({
  id: z.string(),
  usuario_id: z.string().nullable(),
  usuario_nombre: z.string(),
  accion: z.string(),
  entidad: z.string(),
  entidad_id: z.string().nullable(),
  entidad_etiqueta: z.string(),
  cambios: z.array(cambioCrudo),
  creado_en: z.string(),
});

const respuestaCruda = z.object({
  total: z.number(),
  entradas: z.array(entradaCruda),
  usuarios: z.array(
    z.object({
      id: z.string(),
      nombre: z.string(),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Payload: solo claves que la RPC sabe leer, con valores saneados.
// ---------------------------------------------------------------------------

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ACCIONES = new Set(["crear", "modificar", "anular"]);

/** Tope duro de la RPC (ver obtener_auditoria en la migración). */
const LIMITE_MAXIMO = 100;

interface PayloadAuditoria {
  entidad?: string;
  entidad_id?: string;
  usuario_id?: string;
  accion?: string;
  desde?: string;
  hasta?: string;
  limite?: number;
  desplazamiento?: number;
  usuarios?: boolean;
}

function texto(valor: string | undefined): string | undefined {
  const limpio = valor?.trim() ?? "";
  return limpio === "" ? undefined : limpio;
}

function uuidOpcional(valor: string | undefined): string | undefined {
  const limpio = texto(valor);
  return limpio != null && REGEX_UUID.test(limpio) ? limpio : undefined;
}

function fechaOpcional(valor: string | undefined): string | undefined {
  const limpio = texto(valor);
  return limpio != null && REGEX_FECHA.test(limpio) ? limpio : undefined;
}

function accionOpcional(accion: string | undefined): string | undefined {
  const limpio = texto(accion);
  return limpio != null && ACCIONES.has(limpio) ? limpio : undefined;
}

function limiteOpcional(limite: number | undefined): number | undefined {
  return Number.isInteger(limite) ? Math.min(Math.max(limite ?? 25, 1), LIMITE_MAXIMO) : undefined;
}

function desplazamientoOpcional(desplazamiento: number | undefined): number | undefined {
  return Number.isInteger(desplazamiento) && (desplazamiento ?? 0) > 0 ? desplazamiento : undefined;
}

/**
 * Los filtros inválidos se descartan (la RPC vuelve a validar todo). Las
 * claves con `undefined` no viajan en el JSON de la llamada.
 */
function construirPayload(filtros: FiltrosAuditoria): PayloadAuditoria {
  return {
    entidad: texto(filtros.entidad),
    entidad_id: uuidOpcional(filtros.entidadId),
    usuario_id: uuidOpcional(filtros.usuarioId),
    accion: accionOpcional(filtros.accion),
    desde: fechaOpcional(filtros.desde),
    hasta: fechaOpcional(filtros.hasta),
    limite: limiteOpcional(filtros.limite),
    desplazamiento: desplazamientoOpcional(filtros.desplazamiento),
    usuarios: filtros.usuarios === true ? true : undefined,
  };
}

/**
 * Consulta la auditoría (pantalla de administración y pestaña Historial).
 * `null` significa «no se pudo consultar» (RPC ausente o con errores): la
 * pantalla responde con su estado de error.
 */
export async function consultarAuditoria(filtros: FiltrosAuditoria): Promise<RespuestaAuditoria | null> {
  const p = construirPayload(filtros);

  // obtener_auditoria todavía no figura en los tipos generados (haría falta
  // `pnpm db:types` tras aplicar la migración), así que el cliente se tipa sin
  // esquema, como en la búsqueda global y bancos.
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await supabase.rpc("obtener_auditoria", { p });

  if (error != null || data == null) {
    console.error("obtener_auditoria falló", error?.message ?? "sin datos");
    return null;
  }

  const parseo = respuestaCruda.safeParse(data);
  if (!parseo.success) {
    console.error("obtener_auditoria devolvió una respuesta inesperada", parseo.error);
    return null;
  }

  return parseo.data;
}

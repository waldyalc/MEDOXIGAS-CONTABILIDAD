import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/supabase/types";

/**
 * Puente tipado para las RPC de nómina que aún no existen en
 * `src/lib/supabase/types.ts`.
 *
 * Las migraciones 3A y 3B de `main` trajeron los catálogos y el motor
 * (periodos, recibos, cálculo, contabilización, pagos, anulaciones y
 * lecturas), pero **no** las RPC de configuración, empleados y novedades
 * recurrentes que describe `docs/dominio-nomina.md` §6.2–6.3. Este archivo
 * declara su contrato exacto para que las acciones ya queden cableadas:
 *
 *   nomina_guardar_config_empresa(p jsonb) returns void
 *   nomina_guardar_mapeo_contable(p jsonb) returns integer
 *   nomina_guardar_parametros_rd(p jsonb) returns void
 *   nomina_crear_empleado(p jsonb) returns uuid
 *   nomina_actualizar_empleado(p_id uuid, p jsonb) returns uuid
 *   nomina_cambiar_estado_empleado(p_id uuid, p_estado text, p_fecha_fin date) returns uuid
 *   nomina_guardar_novedad_recurrente(p jsonb) returns uuid
 *   nomina_eliminar_novedad_recurrente(p_id uuid) returns void
 *
 * Cuando esas funciones entren a la base y se regenere `types.ts` con
 * `pnpm db:types`, este puente se elimina y las acciones siguen igual: llaman
 * `supabase.rpc("nombre", args)` directo, sin extraer el método.
 */

interface RpcNominaPendientes {
  nomina_guardar_config_empresa: { Args: { p: Json }; Returns: undefined };
  nomina_guardar_mapeo_contable: { Args: { p: Json }; Returns: number };
  nomina_guardar_parametros_rd: { Args: { p: Json }; Returns: undefined };
  nomina_crear_empleado: { Args: { p: Json }; Returns: string };
  nomina_actualizar_empleado: { Args: { p_id: string; p: Json }; Returns: string };
  nomina_cambiar_estado_empleado: {
    Args: { p_id: string; p_estado: string; p_fecha_fin?: string | null };
    Returns: string;
  };
  nomina_guardar_novedad_recurrente: { Args: { p: Json }; Returns: string };
  nomina_eliminar_novedad_recurrente: { Args: { p_id: string }; Returns: undefined };
}

type ClienteNomina = SupabaseClient<Database> & {
  rpc<Fn extends keyof RpcNominaPendientes>(
    fn: Fn,
    args: RpcNominaPendientes[Fn]["Args"],
  ): PromiseLike<{ data: RpcNominaPendientes[Fn]["Returns"] | null; error: PostgrestError | null }>;
};

/** Tipa el cliente con las RPC pendientes sin tocar `types.ts` (generado). */
export function clienteNominaPendiente(cliente: SupabaseClient<Database>): ClienteNomina {
  return cliente as ClienteNomina;
}

export type { ClienteNomina };

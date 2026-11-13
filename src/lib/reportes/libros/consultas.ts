import { createClient } from "@/lib/supabase/server";

import type { CuentaContable } from "../tipos";
import type { ContactoOpcion, FilaMovimiento, FilaSaldoCuenta, FilaSaldoTercero, RespuestaReporte } from "./tipos";

interface RpcResultado<T> {
  data: T[] | null;
  error: { message: string } | null;
}

type RpcSuelta = <T>(fn: string, args: Record<string, unknown>) => PromiseLike<RpcResultado<T>>;

export interface FiltrosMovimientos {
  desde: string;
  hasta: string;
  cuentas?: readonly string[];
  contacto?: string | null;
  origenes?: readonly string[];
}

export interface FiltrosSaldosTercero {
  cuentas?: readonly string[];
  contacto?: string | null;
  incluirCero?: boolean;
}

function lista(valores: readonly string[] | undefined): string[] | null {
  return valores && valores.length > 0 ? [...valores] : null;
}

export async function obtenerMovimientos(filtros: FiltrosMovimientos): Promise<RespuestaReporte<FilaMovimiento>> {
  const supabase = await createClient();
  const rpc = supabase.rpc as unknown as RpcSuelta;
  const { data, error } = await rpc<FilaMovimiento>("reporte_movimientos", {
    p_desde: filtros.desde,
    p_hasta: filtros.hasta,
    p_cuentas: lista(filtros.cuentas),
    p_contacto: filtros.contacto ?? null,
    p_origenes: lista(filtros.origenes),
  });

  if (error) return { filas: [], error: error.message };
  return { filas: data ?? [], error: null };
}

export async function obtenerSaldosTercero(
  desde: string,
  hasta: string,
  filtros: FiltrosSaldosTercero = {},
): Promise<RespuestaReporte<FilaSaldoTercero>> {
  const supabase = await createClient();
  const rpc = supabase.rpc as unknown as RpcSuelta;
  const { data, error } = await rpc<FilaSaldoTercero>("reporte_saldos_tercero", {
    p_desde: desde,
    p_hasta: hasta,
    p_cuentas: lista(filtros.cuentas),
    p_contacto: filtros.contacto ?? null,
    p_incluir_cero: filtros.incluirCero ?? false,
  });

  if (error) return { filas: [], error: error.message };
  return { filas: data ?? [], error: null };
}

export async function obtenerSaldosCuentas(
  desde: string,
  hasta: string,
  cierreAnual: boolean,
  cuentas?: readonly string[],
): Promise<RespuestaReporte<FilaSaldoCuenta>> {
  const supabase = await createClient();
  const rpc = supabase.rpc as unknown as RpcSuelta;
  const { data, error } = await rpc<FilaSaldoCuenta>("reporte_saldos_cuentas", {
    p_desde: desde,
    p_hasta: hasta,
    p_cierre_anual: cierreAnual,
    p_cuentas: lista(cuentas),
  });

  if (error) return { filas: [], error: error.message };
  return { filas: data ?? [], error: null };
}

export async function obtenerContactos(): Promise<RespuestaReporte<ContactoOpcion>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("contactos").select("id, nombre").eq("activo", true).order("nombre");

  if (error) return { filas: [], error: error.message };
  return { filas: (data ?? []) as unknown as ContactoOpcion[], error: null };
}

export async function obtenerCuentas(): Promise<RespuestaReporte<CuentaContable>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cuentas")
    .select("id, codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos, activa")
    .order("codigo");

  if (error) return { filas: [], error: error.message };
  return { filas: (data ?? []) as unknown as CuentaContable[], error: null };
}

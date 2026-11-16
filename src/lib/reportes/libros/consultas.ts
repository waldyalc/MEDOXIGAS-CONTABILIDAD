import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

import type { CuentaContable } from "../tipos";
import type { ContactoOpcion, FilaMovimiento, FilaSaldoCuenta, FilaSaldoTercero, RespuestaReporte } from "./tipos";

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

function lista(valores: readonly string[] | undefined): string[] | undefined {
  return valores && valores.length > 0 ? [...valores] : undefined;
}

export async function obtenerMovimientos(filtros: FiltrosMovimientos): Promise<RespuestaReporte<FilaMovimiento>> {
  const supabase = await createClient();
  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase
      .rpc("reporte_movimientos", {
        p_desde: filtros.desde,
        p_hasta: filtros.hasta,
        p_cuentas: lista(filtros.cuentas),
        p_contacto: filtros.contacto ?? undefined,
        p_origenes: lista(filtros.origenes),
      })
      .order("fecha")
      .order("asiento_numero")
      .order("cuenta_codigo")
      .range(inicio, fin),
  );

  if (error) return { filas: [], error: error.message };
  return { filas: data ?? [], error: null };
}

export async function obtenerSaldosTercero(
  desde: string,
  hasta: string,
  filtros: FiltrosSaldosTercero = {},
): Promise<RespuestaReporte<FilaSaldoTercero>> {
  const supabase = await createClient();
  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase
      .rpc("reporte_saldos_tercero", {
        p_desde: desde,
        p_hasta: hasta,
        p_cuentas: lista(filtros.cuentas),
        p_contacto: filtros.contacto ?? undefined,
        p_incluir_cero: filtros.incluirCero ?? false,
      })
      .order("cuenta_codigo")
      .order("contacto_id")
      .range(inicio, fin),
  );

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
  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase
      .rpc("reporte_saldos_cuentas", {
        p_desde: desde,
        p_hasta: hasta,
        p_cierre_anual: cierreAnual,
        p_cuentas: lista(cuentas),
      })
      .order("cuenta_codigo")
      .order("cuenta_id")
      .range(inicio, fin),
  );

  if (error) return { filas: [], error: error.message };
  return { filas: data ?? [], error: null };
}

export async function obtenerContactos(): Promise<RespuestaReporte<ContactoOpcion>> {
  const supabase = await createClient();
  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase.from("contactos").select("id, nombre").eq("activo", true).order("nombre").order("id").range(inicio, fin),
  );

  if (error) return { filas: [], error: error.message };
  return { filas: (data ?? []) as unknown as ContactoOpcion[], error: null };
}

export async function obtenerCuentas(): Promise<RespuestaReporte<CuentaContable>> {
  const supabase = await createClient();
  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase
      .from("cuentas")
      .select("id, codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos, activa")
      .order("codigo")
      .range(inicio, fin),
  );

  if (error) return { filas: [], error: error.message };
  return { filas: (data ?? []) as unknown as CuentaContable[], error: null };
}

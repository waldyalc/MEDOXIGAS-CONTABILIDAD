import { indexarSaldosPorCodigo } from "@/lib/contabilidad/catalogo";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

import { hoyRd } from "./fechas";
import type {
  CuentaContable,
  FilaBalanceComprobacion,
  FilaConfigContable,
  FilaCxc,
  FilaEstadoResultados,
  FilaLibroDiario,
  FilaSaldoCuenta,
} from "./tipos";

export interface RespuestaReporte<T> {
  filas: T[];
  error: string | null;
}

export async function obtenerLibroDiario(desde: string, hasta: string): Promise<RespuestaReporte<FilaLibroDiario>> {
  const supabase = await createClient();
  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase
      .rpc("reporte_libro_diario", { p_desde: desde, p_hasta: hasta })
      .order("asiento_numero")
      .order("cuenta_codigo")
      .range(inicio, fin),
  );

  if (error) return { filas: [], error: error.message };
  return { filas: (data ?? []) as unknown as FilaLibroDiario[], error: null };
}

export async function obtenerBalanceComprobacion(
  desde: string,
  hasta: string,
): Promise<RespuestaReporte<FilaBalanceComprobacion>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reporte_balance_comprobacion", {
    p_desde: desde,
    p_hasta: hasta,
  });

  if (error) return { filas: [], error: error.message };
  return { filas: (data ?? []) as unknown as FilaBalanceComprobacion[], error: null };
}

export async function obtenerEstadoResultados(
  desde: string,
  hasta: string,
): Promise<RespuestaReporte<FilaEstadoResultados>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reporte_estado_resultados", {
    p_desde: desde,
    p_hasta: hasta,
  });

  if (error) return { filas: [], error: error.message };
  return { filas: (data ?? []) as unknown as FilaEstadoResultados[], error: null };
}
export async function obtenerCxc(fecha: string): Promise<RespuestaReporte<FilaCxc>> {
  const supabase = await createClient();
  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase.rpc("reporte_cxc", { p_fecha: fecha }).order("numero").order("factura_id").range(inicio, fin),
  );

  if (error) return { filas: [], error: error.message };
  return { filas: (data ?? []) as unknown as FilaCxc[], error: null };
}

export interface RespuestaCatalogo {
  cuentas: CuentaContable[];
  configuracion: FilaConfigContable[];
  saldos: Record<string, number>;
  error: string | null;
}

export async function obtenerCatalogoContable(): Promise<RespuestaCatalogo> {
  const supabase = await createClient();
  const [cuentas, configuracion, saldosCuentas] = await Promise.all([
    supabase
      .from("cuentas")
      .select(
        "id, codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos, activa, descripcion, es_caja_banco, tipo_banco",
      )
      .order("codigo"),
    supabase.from("config_contable").select("clave, cuenta_id"),
    supabase.rpc("catalogo_saldos", { p_hasta: hoyRd() }),
  ]);

  if (cuentas.error) {
    return { cuentas: [], configuracion: [], saldos: {}, error: cuentas.error.message };
  }

  const filasSaldos = saldosCuentas.error ? [] : ((saldosCuentas.data ?? []) as unknown as FilaSaldoCuenta[]);

  return {
    cuentas: (cuentas.data ?? []) as unknown as CuentaContable[],
    configuracion: (configuracion.data ?? []) as unknown as FilaConfigContable[],
    saldos: indexarSaldosPorCodigo(filasSaldos),
    error: null,
  };
}

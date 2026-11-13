import { createClient } from "@/lib/supabase/server";

import { centavos } from "../dinero";
import type { FilaBalanceComprobacion, FilaEstadoResultados } from "../tipos";
import { compararPeriodoAnioAnterior, finAnioAnterior, periodoAnterior, restarAnio, sumarDias } from "./fechas";
import { calcularFlujoEfectivo } from "./flujo";
import { calcularEstadoResultadosComparativo } from "./resultados";
import { calcularSituacionFinanciera, utilidadDesdeBalance } from "./situacion";
import type {
  CuentaEstado,
  EstadoResultadosComparativo,
  FlujoEfectivoCalculado,
  OpcionesReporte,
  SituacionFinancieraCalculada,
} from "./tipos";

export interface RespuestaEstado<T> {
  reporte: T | null;
  error: string | null;
}

interface FilasReporte<T> {
  filas: T[];
  error: string | null;
}

type ClienteSupabase = Awaited<ReturnType<typeof createClient>>;

async function consultarCuentas(supabase: ClienteSupabase): Promise<FilasReporte<CuentaEstado>> {
  const { data, error } = await supabase
    .from("cuentas")
    .select("id, codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos, es_caja_banco")
    .order("codigo");

  if (error) return { filas: [], error: error.message };
  return { filas: (data ?? []) as unknown as CuentaEstado[], error: null };
}

async function consultarBalance(
  supabase: ClienteSupabase,
  desde: string,
  hasta: string,
): Promise<FilasReporte<FilaBalanceComprobacion>> {
  const { data, error } = await supabase.rpc("reporte_balance_comprobacion", {
    p_desde: desde,
    p_hasta: hasta,
  });

  if (error) return { filas: [], error: error.message };
  return { filas: (data ?? []) as unknown as FilaBalanceComprobacion[], error: null };
}

function saldosDesdeFilas(filas: readonly FilaBalanceComprobacion[]): Record<string, number> {
  const saldos: Record<string, number> = {};

  for (const fila of filas) {
    saldos[fila.cuenta_codigo] = centavos(fila.saldo);
  }

  return saldos;
}

export async function obtenerEstadoResultadosComparativo(
  desde: string,
  hasta: string,
  opciones: OpcionesReporte = {},
): Promise<RespuestaEstado<EstadoResultadosComparativo>> {
  const supabase = await createClient();
  const anterior = compararPeriodoAnioAnterior(desde, hasta);
  const centro = opciones.centroCostoId ?? null;
  const [actual, previo] = await Promise.all([
    supabase.rpc("reporte_estado_resultados_centro", {
      p_desde: desde,
      p_hasta: hasta,
      p_centro_costo: centro ?? undefined,
    }),
    supabase.rpc("reporte_estado_resultados_centro", {
      p_desde: anterior.desde,
      p_hasta: anterior.hasta,
      p_centro_costo: centro ?? undefined,
    }),
  ]);

  if (actual.error) return { reporte: null, error: actual.error.message };
  if (previo.error) return { reporte: null, error: previo.error.message };

  const filasActuales = (actual.data ?? []) as unknown as FilaEstadoResultados[];
  const filasAnteriores = (previo.data ?? []) as unknown as FilaEstadoResultados[];

  return {
    reporte: calcularEstadoResultadosComparativo(filasActuales, filasAnteriores, opciones),
    error: null,
  };
}

export async function obtenerSituacionFinanciera(
  hasta: string,
  opciones: OpcionesReporte = {},
): Promise<RespuestaEstado<SituacionFinancieraCalculada>> {
  const anterior = restarAnio(hasta);
  const supabase = await createClient();
  const [cuentas, actual, previo, limiteActual, limiteAnterior] = await Promise.all([
    consultarCuentas(supabase),
    consultarBalance(supabase, "1900-01-01", hasta),
    consultarBalance(supabase, "1900-01-01", anterior),
    consultarBalance(supabase, "1900-01-01", finAnioAnterior(hasta)),
    consultarBalance(supabase, "1900-01-01", finAnioAnterior(anterior)),
  ]);

  if (cuentas.error) return { reporte: null, error: cuentas.error };
  if (actual.error) return { reporte: null, error: actual.error };
  if (previo.error) return { reporte: null, error: previo.error };
  if (limiteActual.error) return { reporte: null, error: limiteActual.error };
  if (limiteAnterior.error) return { reporte: null, error: limiteAnterior.error };

  const utilidadActual = utilidadDesdeBalance(actual.filas);
  const utilidadPrevia = utilidadDesdeBalance(previo.filas);
  const utilidadLimiteActual = utilidadDesdeBalance(limiteActual.filas);
  const utilidadLimiteAnterior = utilidadDesdeBalance(limiteAnterior.filas);

  return {
    reporte: calcularSituacionFinanciera(
      {
        cuentas: cuentas.filas,
        saldosActuales: saldosDesdeFilas(actual.filas),
        saldosAnteriores: saldosDesdeFilas(previo.filas),
        utilidadEjercicio: utilidadActual - utilidadLimiteActual,
        utilidadEjercicioAnterior: utilidadPrevia - utilidadLimiteAnterior,
        utilidadAnterior: utilidadLimiteActual,
        utilidadAnteriorAnterior: utilidadLimiteAnterior,
      },
      opciones,
    ),
    error: null,
  };
}

export async function obtenerFlujoEfectivo(
  desde: string,
  hasta: string,
  opciones: OpcionesReporte = {},
): Promise<RespuestaEstado<FlujoEfectivoCalculado>> {
  const supabase = await createClient();
  const anterior = periodoAnterior(desde, hasta);
  const [cuentas, resultadosActuales, resultadosAnteriores, inicioActual, finActual, inicioAnterior, finAnterior] =
    await Promise.all([
      consultarCuentas(supabase),
      supabase.rpc("reporte_estado_resultados", { p_desde: desde, p_hasta: hasta }),
      supabase.rpc("reporte_estado_resultados", { p_desde: anterior.desde, p_hasta: anterior.hasta }),
      consultarBalance(supabase, "1900-01-01", sumarDias(desde, -1)),
      consultarBalance(supabase, "1900-01-01", hasta),
      consultarBalance(supabase, "1900-01-01", sumarDias(anterior.desde, -1)),
      consultarBalance(supabase, "1900-01-01", anterior.hasta),
    ]);

  if (cuentas.error) return { reporte: null, error: cuentas.error };
  if (resultadosActuales.error) return { reporte: null, error: resultadosActuales.error.message };
  if (resultadosAnteriores.error) return { reporte: null, error: resultadosAnteriores.error.message };
  if (inicioActual.error) return { reporte: null, error: inicioActual.error };
  if (finActual.error) return { reporte: null, error: finActual.error };
  if (inicioAnterior.error) return { reporte: null, error: inicioAnterior.error };
  if (finAnterior.error) return { reporte: null, error: finAnterior.error };

  return {
    reporte: calcularFlujoEfectivo(
      {
        cuentas: cuentas.filas,
        actual: {
          resultados: (resultadosActuales.data ?? []) as unknown as FilaEstadoResultados[],
          saldosInicio: saldosDesdeFilas(inicioActual.filas),
          saldosFin: saldosDesdeFilas(finActual.filas),
        },
        anterior: {
          resultados: (resultadosAnteriores.data ?? []) as unknown as FilaEstadoResultados[],
          saldosInicio: saldosDesdeFilas(inicioAnterior.filas),
          saldosFin: saldosDesdeFilas(finAnterior.filas),
        },
      },
      opciones,
    ),
    error: null,
  };
}

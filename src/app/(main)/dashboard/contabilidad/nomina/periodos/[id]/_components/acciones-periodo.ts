"use server";

import { getRol } from "@/lib/auth/rol";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { idSchema } from "@/lib/nomina/esquemas";
import type { EstadoNomina } from "@/lib/nomina/tipos";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

export interface FilaEmpleadoAgregable {
  empleado_id: string;
  nombre: string;
  cargo: string | null;
  /** Estado del recibo del empleado en este periodo, o null si aún no tiene. */
  recibo_estado: EstadoNomina | null;
}

export type ResultadoEmpleadosAgregables = { ok: true; filas: FilaEmpleadoAgregable[] } | { ok: false; error: string };

interface FilaPeriodoCruda {
  frecuencia: string;
  fecha_inicio: string;
  fecha_fin: string;
}

interface EmpleadoCrudo {
  id: string;
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  cargo: string | null;
}

interface ReciboCrudo {
  empleado_id: string;
  estado: string;
}

const ESTADOS: readonly EstadoNomina[] = ["borrador", "calculado", "contabilizado", "pagado", "anulado"];

function aEstado(valor: string): EstadoNomina {
  return ESTADOS.find((estado) => estado === valor) ?? "borrador";
}

function nombreCompleto(empleado: EmpleadoCrudo): string {
  return [empleado.primer_nombre, empleado.segundo_nombre, empleado.primer_apellido, empleado.segundo_apellido]
    .filter((parte): parte is string => Boolean(parte?.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lectura puntual del diálogo «Agregar empleados»: empleados elegibles del
 * periodo — activos, de la misma frecuencia y con contrato vigente dentro del
 * rango, el mismo filtro de elegibilidad de `nomina_agregar_empleados` — con el
 * estado de su recibo en este periodo si ya existe.
 */
export async function leerEmpleadosAgregables(periodoId: string): Promise<ResultadoEmpleadosAgregables> {
  const rol = await getRol();
  if (rol == null) return { ok: false, error: "No tienes permiso para ver los empleados del periodo." };
  if (!idSchema.safeParse(periodoId).success) return { ok: false, error: "El periodo no es válido." };

  const supabase = await createClient();

  const { data: periodo, error: errorPeriodo } = await supabase
    .from("nomina_periodos")
    .select("frecuencia, fecha_inicio, fecha_fin")
    .eq("id", periodoId)
    .maybeSingle<FilaPeriodoCruda>();

  if (errorPeriodo) return { ok: false, error: mensajeErrorRpc(errorPeriodo) };
  if (!periodo) return { ok: false, error: "El periodo no existe." };

  const [empleados, recibos] = await Promise.all([
    paginarConsulta((inicio, fin) =>
      supabase
        .from("empleados")
        .select("id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, cargo")
        .eq("estado", "activo")
        .eq("frecuencia_pago", periodo.frecuencia)
        .lte("fecha_ingreso", periodo.fecha_fin)
        .or(`fecha_fin.is.null,fecha_fin.gte.${periodo.fecha_inicio}`)
        .order("primer_apellido")
        .order("primer_nombre")
        .order("id")
        .range(inicio, fin)
        .returns<EmpleadoCrudo[]>(),
    ),
    paginarConsulta((inicio, fin) =>
      supabase
        .from("nomina_recibos")
        .select("empleado_id, estado")
        .eq("periodo_id", periodoId)
        .order("empleado_id")
        .range(inicio, fin)
        .returns<ReciboCrudo[]>(),
    ),
  ]);

  if (empleados.error) return { ok: false, error: mensajeErrorRpc(empleados.error) };
  if (recibos.error) return { ok: false, error: mensajeErrorRpc(recibos.error) };

  const estadoPorEmpleado = new Map<string, EstadoNomina>();
  for (const recibo of recibos.data ?? []) {
    estadoPorEmpleado.set(recibo.empleado_id, aEstado(recibo.estado));
  }

  const filas: FilaEmpleadoAgregable[] = (empleados.data ?? []).map((empleado) => ({
    empleado_id: empleado.id,
    nombre: nombreCompleto(empleado),
    cargo: empleado.cargo,
    recibo_estado: estadoPorEmpleado.get(empleado.id) ?? null,
  }));

  return { ok: true, filas };
}

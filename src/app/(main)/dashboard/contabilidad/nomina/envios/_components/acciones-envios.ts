"use server";

import { getRol } from "@/lib/auth/rol";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { idSchema } from "@/lib/nomina/esquemas";
import type { EstadoNomina } from "@/lib/nomina/tipos";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

export interface FilaColilla {
  recibo_id: string;
  empleado_id: string;
  nombre: string;
  correo: string | null;
  estado: EstadoNomina;
  colilla_enviada_en: string | null;
}

interface EmpleadoCrudo {
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  correo: string | null;
}

interface FilaCruda {
  id: string;
  empleado_id: string;
  estado: string;
  colilla_enviada_en: string | null;
  empleado: EmpleadoCrudo | null;
}

export type ResultadoColillas = { ok: true; filas: FilaColilla[] } | { ok: false; error: string };

const ESTADOS: readonly EstadoNomina[] = ["borrador", "calculado", "contabilizado", "pagado", "anulado"];

function aEstado(valor: string): EstadoNomina {
  return ESTADOS.find((estado) => estado === valor) ?? "borrador";
}

function nombreCompleto(empleado: EmpleadoCrudo | null): string {
  if (!empleado) return "Empleado sin contacto";
  return [empleado.primer_nombre, empleado.segundo_nombre, empleado.primer_apellido, empleado.segundo_apellido]
    .filter((parte): parte is string => Boolean(parte?.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lectura puntual para el diálogo de colillas: empleado, correo y estado de envío. */
export async function leerColillasPeriodo(periodoId: string): Promise<ResultadoColillas> {
  const rol = await getRol();
  if (rol == null) return { ok: false, error: "No tienes permiso para ver las colillas." };
  if (!idSchema.safeParse(periodoId).success) return { ok: false, error: "El periodo no es válido." };

  const supabase = await createClient();
  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase
      .from("nomina_recibos")
      .select(
        "id, empleado_id, estado, colilla_enviada_en, empleado:empleados(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, correo)",
      )
      .eq("periodo_id", periodoId)
      .order("id")
      .range(inicio, fin)
      .returns<FilaCruda[]>(),
  );

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  const filas: FilaColilla[] = (data ?? []).map((fila) => ({
    recibo_id: fila.id,
    empleado_id: fila.empleado_id,
    nombre: nombreCompleto(fila.empleado),
    correo: fila.empleado?.correo ?? null,
    estado: aEstado(fila.estado),
    colilla_enviada_en: fila.colilla_enviada_en,
  }));

  filas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return { ok: true, filas };
}

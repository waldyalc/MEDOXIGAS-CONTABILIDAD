"use server";

import { revalidatePath } from "next/cache";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { getRol } from "@/lib/auth/rol";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { idSchema, mensajeValidacion } from "@/lib/nomina/esquemas";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/types";

import { type ConceptoEntrada, conceptoSchema, type ResultadoConcepto } from "./concepto";

/**
 * Acciones locales del catálogo de conceptos.
 *
 * Las RPC `nomina_crear_concepto` / `nomina_actualizar_concepto` todavía no
 * están en `src/lib/supabase/types.ts`; se tipan aquí y se llaman directo
 * (`cliente.rpc("nombre", args)`) sin extraer el método. Cuando la migración
 * entre al proyecto, esta interfaz se borra y la llamada no cambia.
 */

interface RpcConceptos {
  nomina_crear_concepto: { Args: { p: Json }; Returns: string };
  nomina_actualizar_concepto: { Args: { p_id: string; p: Json }; Returns: string };
}

type ClienteConceptos = SupabaseClient<Database> & {
  rpc<Fn extends keyof RpcConceptos>(
    fn: Fn,
    args: RpcConceptos[Fn]["Args"],
  ): PromiseLike<{ data: RpcConceptos[Fn]["Returns"] | null; error: PostgrestError | null }>;
};

function clienteConceptos(cliente: SupabaseClient<Database>): ClienteConceptos {
  return cliente as ClienteConceptos;
}

async function puedeEscribir(): Promise<boolean> {
  const rol = await getRol();
  return rol === "admin" || rol === "contador";
}

function esCodigoDuplicado(error: PostgrestError, mensaje: string): boolean {
  return error.code === "23505" || /ya existe|duplicate|unique/i.test(mensaje);
}

function payload(datos: ConceptoEntrada): Json {
  return {
    codigo: datos.codigo,
    nombre: datos.nombre,
    clase: datos.clase,
    grava_tss: datos.grava_tss,
    grava_isr: datos.grava_isr,
    grava_infotep: datos.grava_infotep,
    orden: datos.orden,
    activo: datos.activo,
  };
}

function revalidar() {
  revalidatePath("/dashboard/configuracion/nomina/conceptos");
  revalidatePath("/dashboard/configuracion/nomina/mapeo");
}

export async function crearConcepto(entrada: unknown): Promise<ResultadoConcepto> {
  if (!(await puedeEscribir())) {
    return { ok: false, error: "No tienes permiso para crear conceptos de nómina." };
  }

  const resultado = conceptoSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const supabase = clienteConceptos(await createClient());
  const { data, error } = await supabase.rpc("nomina_crear_concepto", { p: payload(resultado.data) });

  if (error) {
    const mensaje = mensajeErrorRpc(error);
    return esCodigoDuplicado(error, mensaje)
      ? { ok: false, error: "Ya existe un concepto con ese código.", campo: "codigo" }
      : { ok: false, error: mensaje };
  }

  if (typeof data !== "string") return { ok: false, error: "No se pudo crear el concepto." };

  revalidar();
  return { ok: true };
}

export async function actualizarConcepto(id: string, entrada: unknown): Promise<ResultadoConcepto> {
  if (!(await puedeEscribir())) {
    return { ok: false, error: "No tienes permiso para editar conceptos de nómina." };
  }

  if (!idSchema.safeParse(id).success) return { ok: false, error: "El concepto no es válido." };

  const resultado = conceptoSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const supabase = clienteConceptos(await createClient());
  const { data, error } = await supabase.rpc("nomina_actualizar_concepto", {
    p_id: id,
    p: payload(resultado.data),
  });

  if (error) {
    const mensaje = mensajeErrorRpc(error);
    return esCodigoDuplicado(error, mensaje)
      ? { ok: false, error: "Ya existe un concepto con ese código.", campo: "codigo" }
      : { ok: false, error: mensaje };
  }

  if (typeof data !== "string") return { ok: false, error: "No se pudo actualizar el concepto." };

  revalidar();
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";

import { getRol } from "@/lib/auth/rol";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { mensajeValidacion } from "@/lib/facturacion/validacion";
import { createClient } from "@/lib/supabase/server";

import { esquemaActualizarCuenta, esquemaCrearCuenta } from "./validacion";

export type ResultadoCuenta = { ok: true } | { ok: false; error: string };

function texto(formData: FormData, campo: string) {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor : "";
}

function booleano(formData: FormData, campo: string) {
  const valor = texto(formData, campo).toLowerCase();
  return valor === "true" || valor === "on" || valor === "1";
}

function datosDesdeFormulario(formData: FormData) {
  return {
    codigo: texto(formData, "codigo"),
    nombre: texto(formData, "nombre"),
    tipo: texto(formData, "tipo"),
    naturaleza: texto(formData, "naturaleza"),
    padre_id: texto(formData, "padre_id"),
    acepta_movimientos: booleano(formData, "acepta_movimientos"),
    es_caja_banco: booleano(formData, "es_caja_banco"),
    activa: booleano(formData, "activa"),
  };
}

function idValido(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function crearCuenta(formData: FormData): Promise<ResultadoCuenta> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para crear cuentas." };
  }

  const parseo = esquemaCrearCuenta.safeParse(datosDesdeFormulario(formData));
  if (!parseo.success) return { ok: false, error: mensajeValidacion(parseo.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_cuenta", { p: parseo.data });
  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/contabilidad");
  return { ok: true };
}

export async function actualizarCuenta(id: string, formData: FormData): Promise<ResultadoCuenta> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para editar cuentas." };
  }

  if (!idValido(id)) return { ok: false, error: "La cuenta no es válida" };

  const { codigo, tipo, naturaleza, ...resto } = datosDesdeFormulario(formData);
  const parseo = esquemaActualizarCuenta.safeParse({
    ...resto,
    ...(codigo.trim() === "" ? {} : { codigo }),
    ...(tipo === "" ? {} : { tipo }),
    ...(naturaleza === "" ? {} : { naturaleza }),
  });

  if (!parseo.success) return { ok: false, error: mensajeValidacion(parseo.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_cuenta", { p: { id, ...parseo.data } });
  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/contabilidad");
  revalidatePath(`/dashboard/contabilidad/cuentas/${id}`);
  return { ok: true };
}

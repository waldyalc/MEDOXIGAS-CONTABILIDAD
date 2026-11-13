"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import { esquemaContacto, SIN_LISTA_PRECIO } from "./contactos";

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

function texto(formData: FormData, campo: string) {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor : "";
}

function datosDesdeFormulario(formData: FormData) {
  const lista = texto(formData, "lista_precio_id");

  return {
    nombre: texto(formData, "nombre"),
    tipo: texto(formData, "tipo") || "cliente",
    rnc_cedula: texto(formData, "rnc_cedula"),
    telefono: texto(formData, "telefono"),
    correo: texto(formData, "correo"),
    direccion: texto(formData, "direccion"),
    lista_precio_id: lista === SIN_LISTA_PRECIO ? "" : lista,
  };
}

function idValido(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function crearContacto(formData: FormData): Promise<ResultadoAccion> {
  const parseo = esquemaContacto.safeParse(datosDesdeFormulario(formData));
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_contacto", { p: parseo.data });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/contactos");
  return { ok: true };
}

export async function actualizarContacto(id: string, formData: FormData): Promise<ResultadoAccion> {
  if (!idValido(id)) return { ok: false, error: "El contacto no es válido" };

  const parseo = esquemaContacto.safeParse(datosDesdeFormulario(formData));
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_contacto", { p_id: id, p: parseo.data });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/contactos");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import { esquemaProducto } from "./productos";

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

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
    nombre: texto(formData, "nombre"),
    tipo: texto(formData, "tipo") || "producto",
    referencia: texto(formData, "referencia"),
    descripcion: texto(formData, "descripcion"),
    precio: texto(formData, "precio"),
    itbis_tasa: texto(formData, "itbis_tasa") || "18",
    inventariable: booleano(formData, "inventariable"),
    cantidad: texto(formData, "cantidad") || "0",
    costo: texto(formData, "costo") || "0",
  };
}

function idValido(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function crearProducto(formData: FormData): Promise<ResultadoAccion> {
  const parseo = esquemaProducto.safeParse(datosDesdeFormulario(formData));
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_producto", { p: parseo.data });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/productos");
  return { ok: true };
}

export async function actualizarProducto(id: string, formData: FormData): Promise<ResultadoAccion> {
  if (!idValido(id)) return { ok: false, error: "El producto no es válido" };

  const parseo = esquemaProducto.safeParse(datosDesdeFormulario(formData));
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_producto", { p_id: id, p: parseo.data });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/productos");
  return { ok: true };
}

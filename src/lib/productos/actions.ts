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
    impuesto_id: texto(formData, "impuesto_id"),
    inventariable: booleano(formData, "inventariable"),
    cantidad: texto(formData, "cantidad") || "0",
    costo: texto(formData, "costo") || "0",
    categoria_id: texto(formData, "categoria_id"),
  };
}

function idValido(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

interface PrecioListaFormulario {
  lista_id: string;
  precio: number | null;
}

function preciosDesdeFormulario(formData: FormData): PrecioListaFormulario[] | null {
  const precios: PrecioListaFormulario[] = [];

  for (const [campo, valor] of formData.entries()) {
    if (!campo.startsWith("precio_lista_")) continue;
    if (typeof valor !== "string") continue;

    const listaId = campo.slice("precio_lista_".length);
    if (!idValido(listaId)) continue;

    const texto = valor.trim().replace(",", ".");
    if (texto === "") {
      precios.push({ lista_id: listaId, precio: null });
      continue;
    }

    const numero = Number(texto);
    if (!Number.isFinite(numero)) return null;
    precios.push({ lista_id: listaId, precio: numero });
  }

  return precios;
}

export async function crearProducto(formData: FormData): Promise<ResultadoAccion> {
  const parseo = esquemaProducto.safeParse(datosDesdeFormulario(formData));
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const precios = preciosDesdeFormulario(formData);
  if (precios === null) return { ok: false, error: "El precio de una lista no es válido" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_producto", {
    p: { ...parseo.data, precios: precios.map((item) => ({ ...item })) },
  });
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

  const precios = preciosDesdeFormulario(formData);
  if (precios === null) return { ok: false, error: "El precio de una lista no es válido" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_producto", {
    p_id: id,
    p: { ...parseo.data, precios: precios.map((item) => ({ ...item })) },
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/productos");
  return { ok: true };
}

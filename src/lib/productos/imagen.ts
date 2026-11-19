import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

/** Bucket privado creado en la migración `producto_campos_alegra`. */
export const BUCKET_IMAGENES_PRODUCTO = "productos";
export const LIMITE_IMAGEN_PRODUCTO_BYTES = 5 * 1024 * 1024;

const TIPOS_IMAGEN = ["image/png", "image/jpeg", "image/webp"] as const;

export function extensionImagenProducto(tipo: string): string {
  if (tipo === "image/png") return "png";
  if (tipo === "image/webp") return "webp";
  return "jpg";
}

/** Devuelve el problema en español, o null si la imagen se puede subir. */
export function validarImagenProducto(archivo: File): string | null {
  if (archivo.size === 0) return "La imagen está vacía.";
  if (!TIPOS_IMAGEN.includes(archivo.type as (typeof TIPOS_IMAGEN)[number])) {
    return "La imagen debe ser PNG, JPG o WebP.";
  }
  if (archivo.size > LIMITE_IMAGEN_PRODUCTO_BYTES) return "La imagen no puede pesar más de 5 MB.";
  return null;
}

export function mensajeSubidaImagen(mensaje: string): string {
  if (/bucket not found/i.test(mensaje))
    return "No se encontró el almacenamiento de productos. Avisa al administrador.";
  if (/payload too large|maximum allowed size/i.test(mensaje)) return "La imagen no puede pesar más de 5 MB.";
  if (/row-level security|permission|not authorized/i.test(mensaje)) {
    return "Solo un administrador o contador puede subir la imagen.";
  }
  if (/mime|content type/i.test(mensaje)) return "La imagen debe ser PNG, JPG o WebP.";
  return "No se pudo subir la imagen. Intenta de nuevo.";
}

export async function urlFirmadaImagenProducto(
  supabase: SupabaseClient<Database>,
  ruta: string | null,
  segundos = 3600,
): Promise<string | null> {
  const limpia = ruta?.trim();
  if (!limpia) return null;

  const { data, error } = await supabase.storage.from(BUCKET_IMAGENES_PRODUCTO).createSignedUrl(limpia, segundos);
  if (error) return null;
  return data?.signedUrl ?? null;
}

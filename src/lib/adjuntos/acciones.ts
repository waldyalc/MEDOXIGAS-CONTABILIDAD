"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { BUCKET_DOCUMENTOS } from "./adjuntos";

export type ResultadoAdjunto = { ok: true; id?: string; url?: string; nombre?: string } | { ok: false; error: string };

const esquemaRegistro = z.object({
  entidadTipo: z.enum(["contacto", "producto", "factura", "factura_proveedor", "pago"]),
  entidadId: z.uuid("La entidad del adjunto no es válida"),
  path: z.string().min(1, "La ruta del archivo es obligatoria"),
  nombre: z.string().min(1, "El nombre del archivo es obligatorio"),
  mime: z.enum(["image/png", "image/jpeg", "application/pdf"], "El archivo debe ser PNG, JPG o PDF"),
  bytes: z.number().int().nonnegative("El tamaño del archivo no es válido"),
});

const esquemaDescarga = z.object({
  nombre: z.string(),
  path: z.string(),
});

const ID_VALIDO = z.uuid();

/**
 * Registra en `adjuntos` un archivo ya subido al bucket `documentos`: la RPC
 * valida rol, tipo de entidad, que la entidad exista, el prefijo de la ruta,
 * el mime y el tamaño.
 */
export async function registrarAdjunto(entrada: unknown): Promise<ResultadoAdjunto> {
  const parseo = esquemaRegistro.safeParse(entrada);
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Los datos del adjunto no son válidos" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("subir_adjunto", {
    p: {
      entidad_tipo: parseo.data.entidadTipo,
      entidad_id: parseo.data.entidadId,
      path: parseo.data.path,
      nombre: parseo.data.nombre,
      mime: parseo.data.mime,
      bytes: parseo.data.bytes,
    },
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data ?? undefined };
}

/** Borra la fila de `adjuntos` y el objeto del bucket (todo en la RPC). */
export async function borrarAdjunto(id: string): Promise<ResultadoAdjunto> {
  if (!ID_VALIDO.safeParse(id).success) return { ok: false, error: "El adjunto no es válido" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("borrar_adjunto", { p_id: id });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Devuelve una URL firmada (1 h) para descargar el adjunto del bucket privado. */
export async function descargarAdjunto(id: string): Promise<ResultadoAdjunto> {
  if (!ID_VALIDO.safeParse(id).success) return { ok: false, error: "El adjunto no es válido" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("descargar_adjunto", { p_id: id });
  if (error) return { ok: false, error: error.message };

  const meta = esquemaDescarga.safeParse(data);
  if (!meta.success) return { ok: false, error: "No se pudo leer el adjunto" };

  const { data: firmado, error: errorFirma } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .createSignedUrl(meta.data.path, 3600);
  if (errorFirma || !firmado) return { ok: false, error: "No se pudo generar el enlace de descarga" };

  return { ok: true, url: firmado.signedUrl, nombre: meta.data.nombre };
}

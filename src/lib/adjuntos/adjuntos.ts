/** Bucket privado creado en la migración `adjuntos`. */
export const BUCKET_DOCUMENTOS = "documentos";
export const LIMITE_ADJUNTO_BYTES = 10 * 1024 * 1024;

const TIPOS_ADJUNTO = ["image/png", "image/jpeg", "application/pdf"] as const;

export type TipoEntidadAdjunto = "contacto" | "producto" | "factura" | "factura_proveedor" | "pago";

/** Fila de adjuntos ya mapeada para la interfaz. */
export interface AdjuntoItem {
  id: string;
  nombre: string;
  mime: string;
  bytes: number;
  path: string;
  creadoEn: string;
  creadoPorNombre: string | null;
}

export function extensionAdjunto(tipo: string): string {
  if (tipo === "image/png") return "png";
  if (tipo === "application/pdf") return "pdf";
  return "jpg";
}

/** Ruta única del objeto: <tipo>/<entidad>/<uuid>.<ext> (la RPC la exige). */
export function rutaAdjunto(tipo: TipoEntidadAdjunto, entidadId: string, mime: string): string {
  return `${tipo}/${entidadId}/${crypto.randomUUID()}.${extensionAdjunto(mime)}`;
}

/** Devuelve el problema en español, o null si el archivo se puede subir. */
export function validarAdjunto(archivo: File): string | null {
  if (archivo.size === 0) return "El archivo está vacío.";
  if (!TIPOS_ADJUNTO.includes(archivo.type as (typeof TIPOS_ADJUNTO)[number])) {
    return "El archivo debe ser PNG, JPG o PDF.";
  }
  if (archivo.size > LIMITE_ADJUNTO_BYTES) return "El archivo no puede pesar más de 10 MB.";
  return null;
}

export function mensajeSubidaAdjunto(mensaje: string): string {
  if (/bucket not found/i.test(mensaje)) {
    return "No se encontró el almacenamiento de documentos. Avisa al administrador.";
  }
  if (/payload too large|maximum allowed size/i.test(mensaje)) {
    return "El archivo no puede pesar más de 10 MB.";
  }
  if (/row-level security|permission|not authorized|sin permiso/i.test(mensaje)) {
    return "Solo un administrador o contador puede subir adjuntos.";
  }
  if (/mime|content type/i.test(mensaje)) return "El archivo debe ser PNG, JPG o PDF.";
  return "No se pudo subir el archivo. Intenta de nuevo.";
}

/** Etiqueta del tipo de adjunto para filtros y la columna "Tipo". */
export function etiquetaTipoAdjunto(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime === "image/png" || mime === "image/jpeg") return "Imagen";
  return "Archivo";
}

export function formatoTamanoAdjunto(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

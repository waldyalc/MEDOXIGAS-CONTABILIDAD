import { z } from "zod";

export const LIMITE_LOGO_BYTES = 2 * 1024 * 1024;

export const TIPOS_LOGO_PERMITIDOS = ["image/png", "image/jpeg", "image/webp"] as const;

export type TipoLogoPermitido = (typeof TIPOS_LOGO_PERMITIDOS)[number];

export function esTipoLogoPermitido(tipo: string): tipo is TipoLogoPermitido {
  return TIPOS_LOGO_PERMITIDOS.some((permitido) => permitido === tipo);
}

export function validarLogo(archivo: { type: string; size: number }): string | null {
  if (!esTipoLogoPermitido(archivo.type)) {
    return "El logo debe ser una imagen PNG, JPG o WebP.";
  }

  if (archivo.size > LIMITE_LOGO_BYTES) {
    return "El logo no puede pesar más de 2 MB.";
  }

  return null;
}

export function extensionLogo(tipo: string) {
  if (tipo === "image/jpeg") return "jpg";
  if (tipo === "image/webp") return "webp";
  return "png";
}

function normalizarNombre(valor: string) {
  return valor.trim().replace(/\s+/g, " ");
}

function campoOpcional(maximo: number, mensaje: string) {
  return z
    .string()
    .nullish()
    .transform((valor) => (valor ?? "").trim())
    .refine((valor) => valor.length <= maximo, mensaje)
    .transform((valor) => (valor === "" ? null : valor));
}

const campoCorreo = z
  .string()
  .nullish()
  .transform((valor) => (valor ?? "").trim())
  .refine((valor) => valor === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor), "El correo de la empresa no es válido")
  .transform((valor) => (valor === "" ? null : valor));

const campoLogo = z
  .string()
  .nullish()
  .transform((valor) => (valor ?? "").trim())
  .refine((valor) => valor.length <= 500, "La dirección del logo es demasiado larga")
  .refine(
    (valor) => valor === "" || valor.startsWith("/") || /^https?:\/\//i.test(valor),
    "La dirección del logo no es válida",
  )
  .transform((valor) => (valor === "" ? null : valor));

export const esquemaEmpresa = z.object({
  nombre: z
    .string()
    .transform(normalizarNombre)
    .refine((valor) => valor.length > 0, "El nombre de la empresa es obligatorio")
    .refine((valor) => valor.length <= 200, "El nombre de la empresa no puede pasar de 200 caracteres"),
  rnc: campoOpcional(20, "El RNC no puede pasar de 20 caracteres"),
  direccion: campoOpcional(300, "La dirección no puede pasar de 300 caracteres"),
  telefono: campoOpcional(40, "El teléfono no puede pasar de 40 caracteres"),
  correo: campoCorreo,
  logo_url: campoLogo,
});

export type DatosEmpresa = z.infer<typeof esquemaEmpresa>;

export const esquemaTerminoPago = z.object({
  nombre: z
    .string()
    .transform(normalizarNombre)
    .refine((valor) => valor.length > 0, "El nombre del término de pago es obligatorio")
    .refine((valor) => valor.length <= 80, "El nombre no puede pasar de 80 caracteres"),
  dias: z.coerce
    .number()
    .int("Los días deben ser un número entero")
    .min(0, "Los días no pueden ser negativos")
    .max(3650, "Los días no pueden pasar de 3650"),
});

export type DatosTerminoPago = z.infer<typeof esquemaTerminoPago>;

const cuentaOpcional = z
  .string()
  .nullish()
  .transform((valor) => (valor ?? "").trim())
  .transform((valor) => (valor === "" ? null : valor))
  .pipe(z.uuid("La cuenta no es válida").nullable());

export const esquemaRetencion = z.object({
  nombre: z
    .string()
    .transform(normalizarNombre)
    .refine((valor) => valor.length > 0, "El nombre de la retención es obligatorio")
    .refine((valor) => valor.length <= 80, "El nombre no puede pasar de 80 caracteres"),
  tipo: z.enum(["itbis", "isr"], "El tipo de retención debe ser ITBIS o ISR"),
  porcentaje: z.coerce
    .number()
    .finite("El porcentaje no es válido")
    .positive("El porcentaje debe ser mayor que cero")
    .max(100, "El porcentaje no puede pasar de 100"),
  cuenta_id: z.uuid("La cuenta de la retención no es válida"),
  cuenta_anticipo_id: cuentaOpcional,
  activa: z.boolean().default(true),
});

export const esquemaActualizarRetencion = esquemaRetencion.extend({
  id: z.uuid("La retención no es válida"),
});

export type DatosRetencion = z.infer<typeof esquemaRetencion>;
export type DatosActualizarRetencion = z.infer<typeof esquemaActualizarRetencion>;

export function mensajeValidacion(error: z.ZodError) {
  return error.issues[0]?.message ?? "Datos inválidos";
}

import { z } from "zod";

export const tipoEntradaSchema = z.object({
  nombre: z.string().trim().min(1, { message: "El nombre del tipo de entrada es obligatorio" }).max(120),
  prefijo: z
    .string()
    .trim()
    .regex(/^[A-Za-z][A-Za-z0-9]{0,9}$/, {
      message: "El prefijo usa solo letras y números, sin espacios (máx. 10)",
    }),
  activo: z.boolean().optional(),
});

export type TipoEntradaEntrada = z.infer<typeof tipoEntradaSchema>;

export function mensajeValidacion(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

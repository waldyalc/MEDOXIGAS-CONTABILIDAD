import { z } from "zod";

export const tasaCambioSchema = z.object({
  moneda_codigo: z.string().trim().length(3, { message: "Selecciona una moneda" }).toUpperCase(),
  fecha: z.iso.date(),
  tasa: z.coerce.number().finite().positive({ message: "La tasa de cambio debe ser mayor que cero" }),
});

export type TasaCambioEntrada = z.infer<typeof tasaCambioSchema>;

export function mensajeValidacion(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

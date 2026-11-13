import { z } from "zod";

export const centroCostoSchema = z.object({
  codigo: z.string().trim().min(1, { message: "El código del centro de costo es obligatorio" }).max(30),
  nombre: z.string().trim().min(1, { message: "El nombre del centro de costo es obligatorio" }).max(120),
  descripcion: z.string().trim().max(500).optional(),
  activo: z.boolean().optional(),
});

export type CentroCostoEntrada = z.infer<typeof centroCostoSchema>;

export function mensajeValidacion(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

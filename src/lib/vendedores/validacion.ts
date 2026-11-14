import { z } from "zod";

export const vendedorSchema = z.object({
  nombre: z.string().trim().min(1, { message: "El nombre del vendedor es obligatorio" }).max(120),
  identificacion: z.string().trim().max(60).optional(),
  observacion: z.string().trim().max(500).optional(),
  activo: z.boolean().optional(),
});

export type VendedorEntrada = z.infer<typeof vendedorSchema>;

export function mensajeValidacion(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

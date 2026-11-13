import { z } from "zod";

const siguienteSchema = z.coerce
  .number()
  .int("El siguiente debe ser un entero")
  .min(1, "El siguiente debe ser mayor o igual a 1");

const hastaSchema = z.preprocess(
  (valor) => (valor === "" || valor == null ? null : valor),
  z.coerce.number().int("El hasta debe ser un entero").min(1, "El hasta debe ser mayor o igual a 1").nullable(),
);

const venceSchema = z.preprocess(
  (valor) => (valor === "" || valor == null ? null : valor),
  z.iso.date("La fecha de vencimiento no es válida").nullable(),
);

export const actualizarNumeracionSchema = z
  .object({
    id: z.uuid("La numeración no es válida"),
    nombre: z.string().trim().min(1, "El nombre es obligatorio").max(120, "El nombre es demasiado largo"),
    siguiente: siguienteSchema,
    hasta: hastaSchema,
    vence: venceSchema,
    activa: z.boolean(),
  })
  .refine((datos) => datos.hasta == null || datos.siguiente <= datos.hasta, {
    message: "El siguiente no puede ser mayor que el hasta",
    path: ["siguiente"],
  });

export type ActualizarNumeracionEntrada = z.infer<typeof actualizarNumeracionSchema>;

export function mensajeValidacion(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

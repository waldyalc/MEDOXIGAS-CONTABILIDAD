import { z } from "zod";

import { TIPOS_PLANTILLA } from "./tipos";

export const plantillaImpresionSchema = z.object({
  tipo_documento: z.enum(TIPOS_PLANTILLA),
  notas_pie: z.string().trim().max(2000).optional(),
  terminos: z.string().trim().max(2000).optional(),
  mostrar_logo: z.boolean().default(true),
});

export type PlantillaImpresionEntrada = z.infer<typeof plantillaImpresionSchema>;

export function mensajeValidacion(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

import { z } from "zod";

import { TIPOS_COMPROBANTE } from "@/lib/facturacion/tipos";
import { lineaFacturaSchema } from "@/lib/facturacion/validacion";

export const crearFacturaRecurrenteSchema = z
  .object({
    contacto_id: z.uuid("El cliente es obligatorio"),
    tipo_comprobante: z.enum(TIPOS_COMPROBANTE),
    fecha_inicio: z.iso.date(),
    vigencia_hasta: z.iso.date().optional(),
    frecuencia_meses: z.coerce
      .number()
      .int()
      .min(1, { message: "La frecuencia debe ser de al menos 1 mes" })
      .max(60, { message: "La frecuencia no puede pasar de 60 meses" }),
    plazo_dias: z.coerce
      .number()
      .int()
      .min(0, { message: "El plazo no puede ser negativo" })
      .max(365, { message: "El plazo no puede pasar de 365 días" })
      .default(0),
    notas: z.string().trim().max(2000).optional(),
    terminos: z.string().trim().max(2000).optional(),
    pie: z.string().trim().max(2000).optional(),
    lineas: z
      .array(lineaFacturaSchema)
      .min(1, { message: "Agrega al menos una línea" })
      .max(200, { message: "La plantilla admite hasta 200 líneas" }),
  })
  .refine((datos) => !datos.vigencia_hasta || datos.vigencia_hasta >= datos.fecha_inicio, {
    message: "La vigencia no puede ser anterior a la fecha de inicio",
    path: ["vigencia_hasta"],
  });

export type CrearFacturaRecurrenteEntrada = z.infer<typeof crearFacturaRecurrenteSchema>;

export function mensajeValidacionRecurrente(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

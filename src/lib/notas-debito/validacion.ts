import { z } from "zod";

import { lineaFacturaSchema } from "@/lib/facturacion/validacion";

export const TIPOS_NOTA_DEBITO_VALIDOS = ["texto", "montos"] as const;

export const crearNotaDebitoVentaSchema = z.object({
  factura_id: z.uuid("La factura es obligatoria"),
  tipo: z.enum(TIPOS_NOTA_DEBITO_VALIDOS, { message: "Selecciona el tipo de nota de débito" }),
  fecha: z.iso.date(),
  notas: z.string().trim().max(2000).optional(),
  lineas: z
    .array(lineaFacturaSchema)
    .min(1, { message: "Agrega al menos una línea" })
    .max(200, { message: "La nota admite hasta 200 líneas" }),
});

export type CrearNotaDebitoVentaEntrada = z.infer<typeof crearNotaDebitoVentaSchema>;

export function mensajeValidacionNotaDebito(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

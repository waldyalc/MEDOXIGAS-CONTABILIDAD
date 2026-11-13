import { z } from "zod";

export const lineaNotaCreditoSchema = z
  .object({
    factura_linea_id: z.uuid("La línea de la factura es obligatoria"),
    cantidad: z.coerce.number().finite().positive({ message: "La cantidad debe ser mayor que cero" }),
    pendiente: z.coerce.number().finite().nonnegative(),
  })
  .refine((linea) => linea.cantidad <= linea.pendiente, {
    message: "La cantidad no puede superar lo pendiente por acreditar",
    path: ["cantidad"],
  });

export const crearNotaCreditoVentaSchema = z.object({
  factura_id: z.uuid("La factura es obligatoria"),
  fecha: z.iso.date(),
  notas: z.string().trim().max(2000).optional(),
  devuelve_inventario: z.boolean().default(true),
  lineas: z
    .array(lineaNotaCreditoSchema)
    .min(1, { message: "Agrega al menos una línea con cantidad mayor que cero" })
    .max(200),
});

export type CrearNotaCreditoVentaEntrada = z.infer<typeof crearNotaCreditoVentaSchema>;

export function mensajeValidacionNota(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

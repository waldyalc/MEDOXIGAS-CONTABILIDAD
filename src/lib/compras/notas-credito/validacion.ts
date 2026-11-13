import { z } from "zod";

export const lineaNotaCreditoCompraSchema = z
  .object({
    factura_proveedor_linea_id: z.uuid("La línea de la factura es obligatoria"),
    cantidad: z.coerce.number().finite().positive({ message: "La cantidad debe ser mayor que cero" }),
    pendiente: z.coerce.number().finite().nonnegative(),
  })
  .refine((linea) => linea.cantidad <= linea.pendiente, {
    message: "La cantidad no puede superar lo pendiente por acreditar",
    path: ["cantidad"],
  });

export const crearNotaCreditoCompraSchema = z.object({
  factura_proveedor_id: z.uuid("La factura de proveedor es obligatoria"),
  fecha: z.iso.date(),
  notas: z.string().trim().max(2000).optional(),
  devuelve_inventario: z.boolean().default(true),
  lineas: z
    .array(lineaNotaCreditoCompraSchema)
    .min(1, { message: "Agrega al menos una línea con cantidad mayor que cero" })
    .max(200),
});

export type CrearNotaCreditoCompraEntrada = z.infer<typeof crearNotaCreditoCompraSchema>;

export function mensajeValidacionNotaCompra(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

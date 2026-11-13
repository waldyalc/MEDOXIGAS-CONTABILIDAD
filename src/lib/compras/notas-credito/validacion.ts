import { z } from "zod";

const NCF_NOTA_COMPRA = /^(B04\d{8}|E34\d{10})$/;

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
  ncf: z
    .string()
    .trim()
    .toUpperCase()
    .refine((valor) => valor === "" || NCF_NOTA_COMPRA.test(valor), {
      message: "El NCF debe ser B04 + 8 dígitos o E34 + 10 dígitos.",
    })
    .optional()
    .transform((valor) => valor || null),
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

import { z } from "zod";

import { metodoPagoSchema } from "@/lib/facturacion/validacion";

const retencionPagoSchema = z.object({
  retencion_id: z.uuid("La retención no es válida"),
});

export const registrarPagoSchema = z.object({
  factura_id: z.uuid(),
  contacto_id: z.uuid(),
  fecha: z.iso.date(),
  cuenta_id: z.uuid(),
  metodo: metodoPagoSchema,
  monto: z.coerce.number().finite().positive({ message: "El monto debe ser mayor que cero" }),
  notas: z.string().trim().max(2000).optional(),
  retenciones: z.array(retencionPagoSchema).max(20).optional().default([]),
});

const aplicacionPagoSchema = z.object({
  factura_id: z.uuid(),
  monto: z.coerce.number().finite().positive({ message: "El monto debe ser mayor que cero" }),
  retenciones: z.array(retencionPagoSchema).max(20).optional().default([]),
});

const otroIngresoSchema = z.object({
  cuenta_id: z.uuid(),
  descripcion: z.string().trim().max(200).optional().default(""),
  monto: z.coerce.number().finite().positive({ message: "El monto debe ser mayor que cero" }),
  itbis_tasa: z
    .union([z.literal(0), z.literal(16), z.literal(18)])
    .optional()
    .default(0),
});

export const registrarPagoMultifacturaSchema = z
  .object({
    contacto_id: z.uuid(),
    fecha: z.iso.date(),
    cuenta_id: z.uuid(),
    metodo: metodoPagoSchema,
    notas: z.string().trim().max(2000).optional(),
    centro_costo_id: z.uuid().optional(),
    aplicaciones: z.array(aplicacionPagoSchema).max(50).optional().default([]),
    otros: z.array(otroIngresoSchema).max(50).optional().default([]),
  })
  .refine((datos) => datos.aplicaciones.length + datos.otros.length > 0, {
    message: "Agrega al menos una factura o un ingreso",
  });

export type RegistrarPagoEntrada = z.infer<typeof registrarPagoSchema>;
export type RegistrarPagoMultifacturaEntrada = z.infer<typeof registrarPagoMultifacturaSchema>;

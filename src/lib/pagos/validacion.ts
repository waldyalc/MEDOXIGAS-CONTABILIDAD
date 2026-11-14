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

export type RegistrarPagoEntrada = z.infer<typeof registrarPagoSchema>;

import { z } from "zod";

import { metodoPagoSchema } from "@/lib/facturacion/validacion";

export const registrarPagoSchema = z.object({
  factura_id: z.uuid(),
  contacto_id: z.uuid(),
  fecha: z.iso.date(),
  cuenta_id: z.uuid(),
  metodo: metodoPagoSchema,
  monto: z.coerce.number().finite().positive({ message: "El monto debe ser mayor que cero" }),
  notas: z.string().trim().max(2000).optional(),
});

export type RegistrarPagoEntrada = z.infer<typeof registrarPagoSchema>;

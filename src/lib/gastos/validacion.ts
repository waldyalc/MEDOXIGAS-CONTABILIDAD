import { z } from "zod";

import { TASAS_ITBIS } from "@/lib/facturacion/calculo";

export const crearGastoMenorSchema = z.object({
  fecha: z.iso.date(),
  descripcion: z.string().trim().min(1, { message: "La descripción es obligatoria" }).max(500),
  subtotal: z.coerce.number().finite().positive({ message: "El monto debe ser mayor que cero" }),
  itbis_tasa: z.coerce
    .number()
    .refine((valor) => TASAS_ITBIS.includes(valor as (typeof TASAS_ITBIS)[number]), {
      message: "El ITBIS debe ser 0 %, 16 % o 18 %",
    })
    .default(0),
  cuenta_gasto_id: z.uuid().optional(),
  cuenta_pago_id: z.uuid().optional(),
  contacto_id: z.uuid().optional(),
});

export type CrearGastoMenorEntrada = z.infer<typeof crearGastoMenorSchema>;

import { z } from "zod";

export const crearGastoMenorSchema = z.object({
  fecha: z.iso.date(),
  descripcion: z.string().trim().min(1, { message: "La descripciA3n es obligatoria" }).max(500),
  subtotal: z.coerce.number().finite().positive({ message: "El monto debe ser mayor que cero" }),
  itbis_tasa: z.coerce
    .number()
    .refine((valor) => [0, 2, 10, 16, 18].includes(valor), {
      message: "La tarifa del impuesto no está en el catálogo",
    })
    .default(0),
  impuesto_id: z.uuid().nullish(),
  cuenta_gasto_id: z.uuid().optional(),
  cuenta_pago_id: z.uuid().optional(),
  contacto_id: z.uuid().optional(),
});

export type CrearGastoMenorEntrada = z.infer<typeof crearGastoMenorSchema>;

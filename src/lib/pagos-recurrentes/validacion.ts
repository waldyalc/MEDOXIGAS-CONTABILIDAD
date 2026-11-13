import { z } from "zod";

export const esquemaPagoRecurrente = z
  .object({
    nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(120, "El nombre es muy largo."),
    contacto_id: z
      .union([z.uuid(), z.literal("")])
      .optional()
      .transform((valor) => valor || null),
    cuenta_gasto_id: z.uuid("Selecciona la cuenta de gasto."),
    cuenta_pago_id: z.uuid("Selecciona la cuenta de pago."),
    subtotal: z.coerce.number().positive("El monto debe ser mayor que 0."),
    itbis_tasa: z.coerce
      .number()
      .min(0, "El ITBIS no puede ser negativo.")
      .max(100, "El ITBIS no puede pasar de 100 %."),
    frecuencia_meses: z.coerce
      .number()
      .int("La frecuencia debe ser un número entero de meses.")
      .min(1, "La frecuencia debe ser de al menos 1 mes."),
    fecha_inicio: z.iso.date(),
    vigencia_hasta: z
      .union([z.iso.date(), z.literal("")])
      .optional()
      .transform((valor) => valor || null),
    notas: z
      .string()
      .trim()
      .max(500, "Las notas son muy largas.")
      .optional()
      .transform((valor) => valor || null),
    activo: z.boolean().default(true),
  })
  .refine((datos) => datos.vigencia_hasta == null || datos.vigencia_hasta >= datos.fecha_inicio, {
    message: "La vigencia no puede terminar antes de la fecha de inicio.",
    path: ["vigencia_hasta"],
  });

export type EntradaPagoRecurrente = z.input<typeof esquemaPagoRecurrente>;

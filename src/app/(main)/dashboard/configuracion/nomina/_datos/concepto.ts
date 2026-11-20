import { z } from "zod";

import { CLASES_CONCEPTO, type ClaseConcepto } from "@/lib/nomina/tipos";

/**
 * Validación del diálogo de conceptos de nómina.
 *
 * La base revalida el código y la regla "solo un ingreso entra en las bases";
 * aquí se avisa antes de llamar a la RPC y se mantienen los mensajes en español.
 */

export const CODIGO_CONCEPTO = /^[A-Z][A-Z0-9_]{2,39}$/;

export const conceptoSchema = z.object({
  codigo: z
    .string({ message: "El código es obligatorio." })
    .transform((valor) => valor.trim().toUpperCase())
    .refine((valor) => CODIGO_CONCEPTO.test(valor), {
      message: "El código debe empezar con una letra y usar solo mayúsculas, números o guion bajo (3 a 40).",
    }),
  nombre: z
    .string({ message: "El nombre es obligatorio." })
    .trim()
    .min(1, { message: "El nombre es obligatorio." })
    .max(120, { message: "El nombre no puede pasar de 120 caracteres." }),
  clase: z.enum(CLASES_CONCEPTO, { message: "La clase del concepto no es válida." }),
  grava_tss: z.boolean({ message: "El indicador de TSS no es válido." }),
  grava_isr: z.boolean({ message: "El indicador de ISR no es válido." }),
  grava_infotep: z.boolean({ message: "El indicador de INFOTEP no es válido." }),
  orden: z.coerce
    .number({ message: "El orden debe ser un número entero." })
    .int({ message: "El orden debe ser un número entero." })
    .min(0, { message: "El orden no puede ser negativo." })
    .max(9999, { message: "El orden no puede pasar de 9999." }),
  activo: z.boolean({ message: "El estado del concepto no es válido." }),
});

export type ConceptoEntrada = z.infer<typeof conceptoSchema>;

export interface ResultadoConcepto {
  ok: boolean;
  error?: string;
  campo?: "codigo" | "nombre" | "orden";
}

const ETIQUETAS_CLASE: Record<ClaseConcepto, string> = {
  ingreso: "Ingreso",
  deduccion: "Deducción",
  aporte_empleador: "Aporte patronal",
  provision: "Provisión",
};

export function etiquetaClaseConcepto(clase: ClaseConcepto): string {
  return ETIQUETAS_CLASE[clase];
}

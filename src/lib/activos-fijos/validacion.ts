import { z } from "zod";

import { TIPOS_ACTIVO } from "./tipos";

export const PERIODOS_DEPRECIACION = ["anual", "mensual"] as const;

export const crearActivoFijoSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(1, "El nombre del activo es obligatorio")
      .max(200, "El nombre no puede pasar de 200 caracteres"),
    referencia: z.string().trim().max(100, "La referencia no puede pasar de 100 caracteres").optional(),
    tipo_activo: z.enum(TIPOS_ACTIVO, "El tipo de activo no es válido"),
    proveedor_contacto_id: z.uuid("El proveedor no es válido").nullish(),
    fecha_adquisicion: z.iso.date("La fecha de adquisición no es válida"),
    costo_unitario: z.coerce.number().finite().positive("El costo de adquisición debe ser mayor que cero"),
    cantidad: z.coerce.number().finite().positive("La cantidad debe ser mayor que cero"),
    monto_total: z.coerce.number().finite().positive("El monto total de inversión debe ser mayor que cero"),
    valor_residual: z.coerce.number().finite().min(0, "El valor residual no puede ser negativo").default(0),
    cuenta_activo_id: z.uuid("La cuenta del activo no es válida").nullish(),
    cuenta_depreciacion_id: z.uuid("La cuenta de depreciación acumulada no es válida").nullish(),
    cuenta_gasto_id: z.uuid("La cuenta de gasto no es válida").nullish(),
    fecha_inicio_depreciacion: z.iso.date("La fecha de inicio de depreciación no es válida"),
    vida_util: z.coerce.number().finite().positive("La vida útil debe ser mayor que cero"),
    periodo_depreciacion: z.enum(PERIODOS_DEPRECIACION, "El periodo de depreciación no es válido"),
    contabilizar_creacion: z.boolean().default(true),
  })
  .superRefine((datos, ctx) => {
    if (datos.valor_residual >= datos.monto_total) {
      ctx.addIssue({
        code: "custom",
        message: "El valor residual debe ser menor que el monto total",
        path: ["valor_residual"],
      });
    }

    const meses = vidaUtilEnMeses(datos.vida_util, datos.periodo_depreciacion);
    if (meses < 1) {
      ctx.addIssue({
        code: "custom",
        message: "La vida útil debe equivaler al menos a un mes",
        path: ["vida_util"],
      });
    }
    if (meses > 1200) {
      ctx.addIssue({
        code: "custom",
        message: "La vida útil no puede pasar de 1200 meses",
        path: ["vida_util"],
      });
    }
  });

export type CrearActivoFijoEntrada = z.infer<typeof crearActivoFijoSchema>;

export function vidaUtilEnMeses(vidaUtil: number, periodo: (typeof PERIODOS_DEPRECIACION)[number]): number {
  if (!Number.isFinite(vidaUtil) || vidaUtil <= 0) return 0;
  return periodo === "anual" ? Math.round(vidaUtil * 12) : Math.round(vidaUtil);
}

export const depreciarActivoSchema = z.object({
  activo_id: z.uuid("El activo no es válido"),
  periodo: z.iso.date("El periodo no es válido").optional(),
});

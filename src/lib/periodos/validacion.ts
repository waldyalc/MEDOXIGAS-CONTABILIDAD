import { z } from "zod";

export const periodoMesSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-01$/, "El periodo debe ser el primer día de un mes (YYYY-MM-01)");

export const anioCierreSchema = z.coerce
  .number()
  .int("El año debe ser entero")
  .min(2000, "El año no es válido")
  .max(2100, "El año no es válido");

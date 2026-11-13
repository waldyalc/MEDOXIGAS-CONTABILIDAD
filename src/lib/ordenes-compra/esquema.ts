import { z } from "zod";

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa una fecha válida (AAAA-MM-DD).");
const id = z.string().uuid("Selección inválida.");
const numero = z.coerce.number().finite();

export const esquemaLineaOrden = z
  .object({
    producto_id: z
      .union([id, z.literal("")])
      .optional()
      .transform((valor) => valor || null),
    cuenta_id: z
      .union([id, z.literal("")])
      .optional()
      .transform((valor) => valor || null),
    descripcion: z
      .string()
      .trim()
      .max(200, "La descripción es muy larga.")
      .optional()
      .transform((valor) => valor ?? ""),
    cantidad: numero.positive("La cantidad debe ser mayor que 0."),
    costo: numero.min(0, "El costo no puede ser negativo."),
    itbis_tasa: numero.min(0, "El ITBIS no puede ser negativo.").max(100, "El ITBIS no puede pasar de 100 %."),
  })
  .refine((linea) => (linea.producto_id == null) !== (linea.cuenta_id == null), {
    message: "Cada línea debe ser un producto o una cuenta de gasto.",
  });

export const esquemaOrdenCompra = z
  .object({
    contacto_id: id,
    fecha,
    fecha_entrega: fecha,
    notas: z
      .string()
      .trim()
      .max(500, "Las notas son muy largas.")
      .optional()
      .transform((valor) => valor || null),
    terminos: z
      .string()
      .trim()
      .max(500, "Los términos son muy largos.")
      .optional()
      .transform((valor) => valor || null),
    lineas: z.array(esquemaLineaOrden).min(1, "Agrega al menos una línea."),
  })
  .refine((orden) => orden.fecha_entrega >= orden.fecha, {
    message: "La fecha de entrega no puede ser anterior a la fecha.",
    path: ["fecha_entrega"],
  });

export type EntradaOrdenCompra = z.input<typeof esquemaOrdenCompra>;

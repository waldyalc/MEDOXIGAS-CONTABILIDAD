import { z } from "zod";

const TASAS_IMPUESTO = [0, 2, 10, 16, 18] as const;

const tasaImpuestoSchema = z.coerce
  .number()
  .refine((valor) => TASAS_IMPUESTO.includes(valor as (typeof TASAS_IMPUESTO)[number]), {
    message: "La tarifa del impuesto no está en el catálogo",
  });

const textoOpcionalSchema = z.string().trim().max(2000).optional();

export const lineaDocumentoSchema = z
  .object({
    producto_id: z.uuid().nullish(),
    descripcion: z.string().trim().max(500).optional(),
    cantidad: z.coerce.number().finite().positive({ message: "La cantidad debe ser mayor que cero" }),
    precio: z.coerce.number().finite().min(0, { message: "El precio no puede ser negativo" }),
    descuento_pct: z.coerce.number().min(0).max(100).default(0),
    itbis_tasa: tasaImpuestoSchema.default(0),
    impuesto_id: z.uuid().nullish(),
  })
  .superRefine((linea, ctx) => {
    if (!linea.producto_id && !linea.descripcion) {
      ctx.addIssue({ code: "custom", message: "Cada línea necesita un producto o una descripción" });
    }
  });

export const crearDocumentoSchema = z
  .object({
    contacto_id: z.uuid({ message: "Selecciona un cliente" }),
    fecha: z.iso.date(),
    vencimiento: z.iso.date(),
    notas: textoOpcionalSchema,
    vendedor_id: z.uuid().nullish(),
    centro_costo_id: z.uuid().nullish(),
    lineas: z.array(lineaDocumentoSchema).min(1, { message: "Agrega al menos una línea" }).max(200),
  })
  .refine((datos) => datos.vencimiento >= datos.fecha, {
    message: "El vencimiento no puede ser anterior a la fecha",
    path: ["vencimiento"],
  });

export type CrearDocumentoEntrada = z.infer<typeof crearDocumentoSchema>;

export function mensajeValidacion(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

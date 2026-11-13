import { z } from "zod";

import { TASAS_ITBIS } from "./calculo";
import { TIPOS_COMPROBANTE } from "./tipos";

export const METODOS_PAGO = ["efectivo", "transferencia", "tarjeta", "cheque"] as const;

export const metodoPagoSchema = z.enum(METODOS_PAGO);

const tasaItbisSchema = z.coerce
  .number()
  .refine((valor) => TASAS_ITBIS.includes(valor as (typeof TASAS_ITBIS)[number]), {
    message: "El ITBIS debe ser 0 %, 16 % o 18 %",
  });

const textoOpcionalSchema = z.string().trim().max(2000).optional();

export const lineaFacturaSchema = z
  .object({
    producto_id: z.uuid().nullish(),
    descripcion: z.string().trim().max(500).optional(),
    cantidad: z.coerce.number().finite().positive({ message: "La cantidad debe ser mayor que cero" }),
    precio: z.coerce.number().finite().min(0, { message: "El precio no puede ser negativo" }),
    descuento_pct: z.coerce.number().min(0).max(100).default(0),
    itbis_tasa: tasaItbisSchema.default(0),
  })
  .superRefine((linea, ctx) => {
    if (!linea.producto_id && !linea.descripcion) {
      ctx.addIssue({ code: "custom", message: "Cada línea necesita un producto o una descripción" });
    }
  });

export const pagoEnFacturaSchema = z.object({
  cuenta_id: z.uuid(),
  metodo: metodoPagoSchema,
  monto: z.coerce.number().finite().nonnegative(),
});

export const crearFacturaSchema = z
  .object({
    tipo_comprobante: z.enum(TIPOS_COMPROBANTE),
    contacto_id: z.uuid(),
    fecha: z.iso.date(),
    vencimiento: z.iso.date(),
    notas: textoOpcionalSchema,
    terminos: textoOpcionalSchema,
    pie: textoOpcionalSchema,
    lineas: z.array(lineaFacturaSchema).min(1, { message: "Agrega al menos una línea" }).max(200),
    pago: pagoEnFacturaSchema.optional(),
  })
  .refine((datos) => datos.vencimiento >= datos.fecha, {
    message: "El vencimiento no puede ser anterior a la fecha",
    path: ["vencimiento"],
  });

export type CrearFacturaEntrada = z.infer<typeof crearFacturaSchema>;

export function mensajeValidacion(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

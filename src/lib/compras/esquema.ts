import { z } from "zod";

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa una fecha válida (AAAA-MM-DD).");
const id = z.string().uuid("Selección inválida.");
const numero = z.coerce.number().finite();

export const METODOS_PAGO = ["efectivo", "transferencia", "tarjeta", "cheque"] as const;

export const esquemaLineaFactura = z
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

export const esquemaFacturaProveedor = z
  .object({
    contacto_id: id,
    fecha,
    vencimiento: fecha,
    ncf: z
      .string()
      .trim()
      .max(20, "El NCF es muy largo.")
      .optional()
      .transform((valor) => valor || null),
    notas: z
      .string()
      .trim()
      .max(500, "Las notas son muy largas.")
      .optional()
      .transform((valor) => valor || null),
    centro_costo_id: z
      .union([id, z.literal("")])
      .optional()
      .transform((valor) => valor || null),
    lineas: z.array(esquemaLineaFactura).min(1, "Agrega al menos una línea."),
  })
  .refine((factura) => factura.vencimiento >= factura.fecha, {
    message: "El vencimiento no puede ser anterior a la fecha.",
    path: ["vencimiento"],
  });

export const esquemaPagoProveedor = z.object({
  factura_proveedor_id: id,
  fecha,
  cuenta_id: id,
  metodo: z.enum(METODOS_PAGO),
  monto: numero.positive("El monto debe ser mayor que 0."),
});

export type EntradaLineaFactura = z.input<typeof esquemaLineaFactura>;
export type EntradaFacturaProveedor = z.input<typeof esquemaFacturaProveedor>;
export type EntradaPagoProveedor = z.input<typeof esquemaPagoProveedor>;

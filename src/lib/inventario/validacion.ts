import { z } from "zod";

export const TIPOS_AJUSTE = ["entrada", "salida"] as const;

export type TipoAjuste = (typeof TIPOS_AJUSTE)[number];

export interface LineaAjusteValidable {
  producto_id: string;
  cantidad: number;
  costoCentavos: number | null;
}

export interface AjusteValidable {
  almacen_id: string;
  lineas: LineaAjusteValidable[];
}

export function validarAjuste(datos: AjusteValidable): string | null {
  if (!datos.almacen_id) return "Selecciona el almacén.";
  if (datos.lineas.length === 0) return "Agrega al menos un producto.";

  for (const [indice, linea] of datos.lineas.entries()) {
    const numero = indice + 1;

    if (!linea.producto_id) return `Selecciona el producto de la línea ${numero}.`;
    if (!Number.isFinite(linea.cantidad) || linea.cantidad <= 0) {
      return `La cantidad de la línea ${numero} debe ser mayor que cero.`;
    }
    if (linea.costoCentavos === null || !Number.isFinite(linea.costoCentavos) || linea.costoCentavos <= 0) {
      return `El costo de la línea ${numero} no es válido.`;
    }
  }

  return null;
}

export const ajusteLineaSchema = z.object({
  producto_id: z.uuid({ message: "Selecciona un producto válido." }),
  tipo: z.enum(TIPOS_AJUSTE, { message: "Selecciona entrada o salida." }),
  cantidad: z.coerce.number().finite().positive({ message: "La cantidad debe ser mayor que cero." }),
  costo_unitario: z.coerce.number().finite().positive({ message: "El costo debe ser mayor que cero." }),
});

export const ajusteSchema = z.object({
  fecha: z.iso.date({ message: "La fecha no es válida." }),
  almacen_id: z.uuid({ message: "Selecciona un almacén válido." }),
  observaciones: z.string().trim().max(2000, { message: "Las observaciones son demasiado largas." }).optional(),
  lineas: z
    .array(ajusteLineaSchema)
    .min(1, { message: "Agrega al menos un producto." })
    .max(200, { message: "Un ajuste no puede pasar de 200 líneas." }),
});

export const categoriaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, { message: "Escribe el nombre de la categoría." })
    .max(120, { message: "El nombre de la categoría es demasiado largo." }),
  descripcion: z.string().trim().max(500, { message: "La descripción es demasiado larga." }).optional(),
  activo: z.boolean().optional(),
});

export const almacenSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, { message: "Escribe el nombre del almacén." })
    .max(120, { message: "El nombre del almacén es demasiado largo." }),
  activo: z.boolean().optional(),
});

export const TIPOS_LISTA_PRECIO = ["fijo", "porcentaje"] as const;

export const listaPrecioSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, { message: "Escribe el nombre de la lista de precios." })
    .max(120, { message: "El nombre de la lista de precios es demasiado largo." }),
  tipo: z.enum(TIPOS_LISTA_PRECIO, { message: "Selecciona el tipo de lista." }),
  es_principal: z.boolean().optional(),
  activo: z.boolean().optional(),
});

export const transferenciaLineaSchema = z.object({
  producto_id: z.uuid({ message: "Selecciona un producto válido." }),
  cantidad: z.coerce.number().finite().positive({ message: "La cantidad debe ser mayor que cero." }),
});

export const transferenciaSchema = z
  .object({
    fecha: z.iso.date({ message: "La fecha no es válida." }),
    origen_id: z.uuid({ message: "Selecciona el almacén de origen." }),
    destino_id: z.uuid({ message: "Selecciona el almacén de destino." }),
    observaciones: z.string().trim().max(2000, { message: "Las observaciones son demasiado largas." }).optional(),
    lineas: z
      .array(transferenciaLineaSchema)
      .min(1, { message: "Agrega al menos un producto." })
      .max(200, { message: "Una transferencia no puede pasar de 200 líneas." }),
  })
  .refine((datos) => datos.origen_id !== datos.destino_id, {
    message: "El almacén de origen y el de destino deben ser distintos.",
    path: ["destino_id"],
  });

export type AjusteEntrada = z.infer<typeof ajusteSchema>;
export type CategoriaEntrada = z.infer<typeof categoriaSchema>;
export type AlmacenEntrada = z.infer<typeof almacenSchema>;
export type ListaPrecioEntrada = z.infer<typeof listaPrecioSchema>;
export type TransferenciaEntrada = z.infer<typeof transferenciaSchema>;

import { z } from "zod";

import { parsearMonto } from "@/lib/productos/productos";

import { ESTADOS_CONTEO, TIPOS_PRODUCTO } from "./tipos";

/**
 * Esquemas de la capa de ferretería. Los montos y cantidades se validan como
 * texto decimal (máximo 2 decimales; el factor de la unidad, 4) para que el
 * payload llegue a la RPC como string y nunca como float.
 */

const DECIMAL_2 = /^-?\d+(?:\.\d{1,2})?$/;
const DECIMAL_4 = /^-?\d+(?:\.\d{1,4})?$/;

export const idSchema = z.uuid("El identificador no es válido.");

/** Acepta ``1,500.25`` o ``1250,50`` con el mismo criterio que las pantallas. */
function textoDecimal(valor: unknown): string {
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : "";
  if (typeof valor !== "string") return "";

  const numero = parsearMonto(valor);
  return numero === null ? valor.trim() : String(numero);
}

function decimal2(mensajeFormato: string) {
  return z.preprocess(textoDecimal, z.string().regex(DECIMAL_2, { message: mensajeFormato }));
}

function decimal4(mensajeFormato: string) {
  return z.preprocess(textoDecimal, z.string().regex(DECIMAL_4, { message: mensajeFormato }));
}

function uuidOpcional(mensaje: string) {
  return z.preprocess((valor) => (valor === "" || valor === null ? undefined : valor), z.uuid(mensaje).optional());
}

function uuidNulo(mensaje: string) {
  return z.preprocess((valor) => (valor === "" || valor === undefined ? null : valor), z.uuid(mensaje).nullable());
}

function textoOpcional(maximo: number, mensaje: string) {
  return z.preprocess(
    (valor) => (valor === null || valor === undefined ? undefined : String(valor).trim()),
    z.string().max(maximo, { message: mensaje }).optional(),
  );
}

// ---------------------------------------------------------------------------
// Producto: marca, favorito del POS y ubicación física
// ---------------------------------------------------------------------------

export const datosFerreteriaProductoSchema = z.object({
  marca: textoOpcional(120, "La marca es demasiado larga."),
  favorito_pos: z.boolean({ message: "El favorito del POS no es válido." }).optional(),
  ubicacion: textoOpcional(120, "La ubicación es demasiado larga."),
  almacen_id: uuidOpcional("Selecciona un almacén válido."),
});

export type DatosFerreteriaProductoEntrada = z.infer<typeof datosFerreteriaProductoSchema>;

// ---------------------------------------------------------------------------
// Códigos de barra
// ---------------------------------------------------------------------------

export const codigoBarraSchema = z.object({
  codigo: z
    .string({ message: "El código de barra es obligatorio." })
    .trim()
    .min(1, { message: "El código de barra es obligatorio." })
    .max(64, { message: "El código de barra es demasiado largo." }),
  unidad_id: uuidNulo("La unidad del código no es válida."),
  principal: z.boolean({ message: "El código principal no es válido." }).default(false),
});

export type CodigoBarraEntrada = z.infer<typeof codigoBarraSchema>;

export const codigosBarraProductoSchema = z
  .object({
    codigos: z.array(codigoBarraSchema).max(50, { message: "Un producto no puede tener más de 50 códigos de barra." }),
  })
  .superRefine((datos, ctx) => {
    const vistos = new Set<string>();
    let principales = 0;

    for (const [indice, codigo] of datos.codigos.entries()) {
      const normalizado = codigo.codigo.toLowerCase();
      if (vistos.has(normalizado)) {
        ctx.addIssue({
          code: "custom",
          message: "Repetiste un código de barra en la lista.",
          path: ["codigos", indice, "codigo"],
        });
      }
      vistos.add(normalizado);

      if (codigo.principal) principales += 1;
    }

    if (principales > 1) {
      ctx.addIssue({
        code: "custom",
        message: "Solo un código de barra puede ser el principal.",
        path: ["codigos"],
      });
    }
  });

export type CodigosBarraProductoEntrada = z.infer<typeof codigosBarraProductoSchema>;

// ---------------------------------------------------------------------------
// Unidades de medida (presentaciones con conversión a la unidad base)
// ---------------------------------------------------------------------------

export const unidadMedidaSchema = z.object({
  id: uuidOpcional("La unidad de medida no es válida."),
  nombre: z
    .string({ message: "Cada unidad requiere un nombre." })
    .trim()
    .min(1, { message: "Cada unidad requiere un nombre." })
    .max(60, { message: "El nombre de la unidad es demasiado largo." }),
  factor_base: decimal4("El factor de la unidad debe ser un número de hasta 4 decimales.").refine(
    (valor) => Number(valor) > 0,
    { message: "El factor de la unidad debe ser mayor a cero." },
  ),
  precio: z
    .preprocess(
      (valor) => (valor === "" || valor === null || valor === undefined ? null : textoDecimal(valor)),
      z.union([z.string().regex(DECIMAL_2, "El precio debe ser un número de hasta 2 decimales."), z.null()]),
    )
    .refine((valor) => valor === null || Number(valor) >= 0, { message: "El precio no puede ser negativo." }),
  es_compra: z.boolean({ message: "El indicador de compra no es válido." }).default(false),
  es_venta: z.boolean({ message: "El indicador de venta no es válido." }).default(true),
  activa: z.boolean({ message: "El estado de la unidad no es válido." }).default(true),
});

export type UnidadMedidaEntrada = z.infer<typeof unidadMedidaSchema>;

export const unidadesProductoSchema = z
  .object({
    unidades: z.array(unidadMedidaSchema).max(30, { message: "Un producto no puede tener más de 30 unidades." }),
  })
  .superRefine((datos, ctx) => {
    const vistos = new Set<string>();

    for (const [indice, unidad] of datos.unidades.entries()) {
      const normalizado = unidad.nombre.toLowerCase();
      if (vistos.has(normalizado)) {
        ctx.addIssue({
          code: "custom",
          message: "Repetiste el nombre de una unidad.",
          path: ["unidades", indice, "nombre"],
        });
      }
      vistos.add(normalizado);
    }
  });

export type UnidadesProductoEntrada = z.infer<typeof unidadesProductoSchema>;

// ---------------------------------------------------------------------------
// Receta de un combo
// ---------------------------------------------------------------------------

export const comboComponenteSchema = z.object({
  componente_id: z.uuid({ message: "Selecciona un producto válido." }),
  cantidad: decimal2("La cantidad del componente debe ser un número de hasta 2 decimales.").refine(
    (valor) => Number(valor) > 0,
    { message: "La cantidad del componente debe ser mayor a cero." },
  ),
  /**
   * Contexto del formulario: permite rechazar un combo anidado antes de
   * llamar la RPC. La base vuelve a validarlo y es la autoridad final.
   */
  tipo: z.enum(TIPOS_PRODUCTO, { message: "El tipo del componente no es válido." }).optional(),
});

export type ComboComponenteEntrada = z.infer<typeof comboComponenteSchema>;

export function recetaComboSchema(comboId: string) {
  return z
    .object({
      componentes: z.array(comboComponenteSchema).max(100, { message: "Un combo no puede pasar de 100 componentes." }),
    })
    .superRefine((datos, ctx) => {
      const vistos = new Set<string>();

      for (const [indice, componente] of datos.componentes.entries()) {
        if (componente.componente_id === comboId) {
          ctx.addIssue({
            code: "custom",
            message: "Un combo no puede ser componente de sí mismo.",
            path: ["componentes", indice, "componente_id"],
          });
        }

        if (componente.tipo === "combo") {
          ctx.addIssue({
            code: "custom",
            message: "Un combo no puede tener componentes que sean combos.",
            path: ["componentes", indice, "componente_id"],
          });
        }

        if (vistos.has(componente.componente_id)) {
          ctx.addIssue({
            code: "custom",
            message: "Repetiste el mismo componente en el combo.",
            path: ["componentes", indice, "componente_id"],
          });
        }
        vistos.add(componente.componente_id);
      }
    });
}

export type RecetaComboEntrada = z.infer<ReturnType<typeof recetaComboSchema>>;

// ---------------------------------------------------------------------------
// Conteo físico
// ---------------------------------------------------------------------------

export const conteoLineaSchema = z.object({
  producto_id: z.uuid({ message: "Selecciona un producto válido." }),
  cantidad_contada: decimal2("La cantidad contada debe ser un número de hasta 2 decimales.").refine(
    (valor) => Number(valor) >= 0,
    { message: "La cantidad contada no puede ser negativa." },
  ),
  notas: textoOpcional(500, "La nota de la línea es demasiado larga."),
});

export type ConteoLineaEntrada = z.infer<typeof conteoLineaSchema>;

function productosRepetidos(lineas: { producto_id: string }[]): number[] {
  const vistos = new Set<string>();
  const repetidos: number[] = [];

  for (const [indice, linea] of lineas.entries()) {
    if (vistos.has(linea.producto_id)) repetidos.push(indice);
    vistos.add(linea.producto_id);
  }

  return repetidos;
}

export const crearConteoSchema = z
  .object({
    almacen_id: z.uuid({ message: "Selecciona el almacén del conteo." }),
    fecha: z.iso.date({ message: "La fecha del conteo no es válida." }),
    notas: textoOpcional(2000, "Las notas del conteo son demasiado largas."),
    lineas: z.array(conteoLineaSchema).max(5000, { message: "Un conteo no puede pasar de 5,000 líneas." }).default([]),
  })
  .superRefine((datos, ctx) => {
    for (const indice of productosRepetidos(datos.lineas)) {
      ctx.addIssue({
        code: "custom",
        message: "Repetiste un producto en el conteo.",
        path: ["lineas", indice, "producto_id"],
      });
    }
  });

export type CrearConteoEntrada = z.infer<typeof crearConteoSchema>;

export const lineasConteoSchema = z
  .object({
    lineas: z.array(conteoLineaSchema).max(5000, { message: "Un conteo no puede pasar de 5,000 líneas." }).default([]),
  })
  .superRefine((datos, ctx) => {
    for (const indice of productosRepetidos(datos.lineas)) {
      ctx.addIssue({
        code: "custom",
        message: "Repetiste un producto en el conteo.",
        path: ["lineas", indice, "producto_id"],
      });
    }
  });

export type LineasConteoEntrada = z.infer<typeof lineasConteoSchema>;

export const filtroConteoSchema = z
  .object({
    almacen_id: uuidOpcional("El almacén del filtro no es válido."),
    estado: z.enum(ESTADOS_CONTEO, { message: "El estado del conteo no es válido." }).optional(),
    desde: z.iso.date({ message: "La fecha desde no es válida." }).optional(),
    hasta: z.iso.date({ message: "La fecha hasta no es válida." }).optional(),
  })
  .refine((datos) => !datos.desde || !datos.hasta || datos.desde <= datos.hasta, {
    message: "La fecha desde no puede ser mayor que la fecha hasta.",
    path: ["desde"],
  });

export type FiltroConteoEntrada = z.infer<typeof filtroConteoSchema>;

// ---------------------------------------------------------------------------
// Filtros de lectura (POS y reportes)
// ---------------------------------------------------------------------------

export const busquedaCodigoBarraSchema = z.object({
  codigo: z
    .string({ message: "Escribe o escanea un código de barra." })
    .trim()
    .min(1, { message: "Escribe o escanea un código de barra." })
    .max(64, { message: "El código de barra es demasiado largo." }),
  almacen_id: uuidOpcional("El almacén no es válido."),
  lista_precio_id: uuidOpcional("La lista de precios no es válida."),
});

export type BusquedaCodigoBarraEntrada = z.infer<typeof busquedaCodigoBarraSchema>;

export const filtroCatalogoPosSchema = z.object({
  almacen_id: uuidOpcional("El almacén no es válido."),
  lista_precio_id: uuidOpcional("La lista de precios no es válida."),
  busqueda: textoOpcional(120, "La búsqueda es demasiado larga."),
  categoria_id: uuidOpcional("La categoría no es válida."),
  solo_favoritos: z.boolean({ message: "El filtro de favoritos no es válido." }).default(false),
  limit: z.coerce
    .number({ message: "El límite debe ser un número." })
    .int({ message: "El límite debe ser un entero." })
    .min(1, { message: "El límite debe estar entre 1 y 200." })
    .max(200, { message: "El límite debe estar entre 1 y 200." })
    .default(50),
  offset: z.coerce
    .number({ message: "El desplazamiento debe ser un número." })
    .int({ message: "El desplazamiento debe ser un entero." })
    .min(0, { message: "El desplazamiento no puede ser negativo." })
    .default(0),
});

export type FiltroCatalogoPosEntrada = z.infer<typeof filtroCatalogoPosSchema>;

export function mensajeValidacion(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

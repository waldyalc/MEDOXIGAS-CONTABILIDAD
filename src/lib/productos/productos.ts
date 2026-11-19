import { z } from "zod";

import type { PrecioLista } from "@/lib/inventario/tipos";

export type ProductoTipo = "producto" | "servicio" | "combo";
export type TasaItbis = 0 | 2 | 10 | 16 | 18;

export const SIN_CATEGORIA = "__sin_categoria__";

export interface Producto {
  id: string;
  nombre: string;
  tipo: ProductoTipo;
  referencia: string | null;
  descripcion: string | null;
  precio: number;
  itbis_tasa: number;
  impuesto_id: string | null;
  inventariable: boolean;
  cantidad: number;
  costo: number;
  categoria_id: string | null;
  precios: PrecioLista[];
  activo: boolean;
  unidad_medida: string;
  almacen_id: string | null;
  vende_negativo: boolean;
  imagen_path: string | null;
}

export const TASAS_ITBIS: { valor: TasaItbis; etiqueta: string }[] = [
  { valor: 18, etiqueta: "18 %" },
  { valor: 16, etiqueta: "16 %" },
  { valor: 0, etiqueta: "0 %" },
];

export function etiquetaTasaItbis(tasa: number) {
  if (tasa === 2) return "CDT 2 %";
  if (tasa === 10) return "Propina 10 %";
  return TASAS_ITBIS.find((item) => item.valor === tasa)?.etiqueta ?? `${tasa} %`;
}

export function etiquetaTipoProducto(tipo: ProductoTipo) {
  if (tipo === "servicio") return "Servicio";
  if (tipo === "combo") return "Combo";
  return "Producto";
}

export function parsearMonto(texto: string): number | null {
  let valor = texto.replace(/RD\$/gi, "").replace(/\s/g, "");
  if (valor === "") return null;

  const tieneComa = valor.includes(",");
  const tienePunto = valor.includes(".");

  if (tieneComa && tienePunto) {
    valor = valor.replace(/,/g, "");
  } else if (tieneComa) {
    if (/,\d{1,2}$/.test(valor)) {
      valor = valor.replace(",", ".");
    } else {
      valor = valor.replace(/,/g, "");
    }
  }

  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

export function normalizarReferencia(valor: string) {
  return valor.trim().toUpperCase();
}

export function normalizarNombre(valor: string) {
  return valor.trim().replace(/\s+/g, " ");
}

export function textoOpcional(valor: string | null | undefined): string | null {
  const texto = (valor ?? "").trim();
  return texto === "" ? null : texto;
}

function aNumero(valor: number | string | null | undefined) {
  if (valor === null || valor === undefined || valor === "") return Number.NaN;
  const numero = typeof valor === "string" ? Number(valor) : valor;
  return Number.isFinite(numero) ? numero : Number.NaN;
}

const formatoMonedaNumero = new Intl.NumberFormat("es-DO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatoCantidadNumero = new Intl.NumberFormat("es-DO", {
  maximumFractionDigits: 2,
});

export function formatoMoneda(valor: number | string | null | undefined) {
  const numero = aNumero(valor);
  if (Number.isNaN(numero)) return "—";
  return `RD$ ${formatoMonedaNumero.format(numero)}`;
}

export function formatoCantidad(valor: number | string | null | undefined) {
  const numero = aNumero(valor);
  if (Number.isNaN(numero)) return "—";
  return formatoCantidadNumero.format(numero);
}

function normalizarBusqueda(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function filtrarProductos(productos: Producto[], busqueda: string): Producto[] {
  const termino = normalizarBusqueda(busqueda);
  if (termino === "") return productos;
  return productos.filter((producto) =>
    [producto.nombre, producto.referencia ?? ""].some((valor) => normalizarBusqueda(valor).includes(termino)),
  );
}

const campoTipo = z.enum(["producto", "servicio", "combo"]);

const campoPrecio = z.union([z.string(), z.number()]).transform((valor, ctx) => {
  if (typeof valor === "number") {
    if (Number.isFinite(valor) && valor >= 0) return valor;
    ctx.addIssue({ code: "custom", message: "Precio inválido" });
    return 0;
  }

  if (valor.trim() === "") {
    ctx.addIssue({ code: "custom", message: "El precio es obligatorio" });
    return 0;
  }

  const monto = parsearMonto(valor);
  if (monto === null) {
    ctx.addIssue({ code: "custom", message: "Precio inválido" });
    return 0;
  }

  return monto;
});

const campoOpcional = z.string().nullish().transform(textoOpcional);

export const CAMPOS_CUENTA_PRODUCTO = ["cuenta_ingreso_id", "cuenta_inventario_id", "cuenta_costo_id"] as const;

export type CampoCuentaProducto = (typeof CAMPOS_CUENTA_PRODUCTO)[number];

/**
 * Solo viaja si el formulario envía el campo. Así el diálogo, la importación y
 * la edición masiva siguen sin tocar las cuentas que ya tenga el producto.
 */
const campoCuenta = z
  .string()
  .transform(textoOpcional)
  .refine((valor) => valor === null || z.uuid().safeParse(valor).success, "La cuenta contable no es válida")
  .optional();

/**
 * Campos que Alegra agregó al producto. Igual que las cuentas, solo viajan si
 * el formulario los envía para no alterar altas viejas, la importación ni la
 * edición masiva.
 */
const campoUnidadMedida = z
  .string()
  .transform((valor) => valor.trim())
  .refine((valor) => valor.length > 0, "La unidad de medida es obligatoria")
  .refine((valor) => valor.length <= 60, "La unidad de medida no puede pasar de 60 caracteres")
  .optional();

const campoAlmacen = z
  .string()
  .transform(textoOpcional)
  .refine((valor) => valor === null || z.uuid().safeParse(valor).success, "El almacén no es válido")
  .optional();

const campoImagen = z
  .string()
  .transform(textoOpcional)
  .refine((valor) => valor === null || valor.length <= 500, "La ruta de la imagen no es válida")
  .optional();

const campoCantidadOpcional = z
  .union([z.literal(""), z.coerce.number().min(0, "La cantidad no puede ser negativa")])
  .transform((valor) => (valor === "" ? null : valor))
  .nullish();

const campoExistenciaAlmacen = z.object({
  almacen_id: z
    .string()
    .refine((valor) => z.uuid().safeParse(valor).success, "El almacén de la existencia no es válido"),
  minimo: z
    .union([z.literal(""), z.coerce.number().min(0, "El mínimo no puede ser negativo")])
    .transform((valor) => (valor === "" ? 0 : valor))
    .default(0),
  maximo: z
    .union([z.literal(""), z.coerce.number().min(0, "El máximo no puede ser negativo")])
    .transform((valor) => (valor === "" ? null : valor))
    .nullable()
    .default(null),
});

export const esquemaProducto = z
  .object({
    nombre: z
      .string()
      .transform(normalizarNombre)
      .refine((valor) => valor.length > 0, "El nombre es obligatorio")
      .refine((valor) => valor.length <= 200, "El nombre no puede pasar de 200 caracteres"),
    tipo: campoTipo.default("producto"),
    referencia: z
      .string()
      .nullish()
      .transform((valor) => textoOpcional(normalizarReferencia(valor ?? ""))),
    descripcion: campoOpcional,
    precio: campoPrecio,
    itbis_tasa: z.coerce
      .number()
      .refine((valor) => [0, 2, 10, 16, 18].includes(valor), "La tarifa del impuesto no está en el catálogo")
      .default(18),
    impuesto_id: z
      .string()
      .nullish()
      .transform((valor) => textoOpcional(valor))
      .refine((valor) => valor === null || z.uuid().safeParse(valor).success, "El impuesto no es vA�lido"),
    inventariable: z.boolean().default(false),
    cantidad: z.coerce.number().min(0, "La cantidad no puede ser negativa").default(0),
    costo: z.coerce.number().min(0, "El costo no puede ser negativo").default(0),
    categoria_id: z
      .string()
      .nullish()
      .transform((valor) => {
        const texto = textoOpcional(valor);
        return texto === SIN_CATEGORIA ? null : texto;
      })
      .refine((valor) => valor === null || z.uuid().safeParse(valor).success, "La categoría no es válida"),
    activo: z.boolean().optional(),
    cuenta_ingreso_id: campoCuenta,
    cuenta_inventario_id: campoCuenta,
    cuenta_costo_id: campoCuenta,
    unidad_medida: campoUnidadMedida,
    almacen_id: campoAlmacen,
    vende_negativo: z.boolean().optional(),
    imagen_path: campoImagen,
    minimo: campoCantidadOpcional,
    maximo: campoCantidadOpcional,
    existencias: z.array(campoExistenciaAlmacen).optional(),
  })
  .transform((datos) => {
    const inventariable = datos.tipo === "producto" ? datos.inventariable : false;
    const cuentas: Partial<Record<CampoCuentaProducto, string | null>> = {};
    for (const campo of CAMPOS_CUENTA_PRODUCTO) {
      const valor = datos[campo];
      if (valor !== undefined) cuentas[campo] = valor;
    }

    return {
      nombre: datos.nombre,
      tipo: datos.tipo,
      referencia: datos.referencia,
      descripcion: datos.descripcion,
      precio: datos.precio,
      itbis_tasa: datos.itbis_tasa,
      impuesto_id: datos.impuesto_id,
      inventariable,
      cantidad: inventariable ? datos.cantidad : 0,
      costo: inventariable ? datos.costo : 0,
      categoria_id: datos.categoria_id,
      activo: datos.activo,
      ...cuentas,
      ...(datos.unidad_medida === undefined ? {} : { unidad_medida: datos.unidad_medida }),
      ...(datos.almacen_id === undefined ? {} : { almacen_id: datos.almacen_id }),
      // La venta en negativo solo aplica a productos que controlan inventario:
      // la RPC remota guarda el flag verbatim, así que se normaliza aquí.
      ...(datos.vende_negativo === undefined ? {} : { vende_negativo: inventariable && datos.vende_negativo }),
      ...(datos.imagen_path === undefined ? {} : { imagen_path: datos.imagen_path }),
      ...(datos.minimo === undefined ? {} : { minimo: datos.minimo }),
      ...(datos.maximo === undefined ? {} : { maximo: datos.maximo }),
      ...(datos.existencias === undefined ? {} : { existencias: datos.existencias }),
    };
  });

export type DatosProducto = z.infer<typeof esquemaProducto>;

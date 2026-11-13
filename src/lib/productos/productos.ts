import { z } from "zod";

export type ProductoTipo = "producto" | "servicio";

export const SIN_CATEGORIA = "__sin_categoria__";

export interface Producto {
  id: string;
  nombre: string;
  tipo: ProductoTipo;
  referencia: string | null;
  descripcion: string | null;
  precio: number;
  itbis_tasa: number;
  inventariable: boolean;
  cantidad: number;
  costo: number;
  categoria_id: string | null;
}

export const TASAS_ITBIS: { valor: number; etiqueta: string }[] = [
  { valor: 18, etiqueta: "18 %" },
  { valor: 16, etiqueta: "16 %" },
  { valor: 0, etiqueta: "0 %" },
];

export function etiquetaTasaItbis(tasa: number) {
  return TASAS_ITBIS.find((item) => item.valor === tasa)?.etiqueta ?? `${tasa} %`;
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

const campoTipo = z.enum(["producto", "servicio"]);

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
      .refine((valor) => valor === 0 || valor === 16 || valor === 18, "La tasa de ITBIS no es válida")
      .default(18),
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
  })
  .transform((datos) => {
    const inventariable = datos.tipo === "servicio" ? false : datos.inventariable;
    return {
      nombre: datos.nombre,
      tipo: datos.tipo,
      referencia: datos.referencia,
      descripcion: datos.descripcion,
      precio: datos.precio,
      itbis_tasa: datos.itbis_tasa,
      inventariable,
      cantidad: inventariable ? datos.cantidad : 0,
      costo: inventariable ? datos.costo : 0,
      categoria_id: datos.categoria_id,
    };
  });

export type DatosProducto = z.infer<typeof esquemaProducto>;

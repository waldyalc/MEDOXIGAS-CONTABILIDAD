import { z } from "zod";

// Catálogo fiscal de la DGII que Alegra configura por cuenta contable
// (Reportes → Fiscales → configuración del reporte). Los códigos y el orden
// son los del instructivo 606/607 y la prueba real del 19–20 nov 2026.

export const CATEGORIAS_DGII = [
  { valor: "01", etiqueta: "01 · Gastos de personal", corta: "01 · Gastos de personal" },
  { valor: "02", etiqueta: "02 · Gastos por trabajos, suministros y servicios", corta: "02 · Trabajos y servicios" },
  { valor: "03", etiqueta: "03 · Arrendamientos", corta: "03 · Arrendamientos" },
  { valor: "04", etiqueta: "04 · Gastos de activos fijos", corta: "04 · Activos fijos" },
  { valor: "05", etiqueta: "05 · Gastos de representación", corta: "05 · Representación" },
  { valor: "06", etiqueta: "06 · Otras deducciones admitidas", corta: "06 · Otras deducciones" },
  { valor: "07", etiqueta: "07 · Gastos financieros", corta: "07 · Gastos financieros" },
  { valor: "08", etiqueta: "08 · Gastos extraordinarios", corta: "08 · Extraordinarios" },
  {
    valor: "09",
    etiqueta: "09 · Compras y gastos que hacen parte del costo de venta",
    corta: "09 · Costo de venta",
  },
  { valor: "10", etiqueta: "10 · Adquisiciones de activos", corta: "10 · Adquisiciones de activos" },
] as const;

export const TIPOS_COMPRA = [
  { valor: "bienes", etiqueta: "Bienes", corta: "Bienes" },
  { valor: "servicio", etiqueta: "Servicio", corta: "Servicio" },
] as const;

export const TIPOS_INGRESO = [
  {
    valor: "1",
    etiqueta: "1 · Ingresos por operaciones (No financieros)",
    corta: "1 · Operaciones (no financieros)",
  },
  { valor: "2", etiqueta: "2 · Ingresos financieros", corta: "2 · Financieros" },
  { valor: "3", etiqueta: "3 · Ingresos extraordinarios", corta: "3 · Extraordinarios" },
  { valor: "4", etiqueta: "4 · Ingresos por arrendamientos", corta: "4 · Arrendamientos" },
  { valor: "5", etiqueta: "5 · Ingresos por ventas de activos depreciables", corta: "5 · Venta de activos" },
  { valor: "6", etiqueta: "6 · Otros ingresos", corta: "6 · Otros ingresos" },
] as const;

export const VALORES_CATEGORIA_DGII = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"] as const;
export const VALORES_TIPO_COMPRA = ["bienes", "servicio"] as const;
export const VALORES_TIPO_INGRESO = ["1", "2", "3", "4", "5", "6"] as const;

/** Etiqueta legible de la categoría DGII (para la tabla y las pruebas). */
export function etiquetaCategoriaDgii(valor: string | null): string {
  return CATEGORIAS_DGII.find((categoria) => categoria.valor === valor)?.etiqueta ?? "Sin clasificar";
}

export function etiquetaTipoCompra(valor: string | null): string {
  return TIPOS_COMPRA.find((tipo) => tipo.valor === valor)?.etiqueta ?? "Sin clasificar";
}

export function etiquetaTipoIngreso(valor: string | null): string {
  return TIPOS_INGRESO.find((tipo) => tipo.valor === valor)?.etiqueta ?? "Sin clasificar";
}

const campoOpcional = z
  .string()
  .nullish()
  .transform((valor) => (valor ?? "").trim())
  .transform((valor) => (valor === "" ? null : valor));

export const esquemaClasificacionDgii = z.object({
  cuentaId: z.uuid("La cuenta no es válida"),
  categoriaDgii: campoOpcional.pipe(z.enum(VALORES_CATEGORIA_DGII, "La categoría DGII no es válida").nullable()),
  tipoCompra: campoOpcional.pipe(z.enum(VALORES_TIPO_COMPRA, "El tipo de compra no es válido").nullable()),
  tipoIngreso: campoOpcional.pipe(z.enum(VALORES_TIPO_INGRESO, "El tipo de ingreso no es válido").nullable()),
});

export type DatosClasificacionDgii = z.infer<typeof esquemaClasificacionDgii>;

export interface CuentaDgii {
  id: string;
  codigo: string;
  nombre: string;
  categoriaDgii: string | null;
  tipoCompra: string | null;
  tipoIngreso: string | null;
}

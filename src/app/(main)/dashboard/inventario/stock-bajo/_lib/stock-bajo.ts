import { centavosDeDecimal } from "@/lib/inventario/ferreteria/mapeo";
import type { ProductoStockBajo } from "@/lib/inventario/ferreteria/tipos";

/**
 * Fila del reporte de stock bajo ya enriquecida para la pantalla: el producto
 * y sus cantidades vienen de `reporte_stock_bajo`; la categoría y los códigos
 * de barra se leen aparte (la RPC no los devuelve).
 */
export interface FilaStockBajo extends ProductoStockBajo {
  categoria: string | null;
  codigos: readonly string[];
}

/** Las tres situaciones del reporte, mutuamente excluyentes. */
export type SituacionStock = "critico" | "bajo" | "sin-stock";

export interface ResumenStock {
  criticos: number;
  bajoMinimo: number;
  sinStock: number;
  total: number;
}

/**
 * Criticidad de una fila: negativa = crítico, cero = sin stock y positiva
 * (siempre ≤ mínimo, porque la RPC solo trae esos) = bajo mínimo. Se compara
 * en centavos enteros, nunca con floats.
 */
export function clasificarStock(fila: Pick<ProductoStockBajo, "cantidad">): SituacionStock {
  const cantidad = centavosDeDecimal(fila.cantidad);

  if (cantidad < 0) return "critico";
  if (cantidad === 0) return "sin-stock";
  return "bajo";
}

export function etiquetaSituacion(situacion: SituacionStock): string {
  if (situacion === "critico") return "Crítico";
  if (situacion === "sin-stock") return "Sin stock";
  return "Bajo mínimo";
}

export function resumirStock(filas: readonly Pick<FilaStockBajo, "cantidad">[]): ResumenStock {
  const resumen: ResumenStock = { criticos: 0, bajoMinimo: 0, sinStock: 0, total: filas.length };

  for (const fila of filas) {
    const situacion = clasificarStock(fila);
    if (situacion === "critico") resumen.criticos += 1;
    else if (situacion === "sin-stock") resumen.sinStock += 1;
    else resumen.bajoMinimo += 1;
  }

  return resumen;
}

function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Búsqueda local por nombre, referencia o código de barra, sin acentos ni mayúsculas. */
export function filtrarStockBajo(filas: readonly FilaStockBajo[], busqueda: string): FilaStockBajo[] {
  const termino = normalizarTexto(busqueda);
  if (termino === "") return [...filas];

  return filas.filter((fila) =>
    [fila.nombre, fila.referencia ?? "", ...fila.codigos].some((valor) => normalizarTexto(valor).includes(termino)),
  );
}

function celdaCsv(valor: string): string {
  return /[",\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/**
 * CSV del listado filtrado, con las cantidades como decimales crudos
 * (`numeric` de Postgres, punto decimal) para que Excel no las reinterprete.
 */
export function csvStockBajo(filas: readonly FilaStockBajo[]): string {
  const encabezados = [
    "Producto",
    "Referencia",
    "Marca",
    "Categoría",
    "Existencia",
    "Mínimo",
    "Máximo",
    "Sugerido",
    "Ubicación",
    "Situación",
  ];

  const lineas = filas.map((fila) => [
    fila.nombre,
    fila.referencia ?? "",
    fila.marca ?? "",
    fila.categoria ?? "",
    fila.cantidad,
    fila.minimo,
    fila.maximo ?? "",
    fila.sugerido,
    fila.ubicacion ?? "",
    etiquetaSituacion(clasificarStock(fila)),
  ]);

  return `${[encabezados, ...lineas].map((linea) => linea.map(celdaCsv).join(",")).join("\r\n")}\r\n`;
}

/** Fecha de hoy en República Dominicana, en formato `YYYY-MM-DD`. */
export function fechaArchivoRd(fecha: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo" }).format(fecha);
}

/** `stock-bajo-<almacén>-<fecha>.csv`, sin acentos ni espacios en el nombre. */
export function nombreArchivoStockBajo(almacen: string, fecha: string): string {
  const slug =
    normalizarTexto(almacen)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "almacen";

  return `stock-bajo-${slug}-${fecha}.csv`;
}

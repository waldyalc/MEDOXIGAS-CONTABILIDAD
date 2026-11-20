import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { createClient } from "@/lib/supabase/server";

const TAMANO_LOTE = 200;

interface FilaDetalleProducto {
  id: string;
  categorias_productos: { nombre: string } | null;
  producto_codigos_barra: { codigo: string }[] | null;
}

export interface DetalleProducto {
  categoria: string | null;
  codigos: string[];
}

/**
 * Categoría y códigos de barra de los productos del reporte. `reporte_stock_bajo`
 * no los devuelve y `src/lib` está congelado en esta tarea, así que se leen
 * aquí en lotes de 200 ids (PostgREST corta en 1,000 filas por consulta).
 */
export async function cargarDetallesProductos(ids: readonly string[]): Promise<Map<string, DetalleProducto>> {
  const detalles = new Map<string, DetalleProducto>();
  if (ids.length === 0) return detalles;

  const supabase = await createClient();

  for (let inicio = 0; inicio < ids.length; inicio += TAMANO_LOTE) {
    const lote = ids.slice(inicio, inicio + TAMANO_LOTE);
    const { data, error } = await supabase
      .from("productos")
      .select("id, categorias_productos(nombre), producto_codigos_barra(codigo)")
      .in("id", lote)
      .order("id")
      .returns<FilaDetalleProducto[]>();

    if (error) throw new Error(mensajeErrorRpc(error));

    for (const fila of data ?? []) {
      detalles.set(fila.id, {
        categoria: fila.categorias_productos?.nombre ?? null,
        codigos: (fila.producto_codigos_barra ?? [])
          .map((codigo) => codigo.codigo.trim())
          .filter((codigo) => codigo !== "")
          .sort((a, b) => a.localeCompare(b, "es")),
      });
    }
  }

  return detalles;
}

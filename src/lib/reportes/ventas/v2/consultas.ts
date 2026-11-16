import { createClient } from "@/lib/supabase/server";

import type { LineaVenta } from "./tipos";

const TAMANO_PAGINA = 1000;

interface FilaLineaConsulta {
  producto_id: string | null;
  descripcion: string;
  cantidad: number;
  subtotal: number;
  total: number;
  costo_unitario: number;
  productos: { nombre: string; referencia: string | null } | null;
}

export interface RespuestaLineasVenta {
  lineas: LineaVenta[];
  error: string | null;
}

function aLinea(fila: FilaLineaConsulta): LineaVenta {
  return {
    productoId: fila.producto_id,
    nombre: fila.productos?.nombre ?? fila.descripcion,
    referencia: fila.productos?.referencia ?? null,
    cantidad: fila.cantidad,
    subtotal: fila.subtotal,
    total: fila.total,
    costoUnitario: fila.costo_unitario,
  };
}

/**
 * Líneas de facturas de venta no anuladas del período.
 *
 * El costo sale de factura_lineas.costo_unitario, que crear_factura copia de
 * productos.costo al momento de la venta (costo histórico); las líneas de
 * servicios o productos no inventariables quedan en 0.
 */
export async function obtenerLineasVenta(desde: string, hasta: string): Promise<RespuestaLineasVenta> {
  const supabase = await createClient();
  const lineas: LineaVenta[] = [];

  for (let inicio = 0; ; inicio += TAMANO_PAGINA) {
    const { data, error } = await supabase
      .from("factura_lineas")
      .select(
        "producto_id, descripcion, cantidad, subtotal, total, costo_unitario, facturas!inner(fecha, estado), productos(nombre, referencia)",
      )
      .gte("facturas.fecha", desde)
      .lte("facturas.fecha", hasta)
      .neq("facturas.estado", "anulada")
      .order("id")
      .range(inicio, inicio + TAMANO_PAGINA - 1)
      .returns<FilaLineaConsulta[]>();

    if (error) return { lineas: [], error: error.message };

    const filas = data ?? [];
    lineas.push(...filas.map(aLinea));

    if (filas.length < TAMANO_PAGINA) break;
  }

  return { lineas, error: null };
}

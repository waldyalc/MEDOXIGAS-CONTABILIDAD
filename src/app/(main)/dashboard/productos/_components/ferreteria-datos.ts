import { z } from "zod";

import { aNumero } from "@/lib/facturacion/formato";
import type { ExistenciaAlmacen } from "@/lib/inventario/tipos";
import { createClient } from "@/lib/supabase/server";

export interface DatosFerreteriaProducto {
  marca: string | null;
  favorito_pos: boolean;
  ubicacion: string | null;
}

export interface ExistenciaFerreteria extends ExistenciaAlmacen {
  ubicacion: string | null;
}

interface FilaExistencia {
  almacen_id: string;
  ubicacion: string | null;
  cantidad: number;
  cantidad_inicial: number;
  minimo: number;
  maximo: number | null;
  almacenes: { nombre: string; es_principal: boolean } | null;
}

/** Marca, favorito del POS y ubicación por defecto del producto (columnas de la fase 1A). */
export async function obtenerDatosFerreteriaProducto(id: string): Promise<DatosFerreteriaProducto | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("productos")
    .select("marca, favorito_pos, ubicacion")
    .eq("id", id)
    .maybeSingle<DatosFerreteriaProducto>();

  if (error) throw new Error(error.message);
  return data;
}

/** Existencias por almacén con su ubicación real (la del almacén manda sobre la del producto). */
export async function listarExistenciasFerreteria(id: string): Promise<ExistenciaFerreteria[]> {
  if (!z.uuid().safeParse(id).success) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("existencias")
    .select("almacen_id, ubicacion, cantidad, cantidad_inicial, minimo, maximo, almacenes(nombre, es_principal)")
    .eq("producto_id", id)
    .returns<FilaExistencia[]>();

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((fila) => ({
      almacen_id: fila.almacen_id,
      almacen_nombre: fila.almacenes?.nombre ?? "—",
      es_principal: fila.almacenes?.es_principal ?? false,
      ubicacion: fila.ubicacion,
      cantidad: aNumero(fila.cantidad),
      cantidad_inicial: aNumero(fila.cantidad_inicial),
      minimo: aNumero(fila.minimo),
      maximo: fila.maximo === null ? null : aNumero(fila.maximo),
    }))
    .sort(
      (a, b) =>
        Number(b.es_principal) - Number(a.es_principal) || a.almacen_nombre.localeCompare(b.almacen_nombre, "es"),
    );
}

import { z } from "zod";

import type { PrecioLista } from "@/lib/inventario/tipos";
import { limpiarBusqueda, patronIlike } from "@/lib/listas/busqueda";
import {
  type OpcionesLista,
  type ResultadoPagina,
  rangoPagina,
  resumirPagina,
  TAMANO_PAGINA_DEFECTO,
} from "@/lib/listas/parametros";
import { createClient } from "@/lib/supabase/server";

import type { Producto } from "./productos";

const CAMPOS =
  "id, nombre, tipo, referencia, descripcion, precio, itbis_tasa, impuesto_id, inventariable, cantidad, costo, categoria_id, activo";

const OPCIONES_LISTA_DEFECTO: OpcionesLista = { pagina: 1, tamano: TAMANO_PAGINA_DEFECTO, q: "" };

export async function obtenerProducto(id: string): Promise<Producto | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("productos")
    .select(CAMPOS)
    .eq("id", id)
    .maybeSingle()
    .returns<Omit<Producto, "precios"> | null>();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const preciosRes = await supabase.from("producto_precios").select("lista_id, precio").eq("producto_id", id);
  const precios = preciosRes.error ? [] : ((preciosRes.data ?? []) as PrecioLista[]);

  return { ...data, precios };
}

export async function listarProductos(
  opciones: OpcionesLista = OPCIONES_LISTA_DEFECTO,
): Promise<ResultadoPagina<Producto>> {
  const supabase = await createClient();
  const q = limpiarBusqueda(opciones.q);

  const consultar = async (pagina: number) => {
    const { desde, hasta } = rangoPagina(pagina, opciones.tamano);
    let consulta = supabase.from("productos").select(CAMPOS, { count: "exact" });

    if (q) {
      const patron = patronIlike(q);
      consulta = consulta.or(`nombre.ilike.${patron},referencia.ilike.${patron}`);
    }

    const { data, error, count } = await consulta
      .order("nombre")
      .range(desde, hasta)
      .returns<Omit<Producto, "precios">[]>();

    if (error) throw new Error(error.message);
    return { filas: data ?? [], total: count ?? 0 };
  };

  const primera = await consultar(opciones.pagina);
  const resumen = resumirPagina(opciones.pagina, opciones.tamano, primera.total);
  const productos =
    resumen.pagina !== opciones.pagina && primera.filas.length === 0
      ? (await consultar(resumen.pagina)).filas
      : primera.filas;

  if (productos.length === 0) return { filas: [], resumen };

  const preciosRes = await supabase
    .from("producto_precios")
    .select("producto_id, lista_id, precio")
    .in(
      "producto_id",
      productos.map((producto) => producto.id),
    );

  if (preciosRes.error) {
    return { filas: productos.map((producto) => ({ ...producto, precios: [] })), resumen };
  }

  const preciosPorProducto = new Map<string, PrecioLista[]>();
  for (const fila of preciosRes.data as { producto_id: string; lista_id: string; precio: number }[]) {
    const actuales = preciosPorProducto.get(fila.producto_id) ?? [];
    actuales.push({ lista_id: fila.lista_id, precio: fila.precio });
    preciosPorProducto.set(fila.producto_id, actuales);
  }

  return {
    filas: productos.map((producto) => ({ ...producto, precios: preciosPorProducto.get(producto.id) ?? [] })),
    resumen,
  };
}

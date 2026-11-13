import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import type { AjusteDetalle, AjusteLinea, AjusteLista, Almacen, CategoriaProducto, ProductoInventario } from "./tipos";
import type { TipoAjuste } from "./validacion";

interface FilaAjusteLista {
  id: string;
  numero: number;
  fecha: string;
  total: number;
  observaciones: string | null;
  almacenes: { nombre: string } | null;
}

interface FilaAjusteDetalle {
  id: string;
  numero: number;
  fecha: string;
  almacen_id: string;
  observaciones: string | null;
  total: number;
  asiento_id: string | null;
  almacenes: { nombre: string } | null;
  ajuste_inventario_lineas: {
    id: string;
    producto_id: string;
    tipo: string;
    cantidad: number;
    costo_unitario: number;
    total: number;
    productos: { nombre: string } | null;
  }[];
}

export async function listarAlmacenes(): Promise<Almacen[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("almacenes")
    .select("id, nombre, es_principal, activo")
    .order("es_principal", { ascending: false })
    .order("nombre");

  return (data ?? []) as Almacen[];
}

export async function listarAlmacenesActivos(): Promise<Almacen[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("almacenes")
    .select("id, nombre, es_principal, activo")
    .eq("activo", true)
    .order("es_principal", { ascending: false })
    .order("nombre");

  return (data ?? []) as Almacen[];
}

export async function listarCategorias(): Promise<CategoriaProducto[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categorias_productos")
    .select("id, nombre, descripcion, activo")
    .order("nombre");

  return (data ?? []) as CategoriaProducto[];
}

export async function listarProductosInventariables(): Promise<ProductoInventario[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("productos")
    .select("id, nombre, referencia, cantidad, costo")
    .eq("activo", true)
    .eq("inventariable", true)
    .order("nombre");

  return (data ?? []) as ProductoInventario[];
}

export async function listarAjustes(): Promise<AjusteLista[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ajustes_inventario")
    .select("id, numero, fecha, total, observaciones, almacenes(nombre)")
    .order("fecha", { ascending: false })
    .order("numero", { ascending: false });

  const filas = (data ?? []) as unknown as FilaAjusteLista[];

  return filas.map((fila) => ({
    id: fila.id,
    numero: fila.numero,
    fecha: fila.fecha,
    total: fila.total,
    observaciones: fila.observaciones,
    almacen_nombre: fila.almacenes?.nombre ?? "—",
  }));
}

export async function obtenerAjuste(id: string): Promise<AjusteDetalle | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("ajustes_inventario")
    .select(
      "id, numero, fecha, almacen_id, observaciones, total, asiento_id, almacenes(nombre), ajuste_inventario_lineas(id, producto_id, tipo, cantidad, costo_unitario, total, productos(nombre))",
    )
    .eq("id", id)
    .maybeSingle<FilaAjusteDetalle>();

  if (!data) return null;

  const lineas: AjusteLinea[] = (data.ajuste_inventario_lineas ?? [])
    .map((linea) => ({
      id: linea.id,
      producto_id: linea.producto_id,
      producto_nombre: linea.productos?.nombre ?? "—",
      tipo: linea.tipo === "salida" ? ("salida" as TipoAjuste) : ("entrada" as TipoAjuste),
      cantidad: linea.cantidad,
      costo_unitario: linea.costo_unitario,
      total: linea.total,
    }))
    .sort((a, b) => a.producto_nombre.localeCompare(b.producto_nombre, "es"));

  return {
    id: data.id,
    numero: data.numero,
    fecha: data.fecha,
    almacen_id: data.almacen_id,
    almacen_nombre: data.almacenes?.nombre ?? "—",
    observaciones: data.observaciones,
    total: data.total,
    asiento_id: data.asiento_id,
    lineas,
  };
}

export async function datosFormularioAjuste() {
  const [almacenes, productos] = await Promise.all([listarAlmacenesActivos(), listarProductosInventariables()]);
  const principal = almacenes.find((almacen) => almacen.es_principal) ?? almacenes[0] ?? null;

  return { almacenes, productos, almacenPorDefecto: principal?.id ?? "" };
}

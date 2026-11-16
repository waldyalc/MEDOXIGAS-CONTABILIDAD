import { z } from "zod";

import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

import type {
  AjusteDetalle,
  AjusteLinea,
  AjusteLista,
  Almacen,
  CategoriaProducto,
  ExistenciaAlmacen,
  ListaPrecio,
  ProductoInventario,
  TransferenciaDetalle,
  TransferenciaLinea,
  TransferenciaLista,
} from "./tipos";
import type { TipoAjuste } from "./validacion";

interface FilaAjusteLista {
  id: string;
  numero: number;
  fecha: string;
  total: number;
  observaciones: string | null;
  estado: string;
  almacenes: { nombre: string } | null;
}

interface FilaAjusteDetalle {
  id: string;
  numero: number;
  fecha: string;
  almacen_id: string;
  observaciones: string | null;
  total: number;
  estado: string;
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

interface FilaTransferenciaLista {
  id: string;
  numero: number;
  fecha: string;
  estado: string;
  origen: { nombre: string } | null;
  destino: { nombre: string } | null;
  transferencia_inventario_lineas: { id: string }[];
}

interface FilaTransferenciaDetalle {
  id: string;
  numero: number;
  fecha: string;
  origen_id: string;
  destino_id: string;
  observaciones: string | null;
  estado: string;
  origen: { nombre: string } | null;
  destino: { nombre: string } | null;
  transferencia_inventario_lineas: {
    id: string;
    producto_id: string;
    cantidad: number;
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
  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase
      .from("productos")
      .select("id, nombre, referencia, cantidad, costo")
      .eq("activo", true)
      .eq("inventariable", true)
      .order("nombre")
      .order("id")
      .range(inicio, fin)
      .returns<ProductoInventario[]>(),
  );

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listarAjustes(): Promise<AjusteLista[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ajustes_inventario")
    .select("id, numero, fecha, total, observaciones, estado, almacenes(nombre)")
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
    estado: fila.estado === "anulada" ? "anulada" : "activo",
  }));
}

export async function obtenerAjuste(id: string): Promise<AjusteDetalle | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("ajustes_inventario")
    .select(
      "id, numero, fecha, almacen_id, observaciones, total, estado, asiento_id, almacenes(nombre), ajuste_inventario_lineas(id, producto_id, tipo, cantidad, costo_unitario, total, productos(nombre))",
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
    estado: data.estado === "anulada" ? "anulada" : "activo",
    asiento_id: data.asiento_id,
    lineas,
  };
}

export async function datosFormularioAjuste() {
  const [almacenes, productos] = await Promise.all([listarAlmacenesActivos(), listarProductosInventariables()]);
  const principal = almacenes.find((almacen) => almacen.es_principal) ?? almacenes[0] ?? null;

  return { almacenes, productos, almacenPorDefecto: principal?.id ?? "" };
}

export async function listarExistenciasProducto(productoId: string): Promise<ExistenciaAlmacen[]> {
  if (!z.uuid().safeParse(productoId).success) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("existencias")
    .select("almacen_id, cantidad, almacenes(nombre, es_principal)")
    .eq("producto_id", productoId);

  const filas = (data ?? []) as unknown as {
    almacen_id: string;
    cantidad: number;
    almacenes: { nombre: string; es_principal: boolean } | null;
  }[];

  return filas
    .map((fila) => ({
      almacen_id: fila.almacen_id,
      almacen_nombre: fila.almacenes?.nombre ?? "—",
      es_principal: fila.almacenes?.es_principal ?? false,
      cantidad: fila.cantidad,
    }))
    .sort(
      (a, b) =>
        Number(b.es_principal) - Number(a.es_principal) || a.almacen_nombre.localeCompare(b.almacen_nombre, "es"),
    );
}

export async function listarListasPrecios(): Promise<ListaPrecio[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listas_precios")
    .select("id, nombre, es_principal, tipo, activo")
    .order("es_principal", { ascending: false })
    .order("nombre");

  return (data ?? []) as ListaPrecio[];
}

export async function listarListasPreciosActivas(): Promise<ListaPrecio[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listas_precios")
    .select("id, nombre, es_principal, tipo, activo")
    .eq("activo", true)
    .order("es_principal", { ascending: false })
    .order("nombre");

  return (data ?? []) as ListaPrecio[];
}

export async function listarTransferencias(): Promise<TransferenciaLista[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transferencias_inventario")
    .select(
      "id, numero, fecha, estado, origen:almacenes!transferencias_inventario_origen_id_fkey(nombre), destino:almacenes!transferencias_inventario_destino_id_fkey(nombre), transferencia_inventario_lineas(id)",
    )
    .order("fecha", { ascending: false })
    .order("numero", { ascending: false });

  const filas = (data ?? []) as unknown as FilaTransferenciaLista[];

  return filas.map((fila) => ({
    id: fila.id,
    numero: fila.numero,
    fecha: fila.fecha,
    origen_nombre: fila.origen?.nombre ?? "—",
    destino_nombre: fila.destino?.nombre ?? "—",
    estado: fila.estado === "anulada" ? "anulada" : "activa",
    lineas: fila.transferencia_inventario_lineas.length,
  }));
}

export async function obtenerTransferencia(id: string): Promise<TransferenciaDetalle | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("transferencias_inventario")
    .select(
      "id, numero, fecha, origen_id, destino_id, observaciones, estado, origen:almacenes!transferencias_inventario_origen_id_fkey(nombre), destino:almacenes!transferencias_inventario_destino_id_fkey(nombre), transferencia_inventario_lineas(id, producto_id, cantidad, productos(nombre))",
    )
    .eq("id", id)
    .maybeSingle<FilaTransferenciaDetalle>();

  if (!data) return null;

  const lineas: TransferenciaLinea[] = (data.transferencia_inventario_lineas ?? [])
    .map((linea) => ({
      id: linea.id,
      producto_id: linea.producto_id,
      producto_nombre: linea.productos?.nombre ?? "—",
      cantidad: linea.cantidad,
    }))
    .sort((a, b) => a.producto_nombre.localeCompare(b.producto_nombre, "es"));

  return {
    id: data.id,
    numero: data.numero,
    fecha: data.fecha,
    origen_id: data.origen_id,
    origen_nombre: data.origen?.nombre ?? "—",
    destino_id: data.destino_id,
    destino_nombre: data.destino?.nombre ?? "—",
    observaciones: data.observaciones,
    estado: data.estado === "anulada" ? "anulada" : "activa",
    lineas,
  };
}

export async function datosFormularioTransferencia() {
  const [almacenes, productos] = await Promise.all([listarAlmacenesActivos(), listarProductosInventariables()]);
  const principal = almacenes.find((almacen) => almacen.es_principal) ?? almacenes[0] ?? null;
  const origen = principal?.id ?? "";
  const destino = almacenes.find((almacen) => almacen.id !== origen)?.id ?? "";

  return { almacenes, productos, origenPorDefecto: origen, destinoPorDefecto: destino };
}

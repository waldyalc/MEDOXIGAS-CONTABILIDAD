import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

import { busquedaCodigoBarraSchema, filtroCatalogoPosSchema, filtroConteoSchema, idSchema } from "./esquemas";
import {
  type FilaCodigoBarra,
  type FilaComponenteCombo,
  type FilaConteoLinea,
  type FilaConteoLista,
  type FilaProductoCatalogo,
  type FilaProductoParaCombo,
  type FilaStockBajo,
  type FilaUnidadMedida,
  mapearCodigoBarra,
  mapearComponenteCombo,
  mapearConteoLinea,
  mapearConteoResumen,
  mapearProductoCatalogo,
  mapearProductoParaCombo,
  mapearProductoPorCodigo,
  mapearStockBajo,
  mapearUnidad,
  ordenarPorCriticidad,
} from "./mapeo";
import type {
  CodigoBarra,
  ComponenteCombo,
  ConteoDetalle,
  ConteoResumen,
  ProductoCatalogoPos,
  ProductoParaCombo,
  ProductoPosCodigo,
  ProductoStockBajo,
  UnidadMedida,
} from "./tipos";

function esId(valor: string): boolean {
  return idSchema.safeParse(valor).success;
}

/**
 * Pistola del POS: coincidencia exacta por código de barra. Devuelve `null`
 * cuando el código no existe; solo lanza si la RPC falla.
 */
export async function buscarProductoPorCodigoBarra(entrada: unknown): Promise<ProductoPosCodigo | null> {
  const resultado = busquedaCodigoBarraSchema.safeParse(entrada);
  if (!resultado.success) return null;

  const datos = resultado.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_buscar_por_codigo_barra", {
    p_codigo: datos.codigo,
    ...(datos.almacen_id ? { p_almacen_id: datos.almacen_id } : {}),
    ...(datos.lista_precio_id ? { p_lista_precio_id: datos.lista_precio_id } : {}),
  });

  if (error) throw new Error(mensajeErrorRpc(error));

  const fila = data?.[0];
  return fila ? mapearProductoPorCodigo(fila) : null;
}

/**
 * Catálogo paginado del POS: una sola ida a la base, con stock, precio
 * efectivo y presentaciones activas. La RPC acota `limit` a 1–200.
 */
export async function listarCatalogoPos(entrada: unknown): Promise<ProductoCatalogoPos[]> {
  const resultado = filtroCatalogoPosSchema.safeParse(entrada);
  if (!resultado.success) return [];

  const datos = resultado.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_catalogo_productos", {
    p_solo_favoritos: datos.solo_favoritos,
    p_limit: datos.limit,
    p_offset: datos.offset,
    ...(datos.almacen_id ? { p_almacen_id: datos.almacen_id } : {}),
    ...(datos.lista_precio_id ? { p_lista_precio_id: datos.lista_precio_id } : {}),
    ...(datos.busqueda ? { p_busqueda: datos.busqueda } : {}),
    ...(datos.categoria_id ? { p_categoria_id: datos.categoria_id } : {}),
  });

  if (error) throw new Error(mensajeErrorRpc(error));

  return (data ?? []).map((fila: FilaProductoCatalogo) => mapearProductoCatalogo(fila));
}

/**
 * Productos bajo mínimo o con stock negativo, del más crítico al menos.
 *
 * PostgREST corta en ~1,000 filas: se lee por lotes con un orden estable
 * (`producto_id`) y luego se ordena por `cantidad − minimo`, igual que el SQL.
 */
export async function listarStockBajo(almacenId?: string | null): Promise<ProductoStockBajo[]> {
  if (almacenId != null && !esId(almacenId)) return [];

  const supabase = await createClient();
  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase
      .rpc("reporte_stock_bajo", almacenId ? { p_almacen_id: almacenId } : {})
      .order("producto_id")
      .range(inicio, fin),
  );

  if (error) throw new Error(mensajeErrorRpc(error));

  const productos = (data ?? []).map((fila: FilaStockBajo) => mapearStockBajo(fila));

  return ordenarPorCriticidad(productos);
}

/** Conteos físicos, más recientes primero, leídos completos por lotes. */
export async function listarConteos(filtros: unknown = {}): Promise<ConteoResumen[]> {
  const resultado = filtroConteoSchema.safeParse(filtros ?? {});
  if (!resultado.success) return [];

  const datos = resultado.data;
  const supabase = await createClient();

  let consulta = supabase
    .from("conteos_inventario")
    .select("id, numero, fecha, estado, almacen_id, notas, ajuste_id, creado_en, almacenes(nombre)");

  if (datos.almacen_id) consulta = consulta.eq("almacen_id", datos.almacen_id);
  if (datos.estado) consulta = consulta.eq("estado", datos.estado);
  if (datos.desde) consulta = consulta.gte("fecha", datos.desde);
  if (datos.hasta) consulta = consulta.lte("fecha", datos.hasta);

  const { data, error } = await paginarConsulta((inicio, fin) =>
    consulta
      .order("fecha", { ascending: false })
      .order("numero", { ascending: false })
      .order("id")
      .range(inicio, fin)
      .returns<FilaConteoLista[]>(),
  );

  if (error) throw new Error(mensajeErrorRpc(error));

  return (data ?? []).map((fila) => mapearConteoResumen(fila));
}

/** Cabecera y líneas de un conteo (las líneas también se leen por lotes). */
export async function obtenerConteo(id: string): Promise<ConteoDetalle | null> {
  if (!esId(id)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conteos_inventario")
    .select("id, numero, fecha, estado, almacen_id, notas, ajuste_id, creado_en, almacenes(nombre)")
    .eq("id", id)
    .maybeSingle<FilaConteoLista>();

  if (error) throw new Error(mensajeErrorRpc(error));
  if (!data) return null;

  const { data: filas, error: errorLineas } = await paginarConsulta((inicio, fin) =>
    supabase
      .from("conteo_inventario_lineas")
      .select("id, producto_id, cantidad_sistema, cantidad_contada, diferencia, notas, productos(nombre, referencia)")
      .eq("conteo_id", id)
      .order("producto_id")
      .range(inicio, fin)
      .returns<FilaConteoLinea[]>(),
  );

  if (errorLineas) throw new Error(mensajeErrorRpc(errorLineas));

  const lineas = (filas ?? [])
    .map((fila) => mapearConteoLinea(fila))
    .sort((a, b) => a.producto_nombre.localeCompare(b.producto_nombre, "es"));

  return { ...mapearConteoResumen(data), lineas };
}

export async function listarCodigosBarra(productoId: string): Promise<CodigoBarra[]> {
  if (!esId(productoId)) return [];

  const supabase = await createClient();
  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase
      .from("producto_codigos_barra")
      .select("id, producto_id, unidad_id, codigo, principal, creado_en")
      .eq("producto_id", productoId)
      .order("codigo")
      .order("id")
      .range(inicio, fin)
      .returns<FilaCodigoBarra[]>(),
  );

  if (error) throw new Error(mensajeErrorRpc(error));

  return (data ?? []).map((fila) => mapearCodigoBarra(fila));
}

export async function listarUnidadesProducto(productoId: string): Promise<UnidadMedida[]> {
  if (!esId(productoId)) return [];

  const supabase = await createClient();
  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase
      .from("producto_unidades")
      .select("id, producto_id, nombre, factor_base, precio, es_compra, es_venta, activa, creado_en")
      .eq("producto_id", productoId)
      .order("factor_base")
      .order("nombre")
      .order("id")
      .range(inicio, fin)
      .returns<FilaUnidadMedida[]>(),
  );

  if (error) throw new Error(mensajeErrorRpc(error));

  return (data ?? []).map((fila) => mapearUnidad(fila));
}

export async function listarComponentesCombo(comboId: string): Promise<ComponenteCombo[]> {
  if (!esId(comboId)) return [];

  const supabase = await createClient();
  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase
      .from("combo_componentes")
      .select(
        "id, combo_id, componente_id, cantidad, componente:productos!combo_componentes_componente_id_fkey(nombre, tipo, inventariable)",
      )
      .eq("combo_id", comboId)
      .order("componente_id")
      .range(inicio, fin)
      .returns<FilaComponenteCombo[]>(),
  );

  if (error) throw new Error(mensajeErrorRpc(error));

  return (data ?? [])
    .map((fila) => mapearComponenteCombo(fila))
    .sort((a, b) => a.componente_nombre.localeCompare(b.componente_nombre, "es"));
}

/** Productos simples activos que pueden entrar en la receta de un combo. */
export async function listarProductosParaCombo(): Promise<ProductoParaCombo[]> {
  const supabase = await createClient();
  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase
      .from("productos")
      .select("id, nombre, referencia, marca, inventariable")
      .eq("activo", true)
      .eq("tipo", "producto")
      .order("nombre")
      .order("id")
      .range(inicio, fin)
      .returns<FilaProductoParaCombo[]>(),
  );

  if (error) throw new Error(mensajeErrorRpc(error));

  return (data ?? []).map((fila) => mapearProductoParaCombo(fila));
}

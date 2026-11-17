import { z } from "zod";

import { aNumero } from "@/lib/facturacion/formato";
import type { ExistenciaAlmacen } from "@/lib/inventario/tipos";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

import {
  type CuentaResumen,
  type DocumentoComercialFicha,
  type DocumentoFicha,
  type FichaProducto,
  type PrecioListaFicha,
  type ProductoFicha,
  resolverCuentasFicha,
  sumarCantidades,
} from "./ficha";
import { urlFirmadaImagenProducto } from "./imagen";
import { construirKardex, type MovimientoKardex } from "./kardex";
import type { ProductoTipo } from "./productos";

interface ProductoFila {
  id: string;
  nombre: string;
  referencia: string | null;
  descripcion: string | null;
  tipo: string;
  activo: boolean;
  inventariable: boolean;
  precio: number;
  itbis_tasa: number;
  costo: number;
  cantidad: number;
  unidad_medida: string;
  almacen_id: string | null;
  vende_negativo: boolean;
  imagen_path: string | null;
  cuenta_ingreso_id: string | null;
  cuenta_inventario_id: string | null;
  cuenta_costo_id: string | null;
  categorias_productos: { nombre: string } | null;
}

interface ListaPrecioFila {
  id: string;
  nombre: string;
  es_principal: boolean;
  tipo: string;
}

interface PrecioProductoFila {
  lista_id: string;
  precio: number;
}

interface LineaVentaFila {
  factura_id: string;
  cantidad: number;
  costo_unitario: number;
}

interface LineaCompraFila {
  factura_proveedor_id: string;
  cantidad: number;
  costo: number;
}

interface LineaVentaJoin extends LineaVentaFila {
  facturas: DocumentoFila;
}

interface LineaCompraJoin extends LineaCompraFila {
  facturas_proveedor: DocumentoFila;
}

interface LineaCotizacionJoin {
  cotizacion_id: string;
  cotizaciones: DocumentoComercialFicha;
}

interface LineaRemisionJoin {
  remision_id: string;
  remisiones: DocumentoComercialFicha;
}

interface DocumentoFila {
  id: string;
  numero: number;
  ncf: string | null;
  contacto_id: string;
  fecha: string;
  creado_en: string;
  vencimiento: string;
  total: number;
  pagado: number;
  credito: number;
  estado: string;
  contactos: { nombre: string } | null;
}

async function cargarCuentas(ids: readonly string[]): Promise<Map<string, CuentaResumen>> {
  if (ids.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cuentas")
    .select("id, codigo, nombre")
    .in("id", [...ids])
    .returns<CuentaResumen[]>();

  if (error) throw new Error(error.message);
  return new Map(data.map((cuenta) => [cuenta.id, cuenta]));
}

async function cargarConfiguracionFicha(): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("config_contable")
    .select("clave, cuenta_id")
    .in("clave", ["ventas", "ventas_servicios", "inventario", "costo_ventas"]);

  if (error) throw new Error(error.message);
  return new Map(data.map((fila) => [fila.clave, fila.cuenta_id]));
}

function tipoProducto(tipo: string): ProductoTipo {
  if (tipo === "servicio") return "servicio";
  if (tipo === "combo") return "combo";
  return "producto";
}

function dedupePorId<T extends { id: string; fecha: string; numero: number }>(filas: readonly T[]): T[] {
  const porId = new Map<string, T>();
  for (const fila of filas) porId.set(fila.id, fila);
  return [...porId.values()].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.numero - a.numero);
}

function agruparCantidades(lineas: readonly { documentoId: string; cantidad: number }[]): Map<string, number[]> {
  const cantidades = new Map<string, number[]>();

  for (const linea of lineas) {
    const actuales = cantidades.get(linea.documentoId);
    if (actuales) actuales.push(linea.cantidad);
    else cantidades.set(linea.documentoId, [linea.cantidad]);
  }

  return cantidades;
}

function documentoDesdeFila(fila: DocumentoFila, cantidades: Map<string, number[]>): DocumentoFicha {
  return {
    id: fila.id,
    numero: fila.numero,
    ncf: fila.ncf,
    contactoId: fila.contacto_id,
    contactoNombre: fila.contactos?.nombre ?? "—",
    fecha: fila.fecha,
    vencimiento: fila.vencimiento,
    cantidad: sumarCantidades(cantidades.get(fila.id) ?? []),
    total: aNumero(fila.total),
    pagado: aNumero(fila.pagado),
    credito: aNumero(fila.credito),
    estado: fila.estado,
  };
}

function movimientosDeVentas(
  lineas: readonly LineaVentaFila[],
  facturas: readonly DocumentoFila[],
): MovimientoKardex[] {
  const porId = new Map(facturas.map((fila) => [fila.id, fila]));
  const movimientos: MovimientoKardex[] = [];

  for (const linea of lineas) {
    const factura = porId.get(linea.factura_id);
    if (!factura) continue;

    movimientos.push({
      tipo: "venta",
      documentoId: factura.id,
      numero: factura.numero,
      ncf: factura.ncf,
      fecha: factura.fecha,
      creadoEn: factura.creado_en,
      terceroId: factura.contacto_id,
      terceroNombre: factura.contactos?.nombre ?? "—",
      cantidad: linea.cantidad,
      costoUnitario: linea.costo_unitario,
    });
  }

  return movimientos;
}

function movimientosDeCompras(
  lineas: readonly LineaCompraFila[],
  facturas: readonly DocumentoFila[],
): MovimientoKardex[] {
  const porId = new Map(facturas.map((fila) => [fila.id, fila]));
  const movimientos: MovimientoKardex[] = [];

  for (const linea of lineas) {
    const factura = porId.get(linea.factura_proveedor_id);
    if (!factura) continue;

    movimientos.push({
      tipo: "compra",
      documentoId: factura.id,
      numero: factura.numero,
      ncf: factura.ncf,
      fecha: factura.fecha,
      creadoEn: factura.creado_en,
      terceroId: factura.contacto_id,
      terceroNombre: factura.contactos?.nombre ?? "—",
      cantidad: linea.cantidad,
      costoUnitario: linea.costo,
    });
  }

  return movimientos;
}

export async function obtenerFichaProducto(id: string): Promise<FichaProducto | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const { data: producto, error } = await supabase
    .from("productos")
    .select(
      "id, nombre, referencia, descripcion, tipo, activo, inventariable, precio, itbis_tasa, costo, cantidad, unidad_medida, almacen_id, vende_negativo, imagen_path, cuenta_ingreso_id, cuenta_inventario_id, cuenta_costo_id, categorias_productos(nombre)",
    )
    .eq("id", id)
    .maybeSingle()
    .returns<ProductoFila | null>();

  if (error) throw new Error(error.message);
  if (!producto) return null;

  const CAMPOS_FACTURA =
    "id, numero, ncf, contacto_id, fecha, creado_en, vencimiento, total, pagado, credito, estado, contactos(nombre)";

  const [
    lineasVenta,
    lineasCompra,
    lineasCotizacion,
    lineasRemision,
    existenciasRes,
    listasPreciosRes,
    preciosProductoRes,
    configuracion,
  ] = await Promise.all([
    paginarConsulta((inicio, fin) =>
      supabase
        .from("factura_lineas")
        .select(`factura_id, cantidad, costo_unitario, facturas!inner(${CAMPOS_FACTURA})`)
        .eq("producto_id", id)
        .neq("facturas.estado", "anulada")
        .order("id")
        .range(inicio, fin)
        .returns<LineaVentaJoin[]>(),
    ),
    paginarConsulta((inicio, fin) =>
      supabase
        .from("facturas_proveedor_lineas")
        .select(`factura_proveedor_id, cantidad, costo, facturas_proveedor!inner(${CAMPOS_FACTURA})`)
        .eq("producto_id", id)
        .neq("facturas_proveedor.estado", "anulada")
        .order("id")
        .range(inicio, fin)
        .returns<LineaCompraJoin[]>(),
    ),
    paginarConsulta((inicio, fin) =>
      supabase
        .from("cotizacion_lineas")
        .select("cotizacion_id, cotizaciones!inner(id, numero, fecha, total, estado)")
        .eq("producto_id", id)
        .order("id")
        .range(inicio, fin)
        .returns<LineaCotizacionJoin[]>(),
    ),
    paginarConsulta((inicio, fin) =>
      supabase
        .from("remision_lineas")
        .select("remision_id, remisiones!inner(id, numero, fecha, total, estado)")
        .eq("producto_id", id)
        .order("id")
        .range(inicio, fin)
        .returns<LineaRemisionJoin[]>(),
    ),
    supabase
      .from("existencias")
      .select("almacen_id, cantidad, cantidad_inicial, minimo, maximo, almacenes(nombre, es_principal)")
      .eq("producto_id", id)
      .returns<
        {
          almacen_id: string;
          cantidad: number;
          cantidad_inicial: number;
          minimo: number;
          maximo: number | null;
          almacenes: { nombre: string; es_principal: boolean } | null;
        }[]
      >(),
    supabase
      .from("listas_precios")
      .select("id, nombre, es_principal, tipo")
      .eq("activo", true)
      .order("es_principal", { ascending: false })
      .order("nombre")
      .returns<ListaPrecioFila[]>(),
    supabase.from("producto_precios").select("lista_id, precio").eq("producto_id", id).returns<PrecioProductoFila[]>(),
    cargarConfiguracionFicha(),
  ]);

  if (lineasVenta.error) throw new Error(lineasVenta.error.message);
  if (lineasCompra.error) throw new Error(lineasCompra.error.message);
  if (lineasCotizacion.error) throw new Error(lineasCotizacion.error.message);
  if (lineasRemision.error) throw new Error(lineasRemision.error.message);
  if (existenciasRes.error) throw new Error(existenciasRes.error.message);
  if (listasPreciosRes.error) throw new Error(listasPreciosRes.error.message);
  if (preciosProductoRes.error) throw new Error(preciosProductoRes.error.message);

  const preciosPorLista = new Map((preciosProductoRes.data ?? []).map((fila) => [fila.lista_id, aNumero(fila.precio)]));
  const precios: PrecioListaFicha[] = (listasPreciosRes.data ?? []).map((lista) => ({
    listaId: lista.id,
    nombre: lista.nombre,
    esPrincipal: lista.es_principal,
    tipo: lista.tipo === "porcentaje" ? "porcentaje" : "fijo",
    precio: preciosPorLista.get(lista.id) ?? null,
  }));

  const existencias: ExistenciaAlmacen[] = (existenciasRes.data ?? [])
    .map((fila) => ({
      almacen_id: fila.almacen_id,
      almacen_nombre: fila.almacenes?.nombre ?? "—",
      es_principal: fila.almacenes?.es_principal ?? false,
      cantidad: aNumero(fila.cantidad),
      cantidad_inicial: aNumero(fila.cantidad_inicial),
      minimo: aNumero(fila.minimo),
      maximo: fila.maximo === null ? null : aNumero(fila.maximo),
    }))
    .sort(
      (a, b) =>
        Number(b.es_principal) - Number(a.es_principal) || a.almacen_nombre.localeCompare(b.almacen_nombre, "es"),
    );

  const cuentaIds = [
    producto.cuenta_ingreso_id,
    producto.cuenta_inventario_id,
    producto.cuenta_costo_id,
    ...configuracion.values(),
  ].filter((valor): valor is string => valor !== null);

  const facturasVentaDb = dedupePorId((lineasVenta.data ?? []).map((linea) => linea.facturas));
  const facturasCompraDb = dedupePorId((lineasCompra.data ?? []).map((linea) => linea.facturas_proveedor));
  const cotizacionesDb = dedupePorId((lineasCotizacion.data ?? []).map((linea) => linea.cotizaciones));
  const conducesDb = dedupePorId((lineasRemision.data ?? []).map((linea) => linea.remisiones));
  const cuentas = await cargarCuentas(cuentaIds);

  const ventasData = lineasVenta.data ?? [];
  const comprasData = lineasCompra.data ?? [];

  const cantidadesVenta = agruparCantidades(
    ventasData.map((linea) => ({ documentoId: linea.factura_id, cantidad: linea.cantidad })),
  );
  const cantidadesCompra = agruparCantidades(
    comprasData.map((linea) => ({
      documentoId: linea.factura_proveedor_id,
      cantidad: linea.cantidad,
    })),
  );

  const productoFicha: ProductoFicha = {
    id: producto.id,
    nombre: producto.nombre,
    referencia: producto.referencia,
    descripcion: producto.descripcion,
    tipo: tipoProducto(producto.tipo),
    categoriaNombre: producto.categorias_productos?.nombre ?? null,
    activo: producto.activo,
    inventariable: producto.inventariable,
    precio: aNumero(producto.precio),
    itbis_tasa: aNumero(producto.itbis_tasa),
    costo: aNumero(producto.costo),
    cantidad: aNumero(producto.cantidad),
    unidadMedida: producto.unidad_medida,
    almacenId: producto.almacen_id,
    vendeNegativo: producto.vende_negativo,
    imagenPath: producto.imagen_path,
    imagenUrl: await urlFirmadaImagenProducto(supabase, producto.imagen_path),
    precios,
    cuentaIngresoId: producto.cuenta_ingreso_id,
    cuentaInventarioId: producto.cuenta_inventario_id,
    cuentaCostoId: producto.cuenta_costo_id,
  };

  const cuentasFicha = resolverCuentasFicha(productoFicha, configuracion, cuentas);

  const movimientos =
    productoFicha.tipo === "producto" && productoFicha.inventariable
      ? [...movimientosDeVentas(ventasData, facturasVentaDb), ...movimientosDeCompras(comprasData, facturasCompraDb)]
      : [];

  return {
    producto: productoFicha,
    cuentas: cuentasFicha,
    facturasVenta: facturasVentaDb.map((fila) => documentoDesdeFila(fila, cantidadesVenta)),
    facturasCompra: facturasCompraDb.map((fila) => documentoDesdeFila(fila, cantidadesCompra)),
    cotizaciones: cotizacionesDb,
    conduces: conducesDb,
    existencias,
    kardex: construirKardex(productoFicha.inventariable ? productoFicha.cantidad : 0, movimientos),
  };
}

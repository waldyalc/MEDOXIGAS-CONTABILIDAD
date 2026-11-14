import { z } from "zod";

import { aNumero } from "@/lib/facturacion/formato";
import type { ExistenciaAlmacen } from "@/lib/inventario/tipos";
import { createClient } from "@/lib/supabase/server";

import {
  type CuentaResumen,
  type DocumentoComercialFicha,
  type DocumentoFicha,
  type FichaProducto,
  type ProductoFicha,
  resolverCuentasFicha,
  sumarCantidades,
} from "./ficha";
import { construirKardex, type MovimientoKardex } from "./kardex";

interface ProductoFila {
  id: string;
  nombre: string;
  referencia: string | null;
  descripcion: string | null;
  tipo: string;
  inventariable: boolean;
  precio: number;
  itbis_tasa: number;
  costo: number;
  cantidad: number;
  cuenta_ingreso_id: string | null;
  cuenta_inventario_id: string | null;
  cuenta_costo_id: string | null;
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

interface LineaCotizacionFila {
  cotizacion_id: string;
}

interface LineaRemisionFila {
  remision_id: string;
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

async function cargarFacturasVenta(lineas: readonly LineaVentaFila[]): Promise<DocumentoFila[]> {
  const ids = [...new Set(lineas.map((linea) => linea.factura_id))];
  if (ids.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facturas")
    .select(
      "id, numero, ncf, contacto_id, fecha, creado_en, vencimiento, total, pagado, credito, estado, contactos(nombre)",
    )
    .in("id", ids)
    .neq("estado", "anulada")
    .order("fecha", { ascending: false })
    .order("numero", { ascending: false })
    .returns<DocumentoFila[]>();

  if (error) throw new Error(error.message);
  return data;
}

async function cargarFacturasCompra(lineas: readonly LineaCompraFila[]): Promise<DocumentoFila[]> {
  const ids = [...new Set(lineas.map((linea) => linea.factura_proveedor_id))];
  if (ids.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facturas_proveedor")
    .select(
      "id, numero, ncf, contacto_id, fecha, creado_en, vencimiento, total, pagado, credito, estado, contactos(nombre)",
    )
    .in("id", ids)
    .neq("estado", "anulada")
    .order("fecha", { ascending: false })
    .order("numero", { ascending: false })
    .returns<DocumentoFila[]>();

  if (error) throw new Error(error.message);
  return data;
}

async function cargarCotizaciones(ids: readonly string[]): Promise<DocumentoComercialFicha[]> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("id, numero, fecha, total, estado")
    .in("id", unicos)
    .order("fecha", { ascending: false })
    .order("numero", { ascending: false })
    .returns<DocumentoComercialFicha[]>();

  if (error) throw new Error(error.message);
  return data;
}

async function cargarConduces(ids: readonly string[]): Promise<DocumentoComercialFicha[]> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("remisiones")
    .select("id, numero, fecha, total, estado")
    .in("id", unicos)
    .order("fecha", { ascending: false })
    .order("numero", { ascending: false })
    .returns<DocumentoComercialFicha[]>();

  if (error) throw new Error(error.message);
  return data;
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
      "id, nombre, referencia, descripcion, tipo, inventariable, precio, itbis_tasa, costo, cantidad, cuenta_ingreso_id, cuenta_inventario_id, cuenta_costo_id",
    )
    .eq("id", id)
    .maybeSingle()
    .returns<ProductoFila | null>();

  if (error) throw new Error(error.message);
  if (!producto) return null;

  const [lineasVenta, lineasCompra, lineasCotizacion, lineasRemision, existenciasRes] = await Promise.all([
    supabase
      .from("factura_lineas")
      .select("factura_id, cantidad, costo_unitario")
      .eq("producto_id", id)
      .returns<LineaVentaFila[]>(),
    supabase
      .from("facturas_proveedor_lineas")
      .select("factura_proveedor_id, cantidad, costo")
      .eq("producto_id", id)
      .returns<LineaCompraFila[]>(),
    supabase.from("cotizacion_lineas").select("cotizacion_id").eq("producto_id", id).returns<LineaCotizacionFila[]>(),
    supabase.from("remision_lineas").select("remision_id").eq("producto_id", id).returns<LineaRemisionFila[]>(),
    supabase
      .from("existencias")
      .select("almacen_id, cantidad, almacenes(nombre, es_principal)")
      .eq("producto_id", id)
      .returns<
        {
          almacen_id: string;
          cantidad: number;
          almacenes: { nombre: string; es_principal: boolean } | null;
        }[]
      >(),
  ]);

  if (lineasVenta.error) throw new Error(lineasVenta.error.message);
  if (lineasCompra.error) throw new Error(lineasCompra.error.message);
  if (lineasCotizacion.error) throw new Error(lineasCotizacion.error.message);
  if (lineasRemision.error) throw new Error(lineasRemision.error.message);
  if (existenciasRes.error) throw new Error(existenciasRes.error.message);

  const existencias: ExistenciaAlmacen[] = (existenciasRes.data ?? [])
    .map((fila) => ({
      almacen_id: fila.almacen_id,
      almacen_nombre: fila.almacenes?.nombre ?? "—",
      es_principal: fila.almacenes?.es_principal ?? false,
      cantidad: aNumero(fila.cantidad),
    }))
    .sort(
      (a, b) =>
        Number(b.es_principal) - Number(a.es_principal) || a.almacen_nombre.localeCompare(b.almacen_nombre, "es"),
    );

  const configuracion = await cargarConfiguracionFicha();
  const cuentaIds = [
    producto.cuenta_ingreso_id,
    producto.cuenta_inventario_id,
    producto.cuenta_costo_id,
    ...configuracion.values(),
  ].filter((valor): valor is string => valor !== null);

  const [facturasVentaDb, facturasCompraDb, cotizacionesDb, conducesDb, cuentas] = await Promise.all([
    cargarFacturasVenta(lineasVenta.data),
    cargarFacturasCompra(lineasCompra.data),
    cargarCotizaciones(lineasCotizacion.data.map((linea) => linea.cotizacion_id)),
    cargarConduces(lineasRemision.data.map((linea) => linea.remision_id)),
    cargarCuentas(cuentaIds),
  ]);

  const cantidadesVenta = agruparCantidades(
    lineasVenta.data.map((linea) => ({ documentoId: linea.factura_id, cantidad: linea.cantidad })),
  );
  const cantidadesCompra = agruparCantidades(
    lineasCompra.data.map((linea) => ({
      documentoId: linea.factura_proveedor_id,
      cantidad: linea.cantidad,
    })),
  );

  const productoFicha: ProductoFicha = {
    id: producto.id,
    nombre: producto.nombre,
    referencia: producto.referencia,
    descripcion: producto.descripcion,
    tipo: producto.tipo === "servicio" ? "servicio" : "producto",
    inventariable: producto.inventariable,
    precio: aNumero(producto.precio),
    itbis_tasa: aNumero(producto.itbis_tasa),
    costo: aNumero(producto.costo),
    cantidad: aNumero(producto.cantidad),
    cuentaIngresoId: producto.cuenta_ingreso_id,
    cuentaInventarioId: producto.cuenta_inventario_id,
    cuentaCostoId: producto.cuenta_costo_id,
  };

  const cuentasFicha = resolverCuentasFicha(productoFicha, configuracion, cuentas);

  const movimientos =
    productoFicha.tipo === "producto" && productoFicha.inventariable
      ? [
          ...movimientosDeVentas(lineasVenta.data, facturasVentaDb),
          ...movimientosDeCompras(lineasCompra.data, facturasCompraDb),
        ]
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

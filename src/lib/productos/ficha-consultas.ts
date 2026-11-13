import { z } from "zod";

import { aNumero } from "@/lib/facturacion/formato";
import { createClient } from "@/lib/supabase/server";

import {
  type CuentaResumen,
  type CuentasFicha,
  type DocumentoFicha,
  type FichaProducto,
  type ProductoFicha,
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

async function cargarFacturasVenta(lineas: readonly LineaVentaFila[]): Promise<DocumentoFila[]> {
  const ids = [...new Set(lineas.map((linea) => linea.factura_id))];
  if (ids.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facturas")
    .select("id, numero, ncf, contacto_id, fecha, creado_en, vencimiento, total, pagado, estado, contactos(nombre)")
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
    .select("id, numero, ncf, contacto_id, fecha, creado_en, vencimiento, total, pagado, estado, contactos(nombre)")
    .in("id", ids)
    .neq("estado", "anulada")
    .order("fecha", { ascending: false })
    .order("numero", { ascending: false })
    .returns<DocumentoFila[]>();

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

function cuentaDe(id: string | null, cuentas: Map<string, CuentaResumen>): CuentaResumen | null {
  if (!id) return null;
  return cuentas.get(id) ?? null;
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

  const [lineasVenta, lineasCompra] = await Promise.all([
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
  ]);

  if (lineasVenta.error) throw new Error(lineasVenta.error.message);
  if (lineasCompra.error) throw new Error(lineasCompra.error.message);

  const cuentaIds = [producto.cuenta_ingreso_id, producto.cuenta_inventario_id, producto.cuenta_costo_id].filter(
    (valor): valor is string => valor !== null,
  );

  const [facturasVentaDb, facturasCompraDb, cuentas] = await Promise.all([
    cargarFacturasVenta(lineasVenta.data),
    cargarFacturasCompra(lineasCompra.data),
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

  const cuentasFicha: CuentasFicha = {
    ingreso: cuentaDe(producto.cuenta_ingreso_id, cuentas),
    inventario: cuentaDe(producto.cuenta_inventario_id, cuentas),
    costo: cuentaDe(producto.cuenta_costo_id, cuentas),
  };

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
    kardex: construirKardex(productoFicha.inventariable ? productoFicha.cantidad : 0, movimientos),
  };
}

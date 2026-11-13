import { centavos } from "@/lib/reportes/dinero";
import { createClient } from "@/lib/supabase/server";

import { clasificarVista, diasVencida } from "./antiguedad";
import { calcularTotalLinea, cantidadALaFecha } from "./inventario";
import type { FilaCartera, FilaCompra, FilaInventario } from "./tipos";

export interface RespuestaReporte<T> {
  filas: T[];
  error: string | null;
}

interface ContactoEmbed {
  nombre: string;
}

function nombreContacto(valor: ContactoEmbed | ContactoEmbed[] | null): string {
  if (Array.isArray(valor)) return valor[0]?.nombre ?? "";
  return valor?.nombre ?? "";
}

interface FilaCxcDb {
  id: string;
  numero: number;
  ncf: string;
  contacto_id: string;
  fecha: string;
  vencimiento: string;
  total: number | string;
  pagado: number | string;
  contactos: ContactoEmbed | ContactoEmbed[] | null;
}

interface FilaCxpDb {
  id: string;
  numero: number;
  ncf: string | null;
  contacto_id: string;
  fecha: string;
  vencimiento: string;
  total: number | string;
  pagado: number | string;
  contactos: ContactoEmbed | ContactoEmbed[] | null;
}

interface FilaCompraDb {
  id: string;
  numero: number;
  ncf: string | null;
  contacto_id: string;
  fecha: string;
  subtotal: number | string;
  total: number | string;
  contactos: ContactoEmbed | ContactoEmbed[] | null;
}

interface ProductoDb {
  id: string;
  nombre: string;
  referencia: string | null;
  descripcion: string | null;
  cantidad: number | string;
  costo: number | string;
  activo: boolean;
}

function convertirCartera(fila: FilaCxcDb | FilaCxpDb, corte: string, tipoDocumento: string): FilaCartera | null {
  const total = centavos(fila.total);
  const pagado = centavos(fila.pagado);
  const saldo = total - pagado;
  if (saldo <= 0) return null;

  const dias = diasVencida(fila.vencimiento, corte);

  return {
    id: fila.id,
    numero: fila.numero,
    ncf: fila.ncf,
    tipoDocumento,
    contactoId: fila.contacto_id,
    contactoNombre: nombreContacto(fila.contactos),
    creado: fila.fecha,
    vencimiento: fila.vencimiento,
    total,
    pagado,
    saldo,
    diasVencida: dias,
    vista: clasificarVista(dias),
  };
}

export async function obtenerCarteraCxc(hasta: string): Promise<RespuestaReporte<FilaCartera>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facturas")
    .select("id, numero, ncf, contacto_id, fecha, vencimiento, total, pagado, contactos(nombre)")
    .neq("estado", "anulada")
    .lte("fecha", hasta)
    .order("fecha", { ascending: false })
    .order("numero", { ascending: false })
    .returns<FilaCxcDb[]>();

  if (error) return { filas: [], error: error.message };

  const filas: FilaCartera[] = [];
  for (const fila of data ?? []) {
    const convertida = convertirCartera(fila, hasta, "Factura");
    if (convertida != null) filas.push(convertida);
  }

  return { filas, error: null };
}

export async function obtenerCarteraCxp(desde: string, hasta: string): Promise<RespuestaReporte<FilaCartera>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facturas_proveedor")
    .select("id, numero, ncf, contacto_id, fecha, vencimiento, total, pagado, contactos(nombre)")
    .neq("estado", "anulada")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: false })
    .order("numero", { ascending: false })
    .returns<FilaCxpDb[]>();

  if (error) return { filas: [], error: error.message };

  const filas: FilaCartera[] = [];
  for (const fila of data ?? []) {
    const convertida = convertirCartera(fila, hasta, "Factura de proveedor");
    if (convertida != null) filas.push(convertida);
  }

  return { filas, error: null };
}

export async function obtenerCompras(desde: string, hasta: string): Promise<RespuestaReporte<FilaCompra>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facturas_proveedor")
    .select("id, numero, ncf, contacto_id, fecha, subtotal, total, contactos(nombre)")
    .neq("estado", "anulada")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: false })
    .order("numero", { ascending: false })
    .returns<FilaCompraDb[]>();

  if (error) return { filas: [], error: error.message };

  return {
    filas: (data ?? []).map((fila) => ({
      id: fila.id,
      numero: fila.numero,
      ncf: fila.ncf,
      contactoId: fila.contacto_id,
      contactoNombre: nombreContacto(fila.contactos),
      fecha: fila.fecha,
      subtotal: centavos(fila.subtotal),
      total: centavos(fila.total),
    })),
    error: null,
  };
}

function acumular(mapa: Map<string, number>, productoId: string | null, cantidad: number | string): void {
  if (productoId == null) return;
  mapa.set(productoId, (mapa.get(productoId) ?? 0) + Number(cantidad));
}

interface LineaMovimiento {
  producto_id: string | null;
  cantidad: number | string;
}

async function movimientosVenta(despuesDe: string): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data: facturas, error } = await supabase
    .from("facturas")
    .select("id")
    .gt("fecha", despuesDe)
    .neq("estado", "anulada");

  if (error || facturas == null || facturas.length === 0) return new Map();

  const ids = facturas.map((factura) => factura.id);
  const { data: lineas } = await supabase
    .from("factura_lineas")
    .select("producto_id, cantidad")
    .in("factura_id", ids)
    .returns<LineaMovimiento[]>();

  const cantidades = new Map<string, number>();
  for (const linea of lineas ?? []) acumular(cantidades, linea.producto_id, linea.cantidad);
  return cantidades;
}

async function movimientosCompra(despuesDe: string): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data: facturas, error } = await supabase
    .from("facturas_proveedor")
    .select("id")
    .gt("fecha", despuesDe)
    .neq("estado", "anulada");

  if (error || facturas == null || facturas.length === 0) return new Map();

  const ids = facturas.map((factura) => factura.id);
  const { data: lineas } = await supabase
    .from("facturas_proveedor_lineas")
    .select("producto_id, cantidad")
    .in("factura_proveedor_id", ids)
    .returns<LineaMovimiento[]>();

  const cantidades = new Map<string, number>();
  for (const linea of lineas ?? []) acumular(cantidades, linea.producto_id, linea.cantidad);
  return cantidades;
}

/** Existencia a la fecha de corte: si es hoy usa `productos.cantidad`; si no, reconstruye. */
export async function obtenerInventario(hasta: string, hoy: string): Promise<RespuestaReporte<FilaInventario>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("productos")
    .select("id, nombre, referencia, descripcion, cantidad, costo, activo")
    .eq("inventariable", true)
    .order("nombre")
    .returns<ProductoDb[]>();

  if (error) return { filas: [], error: error.message };

  const historico = hasta !== hoy;
  const [ventas, compras] = historico
    ? await Promise.all([movimientosVenta(hasta), movimientosCompra(hasta)])
    : [new Map<string, number>(), new Map<string, number>()];

  return {
    filas: (data ?? []).map((producto) => {
      const cantidadActual = Number(producto.cantidad);
      const cantidad = historico
        ? cantidadALaFecha(cantidadActual, ventas.get(producto.id) ?? 0, compras.get(producto.id) ?? 0)
        : cantidadActual;
      const costo = centavos(producto.costo);

      return {
        id: producto.id,
        nombre: producto.nombre,
        referencia: producto.referencia,
        descripcion: producto.descripcion,
        cantidad,
        unidad: "Unidad",
        activo: producto.activo,
        costo,
        total: calcularTotalLinea(cantidad, costo),
      };
    }),
    error: null,
  };
}

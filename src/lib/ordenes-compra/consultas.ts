import { z } from "zod";

import type { ContactoOpcion, CuentaOpcion, ProductoOpcion } from "@/lib/compras/tipos";
import { createClient } from "@/lib/supabase/server";

import type {
  EstadoOrdenCompra,
  OpcionesOrden,
  OrdenCompraLinea,
  OrdenCompraLista,
  OrdenCompraVista,
  OrdenParaFactura,
} from "./tipos";

export async function listarOrdenesCompra(): Promise<OrdenCompraLista[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ordenes_compra")
    .select("id, numero, contacto_id, fecha, fecha_entrega, total, estado, factura_proveedor_id")
    .order("fecha", { ascending: false })
    .order("numero", { ascending: false })
    .limit(300)
    .returns<
      {
        id: string;
        numero: number;
        contacto_id: string;
        fecha: string;
        fecha_entrega: string;
        total: number;
        estado: EstadoOrdenCompra;
        factura_proveedor_id: string | null;
      }[]
    >();

  if (error) throw new Error(error.message);
  if (data.length === 0) return [];

  const contactoIds = [...new Set(data.map((orden) => orden.contacto_id))];
  const { data: contactos, error: errorContactos } = await supabase
    .from("contactos")
    .select("id, nombre")
    .in("id", contactoIds)
    .returns<{ id: string; nombre: string }[]>();

  if (errorContactos) throw new Error(errorContactos.message);

  const nombres = new Map(contactos.map((contacto) => [contacto.id, contacto.nombre]));

  return data.map((orden) => ({
    ...orden,
    contacto_nombre: nombres.get(orden.contacto_id) ?? "—",
  }));
}

export async function obtenerOrdenCompra(id: string): Promise<OrdenCompraVista | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const orden = await supabase
    .from("ordenes_compra")
    .select(
      "id, numero, contacto_id, fecha, fecha_entrega, subtotal, itbis, total, notas, terminos, estado, factura_proveedor_id",
    )
    .eq("id", id)
    .maybeSingle<Omit<OrdenCompraVista, "contacto_nombre" | "lineas">>();

  if (orden.error) throw new Error(orden.error.message);
  if (!orden.data) return null;

  const [lineas, contacto] = await Promise.all([
    supabase
      .from("orden_compra_lineas")
      .select(
        "id, producto_id, cuenta_id, descripcion, cantidad, costo, itbis_tasa, subtotal, itbis, total, productos(nombre), cuentas(codigo, nombre)",
      )
      .eq("orden_id", id)
      .order("id")
      .returns<OrdenCompraLinea[]>(),
    supabase
      .from("contactos")
      .select("nombre")
      .eq("id", orden.data.contacto_id)
      .maybeSingle()
      .returns<{ nombre: string } | null>(),
  ]);

  if (lineas.error) throw new Error(lineas.error.message);
  if (contacto.error) throw new Error(contacto.error.message);

  return {
    ...orden.data,
    contacto_nombre: contacto.data?.nombre ?? "—",
    lineas: lineas.data,
  };
}

export async function cargarOpcionesOrden(): Promise<OpcionesOrden> {
  const supabase = await createClient();
  const [contactos, productos, cuentasGasto] = await Promise.all([
    supabase
      .from("contactos")
      .select("id, nombre, rnc_cedula")
      .in("tipo", ["proveedor", "ambos"])
      .eq("activo", true)
      .order("nombre")
      .returns<ContactoOpcion[]>(),
    supabase
      .from("productos")
      .select("id, nombre, referencia, costo, precio, itbis_tasa, inventariable, tipo")
      .eq("activo", true)
      .order("nombre")
      .returns<ProductoOpcion[]>(),
    supabase
      .from("cuentas")
      .select("id, codigo, nombre, tipo, es_caja_banco")
      .eq("tipo", "gasto")
      .eq("acepta_movimientos", true)
      .eq("activa", true)
      .order("codigo")
      .returns<CuentaOpcion[]>(),
  ]);

  if (contactos.error) throw new Error(contactos.error.message);
  if (productos.error) throw new Error(productos.error.message);
  if (cuentasGasto.error) throw new Error(cuentasGasto.error.message);

  return {
    contactos: contactos.data ?? [],
    productos: productos.data ?? [],
    cuentasGasto: cuentasGasto.data ?? [],
  };
}

export async function getOrdenParaFactura(id: string): Promise<OrdenParaFactura | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const orden = await supabase
    .from("ordenes_compra")
    .select("id, numero, contacto_id, fecha, fecha_entrega, notas, estado")
    .eq("id", id)
    .maybeSingle<
      Pick<OrdenCompraVista, "id" | "numero" | "contacto_id" | "fecha" | "fecha_entrega" | "notas" | "estado">
    >();

  if (orden.error) throw new Error(orden.error.message);
  if (orden.data?.estado !== "abierta") return null;

  const { data: lineas, error } = await supabase
    .from("orden_compra_lineas")
    .select("producto_id, cuenta_id, descripcion, cantidad, costo, itbis_tasa")
    .eq("orden_id", id)
    .order("id")
    .returns<
      {
        producto_id: string | null;
        cuenta_id: string | null;
        descripcion: string;
        cantidad: number;
        costo: number;
        itbis_tasa: number;
      }[]
    >();

  if (error) throw new Error(error.message);

  return {
    ordenId: orden.data.id,
    numero: orden.data.numero,
    inicial: {
      contacto_id: orden.data.contacto_id,
      fecha: orden.data.fecha,
      vencimiento: orden.data.fecha_entrega,
      ncf: "",
      notas: orden.data.notas ?? "",
      lineas: lineas.map((linea) => ({
        producto_id: linea.producto_id ?? "",
        cuenta_id: linea.cuenta_id ?? "",
        descripcion: linea.descripcion,
        cantidad: linea.cantidad,
        costo: linea.costo,
        itbis_tasa: linea.itbis_tasa,
      })),
    },
  };
}

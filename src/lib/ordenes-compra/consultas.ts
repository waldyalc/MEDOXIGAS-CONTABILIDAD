import { z } from "zod";

import type { ContactoOpcion, CuentaOpcion, ProductoOpcion } from "@/lib/compras/tipos";
import { getImpuestosActivos } from "@/lib/impuestos/consultas";
import { limpiarBusqueda, numeroDocumento } from "@/lib/listas/busqueda";
import { contactosQueCoinciden } from "@/lib/listas/coincidencias";
import { condicionesDocumento } from "@/lib/listas/documento";
import {
  type OpcionesLista,
  type ResultadoPagina,
  rangoPagina,
  resumirPagina,
  TAMANO_PAGINA_DEFECTO,
} from "@/lib/listas/parametros";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

import type {
  EstadoOrdenCompra,
  OpcionesOrden,
  OrdenCompraLinea,
  OrdenCompraLista,
  OrdenCompraVista,
  OrdenParaFactura,
} from "./tipos";

const OPCIONES_LISTA_DEFECTO: OpcionesLista = { pagina: 1, tamano: TAMANO_PAGINA_DEFECTO, q: "" };

const CAMPOS_ORDEN =
  "id, numero, contacto_id, fecha, fecha_entrega, total, estado, factura_proveedor_id, contactos(nombre)";

interface OrdenListaConContacto {
  id: string;
  numero: number;
  contacto_id: string;
  fecha: string;
  fecha_entrega: string;
  total: number;
  estado: EstadoOrdenCompra;
  factura_proveedor_id: string | null;
  contactos: { nombre: string } | null;
}

export async function listarOrdenesCompra(
  opciones: OpcionesLista = OPCIONES_LISTA_DEFECTO,
): Promise<ResultadoPagina<OrdenCompraLista>> {
  const supabase = await createClient();
  const q = limpiarBusqueda(opciones.q);
  const numero = numeroDocumento(q);
  const idsContactos = q && numero == null ? await contactosQueCoinciden(supabase, q, ["proveedor", "ambos"]) : [];
  const filtro = condicionesDocumento({ q, idsContactos, campos: { texto: "" } });

  const consultar = async (pagina: number) => {
    const { desde, hasta } = rangoPagina(pagina, opciones.tamano);
    let consulta = supabase.from("ordenes_compra").select(CAMPOS_ORDEN, { count: "exact" });

    if (filtro) consulta = consulta.or(filtro);

    const { data, error, count } = await consulta
      .order("fecha", { ascending: false })
      .order("numero", { ascending: false })
      .range(desde, hasta)
      .returns<OrdenListaConContacto[]>();

    if (error) throw new Error(error.message);
    return { filas: data ?? [], total: count ?? 0 };
  };

  const primera = await consultar(opciones.pagina);
  const resumen = resumirPagina(opciones.pagina, opciones.tamano, primera.total);
  const filas =
    resumen.pagina !== opciones.pagina && primera.filas.length === 0
      ? (await consultar(resumen.pagina)).filas
      : primera.filas;

  return {
    filas: filas.map(({ contactos, ...orden }) => ({
      ...orden,
      contacto_nombre: contactos?.nombre ?? "—",
    })),
    resumen,
  };
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
  const [contactos, productos, cuentasGasto, impuestos] = await Promise.all([
    supabase
      .from("contactos")
      .select("id, nombre, rnc_cedula")
      .in("tipo", ["proveedor", "ambos"])
      .eq("activo", true)
      .order("nombre")
      .returns<ContactoOpcion[]>(),
    paginarConsulta((inicio, fin) =>
      supabase
        .from("productos")
        .select("id, nombre, referencia, costo, precio, itbis_tasa, impuesto_id, inventariable, tipo")
        .eq("activo", true)
        .order("nombre")
        .order("id")
        .range(inicio, fin)
        .returns<ProductoOpcion[]>(),
    ),
    supabase
      .from("cuentas")
      .select("id, codigo, nombre, tipo, es_caja_banco")
      .eq("tipo", "gasto")
      .eq("acepta_movimientos", true)
      .eq("activa", true)
      .order("codigo")
      .returns<CuentaOpcion[]>(),
    getImpuestosActivos(),
  ]);

  if (contactos.error) throw new Error(contactos.error.message);
  if (productos.error) throw new Error(productos.error.message);
  if (cuentasGasto.error) throw new Error(cuentasGasto.error.message);

  return {
    contactos: contactos.data ?? [],
    productos: productos.data ?? [],
    cuentasGasto: cuentasGasto.data ?? [],
    impuestos,
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
    .select("producto_id, cuenta_id, descripcion, cantidad, costo, impuesto_id, itbis_tasa")
    .eq("orden_id", id)
    .order("id")
    .returns<
      {
        producto_id: string | null;
        cuenta_id: string | null;
        descripcion: string;
        cantidad: number;
        costo: number;
        impuesto_id: string | null;
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
        impuesto_id: linea.impuesto_id,
        itbis_tasa: linea.itbis_tasa,
      })),
    },
  };
}

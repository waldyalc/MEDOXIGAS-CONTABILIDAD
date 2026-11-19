"use server";

import { aNumero } from "@/lib/facturacion/formato";
import { limpiarBusqueda, patronIlike } from "@/lib/listas/busqueda";
import { contactosQueCoinciden } from "@/lib/listas/coincidencias";
import { createClient } from "@/lib/supabase/server";

/** Con menos de 2 caracteres el término no aporta resultados. */
const MINIMO_CARACTERES = 2;

/** La paleta es un atajo, no un listado: 5 resultados por grupo. */
const MAX_RESULTADOS = 5;

export interface ContactoHallado {
  id: string;
  nombre: string;
  rnc: string | null;
  tipo: string;
}

export interface ProductoHallado {
  id: string;
  nombre: string;
  referencia: string | null;
  /** Precio de venta en pesos; PostgREST puede devolverlo como texto. */
  precio: number;
}

export interface FacturaHallada {
  id: string;
  ncf: string;
  contacto: string | null;
  total: number;
  fecha: string;
}

export interface ResultadoBusquedaGlobal {
  contactos: ContactoHallado[];
  productos: ProductoHallado[];
  facturas: FacturaHallada[];
}

type Cliente = Awaited<ReturnType<typeof createClient>>;

interface FilaContacto {
  id: string;
  nombre: string;
  rnc_cedula: string | null;
  tipo: string;
}

interface FilaProducto {
  id: string;
  nombre: string;
  referencia: string | null;
  precio: number | string | null;
}

interface FilaFactura {
  id: string;
  ncf: string;
  total: number | string | null;
  fecha: string;
  contactos: { nombre: string } | null;
}

/**
 * Busca contactos, productos y facturas de venta para la búsqueda global
 * (Ctrl+K). Respeta RLS porque usa el cliente del servidor con la sesión del
 * usuario. Un término menor a 2 caracteres devuelve vacío sin consultar; si
 * una tabla falla, ese grupo sale vacío y la paleta conserva el resto.
 */
export async function buscarEntidades(termino: string): Promise<ResultadoBusquedaGlobal> {
  const q = limpiarBusqueda(termino);
  if (q.length < MINIMO_CARACTERES) return { contactos: [], productos: [], facturas: [] };

  const supabase = await createClient();
  const [contactos, productos, facturas] = await Promise.all([
    hallarContactos(supabase, q),
    hallarProductos(supabase, q),
    hallarFacturas(supabase, q),
  ]);

  return { contactos, productos, facturas };
}

async function hallarContactos(supabase: Cliente, q: string): Promise<ContactoHallado[]> {
  const patron = patronIlike(q);
  const { data, error } = await supabase
    .from("contactos")
    .select("id, nombre, rnc_cedula, tipo")
    .or(`nombre.ilike.${patron},rnc_cedula.ilike.${patron}`)
    .order("nombre")
    .limit(MAX_RESULTADOS)
    .returns<FilaContacto[]>();

  if (error) return [];
  return (data ?? []).map((fila) => ({ id: fila.id, nombre: fila.nombre, rnc: fila.rnc_cedula, tipo: fila.tipo }));
}

async function hallarProductos(supabase: Cliente, q: string): Promise<ProductoHallado[]> {
  const patron = patronIlike(q);
  const { data, error } = await supabase
    .from("productos")
    .select("id, nombre, referencia, precio")
    .or(`nombre.ilike.${patron},referencia.ilike.${patron}`)
    .order("nombre")
    .limit(MAX_RESULTADOS)
    .returns<FilaProducto[]>();

  if (error) return [];
  return (data ?? []).map((fila) => ({
    id: fila.id,
    nombre: fila.nombre,
    referencia: fila.referencia,
    precio: aNumero(fila.precio),
  }));
}

async function hallarFacturas(supabase: Cliente, q: string): Promise<FacturaHallada[]> {
  // PostgREST no filtra por columnas del join: se resuelven primero los ids
  // de los clientes que coinciden, como en la lista de facturación.
  const idsClientes = await contactosQueCoinciden(supabase, q, ["cliente", "ambos"]).catch(() => []);
  const condiciones = [`ncf.ilike.${patronIlike(q)}`];
  if (idsClientes.length > 0) condiciones.push(`contacto_id.in.(${idsClientes.join(",")})`);

  const { data, error } = await supabase
    .from("facturas")
    .select("id, ncf, total, fecha, contactos(nombre)")
    .or(condiciones.join(","))
    .order("numero", { ascending: false })
    .limit(MAX_RESULTADOS)
    .returns<FilaFactura[]>();

  if (error) return [];
  return (data ?? []).map((fila) => ({
    id: fila.id,
    ncf: fila.ncf,
    contacto: fila.contactos?.nombre ?? null,
    total: aNumero(fila.total),
    fecha: fila.fecha.slice(0, 10),
  }));
}

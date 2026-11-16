"use server";

import { limpiarBusqueda, patronIlike } from "@/lib/listas/busqueda";
import { rangoPagina, resumirPagina } from "@/lib/listas/parametros";
import { createClient } from "@/lib/supabase/server";

import { type ContactoBuscado, TAMANO_CONTACTOS, tiposContacto, unirContactos } from "./seleccion";

const CAMPOS = "id, nombre, rnc_cedula, lista_precio_id";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface EntradaBusquedaContactos {
  tipo?: "cliente" | "proveedor" | "todos";
  q?: string;
  pagina?: number;
  tamano?: number;
  incluir?: string;
}

export interface ResultadoBusquedaContactos {
  contactos: ContactoBuscado[];
  total: number;
  pagina: number;
  totalPaginas: number;
}

export async function buscarContactos(entrada: EntradaBusquedaContactos): Promise<ResultadoBusquedaContactos> {
  const tipo = entrada.tipo === "proveedor" || entrada.tipo === "todos" ? entrada.tipo : "cliente";
  const tipoFiltro = tiposContacto(tipo);
  const tamano = Math.min(Math.max(Math.trunc(entrada.tamano ?? TAMANO_CONTACTOS), 1), 50);
  const paginaPedida =
    typeof entrada.pagina === "number" && Number.isInteger(entrada.pagina) && entrada.pagina > 0 ? entrada.pagina : 1;
  const q = limpiarBusqueda(typeof entrada.q === "string" ? entrada.q : "");
  const incluir = typeof entrada.incluir === "string" && UUID.test(entrada.incluir) ? entrada.incluir : null;
  const supabase = await createClient();

  const consultar = async (pagina: number) => {
    const { desde, hasta } = rangoPagina(pagina, tamano);
    let consulta = supabase.from("contactos").select(CAMPOS, { count: "exact" }).eq("activo", true);

    if (tipoFiltro) consulta = consulta.in("tipo", [...tipoFiltro]);

    if (q) {
      const patron = patronIlike(q);
      consulta = consulta.or(
        `nombre.ilike.${patron},rnc_cedula.ilike.${patron},telefono.ilike.${patron},correo.ilike.${patron}`,
      );
    }

    const { data, error, count } = await consulta.order("nombre").range(desde, hasta).returns<ContactoBuscado[]>();

    if (error) throw new Error(error.message);
    return { filas: data ?? [], total: count ?? 0 };
  };

  const primera = await consultar(paginaPedida);
  const resumen = resumirPagina(paginaPedida, tamano, primera.total);
  const filas =
    resumen.pagina !== paginaPedida && primera.filas.length === 0
      ? (await consultar(resumen.pagina)).filas
      : primera.filas;

  const incluido = incluir ? await contactoPorId(incluir) : null;

  return {
    contactos: incluido ? unirContactos(filas, incluido) : filas,
    total: resumen.total,
    pagina: resumen.pagina,
    totalPaginas: resumen.totalPaginas,
  };
}

async function contactoPorId(id: string): Promise<ContactoBuscado | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("contactos").select(CAMPOS).eq("id", id).maybeSingle<ContactoBuscado>();

  if (error) throw new Error(error.message);
  return data;
}

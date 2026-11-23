"use server";

import { limpiarBusqueda, patronIlike } from "@/lib/listas/busqueda";
import { createClient } from "@/lib/supabase/server";

import { normalizarNombre } from "./contactos";
import {
  buscarContactoSimilar,
  type ContactoSimilar,
  type DuplicadoContacto,
  identificacionParaComparar,
} from "./duplicados";

const CAMPOS = "id, nombre, rnc_cedula";

function sinAcentos(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[%_]/g, "");
}

/**
 * Filtro `.or()` de PostgREST con las variantes del texto. Se piden las
 * versiones con y sin acentos para encontrar el nombre guardado como sea;
 * aquí solo se limpian los comodines, no la diacrítica.
 */
function filtroNombre(valores: readonly string[]) {
  const patrones = [...new Set(valores.map((valor) => limpiarBusqueda(valor).replace(/[%_]/g, "")).filter(Boolean))];
  if (patrones.length === 0) return null;
  return patrones.map((patron) => `nombre.ilike.${patronIlike(patron)}`).join(",");
}

/**
 * Busca un contacto activo que choque con el nombre normalizado o con el
 * RNC/cédula (solo dígitos). No bloquea: el diálogo decide si avisa o crea.
 */
export async function buscarContactoDuplicado(datos: {
  nombre: string;
  rnc_cedula: string | null;
}): Promise<DuplicadoContacto | null> {
  const nombre = normalizarNombre(datos.nombre);
  if (nombre === "") return null;

  const rnc = identificacionParaComparar(datos.rnc_cedula);
  const palabra = nombre.split(" ")[0] ?? nombre;
  const supabase = await createClient();
  const filas: ContactoSimilar[] = [];

  async function leer(consulta: PromiseLike<{ data: ContactoSimilar[] | null; error: { message: string } | null }>) {
    const { data, error } = await consulta;
    if (error) throw new Error(error.message);
    filas.push(...(data ?? []));
    return buscarContactoSimilar(filas, { nombre, rnc_cedula: rnc === "" ? null : rnc });
  }

  if (rnc !== "") {
    // El `%` entre dígitos encuentra el RNC aunque esté guardado con guiones.
    const patronRnc = patronIlike(rnc.split("").join("%"));
    const encontrado = await leer(
      supabase.from("contactos").select(CAMPOS).eq("activo", true).ilike("rnc_cedula", patronRnc).limit(50),
    );
    if (encontrado) return encontrado;
  }

  const completo = filtroNombre([nombre, sinAcentos(nombre)]);
  if (completo) {
    const encontrado = await leer(
      supabase.from("contactos").select(CAMPOS).eq("activo", true).or(completo).order("nombre").limit(20),
    );
    if (encontrado) return encontrado;
  }

  const primeraPalabra = filtroNombre([palabra, sinAcentos(palabra)]);
  if (primeraPalabra) {
    const encontrado = await leer(
      supabase.from("contactos").select(CAMPOS).eq("activo", true).or(primeraPalabra).order("nombre").limit(100),
    );
    if (encontrado) return encontrado;
  }

  return null;
}

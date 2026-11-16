import { limpiarBusqueda, patronIlike } from "@/lib/listas/busqueda";
import {
  type OpcionesLista,
  type ResultadoPagina,
  rangoPagina,
  resumirPagina,
  TAMANO_PAGINA_DEFECTO,
} from "@/lib/listas/parametros";
import { createClient } from "@/lib/supabase/server";

import type { Contacto, PestanaContactos } from "./contactos";

const CAMPOS =
  "id, nombre, rnc_cedula, telefono, correo, direccion, tipo, lista_precio_id, tipo_identificacion, municipio_provincia";

const OPCIONES_LISTA_DEFECTO: OpcionesLista = { pagina: 1, tamano: TAMANO_PAGINA_DEFECTO, q: "" };

export async function obtenerContacto(id: string): Promise<Contacto | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contactos")
    .select(CAMPOS)
    .eq("id", id)
    .maybeSingle()
    .returns<Contacto | null>();

  if (error) throw new Error(error.message);
  return data;
}

export async function listarContactos(
  opciones: OpcionesLista = OPCIONES_LISTA_DEFECTO,
  pestana: PestanaContactos = "todos",
): Promise<ResultadoPagina<Contacto>> {
  const supabase = await createClient();
  const q = limpiarBusqueda(opciones.q);

  const consultar = async (pagina: number) => {
    const { desde, hasta } = rangoPagina(pagina, opciones.tamano);
    let consulta = supabase.from("contactos").select(CAMPOS, { count: "exact" });

    if (pestana === "clientes") consulta = consulta.in("tipo", ["cliente", "ambos"]);
    if (pestana === "proveedores") consulta = consulta.in("tipo", ["proveedor", "ambos"]);

    if (q) {
      const patron = patronIlike(q);
      consulta = consulta.or(
        `nombre.ilike.${patron},rnc_cedula.ilike.${patron},telefono.ilike.${patron},correo.ilike.${patron}`,
      );
    }

    const { data, error, count } = await consulta.order("nombre").range(desde, hasta).returns<Contacto[]>();

    if (error) throw new Error(error.message);
    return { filas: data ?? [], total: count ?? 0 };
  };

  const primera = await consultar(opciones.pagina);
  const resumen = resumirPagina(opciones.pagina, opciones.tamano, primera.total);

  if (resumen.pagina !== opciones.pagina && primera.filas.length === 0) {
    const ultima = await consultar(resumen.pagina);
    return { filas: ultima.filas, resumen };
  }

  return { filas: primera.filas, resumen };
}

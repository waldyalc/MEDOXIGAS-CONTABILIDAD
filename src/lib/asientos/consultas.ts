import { limpiarBusqueda, numeroDocumento, patronContiene } from "@/lib/listas/busqueda";
import {
  type OpcionesLista,
  type ResultadoPagina,
  rangoPagina,
  resumirPagina,
  TAMANO_PAGINA_DEFECTO,
} from "@/lib/listas/parametros";
import { createClient } from "@/lib/supabase/server";

import type { AsientoLista, CentroCostoAsiento, ContactoAsiento, CuentaAsiento, DatosFormularioAsiento } from "./tipos";

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

const OPCIONES_LISTA_DEFECTO: OpcionesLista = { pagina: 1, tamano: TAMANO_PAGINA_DEFECTO, q: "" };

export function normalizarFecha(valor: string | undefined): string | undefined {
  if (valor == null || !FORMATO_FECHA.test(valor)) return undefined;
  return valor;
}

export async function getAsientosLista(
  opciones: OpcionesLista = OPCIONES_LISTA_DEFECTO,
  desde?: string,
  hasta?: string,
): Promise<ResultadoPagina<AsientoLista>> {
  const supabase = await createClient();
  const q = limpiarBusqueda(opciones.q);
  const numero = numeroDocumento(q);

  const consultar = async (pagina: number) => {
    const { desde: inicio, hasta: fin } = rangoPagina(pagina, opciones.tamano);
    let consulta = supabase
      .from("asientos")
      .select("id, numero, fecha, descripcion, origen_tipo, origen_id, total", { count: "exact" });

    if (desde) consulta = consulta.gte("fecha", desde);
    if (hasta) consulta = consulta.lte("fecha", hasta);
    if (q) {
      consulta = numero != null ? consulta.eq("numero", numero) : consulta.ilike("descripcion", patronContiene(q));
    }

    const { data, error, count } = await consulta
      .order("numero", { ascending: false })
      .range(inicio, fin)
      .returns<AsientoLista[]>();

    if (error) throw new Error(error.message);
    return { filas: data ?? [], total: count ?? 0 };
  };

  const primera = await consultar(opciones.pagina);
  const resumen = resumirPagina(opciones.pagina, opciones.tamano, primera.total);
  const filas =
    resumen.pagina !== opciones.pagina && primera.filas.length === 0
      ? (await consultar(resumen.pagina)).filas
      : primera.filas;

  return { filas, resumen };
}

export async function getDatosFormularioAsiento(): Promise<DatosFormularioAsiento> {
  const supabase = await createClient();
  const [cuentas, contactos, centrosCosto] = await Promise.all([
    supabase
      .from("cuentas")
      .select("id, codigo, nombre")
      .eq("activa", true)
      .eq("acepta_movimientos", true)
      .order("codigo")
      .returns<CuentaAsiento[]>(),
    supabase.from("contactos").select("id, nombre").eq("activo", true).order("nombre").returns<ContactoAsiento[]>(),
    supabase
      .from("centros_costo")
      .select("id, codigo, nombre")
      .eq("activo", true)
      .order("codigo")
      .returns<CentroCostoAsiento[]>(),
  ]);

  if (cuentas.error) throw new Error(cuentas.error.message);
  if (contactos.error) throw new Error(contactos.error.message);
  if (centrosCosto.error) throw new Error(centrosCosto.error.message);

  return { cuentas: cuentas.data, contactos: contactos.data, centrosCosto: centrosCosto.data };
}

"use server";

import { limpiarBusqueda, numeroDocumento, patronContiene } from "@/lib/listas/busqueda";
import { rangoPagina, resumirPagina } from "@/lib/listas/parametros";
import { createClient } from "@/lib/supabase/server";

import type { FacturaParaNotaDebito } from "./tipos";

const CAMPOS = "id, numero, ncf, fecha, total, estado, contacto_id";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface EntradaBusquedaFacturasNotaDebito {
  contactoId: string;
  q?: string;
  pagina?: number;
  tamano?: number;
  incluir?: string;
}

export interface ResultadoBusquedaFacturasNotaDebito {
  facturas: FacturaParaNotaDebito[];
  total: number;
  pagina: number;
  totalPaginas: number;
}

const VACIO: ResultadoBusquedaFacturasNotaDebito = { facturas: [], total: 0, pagina: 1, totalPaginas: 1 };

export async function buscarFacturasNotaDebito(
  entrada: EntradaBusquedaFacturasNotaDebito,
): Promise<ResultadoBusquedaFacturasNotaDebito> {
  const contactoId = typeof entrada.contactoId === "string" ? entrada.contactoId.trim() : "";
  if (!UUID.test(contactoId)) return VACIO;

  const tamano = Math.min(Math.max(Math.trunc(entrada.tamano ?? 25), 1), 50);
  const paginaPedida =
    typeof entrada.pagina === "number" && Number.isInteger(entrada.pagina) && entrada.pagina > 0 ? entrada.pagina : 1;
  const q = limpiarBusqueda(typeof entrada.q === "string" ? entrada.q : "");
  const incluir = typeof entrada.incluir === "string" && UUID.test(entrada.incluir) ? entrada.incluir : null;
  const supabase = await createClient();

  const consultar = async (pagina: number) => {
    const { desde, hasta } = rangoPagina(pagina, tamano);
    let consulta = supabase
      .from("facturas")
      .select(CAMPOS, { count: "exact" })
      .eq("contacto_id", contactoId)
      .neq("estado", "anulada");

    if (q) {
      const numero = numeroDocumento(q);
      consulta = numero != null ? consulta.eq("numero", numero) : consulta.ilike("ncf", patronContiene(q));
    }

    const { data, error, count } = await consulta
      .order("numero", { ascending: false })
      .range(desde, hasta)
      .returns<FacturaParaNotaDebito[]>();

    if (error) throw new Error(error.message);
    return { filas: data ?? [], total: count ?? 0 };
  };

  const primera = await consultar(paginaPedida);
  const resumen = resumirPagina(paginaPedida, tamano, primera.total);
  const filas =
    resumen.pagina !== paginaPedida && primera.filas.length === 0
      ? (await consultar(resumen.pagina)).filas
      : primera.filas;

  const seleccionada =
    incluir && !filas.some((factura) => factura.id === incluir) ? await facturaPorId(contactoId, incluir) : null;

  return {
    facturas: seleccionada ? [seleccionada, ...filas] : filas,
    total: resumen.total,
    pagina: resumen.pagina,
    totalPaginas: resumen.totalPaginas,
  };
}

async function facturaPorId(contactoId: string, id: string): Promise<FacturaParaNotaDebito | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facturas")
    .select(CAMPOS)
    .eq("id", id)
    .eq("contacto_id", contactoId)
    .neq("estado", "anulada")
    .maybeSingle<FacturaParaNotaDebito>();

  if (error) throw new Error(error.message);
  return data;
}

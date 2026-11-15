"use server";

import { limpiarBusqueda, numeroDocumento, patronIlike } from "@/lib/listas/busqueda";
import { rangoPagina, resumirPagina } from "@/lib/listas/parametros";
import { createClient } from "@/lib/supabase/server";

import {
  type EntradaBusquedaFacturas,
  type FacturaPago,
  type ResultadoBusquedaFacturas,
  saldoPendiente,
  TAMANO_PAGINA_FACTURAS,
} from "./multifactura";

const CAMPOS = "id, numero, ncf, contacto_id, vencimiento, subtotal, itbis, total, pagado, credito, retenido";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TABLAS = { recibido: "facturas", proveedor: "facturas_proveedor" } as const;

export async function buscarFacturasPago(entrada: EntradaBusquedaFacturas): Promise<ResultadoBusquedaFacturas> {
  const contactoId = typeof entrada.contactoId === "string" ? entrada.contactoId.trim() : "";
  if (!UUID.test(contactoId)) {
    return { facturas: [], total: 0, pagina: 1, totalPaginas: 1 };
  }

  const tipo = entrada.tipo === "proveedor" ? "proveedor" : "recibido";
  const tamano = Math.min(Math.max(Math.trunc(entrada.tamano ?? TAMANO_PAGINA_FACTURAS), 1), 50);
  const paginaPedida = Number.isInteger(entrada.pagina) && entrada.pagina > 0 ? entrada.pagina : 1;
  const q = limpiarBusqueda(typeof entrada.q === "string" ? entrada.q : "");
  const supabase = await createClient();

  const consultar = async (pagina: number) => {
    const { desde, hasta } = rangoPagina(pagina, tamano);
    let consulta = supabase
      .from(TABLAS[tipo])
      .select(CAMPOS, { count: "exact" })
      .eq("contacto_id", contactoId)
      .eq("estado", "abierta");

    if (q) {
      const numero = numeroDocumento(q);
      consulta = numero != null ? consulta.or(`numero.eq.${numero}`) : consulta.or(`ncf.ilike.${patronIlike(q)}`);
    }

    const { data, error, count } = await consulta
      .order("vencimiento")
      .order("numero")
      .range(desde, hasta)
      .returns<FacturaPago[]>();

    if (error) throw new Error(error.message);
    return { filas: data ?? [], total: count ?? 0 };
  };

  const primera = await consultar(paginaPedida);
  const resumen = resumirPagina(paginaPedida, tamano, primera.total);
  const filas =
    resumen.pagina !== paginaPedida && primera.filas.length === 0
      ? (await consultar(resumen.pagina)).filas
      : primera.filas;

  return {
    facturas: filas.filter((factura) => saldoPendiente(factura) > 0),
    total: resumen.total,
    pagina: resumen.pagina,
    totalPaginas: resumen.totalPaginas,
  };
}

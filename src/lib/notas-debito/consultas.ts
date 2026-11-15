import { z } from "zod";

import { getContactosClientes, getEmpresa, getProductosActivos } from "@/lib/facturacion/consultas";
import { limpiarBusqueda, numeroDocumento } from "@/lib/listas/busqueda";
import { contactosQueCoinciden, facturasVentaQueCoinciden } from "@/lib/listas/coincidencias";
import { condicionesDocumento } from "@/lib/listas/documento";
import {
  type OpcionesLista,
  type ResultadoPagina,
  rangoPagina,
  resumirPagina,
  TAMANO_PAGINA_DEFECTO,
} from "@/lib/listas/parametros";
import { createClient } from "@/lib/supabase/server";

import type {
  DatosFormularioNotaDebito,
  EstadoNotaDebito,
  FacturaParaNotaDebito,
  NotaDebitoLinea,
  NotaDebitoLista,
  NotaDebitoVista,
  TipoNotaDebito,
} from "./tipos";

const OPCIONES_LISTA_DEFECTO: OpcionesLista = { pagina: 1, tamano: TAMANO_PAGINA_DEFECTO, q: "" };

export async function getNotasDebitoLista(
  opciones: OpcionesLista = OPCIONES_LISTA_DEFECTO,
): Promise<ResultadoPagina<NotaDebitoLista>> {
  const supabase = await createClient();
  const q = limpiarBusqueda(opciones.q);
  const numero = numeroDocumento(q);
  const [idsContactos, idsFacturas] = await Promise.all([
    q && numero == null ? contactosQueCoinciden(supabase, q, ["cliente", "ambos"]) : Promise.resolve<string[]>([]),
    q ? facturasVentaQueCoinciden(supabase, q) : Promise.resolve<string[]>([]),
  ]);
  const filtro = condicionesDocumento({ q, idsContactos, idsFacturas });

  const consultar = async (pagina: number) => {
    const { desde, hasta } = rangoPagina(pagina, opciones.tamano);
    let consulta = supabase
      .from("notas_debito_venta")
      .select("id, numero, ncf, fecha, tipo, total, estado, factura_id, contacto_id", { count: "exact" });

    if (filtro) consulta = consulta.or(filtro);

    const { data, error, count } = await consulta.order("numero", { ascending: false }).range(desde, hasta).returns<
      {
        id: string;
        numero: number;
        ncf: string;
        fecha: string;
        tipo: TipoNotaDebito;
        total: number;
        estado: EstadoNotaDebito;
        factura_id: string;
        contacto_id: string;
      }[]
    >();

    if (error) throw new Error(error.message);
    return { filas: data ?? [], total: count ?? 0 };
  };

  const primera = await consultar(opciones.pagina);
  const resumen = resumirPagina(opciones.pagina, opciones.tamano, primera.total);
  const data =
    resumen.pagina !== opciones.pagina && primera.filas.length === 0
      ? (await consultar(resumen.pagina)).filas
      : primera.filas;

  if (data.length === 0) return { filas: [], resumen };

  const contactoIds = [...new Set(data.map((nota) => nota.contacto_id))];
  const facturaIds = [...new Set(data.map((nota) => nota.factura_id))];

  const [contactos, facturas] = await Promise.all([
    supabase.from("contactos").select("id, nombre").in("id", contactoIds).returns<{ id: string; nombre: string }[]>(),
    supabase
      .from("facturas")
      .select("id, numero, ncf")
      .in("id", facturaIds)
      .returns<{ id: string; numero: number; ncf: string | null }[]>(),
  ]);

  if (contactos.error) throw new Error(contactos.error.message);
  if (facturas.error) throw new Error(facturas.error.message);

  const nombres = new Map(contactos.data.map((contacto) => [contacto.id, contacto.nombre]));
  const facturasPorId = new Map(facturas.data.map((factura) => [factura.id, factura]));

  return {
    filas: data.map((nota) => {
      const factura = facturasPorId.get(nota.factura_id);
      return {
        ...nota,
        cliente_nombre: nombres.get(nota.contacto_id) ?? "—",
        factura_numero: factura?.numero ?? 0,
        factura_ncf: factura?.ncf ?? null,
      };
    }),
    resumen,
  };
}

export async function getNotaDebitoVista(id: string): Promise<NotaDebitoVista | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const nota = await supabase
    .from("notas_debito_venta")
    .select(
      "id, numero, ncf, tipo, fecha, subtotal, descuento, itbis, total, estado, notas, asiento_id, factura_id, contacto_id",
    )
    .eq("id", id)
    .maybeSingle<Omit<NotaDebitoVista, "cliente_nombre" | "factura_numero" | "factura_ncf" | "lineas">>();

  if (nota.error) throw new Error(nota.error.message);
  if (!nota.data) return null;

  const [lineas, contacto, factura] = await Promise.all([
    supabase
      .from("nota_debito_venta_lineas")
      .select(
        "id, producto_id, productos(nombre), descripcion, cantidad, precio, descuento_pct, itbis_tasa, subtotal, itbis, total",
      )
      .eq("nota_id", id)
      .order("id")
      .returns<NotaDebitoLinea[]>(),
    supabase
      .from("contactos")
      .select("nombre")
      .eq("id", nota.data.contacto_id)
      .maybeSingle()
      .returns<{ nombre: string } | null>(),
    supabase
      .from("facturas")
      .select("numero, ncf")
      .eq("id", nota.data.factura_id)
      .maybeSingle()
      .returns<{ numero: number; ncf: string | null } | null>(),
  ]);

  if (lineas.error) throw new Error(lineas.error.message);
  if (contacto.error) throw new Error(contacto.error.message);
  if (factura.error) throw new Error(factura.error.message);

  return {
    ...nota.data,
    cliente_nombre: contacto.data?.nombre ?? "—",
    factura_numero: factura.data?.numero ?? 0,
    factura_ncf: factura.data?.ncf ?? null,
    lineas: lineas.data,
  };
}

export async function getDatosFormularioNotaDebito(): Promise<DatosFormularioNotaDebito> {
  const [empresa, contactos, productos] = await Promise.all([
    getEmpresa(),
    getContactosClientes(),
    getProductosActivos(),
  ]);

  return { empresa, contactos, productos };
}

export async function getFacturaParaNotaDebito(id: string): Promise<FacturaParaNotaDebito | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facturas")
    .select("id, numero, ncf, fecha, total, estado, contacto_id")
    .eq("id", id)
    .neq("estado", "anulada")
    .maybeSingle<FacturaParaNotaDebito>();

  if (error) throw new Error(error.message);
  return data;
}

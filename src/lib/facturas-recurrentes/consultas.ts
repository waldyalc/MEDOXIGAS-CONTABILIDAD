import { z } from "zod";

import type { ContactoBuscado } from "@/lib/contactos/seleccion";
import { getEmpresa, getProductosActivos } from "@/lib/facturacion/consultas";
import type { TipoComprobante } from "@/lib/facturacion/tipos";
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
import { createClient } from "@/lib/supabase/server";

import type {
  DatosFormularioRecurrente,
  FacturaRecurrenteLinea,
  FacturaRecurrenteLista,
  FacturaRecurrenteVista,
  GeneracionRecurrente,
} from "./tipos";

const CONTACTOS_INICIALES = 25;

interface RecurrenteFila {
  id: string;
  numero: number;
  contacto_id: string;
  tipo_comprobante: TipoComprobante;
  fecha_inicio: string;
  vigencia_hasta: string | null;
  frecuencia_meses: number;
  plazo_dias: number;
}

interface RecurrenteListaConContacto extends RecurrenteFila {
  contactos: { nombre: string } | null;
}

const OPCIONES_LISTA_DEFECTO: OpcionesLista = { pagina: 1, tamano: TAMANO_PAGINA_DEFECTO, q: "" };

export async function getFacturasRecurrentesLista(
  opciones: OpcionesLista = OPCIONES_LISTA_DEFECTO,
): Promise<ResultadoPagina<FacturaRecurrenteLista>> {
  const supabase = await createClient();
  const q = limpiarBusqueda(opciones.q);
  const numero = numeroDocumento(q);
  const idsContactos = q && numero == null ? await contactosQueCoinciden(supabase, q, ["cliente", "ambos"]) : [];
  const filtro = condicionesDocumento({ q, idsContactos, campos: { texto: "" } });

  const consultar = async (pagina: number) => {
    const { desde, hasta } = rangoPagina(pagina, opciones.tamano);
    let consulta = supabase
      .from("facturas_recurrentes")
      .select(
        "id, numero, contacto_id, tipo_comprobante, fecha_inicio, vigencia_hasta, frecuencia_meses, plazo_dias, contactos(nombre)",
        { count: "exact" },
      );

    if (filtro) consulta = consulta.or(filtro);

    const { data, error, count } = await consulta
      .order("numero", { ascending: false })
      .range(desde, hasta)
      .returns<RecurrenteListaConContacto[]>();

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

  const recurrenteIds = data.map((fila) => fila.id);
  const { data: generaciones, error } = await supabase
    .from("factura_recurrente_generaciones")
    .select("recurrente_id, periodo")
    .in("recurrente_id", recurrenteIds)
    .order("periodo", { ascending: false })
    .returns<{ recurrente_id: string; periodo: string }[]>();

  if (error) throw new Error(error.message);

  const conteo = new Map<string, number>();
  const ultimo = new Map<string, string>();

  for (const generacion of generaciones) {
    conteo.set(generacion.recurrente_id, (conteo.get(generacion.recurrente_id) ?? 0) + 1);
    const actual = ultimo.get(generacion.recurrente_id);
    if (!actual || generacion.periodo > actual) ultimo.set(generacion.recurrente_id, generacion.periodo);
  }

  return {
    filas: data.map(({ contactos, ...fila }) => ({
      ...fila,
      cliente_nombre: contactos?.nombre ?? "—",
      generaciones: conteo.get(fila.id) ?? 0,
      ultimo_periodo: ultimo.get(fila.id) ?? null,
    })),
    resumen,
  };
}

export async function getFacturaRecurrenteVista(id: string): Promise<FacturaRecurrenteVista | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const recurrente = await supabase
    .from("facturas_recurrentes")
    .select(
      "id, numero, contacto_id, tipo_comprobante, fecha_inicio, vigencia_hasta, frecuencia_meses, plazo_dias, notas, terminos, pie",
    )
    .eq("id", id)
    .maybeSingle<Omit<FacturaRecurrenteVista, "cliente_nombre" | "lineas" | "generaciones">>();

  if (recurrente.error) throw new Error(recurrente.error.message);
  if (!recurrente.data) return null;

  const [contacto, lineas, generaciones] = await Promise.all([
    supabase
      .from("contactos")
      .select("nombre")
      .eq("id", recurrente.data.contacto_id)
      .maybeSingle()
      .returns<{ nombre: string } | null>(),
    supabase
      .from("factura_recurrente_lineas")
      .select("id, producto_id, descripcion, cantidad, precio, descuento_pct, itbis_tasa")
      .eq("recurrente_id", id)
      .order("id")
      .returns<FacturaRecurrenteLinea[]>(),
    supabase
      .from("factura_recurrente_generaciones")
      .select("id, periodo, factura_id")
      .eq("recurrente_id", id)
      .order("periodo", { ascending: false })
      .returns<{ id: string; periodo: string; factura_id: string }[]>(),
  ]);

  if (contacto.error) throw new Error(contacto.error.message);
  if (lineas.error) throw new Error(lineas.error.message);
  if (generaciones.error) throw new Error(generaciones.error.message);

  const facturaIds = generaciones.data.map((generacion) => generacion.factura_id);
  const facturas =
    facturaIds.length > 0
      ? await supabase
          .from("facturas")
          .select("id, numero, ncf, fecha, total, estado")
          .in("id", facturaIds)
          .returns<{ id: string; numero: number; ncf: string | null; fecha: string; total: number; estado: string }[]>()
      : { data: [], error: null };

  if (facturas.error) throw new Error(facturas.error.message);

  const facturasPorId = new Map(facturas.data.map((factura) => [factura.id, factura]));
  const generacionesVista: GeneracionRecurrente[] = generaciones.data.map((generacion) => {
    const factura = facturasPorId.get(generacion.factura_id);
    return {
      id: generacion.id,
      periodo: generacion.periodo,
      factura_id: generacion.factura_id,
      factura_numero: factura?.numero ?? 0,
      factura_ncf: factura?.ncf ?? null,
      factura_fecha: factura?.fecha ?? generacion.periodo,
      factura_total: factura?.total ?? 0,
      factura_estado: factura?.estado ?? "—",
    };
  });

  return {
    ...recurrente.data,
    cliente_nombre: contacto.data?.nombre ?? "—",
    lineas: lineas.data,
    generaciones: generacionesVista,
  };
}

export async function getDatosFormularioRecurrente(): Promise<DatosFormularioRecurrente> {
  const supabase = await createClient();
  const [empresa, contactos, productos] = await Promise.all([
    getEmpresa(),
    supabase
      .from("contactos")
      .select("id, nombre, rnc_cedula, lista_precio_id")
      .eq("activo", true)
      .in("tipo", ["cliente", "ambos"])
      .order("nombre")
      .limit(CONTACTOS_INICIALES)
      .returns<ContactoBuscado[]>(),
    getProductosActivos(),
  ]);

  if (contactos.error) throw new Error(contactos.error.message);

  return { empresa, contactos: contactos.data, productos };
}

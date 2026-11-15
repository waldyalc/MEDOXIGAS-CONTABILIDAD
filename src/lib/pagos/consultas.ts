import { getCentrosCostoActivos } from "@/lib/centros-costo/consultas";
import { getRetencionesActivas } from "@/lib/configuracion/consultas";
import { getContactosClientes, getCuentasCajaBanco, getEmpresa } from "@/lib/facturacion/consultas";
import { limpiarBusqueda, numeroDocumento } from "@/lib/listas/busqueda";
import {
  contactosQueCoinciden,
  facturasVentaQueCoinciden,
  pagosRecibidosQueCubrenFacturas,
} from "@/lib/listas/coincidencias";
import { condicionesDocumento } from "@/lib/listas/documento";
import {
  type OpcionesLista,
  type ResultadoPagina,
  rangoPagina,
  resumirPagina,
  TAMANO_PAGINA_DEFECTO,
} from "@/lib/listas/parametros";
import { createClient } from "@/lib/supabase/server";

import type { FacturaPago } from "./multifactura";
import type { DatosFormularioPago, PagoLista } from "./tipos";

const CAMPOS_FACTURA_PAGO =
  "id, numero, ncf, contacto_id, vencimiento, subtotal, itbis, total, pagado, credito, retenido";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getFacturaPago(id: string, tipo: "recibido" | "proveedor"): Promise<FacturaPago | null> {
  if (!UUID.test(id)) return null;

  const supabase = await createClient();
  const tabla = tipo === "recibido" ? "facturas" : "facturas_proveedor";
  const { data, error } = await supabase
    .from(tabla)
    .select(CAMPOS_FACTURA_PAGO)
    .eq("id", id)
    .eq("estado", "abierta")
    .maybeSingle<FacturaPago>();

  if (error) throw new Error(error.message);
  return data;
}

export async function getCuentasIngreso(): Promise<{ id: string; codigo: string; nombre: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cuentas")
    .select("id, codigo, nombre")
    .eq("tipo", "ingreso")
    .eq("acepta_movimientos", true)
    .eq("activa", true)
    .order("codigo")
    .returns<{ id: string; codigo: string; nombre: string }[]>();

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSiguienteNumeroPago(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagos_recibidos")
    .select("numero")
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle<{ numero: number }>();

  if (error) throw new Error(error.message);
  return (data?.numero ?? 0) + 1;
}

export async function getDatosFormularioPago(): Promise<DatosFormularioPago> {
  const [empresa, contactos, cuentas, cuentasIngreso, centrosCosto, retenciones, siguienteNumero] = await Promise.all([
    getEmpresa(),
    getContactosClientes(),
    getCuentasCajaBanco(),
    getCuentasIngreso(),
    getCentrosCostoActivos(),
    getRetencionesActivas(),
    getSiguienteNumeroPago(),
  ]);

  return { empresa, contactos, cuentas, cuentasIngreso, centrosCosto, retenciones, siguienteNumero };
}

const OPCIONES_LISTA_DEFECTO: OpcionesLista = { pagina: 1, tamano: TAMANO_PAGINA_DEFECTO, q: "" };

const ID_INEXISTENTE = "00000000-0000-0000-0000-000000000000";

function filtroPagos(
  q: string,
  idsContactos: readonly string[],
  idsFacturas: readonly string[],
  idsPagos: readonly string[],
): string | null {
  const filtro = condicionesDocumento({ q, idsContactos, idsFacturas, campos: { texto: "" } });
  if (idsPagos.length > 0) {
    const ids = `id.in.(${idsPagos.join(",")})`;
    return filtro ? `${filtro},${ids}` : ids;
  }

  return filtro ?? (q ? `id.eq.${ID_INEXISTENTE}` : null);
}

export async function getPagosLista(
  opciones: OpcionesLista = OPCIONES_LISTA_DEFECTO,
): Promise<ResultadoPagina<PagoLista>> {
  const supabase = await createClient();
  const q = limpiarBusqueda(opciones.q);
  const numero = numeroDocumento(q);
  const [idsContactos, idsFacturas] = await Promise.all([
    q && numero == null ? contactosQueCoinciden(supabase, q, ["cliente", "ambos"]) : Promise.resolve<string[]>([]),
    q ? facturasVentaQueCoinciden(supabase, q) : Promise.resolve<string[]>([]),
  ]);
  const idsPagos = await pagosRecibidosQueCubrenFacturas(supabase, idsFacturas);
  const filtro = filtroPagos(q, idsContactos, idsFacturas, idsPagos);

  const consultar = async (pagina: number) => {
    const { desde, hasta } = rangoPagina(pagina, opciones.tamano);
    let consulta = supabase
      .from("pagos_recibidos")
      .select("id, numero, fecha, contacto_id, factura_id, monto, metodo, estado", { count: "exact" });

    if (filtro) consulta = consulta.or(filtro);

    const { data, error, count } = await consulta.order("numero", { ascending: false }).range(desde, hasta).returns<
      {
        id: string;
        numero: number;
        fecha: string;
        contacto_id: string;
        factura_id: string | null;
        monto: number;
        metodo: PagoLista["metodo"];
        estado: PagoLista["estado"];
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

  const contactoIds = [...new Set(data.map((pago) => pago.contacto_id))];
  const facturaIds = [...new Set(data.map((pago) => pago.factura_id).filter((id): id is string => id !== null))];
  const pagoIds = data.map((pago) => pago.id);

  const [contactos, facturas, aplicaciones] = await Promise.all([
    contactoIds.length > 0
      ? supabase
          .from("contactos")
          .select("id, nombre")
          .in("id", contactoIds)
          .returns<{ id: string; nombre: string }[]>()
      : Promise.resolve({ data: [], error: null }),
    facturaIds.length > 0
      ? supabase
          .from("facturas")
          .select("id, numero, ncf")
          .in("id", facturaIds)
          .returns<{ id: string; numero: number; ncf: string | null }[]>()
      : Promise.resolve({ data: [], error: null }),
    pagoIds.length > 0
      ? supabase
          .from("pago_recibido_aplicaciones")
          .select("pago_id")
          .in("pago_id", pagoIds)
          .returns<{ pago_id: string }[]>()
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (contactos.error) throw new Error(contactos.error.message);
  if (facturas.error) throw new Error(facturas.error.message);
  if (aplicaciones.error) throw new Error(aplicaciones.error.message);

  const nombres = new Map(contactos.data.map((contacto) => [contacto.id, contacto.nombre]));
  const facturasPorId = new Map(facturas.data.map((factura) => [factura.id, factura]));
  const aplicacionesPorPago = new Map<string, number>();
  for (const aplicacion of aplicaciones.data ?? []) {
    aplicacionesPorPago.set(aplicacion.pago_id, (aplicacionesPorPago.get(aplicacion.pago_id) ?? 0) + 1);
  }

  return {
    filas: data.map((pago) => {
      const factura = pago.factura_id ? facturasPorId.get(pago.factura_id) : undefined;
      return {
        ...pago,
        cliente_nombre: nombres.get(pago.contacto_id) ?? "—",
        factura_numero: factura?.numero ?? null,
        factura_ncf: factura?.ncf ?? null,
        aplicaciones: aplicacionesPorPago.get(pago.id) ?? 0,
      };
    }),
    resumen,
  };
}

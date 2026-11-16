import type { ContactoResumen } from "@/lib/facturacion/tipos";
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

import {
  elegirCuentaGastoPorDefecto,
  elegirCuentaPagoPorDefecto,
  filtrarCuentasCajaBanco,
  filtrarCuentasGasto,
} from "./seleccion";
import type { CuentaContable, DatosFormularioGasto, GastoLista } from "./tipos";

async function getCuentas(): Promise<CuentaContable[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cuentas")
    .select("id, codigo, nombre, tipo, acepta_movimientos, activa, es_caja_banco")
    .order("codigo")
    .returns<CuentaContable[]>();

  if (error) throw new Error(error.message);
  return data;
}

export async function getProveedores(): Promise<ContactoResumen[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contactos")
    .select("id, nombre, rnc_cedula, direccion")
    .eq("activo", true)
    .in("tipo", ["proveedor", "ambos"])
    .order("nombre")
    .returns<ContactoResumen[]>();

  if (error) throw new Error(error.message);
  return data;
}

export async function getDatosFormularioGasto(): Promise<DatosFormularioGasto> {
  const [cuentasContables, proveedores] = await Promise.all([getCuentas(), getProveedores()]);
  const cuentas = filtrarCuentasGasto(cuentasContables);
  const cuentasCajaBanco = filtrarCuentasCajaBanco(cuentasContables);

  return {
    cuentas,
    cuentasCajaBanco,
    proveedores,
    cuentaPorDefecto: elegirCuentaGastoPorDefecto(cuentas)?.id ?? "",
    cuentaPagoPorDefecto: elegirCuentaPagoPorDefecto(cuentasCajaBanco)?.id ?? "",
  };
}

const OPCIONES_LISTA_DEFECTO: OpcionesLista = { pagina: 1, tamano: TAMANO_PAGINA_DEFECTO, q: "" };

const CAMPOS_GASTO =
  "id, numero, ncf, fecha, contacto_id, cuenta_gasto_id, cuenta_pago_id, descripcion, subtotal, itbis, total, estado, contactos(nombre)";

interface GastoListaConContacto {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  contacto_id: string | null;
  cuenta_gasto_id: string;
  cuenta_pago_id: string;
  descripcion: string;
  subtotal: number;
  itbis: number;
  total: number;
  estado: GastoLista["estado"];
  contactos: { nombre: string } | null;
}

export async function getGastosLista(
  opciones: OpcionesLista = OPCIONES_LISTA_DEFECTO,
): Promise<ResultadoPagina<GastoLista>> {
  const supabase = await createClient();
  const q = limpiarBusqueda(opciones.q);
  const numero = numeroDocumento(q);
  const idsContactos = q && numero == null ? await contactosQueCoinciden(supabase, q, ["proveedor", "ambos"]) : [];
  const filtro = condicionesDocumento({ q, idsContactos, campos: { texto: ["ncf", "descripcion"] } });

  const consultar = async (pagina: number) => {
    const { desde, hasta } = rangoPagina(pagina, opciones.tamano);
    let consulta = supabase.from("gastos_menores").select(CAMPOS_GASTO, { count: "exact" });

    if (filtro) consulta = consulta.or(filtro);

    const { data, error, count } = await consulta
      .order("numero", { ascending: false })
      .range(desde, hasta)
      .returns<GastoListaConContacto[]>();

    if (error) throw new Error(error.message);
    return { filas: data ?? [], total: count ?? 0 };
  };

  const primera = await consultar(opciones.pagina);
  const resumen = resumirPagina(opciones.pagina, opciones.tamano, primera.total);
  const filas =
    resumen.pagina !== opciones.pagina && primera.filas.length === 0
      ? (await consultar(resumen.pagina)).filas
      : primera.filas;

  const cuentaIds = [...new Set(filas.flatMap((gasto) => [gasto.cuenta_gasto_id, gasto.cuenta_pago_id]))];
  const cuentas =
    cuentaIds.length > 0
      ? await supabase
          .from("cuentas")
          .select("id, nombre")
          .in("id", cuentaIds)
          .returns<{ id: string; nombre: string }[]>()
      : { data: [], error: null };

  if (cuentas.error) throw new Error(cuentas.error.message);

  const nombresCuentas = new Map(cuentas.data.map((cuenta) => [cuenta.id, cuenta.nombre]));

  return {
    filas: filas.map(({ contactos, ...gasto }) => ({
      ...gasto,
      proveedor_nombre: contactos?.nombre ?? "—",
      cuenta_nombre: nombresCuentas.get(gasto.cuenta_gasto_id) ?? "—",
      cuenta_pago_nombre: nombresCuentas.get(gasto.cuenta_pago_id) ?? "—",
    })),
    resumen,
  };
}

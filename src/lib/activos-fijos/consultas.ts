import { z } from "zod";

import { condicionesTexto, limpiarBusqueda } from "@/lib/listas/busqueda";
import {
  type OpcionesLista,
  type ResultadoPagina,
  rangoPagina,
  resumirPagina,
  TAMANO_PAGINA_DEFECTO,
} from "@/lib/listas/parametros";
import { createClient } from "@/lib/supabase/server";

import type {
  ActivoDetalle,
  ActivoLista,
  ContactoActivo,
  CuentaActivo,
  DatosFormularioActivo,
  DepreciacionRegistrada,
} from "./tipos";

interface ActivoFila {
  id: string;
  nombre: string;
  referencia: string | null;
  tipo_activo: string;
  fecha_adquisicion: string;
  costo_unitario: number;
  cantidad: number;
  monto_total: number;
  valor_residual: number;
  fecha_inicio_depreciacion: string;
  vida_util_meses: number;
  asiento_id: string | null;
  proveedor_contacto_id: string | null;
  cuenta_activo_id: string;
  cuenta_depreciacion_id: string;
  cuenta_gasto_id: string;
}

interface CuentaResumen {
  id: string;
  codigo: string;
  nombre: string;
}

const OPCIONES_LISTA_DEFECTO: OpcionesLista = { pagina: 1, tamano: TAMANO_PAGINA_DEFECTO, q: "" };

export async function getActivosLista(
  opciones: OpcionesLista = OPCIONES_LISTA_DEFECTO,
): Promise<ResultadoPagina<ActivoLista>> {
  const supabase = await createClient();
  const q = limpiarBusqueda(opciones.q);
  const filtro = condicionesTexto(q, ["nombre", "referencia"]);

  const consultar = async (pagina: number) => {
    const { desde, hasta } = rangoPagina(pagina, opciones.tamano);
    let consulta = supabase
      .from("activos_fijos")
      .select("id, nombre, referencia, tipo_activo, fecha_adquisicion, monto_total, valor_residual, vida_util_meses", {
        count: "exact",
      });

    if (filtro) consulta = consulta.or(filtro);

    const { data, error, count } = await consulta
      .order("creado_en", { ascending: false })
      .range(desde, hasta)
      .returns<Omit<ActivoLista, "depreciado">[]>();

    if (error) throw new Error(error.message);
    return { filas: data ?? [], total: count ?? 0 };
  };

  const primera = await consultar(opciones.pagina);
  const resumen = resumirPagina(opciones.pagina, opciones.tamano, primera.total);
  const activos =
    resumen.pagina !== opciones.pagina && primera.filas.length === 0
      ? (await consultar(resumen.pagina)).filas
      : primera.filas;

  const ids = activos.map((activo) => activo.id);
  const { data: depreciaciones, error } =
    ids.length > 0
      ? await supabase
          .from("activo_depreciaciones")
          .select("activo_id, monto")
          .in("activo_id", ids)
          .returns<{ activo_id: string; monto: number }[]>()
      : { data: [], error: null };

  if (error) throw new Error(error.message);

  const acumulado = new Map<string, number>();
  for (const fila of depreciaciones) {
    acumulado.set(fila.activo_id, (acumulado.get(fila.activo_id) ?? 0) + fila.monto);
  }

  return {
    filas: activos.map((activo) => ({
      ...activo,
      depreciado: acumulado.get(activo.id) ?? 0,
    })),
    resumen,
  };
}

async function cargarCuentas(ids: string[]): Promise<Map<string, CuentaResumen>> {
  if (ids.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase.from("cuentas").select("id, codigo, nombre").in("id", ids);
  if (error) throw new Error(error.message);

  return new Map(data.map((cuenta) => [cuenta.id, cuenta]));
}

export async function getActivoDetalle(id: string): Promise<ActivoDetalle | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const { data: activo, error } = await supabase
    .from("activos_fijos")
    .select(
      "id, nombre, referencia, tipo_activo, fecha_adquisicion, costo_unitario, cantidad, monto_total, valor_residual, fecha_inicio_depreciacion, vida_util_meses, asiento_id, proveedor_contacto_id, cuenta_activo_id, cuenta_depreciacion_id, cuenta_gasto_id",
    )
    .eq("id", id)
    .maybeSingle()
    .returns<ActivoFila | null>();

  if (error) throw new Error(error.message);
  if (!activo) return null;

  const [cuentas, proveedor, depreciaciones] = await Promise.all([
    cargarCuentas([activo.cuenta_activo_id, activo.cuenta_depreciacion_id, activo.cuenta_gasto_id]),
    activo.proveedor_contacto_id
      ? supabase
          .from("contactos")
          .select("id, nombre")
          .eq("id", activo.proveedor_contacto_id)
          .maybeSingle()
          .returns<ContactoActivo | null>()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("activo_depreciaciones")
      .select("periodo, monto, asiento_id")
      .eq("activo_id", id)
      .order("periodo")
      .returns<{ periodo: string; monto: number; asiento_id: string }[]>(),
  ]);

  if (proveedor.error) throw new Error(proveedor.error.message);
  if (depreciaciones.error) throw new Error(depreciaciones.error.message);

  const asientoIds = [...new Set(depreciaciones.data.map((fila) => fila.asiento_id))];
  const { data: asientos, error: errorAsientos } =
    asientoIds.length > 0
      ? await supabase
          .from("asientos")
          .select("id, numero")
          .in("id", asientoIds)
          .returns<{ id: string; numero: number }[]>()
      : { data: [], error: null };

  if (errorAsientos) throw new Error(errorAsientos.message);

  const numeroAsiento = new Map(asientos.map((asiento) => [asiento.id, asiento.numero]));

  const cuentaActivo = cuentas.get(activo.cuenta_activo_id) ?? null;
  const cuentaDepreciacion = cuentas.get(activo.cuenta_depreciacion_id) ?? null;
  const cuentaGasto = cuentas.get(activo.cuenta_gasto_id) ?? null;

  const filas: DepreciacionRegistrada[] = depreciaciones.data.map((fila) => ({
    periodo: fila.periodo,
    monto: fila.monto,
    asiento_id: fila.asiento_id,
    asiento_numero: numeroAsiento.get(fila.asiento_id) ?? null,
  }));

  return {
    id: activo.id,
    nombre: activo.nombre,
    referencia: activo.referencia,
    tipo_activo: activo.tipo_activo,
    fecha_adquisicion: activo.fecha_adquisicion,
    costo_unitario: activo.costo_unitario,
    cantidad: activo.cantidad,
    monto_total: activo.monto_total,
    valor_residual: activo.valor_residual,
    fecha_inicio_depreciacion: activo.fecha_inicio_depreciacion,
    vida_util_meses: activo.vida_util_meses,
    asiento_id: activo.asiento_id,
    proveedor: proveedor.data,
    cuenta_activo: cuentaActivo,
    cuenta_depreciacion: cuentaDepreciacion,
    cuenta_gasto: cuentaGasto,
    depreciaciones: filas,
  };
}

export async function getDatosFormularioActivo(): Promise<DatosFormularioActivo> {
  const supabase = await createClient();

  const [cuentas, proveedores] = await Promise.all([
    supabase
      .from("cuentas")
      .select("id, codigo, nombre, tipo, naturaleza, acepta_movimientos, activa")
      .eq("activa", true)
      .eq("acepta_movimientos", true)
      .order("codigo")
      .returns<CuentaActivo[]>(),
    supabase
      .from("contactos")
      .select("id, nombre")
      .eq("activo", true)
      .in("tipo", ["proveedor", "ambos"])
      .order("nombre")
      .returns<ContactoActivo[]>(),
  ]);

  if (cuentas.error) throw new Error(cuentas.error.message);
  if (proveedores.error) throw new Error(proveedores.error.message);

  const cuentasActivo = cuentas.data.filter((cuenta) => cuenta.tipo === "activo" && cuenta.naturaleza === "debito");
  const cuentasDepreciacion = cuentas.data.filter(
    (cuenta) => cuenta.tipo === "activo" && cuenta.naturaleza === "credito",
  );
  const cuentasGasto = cuentas.data.filter(
    (cuenta) => (cuenta.tipo === "gasto" || cuenta.tipo === "costo") && cuenta.naturaleza === "debito",
  );

  return {
    cuentasActivo,
    cuentasDepreciacion,
    cuentasGasto,
    proveedores: proveedores.data,
    porDefecto: {
      activo: elegirPorCodigo(cuentasActivo, "1210"),
      depreciacion: elegirPorCodigo(cuentasDepreciacion, "1211"),
      gasto: elegirPorCodigo(cuentasGasto, "6109"),
    },
  };
}

function elegirPorCodigo(cuentas: CuentaActivo[], codigo: string): string {
  return cuentas.find((cuenta) => cuenta.codigo === codigo)?.id ?? cuentas[0]?.id ?? "";
}

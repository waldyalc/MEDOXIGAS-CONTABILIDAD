import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import type { ContactoTipo } from "./contactos";
import {
  type AsientoFicha,
  type ContactoFicha,
  type CuentaFicha,
  type DatosFichaContacto,
  type DocumentoComercialFicha,
  type DocumentoFicha,
  type LineaAsientoContacto,
  type NotaFicha,
  type PagoFicha,
  sumarLineasAsiento,
  type TipoNotaFicha,
  type TotalesAsiento,
} from "./ficha";

const UUID = z.uuid();

const CAMPOS_CONTACTO = "id, nombre, rnc_cedula, telefono, correo, direccion, tipo, cuenta_cxc_id, cuenta_cxp_id";
const CAMPOS_DOCUMENTO = "id, numero, ncf, fecha, vencimiento, total, pagado, credito, estado";
const CAMPOS_COMERCIAL = "id, numero, fecha, total, estado";
const CAMPOS_NOTA = "id, numero, ncf, fecha, total, estado";
const CAMPOS_PAGO = "id, numero, fecha, monto, estado, factura_id";

interface ContactoConCuentas extends ContactoFicha {
  cuenta_cxc_id: string | null;
  cuenta_cxp_id: string | null;
}

interface PagoProveedorFila {
  id: string;
  numero: number;
  fecha: string;
  monto: number | string;
  estado: string;
  factura_proveedor_id: string | null;
}

interface AsientoFila {
  id: string;
  numero: number;
  fecha: string;
  descripcion: string;
}

function normalizarTipo(valor: string): ContactoTipo {
  if (valor === "proveedor" || valor === "ambos") return valor;
  return "cliente";
}

function verificarError(resultado: { error: { message: string } | null }): void {
  if (resultado.error !== null) throw new Error(resultado.error.message);
}

function filasDe<T>(filas: T[] | null): T[] {
  return filas ?? [];
}

function mapearContacto(fila: ContactoConCuentas): ContactoFicha {
  return {
    id: fila.id,
    nombre: fila.nombre,
    rnc_cedula: fila.rnc_cedula,
    telefono: fila.telefono,
    correo: fila.correo,
    direccion: fila.direccion,
    tipo: normalizarTipo(fila.tipo),
  };
}

function resolverCuenta(
  propia: string | null,
  configurada: string | undefined,
  cuentas: ReadonlyMap<string, CuentaFicha>,
): CuentaFicha | null {
  if (propia !== null) {
    const cuenta = cuentas.get(propia);
    if (cuenta) return cuenta;
  }
  if (configurada !== undefined) return cuentas.get(configurada) ?? null;
  return null;
}

function mapearPagosRecibidos(
  pagos: readonly Omit<PagoFicha, "factura_numero">[],
  numerosFactura: ReadonlyMap<string, number>,
): PagoFicha[] {
  return pagos.map((pago) => ({
    ...pago,
    factura_numero: pago.factura_id === null ? null : (numerosFactura.get(pago.factura_id) ?? null),
  }));
}

function mapearPagosProveedor(
  pagos: readonly PagoProveedorFila[],
  numerosCompra: ReadonlyMap<string, number>,
): PagoFicha[] {
  return pagos.map((pago) => ({
    id: pago.id,
    numero: pago.numero,
    fecha: pago.fecha,
    monto: pago.monto,
    estado: pago.estado,
    factura_id: pago.factura_proveedor_id,
    factura_numero: pago.factura_proveedor_id === null ? null : (numerosCompra.get(pago.factura_proveedor_id) ?? null),
  }));
}

interface NotaCruda {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  total: number | string;
  estado: string;
}

function mapearNotas(notas: readonly NotaCruda[], tipo: TipoNotaFicha): NotaFicha[] {
  return notas.map((nota) => ({ ...nota, tipo }));
}

function mapearAsientos(
  asientos: readonly AsientoFila[],
  totalesAsientos: ReadonlyMap<string, TotalesAsiento>,
): AsientoFicha[] {
  return asientos.map((asiento) => {
    const totales = totalesAsientos.get(asiento.id) ?? { debitoCentavos: 0, creditoCentavos: 0 };

    return {
      id: asiento.id,
      numero: asiento.numero,
      fecha: asiento.fecha,
      descripcion: asiento.descripcion,
      debitoCentavos: totales.debitoCentavos,
      creditoCentavos: totales.creditoCentavos,
    };
  });
}

export async function obtenerContactoFicha(id: string): Promise<ContactoFicha | null> {
  if (!UUID.safeParse(id).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contactos")
    .select(CAMPOS_CONTACTO)
    .eq("id", id)
    .maybeSingle()
    .returns<ContactoConCuentas | null>();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapearContacto(data);
}

export async function obtenerFichaContacto(id: string): Promise<DatosFichaContacto | null> {
  if (!UUID.safeParse(id).success) return null;

  const supabase = await createClient();
  const [
    contactoRes,
    facturasRes,
    comprasRes,
    cotizacionesRes,
    conducesRes,
    notasCreditoRes,
    notasDebitoRes,
    notasCompraRes,
    pagosRes,
    pagosProveedorRes,
    lineasRes,
    configRes,
  ] = await Promise.all([
    supabase.from("contactos").select(CAMPOS_CONTACTO).eq("id", id).maybeSingle().returns<ContactoConCuentas | null>(),
    supabase
      .from("facturas")
      .select(CAMPOS_DOCUMENTO)
      .eq("contacto_id", id)
      .order("fecha", { ascending: false })
      .order("numero", { ascending: false })
      .returns<DocumentoFicha[]>(),
    supabase
      .from("facturas_proveedor")
      .select(CAMPOS_DOCUMENTO)
      .eq("contacto_id", id)
      .order("fecha", { ascending: false })
      .order("numero", { ascending: false })
      .returns<DocumentoFicha[]>(),
    supabase
      .from("cotizaciones")
      .select(CAMPOS_COMERCIAL)
      .eq("contacto_id", id)
      .order("fecha", { ascending: false })
      .order("numero", { ascending: false })
      .returns<DocumentoComercialFicha[]>(),
    supabase
      .from("remisiones")
      .select(CAMPOS_COMERCIAL)
      .eq("contacto_id", id)
      .order("fecha", { ascending: false })
      .order("numero", { ascending: false })
      .returns<DocumentoComercialFicha[]>(),
    supabase
      .from("notas_credito_venta")
      .select(CAMPOS_NOTA)
      .eq("contacto_id", id)
      .order("fecha", { ascending: false })
      .order("numero", { ascending: false })
      .returns<NotaCruda[]>(),
    supabase
      .from("notas_debito_venta")
      .select(CAMPOS_NOTA)
      .eq("contacto_id", id)
      .order("fecha", { ascending: false })
      .order("numero", { ascending: false })
      .returns<NotaCruda[]>(),
    supabase
      .from("notas_credito_compra")
      .select(CAMPOS_NOTA)
      .eq("contacto_id", id)
      .order("fecha", { ascending: false })
      .order("numero", { ascending: false })
      .returns<NotaCruda[]>(),
    supabase
      .from("pagos_recibidos")
      .select(CAMPOS_PAGO)
      .eq("contacto_id", id)
      .order("fecha", { ascending: false })
      .order("numero", { ascending: false })
      .returns<Omit<PagoFicha, "factura_numero">[]>(),
    supabase
      .from("pagos_proveedor")
      .select("id, numero, fecha, monto, estado, factura_proveedor_id")
      .eq("contacto_id", id)
      .order("fecha", { ascending: false })
      .order("numero", { ascending: false })
      .returns<PagoProveedorFila[]>(),
    supabase
      .from("asiento_lineas")
      .select("asiento_id, debito, credito")
      .eq("contacto_id", id)
      .returns<LineaAsientoContacto[]>(),
    supabase
      .from("config_contable")
      .select("clave, cuenta_id")
      .in("clave", ["cxc", "cxp"])
      .returns<{ clave: string; cuenta_id: string }[]>(),
  ]);

  for (const resultado of [
    contactoRes,
    facturasRes,
    comprasRes,
    cotizacionesRes,
    conducesRes,
    notasCreditoRes,
    notasDebitoRes,
    notasCompraRes,
    pagosRes,
    pagosProveedorRes,
    lineasRes,
    configRes,
  ]) {
    verificarError(resultado);
  }
  if (!contactoRes.data) return null;

  const contacto = contactoRes.data;
  const configuracion = new Map(filasDe(configRes.data).map((fila) => [fila.clave, fila.cuenta_id]));
  const cuentaIds = [
    contacto.cuenta_cxc_id,
    contacto.cuenta_cxp_id,
    configuracion.get("cxc"),
    configuracion.get("cxp"),
  ].filter((valor): valor is string => valor != null);
  const totalesAsientos = sumarLineasAsiento(filasDe(lineasRes.data));
  const asientoIds = [...totalesAsientos.keys()];

  const [cuentasRes, asientosRes] = await Promise.all([
    cuentaIds.length > 0
      ? supabase.from("cuentas").select("id, codigo, nombre").in("id", cuentaIds).returns<CuentaFicha[]>()
      : Promise.resolve({ data: [] as CuentaFicha[], error: null }),
    asientoIds.length > 0
      ? supabase
          .from("asientos")
          .select("id, numero, fecha, descripcion")
          .in("id", asientoIds)
          .order("fecha", { ascending: false })
          .order("numero", { ascending: false })
          .returns<AsientoFila[]>()
      : Promise.resolve({ data: [] as AsientoFila[], error: null }),
  ]);

  for (const resultado of [cuentasRes, asientosRes]) {
    verificarError(resultado);
  }

  const cuentas = new Map(filasDe(cuentasRes.data).map((cuenta) => [cuenta.id, cuenta]));
  const facturas = filasDe(facturasRes.data);
  const compras = filasDe(comprasRes.data);
  const numerosFactura = new Map(facturas.map((factura) => [factura.id, factura.numero]));
  const numerosCompra = new Map(compras.map((compra) => [compra.id, compra.numero]));

  const pagosRecibidos = mapearPagosRecibidos(filasDe(pagosRes.data), numerosFactura);
  const pagosProveedor = mapearPagosProveedor(filasDe(pagosProveedorRes.data), numerosCompra);
  const asientos = mapearAsientos(filasDe(asientosRes.data), totalesAsientos);
  const notasVenta = [
    ...mapearNotas(filasDe(notasCreditoRes.data), "credito"),
    ...mapearNotas(filasDe(notasDebitoRes.data), "debito"),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.numero - a.numero);

  return {
    contacto: mapearContacto(contacto),
    cuentaCxc: resolverCuenta(contacto.cuenta_cxc_id, configuracion.get("cxc"), cuentas),
    cuentaCxp: resolverCuenta(contacto.cuenta_cxp_id, configuracion.get("cxp"), cuentas),
    facturas,
    facturasProveedor: compras,
    cotizaciones: filasDe(cotizacionesRes.data),
    conduces: filasDe(conducesRes.data),
    notasVenta,
    notasCompra: mapearNotas(filasDe(notasCompraRes.data), "credito_compra"),
    pagosRecibidos,
    pagosProveedor,
    asientos,
  };
}

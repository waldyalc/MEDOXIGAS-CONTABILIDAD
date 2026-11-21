import { z } from "zod";

import {
  rutaCompra,
  rutaConciliacion,
  rutaFactura,
  rutaGasto,
  rutaNotaCreditoCompra,
  rutaNotaCreditoVenta,
  rutaNotaDebitoVenta,
  rutaPagoProveedor,
  rutaPagoRecibido,
  rutaTransferencia,
} from "@/lib/enlaces";
import { createClient } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof createClient>>;

interface AsientoFila {
  id: string;
  numero: number;
  codigo: string | null;
  tipo_entrada_id: string | null;
  fecha: string;
  descripcion: string;
  origen_tipo: string;
  origen_id: string | null;
  anula_asiento_id: string | null;
}

interface LineaFila {
  id: string;
  cuenta_id: string;
  contacto_id: string | null;
  descripcion: string | null;
  debito: number;
  credito: number;
}

interface CuentaResumen {
  id: string;
  codigo: string;
  nombre: string;
}

interface ContactoResumen {
  id: string;
  nombre: string;
}

export interface LineaAsiento {
  id: string;
  descripcion: string | null;
  debito: number;
  credito: number;
  cuenta: CuentaResumen | null;
  contacto: ContactoResumen | null;
}

export interface OrigenAsiento {
  etiqueta: string;
  href: string | null;
}

export interface AsientoDetalle {
  id: string;
  numero: number;
  codigo: string | null;
  tipoEntrada: string | null;
  fecha: string;
  descripcion: string;
  origen: OrigenAsiento;
  lineas: LineaAsiento[];
}

const ETIQUETAS_DOCUMENTO: Record<string, string> = {
  factura: "Factura",
  factura_proveedor: "Compra",
  pago_recibido: "Pago recibido",
  pago_proveedor: "Pago a proveedor",
  gasto_menor: "Gasto",
  nota_credito_venta: "Nota de crédito",
  nota_credito_compra: "Nota de crédito de compra",
  nota_debito: "Nota de débito",
  transferencia: "Transferencia",
  deposito: "Depósito",
  conciliacion: "Conciliación",
  ajuste_inventario: "Ajuste de inventario",
  inventario_inicial: "Inventario inicial",
  manual: "Manual",
  anulacion: "Anulación",
  saldo_inicial: "Saldos iniciales",
  pos_movimiento: "Movimiento de caja POS",
  pos_diferencia: "Diferencia de cierre POS",
  nomina: "Nómina",
  pago_nomina: "Pago de nómina",
};

const ETIQUETAS_TIPO: Record<string, string> = {
  factura: "factura",
  factura_proveedor: "factura de proveedor",
  pago_recibido: "pago recibido",
  pago_proveedor: "pago a proveedor",
  gasto_menor: "gasto",
  nota_credito_venta: "nota de crédito",
  nota_credito_compra: "nota de crédito de compra",
  nota_debito: "nota de débito",
  transferencia: "transferencia",
  deposito: "depósito",
  conciliacion: "conciliación",
  ajuste_inventario: "ajuste de inventario",
  inventario_inicial: "inventario inicial",
  manual: "manual",
  anulacion: "anulación",
  saldo_inicial: "saldos iniciales",
  pos_movimiento: "movimiento de caja POS",
  pos_diferencia: "diferencia de cierre POS",
  nomina: "nómina",
  pago_nomina: "pago de nómina",
};

function rutaDocumento(tipo: string, id: string): string | null {
  switch (tipo) {
    case "factura":
      return rutaFactura(id);
    case "factura_proveedor":
      return rutaCompra(id);
    case "pago_recibido":
      return rutaPagoRecibido(id);
    case "pago_proveedor":
      return rutaPagoProveedor(id);
    case "gasto_menor":
      return rutaGasto(id);
    case "nota_credito_venta":
      return rutaNotaCreditoVenta(id);
    case "nota_credito_compra":
      return rutaNotaCreditoCompra(id);
    case "nota_debito":
      return rutaNotaDebitoVenta(id);
    case "conciliacion":
      return rutaConciliacion(id);
    default:
      return null;
  }
}

async function buscarNumeroDocumento(cliente: Cliente, tipo: string, id: string): Promise<number | null> {
  switch (tipo) {
    case "factura": {
      const { data } = await cliente.from("facturas").select("numero").eq("id", id).maybeSingle();
      return data?.numero ?? null;
    }
    case "factura_proveedor": {
      const { data } = await cliente.from("facturas_proveedor").select("numero").eq("id", id).maybeSingle();
      return data?.numero ?? null;
    }
    case "pago_recibido": {
      const { data } = await cliente.from("pagos_recibidos").select("numero").eq("id", id).maybeSingle();
      return data?.numero ?? null;
    }
    case "pago_proveedor": {
      const { data } = await cliente.from("pagos_proveedor").select("numero").eq("id", id).maybeSingle();
      return data?.numero ?? null;
    }
    case "gasto_menor": {
      const { data } = await cliente.from("gastos_menores").select("numero").eq("id", id).maybeSingle();
      return data?.numero ?? null;
    }
    case "nota_credito_venta": {
      const { data } = await cliente.from("notas_credito_venta").select("numero").eq("id", id).maybeSingle();
      return data?.numero ?? null;
    }
    case "nota_credito_compra": {
      const { data } = await cliente.from("notas_credito_compra").select("numero").eq("id", id).maybeSingle();
      return data?.numero ?? null;
    }
    case "nota_debito": {
      const { data } = await cliente.from("notas_debito_venta").select("numero").eq("id", id).maybeSingle();
      return data?.numero ?? null;
    }
    default:
      return null;
  }
}

async function resolverAnulacion(cliente: Cliente, asiento: AsientoFila): Promise<OrigenAsiento> {
  if (!asiento.anula_asiento_id) return { etiqueta: "Anulación", href: null };

  const { data } = await cliente
    .from("asientos")
    .select("id, origen_tipo, origen_id")
    .eq("id", asiento.anula_asiento_id)
    .maybeSingle();

  if (!data) return { etiqueta: "Anulación", href: null };

  let href: string | null = null;
  if (data.origen_tipo === "transferencia" || data.origen_tipo === "deposito") {
    href = rutaTransferencia(data.id);
  } else if (data.origen_id) {
    href = rutaDocumento(data.origen_tipo, data.origen_id);
  }

  if (!href) return { etiqueta: "Anulación", href: null };

  return { etiqueta: `Anulación de ${ETIQUETAS_TIPO[data.origen_tipo] ?? data.origen_tipo}`, href };
}

async function resolverOrigen(cliente: Cliente, asiento: AsientoFila): Promise<OrigenAsiento> {
  if (asiento.origen_tipo === "anulacion") return resolverAnulacion(cliente, asiento);
  if (asiento.origen_tipo === "manual") return { etiqueta: "Manual", href: null };
  if (asiento.origen_tipo === "saldo_inicial") return { etiqueta: "Saldos iniciales", href: null };

  if (asiento.origen_tipo === "transferencia" || asiento.origen_tipo === "deposito") {
    return {
      etiqueta: ETIQUETAS_DOCUMENTO[asiento.origen_tipo] ?? "Movimiento",
      href: rutaTransferencia(asiento.id),
    };
  }

  if (asiento.origen_tipo === "conciliacion") {
    return {
      etiqueta: "Conciliación",
      href: asiento.origen_id ? rutaConciliacion(asiento.origen_id) : null,
    };
  }

  if (!asiento.origen_id) return { etiqueta: "—", href: null };

  const href = rutaDocumento(asiento.origen_tipo, asiento.origen_id);
  if (!href) return { etiqueta: "—", href: null };

  const etiqueta = ETIQUETAS_DOCUMENTO[asiento.origen_tipo];
  const numero = await buscarNumeroDocumento(cliente, asiento.origen_tipo, asiento.origen_id);

  return { etiqueta: etiqueta && numero != null ? `${etiqueta} #${numero}` : "Ver documento", href };
}

async function cargarCuentas(cliente: Cliente, ids: string[]): Promise<Map<string, CuentaResumen>> {
  if (ids.length === 0) return new Map();

  const { data, error } = await cliente.from("cuentas").select("id, codigo, nombre").in("id", ids);
  if (error) throw new Error(error.message);

  return new Map((data ?? []).map((cuenta) => [cuenta.id, cuenta]));
}

async function cargarContactos(cliente: Cliente, ids: string[]): Promise<Map<string, ContactoResumen>> {
  if (ids.length === 0) return new Map();

  const { data, error } = await cliente.from("contactos").select("id, nombre").in("id", ids);
  if (error) throw new Error(error.message);

  return new Map((data ?? []).map((contacto) => [contacto.id, contacto]));
}

export async function obtenerAsientoDetalle(id: string): Promise<AsientoDetalle | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const cliente = await createClient();
  const { data: asiento, error } = await cliente
    .from("asientos")
    .select("id, numero, codigo, tipo_entrada_id, fecha, descripcion, origen_tipo, origen_id, anula_asiento_id")
    .eq("id", id)
    .maybeSingle()
    .returns<AsientoFila | null>();

  if (error) throw new Error(error.message);
  if (!asiento) return null;

  const [lineas, origen] = await Promise.all([
    cliente
      .from("asiento_lineas")
      .select("id, cuenta_id, contacto_id, descripcion, debito, credito")
      .eq("asiento_id", id)
      .order("id")
      .returns<LineaFila[]>(),
    resolverOrigen(cliente, asiento),
  ]);

  if (lineas.error) throw new Error(lineas.error.message);

  const filas = lineas.data ?? [];
  const cuentaIds = [...new Set(filas.map((linea) => linea.cuenta_id))];
  const contactoIds = [...new Set(filas.flatMap((linea) => (linea.contacto_id == null ? [] : [linea.contacto_id])))];

  const [cuentas, contactos] = await Promise.all([
    cargarCuentas(cliente, cuentaIds),
    cargarContactos(cliente, contactoIds),
  ]);

  let tipoEntrada: string | null = null;
  if (asiento.tipo_entrada_id) {
    const { data: tipo } = await cliente
      .from("tipos_entrada_diario")
      .select("nombre")
      .eq("id", asiento.tipo_entrada_id)
      .maybeSingle();
    tipoEntrada = tipo?.nombre ?? null;
  }

  return {
    id: asiento.id,
    numero: asiento.numero,
    codigo: asiento.codigo,
    tipoEntrada,
    fecha: asiento.fecha,
    descripcion: asiento.descripcion,
    origen,
    lineas: filas.map((linea) => ({
      id: linea.id,
      descripcion: linea.descripcion,
      debito: linea.debito,
      credito: linea.credito,
      cuenta: cuentas.get(linea.cuenta_id) ?? null,
      contacto: linea.contacto_id == null ? null : (contactos.get(linea.contacto_id) ?? null),
    })),
  };
}

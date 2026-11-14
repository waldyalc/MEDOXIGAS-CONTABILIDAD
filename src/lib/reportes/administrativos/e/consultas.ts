import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

import { centavos } from "../../dinero";
import type { CuentaContable, FilaEstadoResultados } from "../../tipos";
import type { ItemRankingAnual, VentaFecha } from "./anual";
import type { MovimientoTransaccion } from "./transacciones";

type Relacion<T> = T | T[] | null | undefined;

function primerRelacion<T>(valor: Relacion<T>): T | null {
  if (valor == null) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

async function cliente(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

export interface DatosIngresosCompras {
  cuentas: CuentaContable[];
  filas: FilaEstadoResultados[];
  error: string | null;
}

export async function obtenerDatosIngresosCompras(desde: string, hasta: string): Promise<DatosIngresosCompras> {
  const supabase = await cliente();
  const [cuentas, estado] = await Promise.all([
    supabase
      .from("cuentas")
      .select("id, codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos, activa")
      .in("tipo", ["ingreso", "costo", "gasto"])
      .eq("activa", true)
      .order("codigo"),
    supabase.rpc("reporte_estado_resultados", { p_desde: desde, p_hasta: hasta }),
  ]);

  return {
    cuentas: (cuentas.data ?? []) as unknown as CuentaContable[],
    filas: (estado.data ?? []) as unknown as FilaEstadoResultados[],
    error: cuentas.error?.message ?? estado.error?.message ?? null,
  };
}

interface PagoRecibidoCrudo {
  id: string;
  numero: number;
  fecha: string;
  monto: number | string;
  estado: string;
  contacto_id: string;
  cuenta_id: string;
  creado_en: string;
  cuenta: Relacion<{ nombre: string }>;
  contacto: Relacion<{ nombre: string }>;
  factura: Relacion<{ ncf: string }>;
}

interface PagoProveedorCrudo {
  id: string;
  numero: number;
  fecha: string;
  monto: number | string;
  estado: string;
  contacto_id: string;
  cuenta_id: string;
  creado_en: string;
  cuenta: Relacion<{ nombre: string }>;
  contacto: Relacion<{ nombre: string }>;
  factura: Relacion<{ ncf: string | null }>;
}

interface GastoMenorCrudo {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  descripcion: string;
  total: number | string;
  estado: string;
  contacto_id: string | null;
  cuenta_id: string;
  creado_en: string;
  cuenta: Relacion<{ nombre: string }>;
  contacto: Relacion<{ nombre: string }>;
}

interface MovimientoOrdenado {
  creadoEn: string;
  movimiento: MovimientoTransaccion;
}

export interface ResultadoTransacciones {
  movimientos: MovimientoTransaccion[];
  error: string | null;
}

function movimientoGasto(fila: GastoMenorCrudo): MovimientoOrdenado {
  return {
    creadoEn: fila.creado_en,
    movimiento: {
      id: fila.id,
      origen: "gasto_menor",
      comprobante: fila.ncf ?? String(fila.numero),
      fecha: fila.fecha,
      cuentaId: fila.cuenta_id,
      cuenta: primerRelacion(fila.cuenta)?.nombre ?? "—",
      contactoId: fila.contacto_id,
      contactoNombre: primerRelacion(fila.contacto)?.nombre ?? null,
      detalle: fila.descripcion,
      entradas: 0,
      salidas: centavos(fila.total),
      estado: fila.estado,
    },
  };
}

function movimientoPagoRecibido(fila: PagoRecibidoCrudo): MovimientoOrdenado {
  const factura = primerRelacion(fila.factura);

  return {
    creadoEn: fila.creado_en,
    movimiento: {
      id: fila.id,
      origen: "pago_recibido",
      comprobante: String(fila.numero),
      fecha: fila.fecha,
      cuentaId: fila.cuenta_id,
      cuenta: primerRelacion(fila.cuenta)?.nombre ?? "—",
      contactoId: fila.contacto_id,
      contactoNombre: primerRelacion(fila.contacto)?.nombre ?? null,
      detalle: factura?.ncf ? `Facturas: ${factura.ncf}` : "Pago recibido",
      entradas: centavos(fila.monto),
      salidas: 0,
      estado: fila.estado,
    },
  };
}

function movimientoPagoProveedor(fila: PagoProveedorCrudo): MovimientoOrdenado {
  const factura = primerRelacion(fila.factura);

  return {
    creadoEn: fila.creado_en,
    movimiento: {
      id: fila.id,
      origen: "pago_proveedor",
      comprobante: String(fila.numero),
      fecha: fila.fecha,
      cuentaId: fila.cuenta_id,
      cuenta: primerRelacion(fila.cuenta)?.nombre ?? "—",
      contactoId: fila.contacto_id,
      contactoNombre: primerRelacion(fila.contacto)?.nombre ?? null,
      detalle: factura?.ncf ? `Facturas de proveedor: ${factura.ncf}` : "Pago a proveedor",
      entradas: 0,
      salidas: centavos(fila.monto),
      estado: fila.estado,
    },
  };
}

function ordenarMovimientos(ordenados: MovimientoOrdenado[]): MovimientoTransaccion[] {
  return ordenados
    .sort(
      (a, b) =>
        b.movimiento.fecha.localeCompare(a.movimiento.fecha) ||
        b.creadoEn.localeCompare(a.creadoEn) ||
        b.movimiento.comprobante.localeCompare(a.movimiento.comprobante),
    )
    .map((fila) => fila.movimiento);
}

export async function obtenerTransacciones(desde: string, hasta: string): Promise<ResultadoTransacciones> {
  const supabase = await cliente();
  const [pagosRecibidos, pagosProveedor, gastos] = await Promise.all([
    supabase
      .from("pagos_recibidos")
      .select(
        "id, numero, fecha, monto, estado, contacto_id, cuenta_id, creado_en, cuenta:cuentas(nombre), contacto:contactos(nombre), factura:facturas(ncf)",
      )
      .eq("estado", "activo")
      .gte("fecha", desde)
      .lte("fecha", hasta),
    supabase
      .from("pagos_proveedor")
      .select(
        "id, numero, fecha, monto, estado, contacto_id, cuenta_id, creado_en, cuenta:cuentas(nombre), contacto:contactos(nombre), factura:facturas_proveedor(ncf)",
      )
      .eq("estado", "activo")
      .gte("fecha", desde)
      .lte("fecha", hasta),
    supabase
      .from("gastos_menores")
      .select(
        "id, numero, ncf, fecha, descripcion, total, estado, contacto_id, cuenta_id, creado_en, cuenta:cuentas!gastos_menores_cuenta_pago_id_fkey(nombre), contacto:contactos(nombre)",
      )
      .eq("estado", "activo")
      .gte("fecha", desde)
      .lte("fecha", hasta),
  ]);

  const ordenados: MovimientoOrdenado[] = [
    ...((gastos.data ?? []) as unknown as GastoMenorCrudo[]).map(movimientoGasto),
    ...((pagosRecibidos.data ?? []) as unknown as PagoRecibidoCrudo[]).map(movimientoPagoRecibido),
    ...((pagosProveedor.data ?? []) as unknown as PagoProveedorCrudo[]).map(movimientoPagoProveedor),
  ];

  return {
    movimientos: ordenarMovimientos(ordenados),
    error: pagosRecibidos.error?.message ?? pagosProveedor.error?.message ?? gastos.error?.message ?? null,
  };
}

interface FacturaAnualCruda {
  fecha: string;
  subtotal: number | string | null;
}

interface LineaAnualCruda {
  producto_id: string | null;
  descripcion: string | null;
  subtotal: number | string | null;
  producto: Relacion<{ nombre: string | null }>;
}

interface FacturaClienteCruda {
  contacto_id: string;
  subtotal: number | string | null;
  contacto: Relacion<{ nombre: string }>;
}

export interface DatosAnualConsultados {
  estado: FilaEstadoResultados[];
  estadoAnterior: FilaEstadoResultados[];
  ventas: VentaFecha[];
  ventasAnterior: VentaFecha[];
  productos: ItemRankingAnual[];
  clientes: ItemRankingAnual[];
  gastos: ItemRankingAnual[];
}

export interface ResultadoAnual {
  datos: DatosAnualConsultados;
  error: string | null;
}

export async function obtenerDatosReporteAnual(anio: number): Promise<ResultadoAnual> {
  const supabase = await cliente();
  const desde = `${anio}-01-01`;
  const hasta = `${anio}-12-31`;
  const desdeAnterior = `${anio - 1}-01-01`;
  const hastaAnterior = `${anio - 1}-12-31`;

  const [estado, estadoAnterior, ventas, ventasAnterior, lineas, facturasClientes] = await Promise.all([
    supabase.rpc("reporte_estado_resultados", { p_desde: desde, p_hasta: hasta }),
    supabase.rpc("reporte_estado_resultados", { p_desde: desdeAnterior, p_hasta: hastaAnterior }),
    supabase
      .from("facturas")
      .select("fecha, subtotal")
      .neq("estado", "anulada")
      .gte("fecha", desde)
      .lte("fecha", hasta),
    supabase
      .from("facturas")
      .select("fecha, subtotal")
      .neq("estado", "anulada")
      .gte("fecha", desdeAnterior)
      .lte("fecha", hastaAnterior),
    supabase
      .from("factura_lineas")
      .select("producto_id, descripcion, subtotal, factura:facturas!inner(fecha, estado), producto:productos(nombre)")
      .neq("factura.estado", "anulada")
      .gte("factura.fecha", desde)
      .lte("factura.fecha", hasta),
    supabase
      .from("facturas")
      .select("contacto_id, subtotal, contacto:contactos(nombre)")
      .neq("estado", "anulada")
      .gte("fecha", desde)
      .lte("fecha", hasta),
  ]);

  const filasEstado = (estado.data ?? []) as unknown as FilaEstadoResultados[];
  const filasAnterior = (estadoAnterior.data ?? []) as unknown as FilaEstadoResultados[];

  const productos = ((lineas.data ?? []) as unknown as LineaAnualCruda[]).map<ItemRankingAnual>((linea) => {
    const producto = primerRelacion(linea.producto);
    return {
      id: linea.producto_id,
      nombre: producto?.nombre?.trim() || linea.descripcion?.trim() || "Sin descripción",
      monto: linea.subtotal,
    };
  });

  const clientes = ((facturasClientes.data ?? []) as unknown as FacturaClienteCruda[]).map<ItemRankingAnual>(
    (factura) => ({
      id: factura.contacto_id,
      nombre: primerRelacion(factura.contacto)?.nombre ?? "Sin nombre",
      monto: factura.subtotal,
    }),
  );

  return {
    datos: {
      estado: filasEstado,
      estadoAnterior: filasAnterior,
      ventas: ((ventas.data ?? []) as unknown as FacturaAnualCruda[]).map((fila) => ({
        fecha: fila.fecha,
        monto: fila.subtotal,
      })),
      ventasAnterior: ((ventasAnterior.data ?? []) as unknown as FacturaAnualCruda[]).map((fila) => ({
        fecha: fila.fecha,
        monto: fila.subtotal,
      })),
      productos,
      clientes,
      gastos: filasEstado
        .filter((fila) => fila.tipo === "gasto")
        .map((fila) => ({ id: fila.cuenta_codigo, nombre: fila.cuenta_nombre, monto: fila.monto })),
    },
    error:
      estado.error?.message ??
      estadoAnterior.error?.message ??
      ventas.error?.message ??
      ventasAnterior.error?.message ??
      lineas.error?.message ??
      facturasClientes.error?.message ??
      null,
  };
}

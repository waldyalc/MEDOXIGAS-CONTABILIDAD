import { cache } from "react";

import { centavos } from "@/lib/reportes/dinero";
import { periodoAnterior } from "@/lib/reportes/estados/fechas";
import { consultarEnLotes } from "@/lib/supabase/lotes";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

import {
  agruparFlujo,
  agruparGastos,
  agruparTopClientes,
  agruparTopProductos,
  type DistribucionGastos,
  type FlujoTransacciones,
  type LineaMovimiento,
  type TopCliente,
  type TopProducto,
} from "./calculos";

export interface GrupoCartera {
  monto: number;
  documentos: number;
}

export interface CarteraResumen {
  total: number;
  vigentes: GrupoCartera;
  vencidas: GrupoCartera;
}

export interface PuntoSerieVentas {
  etiqueta: string;
  actual: number;
  anterior: number;
}

export interface VentasResumen {
  total: number;
  anterior: number;
  variacion: number | null;
  serie: PuntoSerieVentas[];
}

export interface ResumenNegocio {
  desde: string;
  hasta: string;
  es_diario: boolean;
  cxc: CarteraResumen;
  cxp: CarteraResumen;
  impuestos_venta: number;
  productos_vendidos: number;
  devoluciones_clientes: number;
  clientes_con_ventas: number;
  ventas: VentasResumen;
}

export interface RespuestaResumen {
  resumen: ResumenNegocio | null;
  error: string | null;
}

/**
 * Una sola llamada a `dashboard_resumen` por request: `cache()` la comparte
 * entre las tarjetas y la gráfica aunque cada bloque tenga su propio Suspense.
 */
export const obtenerResumenNegocio = cache(async (desde: string, hasta: string): Promise<RespuestaResumen> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_resumen", { p_desde: desde, p_hasta: hasta });

  if (error) return { resumen: null, error: error.message };
  return { resumen: data as unknown as ResumenNegocio, error: null };
});

export interface DatosWidgets {
  flujo: FlujoTransacciones;
  gastos: DistribucionGastos;
}

export interface RespuestaWidgets {
  datos: DatosWidgets | null;
  error: string | null;
}

interface CuentaWidget {
  id: string;
  nombre: string;
  tipo: string;
  es_caja_banco: boolean;
}

interface AsientoFecha {
  id: string;
  fecha: string;
}

interface LineaWidget {
  asiento_id: string;
  cuenta_id: string;
  debito: number | string | null;
  credito: number | string | null;
}

/**
 * Flujo de transacciones (entradas/salidas de caja y banco por día) y
 * distribución de gastos (top 5 de cuentas de gasto) en una sola pasada.
 *
 * La comparación del flujo es contra el período inmediato anterior del mismo
 * largo. Se lee en dos pasos indexados — asientos por fecha y luego sus
 * líneas — como `getIngresosGastosMensual` de bancos: filtrar la fecha desde
 * `asiento_lineas` recorre el histórico completo y agota el timeout.
 */
export const obtenerDatosWidgets = cache(async (desde: string, hasta: string): Promise<RespuestaWidgets> => {
  const supabase = await createClient();
  const anterior = periodoAnterior(desde, hasta);

  const { data: cuentas, error: errorCuentas } = await supabase
    .from("cuentas")
    .select("id, nombre, tipo, es_caja_banco")
    .order("codigo")
    .returns<CuentaWidget[]>();

  if (errorCuentas) return { datos: null, error: errorCuentas.message };

  const idsCajaBanco = new Set<string>();
  const idsGasto = new Set<string>();
  const nombrePorCuenta = new Map<string, string>();
  for (const cuenta of cuentas ?? []) {
    nombrePorCuenta.set(cuenta.id, cuenta.nombre);
    if (cuenta.es_caja_banco) idsCajaBanco.add(cuenta.id);
    if (cuenta.tipo === "gasto") idsGasto.add(cuenta.id);
  }

  const idsRelevantes = [...idsCajaBanco, ...idsGasto];
  if (idsRelevantes.length === 0) {
    return {
      datos: {
        flujo: { puntos: [], totalIngresos: 0, totalEgresos: 0, variacionIngresos: null, variacionEgresos: null },
        gastos: { items: [], total: 0 },
      },
      error: null,
    };
  }

  // Un solo rango cubre el período y el anterior; cada línea se reparte por fecha.
  const { data: asientos, error: errorAsientos } = await paginarConsulta((inicio, fin) =>
    supabase
      .from("asientos")
      .select("id, fecha")
      .gte("fecha", anterior.desde)
      .lte("fecha", hasta)
      .neq("origen_tipo", "transferencia")
      .order("fecha", { ascending: true })
      .order("id", { ascending: true })
      .range(inicio, fin)
      .returns<AsientoFecha[]>(),
  );

  if (errorAsientos) return { datos: null, error: errorAsientos.message };

  const fechaPorAsiento = new Map((asientos ?? []).map((asiento) => [asiento.id, asiento.fecha]));

  const { data: filas, error: errorLineas } = await consultarEnLotes([...fechaPorAsiento.keys()], (lote) =>
    paginarConsulta((inicio, fin) =>
      supabase
        .from("asiento_lineas")
        .select("asiento_id, cuenta_id, debito, credito")
        .in("asiento_id", lote)
        .in("cuenta_id", idsRelevantes)
        .order("id")
        .range(inicio, fin)
        .returns<LineaWidget[]>(),
    ),
  );

  if (errorLineas) return { datos: null, error: errorLineas.message };

  const lineas: LineaMovimiento[] = (filas ?? []).map((fila) => ({
    asientoId: fila.asiento_id,
    cuentaId: fila.cuenta_id,
    debito: centavos(fila.debito),
    credito: centavos(fila.credito),
  }));

  return {
    datos: {
      flujo: agruparFlujo(lineas, fechaPorAsiento, idsCajaBanco, anterior.hasta),
      gastos: agruparGastos(lineas, fechaPorAsiento, idsGasto, nombrePorCuenta, anterior.hasta),
    },
    error: null,
  };
});

export interface TopVentas {
  productos: TopProducto[];
  clientes: TopCliente[];
}

export interface RespuestaTopVentas {
  top: TopVentas | null;
  error: string | null;
}

interface FacturaTopFila {
  id: string;
  contacto_id: string;
  total: number | string | null;
  contactos: { nombre: string } | null;
}

interface LineaTopFila {
  factura_id: string;
  producto_id: string | null;
  descripcion: string;
  cantidad: number | string | null;
  total: number | string | null;
  productos: { nombre: string; referencia: string | null } | null;
}

/**
 * Top 5 de productos y de clientes del período: mismas facturas que la
 * gráfica de ventas (no anuladas, totales con impuestos incluidos).
 */
export const obtenerTopVentas = cache(async (desde: string, hasta: string): Promise<RespuestaTopVentas> => {
  const supabase = await createClient();

  const { data: facturas, error: errorFacturas } = await paginarConsulta((inicio, fin) =>
    supabase
      .from("facturas")
      .select("id, contacto_id, total, contactos(nombre)")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .neq("estado", "anulada")
      .order("fecha", { ascending: true })
      .order("id", { ascending: true })
      .range(inicio, fin)
      .returns<FacturaTopFila[]>(),
  );

  if (errorFacturas) return { top: null, error: errorFacturas.message };

  const clientes = agruparTopClientes(
    (facturas ?? []).map((factura) => ({
      contactoId: factura.contacto_id,
      total: centavos(factura.total),
      nombreContacto: factura.contactos?.nombre ?? "Cliente",
    })),
  );

  const ids = (facturas ?? []).map((factura) => factura.id);
  if (ids.length === 0) return { top: { productos: [], clientes }, error: null };

  const { data: filas, error: errorLineas } = await consultarEnLotes(ids, (lote) =>
    paginarConsulta((inicio, fin) =>
      supabase
        .from("factura_lineas")
        .select("factura_id, producto_id, descripcion, cantidad, total, productos(nombre, referencia)")
        .in("factura_id", lote)
        .order("id")
        .range(inicio, fin)
        .returns<LineaTopFila[]>(),
    ),
  );

  if (errorLineas) return { top: null, error: errorLineas.message };

  const productos = agruparTopProductos(
    (filas ?? []).map((fila) => ({
      productoId: fila.producto_id,
      descripcion: fila.descripcion,
      cantidad: Number(fila.cantidad ?? 0),
      total: centavos(fila.total),
      nombreProducto: fila.productos?.nombre ?? null,
      referenciaProducto: fila.productos?.referencia ?? null,
    })),
  );

  return { top: { productos, clientes }, error: null };
});

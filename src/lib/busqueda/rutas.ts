/**
 * Ruta de cada resultado de búsqueda (docs/busqueda-global.md §2.1).
 *
 * Regla de oro: la RPC devuelve `entidad` + `id` y el SQL nunca devuelve URLs.
 * La traducción vive aquí, encima de `src/lib/enlaces.ts`, para arreglar una
 * ruta en un solo lugar. El `Record` completo es el candado: si mañana se
 * agrega una entidad a `EntidadBusqueda`, TypeScript obliga a darle ruta.
 */

import {
  rutaAsiento,
  rutaCompra,
  rutaConduce,
  rutaContacto,
  rutaCotizacion,
  rutaCuenta,
  rutaFactura,
  rutaFacturaRecurrente,
  rutaGasto,
  rutaNotaCreditoCompra,
  rutaNotaCreditoVenta,
  rutaNotaDebitoVenta,
  rutaOrdenCompra,
  rutaPagoProveedor,
  rutaPagoRecibido,
  rutaProducto,
} from "@/lib/enlaces";

import type { EntidadBusqueda } from "./tipos";

/**
 * Ruta por entidad. `reporte` y `navegacion` no tienen función: su `id` ya es
 * la URL (el `href` del catálogo de reportes o del menú). `documento` llega
 * con los contratos en la fase 4.
 */
const RUTAS: Record<EntidadBusqueda, ((id: string) => string) | null> = {
  contacto: rutaContacto,
  producto: rutaProducto,
  factura: rutaFactura,
  nota_credito_venta: rutaNotaCreditoVenta,
  nota_debito_venta: rutaNotaDebitoVenta,
  cotizacion: rutaCotizacion,
  remision: rutaConduce,
  factura_recurrente: rutaFacturaRecurrente,
  pago_recibido: rutaPagoRecibido,
  factura_proveedor: rutaCompra,
  nota_credito_compra: rutaNotaCreditoCompra,
  orden_compra: rutaOrdenCompra,
  pago_proveedor: rutaPagoProveedor,
  gasto_menor: rutaGasto,
  asiento: rutaAsiento,
  cuenta: rutaCuenta,
  reporte: null,
  navegacion: null,
  documento: null,
};

/** Mínimo resultado necesario para construir su ruta. */
export interface ResultadoConRuta {
  entidad: EntidadBusqueda;
  id: string;
}

/**
 * Ruta de un resultado, o `null` si la entidad aún no tiene (`documento`,
 * fase 4). Para `reporte` y `navegacion` devuelve la URL que ya viene como
 * `id`; el id vacío se trata como «sin ruta» para no enlazar a "".
 */
export function rutaDeResultado(resultado: ResultadoConRuta): string | null {
  const construir = RUTAS[resultado.entidad];
  if (construir != null) return construir(resultado.id);
  if (resultado.entidad === "documento") return null;
  return resultado.id.length > 0 ? resultado.id : null;
}

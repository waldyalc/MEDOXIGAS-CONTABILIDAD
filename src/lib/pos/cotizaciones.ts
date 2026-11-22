import type { DocumentoVista } from "@/lib/cotizaciones/tipos";

import { centavosATexto } from "./calculo";
import type { Decimal } from "./tipos";

/**
 * Puente entre el carrito del POS y las cotizaciones: arma el payload de
 * `crearCotizacionPOS` y traduce una cotización abierta a las líneas que
 * entiende `aplicarCotizacion`. Sin esto, la UI guardaba y cargaba con dos
 * mapeos copiados a mano que podían separarse del contrato de la RPC.
 */

export interface LineaParaCotizacion {
  productoId: string | null;
  descripcion: string;
  cantidad: Decimal;
  unidadId: string | null;
  precio: Decimal;
  descuentoPct: Decimal;
  itbisTasa: Decimal;
  impuestoId: string | null;
}

export interface PestanaParaCotizacion {
  contactoId: string;
  listaPrecioId: string;
  vendedorId: string;
  lineas: readonly LineaParaCotizacion[];
}

export interface PayloadCotizacionPOS {
  terminal_id: string;
  contacto_id: string | null;
  lista_precio_id: string | null;
  fecha: string;
  vencimiento: string;
  vendedor_id: string | null;
  lineas: {
    producto_id: string | null;
    descripcion: string;
    cantidad: Decimal;
    unidad_id: string | null;
    precio: Decimal;
    descuento_pct: Decimal;
    itbis_tasa: Decimal;
    impuesto_id: string | null;
  }[];
}

/** Payload de «Guardar como cotización»: cliente, lista, líneas, precios, descuentos e impuestos. */
export function payloadCotizacionPOS({
  terminalId,
  fecha,
  vencimiento,
  pestana,
}: {
  terminalId: string;
  fecha: string;
  vencimiento: string;
  pestana: PestanaParaCotizacion;
}): PayloadCotizacionPOS {
  return {
    terminal_id: terminalId,
    contacto_id: pestana.contactoId || null,
    lista_precio_id: pestana.listaPrecioId || null,
    fecha,
    vencimiento,
    vendedor_id: pestana.vendedorId || null,
    lineas: pestana.lineas.map((linea) => ({
      producto_id: linea.productoId,
      descripcion: linea.descripcion,
      cantidad: linea.cantidad,
      unidad_id: linea.unidadId,
      precio: linea.precio,
      descuento_pct: linea.descuentoPct,
      itbis_tasa: linea.itbisTasa,
      impuesto_id: linea.impuestoId,
    })),
  };
}

export interface LineaDeCotizacion {
  productoId: string | null;
  descripcion: string;
  referencia: string | null;
  cantidad: Decimal;
  unidadId: string | null;
  unidadNombre: string | null;
  precio: Decimal;
  descuentoPct: Decimal;
  itbisTasa: Decimal;
}

function decimalDe(valor: number): string {
  return centavosATexto(Math.round(valor * 100));
}

/** Líneas de una cotización abierta listas para `carrito.aplicarCotizacion`. */
export function lineasDeCotizacionPOS(vista: Pick<DocumentoVista, "lineas">): LineaDeCotizacion[] {
  return vista.lineas.map((linea) => ({
    productoId: linea.producto_id,
    descripcion: linea.descripcion,
    referencia: null,
    cantidad: decimalDe(linea.cantidad),
    unidadId: null,
    unidadNombre: null,
    precio: decimalDe(linea.precio),
    descuentoPct: decimalDe(linea.descuento_pct),
    itbisTasa: decimalDe(linea.itbis_tasa),
  }));
}

/** Enlace al detalle de la cotización en Contabilidad (toast y ficha de factura). */
export function enlaceCotizacionPOS(id: string): string {
  return `/dashboard/cotizaciones/${id}`;
}

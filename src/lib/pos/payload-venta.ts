import type { VentaEntrada } from "./esquemas";

/**
 * Payload de `pos_completar_venta`. Puro y compartido: la server action lo usa
 * online y la cola offline lo reconstruye al sincronizar, para que la venta
 * cobrada en el dispositivo llegue al servidor con los mismos datos.
 */
export function payloadLineasVenta(lineas: NonNullable<VentaEntrada["lineas"]>) {
  return lineas.map((linea) => ({
    producto_id: linea.producto_id ?? null,
    cantidad: linea.cantidad,
    descuento_pct: linea.descuento_pct,
    ...(linea.descripcion ? { descripcion: linea.descripcion } : {}),
    ...(linea.unidad_id ? { unidad_id: linea.unidad_id } : {}),
    ...(linea.precio !== undefined ? { precio: linea.precio } : {}),
    ...(linea.itbis_tasa !== undefined ? { itbis_tasa: linea.itbis_tasa } : {}),
    ...(linea.impuesto_id ? { impuesto_id: linea.impuesto_id } : {}),
  }));
}

export function payloadPagosVenta(pagos: VentaEntrada["pagos"]) {
  return pagos.map((pago) => ({
    metodo: pago.metodo,
    monto: pago.monto,
    ...(pago.cuenta_id ? { cuenta_id: pago.cuenta_id } : {}),
    ...(pago.metodo === "efectivo" && pago.monto_recibido !== undefined ? { monto_recibido: pago.monto_recibido } : {}),
    ...(pago.notas ? { notas: pago.notas } : {}),
  }));
}

export function payloadFuenteVenta(datos: {
  lineas?: VentaEntrada["lineas"];
  venta_simple?: VentaEntrada["venta_simple"];
  cotizacion_id?: string | null;
}) {
  return {
    ...(datos.cotizacion_id ? { cotizacion_id: datos.cotizacion_id } : {}),
    ...(datos.venta_simple
      ? {
          venta_simple: {
            descripcion: datos.venta_simple.descripcion,
            monto: datos.venta_simple.monto,
            ...(datos.venta_simple.itbis_tasa !== undefined ? { itbis_tasa: datos.venta_simple.itbis_tasa } : {}),
          },
        }
      : {}),
    ...(datos.lineas && !datos.cotizacion_id && !datos.venta_simple
      ? { lineas: payloadLineasVenta(datos.lineas) }
      : {}),
  };
}

export function payloadVentaCompleta(datos: VentaEntrada) {
  return {
    terminal_id: datos.terminal_id,
    pagos: payloadPagosVenta(datos.pagos),
    ...payloadFuenteVenta(datos),
    ...(datos.contacto_id ? { contacto_id: datos.contacto_id } : {}),
    ...(datos.lista_precio_id ? { lista_precio_id: datos.lista_precio_id } : {}),
    ...(datos.numeracion_id ? { numeracion_id: datos.numeracion_id } : {}),
    ...(datos.tipo_comprobante ? { tipo_comprobante: datos.tipo_comprobante } : {}),
    ...(datos.fecha ? { fecha: datos.fecha } : {}),
    ...(datos.vencimiento ? { vencimiento: datos.vencimiento } : {}),
    ...(datos.vendedor_id ? { vendedor_id: datos.vendedor_id } : {}),
    ...(datos.notas ? { notas: datos.notas } : {}),
    ...(datos.terminos ? { terminos: datos.terminos } : {}),
    ...(datos.pie ? { pie: datos.pie } : {}),
  };
}

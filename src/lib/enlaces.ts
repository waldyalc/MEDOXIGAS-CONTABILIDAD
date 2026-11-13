function ruta(base: string, id: string) {
  return `${base}/${encodeURIComponent(id)}`;
}

export function rutaContacto(id: string) {
  return ruta("/dashboard/contactos", id);
}

export function rutaProducto(id: string) {
  return ruta("/dashboard/productos", id);
}

export function rutaFactura(id: string) {
  return ruta("/dashboard/facturacion", id);
}

export function rutaNotaCreditoVenta(id: string) {
  return ruta("/dashboard/notas-credito", id);
}

export function rutaNotaDebitoVenta(id: string) {
  return ruta("/dashboard/notas-debito", id);
}

export function rutaFacturaRecurrente(id: string) {
  return ruta("/dashboard/facturas-recurrentes", id);
}

export function rutaCompra(id: string) {
  return ruta("/dashboard/compras", id);
}

export function rutaNotaCreditoCompra(id: string) {
  return ruta("/dashboard/compras/notas-credito", id);
}

export function rutaOrdenCompra(id: string) {
  return ruta("/dashboard/ordenes-compra", id);
}

export function rutaPagoRecurrente(id: string) {
  return ruta("/dashboard/pagos-recurrentes", id);
}

export function rutaCotizacion(id: string) {
  return ruta("/dashboard/cotizaciones", id);
}

export function rutaConduce(id: string) {
  return ruta("/dashboard/conduces", id);
}

export function rutaPagoRecibido(id: string) {
  return ruta("/dashboard/pagos-recibidos", id);
}

export function rutaPagoProveedor(id: string) {
  return ruta("/dashboard/compras/pagos", id);
}

export function rutaGasto(id: string) {
  return ruta("/dashboard/gastos", id);
}

export function rutaAsiento(id: string) {
  return ruta("/dashboard/contabilidad/asientos", id);
}

export function rutaCuenta(id: string) {
  return ruta("/dashboard/contabilidad/cuentas", id);
}

export function rutaBanco(id: string) {
  return ruta("/dashboard/bancos", id);
}

export function rutaTransferencia(id: string) {
  return ruta("/dashboard/bancos/transferencias", id);
}

export function rutaConciliacion(id: string) {
  return ruta("/dashboard/bancos/conciliaciones", id);
}

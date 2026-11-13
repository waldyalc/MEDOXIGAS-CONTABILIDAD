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

export function rutaCompra(id: string) {
  return ruta("/dashboard/compras", id);
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

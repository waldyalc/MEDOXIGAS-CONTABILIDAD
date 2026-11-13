export const enlaces = {
  contacto: (id: string) => `/dashboard/contactos/${id}`,
  producto: (id: string) => `/dashboard/productos/${id}`,
  facturaVenta: (id: string) => `/dashboard/facturacion/${id}`,
  facturaProveedor: (id: string) => `/dashboard/compras/${id}`,
  pagoProveedor: (id: string) => `/dashboard/compras/pagos/${id}`,
  pagoRecibido: (id: string) => `/dashboard/pagos-recibidos/${id}`,
  gastoMenor: (id: string) => `/dashboard/gastos/${id}`,
  cuentaContable: (codigo: string, desde: string, hasta: string) => {
    const parametros = new URLSearchParams({ cuenta: codigo, desde, hasta });
    return `/dashboard/reportes/movimientos-cuenta?${parametros.toString()}`;
  },
};

interface ParametrosVentas {
  desde: string;
  hasta: string;
  q?: string;
  pagina?: number;
}

interface ParametrosEstadoCuenta {
  cliente: string;
  corte: string;
  vencimiento?: string;
  documento?: string;
}

export function urlVentasCliente({ desde, hasta, q, pagina }: ParametrosVentas): string {
  const params = new URLSearchParams({ desde, hasta });
  if (q != null && q !== "") params.set("q", q);
  if (pagina != null && pagina > 1) params.set("pagina", String(pagina));
  return `/dashboard/reportes/ventas-cliente?${params.toString()}`;
}

export function urlVentasVendedor({ desde, hasta, q, pagina }: ParametrosVentas): string {
  const params = new URLSearchParams({ desde, hasta });
  if (q != null && q !== "") params.set("q", q);
  if (pagina != null && pagina > 1) params.set("pagina", String(pagina));
  return `/dashboard/reportes/ventas-vendedor?${params.toString()}`;
}

export function urlEstadoCuentaCliente({ cliente, corte, vencimiento, documento }: ParametrosEstadoCuenta): string {
  const params = new URLSearchParams({ cliente, corte });
  if (vencimiento != null && vencimiento !== "" && vencimiento !== "todas") params.set("vencimiento", vencimiento);
  if (documento != null && documento !== "") params.set("documento", documento);
  return `/dashboard/reportes/estado-cuenta-cliente?${params.toString()}`;
}

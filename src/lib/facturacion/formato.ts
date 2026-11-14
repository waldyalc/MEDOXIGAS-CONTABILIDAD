const dinero = new Intl.NumberFormat("es-DO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const cantidad = new Intl.NumberFormat("es-DO", {
  maximumFractionDigits: 2,
});

export function aNumero(valor: number | string | null | undefined): number {
  if (valor == null) return 0;
  const numero = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

export function formatoMoneda(valor: number | string | null | undefined): string {
  if (valor == null) return "—";
  const numero = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(numero)) return "—";
  return `RD$ ${dinero.format(numero)}`;
}

export function formatoMonedaCentavos(centavos: number): string {
  return formatoMoneda(centavos / 100);
}

export function formatoCantidad(valor: number | string | null | undefined): string {
  if (valor == null) return "—";
  const numero = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(numero)) return "—";
  return cantidad.format(numero);
}

export function saldoDeFactura(
  total: number | string | null | undefined,
  pagado: number | string | null | undefined,
  credito: number | string | null | undefined = 0,
  retenido: number | string | null | undefined = 0,
): number {
  return Math.max(0, aNumero(total) - aNumero(pagado) - aNumero(credito) - aNumero(retenido));
}

export function hoyRD(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

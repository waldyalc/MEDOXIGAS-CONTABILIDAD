const FORMATO_RD = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MONTO = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

/** Convierte un monto de la base (numeric) a centavos enteros. */
export function centavos(valor: number | string | null | undefined): number {
  if (valor == null) return 0;

  if (typeof valor === "number") {
    return Number.isFinite(valor) ? Math.round(valor * 100) : 0;
  }

  const coincidencia = MONTO.exec(valor.trim().replace(/,/g, ""));
  if (!coincidencia) return 0;

  const signo = coincidencia[1] === "-" ? -1 : 1;
  const entero = Number(coincidencia[2] ?? "0");
  const decimales = Number((coincidencia[3] ?? "").padEnd(2, "0"));

  return signo * (entero * 100 + decimales);
}

export function sumarCentavos(valores: readonly (number | string | null | undefined)[]): number {
  return valores.reduce<number>((total, valor) => total + centavos(valor), 0);
}

/** Formatea centavos enteros como RD$ con 2 decimales. */
export function formatearRd(valorCentavos: number): string {
  return FORMATO_RD.format(valorCentavos / 100);
}

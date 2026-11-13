import { aNumero } from "./calculo";

const moneda = new Intl.NumberFormat("es-DO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const cantidad = new Intl.NumberFormat("es-DO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatoMoneda(valor: string | number | null | undefined): string {
  return `RD$ ${moneda.format(aNumero(valor))}`;
}

export function formatoCantidad(valor: string | number | null | undefined): string {
  return cantidad.format(aNumero(valor));
}

export function formatoTasa(valor: string | number | null | undefined): string {
  return `${formatoCantidad(valor)} %`;
}

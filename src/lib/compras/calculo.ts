export interface EntradaLineaCalculo {
  cantidad: string | number | null | undefined;
  costo: string | number | null | undefined;
  itbisTasa: string | number | null | undefined;
}

export interface TotalesLinea {
  subtotalCentavos: number;
  itbisCentavos: number;
  totalCentavos: number;
}

export interface TotalesDocumento {
  subtotalCentavos: number;
  itbisCentavos: number;
  totalCentavos: number;
}

function normalizarNumero(texto: string) {
  const limpio = texto.replace(/\s/g, "");
  if (limpio.includes(",") && limpio.includes(".")) return limpio.replace(/,/g, "");
  return limpio.replace(",", ".");
}

export function aNumero(valor: string | number | null | undefined): number {
  if (valor == null) return 0;
  const numero = typeof valor === "number" ? valor : Number(normalizarNumero(valor));
  return Number.isFinite(numero) ? numero : 0;
}

export function aCentavos(valor: string | number | null | undefined): number {
  return Math.round(aNumero(valor) * 100);
}

export function desdeCentavos(centavos: number): number {
  return centavos / 100;
}

export function calcularLinea(linea: EntradaLineaCalculo): TotalesLinea {
  const cantidadCentavos = aCentavos(linea.cantidad);
  const costoCentavos = aCentavos(linea.costo);
  const tasaCentavos = aCentavos(linea.itbisTasa);

  const subtotalCentavos = Math.round((cantidadCentavos * costoCentavos) / 100);
  const itbisCentavos = Math.round((subtotalCentavos * tasaCentavos) / 10000);

  return {
    subtotalCentavos,
    itbisCentavos,
    totalCentavos: subtotalCentavos + itbisCentavos,
  };
}

export function calcularTotales(lineas: readonly EntradaLineaCalculo[]): TotalesDocumento {
  return lineas.reduce<TotalesDocumento>(
    (totales, linea) => {
      const calculo = calcularLinea(linea);
      return {
        subtotalCentavos: totales.subtotalCentavos + calculo.subtotalCentavos,
        itbisCentavos: totales.itbisCentavos + calculo.itbisCentavos,
        totalCentavos: totales.totalCentavos + calculo.totalCentavos,
      };
    },
    { subtotalCentavos: 0, itbisCentavos: 0, totalCentavos: 0 },
  );
}

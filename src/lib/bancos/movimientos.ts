import { valorACentavos } from "@/lib/facturacion/calculo";

export interface DocumentoVinculado {
  etiqueta: string;
  href: string | null;
}

export interface TerceroVinculado {
  id: string;
  nombre: string;
}

export interface LineaBanco {
  id: string;
  asientoId: string;
  asientoNumero: number;
  fecha: string;
  descripcion: string | null;
  debito: number;
  credito: number;
  documento: DocumentoVinculado;
  tercero: TerceroVinculado | null;
}

export interface MovimientoBanco {
  id: string;
  asientoId: string;
  asientoNumero: number;
  fecha: string;
  descripcion: string | null;
  documento: DocumentoVinculado;
  tercero: TerceroVinculado | null;
  entradaCentavos: number;
  salidaCentavos: number;
  saldoCentavos: number;
}

export interface MovimientosBancoCalculados {
  movimientos: MovimientoBanco[];
  saldoCentavos: number;
  totalEntradasCentavos: number;
  totalSalidasCentavos: number;
}

/**
 * Convierte líneas de una cuenta de caja/banco en movimientos con saldo
 * acumulado. Las líneas deben venir ordenadas por fecha y número de asiento.
 * El saldo arrastra los movimientos anteriores a `desde`, igual que el estado
 * de cuenta contable.
 */
export function calcularMovimientosBanco(
  lineas: readonly LineaBanco[],
  desde?: string,
  hasta?: string,
): MovimientosBancoCalculados {
  const movimientos: MovimientoBanco[] = [];
  let saldoCentavos = 0;
  let totalEntradasCentavos = 0;
  let totalSalidasCentavos = 0;

  for (const linea of lineas) {
    if (hasta != null && linea.fecha > hasta) continue;

    const entradaCentavos = valorACentavos(linea.debito);
    const salidaCentavos = valorACentavos(linea.credito);
    saldoCentavos += entradaCentavos - salidaCentavos;

    if (desde != null && linea.fecha < desde) continue;

    totalEntradasCentavos += entradaCentavos;
    totalSalidasCentavos += salidaCentavos;
    movimientos.push({
      id: linea.id,
      asientoId: linea.asientoId,
      asientoNumero: linea.asientoNumero,
      fecha: linea.fecha,
      descripcion: linea.descripcion,
      documento: linea.documento,
      tercero: linea.tercero,
      entradaCentavos,
      salidaCentavos,
      saldoCentavos,
    });
  }

  return { movimientos, saldoCentavos, totalEntradasCentavos, totalSalidasCentavos };
}

import type { EscalaIsrTramo, ParametrosRD } from "@/lib/nomina/tipos";
import { parsearMonto } from "@/lib/productos/productos";

/**
 * Escala de ISR anual de la configuración de nómina.
 *
 * `desde` y `monto_fijo` no se capturan: se derivan del tramo anterior cada vez
 * que se edita un `hasta` o una `tasa`. Es configuración tributaria, no el
 * cálculo de un recibo; la RPC vuelve a validar huecos, solapes y el acumulado.
 */

export interface TramoForm {
  hasta: string;
  tasa: string;
}

export function formatearDecimal(valor: string | null | undefined, decimales: number): string {
  if (valor === null || valor === undefined || valor === "") return "";
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toFixed(decimales) : "";
}

export function numero(valor: string): number {
  const leido = parsearMonto(valor);
  return leido ?? 0;
}

/** Cuatro filas fijas de la fase 1; el último tramo siempre queda abierto. */
export function tramosDesde(parametros: ParametrosRD | null): TramoForm[] {
  const base = parametros?.escala_isr_anual ?? [];

  return [0, 1, 2, 3].map((indice) => {
    const tramo = base[indice];
    return {
      hasta: indice === 3 ? "" : formatearDecimal(tramo?.hasta, 2),
      tasa: formatearDecimal(tramo?.tasa, 3),
    };
  });
}

export function calcularTramos(tramos: TramoForm[]): EscalaIsrTramo[] {
  let desde = 0;
  let montoFijo = 0;

  return tramos.map((tramo, indice) => {
    const esUltimo = indice === tramos.length - 1;
    const hasta = esUltimo ? null : numero(tramo.hasta);
    const tasa = tramo.tasa.trim() === "" ? "0" : String(numero(tramo.tasa));
    const fila: EscalaIsrTramo = {
      desde: desde.toFixed(2),
      hasta: hasta === null ? null : hasta.toFixed(2),
      tasa,
      monto_fijo: montoFijo.toFixed(2),
    };

    if (hasta !== null) {
      montoFijo += (numero(tramo.tasa) / 100) * (hasta - desde);
      desde = hasta;
    }

    return fila;
  });
}

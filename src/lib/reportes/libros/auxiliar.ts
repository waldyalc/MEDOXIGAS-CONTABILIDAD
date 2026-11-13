import { centavos } from "../dinero";
import { signoNeto } from "./comun";
import type { FilaSaldoTercero } from "./tipos";

export interface FilaAuxiliarCalculada {
  clave: string;
  cuentaCodigo: string;
  cuentaNombre: string;
  tercero: string;
  saldoAnterior: number;
  debito: number;
  credito: number;
  neto: number;
  saldoFinal: number;
}

export function calcularAuxiliar(filas: readonly FilaSaldoTercero[]): FilaAuxiliarCalculada[] {
  return [...filas]
    .sort((a, b) => a.cuenta_codigo.localeCompare(b.cuenta_codigo))
    .map((fila) => {
      const saldoAnterior = centavos(fila.saldo_inicial);
      const debito = centavos(fila.debitos);
      const credito = centavos(fila.creditos);
      const neto = signoNeto(fila.cuenta_naturaleza, debito, credito);

      return {
        clave: `${fila.cuenta_id}-${fila.contacto_id ?? "sin-tercero"}`,
        cuentaCodigo: fila.cuenta_codigo,
        cuentaNombre: fila.cuenta_nombre,
        tercero: fila.tercero ?? "Sin tercero",
        saldoAnterior,
        debito,
        credito,
        neto,
        saldoFinal: saldoAnterior + neto,
      };
    });
}

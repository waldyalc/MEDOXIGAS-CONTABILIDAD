import { centavos } from "../dinero";
import { partirSaldo, signoNeto } from "./comun";
import type { FilaSaldoTercero } from "./tipos";

export interface FilaBalanzaTerceroCalculada {
  clave: string;
  cuentaId: string;
  cuentaCodigo: string;
  cuentaNombre: string;
  contactoId: string | null;
  tercero: string;
  saldoInicialDebito: number;
  saldoInicialCredito: number;
  debitos: number;
  creditos: number;
  saldoFinalDebito: number;
  saldoFinalCredito: number;
}

export interface TotalesBalanzaTercero {
  saldoInicialDebito: number;
  saldoInicialCredito: number;
  debitos: number;
  creditos: number;
  saldoFinalDebito: number;
  saldoFinalCredito: number;
}

export interface BalanzaTerceroCalculada {
  filas: FilaBalanzaTerceroCalculada[];
  totales: TotalesBalanzaTercero;
}

export function calcularBalanzaTercero(
  filas: readonly FilaSaldoTercero[],
  incluirCero: boolean,
): BalanzaTerceroCalculada {
  const calculadas = [...filas]
    .sort(
      (a, b) =>
        a.cuenta_codigo.localeCompare(b.cuenta_codigo) || (a.tercero ?? "").localeCompare(b.tercero ?? "", "es"),
    )
    .map<FilaBalanzaTerceroCalculada>((fila) => {
      const saldoInicial = centavos(fila.saldo_inicial);
      const debitos = centavos(fila.debitos);
      const creditos = centavos(fila.creditos);
      const inicial = partirSaldo(saldoInicial, fila.cuenta_naturaleza);
      const final = partirSaldo(
        saldoInicial + signoNeto(fila.cuenta_naturaleza, debitos, creditos),
        fila.cuenta_naturaleza,
      );

      return {
        clave: `${fila.cuenta_id}-${fila.contacto_id ?? "sin-tercero"}`,
        cuentaId: fila.cuenta_id,
        cuentaCodigo: fila.cuenta_codigo,
        cuentaNombre: fila.cuenta_nombre,
        contactoId: fila.contacto_id,
        tercero: fila.tercero ?? "Sin tercero",
        saldoInicialDebito: inicial.debito,
        saldoInicialCredito: inicial.credito,
        debitos,
        creditos,
        saldoFinalDebito: final.debito,
        saldoFinalCredito: final.credito,
      };
    })
    .filter(
      (fila) =>
        incluirCero ||
        fila.saldoInicialDebito !== 0 ||
        fila.saldoInicialCredito !== 0 ||
        fila.debitos !== 0 ||
        fila.creditos !== 0 ||
        fila.saldoFinalDebito !== 0 ||
        fila.saldoFinalCredito !== 0,
    );

  const totales = calculadas.reduce<TotalesBalanzaTercero>(
    (acumulado, fila) => ({
      saldoInicialDebito: acumulado.saldoInicialDebito + fila.saldoInicialDebito,
      saldoInicialCredito: acumulado.saldoInicialCredito + fila.saldoInicialCredito,
      debitos: acumulado.debitos + fila.debitos,
      creditos: acumulado.creditos + fila.creditos,
      saldoFinalDebito: acumulado.saldoFinalDebito + fila.saldoFinalDebito,
      saldoFinalCredito: acumulado.saldoFinalCredito + fila.saldoFinalCredito,
    }),
    {
      saldoInicialDebito: 0,
      saldoInicialCredito: 0,
      debitos: 0,
      creditos: 0,
      saldoFinalDebito: 0,
      saldoFinalCredito: 0,
    },
  );

  return { filas: calculadas, totales };
}

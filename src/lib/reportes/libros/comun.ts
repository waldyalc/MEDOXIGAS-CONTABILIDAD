/** Diferencia neta de un movimiento según la naturaleza de la cuenta. */
export function signoNeto(naturaleza: string, debito: number, credito: number): number {
  return naturaleza === "credito" ? credito - debito : debito - credito;
}

/** Parte un saldo neto (positivo = naturaleza de la cuenta) en débito/crédito. */
export function partirSaldo(saldo: number, naturaleza: string): { debito: number; credito: number } {
  const positivoEsCredito = naturaleza === "credito";

  if (saldo >= 0) {
    return positivoEsCredito ? { debito: 0, credito: saldo } : { debito: saldo, credito: 0 };
  }

  return positivoEsCredito ? { debito: -saldo, credito: 0 } : { debito: 0, credito: -saldo };
}

export function etiquetaTercero(tercero: string | null | undefined): string {
  return tercero?.trim() ? tercero : "Sin tercero";
}

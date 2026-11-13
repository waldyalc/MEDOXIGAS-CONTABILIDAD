import { z } from "zod";

export interface TransferenciaValidable {
  cuenta_origen_id: string;
  cuenta_destino_id: string;
  montoCentavos: number;
}

export interface DepositoValidable {
  cuenta_destino_id: string;
  cuenta_contrapartida_id: string;
  montoCentavos: number;
}

export function validarTransferencia(datos: TransferenciaValidable): string | null {
  if (!datos.cuenta_origen_id) return "Selecciona la cuenta de origen.";
  if (!datos.cuenta_destino_id) return "Selecciona la cuenta de destino.";
  if (datos.cuenta_origen_id === datos.cuenta_destino_id) {
    return "La cuenta de origen y la de destino deben ser distintas.";
  }
  if (!Number.isFinite(datos.montoCentavos) || datos.montoCentavos <= 0) {
    return "El monto debe ser mayor que cero.";
  }
  return null;
}

export function validarDeposito(datos: DepositoValidable): string | null {
  if (!datos.cuenta_destino_id) return "Selecciona la cuenta de destino.";
  if (!datos.cuenta_contrapartida_id) return "Selecciona la cuenta de contrapartida.";
  if (datos.cuenta_destino_id === datos.cuenta_contrapartida_id) {
    return "La cuenta de destino y la contrapartida deben ser distintas.";
  }
  if (!Number.isFinite(datos.montoCentavos) || datos.montoCentavos <= 0) {
    return "El monto debe ser mayor que cero.";
  }
  return null;
}

export const transferenciaSchema = z.object({
  cuenta_origen_id: z.uuid({ message: "Selecciona una cuenta de origen válida." }),
  cuenta_destino_id: z.uuid({ message: "Selecciona una cuenta de destino válida." }),
  monto: z.coerce.number().finite({ message: "Escribe un monto válido." }),
  fecha: z.iso.date({ message: "La fecha no es válida." }),
  descripcion: z.string().trim().max(2000).optional(),
});

export const depositoSchema = z.object({
  cuenta_destino_id: z.uuid({ message: "Selecciona una cuenta de destino válida." }),
  cuenta_contrapartida_id: z.uuid({ message: "Selecciona una cuenta de contrapartida válida." }),
  monto: z.coerce.number().finite({ message: "Escribe un monto válido." }),
  fecha: z.iso.date({ message: "La fecha no es válida." }),
  descripcion: z.string().trim().max(2000).optional(),
});

export type TransferenciaEntrada = z.infer<typeof transferenciaSchema>;
export type DepositoEntrada = z.infer<typeof depositoSchema>;

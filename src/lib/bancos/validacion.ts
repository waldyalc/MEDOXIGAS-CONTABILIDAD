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

export const TIPOS_CUENTA_BANCO = ["banco", "efectivo", "tarjeta"] as const;
export type TipoCuentaBanco = (typeof TIPOS_CUENTA_BANCO)[number];

export function tipoCuentaBancoValido(tipo: string): tipo is TipoCuentaBanco {
  return tipo === "banco" || tipo === "efectivo" || tipo === "tarjeta";
}

export interface CuentaBancoValidable {
  nombre: string;
  tipo_banco: string;
  saldoCentavos: number;
  fecha_saldo_inicial: string;
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

export function validarCuentaBanco(datos: CuentaBancoValidable): string | null {
  if (!datos.nombre.trim()) return "Escribe el nombre de la cuenta.";
  if (!tipoCuentaBancoValido(datos.tipo_banco)) return "Selecciona un tipo de cuenta válido.";
  if (!Number.isFinite(datos.saldoCentavos) || datos.saldoCentavos < 0) {
    return "El saldo inicial no puede ser negativo.";
  }
  if (!datos.fecha_saldo_inicial) return "Selecciona la fecha del saldo inicial.";
  return null;
}

export const cuentaBancoSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, { message: "Escribe el nombre de la cuenta." })
    .max(150, { message: "El nombre de la cuenta es demasiado largo." }),
  tipo_banco: z.enum(TIPOS_CUENTA_BANCO, { message: "Selecciona un tipo de cuenta válido." }),
  numero_cuenta: z.string().trim().max(60, { message: "El número de cuenta es demasiado largo." }).optional(),
  saldo_inicial: z.coerce
    .number()
    .finite({ message: "Escribe un saldo inicial válido." })
    .min(0, { message: "El saldo inicial no puede ser negativo." }),
  fecha_saldo_inicial: z.iso.date({ message: "La fecha del saldo inicial no es válida." }),
  descripcion: z.string().trim().max(2000).optional(),
});

export const transferenciaSchema = z.object({
  cuenta_origen_id: z.uuid({ message: "Selecciona una cuenta de origen válida." }),
  cuenta_destino_id: z.uuid({ message: "Selecciona una cuenta de destino válida." }),
  monto: z.coerce.number().finite({ message: "Escribe un monto válido." }),
  fecha: z.iso.date({ message: "La fecha no es válida." }),
  descripcion: z.string().trim().max(2000).optional(),
  numeracion_ingreso: z.string().trim().max(60).optional(),
  numeracion_egreso: z.string().trim().max(60).optional(),
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
export type CuentaBancoEntrada = z.infer<typeof cuentaBancoSchema>;

export const iniciarConciliacionSchema = z.object({
  cuenta_id: z.uuid({ message: "Selecciona la cuenta a conciliar." }),
  fecha_hasta: z.iso.date({ message: "La fecha de corte no es válida." }),
  saldo_bancario: z.coerce
    .number()
    .finite({ message: "Escribe un saldo del extracto válido." })
    .min(0, { message: "El saldo del extracto no puede ser negativo." }),
});

export const conciliacionSchema = z
  .object({
    conciliacion_id: z.uuid({ message: "La conciliación no es válida." }),
    cuenta_id: z.uuid({ message: "Selecciona la cuenta a conciliar." }),
    fecha_desde: z.iso.date({ message: "La fecha desde no es válida." }),
    fecha_hasta: z.iso.date({ message: "La fecha de corte no es válida." }),
    saldo_bancario: z.coerce
      .number()
      .finite({ message: "Escribe un saldo del extracto válido." })
      .min(0, { message: "El saldo del extracto no puede ser negativo." }),
    gastos_bancarios: z.coerce.number().finite().min(0).default(0),
    entradas_bancarias: z.coerce.number().finite().min(0).default(0),
    lineas: z.array(z.uuid()).max(5000),
  })
  .refine((datos) => datos.fecha_desde <= datos.fecha_hasta, {
    message: "El rango de fechas es inválido.",
    path: ["fecha_hasta"],
  })
  .refine((datos) => new Set(datos.lineas).size === datos.lineas.length, {
    message: "Hay un movimiento repetido en la conciliación.",
    path: ["lineas"],
  });

export interface ConciliacionValidable {
  fecha_desde: string;
  fecha_hasta: string;
  saldoCentavos: number | null;
  lineas: readonly string[];
  requiereMovimientos: boolean;
}

export function validarConciliacion(datos: ConciliacionValidable): string | null {
  if (datos.fecha_desde > datos.fecha_hasta) return "El rango de fechas es inválido.";
  if (datos.saldoCentavos === null || !Number.isFinite(datos.saldoCentavos) || datos.saldoCentavos < 0) {
    return "Escribe el saldo del extracto.";
  }
  if (datos.requiereMovimientos && datos.lineas.length === 0) return "Selecciona al menos un movimiento.";
  if (new Set(datos.lineas).size !== datos.lineas.length) return "Hay un movimiento repetido en la conciliación.";
  return null;
}

export type IniciarConciliacionEntrada = z.infer<typeof iniciarConciliacionSchema>;
export type ConciliacionEntrada = z.infer<typeof conciliacionSchema>;

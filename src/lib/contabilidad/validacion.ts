import { z } from "zod";

export const TIPOS_CUENTA = ["activo", "pasivo", "capital", "ingreso", "costo", "gasto"] as const;

export const NATURALEZAS_CUENTA = ["debito", "credito"] as const;

export type TipoCuentaContable = (typeof TIPOS_CUENTA)[number];

export type NaturalezaCuenta = (typeof NATURALEZAS_CUENTA)[number];

const ETIQUETAS_TIPO: Record<TipoCuentaContable, string> = {
  activo: "Activo",
  pasivo: "Pasivo",
  capital: "Patrimonio",
  ingreso: "Ingreso",
  costo: "Costo",
  gasto: "Gasto",
};

const ETIQUETAS_NATURALEZA: Record<NaturalezaCuenta, string> = {
  debito: "Débito",
  credito: "Crédito",
};

export function etiquetaTipoCuenta(tipo: string) {
  return TIPOS_CUENTA.includes(tipo as TipoCuentaContable) ? ETIQUETAS_TIPO[tipo as TipoCuentaContable] : tipo;
}

export function etiquetaNaturalezaCuenta(naturaleza: string) {
  return NATURALEZAS_CUENTA.includes(naturaleza as NaturalezaCuenta)
    ? ETIQUETAS_NATURALEZA[naturaleza as NaturalezaCuenta]
    : naturaleza;
}

export interface CuentaOpcion {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
}

export interface CuentaEditable extends CuentaOpcion {
  naturaleza: string;
  padre_id: string | null;
  acepta_movimientos: boolean;
  es_caja_banco: boolean;
  activa: boolean;
}

const campoCodigo = z
  .string()
  .transform((valor) => valor.trim().toUpperCase())
  .refine((valor) => valor.length > 0, "El código es obligatorio")
  .refine((valor) => valor.length <= 20, "El código no puede pasar de 20 caracteres");

const campoNombre = z
  .string()
  .transform((valor) => valor.trim().replace(/\s+/g, " "))
  .refine((valor) => valor.length > 0, "El nombre es obligatorio")
  .refine((valor) => valor.length <= 200, "El nombre no puede pasar de 200 caracteres");

const campoPadre = z
  .string()
  .nullish()
  .transform((valor) => {
    const texto = (valor ?? "").trim();
    return texto === "" ? null : texto;
  })
  .refine((valor) => valor === null || z.uuid().safeParse(valor).success, "La cuenta padre no es válida");

const campoTipo = z.enum(TIPOS_CUENTA, "El tipo de cuenta no es válido");

const campoNaturaleza = z.enum(NATURALEZAS_CUENTA, "La naturaleza de la cuenta no es válida");

export const esquemaCrearCuenta = z.object({
  codigo: campoCodigo,
  nombre: campoNombre,
  tipo: campoTipo,
  naturaleza: campoNaturaleza,
  padre_id: campoPadre,
  acepta_movimientos: z.boolean().default(true),
  es_caja_banco: z.boolean().default(false),
  activa: z.boolean().default(true),
});

export const esquemaActualizarCuenta = z.object({
  codigo: campoCodigo.optional(),
  nombre: campoNombre,
  tipo: campoTipo.optional(),
  naturaleza: campoNaturaleza.optional(),
  padre_id: campoPadre,
  acepta_movimientos: z.boolean().default(true),
  es_caja_banco: z.boolean().default(false),
  activa: z.boolean().default(true),
});

export type DatosCuenta = z.infer<typeof esquemaCrearCuenta>;

export type DatosActualizarCuenta = z.infer<typeof esquemaActualizarCuenta>;

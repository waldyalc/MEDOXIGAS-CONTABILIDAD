import { z } from "zod";

import { valorACentavos } from "@/lib/facturacion/calculo";

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

const lineaSaldoInicialSchema = z
  .object({
    cuenta_id: z.uuid({ message: "Selecciona una cuenta en cada línea" }),
    descripcion: z.string().trim().max(500).optional(),
    debito: z.coerce.number().finite().min(0, { message: "El débito no puede ser negativo" }),
    credito: z.coerce.number().finite().min(0, { message: "El crédito no puede ser negativo" }),
  })
  .superRefine((linea, ctx) => {
    if (linea.debito > 0 === linea.credito > 0) {
      ctx.addIssue({
        code: "custom",
        message: "Cada línea debe llevar débito o crédito, nunca ambos.",
      });
    }
  });

export const esquemaSaldosIniciales = z
  .object({
    fecha: z.iso.date({ message: "La fecha no es válida." }),
    descripcion: z.string().trim().max(500).optional(),
    lineas: z.array(lineaSaldoInicialSchema).min(1, { message: "Carga al menos un saldo inicial." }).max(500),
  })
  .superRefine((datos, ctx) => {
    const vistas = new Set<string>();
    for (const linea of datos.lineas) {
      if (vistas.has(linea.cuenta_id)) {
        ctx.addIssue({
          code: "custom",
          message: "Cada cuenta puede aparecer una sola vez.",
          path: ["lineas"],
        });
        break;
      }
      vistas.add(linea.cuenta_id);
    }

    const debitos = datos.lineas.reduce((total, linea) => total + valorACentavos(linea.debito), 0);
    const creditos = datos.lineas.reduce((total, linea) => total + valorACentavos(linea.credito), 0);

    if (debitos !== creditos) {
      ctx.addIssue({
        code: "custom",
        message: "El registro está descuadrado: el total de débitos debe ser igual al total de créditos.",
        path: ["lineas"],
      });
    }
  });

export type DatosSaldosIniciales = z.infer<typeof esquemaSaldosIniciales>;

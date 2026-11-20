// Exclusiones de los reportes 606/607 con los motivos literales de Alegra
// (Prueba 4, docs/alegra/reporte-investigacion-inventario-fiscal).
//
// Alegra excluye un documento cuando la identificación del contacto no es una
// cédula de 11 dígitos ni un RNC de 9 que pase el dígito verificador DGII, o
// cuando la cuenta contable del renglón (o su cuenta madre) no tiene la
// clasificación fiscal configurada.

import { soloDigitos } from "./comun";
import type { DocumentoFiscal } from "./tipos";

export interface DocumentoExcluido {
  id: string;
  /** NCF o `#numero` cuando el documento no tiene NCF. */
  numero: string;
  tipo: string;
  motivo: string;
  ruta: string | null;
}

export const MOTIVO_IDENTIFICACION_LONGITUD =
  "La identificación del proveedor/cliente asociado no tiene la longitud requerida. " +
  "La longitud permitida debe ser de 11 dígitos para cédulas y 9 para RNC.";

export const MOTIVO_SIN_TIPO_INGRESO = "No se encontró configurado el tipo de ingreso para la cuenta contable.";

export function motivoDigitoVerificador(valor: string | null | undefined): string {
  return `La comprobación del dígito verificador de la identificación: ${soloDigitos(valor)} fue erronea`;
}

export function motivoCuentaSinClasificar(nombreCuenta: string): string {
  return `La cuenta contable ${nombreCuenta} o su cuenta contable madre aún no tienen configurada la clasificación de costos y gastos.`;
}

/**
 * Dígito verificador DGII, igual que `public._rnc_digito_valido`:
 * · RNC (9): pesos [7,9,8,6,4,3,2] sobre los dígitos 2..8; dv = (11 - suma % 11) % 11.
 * · Cédula (11): pesos [1,2,1,2,1,2,1,2,1,2] sobre los 10 primeros, restando 9 a
 *   los productos >= 10; dv = (10 - suma % 10) % 10.
 */
export function digitoVerificadorValido(valor: string | null | undefined): boolean {
  const digitos = soloDigitos(valor);

  if (digitos.length === 9) {
    const pesos = [7, 9, 8, 6, 4, 3, 2];
    let suma = 0;
    for (let i = 0; i < pesos.length; i += 1) {
      suma += Number(digitos[i + 1]) * (pesos[i] ?? 0);
    }
    return (11 - (suma % 11)) % 11 === Number(digitos[8]);
  }

  if (digitos.length === 11) {
    const pesos = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
    let suma = 0;
    for (let i = 0; i < pesos.length; i += 1) {
      let producto = Number(digitos[i]) * (pesos[i] ?? 0);
      if (producto >= 10) producto -= 9;
      suma += producto;
    }
    return (10 - (suma % 10)) % 10 === Number(digitos[10]);
  }

  return false;
}

/** Cédula de 11 o RNC de 9 dígitos con dígito verificador válido. */
export function identificacionValida(valor: string | null | undefined): boolean {
  const digitos = soloDigitos(valor);
  if (digitos.length !== 9 && digitos.length !== 11) return false;
  return digitoVerificadorValido(digitos);
}

/** Motivo literal de Alegra, o null si la identificación sirve para la DGII. */
export function motivoIdentificacionInvalida(valor: string | null | undefined): string | null {
  const digitos = soloDigitos(valor);
  if (digitos.length !== 9 && digitos.length !== 11) return MOTIVO_IDENTIFICACION_LONGITUD;
  if (!digitoVerificadorValido(digitos)) return motivoDigitoVerificador(digitos);
  return null;
}

export function tipoDocumentoFiscal(documento: DocumentoFiscal): string {
  if (documento.clase === "compra") return "Factura de proveedor";
  if (documento.clase === "gasto") return "Gasto menor";
  if (documento.clase === "devolucion-venta") return "Nota de crédito";
  if (documento.clase === "devolucion-compra") return "Nota de crédito de compra";
  return "Venta";
}

export function numeroDocumentoFiscal(documento: DocumentoFiscal): string {
  return documento.ncf.trim() === "" ? `#${documento.numero}` : documento.ncf;
}

/**
 * Motivo por el que un documento no entra al TXT: primero la identificación
 * (longitud y dígito verificador, como Alegra), luego la clasificación de la
 * cuenta que dejó `consultas.ts` en `documento.exclusion`.
 */
export function motivoExclusionDocumento(documento: DocumentoFiscal): string | null {
  return motivoIdentificacionInvalida(documento.rnc) ?? documento.exclusion ?? null;
}

export function separarDocumentos(documentos: readonly DocumentoFiscal[]): {
  incluidos: DocumentoFiscal[];
  excluidos: DocumentoExcluido[];
} {
  const incluidos: DocumentoFiscal[] = [];
  const excluidos: DocumentoExcluido[] = [];

  for (const documento of documentos) {
    const motivo = motivoExclusionDocumento(documento);
    if (motivo == null) {
      incluidos.push(documento);
      continue;
    }

    excluidos.push({
      id: documento.id,
      numero: numeroDocumentoFiscal(documento),
      tipo: tipoDocumentoFiscal(documento),
      motivo,
      ruta: documento.ruta,
    });
  }

  return { incluidos, excluidos };
}

/** Fila de la hoja "Documentos no incluidos" del Excel. */
export function filaDocumentoExcluido(excluido: DocumentoExcluido): { [clave: string]: string } {
  return {
    numero: excluido.numero,
    tipo: excluido.tipo,
    motivo: excluido.motivo,
  };
}

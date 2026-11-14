export type TipoIdentificacion = "rnc" | "cedula" | "pasaporte";

export const TIPOS_IDENTIFICACION: readonly { valor: TipoIdentificacion; etiqueta: string }[] = [
  { valor: "rnc", etiqueta: "RNC" },
  { valor: "cedula", etiqueta: "Cédula" },
  { valor: "pasaporte", etiqueta: "Pasaporte" },
];

export function normalizarIdentificacion(tipo: TipoIdentificacion | null | undefined, valor: string): string {
  const limpio = valor.trim();
  if (tipo === "pasaporte") return limpio.replace(/\s+/g, "").toUpperCase();
  return limpio.replace(/\D/g, "");
}

export function errorIdentificacion(tipo: TipoIdentificacion | null | undefined, valor: string): string | null {
  const numero = normalizarIdentificacion(tipo, valor);
  if (numero === "") return null;

  if (tipo === "rnc") return /^\d{9}$/.test(numero) ? null : "El RNC debe tener 9 dígitos.";
  if (tipo === "cedula") return /^\d{11}$/.test(numero) ? null : "La cédula debe tener 11 dígitos.";
  if (tipo === "pasaporte") {
    return /^[A-Z0-9]{5,20}$/.test(numero) ? null : "El pasaporte debe tener entre 5 y 20 letras o números.";
  }

  return /^(\d{9}|\d{11})$/.test(numero) ? null : "El RNC o la cédula debe tener 9 u 11 dígitos.";
}

export function tipoContactoDesde(cliente: boolean, proveedor: boolean): "cliente" | "proveedor" | "ambos" | null {
  if (cliente && proveedor) return "ambos";
  if (cliente) return "cliente";
  if (proveedor) return "proveedor";
  return null;
}

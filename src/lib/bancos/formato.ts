export type TipoCuenta = "Caja" | "Banco" | "Efectivo" | "Tarjeta";

const TIPOS: Record<string, TipoCuenta> = {
  banco: "Banco",
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
};

export function tipoCuenta(nombre: string, tipoBanco?: string | null): TipoCuenta {
  const tipo = tipoBanco ? TIPOS[tipoBanco] : undefined;
  if (tipo) return tipo;
  return nombre.toLocaleLowerCase("es").includes("caja") ? "Caja" : "Banco";
}

/** Número de cuenta enmascarado estilo "**** * 6789"; null si no hay número. */
export function numeroEnmascarado(numeroCuenta: string | null): string | null {
  const limpio = (numeroCuenta ?? "").replace(/\s/g, "");
  return limpio === "" ? null : `**** * ${limpio.slice(-4)}`;
}

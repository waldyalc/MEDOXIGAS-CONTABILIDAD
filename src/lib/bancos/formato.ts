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

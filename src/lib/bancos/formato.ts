export function tipoCuenta(nombre: string): "Caja" | "Banco" {
  return nombre.toLocaleLowerCase("es").includes("caja") ? "Caja" : "Banco";
}

import type { Rol } from "@/lib/auth/rol";
import type { EstadoDocumento } from "@/lib/facturacion/tipos";

export function puedeAnularDocumento(rol: Rol | null, estado: EstadoDocumento): boolean {
  return (rol === "admin" || rol === "contador") && estado !== "anulado";
}

import { PillEstado } from "@/components/listas/tabla-lista";
import type { EstadoConteo } from "@/lib/inventario/ferreteria/tipos";

export const ESTADOS_CONTEO: Record<EstadoConteo, { etiqueta: string; tono: "pendiente" | "exito" | "peligro" }> = {
  borrador: { etiqueta: "Borrador", tono: "pendiente" },
  aplicado: { etiqueta: "Aplicado", tono: "exito" },
  anulado: { etiqueta: "Anulado", tono: "peligro" },
};

export function EtiquetaEstadoConteo({ estado }: { estado: EstadoConteo }) {
  const config = ESTADOS_CONTEO[estado];
  return <PillEstado tono={config.tono}>{config.etiqueta}</PillEstado>;
}

import { PillEstado, type TonoPill } from "@/components/listas/tabla-lista";
import type { EstadoDocumento } from "@/lib/compras/tipos";

const ETIQUETAS: Record<EstadoDocumento, string> = {
  abierta: "Abierta",
  pagada: "Pagada",
  anulada: "Anulada",
};

const TONOS: Record<EstadoDocumento, TonoPill> = {
  abierta: "pendiente",
  pagada: "exito",
  anulada: "peligro",
};

export function EstadoBadge({ estado }: { estado: EstadoDocumento }) {
  return <PillEstado tono={TONOS[estado]}>{ETIQUETAS[estado]}</PillEstado>;
}

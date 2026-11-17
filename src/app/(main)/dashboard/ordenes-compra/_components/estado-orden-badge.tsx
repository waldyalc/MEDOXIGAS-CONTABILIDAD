import { PillEstado, type TonoPill } from "@/components/listas/tabla-lista";
import type { EstadoOrdenCompra } from "@/lib/ordenes-compra/tipos";

const TONOS: Record<EstadoOrdenCompra, TonoPill> = {
  abierta: "pendiente",
  convertida: "exito",
  anulada: "peligro",
};

const ETIQUETAS: Record<EstadoOrdenCompra, string> = {
  abierta: "Abierta",
  convertida: "Convertida",
  anulada: "Anulada",
};

export function EstadoOrdenBadge({ estado }: { estado: EstadoOrdenCompra }) {
  return <PillEstado tono={TONOS[estado]}>{ETIQUETAS[estado]}</PillEstado>;
}

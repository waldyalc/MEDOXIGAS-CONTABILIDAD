import { Badge } from "@/components/ui/badge";
import type { EstadoOrdenCompra } from "@/lib/ordenes-compra/tipos";

export function EstadoOrdenBadge({ estado }: { estado: EstadoOrdenCompra }) {
  if (estado === "anulada") return <Badge variant="destructive">Anulada</Badge>;
  if (estado === "convertida") return <Badge>Convertida</Badge>;
  return <Badge variant="secondary">Abierta</Badge>;
}

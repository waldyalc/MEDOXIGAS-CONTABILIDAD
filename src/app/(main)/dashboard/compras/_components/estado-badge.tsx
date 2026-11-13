import { Badge } from "@/components/ui/badge";
import type { EstadoDocumento } from "@/lib/compras/tipos";

const ETIQUETAS: Record<EstadoDocumento, string> = {
  abierta: "Abierta",
  pagada: "Pagada",
  anulada: "Anulada",
};

const VARIANTES: Record<EstadoDocumento, "default" | "outline" | "destructive"> = {
  abierta: "outline",
  pagada: "default",
  anulada: "destructive",
};

export function EstadoBadge({ estado }: { estado: EstadoDocumento }) {
  return <Badge variant={VARIANTES[estado]}>{ETIQUETAS[estado]}</Badge>;
}

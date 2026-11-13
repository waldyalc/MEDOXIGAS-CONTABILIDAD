import { Badge } from "@/components/ui/badge";

export function EstadoAsiento({ estado }: { estado: string }) {
  if (estado === "Anulado") {
    return <Badge variant="destructive">Anulado</Badge>;
  }

  return (
    <Badge variant="outline" className="border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400">
      {estado}
    </Badge>
  );
}

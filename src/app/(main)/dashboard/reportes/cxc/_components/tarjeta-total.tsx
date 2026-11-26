import { Card, CardContent } from "@/components/ui/card";
import { formatearRd } from "@/lib/reportes/dinero";

interface Props {
  etiqueta: string;
  total: number;
}

export function TarjetaTotal({ etiqueta, total }: Props) {
  return (
    <Card className="border-border bg-card rounded-xl py-0">
      <CardContent className="flex flex-col items-center gap-0.5 py-4">
        <span className="text-muted-foreground text-sm">{etiqueta}</span>
        <span className="text-xl font-semibold text-rose-600 tabular-nums sm:text-2xl dark:text-rose-400">
          {formatearRd(total)}
        </span>
      </CardContent>
    </Card>
  );
}

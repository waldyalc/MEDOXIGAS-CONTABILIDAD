import { cn } from "cn";

import { ChartPie } from "@/components/icons";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

interface Props {
  titulo: string;
  detalle: string;
  className?: string;
}

/** Estado vacío de un widget del Inicio: ícono gris + título + detalle. */
export function EstadoVacio({ titulo, detalle, className }: Props) {
  return (
    <Empty className={cn("gap-3 p-6", className)}>
      <EmptyHeader className="gap-1.5">
        <EmptyMedia>
          <ChartPie aria-hidden="true" className="text-muted-foreground/40 size-14" strokeWidth={1.25} />
        </EmptyMedia>
        <EmptyTitle className="text-foreground text-base font-semibold">{titulo}</EmptyTitle>
        <EmptyDescription className="text-muted-foreground text-xs">{detalle}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

import { formatoDia } from "@/lib/formato";

import { BotonImprimir } from "./boton-imprimir";

interface Props {
  titulo: string;
  descripcion: string;
  desde: string;
  hasta: string;
}

export function EncabezadoReporte({ titulo, descripcion, desde, hasta }: Props) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        <p className="text-muted-foreground text-sm">{descripcion}</p>
        <p className="text-muted-foreground text-sm">
          Del {formatoDia(desde)} al {formatoDia(hasta)}
        </p>
      </div>
      <BotonImprimir />
    </div>
  );
}

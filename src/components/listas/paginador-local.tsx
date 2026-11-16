"use client";

import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formato = new Intl.NumberFormat("es-DO");

interface Props {
  total: number;
  /** Página actual en base 0, igual que `usePagina` de las fichas. */
  pagina: number;
  setPagina: (pagina: number) => void;
  porPagina?: number;
  /** Sustantivo del contador: "facturas", "documentos", "registros"… */
  etiqueta?: string;
  /** Ofrece el selector de tamaño solo si se pasa esta lista. */
  opciones?: readonly number[];
  onCambiarPorPagina?: (porPagina: number) => void;
  className?: string;
}

export function PaginadorLocal({
  total,
  pagina,
  setPagina,
  porPagina = 10,
  etiqueta = "registros",
  opciones,
  onCambiarPorPagina,
  className,
}: Props) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const actual = Math.min(Math.max(pagina, 0), totalPaginas - 1);
  const inicio = total === 0 ? 0 : actual * porPagina + 1;
  const fin = Math.min((actual + 1) * porPagina, total);
  const conSelector = opciones !== undefined && onCambiarPorPagina !== undefined;

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 text-sm", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {conSelector ? (
          <>
            <span>Ítems por página</span>
            <Select
              value={String(porPagina)}
              onValueChange={(valor) => {
                if (valor !== null && valor !== String(porPagina)) onCambiarPorPagina(Number(valor));
              }}
            >
              <SelectTrigger className="h-8 w-20" aria-label="Ítems por página">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {opciones.map((opcion) => (
                  <SelectItem key={opcion} value={String(opcion)}>
                    {opcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : null}
        <p className="text-muted-foreground tabular-nums">
          Mostrando {formato.format(inicio)}–{formato.format(fin)} de {formato.format(total)} {etiqueta}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          disabled={actual === 0}
          aria-label="Página anterior"
          onClick={() => setPagina(actual - 1)}
        >
          <ChevronLeft />
        </Button>
        <span className="text-muted-foreground min-w-28 text-center tabular-nums">
          Página {formato.format(actual + 1)} de {formato.format(totalPaginas)}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={actual >= totalPaginas - 1}
          aria-label="Página siguiente"
          onClick={() => setPagina(actual + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

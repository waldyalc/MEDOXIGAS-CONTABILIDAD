import Link from "next/link";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type ParametrosLista, type ResumenPagina, urlLista } from "@/lib/listas/parametros";

const formato = new Intl.NumberFormat("es-DO");

interface Props {
  base: string;
  params: ParametrosLista;
  resumen: ResumenPagina;
}

export function PaginadorLista({ base, params, resumen }: Props) {
  if (resumen.total === 0) return null;

  const { pagina, totalPaginas, inicio, fin, total } = resumen;
  const anterior = pagina > 1 ? urlLista(base, params, { pagina: String(pagina - 1) }) : null;
  const siguiente = pagina < totalPaginas ? urlLista(base, params, { pagina: String(pagina + 1) }) : null;
  const primera = pagina > 1 ? urlLista(base, params, { pagina: "1" }) : null;
  const ultima = pagina < totalPaginas ? urlLista(base, params, { pagina: String(totalPaginas) }) : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        Mostrando {formato.format(inicio)}–{formato.format(fin)} de {formato.format(total)}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          disabled={primera === null}
          aria-label="Primera página"
          render={primera ? <Link href={primera} prefetch={false} /> : undefined}
        >
          <ChevronsLeft />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={anterior === null}
          aria-label="Página anterior"
          render={anterior ? <Link href={anterior} prefetch={false} /> : undefined}
        >
          <ChevronLeft />
        </Button>
        <span className="text-muted-foreground min-w-28 text-center tabular-nums">
          Página {formato.format(pagina)} de {formato.format(totalPaginas)}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={siguiente === null}
          aria-label="Página siguiente"
          render={siguiente ? <Link href={siguiente} prefetch={false} /> : undefined}
        >
          <ChevronRight />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={ultima === null}
          aria-label="Última página"
          render={ultima ? <Link href={ultima} prefetch={false} /> : undefined}
        >
          <ChevronsRight />
        </Button>
      </div>
    </div>
  );
}

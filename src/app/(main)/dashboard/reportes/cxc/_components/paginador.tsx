import Link from "next/link";

import { Button } from "@/components/ui/button";
import { urlConParametros } from "@/lib/reportes/administrativos/d/parametros";
import type { ParametrosFecha } from "@/lib/reportes/fechas";

interface Props {
  base: string;
  params: ParametrosFecha;
  pagina: number;
  totalPaginas: number;
  inicio: number;
  fin: number;
  total: number;
}

export function Paginador({ base, params, pagina, totalPaginas, inicio, fin, total }: Props) {
  if (total === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm print:hidden">
      <p className="text-muted-foreground">
        Mostrando {inicio}–{fin} de {total}
      </p>
      <div className="flex items-center gap-2">
        {pagina > 1 ? (
          <Button
            variant="outline"
            size="sm"
            render={<Link href={urlConParametros(base, params, { pagina: String(pagina - 1) })} prefetch={false} />}
          >
            Anterior
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Anterior
          </Button>
        )}
        <span className="text-muted-foreground tabular-nums">
          Página {pagina} de {totalPaginas}
        </span>
        {pagina < totalPaginas ? (
          <Button
            variant="outline"
            size="sm"
            render={<Link href={urlConParametros(base, params, { pagina: String(pagina + 1) })} prefetch={false} />}
          >
            Siguiente
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Siguiente
          </Button>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";

import { Button } from "@/components/ui/button";

interface Props {
  pagina: number;
  totalPaginas: number;
  anterior: string | null;
  siguiente: string | null;
}

export function PaginacionReporte({ pagina, totalPaginas, anterior, siguiente }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <p className="text-muted-foreground text-sm">
        Página {pagina} de {totalPaginas}
      </p>
      <div className="flex items-center gap-2">
        {anterior ? (
          <Button variant="outline" render={<Link href={anterior} prefetch={false} />}>
            Anterior
          </Button>
        ) : (
          <Button variant="outline" disabled>
            Anterior
          </Button>
        )}
        {siguiente ? (
          <Button variant="outline" render={<Link href={siguiente} prefetch={false} />}>
            Siguiente
          </Button>
        ) : (
          <Button variant="outline" disabled>
            Siguiente
          </Button>
        )}
      </div>
    </div>
  );
}

import type { ReactNode } from "react";

import { cn } from "cn";

import { type MigaDePan, MigasDePan } from "@/components/migas-de-pan";

export interface EncabezadoPaginaProps {
  /** Título de la página: 20 px / 600, el `h1` de Alegra (GUIA-TABLAS §2.1). */
  titulo: ReactNode;
  subtitulo?: ReactNode;
  /** "Facturación / Facturas"; la última miga se pinta como página actual, sin enlace. */
  migas?: readonly MigaDePan[];
  /** Botones a la derecha del título. */
  acciones?: ReactNode;
  className?: string;
}

/**
 * Marco de encabezado de una pantalla: migas opcionales, título, subtítulo y acciones.
 * Es un Server Component; las acciones pueden ser un Suspense con su propio esqueleto.
 */
export function EncabezadoPagina({ titulo, subtitulo, migas, acciones, className }: EncabezadoPaginaProps) {
  return (
    <header className={cn("flex flex-col gap-3", className)}>
      {migas && migas.length > 0 ? <MigasDePan items={migas} /> : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
          {subtitulo ? <p className="text-muted-foreground text-sm">{subtitulo}</p> : null}
        </div>

        {acciones ? <div className="flex flex-wrap items-center gap-2">{acciones}</div> : null}
      </div>
    </header>
  );
}

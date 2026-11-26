import Link from "next/link";

import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { urlConParametros } from "@/lib/reportes/administrativos/d/parametros";
import { ETIQUETAS_VISTA, VISTAS_ANTIGUEDAD, type VistaAntiguedad } from "@/lib/reportes/administrativos/d/tipos";
import type { ParametrosFecha } from "@/lib/reportes/fechas";

interface Props {
  base: string;
  params: ParametrosFecha;
  vista: VistaAntiguedad;
}

export function PestanasAntiguedad({ base, params, vista }: Props) {
  return (
    <div className="flex flex-col gap-1.5 print:hidden">
      <div className="border-border bg-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-3 lg:grid-cols-5">
        {VISTAS_ANTIGUEDAD.map((opcion) => {
          const activa = opcion === vista;
          const href = urlConParametros(base, params, { vista: activa ? null : opcion, pagina: null });

          return (
            <Link
              key={opcion}
              href={href}
              prefetch={false}
              className={cn(
                "bg-card flex min-h-11 items-center justify-center px-3 py-2 text-center text-xs text-slate-600 transition-colors hover:bg-slate-50 sm:text-sm dark:text-slate-300",
                activa &&
                  "bg-primary/10 text-primary hover:bg-primary/10 font-medium shadow-[inset_0_-2px_0_0_var(--primary)]",
              )}
            >
              {ETIQUETAS_VISTA[opcion]}
            </Link>
          );
        })}
      </div>

      {vista === "todas" ? null : (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            render={<Link href={urlConParametros(base, params, { vista: null, pagina: null })} prefetch={false} />}
          >
            Ver todas
          </Button>
        </div>
      )}
    </div>
  );
}

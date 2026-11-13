import Link from "next/link";

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
    <div className="flex flex-col gap-2 print:hidden">
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
        {VISTAS_ANTIGUEDAD.map((opcion) => {
          const activa = opcion === vista;
          const href = urlConParametros(base, params, { vista: activa ? null : opcion, pagina: null });

          return (
            <Button
              key={opcion}
              variant={activa ? "secondary" : "outline"}
              className="h-auto justify-center px-2 py-2 text-center text-xs whitespace-normal sm:text-sm"
              render={<Link href={href} prefetch={false} />}
            >
              {ETIQUETAS_VISTA[opcion]}
            </Button>
          );
        })}
      </div>

      {vista === "todas" ? null : (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={urlConParametros(base, params, { vista: null, pagina: null })} prefetch={false} />}
          >
            Ver todas
          </Button>
        </div>
      )}
    </div>
  );
}

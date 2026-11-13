import Link from "next/link";

import { Button } from "@/components/ui/button";
import { urlConParametros } from "@/lib/reportes/administrativos/d/parametros";
import type { ParametrosFecha } from "@/lib/reportes/fechas";

interface Opcion {
  valor: string;
  etiqueta: string;
}

interface Props {
  base: string;
  params: ParametrosFecha;
  clave: string;
  activa: string;
  opciones: readonly Opcion[];
}

export function PestanasFiscales({ base, params, clave, activa, opciones }: Props) {
  return (
    <div className="flex flex-wrap gap-1 print:hidden">
      {opciones.map((opcion) => (
        <Button
          key={opcion.valor}
          variant={opcion.valor === activa ? "secondary" : "outline"}
          className="h-auto px-3 py-2 text-sm"
          render={
            <Link href={urlConParametros(base, params, { [clave]: opcion.valor })} prefetch={false} scroll={false} />
          }
        >
          {opcion.etiqueta}
        </Button>
      ))}
    </div>
  );
}

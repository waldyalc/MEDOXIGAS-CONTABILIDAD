import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TIPOS_REGISTRO } from "@/lib/reportes/libros/parametros";

import { SelectorRangoFechas } from "../selector-fechas";

interface Props {
  desde: string;
  hasta: string;
  origenes: readonly string[];
  porPagina: number;
}

export function FiltroLibroDiario({ desde, hasta, origenes, porPagina }: Props) {
  return (
    <form method="get" className="ring-foreground/10 flex flex-col gap-4 rounded-xl p-4 ring-1 print:hidden">
      <div className="flex flex-wrap items-end gap-4">
        <SelectorRangoFechas desde={desde} hasta={hasta} />

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium">Tipo de registro</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {TIPOS_REGISTRO.map((tipo) => (
              <label key={tipo.valor} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="origen"
                  value={tipo.valor}
                  defaultChecked={origenes.includes(tipo.valor)}
                  className="accent-primary size-4"
                />
                {tipo.etiqueta}
              </label>
            ))}
          </div>
        </fieldset>

        <input type="hidden" name="porPagina" value={porPagina} />

        <Button type="submit" variant="secondary">
          Aplicar
        </Button>
      </div>

      <Label className="text-muted-foreground text-xs font-normal">
        Sin tipos seleccionados se incluyen todos los registros.
      </Label>
    </form>
  );
}

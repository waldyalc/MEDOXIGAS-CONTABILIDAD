import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CentroCostoOpcion } from "@/lib/centros-costo/tipos";
import type { Vista } from "@/lib/reportes/estados/tipos";

import { SelectorFechaCorte, SelectorRangoFechas } from "../selector-fechas";

interface Props {
  tipo: "rango" | "fecha";
  desde?: string;
  hasta: string;
  vista?: Vista;
  busqueda: string;
  centrosCosto?: CentroCostoOpcion[];
  centroSeleccionado?: string;
}

export function FiltrosEstados({
  tipo,
  desde,
  hasta,
  vista,
  busqueda,
  centrosCosto = [],
  centroSeleccionado = "",
}: Props) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 print:hidden">
      {tipo === "rango" && desde != null ? (
        <SelectorRangoFechas desde={desde} hasta={hasta} />
      ) : (
        <SelectorFechaCorte valor={hasta} />
      )}
      {centrosCosto.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="centro">Centro de costo</Label>
          <SelectCampo
            id="centro"
            name="centro"
            opciones={centrosCosto.map((centro) => ({
              value: centro.id,
              label: `${centro.codigo} · ${centro.nombre}`,
            }))}
            valorInicial={centroSeleccionado}
            etiquetaVacia="Todos los centros"
            buscable
            className="w-52"
          />
        </div>
      ) : null}
      {vista != null ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vista">Vista</Label>
          <SelectCampo
            id="vista"
            name="vista"
            opciones={[
              { value: "detallado", label: "Reporte detallado" },
              { value: "resumido", label: "Reporte resumido" },
            ]}
            valorInicial={vista}
            className="w-48"
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="q">Buscar cuenta contable</Label>
        <Input id="q" name="q" type="search" defaultValue={busqueda} placeholder="Cuenta contable" className="w-56" />
      </div>
      <Button type="submit" variant="secondary">
        Aplicar
      </Button>
    </form>
  );
}

import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FiltrosVentasUrl, NumeracionOpcion } from "@/lib/reportes/ventas/v1/tipos";

import { SelectorRangoFechas } from "../../_components/selector-fechas";

interface Props {
  desde: string;
  hasta: string;
  filtros: FiltrosVentasUrl;
  numeraciones: NumeracionOpcion[];
  mostrarNumeracion?: boolean;
}

export function FiltrosVentas({ desde, hasta, filtros, numeraciones, mostrarNumeracion = true }: Props) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 print:hidden">
      <SelectorRangoFechas desde={desde} hasta={hasta} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="almacen">Almacén</Label>
        <SelectCampo
          id="almacen"
          name="almacen"
          opciones={[{ value: "principal", label: "Principal" }]}
          valorInicial={filtros.almacen}
          etiquetaVacia="Todos los almacenes"
          className="w-44"
        />
      </div>
      {mostrarNumeracion ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="numeracion">Numeración</Label>
          <SelectCampo
            id="numeracion"
            name="numeracion"
            opciones={numeraciones.map((numeracion) => ({
              value: numeracion.tipo_comprobante,
              label: `${numeracion.prefijo} ${numeracion.nombre}`,
            }))}
            valorInicial={filtros.tipoComprobante}
            etiquetaVacia="Todas las numeraciones"
            className="w-56"
          />
        </div>
      ) : null}
      <div className="flex min-w-52 flex-1 flex-col gap-1.5">
        <Label htmlFor="q">Buscar</Label>
        <Input
          id="q"
          name="q"
          type="search"
          defaultValue={filtros.busqueda}
          placeholder="NCF o cliente"
          className="w-full max-w-64"
        />
      </div>
      {filtros.grafico === "mensual" ? <input type="hidden" name="grafico" value="mensual" /> : null}
      <Button type="submit" variant="secondary">
        Aplicar
      </Button>
    </form>
  );
}

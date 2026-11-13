import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { FiltrosVentasUrl, NumeracionOpcion } from "@/lib/reportes/ventas/v1/tipos";

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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="desde">Desde</Label>
        <Input id="desde" name="desde" type="date" defaultValue={desde} className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hasta">Hasta</Label>
        <Input id="hasta" name="hasta" type="date" defaultValue={hasta} className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="almacen">Almacén</Label>
        <NativeSelect id="almacen" name="almacen" defaultValue={filtros.almacen} className="w-44">
          <NativeSelectOption value="">Todos los almacenes</NativeSelectOption>
          <NativeSelectOption value="principal">Principal</NativeSelectOption>
        </NativeSelect>
      </div>
      {mostrarNumeracion ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="numeracion">Numeración</Label>
          <NativeSelect id="numeracion" name="numeracion" defaultValue={filtros.tipoComprobante} className="w-56">
            <NativeSelectOption value="">Todas las numeraciones</NativeSelectOption>
            {numeraciones.map((numeracion) => (
              <NativeSelectOption key={numeracion.tipo_comprobante} value={numeracion.tipo_comprobante}>
                {numeracion.prefijo} {numeracion.nombre}
              </NativeSelectOption>
            ))}
          </NativeSelect>
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

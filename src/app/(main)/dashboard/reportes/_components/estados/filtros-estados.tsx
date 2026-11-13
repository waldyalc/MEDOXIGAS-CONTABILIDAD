import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Vista } from "@/lib/reportes/estados/tipos";

interface Props {
  tipo: "rango" | "fecha";
  desde?: string;
  hasta: string;
  vista?: Vista;
  busqueda: string;
  centroCostos?: boolean;
}

export function FiltrosEstados({ tipo, desde, hasta, vista, busqueda, centroCostos = false }: Props) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 print:hidden">
      {tipo === "rango" && desde != null ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" name="desde" type="date" defaultValue={desde} className="w-40" />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hasta">Hasta</Label>
        <Input id="hasta" name="hasta" type="date" defaultValue={hasta} className="w-40" />
      </div>
      {centroCostos ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="centro">Centro de costo</Label>
          <NativeSelect id="centro" name="centro" disabled defaultValue="" className="w-44">
            <NativeSelectOption value="">Próximamente</NativeSelectOption>
          </NativeSelect>
        </div>
      ) : null}
      {vista != null ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vista">Vista</Label>
          <NativeSelect id="vista" name="vista" defaultValue={vista} className="w-48">
            <NativeSelectOption value="detallado">Reporte detallado</NativeSelectOption>
            <NativeSelectOption value="resumido">Reporte resumido</NativeSelectOption>
          </NativeSelect>
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

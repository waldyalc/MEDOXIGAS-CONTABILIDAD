import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { SelectorRangoFechas } from "../../_components/selector-fechas";

interface Props {
  desde: string;
  hasta: string;
  proveedor: string;
}

export function FiltrosCompras({ desde, hasta, proveedor }: Props) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 print:hidden">
      <SelectorRangoFechas desde={desde} hasta={hasta} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="proveedor">Proveedor</Label>
        <Input id="proveedor" name="proveedor" defaultValue={proveedor} placeholder="Nombre del proveedor" />
      </div>

      <Button type="submit" variant="secondary">
        Aplicar
      </Button>
    </form>
  );
}

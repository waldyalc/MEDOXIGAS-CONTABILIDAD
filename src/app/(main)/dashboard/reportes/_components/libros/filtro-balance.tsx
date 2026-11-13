import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { SelectorRangoFechas } from "../selector-fechas";

interface Props {
  desde: string;
  hasta: string;
  buscar: string;
  cierreAnual: boolean;
  incluirCero: boolean;
}

export function FiltroBalance({ desde, hasta, buscar, cierreAnual, incluirCero }: Props) {
  return (
    <form method="get" className="ring-foreground/10 flex flex-wrap items-end gap-4 rounded-xl p-4 ring-1 print:hidden">
      <SelectorRangoFechas desde={desde} hasta={hasta} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="buscar">Buscar cuenta contable</Label>
        <Input id="buscar" name="buscar" defaultValue={buscar} placeholder="Código o nombre" className="w-56" />
      </div>

      <div className="flex items-center gap-2 pb-1.5">
        <Switch id="cierre" name="cierre" value="1" defaultChecked={cierreAnual} />
        <Label htmlFor="cierre">Cierre anual</Label>
      </div>

      <div className="flex items-center gap-2 pb-1.5">
        <Switch id="ceros" name="ceros" value="1" defaultChecked={incluirCero} />
        <Label htmlFor="ceros">Cuentas con saldos en cero</Label>
      </div>

      <Button type="submit" variant="secondary">
        Aplicar
      </Button>
    </form>
  );
}

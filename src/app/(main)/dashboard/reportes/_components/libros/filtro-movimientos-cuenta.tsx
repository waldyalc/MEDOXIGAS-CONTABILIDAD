import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CuentaContable } from "@/lib/reportes/tipos";

import { SelectorRangoFechas } from "../selector-fechas";
import { SelectCuenta } from "./select-cuenta";

interface Props {
  desde: string;
  hasta: string;
  cuentas: readonly CuentaContable[];
  cuenta: string | null;
  asiento: string;
}

export function FiltroMovimientosCuenta({ desde, hasta, cuentas, cuenta, asiento }: Props) {
  return (
    <form method="get" className="ring-foreground/10 flex flex-wrap items-end gap-4 rounded-xl p-4 ring-1 print:hidden">
      <SelectorRangoFechas desde={desde} hasta={hasta} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cuenta">Cuenta contable</Label>
        <SelectCuenta id="cuenta" cuentas={cuentas} valor={cuenta} requerido />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asiento">Asiento</Label>
        <Input id="asiento" name="asiento" defaultValue={asiento} placeholder="Número de asiento" className="w-44" />
      </div>

      <Button type="submit" variant="secondary">
        Aplicar
      </Button>
    </form>
  );
}

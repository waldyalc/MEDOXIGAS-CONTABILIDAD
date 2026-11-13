import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ContactoOpcion } from "@/lib/reportes/libros/tipos";
import type { CuentaContable } from "@/lib/reportes/tipos";

import { SelectorRangoFechas } from "../selector-fechas";
import { SelectContacto } from "./select-contacto";
import { SelectCuenta } from "./select-cuenta";

interface Props {
  desde: string;
  hasta: string;
  cuentas: readonly CuentaContable[];
  contactos: readonly ContactoOpcion[];
  cuenta: string | null;
  tercero: string | null;
  incluirCero: boolean;
}

export function FiltroBalanzaTercero({ desde, hasta, cuentas, contactos, cuenta, tercero, incluirCero }: Props) {
  return (
    <form method="get" className="ring-foreground/10 flex flex-wrap items-end gap-4 rounded-xl p-4 ring-1 print:hidden">
      <SelectorRangoFechas desde={desde} hasta={hasta} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cuenta">Cuenta</Label>
        <SelectCuenta id="cuenta" cuentas={cuentas} valor={cuenta} todas etiquetaTodas="Todas las cuentas" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tercero">Tercero</Label>
        <SelectContacto id="tercero" contactos={contactos} valor={tercero} todos />
      </div>

      <div className="flex items-center gap-2 pb-1.5">
        <Switch id="ceros" name="ceros" value="1" defaultChecked={incluirCero} />
        <Label htmlFor="ceros">Incluir cuentas con saldos en cero</Label>
      </div>

      <Button type="submit" variant="secondary">
        Aplicar
      </Button>
    </form>
  );
}

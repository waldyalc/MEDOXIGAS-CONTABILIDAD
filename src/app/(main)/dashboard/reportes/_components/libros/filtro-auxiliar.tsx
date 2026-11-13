import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ContactoOpcion } from "@/lib/reportes/libros/tipos";
import type { CuentaContable } from "@/lib/reportes/tipos";

import { SelectorRangoFechas } from "../selector-fechas";
import { SelectContacto } from "./select-contacto";
import { SelectCuenta } from "./select-cuenta";

interface Props {
  desde: string;
  hasta: string;
  contactos: readonly ContactoOpcion[];
  cuentas: readonly CuentaContable[];
  tercero: string | null;
  cuenta: string | null;
}

export function FiltroAuxiliar({ desde, hasta, contactos, cuentas, tercero, cuenta }: Props) {
  return (
    <form method="get" className="ring-foreground/10 flex flex-wrap items-end gap-4 rounded-xl p-4 ring-1 print:hidden">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tercero">Tercero</Label>
        <SelectContacto id="tercero" contactos={contactos} valor={tercero} requerido />
      </div>

      <SelectorRangoFechas desde={desde} hasta={hasta} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cuenta">Cuenta contable</Label>
        <SelectCuenta id="cuenta" cuentas={cuentas} valor={cuenta} todas etiquetaTodas="Todas las cuentas" />
      </div>

      <Button type="submit" variant="secondary">
        Aplicar
      </Button>
    </form>
  );
}

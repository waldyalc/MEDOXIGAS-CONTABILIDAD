import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { AgruparPor } from "@/lib/reportes/libros/agrupado";
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
  agruparPor: AgruparPor;
}

export function FiltroAgrupado({ desde, hasta, cuentas, contactos, cuenta, tercero, agruparPor }: Props) {
  return (
    <form method="get" className="ring-foreground/10 flex flex-wrap items-end gap-4 rounded-xl p-4 ring-1 print:hidden">
      <SelectorRangoFechas desde={desde} hasta={hasta} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cuenta">Cuenta contable</Label>
        <SelectCuenta id="cuenta" cuentas={cuentas} valor={cuenta} requerido />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agrupar">Agrupar por</Label>
        <SelectCampo
          id="agrupar"
          name="agrupar"
          opciones={[
            { value: "cuenta", label: "Cuenta contable" },
            { value: "tercero", label: "Tercero" },
          ]}
          valorInicial={agruparPor}
          className="w-48"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tercero">Tercero</Label>
        <SelectContacto id="tercero" contactos={contactos} valor={tercero} todos />
      </div>

      <Button type="submit" variant="secondary">
        Aplicar
      </Button>
    </form>
  );
}

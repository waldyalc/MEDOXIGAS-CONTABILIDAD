import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { AgruparPor } from "@/lib/reportes/libros/agrupado";
import type { ContactoOpcion } from "@/lib/reportes/libros/tipos";
import type { CuentaContable } from "@/lib/reportes/tipos";

import { CamposFecha } from "./campos-fecha";
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
      <CamposFecha desde={desde} hasta={hasta} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cuenta">Cuenta contable</Label>
        <SelectCuenta id="cuenta" cuentas={cuentas} valor={cuenta} requerido />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agrupar">Agrupar por</Label>
        <NativeSelect id="agrupar" name="agrupar" defaultValue={agruparPor} className="w-48">
          <NativeSelectOption value="cuenta">Cuenta contable</NativeSelectOption>
          <NativeSelectOption value="tercero">Tercero</NativeSelectOption>
        </NativeSelect>
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

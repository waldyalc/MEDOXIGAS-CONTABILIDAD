import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import { SelectorFechaFormulario, SelectorRangoFechas } from "../../_components/selector-fechas";

interface Props {
  desde: string;
  hasta: string;
  comprobante: string;
  fecha: string;
  estado: string;
  tipo: string;
  valor: string;
}

export function FiltrosTransacciones({ desde, hasta, comprobante, fecha, estado, tipo, valor }: Props) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 print:hidden">
      <SelectorRangoFechas desde={desde} hasta={hasta} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="comprobante">Comprobante</Label>
        <Input id="comprobante" name="comprobante" defaultValue={comprobante} className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Fecha</Label>
        <SelectorFechaFormulario name="fecha" valor={fecha} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="estado">Estado</Label>
        <NativeSelect id="estado" name="estado" defaultValue={estado} className="w-32">
          <NativeSelectOption value="">Todos</NativeSelectOption>
          <NativeSelectOption value="activo">Activo</NativeSelectOption>
          <NativeSelectOption value="anulado">Anulado</NativeSelectOption>
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tipo">Tipo</Label>
        <NativeSelect id="tipo" name="tipo" defaultValue={tipo} className="w-32">
          <NativeSelectOption value="">Todos</NativeSelectOption>
          <NativeSelectOption value="entrada">Entrada</NativeSelectOption>
          <NativeSelectOption value="salida">Salida</NativeSelectOption>
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="valor">Valor</Label>
        <Input id="valor" name="valor" type="number" step="0.01" defaultValue={valor} className="w-32" />
      </div>
      <Button type="submit" variant="secondary">
        <Search />
        Filtrar
      </Button>
    </form>
  );
}

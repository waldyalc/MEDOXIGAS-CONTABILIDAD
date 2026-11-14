import { Search } from "lucide-react";

import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
        <SelectCampo
          id="estado"
          name="estado"
          opciones={[
            { value: "activo", label: "Activo" },
            { value: "anulado", label: "Anulado" },
          ]}
          valorInicial={estado}
          etiquetaVacia="Todos"
          className="w-32"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tipo">Tipo</Label>
        <SelectCampo
          id="tipo"
          name="tipo"
          opciones={[
            { value: "entrada", label: "Entrada" },
            { value: "salida", label: "Salida" },
          ]}
          valorInicial={tipo}
          etiquetaVacia="Todos"
          className="w-32"
        />
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

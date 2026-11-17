import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { SelectorRangoFechas } from "../../_components/selector-fechas";

interface FechasProps {
  desde: string;
  hasta: string;
}

interface ProveedorProps extends FechasProps {
  proveedor: string;
}

export function FiltrosCompras({ desde, hasta }: FechasProps) {
  return (
    <div className="print:hidden">
      <SelectorRangoFechas desde={desde} hasta={hasta} />
    </div>
  );
}

export function FiltroProveedorCompras({ desde, hasta, proveedor }: ProveedorProps) {
  return (
    <form method="get" className="flex w-full items-center gap-2 print:hidden">
      <input type="hidden" name="desde" value={desde} />
      <input type="hidden" name="hasta" value={hasta} />

      <div className="relative min-w-0 flex-1 sm:max-w-[267px]">
        <Label htmlFor="proveedor" className="sr-only">
          Proveedor
        </Label>
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          id="proveedor"
          name="proveedor"
          defaultValue={proveedor}
          placeholder="Proveedor"
          aria-label="Filtrar por proveedor"
          className="h-8 pl-8"
        />
      </div>

      <Button type="submit" variant="secondary">
        Aplicar
      </Button>
    </form>
  );
}

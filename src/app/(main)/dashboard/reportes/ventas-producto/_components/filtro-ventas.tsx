import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  desde: string;
  hasta: string;
  busqueda: string;
}

export function FiltroVentas({ desde, hasta, busqueda }: Props) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 print:hidden">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="desde">Desde</Label>
        <Input id="desde" name="desde" type="date" defaultValue={desde} className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hasta">Hasta</Label>
        <Input id="hasta" name="hasta" type="date" defaultValue={hasta} className="w-40" />
      </div>
      <div className="flex min-w-56 flex-1 flex-col gap-1.5">
        <Label htmlFor="q">Buscar</Label>
        <Input id="q" name="q" type="search" defaultValue={busqueda} placeholder="Producto, servicio o referencia…" />
      </div>
      <Button type="submit" variant="secondary">
        <Search />
        Buscar
      </Button>
    </form>
  );
}

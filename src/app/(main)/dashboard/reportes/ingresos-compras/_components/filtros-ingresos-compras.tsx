"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { SelectorRangoFechas } from "../../_components/selector-fechas";

interface Props {
  desde: string;
  hasta: string;
  buscar: string;
  incluirCeros: boolean;
}

export function FiltrosIngresosCompras({ desde, hasta, buscar, incluirCeros }: Props) {
  const [ceros, setCeros] = useState(incluirCeros);

  return (
    <form method="get" className="flex flex-wrap items-end gap-3 print:hidden">
      <SelectorRangoFechas desde={desde} hasta={hasta} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="q">Buscar cuenta contable</Label>
        <Input id="q" name="q" type="search" defaultValue={buscar} placeholder="Código o nombre" className="w-64" />
      </div>
      <div className="flex items-center gap-2 pb-2">
        <Switch id="ceros" checked={ceros} onCheckedChange={setCeros} />
        <Label htmlFor="ceros">Cuentas con saldos en cero</Label>
      </div>
      <input type="hidden" name="ceros" value={ceros ? "1" : "0"} />
      <Button type="submit" variant="secondary">
        Actualizar
      </Button>
    </form>
  );
}

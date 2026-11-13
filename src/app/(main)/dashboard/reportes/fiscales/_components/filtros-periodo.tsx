"use client";

import { useState } from "react";

import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface Extra {
  nombre: string;
  valor: string;
}

interface Props {
  desde: string;
  hasta: string;
  extras?: readonly Extra[];
  etiqueta?: string;
}

export function FiltrosPeriodo({ desde, hasta, extras = [], etiqueta = "Aplicar" }: Props) {
  const [inicio, setInicio] = useState(desde);
  const [fin, setFin] = useState(hasta);

  return (
    <form method="get" className="flex flex-wrap items-end gap-3 print:hidden">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="desde">Desde</Label>
        <DatePicker id="desde" value={inicio} onChange={setInicio} className="w-44" />
        <input type="hidden" name="desde" value={inicio} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hasta">Hasta</Label>
        <DatePicker id="hasta" value={fin} onChange={setFin} className="w-44" />
        <input type="hidden" name="hasta" value={fin} />
      </div>

      {extras.map((extra) => (
        <input key={extra.nombre} type="hidden" name={extra.nombre} value={extra.valor} />
      ))}

      <Button type="submit" variant="secondary">
        {etiqueta}
      </Button>
    </form>
  );
}

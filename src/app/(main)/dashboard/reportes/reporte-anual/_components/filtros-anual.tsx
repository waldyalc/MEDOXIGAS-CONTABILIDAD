"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";

interface Props {
  anio: number;
  anioActual: number;
  comparar: boolean;
}

const CANTIDAD_ANIOS = 10;

export function FiltrosAnual({ anio, anioActual, comparar }: Props) {
  const [compararAnterior, setCompararAnterior] = useState(comparar);
  const anios = Array.from(
    new Set([anio, ...Array.from({ length: CANTIDAD_ANIOS }, (_, indice) => anioActual - indice)]),
  ).sort((a, b) => b - a);

  return (
    <form method="get" className="flex flex-wrap items-end gap-3 print:hidden">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="anio">Año</Label>
        <NativeSelect id="anio" name="anio" defaultValue={String(anio)}>
          {anios.map((valor) => (
            <NativeSelectOption key={valor} value={String(valor)}>
              {valor}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="comparar">Comparar con año anterior</Label>
        <div className="flex h-8 items-center gap-2">
          <Switch id="comparar" checked={compararAnterior} onCheckedChange={setCompararAnterior} />
          <input type="hidden" name="comparar" value={compararAnterior ? "1" : "0"} />
          <span className="text-muted-foreground text-sm">{compararAnterior ? "Sí" : "No"}</span>
        </div>
      </div>

      <Button type="submit" variant="secondary">
        Actualizar
      </Button>
    </form>
  );
}

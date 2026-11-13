"use client";

import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import type { RetencionOpcion } from "@/lib/configuracion/tipos";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { type BaseRetencion, calcularRetenciones, totalRetenido } from "@/lib/retenciones/calculo";

interface Props {
  retenciones: readonly RetencionOpcion[];
  base: BaseRetencion;
  seleccionadas: readonly string[];
  onCambiar: (ids: string[]) => void;
  titulo?: string;
  deshabilitado?: boolean;
}

export function RetencionesCampo({
  retenciones,
  base,
  seleccionadas,
  onCambiar,
  titulo = "Retenciones",
  deshabilitado = false,
}: Props) {
  const filas = calcularRetenciones(seleccionadas, retenciones, base);
  const disponibles = retenciones.filter((retencion) => !seleccionadas.includes(retencion.id));
  const total = totalRetenido(filas);

  function agregar(id: string) {
    onCambiar([...seleccionadas, id]);
  }

  function quitar(id: string) {
    onCambiar(seleccionadas.filter((seleccionada) => seleccionada !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>{titulo}</Label>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={deshabilitado ? true : disponibles.length === 0}
              />
            }
          >
            <Plus />
            Agregar retención
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {disponibles.map((retencion) => (
              <DropdownMenuItem key={retencion.id} onClick={() => agregar(retencion.id)}>
                {retencion.nombre}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {filas.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          {deshabilitado ? "Selecciona la factura para aplicar retenciones." : "Sin retenciones aplicadas."}
        </p>
      ) : (
        <div className="flex flex-col divide-y rounded-lg border">
          {filas.map((fila) => (
            <div key={fila.retencion.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{fila.retencion.nombre}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  Base {formatoMoneda(fila.base)} · {fila.retencion.porcentaje} %
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular-nums">{formatoMoneda(fila.monto)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => quitar(fila.retencion.id)}
                  aria-label={`Quitar ${fila.retencion.nombre}`}
                >
                  <X />
                </Button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span className="font-medium">Total retenido</span>
            <span className="font-medium tabular-nums">{formatoMoneda(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

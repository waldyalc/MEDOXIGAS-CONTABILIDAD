"use client";

import { ChevronDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useWidgetsInicio } from "./widgets";

/** Botón «Agregar gráfica»: lista los widgets quitados para reponerlos. */
export function AgregarGrafica() {
  const { agregables, mostrar } = useWidgetsInicio();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary h-10 gap-2 rounded-[10px] px-4 text-sm font-medium disabled:opacity-60"
            disabled={agregables.length === 0}
            aria-label="Agregar gráfica al resumen"
          />
        }
      >
        <span>Agregar gráfica</span>
        <ChevronDown aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {agregables.map((widget) => (
          <DropdownMenuItem key={widget.id} onClick={() => mostrar(widget.id)} className="gap-2">
            <Plus aria-hidden="true" className="text-muted-foreground size-4" />
            {widget.titulo}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

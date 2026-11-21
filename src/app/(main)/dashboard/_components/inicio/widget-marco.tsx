"use client";

import { type ReactNode, useState } from "react";

import { cn } from "cn";
import { Expand, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { useWidgetsInicio, WIDGETS_INICIO, type WidgetId } from "./widgets";

interface Props {
  id: WidgetId;
  children: ReactNode;
  className?: string;
}

/**
 * Marco de un widget del Inicio: controles al pasar el mouse (expandir en un
 * diálogo y quitar de la parrilla), como las tarjetas del resumen de Alegra.
 * Los controles van sobre la tarjeta; solo se muestran en pantallas grandes.
 */
export function WidgetMarco({ id, children, className }: Props) {
  const { esVisible, ocultar } = useWidgetsInicio();
  const [expandido, setExpandido] = useState(false);
  const titulo = WIDGETS_INICIO.find((widget) => widget.id === id)?.titulo ?? "gráfica";

  if (!esVisible(id)) return null;

  return (
    <div className={cn("group/widget relative", className)}>
      {children}
      <div className="border-border bg-card absolute top-2 right-2 z-20 hidden items-center gap-0.5 rounded-lg border px-1 py-0.5 opacity-0 shadow-sm transition-opacity duration-200 group-hover/widget:opacity-100 lg:flex">
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-foreground hover:text-primary"
          onClick={() => setExpandido(true)}
          aria-label={`Expandir ${titulo}`}
        >
          <Expand aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-foreground hover:text-destructive"
          onClick={() => ocultar(id)}
          aria-label={`Eliminar ${titulo}`}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      <Dialog open={expandido} onOpenChange={setExpandido}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[920px]">
          <DialogHeader>
            <DialogTitle className="sr-only">{titulo}</DialogTitle>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    </div>
  );
}

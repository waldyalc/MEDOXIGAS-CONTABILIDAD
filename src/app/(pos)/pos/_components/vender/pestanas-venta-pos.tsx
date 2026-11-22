"use client";

import { useState } from "react";

import { cn } from "cn";

import { Basket, MoreVertical, Plus } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { MAXIMO_PESTANAS, useCarritoPOS } from "../carrito-pos-provider";

export function PestanasVentaPos({ onNuevaVenta }: { onNuevaVenta?: () => void }) {
  const { pestanas, activa, activarPestana, nuevaPestana, renombrarPestana, eliminarPestana } = useCarritoPOS();
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [eliminando, setEliminando] = useState<string | null>(null);

  function guardar(id: string) {
    renombrarPestana(id, texto);
    setRenombrando(null);
  }

  return (
    <div className="border-pos-linea -mx-4 flex items-center gap-0 border-t pr-1">
      <div
        role="tablist"
        aria-label="Ventas abiertas"
        className="flex min-w-0 flex-1 items-stretch gap-0 overflow-x-auto"
      >
        {pestanas.map((pestana) => {
          const seleccionada = pestana.id === activa.id;

          if (renombrando === pestana.id) {
            return (
              <input
                key={pestana.id}
                value={texto}
                maxLength={30}
                aria-label={`Renombrar ${pestana.nombre}`}
                className="border-pos-primario bg-background my-1 h-8 w-32 rounded-md border px-2 text-sm"
                onChange={(evento) => setTexto(evento.target.value)}
                onBlur={() => guardar(pestana.id)}
                onKeyDown={(evento) => {
                  if (evento.key === "Enter") {
                    evento.preventDefault();
                    guardar(pestana.id);
                  }
                  if (evento.key === "Escape") {
                    evento.preventDefault();
                    setRenombrando(null);
                  }
                }}
              />
            );
          }

          return (
            <div
              key={pestana.id}
              className={cn(
                "group flex shrink-0 items-center border-b-2",
                seleccionada ? "border-pos-primario" : "border-transparent",
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={seleccionada}
                aria-controls="panel-factura-pos"
                id={`pestana-${pestana.id}`}
                onClick={() => activarPestana(pestana.id)}
                className={cn(
                  "flex h-10 max-w-[170px] items-center gap-1.5 px-2.5 text-[13px] font-medium",
                  seleccionada ? "text-pos-primario" : "text-pos-texto-suave hover:text-pos-texto",
                )}
              >
                <Basket className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{pestana.nombre}</span>
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className={cn(
                        "opacity-60 hover:opacity-100 group-hover:opacity-100",
                        seleccionada ? "text-pos-primario" : "text-pos-texto-suave",
                      )}
                      aria-label={`Opciones de ${pestana.nombre}`}
                    />
                  }
                >
                  <MoreVertical aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  <DropdownMenuItem
                    onClick={() => {
                      setTexto(pestana.nombre);
                      setRenombrando(pestana.id);
                    }}
                  >
                    Renombrar
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => setEliminando(pestana.id)}>
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="text-pos-icono hover:text-pos-texto size-8"
        aria-label="Nueva venta"
        title={pestanas.length >= MAXIMO_PESTANAS ? "Máximo 8 ventas abiertas." : "Nueva venta"}
        disabled={pestanas.length >= MAXIMO_PESTANAS}
        onClick={() => {
          nuevaPestana();
          onNuevaVenta?.();
        }}
      >
        <Plus aria-hidden="true" />
      </Button>

      <AlertDialog open={eliminando !== null} onOpenChange={(abierto) => (abierto ? null : setEliminando(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {`¿Eliminar «${pestanas.find((pestana) => pestana.id === eliminando)?.nombre ?? "la venta"}»?`}
            </AlertDialogTitle>
            <AlertDialogDescription>Se perderán sus productos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (eliminando) eliminarPestana(eliminando);
                setEliminando(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

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
import { esPestanaPrincipal, LARGO_MAXIMO_NOMBRE_PESTANA } from "@/lib/pos/pestanas-venta";

import { MAXIMO_PESTANAS, useCarritoPOS } from "../carrito-pos-provider";

export function PestanasVentaPos({ onNuevaVenta }: { onNuevaVenta?: () => void }) {
  const { pestanas, activa, activarPestana, nuevaPestana, renombrarPestana, eliminarPestana } = useCarritoPOS();
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [eliminando, setEliminando] = useState<string | null>(null);

  // En móvil la tira se desplaza: al crear o activar una pestaña, que se vea.
  useEffect(() => {
    const visible = document.getElementById(`pestana-${activa.id}`);
    visible?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activa.id]);

  function guardar(id: string) {
    renombrarPestana(id, texto);
    setRenombrando(null);
  }

  return (
    <div className="flex max-w-full min-w-0 items-stretch">
      <div
        role="tablist"
        aria-label="Ventas abiertas"
        className="flex min-w-0 items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pestanas.map((pestana) => {
          const seleccionada = pestana.id === activa.id;
          const principal = esPestanaPrincipal(pestanas, pestana.id);

          if (renombrando === pestana.id) {
            return (
              <input
                key={pestana.id}
                value={texto}
                maxLength={LARGO_MAXIMO_NOMBRE_PESTANA}
                aria-label={`Renombrar ${pestana.nombre}`}
                // biome-ignore lint/a11y/noAutofocus: renombrar es una acción explícita del menú; el foco debe ir al input.
                autoFocus
                onFocus={(evento) => evento.currentTarget.select()}
                className="border-pos-primario bg-background mx-2 my-1.5 h-8 w-32 rounded-md border px-2 text-sm"
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
                "group relative flex h-full w-[160px] shrink-0 items-stretch border-r border-b-2 border-r-black/10 dark:border-r-pos-linea",
                seleccionada
                  ? "border-b-pos-primario bg-white dark:bg-card"
                  : "border-b-transparent hover:bg-white/60 dark:hover:bg-white/5",
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
                  "flex h-full w-full items-center gap-2 px-3 pr-2 text-left text-sm font-medium",
                  seleccionada ? "text-[#474747] dark:text-pos-texto" : "text-pos-texto-suave hover:text-pos-texto",
                )}
              >
                <Basket
                  className={cn("size-[18px] shrink-0", seleccionada ? "text-pos-primario" : "text-pos-icono")}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{pestana.nombre}</span>
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className={cn(
                        "absolute top-1/2 right-1 -translate-y-1/2",
                        seleccionada
                          ? "text-pos-primario opacity-100"
                          : "text-pos-icono opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
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
                  {principal ? null : (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        if (pestana.lineas.length === 0) {
                          eliminarPestana(pestana.id);
                          return;
                        }
                        setEliminando(pestana.id);
                      }}
                    >
                      Eliminar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>

      <Button
        variant="ghost"
        className="h-full w-11 shrink-0 rounded-none border-r border-r-black/10 bg-white text-xl text-[#0f172a] hover:bg-pos-panel dark:border-r-pos-linea dark:bg-card dark:text-pos-texto"
        aria-label="Nueva venta"
        title={pestanas.length >= MAXIMO_PESTANAS ? "Máximo 8 ventas abiertas." : "Nueva venta"}
        disabled={pestanas.length >= MAXIMO_PESTANAS}
        onClick={() => {
          nuevaPestana();
          onNuevaVenta?.();
        }}
      >
        <Plus className="size-5" aria-hidden="true" />
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

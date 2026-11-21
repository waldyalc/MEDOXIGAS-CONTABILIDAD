"use client";

import { useState } from "react";

import { cn } from "cn";
import { ArrowLeft } from "lucide-react";

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

import { useCarritoPOS } from "./carrito-pos-provider";
import { claseIconoMenu, itemMenuBase, itemMenuColapsado } from "./menu-pos-estilos";

/**
 * Ítem «Volver a Contabilidad» del pie del menú del POS. Si hay ventas sin
 * cobrar, pide confirmación antes de salir del punto de venta.
 */
export function SalirPos({ colapsado = false }: { colapsado?: boolean }) {
  const { hayLineas } = useCarritoPOS();
  const [abierto, setAbierto] = useState(false);

  function salir() {
    window.location.assign("/dashboard");
  }

  return (
    <>
      <button
        type="button"
        title="Volver a Contabilidad"
        className={cn(itemMenuBase, colapsado && itemMenuColapsado)}
        onClick={() => {
          if (hayLineas) {
            setAbierto(true);
            return;
          }
          salir();
        }}
      >
        <ArrowLeft aria-hidden="true" className={claseIconoMenu(false)} />
        <span className={cn("min-w-0 flex-1 truncate", colapsado && "hidden")}>Volver a Contabilidad</span>
      </button>

      <AlertDialog open={abierto} onOpenChange={setAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salir del punto de venta?</AlertDialogTitle>
            <AlertDialogDescription>Las ventas que no hayas cobrado se perderán.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir vendiendo</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={salir}>
              Salir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

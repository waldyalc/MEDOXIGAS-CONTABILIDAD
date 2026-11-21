"use client";

import { useState } from "react";

import { ArrowLeft } from "@/components/icons";
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

import { useCarritoPOS } from "./carrito-pos-provider";

export function SalirPos() {
  const { hayLineas } = useCarritoPOS();
  const [abierto, setAbierto] = useState(false);

  function salir() {
    window.location.assign("/dashboard");
  }

  return (
    <>
      <Button
        variant="outline"
        className="h-10 gap-1.5"
        title="Volver a Contabilidad"
        aria-label="Volver a Contabilidad"
        onClick={() => {
          if (hayLineas) {
            setAbierto(true);
            return;
          }
          salir();
        }}
      >
        <ArrowLeft aria-hidden="true" />
        <span className="hidden xl:inline">Salir</span>
      </Button>

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

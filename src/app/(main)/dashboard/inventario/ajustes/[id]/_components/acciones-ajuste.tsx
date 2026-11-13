"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { anularAjusteInventario } from "@/lib/inventario/acciones";

export function AccionesAjuste({ ajusteId, numero }: { ajusteId: string; numero: number }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function cambiarAbierto(abrir: boolean) {
    setAbierto(abrir);
    if (!abrir) setError(null);
  }

  function confirmar() {
    setError(null);

    iniciar(async () => {
      const resultado = await anularAjusteInventario(ajusteId);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog open={abierto} onOpenChange={cambiarAbierto}>
      <AlertDialogTrigger render={<Button variant="destructive" disabled={pendiente} />}>Anular</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Anular el ajuste #{numero}?</AlertDialogTitle>
          <AlertDialogDescription>Se revierte la existencia del almacén y el asiento contable.</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pendiente} onClick={confirmar}>
            {pendiente ? "Anulando…" : "Anular ajuste"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

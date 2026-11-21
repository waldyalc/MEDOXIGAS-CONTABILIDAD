"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Ban, Loader2 } from "@/components/icons";
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
import { anularGastoMenor } from "@/lib/gastos/acciones";

interface Props {
  gastoId: string;
  numero: number;
}

export function AccionesGasto({ gastoId, numero }: Props) {
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
      const resultado = await anularGastoMenor(gastoId);

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
      <AlertDialogTrigger render={<Button variant="destructive" disabled={pendiente} />}>
        <Ban />
        Anular
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Anular el gasto menor #{numero}?</AlertDialogTitle>
          <AlertDialogDescription>
            Se creará un asiento de anulación. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pendiente} onClick={confirmar}>
            {pendiente ? <Loader2 className="animate-spin" /> : null}
            Anular gasto
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

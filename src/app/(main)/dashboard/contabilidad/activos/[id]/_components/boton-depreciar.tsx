"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Loader2 } from "@/components/icons";
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
import { depreciarPeriodo } from "@/lib/activos-fijos/acciones";
import { formatoMonedaCentavos } from "@/lib/facturacion/formato";

interface Props {
  activoId: string;
  periodo: string;
  etiqueta: string;
  montoCentavos: number;
}

export function BotonDepreciar({ activoId, periodo, etiqueta, montoCentavos }: Props) {
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
      const resultado = await depreciarPeriodo({ activo_id: activoId, periodo });

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
      <AlertDialogTrigger render={<Button disabled={pendiente} />}>Depreciar periodo</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Depreciar {etiqueta}?</AlertDialogTitle>
          <AlertDialogDescription>
            Se creará el asiento de {formatoMonedaCentavos(montoCentavos)}: débito al gasto de depreciación y crédito a
            la depreciación acumulada. No se duplica si el mes ya está depreciado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={pendiente} onClick={confirmar}>
            {pendiente ? <Loader2 className="animate-spin" /> : null}
            Depreciar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

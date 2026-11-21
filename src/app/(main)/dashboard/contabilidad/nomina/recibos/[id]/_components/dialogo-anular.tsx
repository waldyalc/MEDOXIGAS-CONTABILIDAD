"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Loader2, Undo2 } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { anularPagoRecibo, anularRecibo } from "@/lib/nomina/acciones";

interface PropsBase {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  reciboId: string;
  nombre: string;
}

export function DialogoAnularPago({ abierto, onOpenChange, reciboId, nombre }: PropsBase) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function cambiar(abrir: boolean) {
    if (pendiente) return;
    if (!abrir) setError(null);
    onOpenChange(abrir);
  }

  function confirmar() {
    setError(null);
    iniciar(async () => {
      const resultado = await anularPagoRecibo(reciboId);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      onOpenChange(false);
      toast.add({
        type: "success",
        title: "Pago anulado",
        description:
          resultado.asientoId == null
            ? `El recibo de ${nombre} volvió a contabilizado.`
            : `Se creó el asiento de anulación y el recibo de ${nombre} volvió a contabilizado.`,
      });
      router.refresh();
    });
  }

  return (
    <AlertDialog open={abierto} onOpenChange={cambiar}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Anular el pago de {nombre}?</AlertDialogTitle>
          <AlertDialogDescription>
            Se creará un asiento de anulación con fecha de hoy y el recibo volverá a Contabilizado.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={pendiente} onClick={confirmar}>
            {pendiente ? <Loader2 className="animate-spin" /> : <Undo2 />}
            Anular pago
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface PropsRecibo extends PropsBase {
  codigoAsiento: string | null;
}

export function DialogoAnularRecibo({ abierto, onOpenChange, reciboId, nombre, codigoAsiento }: PropsRecibo) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function cambiar(abrir: boolean) {
    if (pendiente) return;
    if (!abrir) setError(null);
    onOpenChange(abrir);
  }

  function confirmar() {
    setError(null);
    iniciar(async () => {
      const resultado = await anularRecibo(reciboId);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      onOpenChange(false);
      toast.add({
        type: "success",
        title: "Recibo anulado",
        description: codigoAsiento
          ? `Se revirtió el comprobante ${codigoAsiento} del recibo de ${nombre}.`
          : `El recibo de ${nombre} quedó anulado.`,
      });
      router.refresh();
    });
  }

  return (
    <AlertDialog open={abierto} onOpenChange={cambiar}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Anular el recibo de {nombre}?</AlertDialogTitle>
          <AlertDialogDescription>
            {codigoAsiento
              ? `Se revertirá el comprobante ${codigoAsiento}.`
              : "Se anulará el recibo y sus líneas dejarán de sumar en el periodo."}{" "}
            Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={pendiente} onClick={confirmar}>
            {pendiente ? <Loader2 className="animate-spin" /> : <Undo2 />}
            Anular recibo
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Calculator, Loader2 } from "@/components/icons";
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
import { calcularRecibo } from "@/lib/nomina/acciones";

interface Props {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  reciboId: string;
  nombre: string;
  recalcular: boolean;
}

export function DialogoCalcularRecibo({ abierto, onOpenChange, reciboId, nombre, recalcular }: Props) {
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
      const resultado = await calcularRecibo(reciboId);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      onOpenChange(false);
      toast.add({ type: "success", title: "Recibo calculado", description: `Se recalculó el recibo de ${nombre}.` });
      router.refresh();
    });
  }

  return (
    <AlertDialog open={abierto} onOpenChange={cambiar}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {recalcular ? "Recalcular" : "Calcular"} el recibo de {nombre}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Se recalcularán los días, las bases y los totales. Las novedades manuales se conservan.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
          <Button type="button" disabled={pendiente} onClick={confirmar}>
            {pendiente ? <Loader2 className="animate-spin" /> : <Calculator />}
            {recalcular ? "Recalcular" : "Calcular"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Calculator, Loader2 } from "lucide-react";

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
import { formatoMoneda } from "@/lib/facturacion/formato";
import { calcularPeriodo } from "@/lib/nomina/acciones";

interface Props {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  periodoId: string;
  periodoCodigo: string;
  recibos: number;
  provisiones: boolean;
}

export function DialogoCalcularPeriodo({
  abierto,
  onOpenChange,
  periodoId,
  periodoCodigo,
  recibos,
  provisiones,
}: Props) {
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
      const resultado = await calcularPeriodo(periodoId);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      onOpenChange(false);
      toast.add({
        type: "success",
        title: "Nómina calculada",
        description: `${resultado.recibos} recibos · Neto ${formatoMoneda(resultado.totalNeto)} · Costo ${formatoMoneda(resultado.totalCostoEmpresa)}.`,
      });
      router.refresh();
    });
  }

  return (
    <AlertDialog open={abierto} onOpenChange={cambiar}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Calcular la nómina del periodo</AlertDialogTitle>
          <AlertDialogDescription>
            Se recalcularán {recibos} recibos en borrador o calculados del periodo {periodoCodigo}. Las novedades
            manuales se conservan.
            {provisiones ? " Se incluirán las provisiones de regalía, vacaciones y cesantía." : ""}
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
            Calcular nómina
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

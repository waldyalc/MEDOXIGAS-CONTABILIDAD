"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { BookOpen, Loader2 } from "@/components/icons";
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
import { contabilizarPeriodo } from "@/lib/nomina/acciones";

import { RUTA_ASIENTOS } from "./comun-nomina";

interface Props {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  periodoId: string;
  periodoCodigo: string;
  fecha: string;
  recibos: number;
  total: string;
}

export function DialogoContabilizarPeriodo({
  abierto,
  onOpenChange,
  periodoId,
  periodoCodigo,
  fecha,
  recibos,
  total,
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
      const resultado = await contabilizarPeriodo(periodoId);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      onOpenChange(false);
      toast.add({
        type: "success",
        title: `${resultado.asientos} comprobantes NO creados`,
        description: `Periodo ${periodoCodigo} por ${formatoMoneda(resultado.total)}.`,
      });
      router.refresh();
    });
  }

  return (
    <AlertDialog open={abierto} onOpenChange={cambiar}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Contabilizar la nómina</AlertDialogTitle>
          <AlertDialogDescription>
            Se creará un comprobante NO por cada empleado con recibo calculado en el periodo {periodoCodigo}, con fecha{" "}
            {fecha.split("-").reverse().join("/")}. Los recibos ya contabilizados se omiten y el número NO se asigna
            hasta confirmar.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="bg-muted/50 flex flex-col gap-1 rounded-xl px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Recibos por contabilizar</span>
            <span className="font-medium tabular-nums">{recibos}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Total del comprobante</span>
            <span className="font-semibold tabular-nums">{formatoMoneda(total)}</span>
          </div>
        </div>

        <p className="text-muted-foreground text-sm">
          Esta acción no se puede deshacer sin anular los recibos. Si el periodo contable está cerrado, el asiento se
          rechazará con el mensaje del servidor.
        </p>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
          <Button type="button" disabled={pendiente} onClick={confirmar}>
            {pendiente ? <Loader2 className="animate-spin" /> : <BookOpen />}
            Contabilizar
          </Button>
        </AlertDialogFooter>

        <p className="text-muted-foreground text-center text-xs">
          <Link href={RUTA_ASIENTOS} className="text-primary underline-offset-4 hover:underline">
            Ver asientos contables
          </Link>
        </p>
      </AlertDialogContent>
    </AlertDialog>
  );
}

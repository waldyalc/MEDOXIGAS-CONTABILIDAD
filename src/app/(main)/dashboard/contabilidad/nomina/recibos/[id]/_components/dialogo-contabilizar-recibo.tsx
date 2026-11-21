"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { BookOpen, Loader2 } from "lucide-react";

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
import { contabilizarRecibo } from "@/lib/nomina/acciones";

interface Props {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  reciboId: string;
  nombre: string;
  periodo: string;
  fecha: string;
  lineas: number;
  ingresos: string;
  aportes: string;
  provisiones: string;
  total: string;
}

export function DialogoContabilizarRecibo({
  abierto,
  onOpenChange,
  reciboId,
  nombre,
  periodo,
  fecha,
  lineas,
  ingresos,
  aportes,
  provisiones,
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
      const resultado = await contabilizarRecibo(reciboId);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      onOpenChange(false);
      toast.add({
        type: "success",
        title: "Comprobante NO creado",
        description: `Recibo de ${nombre} por ${formatoMoneda(total)}. Consulta el código NO en el recibo.`,
      });
      router.refresh();
    });
  }

  return (
    <AlertDialog open={abierto} onOpenChange={cambiar}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Contabilizar el recibo de {nombre}</AlertDialogTitle>
          <AlertDialogDescription>
            Se creará un comprobante NO con fecha {fecha.split("-").reverse().join("/")}. El número se asigna al
            confirmar.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="bg-muted/50 flex flex-col gap-1 rounded-xl px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Periodo</span>
            <span className="font-mono text-xs">{periodo}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Líneas del comprobante</span>
            <span className="font-medium tabular-nums">{lineas}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Ingresos</span>
            <span className="tabular-nums">{formatoMoneda(ingresos)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Aportes patronales</span>
            <span className="tabular-nums">{formatoMoneda(aportes)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Provisiones</span>
            <span className="tabular-nums">{formatoMoneda(provisiones)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-4 border-t pt-2">
            <span className="font-medium">Total del comprobante</span>
            <span className="font-semibold tabular-nums">{formatoMoneda(total)}</span>
          </div>
        </div>

        <p className="text-muted-foreground text-sm">
          Si el mapeo contable o la cuenta de salarios por pagar están incompletos, o el periodo contable está cerrado,
          el servidor devolverá el mensaje exacto.
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
          <Link
            href="/dashboard/configuracion/nomina/laboral"
            className="text-primary underline-offset-4 hover:underline"
          >
            Configuración · Datos laborales
          </Link>
          {" · "}
          <Link
            href="/dashboard/configuracion/nomina/mapeo"
            className="text-primary underline-offset-4 hover:underline"
          >
            Mapeo contable
          </Link>
        </p>
      </AlertDialogContent>
    </AlertDialog>
  );
}

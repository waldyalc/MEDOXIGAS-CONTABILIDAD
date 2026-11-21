"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Ban, Loader2, Pencil } from "lucide-react";

import { type ColumnaLista, PillEstado, TablaLista } from "@/components/listas/tabla-lista";
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
import { toast } from "@/components/ui/toast";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { eliminarNovedadRecurrente } from "@/lib/nomina/acciones";
import type { NovedadRecurrente } from "@/lib/nomina/tipos";

import { formatoFecha, formatoPorcentaje } from "../../_components/formato-nomina";

function valorDe(novedad: NovedadRecurrente): string {
  if (novedad.porcentaje !== null) return `${formatoPorcentaje(novedad.porcentaje)} del salario`;
  return formatoMoneda(novedad.monto);
}

function AccionesNovedad({ novedad }: { novedad: NovedadRecurrente }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, iniciar] = useTransition();

  function apagar() {
    iniciar(async () => {
      const resultado = await eliminarNovedadRecurrente(novedad.id);

      if (!resultado.ok) {
        toast.add({ type: "error", title: "No se pudo apagar la novedad", description: resultado.error });
        return;
      }

      setAbierto(false);
      toast.add({ type: "success", title: "Novedad apagada." });
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Apagar ${novedad.concepto_nombre}`}
        disabled={pendiente}
        onClick={() => setAbierto(true)}
      >
        <Ban />
      </Button>

      <AlertDialog open={abierto} onOpenChange={setAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Apagar esta novedad?</AlertDialogTitle>
            <AlertDialogDescription>
              No se borra: deja de aplicarse en los próximos periodos. Puedes volver a activarla editándola.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pendiente} onClick={apagar}>
              {pendiente ? <Loader2 className="animate-spin" /> : null}
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function TablaNovedades({
  novedades,
  puedeEscribir,
  onEditar,
}: {
  novedades: readonly NovedadRecurrente[];
  puedeEscribir: boolean;
  onEditar: (novedad: NovedadRecurrente) => void;
}) {
  const columnas: readonly ColumnaLista<NovedadRecurrente>[] = [
    {
      clave: "concepto",
      encabezado: "Concepto",
      celda: (novedad) => (
        <div className="flex flex-col">
          <span className="font-medium">{novedad.concepto_nombre}</span>
          <span className="text-muted-foreground font-mono text-xs">{novedad.concepto_codigo}</span>
        </div>
      ),
    },
    {
      clave: "clase",
      encabezado: "Clase",
      celda: (novedad) => (
        <PillEstado tono={novedad.clase === "ingreso" ? "info" : "neutro"}>
          {novedad.clase === "ingreso" ? "Ingreso" : "Deducción"}
        </PillEstado>
      ),
    },
    {
      clave: "valor",
      encabezado: "Valor",
      alineacion: "derecha",
      celda: valorDe,
    },
    {
      clave: "vigencia",
      encabezado: "Vigencia",
      celda: (novedad) => (
        <div className="flex flex-col text-xs">
          <span>Desde {formatoFecha(novedad.fecha_inicio)}</span>
          <span className="text-muted-foreground">
            {novedad.fecha_fin ? `Hasta ${formatoFecha(novedad.fecha_fin)}` : "Sin fin"}
          </span>
        </div>
      ),
    },
    {
      clave: "estado",
      encabezado: "Estado",
      celda: (novedad) => (
        <PillEstado tono={novedad.activa ? "exito" : "neutro"}>{novedad.activa ? "Activa" : "Inactiva"}</PillEstado>
      ),
    },
  ];

  return (
    <TablaLista
      columnas={columnas}
      filas={novedades}
      claveFila={(novedad) => novedad.id}
      densidad="compacta"
      acciones={
        puedeEscribir
          ? (novedad) => (
              <div className="flex items-center justify-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Editar ${novedad.concepto_nombre}`}
                  onClick={() => onEditar(novedad)}
                >
                  <Pencil />
                </Button>
                {novedad.activa ? <AccionesNovedad novedad={novedad} /> : null}
              </div>
            )
          : undefined
      }
      vacio={{
        titulo: "No tiene novedades recurrentes.",
        descripcion: "Agrega un préstamo, un bono fijo o una pensión alimenticia.",
      }}
    />
  );
}

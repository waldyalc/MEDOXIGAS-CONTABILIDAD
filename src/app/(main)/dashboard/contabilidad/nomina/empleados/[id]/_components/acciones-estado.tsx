"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { DatePicker } from "@/components/date-picker";
import { EllipsisVertical, Loader2, PauseCircle, RotateCcw, UserX } from "@/components/icons";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { hoyRD } from "@/lib/facturacion/formato";
import { cambiarEstadoEmpleado } from "@/lib/nomina/acciones";
import type { Empleado } from "@/lib/nomina/tipos";

import { formatoFecha } from "../../_components/formato-nomina";

type Accion = "suspender" | "inactivo" | "reactivar";

const TITULO: Record<Accion, string> = {
  suspender: "¿Suspender a",
  inactivo: "¿Marcar inactivo a",
  reactivar: "¿Reactivar a",
};

const CONFIRMAR: Record<Accion, string> = {
  suspender: "Suspender",
  inactivo: "Marcar inactivo",
  reactivar: "Reactivar",
};

const EXITO: Record<Accion, string> = {
  suspender: "Empleado suspendido.",
  inactivo: "Empleado marcado inactivo.",
  reactivar: "Empleado reactivado.",
};

function validarAccion(
  accion: Accion,
  fechaFin: string,
  hoy: string,
  fechaIngreso: string,
  esDefinido: boolean,
): string | null {
  if (accion === "inactivo" && fechaFin !== "" && fechaFin < fechaIngreso) {
    return "La fecha de salida no puede ser anterior a la fecha de ingreso.";
  }
  if (accion === "reactivar" && esDefinido) {
    if (fechaFin === "") return "El contrato definido necesita una fecha de fin.";
    if (fechaFin <= hoy) return "La fecha de fin debe ser futura para un contrato definido.";
  }
  return null;
}

function entradaDe(accion: Accion, fechaFin: string) {
  if (accion === "suspender") return { estado: "suspendido" as const };
  if (accion === "inactivo") return { estado: "inactivo" as const, fecha_fin: fechaFin };
  return { estado: "activo" as const, fecha_fin: fechaFin };
}

function descripcionDe(accion: Accion | null, esDefinido: boolean): string {
  if (accion === "suspender") return "No se incluirá en periodos nuevos, pero su historial se conserva.";
  if (accion === "inactivo") {
    return "No se borra: deja de aparecer en periodos nuevos y su historial se conserva.";
  }
  if (accion === "reactivar" && esDefinido) return "Indica una nueva fecha de fin futura para el contrato.";
  return "Volverá a incluirse en los periodos nuevos.";
}

export function AccionesEstado({ empleado }: { empleado: Empleado }) {
  const router = useRouter();
  const hoy = hoyRD();
  const [accion, setAccion] = useState<Accion | null>(null);
  const [fechaFin, setFechaFin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const esDefinido = empleado.tipo_contrato === "definido";

  function abrir(siguiente: Accion) {
    setAccion(siguiente);
    setFechaFin(siguiente === "inactivo" ? hoy : "");
    setError(null);
  }

  function cerrar() {
    if (pendiente) return;
    setAccion(null);
    setError(null);
  }

  function confirmar() {
    if (!accion) return;

    const mensaje = validarAccion(accion, fechaFin, hoy, empleado.fecha_ingreso, esDefinido);
    if (mensaje) {
      setError(mensaje);
      return;
    }

    const accionActual = accion;
    const entrada = entradaDe(accionActual, fechaFin);
    setError(null);

    iniciar(async () => {
      const resultado = await cambiarEstadoEmpleado(empleado.id, entrada);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setAccion(null);
      toast.add({ type: "success", title: EXITO[accionActual] });
      router.refresh();
    });
  }

  const descripcion = descripcionDe(accion, esDefinido);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Más acciones del empleado" />}>
          <EllipsisVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {empleado.estado !== "activo" ? (
            <DropdownMenuItem onClick={() => abrir("reactivar")}>
              <RotateCcw />
              Reactivar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => abrir("suspender")}>
              <PauseCircle />
              Suspender
            </DropdownMenuItem>
          )}
          {empleado.estado !== "inactivo" ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => abrir("inactivo")}>
                <UserX />
                Marcar inactivo
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={accion !== null} onOpenChange={(abierto) => (abierto ? undefined : cerrar())}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{accion ? `${TITULO[accion]} ${empleado.nombre_completo}?` : ""}</AlertDialogTitle>
            <AlertDialogDescription>{descripcion}</AlertDialogDescription>
          </AlertDialogHeader>

          {accion === "inactivo" ? (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Fecha de salida</span>
              <DatePicker value={fechaFin} onChange={setFechaFin} placeholder={formatoFecha(hoy)} />
              <span className="text-muted-foreground text-xs">Si no la indicas, se usa la fecha de hoy.</span>
            </div>
          ) : null}

          {accion === "reactivar" && esDefinido ? (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Nueva fecha de fin</span>
              <DatePicker value={fechaFin} onChange={setFechaFin} placeholder="Seleccionar fecha" />
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant={accion === "inactivo" ? "destructive" : "default"}
              disabled={pendiente}
              onClick={confirmar}
            >
              {pendiente ? <Loader2 className="animate-spin" /> : null}
              {accion ? CONFIRMAR[accion] : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

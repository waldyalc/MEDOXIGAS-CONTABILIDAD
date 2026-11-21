"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ArrowRightLeft,
  Ban,
  CheckCircle2,
  ChevronDown,
  CircleArrowDown,
  CircleArrowUp,
  Loader2,
  MoreVertical,
  Scale,
  Trash2,
} from "@/components/icons";
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
import type { CuentaSeleccion } from "@/lib/bancos/tipos";
import { actualizarCuenta } from "@/lib/contabilidad/acciones";
import type { CuentaEditable } from "@/lib/contabilidad/validacion";

import { DialogoTransferencia } from "../../_components/acciones-bancos";

interface Props {
  cuenta: CuentaEditable;
  cuentasCajaBanco: CuentaSeleccion[];
  puedeEscribir: boolean;
  fechaHoy: string;
}

/** Menú ⋮ + papelera + "Conciliar" de la ficha de cuenta bancaria. */
export function AccionesCuenta({ cuenta, cuentasCajaBanco, puedeEscribir, fechaHoy }: Props) {
  const router = useRouter();
  const [transferirAbierto, setTransferirAbierto] = useState(false);
  const [desactivarAbierto, setDesactivarAbierto] = useState(false);
  const [pendiente, iniciar] = useTransition();

  const urlConciliaciones = `/dashboard/bancos/conciliaciones?cuenta=${cuenta.id}`;
  const urlNuevaConciliacion = `/dashboard/bancos/conciliaciones/nueva?cuenta=${cuenta.id}`;

  function cambiarActiva(activar: boolean) {
    const datos = new FormData();
    datos.set("codigo", cuenta.codigo);
    datos.set("nombre", cuenta.nombre);
    datos.set("tipo", cuenta.tipo);
    datos.set("naturaleza", cuenta.naturaleza);
    datos.set("padre_id", cuenta.padre_id ?? "");
    datos.set("acepta_movimientos", String(cuenta.acepta_movimientos));
    datos.set("es_caja_banco", String(cuenta.es_caja_banco));
    datos.set("activa", String(activar));

    iniciar(async () => {
      const resultado = await actualizarCuenta(cuenta.id, datos);
      if (!resultado.ok) {
        toast.add({ type: "error", title: "No se pudo actualizar la cuenta", description: resultado.error });
        return;
      }
      toast.add({
        type: "success",
        title: activar ? "Cuenta activada" : "Cuenta desactivada",
        description: cuenta.nombre,
      });
      setDesactivarAbierto(false);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Acciones de la cuenta" />}>
          <MoreVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {puedeEscribir ? (
            <>
              <DropdownMenuItem onClick={() => router.push(`/dashboard/pagos-recibidos/nuevo?cuenta=${cuenta.id}`)}>
                <CircleArrowDown />
                Crear pago recibido
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/dashboard/compras/pagos/nuevo?cuenta=${cuenta.id}`)}>
                <CircleArrowUp />
                Crear nuevo pago
              </DropdownMenuItem>
              <DropdownMenuItem disabled={cuentasCajaBanco.length < 2} onClick={() => setTransferirAbierto(true)}>
                <ArrowRightLeft />
                Transferir
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuItem onClick={() => router.push(urlConciliaciones)}>
            <Scale />
            Ver conciliaciones
          </DropdownMenuItem>
          {puedeEscribir ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDesactivarAbierto(true)}>
                {cuenta.activa ? <Ban /> : <CheckCircle2 />}
                {cuenta.activa ? "Desactivar" : "Activar"}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {puedeEscribir && cuenta.activa ? (
        <Button variant="outline" size="icon" aria-label="Desactivar cuenta" onClick={() => setDesactivarAbierto(true)}>
          <Trash2 />
        </Button>
      ) : null}

      {puedeEscribir ? (
        <div className="flex items-center">
          <Button render={<Link href={urlNuevaConciliacion} prefetch={false} />} className="rounded-r-none">
            <Scale />
            Conciliar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label="Opciones de conciliación"
                  className="rounded-l-none border-l border-white/25 px-2"
                />
              }
            >
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(urlNuevaConciliacion)}>Nueva conciliación</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(urlConciliaciones)}>Ver conciliaciones</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}

      {puedeEscribir ? (
        <DialogoTransferencia
          cuentas={cuentasCajaBanco}
          fechaHoy={fechaHoy}
          origenInicial={cuenta.id}
          abierto={transferirAbierto}
          onAbiertoChange={setTransferirAbierto}
        />
      ) : null}

      <AlertDialog open={desactivarAbierto} onOpenChange={setDesactivarAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{cuenta.activa ? "¿Desactivar la cuenta?" : "¿Activar la cuenta?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {cuenta.activa
                ? `"${cuenta.nombre}" dejará de estar disponible para nuevos movimientos; su historial no se borra.`
                : `"${cuenta.nombre}" vuelve a estar disponible para nuevos movimientos.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant={cuenta.activa ? "destructive" : "default"}
              disabled={pendiente}
              onClick={() => cambiarActiva(!cuenta.activa)}
            >
              {pendiente ? <Loader2 className="animate-spin" /> : null}
              {cuenta.activa ? "Desactivar" : "Activar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

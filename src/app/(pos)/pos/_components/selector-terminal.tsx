"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Loader2, Store } from "@/components/icons";
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
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

import { seleccionarTerminalPOS } from "./acciones-pos";
import { useCarritoPOS } from "./carrito-pos-provider";

export function SelectorTerminal({
  terminales,
  activa,
  colapsado = false,
}: {
  terminales: { id: string; nombre: string }[];
  activa: { id: string; nombre: string };
  /** Riel de 56 px del menú del POS: solo el icono de la terminal. */
  colapsado?: boolean;
}) {
  const router = useRouter();
  const { hayLineas } = useCarritoPOS();
  const [pendiente, setPendiente] = useState(false);
  const [confirmar, setConfirmar] = useState<string | null>(null);

  async function cambiar(terminalId: string) {
    setPendiente(true);
    try {
      const resultado = await seleccionarTerminalPOS(terminalId);
      if (!resultado.ok) {
        toast.add({ type: "error", title: "No se pudo cambiar la terminal", description: resultado.error });
        return;
      }
      router.refresh();
    } catch {
      toast.add({
        type: "error",
        title: "No se pudo cambiar la terminal",
        description: "Revisa tu conexión e inténtalo de nuevo.",
      });
    } finally {
      setPendiente(false);
      setConfirmar(null);
    }
  }

  if (colapsado) {
    return (
      <div className="flex h-8 w-full items-center justify-center" title={`Terminal: ${activa.nombre}`}>
        <Store
          className="dark:text-sidebar-foreground/50 size-5 shrink-0 stroke-[1.6] text-slate-400"
          aria-hidden="true"
        />
      </div>
    );
  }

  if (terminales.length <= 1) {
    return (
      <div className="dark:text-sidebar-foreground/85 flex h-8 items-center gap-2 rounded-[6px] px-2 text-sm text-slate-700">
        <Store
          className="dark:text-sidebar-foreground/50 size-5 shrink-0 stroke-[1.6] text-slate-400"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate">{activa.nombre}</span>
        <Badge variant="secondary">Terminal</Badge>
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        <Select
          items={terminales.map((terminal) => ({ value: terminal.id, label: terminal.nombre }))}
          value={activa.id}
          onValueChange={(valor) => {
            if (!valor || valor === activa.id) return;
            if (hayLineas) {
              setConfirmar(valor);
              return;
            }
            void cambiar(valor);
          }}
          disabled={pendiente}
        >
          <SelectTrigger className="h-9 w-full" aria-label="Terminal activa">
            <Store className="text-muted-foreground size-4" aria-hidden="true" />
            <SelectValue />
            {pendiente ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {terminales.map((terminal) => (
              <SelectItem key={terminal.id} value={terminal.id}>
                {terminal.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AlertDialog open={confirmar !== null} onOpenChange={(abierto) => (abierto ? null : setConfirmar(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar de terminal?</AlertDialogTitle>
            <AlertDialogDescription>
              El carrito se vaciará porque cambian el almacén, la numeración y las cuentas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={pendiente} onClick={() => (confirmar ? void cambiar(confirmar) : null)}>
              {pendiente ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Cambiar y vaciar carrito
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

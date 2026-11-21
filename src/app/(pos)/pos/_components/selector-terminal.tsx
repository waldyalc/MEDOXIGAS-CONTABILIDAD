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
}: {
  terminales: { id: string; nombre: string }[];
  activa: { id: string; nombre: string };
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

  if (terminales.length <= 1) {
    return (
      <div className="flex h-10 items-center gap-2 rounded-lg border border-transparent px-1">
        <Store className="text-muted-foreground size-4" aria-hidden="true" />
        <span className="max-w-[160px] truncate text-sm font-medium">{activa.nombre}</span>
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
          <SelectTrigger className="h-10 w-[190px]" aria-label="Terminal activa">
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

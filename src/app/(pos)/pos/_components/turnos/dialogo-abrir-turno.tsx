"use client";

import { useEffect, useState } from "react";

import { Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { abrirTurno } from "@/lib/pos/acciones";
import type { AperturaTurnoPOS } from "@/lib/pos/tipos";

import { capitalizar, textoAMonto } from "../formato-pos";

export function DialogoAbrirTurno({
  abierto,
  onCerrar,
  terminal,
  turnoActual,
  onAbierto,
}: {
  abierto: boolean;
  onCerrar: () => void;
  terminal: { id: string; nombre: string };
  turnoActual: number | null;
  onAbierto: (datos: AperturaTurnoPOS) => void;
}) {
  const [base, setBase] = useState("0.00");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setBase("0.00");
    setObservaciones("");
    setError(null);
  }, [abierto]);

  async function abrir() {
    const monto = textoAMonto(base);
    if (monto === null || Number(monto) < 0) {
      setError("La base inicial no puede ser negativa.");
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      const resultado = await abrirTurno({
        terminal_id: terminal.id,
        base_inicial: monto,
        ...(observaciones.trim() ? { observaciones: observaciones.trim() } : {}),
      });

      if (!resultado.ok) {
        setError(capitalizar(resultado.error));
        return;
      }

      toast.add({ type: "success", title: "Turno abierto." });
      onAbierto(resultado.data);
      onCerrar();
    } catch {
      setError("No sabemos si el turno se abrió. Revisa Turnos antes de intentarlo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(nuevo) => (nuevo ? null : onCerrar())}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Abrir turno</DialogTitle>
          <DialogDescription>{terminal.nombre}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {turnoActual !== null ? (
            <Alert>
              <AlertDescription>
                {`Ya hay un turno abierto (No ${turnoActual}). Ciérralo antes de abrir otro.`}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-1">
            <Label htmlFor="base-inicial">Base inicial</Label>
            <InputGroup className="h-10">
              <InputGroupAddon>
                <InputGroupText>RD$</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="base-inicial"
                value={base}
                inputMode="decimal"
                onChange={(evento) => setBase(evento.target.value)}
              />
            </InputGroup>
            <p className="text-muted-foreground text-xs">
              Es el efectivo que ya está en el cajón. No genera asiento contable.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="observaciones-turno">Observaciones</Label>
            <Textarea
              id="observaciones-turno"
              value={observaciones}
              maxLength={500}
              onChange={(evento) => setObservaciones(evento.target.value)}
            />
          </div>

          <p className="text-muted-foreground text-xs">
            Un turno abierto por terminal. Si ya hay uno, ciérralo antes de abrir otro.
          </p>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button className="h-12" onClick={() => void abrir()} disabled={enviando || turnoActual !== null}>
            {enviando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {enviando ? "Abriendo turno…" : "Abrir turno"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

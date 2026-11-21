"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { DatePicker } from "@/components/date-picker";
import { FormField } from "@/components/formularios/formulario";
import { Loader2, Wallet } from "@/components/icons";
import { SelectCampo } from "@/components/select-campo";
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
import { toast } from "@/components/ui/toast";
import { formatoMoneda, hoyRD } from "@/lib/facturacion/formato";
import type { CuentaCajaBanco } from "@/lib/facturacion/tipos";
import { pagarRecibo } from "@/lib/nomina/acciones";

interface Props {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  reciboId: string;
  nombre: string;
  neto: string;
  cuentas: readonly CuentaCajaBanco[];
  cuentaDefecto: string | null;
  cuentaSalarios: string | null;
}

export function DialogoPagarRecibo({
  abierto,
  onOpenChange,
  reciboId,
  nombre,
  neto,
  cuentas,
  cuentaDefecto,
  cuentaSalarios,
}: Props) {
  const router = useRouter();
  const [fecha, setFecha] = useState(hoyRD());
  const [cuenta, setCuenta] = useState(
    cuentaDefecto && cuentas.some((opcion) => opcion.id === cuentaDefecto) ? cuentaDefecto : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const cuentaElegida = cuentas.find((opcion) => opcion.id === cuenta);
  const netoCero = Number(neto) === 0;

  function cambiar(abrir: boolean) {
    if (pendiente) return;
    if (!abrir) setError(null);
    onOpenChange(abrir);
  }

  function confirmar() {
    setError(null);
    if (!cuenta) {
      setError("Selecciona la cuenta con la que se paga la nómina.");
      return;
    }

    iniciar(async () => {
      const resultado = await pagarRecibo({ recibo_id: reciboId, fecha, cuenta_pago_id: cuenta });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      onOpenChange(false);
      toast.add({
        type: "success",
        title: "Recibo pagado",
        description:
          resultado.asientoId == null
            ? "El recibo quedó pagado sin asiento de pago porque su neto es 0."
            : `Se creó el asiento de pago por ${formatoMoneda(neto)}.`,
      });
      router.refresh();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={cambiar}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pagar el recibo de {nombre}</DialogTitle>
          <DialogDescription>
            Se debitará Salarios por pagar y se acreditará la cuenta elegida por {formatoMoneda(neto)}.
            {netoCero ? " Como el neto es 0, no se creará asiento de pago." : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <FormField htmlFor="pago-recibo-fecha" label="Fecha de pago" required>
            <DatePicker id="pago-recibo-fecha" value={fecha} onChange={setFecha} />
          </FormField>

          <FormField htmlFor="pago-recibo-cuenta" label="Cuenta de pago" required>
            <SelectCampo
              id="pago-recibo-cuenta"
              buscable
              opciones={cuentas.map((opcion) => ({ value: opcion.id, label: `${opcion.codigo} — ${opcion.nombre}` }))}
              valor={cuenta}
              onCambio={setCuenta}
              etiquetaVacia="Selecciona la cuenta"
            />
          </FormField>

          <div className="bg-muted/50 flex flex-col gap-1 rounded-xl px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Cuenta de salarios por pagar</span>
              <span className="font-medium">{cuentaSalarios ?? "2107 · Salarios por pagar"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Cuenta de pago</span>
              <span className="font-medium">
                {cuentaElegida ? `${cuentaElegida.codigo} — ${cuentaElegida.nombre}` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Neto</span>
              <span className="font-semibold tabular-nums">{formatoMoneda(neto)}</span>
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={pendiente} onClick={() => cambiar(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={pendiente} onClick={confirmar}>
            {pendiente ? <Loader2 className="animate-spin" /> : <Wallet />}
            Pagar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

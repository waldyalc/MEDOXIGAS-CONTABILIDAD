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
import { pagarPeriodo } from "@/lib/nomina/acciones";

interface Props {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  periodoId: string;
  periodoCodigo: string;
  recibos: number;
  total: string;
  cuentas: readonly CuentaCajaBanco[];
  cuentaDefecto: string | null;
  conNetoCero: number;
}

export function DialogoPagarPeriodo({
  abierto,
  onOpenChange,
  periodoId,
  periodoCodigo,
  recibos,
  total,
  cuentas,
  cuentaDefecto,
  conNetoCero,
}: Props) {
  const router = useRouter();
  const [fecha, setFecha] = useState(hoyRD());
  const [cuenta, setCuenta] = useState(
    cuentaDefecto && cuentas.some((opcion) => opcion.id === cuentaDefecto) ? cuentaDefecto : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const cuentaElegida = cuentas.find((opcion) => opcion.id === cuenta);

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
      const resultado = await pagarPeriodo({
        periodo_id: periodoId,
        fecha,
        cuenta_pago_id: cuenta,
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      onOpenChange(false);
      toast.add({
        type: "success",
        title: `${resultado.recibos} recibos pagados`,
        description: `Total pagado ${formatoMoneda(resultado.totalPagado)}.`,
      });
      router.refresh();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={cambiar}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pagar la nómina del periodo</DialogTitle>
          <DialogDescription>
            Se pagarán {recibos} recibos contabilizados del periodo {periodoCodigo} por un total de{" "}
            {formatoMoneda(total)}. Se debitará Salarios por pagar y se acreditará la cuenta elegida.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <FormField htmlFor="pago-periodo-fecha" label="Fecha de pago" required>
            <DatePicker id="pago-periodo-fecha" value={fecha} onChange={setFecha} />
          </FormField>

          <FormField htmlFor="pago-periodo-cuenta" label="Cuenta de pago" required>
            <SelectCampo
              id="pago-periodo-cuenta"
              buscable
              opciones={cuentas.map((opcion) => ({ value: opcion.id, label: `${opcion.codigo} — ${opcion.nombre}` }))}
              valor={cuenta}
              onCambio={setCuenta}
              etiquetaVacia="Selecciona la cuenta"
            />
          </FormField>

          <div className="bg-muted/50 flex flex-col gap-1 rounded-xl px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Recibos</span>
              <span className="font-medium tabular-nums">{recibos}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Total a pagar</span>
              <span className="font-semibold tabular-nums">{formatoMoneda(total)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Cuenta</span>
              <span className="font-medium">
                {cuentaElegida ? `${cuentaElegida.codigo} — ${cuentaElegida.nombre}` : "—"}
              </span>
            </div>
          </div>

          {conNetoCero > 0 ? (
            <p className="text-muted-foreground text-xs">
              {conNetoCero === 1 ? "Un recibo tiene" : `${conNetoCero} recibos tienen`} neto 0: quedan pagados sin
              asiento de pago.
            </p>
          ) : null}

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
            Pagar {recibos} recibos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

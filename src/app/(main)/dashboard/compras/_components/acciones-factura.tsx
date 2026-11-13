"use client";

import { type FormEvent, useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { toast } from "@/components/ui/toast";
import { anularFacturaProveedor, registrarPagoProveedor } from "@/lib/compras/acciones";
import { aNumero } from "@/lib/compras/calculo";
import { hoyEnRd } from "@/lib/compras/fechas";
import { formatoMoneda } from "@/lib/compras/formato";
import type { CuentaOpcion, EstadoDocumento, MetodoPago } from "@/lib/compras/tipos";

const METODOS: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "transferencia", etiqueta: "Transferencia" },
  { valor: "tarjeta", etiqueta: "Tarjeta" },
  { valor: "cheque", etiqueta: "Cheque" },
];

interface DialogoPagoProps {
  facturaId: string;
  numero: number;
  saldo: number;
  cuentas: CuentaOpcion[];
}

function DialogoPago({ facturaId, numero, saldo, cuentas }: DialogoPagoProps) {
  const cuentaPredeterminada = cuentas.length === 1 ? (cuentas[0]?.id ?? "") : "";
  const sinCuentas = cuentas.length === 0;

  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(hoyEnRd);
  const [cuentaId, setCuentaId] = useState(cuentaPredeterminada);
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [monto, setMonto] = useState(() => saldo.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function reiniciar() {
    setFecha(hoyEnRd());
    setCuentaId(cuentaPredeterminada);
    setMetodo("efectivo");
    setMonto(saldo.toFixed(2));
    setError(null);
  }

  function cambiarAbierto(abrir: boolean) {
    if (abrir) reiniciar();
    setAbierto(abrir);
  }

  function cambiarMetodo(valor: string) {
    const opcion = METODOS.find((item) => item.valor === valor);
    if (opcion) setMetodo(opcion.valor);
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    if (!cuentaId) {
      setError("Selecciona una cuenta de caja o banco.");
      return;
    }

    if (aNumero(monto) <= 0) {
      setError("El monto debe ser mayor que 0.");
      return;
    }

    iniciar(async () => {
      const resultado = await registrarPagoProveedor({
        factura_proveedor_id: facturaId,
        fecha,
        cuenta_id: cuentaId,
        metodo,
        monto: aNumero(monto),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      if (resultado.aviso) {
        toast.add({ type: "warning", title: "Saldo negativo", description: resultado.aviso });
      }

      setAbierto(false);
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={cambiarAbierto}>
      <DialogTrigger render={<Button disabled={pendiente} />}>Registrar pago</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            Factura #{numero} · Saldo {formatoMoneda(saldo)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pago-fecha">Fecha *</Label>
            <Input
              id="pago-fecha"
              type="date"
              value={fecha}
              onChange={(evento) => setFecha(evento.target.value)}
              required
              disabled={pendiente}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pago-cuenta">Cuenta *</Label>
            <NativeSelect
              id="pago-cuenta"
              className="w-full"
              value={cuentaId}
              onChange={(evento) => setCuentaId(evento.target.value)}
              required
              disabled={pendiente || sinCuentas}
            >
              <NativeSelectOption value="">Selecciona una cuenta…</NativeSelectOption>
              {cuentas.map((cuenta) => (
                <NativeSelectOption key={cuenta.id} value={cuenta.id}>
                  {cuenta.codigo} · {cuenta.nombre}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {sinCuentas ? (
            <Alert variant="destructive">
              <AlertDescription>No hay cuentas de caja o banco configuradas.</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pago-metodo">Método *</Label>
              <NativeSelect
                id="pago-metodo"
                className="w-full"
                value={metodo}
                onChange={(evento) => cambiarMetodo(evento.target.value)}
                disabled={pendiente}
              >
                {METODOS.map((opcion) => (
                  <NativeSelectOption key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pago-monto">Monto *</Label>
              <Input
                id="pago-monto"
                inputMode="decimal"
                value={monto}
                onChange={(evento) => setMonto(evento.target.value)}
                required
                disabled={pendiente}
              />
            </div>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pendiente} />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pendiente || sinCuentas}>
              {pendiente ? "Registrando…" : "Registrar pago"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DialogoAnularProps {
  facturaId: string;
  numero: number;
}

function DialogoAnular({ facturaId, numero }: DialogoAnularProps) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function cambiarAbierto(abrir: boolean) {
    setAbierto(abrir);
    if (!abrir) setError(null);
  }

  function confirmar() {
    setError(null);

    iniciar(async () => {
      const resultado = await anularFacturaProveedor(facturaId);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setAbierto(false);
    });
  }

  return (
    <AlertDialog open={abierto} onOpenChange={cambiarAbierto}>
      <AlertDialogTrigger render={<Button variant="destructive" disabled={pendiente} />}>Anular</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Anular la factura #{numero}?</AlertDialogTitle>
          <AlertDialogDescription>Se revertirá su asiento e inventario.</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pendiente} onClick={confirmar}>
            {pendiente ? "Anulando…" : "Anular factura"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface AccionesFacturaProps {
  facturaId: string;
  numero: number;
  estado: EstadoDocumento;
  saldo: number;
  cuentas: CuentaOpcion[];
  puedeRegistrarPago: boolean;
  puedeAnular: boolean;
}

export function AccionesFactura({
  facturaId,
  numero,
  estado,
  saldo,
  cuentas,
  puedeRegistrarPago,
  puedeAnular,
}: AccionesFacturaProps) {
  const mostrarPago = puedeRegistrarPago && estado === "abierta";
  const mostrarAnular = puedeAnular && estado !== "anulada";

  if (!mostrarPago && !mostrarAnular) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {mostrarPago ? <DialogoPago facturaId={facturaId} numero={numero} saldo={saldo} cuentas={cuentas} /> : null}
      {mostrarAnular ? <DialogoAnular facturaId={facturaId} numero={numero} /> : null}
    </div>
  );
}

"use client";

import { type FormEvent, useState, useTransition } from "react";

import { ChevronDown } from "lucide-react";

import { DatePicker } from "@/components/date-picker";
import { RetencionesCampo } from "@/components/retenciones/retenciones-campo";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { anularFacturaProveedor, registrarPagoProveedor } from "@/lib/compras/acciones";
import { aNumero } from "@/lib/compras/calculo";
import { hoyEnRd } from "@/lib/compras/fechas";
import { formatoMoneda } from "@/lib/compras/formato";
import type { CuentaOpcion, EstadoDocumento, MetodoPago } from "@/lib/compras/tipos";
import type { RetencionOpcion } from "@/lib/configuracion/tipos";
import { calcularRetenciones, totalRetenido } from "@/lib/retenciones/calculo";

const METODOS: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "transferencia", etiqueta: "Transferencia" },
  { valor: "tarjeta", etiqueta: "Tarjeta" },
  { valor: "cheque", etiqueta: "Cheque" },
];

const OPCIONES_METODO = METODOS.map((metodo) => ({ value: metodo.valor, label: metodo.etiqueta }));

interface DialogoPagoProps {
  facturaId: string;
  numero: number;
  saldo: number;
  subtotal: number;
  itbis: number;
  cuentas: CuentaOpcion[];
  retenciones: RetencionOpcion[];
}

function DialogoPago({ facturaId, numero, saldo, subtotal, itbis, cuentas, retenciones }: DialogoPagoProps) {
  const cuentaPredeterminada = cuentas.length === 1 ? (cuentas[0]?.id ?? "") : "";
  const sinCuentas = cuentas.length === 0;

  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(hoyEnRd);
  const [cuentaId, setCuentaId] = useState(cuentaPredeterminada);
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [monto, setMonto] = useState(() => saldo.toFixed(2));
  const [retencionesIds, setRetencionesIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const base = { subtotal, itbis };
  const retenido = totalRetenido(calcularRetenciones(retencionesIds, retenciones, base));
  const opcionesCuentas = cuentas.map((cuenta) => ({ value: cuenta.id, label: `${cuenta.codigo} · ${cuenta.nombre}` }));

  function reiniciar() {
    setFecha(hoyEnRd());
    setCuentaId(cuentaPredeterminada);
    setMetodo("efectivo");
    setMonto(saldo.toFixed(2));
    setRetencionesIds([]);
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

  function cambiarRetenciones(ids: string[]) {
    setRetencionesIds(ids);
    const nuevoRetenido = totalRetenido(calcularRetenciones(ids, retenciones, base));
    setMonto(Math.max(0, Math.round((saldo - nuevoRetenido) * 100) / 100).toFixed(2));
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

    if (Math.round((aNumero(monto) + retenido) * 100) > Math.round(saldo * 100)) {
      setError("El monto más las retenciones no puede superar el saldo de la factura.");
      return;
    }

    iniciar(async () => {
      const resultado = await registrarPagoProveedor({
        factura_proveedor_id: facturaId,
        fecha,
        cuenta_id: cuentaId,
        metodo,
        monto: aNumero(monto),
        retenciones: retencionesIds.map((id) => ({ retencion_id: id })),
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
            <DatePicker id="pago-fecha" value={fecha} onChange={setFecha} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pago-cuenta">Cuenta *</Label>
            <Select
              items={opcionesCuentas}
              value={cuentaId || null}
              onValueChange={(valor: string | null) => setCuentaId(valor ?? "")}
            >
              <SelectTrigger id="pago-cuenta" className="w-full" disabled={pendiente || sinCuentas}>
                <SelectValue placeholder="Selecciona una cuenta…" />
              </SelectTrigger>
              <SelectContent>
                {opcionesCuentas.map((cuenta) => (
                  <SelectItem key={cuenta.value} value={cuenta.value}>
                    {cuenta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {sinCuentas ? (
            <Alert variant="destructive">
              <AlertDescription>No hay cuentas de caja o banco configuradas.</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pago-metodo">Método *</Label>
              <Select
                items={[...OPCIONES_METODO]}
                value={metodo}
                onValueChange={(valor: string | null) => cambiarMetodo(valor ?? "")}
              >
                <SelectTrigger id="pago-metodo" className="w-full" disabled={pendiente}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPCIONES_METODO.map((opcion) => (
                    <SelectItem key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium [&[data-panel-open]>svg]:rotate-180">
              Más opciones
              <ChevronDown className="size-4 transition-transform" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pt-2">
                <RetencionesCampo
                  retenciones={retenciones}
                  base={base}
                  seleccionadas={retencionesIds}
                  onCambiar={cambiarRetenciones}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
          <p className="text-muted-foreground text-xs">
            Total aplicado: {formatoMoneda(aNumero(monto) + retenido)} (monto + retenciones)
          </p>
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
  subtotal: number;
  itbis: number;
  cuentas: CuentaOpcion[];
  retenciones: RetencionOpcion[];
  puedeRegistrarPago: boolean;
  puedeAnular: boolean;
}

export function AccionesFactura({
  facturaId,
  numero,
  estado,
  saldo,
  subtotal,
  itbis,
  cuentas,
  retenciones,
  puedeRegistrarPago,
  puedeAnular,
}: AccionesFacturaProps) {
  const mostrarPago = puedeRegistrarPago && estado === "abierta";
  const mostrarAnular = puedeAnular && estado !== "anulada";

  if (!mostrarPago && !mostrarAnular) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {mostrarPago ? (
        <DialogoPago
          facturaId={facturaId}
          numero={numero}
          saldo={saldo}
          subtotal={subtotal}
          itbis={itbis}
          cuentas={cuentas}
          retenciones={retenciones}
        />
      ) : null}
      {mostrarAnular ? <DialogoAnular facturaId={facturaId} numero={numero} /> : null}
    </div>
  );
}

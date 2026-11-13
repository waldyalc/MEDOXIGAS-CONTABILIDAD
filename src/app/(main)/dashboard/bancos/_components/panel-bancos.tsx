"use client";

import { type FormEvent, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowRightLeft, ChevronDown, Loader2, Plus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { registrarDeposito, transferirEntreCuentas } from "@/lib/bancos/acciones";
import { tipoCuenta } from "@/lib/bancos/formato";
import type { CuentaBanco, CuentaSeleccion } from "@/lib/bancos/tipos";
import { validarDeposito, validarTransferencia } from "@/lib/bancos/validacion";
import { rutaCuenta } from "@/lib/enlaces";
import { centavosAValor, parsearCentavos } from "@/lib/facturacion/calculo";
import { centavos, formatearRd } from "@/lib/reportes/dinero";

interface Props {
  cuentas: CuentaBanco[];
  cuentasCajaBanco: CuentaSeleccion[];
  cuentasMovimiento: CuentaSeleccion[];
  puedeEscribir: boolean;
  fechaHoy: string;
}

function opciones(cuentas: CuentaSeleccion[]) {
  return cuentas.map((cuenta) => (
    <NativeSelectOption key={cuenta.id} value={cuenta.id}>
      {cuenta.codigo} · {cuenta.nombre}
    </NativeSelectOption>
  ));
}

function DialogoTransferencia({ cuentas, fechaHoy }: { cuentas: CuentaSeleccion[]; fechaHoy: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(fechaHoy);
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const sinCuentas = cuentas.length < 2;

  function reiniciar() {
    setOrigen("");
    setDestino("");
    setMonto("");
    setFecha(fechaHoy);
    setNotas("");
    setError(null);
  }

  function cambiarAbierto(abrir: boolean) {
    if (abrir) reiniciar();
    setAbierto(abrir);
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    const montoCentavos = parsearCentavos(monto);
    if (montoCentavos === null) {
      setError("Escribe un monto válido.");
      return;
    }

    const validacion = validarTransferencia({
      cuenta_origen_id: origen,
      cuenta_destino_id: destino,
      montoCentavos,
    });
    if (validacion) {
      setError(validacion);
      return;
    }

    iniciar(async () => {
      const resultado = await transferirEntreCuentas({
        cuenta_origen_id: origen,
        cuenta_destino_id: destino,
        monto: centavosAValor(montoCentavos),
        fecha,
        ...(notas.trim() ? { descripcion: notas.trim() } : {}),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      if (resultado.aviso) {
        toast.add({ type: "warning", title: "Saldo negativo", description: resultado.aviso });
      }

      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={cambiarAbierto}>
      <DialogTrigger render={<Button variant="outline" disabled={sinCuentas} />}>
        <ArrowRightLeft />
        Transferir
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir entre cuentas</DialogTitle>
          <DialogDescription>Mueve dinero de una cuenta de caja o banco a otra.</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="transferencia-origen">Desde *</Label>
            <NativeSelect
              id="transferencia-origen"
              className="w-full"
              value={origen}
              onChange={(evento) => setOrigen(evento.target.value)}
              required
              disabled={pendiente}
            >
              <NativeSelectOption value="">Selecciona una cuenta…</NativeSelectOption>
              {opciones(cuentas)}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="transferencia-destino">Hacia *</Label>
            <NativeSelect
              id="transferencia-destino"
              className="w-full"
              value={destino}
              onChange={(evento) => setDestino(evento.target.value)}
              required
              disabled={pendiente}
            >
              <NativeSelectOption value="">Selecciona una cuenta…</NativeSelectOption>
              {opciones(cuentas)}
            </NativeSelect>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="transferencia-monto">Monto *</Label>
              <Input
                id="transferencia-monto"
                inputMode="decimal"
                placeholder="0.00"
                value={monto}
                onChange={(evento) => setMonto(evento.target.value)}
                required
                disabled={pendiente}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="transferencia-fecha">Fecha *</Label>
              <Input
                id="transferencia-fecha"
                type="date"
                value={fecha}
                onChange={(evento) => setFecha(evento.target.value)}
                required
                disabled={pendiente}
              />
            </div>
          </div>
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between border-t py-2 text-sm font-medium">
              Más opciones
              <ChevronDown className="size-4" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-col gap-2 pt-2">
                <Label htmlFor="transferencia-notas">Notas / descripción</Label>
                <Input
                  id="transferencia-notas"
                  placeholder="Ej. Paso de caja a banco"
                  value={notas}
                  onChange={(evento) => setNotas(evento.target.value)}
                  disabled={pendiente}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pendiente} />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? <Loader2 className="animate-spin" /> : null}
              Transferir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogoDeposito({
  cuentasDestino,
  cuentasContrapartida,
  fechaHoy,
}: {
  cuentasDestino: CuentaSeleccion[];
  cuentasContrapartida: CuentaSeleccion[];
  fechaHoy: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [destino, setDestino] = useState("");
  const [contrapartida, setContrapartida] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(fechaHoy);
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const sinCuentas = cuentasDestino.length === 0 || cuentasContrapartida.length < 2;

  function reiniciar() {
    setDestino("");
    setContrapartida("");
    setMonto("");
    setFecha(fechaHoy);
    setNotas("");
    setError(null);
  }

  function cambiarAbierto(abrir: boolean) {
    if (abrir) reiniciar();
    setAbierto(abrir);
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    const montoCentavos = parsearCentavos(monto);
    if (montoCentavos === null) {
      setError("Escribe un monto válido.");
      return;
    }

    const validacion = validarDeposito({
      cuenta_destino_id: destino,
      cuenta_contrapartida_id: contrapartida,
      montoCentavos,
    });
    if (validacion) {
      setError(validacion);
      return;
    }

    iniciar(async () => {
      const resultado = await registrarDeposito({
        cuenta_destino_id: destino,
        cuenta_contrapartida_id: contrapartida,
        monto: centavosAValor(montoCentavos),
        fecha,
        ...(notas.trim() ? { descripcion: notas.trim() } : {}),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      if (resultado.aviso) {
        toast.add({ type: "warning", title: "Saldo negativo", description: resultado.aviso });
      }

      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={cambiarAbierto}>
      <DialogTrigger render={<Button disabled={sinCuentas} />}>
        <Plus />
        Depósito
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar depósito</DialogTitle>
          <DialogDescription>Registra un ingreso o aporte a una cuenta de caja o banco.</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="deposito-destino">Cuenta destino *</Label>
            <NativeSelect
              id="deposito-destino"
              className="w-full"
              value={destino}
              onChange={(evento) => setDestino(evento.target.value)}
              required
              disabled={pendiente}
            >
              <NativeSelectOption value="">Selecciona una cuenta…</NativeSelectOption>
              {opciones(cuentasDestino)}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="deposito-contrapartida">Contrapartida *</Label>
            <NativeSelect
              id="deposito-contrapartida"
              className="w-full"
              value={contrapartida}
              onChange={(evento) => setContrapartida(evento.target.value)}
              required
              disabled={pendiente}
            >
              <NativeSelectOption value="">Selecciona una cuenta…</NativeSelectOption>
              {opciones(cuentasContrapartida)}
            </NativeSelect>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="deposito-monto">Monto *</Label>
              <Input
                id="deposito-monto"
                inputMode="decimal"
                placeholder="0.00"
                value={monto}
                onChange={(evento) => setMonto(evento.target.value)}
                required
                disabled={pendiente}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="deposito-fecha">Fecha *</Label>
              <Input
                id="deposito-fecha"
                type="date"
                value={fecha}
                onChange={(evento) => setFecha(evento.target.value)}
                required
                disabled={pendiente}
              />
            </div>
          </div>
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between border-t py-2 text-sm font-medium">
              Más opciones
              <ChevronDown className="size-4" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-col gap-2 pt-2">
                <Label htmlFor="deposito-notas">Notas / descripción</Label>
                <Input
                  id="deposito-notas"
                  placeholder="Ej. Aporte de capital"
                  value={notas}
                  onChange={(evento) => setNotas(evento.target.value)}
                  disabled={pendiente}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pendiente} />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? <Loader2 className="animate-spin" /> : null}
              Guardar depósito
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PanelBancos({ cuentas, cuentasCajaBanco, cuentasMovimiento, puedeEscribir, fechaHoy }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {puedeEscribir ? (
        <div className="flex flex-wrap justify-end gap-2">
          <DialogoTransferencia cuentas={cuentasCajaBanco} fechaHoy={fechaHoy} />
          <DialogoDeposito
            cuentasDestino={cuentasCajaBanco}
            cuentasContrapartida={cuentasMovimiento}
            fechaHoy={fechaHoy}
          />
        </div>
      ) : null}

      <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuenta</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cuentas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground py-10 text-center">
                  No hay cuentas de caja o banco configuradas.
                </TableCell>
              </TableRow>
            ) : (
              cuentas.map((cuenta) => {
                const saldoCentavos = centavos(cuenta.saldo);

                return (
                  <TableRow key={cuenta.id}>
                    <TableCell className="font-medium">
                      <Link className="hover:underline" href={rutaCuenta(cuenta.id)}>
                        {cuenta.nombre}
                      </Link>
                      <span className="text-muted-foreground ml-2 text-xs">{cuenta.codigo}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{tipoCuenta(cuenta.nombre)}</Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${saldoCentavos < 0 ? "text-destructive" : ""}`}
                    >
                      {formatearRd(saldoCentavos)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

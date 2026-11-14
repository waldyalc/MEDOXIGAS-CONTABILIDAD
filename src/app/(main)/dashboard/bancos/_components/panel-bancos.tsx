"use client";

import { type FormEvent, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowRightLeft, ChevronDown, Loader2, Plus } from "lucide-react";

import { DatePicker } from "@/components/date-picker";
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
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { crearCuentaBanco, registrarDeposito, transferirEntreCuentas } from "@/lib/bancos/acciones";
import { tipoCuenta } from "@/lib/bancos/formato";
import type { CuentaBanco, CuentaSeleccion } from "@/lib/bancos/tipos";
import { validarCuentaBanco, validarDeposito, validarTransferencia } from "@/lib/bancos/validacion";
import { rutaBanco, rutaConciliacion, rutaCuenta, rutaTransferencia } from "@/lib/enlaces";
import { centavosAValor, parsearCentavos } from "@/lib/facturacion/calculo";
import { formatoDia } from "@/lib/formato";
import { centavos, formatearRd } from "@/lib/reportes/dinero";

interface Props {
  cuentas: CuentaBanco[];
  cuentasCajaBanco: CuentaSeleccion[];
  cuentasMovimiento: CuentaSeleccion[];
  puedeEscribir: boolean;
  fechaHoy: string;
}

const TIPOS_CUENTA = [
  { value: "banco", label: "Banco" },
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
];

function opciones(cuentas: CuentaSeleccion[]) {
  return cuentas.map((cuenta) => ({ value: cuenta.id, label: `${cuenta.codigo} · ${cuenta.nombre}` }));
}

function DialogoNuevaCuenta({ fechaHoy }: { fechaHoy: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("banco");
  const [numeroCuenta, setNumeroCuenta] = useState("");
  const [saldo, setSaldo] = useState("");
  const [fecha, setFecha] = useState(fechaHoy);
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function reiniciar() {
    setNombre("");
    setTipo("banco");
    setNumeroCuenta("");
    setSaldo("");
    setFecha(fechaHoy);
    setDescripcion("");
    setError(null);
  }

  function cambiarAbierto(abrir: boolean) {
    if (abrir) reiniciar();
    setAbierto(abrir);
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    const saldoCentavos = parsearCentavos(saldo);
    if (saldoCentavos === null) {
      setError("Escribe un saldo inicial válido.");
      return;
    }

    const validacion = validarCuentaBanco({
      nombre,
      tipo_banco: tipo,
      saldoCentavos,
      fecha_saldo_inicial: fecha,
    });
    if (validacion) {
      setError(validacion);
      return;
    }

    iniciar(async () => {
      const resultado = await crearCuentaBanco({
        nombre: nombre.trim(),
        tipo_banco: tipo,
        saldo_inicial: centavosAValor(saldoCentavos),
        fecha_saldo_inicial: fecha,
        ...(numeroCuenta.trim() ? { numero_cuenta: numeroCuenta.trim() } : {}),
        ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setAbierto(false);
      router.push(rutaBanco(resultado.id));
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={cambiarAbierto}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Plus />
        Agregar banco
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar cuenta de banco o caja</DialogTitle>
          <DialogDescription>Crea la cuenta contable con su saldo inicial.</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cuenta-nombre">Nombre de la cuenta *</Label>
            <Input
              id="cuenta-nombre"
              placeholder="Ej. Banco Popular"
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
              maxLength={150}
              required
              disabled={pendiente}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cuenta-tipo">Tipo de cuenta *</Label>
              <Select
                items={TIPOS_CUENTA}
                value={tipo}
                onValueChange={(valor: string | null) => setTipo(valor ?? "banco")}
              >
                <SelectTrigger id="cuenta-tipo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {TIPOS_CUENTA.map((opcion) => (
                    <SelectItem key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cuenta-numero">Número de cuenta</Label>
              <Input
                id="cuenta-numero"
                placeholder="Opcional"
                value={numeroCuenta}
                onChange={(evento) => setNumeroCuenta(evento.target.value)}
                maxLength={60}
                disabled={pendiente}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cuenta-saldo">Saldo inicial *</Label>
              <InputGroup>
                <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
                  RD$
                </InputGroupAddon>
                <InputGroupInput
                  id="cuenta-saldo"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={saldo}
                  onChange={(evento) => setSaldo(evento.target.value)}
                  required
                  disabled={pendiente}
                />
              </InputGroup>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cuenta-fecha">Fecha de saldo inicial *</Label>
              <DatePicker id="cuenta-fecha" value={fecha} onChange={setFecha} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cuenta-descripcion">Descripción</Label>
            <Input
              id="cuenta-descripcion"
              placeholder="Opcional"
              value={descripcion}
              onChange={(evento) => setDescripcion(evento.target.value)}
              disabled={pendiente}
            />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pendiente} />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? <Loader2 className="animate-spin" /> : null}
              Crear cuenta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogoTransferencia({ cuentas, fechaHoy }: { cuentas: CuentaSeleccion[]; fechaHoy: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(fechaHoy);
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const sinCuentas = cuentas.length < 2;
  const cuentasItems = opciones(cuentas);

  function reiniciar() {
    setOrigen("");
    setDestino("");
    setMonto("");
    setFecha(fechaHoy);
    setObservaciones("");
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
        ...(observaciones.trim() ? { descripcion: observaciones.trim() } : {}),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      if (resultado.aviso) {
        toast.add({ type: "warning", title: "Saldo negativo", description: resultado.aviso });
      }

      setAbierto(false);
      router.push(rutaTransferencia(resultado.id));
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
            <Select
              items={cuentasItems}
              value={origen}
              onValueChange={(valor: string | null) => setOrigen(valor ?? "")}
            >
              <SelectTrigger id="transferencia-origen" className="w-full" disabled={pendiente}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {cuentasItems.map((cuenta) => (
                  <SelectItem key={cuenta.value} value={cuenta.value}>
                    {cuenta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="transferencia-destino">Hacia *</Label>
            <Select
              items={cuentasItems}
              value={destino}
              onValueChange={(valor: string | null) => setDestino(valor ?? "")}
            >
              <SelectTrigger id="transferencia-destino" className="w-full" disabled={pendiente}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {cuentasItems.map((cuenta) => (
                  <SelectItem key={cuenta.value} value={cuenta.value}>
                    {cuenta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="transferencia-monto">Monto *</Label>
              <InputGroup>
                <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
                  RD$
                </InputGroupAddon>
                <InputGroupInput
                  id="transferencia-monto"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={monto}
                  onChange={(evento) => setMonto(evento.target.value)}
                  required
                  disabled={pendiente}
                />
              </InputGroup>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="transferencia-fecha">Fecha *</Label>
              <DatePicker id="transferencia-fecha" value={fecha} onChange={setFecha} />
            </div>
          </div>
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between border-t py-2 text-sm font-medium">
              Más opciones
              <ChevronDown className="size-4" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-col gap-2 pt-2">
                <Label htmlFor="transferencia-observaciones">Observaciones</Label>
                <Textarea
                  id="transferencia-observaciones"
                  placeholder="Ej. Paso de caja a banco"
                  value={observaciones}
                  onChange={(evento) => setObservaciones(evento.target.value)}
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
  const destinos = opciones(cuentasDestino);
  const contrapartidas = opciones(cuentasContrapartida);

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
            <Select items={destinos} value={destino} onValueChange={(valor: string | null) => setDestino(valor ?? "")}>
              <SelectTrigger id="deposito-destino" className="w-full" disabled={pendiente}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {destinos.map((cuenta) => (
                  <SelectItem key={cuenta.value} value={cuenta.value}>
                    {cuenta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="deposito-contrapartida">Contrapartida *</Label>
            <Select
              items={contrapartidas}
              value={contrapartida}
              onValueChange={(valor: string | null) => setContrapartida(valor ?? "")}
            >
              <SelectTrigger id="deposito-contrapartida" className="w-full" disabled={pendiente}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {contrapartidas.map((cuenta) => (
                  <SelectItem key={cuenta.value} value={cuenta.value}>
                    {cuenta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="deposito-monto">Monto *</Label>
              <InputGroup>
                <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
                  RD$
                </InputGroupAddon>
                <InputGroupInput
                  id="deposito-monto"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={monto}
                  onChange={(evento) => setMonto(evento.target.value)}
                  required
                  disabled={pendiente}
                />
              </InputGroup>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="deposito-fecha">Fecha *</Label>
              <DatePicker id="deposito-fecha" value={fecha} onChange={setFecha} />
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

function ConciliacionCelda({ cuenta, puedeEscribir }: { cuenta: CuentaBanco; puedeEscribir: boolean }) {
  if (cuenta.conciliacion) {
    return (
      <Link href={rutaConciliacion(cuenta.conciliacion.id)} title={formatoDia(cuenta.conciliacion.fechaHasta)}>
        {cuenta.conciliacion.estado === "conciliada" ? (
          <Badge variant="secondary">Conciliada</Badge>
        ) : (
          <Badge variant="outline">Borrador</Badge>
        )}
      </Link>
    );
  }

  if (!puedeEscribir) return <span className="text-muted-foreground">—</span>;

  return (
    <Link
      href={`/dashboard/bancos/conciliaciones/nueva?cuenta=${cuenta.id}`}
      className="text-primary text-sm underline-offset-4 hover:underline"
    >
      Conciliar
    </Link>
  );
}

export function PanelBancos({ cuentas, cuentasCajaBanco, cuentasMovimiento, puedeEscribir, fechaHoy }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {puedeEscribir ? (
        <div className="flex flex-wrap justify-end gap-2">
          <DialogoNuevaCuenta fechaHoy={fechaHoy} />
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
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Número</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Conciliación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cuentas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                  No hay cuentas de caja o banco configuradas.
                </TableCell>
              </TableRow>
            ) : (
              cuentas.map((cuenta) => {
                const saldoCentavos = centavos(cuenta.saldo);

                return (
                  <TableRow key={cuenta.id}>
                    <TableCell className="font-medium">
                      <Link className="hover:underline" href={rutaBanco(cuenta.id)}>
                        {cuenta.nombre}
                      </Link>
                      <Link
                        className="text-muted-foreground ml-2 text-xs underline-offset-4 hover:underline"
                        href={rutaCuenta(cuenta.id)}
                      >
                        {cuenta.codigo}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{tipoCuenta(cuenta.nombre, cuenta.tipoBanco)}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{cuenta.numeroCuenta ?? "—"}</TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${saldoCentavos < 0 ? "text-destructive" : ""}`}
                    >
                      {formatearRd(saldoCentavos)}
                    </TableCell>
                    <TableCell>
                      <ConciliacionCelda cuenta={cuenta} puedeEscribir={puedeEscribir} />
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

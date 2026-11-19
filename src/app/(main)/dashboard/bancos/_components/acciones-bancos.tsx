"use client";

import { type FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { ArrowRightLeft, ChevronDown, Loader2, Plus } from "lucide-react";

import { DatePicker } from "@/components/date-picker";
import { CampoFormulario } from "@/components/formularios/campo-formulario";
import {
  FORM_BUTTON,
  FORM_INPUT,
  FORM_INPUT_GROUP,
  FORM_SELECT,
  FORM_TEXTAREA,
} from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { crearCuentaBanco, registrarDeposito, transferirEntreCuentas } from "@/lib/bancos/acciones";
import type { CuentaSeleccion } from "@/lib/bancos/tipos";
import { validarCuentaBanco, validarDeposito, validarTransferencia } from "@/lib/bancos/validacion";
import { rutaBanco, rutaTransferencia } from "@/lib/enlaces";
import { centavosAValor, parsearCentavos } from "@/lib/facturacion/calculo";
import { requerido } from "@/lib/formularios/validacion";

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
  const validacion = useValidacionFormulario();

  function reiniciar() {
    setNombre("");
    setTipo("banco");
    setNumeroCuenta("");
    setSaldo("");
    setFecha(fechaHoy);
    setDescripcion("");
    setError(null);
    validacion.limpiarTodo();
  }

  function cambiarAbierto(abrir: boolean) {
    if (abrir) reiniciar();
    setAbierto(abrir);
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    const saldoCentavos = parsearCentavos(saldo);
    if (
      !validacion.validar([
        requerido("cuenta-nombre", nombre, "El nombre de la cuenta es requerido."),
        requerido("cuenta-saldo", saldo, "El saldo inicial es requerido."),
        {
          campo: "cuenta-saldo",
          invalido: saldoCentavos === null,
          mensaje: "Escribe un saldo inicial válido.",
        },
        requerido("cuenta-fecha", fecha, "La fecha es requerida."),
      ])
    ) {
      return;
    }

    if (saldoCentavos === null) return;

    const problema = validarCuentaBanco({
      nombre,
      tipo_banco: tipo,
      saldoCentavos,
      fecha_saldo_inicial: fecha,
    });
    if (problema) {
      setError(problema);
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
        <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
          <CampoFormulario
            htmlFor="cuenta-nombre"
            label="Nombre de la cuenta"
            required
            error={validacion.errorDe("cuenta-nombre")}
          >
            <Input
              id="cuenta-nombre"
              placeholder="Ej. Banco Popular"
              value={nombre}
              onChange={(evento) => {
                setNombre(evento.target.value);
                validacion.limpiar("cuenta-nombre");
              }}
              maxLength={150}
              required
              disabled={pendiente}
              className={FORM_INPUT}
            />
          </CampoFormulario>
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <CampoFormulario htmlFor="cuenta-tipo" label="Tipo de cuenta" required>
              <Select
                items={TIPOS_CUENTA}
                value={tipo}
                onValueChange={(valor: string | null) => setTipo(valor ?? "banco")}
              >
                <SelectTrigger id="cuenta-tipo" className={FORM_SELECT}>
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
            </CampoFormulario>
            <CampoFormulario htmlFor="cuenta-numero" label="Número de cuenta">
              <Input
                id="cuenta-numero"
                placeholder="Opcional"
                value={numeroCuenta}
                onChange={(evento) => setNumeroCuenta(evento.target.value)}
                maxLength={60}
                disabled={pendiente}
                className={FORM_INPUT}
              />
            </CampoFormulario>
          </div>
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <CampoFormulario
              htmlFor="cuenta-saldo"
              label="Saldo inicial"
              required
              error={validacion.errorDe("cuenta-saldo")}
            >
              <InputGroup className={FORM_INPUT_GROUP}>
                <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
                  RD$
                </InputGroupAddon>
                <InputGroupInput
                  id="cuenta-saldo"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={saldo}
                  onChange={(evento) => {
                    setSaldo(evento.target.value);
                    validacion.limpiar("cuenta-saldo");
                  }}
                  required
                  disabled={pendiente}
                />
              </InputGroup>
            </CampoFormulario>
            <CampoFormulario
              htmlFor="cuenta-fecha"
              label="Fecha de saldo inicial"
              required
              error={validacion.errorDe("cuenta-fecha")}
            >
              <DatePicker
                id="cuenta-fecha"
                value={fecha}
                onChange={(valor) => {
                  setFecha(valor);
                  validacion.limpiar("cuenta-fecha");
                }}
              />
            </CampoFormulario>
          </div>
          <CampoFormulario htmlFor="cuenta-descripcion" label="Descripción">
            <Input
              id="cuenta-descripcion"
              placeholder="Opcional"
              value={descripcion}
              onChange={(evento) => setDescripcion(evento.target.value)}
              disabled={pendiente}
              className={FORM_INPUT}
            />
          </CampoFormulario>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={pendiente} className="h-11 rounded-[12px] px-6" />
              }
            >
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={pendiente} className={FORM_BUTTON}>
              {pendiente ? <Loader2 className="animate-spin" /> : null}
              Crear cuenta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DialogoTransferencia({
  cuentas,
  fechaHoy,
  origenInicial = "",
  abierto,
  onAbiertoChange,
}: {
  cuentas: CuentaSeleccion[];
  fechaHoy: string;
  /** Precarga "Desde" (usado al abrir desde la ficha de una cuenta). */
  origenInicial?: string;
  /** Controlado desde el menú de acciones; sin estas props se usa el botón propio. */
  abierto?: boolean;
  onAbiertoChange?: (abierto: boolean) => void;
}) {
  const router = useRouter();
  const [interno, setInterno] = useState(false);
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(fechaHoy);
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const validacion = useValidacionFormulario();
  const sinCuentas = cuentas.length < 2;
  const cuentasItems = opciones(cuentas);
  const abiertoActual = abierto ?? interno;

  function reiniciar() {
    setOrigen(origenInicial);
    setDestino("");
    setMonto("");
    setFecha(fechaHoy);
    setObservaciones("");
    setError(null);
    validacion.limpiarTodo();
  }

  function cambiarAbierto(abrir: boolean) {
    if (abrir) reiniciar();
    setInterno(abrir);
    onAbiertoChange?.(abrir);
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    const montoCentavos = parsearCentavos(monto);
    if (
      !validacion.validar([
        requerido("transferencia-origen", origen, "La cuenta de origen es requerida."),
        requerido("transferencia-destino", destino, "La cuenta de destino es requerida."),
        {
          campo: "transferencia-destino",
          invalido: origen !== "" && origen === destino,
          mensaje: "La cuenta de destino debe ser distinta a la de origen.",
        },
        requerido("transferencia-monto", monto, "El monto es requerido."),
        { campo: "transferencia-monto", invalido: montoCentavos === null, mensaje: "Escribe un monto válido." },
        {
          campo: "transferencia-monto",
          invalido: montoCentavos !== null && montoCentavos <= 0,
          mensaje: "El monto debe ser mayor que cero.",
        },
        requerido("transferencia-fecha", fecha, "La fecha es requerida."),
      ])
    ) {
      return;
    }

    if (montoCentavos === null) return;

    const problema = validarTransferencia({
      cuenta_origen_id: origen,
      cuenta_destino_id: destino,
      montoCentavos,
    });
    if (problema) {
      setError(problema);
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

      setInterno(false);
      onAbiertoChange?.(false);
      router.push(rutaTransferencia(resultado.id));
    });
  }

  return (
    <Dialog open={abiertoActual} onOpenChange={cambiarAbierto}>
      {abierto === undefined ? (
        <DialogTrigger render={<Button variant="outline" disabled={sinCuentas} />}>
          <ArrowRightLeft />
          Transferir
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir entre cuentas</DialogTitle>
          <DialogDescription>Mueve dinero de una cuenta de caja o banco a otra.</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
          <CampoFormulario
            htmlFor="transferencia-origen"
            label="Desde"
            required
            error={validacion.errorDe("transferencia-origen")}
          >
            <Select
              items={cuentasItems}
              value={origen}
              onValueChange={(valor: string | null) => {
                setOrigen(valor ?? "");
                validacion.limpiar("transferencia-origen");
              }}
            >
              <SelectTrigger id="transferencia-origen" className={FORM_SELECT} disabled={pendiente}>
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
          </CampoFormulario>
          <CampoFormulario
            htmlFor="transferencia-destino"
            label="Hacia"
            required
            error={validacion.errorDe("transferencia-destino")}
          >
            <Select
              items={cuentasItems}
              value={destino}
              onValueChange={(valor: string | null) => {
                setDestino(valor ?? "");
                validacion.limpiar("transferencia-destino");
              }}
            >
              <SelectTrigger id="transferencia-destino" className={FORM_SELECT} disabled={pendiente}>
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
          </CampoFormulario>
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <CampoFormulario
              htmlFor="transferencia-monto"
              label="Monto"
              required
              error={validacion.errorDe("transferencia-monto")}
            >
              <InputGroup className={FORM_INPUT_GROUP}>
                <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
                  RD$
                </InputGroupAddon>
                <InputGroupInput
                  id="transferencia-monto"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={monto}
                  onChange={(evento) => {
                    setMonto(evento.target.value);
                    validacion.limpiar("deposito-monto");
                  }}
                  required
                  disabled={pendiente}
                />
              </InputGroup>
            </CampoFormulario>
            <CampoFormulario
              htmlFor="transferencia-fecha"
              label="Fecha"
              required
              error={validacion.errorDe("transferencia-fecha")}
            >
              <DatePicker
                id="transferencia-fecha"
                value={fecha}
                onChange={(valor) => {
                  setFecha(valor);
                  validacion.limpiar("transferencia-fecha");
                }}
              />
            </CampoFormulario>
          </div>
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between border-t border-slate-200 py-2 text-sm font-medium">
              Más opciones
              <ChevronDown className="size-4" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pt-2">
                <CampoFormulario htmlFor="transferencia-observaciones" label="Observaciones">
                  <Textarea
                    id="transferencia-observaciones"
                    placeholder="Ej. Paso de caja a banco"
                    value={observaciones}
                    onChange={(evento) => setObservaciones(evento.target.value)}
                    disabled={pendiente}
                    className={FORM_TEXTAREA}
                  />
                </CampoFormulario>
              </div>
            </CollapsibleContent>
          </Collapsible>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={pendiente} className="h-11 rounded-[12px] px-6" />
              }
            >
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={pendiente} className={FORM_BUTTON}>
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
  const validacion = useValidacionFormulario();
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
    validacion.limpiarTodo();
  }

  function cambiarAbierto(abrir: boolean) {
    if (abrir) reiniciar();
    setAbierto(abrir);
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    const montoCentavos = parsearCentavos(monto);
    if (
      !validacion.validar([
        requerido("deposito-destino", destino, "La cuenta destino es requerida."),
        requerido("deposito-contrapartida", contrapartida, "La contrapartida es requerida."),
        requerido("deposito-monto", monto, "El monto es requerido."),
        { campo: "deposito-monto", invalido: montoCentavos === null, mensaje: "Escribe un monto válido." },
        {
          campo: "deposito-monto",
          invalido: montoCentavos !== null && montoCentavos <= 0,
          mensaje: "El monto debe ser mayor que cero.",
        },
        requerido("deposito-fecha", fecha, "La fecha es requerida."),
      ])
    ) {
      return;
    }

    if (montoCentavos === null) return;

    const problema = validarDeposito({
      cuenta_destino_id: destino,
      cuenta_contrapartida_id: contrapartida,
      montoCentavos,
    });
    if (problema) {
      setError(problema);
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
      <DialogTrigger render={<Button variant="outline" disabled={sinCuentas} />}>
        <Plus />
        Depósito
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar depósito</DialogTitle>
          <DialogDescription>Registra un ingreso o aporte a una cuenta de caja o banco.</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
          <CampoFormulario
            htmlFor="deposito-destino"
            label="Cuenta destino"
            required
            error={validacion.errorDe("deposito-destino")}
          >
            <Select
              items={destinos}
              value={destino}
              onValueChange={(valor: string | null) => {
                setDestino(valor ?? "");
                validacion.limpiar("deposito-destino");
              }}
            >
              <SelectTrigger id="deposito-destino" className={FORM_SELECT} disabled={pendiente}>
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
          </CampoFormulario>
          <CampoFormulario
            htmlFor="deposito-contrapartida"
            label="Contrapartida"
            required
            error={validacion.errorDe("deposito-contrapartida")}
          >
            <Select
              items={contrapartidas}
              value={contrapartida}
              onValueChange={(valor: string | null) => {
                setContrapartida(valor ?? "");
                validacion.limpiar("deposito-contrapartida");
              }}
            >
              <SelectTrigger id="deposito-contrapartida" className={FORM_SELECT} disabled={pendiente}>
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
          </CampoFormulario>
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <CampoFormulario
              htmlFor="deposito-monto"
              label="Monto"
              required
              error={validacion.errorDe("deposito-monto")}
            >
              <InputGroup className={FORM_INPUT_GROUP}>
                <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
                  RD$
                </InputGroupAddon>
                <InputGroupInput
                  id="deposito-monto"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={monto}
                  onChange={(evento) => {
                    setMonto(evento.target.value);
                    validacion.limpiar("deposito-monto");
                  }}
                  required
                  disabled={pendiente}
                />
              </InputGroup>
            </CampoFormulario>
            <CampoFormulario
              htmlFor="deposito-fecha"
              label="Fecha"
              required
              error={validacion.errorDe("deposito-fecha")}
            >
              <DatePicker
                id="deposito-fecha"
                value={fecha}
                onChange={(valor) => {
                  setFecha(valor);
                  validacion.limpiar("deposito-fecha");
                }}
              />
            </CampoFormulario>
          </div>
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between border-t border-slate-200 py-2 text-sm font-medium">
              Más opciones
              <ChevronDown className="size-4" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pt-2">
                <CampoFormulario htmlFor="deposito-notas" label="Notas / descripción">
                  <Input
                    id="deposito-notas"
                    placeholder="Ej. Aporte de capital"
                    value={notas}
                    onChange={(evento) => setNotas(evento.target.value)}
                    disabled={pendiente}
                    className={FORM_INPUT}
                  />
                </CampoFormulario>
              </div>
            </CollapsibleContent>
          </Collapsible>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={pendiente} className="h-11 rounded-[12px] px-6" />
              }
            >
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={pendiente} className={FORM_BUTTON}>
              {pendiente ? <Loader2 className="animate-spin" /> : null}
              Guardar depósito
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Botones del encabezado de Bancos y caja: transferir, depósito y nueva cuenta. */
export function AccionesBancos({
  cuentasCajaBanco,
  cuentasMovimiento,
  fechaHoy,
}: {
  cuentasCajaBanco: CuentaSeleccion[];
  cuentasMovimiento: CuentaSeleccion[];
  fechaHoy: string;
}) {
  return (
    <>
      <DialogoTransferencia cuentas={cuentasCajaBanco} fechaHoy={fechaHoy} />
      <DialogoDeposito cuentasDestino={cuentasCajaBanco} cuentasContrapartida={cuentasMovimiento} fechaHoy={fechaHoy} />
      <DialogoNuevaCuenta fechaHoy={fechaHoy} />
    </>
  );
}

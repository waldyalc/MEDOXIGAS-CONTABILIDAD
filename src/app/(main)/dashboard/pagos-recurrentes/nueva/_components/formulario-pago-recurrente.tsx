"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowLeft, X } from "lucide-react";

import { DatePicker } from "@/components/date-picker";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { aNumero, calcularLinea, desdeCentavos } from "@/lib/compras/calculo";
import { hoyEnRd } from "@/lib/compras/fechas";
import { formatoMoneda } from "@/lib/compras/formato";
import { elegirCuentaPagoPorDefecto } from "@/lib/compras/seleccion";
import { rutaPagoRecurrente } from "@/lib/enlaces";
import { crearPagoRecurrente } from "@/lib/pagos-recurrentes/acciones";
import type { OpcionesPagoRecurrente } from "@/lib/pagos-recurrentes/tipos";
import { esquemaPagoRecurrente } from "@/lib/pagos-recurrentes/validacion";

import { ComboboxCampo, type OpcionCombobox } from "../../../compras/_components/combobox-campo";

const OPCIONES_ITBIS = [
  { value: "18", label: "18 %" },
  { value: "16", label: "16 %" },
  { value: "0", label: "0 %" },
];

export function FormularioPagoRecurrente({ cuentasGasto, cuentasCajaBanco, contactos }: OpcionesPagoRecurrente) {
  const router = useRouter();
  const hoy = hoyEnRd();
  const [nombre, setNombre] = useState("");
  const [contactoId, setContactoId] = useState("");
  const [cuentaGastoId, setCuentaGastoId] = useState(cuentasGasto[0]?.id ?? "");
  const [cuentaPagoId, setCuentaPagoId] = useState(() => elegirCuentaPagoPorDefecto(cuentasCajaBanco));
  const [subtotal, setSubtotal] = useState("");
  const [itbisTasa, setItbisTasa] = useState("18");
  const [frecuencia, setFrecuencia] = useState("1");
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [vigenciaHasta, setVigenciaHasta] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const opcionesContactos: OpcionCombobox[] = contactos.map((contacto) => ({
    value: contacto.id,
    label: contacto.nombre,
    hint: contacto.rnc_cedula ?? undefined,
  }));

  const opcionesCuentasGasto = cuentasGasto.map((cuenta) => ({
    value: cuenta.id,
    label: `${cuenta.codigo} — ${cuenta.nombre}`,
  }));

  const opcionesCuentasPago = cuentasCajaBanco.map((cuenta) => ({
    value: cuenta.id,
    label: `${cuenta.codigo} — ${cuenta.nombre}`,
  }));

  const calculo = calcularLinea({ cantidad: 1, costo: subtotal, itbisTasa });

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    const entrada = {
      nombre,
      contacto_id: contactoId,
      cuenta_gasto_id: cuentaGastoId,
      cuenta_pago_id: cuentaPagoId,
      subtotal: aNumero(subtotal),
      itbis_tasa: aNumero(itbisTasa),
      frecuencia_meses: Math.trunc(aNumero(frecuencia)),
      fecha_inicio: fechaInicio,
      vigencia_hasta: vigenciaHasta,
      notas,
      activo: true,
    };

    const validacion = esquemaPagoRecurrente.safeParse(entrada);
    if (!validacion.success) {
      setError(validacion.error.issues[0]?.message ?? "Revisa los datos.");
      return;
    }

    iniciar(async () => {
      const resultado = await crearPagoRecurrente(entrada);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      router.push(rutaPagoRecurrente(resultado.id));
    });
  }

  return (
    <form onSubmit={enviar} className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit"
            render={<Link href="/dashboard/pagos-recurrentes" prefetch={false} />}
          >
            <ArrowLeft data-icon="inline-start" />
            Pagos recurrentes
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Nueva plantilla de pago</h1>
        </div>
        <Button type="submit" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar plantilla"}
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Datos del pago</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
              placeholder="Alquiler del local, luz, internet…"
              maxLength={120}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cuenta-gasto">Cuenta de gasto *</Label>
            <Select
              value={cuentaGastoId}
              items={opcionesCuentasGasto}
              onValueChange={(valor: string | null) => {
                if (valor) setCuentaGastoId(valor);
              }}
            >
              <SelectTrigger id="cuenta-gasto" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {opcionesCuentasGasto.map((opcion) => (
                  <SelectItem key={opcion.value} value={opcion.value}>
                    {opcion.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cuenta-pago">Cuenta de pago *</Label>
            <Select
              value={cuentaPagoId}
              items={opcionesCuentasPago}
              onValueChange={(valor: string | null) => {
                if (valor) setCuentaPagoId(valor);
              }}
            >
              <SelectTrigger id="cuenta-pago" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {opcionesCuentasPago.map((opcion) => (
                  <SelectItem key={opcion.value} value={opcion.value}>
                    {opcion.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="subtotal">Monto *</Label>
            <InputGroup>
              <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
                RD$
              </InputGroupAddon>
              <InputGroupInput
                id="subtotal"
                inputMode="decimal"
                value={subtotal}
                placeholder="0.00"
                onChange={(evento) => setSubtotal(evento.target.value)}
                required
              />
            </InputGroup>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="itbis">ITBIS</Label>
            <Select
              value={itbisTasa}
              items={OPCIONES_ITBIS}
              onValueChange={(valor: string | null) => {
                if (valor) setItbisTasa(valor);
              }}
            >
              <SelectTrigger id="itbis" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPCIONES_ITBIS.map((opcion) => (
                  <SelectItem key={opcion.value} value={opcion.value}>
                    {opcion.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fecha-inicio">Fecha de inicio *</Label>
            <DatePicker id="fecha-inicio" value={fechaInicio} onChange={setFechaInicio} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="frecuencia">Frecuencia (meses) *</Label>
            <Input
              id="frecuencia"
              inputMode="numeric"
              value={frecuencia}
              onChange={(evento) => setFrecuencia(evento.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="vigencia">Vigencia hasta (opcional)</Label>
              {vigenciaHasta ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setVigenciaHasta("")}
                >
                  <X data-icon="inline-start" />
                  Quitar
                </Button>
              ) : null}
            </div>
            <DatePicker id="vigencia" value={vigenciaHasta} onChange={setVigenciaHasta} placeholder="Sin vigencia" />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="contacto">Contacto (opcional)</Label>
            <ComboboxCampo
              id="contacto"
              opciones={opcionesContactos}
              valor={contactoId}
              onCambio={setContactoId}
              placeholder="Buscar proveedor…"
              vacio="No hay proveedores registrados."
            />
          </div>
          <Accordion className="sm:col-span-2">
            <AccordionItem value="mas" className="border-0">
              <AccordionTrigger>Más opciones</AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="notas">Observaciones</Label>
                  <Textarea
                    id="notas"
                    value={notas}
                    onChange={(evento) => setNotas(evento.target.value)}
                    placeholder="Detalle del gasto fijo"
                    maxLength={500}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="mx-auto flex w-full max-w-sm flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatoMoneda(desdeCentavos(calculo.subtotalCentavos))}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">ITBIS</span>
            <span className="tabular-nums">{formatoMoneda(desdeCentavos(calculo.itbisCentavos))}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-2 font-medium">
            <span>Total por periodo</span>
            <span className="tabular-nums">{formatoMoneda(desdeCentavos(calculo.totalCentavos))}</span>
          </div>
          <Button type="submit" className="mt-2" disabled={pendiente}>
            {pendiente ? "Guardando…" : "Guardar plantilla"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}

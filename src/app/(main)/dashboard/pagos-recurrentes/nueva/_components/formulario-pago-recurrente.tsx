"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowLeft, X } from "lucide-react";

import { DatePicker } from "@/components/date-picker";
import {
  FORM_BUTTON,
  FORM_INPUT,
  FORM_INPUT_GROUP,
  FORM_SELECT,
  FORM_TEXTAREA,
  FormActions,
  FormCard,
  FormField,
  FormSectionTitle,
  FormTotal,
} from "@/components/formularios/formulario";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
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
    <form onSubmit={enviar} className="mx-auto flex w-full max-w-[1040px] flex-col gap-6">
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
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FormCard>
        <section>
          <FormSectionTitle className="mb-4">Datos del pago</FormSectionTitle>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <FormField htmlFor="nombre" label="Nombre" required className="sm:col-span-2">
              <Input
                id="nombre"
                value={nombre}
                onChange={(evento) => setNombre(evento.target.value)}
                placeholder="Alquiler del local, luz, internet…"
                maxLength={120}
                required
                className={FORM_INPUT}
              />
            </FormField>
            <FormField htmlFor="cuenta-gasto" label="Cuenta de gasto" required>
              <Select
                value={cuentaGastoId}
                items={opcionesCuentasGasto}
                onValueChange={(valor: string | null) => {
                  if (valor) setCuentaGastoId(valor);
                }}
              >
                <SelectTrigger id="cuenta-gasto" className={FORM_SELECT}>
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
            </FormField>
            <FormField htmlFor="cuenta-pago" label="Cuenta de pago" required>
              <Select
                value={cuentaPagoId}
                items={opcionesCuentasPago}
                onValueChange={(valor: string | null) => {
                  if (valor) setCuentaPagoId(valor);
                }}
              >
                <SelectTrigger id="cuenta-pago" className={FORM_SELECT}>
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
            </FormField>
            <FormField htmlFor="subtotal" label="Monto" required>
              <InputGroup className={FORM_INPUT_GROUP}>
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
            </FormField>
            <FormField htmlFor="itbis" label="ITBIS">
              <Select
                value={itbisTasa}
                items={OPCIONES_ITBIS}
                onValueChange={(valor: string | null) => {
                  if (valor) setItbisTasa(valor);
                }}
              >
                <SelectTrigger id="itbis" className={FORM_SELECT}>
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
            </FormField>
            <FormField htmlFor="fecha-inicio" label="Fecha de inicio" required>
              <DatePicker id="fecha-inicio" value={fechaInicio} onChange={setFechaInicio} />
            </FormField>
            <FormField htmlFor="frecuencia" label="Frecuencia (meses)" required>
              <Input
                id="frecuencia"
                inputMode="numeric"
                value={frecuencia}
                onChange={(evento) => setFrecuencia(evento.target.value)}
                required
                className={FORM_INPUT}
              />
            </FormField>
            <FormField htmlFor="vigencia" label="Vigencia hasta (opcional)">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <DatePicker
                    id="vigencia"
                    value={vigenciaHasta}
                    onChange={setVigenciaHasta}
                    placeholder="Sin vigencia"
                  />
                </div>
                {vigenciaHasta ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setVigenciaHasta("")}
                    aria-label="Quitar la vigencia"
                  >
                    <X />
                  </Button>
                ) : null}
              </div>
            </FormField>
            <FormField htmlFor="contacto" label="Contacto (opcional)" className="sm:col-span-2">
              <ComboboxCampo
                id="contacto"
                opciones={opcionesContactos}
                valor={contactoId}
                onCambio={setContactoId}
                placeholder="Buscar proveedor…"
                vacio="No hay proveedores registrados."
              />
            </FormField>
            <Accordion className="sm:col-span-2">
              <AccordionItem value="mas" className="border-0">
                <AccordionTrigger>Más opciones</AccordionTrigger>
                <AccordionContent>
                  <FormField htmlFor="notas" label="Observaciones">
                    <Textarea
                      id="notas"
                      value={notas}
                      onChange={(evento) => setNotas(evento.target.value)}
                      placeholder="Detalle del gasto fijo"
                      maxLength={500}
                      className={FORM_TEXTAREA}
                    />
                  </FormField>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        <FormTotal>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatoMoneda(desdeCentavos(calculo.subtotalCentavos))}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">ITBIS</span>
            <span className="tabular-nums">{formatoMoneda(desdeCentavos(calculo.itbisCentavos))}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xl leading-7 font-semibold text-slate-900">
            <span>Total por periodo</span>
            <span className="tabular-nums">{formatoMoneda(desdeCentavos(calculo.totalCentavos))}</span>
          </div>
        </FormTotal>
      </FormCard>

      <FormActions>
        <Button
          type="button"
          variant="outline"
          className={FORM_BUTTON}
          render={<Link href="/dashboard/pagos-recurrentes" />}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente} className={FORM_BUTTON}>
          {pendiente ? "Guardando…" : "Guardar plantilla"}
        </Button>
      </FormActions>
    </form>
  );
}

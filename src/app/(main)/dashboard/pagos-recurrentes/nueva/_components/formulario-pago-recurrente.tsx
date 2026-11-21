"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { DatePicker } from "@/components/date-picker";
import { CampoFormulario } from "@/components/formularios/campo-formulario";
import {
  FORM_BUTTON,
  FORM_INPUT,
  FORM_INPUT_GROUP,
  FORM_SELECT,
  FORM_TEXTAREA,
  FormActions,
  FormCard,
  FormSectionTitle,
  FormTotal,
} from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { ArrowLeft, X } from "@/components/icons";
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
import { requerido } from "@/lib/formularios/validacion";
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
  const validacion = useValidacionFormulario();

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

    if (
      !validacion.validar([
        requerido("nombre", nombre, "El nombre es requerido."),
        requerido("cuenta-gasto", cuentaGastoId, "La cuenta de gasto es requerida."),
        requerido("cuenta-pago", cuentaPagoId, "La cuenta de pago es requerida."),
        requerido("subtotal", subtotal, "El monto es requerido."),
        {
          campo: "subtotal",
          invalido: !Number.isFinite(aNumero(subtotal)) || aNumero(subtotal) <= 0,
          mensaje: "El monto debe ser mayor que cero.",
        },
        requerido("fecha-inicio", fechaInicio, "La fecha de inicio es requerida."),
        requerido("frecuencia", frecuencia, "La frecuencia es requerida."),
        {
          campo: "frecuencia",
          invalido: !Number.isFinite(Number(frecuencia)) || Number(frecuencia) <= 0,
          mensaje: "La frecuencia debe ser mayor que cero.",
        },
      ])
    ) {
      return;
    }

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

    const resultadoValidacion = esquemaPagoRecurrente.safeParse(entrada);
    if (!resultadoValidacion.success) {
      setError(resultadoValidacion.error.issues[0]?.message ?? "Revisa los datos.");
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
    <form noValidate onSubmit={enviar} className="mx-auto flex w-full max-w-[1040px] flex-col gap-6">
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
            <CampoFormulario
              htmlFor="nombre"
              label="Nombre"
              required
              error={validacion.errorDe("nombre")}
              className="sm:col-span-2"
            >
              <Input
                id="nombre"
                value={nombre}
                onChange={(evento) => {
                  setNombre(evento.target.value);
                  validacion.limpiar("nombre");
                }}
                placeholder="Alquiler del local, luz, internet…"
                maxLength={120}
                required
                className={FORM_INPUT}
              />
            </CampoFormulario>
            <CampoFormulario
              htmlFor="cuenta-gasto"
              label="Cuenta de gasto"
              required
              error={validacion.errorDe("cuenta-gasto")}
            >
              <Select
                value={cuentaGastoId}
                items={opcionesCuentasGasto}
                onValueChange={(valor: string | null) => {
                  if (valor) {
                    setCuentaGastoId(valor);
                    validacion.limpiar("cuenta-gasto");
                  }
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
            </CampoFormulario>
            <CampoFormulario
              htmlFor="cuenta-pago"
              label="Cuenta de pago"
              required
              error={validacion.errorDe("cuenta-pago")}
            >
              <Select
                value={cuentaPagoId}
                items={opcionesCuentasPago}
                onValueChange={(valor: string | null) => {
                  if (valor) {
                    setCuentaPagoId(valor);
                    validacion.limpiar("cuenta-pago");
                  }
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
            </CampoFormulario>
            <CampoFormulario htmlFor="subtotal" label="Monto" required error={validacion.errorDe("subtotal")}>
              <InputGroup className={FORM_INPUT_GROUP}>
                <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
                  RD$
                </InputGroupAddon>
                <InputGroupInput
                  id="subtotal"
                  inputMode="decimal"
                  value={subtotal}
                  placeholder="0.00"
                  onChange={(evento) => {
                    setSubtotal(evento.target.value);
                    validacion.limpiar("subtotal");
                  }}
                  required
                />
              </InputGroup>
            </CampoFormulario>
            <CampoFormulario htmlFor="itbis" label="ITBIS">
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
            </CampoFormulario>
            <CampoFormulario
              htmlFor="fecha-inicio"
              label="Fecha de inicio"
              required
              error={validacion.errorDe("fecha-inicio")}
            >
              <DatePicker
                id="fecha-inicio"
                value={fechaInicio}
                onChange={(valor) => {
                  setFechaInicio(valor);
                  validacion.limpiar("fecha-inicio");
                }}
              />
            </CampoFormulario>
            <CampoFormulario
              htmlFor="frecuencia"
              label="Frecuencia (meses)"
              required
              error={validacion.errorDe("frecuencia")}
            >
              <Input
                id="frecuencia"
                inputMode="numeric"
                value={frecuencia}
                onChange={(evento) => {
                  setFrecuencia(evento.target.value);
                  validacion.limpiar("frecuencia");
                }}
                required
                className={FORM_INPUT}
              />
            </CampoFormulario>
            <CampoFormulario htmlFor="vigencia" label="Vigencia hasta (opcional)">
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
            </CampoFormulario>
            <CampoFormulario htmlFor="contacto" label="Contacto (opcional)" className="sm:col-span-2">
              <ComboboxCampo
                id="contacto"
                opciones={opcionesContactos}
                valor={contactoId}
                onCambio={setContactoId}
                placeholder="Buscar proveedor…"
                vacio="No hay proveedores registrados."
              />
            </CampoFormulario>
            <Accordion className="sm:col-span-2">
              <AccordionItem value="mas" className="border-0">
                <AccordionTrigger>Más opciones</AccordionTrigger>
                <AccordionContent>
                  <CampoFormulario htmlFor="notas" label="Observaciones">
                    <Textarea
                      id="notas"
                      value={notas}
                      onChange={(evento) => setNotas(evento.target.value)}
                      placeholder="Detalle del gasto fijo"
                      maxLength={500}
                      className={FORM_TEXTAREA}
                    />
                  </CampoFormulario>
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

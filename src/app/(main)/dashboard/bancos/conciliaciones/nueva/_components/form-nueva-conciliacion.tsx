"use client";

import { type FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { DatePicker } from "@/components/date-picker";
import { CampoFormulario } from "@/components/formularios/campo-formulario";
import {
  FORM_BUTTON,
  FORM_INPUT_GROUP,
  FORM_SELECT,
  FormActions,
  FormCard,
  FormSectionTitle,
} from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { Info, Loader2 } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { iniciarConciliacion } from "@/lib/bancos/acciones";
import type { CuentaSeleccion } from "@/lib/bancos/tipos";
import { rutaConciliacion } from "@/lib/enlaces";
import { centavosAValor, parsearCentavos } from "@/lib/facturacion/calculo";
import { requerido } from "@/lib/formularios/validacion";

interface Props {
  cuentas: CuentaSeleccion[];
  borradores: Record<string, string>;
  cuentaInicial: string;
  fechaHoy: string;
}

export function FormNuevaConciliacion({ cuentas, borradores, cuentaInicial, fechaHoy }: Props) {
  const router = useRouter();
  const [cuentaId, setCuentaId] = useState(cuentaInicial);
  const [fechaCorte, setFechaCorte] = useState(fechaHoy);
  const [saldo, setSaldo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const validacion = useValidacionFormulario();

  const opciones = cuentas.map((cuenta) => ({
    value: cuenta.id,
    label: `${cuenta.codigo} · ${cuenta.nombre}`,
  }));
  const borrador = cuentaId ? borradores[cuentaId] : undefined;

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    const saldoCentavos = parsearCentavos(saldo);
    if (
      !validacion.validar([
        requerido("conciliacion-cuenta", cuentaId, "La cuenta es requerida."),
        requerido("conciliacion-fecha", fechaCorte, "La fecha de corte es requerida."),
        requerido("conciliacion-saldo", saldo, "El saldo del extracto es requerido."),
        {
          campo: "conciliacion-saldo",
          invalido: saldoCentavos === null,
          mensaje: "Escribe el saldo del extracto.",
        },
      ])
    ) {
      return;
    }

    if (saldoCentavos === null) return;

    iniciar(async () => {
      const resultado = await iniciarConciliacion({
        cuenta_id: cuentaId,
        fecha_hasta: fechaCorte,
        saldo_bancario: centavosAValor(saldoCentavos),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      router.push(rutaConciliacion(resultado.id));
    });
  }

  return (
    <form noValidate onSubmit={enviar} className="mx-auto flex w-full max-w-[1040px] flex-col gap-6">
      <FormCard>
        <section>
          <FormSectionTitle className="mb-4">Datos de la conciliación</FormSectionTitle>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <CampoFormulario
              htmlFor="conciliacion-cuenta"
              label="Cuenta"
              required
              error={validacion.errorDe("conciliacion-cuenta")}
              className="sm:col-span-2"
            >
              <Select
                items={opciones}
                value={cuentaId}
                onValueChange={(valor: string | null) => {
                  setCuentaId(valor ?? "");
                  validacion.limpiar("conciliacion-cuenta");
                }}
              >
                <SelectTrigger id="conciliacion-cuenta" className={FORM_SELECT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {opciones.map((opcion) => (
                    <SelectItem key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CampoFormulario>

            <CampoFormulario
              htmlFor="conciliacion-fecha"
              label="Fecha de corte"
              required
              error={validacion.errorDe("conciliacion-fecha")}
            >
              <DatePicker
                id="conciliacion-fecha"
                value={fechaCorte}
                onChange={(valor) => {
                  setFechaCorte(valor);
                  validacion.limpiar("conciliacion-fecha");
                }}
              />
            </CampoFormulario>

            <CampoFormulario
              htmlFor="conciliacion-saldo"
              label="Saldo del extracto"
              required
              error={validacion.errorDe("conciliacion-saldo")}
            >
              <InputGroup className={FORM_INPUT_GROUP}>
                <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
                  RD$
                </InputGroupAddon>
                <InputGroupInput
                  id="conciliacion-saldo"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={saldo}
                  onChange={(evento) => {
                    setSaldo(evento.target.value);
                    validacion.limpiar("conciliacion-saldo");
                  }}
                  required
                  disabled={pendiente}
                />
              </InputGroup>
            </CampoFormulario>

            <p className="text-muted-foreground text-sm sm:col-span-2">
              Los movimientos se toman desde el día siguiente al último corte conciliado. Si es la primera conciliación,
              desde el primer movimiento de la cuenta.
            </p>
          </div>
        </section>
      </FormCard>

      {borrador ? (
        <Alert>
          <Info />
          <AlertTitle>Ya hay un borrador para esta cuenta</AlertTitle>
          <AlertDescription>
            Al continuar se abrirá la conciliación en borrador para que marques sus movimientos.
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FormActions>
        <Button
          type="button"
          variant="outline"
          className={FORM_BUTTON}
          onClick={() => router.push("/dashboard/bancos/conciliaciones")}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente || cuentas.length === 0} className={FORM_BUTTON}>
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          {borrador ? "Continuar borrador" : "Crear conciliación"}
        </Button>
      </FormActions>
    </form>
  );
}
